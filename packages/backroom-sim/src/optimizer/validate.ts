import type { BackroomLayout } from "../types";
import type { WorkflowGraph } from "../workflow/graph";

/**
 * Validation result for a candidate layout.
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate a candidate layout against all placement constraints.
 *
 * Constraints:
 *  1. Station inventory must match expected counts (if provided).
 *  2. Entrance must be at (0, 0).
 *  3. Receiving (intake) stations must be on the top edge (y = 0).
 *  4. No two stations may occupy the same tile.
 *  5. All stations must be within grid bounds.
 *  6. All non-station tiles must form a connected walkable region
 *     (every station is reachable from the entrance).
 */
export function validateLayout(
  layout: BackroomLayout,
  workflow: WorkflowGraph,
  expectedCounts?: Readonly<Record<string, number>>,
): ValidationResult {
  const errors: string[] = [];
  const { cols, rows, stations } = layout;

  // 1. Station inventory check (if expected counts provided)
  if (expectedCounts) {
    const actual: Record<string, number> = {};
    for (const s of stations) {
      actual[s.type] = (actual[s.type] ?? 0) + 1;
    }
    const allTypes = new Set([...Object.keys(expectedCounts), ...Object.keys(actual)]);
    for (const type of allTypes) {
      const expected = expectedCounts[type] ?? 0;
      const got = actual[type] ?? 0;
      if (got !== expected) {
        errors.push(
          `Station "${type}" count mismatch: expected ${expected}, got ${got}`,
        );
      }
    }
  }

  // 2. Entrance pinned at (0, 0)
  const entrances = stations.filter(
    (s) => workflow.placeRole(s.type) === "entrance",
  );
  if (entrances.length === 0) {
    errors.push("No entrance station found");
  } else {
    for (const e of entrances) {
      if (e.x !== 0 || e.y !== 0) {
        errors.push(`Entrance must be at (0,0), found at (${e.x},${e.y})`);
      }
    }
  }

  // 2. Receiving (intake) stations on top edge
  for (const s of stations) {
    if (workflow.placeRole(s.type) === "intake" && s.y !== 0) {
      errors.push(
        `Intake station "${s.type}" must be on top edge (y=0), found at (${s.x},${s.y})`,
      );
    }
  }

  // 3. Bounds check
  for (const s of stations) {
    if (s.x < 0 || s.x >= cols || s.y < 0 || s.y >= rows) {
      errors.push(
        `Station "${s.type}" at (${s.x},${s.y}) is out of bounds [${cols}x${rows}]`,
      );
    }
  }

  // 4. No overlapping stations
  const occupied = new Set<string>();
  for (const s of stations) {
    const key = `${s.x},${s.y}`;
    if (occupied.has(key)) {
      errors.push(`Overlapping stations at (${s.x},${s.y})`);
    }
    occupied.add(key);
  }

  // 5. Connectivity — BFS on walkable (non-station) tiles from entrance-adjacent floor
  if (errors.length === 0) {
    const connError = checkConnectivity(cols, rows, stations, workflow);
    if (connError) errors.push(connError);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * BFS connectivity check: every station must have at least one adjacent
 * walkable tile, and all walkable tiles must form a single connected component.
 */
function checkConnectivity(
  cols: number,
  rows: number,
  stations: BackroomLayout["stations"],
  workflow: WorkflowGraph,
): string | null {
  const blocked = new Uint8Array(cols * rows);
  for (const s of stations) {
    blocked[s.y * cols + s.x] = 1;
  }

  // Find entrance-adjacent walkable tile as BFS seed
  const entrance = stations.find(
    (s) => workflow.placeRole(s.type) === "entrance",
  );
  if (!entrance) return "No entrance for connectivity check";

  const DIRS = [
    [0, -1],
    [0, 1],
    [-1, 0],
    [1, 0],
  ] as const;

  let seed: { x: number; y: number } | null = null;
  for (const [dx, dy] of DIRS) {
    const nx = entrance.x + dx;
    const ny = entrance.y + dy;
    if (nx >= 0 && nx < cols && ny >= 0 && ny < rows && !blocked[ny * cols + nx]) {
      seed = { x: nx, y: ny };
      break;
    }
  }
  if (!seed) return "Entrance has no adjacent walkable tile";

  // BFS from seed over walkable tiles
  const visited = new Uint8Array(cols * rows);
  visited[seed.y * cols + seed.x] = 1;
  const queue: number[] = [seed.x, seed.y];
  let head = 0;

  while (head < queue.length) {
    const cx = queue[head++];
    const cy = queue[head++];
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
      const key = ny * cols + nx;
      if (visited[key] || blocked[key]) continue;
      visited[key] = 1;
      queue.push(nx, ny);
    }
  }

  // Every station must have at least one adjacent visited (walkable) tile
  for (const s of stations) {
    let reachable = false;
    for (const [dx, dy] of DIRS) {
      const nx = s.x + dx;
      const ny = s.y + dy;
      if (nx >= 0 && nx < cols && ny >= 0 && ny < rows && visited[ny * cols + nx]) {
        reachable = true;
        break;
      }
    }
    if (!reachable) {
      return `Station "${s.type}" at (${s.x},${s.y}) is not reachable`;
    }
  }

  return null;
}
