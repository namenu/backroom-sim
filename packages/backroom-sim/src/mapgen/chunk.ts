import type { WFCTile, WFCGrid, MapGenStation, FloorDecoration, MapGenResult } from "./wfc-types.js";
import { solveWFC } from "./wfc-solver.js";

export const CHUNK_SIZE = 16;

export interface Chunk {
  cx: number;
  cy: number;
  stations: MapGenStation[];
  decorations: FloorDecoration[];
  generated: boolean;
  grid?: WFCGrid;
}

/**
 * Manages an infinite, lazily generated factory map using chunked WFC.
 * New chunks are solved with boundary constraints matching adjacent chunks.
 */
export class ChunkManager {
  private chunks = new Map<string, Chunk>();
  private seed: number;
  private tileset: WFCTile[];
  private tileMap: Map<string, WFCTile>;

  constructor(seed: number, tileset: WFCTile[]) {
    this.seed = seed;
    this.tileset = tileset;
    this.tileMap = new Map(tileset.map((t) => [t.id, t]));
  }

  private chunkKey(cx: number, cy: number): string {
    return `${cx},${cy}`;
  }

  getChunk(cx: number, cy: number): Chunk {
    const key = this.chunkKey(cx, cy);
    let chunk = this.chunks.get(key);
    if (!chunk) {
      chunk = this.generateChunk(cx, cy);
    }
    return chunk;
  }

  generateChunk(cx: number, cy: number, boundaryConstraints?: Map<string, string[]>): Chunk {
    const key = this.chunkKey(cx, cy);
    const existing = this.chunks.get(key);
    if (existing?.generated) return existing;

    // Build boundary constraints from adjacent chunks
    const constraints = boundaryConstraints ?? this.buildBoundaryConstraints(cx, cy);

    // Use a deterministic seed per chunk
    const chunkSeed = this.seed ^ (cx * 73856093) ^ (cy * 19349663);

    const grid = solveWFC(CHUNK_SIZE, CHUNK_SIZE, this.tileset, constraints.size > 0 ? constraints : undefined, chunkSeed);

    const chunk: Chunk = {
      cx,
      cy,
      stations: [],
      decorations: [],
      generated: false,
      grid: grid ?? undefined,
    };

    if (grid) {
      chunk.generated = true;
      chunk.stations = this.extractStations(grid);
      chunk.decorations = this.extractDecorations(grid);
    }

    this.chunks.set(key, chunk);
    return chunk;
  }

  /** Check if a world position is near an ungenerated chunk and generate it. */
  expandAt(worldX: number, worldY: number): boolean {
    const cx = Math.floor(worldX / CHUNK_SIZE);
    const cy = Math.floor(worldY / CHUNK_SIZE);

    // Check adjacent chunks
    let expanded = false;
    for (const [dx, dy] of [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const ncx = cx + dx;
      const ncy = cy + dy;
      const key = this.chunkKey(ncx, ncy);
      if (!this.chunks.has(key)) {
        this.generateChunk(ncx, ncy);
        expanded = true;
      }
    }

    return expanded;
  }

  /** Flatten all generated chunks into a single MapGenResult. */
  toLayout(): MapGenResult {
    if (this.chunks.size === 0) {
      return { cols: 0, rows: 0, stations: [], decorations: [] };
    }

    let minCx = Infinity, maxCx = -Infinity;
    let minCy = Infinity, maxCy = -Infinity;
    for (const chunk of this.chunks.values()) {
      if (!chunk.generated) continue;
      minCx = Math.min(minCx, chunk.cx);
      maxCx = Math.max(maxCx, chunk.cx);
      minCy = Math.min(minCy, chunk.cy);
      maxCy = Math.max(maxCy, chunk.cy);
    }

    if (minCx === Infinity) {
      return { cols: 0, rows: 0, stations: [], decorations: [] };
    }

    const cols = (maxCx - minCx + 1) * CHUNK_SIZE;
    const rows = (maxCy - minCy + 1) * CHUNK_SIZE;
    const allStations: MapGenStation[] = [];
    const allDecorations: FloorDecoration[] = [];

    for (const chunk of this.chunks.values()) {
      if (!chunk.generated) continue;
      // Offset stations/decorations relative to min chunk
      const ox = (chunk.cx - minCx) * CHUNK_SIZE;
      const oy = (chunk.cy - minCy) * CHUNK_SIZE;
      for (const s of chunk.stations) {
        allStations.push({ ...s, x: s.x + ox, y: s.y + oy });
      }
      for (const d of chunk.decorations) {
        allDecorations.push({ ...d, x: d.x + ox, y: d.y + oy });
      }
    }

    return { cols, rows, stations: allStations, decorations: allDecorations };
  }

  /** Build boundary constraints from already-generated adjacent chunks. */
  private buildBoundaryConstraints(cx: number, cy: number): Map<string, string[]> {
    const constraints = new Map<string, string[]>();

    // Check each adjacent chunk
    // North neighbor (cy-1): our top row (y=0) dir=0(N) must match their bottom row's dir=2(S)
    const north = this.chunks.get(this.chunkKey(cx, cy - 1));
    if (north?.generated && north.grid) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const neighborTileId = north.grid.cells[CHUNK_SIZE - 1][x].tileId;
        if (neighborTileId) {
          const nTile = this.tileMap.get(neighborTileId);
          if (nTile) {
            // Our cell (x, 0) socket N=0 must match neighbor's S=2
            constraints.set(`${x},0,0`, [nTile.sockets[2]]);
          }
        }
      }
    }

