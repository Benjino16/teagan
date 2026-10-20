//! Second factor via TOTP (RFC 6238) and recovery codes.
//! SHA-1, 6 digits, 30 s – what every authenticator app understands.

use qrcode::{QrCode, render::svg};
use totp_rs::{Builder, Secret, Totp};

use super::hash_token;

const ISSUER: &str = "Teagan";
const RECOVERY_CODE_COUNT: usize = 10;
/// Without 0/o, 1/l/i – easy to read off a printout.
const RECOVERY_ALPHABET: &[u8] = b"23456789abcdefghjkmnpqrstuvwxyz";

/// A new secret (160 bits) as base32, the form the database stores.
pub fn new_totp_secret() -> String {
    Secret::generate().to_base32()
}

fn totp(secret: &str, username: &str) -> anyhow::Result<Totp> {
    let secret = Secret::try_from_base32(secret)
        .map_err(|err| anyhow::anyhow!("bad TOTP secret: {err:?}"))?;
    Builder::new()
        .with_secret(secret)
        .with_account_name(username)
        .with_issuer(Some(ISSUER))
        .build()
        .map_err(|err| anyhow::anyhow!("cannot set up TOTP: {err:?}"))
}

/// What the authenticator app needs: the `otpauth://` link and it as a QR code.
pub struct TotpSetup {
    pub url: String,
    pub qr_svg: String,
}

pub fn totp_setup(secret: &str, username: &str) -> anyhow::Result<TotpSetup> {
    let url = totp(secret, username)?
        .to_url()
        .map_err(|err| anyhow::anyhow!("cannot build otpauth URL: {err:?}"))?;
    // Black on white with a quiet zone – scanners need the contrast, also in dark mode
    let qr_svg = QrCode::new(url.as_bytes())?
        .render::<svg::Color>()
        .min_dimensions(200, 200)
        .dark_color(svg::Color("#000000"))
        .light_color(svg::Color("#ffffff"))
        .build();
    Ok(TotpSetup { url, qr_svg })
}

/// The time step the code belongs to, if it is right for now ± 30 s. The
/// caller must accept each step only once (`last_used_step`).
pub fn totp_step(secret: &str, code: &str, unix_time: u64) -> anyhow::Result<Option<i64>> {
    // The username only matters for the QR code
    let step = totp(secret, "-")?.check(code, unix_time);
    Ok(step.and_then(|step| i64::try_from(step).ok()))
}

/// A code as typed: spaces and dashes don't matter, letters in any case.
pub fn normalize_code(code: &str) -> String {
    code.chars()
        .filter(|c| !c.is_whitespace() && *c != '-')
        .flat_map(char::to_lowercase)
        .collect()
}

/// Six digits are a TOTP code, anything else may be a recovery code.
pub fn is_totp_code(normalized: &str) -> bool {
    normalized.len() == 6 && normalized.chars().all(|c| c.is_ascii_digit())
}

/// New recovery codes like `k7m2p-x9qa4` (50 bits each), shown once;
/// the database keeps only `hash_recovery_code` of them.
pub fn new_recovery_codes() -> anyhow::Result<Vec<String>> {
    (0..RECOVERY_CODE_COUNT)
        .map(|_| {
            let mut bytes = [0u8; 10];
            getrandom::fill(&mut bytes).map_err(|err| anyhow::anyhow!("no randomness: {err}"))?;
            let chars: String = bytes
                .iter()
                .map(|b| RECOVERY_ALPHABET[*b as usize % RECOVERY_ALPHABET.len()] as char)
                .collect();
            Ok(format!("{}-{}", &chars[..5], &chars[5..]))
        })
        .collect()
}

/// Of the normalized code, so `K7M2P X9QA4` matches `k7m2p-x9qa4`.
pub fn hash_recovery_code(code: &str) -> String {
    hash_token(&normalize_code(code))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn code_from_now_is_accepted_with_its_step() {
        let secret = new_totp_secret();
        let now = 1_800_000_000;
        let code = totp(&secret, "ben").unwrap().generate(now).to_string();
        assert_eq!(totp_step(&secret, &code, now).unwrap(), Some(60_000_000));
        // One step late is fine, two are not
        assert_eq!(
            totp_step(&secret, &code, now + 30).unwrap(),
            Some(60_000_000)
        );
        assert_eq!(totp_step(&secret, &code, now + 60).unwrap(), None);
        assert_eq!(
            totp_step(&secret, "000000", now).unwrap().is_some(),
            code == "000000"
        );
    }

    #[test]
    fn setup_has_issuer_account_and_svg() {
        let setup = totp_setup(&new_totp_secret(), "ben").unwrap();
        assert!(setup.url.starts_with("otpauth://totp/Teagan:ben?"));
        assert!(setup.url.contains("issuer=Teagan"));
        assert!(setup.qr_svg.contains("<svg"));
    }

    #[test]
    fn codes_are_normalized_and_told_apart() {
        assert_eq!(normalize_code(" 123 456 "), "123456");
        assert_eq!(normalize_code("K7M2P-X9QA4"), "k7m2px9qa4");
        assert!(is_totp_code("123456"));
        assert!(!is_totp_code("12345"));
        assert!(!is_totp_code("k7m2px9qa4"));
    }

    #[test]
    fn recovery_codes_are_unique_readable_and_hash_like_typed() {
        let codes = new_recovery_codes().unwrap();
        assert_eq!(codes.len(), 10);
        assert!(
            codes
                .iter()
                .all(|c| c.len() == 11 && c.as_bytes()[5] == b'-')
        );
        let unique: std::collections::HashSet<_> = codes.iter().collect();
        assert_eq!(unique.len(), 10);
        assert_eq!(
            hash_recovery_code(&codes[0]),
            hash_recovery_code(&codes[0].to_uppercase().replace('-', " "))
        );
    }
}
