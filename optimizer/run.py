#!/usr/bin/env python3
"""CLI runner for the layout optimizer GA.

Usage:
    python -m optimizer.run                     # defaults
    python -m optimizer.run --generations 100   # more generations
    python -m optimizer.run --population 50 --ticks 3000
"""

from __future__ import annotations

import argparse
import json
import sys

from .evaluate import evaluate_baseline
from .ga import run_ga, GAConfig


def main() -> None:
    parser = argparse.ArgumentParser(description="Layout Optimizer (GA)")
    parser.add_argument("--population", type=int, default=30, help="Population size")
    parser.add_argument("--generations", type=int, default=50, help="Number of generations")
    parser.add_argument("--ticks", type=int, default=5000, help="Simulation ticks per evaluation")
    parser.add_argument("--elitism", type=float, default=0.1, help="Elitism rate")
    parser.add_argument("--crossover", type=float, default=0.7, help="Crossover rate")
    parser.add_argument("--mutation", type=float, default=0.15, help="Mutation rate")
    parser.add_argument("--tournament", type=int, default=3, help="Tournament size")
    parser.add_argument("--recipe", type=str, default="backroom", help="Recipe: backroom or steak")
    parser.add_argument("--seed", type=int, default=None, help="Random seed")
    parser.add_argument("--output", type=str, default=None, help="Save best layout to JSON file")
    args = parser.parse_args()

    # Baseline
    print("=" * 60)
    print("Evaluating baseline layout...")
    baseline_layout, baseline_metrics = evaluate_baseline(ticks=args.ticks, recipe=args.recipe)
    print(f"  Baseline fitness:    {baseline_metrics.fitness:.4f}")
    print(f"  Baseline throughput: {baseline_metrics.throughput:.4f} ({baseline_metrics.total_served} served)")
    print(f"  Baseline util:       {baseline_metrics.avg_utilization:.4f}")
    print(f"  Baseline idle:       {baseline_metrics.avg_worker_idle:.4f}")
    print("=" * 60)

    # GA
    config = GAConfig(
        population_size=args.population,
        generations=args.generations,
        sim_ticks=args.ticks,
        elitism_rate=args.elitism,
        crossover_rate=args.crossover,
        mutation_rate=args.mutation,
        tournament_size=args.tournament,
        recipe=args.recipe,
        seed=args.seed,
    )

    def progress(gen: int, best, avg_fitness: float) -> None:
        served = best.metrics.total_served if best.metrics else 0
        print(
            f"Gen {gen:3d} | "
            f"Best: {best.fitness:8.4f} (served={served:3d}) | "
            f"Avg: {avg_fitness:8.4f}"
        )

    print(f"\nStarting GA: pop={config.population_size}, gen={config.generations}, ticks={config.sim_ticks}")
    print("-" * 60)

    result = run_ga(config=config, on_progress=progress)

    print("-" * 60)
    print(f"\nCompleted in {result.elapsed_seconds:.1f}s")
    print(f"\nBest layout fitness: {result.best.fitness:.4f}")
    if result.best.metrics:
        m = result.best.metrics
        print(f"  Throughput:  {m.throughput:.4f} ({m.total_served} served)")
        print(f"  Utilization: {m.avg_utilization:.4f}")
        print(f"  Worker idle: {m.avg_worker_idle:.4f}")

    improvement = result.best.fitness - baseline_metrics.fitness
    pct = (improvement / abs(baseline_metrics.fitness)) * 100 if baseline_metrics.fitness != 0 else 0
    print(f"\n  vs Baseline: {improvement:+.4f} ({pct:+.1f}%)")

    # Print best layout
    print(f"\nBest layout stations:")
    for s in result.best.layout.stations:
        print(f"  {s.type:12s} ({s.x:2d}, {s.y:2d})")

    # Save if requested
    if args.output:
        output = {
            "best_layout": result.best.layout.to_dict(),
            "best_metrics": {
                "fitness": result.best.fitness,
                "throughput": result.best.metrics.throughput if result.best.metrics else 0,
                "total_served": result.best.metrics.total_served if result.best.metrics else 0,
                "avg_utilization": result.best.metrics.avg_utilization if result.best.metrics else 0,
                "station_utilization": result.best.metrics.station_utilization if result.best.metrics else {},
            },
            "baseline_fitness": baseline_metrics.fitness,
            "history": result.history,
            "config": {
                "population_size": config.population_size,
                "generations": config.generations,
                "sim_ticks": config.sim_ticks,
                "elitism_rate": config.elitism_rate,
                "crossover_rate": config.crossover_rate,
                "mutation_rate": config.mutation_rate,
                "tournament_size": config.tournament_size,
                "seed": config.seed,
            },
        }
        with open(args.output, "w") as f:
            json.dump(output, f, indent=2)
        print(f"\nSaved results to {args.output}")


if __name__ == "__main__":
    main()
