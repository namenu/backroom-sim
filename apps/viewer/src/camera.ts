export interface Camera {
  panX: number;    // screen-space offset
  panY: number;
  zoom: number;    // 0.25 to 3.0
  viewportW: number;
  viewportH: number;
}

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3.0;

export function createCamera(viewportW: number, viewportH: number): Camera {
  return { panX: 0, panY: 0, zoom: 1, viewportW, viewportH };
}

/** Center camera on the grid */
export function centerOnGrid(
  camera: Camera,
  cols: number,
  rows: number,
  tileW: number,
  tileH: number,
): Camera {
  const topPad = tileH * 2;
  const gridW = (cols + rows) * (tileW / 2) + tileW;
  const gridH = (cols + rows) * (tileH / 2) + topPad + tileH;
  const zoom = Math.min(camera.viewportW / gridW, camera.viewportH / gridH, 1);
  return {
    ...camera,
    zoom,
    panX: (camera.viewportW - gridW * zoom) / 2,
    panY: (camera.viewportH - gridH * zoom) / 2,
  };
}

/** Apply zoom centered on mouse position */
export function applyZoom(
  camera: Camera,
  deltaZoom: number,
  mouseX: number,
  mouseY: number,
): Camera {
  const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, camera.zoom * deltaZoom));
  // Keep the world point under the mouse fixed
  const scale = newZoom / camera.zoom;
  return {
    ...camera,
    zoom: newZoom,
    panX: mouseX - (mouseX - camera.panX) * scale,
    panY: mouseY - (mouseY - camera.panY) * scale,
  };
}

/** Apply pan offset */
export function applyPan(camera: Camera, dx: number, dy: number): Camera {
  return { ...camera, panX: camera.panX + dx, panY: camera.panY + dy };
}

/** Get visible tile range for culling (returns bounding box in grid coords) */
export function getVisibleTileRange(
  camera: Camera,
  cols: number,
  rows: number,
  originX: number,
  originY: number,
  tileW: number,
  tileH: number,
): { minGX: number; maxGX: number; minGY: number; maxGY: number } {
  // Compute the world-space bounding box of the viewport
  const left = -camera.panX / camera.zoom;
  const top = -camera.panY / camera.zoom;
  const right = (camera.viewportW - camera.panX) / camera.zoom;
  const bottom = (camera.viewportH - camera.panY) / camera.zoom;

  const halfW = tileW / 2;
  const halfH = tileH / 2;

  // Check all four viewport corners in world space
  const corners = [
    [left - originX, top - originY],
    [right - originX, top - originY],
    [left - originX, bottom - originY],
    [right - originX, bottom - originY],
  ];

  let minGX = Infinity, maxGX = -Infinity;
  let minGY = Infinity, maxGY = -Infinity;

  for (const [sx, sy] of corners) {
    const gx = (sx / halfW + sy / halfH) / 2;
    const gy = (sy / halfH - sx / halfW) / 2;
    minGX = Math.min(minGX, gx);
    maxGX = Math.max(maxGX, gx);
    minGY = Math.min(minGY, gy);
    maxGY = Math.max(maxGY, gy);
  }

  // Add margin and clamp
  const margin = 2;
  return {
    minGX: Math.max(0, Math.floor(minGX) - margin),
    maxGX: Math.min(cols - 1, Math.ceil(maxGX) + margin),
    minGY: Math.max(0, Math.floor(minGY) - margin),
    maxGY: Math.min(rows - 1, Math.ceil(maxGY) + margin),
  };
}

/** Convert screen coords to world coords (inverse of camera transform) */
export function screenToWorld(
  camera: Camera,
  screenX: number,
  screenY: number,
): { worldX: number; worldY: number } {
  return {
    worldX: (screenX - camera.panX) / camera.zoom,
    worldY: (screenY - camera.panY) / camera.zoom,
  };
}
