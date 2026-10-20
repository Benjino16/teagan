//! Rebuilds when the frontend build changes, so `src/http/frontend.rs` embeds
//! the current `frontend/dist` – including when it appears after a build
//! without it.

use std::path::Path;

fn main() {
    let dist = Path::new("../frontend/dist");
    println!("cargo:rerun-if-changed={}", dist.display());

    if !dist.join("index.html").exists() {
        println!(
            "cargo:warning=frontend/dist is missing – the binary serves only the API. \
             Run `npm run build` in frontend/ first."
        );
    }
}
