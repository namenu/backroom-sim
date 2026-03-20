import { describe, it, expect } from "vitest";
import { createWorld, tickWorld, DEFAULT_WORKFLOW_DEF } from "../index";
import type { BackroomLayout } from "../index";
import { runTicks, deriveBounds, terminalStates } from "./test-utils";

/**
 * Large kitchen: 40×28 grid (4x the default area).
 * Tests whether agents can still complete the pipeline at scale.
 */
const LARGE_LAYOUT: BackroomLayout = {
  cols: 40,
  rows: 28,
  stations: [
    { type: "entrance", x: 0, y: 0 },
    // Order windows
    { type: "order_window", x: 5, y: 0 },
    { type: "order_window", x: 6, y: 0 },
    { type: "order_window", x: 7, y: 0 },
    { type: "order_window", x: 9, y: 0 },
    { type: "order_window", x: 10, y: 0 },
    // Fridges (left wall)
    { type: "fridge", x: 0, y: 4 },
    { type: "fridge", x: 0, y: 5 },
    { type: "fridge", x: 0, y: 6 },
    { type: "fridge", x: 0, y: 8 },
    { type: "fridge", x: 0, y: 9 },
    { type: "fridge", x: 0, y: 10 },
    { type: "fridge", x: 0, y: 12 },
    { type: "fridge", x: 0, y: 13 },
    // Cutting boards (row 10)
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
    // Burners (row 15)
    { type: "burner", x: 10, y: 15 },
    { type: "burner", x: 11, y: 15 },
    { type: "burner", x: 12, y: 15 },
    { type: "burner", x: 14, y: 15 },
    { type: "burner", x: 15, y: 15 },
    { type: "burner", x: 22, y: 15 },
    { type: "burner", x: 23, y: 15 },
    { type: "burner", x: 24, y: 15 },
    // Resting racks (row 18)
    { type: "resting_rack", x: 12, y: 18 },
    { type: "resting_rack", x: 13, y: 18 },
    { type: "resting_rack", x: 14, y: 18 },
    { type: "resting_rack", x: 22, y: 18 },
    { type: "resting_rack", x: 23, y: 18 },
    // Plating stations (row 20)
    { type: "plating_station", x: 12, y: 20 },
    { type: "plating_station", x: 13, y: 20 },
    { type: "plating_station", x: 14, y: 20 },
    { type: "plating_station", x: 22, y: 20 },
    { type: "plating_station", x: 23, y: 20 },
    // Pass (row 22)
    { type: "pass", x: 10, y: 22 },
    { type: "pass", x: 11, y: 22 },
    { type: "pass", x: 12, y: 22 },
    { type: "pass", x: 14, y: 22 },
    { type: "pass", x: 15, y: 22 },
    { type: "pass", x: 16, y: 22 },
    { type: "pass", x: 18, y: 22 },
    { type: "pass", x: 19, y: 22 },
    // Dish return (row 22)
    { type: "dish_return", x: 22, y: 22 },
    { type: "dish_return", x: 23, y: 22 },
    { type: "dish_return", x: 24, y: 22 },
    // Sinks (bottom)
    { type: "sink", x: 3, y: 27 },
    { type: "sink", x: 4, y: 27 },
    { type: "sink", x: 5, y: 27 },
    { type: "sink", x: 7, y: 27 },
    { type: "sink", x: 8, y: 27 },
  ],
};


describe("large kitchen simulation (40×28)", () => {
  const bounds = deriveBounds(DEFAULT_WORKFLOW_DEF, LARGE_LAYOUT.cols, LARGE_LAYOUT.rows);
  const terminals = terminalStates(DEFAULT_WORKFLOW_DEF);

  it("items should progress through the full pipeline", () => {
    const world = createWorld(
      { workerCount: 6, orderSize: 8, orderInterval: 9999 },
      LARGE_LAYOUT,
    );
    runTicks(world, bounds.oneItemTime * 2);

    const completed = world.items.filter((i) => terminals.has(i.state)).length;
    expect(completed).toBeGreaterThan(0);
  });

  it("intermediate states should be observable", () => {
    const world = createWorld(
      { workerCount: 6, orderSize: 8, orderInterval: 9999 },
      LARGE_LAYOUT,
    );

    const observed = new Set<string>();
    for (let i = 0; i < bounds.oneItemTime; i++) {
      tickWorld(world);
      for (const item of world.items) observed.add(item.state);
    }

    const nonTrivial = [...observed].filter(
      (s) => s !== world.recipe.initialItemState && !terminals.has(s)
    );
    expect(nonTrivial.length).toBeGreaterThan(0);
  });

  it("pipeline throughput: items should complete given sufficient time", () => {
    const world = createWorld(
      { workerCount: 8, orderSize: 10, orderInterval: 9999 },
      LARGE_LAYOUT,
    );
    runTicks(world, bounds.oneItemTime * 4);

    const completed = world.items.filter((i) => terminals.has(i.state)).length;
    expect(completed).toBeGreaterThanOrEqual(Math.floor(world.items.length / 4));
  });

  it("workers should eventually drop carried items", () => {
    const world = createWorld(
      { workerCount: 6, orderSize: 8, orderInterval: 9999 },
      LARGE_LAYOUT,
    );
    runTicks(world, bounds.maxTraversal);

    let totalDrops = 0;
    const wasCarrying = new Map<number, boolean>();

    for (let t = 0; t < bounds.oneItemTime * 2; t++) {
      tickWorld(world);
      for (const w of world.workers) {
        const carrying = w.carryingItem !== null;
        if (wasCarrying.get(w.id) && !carrying) totalDrops++;
        wasCarrying.set(w.id, carrying);
      }
    }

    expect(totalDrops).toBeGreaterThan(0);
  });

  it("workers should react to actionable work", () => {
    const world = createWorld(
      { workerCount: 6, orderSize: 8, orderInterval: 9999 },
      LARGE_LAYOUT,
    );

    const idleTicks = new Map<number, number>();
    const maxIdleBeforeReaction = bounds.maxTraversal;

    for (let t = 0; t < bounds.oneItemTime; t++) {
      tickWorld(world);

      for (const w of world.workers) {
        const actionableWork = world.items.some(
          (i) => !terminals.has(i.state) && i.carriedBy === null && i.processTimer === -1,
        );
        if (!actionableWork) continue;
        if (w.state === "idle" && w.intent === "idle") {
          idleTicks.set(w.id, (idleTicks.get(w.id) ?? 0) + 1);
          expect(idleTicks.get(w.id)!).toBeLessThan(maxIdleBeforeReaction);
        } else {
          idleTicks.set(w.id, 0);
        }
      }
    }
  });

  it("stress test: many workers, periodic restocking", () => {
    const world = createWorld(
      { workerCount: 12, orderSize: 12, orderInterval: bounds.oneItemTime },
      LARGE_LAYOUT,
    );
    runTicks(world, bounds.oneItemTime * 3);

    const completed = world.items.filter((i) => terminals.has(i.state)).length;
    expect(completed).toBeGreaterThan(0);
  });
});
