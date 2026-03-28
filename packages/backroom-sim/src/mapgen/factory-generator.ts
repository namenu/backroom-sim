import type { MapGenConfig, MapGenResult, MapGenStation, FloorDecoration, WFCGrid, WFCTile } from "./wfc-types.js";
import { solveWFC } from "./wfc-solver.js";
import { createFactoryTileset } from "./tile-registry.js";

const DECORATION_PREFIXES = ["pipe_", "conveyor_"];
const FLOOR_VARIANTS = new Set(["floor_grated", "floor_dirty"]);

/**
 * Generate a factory layout using WFC.
 * Returns a MapGenResult compatible with BackroomLayout.
 */
export function generateFactoryLayout(config: MapGenConfig): MapGenResult | null {
  const { width, height, seed, density = 0.3 } = config;
  const maxAttempts = 5;
  const baseSeed = seed ?? Date.now();

  const tileset = createFactoryTileset(density);
  const filtered = config.stationTypes
    ? tileset.filter((t) => !t.station || config.stationTypes!.includes(t.station.type))
    : tileset;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const grid = solveWFC(width, height, filtered, undefined, baseSeed + attempt * 1000);
    if (!grid) continue;

    const stations = extractStations(grid, filtered);
    const decorations = extractDecorations(grid);

    // Seed entrance at left edge, middle row
    const entranceY = Math.floor(height / 2);
    // Validate connectivity: BFS from entrance to all stations
    if (stations.length > 0 && !checkConnectivity(grid, 0, entranceY, stations)) {
      continue;
    }

    return { cols: width, rows: height, stations, decorations };
  }

  return null;
}

/** Extract station placements from a solved grid. */
function extractStations(grid: WFCGrid, tileset: WFCTile[]): MapGenStation[] {
  const tileMap = new Map(tileset.map((t) => [t.id, t]));
  const seen = new Set<string>(); // track group origins to avoid duplicates
  const stations: MapGenStation[] = [];

  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      const cell = grid.cells[y][x];
      if (!cell.tileId) continue;
      const tile = tileMap.get(cell.tileId);
      if (!tile?.station) continue;

      if (tile.group) {
        // Only emit station at origin (0,0) of group
        if (tile.group.gx !== 0 || tile.group.gy !== 0) continue;
        const key = `${tile.station.type}_${x}_${y}`;
        if (seen.has(key)) continue;
        seen.add(key);
        stations.push({
          type: tile.station.type,
          x,
          y,
          width: tile.group.width,
          height: tile.group.height,
        });
      } else {
        stations.push({ type: tile.station.type, x, y });
      }
    }
  }

  return stations;
}

/** Extract floor decorations (pipes, conveyors, floor variants) from solved grid. */
function extractDecorations(grid: WFCGrid): FloorDecoration[] {
  const decorations: FloorDecoration[] = [];

  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      const tileId = grid.cells[y][x].tileId;
      if (!tileId) continue;

      const isDecoration =
        DECORATION_PREFIXES.some((p) => tileId.startsWith(p)) ||
        FLOOR_VARIANTS.has(tileId);

      if (isDecoration) {
        decorations.push({ type: tileId, x, y });
      }
    }
  }

  return decorations;
}

/** BFS connectivity check: can we reach all stations from the start? */
function checkConnectivity(
  grid: WFCGrid,
  startX: number,
  startY: number,
  stations: MapGenStation[]
): boolean {
  // Build walkable map: floor-socket tiles are walkable
  const walkable = new Set<string>();
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      const tileId = grid.cells[y][x].tileId;
      if (!tileId) continue;
      // Consider anything that isn't a wall tile as walkable for connectivity
      if (!tileId.startsWith("wall_")) {
        walkable.add(`${x},${y}`);
      }
    }
  }

  // BFS from start
  const visited = new Set<string>();
  const queue: [number, number][] = [[startX, startY]];
  visited.add(`${startX},${startY}`);

  while (queue.length > 0) {
    const [x, y] = queue.shift()!;
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const nx = x + dx;
      const ny = y + dy;
      const key = `${nx},${ny}`;
      if (nx >= 0 && nx < grid.width && ny >= 0 && ny < grid.height && !visited.has(key) && walkable.has(key)) {
        visited.add(key);
        queue.push([nx, ny]);
      }
    }
  }

  // Check that at least one cell of each station is adjacent to a visited cell
  for (const station of stations) {
    const w = station.width ?? 1;
    const h = station.height ?? 1;
    let reachable = false;
    for (let sy = station.y; sy < station.y + h && !reachable; sy++) {
      for (let sx = station.x; sx < station.x + w && !reachable; sx++) {
        if (visited.has(`${sx},${sy}`)) {
          reachable = true;
        }
      }
    }
    if (!reachable) return false;
  }

  return true;
}
