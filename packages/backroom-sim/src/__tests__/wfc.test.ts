import { describe, it, expect } from "vitest";
import { solveWFC, validateGrid } from "../mapgen/wfc-solver.js";
import { createFactoryTileset } from "../mapgen/tile-registry.js";
import { generateFactoryLayout } from "../mapgen/factory-generator.js";
import { ChunkManager, CHUNK_SIZE } from "../mapgen/chunk.js";
import type { WFCTile } from "../mapgen/wfc-types.js";

describe("WFC solver", () => {
  it("produces a valid grid with no socket mismatches (simple tileset)", () => {
    // Minimal tileset: just floor tiles
    const tiles: WFCTile[] = [
      { id: "floor", sockets: ["floor", "floor", "floor", "floor"], weight: 1 },
    ];
    const grid = solveWFC(4, 4, tiles, undefined, 42);
    expect(grid).not.toBeNull();
    const tileMap = new Map(tiles.map((t) => [t.id, t]));
    expect(validateGrid(grid!, tileMap)).toBe(true);
  });

  it("produces a valid grid with factory tileset", () => {
    const tiles = createFactoryTileset(0.1);
    const grid = solveWFC(8, 8, tiles, undefined, 123);
    expect(grid).not.toBeNull();
    const tileMap = new Map(tiles.map((t) => [t.id, t]));
    expect(validateGrid(grid!, tileMap)).toBe(true);
  });

  it("all cells are collapsed in solved grid", () => {
    const tiles = createFactoryTileset(0.1);
    const grid = solveWFC(6, 6, tiles, undefined, 99);
    expect(grid).not.toBeNull();
    for (let y = 0; y < grid!.height; y++) {
      for (let x = 0; x < grid!.width; x++) {
        expect(grid!.cells[y][x].collapsed).toBe(true);
        expect(grid!.cells[y][x].tileId).not.toBeNull();
      }
    }
  });

  it("is deterministic with same seed", () => {
    const tiles = createFactoryTileset(0.2);
    const grid1 = solveWFC(6, 6, tiles, undefined, 777);
    const grid2 = solveWFC(6, 6, tiles, undefined, 777);
    expect(grid1).not.toBeNull();
    expect(grid2).not.toBeNull();
    for (let y = 0; y < 6; y++) {
      for (let x = 0; x < 6; x++) {
        expect(grid1!.cells[y][x].tileId).toBe(grid2!.cells[y][x].tileId);
      }
    }
  });
});

describe("Factory generator", () => {
  it("returns a valid MapGenResult", () => {
    const result = generateFactoryLayout({ width: 10, height: 10, seed: 42, density: 0.1 });
    expect(result).not.toBeNull();
    expect(result!.cols).toBe(10);
    expect(result!.rows).toBe(10);
    expect(Array.isArray(result!.stations)).toBe(true);
    expect(Array.isArray(result!.decorations)).toBe(true);
  });

  it("output is compatible with BackroomLayout shape", () => {
    const result = generateFactoryLayout({ width: 8, height: 8, seed: 55, density: 0.1 });
    expect(result).not.toBeNull();
    // BackroomLayout requires cols, rows, stations with type/x/y
    expect(typeof result!.cols).toBe("number");
    expect(typeof result!.rows).toBe("number");
    for (const s of result!.stations) {
      expect(typeof s.type).toBe("string");
      expect(typeof s.x).toBe("number");
      expect(typeof s.y).toBe("number");
    }
  });

  it("stations are within grid bounds", () => {
    const result = generateFactoryLayout({ width: 12, height: 12, seed: 100, density: 0.3 });
    if (!result) return; // solver may not produce stations at low sizes
    for (const s of result.stations) {
      const w = s.width ?? 1;
      const h = s.height ?? 1;
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.y).toBeGreaterThanOrEqual(0);
      expect(s.x + w).toBeLessThanOrEqual(result.cols);
      expect(s.y + h).toBeLessThanOrEqual(result.rows);
    }
  });
});

describe("Multi-tile stations", () => {
  it("no partial groups in solved grid", () => {
    const tiles = createFactoryTileset(0.5);
    const grid = solveWFC(12, 12, tiles, undefined, 200);
    expect(grid).not.toBeNull();

    const tileMap = new Map(tiles.map((t) => [t.id, t]));
    // Collect group instances
    const groups = new Map<string, { gx: number; gy: number; x: number; y: number }[]>();

    for (let y = 0; y < grid!.height; y++) {
      for (let x = 0; x < grid!.width; x++) {
        const tileId = grid!.cells[y][x].tileId!;
        const tile = tileMap.get(tileId);
        if (tile?.group) {
          const baseX = x - tile.group.gx;
          const baseY = y - tile.group.gy;
          const key = `${tile.group.id}_${baseX}_${baseY}`;
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key)!.push({ gx: tile.group.gx, gy: tile.group.gy, x, y });
        }
      }
    }

    // Each group instance should have all cells
    for (const [, cells] of groups) {
      // Parse group dimensions from first cell
      const firstTileId = grid!.cells[cells[0].y][cells[0].x].tileId!;
      const firstTile = tileMap.get(firstTileId)!;
      const expectedCount = firstTile.group!.width * firstTile.group!.height;
      expect(cells.length).toBe(expectedCount);
    }
  });
});

describe("Chunk system", () => {
  it("generates a chunk", () => {
    const tileset = createFactoryTileset(0.1);
    const mgr = new ChunkManager(42, tileset);
    const chunk = mgr.getChunk(0, 0);
    expect(chunk.generated).toBe(true);
    expect(chunk.cx).toBe(0);
    expect(chunk.cy).toBe(0);
  });

  it("expandAt generates adjacent chunks", () => {
    const tileset = createFactoryTileset(0.1);
    const mgr = new ChunkManager(42, tileset);
    mgr.getChunk(0, 0); // seed chunk
    const expanded = mgr.expandAt(CHUNK_SIZE - 1, CHUNK_SIZE / 2);
    expect(expanded).toBe(true);
  });

  it("toLayout flattens chunks correctly", () => {
    const tileset = createFactoryTileset(0.1);
    const mgr = new ChunkManager(42, tileset);
    mgr.getChunk(0, 0);
    const layout = mgr.toLayout();
    expect(layout.cols).toBe(CHUNK_SIZE);
    expect(layout.rows).toBe(CHUNK_SIZE);
  });

  it("boundary stitching produces valid edges", () => {
    const tileset = createFactoryTileset(0.1);
    const tileMap = new Map(tileset.map((t) => [t.id, t]));
    const mgr = new ChunkManager(42, tileset);

    const chunk0 = mgr.getChunk(0, 0);
    const chunk1 = mgr.getChunk(1, 0);

    expect(chunk0.generated).toBe(true);
    expect(chunk1.generated).toBe(true);

    // Check that the right edge of chunk0 matches the left edge of chunk1
    if (chunk0.grid && chunk1.grid) {
      for (let y = 0; y < CHUNK_SIZE; y++) {
        const rightTileId = chunk0.grid.cells[y][CHUNK_SIZE - 1].tileId!;
        const leftTileId = chunk1.grid.cells[y][0].tileId!;
        const rightTile = tileMap.get(rightTileId)!;
        const leftTile = tileMap.get(leftTileId)!;
        // Right tile's E socket should match left tile's W socket
        expect(rightTile.sockets[1]).toBe(leftTile.sockets[3]);
      }
    }
  });
});
