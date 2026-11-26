#!/usr/bin/env python3
# ruff: noqa: E501, PLR2004
"""Incremental Diff Coverage Guardrail.

Prevents test coverage regressions on every incremental change by checking that
newly added or modified executable lines in the current git diff meet a strict
minimum coverage threshold (default: 85%) against Vitest (`coverage-final.json`)
and optional Cargo `llvm-cov` JSON reports.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

DEFAULT_MIN_DIFF_COVERAGE = 85.0

EXCLUDED_FRONTEND_PATTERNS = (
    r"^frontend/src/App\.tsx$",
    r"^frontend/src/ActiveTabRouter\.tsx$",
    r"^frontend/src/DashboardActionHeader\.tsx$",
    r"^frontend/src/DashboardModals\.tsx$",
    r"^frontend/src/useDashboardController\.ts$",
    r"^frontend/src/useDashboardData\.ts$",
    r"^frontend/src/useDashboardMutations\.ts$",
    r"^frontend/src/main\.tsx$",
    r"^frontend/src/components/Auth/",
    r"^frontend/src/components/Dashboard/HistoryChart\.tsx$",
    r"^frontend/src/components/Dashboard/EmptyStatePlaceholder\.tsx$",
    r"^frontend/src/components/Insights/",
    r"^frontend/src/contexts/SettingsContext\.tsx$",
    r"^frontend/src/types/",
)

EXCLUDED_MOBILE_PATTERNS = (
    r"^mobile/app/_layout\.tsx$",
    r"^mobile/app/\(auth\)/_layout\.tsx$",
    r"^mobile/app/\(tabs\)/_layout\.tsx$",
    r"^mobile/src/types/",
    r"^mobile/src/components/index\.ts$",
    r"^mobile/src/db/index\.ts$",
    r"^mobile/src/feeds/index\.ts$",
    r"^mobile/src/services/index\.ts$",
)

EXCLUDED_BACKEND_PATTERNS = (
    r"/main\.rs$",
    r"/test_mocks\.rs$",
    r"/repositories/",
    r"/tests/",
)

HUNK_RE = re.compile(r"^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@")


def is_excluded_source(rel_path: str) -> bool:
    """Return True if the file is a test, type-only, generated, or excluded harness file."""
    if any(
        token in rel_path
        for token in (".test.", ".spec.", "__tests__", "/test/", "/tests/", ".d.ts")
    ):
        return True
    if rel_path.endswith(("index.ts", "index.tsx")):
        return True
    for pattern in (
        EXCLUDED_FRONTEND_PATTERNS + EXCLUDED_MOBILE_PATTERNS + EXCLUDED_BACKEND_PATTERNS
    ):
        if re.search(pattern, rel_path):
            return True
    return False


def is_tracked_source(rel_path: str) -> bool:
    """Return True if the path belongs to frontend, mobile, or backend source directories."""
    if rel_path.startswith("frontend/src/") and rel_path.endswith((".ts", ".tsx")):
        return not is_excluded_source(rel_path)
    if (
        rel_path.startswith("mobile/src/") or rel_path.startswith("mobile/app/")
    ) and rel_path.endswith((".ts", ".tsx")):
        return not is_excluded_source(rel_path)
    if (
        rel_path.startswith("backend-rs/crates/")
        and "/src/" in rel_path
        and rel_path.endswith(".rs")
    ):
        return not is_excluded_source(rel_path)
    return False


def parse_unified_diff(diff_text: str) -> dict[str, set[int]]:
    """Parse `git diff -U0` output into a map of `{rel_path: {added_or_modified_line_numbers}}`."""
    changed: dict[str, set[int]] = {}
    current_file: str | None = None

    for line in diff_text.splitlines():
        if line.startswith("+++ b/"):
            candidate = line[6:].strip()
            current_file = candidate if is_tracked_source(candidate) else None
        elif line.startswith("+++ "):
            current_file = None
        elif current_file is not None and line.startswith("@@ "):
            match = HUNK_RE.match(line)
            if not match:
                continue
            start_line = int(match.group(1))
            count = int(match.group(2)) if match.group(2) is not None else 1
            if count > 0:
                changed.setdefault(current_file, set()).update(
                    range(start_line, start_line + count)
                )

    return {path: lines for path, lines in changed.items() if lines}


def load_istanbul_line_coverage(cov_json_path: Path, repo_root: Path) -> dict[str, dict[int, int]]:
    """Convert Istanbul/V8 `coverage-final.json` into `{rel_path: {line_num: max_hit_count}}`."""
    if not cov_json_path.exists():
        return {}
    raw = json.loads(cov_json_path.read_text(encoding="utf-8"))
    result: dict[str, dict[int, int]] = {}

    for abs_path, entry in raw.items():
        try:
            rel_path = Path(abs_path).resolve().relative_to(repo_root.resolve()).as_posix()
        except ValueError:
            rel_path = abs_path.lstrip("./")

        line_hits: dict[int, int] = {}
        stmt_map = entry.get("statementMap", {})
        stmt_counts = entry.get("s", {})
        for stmt_id, loc in stmt_map.items():
            count = int(stmt_counts.get(stmt_id, 0))
            start_line = int(loc.get("start", {}).get("line", 0))
            end_line = int(loc.get("end", {}).get("line", start_line))
            for ln in range(start_line, end_line + 1):
                if ln > 0:
                    line_hits[ln] = max(line_hits.get(ln, 0), count)

        result[rel_path] = line_hits

    return result


def load_llvm_cov_line_coverage(cov_json_path: Path, repo_root: Path) -> dict[str, dict[int, int]]:
    """Convert `cargo llvm-cov --json` output into `{rel_path: {line_num: max_hit_count}}`."""
    if not cov_json_path.exists():
        return {}
    raw = json.loads(cov_json_path.read_text(encoding="utf-8"))
    result: dict[str, dict[int, int]] = {}

    for data_block in raw.get("data", []):
        for file_entry in data_block.get("files", []):
            filename = file_entry.get("filename", "")
            try:
                rel_path = Path(filename).resolve().relative_to(repo_root.resolve()).as_posix()
            except ValueError:
                rel_path = filename.lstrip("./")

            line_hits: dict[int, int] = {}
            for seg in file_entry.get("segments", []):
                # LLVM coverage segment tuple: [line, col, count, has_count, is_region_entry, ...]
                if len(seg) >= 4 and seg[3]:
                    ln = int(seg[0])
                    count = int(seg[2])
                    line_hits[ln] = max(line_hits.get(ln, 0), count)
            result[rel_path] = line_hits

    return result


def evaluate_diff_coverage(
    changed_lines: dict[str, set[int]],
    coverage_by_file: dict[str, dict[int, int]],
    min_pct: float,
    checked_prefixes: tuple[str, ...],
) -> tuple[bool, list[str], float, int, int]:
    """Evaluate diff coverage across changed lines for the enabled coverage sources."""
    total_executable = 0
    total_covered = 0
    report_lines: list[str] = []

    for rel_path in sorted(changed_lines):
        if not rel_path.startswith(checked_prefixes):
            continue
        diff_line_nums = changed_lines[rel_path]
        file_cov = coverage_by_file.get(rel_path)

        if file_cov is None:
            # File was not instrumented at all by tests -> 0% covered for all non-empty changed lines.
            uncovered = sorted(diff_line_nums)
            total_executable += len(uncovered)
            report_lines.append(
                f"  ❌ {rel_path}: 0.0% (0/{len(uncovered)} lines) — uninstrumented by tests (lines {uncovered[:8]})"
            )
            continue

        exec_lines = sorted(ln for ln in diff_line_nums if ln in file_cov)
        if not exec_lines:
            continue
        covered_lines = [ln for ln in exec_lines if file_cov[ln] > 0]
        uncovered_lines = [ln for ln in exec_lines if file_cov[ln] == 0]
        total_executable += len(exec_lines)
        total_covered += len(covered_lines)

        pct = (len(covered_lines) / len(exec_lines)) * 100.0
        status = "✅" if pct >= min_pct else "⚠️"
        detail = f" (uncovered: {uncovered_lines[:8]})" if uncovered_lines else ""
        report_lines.append(
            f"  {status} {rel_path}: {pct:.1f}% ({len(covered_lines)}/{len(exec_lines)} lines){detail}"
        )

    if total_executable == 0:
        return True, report_lines, 100.0, 0, 0

    overall_pct = (total_covered / total_executable) * 100.0
    passed = overall_pct >= min_pct
    return passed, report_lines, overall_pct, total_covered, total_executable


def resolve_git_base(repo_root: Path, requested_base: str | None) -> str | None:
    """Resolve the git base ref to diff against."""
    if requested_base:
        return requested_base
    for candidate in ("origin/main", "main", "HEAD~1"):
        res = subprocess.run(
            ["git", "rev-parse", "--verify", "--quiet", candidate],
            cwd=repo_root,
            capture_output=True,
            text=True,
        )
        if res.returncode == 0:
            return candidate
    return None


def run_self_test() -> int:
    """Run hermetic self-tests for diff parsing, coverage mapping, and threshold gating."""
    sample_diff = """diff --git a/frontend/src/utils/sample.ts b/frontend/src/utils/sample.ts
