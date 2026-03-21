"""Layout types and constraints for the backroom station placement problem."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class Station:
    type: str
    x: int
    y: int


@dataclass
class Layout:
    cols: int
    rows: int
    stations: list[Station]

    def to_dict(self) -> dict[str, Any]:
        return {
            "cols": self.cols,
            "rows": self.rows,
            "stations": [{"type": s.type, "x": s.x, "y": s.y} for s in self.stations],
        }

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> Layout:
        return cls(
            cols=d["cols"],
            rows=d["rows"],
            stations=[Station(**s) for s in d["stations"]],
        )

    def clone(self) -> Layout:
        return Layout(
            cols=self.cols,
            rows=self.rows,
            stations=[Station(s.type, s.x, s.y) for s in self.stations],
        )


@dataclass
class FitnessMetrics:
    throughput: float
    station_utilization: dict[str, float]
    avg_utilization: float
    worker_idle_ratios: list[float]
    avg_worker_idle: float
    total_served: int
    fitness: float

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> FitnessMetrics:
        return cls(
            throughput=d["throughput"],
            station_utilization=d["stationUtilization"],
            avg_utilization=d["avgUtilization"],
            worker_idle_ratios=d["workerIdleRatios"],
            avg_worker_idle=d["avgWorkerIdle"],
            total_served=d["totalServed"],
            fitness=d["fitness"],
        )


# ─── Backroom problem constraints ────────────────────────────

# Station types that must be at y=0 (top edge)
INTAKE_TYPES = {"receiving"}

# Station types pinned to (0, 0)
ENTRANCE_TYPE = "entrance"

# Default backroom station counts (type -> count)
BACKROOM_STATION_COUNTS: dict[str, int] = {
    "entrance": 1,
    "receiving": 4,
    "shelf": 3,
    "fridge": 2,
    "prep_table": 4,
    "stove": 2,
    "counter": 4,
    "returning": 2,
    "sink": 2,
    "trash": 1,
}

GRID_COLS = 12
GRID_ROWS = 9
