import type { BlockedGrid } from "./helpers.js";

const CARDINAL_DIRS: readonly [number, number][] = [[0, -1], [1, 0], [0, 1], [-1, 0]];

/** Min-heap for A* open set. Stores [f, g, x, y, firstDx, firstDy]. */
class MinHeap {
  private data: number[][] = [];

  get size() { return this.data.length; }

  push(node: number[]) {
    this.data.push(node);
    this._bubbleUp(this.data.length - 1);
  }

  pop(): number[] {
    const top = this.data[0];
    const last = this.data.pop()!;
    if (this.data.length > 0) {
      this.data[0] = last;
      this._sinkDown(0);
    }
    return top;
  }

  private _bubbleUp(i: number) {
    const d = this.data;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (d[i][0] < d[parent][0]) {
        [d[i], d[parent]] = [d[parent], d[i]];
        i = parent;
      } else break;
    }
  }

  private _sinkDown(i: number) {
    const d = this.data;
    const n = d.length;
    while (true) {
      let smallest = i;
      const l = 2 * i + 1;
      const r = 2 * i + 2;
      if (l < n && d[l][0] < d[smallest][0]) smallest = l;
      if (r < n && d[r][0] < d[smallest][0]) smallest = r;
      if (smallest !== i) {
        [d[i], d[smallest]] = [d[smallest], d[i]];
        i = smallest;
      } else break;
    }
  }
}

/**
 * A* pathfinding with Manhattan heuristic.
 * Same signature as bfsDirection for drop-in use.
 *
 * @param targetIsStation  If true, goal is any walkable tile adjacent to (tx, ty).
 * @returns [dx, dy] direction for the first step, or null if already at goal / no path.
 */
export function astarDirection(
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

  const heuristic = targetIsStation
    ? (x: number, y: number) => Math.max(0, Math.abs(x - tx) + Math.abs(y - ty) - 1)
    : (x: number, y: number) => Math.abs(x - tx) + Math.abs(y - ty);

  const gScore = new Float32Array(cols * rows);
  gScore.fill(Infinity);
  gScore[sy * cols + sx] = 0;

  const open = new MinHeap();
  // [f, g, x, y, firstDx, firstDy]
  open.push([heuristic(sx, sy), 0, sx, sy, 0, 0]);

  while (open.size > 0) {
    const [, g, cx, cy, fdx, fdy] = open.pop();

    // Skip if we already found a better path to this node
    const cKey = cy * cols + cx;
    if (g > gScore[cKey]) continue;

    for (const [dx, dy] of CARDINAL_DIRS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
      const nKey = ny * cols + nx;
      if (blocked[nKey]) continue;

      const ng = g + 1;
      if (ng >= gScore[nKey]) continue;
      gScore[nKey] = ng;

      // Track first-step direction
      const nfdx = fdx === 0 && fdy === 0 ? dx : fdx;
      const nfdy = fdx === 0 && fdy === 0 ? dy : fdy;

      if (isGoal(nx, ny)) return [nfdx, nfdy];

      open.push([ng + heuristic(nx, ny), ng, nx, ny, nfdx, nfdy]);
    }
  }

  return null;
}
