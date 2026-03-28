import type { World, Worker, Item, Station, StationType, ItemState } from "../types";
import { patchAt, buildBlockedGrid, astarDirection } from "../helpers";
import { isAdjacentToStation } from "../station-utils.js";
import type {
  Perception,
  ItemView,
  StationView,
  AdjacentPickup,
  PipelineSnapshot,
  StationSummary,
} from "./types";

function toItemView(item: Item): ItemView {
  return { id: item.id, type: item.type, state: item.state, x: item.x, y: item.y };
}

function toStationView(s: Station): StationView {
  return { type: s.type, x: s.x, y: s.y };
}

function findNearestStation(
  world: World,
  type: StationType,
  fromX: number,
  fromY: number,
): { x: number; y: number } | null {
  let best: { x: number; y: number } | null = null;
  let bestDist = Infinity;
  for (const s of world.stations) {
    if (s.type !== type) continue;
    const d = Math.abs(s.x - fromX) + Math.abs(s.y - fromY);
    if (d < bestDist) {
      bestDist = d;
      best = { x: s.x, y: s.y };
    }
  }
  return best;
}

function isItemClaimed(world: World, itemId: number, excludeWorkerId: number): boolean {
  return world.workers.some((w) => w.id !== excludeWorkerId && w.carryingItem === itemId);
}

function getAdjacentStations(worker: Worker, world: World): Station[] {
  const result: Station[] = [];
  for (const s of world.stations) {
    if (isAdjacentToStation(worker.x, worker.y, s)) {
      result.push(s);
    }
  }
  return result;
}

function buildPickup(item: Item, station: Station, worker: Worker, world: World): AdjacentPickup {
  const next = world.workflow.nextPlaceFor(item.state) as StationType | null;
  return {
    item: toItemView(item),
    station: toStationView(station),
    nextStationType: next,
    nearestNext: next ? findNearestStation(world, next, worker.x, worker.y) : null,
  };
}

function getUnclaimedItemsAt(
  world: World,
  x: number,
  y: number,
  excludeWorkerId: number,
): Item[] {
  return world.items.filter(
    (i) =>
      i.carriedBy === null &&
      i.x === x &&
      i.y === y &&
      !isItemClaimed(world, i.id, excludeWorkerId),
  );
}

// ============================================================
// Pipeline snapshot — environment signals (stigmergy)
// ============================================================

function computePipelineSnapshot(world: World): PipelineSnapshot {
  const stationTotals = new Map<string, number>();
  for (const s of world.stations) {
    stationTotals.set(s.type, (stationTotals.get(s.type) ?? 0) + 1);
  }

  const itemsAtStation = new Map<string, number>();
  const itemsByState: Record<string, number> = {};
  for (const item of world.items) {
    if (item.carriedBy !== null) continue;
    const stationType = patchAt(world, item.x, item.y);
    if (stationType !== "floor") {
      itemsAtStation.set(stationType, (itemsAtStation.get(stationType) ?? 0) + 1);
    }
    itemsByState[item.state] = (itemsByState[item.state] ?? 0) + 1;
  }

  const workersBusy = new Map<string, number>();
  for (const w of world.workers) {
    if (w.state !== "working") continue;
    for (const s of world.stations) {
      if (isAdjacentToStation(w.x, w.y, s)) {
        workersBusy.set(s.type, (workersBusy.get(s.type) ?? 0) + 1);
        break;
      }
    }
  }

  const stations: Record<string, StationSummary> = {};
  for (const [type, total] of stationTotals) {
    stations[type] = {
      total,
      itemCount: itemsAtStation.get(type) ?? 0,
      workersBusy: workersBusy.get(type) ?? 0,
    };
  }

  return { stations, itemsByState };
}

// ============================================================
// perceive: World × Worker → Perception  (pure)
// ============================================================

