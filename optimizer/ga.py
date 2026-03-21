"""Genetic Algorithm for station placement optimization.

Encodes each individual as a list of (x, y) positions for the fixed set of stations.
Uses the TS simulation bridge for fitness evaluation.
"""

from __future__ import annotations

import random
import time
from collections import deque
from dataclasses import dataclass, field
from typing import Callable

from .layout_types import (
    Layout,
    Station,
    FitnessMetrics,
    INTAKE_TYPES,
    ENTRANCE_TYPE,
    BACKROOM_STATION_COUNTS,
    GRID_COLS,
    GRID_ROWS,
)
from .evaluate import evaluate_batch


# ─── Types ────────────────────────────────────────────────────

@dataclass
class Individual:
    layout: Layout
    fitness: float = float("-inf")
    metrics: FitnessMetrics | None = None


@dataclass
class GAConfig:
    population_size: int = 30
    generations: int = 50
    elitism_rate: float = 0.1
    crossover_rate: float = 0.7
    mutation_rate: float = 0.15
    tournament_size: int = 3
    sim_ticks: int = 5000
    recipe: str = "backroom"
    seed: int | None = None


@dataclass
class GAResult:
    best: Individual
    history: list[dict]  # per-generation stats
    elapsed_seconds: float = 0.0


# ─── Constraint helpers ──────────────────────────────────────

def _is_intake(station_type: str) -> bool:
    return station_type in INTAKE_TYPES


def _is_entrance(station_type: str) -> bool:
    return station_type == ENTRANCE_TYPE


def _random_free_pos(
    cols: int,
    rows: int,
    occupied: set[tuple[int, int]],
    y_constraint: int | None = None,
) -> tuple[int, int] | None:
    """Pick a random unoccupied position. y_constraint pins to a specific row."""
    min_y = y_constraint if y_constraint is not None else 0
    max_y = (y_constraint + 1) if y_constraint is not None else rows

    # Fast random sampling
    for _ in range(100):
        x = random.randint(0, cols - 1)
        y = random.randint(min_y, max_y - 1)
        if (x, y) not in occupied:
            return (x, y)

    # Exhaustive fallback
    candidates = [
        (x, y)
        for y in range(min_y, max_y)
        for x in range(cols)
        if (x, y) not in occupied
    ]
    if not candidates:
        return None
    return random.choice(candidates)


def _check_connectivity(
    cols: int,
    rows: int,
    stations: list[Station],
) -> bool:
    """BFS connectivity check: all walkable tiles connected, all stations reachable."""
    blocked = set((s.x, s.y) for s in stations)

    # Find entrance-adjacent walkable seed
    entrance = next((s for s in stations if _is_entrance(s.type)), None)
    if entrance is None:
        return False

    seed = None
    for dx, dy in [(0, -1), (0, 1), (-1, 0), (1, 0)]:
        nx, ny = entrance.x + dx, entrance.y + dy
        if 0 <= nx < cols and 0 <= ny < rows and (nx, ny) not in blocked:
            seed = (nx, ny)
            break
    if seed is None:
        return False

    # BFS
    visited: set[tuple[int, int]] = {seed}
    queue = deque([seed])
    while queue:
        cx, cy = queue.popleft()
        for dx, dy in [(0, -1), (0, 1), (-1, 0), (1, 0)]:
            nx, ny = cx + dx, cy + dy
            if 0 <= nx < cols and 0 <= ny < rows and (nx, ny) not in visited and (nx, ny) not in blocked:
                visited.add((nx, ny))
                queue.append((nx, ny))

    # Every station must have at least one adjacent visited tile
    for s in stations:
        reachable = any(
            (s.x + dx, s.y + dy) in visited
            for dx, dy in [(0, -1), (0, 1), (-1, 0), (1, 0)]
        )
        if not reachable:
            return False
    return True


# ─── Random individual generation ────────────────────────────

def _random_individual(
    station_types: list[str],
    cols: int = GRID_COLS,
    rows: int = GRID_ROWS,
    max_attempts: int = 200,
) -> Individual | None:
    """Generate a random valid individual."""
    for _ in range(max_attempts):
        stations: list[Station] = []
        occupied: set[tuple[int, int]] = set()
        ok = True

        for stype in station_types:
            if _is_entrance(stype):
                pos = (0, 0)
            elif _is_intake(stype):
                pos = _random_free_pos(cols, rows, occupied, y_constraint=0)
            else:
                pos = _random_free_pos(cols, rows, occupied)

            if pos is None:
                ok = False
                break

            stations.append(Station(stype, pos[0], pos[1]))
            occupied.add(pos)

        if not ok:
            continue

        if _check_connectivity(cols, rows, stations):
            return Individual(layout=Layout(cols, rows, stations))

    return None


# ─── Selection ────────────────────────────────────────────────

def _tournament_select(population: list[Individual], k: int) -> Individual:
    candidates = random.sample(population, min(k, len(population)))
    return max(candidates, key=lambda ind: ind.fitness)


# ─── Crossover ────────────────────────────────────────────────

