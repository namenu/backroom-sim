import { describe, it, expect } from "vitest";
import { createWorld, tickWorld } from "../index";
import type { BackroomLayout, World } from "../index";

/**
 * Large kitchen: 40×28 grid (4x the default area).
 * More stations, more workers, longer distances.
 * Tests whether simple agents can still complete the steak pipeline at scale.
 *
 *  Layout sketch (40 cols × 28 rows):
 *
 *  Row 0:      order_window (spread across top with gaps)
 *  Row 1-2:    open floor
 *  Col 0:      fridges (left wall, with gaps)
 *  Row 10-11:  cutting_boards (two clusters)
 *  Row 15:     burners (spread with gaps)
 *  Row 18:     resting_racks
 *  Row 20:     plating_stations
 *  Row 22:     pass + dish_return
 *  Row 27:     sinks (bottom)
 */
const LARGE_LAYOUT: BackroomLayout = {
  cols: 40,
  rows: 28,
  stations: [
    // === Entrance ===
    { type: "entrance", x: 0, y: 0 },

    // === Order windows (top row) ===
    { type: "order_window", x: 5, y: 0 },
    { type: "order_window", x: 6, y: 0 },
    { type: "order_window", x: 7, y: 0 },
    { type: "order_window", x: 9, y: 0 },
    { type: "order_window", x: 10, y: 0 },

    // === Fridges (left wall, with gaps for passage) ===
    { type: "fridge", x: 0, y: 4 },
    { type: "fridge", x: 0, y: 5 },
    { type: "fridge", x: 0, y: 6 },
    // gap at y=7
    { type: "fridge", x: 0, y: 8 },
    { type: "fridge", x: 0, y: 9 },
    { type: "fridge", x: 0, y: 10 },
    // gap at y=11
    { type: "fridge", x: 0, y: 12 },
    { type: "fridge", x: 0, y: 13 },

    // === Cutting boards (row 10, two clusters) ===
    { type: "cutting_board", x: 8, y: 10 },
    { type: "cutting_board", x: 9, y: 10 },
    { type: "cutting_board", x: 10, y: 10 },
    { type: "cutting_board", x: 12, y: 10 },
    { type: "cutting_board", x: 13, y: 10 },
    { type: "cutting_board", x: 20, y: 10 },
    { type: "cutting_board", x: 21, y: 10 },
    { type: "cutting_board", x: 22, y: 10 },
    { type: "cutting_board", x: 24, y: 10 },
    { type: "cutting_board", x: 25, y: 10 },

    // === Burners (row 15, spread with gaps) ===
    { type: "burner", x: 10, y: 15 },
    { type: "burner", x: 11, y: 15 },
    { type: "burner", x: 12, y: 15 },
    { type: "burner", x: 14, y: 15 },
    { type: "burner", x: 15, y: 15 },
    { type: "burner", x: 22, y: 15 },
    { type: "burner", x: 23, y: 15 },
    { type: "burner", x: 24, y: 15 },

    // === Resting racks (row 18) ===
    { type: "resting_rack", x: 12, y: 18 },
    { type: "resting_rack", x: 13, y: 18 },
    { type: "resting_rack", x: 14, y: 18 },
    { type: "resting_rack", x: 22, y: 18 },
    { type: "resting_rack", x: 23, y: 18 },

    // === Plating stations (row 20) ===
    { type: "plating_station", x: 12, y: 20 },
    { type: "plating_station", x: 13, y: 20 },
    { type: "plating_station", x: 14, y: 20 },
    { type: "plating_station", x: 22, y: 20 },
    { type: "plating_station", x: 23, y: 20 },

    // === Pass / serving window (row 22) ===
    { type: "pass", x: 10, y: 22 },
    { type: "pass", x: 11, y: 22 },
    { type: "pass", x: 12, y: 22 },
    { type: "pass", x: 14, y: 22 },
    { type: "pass", x: 15, y: 22 },
    { type: "pass", x: 16, y: 22 },
    { type: "pass", x: 18, y: 22 },
    { type: "pass", x: 19, y: 22 },

    // === Dish return (right of pass, row 22) ===
    { type: "dish_return", x: 22, y: 22 },
    { type: "dish_return", x: 23, y: 22 },
    { type: "dish_return", x: 24, y: 22 },

    // === Sinks (bottom) ===
    { type: "sink", x: 3, y: 27 },
    { type: "sink", x: 4, y: 27 },
    { type: "sink", x: 5, y: 27 },
    { type: "sink", x: 7, y: 27 },
    { type: "sink", x: 8, y: 27 },
  ],
};

