import { describe, it, expect } from "vitest";
import { validateLayout } from "../optimizer/validate";
import { evaluateLayout, DEFAULT_EVAL_CONFIG } from "../optimizer/evaluate";
import { BACKROOM_LAYOUT, BACKROOM_CONFIG, BACKROOM_STATION_COUNTS } from "../backroom/recipe";
import { BACKROOM_WORKFLOW } from "../backroom/workflow";
import type { BackroomLayout } from "../types";

describe("validateLayout", () => {
  it("accepts the default backroom layout", () => {
    const result = validateLayout(BACKROOM_LAYOUT, BACKROOM_WORKFLOW);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("accepts the default backroom layout with station counts", () => {
    const result = validateLayout(BACKROOM_LAYOUT, BACKROOM_WORKFLOW, BACKROOM_STATION_COUNTS);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects layout with missing station type", () => {
    const stations = BACKROOM_LAYOUT.stations.filter((s) => s.type !== "trash");
    const layout: BackroomLayout = { ...BACKROOM_LAYOUT, stations };
    const result = validateLayout(layout, BACKROOM_WORKFLOW, BACKROOM_STATION_COUNTS);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("trash") && e.includes("count mismatch"))).toBe(true);
  });

  it("rejects layout with extra station", () => {
    const stations = [...BACKROOM_LAYOUT.stations, { type: "sink", x: 5, y: 5 }];
    const layout: BackroomLayout = { ...BACKROOM_LAYOUT, stations };
    const result = validateLayout(layout, BACKROOM_WORKFLOW, BACKROOM_STATION_COUNTS);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("sink") && e.includes("count mismatch"))).toBe(true);
  });

  it("rejects layout with entrance not at (0,0)", () => {
    const layout: BackroomLayout = {
      ...BACKROOM_LAYOUT,
      stations: BACKROOM_LAYOUT.stations.map((s) =>
        s.type === "entrance" ? { ...s, x: 5, y: 5 } : s,
      ),
    };
    const result = validateLayout(layout, BACKROOM_WORKFLOW);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Entrance"))).toBe(true);
  });

  it("rejects layout with receiving not on top edge", () => {
    const stations = BACKROOM_LAYOUT.stations.map((s, i) =>
      i === 0 && s.type === "receiving" ? { ...s, y: 5 } : s,
    );
    const layout: BackroomLayout = { ...BACKROOM_LAYOUT, stations };
    const result = validateLayout(layout, BACKROOM_WORKFLOW);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("top edge"))).toBe(true);
  });

  it("rejects layout with overlapping stations", () => {
    const stations = [...BACKROOM_LAYOUT.stations];
    // Make two stations overlap
    stations[1] = { ...stations[1], x: stations[0].x, y: stations[0].y };
    const layout: BackroomLayout = { ...BACKROOM_LAYOUT, stations };
    const result = validateLayout(layout, BACKROOM_WORKFLOW);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Overlapping"))).toBe(true);
  });

  it("rejects layout with out-of-bounds station", () => {
    const stations = BACKROOM_LAYOUT.stations.map((s, i) =>
      i === 4 ? { ...s, x: 99, y: 99 } : s,
    );
    const layout: BackroomLayout = { ...BACKROOM_LAYOUT, stations };
    const result = validateLayout(layout, BACKROOM_WORKFLOW);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("out of bounds"))).toBe(true);
  });

  it("rejects disconnected layout", () => {
    // Create a layout where a station is surrounded by other stations (unreachable)
    const layout: BackroomLayout = {
      cols: 5,
      rows: 5,
      stations: [
        { type: "entrance", x: 0, y: 0 },
        { type: "receiving", x: 2, y: 0 },
        // Surround a station with blockers so it's unreachable
        { type: "shelf", x: 4, y: 4 },
        { type: "prep_table", x: 3, y: 4 },
        { type: "stove", x: 4, y: 3 },
        // Fill rest of last row/col to block path
        { type: "counter", x: 3, y: 3 },
        { type: "sink", x: 2, y: 4 },
        { type: "returning", x: 4, y: 2 },
        { type: "fridge", x: 3, y: 2 },
        { type: "trash", x: 2, y: 3 },
      ],
    };
    const result = validateLayout(layout, BACKROOM_WORKFLOW);
    // This should be invalid because the corner station at (4,4) is blocked on all sides
    expect(result.valid).toBe(false);
  });
});

describe("evaluateLayout", () => {
  it("evaluates the default layout and returns metrics", () => {
    const evalConfig = { ...DEFAULT_EVAL_CONFIG, ticks: 1000 };
    const metrics = evaluateLayout(
      BACKROOM_LAYOUT,
      BACKROOM_CONFIG,
      BACKROOM_WORKFLOW,
      // Use imported recipe
      {
        name: "Backroom",
        description: "",
        stationTypes: [],
        stationMeta: {},
        itemTypes: ["onion", "pork", "noodle", "soup_base"],
        initialItemState: "raw",
        spawnStationType: "receiving",
        completedStates: ["served", "dirty", "clean", "stored"],
        servedState: "served",
        chartStages: [],
        rewardMilestones: [],
        floorType: "floor",
      },
      evalConfig,
    );

    expect(metrics.throughput).toBeGreaterThanOrEqual(0);
    expect(metrics.totalServed).toBeGreaterThanOrEqual(0);
    expect(metrics.avgUtilization).toBeGreaterThanOrEqual(0);
    expect(metrics.avgUtilization).toBeLessThanOrEqual(1);
    expect(metrics.workerIdleRatios.length).toBe(3); // 3 workers
    expect(typeof metrics.fitness).toBe("number");
  });

  it("returns higher throughput over more ticks", () => {
    const recipe = {
      name: "Backroom",
      description: "",
      stationTypes: [],
      stationMeta: {},
      itemTypes: ["onion", "pork", "noodle", "soup_base"],
      initialItemState: "raw",
      spawnStationType: "receiving",
      completedStates: ["served", "dirty", "clean", "stored"],
      servedState: "served",
      chartStages: [],
      rewardMilestones: [],
      floorType: "floor",
    };

    const short = evaluateLayout(
      BACKROOM_LAYOUT,
      BACKROOM_CONFIG,
      BACKROOM_WORKFLOW,
      recipe,
      { ...DEFAULT_EVAL_CONFIG, ticks: 500 },
    );
    const long = evaluateLayout(
      BACKROOM_LAYOUT,
      BACKROOM_CONFIG,
      BACKROOM_WORKFLOW,
      recipe,
      { ...DEFAULT_EVAL_CONFIG, ticks: 3000 },
    );

    // More ticks should serve more items total
    expect(long.totalServed).toBeGreaterThanOrEqual(short.totalServed);
  });
});