    // South neighbor (cy+1)
    const south = this.chunks.get(this.chunkKey(cx, cy + 1));
    if (south?.generated && south.grid) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const neighborTileId = south.grid.cells[0][x].tileId;
        if (neighborTileId) {
          const nTile = this.tileMap.get(neighborTileId);
          if (nTile) {
            constraints.set(`${x},${CHUNK_SIZE - 1},2`, [nTile.sockets[0]]);
          }
        }
      }
    }

    // West neighbor (cx-1)
    const west = this.chunks.get(this.chunkKey(cx - 1, cy));
    if (west?.generated && west.grid) {
      for (let y = 0; y < CHUNK_SIZE; y++) {
        const neighborTileId = west.grid.cells[y][CHUNK_SIZE - 1].tileId;
        if (neighborTileId) {
          const nTile = this.tileMap.get(neighborTileId);
          if (nTile) {
            constraints.set(`0,${y},3`, [nTile.sockets[1]]);
          }
        }
      }
    }

    // East neighbor (cx+1)
    const east = this.chunks.get(this.chunkKey(cx + 1, cy));
    if (east?.generated && east.grid) {
      for (let y = 0; y < CHUNK_SIZE; y++) {
        const neighborTileId = east.grid.cells[y][0].tileId;
        if (neighborTileId) {
          const nTile = this.tileMap.get(neighborTileId);
          if (nTile) {
            constraints.set(`${CHUNK_SIZE - 1},${y},1`, [nTile.sockets[3]]);
          }
        }
      }
    }

    return constraints;
  }

  private extractStations(grid: WFCGrid): MapGenStation[] {
    const stations: MapGenStation[] = [];
    const seen = new Set<string>();

    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) {
        const tileId = grid.cells[y][x].tileId;
        if (!tileId) continue;
        const tile = this.tileMap.get(tileId);
        if (!tile?.station) continue;

        if (tile.group) {
          if (tile.group.gx !== 0 || tile.group.gy !== 0) continue;
          const key = `${tile.station.type}_${x}_${y}`;
          if (seen.has(key)) continue;
          seen.add(key);
          stations.push({ type: tile.station.type, x, y, width: tile.group.width, height: tile.group.height });
        } else {
          stations.push({ type: tile.station.type, x, y });
        }
      }
    }

    return stations;
  }

  private extractDecorations(grid: WFCGrid): FloorDecoration[] {
    const decorations: FloorDecoration[] = [];
    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) {
        const tileId = grid.cells[y][x].tileId;
        if (!tileId) continue;
        if (tileId.startsWith("pipe_") || tileId.startsWith("conveyor_") || tileId === "floor_grated" || tileId === "floor_dirty") {
          decorations.push({ type: tileId, x, y });
        }
      }
    }
    return decorations;
  }
}
