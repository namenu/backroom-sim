import type { World, Worker } from "../types";
import { patchAt } from "../helpers";
import {
  type Observation,
  VIEW_RADIUS,
  OBS_SIZE,
} from "./types";

// ─── Encoding maps ──────────────────────────────────────────

const STATION_TYPE_MAP: Record<string, number> = {
  floor: 1,
  receiving: 2,
  shelf: 3,
  fridge: 4,
  prep_table: 5,
  stove: 6,
  counter: 7,
  returning: 8,
  sink: 9,
  trash: 10,
  entrance: 11,
};
const STATION_MAX = 12;

const ITEM_STATE_MAP: Record<string, number> = {
  raw: 1,
  chopped: 2,
  cooked: 3,
  served: 4,
  dirty: 5,
  clean: 6,
  stored: 7,
};
const ITEM_STATE_MAX = 7;

const ITEM_TYPE_MAP: Record<string, number> = {
  onion: 1,
  pork: 2,
  noodle: 3,
  soup_base: 4,
};
const ITEM_TYPE_MAX = 4;

// ─── Observation extraction ─────────────────────────────────

/**
 * Extract a flat numeric observation for a single worker.
 *
 * Layout: 7×7 grid (row-major) × 4 channels, then 2 agent features.
 */
export function observe(world: World, worker: Worker): Observation {
  const obs = new Float32Array(OBS_SIZE);
  let idx = 0;

  // Build spatial lookups for this view (avoids 49 × O(N) scans)
  const { cols, rows } = world;
  const itemGrid = new Map<number, typeof world.items[0]>();
  for (const item of world.items) {
    if (item.carriedBy !== null) continue;
    const key = item.y * cols + item.x;
    if (!itemGrid.has(key)) itemGrid.set(key, item);
  }
  const workerGrid = new Set<number>();
  for (const w of world.workers) {
    if (w.id !== worker.id) workerGrid.add(w.y * cols + w.x);
  }

  // Local grid view
  for (let dy = -VIEW_RADIUS; dy <= VIEW_RADIUS; dy++) {
    for (let dx = -VIEW_RADIUS; dx <= VIEW_RADIUS; dx++) {
      const gx = worker.x + dx;
      const gy = worker.y + dy;

      if (gx < 0 || gx >= cols || gy < 0 || gy >= rows) {
        obs[idx++] = 0;
        obs[idx++] = 0;
        obs[idx++] = 0;
        obs[idx++] = 0;
        continue;
      }

      const key = gy * cols + gx;

      // Station type
      const stationType = world.stationTileSet.has(`${gx},${gy}`)
        ? patchAt(world, gx, gy)
        : "floor";
      obs[idx++] = (STATION_TYPE_MAP[stationType] ?? 0) / STATION_MAX;

      // Item at this cell
      const item = itemGrid.get(key);
      obs[idx++] = item ? 1 : 0;
      obs[idx++] = item ? (ITEM_STATE_MAP[item.state] ?? 0) / ITEM_STATE_MAX : 0;

      // Other worker at this cell
      obs[idx++] = workerGrid.has(key) ? 1 : 0;
    }
  }

  // Agent features
  const carried = worker.carryingItem !== null
    ? world.items.find((i) => i.id === worker.carryingItem)
    : null;
  obs[idx++] = carried ? (ITEM_TYPE_MAP[carried.type] ?? 0) / ITEM_TYPE_MAX : 0;
  obs[idx++] = carried ? (ITEM_STATE_MAP[carried.state] ?? 0) / ITEM_STATE_MAX : 0;

  return obs;
}
