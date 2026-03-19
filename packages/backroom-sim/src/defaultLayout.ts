import type { BackroomLayout } from "./types";

/**
 * Default backroom layout — compact grid.
 * All passages are at most 2 tiles wide.
 */
export const DEFAULT_LAYOUT: BackroomLayout = {
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
    // Counter / serving (row 6) — 2 rows gap from prep
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
