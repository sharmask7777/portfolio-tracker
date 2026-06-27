# Security Vulnerabilities

## Password Leakage in ParserService
There is a critical security vulnerability in the `ParserService`. When invoking the Python `casparser` script, the CAS PDF password is currently being passed directly as a command-line argument.
- **Risk:** The password becomes temporarily visible in the operating system's process list (e.g., via the `ps` command).
- **Fix Required:** The architecture must be updated to pass passwords securely via standard input (`stdin`) or environment variables.

## Orphaned Unencrypted Files
- **Risk:** During the parsing process, if the Node.js worker experiences an Out-Of-Memory (OOM) crash or is terminated via a `SIGKILL`, temporary unencrypted CAS PDFs may be left behind on the disk.
- **Fix Required:** Implement robust cleanup routines, ideally using an ephemeral, strictly controlled `/tmp` directory with automated periodic purging.
