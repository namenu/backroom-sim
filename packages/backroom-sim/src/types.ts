// --- Stations (Patches) ---
export type StationType =
  | "receiving"
  | "shelf"
  | "fridge"
  | "prep_table"
  | "stove"
  | "counter"
  | "returning"
  | "sink"
  | "trash"
  | "entrance"
  | "floor";

export interface Station {
  type: StationType;
  x: number;
  y: number;
}

// --- Items ---
export type ItemType = "onion" | "pork" | "noodle" | "soup_base";
export type ItemState = "raw" | "chopped" | "cooked" | "served" | "dirty" | "clean" | "stored";

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
  deliverySize: number;
  deliveryInterval: number;
}

export const DEFAULT_CONFIG: SimConfig = {
  workerCount: 3,
  deliverySize: 6,
  deliveryInterval: 600,
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
}
