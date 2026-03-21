import type { BackroomLayout, SimConfig, Recipe, World } from "../types";
import type { WorkflowGraph } from "../workflow/graph";
import { createWorld, tickWorld } from "../simulation";

/**
 * Fitness metrics collected from a headless simulation run.
 */
export interface FitnessMetrics {
  /** Items that reached the "served" state per tick */
  throughput: number;
  /** Per-station-type utilization: fraction of time each station type was occupied */
  stationUtilization: Record<string, number>;
  /** Average station utilization across all processing station types */
  avgUtilization: number;
  /** Per-worker idle ratio: fraction of ticks each worker was idle */
  workerIdleRatios: number[];
  /** Average worker idle ratio */
  avgWorkerIdle: number;
  /** Total items served */
  totalServed: number;
  /** Combined fitness score (higher is better) */
  fitness: number;
}

export interface EvalConfig {
  /** Number of ticks to simulate (default: 5000) */
  ticks: number;
  /** Weight for throughput in fitness (default: 1.0) */
  throughputWeight: number;
  /** Weight for average utilization in fitness (default: 0.5) */
  utilizationWeight: number;
  /** Weight for worker idle penalty in fitness (default: -0.3) */
  idlePenalty: number;
}

export const DEFAULT_EVAL_CONFIG: EvalConfig = {
  ticks: 5000,
  throughputWeight: 1.0,
  utilizationWeight: 0.5,
  idlePenalty: -0.3,
};

/**
 * Evaluate a layout by running a headless simulation and collecting metrics.
 */
export function evaluateLayout(
  layout: BackroomLayout,
  simConfig: SimConfig,
  workflow: WorkflowGraph,
  recipe: Recipe,
  evalConfig: EvalConfig = DEFAULT_EVAL_CONFIG,
): FitnessMetrics {
  const world = createWorld(simConfig, layout, workflow, recipe);

  // Track station occupancy: how many ticks each station had an item on it
  const stationOccupied = new Map<string, number>(); // stationType -> occupied ticks
  const stationCounts = new Map<string, number>(); // stationType -> count
  for (const s of world.stations) {
    stationCounts.set(s.type, (stationCounts.get(s.type) ?? 0) + 1);
  }

  // Track worker idle ticks
  const workerIdleTicks = new Map<number, number>();
  const workerTotalTicks = new Map<number, number>();

  for (let t = 0; t < evalConfig.ticks; t++) {
    tickWorld(world);

    // Sample station occupancy
    sampleStationOccupancy(world, stationOccupied);

    // Sample worker idle
    for (const w of world.workers) {
      workerTotalTicks.set(w.id, (workerTotalTicks.get(w.id) ?? 0) + 1);
      if (w.state === "idle" && w.carryingItem === null) {
        workerIdleTicks.set(w.id, (workerIdleTicks.get(w.id) ?? 0) + 1);
      }
    }
  }

  return computeMetrics(
    world,
    evalConfig,
    stationOccupied,
    stationCounts,
    workerIdleTicks,
    workerTotalTicks,
  );
}

function sampleStationOccupancy(
  world: World,
  stationOccupied: Map<string, number>,
) {
  // Count stations that have items (not carried) on them
  const occupiedSet = new Set<string>();
  for (const item of world.items) {
    if (item.carriedBy !== null) continue;
    const key = `${item.x},${item.y}`;
    if (world.stationTileSet.has(key)) {
      const station = world.stations.find(
        (s) => s.x === item.x && s.y === item.y,
      );
      if (station) occupiedSet.add(`${station.type}:${station.x},${station.y}`);
    }
  }
  // Also count stations with workers working adjacent
  for (const w of world.workers) {
    if (w.state === "working" && w.workTargetX !== null && w.workTargetY !== null) {
      const station = world.stations.find(
        (s) => s.x === w.workTargetX && s.y === w.workTargetY,
      );
      if (station) occupiedSet.add(`${station.type}:${station.x},${station.y}`);
    }
  }

  for (const key of occupiedSet) {
    const stationType = key.split(":")[0];
    stationOccupied.set(stationType, (stationOccupied.get(stationType) ?? 0) + 1);
  }
}

function computeMetrics(
  world: World,
  evalConfig: EvalConfig,
  stationOccupied: Map<string, number>,
  stationCounts: Map<string, number>,
  workerIdleTicks: Map<number, number>,
  workerTotalTicks: Map<number, number>,
): FitnessMetrics {
  const totalTicks = evalConfig.ticks;
  const totalServed = world.ordersServed;
  const throughput = totalServed / totalTicks;

  // Station utilization per type
  const stationUtilization: Record<string, number> = {};
  let utilSum = 0;
  let utilCount = 0;
  for (const [type, count] of stationCounts) {
    // Skip non-processing stations (entrance, etc.)
    const role = world.workflow.placeRole(type);
    if (!role || role === "entrance") continue;

    const occupied = stationOccupied.get(type) ?? 0;
    const maxOccupied = count * totalTicks;
    const util = maxOccupied > 0 ? occupied / maxOccupied : 0;
    stationUtilization[type] = util;

    if (role === "process" || role === "output") {
      utilSum += util;
      utilCount++;
    }
  }
  const avgUtilization = utilCount > 0 ? utilSum / utilCount : 0;

  // Worker idle ratios
  const workerIdleRatios: number[] = [];
  for (const [id, total] of workerTotalTicks) {
    const idle = workerIdleTicks.get(id) ?? 0;
    workerIdleRatios.push(total > 0 ? idle / total : 0);
  }
  const avgWorkerIdle =
    workerIdleRatios.length > 0
      ? workerIdleRatios.reduce((a, b) => a + b, 0) / workerIdleRatios.length
      : 0;

  // Combined fitness
  const fitness =
    throughput * evalConfig.throughputWeight * 1000 +
    avgUtilization * evalConfig.utilizationWeight +
    avgWorkerIdle * evalConfig.idlePenalty;

  return {
    throughput,
    stationUtilization,
    avgUtilization,
    workerIdleRatios,
    avgWorkerIdle,
    totalServed,
    fitness,
  };
}
