/**
 * Edge length sent to the backend – the maximum of its upload contract.
 * Twice its largest stored size (256 px), so its re-encoding still has detail to work with.
 */
const UPLOAD_SIZE = 512
const JPEG_QUALITY = 0.9

/**
 * Center-crops an image file to a square and scales it down before the upload
 * (saves bandwidth). The backend re-encodes it anyway.
 */
export async function resizePhoto(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image.')
  let bitmap: ImageBitmap
  try {
    // Respects EXIF orientation of phone photos.
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new Error("Couldn't read this image.")
  }

  const side = Math.min(bitmap.width, bitmap.height)
  const size = Math.min(UPLOAD_SIZE, side)
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error("Couldn't process this image.")
  // JPEG has no transparency – otherwise transparent areas turn black.
  ctx.fillStyle = 'white'
  ctx.fillRect(0, 0, size, size)
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size)
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY))
  if (!blob) throw new Error("Couldn't process this image.")
  return blob
}
