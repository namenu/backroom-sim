/**
 * Generate isometric tile assets for the factory/WFC map generator.
 *
 * Art style: 64x64 pixel art, 2:1 isometric diamond base with 3D box extrusion.
 * Matches existing backroom-sim tile aesthetic.
 *
 * Usage: node scripts/generate-factory-tiles.mjs
 */

import { createCanvas } from "canvas";
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "../apps/viewer/public/backroom-assets/tiles");

const SIZE = 64;
const HALF = SIZE / 2;

const DIAMOND_W = 58;
const DIAMOND_H = 29;

function createTile() {
  return createCanvas(SIZE, SIZE);
}

function drawIsoBox(ctx, topY, boxH, topColor, leftColor, rightColor) {
  const cx = HALF;
  const hw = DIAMOND_W / 2;
  const hh = DIAMOND_H / 2;

  ctx.fillStyle = topColor;
  ctx.beginPath();
  ctx.moveTo(cx, topY - hh);
  ctx.lineTo(cx + hw, topY);
  ctx.lineTo(cx, topY + hh);
  ctx.lineTo(cx - hw, topY);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = leftColor;
  ctx.beginPath();
  ctx.moveTo(cx - hw, topY);
  ctx.lineTo(cx, topY + hh);
  ctx.lineTo(cx, topY + hh + boxH);
  ctx.lineTo(cx - hw, topY + boxH);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = rightColor;
  ctx.beginPath();
  ctx.moveTo(cx + hw, topY);
  ctx.lineTo(cx, topY + hh);
  ctx.lineTo(cx, topY + hh + boxH);
  ctx.lineTo(cx + hw, topY + boxH);
  ctx.closePath();
  ctx.fill();
}

function drawIsoBoxOutline(ctx, topY, boxH, color, lineWidth = 1) {
  const cx = HALF;
  const hw = DIAMOND_W / 2;
  const hh = DIAMOND_H / 2;

  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;

  ctx.beginPath();
  ctx.moveTo(cx, topY - hh);
  ctx.lineTo(cx + hw, topY);
  ctx.lineTo(cx, topY + hh);
  ctx.lineTo(cx - hw, topY);
  ctx.closePath();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx - hw, topY);
  ctx.lineTo(cx - hw, topY + boxH);
  ctx.lineTo(cx, topY + hh + boxH);
  ctx.lineTo(cx, topY + hh);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx + hw, topY);
  ctx.lineTo(cx + hw, topY + boxH);
  ctx.lineTo(cx, topY + hh + boxH);
  ctx.stroke();
}

