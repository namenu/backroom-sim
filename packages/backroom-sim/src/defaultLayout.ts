import type { BackroomLayout } from "./types";

/**
 * Default kitchen layout — steak restaurant.
 *
 * 14×10 grid. Flow: order_window → fridge → cutting_board → burner
 *                    → resting_rack → plating_station → pass
 *                    dish_return → sink (cleanup loop)
 */
export const DEFAULT_LAYOUT: BackroomLayout = {
  cols: 14,
  rows: 10,
  stations: [
    // Entrance (top-left — staff door)
    { type: "entrance", x: 0, y: 0 },

    // Order window (top, where orders arrive)
    { type: "order_window", x: 3, y: 0 },
    { type: "order_window", x: 4, y: 0 },

    // Pass / serving window (top-right, where dishes go out)
    { type: "pass", x: 10, y: 0 },
    { type: "pass", x: 11, y: 0 },

    // Fridges (left wall, cold storage)
    { type: "fridge", x: 0, y: 2 },
    { type: "fridge", x: 0, y: 3 },
    { type: "fridge", x: 0, y: 4 },

    // Cutting boards (center-left)
    { type: "cutting_board", x: 3, y: 3 },
    { type: "cutting_board", x: 4, y: 3 },

    // Burners (center-right, the hot line)
    { type: "burner", x: 7, y: 3 },
    { type: "burner", x: 8, y: 3 },
    { type: "burner", x: 9, y: 3 },

    // Resting racks (center)
    { type: "resting_rack", x: 5, y: 5 },
    { type: "resting_rack", x: 6, y: 5 },

    // Plating stations (right side)
    { type: "plating_station", x: 11, y: 3 },
    { type: "plating_station", x: 12, y: 3 },

    // Dish return (bottom-right)
    { type: "dish_return", x: 10, y: 7 },
    { type: "dish_return", x: 11, y: 7 },

    // Sinks (bottom-left, dishwashing)
    { type: "sink", x: 0, y: 8 },
    { type: "sink", x: 1, y: 8 },
  ],
};
