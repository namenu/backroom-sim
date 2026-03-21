"""Layout optimizer for station placement using Genetic Algorithm."""

from .layout_types import Layout, Station, FitnessMetrics
from .layout_types import BACKROOM_STATION_COUNTS, GRID_COLS, GRID_ROWS
from .evaluate import evaluate_layout, evaluate_batch, evaluate_baseline
from .ga import run_ga, GAConfig, GAResult, Individual

__all__ = [
    "Layout",
    "Station",
    "FitnessMetrics",
    "GAConfig",
    "GAResult",
    "Individual",
    "evaluate_layout",
    "evaluate_batch",
    "evaluate_baseline",
    "run_ga",
    "BACKROOM_STATION_COUNTS",
    "GRID_COLS",
    "GRID_ROWS",
]
