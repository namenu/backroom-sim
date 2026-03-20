import type { Recipe, BackroomLayout, SimConfig } from "../types";

/**
 * Backroom recipe — the original concept.
 * A general-purpose kitchen/warehouse with receiving → prep → cook → serve → wash → store.
 */
export const BACKROOM_RECIPE: Recipe = {
  name: "Backroom",
  description: "원조 백룸 — 접수에서 보관까지의 다단계 파이프라인",

  stationTypes: [
    "receiving", "shelf", "fridge", "prep_table", "stove",
    "counter", "returning", "sink", "trash", "entrance",
  ],

  stationMeta: {
    receiving:   { emoji: "📦", color: "#3a5535", tileAsset: "receiving.png" },
    shelf:       { emoji: "🗄️", color: "#6b5010", tileAsset: "shelf.png" },
    fridge:      { emoji: "❄️", color: "#2e4f7a", tileAsset: "fridge.png" },
    prep_table:  { emoji: "🔪", color: "#5a4f40", tileAsset: "prep_table.png" },
    stove:       { emoji: "🔥", color: "#6b3030", tileAsset: "stove.png" },
    counter:     { emoji: "🍜", color: "#2a6040", tileAsset: "counter.png" },
    returning:   { emoji: "🔙", color: "#5a4a60", tileAsset: "returning.png" },
    sink:        { emoji: "🚰", color: "#3a5577", tileAsset: "sink.png" },
    trash:       { emoji: "🗑️", color: "#4a3f30", tileAsset: "trash.png" },
    entrance:    { emoji: "🚪", color: "#4a6050", tileAsset: "entrance.png" },
  },

  itemTypes: ["onion", "pork", "noodle", "soup_base"],
  initialItemState: "raw",
  spawnStationType: "receiving",

  completedStates: ["served", "dirty", "clean", "stored"],
  servedState: "served",

  chartStages: [
    { label: "raw",     state: "raw",     color: "#e74c3c" },
    { label: "chopped", state: "chopped", color: "#2ecc71" },
    { label: "cooked",  state: "cooked",  color: "#3498db" },
    { label: "served",  state: "served",  color: "#9b59b6" },
    { label: "dirty",   state: "dirty",   color: "#e67e22" },
    { label: "clean",   state: "clean",   color: "#1abc9c" },
    { label: "stored",  state: "stored",  color: "#34495e" },
  ],

  rewardMilestones: [
    { state: "served", reward: 5.0 },
    { state: "stored", reward: 1.0 },
  ],

  floorType: "floor",
};

/** Default backroom layout — compact 12×9 grid. */
export const BACKROOM_LAYOUT: BackroomLayout = {
  cols: 12,
  rows: 9,
  stations: [
    // Receiving (top row)
    { type: "receiving", x: 2, y: 0 },
    { type: "receiving", x: 3, y: 0 },
    { type: "receiving", x: 5, y: 0 },
    { type: "receiving", x: 6, y: 0 },
    // Shelves (left wall)
    { type: "shelf", x: 0, y: 2 },
    { type: "shelf", x: 0, y: 3 },
    { type: "shelf", x: 0, y: 4 },
    // Fridges (right wall)
    { type: "fridge", x: 11, y: 2 },
    { type: "fridge", x: 11, y: 3 },
    // Prep tables + stoves (row 3)
    { type: "prep_table", x: 3, y: 3 },
    { type: "prep_table", x: 4, y: 3 },
    { type: "prep_table", x: 6, y: 3 },
    { type: "prep_table", x: 7, y: 3 },
    { type: "stove", x: 8, y: 3 },
    { type: "stove", x: 9, y: 3 },
    // Counter / serving (row 6)
    { type: "counter", x: 4, y: 6 },
    { type: "counter", x: 5, y: 6 },
    { type: "counter", x: 7, y: 6 },
    { type: "counter", x: 8, y: 6 },
    // Returning
    { type: "returning", x: 9, y: 6 },
    { type: "returning", x: 10, y: 6 },
    // Sinks (bottom-left)
    { type: "sink", x: 1, y: 8 },
    { type: "sink", x: 2, y: 8 },
    // Trash (bottom-right)
    { type: "trash", x: 11, y: 8 },
    // Entrance (top-left corner — staff door)
    { type: "entrance", x: 0, y: 0 },
  ],
};

/** Default config for the backroom recipe. */
export const BACKROOM_CONFIG: SimConfig = {
  workerCount: 3,
  orderSize: 4,
  orderInterval: 400,
};