function drawCircle(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function drawIsoEllipse(ctx, cx, cy, rx, ry, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

// ============================================================
// Tile generators
// ============================================================

function generatePipeH() {
  const canvas = createTile();
  const ctx = canvas.getContext("2d");
  const topY = 28;
  const boxH = 8;

  // Flat floor base
  drawIsoBox(ctx, topY, boxH, "#5a5e63", "#3a3e43", "#4a4e53");

  // Horizontal pipe (going E-W in iso space = top-right to bottom-left)
  const cx = HALF;
  ctx.strokeStyle = "#7a8a6a";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(cx - 28, topY);
  ctx.lineTo(cx + 28, topY);
  ctx.stroke();
  // Pipe highlight
  ctx.strokeStyle = "#9aaa8a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 28, topY - 1);
  ctx.lineTo(cx + 28, topY - 1);
  ctx.stroke();

  drawIsoBoxOutline(ctx, topY, boxH, "#2a2e33");
  return canvas;
}

function generatePipeV() {
  const canvas = createTile();
  const ctx = canvas.getContext("2d");
  const topY = 28;
  const boxH = 8;

  drawIsoBox(ctx, topY, boxH, "#5a5e63", "#3a3e43", "#4a4e53");

  // Vertical pipe (going N-S in iso space)
  const cx = HALF;
  ctx.strokeStyle = "#7a8a6a";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(cx, topY - 14);
  ctx.lineTo(cx, topY + 14);
  ctx.stroke();
  ctx.strokeStyle = "#9aaa8a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 1, topY - 14);
  ctx.lineTo(cx - 1, topY + 14);
  ctx.stroke();

  drawIsoBoxOutline(ctx, topY, boxH, "#2a2e33");
  return canvas;
}

function generatePipeCorner(direction) {
  const canvas = createTile();
  const ctx = canvas.getContext("2d");
  const topY = 28;
  const boxH = 8;

  drawIsoBox(ctx, topY, boxH, "#5a5e63", "#3a3e43", "#4a4e53");

  const cx = HALF;
  ctx.strokeStyle = "#7a8a6a";
  ctx.lineWidth = 6;

  const ends = {
    ne: [[cx, topY - 14], [cx + 28, topY]],
    nw: [[cx, topY - 14], [cx - 28, topY]],
    se: [[cx, topY + 14], [cx + 28, topY]],
    sw: [[cx, topY + 14], [cx - 28, topY]],
  };

  const [end1, end2] = ends[direction];
  ctx.beginPath();
  ctx.moveTo(end1[0], end1[1]);
  ctx.lineTo(cx, topY);
  ctx.lineTo(end2[0], end2[1]);
  ctx.stroke();

  // Joint
  drawCircle(ctx, cx, topY, 4, "#8a9a7a");

  drawIsoBoxOutline(ctx, topY, boxH, "#2a2e33");
  return canvas;
}

function generateConveyorH() {
  const canvas = createTile();
  const ctx = canvas.getContext("2d");
  const topY = 28;
  const boxH = 8;

  drawIsoBox(ctx, topY, boxH, "#5a5e63", "#3a3e43", "#4a4e53");

  const cx = HALF;
  // Belt
  ctx.fillStyle = "#3a3a3a";
  ctx.fillRect(cx - 26, topY - 3, 52, 6);
  // Belt segments
  ctx.strokeStyle = "#555";
  ctx.lineWidth = 1;
  for (let i = -24; i <= 24; i += 6) {
    ctx.beginPath();
    ctx.moveTo(cx + i, topY - 3);
    ctx.lineTo(cx + i, topY + 3);
    ctx.stroke();
  }
  // Rollers at ends
  drawCircle(ctx, cx - 24, topY, 3, "#666");
  drawCircle(ctx, cx + 24, topY, 3, "#666");
  // Direction arrow
  ctx.fillStyle = "#ff8800";
  ctx.beginPath();
  ctx.moveTo(cx + 8, topY - 2);
  ctx.lineTo(cx + 14, topY);
  ctx.lineTo(cx + 8, topY + 2);
  ctx.fill();

  drawIsoBoxOutline(ctx, topY, boxH, "#2a2e33");
  return canvas;
}

function generateConveyorV() {
  const canvas = createTile();
  const ctx = canvas.getContext("2d");
  const topY = 28;
  const boxH = 8;

  drawIsoBox(ctx, topY, boxH, "#5a5e63", "#3a3e43", "#4a4e53");

  const cx = HALF;
  // Belt
  ctx.fillStyle = "#3a3a3a";
  ctx.fillRect(cx - 3, topY - 13, 6, 26);
  // Belt segments
  ctx.strokeStyle = "#555";
  ctx.lineWidth = 1;
  for (let i = -12; i <= 12; i += 6) {
    ctx.beginPath();
    ctx.moveTo(cx - 3, topY + i);
    ctx.lineTo(cx + 3, topY + i);
    ctx.stroke();
  }
  // Direction arrow
  ctx.fillStyle = "#ff8800";
  ctx.beginPath();
  ctx.moveTo(cx - 2, topY + 4);
  ctx.lineTo(cx, topY + 10);
  ctx.lineTo(cx + 2, topY + 4);
  ctx.fill();

  drawIsoBoxOutline(ctx, topY, boxH, "#2a2e33");
  return canvas;
}

function generateWall(direction) {
  const canvas = createTile();
  const ctx = canvas.getContext("2d");
  const topY = 20;
  const boxH = 24;

  // Concrete wall
  drawIsoBox(ctx, topY, boxH, "#808890", "#606870", "#707880");
  drawIsoBoxOutline(ctx, topY, boxH, "#404850");

  const cx = HALF;
  const hw = DIAMOND_W / 2;
  const hh = DIAMOND_H / 2;

  // Wall accent line on the appropriate side
  ctx.strokeStyle = "#a0a8b0";
  ctx.lineWidth = 2;

  if (direction === "n") {
    ctx.beginPath();
    ctx.moveTo(cx - hw + 4, topY - 2);
    ctx.lineTo(cx, topY - hh + 2);
    ctx.lineTo(cx + hw - 4, topY + 2);
    ctx.stroke();
  } else if (direction === "s") {
    ctx.beginPath();
    ctx.moveTo(cx - hw + 4, topY + 2);
    ctx.lineTo(cx, topY + hh - 2);
    ctx.lineTo(cx + hw - 4, topY);
    ctx.stroke();
  } else if (direction === "e") {
    ctx.beginPath();
    ctx.moveTo(cx + 4, topY - hh + 4);
    ctx.lineTo(cx + hw - 2, topY + 2);
    ctx.lineTo(cx + 2, topY + hh - 2);
    ctx.stroke();
  } else if (direction === "w") {
    ctx.beginPath();
    ctx.moveTo(cx - 4, topY - hh + 4);
    ctx.lineTo(cx - hw + 2, topY + 2);
    ctx.lineTo(cx - 2, topY + hh - 2);
    ctx.stroke();
  }

  return canvas;
}

function generateFloorGrated() {
  const canvas = createTile();
  const ctx = canvas.getContext("2d");
  const topY = 30;
  const boxH = 4;

  drawIsoBox(ctx, topY, boxH, "#4a5058", "#3a4048", "#424a50");

  // Grate lines
  const cx = HALF;
  ctx.strokeStyle = "#5a6268";
  ctx.lineWidth = 1;
  for (let i = -10; i <= 10; i += 4) {
    ctx.beginPath();
    ctx.moveTo(cx - 20, topY + i * 0.5);
    ctx.lineTo(cx + 20, topY + i * 0.5);
    ctx.stroke();
  }

  drawIsoBoxOutline(ctx, topY, boxH, "#2a2e33");
  return canvas;
}

function generateFloorDirty() {
  const canvas = createTile();
  const ctx = canvas.getContext("2d");
  const topY = 30;
  const boxH = 4;

  drawIsoBox(ctx, topY, boxH, "#6a6050", "#4a4030", "#5a5040");

  // Dirt spots
  ctx.globalAlpha = 0.4;
  drawCircle(ctx, HALF - 8, topY - 3, 3, "#3a3020");
  drawCircle(ctx, HALF + 6, topY + 2, 2, "#4a4030");
  drawCircle(ctx, HALF + 2, topY - 5, 1.5, "#3a3020");
  ctx.globalAlpha = 1.0;

  drawIsoBoxOutline(ctx, topY, boxH, "#2a2e33");
  return canvas;
}

// --- Multi-tile station composites (rendered as single tile for now) ---

function generateSmelter() {
  const canvas = createTile();
  const ctx = canvas.getContext("2d");
  const topY = 18;
  const boxH = 26;

  // Orange-glow furnace body
  drawIsoBox(ctx, topY, boxH, "#8a4420", "#6a2410", "#7a3418");
  drawIsoBoxOutline(ctx, topY, boxH, "#4a1408");

  // Furnace opening (glowing)
  const cx = HALF;
  ctx.fillStyle = "#ff6600";
  ctx.fillRect(cx - 8, topY + 12, 16, 8);
  // Inner glow
  ctx.fillStyle = "#ffaa00";
  ctx.fillRect(cx - 5, topY + 14, 10, 4);
  // Heat shimmer on top
  ctx.globalAlpha = 0.3;
  drawIsoEllipse(ctx, cx, topY - 2, 10, 5, "#ff4400");
  ctx.globalAlpha = 1.0;
  // Chimney
  ctx.fillStyle = "#5a3010";
  ctx.fillRect(cx + 8, topY - 14, 6, 12);
  ctx.fillStyle = "#4a2008";
  ctx.fillRect(cx + 9, topY - 16, 4, 3);

  return canvas;
}

function generateAssembler() {
  const canvas = createTile();
  const ctx = canvas.getContext("2d");
  const topY = 18;
  const boxH = 26;

  // Industrial grey body
  drawIsoBox(ctx, topY, boxH, "#607080", "#405060", "#506070");
  drawIsoBoxOutline(ctx, topY, boxH, "#304050");

  const cx = HALF;
  // Mechanical arm (angled lines)
  ctx.strokeStyle = "#88a0b8";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - 10, topY - 6);
  ctx.lineTo(cx, topY - 12);
  ctx.lineTo(cx + 12, topY - 4);
  ctx.stroke();
  // Arm joint
  drawCircle(ctx, cx, topY - 12, 3, "#90a8c0");
  // Gripper
  ctx.strokeStyle = "#ff8800";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx + 10, topY - 5);
  ctx.lineTo(cx + 15, topY - 2);
  ctx.moveTo(cx + 10, topY - 3);
  ctx.lineTo(cx + 15, topY);
  ctx.stroke();
  // Control panel on side
  ctx.fillStyle = "#2a3a4a";
  ctx.fillRect(cx - 18, topY + 6, 8, 10);
  drawCircle(ctx, cx - 16, topY + 9, 1.5, "#00ff00");
  drawCircle(ctx, cx - 13, topY + 9, 1.5, "#ff0000");

  return canvas;
}

