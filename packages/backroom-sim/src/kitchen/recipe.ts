import type { Recipe, BackroomLayout, SimConfig } from "../types";

/**
 * Steak restaurant recipe — default concept for the kitchen simulator.
 */
export const STEAK_RECIPE: Recipe = {
  name: "Steak Restaurant",
  description: "스테이크 레스토랑 — 주문에서 서빙까지의 풀 파이프라인",

  stationTypes: [
    "order_window", "fridge", "cutting_board", "burner",
    "resting_rack", "plating_station", "pass", "dish_return",
    "sink", "entrance",
  ],

  stationMeta: {
    order_window:    { emoji: "📋", color: "#3a5535", tileAsset: "order_window.png" },
    fridge:          { emoji: "❄️", color: "#2e4f7a", tileAsset: "fridge.png" },
    cutting_board:   { emoji: "🔪", color: "#5a4f40", tileAsset: "cutting_board.png" },
    burner:          { emoji: "🔥", color: "#6b3030", tileAsset: "burner.png" },
    resting_rack:    { emoji: "🧊", color: "#4a5568", tileAsset: "resting_rack.png" },
    plating_station: { emoji: "🍽️", color: "#2a6040", tileAsset: "plating_station.png" },
    pass:            { emoji: "🛎️", color: "#6b5010", tileAsset: "pass.png" },
    dish_return:     { emoji: "🔙", color: "#5a4a60", tileAsset: "dish_return.png" },
    sink:            { emoji: "🚰", color: "#3a5577", tileAsset: "sink.png" },
    entrance:        { emoji: "🚪", color: "#4a6050", tileAsset: "entrance.png" },
  },

  itemTypes: ["ribeye", "sirloin", "tenderloin", "tbone"],
  initialItemState: "raw",
  spawnStationType: "fridge",

  completedStates: ["served", "dirty", "clean"],
  servedState: "served",

  chartStages: [
    { label: "raw",       state: "raw",       color: "#e74c3c" },
    { label: "portioned", state: "portioned", color: "#e67e22" },
    { label: "searing",   state: "searing",   color: "#b7950b" },
    { label: "seared",    state: "seared",    color: "#f1c40f" },
    { label: "resting",   state: "resting",   color: "#1e8449" },
    { label: "rested",    state: "rested",    color: "#2ecc71" },
    { label: "plated",    state: "plated",    color: "#3498db" },
    { label: "served",    state: "served",    color: "#9b59b6" },
    { label: "dirty",     state: "dirty",     color: "#95a5a6" },
    { label: "clean",     state: "clean",     color: "#1abc9c" },
  ],

  rewardMilestones: [
    { state: "served", reward: 5.0 },
    { state: "clean", reward: 1.0 },
  ],

  floorType: "floor",
};

/** Default kitchen layout for the steak recipe — 14×10 grid. */
export const STEAK_LAYOUT: BackroomLayout = {
  cols: 14,
  rows: 10,
  stations: [
    { type: "entrance", x: 0, y: 0 },
    { type: "order_window", x: 3, y: 0 },
    { type: "order_window", x: 4, y: 0 },
    { type: "pass", x: 10, y: 0 },
    { type: "pass", x: 11, y: 0 },
    { type: "fridge", x: 0, y: 2 },
    { type: "fridge", x: 0, y: 3 },
    { type: "fridge", x: 0, y: 4 },
    { type: "cutting_board", x: 3, y: 3 },
    { type: "cutting_board", x: 4, y: 3 },
    { type: "burner", x: 7, y: 3 },
    { type: "burner", x: 8, y: 3 },
    { type: "burner", x: 9, y: 3 },
    { type: "resting_rack", x: 5, y: 5 },
    { type: "resting_rack", x: 6, y: 5 },
    { type: "plating_station", x: 11, y: 3 },
    { type: "plating_station", x: 12, y: 3 },
    { type: "dish_return", x: 10, y: 7 },
    { type: "dish_return", x: 11, y: 7 },
    { type: "sink", x: 0, y: 8 },
    { type: "sink", x: 1, y: 8 },
  ],
};

/** Default config for steak recipe. */
export const STEAK_CONFIG: SimConfig = {
  workerCount: 3,
  orderSize: 4,
  orderInterval: 500,
};
