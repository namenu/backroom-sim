// --- Socket types for tile adjacency ---
export type SocketType =
  | "floor"
  | "wall"
  | "pipe_h"
  | "pipe_v"
  | "conveyor_h"
  | "conveyor_v";

// Direction indices: 0=N, 1=E, 2=S, 3=W
export type Sockets = [SocketType, SocketType, SocketType, SocketType];

export interface TileGroup {
  id: string;
  gx: number; // offset within group (col)
  gy: number; // offset within group (row)
  width: number;
  height: number;
}

export interface WFCTile {
  id: string;
  sockets: Sockets;
  weight: number;
  station?: { type: string; offsetX: number; offsetY: number };
  group?: TileGroup;
}

export interface WFCCell {
  x: number;
  y: number;
  collapsed: boolean;
  tileId: string | null;
  options: Set<string>; // set of tile IDs still possible
}

export interface WFCGrid {
  width: number;
  height: number;
  cells: WFCCell[][];
}

export interface MapGenConfig {
  width: number;
  height: number;
  seed?: number;
  stationTypes?: string[];
  density?: number; // 0-1, controls station frequency via weights
}

// --- Output types compatible with BackroomLayout ---
export interface FloorDecoration {
  type: string;
  x: number;
  y: number;
}

export interface MapGenStation {
  type: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
}

export interface MapGenResult {
  cols: number;
  rows: number;
  stations: MapGenStation[];
  decorations: FloorDecoration[];
}
