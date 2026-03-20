import { describe, it, expect } from "vitest";
import { createWorld, tickWorld, DEFAULT_LAYOUT, DEFAULT_WORKFLOW_DEF } from "../index";
import { runTicks, deriveBounds, terminalStates } from "./test-utils";

describe("kitchen simulation — steak recipe", () => {
  const bounds = deriveBounds(DEFAULT_WORKFLOW_DEF, DEFAULT_LAYOUT.cols, DEFAULT_LAYOUT.rows);
  const terminals = terminalStates(DEFAULT_WORKFLOW_DEF);

  it("items should progress through the full pipeline", () => {
    const world = createWorld({ workerCount: 3, orderSize: 4, orderInterval: 9999 }, DEFAULT_LAYOUT);
    runTicks(world, bounds.oneItemTime * 2);

    const completed = world.items.filter((i) => terminals.has(i.state)).length;
    expect(completed).toBeGreaterThan(0);
  });

  it("intermediate states should be observable during processing", () => {
    const world = createWorld({ workerCount: 2, orderSize: 4, orderInterval: 9999 }, DEFAULT_LAYOUT);

    // Collect all states observed during the simulation
    const observed = new Set<string>();
    for (let i = 0; i < bounds.oneItemTime; i++) {
      tickWorld(world);
      for (const item of world.items) observed.add(item.state);
    }

    // Should see more than just initial + terminal states
    const nonTrivial = [...observed].filter(
      (s) => s !== world.recipe.initialItemState && !terminals.has(s)
    );
    expect(nonTrivial.length).toBeGreaterThan(0);
  });

  it("workers should not carry an item longer than grid traversal allows", () => {
    const world = createWorld({ workerCount: 3, orderSize: 6, orderInterval: 9999 }, DEFAULT_LAYOUT);
    // Warm up to fill pipeline
    runTicks(world, bounds.maxTraversal);

    const carryStart = new Map<number, number>();
    const maxAllowedCarry = bounds.maxTraversal * 2; // generous: 2x max traversal

    for (let t = 0; t < bounds.oneItemTime; t++) {
      tickWorld(world);
      for (const w of world.workers) {
        if (w.carryingItem !== null) {
          if (!carryStart.has(w.id)) carryStart.set(w.id, world.tick);
          const duration = world.tick - carryStart.get(w.id)!;
          expect(duration).toBeLessThan(maxAllowedCarry);
        } else {
          carryStart.delete(w.id);
        }
      }
    }
  });

  it("workers should react to actionable work within bounded time", () => {
    const world = createWorld({ workerCount: 3, orderSize: 6, orderInterval: 9999 }, DEFAULT_LAYOUT);

    const idleTicks = new Map<number, number>();
    const maxIdleBeforeReaction = bounds.maxTraversal;

    for (let t = 0; t < bounds.oneItemTime; t++) {
      tickWorld(world);

      for (const w of world.workers) {
        const actionableWork = world.items.some(
          (i) => !terminals.has(i.state) && i.carriedBy === null && i.processTimer === -1
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

  it("pipeline throughput: most items should complete given sufficient time", () => {
    const world = createWorld({ workerCount: 3, orderSize: 6, orderInterval: 9999 }, DEFAULT_LAYOUT);
    runTicks(world, bounds.oneItemTime * 4);

    const completed = world.items.filter((i) => terminals.has(i.state)).length;
    expect(completed).toBeGreaterThanOrEqual(Math.floor(world.items.length / 3));
  });

  it("ordersServed counter matches items that reached served state", () => {
    const world = createWorld({ workerCount: 3, orderSize: 4, orderInterval: 9999 }, DEFAULT_LAYOUT);
    runTicks(world, bounds.oneItemTime * 3);

    const completedStates = new Set(world.recipe.completedStates);
    const servedOrBeyond = world.items.filter((i) => completedStates.has(i.state)).length;
    expect(world.ordersServed).toBe(servedOrBeyond);
  });

  it("BFS navigates around obstacles to reach target station", () => {
    const world = createWorld(
      { workerCount: 1, orderSize: 0, orderInterval: 99999 },
      DEFAULT_LAYOUT,
    );

    const worker = world.workers[0];
    worker.x = 1;
    worker.y = 3;
    worker.carryingItem = 999;
    world.items.push({
      id: 999, type: "ribeye", state: "raw", x: 0, y: 3, carriedBy: worker.id, processTimer: -1,
    });

    runTicks(world, bounds.maxTraversal * 2);

    const item = world.items.find((i) => i.id === 999)!;
    expect(item.state).not.toBe("raw");
  });
});
