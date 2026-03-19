import type { World, StationType } from "./types";

export const CARDINAL_DIRS = [[0, -1], [0, 1], [-1, 0], [1, 0]] as const;

export const MOVE_TICKS = 10;
const MAX_LOGS = 80;

export function patchAt(world: World, x: number, y: number): StationType {
  return world.stations.find((s) => s.x === x && s.y === y)?.type ?? "floor";
}

export function log(world: World, workerId: number, message: string) {
  world.logs.push({ tick: world.tick, workerId, message });
  if (world.logs.length > MAX_LOGS) {
    world.logs.splice(0, world.logs.length - MAX_LOGS);
  }
}

export function isTileBlocked(world: World, gx: number, gy: number, excludeWorkerId: number): boolean {
  if (gx < 0 || gx >= world.cols || gy < 0 || gy >= world.rows) return true;
  if (world.stationTileSet.has(`${gx},${gy}`)) return true;
  return world.workers.some((w) => w.id !== excludeWorkerId && w.x === gx && w.y === gy);
}

// ─── Precomputed blocked grid for BFS ───────────────────────

export type BlockedGrid = Uint8Array;

/**
 * Build a blocked grid for the current tick.
 * Cells are 1 = blocked (station or worker), 0 = passable.
 */
export function buildBlockedGrid(world: World, excludeWorkerId: number): BlockedGrid {
  const grid = new Uint8Array(world.cols * world.rows);
  for (const s of world.stations) {
    grid[s.y * world.cols + s.x] = 1;
  }
  for (const w of world.workers) {
    if (w.id !== excludeWorkerId) {
      grid[w.y * world.cols + w.x] = 1;
    }
  }
  return grid;
}

/**
 * BFS on the grid — returns the first-step direction from (sx,sy) toward (tx,ty).
 *
 * @param blocked  Precomputed blocked grid (from `buildBlockedGrid`).
 * @param targetIsStation  If true, goal is any floor cell adjacent to (tx,ty).
 * @returns [dx, dy] direction for the first step, or null if already at goal / no path.
 */
export function bfsDirection(
  cols: number, rows: number,
  blocked: BlockedGrid,
  sx: number, sy: number,
  tx: number, ty: number,
  targetIsStation: boolean,
): [number, number] | null {
  const isGoal = targetIsStation
    ? (x: number, y: number) => Math.abs(x - tx) + Math.abs(y - ty) === 1
    : (x: number, y: number) => x === tx && y === ty;

  if (isGoal(sx, sy)) return null;

  const visited = new Uint8Array(cols * rows);
  visited[sy * cols + sx] = 1;

  const queue = new Int16Array(cols * rows * 4);
  let head = 0;
  let tail = 0;

  for (let d = 0; d < 4; d++) {
    const dx = CARDINAL_DIRS[d][0];
    const dy = CARDINAL_DIRS[d][1];
    const nx = sx + dx;
    const ny = sy + dy;
    if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
    const key = ny * cols + nx;
    if (visited[key]) continue;
    visited[key] = 1;
    if (blocked[key]) continue;
    if (isGoal(nx, ny)) return [dx, dy];
    queue[tail++] = nx; queue[tail++] = ny; queue[tail++] = dx; queue[tail++] = dy;
  }

  while (head < tail) {
    const cx = queue[head++];
    const cy = queue[head++];
    const fdx = queue[head++];
    const fdy = queue[head++];
    for (let d = 0; d < 4; d++) {
      const dx = CARDINAL_DIRS[d][0];
      const dy = CARDINAL_DIRS[d][1];
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
      const key = ny * cols + nx;
      if (visited[key]) continue;
      visited[key] = 1;
      if (blocked[key]) continue;
      if (isGoal(nx, ny)) return [fdx, fdy];
      queue[tail++] = nx; queue[tail++] = ny; queue[tail++] = fdx; queue[tail++] = fdy;
    }
  }

  return null;
}
