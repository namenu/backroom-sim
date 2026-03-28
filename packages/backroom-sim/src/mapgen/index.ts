export type {
  SocketType,
  Sockets,
  TileGroup,
  WFCTile,
  WFCCell,
  WFCGrid,
  MapGenConfig,
  FloorDecoration,
  MapGenStation,
  MapGenResult,
} from "./wfc-types.js";

export { solveWFC, validateGrid } from "./wfc-solver.js";
export { createFactoryTileset } from "./tile-registry.js";
export { generateFactoryLayout } from "./factory-generator.js";
export { ChunkManager, CHUNK_SIZE } from "./chunk.js";
export type { Chunk } from "./chunk.js";
