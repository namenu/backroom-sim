/**
 * Generate isometric tile assets for the factory recipe + station animations.
 *
 * Art style: 64x64 pixel art, 2:1 isometric diamond base with 3D box extrusion.
 * Matches the existing backroom-sim tile aesthetic.
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
// Station animation frames
// ============================================================

function generateBurnerProcessing(frameIdx) {
  const canvas = createTile();
  const ctx = canvas.getContext("2d");
  const topY = 22;
  const boxH = 22;

  drawIsoBox(ctx, topY, boxH, "#707880", "#505860", "#606870");
  drawIsoBoxOutline(ctx, topY, boxH, "#383e48");

  const cx = HALF;
  drawIsoEllipse(ctx, cx, topY, 12, 6, "#2a2e33");

  // Animated flame — vary color and size per frame
  const flameColors = ["#e85020", "#ff6030", "#ff4010", "#e86820"];
  const innerColors = ["#ff8830", "#ffaa50", "#ff7720", "#ffcc60"];
  const sizes = [9, 10, 8, 11];

  ctx.strokeStyle = flameColors[frameIdx];
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(cx, topY, sizes[frameIdx], sizes[frameIdx] / 2, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = innerColors[frameIdx];
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(cx, topY, 5 + frameIdx % 2, 2.5 + (frameIdx % 2) * 0.5, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Flame tips rising
  const tipOffsets = [[-3, -4], [2, -5], [-1, -3], [3, -6]];
  ctx.fillStyle = flameColors[frameIdx];
  for (let i = 0; i <= frameIdx; i++) {
    const [ox, oy] = tipOffsets[i];
    drawCircle(ctx, cx + ox, topY + oy - 2, 1.5, innerColors[i]);
  }

  // Knobs
  for (let i = 0; i < 2; i++) {
    drawCircle(ctx, cx - 8 + i * 16, topY + boxH / 2 + DIAMOND_H / 2, 2, "#333");
  }

  return canvas;
}

function generateStoveProcessing(frameIdx) {
  const canvas = createTile();
  const ctx = canvas.getContext("2d");
  const topY = 22;
  const boxH = 22;

  // Stove body — darker steel
  drawIsoBox(ctx, topY, boxH, "#606068", "#484850", "#545460");
  drawIsoBoxOutline(ctx, topY, boxH, "#303038");

  const cx = HALF;
  // Hotplate
  drawIsoEllipse(ctx, cx, topY, 12, 6, "#3a2020");

  // Animated heat glow
  const glowColors = ["#cc3010", "#dd4020", "#bb2008", "#ee5530"];
  const glowSizes = [10, 11, 9, 12];

  ctx.globalAlpha = 0.6;
  drawIsoEllipse(ctx, cx, topY, glowSizes[frameIdx], glowSizes[frameIdx] / 2, glowColors[frameIdx]);
  ctx.globalAlpha = 1.0;

  // Steam wisps
  ctx.strokeStyle = `rgba(200,200,200,${0.3 + frameIdx * 0.1})`;
  ctx.lineWidth = 1;
  for (let i = 0; i < 2 + frameIdx; i++) {
    const sx = cx - 5 + i * 4;
    ctx.beginPath();
    ctx.moveTo(sx, topY - 6 - frameIdx);
    ctx.quadraticCurveTo(sx + 2, topY - 10 - frameIdx, sx - 1, topY - 14 - frameIdx);
    ctx.stroke();
  }

  return canvas;
}

// ============================================================
// New factory stations (1x1)
// ============================================================

function generateSmelter() {
  const canvas = createTile();
  const ctx = canvas.getContext("2d");
  const topY = 18;
  const boxH = 28;

  // Industrial furnace — dark orange
  drawIsoBox(ctx, topY, boxH, "#8a5030", "#6a3820", "#7a4428");
  drawIsoBoxOutline(ctx, topY, boxH, "#4a2810");

  // Orange glow on top
  const cx = HALF;
  ctx.globalAlpha = 0.5;
  drawIsoEllipse(ctx, cx, topY, 10, 5, "#ff6600");
  ctx.globalAlpha = 1.0;

  // Chimney
  ctx.fillStyle = "#555";
  ctx.fillRect(cx + 8, topY - 18, 5, 14);
  ctx.fillStyle = "#444";
  ctx.fillRect(cx + 7, topY - 20, 7, 3);

  return canvas;
}

function generateSmelterProcessing(frameIdx) {
  const canvas = createTile();
  const ctx = canvas.getContext("2d");
  const topY = 18;
  const boxH = 28;

  drawIsoBox(ctx, topY, boxH, "#8a5030", "#6a3820", "#7a4428");
  drawIsoBoxOutline(ctx, topY, boxH, "#4a2810");

  const cx = HALF;
  const glowIntensity = [0.4, 0.6, 0.8, 0.5];
  ctx.globalAlpha = glowIntensity[frameIdx];
  drawIsoEllipse(ctx, cx, topY, 10 + frameIdx, 5 + frameIdx * 0.5, "#ff4400");
  ctx.globalAlpha = 1.0;

  // Chimney with smoke
  ctx.fillStyle = "#555";
  ctx.fillRect(cx + 8, topY - 18, 5, 14);
  ctx.fillStyle = "#444";
  ctx.fillRect(cx + 7, topY - 20, 7, 3);

  // Smoke puffs
  ctx.globalAlpha = 0.4;
  const smokeY = topY - 22 - frameIdx * 2;
  drawCircle(ctx, cx + 10, smokeY, 3 + frameIdx, "#888");
  drawCircle(ctx, cx + 12, smokeY - 3, 2 + frameIdx, "#777");
  ctx.globalAlpha = 1.0;

  return canvas;
}

function generateFurnace() {
  const canvas = createTile();
  const ctx = canvas.getContext("2d");
  const topY = 18;
  const boxH = 28;

  // Dark industrial furnace
  drawIsoBox(ctx, topY, boxH, "#3a3a44", "#2a2a34", "#333340");
  drawIsoBoxOutline(ctx, topY, boxH, "#1a1a24");

  const cx = HALF;
  // Door/opening glow
  ctx.fillStyle = "#cc4400";
  ctx.fillRect(cx - 6, topY + DIAMOND_H / 2 + 4, 12, 8);
  ctx.fillStyle = "#ff6600";
  ctx.fillRect(cx - 4, topY + DIAMOND_H / 2 + 6, 8, 4);

  return canvas;
}

function generatePress() {
  const canvas = createTile();
  const ctx = canvas.getContext("2d");
  const topY = 18;
  const boxH = 26;

  // Steel press body
  drawIsoBox(ctx, topY, boxH, "#8090a0", "#607080", "#708090");
  drawIsoBoxOutline(ctx, topY, boxH, "#405060");

  const cx = HALF;
  // Piston column
  ctx.fillStyle = "#a0b0c0";
  ctx.fillRect(cx - 3, topY - 14, 6, 12);
  // Press plate
  ctx.fillStyle = "#6080a0";
  ctx.fillRect(cx - 10, topY - 16, 20, 3);

  // Hydraulic cylinders on sides
  ctx.fillStyle = "#cc8800";
  ctx.fillRect(cx - 14, topY - 8, 3, 10);
  ctx.fillRect(cx + 11, topY - 8, 3, 10);

  return canvas;
}

function generateAssembler() {
  const canvas = createTile();
  const ctx = canvas.getContext("2d");
  const topY = 20;
  const boxH = 24;

  // Workbench body
  drawIsoBox(ctx, topY, boxH, "#607850", "#485838", "#506844");
  drawIsoBoxOutline(ctx, topY, boxH, "#304028");

  const cx = HALF;
  // Mechanical arm
  ctx.strokeStyle = "#aab0c0";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 10, topY - 4);
  ctx.lineTo(cx - 4, topY - 12);
  ctx.lineTo(cx + 6, topY - 8);
  ctx.stroke();
  // Gripper
  drawCircle(ctx, cx + 6, topY - 8, 3, "#cc8800");

  // Parts on table
  drawCircle(ctx, cx + 10, topY + 2, 2, "#4488cc");
  drawCircle(ctx, cx - 6, topY + 4, 2, "#cc4444");

  return canvas;
}

function generatePackagingUnit() {
  const canvas = createTile();
  const ctx = canvas.getContext("2d");
  const topY = 22;
  const boxH = 20;

  // Cardboard-toned station
  drawIsoBox(ctx, topY, boxH, "#b0956a", "#907548", "#a08558");
  drawIsoBoxOutline(ctx, topY, boxH, "#705530");

  const cx = HALF;
  // Box outline on top
  ctx.strokeStyle = "#705530";
  ctx.lineWidth = 1;
  ctx.strokeRect(cx - 8, topY - 6, 16, 10);

  // Tape strip
  ctx.strokeStyle = "#cc9944";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, topY - 6);
  ctx.lineTo(cx, topY + 4);
  ctx.stroke();

  return canvas;
}

function generateStorageDepot() {
  const canvas = createTile();
  const ctx = canvas.getContext("2d");
  const topY = 18;
  const boxH = 28;

  // Metal shelving
  drawIsoBox(ctx, topY, boxH, "#7a8088", "#5a6068", "#6a7078");
  drawIsoBoxOutline(ctx, topY, boxH, "#3a4048");

  const cx = HALF;
  // Shelf dividers
  ctx.strokeStyle = "#5a6068";
  ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    const sy = topY + DIAMOND_H / 2 + 4 + i * 7;
    ctx.beginPath();
    ctx.moveTo(cx - 12, sy);
    ctx.lineTo(cx + 12, sy);
    ctx.stroke();
  }

  // Boxes on shelves
  const boxColors = ["#cc8844", "#88aa44", "#4488cc"];
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = boxColors[i];
    ctx.fillRect(cx - 8 + i * 6, topY + DIAMOND_H / 2 + 5 + i * 7, 5, 5);
  }

  return canvas;
}

function generateCoolingTower() {
  const canvas = createTile();
  const ctx = canvas.getContext("2d");
  const topY = 14;
  const boxH = 32;

  // Tall tower
  drawIsoBox(ctx, topY, boxH, "#90a8b8", "#708898", "#809aaa");
  drawIsoBoxOutline(ctx, topY, boxH, "#506878");

  const cx = HALF;
  // Cooling fins
  ctx.strokeStyle = "#607888";
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    const sy = topY + DIAMOND_H / 2 + 4 + i * 6;
    ctx.beginPath();
    ctx.moveTo(cx - 14, sy);
    ctx.lineTo(cx + 14, sy);
    ctx.stroke();
  }

  // Steam
  ctx.globalAlpha = 0.3;
  drawCircle(ctx, cx - 2, topY - 10, 4, "#cce0ee");
  drawCircle(ctx, cx + 3, topY - 14, 3, "#cce0ee");
  ctx.globalAlpha = 1.0;

  return canvas;
}

function generateChemicalMixer() {
  const canvas = createTile();
  const ctx = canvas.getContext("2d");
  const topY = 20;
  const boxH = 24;

  // Lab bench
  drawIsoBox(ctx, topY, boxH, "#606870", "#484e58", "#545c64");
  drawIsoBoxOutline(ctx, topY, boxH, "#303840");

  const cx = HALF;
  // Vats (ellipses on top)
  drawIsoEllipse(ctx, cx - 8, topY - 2, 5, 2.5, "#44aa66");
  drawIsoEllipse(ctx, cx + 8, topY - 2, 5, 2.5, "#aa4466");

  // Tubes connecting vats
  ctx.strokeStyle = "#8090a0";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx - 3, topY - 2);
  ctx.quadraticCurveTo(cx, topY - 8, cx + 3, topY - 2);
  ctx.stroke();

  return canvas;
}

function generateInspector() {
  const canvas = createTile();
  const ctx = canvas.getContext("2d");
  const topY = 24;
  const boxH = 18;

  // Clean desk
  drawIsoBox(ctx, topY, boxH, "#c8c0b0", "#a8a098", "#b8b0a4");
  drawIsoBoxOutline(ctx, topY, boxH, "#888078");

  const cx = HALF;
  // Magnifying glass
  ctx.strokeStyle = "#6a5030";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx - 2, topY - 4, 6, 0, Math.PI * 2);
  ctx.stroke();
  // Handle
  ctx.beginPath();
  ctx.moveTo(cx + 3, topY);
  ctx.lineTo(cx + 10, topY + 6);
  ctx.stroke();
  // Lens glint
  ctx.globalAlpha = 0.3;
  drawCircle(ctx, cx - 4, topY - 6, 2, "#aaddff");
  ctx.globalAlpha = 1.0;

  return canvas;
}

function generateConveyorHub() {
  const canvas = createTile();
  const ctx = canvas.getContext("2d");
  const topY = 28;
  const boxH = 10;

  // Low platform
  drawIsoBox(ctx, topY, boxH, "#5a5a60", "#404048", "#4a4a52");
  drawIsoBoxOutline(ctx, topY, boxH, "#2a2a30");

  const cx = HALF;
  // Arrows pointing in 4 directions
  ctx.strokeStyle = "#aacc44";
  ctx.lineWidth = 1.5;
  const dirs = [[-8, 0], [8, 0], [0, -4], [0, 4]];
  for (const [dx, dy] of dirs) {
    ctx.beginPath();
    ctx.moveTo(cx, topY);
    ctx.lineTo(cx + dx, topY + dy);
    ctx.stroke();
  }
  drawCircle(ctx, cx, topY, 2, "#aacc44");

  return canvas;
}

function generatePipeJunction() {
  const canvas = createTile();
  const ctx = canvas.getContext("2d");
  const topY = 28;
  const boxH = 10;

  drawIsoBox(ctx, topY, boxH, "#506068", "#384850", "#445058");
  drawIsoBoxOutline(ctx, topY, boxH, "#283840");

  const cx = HALF;
  // Cross pipes on top
  ctx.strokeStyle = "#7090a0";
  ctx.lineWidth = 3;
  // Horizontal
  ctx.beginPath();
  ctx.moveTo(cx - 12, topY);
  ctx.lineTo(cx + 12, topY);
  ctx.stroke();
  // Vertical (iso-adjusted)
  ctx.beginPath();
  ctx.moveTo(cx, topY - 6);
  ctx.lineTo(cx, topY + 6);
  ctx.stroke();

  // Center joint
  drawCircle(ctx, cx, topY, 3, "#506878");

  return canvas;
}

// ============================================================
// Floor decoration tiles
// ============================================================

function generatePipeH() {
  const canvas = createTile();
  const ctx = canvas.getContext("2d");
  const cx = HALF;
  const cy = HALF;

  // Pipe running along the iso horizontal (NE-SW axis)
  ctx.strokeStyle = "#607080";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(cx - 28, cy);
  ctx.lineTo(cx + 28, cy);
  ctx.stroke();

  // Highlight
  ctx.strokeStyle = "#8090a0";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - 28, cy - 1);
  ctx.lineTo(cx + 28, cy - 1);
  ctx.stroke();

  return canvas;
}

function generatePipeV() {
  const canvas = createTile();
  const ctx = canvas.getContext("2d");
  const cx = HALF;
  const cy = HALF;

  ctx.strokeStyle = "#607080";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(cx, cy - 14);
  ctx.lineTo(cx, cy + 14);
  ctx.stroke();

  ctx.strokeStyle = "#8090a0";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - 1, cy - 14);
  ctx.lineTo(cx - 1, cy + 14);
  ctx.stroke();

  return canvas;
}

function generatePipeCorner(direction) {
  const canvas = createTile();
  const ctx = canvas.getContext("2d");
  const cx = HALF;
  const cy = HALF;

  ctx.strokeStyle = "#607080";
  ctx.lineWidth = 4;
  ctx.beginPath();

  switch (direction) {
    case "ne":
      ctx.moveTo(cx, cy + 14);
      ctx.quadraticCurveTo(cx, cy, cx + 28, cy);
      break;
    case "nw":
      ctx.moveTo(cx, cy + 14);
      ctx.quadraticCurveTo(cx, cy, cx - 28, cy);
      break;
    case "se":
      ctx.moveTo(cx, cy - 14);
      ctx.quadraticCurveTo(cx, cy, cx + 28, cy);
      break;
    case "sw":
      ctx.moveTo(cx, cy - 14);
      ctx.quadraticCurveTo(cx, cy, cx - 28, cy);
      break;
  }
  ctx.stroke();

  return canvas;
}

function generateConveyorH() {
  const canvas = createTile();
  const ctx = canvas.getContext("2d");
  const cx = HALF;
  const cy = HALF;

  // Belt base
  ctx.fillStyle = "#3a3a40";
  ctx.fillRect(cx - 28, cy - 3, 56, 6);

  // Roller segments
  ctx.strokeStyle = "#606068";
  ctx.lineWidth = 1;
  for (let i = -24; i <= 24; i += 6) {
    ctx.beginPath();
    ctx.moveTo(cx + i, cy - 3);
    ctx.lineTo(cx + i, cy + 3);
    ctx.stroke();
  }

  // Direction arrows
  ctx.strokeStyle = "#88aa44";
  ctx.lineWidth = 1;
  for (let i = -18; i <= 12; i += 12) {
    ctx.beginPath();
    ctx.moveTo(cx + i, cy);
    ctx.lineTo(cx + i + 4, cy - 2);
    ctx.moveTo(cx + i, cy);
    ctx.lineTo(cx + i + 4, cy + 2);
    ctx.stroke();
  }

  return canvas;
}

function generateConveyorV() {
  const canvas = createTile();
  const ctx = canvas.getContext("2d");
  const cx = HALF;
  const cy = HALF;

  ctx.fillStyle = "#3a3a40";
  ctx.fillRect(cx - 3, cy - 14, 6, 28);

  ctx.strokeStyle = "#606068";
  ctx.lineWidth = 1;
  for (let i = -12; i <= 12; i += 6) {
    ctx.beginPath();
    ctx.moveTo(cx - 3, cy + i);
    ctx.lineTo(cx + 3, cy + i);
    ctx.stroke();
  }

  ctx.strokeStyle = "#88aa44";
  ctx.lineWidth = 1;
  for (let i = -8; i <= 4; i += 8) {
    ctx.beginPath();
    ctx.moveTo(cx, cy + i);
    ctx.lineTo(cx - 2, cy + i + 3);
    ctx.moveTo(cx, cy + i);
    ctx.lineTo(cx + 2, cy + i + 3);
    ctx.stroke();
  }

  return canvas;
}

function generateFloorGrated() {
  const canvas = createTile();
  const ctx = canvas.getContext("2d");

  // Diamond-shaped grated floor
  const cx = HALF;
  const topY = HALF;
  const hw = DIAMOND_W / 2;
  const hh = DIAMOND_H / 2;

  // Base
  ctx.fillStyle = "#383840";
  ctx.beginPath();
  ctx.moveTo(cx, topY - hh);
  ctx.lineTo(cx + hw, topY);
  ctx.lineTo(cx, topY + hh);
  ctx.lineTo(cx - hw, topY);
  ctx.closePath();
  ctx.fill();

  // Grate lines
  ctx.strokeStyle = "#484850";
  ctx.lineWidth = 0.5;
  for (let i = -20; i <= 20; i += 4) {
    ctx.beginPath();
    ctx.moveTo(cx + i - 10, topY - 10);
    ctx.lineTo(cx + i + 10, topY + 10);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + i + 10, topY - 10);
    ctx.lineTo(cx + i - 10, topY + 10);
    ctx.stroke();
  }

  return canvas;
}

function generateFloorDirty() {
  const canvas = createTile();
  const ctx = canvas.getContext("2d");

  const cx = HALF;
  const topY = HALF;
  const hw = DIAMOND_W / 2;
  const hh = DIAMOND_H / 2;

  // Base floor
  ctx.fillStyle = "#2e2e36";
  ctx.beginPath();
  ctx.moveTo(cx, topY - hh);
  ctx.lineTo(cx + hw, topY);
  ctx.lineTo(cx, topY + hh);
  ctx.lineTo(cx - hw, topY);
  ctx.closePath();
  ctx.fill();

  // Stains
  ctx.globalAlpha = 0.3;
  drawCircle(ctx, cx - 6, topY + 2, 4, "#5a4a30");
  drawCircle(ctx, cx + 8, topY - 3, 3, "#4a3a28");
  drawCircle(ctx, cx + 2, topY + 5, 2, "#6a5a38");
  ctx.globalAlpha = 1.0;

  return canvas;
}

// ============================================================
// Main — generate all factory tiles
// ============================================================

const tiles = {
  // Burner processing animation frames
  "burner_processing_0.png": () => generateBurnerProcessing(0),
  "burner_processing_1.png": () => generateBurnerProcessing(1),
  "burner_processing_2.png": () => generateBurnerProcessing(2),
  "burner_processing_3.png": () => generateBurnerProcessing(3),

  // Stove processing animation frames
  "stove_processing_0.png": () => generateStoveProcessing(0),
  "stove_processing_1.png": () => generateStoveProcessing(1),
  "stove_processing_2.png": () => generateStoveProcessing(2),
  "stove_processing_3.png": () => generateStoveProcessing(3),

  // Smelter + processing
  "smelter.png": generateSmelter,
  "smelter_processing_0.png": () => generateSmelterProcessing(0),
  "smelter_processing_1.png": () => generateSmelterProcessing(1),
  "smelter_processing_2.png": () => generateSmelterProcessing(2),
  "smelter_processing_3.png": () => generateSmelterProcessing(3),

  // Other factory stations
  "furnace.png": generateFurnace,
  "press.png": generatePress,
  "assembler.png": generateAssembler,
  "packaging_unit.png": generatePackagingUnit,
  "storage_depot.png": generateStorageDepot,
  "cooling_tower.png": generateCoolingTower,
  "chemical_mixer.png": generateChemicalMixer,
  "inspector.png": generateInspector,
  "conveyor_hub.png": generateConveyorHub,
  "pipe_junction.png": generatePipeJunction,

  // Floor decorations
  "pipe_h.png": generatePipeH,
  "pipe_v.png": generatePipeV,
  "pipe_corner_ne.png": () => generatePipeCorner("ne"),
  "pipe_corner_nw.png": () => generatePipeCorner("nw"),
  "pipe_corner_se.png": () => generatePipeCorner("se"),
  "pipe_corner_sw.png": () => generatePipeCorner("sw"),
  "conveyor_h.png": generateConveyorH,
  "conveyor_v.png": generateConveyorV,
  "floor_grated.png": generateFloorGrated,
  "floor_dirty.png": generateFloorDirty,
};

mkdirSync(OUT_DIR, { recursive: true });

for (const [filename, generator] of Object.entries(tiles)) {
  const canvas = generator();
  const buffer = canvas.toBuffer("image/png");
  const path = join(OUT_DIR, filename);
  writeFileSync(path, buffer);
  console.log(`  ✓ ${filename} (${buffer.length} bytes)`);
}

console.log(`\nGenerated ${Object.keys(tiles).length} tiles in ${OUT_DIR}`);
