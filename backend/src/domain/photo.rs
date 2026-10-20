use std::io::Cursor;

use image::{
    DynamicImage, ImageDecoder, ImageError, ImageReader, Limits, codecs::jpeg::JpegEncoder,
    imageops::FilterType,
};
use serde::{Deserialize, Serialize};

use crate::error::{AppError, AppResult};

/// Upload contract: clients scale down to at most 512 px
/// themselves, so the backend only ever decodes small images.
/// A 512 px JPEG is ≈ 50 KB; the limit leaves room for PNG.
pub const MAX_UPLOAD_BYTES: usize = 1024 * 1024;

/// Checked *before* decoding: a tiny PNG can claim a huge size and expand to
/// hundreds of MB of pixels. Raising it (public API) raises the
/// memory per upload quadratically – 4096 px measured ~150 MB.
const MAX_DIMENSION: u32 = 512;
/// RGBA at the maximum size, 1 MB. An EXIF rotation briefly needs a second copy.
const MAX_DECODE_BYTES: u64 = MAX_DIMENSION as u64 * MAX_DIMENSION as u64 * 4;

/// Photos decoded at the same time. At 512 px each takes only a few MB; kept so
/// the memory stays capped if `MAX_DIMENSION` is ever raised.
pub const MAX_PARALLEL_PHOTOS: usize = 2;

const THUMB_PX: u32 = 128;
const LARGE_PX: u32 = 256;
const JPEG_QUALITY: u8 = 80;

/// The two stored derivatives, see `person_photos` in the schema.
#[derive(Clone, Copy, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PhotoSize {
    Thumb,
    Large,
}

/// Re-encoded photo, ready to store. The original upload is never kept.
pub struct ProcessedPhoto {
    pub hash: String,
    pub thumb: Vec<u8>,
    pub large: Vec<u8>,
}

/// Decodes an uploaded JPEG, PNG or WebP, crops it to a centered square and
/// re-encodes it as two JPEGs. Re-encoding also drops metadata like GPS.
///
/// CPU-heavy (tens to hundreds of ms) – call it via `spawn_blocking`.
pub fn process_photo(bytes: &[u8]) -> AppResult<ProcessedPhoto> {
    let image = decode(bytes).map_err(|err| match err {
        // Broken, unsupported or oversized input is the client's fault
        ImageError::Decoding(_)
        | ImageError::Unsupported(_)
        | ImageError::Limits(_)
        | ImageError::IoError(_) => AppError::Invalid("photo: unreadable or too large".to_string()),
        other => AppError::Internal(other.into()),
    })?;

    // Scale the big upload only once; the thumb comes from the small result
    let large = square(&image, LARGE_PX);
    let thumb = square(&large, THUMB_PX);
    let thumb = encode(&thumb).map_err(|err| AppError::Internal(err.into()))?;
    let large = encode(&large).map_err(|err| AppError::Internal(err.into()))?;
    // Only for cache busting – 64 bits are plenty
    let hash = blake3::hash(&large).to_hex()[..16].to_string();

    Ok(ProcessedPhoto { hash, thumb, large })
}

fn decode(bytes: &[u8]) -> Result<DynamicImage, ImageError> {
    // The format comes from the magic bytes, not from a header the client sends
    let mut reader = ImageReader::new(Cursor::new(bytes)).with_guessed_format()?;
    let mut limits = Limits::default();
    limits.max_image_width = Some(MAX_DIMENSION);
    limits.max_image_height = Some(MAX_DIMENSION);
    limits.max_alloc = Some(MAX_DECODE_BYTES);
    reader.limits(limits);

    // Phone photos are often stored sideways with an EXIF rotation tag
    let mut decoder = reader.into_decoder()?;
    let orientation = decoder.orientation()?;
    let mut image = DynamicImage::from_decoder(decoder)?;
    image.apply_orientation(orientation);
    Ok(image)
}

/// Center crop and scale in one step.
fn square(image: &DynamicImage, size: u32) -> DynamicImage {
    image.resize_to_fill(size, size, FilterType::Lanczos3)
}

fn encode(image: &DynamicImage) -> Result<Vec<u8>, ImageError> {
    // JPEG has no alpha channel
    let rgb = image.to_rgb8();
    let mut out = Vec::new();
    JpegEncoder::new_with_quality(&mut out, JPEG_QUALITY).encode_image(&rgb)?;
    Ok(out)
}

/// Where the frontend loads the photo. The hash makes the URL change with the
/// photo, so it can be cached forever.
#[derive(Debug, Serialize)]
pub struct PhotoUrls {
    pub thumb: String,
    pub large: String,
}

