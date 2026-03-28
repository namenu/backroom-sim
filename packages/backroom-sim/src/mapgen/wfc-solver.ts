import type { WFCTile, WFCGrid, WFCCell } from "./wfc-types.js";

// Simple seeded PRNG (mulberry32)
function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Opposite direction index: N<->S, E<->W
const OPPOSITE = [2, 3, 0, 1] as const;

// Direction offsets: [dx, dy] for N, E, S, W
const DIR_OFFSETS: [number, number][] = [
  [0, -1], // N
  [1, 0],  // E
  [0, 1],  // S
  [-1, 0], // W
];

interface SolverState {
  grid: WFCGrid;
  tiles: Map<string, WFCTile>;
  rng: () => number;
}

function createGrid(width: number, height: number, tileIds: string[]): WFCGrid {
  const cells: WFCCell[][] = [];
  for (let y = 0; y < height; y++) {
    const row: WFCCell[] = [];
    for (let x = 0; x < width; x++) {
      row.push({
        x,
        y,
        collapsed: false,
        tileId: null,
        options: new Set(tileIds),
      });
    }
    cells.push(row);
  }
  return { width, height, cells };
}

function getCell(grid: WFCGrid, x: number, y: number): WFCCell | null {
  if (x < 0 || x >= grid.width || y < 0 || y >= grid.height) return null;
  return grid.cells[y][x];
}

/** Find uncollapsed cell with lowest entropy (fewest options). */
function findLowestEntropy(grid: WFCGrid, rng: () => number): WFCCell | null {
  let minEntropy = Infinity;
  const candidates: WFCCell[] = [];

  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      const cell = grid.cells[y][x];
      if (cell.collapsed) continue;
      const entropy = cell.options.size;
      if (entropy === 0) continue; // contradiction
      if (entropy < minEntropy) {
        minEntropy = entropy;
        candidates.length = 0;
        candidates.push(cell);
      } else if (entropy === minEntropy) {
        candidates.push(cell);
      }
    }
  }

  if (candidates.length === 0) return null;
  return candidates[Math.floor(rng() * candidates.length)];
}

/** Pick a tile ID from options using weighted random selection. */
function weightedPick(opts: string[], tiles: Map<string, WFCTile>, rng: () => number): string {
  let totalWeight = 0;
  for (const id of opts) {
    totalWeight += tiles.get(id)!.weight;
  }
  let r = rng() * totalWeight;
  for (const id of opts) {
    r -= tiles.get(id)!.weight;
    if (r <= 0) return id;
  }
  return opts[opts.length - 1];
}

/** Collapse a cell to a single tile, weighted by tile weight. */
function collapseCell(cell: WFCCell, state: SolverState): boolean {
  const { tiles, rng } = state;
  const remaining = [...cell.options];
  if (remaining.length === 0) return false;

  // Shuffle by weighted random, try each until one works (group tiles may fail)
  while (remaining.length > 0) {
    const chosen = weightedPick(remaining, tiles, rng);
    const tile = tiles.get(chosen)!;

    if (tile.group) {
      if (canPlaceGroup(cell, tile, state)) {
        cell.collapsed = true;
        cell.tileId = chosen;
        cell.options = new Set([chosen]);
        collapseGroup(cell, tile, state);
        return true;
      }
      // This group tile can't be placed, remove it and try another
      remaining.splice(remaining.indexOf(chosen), 1);
      cell.options.delete(chosen);
    } else {
      cell.collapsed = true;
      cell.tileId = chosen;
      cell.options = new Set([chosen]);
      return true;
    }
  }

  return false; // contradiction: no valid tile
}

/** Check if a group can be placed starting from a cell. */
function canPlaceGroup(cell: WFCCell, tile: WFCTile, state: SolverState): boolean {
  const group = tile.group!;
  const baseX = cell.x - group.gx;
  const baseY = cell.y - group.gy;

  for (let gy = 0; gy < group.height; gy++) {
    for (let gx = 0; gx < group.width; gx++) {
      if (gx === group.gx && gy === group.gy) continue;
      const target = getCell(state.grid, baseX + gx, baseY + gy);
      if (!target) return false;
      if (target.collapsed) return false;
      const groupTileId = `${group.id}_${gx}_${gy}`;
      if (!target.options.has(groupTileId)) return false;
    }
  }
  return true;
}

/** When a group tile is collapsed, collapse all other cells in the group. */
function collapseGroup(cell: WFCCell, tile: WFCTile, state: SolverState): void {
  const group = tile.group!;
  const baseX = cell.x - group.gx;
  const baseY = cell.y - group.gy;

  for (let gy = 0; gy < group.height; gy++) {
    for (let gx = 0; gx < group.width; gx++) {
      if (gx === group.gx && gy === group.gy) continue;
      const target = getCell(state.grid, baseX + gx, baseY + gy)!;
      const groupTileId = `${group.id}_${gx}_${gy}`;
      target.collapsed = true;
      target.tileId = groupTileId;
      target.options = new Set([groupTileId]);
    }
  }
}

