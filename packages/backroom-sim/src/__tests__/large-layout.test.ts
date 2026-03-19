import { describe, it, expect } from "vitest";
import { createWorld, tickWorld } from "../index";
import type { BackroomLayout, World } from "../index";

/**
 * Large backroom: 40×28 grid (4x the default area).
 * More stations, more workers, longer distances.
 * Tests whether simple agents can still complete the full pipeline at scale.
 *
 *  Layout sketch (40 cols × 28 rows):
 *
 *  Row 0:     receiving (spread across top with gaps)
 *  Row 1-2:   open floor
 *  Col 0:     shelves (left wall, with gaps)
 *  Col 39:    fridges (right wall, with gaps)
 *  Row 10-11: prep tables (two clusters with central gap)
 *  Row 14-15: stoves (spread with gaps)
 *  Row 22-23: counters + returning
 *  Row 26-27: sinks + trash (bottom)
 */
const LARGE_LAYOUT: BackroomLayout = {
  cols: 40,
  rows: 28,
  stations: [
    // === Receiving (top row, 10 tiles with gaps) ===
    { type: "receiving", x: 5, y: 0 },
    { type: "receiving", x: 6, y: 0 },
    { type: "receiving", x: 7, y: 0 },
    { type: "receiving", x: 9, y: 0 },
    { type: "receiving", x: 10, y: 0 },
    { type: "receiving", x: 12, y: 0 },
    { type: "receiving", x: 13, y: 0 },
    { type: "receiving", x: 15, y: 0 },
    { type: "receiving", x: 16, y: 0 },
    { type: "receiving", x: 17, y: 0 },

    // === Shelves (left wall, gaps at y=7,11 for passage) ===
    { type: "shelf", x: 0, y: 4 },
    { type: "shelf", x: 0, y: 5 },
    { type: "shelf", x: 0, y: 6 },
    // gap at y=7
    { type: "shelf", x: 0, y: 8 },
    { type: "shelf", x: 0, y: 9 },
    { type: "shelf", x: 0, y: 10 },
    // gap at y=11
    { type: "shelf", x: 0, y: 12 },
    { type: "shelf", x: 0, y: 13 },

    // === Fridges (right wall, gaps at y=7,11) ===
    { type: "fridge", x: 39, y: 4 },
    { type: "fridge", x: 39, y: 5 },
    { type: "fridge", x: 39, y: 6 },
    // gap at y=7
    { type: "fridge", x: 39, y: 8 },
    { type: "fridge", x: 39, y: 9 },

    // === Prep tables (row 10, two clusters) ===
    { type: "prep_table", x: 8, y: 10 },
    { type: "prep_table", x: 9, y: 10 },
    { type: "prep_table", x: 10, y: 10 },
    // gap at x=11
    { type: "prep_table", x: 12, y: 10 },
    { type: "prep_table", x: 13, y: 10 },
    // gap
    { type: "prep_table", x: 20, y: 10 },
    { type: "prep_table", x: 21, y: 10 },
    { type: "prep_table", x: 22, y: 10 },
    // gap at x=23
    { type: "prep_table", x: 24, y: 10 },
    { type: "prep_table", x: 25, y: 10 },

    // === Stoves (row 15, spread with gaps) ===
    { type: "stove", x: 10, y: 15 },
    { type: "stove", x: 11, y: 15 },
    { type: "stove", x: 12, y: 15 },
    // gap at x=13
    { type: "stove", x: 14, y: 15 },
    { type: "stove", x: 15, y: 15 },
    // gap
    { type: "stove", x: 22, y: 15 },
    { type: "stove", x: 23, y: 15 },
    { type: "stove", x: 24, y: 15 },

    // === Counters (row 22, serving area) ===
    { type: "counter", x: 10, y: 22 },
    { type: "counter", x: 11, y: 22 },
    { type: "counter", x: 12, y: 22 },
    // gap at x=13
    { type: "counter", x: 14, y: 22 },
    { type: "counter", x: 15, y: 22 },
    { type: "counter", x: 16, y: 22 },
    // gap at x=17
    { type: "counter", x: 18, y: 22 },
    { type: "counter", x: 19, y: 22 },

    // === Returning (right of counter, row 22) ===
    // gap at x=21
    { type: "returning", x: 22, y: 22 },
    { type: "returning", x: 23, y: 22 },
    { type: "returning", x: 24, y: 22 },

    // === Sinks (bottom-left) ===
    { type: "sink", x: 3, y: 27 },
    { type: "sink", x: 4, y: 27 },
    { type: "sink", x: 5, y: 27 },
    // gap
    { type: "sink", x: 7, y: 27 },
    { type: "sink", x: 8, y: 27 },

    // === Trash (bottom-right) ===
    { type: "trash", x: 35, y: 27 },
    { type: "trash", x: 36, y: 27 },
    { type: "trash", x: 37, y: 27 },
  ],
};

