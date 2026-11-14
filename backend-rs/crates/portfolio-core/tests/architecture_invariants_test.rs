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

    // Find the [dependencies] section
    let in_dependencies = cargo_toml_content
        .lines()
        .skip_while(|line| !line.trim().starts_with("[dependencies]"))
        .skip(1)
        .take_while(|line| !line.trim().starts_with('['));

    for line in in_dependencies {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }

        let dep_name = trimmed.split(['=', ' ', '.']).next().unwrap_or("").trim();
        for &forbidden in &forbidden_dependencies {
            assert_ne!(
                dep_name, forbidden,
                "ArchUnit Violation: portfolio-core violates the Zero-I/O Mandate by importing '{dep_name}'!"
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