/** Propagate constraints from a collapsed cell to neighbors. */
function propagate(startX: number, startY: number, state: SolverState): boolean {
  const { grid, tiles } = state;
  const stack: [number, number][] = [[startX, startY]];

  while (stack.length > 0) {
    const [cx, cy] = stack.pop()!;
    const cell = getCell(grid, cx, cy)!;

    for (let dir = 0; dir < 4; dir++) {
      const [dx, dy] = DIR_OFFSETS[dir];
      const neighbor = getCell(grid, cx + dx, cy + dy);
      if (!neighbor || neighbor.collapsed) continue;

      const oppDir = OPPOSITE[dir];
      // Gather all sockets our cell can present in this direction
      const possibleSockets = new Set<string>();
      for (const tileId of cell.options) {
        possibleSockets.add(tiles.get(tileId)!.sockets[dir]);
      }

      // Remove neighbor options whose opposite socket doesn't match any of ours
      let changed = false;
      for (const nTileId of neighbor.options) {
        const nSocket = tiles.get(nTileId)!.sockets[oppDir];
        if (!possibleSockets.has(nSocket)) {
          neighbor.options.delete(nTileId);
          changed = true;
        }
      }

      if (neighbor.options.size === 0) return false; // contradiction
      if (changed) stack.push([neighbor.x, neighbor.y]);
    }
  }

  return true;
}

/** Apply boundary constraints: fix specific sockets at grid edges. */
function applyBoundaryConstraints(
  state: SolverState,
  constraints?: Map<string, string[]>
): boolean {
  if (!constraints) return true;

  const { grid, tiles } = state;
  for (const [key, allowedSockets] of constraints) {
    const [xStr, yStr, dirStr] = key.split(",");
    const x = parseInt(xStr);
    const y = parseInt(yStr);
    const dir = parseInt(dirStr);
    const cell = getCell(grid, x, y);
    if (!cell || cell.collapsed) continue;

    const socketSet = new Set(allowedSockets);
    for (const tileId of cell.options) {
      if (!socketSet.has(tiles.get(tileId)!.sockets[dir])) {
        cell.options.delete(tileId);
      }
    }
    if (cell.options.size === 0) return false;
  }

  // Initial propagation from constrained cells
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      const cell = grid.cells[y][x];
      if (!cell.collapsed && cell.options.size < tiles.size) {
        if (!propagate(x, y, state)) return false;
      }
    }
  }

  return true;
}

/**
 * Solve a WFC grid.
 * Returns the solved grid or null if no valid solution found after retries.
 */
export function solveWFC(
  width: number,
  height: number,
  tileList: WFCTile[],
  constraints?: Map<string, string[]>,
  seed?: number
): WFCGrid | null {
  const maxRetries = 30;
  const baseSeed = seed ?? Date.now();
  const tileMap = new Map<string, WFCTile>(tileList.map((t) => [t.id, t]));
  const tileIds = tileList.map((t) => t.id);

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const rng = mulberry32(baseSeed + attempt);
    const grid = createGrid(width, height, tileIds);
    const state: SolverState = { grid, tiles: tileMap, rng };

    if (!applyBoundaryConstraints(state, constraints)) continue;

    let solved = true;
    for (;;) {
      const cell = findLowestEntropy(grid, rng);
      if (!cell) {
        // Check if all cells are collapsed
        let allCollapsed = true;
        for (let y = 0; y < height && allCollapsed; y++) {
          for (let x = 0; x < width && allCollapsed; x++) {
            if (!grid.cells[y][x].collapsed) allCollapsed = false;
          }
        }
        if (!allCollapsed) {
          solved = false; // contradiction: uncollapsed cell with 0 options
        }
        break;
      }

      if (!collapseCell(cell, state)) {
        solved = false;
        break;
      }

      if (!propagate(cell.x, cell.y, state)) {
        solved = false;
        break;
      }
    }

    if (solved) return grid;
  }

  return null;
}

/** Validate a solved grid: check all adjacent sockets match. */
export function validateGrid(grid: WFCGrid, tiles: Map<string, WFCTile>): boolean {
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      const cell = grid.cells[y][x];
      if (!cell.collapsed || !cell.tileId) return false;
      const tile = tiles.get(cell.tileId);
      if (!tile) return false;

      for (let dir = 0; dir < 4; dir++) {
        const [dx, dy] = DIR_OFFSETS[dir];
        const neighbor = getCell(grid, x + dx, y + dy);
        if (!neighbor || !neighbor.tileId) continue;
        const nTile = tiles.get(neighbor.tileId);
        if (!nTile) return false;

        if (tile.sockets[dir] !== nTile.sockets[OPPOSITE[dir]]) {
          return false;
        }
      }
    }
  }
  return true;
}