def _crossover(p1: Individual, p2: Individual) -> Layout:
    """Uniform crossover: for each station, pick position from one parent."""
    cols, rows = p1.layout.cols, p1.layout.rows
    stations: list[Station] = []
    occupied: set[tuple[int, int]] = set()

    for i, (s1, s2) in enumerate(zip(p1.layout.stations, p2.layout.stations)):
        source = s1 if random.random() < 0.5 else s2
        pos = (source.x, source.y)

        if pos in occupied:
            # Try the other parent
            alt = s2 if source is s1 else s1
            pos = (alt.x, alt.y)

        if pos in occupied:
            # Both conflict — find a new position
            if _is_entrance(s1.type):
                pos = (0, 0)
            elif _is_intake(s1.type):
                new_pos = _random_free_pos(cols, rows, occupied, y_constraint=0)
                pos = new_pos if new_pos else (source.x, source.y)
            else:
                new_pos = _random_free_pos(cols, rows, occupied)
                pos = new_pos if new_pos else (source.x, source.y)

        stations.append(Station(s1.type, pos[0], pos[1]))
        occupied.add(pos)

    return Layout(cols, rows, stations)


# ─── Mutation ─────────────────────────────────────────────────

def _mutate(layout: Layout, rate: float) -> Layout:
    """Per-station mutation: with probability `rate`, move to a random new position."""
    result = layout.clone()
    occupied = set((s.x, s.y) for s in result.stations)

    for i, s in enumerate(result.stations):
        if _is_entrance(s.type):
            continue
        if random.random() >= rate:
            continue

        occupied.discard((s.x, s.y))

        if _is_intake(s.type):
            new_pos = _random_free_pos(result.cols, result.rows, occupied, y_constraint=0)
        else:
            new_pos = _random_free_pos(result.cols, result.rows, occupied)

        if new_pos:
            s.x, s.y = new_pos
            occupied.add(new_pos)
        else:
            occupied.add((s.x, s.y))

    return result


# ─── GA Main Loop ─────────────────────────────────────────────

def run_ga(
    config: GAConfig | None = None,
    on_progress: Callable[[int, Individual, float], None] | None = None,
) -> GAResult:
    """Run the genetic algorithm for station placement optimization.

    Args:
        config: GA hyperparameters. Uses defaults if None.
        on_progress: Callback(generation, best_individual, avg_fitness).

    Returns:
        GAResult with best individual, history, and elapsed time.
    """
    if config is None:
        config = GAConfig()

    if config.seed is not None:
        random.seed(config.seed)

    start_time = time.time()

    # Station types list (order matters for crossover alignment)
    station_types = []
    for stype, count in BACKROOM_STATION_COUNTS.items():
        station_types.extend([stype] * count)

    # Initialize population
    population: list[Individual] = []
    while len(population) < config.population_size:
        ind = _random_individual(station_types)
        if ind:
            population.append(ind)

    # Evaluate initial population
    _evaluate_population(population, config)
    population.sort(key=lambda ind: ind.fitness, reverse=True)

    history: list[dict] = []
    _record_generation(history, 0, population, start_time)

    if on_progress:
        avg = sum(ind.fitness for ind in population) / len(population)
        on_progress(0, population[0], avg)

    # Evolution loop
    for gen in range(1, config.generations + 1):
        elite_count = max(1, int(config.population_size * config.elitism_rate))
        new_pop: list[Individual] = []

        # Elitism
        for i in range(elite_count):
            new_pop.append(Individual(
                layout=population[i].layout.clone(),
                fitness=population[i].fitness,
                metrics=population[i].metrics,
            ))

        # Breed rest
        while len(new_pop) < config.population_size:
            p1 = _tournament_select(population, config.tournament_size)
            p2 = _tournament_select(population, config.tournament_size)

            if random.random() < config.crossover_rate:
                child_layout = _crossover(p1, p2)
            else:
                child_layout = p1.layout.clone()

            child_layout = _mutate(child_layout, config.mutation_rate)

            # Validate connectivity
            if _check_connectivity(child_layout.cols, child_layout.rows, child_layout.stations):
                new_pop.append(Individual(layout=child_layout))
            else:
                # Try generating a fresh valid individual
                fresh = _random_individual(station_types)
                if fresh:
                    new_pop.append(fresh)

        # Evaluate new individuals (skip evaluated elites)
        unevaluated = [ind for ind in new_pop if ind.fitness == float("-inf")]
        if unevaluated:
            _evaluate_population(unevaluated, config)

        new_pop.sort(key=lambda ind: ind.fitness, reverse=True)
        population = new_pop

        _record_generation(history, gen, population, start_time)

        if on_progress:
            avg = sum(ind.fitness for ind in population) / len(population)
            on_progress(gen, population[0], avg)

    elapsed = time.time() - start_time
    return GAResult(best=population[0], history=history, elapsed_seconds=elapsed)


def _evaluate_population(population: list[Individual], config: GAConfig) -> None:
    """Batch-evaluate individuals via the TS bridge."""
    layouts = [ind.layout for ind in population]
    results = evaluate_batch(layouts, ticks=config.sim_ticks, recipe=config.recipe)

    for ind, metrics in zip(population, results):
        if metrics is not None:
            ind.fitness = metrics.fitness
            ind.metrics = metrics
        else:
            ind.fitness = float("-inf")


def _record_generation(
    history: list[dict],
    gen: int,
    population: list[Individual],
    start_time: float,
) -> None:
    fitnesses = [ind.fitness for ind in population if ind.fitness != float("-inf")]
    best = population[0]
    history.append({
        "generation": gen,
        "best_fitness": best.fitness,
        "avg_fitness": sum(fitnesses) / len(fitnesses) if fitnesses else 0,
        "best_served": best.metrics.total_served if best.metrics else 0,
        "best_throughput": best.metrics.throughput if best.metrics else 0,
        "best_utilization": best.metrics.avg_utilization if best.metrics else 0,
        "elapsed": time.time() - start_time,
    })
