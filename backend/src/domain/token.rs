/// A new random token for a cookie: 32 bytes as hex. Only the client keeps
/// it, the database stores `hash_token` of it.
pub fn new_token() -> anyhow::Result<String> {
    let mut bytes = [0u8; 32];
    getrandom::fill(&mut bytes).map_err(|err| anyhow::anyhow!("no randomness: {err}"))?;
    Ok(bytes.iter().map(|b| format!("{b:02x}")).collect())
}

/// What the database stores instead of the token, so a leaked database
/// holds no usable sessions. The token has 256 random bits, so a fast hash
/// is enough – unlike passwords, it cannot be guessed.
pub fn hash_token(token: &str) -> String {
    blake3::hash(token.as_bytes()).to_hex().to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tokens_are_random_hex() {
        let first = new_token().unwrap();
        assert_eq!(first.len(), 64);
        assert!(first.chars().all(|c| c.is_ascii_hexdigit()));
        assert_ne!(first, new_token().unwrap());
    }

    #[test]
    fn hash_is_stable_and_differs_from_token() {
        assert_eq!(hash_token("abc"), hash_token("abc"));
        assert_ne!(hash_token("abc"), "abc");
        assert_ne!(hash_token("abc"), hash_token("abd"));
    }
}
