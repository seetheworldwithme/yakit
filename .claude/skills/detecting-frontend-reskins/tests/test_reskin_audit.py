"""End-to-end tests for the independence-score reskin audit (stdlib only).

Covers:
  - three tiers land in the right score band (identical/partial/independent)
  - identity override caps total at 39 when name+major match (capped pair)
  - scoring math (dimension_independence formula, weights sum, recoverable >= 0)
  - tier classification boundaries
  - recommendations only for submetrics above the trigger

Run:
    cd .agents/skills/detecting-frontend-reskins
    python3 -m unittest tests.test_reskin_audit -v
"""

from __future__ import annotations

import shutil
import sys
import tempfile
import unittest
from pathlib import Path

SKILL_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(SKILL_ROOT / "scripts"))
import reskin_audit as ra  # noqa: E402

FIXTURES = Path(__file__).resolve().parent / "fixtures"


def _report(a: str, b: str) -> dict:
    """Analyze a fixture pair in a clean temp dir outside any git repo.

    Fixtures live inside the host git repo, so `git -C <fixture>` would inherit
    the host's origin and falsely trigger the same-origin override for every
    pair. Copying to a temp dir gives each fixture an empty git identity, so
    only the package name/major signals (which the fixtures control explicitly)
    drive the override. This mirrors real usage where each project root is its
    own repo.
    """
    config = ra.merge_config(None)
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        pa = shutil.copytree(FIXTURES / a, root / a)
        pb = shutil.copytree(FIXTURES / b, root / b)
        return ra.build_report(pa, pb, config, "A", "B")


class TestTiersLand(unittest.TestCase):
    """The three fixture pairs must land in their target independence bands."""

    def test_identical_pair_is_reskin(self) -> None:
        report = _report("identical_a", "identical_b")
        self.assertLessEqual(report["score"], 39, msg=f"identical expected <=39, got {report['score']}")
        self.assertEqual(report["tier"], "reskin")
        self.assertTrue(report["identity"]["override"], msg="identical pair must trigger identity override")

    def test_partial_pair_is_partial(self) -> None:
        report = _report("partial_a", "partial_b")
        self.assertGreaterEqual(report["score"], 40, msg=f"partial expected >=40, got {report['score']}")
        self.assertLess(report["score"], 70, msg=f"partial expected <70, got {report['score']}")
        self.assertEqual(report["tier"], "partial")
        self.assertFalse(report["identity"]["override"], msg="partial pair must NOT trigger override (different names)")

    def test_independent_pair_is_safe(self) -> None:
        report = _report("independent_a", "independent_b")
        self.assertGreaterEqual(report["score"], 70, msg=f"independent expected >=70, got {report['score']}")
        self.assertEqual(report["tier"], "independent")
        self.assertFalse(report["identity"]["override"], msg="independent pair must NOT trigger override")


class TestIdentityCap(unittest.TestCase):
    """Capped pair: different stacks (raw high) but same name+major -> capped to 39."""

    def test_cap_applies(self) -> None:
        report = _report("capped_a", "capped_b")
        self.assertTrue(report["identity"]["override"], msg="capped pair must trigger override (same name+major)")
        self.assertTrue(report["identity"]["name_match"])
        self.assertTrue(report["identity"]["major_match"])
        self.assertGreater(report["raw_score"], 39, msg=f"raw expected >39 before cap, got {report['raw_score']}")
        self.assertEqual(report["score"], report["tiers"]["identity_cap"], msg=f"capped score must equal cap {report['tiers']['identity_cap']}, got {report['score']}")
        self.assertTrue(report["score_capped_by_identity"])

    def test_identical_override_logic(self) -> None:
        cfg = ra.merge_config(None)
        yes = ra.analyze_identity({"git_origin": "g", "package_name": "p", "package_version": "1.2.0"},
                                  {"git_origin": "g", "package_name": "p", "package_version": "1.9.0"}, cfg)
        self.assertTrue(yes["override"])
        no = ra.analyze_identity({"git_origin": "g1", "package_name": "p1", "package_version": "1.0"},
                                 {"git_origin": "g2", "package_name": "p2", "package_version": "2.0"}, cfg)
        self.assertFalse(no["override"])
        # same name, different major -> flagged but not overriding
        flag = ra.analyze_identity({"git_origin": "", "package_name": "p", "package_version": "1.0"},
                                   {"git_origin": "", "package_name": "p", "package_version": "2.0"}, cfg)
        self.assertFalse(flag["override"])
        self.assertTrue(flag["name_match"])


class TestScoringMath(unittest.TestCase):
    def test_dimension_independence_formula(self) -> None:
        self.assertEqual(ra.dimension_independence(0, 25), 25.0)
        self.assertEqual(ra.dimension_independence(100, 25), 0.0)
        self.assertAlmostEqual(ra.dimension_independence(50, 20), 10.0)

    def test_weights_sum_to_100(self) -> None:
        self.assertEqual(sum(ra.DEFAULT_CONFIG["weights"].values()), 100)

    def test_weights_keys(self) -> None:
        self.assertEqual(set(ra.DEFAULT_CONFIG["weights"]), {"skeleton", "layout", "visual", "logic"})

    def test_classify_boundaries(self) -> None:
        cfg = ra.DEFAULT_CONFIG
        self.assertEqual(ra.classify_independence(70, cfg)[0], "independent")
        self.assertEqual(ra.classify_independence(69.99, cfg)[0], "partial")
        self.assertEqual(ra.classify_independence(40, cfg)[0], "partial")
        self.assertEqual(ra.classify_independence(39.99, cfg)[0], "reskin")
        self.assertEqual(ra.classify_independence(0, cfg)[0], "reskin")

    def test_total_equals_sum_of_dimensions(self) -> None:
        report = _report("partial_a", "partial_b")
        dim_sum = round(sum(report["dimensions"][k]["independence"] for k in ("skeleton", "layout", "visual", "logic")), 2)
        self.assertEqual(dim_sum, report["raw_score"])

    def test_recommendations_above_trigger_and_nonnegative(self) -> None:
        report = _report("partial_a", "partial_b")
        trigger = ra.DEFAULT_CONFIG["remediation"]["submetric_trigger"] * 100
        self.assertTrue(report["recommendations"], msg="partial pair should yield recommendations")
        for rec in report["recommendations"]:
            self.assertGreater(rec["overlap_pct"], trigger)
            self.assertGreaterEqual(rec["recoverable"], 0.0)
            self.assertIn(rec["priority"], {"P0", "P1", "P2", "P3", "P4"})
        # sorted descending by recoverable
        recoveries = [r["recoverable"] for r in report["recommendations"]]
        self.assertEqual(recoveries, sorted(recoveries, reverse=True))

    def test_iteration_path_math(self) -> None:
        report = _report("partial_a", "partial_b")
        ip = report["iteration_path"]
        self.assertEqual(ip["target_score"], 70)
        self.assertAlmostEqual(ip["gap"], max(0.0, 70 - report["score"]), places=2)
        self.assertAlmostEqual(ip["max_recoverable"], sum(r["recoverable"] for r in report["recommendations"]), places=2)


if __name__ == "__main__":
    unittest.main()
