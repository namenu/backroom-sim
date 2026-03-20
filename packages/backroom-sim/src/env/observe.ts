import type { World, Worker, Recipe } from "../types";
import { patchAt } from "../helpers";
import {
  type Observation,
  VIEW_RADIUS,
  OBS_SIZE,
} from "./types";

// ─── Dynamic encoding ──────────────────────────────────────

function buildStationMap(recipe: Recipe): { map: Record<string, number>; max: number } {
  const map: Record<string, number> = { [recipe.floorType]: 1 };
  let idx = 2;
  for (const st of recipe.stationTypes) {
    map[st] = idx++;
  }
  return { map, max: idx };
}

function buildItemStateMap(recipe: Recipe): { map: Record<string, number>; max: number } {
  const map: Record<string, number> = {};
  let idx = 1;
  for (const stage of recipe.chartStages) {
    if (!(stage.state in map)) {
      map[stage.state] = idx++;
    }
  }
  return { map, max: idx };
}

function buildItemTypeMap(recipe: Recipe): { map: Record<string, number>; max: number } {
  const map: Record<string, number> = {};
  let idx = 1;
  for (const t of recipe.itemTypes) {
    map[t] = idx++;
  }
  return { map, max: idx };
}

// Cache maps per recipe (reference equality)
let _cachedRecipe: Recipe | null = null;
let _stationMap: { map: Record<string, number>; max: number };
let _itemStateMap: { map: Record<string, number>; max: number };
let _itemTypeMap: { map: Record<string, number>; max: number };

function ensureMaps(recipe: Recipe) {
  if (_cachedRecipe === recipe) return;
  _cachedRecipe = recipe;
  _stationMap = buildStationMap(recipe);
  _itemStateMap = buildItemStateMap(recipe);
  _itemTypeMap = buildItemTypeMap(recipe);
}

// ─── Observation extraction ─────────────────────────────────

/**
 * Extract a flat numeric observation for a single worker.
 *
 * Layout: 7×7 grid (row-major) × 4 channels, then 2 agent features.
 */
export function observe(world: World, worker: Worker): Observation {
  ensureMaps(world.recipe);

  const obs = new Float32Array(OBS_SIZE);
  let idx = 0;

  const { cols, rows } = world;
  const STATION_MAP = _stationMap.map;
  const STATION_MAX = _stationMap.max;
  const ITEM_STATE_MAP = _itemStateMap.map;
  const ITEM_STATE_MAX = _itemStateMap.max;
  const ITEM_TYPE_MAP = _itemTypeMap.map;
  const ITEM_TYPE_MAX = _itemTypeMap.max;

  // Build spatial lookups
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

      const stationType = world.stationTileSet.has(`${gx},${gy}`)
        ? patchAt(world, gx, gy)
        : world.recipe.floorType;
      obs[idx++] = (STATION_MAP[stationType] ?? 0) / STATION_MAX;

      const item = itemGrid.get(key);
      obs[idx++] = item ? 1 : 0;
      obs[idx++] = item ? (ITEM_STATE_MAP[item.state] ?? 0) / ITEM_STATE_MAX : 0;

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