function generateFurnace() {
  const canvas = createTile();
  const ctx = canvas.getContext("2d");
  const topY = 18;
  const boxH = 26;

  // Dark industrial body
  drawIsoBox(ctx, topY, boxH, "#5a4a4a", "#3a2a2a", "#4a3a3a");
  drawIsoBoxOutline(ctx, topY, boxH, "#2a1a1a");

  const cx = HALF;
  // Furnace door
  ctx.fillStyle = "#3a3030";
  ctx.beginPath();
  ctx.arc(cx, topY + 14, 8, 0, Math.PI * 2);
  ctx.fill();
  // Glow through door
  ctx.fillStyle = "#cc4400";
  ctx.beginPath();
  ctx.arc(cx, topY + 14, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ff8800";
  ctx.beginPath();
  ctx.arc(cx, topY + 14, 3, 0, Math.PI * 2);
  ctx.fill();
  // Temperature gauge
  ctx.fillStyle = "#222";
  ctx.fillRect(cx + 10, topY + 2, 6, 6);
  ctx.strokeStyle = "#ff3300";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx + 13, topY + 7);
  ctx.lineTo(cx + 13, topY + 3);
  ctx.stroke();

  return canvas;
}

function generateStorageDepot() {
  const canvas = createTile();
  const ctx = canvas.getContext("2d");
  const topY = 20;
  const boxH = 22;

  // Shelving unit
  drawIsoBox(ctx, topY, boxH, "#7a6a50", "#5a4a30", "#6a5a40");
  drawIsoBoxOutline(ctx, topY, boxH, "#3a2a18");

  const cx = HALF;
  // Shelf lines
  ctx.strokeStyle = "#8a7a60";
  ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    const sy = topY + 6 + i * 6;
    ctx.beginPath();
    ctx.moveTo(cx - 20, sy);
    ctx.lineTo(cx + 20, sy);
    ctx.stroke();
  }
  // Boxes on shelves
  ctx.fillStyle = "#a08860";
  ctx.fillRect(cx - 16, topY + 1, 8, 5);
  ctx.fillRect(cx + 4, topY + 1, 10, 5);
  ctx.fillStyle = "#90784a";
  ctx.fillRect(cx - 12, topY + 7, 6, 5);
  ctx.fillRect(cx + 2, topY + 7, 8, 5);
  ctx.fillRect(cx - 18, topY + 13, 10, 5);
  // Crate on top
  ctx.fillStyle = "#b0986a";
  ctx.fillRect(cx - 6, topY - 10, 12, 8);
  ctx.strokeStyle = "#7a6840";
  ctx.strokeRect(cx - 6, topY - 10, 12, 8);

  return canvas;
}

