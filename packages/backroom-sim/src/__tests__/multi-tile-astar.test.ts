import { describe, it, expect } from "vitest";
import {
  stationWidth,
  stationHeight,
  stationOccupies,
  stationTileSetFromStations,
  stationAtTile,
  isAdjacentToStation,
} from "../station-utils";
import { astarDirection } from "../pathfinding";
import { bfsDirection } from "../helpers";
import type { Station } from "../types";

describe("station-utils", () => {
  it("defaults width/height to 1", () => {
    const s: Station = { type: "grill", x: 2, y: 3 };
    expect(stationWidth(s)).toBe(1);
    expect(stationHeight(s)).toBe(1);
  });

  it("returns explicit width/height", () => {
    const s: Station = { type: "grill", x: 2, y: 3, width: 3, height: 2 };
    expect(stationWidth(s)).toBe(3);
    expect(stationHeight(s)).toBe(2);
  });

  it("stationOccupies returns single tile for 1x1", () => {
    const s: Station = { type: "grill", x: 5, y: 3 };
    expect(stationOccupies(s)).toEqual([{ x: 5, y: 3 }]);
  });

  it("stationOccupies returns all tiles for multi-tile", () => {
    const s: Station = { type: "grill", x: 1, y: 1, width: 2, height: 3 };
    const tiles = stationOccupies(s);
    expect(tiles).toHaveLength(6);
    expect(tiles).toContainEqual({ x: 1, y: 1 });
    expect(tiles).toContainEqual({ x: 2, y: 1 });
    expect(tiles).toContainEqual({ x: 1, y: 3 });
    expect(tiles).toContainEqual({ x: 2, y: 3 });
  });

  it("stationTileSetFromStations includes all tiles", () => {
    const stations: Station[] = [
      { type: "a", x: 0, y: 0, width: 2, height: 1 },
      { type: "b", x: 5, y: 5 },
    ];
    const set = stationTileSetFromStations(stations);
    expect(set.has("0,0")).toBe(true);
    expect(set.has("1,0")).toBe(true);
    expect(set.has("5,5")).toBe(true);
    expect(set.has("2,0")).toBe(false);
  });

  it("stationAtTile finds station at any occupied tile", () => {
    const stations: Station[] = [
      { type: "a", x: 1, y: 1, width: 2, height: 2 },
      { type: "b", x: 5, y: 5 },
    ];
    expect(stationAtTile(stations, 1, 1)?.type).toBe("a");
    expect(stationAtTile(stations, 2, 2)?.type).toBe("a");
    expect(stationAtTile(stations, 5, 5)?.type).toBe("b");
    expect(stationAtTile(stations, 3, 3)).toBeUndefined();
  });

  it("isAdjacentToStation — 1x1 station", () => {
    const s: Station = { type: "a", x: 3, y: 3 };
    expect(isAdjacentToStation(2, 3, s)).toBe(true);
    expect(isAdjacentToStation(4, 3, s)).toBe(true);
    expect(isAdjacentToStation(3, 2, s)).toBe(true);
    expect(isAdjacentToStation(3, 4, s)).toBe(true);
    expect(isAdjacentToStation(3, 3, s)).toBe(false); // on the station
    expect(isAdjacentToStation(2, 2, s)).toBe(false); // diagonal
  });

  it("isAdjacentToStation — 2x2 station", () => {
    const s: Station = { type: "a", x: 2, y: 2, width: 2, height: 2 };
    // Adjacent to top edge
    expect(isAdjacentToStation(2, 1, s)).toBe(true);
    expect(isAdjacentToStation(3, 1, s)).toBe(true);
    // Adjacent to right edge
    expect(isAdjacentToStation(4, 2, s)).toBe(true);
    expect(isAdjacentToStation(4, 3, s)).toBe(true);
    // Inside station
    expect(isAdjacentToStation(2, 2, s)).toBe(false);
    expect(isAdjacentToStation(3, 3, s)).toBe(false);
    // Diagonal
    expect(isAdjacentToStation(1, 1, s)).toBe(false);
  });
});

describe("astarDirection", () => {
  it("finds path on open grid", () => {
    const cols = 5, rows = 5;
    const blocked = new Uint8Array(cols * rows);
    const dir = astarDirection(cols, rows, blocked, 0, 0, 4, 4, false);
    expect(dir).not.toBeNull();
    // Should step right or down
    expect(
      (dir![0] === 1 && dir![1] === 0) || (dir![0] === 0 && dir![1] === 1)
    ).toBe(true);
  });

  it("returns null when already at goal", () => {
    const blocked = new Uint8Array(25);
    expect(astarDirection(5, 5, blocked, 2, 2, 2, 2, false)).toBeNull();
  });

  it("returns null when already adjacent to station target", () => {
    const blocked = new Uint8Array(25);
    blocked[2 * 5 + 2] = 1; // station at (2,2)
    expect(astarDirection(5, 5, blocked, 2, 1, 2, 2, true)).toBeNull();
  });

  it("returns null when no path exists", () => {
    // Completely walled off
    const cols = 3, rows = 3;
    const blocked = new Uint8Array(cols * rows);
    // Block all around (0,0)
    blocked[0 * 3 + 1] = 1;
    blocked[1 * 3 + 0] = 1;
    blocked[1 * 3 + 1] = 1;
    expect(astarDirection(cols, rows, blocked, 0, 0, 2, 2, false)).toBeNull();
  });

  it("navigates around obstacle", () => {
    // 5x5 grid with wall at column 2, rows 0-3
    const cols = 5, rows = 5;
    const blocked = new Uint8Array(cols * rows);
    for (let r = 0; r < 4; r++) blocked[r * cols + 2] = 1;
    // Path from (0,0) to (4,0) must go around
    const dir = astarDirection(cols, rows, blocked, 0, 0, 4, 0, false);
    expect(dir).not.toBeNull();
  });

  it("matches BFS reachability on small grids", () => {
    const cols = 8, rows = 8;
    const blocked = new Uint8Array(cols * rows);
    // Add some obstacles
    blocked[2 * cols + 3] = 1;
    blocked[3 * cols + 3] = 1;
    blocked[4 * cols + 3] = 1;

    const bfs = bfsDirection(cols, rows, blocked, 1, 1, 6, 6, false);
    const astar = astarDirection(cols, rows, blocked, 1, 1, 6, 6, false);
    // Both should find a path (both optimal, but may differ in tie-breaking)
    expect(bfs).not.toBeNull();
    expect(astar).not.toBeNull();
  });

  it("targetIsStation finds adjacent tile", () => {
    const cols = 5, rows = 5;
    const blocked = new Uint8Array(cols * rows);
    blocked[2 * cols + 2] = 1; // station at (2,2)
    const dir = astarDirection(cols, rows, blocked, 0, 0, 2, 2, true);
    expect(dir).not.toBeNull();
  });
});
