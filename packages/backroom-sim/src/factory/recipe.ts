import type { Recipe, BackroomLayout, SimConfig } from "../types";

/**
 * Factory recipe — large-scale Factorio-like production pipeline.
 * Ore/chemical/scrap processing through smelting, pressing, assembly, and shipping.
 */
export const FACTORY_RECIPE: Recipe = {
  name: "Factory",
  description: "대규모 공장 — 원자재에서 출하까지의 복합 생산 라인",

  stationTypes: [
    "entrance", "conveyor_hub", "pipe_junction", "inspector", "trash_bin",
    "smelter", "furnace", "press", "packaging_unit",
    "assembler", "chemical_mixer",
    "storage_depot", "cooling_tower",
  ],

  stationMeta: {
    entrance:       { emoji: "🚪", color: "#4a6050", tileAsset: "entrance.png" },
    conveyor_hub:   { emoji: "🔄", color: "#5a5a5a", tileAsset: "conveyor_hub.png" },
    pipe_junction:  { emoji: "🔧", color: "#3a5577", tileAsset: "pipe_junction.png" },
    inspector:      { emoji: "🔍", color: "#6b5010", tileAsset: "inspector.png" },
    trash_bin:      { emoji: "🗑️", color: "#4a3f30", tileAsset: "trash_bin.png" },
    smelter:        { emoji: "🔥", color: "#8b3030", tileAsset: "smelter.png", size: { w: 2, h: 2 } },
    furnace:        { emoji: "♨️", color: "#6b3030", tileAsset: "furnace.png", size: { w: 2, h: 2 } },
    press:          { emoji: "⚙️", color: "#4a4a6a", tileAsset: "press.png", size: { w: 2, h: 2 } },
    packaging_unit: { emoji: "📦", color: "#3a5535", tileAsset: "packaging_unit.png", size: { w: 2, h: 2 } },
    assembler:      { emoji: "🏭", color: "#2a6040", tileAsset: "assembler.png", size: { w: 2, h: 3 } },
    chemical_mixer: { emoji: "⚗️", color: "#5a2a6a", tileAsset: "chemical_mixer.png", size: { w: 2, h: 3 } },
    storage_depot:  { emoji: "🏗️", color: "#4a5568", tileAsset: "storage_depot.png", size: { w: 3, h: 2 } },
    cooling_tower:  { emoji: "❄️", color: "#2e4f7a", tileAsset: "cooling_tower.png", size: { w: 3, h: 2 } },
  } as Recipe["stationMeta"],

  itemTypes: ["ore", "chemical", "scrap"],
  initialItemState: "raw",
  spawnStationType: "storage_depot",

  completedStates: ["shipped", "recycled"],
  servedState: "shipped",

  chartStages: [
    { label: "raw",       state: "raw",       color: "#e74c3c" },
    { label: "smelted",   state: "smelted",   color: "#e67e22" },
    { label: "cooled",    state: "cooled",     color: "#3498db" },
    { label: "mixed",     state: "mixed",      color: "#9b59b6" },
    { label: "pressed",   state: "pressed",   color: "#f1c40f" },
    { label: "assembled", state: "assembled", color: "#2ecc71" },
    { label: "inspected", state: "inspected", color: "#1abc9c" },
    { label: "rejected",  state: "rejected",  color: "#95a5a6" },
    { label: "packaged",  state: "packaged",  color: "#3a5535" },
    { label: "shipped",   state: "shipped",   color: "#1e8449" },
    { label: "reclaimed", state: "reclaimed", color: "#d35400" },
    { label: "recycled",  state: "recycled",  color: "#34495e" },
  ],

  rewardMilestones: [
    { state: "shipped",  reward: 5.0 },
    { state: "recycled", reward: 1.0 },
  ],

  floorType: "floor",
};

/**
 * Default factory layout — 20x16 grid.
 *
 * Multi-tile stations are placed at their top-left corner.
 * Each tile of a multi-tile station is listed individually
 * (matching the pattern used in existing recipes).
 */
function multiTileStations(type: string, x: number, y: number, w: number, h: number) {
  const tiles: { type: string; x: number; y: number }[] = [];
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      tiles.push({ type, x: x + dx, y: y + dy });
    }
  }
  return tiles;
}

export const FACTORY_LAYOUT: BackroomLayout = {
  cols: 20,
  rows: 16,
  stations: [
    // Entrance (1x1)
    { type: "entrance", x: 0, y: 0 },

    // Storage depots (3x2) — raw material intake
    ...multiTileStations("storage_depot", 1, 0, 3, 2),
    ...multiTileStations("storage_depot", 5, 0, 3, 2),

    // Smelter (2x2)
    ...multiTileStations("smelter", 1, 3, 2, 2),
    ...multiTileStations("smelter", 4, 3, 2, 2),

    // Chemical mixer (2x3)
    ...multiTileStations("chemical_mixer", 10, 0, 2, 3),

    // Cooling tower (3x2)
    ...multiTileStations("cooling_tower", 1, 6, 3, 2),

    // Press (2x2)
    ...multiTileStations("press", 7, 4, 2, 2),

    // Assembler (2x3)
    ...multiTileStations("assembler", 10, 4, 2, 3),

    // Inspector (1x1)
    { type: "inspector", x: 14, y: 5 },

    // Furnace (2x2) — recycling
    ...multiTileStations("furnace", 14, 8, 2, 2),

    // Packaging unit (2x2)
    ...multiTileStations("packaging_unit", 14, 2, 2, 2),

    // Conveyor hub (1x1)
    { type: "conveyor_hub", x: 17, y: 7 },

    // Pipe junction (1x1)
    { type: "pipe_junction", x: 18, y: 7 },

    // Trash bin (1x1)
    { type: "trash_bin", x: 19, y: 15 },
  ],
};

/** Default config for the factory recipe. */
export const FACTORY_CONFIG: SimConfig = {
  workerCount: 5,
  orderSize: 6,
  orderInterval: 400,
};
