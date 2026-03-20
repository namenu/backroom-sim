/**
 * Generate isometric tile assets for the steak kitchen recipe.
 *
 * Art style: 64×64 pixel art, 2:1 isometric diamond base with 3D box extrusion.
 * Matches the existing backroom-sim tile aesthetic.
 *
 * Usage: node scripts/generate-tiles.mjs
 */

import { createCanvas } from "canvas";
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "../apps/viewer/public/backroom-assets/tiles");

const SIZE = 64;
const HALF = SIZE / 2;

// Isometric diamond vertices (top face)
// Diamond center at (32, topY), width=60, height=30
const DIAMOND_W = 58;
const DIAMOND_H = 29;

function createTile() {
  return createCanvas(SIZE, SIZE);
}

/**
 * Draw an isometric box (base shape for all tiles).
 * topY = y-center of the top diamond face
 * boxH = height of the box extrusion in pixels
 */
function drawIsoBox(ctx, topY, boxH, topColor, leftColor, rightColor) {
  const cx = HALF;
  const hw = DIAMOND_W / 2;
  const hh = DIAMOND_H / 2;

  // Top face
  ctx.fillStyle = topColor;
  ctx.beginPath();
  ctx.moveTo(cx, topY - hh);       // top
  ctx.lineTo(cx + hw, topY);       // right
  ctx.lineTo(cx, topY + hh);       // bottom
  ctx.lineTo(cx - hw, topY);       // left
  ctx.closePath();
  ctx.fill();

  // Left face
  ctx.fillStyle = leftColor;
  ctx.beginPath();
  ctx.moveTo(cx - hw, topY);        // top-left of diamond
  ctx.lineTo(cx, topY + hh);        // bottom of diamond
  ctx.lineTo(cx, topY + hh + boxH); // bottom of diamond + extrusion
  ctx.lineTo(cx - hw, topY + boxH); // top-left + extrusion
  ctx.closePath();
  ctx.fill();

  // Right face
  ctx.fillStyle = rightColor;
  ctx.beginPath();
  ctx.moveTo(cx + hw, topY);        // top-right of diamond
  ctx.lineTo(cx, topY + hh);        // bottom of diamond
  ctx.lineTo(cx, topY + hh + boxH); // bottom + extrusion
  ctx.lineTo(cx + hw, topY + boxH); // top-right + extrusion
  ctx.closePath();
  ctx.fill();
}

/** Draw thin outline on the box edges */
function drawIsoBoxOutline(ctx, topY, boxH, color, lineWidth = 1) {
  const cx = HALF;
  const hw = DIAMOND_W / 2;
  const hh = DIAMOND_H / 2;

  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;

  // Top face outline
  ctx.beginPath();
  ctx.moveTo(cx, topY - hh);
  ctx.lineTo(cx + hw, topY);
  ctx.lineTo(cx, topY + hh);
  ctx.lineTo(cx - hw, topY);
  ctx.closePath();
  ctx.stroke();

  // Left face outline
  ctx.beginPath();
  ctx.moveTo(cx - hw, topY);
  ctx.lineTo(cx - hw, topY + boxH);
  ctx.lineTo(cx, topY + hh + boxH);
  ctx.lineTo(cx, topY + hh);
  ctx.stroke();

  // Right face outline
  ctx.beginPath();
  ctx.moveTo(cx + hw, topY);
  ctx.lineTo(cx + hw, topY + boxH);
  ctx.lineTo(cx, topY + hh + boxH);
  ctx.stroke();
}

