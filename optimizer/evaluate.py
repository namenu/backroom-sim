"""Bridge to the TypeScript simulation evaluator."""

from __future__ import annotations

import json
import subprocess
from pathlib import Path
from typing import Any

from .layout_types import Layout, FitnessMetrics

# Path to the TS evaluator script
_SCRIPT = Path(__file__).resolve().parent.parent / "scripts" / "evaluate-layout.ts"
_PROJECT_ROOT = Path(__file__).resolve().parent.parent


def evaluate_layout(
    layout: Layout,
    ticks: int = 5000,
    recipe: str = "backroom",
) -> FitnessMetrics | None:
    """Evaluate a single layout by calling the TS simulation.

    Returns FitnessMetrics on success, None if layout is invalid.
    """
    request = {
        "layout": layout.to_dict(),
        "ticks": ticks,
        "recipe": recipe,
    }
    result = _call_evaluator(request)
    if not result.get("valid", False):
        return None
    return FitnessMetrics.from_dict(result["metrics"])


def evaluate_batch(
    layouts: list[Layout],
    ticks: int = 5000,
    recipe: str = "backroom",
) -> list[FitnessMetrics | None]:
    """Evaluate multiple layouts in a single subprocess call.

    Returns a list of FitnessMetrics (or None for invalid layouts).
    """
    batch_items = [
        {"id": i, "layout": layout.to_dict()}
        for i, layout in enumerate(layouts)
    ]
    request = {"batch": batch_items, "ticks": ticks, "recipe": recipe}
    result = _call_evaluator(request)

    results_by_id: dict[int, Any] = {}
    for r in result.get("results", []):
        results_by_id[r["id"]] = r

    output: list[FitnessMetrics | None] = []
    for i in range(len(layouts)):
        r = results_by_id.get(i)
        if r and r.get("valid", False) and "metrics" in r:
            output.append(FitnessMetrics.from_dict(r["metrics"]))
        else:
            output.append(None)
    return output


def evaluate_baseline(
    ticks: int = 5000,
    recipe: str = "backroom",
) -> tuple[Layout, FitnessMetrics]:
    """Evaluate the default layout and return (layout, metrics)."""
    request = {"ticks": ticks, "recipe": recipe}
    result = _call_evaluator(request)
    layout = Layout.from_dict(result["layout"])
    metrics = FitnessMetrics.from_dict(result["metrics"])
    return layout, metrics


def _call_evaluator(request: dict[str, Any]) -> dict[str, Any]:
    """Call the TS evaluator script via subprocess."""
    input_json = json.dumps(request)
    proc = subprocess.run(
        ["npx", "tsx", str(_SCRIPT)],
        input=input_json,
        capture_output=True,
        text=True,
        cwd=str(_PROJECT_ROOT),
        timeout=120,
    )
    if proc.returncode != 0:
        raise RuntimeError(f"Evaluator failed: {proc.stderr}")
    return json.loads(proc.stdout)