function runTicks(world: World, n: number) {
  for (let i = 0; i < n; i++) tickWorld(world);
}

function isTerminal(state: string): boolean {
  return state === "served" || state === "clean";
}

function measureMetrics(world: World) {
  const served = world.items.filter((i) => i.state === "served").length;
  const dirty = world.items.filter((i) => i.state === "dirty" && i.carriedBy === null).length;
  const clean = world.items.filter((i) => i.state === "clean").length;
  const completed = world.items.filter((i) =>
    i.state === "served" || i.state === "dirty" || i.state === "clean"
  ).length;
  const idle = world.workers.filter((w) => w.state === "idle" && w.intent === "idle").length;
  return { served, completed, dirty, clean, idle, total: world.items.length };
}

describe("large kitchen simulation (40×28)", () => {
  it("steaks should progress through the full pipeline", () => {
    const world = createWorld(
      { workerCount: 6, orderSize: 8, orderInterval: 9999 },
      LARGE_LAYOUT,
    );
    runTicks(world, 5000);

    const m = measureMetrics(world);
    expect(m.completed).toBeGreaterThan(0);
  });

  it("portioned steaks should appear as intermediate state", () => {
    const world = createWorld(
      { workerCount: 6, orderSize: 8, orderInterval: 9999 },
      LARGE_LAYOUT,
    );

    let sawPortioned = false;
    for (let i = 0; i < 3000; i++) {
      tickWorld(world);
      if (world.items.some((it) => it.state === "portioned")) {
        sawPortioned = true;
        break;
      }
    }
    expect(sawPortioned).toBe(true);
  });

  it("pipeline throughput: steaks should be served given enough time", () => {
    const world = createWorld(
      { workerCount: 8, orderSize: 10, orderInterval: 9999 },
      LARGE_LAYOUT,
    );
    runTicks(world, 12000);

    const m = measureMetrics(world);
    // At least a quarter of steaks should be done (larger grid = longer travel)
    expect(m.completed).toBeGreaterThanOrEqual(Math.floor(m.total / 4));
  });

  it("dirty dishes should be cleaned", () => {
    const world = createWorld(
      { workerCount: 8, orderSize: 6, orderInterval: 9999 },
      LARGE_LAYOUT,
    );
    runTicks(world, 15000);

    const m = measureMetrics(world);
    expect(m.clean).toBeGreaterThan(0);
  });

  it("workers should eventually drop carried items", () => {
    const world = createWorld(
      { workerCount: 6, orderSize: 8, orderInterval: 9999 },
      LARGE_LAYOUT,
    );
    runTicks(world, 500);

    let totalDrops = 0;
    const wasCarrying = new Map<number, boolean>();

    for (let t = 0; t < 5000; t++) {
      tickWorld(world);
      for (const w of world.workers) {
        const carrying = w.carryingItem !== null;
        if (wasCarrying.get(w.id) && !carrying) {
          totalDrops++;
        }
        wasCarrying.set(w.id, carrying);
      }
    }

    expect(totalDrops).toBeGreaterThan(0);
  });

  it("no worker should be permanently idle when there is work", () => {
    const world = createWorld(
      { workerCount: 6, orderSize: 8, orderInterval: 9999 },
      LARGE_LAYOUT,
    );

    const idleTicks = new Map<number, number>();

    for (let t = 0; t < 3000; t++) {
      tickWorld(world);

      for (const w of world.workers) {
        const unclaimedWork = world.items.some(
          (i) => !isTerminal(i.state) && i.carriedBy === null,
        );
        if (!unclaimedWork) continue;
        if (w.state === "idle" && w.intent === "idle") {
          idleTicks.set(w.id, (idleTicks.get(w.id) ?? 0) + 1);
          expect(idleTicks.get(w.id)!).toBeLessThan(200);
        } else {
          idleTicks.set(w.id, 0);
        }
      }
    }
  });

  it("stress test: 12 workers, large orders, periodic restocking", () => {
    const world = createWorld(
      { workerCount: 12, orderSize: 12, orderInterval: 2000 },
      LARGE_LAYOUT,
    );
    runTicks(world, 12000);

    const m = measureMetrics(world);
    expect(m.completed).toBeGreaterThan(0);
    expect(m.idle).toBeLessThan(12);
  });
});