/** Draw a small circle (e.g., knob, plate, bowl) */
function drawCircle(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

/** Draw an isometric ellipse on the top face */
function drawIsoEllipse(ctx, cx, cy, rx, ry, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** Draw horizontal lines on top face (for grill/cutting marks) */
function drawTopLines(ctx, topY, count, color, lineWidth = 1) {
  const cx = HALF;
  const hw = DIAMOND_W / 2;
  const hh = DIAMOND_H / 2;

  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;

  for (let i = 1; i <= count; i++) {
    const t = i / (count + 1);
    const y = topY - hh + t * (DIAMOND_H);
    // Calculate line extent at this y
    const dy = Math.abs(y - topY);
    const ratio = 1 - dy / hh;
    const halfLen = hw * ratio;
    ctx.beginPath();
    ctx.moveTo(cx - halfLen, y);
    ctx.lineTo(cx + halfLen, y);
    ctx.stroke();
  }
}

// ============================================================
// Tile generators
// ============================================================

function generateOrderWindow() {
  const canvas = createTile();
  const ctx = canvas.getContext("2d");
  const topY = 22;
  const boxH = 20;

  // Wood counter with green top
  drawIsoBox(ctx, topY, boxH, "#5a8a50", "#3d5e30", "#4a7040");
  drawIsoBoxOutline(ctx, topY, boxH, "#2a3e20");

  // Order ticket slots (small rectangles on top)
  ctx.fillStyle = "#f5f0e0";
  // Ticket 1
  ctx.fillRect(24, topY - 8, 6, 10);
  // Ticket 2
  ctx.fillRect(34, topY - 10, 6, 12);
  // Ticket 3
  ctx.fillRect(44, topY - 7, 5, 9);

  // Ticket lines
  ctx.strokeStyle = "#888";
  ctx.lineWidth = 0.5;
  for (const tx of [24, 34, 44]) {
    for (let ly = 2; ly < 8; ly += 2) {
      ctx.beginPath();
      ctx.moveTo(tx + 1, topY - 8 + ly + 2);
      ctx.lineTo(tx + 4, topY - 8 + ly + 2);
      ctx.stroke();
    }
  }

  return canvas;
}

function generateCuttingBoard() {
  const canvas = createTile();
  const ctx = canvas.getContext("2d");
  const topY = 24;
  const boxH = 18;

  // Wooden table
  drawIsoBox(ctx, topY, boxH, "#8B7355", "#6B5335", "#7B6345");
  drawIsoBoxOutline(ctx, topY, boxH, "#4a3520");

  // Cutting board on top (lighter wood, slightly smaller diamond)
  ctx.fillStyle = "#C4A872";
  const cx = HALF;
  const bw = 18;
  const bh = 9;
  ctx.beginPath();
  ctx.moveTo(cx, topY - bh);
  ctx.lineTo(cx + bw, topY);
  ctx.lineTo(cx, topY + bh);
  ctx.lineTo(cx - bw, topY);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#A08850";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Wood grain lines on cutting board
  drawTopLines(ctx, topY, 3, "#B09860", 0.5);

  // Knife on the side
  ctx.strokeStyle = "#888";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx + 12, topY - 6);
  ctx.lineTo(cx + 20, topY - 2);
  ctx.stroke();
  // Knife handle
  ctx.strokeStyle = "#5a3a20";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(cx + 20, topY - 2);
  ctx.lineTo(cx + 24, topY);
  ctx.stroke();

  return canvas;
}

function generateBurner() {
  const canvas = createTile();
  const ctx = canvas.getContext("2d");
  const topY = 22;
  const boxH = 22;

  // Stainless steel body
  drawIsoBox(ctx, topY, boxH, "#707880", "#505860", "#606870");
  drawIsoBoxOutline(ctx, topY, boxH, "#383e48");

  // Burner grate (dark circle on top)
  const cx = HALF;
  drawIsoEllipse(ctx, cx, topY, 12, 6, "#2a2e33");

  // Flame ring (orange-red)
  ctx.strokeStyle = "#e85020";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(cx, topY, 9, 4.5, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Inner flame (bright orange)
  ctx.strokeStyle = "#ff8830";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(cx, topY, 5, 2.5, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Pan handle (line extending from burner)
  ctx.strokeStyle = "#444";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx + 14, topY + 2);
  ctx.lineTo(cx + 24, topY + 7);
  ctx.stroke();

  // Knobs on front face
  for (let i = 0; i < 2; i++) {
    drawCircle(ctx, cx - 8 + i * 16, topY + boxH / 2 + DIAMOND_H / 2, 2, "#333");
  }

  return canvas;
}

function generateRestingRack() {
  const canvas = createTile();
  const ctx = canvas.getContext("2d");
  const topY = 26;
  const boxH = 14;

  // Metal rack (silver-grey)
  drawIsoBox(ctx, topY, boxH, "#909aa0", "#707a80", "#808a90");
  drawIsoBoxOutline(ctx, topY, boxH, "#505a60");

  // Wire rack lines on top
  drawTopLines(ctx, topY, 5, "#687078", 1);

  // Steak piece resting (brown ellipse)
  const cx = HALF;
  drawIsoEllipse(ctx, cx - 4, topY - 2, 7, 3.5, "#8B4513");
  // Sear marks
  ctx.strokeStyle = "#5a2a08";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(cx - 8, topY - 2);
  ctx.lineTo(cx, topY - 2);
  ctx.stroke();

  return canvas;
}

function generatePlatingStation() {
  const canvas = createTile();
  const ctx = canvas.getContext("2d");
  const topY = 24;
  const boxH = 18;

  // Clean white/marble counter
  drawIsoBox(ctx, topY, boxH, "#e8e0d0", "#c0b8a8", "#d0c8b8");
  drawIsoBoxOutline(ctx, topY, boxH, "#908880");

  // Plate (white circle)
  const cx = HALF;
  drawIsoEllipse(ctx, cx, topY, 11, 5.5, "#ffffff");
  drawIsoEllipse(ctx, cx, topY, 8, 4, "#f0ebe6");

  // Garnish dots
  drawCircle(ctx, cx - 3, topY - 1, 1.5, "#2ecc71");
  drawCircle(ctx, cx + 4, topY + 1, 1, "#e74c3c");

  // Sauce bottle on the side
  ctx.fillStyle = "#8B0000";
  ctx.fillRect(cx + 14, topY - 10, 3, 8);
  ctx.fillStyle = "#aaa";
  ctx.fillRect(cx + 14, topY - 12, 3, 3);

  return canvas;
}

function generatePass() {
  const canvas = createTile();
  const ctx = canvas.getContext("2d");
  const topY = 22;
  const boxH = 20;

  // Warm-toned serving counter
  drawIsoBox(ctx, topY, boxH, "#c4a050", "#9a7830", "#b09040");
  drawIsoBoxOutline(ctx, topY, boxH, "#705820");

  // Heat lamp (overhead, shown as glow on surface)
  const cx = HALF;
  drawIsoEllipse(ctx, cx, topY, 14, 7, "#d4a840");

  // Warming glow
  ctx.globalAlpha = 0.3;
  drawIsoEllipse(ctx, cx, topY, 10, 5, "#ff8800");
  ctx.globalAlpha = 1.0;

  // Bell icon (service bell)
  drawCircle(ctx, cx + 10, topY - 8, 4, "#c0c0c0");
  drawCircle(ctx, cx + 10, topY - 8, 2, "#e0e0e0");
  // Bell top
  ctx.fillStyle = "#808080";
  ctx.fillRect(cx + 9, topY - 13, 2, 3);

  return canvas;
}

function generateDishReturn() {
  const canvas = createTile();
  const ctx = canvas.getContext("2d");
  const topY = 24;
  const boxH = 18;

  // Dark counter
  drawIsoBox(ctx, topY, boxH, "#6a5a70", "#4a3a50", "#5a4a60");
  drawIsoBoxOutline(ctx, topY, boxH, "#3a2a40");

  // Stacked dirty plates
  const cx = HALF;
  for (let i = 2; i >= 0; i--) {
    const py = topY - 2 - i * 2;
    drawIsoEllipse(ctx, cx, py, 9, 4.5, i === 0 ? "#d8d0c0" : "#ccc5b5");
    ctx.strokeStyle = "#a09888";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.ellipse(cx, py, 9, 4.5, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Smudge marks (dirty)
  ctx.globalAlpha = 0.3;
  drawCircle(ctx, cx - 3, topY - 5, 2, "#8B4513");
  drawCircle(ctx, cx + 4, topY - 3, 1.5, "#6B3513");
  ctx.globalAlpha = 1.0;

  return canvas;
}

// ============================================================
// Main — generate all tiles
// ============================================================

const tiles = {
  "order_window.png": generateOrderWindow,
  "cutting_board.png": generateCuttingBoard,
  "burner.png": generateBurner,
  "resting_rack.png": generateRestingRack,
  "plating_station.png": generatePlatingStation,
  "pass.png": generatePass,
  "dish_return.png": generateDishReturn,
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