export function perceive(world: World, worker: Worker): Perception {
  const adjacentStations = getAdjacentStations(worker, world);

  // --- Carrying context ---
  const carriedItem =
    worker.carryingItem !== null
      ? world.items.find((i) => i.id === worker.carryingItem) ?? null
      : null;
  const carriedView = carriedItem ? toItemView(carriedItem) : null;
  const carriedPickupRole = carriedItem
    ? world.workflow.placeRole(patchAt(world, carriedItem.x, carriedItem.y))
    : undefined;

  let adjacentStorageForCarried: StationView | null = null;
  let adjacentTransform: Perception["adjacentTransform"] = null;
  let nextStationForCarried: StationType | null = null;
  let nearestNextStation: { x: number; y: number } | null = null;
  let nearestStorageForCarried: { x: number; y: number } | null = null;

  if (carriedItem) {
    const correctStorage = world.workflow.storageFor(carriedItem.type) as StationType | null;
    const adjStorage = correctStorage
      ? adjacentStations.find((s) => s.type === correctStorage)
      : null;
    if (adjStorage) adjacentStorageForCarried = toStationView(adjStorage);
    nearestStorageForCarried = correctStorage
      ? findNearestStation(world, correctStorage, worker.x, worker.y)
      : null;

    for (const s of adjacentStations) {
      const transition = world.workflow.findTransition(s.type, carriedItem.state);
      if (transition) {
        adjacentTransform = {
          station: toStationView(s),
          rule: {
            station: s.type,
            fromState: transition.fromColor as ItemState,
            toState: transition.toColor as ItemState,
            duration: transition.duration,
          },
        };
        break;
      }
    }

    const nextPlace = world.workflow.nextPlaceFor(carriedItem.state);
    nextStationForCarried = nextPlace as StationType | null;
    if (nextStationForCarried) {
      nearestNextStation = findNearestStation(
        world,
        nextStationForCarried,
        worker.x,
        worker.y,
      );
    }
  }

  // --- Not-carrying context ---
  const adjacentReturning: AdjacentPickup[] = [];
  const adjacentReceiving: ItemView[] = [];
  const adjacentStorageProcessable: AdjacentPickup[] = [];
  const adjacentProcessDone: AdjacentPickup[] = [];

  if (!carriedItem) {
    for (const s of adjacentStations) {
      const items = getUnclaimedItemsAt(world, s.x, s.y, worker.id);
      if (items.length === 0) continue;

      const role = world.workflow.placeRole(s.type);

      if (role === "return") {
        for (const item of items) {
          adjacentReturning.push(buildPickup(item, s, worker, world));
        }
      } else if (role === "intake") {
        for (const item of items) {
          adjacentReceiving.push(toItemView(item));
        }
      } else if (role === "storage") {
        for (const item of items) {
          if (!world.workflow.isTerminal(item.state)) {
            adjacentStorageProcessable.push(buildPickup(item, s, worker, world));
          }
        }
      } else {
        for (const item of items) {
          if (world.workflow.isOutputOf(s.type, item.state) && !world.workflow.isTerminal(item.state)) {
            adjacentProcessDone.push(buildPickup(item, s, worker, world));
          }
        }
      }
    }
  }

  // --- Pipeline snapshot (stigmergy signals) ---
  const pipeline = computePipelineSnapshot(world);

  // --- Global work scan (pipeline-aware) ---
  const nearestWork = findNearestWork(world, worker, pipeline);

  // --- BFS directions ---
  const blocked = buildBlockedGrid(world, worker.id);
  const { cols, rows } = world;
  const dirToNextStation = nearestNextStation
    ? astarDirection(cols, rows, blocked, worker.x, worker.y, nearestNextStation.x, nearestNextStation.y, true)
    : null;
  const dirToStorage = nearestStorageForCarried
    ? astarDirection(cols, rows, blocked, worker.x, worker.y, nearestStorageForCarried.x, nearestStorageForCarried.y, true)
    : null;
  const dirToWork = nearestWork
    ? astarDirection(cols, rows, blocked, worker.x, worker.y, nearestWork.x, nearestWork.y, true)
    : null;

  return {
    workerId: worker.id,
    workerX: worker.x,
    workerY: worker.y,
    carriedItem: carriedView,
    carriedPickupRole,
    adjacentStorageForCarried,
    adjacentTransform,
    nextStationForCarried,
    nearestNextStation,
    nearestStorageForCarried,
    adjacentReturning,
    adjacentReceiving,
    adjacentStorageProcessable,
    adjacentProcessDone,
    nearestWork,
    dirToNextStation,
    dirToStorage,
    dirToWork,
    pipeline,
  };
}

/**
 * Pipeline-aware work selection.
 *
 * Each candidate is scored using environment signals:
 *   score = basePriority × nextStationCapacity
 */
function findNearestWork(
  world: World,
  worker: Worker,
  pipeline: PipelineSnapshot,
): Perception["nearestWork"] {
  let best: {
    x: number;
    y: number;
    stationType: StationType;
    score: number;
    dist: number;
  } | null = null;

  for (const item of world.items) {
    if (item.carriedBy !== null) continue;
    if (isItemClaimed(world, item.id, worker.id)) continue;
    if (world.workflow.isTerminal(item.state)) continue;

    const patch = patchAt(world, item.x, item.y);
    const patchRole = world.workflow.placeRole(patch);
    let basePriority = 0;

    if (patchRole === "return") {
      basePriority = 4;
    } else if (patchRole === "intake") {
      basePriority = 3;
    } else if (patchRole === "storage") {
      basePriority = 2;
    } else {
      if (world.workflow.isOutputOf(patch, item.state)) {
        basePriority = 1;
      } else {
        continue;
      }
    }

    let capacityFactor = 1.0;
    const nextPlace = world.workflow.nextPlaceFor(item.state);
    if (nextPlace) {
      const summary = pipeline.stations[nextPlace];
      if (summary && summary.total > 0) {
        const occupied = summary.itemCount + summary.workersBusy;
        const available = Math.max(0, summary.total - occupied);
        if (available === 0) {
          capacityFactor = 0.3;
        }
      }
    }
    if (patchRole === "intake") {
      const storageType = world.workflow.storageFor(item.type);
      if (storageType) {
        const summary = pipeline.stations[storageType];
        if (summary && summary.total > 0) {
          const occupied = summary.itemCount;
          if (occupied >= summary.total * 3) {
            capacityFactor = 0.5;
          }
        }
      }
    }

    const score = basePriority * capacityFactor;
    const dist = Math.abs(item.x - worker.x) + Math.abs(item.y - worker.y);

    if (
      !best ||
      score > best.score ||
      (score === best.score && dist < best.dist)
    ) {
      best = { x: item.x, y: item.y, stationType: patch, score, dist };
    }
  }

  return best ? { x: best.x, y: best.y, stationType: best.stationType } : null;
}