function generatePress() {
  const canvas = createTile();
  const ctx = canvas.getContext("2d");
  const topY = 18;
  const boxH = 26;

  // Heavy hydraulic press
  drawIsoBox(ctx, topY, boxH, "#707880", "#505860", "#606870");
  drawIsoBoxOutline(ctx, topY, boxH, "#383e48");

  const cx = HALF;
  // Hydraulic columns
  ctx.fillStyle = "#888e98";
  ctx.fillRect(cx - 14, topY - 12, 4, 20);
  ctx.fillRect(cx + 10, topY - 12, 4, 20);
  // Press plate (top)
  ctx.fillStyle = "#606870";
  ctx.fillRect(cx - 16, topY - 14, 32, 4);
  // Press plate (bottom)
  ctx.fillStyle = "#505860";
  ctx.fillRect(cx - 12, topY + 4, 24, 3);
  // Hydraulic cylinder
  ctx.fillStyle = "#aa3030";
  ctx.fillRect(cx - 2, topY - 10, 4, 12);
  // Pressure gauge
  drawCircle(ctx, cx + 18, topY - 4, 4, "#222");
  drawCircle(ctx, cx + 18, topY - 4, 2.5, "#333");
  ctx.strokeStyle = "#ff4400";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx + 18, topY - 4);
  ctx.lineTo(cx + 20, topY - 6);
  ctx.stroke();

  return canvas;
}

