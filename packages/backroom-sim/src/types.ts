// --- Stations (Patches) ---
export type StationType =
  | "order_window"
  | "fridge"
  | "cutting_board"
  | "burner"
  | "resting_rack"
  | "plating_station"
  | "pass"
  | "dish_return"
  | "sink"
  | "entrance"
  | "floor";

export interface Station {
  type: StationType;
  x: number;
  y: number;
}

// --- Items ---
export type ItemType = "ribeye" | "sirloin" | "tenderloin" | "tbone";
export type ItemState =
  | "ordered"
  | "raw"
  | "portioned"
  | "searing"
  | "seared"
  | "rested"
  | "plated"
  | "served"
  | "dirty"
  | "clean";

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
  /** Number of orders per batch */
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
  /** Tracking: total orders served */
  ordersServed: number;
}