impl PhotoUrls {
    pub fn new(person_id: i64, hash: &str) -> Self {
        let url = |size| format!("/api/people/{person_id}/photo/{size}?v={hash}");
        Self {
            thumb: url("thumb"),
            large: url("large"),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{ImageFormat, Rgb, RgbImage};

    fn png(width: u32, height: u32, pixel: impl Fn(u32, u32) -> Rgb<u8>) -> Vec<u8> {
        let image = RgbImage::from_fn(width, height, pixel);
        let mut out = Cursor::new(Vec::new());
        image.write_to(&mut out, ImageFormat::Png).unwrap();
        out.into_inner()
    }

    fn dimensions(jpeg: &[u8]) -> (u32, u32) {
        let image = image::load_from_memory_with_format(jpeg, ImageFormat::Jpeg).unwrap();
        (image.width(), image.height())
    }

    fn invalid_message(bytes: &[u8]) -> String {
        match process_photo(bytes) {
            Err(AppError::Invalid(message)) => message,
            Err(other) => panic!("expected Invalid, got {other:?}"),
            Ok(_) => panic!("expected Invalid, got a photo"),
        }
    }

    #[test]
    fn crops_to_squares_of_both_sizes() {
        let photo = process_photo(&png(500, 300, |_, _| Rgb([200, 100, 50]))).unwrap();
        assert_eq!(dimensions(&photo.thumb), (128, 128));
        assert_eq!(dimensions(&photo.large), (256, 256));
    }

    #[test]
    fn keeps_the_center() {
        // Left and right thirds red, middle blue: after the crop only blue remains
        let bytes = png(480, 160, |x, _| {
            if (160..320).contains(&x) {
                Rgb([0, 0, 255])
            } else {
                Rgb([255, 0, 0])
            }
        });
        let photo = process_photo(&bytes).unwrap();
        let image = image::load_from_memory(&photo.large).unwrap().to_rgb8();
        for x in [5, 128, 250] {
            let Rgb([r, _, b]) = *image.get_pixel(x, 128);
            assert!(
                b > 200 && r < 50,
                "pixel {x} should be blue, got r={r} b={b}"
            );
        }
    }

    /// Noise is the worst case for JPEG – it must still fit the CHECKs in the schema.
    #[test]
    fn noise_fits_the_schema_limits() {
        let mut state: u32 = 1;
        let mut next = || {
            state = state.wrapping_mul(1_103_515_245).wrapping_add(12_345);
            (state >> 16) as u8
        };
        let noise: Vec<[u8; 3]> = (0..512 * 512).map(|_| [next(), next(), next()]).collect();
        let photo =
            process_photo(&png(512, 512, |x, y| Rgb(noise[(y * 512 + x) as usize]))).unwrap();
        assert!(
            photo.thumb.len() <= 50_000,
            "thumb has {} bytes",
            photo.thumb.len()
        );
        assert!(
            photo.large.len() <= 200_000,
            "large has {} bytes",
            photo.large.len()
        );
    }

    #[test]
    fn hash_follows_the_content() {
        let red = process_photo(&png(10, 10, |_, _| Rgb([255, 0, 0]))).unwrap();
        let red_again = process_photo(&png(10, 10, |_, _| Rgb([255, 0, 0]))).unwrap();
        let blue = process_photo(&png(10, 10, |_, _| Rgb([0, 0, 255]))).unwrap();
        assert_eq!(red.hash, red_again.hash);
        assert_ne!(red.hash, blue.hash);
        assert_eq!(red.hash.len(), 16);
    }

    #[test]
    fn rejects_garbage() {
        assert_eq!(
            invalid_message(b"definitely not an image"),
            "photo: unreadable or too large"
        );
        assert_eq!(invalid_message(b""), "photo: unreadable or too large");
    }

    #[test]
    fn rejects_truncated_image() {
        let bytes = png(200, 200, |x, y| Rgb([x as u8, y as u8, 0]));
        invalid_message(&bytes[..bytes.len() / 2]);
    }

    #[test]
    fn accepts_the_contract_size() {
        assert!(process_photo(&png(MAX_DIMENSION, MAX_DIMENSION, |_, _| Rgb([0, 0, 0]))).is_ok());
    }

    #[test]
    fn rejects_dimensions_before_decoding() {
        invalid_message(&png(MAX_DIMENSION + 1, 1, |_, _| Rgb([0, 0, 0])));
        invalid_message(&png(1, MAX_DIMENSION + 1, |_, _| Rgb([0, 0, 0])));
    }

    #[test]
    fn urls_carry_the_hash() {
        let urls = PhotoUrls::new(12, "abc");
        assert_eq!(urls.thumb, "/api/people/12/photo/thumb?v=abc");
        assert_eq!(urls.large, "/api/people/12/photo/large?v=abc");
    }
}