--- a/frontend/src/utils/sample.ts
+++ b/frontend/src/utils/sample.ts
@@ -10,0 +11,3 @@ export function demo() {
+  const a = 1;
+  const b = 2;
+  return a + b;
diff --git a/frontend/src/utils/sample.test.ts b/frontend/src/utils/sample.test.ts
--- a/frontend/src/utils/sample.test.ts
+++ b/frontend/src/utils/sample.test.ts
@@ -1,0 +2,1 @@
+expect(true).toBe(true);
"""
    parsed = parse_unified_diff(sample_diff)
    assert parsed == {"frontend/src/utils/sample.ts": {11, 12, 13}}, (
        f"Unexpected parsed diff: {parsed}"
    )

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_path = Path(tmpdir)
        cov_file = tmp_path / "coverage-final.json"
        sample_abs = str((tmp_path / "frontend/src/utils/sample.ts").resolve())
        cov_file.write_text(
            json.dumps(
                {
                    sample_abs: {
                        "statementMap": {
                            "0": {
                                "start": {"line": 11, "column": 0},
                                "end": {"line": 11, "column": 10},
                            },
                            "1": {
                                "start": {"line": 12, "column": 0},
                                "end": {"line": 12, "column": 10},
                            },
                            "2": {
                                "start": {"line": 13, "column": 0},
                                "end": {"line": 13, "column": 10},
                            },
                        },
                        "s": {"0": 1, "1": 1, "2": 0},
                    }
                }
            ),
            encoding="utf-8",
        )

        cov_map = load_istanbul_line_coverage(cov_file, tmp_path)
        passed_66, _, pct_66, cov_cnt, exec_cnt = evaluate_diff_coverage(
            parsed, cov_map, 85.0, ("frontend/src/",)
        )
        assert not passed_66, "Expected 66.7% diff coverage to fail 85% gate"
        assert cov_cnt == 2 and exec_cnt == 3 and 66.0 < pct_66 < 67.0

        passed_60, _, _, _, _ = evaluate_diff_coverage(parsed, cov_map, 60.0, ("frontend/src/",))
        assert passed_60, "Expected 66.7% diff coverage to pass 60% gate"

    print("✅ All 3 check-diff-coverage self-tests passed.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Enforce minimum coverage on incremental git diff lines."
    )
    parser.add_argument(
        "--base", default=None, help="Git base ref to diff against (default: origin/main or HEAD~1)"
    )
    parser.add_argument("--min-diff-coverage", type=float, default=DEFAULT_MIN_DIFF_COVERAGE)
    parser.add_argument("--frontend-cov", default="frontend/coverage/coverage-final.json")
    parser.add_argument("--mobile-cov", default="mobile/coverage/coverage-final.json")
    parser.add_argument(
        "--backend-cov", default=None, help="Optional cargo llvm-cov --json output path"
    )
    parser.add_argument("--self-test", action="store_true", help="Run internal self-tests and exit")
    args = parser.parse_args()

    if args.self_test:
        return run_self_test()

    repo_root = Path.cwd()
    base_ref = resolve_git_base(repo_root, args.base)
    if base_ref is None:
        print("ℹ️  No git base ref available; skipping incremental diff coverage check.")
        return 0

    diff_res = subprocess.run(
        ["git", "diff", "-U0", f"{base_ref}...HEAD"],
        cwd=repo_root,
        capture_output=True,
        text=True,
        check=False,
    )
    if diff_res.returncode != 0:
        diff_res = subprocess.run(
            ["git", "diff", "-U0", base_ref],
            cwd=repo_root,
            capture_output=True,
            text=True,
            check=True,
        )

    changed_lines = parse_unified_diff(diff_res.stdout)
    coverage_by_file: dict[str, dict[int, int]] = {}
    checked_prefixes: list[str] = []

    fe_cov_path = repo_root / args.frontend_cov
    if fe_cov_path.exists():
        coverage_by_file.update(load_istanbul_line_coverage(fe_cov_path, repo_root))
        checked_prefixes.append("frontend/src/")

    mob_cov_path = repo_root / args.mobile_cov
    if mob_cov_path.exists():
        coverage_by_file.update(load_istanbul_line_coverage(mob_cov_path, repo_root))
        checked_prefixes.extend(["mobile/src/", "mobile/app/"])

    if args.backend_cov:
        be_cov_path = repo_root / args.backend_cov
        if be_cov_path.exists():
            coverage_by_file.update(load_llvm_cov_line_coverage(be_cov_path, repo_root))
            checked_prefixes.append("backend-rs/crates/")

    if not checked_prefixes:
        print(
            "ℹ️  No coverage JSON artifacts found; run unit coverage suites before check-diff-coverage."
        )
        return 0

    passed, report_lines, overall_pct, covered, executable = evaluate_diff_coverage(
        changed_lines, coverage_by_file, args.min_diff_coverage, tuple(checked_prefixes)
    )

    print("=" * 80)
    print(
        f"Incremental Diff Coverage Guardrail (vs {base_ref}, minimum {args.min_diff_coverage:.1f}%)"
    )
    print("=" * 80)
    for line in report_lines:
        print(line)
    print(f"Summary: {overall_pct:.2f}% ({covered}/{executable} executable changed lines covered)")

    if not passed:
        print(
            f"❌ FAILED: Incremental diff coverage {overall_pct:.2f}% is below {args.min_diff_coverage:.1f}%.",
            file=sys.stderr,
        )
        return 1

    print("✅ PASSED: Incremental diff coverage meets guardrail.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
