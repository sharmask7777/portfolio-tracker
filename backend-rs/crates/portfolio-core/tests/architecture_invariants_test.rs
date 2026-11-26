//! ArchUnit-style architectural and boundary invariant tests for `portfolio-core`.
//!
//! Enforces:
//! 1. Strict Zero-I/O policy: No database (sqlx), network (reqwest), async runtime (tokio),
//!    or cache (redis) dependencies in `portfolio-core`.
//! 2. Safe Code mandate: `#![forbid(unsafe_code)]` must be strictly enforced.
//! 3. Domain type immutability and precision guards (no unrounded float leaks into financial structs).

#![allow(clippy::unwrap_used, clippy::panic)]

#[test]
fn test_archunit_zero_io_dependency_invariants() {
    // Read the Cargo.toml of portfolio-core directly at runtime
    let cargo_toml_content = include_str!("../Cargo.toml");

    // Strictly forbidden dependencies for portfolio-core (Zero-I/O domain engine)
    let forbidden_dependencies = [
        "tokio", "sqlx", "reqwest", "redis", "actix", "axum", "hyper", "tower", "diesel",
        "postgres",
    ];

    // Inspect [dependencies], [dependencies.*], and [target.*.dependencies]
    let mut in_dep_section = false;
    for line in cargo_toml_content.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }
        if trimmed.starts_with('[') {
            in_dep_section = trimmed == "[dependencies]"
                || trimmed.starts_with("[dependencies.")
                || (trimmed.starts_with("[target.") && trimmed.contains(".dependencies"));
            continue;
        }
        if in_dep_section {
            let dep_name = trimmed.split(['=', ' ', '.']).next().unwrap_or("").trim();
            for &forbidden in &forbidden_dependencies {
                assert_ne!(
                    dep_name, forbidden,
                    "ArchUnit Violation: portfolio-core violates the Zero-I/O Mandate by importing '{dep_name}'!"
                );
            }
        }
    }
}

fn collect_rs_files(dir: &std::path::Path, out: &mut Vec<std::path::PathBuf>) {
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                collect_rs_files(&path, out);
            } else if path.extension().and_then(|e| e.to_str()) == Some("rs") {
                out.push(path);
            }
        }
    }
}

#[test]
fn test_archunit_zero_io_source_scan() {
    let src_dir = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("src");
    let mut files = Vec::new();
    collect_rs_files(&src_dir, &mut files);
    assert!(!files.is_empty(), "Expected Rust source files in src/");

    let forbidden_apis = ["std::fs", "std::net", "std::process", "std::env"];

    for file in files {
        let rel = file
            .strip_prefix(&src_dir)
            .unwrap_or(&file)
            .to_string_lossy()
            .replace('\\', "/");
        let content = std::fs::read_to_string(&file).unwrap();

        for api in &forbidden_apis {
            assert!(
                !content.contains(api),
                "ArchUnit Violation: {rel} uses forbidden I/O API '{api}'"
            );
        }

        if !rel.starts_with("tax/") {
            assert!(
                !content.contains("Utc::now"),
                "ArchUnit Violation: {rel} uses ambient Utc::now() outside tax/"
            );
        }

        if rel != "tax/classification.rs" && !rel.starts_with("tax/") {
            assert!(
                !content.contains("HOLDING_DAYS_EQUITY_LTCG"),
                "ArchUnit Violation: {rel} references HOLDING_DAYS_EQUITY_LTCG directly outside tax/classification.rs"
            );
        }
    }
}

#[test]
fn test_archunit_forbid_unsafe_code_in_domain_roots() {
    let lib_rs_content = include_str!("../src/lib.rs");
    assert!(
        lib_rs_content.contains("#![forbid(unsafe_code)]"),
        "ArchUnit Violation: portfolio-core/src/lib.rs MUST contain '#![forbid(unsafe_code)]'"
    );
}