function generatePackagingUnit() {
  const canvas = createTile();
  const ctx = canvas.getContext("2d");
  const topY = 20;
  const boxH = 22;

  // Assembly table
  drawIsoBox(ctx, topY, boxH, "#6a7a6a", "#4a5a4a", "#5a6a5a");
  drawIsoBoxOutline(ctx, topY, boxH, "#3a4a3a");

  const cx = HALF;
  // Cardboard boxes
  ctx.fillStyle = "#c4a060";
  ctx.fillRect(cx - 14, topY - 8, 10, 8);
  ctx.strokeStyle = "#8a7040";
  ctx.lineWidth = 1;
  ctx.strokeRect(cx - 14, topY - 8, 10, 8);
  // Box tape
  ctx.strokeStyle = "#d0b070";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 9, topY - 8);
  ctx.lineTo(cx - 9, topY);
  ctx.stroke();

  // Open box
  ctx.fillStyle = "#d4b070";
  ctx.fillRect(cx + 4, topY - 6, 12, 6);
  ctx.strokeStyle = "#a08848";
  ctx.strokeRect(cx + 4, topY - 6, 12, 6);
  // Box flaps
  ctx.beginPath();
  ctx.moveTo(cx + 4, topY - 6);
  ctx.lineTo(cx + 2, topY - 10);
  ctx.lineTo(cx + 10, topY - 10);
  ctx.lineTo(cx + 10, topY - 6);
  ctx.fillStyle = "#c4a060";
  ctx.fill();

  // Tape dispenser
  drawCircle(ctx, cx - 20, topY + 6, 3, "#aa4040");
  drawCircle(ctx, cx - 20, topY + 6, 1.5, "#882020");

  return canvas;
}

// ============================================================
// Main — generate all tiles
// ============================================================

const tiles = {
  "pipe_h.png": generatePipeH,
  "pipe_v.png": generatePipeV,
  "pipe_corner_ne.png": () => generatePipeCorner("ne"),
  "pipe_corner_nw.png": () => generatePipeCorner("nw"),
  "pipe_corner_se.png": () => generatePipeCorner("se"),
  "pipe_corner_sw.png": () => generatePipeCorner("sw"),
  "conveyor_h.png": generateConveyorH,
  "conveyor_v.png": generateConveyorV,
  "wall_n.png": () => generateWall("n"),
  "wall_e.png": () => generateWall("e"),
  "wall_s.png": () => generateWall("s"),
  "wall_w.png": () => generateWall("w"),
  "floor_grated.png": generateFloorGrated,
  "floor_dirty.png": generateFloorDirty,
  "smelter.png": generateSmelter,
  "assembler.png": generateAssembler,
  "furnace.png": generateFurnace,
  "storage_depot.png": generateStorageDepot,
  "press.png": generatePress,
  "packaging_unit.png": generatePackagingUnit,
};

mkdirSync(OUT_DIR, { recursive: true });

for (const [filename, generator] of Object.entries(tiles)) {
  const canvas = generator();
  const buffer = canvas.toBuffer("image/png");
  const path = join(OUT_DIR, filename);
  writeFileSync(path, buffer);
  console.log(`  ✓ ${filename} (${buffer.length} bytes)`);
}

console.log(`\nGenerated ${Object.keys(tiles).length} factory tiles in ${OUT_DIR}`);
