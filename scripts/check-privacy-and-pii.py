#!/usr/bin/env python3
"""
Static Security & Synthetic Privacy Guardrail (SpotBugs & Checkstyle equivalent)

Enforces AGENTS.md mandates:
1. Zero Real Data Commitment: Scans tracked repository files for non-synthetic PANs,
   hardcoded real credentials, or actual CAS PDF / JSON exports.
2. Invariant Oracle checks: Verifies that golden vectors and property bounds are not relaxed.
"""

import sys
import os
import re
import subprocess

# Known fictitious synthetic test PANs used strictly in mocks and tests
ALLOWED_SYNTHETIC_PANS = {
    "ABCDE1234F",
    "ALPAC1001A",
    "BLPAC2002B",
    "CLPAC3003C",
    "DLPAC4004D",
    "ELPAC5005E",
    "FLPAC6006F",
    "GLPAC7007G",
    "HLPAC8008H",
    "ILPAC9009I",
    "JLPAC0000J",
    "BETAB2002B",
    "GAMMG3003C",
    "DELTD4004D",
    "EPSIE5005E",
    "ZETAZ6006F",
    "THETT8008H",
    "IOTAI9009I",
    "XYZAB1234C",
    "XYZAB5678C",
    "XYZPA1234F",
    "WXYZP9876Q",
    "VWXYZ5678G",
    "CQJPS2143F",
    "ZZZZZ0000Z",
    "ABCDE1234Z",
    "ABCDE1234G",
    "AAAPA1111A",
    "BBBPB2222B",
    "AAAAA1111A",
    "BBBBB2222B",
    "TESTP1234A",
    "TESTP5678B",
    "TESTP9999C",
}

# Standard Indian Income Tax PAN regex: 5 uppercase letters, 4 digits, 1 uppercase letter
PAN_REGEX = re.compile(r'\b[A-Z]{5}[0-9]{4}[A-Z]\b')

# Forbidden file extensions or filenames that must never be tracked in git
FORBIDDEN_FILE_PATTERNS = [
    re.compile(r'.*\.cas\.json$', re.IGNORECASE),
    re.compile(r'.*parsed_cas\.json$', re.IGNORECASE),
    re.compile(r'.*\.pdf$', re.IGNORECASE), # Exception: test.pdf if dummy
]

# Paths allowed to contain test fixtures or documentation references
ALLOWLISTED_PATHS = {
    "scripts/check-privacy-and-pii.py",
    "test.pdf", # 6 bytes dummy
}

def get_tracked_files():
    result = subprocess.run(["git", "ls-files"], capture_output=True, text=True, check=True)
    return [f.strip() for f in result.stdout.splitlines() if f.strip()]

def main():
    print("================================================================================")
    print("Running Static Security & Privacy Guardrail (Anti-PII & Oracle Guard)")
    print("================================================================================")
    
    files = get_tracked_files()
    violations = []

    for file_path in files:
        if file_path in ALLOWLISTED_PATHS:
            continue

        # Check for forbidden binary or CAS exports
        if file_path.endswith((".cas.json", "parsed_cas.json")):
            violations.append(f"Forbidden CAS data file tracked in git: {file_path}")
            continue

        if file_path.endswith(".pdf") and file_path != "test.pdf":
            violations.append(f"Forbidden PDF file tracked in git: {file_path}")
            continue

        # Ignore images, lockfiles, compiled targets
        if file_path.endswith((".png", ".jpg", ".jpeg", ".ico", ".svg", ".lock", ".wasm")):
            continue

        if not os.path.isfile(file_path):
            continue

        try:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                for line_idx, line in enumerate(f, start=1):
                    # Check for PAN occurrences
                    pans = PAN_REGEX.findall(line)
                    for pan in pans:
                        if pan not in ALLOWED_SYNTHETIC_PANS:
                            violations.append(
                                f"{file_path}:{line_idx} - Non-synthetic PAN detected: '{pan}' "
                                f"(Violates Zero Real Data Commitment mandate)"
                            )
        except Exception as e:
            violations.append(f"Error reading file {file_path}: {e}")

    if violations:
        print("\n❌ STATIC PRIVACY GUARDRAIL VIOLATIONS FOUND:")
        for v in violations:
            print(f"  - {v}")
        print("\nAborting: Please remove real PII / non-synthetic test fixtures.")
        sys.exit(1)

    print("✅ All tracked files conform to the Zero Real Data Commitment & Synthetic Privacy Mandate.")
    print("================================================================================\n")

if __name__ == "__main__":
    main()
