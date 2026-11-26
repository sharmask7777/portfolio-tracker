#!/usr/bin/env python3
# ruff: noqa: E501, BLE001
"""
Static View Layer Boundary & Zero Business Logic Guardrail.

Enforces AGENTS.md mandates:
1. Zero Business Logic in Views: Web components (frontend/src/components/) and
   Mobile components/screens (mobile/src/components/, mobile/app/) must act
   strictly as paint/rendering layers consuming display-ready backend DTOs.
2. Invariant Oracle Law: Financial calculations, statutory rates (12.5% LTCG,
   20% STCG, 4% cess, 50AA slab debt), Fisher deflators ((1+r)/(1+i)-1), and
   net-worth tax netting must NEVER be replicated in the view layer.
3. Architectural Layer Isolation: View files must not import database layers
   or backend domain calculation engines.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path
from typing import NamedTuple

REPO_ROOT = Path(__file__).resolve().parent.parent

# Directories scanned as View Layer
VIEW_DIRECTORIES = [
    REPO_ROOT / "frontend" / "src" / "components",
    REPO_ROOT / "mobile" / "src" / "components",
    REPO_ROOT / "mobile" / "app",
]

# Patterns for files that are tests or mocks (excluded from view layer rules)
TEST_FILE_PATTERNS = [
    re.compile(r"\.(test|spec)\.[jt]sx?$"),
    re.compile(r"mock-portfolios"),
    re.compile(r"__tests__"),
]


class Violation(NamedTuple):
    file_path: Path
    line_number: int
    rule_id: str
    message: str
    line_content: str


# Banned statutory tax rate multiplications in view code (e.g. * 0.125, * 0.20, * 0.15, * 0.04)
# Excludes CSS transitions (0.15s), paddings (0.15rem), rgba opacities (rgba(..., 0.15))
BANNED_MATH_PATTERNS = [
    (
        "VBL001_STATUTORY_TAX_CALC",
        re.compile(r"(\*\s*0\.(?:125|20|15|04|30)\b|\b0\.(?:125|20|15|04|30)\s*\*)"),
        "Forbidden hardcoded statutory tax rate multiplication in view layer. Tax calculations must occur on the backend.",
    ),
    (
        "VBL002_FISHER_DEFLATOR_MATH",
        re.compile(r"(\bMath\.pow\s*\(\s*1\s*\+|\(\s*1\s*\+[^)]+\)\s*/\s*\(\s*1\s*\+)"),
        "Forbidden client-side Fisher purchasing power deflator compounding. Use backend DragDecompositionDto.purchasingPowerValue.",
    ),
    (
        "VBL003_TAX_NETTING_SUBTRACTION",
        re.compile(
            r"(\b(?:totalValue|currentValue|nominalValue)\s*-\s*(?:\(?\s*\w*\.?estimatedTax|\(?\s*\w*\.?totalTax|\(?\s*taxDrag))"
        ),
        "Forbidden client-side tax netting subtraction. Use backend pre-calculated netRealizableValue or postTaxValue.",
    ),
    (
        "VBL004_DRAG_SUBTRACTION",
        re.compile(
            r"(\bxirr\s*-\s*(?:postTaxXirr|realPostTaxXirr)|\bpostTaxXirr\s*-\s*realPostTaxXirr)"
        ),
        "Forbidden client-side return drag subtraction. Consume backend drags.totalTaxDrag and drags.totalOverallDrag directly.",
    ),
    (
        "VBL005_RAW_GAIN_RETURN_PCT",
        re.compile(
            r"(\bunrealizedGain\s*/\s*(?:totalInvestedCost|investedCost|investedAmount)|\(\s*unrealizedGain\s*/\s*\w+\s*\)\s*\*\s*100)"
        ),
        "Forbidden client-side return percentage arithmetic in view. Use backend return rates (nominalXirr, absoluteReturn, gainPercentage).",
    ),
]

# Multi-line and single-line import block regex
IMPORT_BLOCK_RE = re.compile(
    r"import\s+((?:type\s+)?(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)(?:\s*,\s*(?:\{[^}]*\}|\w+))*)\s+from\s+['\"]([^'\"]+)['\"]",
    re.DOTALL,
)

BANNED_IMPORT_TARGETS = [
    (
        "VBL101_DB_IMPORT_IN_VIEW",
        re.compile(r"(?:/db/|^db/|expo-sqlite|sqlx)"),
        "View components must never import database repositories or SQL clients directly.",
        False,  # Banned even if type-only
    ),
    (
        "VBL102_CALC_ENGINE_IMPORT_IN_VIEW",
        re.compile(r"(?:tax-calculations|itr-report-generator|portfolio-calculations\.ts)"),
        "View components must never import business/tax calculation engines directly. Consume display DTOs and presentation hooks.",
        True,  # Allow pure type-only imports if they start with import type
    ),
]


def is_test_file(path: Path) -> bool:
    path_str = str(path)
    return any(p.search(path_str) for p in TEST_FILE_PATTERNS)


def is_comment_or_css(line: str) -> bool:
    stripped = line.strip()
    if stripped.startswith("//") or stripped.startswith("/*") or stripped.startswith("*"):
        return True
    # Ignore CSS transitions, durations, font-weights, and rgba opacities
    if any(
        css_kw in stripped
        for css_kw in [
            "transition:",
            "animation:",
            "duration:",
            "rgba(",
            "padding:",
            "margin:",
            "fontSize:",
        ]
    ):
        return True
    return False


def scan_file(path: Path) -> list[Violation]:
    violations: list[Violation] = []
    try:
        content = path.read_text(encoding="utf-8")
    except Exception:
        return violations

    lines = content.splitlines()

    # 1. Check line-by-line banned math patterns
    for idx, line in enumerate(lines, start=1):
        if is_comment_or_css(line):
            continue

        for rule_id, pattern, msg in BANNED_MATH_PATTERNS:
            if pattern.search(line):
                violations.append(Violation(path, idx, rule_id, msg, line.strip()))

    # 2. Check multi-line and single-line import blocks
    for match in IMPORT_BLOCK_RE.finditer(content):
        import_clause = match.group(1).strip()
        module_path = match.group(2).strip()
        start_offset = match.start()
        line_num = content[:start_offset].count("\n") + 1

        is_type_only = import_clause.startswith("type ") or match.group(0).startswith("import type")

        for rule_id, target_pat, msg, allow_type_only in BANNED_IMPORT_TARGETS:
            if target_pat.search(module_path):
                if allow_type_only and is_type_only:
                    continue
                first_line = match.group(0).splitlines()[0].strip()
                violations.append(Violation(path, line_num, rule_id, msg, first_line))

    return violations


def check_no_calc_engines_in_components(view_dirs: list[Path]) -> list[Violation]:
    """Ensures no non-component calculation engine files (*calculations.ts, *engine.ts) live in components/."""
    violations: list[Violation] = []
    banned_filenames = re.compile(r"(calculation|engine|formula|oracle).*\.ts$", re.IGNORECASE)

    for vdir in view_dirs:
        if not vdir.exists():
            continue
        for p in vdir.rglob("*.ts"):
            if is_test_file(p):
                continue
            if banned_filenames.search(p.name):
                violations.append(
                    Violation(
                        p,
                        1,
                        "VBL201_CALC_FILE_IN_COMPONENTS",
                        f"Calculation engine file '{p.name}' is forbidden in view components directory. Move to services/ or utils/.",
                        p.name,
                    )
                )
    return violations


def run_checks() -> int:
    print("=" * 80)
    print("Running Static View Layer Boundary & Zero Business Logic Guardrail")
    print("Enforcing Zero-Logic Paint Layer Mandate across Web and Mobile...")
    print("=" * 80)

    all_violations: list[Violation] = []

    # Check 1: No calculation files in components
    all_violations.extend(check_no_calc_engines_in_components(VIEW_DIRECTORIES))

    # Check 2: Scan view files for prohibited logic and imports
    scanned_count = 0
    for vdir in VIEW_DIRECTORIES:
        if not vdir.exists():
            continue
        for path in vdir.rglob("*"):
            if not path.is_file() or path.suffix not in [".ts", ".tsx", ".js", ".jsx"]:
                continue
            if is_test_file(path):
                continue
            scanned_count += 1
            all_violations.extend(scan_file(path))

    if all_violations:
        print(f"\n❌ FAILED: Found {len(all_violations)} View Layer Business Logic Violation(s):\n")
        for v in all_violations:
            rel_path = (
                v.file_path.relative_to(REPO_ROOT)
                if REPO_ROOT in v.file_path.parents
                else v.file_path
            )
            print(f"  [{v.rule_id}] {rel_path}:{v.line_number}")
            print(f"    Line:    {v.line_content}")
            print(f"    Message: {v.message}\n")
        print(
            "Remediation: Remove client-side arithmetic from the view layer and consume display-ready backend DTOs."
        )
        print("=" * 80)
        return 1

    print(f"✅ PASSED: Scanned {scanned_count} view layer files across Web and Mobile.")
    print("   0 business logic leaks, 0 statutory tax calculations, 0 forbidden imports detected.")
    print("=" * 80)
    return 0


def run_self_tests() -> int:
    """Self-test harness ensuring the guardrail detects synthetic violations."""
    print("Running self-test suite for check-view-layer-boundaries...")
    import tempfile

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_path = Path(tmpdir)
        test_file = tmp_path / "BadComponent.tsx"

        # Test VBL001
        test_file.write_text("const tax = gain * 0.125;")
        v = scan_file(test_file)
        assert any(x.rule_id == "VBL001_STATUTORY_TAX_CALC" for x in v), "Failed to detect VBL001"

        # Test VBL002
        test_file.write_text("const deflator = Math.pow(1 + inflation, years);")
        v = scan_file(test_file)
        assert any(x.rule_id == "VBL002_FISHER_DEFLATOR_MATH" for x in v), "Failed to detect VBL002"

        # Test VBL003
        test_file.write_text("const netWorth = totalValue - estimatedTax;")
        v = scan_file(test_file)
        assert any(x.rule_id == "VBL003_TAX_NETTING_SUBTRACTION" for x in v), (
            "Failed to detect VBL003"
        )

        # Test VBL004
        test_file.write_text("const drag = xirr - postTaxXirr;")
        v = scan_file(test_file)
        assert any(x.rule_id == "VBL004_DRAG_SUBTRACTION" for x in v), "Failed to detect VBL004"

        # Test VBL005
        test_file.write_text("const pct = unrealizedGain / totalInvestedCost;")
        v = scan_file(test_file)
        assert any(x.rule_id == "VBL005_RAW_GAIN_RETURN_PCT" for x in v), "Failed to detect VBL005"

        # Test VBL101
        test_file.write_text("import { getPortfolioHoldings } from '../db/repository';")
        v = scan_file(test_file)
        assert any(x.rule_id == "VBL101_DB_IMPORT_IN_VIEW" for x in v), "Failed to detect VBL101"

        # Test VBL102 (Multi-line import detection)
        test_file.write_text("""
        import {
          computeTaxBreakdowns,
        } from '../../utils/tax-calculations';
        """)
        v = scan_file(test_file)
        assert any(x.rule_id == "VBL102_CALC_ENGINE_IMPORT_IN_VIEW" for x in v), (
            "Failed to detect VBL102 multi-line import"
        )

        # Test clean component passes (including type-only imports)
        test_file.write_text("""
        import React from 'react';
        import type { DragDecompositionDto } from '../../types/generated';
        import type { ITRGainDetail } from '../../utils/itr-report-types';
        export function Card({ drags }: { drags: DragDecompositionDto }) {
          return <div>{drags.totalOverallDrag}</div>;
        }
        """)
        v = scan_file(test_file)
        assert len(v) == 0, f"Clean component flagged falsely: {v}"

    print("✅ All 8 self-test scenarios passed successfully.")
    return 0


if __name__ == "__main__":
    if "--self-test" in sys.argv:
        sys.exit(run_self_tests())
    sys.exit(run_checks())
