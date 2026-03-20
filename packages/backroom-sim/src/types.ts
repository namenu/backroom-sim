// --- Stations (Patches) ---
// String-generic: concrete station types are defined per recipe.
export type StationType = string;

export interface Station {
  type: StationType;
  x: number;
  y: number;
}

// --- Items ---
// String-generic: concrete item types & states are defined per recipe.
export type ItemType = string;
export type ItemState = string;

export interface Item {
  id: number;
  type: ItemType;
  state: ItemState;
  x: number;
  y: number;
  carriedBy: number | null;
}

// --- Workers (Turtles) ---
export interface Worker {
  id: number;
  x: number;
  y: number;
  fatigue: number;
  carryingItem: number | null;
  state: "idle" | "moving" | "working";
  departing: boolean;
  intent: string;
  moveCooldown: number;
  workTimer: number;
  workDuration: number;
  workTargetX: number | null;
  workTargetY: number | null;
}

// --- Log ---
export interface LogEntry {
  tick: number;
  workerId: number;
  message: string;
}

// --- Layout (flexible, for map editor) ---
export interface BackroomLayout {
  cols: number;
  rows: number;
  stations: { type: StationType; x: number; y: number }[];
}

// --- Config ---
export interface SimConfig {
  workerCount: number;
  /** Number of items per order batch */
  orderSize: number;
  /** Ticks between order batches */
  orderInterval: number;
}

export const DEFAULT_CONFIG: SimConfig = {
  workerCount: 3,
  orderSize: 4,
  orderInterval: 500,
};

// --- World ---
import type { WorkflowGraph } from "./workflow/graph";

export interface World {
  tick: number;
  cols: number;
  rows: number;
  stations: Station[];
  stationTileSet: Set<string>;
  items: Item[];
  workers: Worker[];
  logs: LogEntry[];
  nextItemId: number;
  nextWorkerId: number;
  config: SimConfig;
  workflow: WorkflowGraph;
  recipe: Recipe;
  /** Tracking: total orders served */
  ordersServed: number;
}

// ============================================================
// Recipe — single source of truth for a simulation concept
// ============================================================

/** Visual metadata for a station type */
export interface StationMeta {
  readonly emoji: string;
  readonly color: string;
  /** Asset filename in tiles/ directory (e.g. "burner.png") */
  readonly tileAsset: string;
}

/** Chart stage for throughput visualization */
export interface ChartStageDef {
  readonly label: string;
  readonly state: ItemState;
  readonly color: string;
}

/** Reward milestone for RL environment */
export interface RewardMilestone {
  readonly state: ItemState;
  readonly reward: number;
}

/**
 * Recipe — bundles everything needed to define a simulation concept.
 *
 * To create a new concept (e.g., bakery, ramen shop, factory):
 *   1. Define a Recipe with your stations, items, workflow, and layout.
 *   2. Pass it to createWorld() and the viewer.
 *   3. Generate/provide tile assets matching stationMeta[].tileAsset.
 */
export interface Recipe {
  readonly name: string;
  readonly description: string;

  /** Station type identifiers used in this recipe */
  readonly stationTypes: readonly string[];
  /** Visual metadata per station type */
  readonly stationMeta: Readonly<Record<string, StationMeta>>;

  /** Item types that get spawned (cycled through per order) */
  readonly itemTypes: readonly string[];
  /** Initial state of spawned items */
  readonly initialItemState: ItemState;
  /** Which station type to spawn items at */
  readonly spawnStationType: StationType;

  /** States considered "completed" for throughput tracking */
  readonly completedStates: readonly ItemState[];
  /** The state that increments ordersServed counter */
  readonly servedState: ItemState;

  /** Chart stages for throughput visualization */
  readonly chartStages: readonly ChartStageDef[];
  /** Reward milestones for RL env */
  readonly rewardMilestones: readonly RewardMilestone[];

  /** The "floor" type identifier (not a station) */
  readonly floorType: string;
}