function runTicks(world: World, n: number) {
  for (let i = 0; i < n; i++) tickWorld(world);
}

function isTerminal(state: string): boolean {
  return state === "served" || state === "stored";
}

function measureMetrics(world: World) {
  const served = world.items.filter((i) => i.state === "served").length;
  const dirty = world.items.filter((i) => i.state === "dirty" && i.carriedBy === null).length;
  const stored = world.items.filter((i) => i.state === "stored").length;
  const completed = world.items.filter((i) =>
    i.state === "served" || i.state === "dirty" || i.state === "clean" || i.state === "stored"
  ).length;
  const idle = world.workers.filter((w) => w.state === "idle" && w.intent === "idle").length;
  return { served, completed, dirty, stored, idle, total: world.items.length };
}

describe("large backroom simulation (40×28)", () => {
  it("items should progress through the full pipeline", () => {
    const world = createWorld(
      { workerCount: 6, deliverySize: 8, deliveryInterval: 9999 },
      LARGE_LAYOUT,
    );
    runTicks(world, 4000);

    const m = measureMetrics(world);
    expect(m.completed).toBeGreaterThan(0);
  });

  it("chopped items should appear as intermediate state", () => {
    const world = createWorld(
      { workerCount: 6, deliverySize: 8, deliveryInterval: 9999 },
      LARGE_LAYOUT,
    );

    let sawChopped = false;
    for (let i = 0; i < 3000; i++) {
      tickWorld(world);
      if (world.items.some((it) => it.state === "chopped")) {
        sawChopped = true;
        break;
      }
    }
    expect(sawChopped).toBe(true);
  });

  it("pipeline throughput: food items should be served given enough time", () => {
    const world = createWorld(
      { workerCount: 8, deliverySize: 10, deliveryInterval: 9999 },
      LARGE_LAYOUT,
    );
    runTicks(world, 8000);

    const m = measureMetrics(world);
    // At least a quarter of food should be done (larger grid = longer travel)
    expect(m.completed).toBeGreaterThanOrEqual(Math.floor(m.total / 4));
  });

  it("dirty dishes should be cleaned and stored", () => {
    const world = createWorld(
      { workerCount: 8, deliverySize: 6, deliveryInterval: 9999 },
      LARGE_LAYOUT,
    );
    runTicks(world, 10000);

    const m = measureMetrics(world);
    expect(m.stored).toBeGreaterThan(0);
  });

  it("workers should eventually drop carried items", () => {
    const world = createWorld(
      { workerCount: 6, deliverySize: 8, deliveryInterval: 9999 },
      LARGE_LAYOUT,
    );
    runTicks(world, 500);

    // Track how many times each worker drops an item (completes a carry cycle)
    let totalDrops = 0;
    const wasCarrying = new Map<number, boolean>();

    for (let t = 0; t < 4000; t++) {
      tickWorld(world);
      for (const w of world.workers) {
        const carrying = w.carryingItem !== null;
        if (wasCarrying.get(w.id) && !carrying) {
          totalDrops++;
        }
        wasCarrying.set(w.id, carrying);
      }
    }

    // With 6 workers over 4000 ticks, there should be multiple completed carry cycles
    expect(totalDrops).toBeGreaterThan(0);
  });

  it("no worker should be permanently idle when there is work", () => {
    const world = createWorld(
      { workerCount: 6, deliverySize: 8, deliveryInterval: 9999 },
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
          // Allow more idle tolerance on large grid (longer travel between tasks)
          expect(idleTicks.get(w.id)!).toBeLessThan(200);
        } else {
          idleTicks.set(w.id, 0);
        }
      }
    }
  });

  it("stress test: 12 workers, large deliveries, periodic restocking", () => {
    const world = createWorld(
      { workerCount: 12, deliverySize: 12, deliveryInterval: 2000 },
      LARGE_LAYOUT,
    );
    runTicks(world, 10000);

    const m = measureMetrics(world);
    // With 12 workers and periodic deliveries, system should still function
    expect(m.completed).toBeGreaterThan(0);
    // Not all workers should be permanently idle
    expect(m.idle).toBeLessThan(12);
  });
});
