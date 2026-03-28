import type { WFCTile, Sockets } from "./wfc-types.js";

function tile(id: string, sockets: Sockets, weight: number, extra?: Partial<WFCTile>): WFCTile {
  return { id, sockets, weight, ...extra };
}

/** Create a set of tiles for a multi-tile station. All sockets are "floor" for easy adjacency. */
function stationTiles(
  stationType: string,
  width: number,
  height: number,
  weight: number
): WFCTile[] {
  const tiles: WFCTile[] = [];
  const groupId = `station_${stationType}`;

  for (let gy = 0; gy < height; gy++) {
    for (let gx = 0; gx < width; gx++) {
      tiles.push(
        tile(`${groupId}_${gx}_${gy}`, ["floor", "floor", "floor", "floor"], weight, {
          station: { type: stationType, offsetX: gx, offsetY: gy },
          group: { id: groupId, gx, gy, width, height },
        })
      );
    }
  }

  return tiles;
}

/**
 * Create the factory tileset with adjacency rules encoded via sockets.
 *
 * Socket types used:
 * - "floor": walkable ground, compatible with other floor
 * - "pipe_h" / "pipe_v": pipe connections (must match same type)
 * - "conveyor_h" / "conveyor_v": conveyor connections
 * - "wall": wall edge (matches other wall)
 */
export function createFactoryTileset(density = 0.3): WFCTile[] {
  const floorWeight = 10;
  const pipeWeight = 2;
  const conveyorWeight = 2;
  const stationWeight = Math.max(0.1, density * 2);

  const tiles: WFCTile[] = [
    // --- Floor tiles (high weight = majority of map) ---
    tile("floor_open", ["floor", "floor", "floor", "floor"], floorWeight),
    tile("floor_grated", ["floor", "floor", "floor", "floor"], floorWeight * 0.3),
    tile("floor_dirty", ["floor", "floor", "floor", "floor"], floorWeight * 0.2),

    // --- Pipes (must connect to matching pipe ends or terminate) ---
    tile("pipe_h", ["floor", "pipe_h", "floor", "pipe_h"], pipeWeight),
    tile("pipe_v", ["pipe_v", "floor", "pipe_v", "floor"], pipeWeight),
    tile("pipe_corner_ne", ["pipe_v", "pipe_h", "floor", "floor"], pipeWeight * 0.5),
    tile("pipe_corner_nw", ["pipe_v", "floor", "floor", "pipe_h"], pipeWeight * 0.5),
    tile("pipe_corner_se", ["floor", "pipe_h", "pipe_v", "floor"], pipeWeight * 0.5),
    tile("pipe_corner_sw", ["floor", "floor", "pipe_v", "pipe_h"], pipeWeight * 0.5),
    tile("pipe_t_n", ["pipe_v", "pipe_h", "floor", "pipe_h"], pipeWeight * 0.3),
    tile("pipe_t_e", ["pipe_v", "pipe_h", "pipe_v", "floor"], pipeWeight * 0.3),
    tile("pipe_t_s", ["floor", "pipe_h", "pipe_v", "pipe_h"], pipeWeight * 0.3),
    tile("pipe_t_w", ["pipe_v", "floor", "pipe_v", "pipe_h"], pipeWeight * 0.3),
    tile("pipe_cross", ["pipe_v", "pipe_h", "pipe_v", "pipe_h"], pipeWeight * 0.2),

    // Pipe terminators (pipe on one side, floor on others)
    tile("pipe_end_N", ["pipe_v", "floor", "floor", "floor"], pipeWeight * 0.5),
    tile("pipe_end_E", ["floor", "pipe_h", "floor", "floor"], pipeWeight * 0.5),
    tile("pipe_end_S", ["floor", "floor", "pipe_v", "floor"], pipeWeight * 0.5),
    tile("pipe_end_W", ["floor", "floor", "floor", "pipe_h"], pipeWeight * 0.5),

    // --- Conveyors ---
    tile("conveyor_h", ["floor", "conveyor_h", "floor", "conveyor_h"], conveyorWeight),
    tile("conveyor_v", ["conveyor_v", "floor", "conveyor_v", "floor"], conveyorWeight),
    tile("conveyor_corner_ne", ["conveyor_v", "conveyor_h", "floor", "floor"], conveyorWeight * 0.5),
    tile("conveyor_corner_nw", ["conveyor_v", "floor", "floor", "conveyor_h"], conveyorWeight * 0.5),
    tile("conveyor_corner_se", ["floor", "conveyor_h", "conveyor_v", "floor"], conveyorWeight * 0.5),
    tile("conveyor_corner_sw", ["floor", "floor", "conveyor_v", "conveyor_h"], conveyorWeight * 0.5),

    // Conveyor terminators
    tile("conveyor_end_N", ["conveyor_v", "floor", "floor", "floor"], conveyorWeight * 0.5),
    tile("conveyor_end_E", ["floor", "conveyor_h", "floor", "floor"], conveyorWeight * 0.5),
    tile("conveyor_end_S", ["floor", "floor", "conveyor_v", "floor"], conveyorWeight * 0.5),
    tile("conveyor_end_W", ["floor", "floor", "floor", "conveyor_h"], conveyorWeight * 0.5),

    // --- 1x1 Stations (floor sockets on all sides) ---
    tile("station_inspector_0_0", ["floor", "floor", "floor", "floor"], stationWeight, {
      station: { type: "inspector", offsetX: 0, offsetY: 0 },
    }),
    tile("station_conveyor_hub_0_0", ["floor", "floor", "floor", "floor"], stationWeight, {
      station: { type: "conveyor_hub", offsetX: 0, offsetY: 0 },
    }),

    // --- Multi-tile stations (all floor sockets for easy placement) ---
    ...stationTiles("smelter", 2, 2, stationWeight),
    ...stationTiles("furnace", 2, 2, stationWeight),
    ...stationTiles("press", 2, 2, stationWeight),
    ...stationTiles("packaging_unit", 2, 2, stationWeight),
    ...stationTiles("assembler", 2, 3, stationWeight),
    ...stationTiles("storage_depot", 3, 2, stationWeight),

    // --- Wall tiles (decorative, wall-to-wall edges) ---
    tile("wall_N", ["wall", "floor", "floor", "floor"], 0.5),
    tile("wall_E", ["floor", "wall", "floor", "floor"], 0.5),
    tile("wall_S", ["floor", "floor", "wall", "floor"], 0.5),
    tile("wall_W", ["floor", "floor", "floor", "wall"], 0.5),
    tile("wall_corner_NE", ["wall", "wall", "floor", "floor"], 0.3),
    tile("wall_corner_NW", ["wall", "floor", "floor", "wall"], 0.3),
    tile("wall_corner_SE", ["floor", "wall", "wall", "floor"], 0.3),
    tile("wall_corner_SW", ["floor", "floor", "wall", "wall"], 0.3),

  ];

  return tiles;
}
