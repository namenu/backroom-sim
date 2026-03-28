import type { Station } from "./types.js";

/** Get width of station (defaults to 1) */
export function stationWidth(s: Station): number { return s.width ?? 1; }

/** Get height of station (defaults to 1) */
export function stationHeight(s: Station): number { return s.height ?? 1; }

/** Returns all grid tiles a station occupies. Anchor is top-left. */
export function stationOccupies(s: Station): { x: number; y: number }[] {
  const w = stationWidth(s);
  const h = stationHeight(s);
  const tiles: { x: number; y: number }[] = [];
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      tiles.push({ x: s.x + dx, y: s.y + dy });
    }
  }
  return tiles;
}

/** Build Set<string> of "x,y" keys for all tiles occupied by any station */
export function stationTileSetFromStations(stations: Station[]): Set<string> {
  const set = new Set<string>();
  for (const s of stations) {
    for (const t of stationOccupies(s)) {
      set.add(`${t.x},${t.y}`);
    }
  }
  return set;
}

/** Find station occupying tile (x, y), checking multi-tile footprints */
export function stationAtTile(stations: Station[], x: number, y: number): Station | undefined {
  for (const s of stations) {
    const w = stationWidth(s);
    const h = stationHeight(s);
    if (x >= s.x && x < s.x + w && y >= s.y && y < s.y + h) {
      return s;
    }
  }
  return undefined;
}

/** Check if worker position (wx, wy) is adjacent to any edge tile of station s */
export function isAdjacentToStation(wx: number, wy: number, s: Station): boolean {
  const w = stationWidth(s);
  const h = stationHeight(s);
  // Worker must not be inside the station footprint
  if (wx >= s.x && wx < s.x + w && wy >= s.y && wy < s.y + h) return false;
  // Check Manhattan distance 1 to any tile of the station
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      if (Math.abs(wx - (s.x + dx)) + Math.abs(wy - (s.y + dy)) === 1) {
        return true;
      }
    }
  }
  return false;
}
