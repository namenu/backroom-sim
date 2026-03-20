import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend as RLegend } from "recharts";
import {
  createWorld,
  tickWorld,
  DEFAULT_LAYOUT,
  DEFAULT_CONFIG,
  DEFAULT_WORKFLOW_DEF,
  type World,
  type SimConfig,
  type BackroomLayout,
  type StationType,
} from "backroom-sim";

const TILE_SIZE = 36;

// --- Isometric constants ---
const ISO_TILE_W = 64;
const ISO_TILE_H = 32;

const STATION_TYPES: StationType[] = [
  "order_window", "fridge", "cutting_board", "burner",
  "resting_rack", "plating_station", "pass", "dish_return",
  "sink", "entrance",
];

const STATION_EMOJI: Record<string, string> = {
  order_window: "📋",
  fridge: "❄️",
  cutting_board: "🔪",
  burner: "🔥",
  resting_rack: "🧊",
  plating_station: "🍽️",
  pass: "🛎️",
  dish_return: "🔙",
  sink: "🚰",
  entrance: "🚪",
};

const STATION_COLORS: Record<string, string> = {
  order_window: "#3a5535",
  fridge: "#2e4f7a",
  cutting_board: "#5a4f40",
  burner: "#6b3030",
  resting_rack: "#4a5568",
  plating_station: "#2a6040",
  pass: "#6b5010",
  dish_return: "#5a4a60",
  sink: "#3a5577",
  entrance: "#4a6050",
};

const WORKER_COLORS = ["#44bbee", "#ee7744", "#66dd55", "#dd66cc", "#ddaa33", "#55cccc"];

const TILE_ASSET_BASE = "/backroom-assets/tiles/";
const CHAR_ASSET_BASE = "/backroom-assets/small-chef-cat/";

const STATION_TILE_MAP: Record<string, string> = {
  order_window: "receiving.png",
  fridge: "fridge.png",
  cutting_board: "prep_table.png",
  burner: "stove.png",
  resting_rack: "shelf.png",
  plating_station: "counter.png",
  pass: "counter.png",
  dish_return: "returning.png",
  sink: "sink.png",
  entrance: "entrance.png",
};

const MIN_COLS = 6;
const MAX_COLS = 30;
const MIN_ROWS = 6;
const MAX_ROWS = 20;

type Tool = StationType | "eraser";

// --- Shared helpers ---

function getDirection(dx: number, dy: number): string {
  if (dx > 0 && dy === 0) return "south-east";
  if (dx < 0 && dy === 0) return "north-west";
  if (dx === 0 && dy > 0) return "south-west";
  if (dx === 0 && dy < 0) return "north-east";
  if (dx > 0 && dy > 0) return "south";
  if (dx > 0 && dy < 0) return "east";
  if (dx < 0 && dy > 0) return "west";
  if (dx < 0 && dy < 0) return "north";
  return "south";
}

function useImageCache() {
  const cache = useRef(new Map<string, HTMLImageElement>());
  const load = useCallback((src: string): HTMLImageElement | null => {
    if (cache.current.has(src)) {
      const img = cache.current.get(src)!;
      return img.complete && img.naturalWidth > 0 ? img : null;
    }
    const img = new Image();
    img.src = src;
    cache.current.set(src, img);
    return null;
  }, []);
  return load;
}

interface WorkerVisual {
  visualX: number;
  visualY: number;
  segStartX: number;
  segStartY: number;
  gridX: number;
  gridY: number;
  totalCooldown: number;
  dir: string;
}

const RENDER_SCALE = 1.0;
const SCALED_TILE_W = ISO_TILE_W * RENDER_SCALE;
const SCALED_TILE_H = ISO_TILE_H * RENDER_SCALE;

function gridToIsoScaled(gx: number, gy: number): [number, number] {
  const sx = (gx - gy) * (SCALED_TILE_W / 2);
  const sy = (gx + gy) * (SCALED_TILE_H / 2);
  return [sx, sy];
}

/** Hot-swap layout into a live world without full reset */
function applyLayoutToWorld(world: World, layout: BackroomLayout) {
  world.cols = layout.cols;
  world.rows = layout.rows;
  world.stations = layout.stations.map((d) => ({ type: d.type, x: d.x, y: d.y }));
  world.stationTileSet = new Set(world.stations.map((s) => `${s.x},${s.y}`));
}

// ============================================================
// Main component — editor + simulation in one view
// ============================================================

export function BackroomViewer() {
  const [layout, setLayout] = useState<BackroomLayout>(() => structuredClone(DEFAULT_LAYOUT));
  const [config, setConfig] = useState<SimConfig>({ ...DEFAULT_CONFIG });
  const [speed, setSpeed] = useState(1);
  const [paused, setPaused] = useState(false);
  const worldRef = useRef(createWorld(config, layout));
  const [, setTick] = useState(0);

  // Editor state
  const [tool, setTool] = useState<Tool>("order_window");
  const [showJson, setShowJson] = useState(false);
  const [showEditor, setShowEditor] = useState(false);

  // Worker stats tracking
  const statsRef = useRef(new Map<number, WorkerStatsData>());
  const prevWorkerStates = useRef(new Map<number, string>());

  // Hot-swap layout into live world
  const layoutRef = useRef(layout);
  useEffect(() => {
    layoutRef.current = layout;
    applyLayoutToWorld(worldRef.current, layout);
  }, [layout]);

  const resetWorld = useCallback((newConfig: SimConfig) => {
    setConfig(newConfig);
    worldRef.current = createWorld(newConfig, layoutRef.current);
    statsRef.current.clear();
    prevWorkerStates.current.clear();
    setTick(0);
  }, []);

  // Fixed timestep sim loop
  const TICK_MS = 50;
  useEffect(() => {
    let raf: number;
    let lastTime = performance.now();
    let accumulator = 0;
    const loop = (now: number) => {
      if (!paused) {
        const stepMs = TICK_MS / speed;
        accumulator = Math.min(accumulator + (now - lastTime), stepMs * 10);
        let ticked = false;
        while (accumulator >= stepMs) {
          tickWorld(worldRef.current);
          accumulator -= stepMs;
          ticked = true;
          // Track worker state distribution + work done
          for (const w of worldRef.current.workers) {
            let s = statsRef.current.get(w.id);
            if (!s) { s = { idle: 0, moving: 0, carrying: 0, working: 0, workDone: {} }; statsRef.current.set(w.id, s); }
            if (w.state === "moving" && w.carryingItem !== null) {
              s.carrying++;
            } else {
              s[w.state]++;
            }
            const prev = prevWorkerStates.current.get(w.id);
            if (prev === "working" && w.state !== "working") {
              const logs = worldRef.current.logs;
              for (let li = logs.length - 1; li >= 0; li--) {
                if (logs[li].workerId === w.id && logs[li].message.startsWith("done")) {
                  const m = logs[li].message.match(/done → \w+\[(\w+)\]/);
                  if (m) s.workDone[m[1]] = (s.workDone[m[1]] ?? 0) + 1;
                  break;
                }
              }
            }
            prevWorkerStates.current.set(w.id, w.state);
          }
        }
        if (ticked) setTick((t) => t + 1);
      }
      lastTime = now;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [speed, paused]);

  // --- Layout editing callbacks ---
  const handleCellClick = useCallback(
    (x: number, y: number, currentTool: Tool) => {
      setLayout((prev) => {
        const next = structuredClone(prev);
        const idx = next.stations.findIndex((s) => s.x === x && s.y === y);
        if (currentTool === "eraser") {
          if (idx >= 0) next.stations.splice(idx, 1);
        } else {
          if (idx >= 0) {
            next.stations[idx].type = currentTool;
          } else {
            next.stations.push({ type: currentTool, x, y });
          }
        }
        return next;
      });
    },
    []
  );

  const handleCellRightClick = useCallback((x: number, y: number) => {
    setLayout((prev) => {
      const next = structuredClone(prev);
      const idx = next.stations.findIndex((s) => s.x === x && s.y === y);
      if (idx >= 0) next.stations.splice(idx, 1);
      return next;
    });
  }, []);

  const setGridSize = useCallback((cols: number, rows: number) => {
    setLayout((prev) => {
      const next = structuredClone(prev);
      next.cols = cols;
      next.rows = rows;
      next.stations = next.stations.filter((s) => s.x < cols && s.y < rows);
      return next;
    });
  }, []);

  const world = worldRef.current;

  const stationMap = useMemo(() => {
    const m = new Map<string, StationType>();
    for (const s of layout.stations) m.set(`${s.x},${s.y}`, s.type);
    return m;
  }, [layout]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '6px 12px', borderBottom: '1px solid #252830', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, background: '#12141c' }}>
        <span style={{ fontWeight: 700, fontSize: 13, color: '#e8eaed' }}>Kitchen Simulator</span>
        <span style={{ fontSize: 10, color: '#555a66' }}>Steak restaurant workflow simulation</span>
      </div>

      <div className="backroom-app">
      {/* Left sidebar: controls */}
      <div className="backroom-sidebar">
        <Sidebar
          config={config}
          speed={speed}
          paused={paused}
          layout={layout}
          tool={tool}
          showEditor={showEditor}
          onShowEditorChange={setShowEditor}
          onSpeedChange={setSpeed}
          onPausedChange={setPaused}
          onReset={resetWorld}
          onGridSize={setGridSize}
          onToolChange={setTool}
          onWorkerCountChange={(count) => {
            worldRef.current.config.workerCount = count;
            setConfig({ ...worldRef.current.config });
          }}
          onClearLayout={() => setLayout((prev) => ({ ...prev, stations: [] }))}
          onLoadDefault={() => setLayout(structuredClone(DEFAULT_LAYOUT))}
          onShowJson={() => {
            navigator.clipboard.writeText(JSON.stringify(layout, null, 2)).catch(() => {});
            setShowJson(true);
          }}
        />
      </div>

      {/* Main content area */}
      <div className="backroom-main">
        <div className="backroom-views">
          {showEditor && (
            <EditorGrid
              layout={layout}
              stationMap={stationMap}
              tool={tool}
              onCellClick={handleCellClick}
              onCellRightClick={handleCellRightClick}
            />
          )}
          <IsometricGrid world={world} layout={layout} />
          <StationStatus world={world} />
        </div>

        <HUD world={world} statsRef={statsRef} />
        <div className="backroom-charts-row">
          <EfficiencyChart worldRef={worldRef} statsRef={statsRef} />
          <ThroughputChart worldRef={worldRef} />
          <WorkerStatus world={world} statsRef={statsRef} />
        </div>
        <LogPanel world={world} defaultOpen={false} />
      </div>

      {/* JSON panel (overlay) */}
      {showJson && (
        <JsonPanel
          layout={layout}
          onClose={() => setShowJson(false)}
          onImport={(imported) => { setLayout(imported); setShowJson(false); }}
        />
      )}
    </div>
    </div>
  );
}

// ============================================================
// Sidebar — all controls in left pane
// ============================================================

function Sidebar({
  config, speed, paused, layout, tool,
  showEditor, onShowEditorChange,
  onSpeedChange, onPausedChange, onReset, onGridSize,
  onToolChange, onWorkerCountChange, onClearLayout, onLoadDefault, onShowJson,
}: {
  config: SimConfig;
  speed: number;
  paused: boolean;
  layout: BackroomLayout;
  tool: Tool;
  showEditor: boolean;
  onShowEditorChange: (show: boolean) => void;
  onSpeedChange: (s: number) => void;
  onPausedChange: (p: boolean) => void;
  onReset: (c: SimConfig) => void;
  onGridSize: (cols: number, rows: number) => void;
  onToolChange: (t: Tool) => void;
  onWorkerCountChange: (count: number) => void;
  onClearLayout: () => void;
  onLoadDefault: () => void;
  onShowJson: () => void;
}) {
  const [draft, setDraft] = useState({ ...config });

  return (
    <>
      {/* Simulation */}
      <div className="sidebar-section">
        <span className="sidebar-section-label">Simulation</span>
        <label>
          Speed: {speed}x
          <input type="range" min={1} max={10} value={speed}
            onChange={(e) => onSpeedChange(Number(e.target.value))} />
        </label>
        <div className="sidebar-buttons">
          <button onClick={() => onPausedChange(!paused)}>
            {paused ? "\u25B6 Play" : "\u23F8 Pause"}
          </button>
        </div>
      </div>

      {/* Config */}
      <div className="sidebar-section">
        <span className="sidebar-section-label">Config</span>
        <label>
          Workers: {config.workerCount}
          <input type="range" min={1} max={12} value={config.workerCount}
            onChange={(e) => onWorkerCountChange(Number(e.target.value))} />
        </label>
        <label>
          Orders: {draft.orderSize}
          <input type="range" min={2} max={12} value={draft.orderSize}
            onChange={(e) => setDraft({ ...draft, orderSize: Number(e.target.value) })} />
        </label>
        <label>
          Interval: {draft.orderInterval}
          <input type="range" min={200} max={1200} step={100} value={draft.orderInterval}
            onChange={(e) => setDraft({ ...draft, orderInterval: Number(e.target.value) })} />
        </label>
        <div className="sidebar-buttons">
          <button onClick={() => onReset(draft)}>Reset</button>
        </div>
      </div>

      {/* Floor Editor toggle */}
      <div className="sidebar-section">
        <span className="sidebar-section-label" style={{ cursor: "pointer" }}
          onClick={() => onShowEditorChange(!showEditor)}>
          {showEditor ? "\u25BC" : "\u25B6"} Floor Editor
        </span>
        {showEditor && (
          <>
            <label>
              Cols: {layout.cols}
              <input type="range" min={MIN_COLS} max={MAX_COLS} value={layout.cols}
                onChange={(e) => onGridSize(Number(e.target.value), layout.rows)} />
            </label>
            <label>
              Rows: {layout.rows}
              <input type="range" min={MIN_ROWS} max={MAX_ROWS} value={layout.rows}
                onChange={(e) => onGridSize(layout.cols, Number(e.target.value))} />
            </label>
            <div className="sidebar-buttons">
              <button onClick={onClearLayout}>Clear</button>
              <button onClick={onLoadDefault}>Default</button>
              <button onClick={onShowJson}>JSON</button>
            </div>
            <div className="mapeditor-palette">
              <button
                className={`mapeditor-palette-btn ${tool === "eraser" ? "active" : ""}`}
                onClick={() => onToolChange("eraser")}
                title="Eraser (right-click also erases)"
              >
                <span className="mapeditor-palette-emoji">{"\u2716"}</span>
                <span className="mapeditor-palette-label">eraser</span>
              </button>
              {STATION_TYPES.map((st) => (
                <button
                  key={st}
                  className={`mapeditor-palette-btn ${tool === st ? "active" : ""}`}
                  onClick={() => onToolChange(st)}
                  title={st}
                >
                  <span className="mapeditor-palette-emoji">{STATION_EMOJI[st]}</span>
                  <span className="mapeditor-palette-label">{st}</span>
                </button>
              ))}
            </div>
            <StationSummary layout={layout} />
          </>
        )}
      </div>

    </>
  );
}

// ============================================================
// Editor Grid (click/drag to paint stations)
// ============================================================

function EditorGrid({
  layout,
  stationMap,
  tool,
  onCellClick,
  onCellRightClick,
}: {
  layout: BackroomLayout;
  stationMap: Map<string, StationType>;
  tool: Tool;
  onCellClick: (x: number, y: number, tool: Tool) => void;
  onCellRightClick: (x: number, y: number) => void;
}) {
  const [painting, setPainting] = useState(false);
  const [paintButton, setPaintButton] = useState<number | null>(null);
  const toolRef = useRef(tool);
  toolRef.current = tool;

  const handlePointerDown = useCallback(
    (x: number, y: number, button: number) => {
      setPainting(true);
      setPaintButton(button);
      if (button === 2) {
        onCellRightClick(x, y);
      } else {
        onCellClick(x, y, toolRef.current);
      }
    },
    [onCellClick, onCellRightClick]
  );

  const handlePointerEnter = useCallback(
    (x: number, y: number) => {
      if (!painting) return;
      if (paintButton === 2) {
        onCellRightClick(x, y);
      } else {
        onCellClick(x, y, toolRef.current);
      }
    },
    [painting, paintButton, onCellClick, onCellRightClick]
  );

  useEffect(() => {
    const up = () => { setPainting(false); setPaintButton(null); };
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  }, []);

  const cells = [];
  for (let gy = 0; gy < layout.rows; gy++) {
    for (let gx = 0; gx < layout.cols; gx++) {
      const key = `${gx},${gy}`;
      const st = stationMap.get(key);
      cells.push(
        <div
          key={key}
          className={`mapeditor-cell ${st ? "has-station" : ""}`}
          style={{ background: st ? STATION_COLORS[st] : undefined }}
          onPointerDown={(e) => { e.preventDefault(); handlePointerDown(gx, gy, e.button); }}
          onPointerEnter={() => handlePointerEnter(gx, gy)}
          onContextMenu={(e) => e.preventDefault()}
          title={st ? `${st} (${gx},${gy})` : `empty (${gx},${gy})`}
        >
          {st && <span className="mapeditor-cell-emoji">{STATION_EMOJI[st]}</span>}
        </div>
      );
    }
  }

  return (
    <div
      className="mapeditor-grid"
      style={{
        gridTemplateColumns: `repeat(${layout.cols}, ${TILE_SIZE}px)`,
        gridTemplateRows: `repeat(${layout.rows}, ${TILE_SIZE}px)`,
        cursor: tool === "eraser" ? "crosshair" : "pointer",
      }}
    >
      {cells}
    </div>
  );
}

// ============================================================
// Isometric Grid (canvas-based sim view)
// ============================================================

function IsometricGrid({ world, layout }: { world: World; layout: BackroomLayout }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loadImage = useImageCache();
  const frameCountRef = useRef(0);
  const fpsRef = useRef({ lastTime: 0, frames: 0, value: 0 });
  const visualsRef = useRef(new Map<number, WorkerVisual>());

  useEffect(() => {
    let raf: number;

    const render = (now: number) => {
      frameCountRef.current++;
      const fps = fpsRef.current;
      fps.frames++;
      if (now - fps.lastTime >= 1000) {
        fps.value = fps.frames;
        fps.frames = 0;
        fps.lastTime = now;
      }

      const canvas = canvasRef.current;
      if (!canvas) { raf = requestAnimationFrame(render); return; }
      const ctx = canvas.getContext("2d")!;

      const TOP_PAD = SCALED_TILE_H * 2;
      const totalW = (layout.cols + layout.rows) * (SCALED_TILE_W / 2) + SCALED_TILE_W;
      const totalH = (layout.cols + layout.rows) * (SCALED_TILE_H / 2) + TOP_PAD + SCALED_TILE_H;

      const dpr = window.devicePixelRatio || 1;
      const targetW = Math.round(totalW * dpr);
      const targetH = Math.round(totalH * dpr);
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
        canvas.style.width = `${totalW}px`;
        canvas.style.height = `${totalH}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      ctx.clearRect(0, 0, totalW, totalH);

      const originX = layout.rows * (SCALED_TILE_W / 2);
      const originY = TOP_PAD;

      // Update worker visuals
      const visuals = visualsRef.current;
      for (const w of world.workers) {
        let v = visuals.get(w.id);
        if (!v) {
          v = { visualX: w.x, visualY: w.y, segStartX: w.x, segStartY: w.y, gridX: w.x, gridY: w.y, totalCooldown: 1, dir: "south" };
          visuals.set(w.id, v);
        }
        if (v.gridX !== w.x || v.gridY !== w.y) {
          v.dir = getDirection(w.x - v.gridX, w.y - v.gridY);
          v.segStartX = v.visualX;
          v.segStartY = v.visualY;
          v.gridX = w.x;
          v.gridY = w.y;
          v.totalCooldown = w.moveCooldown || 1;
        }
        if (w.state === "working" && w.workTargetX !== null && w.workTargetY !== null) {
          v.dir = getDirection(w.workTargetX - w.x, w.workTargetY - w.y);
        }
        const progress = w.state === "moving" && v.totalCooldown > 0
          ? Math.min(1, 1 - w.moveCooldown / v.totalCooldown)
          : 1;
        v.visualX = v.segStartX + (v.gridX - v.segStartX) * progress;
        v.visualY = v.segStartY + (v.gridY - v.segStartY) * progress;
      }

      // Pass 1: Floor tiles
      const floorImg = loadImage(TILE_ASSET_BASE + "floor.png");
      for (let gy = 0; gy < layout.rows; gy++) {
        for (let gx = 0; gx < layout.cols; gx++) {
          const [sx, sy] = gridToIsoScaled(gx, gy);
          const screenX = originX + sx;
          const screenY = originY + sy;
          if (floorImg) {
            const dw = floorImg.width * RENDER_SCALE;
            const dh = floorImg.height * RENDER_SCALE;
            ctx.drawImage(floorImg, screenX - dw / 2, screenY - dh + SCALED_TILE_H / 2, dw, dh);
          }
        }
      }

      // Pass 2: Stations + workers, depth-sorted
      type Drawable = { depth: number; draw: () => void };
      const drawables: Drawable[] = [];

      for (const s of world.stations) {
        const depth = s.x + s.y;
        const [sx, sy] = gridToIsoScaled(s.x, s.y);
        const screenX = originX + sx;
        const screenY = originY + sy;
        drawables.push({ depth, draw: () => {
          const tileFile = STATION_TILE_MAP[s.type];
          if (tileFile) {
            const img = loadImage(TILE_ASSET_BASE + tileFile);
            if (img) {
              const dw = img.width * RENDER_SCALE;
              const dh = img.height * RENDER_SCALE;
              ctx.drawImage(img, screenX - dw / 2, screenY - dh + SCALED_TILE_H / 2, dw, dh);
            }
          }
        }});
      }

      for (const worker of world.workers) {
        const v = visuals.get(worker.id)!;
        const depth = v.visualX + v.visualY + 0.5;
        const [sx, sy] = gridToIsoScaled(v.visualX, v.visualY);
        const screenX = originX + sx;
        const screenY = originY + sy;

        drawables.push({ depth, draw: () => {
          const animConfig = worker.state === "moving"
            ? { type: "walking-4-frames", frames: 4 }
            : worker.state === "working"
            ? { type: "working", frames: 6 }
            : { type: "breathing-idle", frames: 4 };
          const frameIdx = Math.floor(frameCountRef.current / 10) % animConfig.frames;
          const framePath = `${CHAR_ASSET_BASE}animations/${animConfig.type}/${v.dir}/frame_00${frameIdx}.png`;
          const charImg = loadImage(framePath);

          if (charImg) {
            const dw = charImg.width * RENDER_SCALE;
            const dh = charImg.height * RENDER_SCALE;
            ctx.drawImage(charImg, screenX - dw / 2, screenY - dh + 2, dw, dh);
          } else {
            ctx.fillStyle = WORKER_COLORS[worker.id % WORKER_COLORS.length];
            ctx.beginPath();
            ctx.arc(screenX, screenY - 4, 3, 0, Math.PI * 2);
            ctx.fill();
          }
        }});
      }

      drawables.sort((a, b) => a.depth - b.depth);
      for (const d of drawables) d.draw();

      // FPS counter
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(2, 2, 48, 16);
      ctx.fillStyle = "#0f0";
      ctx.font = "11px monospace";
      ctx.textAlign = "left";
      ctx.fillText(`${fpsRef.current.value} fps`, 6, 14);

      raf = requestAnimationFrame(render);
    };

    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [world, layout, loadImage]);

  return (
    <canvas
      ref={canvasRef}
      className="backroom-iso-canvas"
    />
  );
}

// ============================================================
// HUD
// ============================================================

function HUD({ world, statsRef }: { world: World; statsRef: RefObject<Map<number, WorkerStatsData>> }) {
  const served = world.items.filter((i) => i.state === "served").length;
  const dirty = world.items.filter((i) => i.state === "dirty").length;
  const clean = world.items.filter((i) => i.state === "clean").length;
  const total = world.items.length;

  // Throughput: completed orders per 100 ticks
  const completed = world.items.filter((i) =>
    i.state === "served" || i.state === "dirty" || i.state === "clean"
  ).length;
  const throughput = world.tick > 0 ? (completed / world.tick * 100).toFixed(1) : "0.0";

  // Avg worker utilization: (working + carrying) / total ticks
  let utilPct = 0;
  const stats = statsRef.current;
  if (stats && stats.size > 0) {
    let totalUtil = 0;
    for (const s of stats.values()) {
      const t = s.idle + s.moving + s.carrying + s.working;
      if (t > 0) totalUtil += (s.working + s.carrying) / t;
    }
    utilPct = Math.round((totalUtil / stats.size) * 100);
  }

  return (
    <div className="backroom-hud">
      <span>tick: {world.tick}</span>
      <span>served: {served}</span>
      <span>dirty: {dirty}</span>
      <span>cleaned: {clean}</span>
      <span>orders: {total}</span>
      <span>throughput: {throughput}/100t</span>
      <span>util: {utilPct}%</span>
    </div>
  );
}

// ============================================================
// Station Status
// ============================================================

function StationStatus({ world }: { world: World }) {
  const stationTypes = new Map<string, { count: number; items: typeof world.items }>();
  for (const s of world.stations) {
    if (!stationTypes.has(s.type)) {
      stationTypes.set(s.type, { count: 0, items: [] });
    }
    stationTypes.get(s.type)!.count++;
  }
  for (const item of world.items) {
    if (item.carriedBy !== null) continue;
    const patch = world.stations.find((s) => s.x === item.x && s.y === item.y);
    if (patch && stationTypes.has(patch.type)) {
      stationTypes.get(patch.type)!.items.push(item);
    }
  }

  return (
    <div className="backroom-station-status">
      {[...stationTypes.entries()].map(([type, { count, items }]) => {
        const stateCounts = new Map<string, number>();
        for (const it of items) {
          stateCounts.set(it.state, (stateCounts.get(it.state) ?? 0) + 1);
        }
        const summary = [...stateCounts.entries()]
          .map(([state, n]) => `${state}:${n}`)
          .join(" ");

        return (
          <div key={type} className="backroom-station-status-row">
            <span className="backroom-station-status-name">
              {STATION_EMOJI[type] ?? ""} {type} ×{count}
            </span>
            <span className="backroom-station-status-items">
              {summary || "—"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// Throughput Chart
// ============================================================

// ============================================================
// Efficiency Chart (throughput + utilization time series)
// ============================================================

const EFF_SAMPLE_INTERVAL = 20;
const EFF_MAX_SAMPLES = 200;

interface EffChartData {
  ticks: number[];
  throughput: number[];  // items per 1000 ticks (normalized)
  utilization: number[]; // avg worker utilization %
}

function EfficiencyChart({ worldRef, statsRef }: {
  worldRef: RefObject<World>;
  statsRef: RefObject<Map<number, WorkerStatsData>>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dataRef = useRef<EffChartData>({ ticks: [], throughput: [], utilization: [] });
  const lastSampleTick = useRef(-EFF_SAMPLE_INTERVAL);
  const prevServed = useRef(0);
  const emaThroughput = useRef(0);

  useEffect(() => {
    let raf: number;
    const draw = () => {
      const world = worldRef.current;
      const data = dataRef.current;
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !world || !container) { raf = requestAnimationFrame(draw); return; }

      const chartW = container.clientWidth;
      if (chartW < 100) { raf = requestAnimationFrame(draw); return; }

      // Reset on world restart
      if (world.tick < lastSampleTick.current) {
        data.ticks = []; data.throughput = []; data.utilization = [];
        lastSampleTick.current = -EFF_SAMPLE_INTERVAL;
        prevServed.current = 0;
        emaThroughput.current = 0;
      }

      if (world.tick - lastSampleTick.current >= EFF_SAMPLE_INTERVAL && world.tick > 0) {
        lastSampleTick.current = world.tick;
        data.ticks.push(world.tick);

        // Throughput: EMA of items per 1000 ticks
        const curCompleted = world.items.filter(i =>
          i.state === "served" || i.state === "dirty" || i.state === "clean"
        ).length;
        const rawRate = (curCompleted - prevServed.current) * (1000 / EFF_SAMPLE_INTERVAL);
        prevServed.current = curCompleted;
        const alpha = 0.15; // smoothing factor
        emaThroughput.current = emaThroughput.current === 0 && rawRate > 0
          ? rawRate
          : emaThroughput.current * (1 - alpha) + rawRate * alpha;
        data.throughput.push(emaThroughput.current);

        // Utilization: avg (working+carrying) / total across all workers
        const stats = statsRef.current;
        let util = 0;
        if (stats && stats.size > 0) {
          let totalUtil = 0;
          for (const s of stats.values()) {
            const t = s.idle + s.moving + s.carrying + s.working;
            if (t > 0) totalUtil += (s.working + s.carrying) / t;
          }
          util = (totalUtil / stats.size) * 100;
        }
        data.utilization.push(util);

        if (data.ticks.length > EFF_MAX_SAMPLES) {
          data.ticks.shift(); data.throughput.shift(); data.utilization.shift();
        }
      }

      // --- Draw ---
      const ctx = canvas.getContext("2d");
      if (!ctx) { raf = requestAnimationFrame(draw); return; }

      const dpr = window.devicePixelRatio || 1;
      const targetW = Math.round(chartW * dpr);
      const targetH = Math.round(CHART_H * dpr);
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
        canvas.style.width = `${chartW}px`;
        canvas.style.height = `${CHART_H}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      ctx.clearRect(0, 0, chartW, CHART_H);
      ctx.fillStyle = "#1a1a2e";
      ctx.fillRect(0, 0, chartW, CHART_H);

      const padR = 32; // extra right padding for utilization axis
      const plotW = chartW - PAD.left - padR;
      const plotH = CHART_H - PAD.top - PAD.bottom;
      const n = data.ticks.length;

      if (n < 2) {
        ctx.fillStyle = "#666"; ctx.font = "12px monospace";
        ctx.fillText("Collecting data...", chartW / 2 - 50, CHART_H / 2);
        raf = requestAnimationFrame(draw); return;
      }

      // Y-axis: left = throughput, right = utilization (0-100%)
      let maxThroughput = 1;
      for (const v of data.throughput) if (v > maxThroughput) maxThroughput = v;
      maxThroughput = Math.ceil(maxThroughput * 1.1);

      // Grid lines
      ctx.strokeStyle = "#333"; ctx.lineWidth = 0.5;
      for (let i = 0; i <= 4; i++) {
        const y = PAD.top + plotH - (i / 4) * plotH;
        ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(PAD.left + plotW, y); ctx.stroke();
        // Left axis: throughput
        ctx.fillStyle = "#888"; ctx.font = "10px monospace"; ctx.textAlign = "right";
        ctx.fillText(String(Math.round((i / 4) * maxThroughput)), PAD.left - 4, y + 3);
        // Right axis: utilization %
        ctx.fillStyle = "#2ecc71"; ctx.textAlign = "left";
        ctx.fillText(`${i * 25}%`, PAD.left + plotW + 4, y + 3);
      }

      // X-axis labels
      ctx.fillStyle = "#888"; ctx.font = "10px monospace"; ctx.textAlign = "center";
      const xLabelEvery = Math.max(1, Math.floor(n / 6));
      for (let i = 0; i < n; i += xLabelEvery) {
        const x = PAD.left + (i / (n - 1)) * plotW;
        ctx.fillText(String(data.ticks[i]), x, CHART_H - 4);
      }

      // Draw throughput line
      ctx.strokeStyle = "#f1c40f"; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const x = PAD.left + (i / (n - 1)) * plotW;
        const y = PAD.top + plotH - (data.throughput[i] / maxThroughput) * plotH;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Draw utilization line (scaled to 0-100%)
      ctx.strokeStyle = "#2ecc71"; ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const x = PAD.left + (i / (n - 1)) * plotW;
        const y = PAD.top + plotH - (data.utilization[i] / 100) * plotH;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [worldRef, statsRef]);

  // Current values for legend
  const data = dataRef.current;
  const lastTP = data.throughput.length > 0 ? data.throughput[data.throughput.length - 1] : 0;
  const lastUtil = data.utilization.length > 0 ? Math.round(data.utilization[data.utilization.length - 1]) : 0;

  return (
    <div className="backroom-throughput-chart-container" ref={containerRef}>
      <canvas ref={canvasRef} className="backroom-throughput-chart" style={{ height: CHART_H }} />
      <div className="backroom-chart-legend">
        <div className="backroom-chart-legend-item">
          <div className="backroom-chart-legend-swatch" style={{ background: "#f1c40f" }} />
          <span className="backroom-chart-legend-label">throughput</span>
          <span className="backroom-chart-legend-value">{Math.round(lastTP)}/1000t</span>
        </div>
        <div className="backroom-chart-legend-item">
          <div className="backroom-chart-legend-swatch" style={{ background: "#2ecc71", opacity: 0.7 }} />
          <span className="backroom-chart-legend-label">utilization</span>
          <span className="backroom-chart-legend-value">{lastUtil}%</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Throughput Chart (item states)
// ============================================================

const CHART_STAGES = [
  { label: "raw",       color: "#e74c3c", filter: (w: World) => w.items.filter(i => i.state === "raw").length },
  { label: "portioned", color: "#e67e22", filter: (w: World) => w.items.filter(i => i.state === "portioned").length },
  { label: "seared",    color: "#f1c40f", filter: (w: World) => w.items.filter(i => i.state === "seared").length },
  { label: "rested",    color: "#2ecc71", filter: (w: World) => w.items.filter(i => i.state === "rested").length },
  { label: "plated",    color: "#3498db", filter: (w: World) => w.items.filter(i => i.state === "plated").length },
  { label: "served",    color: "#9b59b6", filter: (w: World) => w.items.filter(i => i.state === "served").length },
  { label: "dirty",     color: "#e67e22", filter: (w: World) => w.items.filter(i => i.state === "dirty").length },
  { label: "clean",     color: "#1abc9c", filter: (w: World) => w.items.filter(i => i.state === "clean").length },
] as const;

const SAMPLE_INTERVAL = 20;
const MAX_SAMPLES = 200;
const CHART_H = 160;
const PAD = { top: 8, right: 8, bottom: 20, left: 32 };

interface ChartData {
  ticks: number[];
  series: number[][];
}

function ThroughputChart({ worldRef }: { worldRef: RefObject<World> }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dataRef = useRef<ChartData>({
    ticks: [],
    series: CHART_STAGES.map(() => []),
  });
  const lastSampleTick = useRef(-SAMPLE_INTERVAL);
  const [hiddenSeries, setHiddenSeries] = useState<Set<number>>(() => new Set());
  const hiddenRef = useRef(hiddenSeries);
  hiddenRef.current = hiddenSeries;

  const toggleSeries = useCallback((idx: number) => {
    setHiddenSeries((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  useEffect(() => {
    let raf: number;
    const draw = () => {
      const world = worldRef.current;
      const data = dataRef.current;
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !world || !container) { raf = requestAnimationFrame(draw); return; }

      const chartW = container.clientWidth;
      if (chartW < 100) { raf = requestAnimationFrame(draw); return; }

      if (world.tick < lastSampleTick.current) {
        data.ticks = [];
        data.series = CHART_STAGES.map(() => []);
        lastSampleTick.current = -SAMPLE_INTERVAL;
      }

      if (world.tick - lastSampleTick.current >= SAMPLE_INTERVAL && world.tick > 0) {
        lastSampleTick.current = world.tick;
        data.ticks.push(world.tick);
        for (let s = 0; s < CHART_STAGES.length; s++) {
          data.series[s].push(CHART_STAGES[s].filter(world));
        }
        if (data.ticks.length > MAX_SAMPLES) {
          const excess = data.ticks.length - MAX_SAMPLES;
          data.ticks.splice(0, excess);
          for (const s of data.series) s.splice(0, excess);
        }
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) { raf = requestAnimationFrame(draw); return; }

      const dpr = window.devicePixelRatio || 1;
      const targetW = Math.round(chartW * dpr);
      const targetH = Math.round(CHART_H * dpr);
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
        canvas.style.width = `${chartW}px`;
        canvas.style.height = `${CHART_H}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      ctx.clearRect(0, 0, chartW, CHART_H);
      ctx.fillStyle = "#1a1a2e";
      ctx.fillRect(0, 0, chartW, CHART_H);

      const plotW = chartW - PAD.left - PAD.right;
      const plotH = CHART_H - PAD.top - PAD.bottom;

      if (data.ticks.length < 2) {
        ctx.fillStyle = "#666";
        ctx.font = "12px monospace";
        ctx.fillText("Collecting data...", chartW / 2 - 50, CHART_H / 2);
        raf = requestAnimationFrame(draw);
        return;
      }

      const hidden = hiddenRef.current;
      let maxY = 1;
      for (let s = 0; s < data.series.length; s++) {
        if (hidden.has(s)) continue;
        for (const v of data.series[s]) if (v > maxY) maxY = v;
      }
      maxY = Math.ceil(maxY * 1.1);

      ctx.strokeStyle = "#333";
      ctx.lineWidth = 0.5;
      const ySteps = 4;
      for (let i = 0; i <= ySteps; i++) {
        const y = PAD.top + plotH - (i / ySteps) * plotH;
        ctx.beginPath();
        ctx.moveTo(PAD.left, y);
        ctx.lineTo(PAD.left + plotW, y);
        ctx.stroke();
        ctx.fillStyle = "#888";
        ctx.font = "10px monospace";
        ctx.textAlign = "right";
        ctx.fillText(String(Math.round((i / ySteps) * maxY)), PAD.left - 4, y + 3);
      }

      ctx.fillStyle = "#888";
      ctx.font = "10px monospace";
      ctx.textAlign = "center";
      const n = data.ticks.length;
      const xLabelEvery = Math.max(1, Math.floor(n / 6));
      for (let i = 0; i < n; i += xLabelEvery) {
        const x = PAD.left + (i / (n - 1)) * plotW;
        ctx.fillText(String(data.ticks[i]), x, CHART_H - 4);
      }

      for (let s = 0; s < CHART_STAGES.length; s++) {
        if (hidden.has(s)) continue;
        const vals = data.series[s];
        if (vals.length < 2) continue;
        ctx.strokeStyle = CHART_STAGES[s].color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i < vals.length; i++) {
          const x = PAD.left + (i / (n - 1)) * plotW;
          const y = PAD.top + plotH - (vals[i] / maxY) * plotH;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [worldRef]);

  return (
    <div className="backroom-throughput-chart-container" ref={containerRef}>
      <canvas
        ref={canvasRef}
        className="backroom-throughput-chart"
        style={{ height: CHART_H }}
      />
      <div className="backroom-chart-legend">
        {CHART_STAGES.map((stage, idx) => (
          <div
            key={stage.label}
            className={`backroom-chart-legend-item ${hiddenSeries.has(idx) ? "hidden" : ""}`}
            onClick={() => toggleSeries(idx)}
          >
            <div className="backroom-chart-legend-swatch" style={{ background: stage.color }} />
            <span className="backroom-chart-legend-label">{stage.label}</span>
            <span className="backroom-chart-legend-value">{(() => { const s = dataRef.current.series[idx]; return s && s.length > 0 ? s[s.length - 1] : 0; })()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Log Panel
// ============================================================

interface WorkerStatsData { idle: number; moving: number; carrying: number; working: number; workDone: Record<string, number> }

// Vivid colors for work actions, muted for idle/moving
const WORK_COLORS = ["#ff6b6b", "#ffa94d", "#cc5de8", "#20c997", "#339af0"];

const RATIO_SEGMENTS = [
  ...DEFAULT_WORKFLOW_DEF.transitions.map((t, i) => ({
    key: `wk_${t.id}`,
    label: t.id,
    color: WORK_COLORS[i % WORK_COLORS.length],
  })),
  { key: "carrying", label: "carrying", color: "#4a5568" },
  { key: "moving", label: "moving", color: "#3d4050" },
  { key: "idle", label: "idle", color: "#2a2d38" },
];

// Derive work keys from workflow transitions (SSOT)
const WORK_KEYS = DEFAULT_WORKFLOW_DEF.transitions.map((t) => ({
  key: `wk_${t.id}`,
  stateKey: t.toColor,
}));

function WorkerStatus({ world, statsRef }: { world: World; statsRef: RefObject<Map<number, WorkerStatsData>> }) {
  // Only show active workers (not departed)
  const data = world.workers.map((worker) => {
    const id = worker.id;
    const stats = statsRef.current?.get(id);
    const total = stats ? stats.idle + stats.moving + stats.carrying + stats.working : 1;
    let totalDone = 0;
    for (const wk of WORK_KEYS) totalDone += stats?.workDone[wk.stateKey] ?? 0;

    const entry: Record<string, string | number> = {
      name: `W${id}`,
      state: worker.state,
      idle: stats ? Math.round((stats.idle / total) * 100) : 0,
      moving: stats ? Math.round((stats.moving / total) * 100) : 0,
      carrying: stats ? Math.round((stats.carrying / total) * 100) : 0,
    };

    const workPct = stats ? (stats.working / total) * 100 : 0;
    for (const wk of WORK_KEYS) {
      const count = stats?.workDone[wk.stateKey] ?? 0;
      entry[wk.key] = totalDone > 0 ? Math.round((count / totalDone) * workPct) : 0;
    }
    if (totalDone === 0 && workPct > 0) {
      entry[WORK_KEYS[0].key] = Math.round(workPct);
    }

    return entry;
  });

  return (
    <div className="backroom-worker-chart">
      <ResponsiveContainer width="100%" height={CHART_H}>
        <BarChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: -16 }}>
          <XAxis dataKey="name" tick={{ fill: "#888", fontSize: 10 }} />
          <YAxis domain={[0, 100]} tick={{ fill: "#888", fontSize: 10 }} hide />
          <Tooltip
            cursor={false}
            contentStyle={{ background: "#1e2028", border: "1px solid #333", fontSize: 11 }}
            formatter={(value, name) => [`${value}%`, name]}
            labelFormatter={(label) => {
              const w = data.find((d) => d.name === label);
              return w ? `${label} (${w.state})` : String(label);
            }}
          />
          <RLegend wrapperStyle={{ fontSize: 9 }} />
          {RATIO_SEGMENTS.map((seg) => (
            <Bar key={seg.key} dataKey={seg.key} name={seg.label} stackId="ratio" fill={seg.color} isAnimationActive={false} activeBar={false} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function LogPanel({ world, defaultOpen = true }: { world: World; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const refsMap = useRef(new Map<number, HTMLDivElement>());
  const logLen = world.logs.length;

  useEffect(() => {
    if (!open) return;
    for (const el of refsMap.current.values()) {
      el?.scrollTo(0, el.scrollHeight);
    }
  }, [logLen, open]);

  const workerIds = world.workers.map((w) => w.id);
  const logsByWorker = new Map<number, typeof world.logs>();
  for (const id of workerIds) logsByWorker.set(id, []);
  for (const l of world.logs) logsByWorker.get(l.workerId)?.push(l);

  return (
    <div className="backroom-log-panel">
      <div
        className="backroom-log-toggle"
        onClick={() => setOpen(!open)}
        style={{ cursor: "pointer", padding: "4px 8px", color: "#888", fontSize: 11, userSelect: "none" }}
      >
        {open ? "▼" : "▶"} Worker Logs
      </div>
      {open && workerIds.map((id) => {
        const worker = world.workers.find((w) => w.id === id);
        const stateLabel = worker?.state ?? "idle";
        const intentLabel = worker?.intent || "";

        return (
        <div key={id} className="backroom-log-section">
          <div
            className="backroom-log-title"
            style={{ color: WORKER_COLORS[id % WORKER_COLORS.length] }}
          >
            Worker {id} <span className="backroom-log-intent">{stateLabel}{intentLabel ? ` · ${intentLabel}` : ""}</span>
          </div>
          <div
            className="backroom-log-scroll"
            ref={(el) => { if (el) refsMap.current.set(id, el); }}
          >
            {(logsByWorker.get(id) ?? []).map((l, i) => (
              <div key={i} className="backroom-log-line">
                [{l.tick}] {l.message}
              </div>
            ))}
          </div>
        </div>
        );
      })}
    </div>
  );
}

// ============================================================
// Editor sub-components
// ============================================================

function StationSummary({ layout }: { layout: BackroomLayout }) {
  const counts = new Map<StationType, number>();
  for (const s of layout.stations) {
    counts.set(s.type, (counts.get(s.type) ?? 0) + 1);
  }
  return (
    <div className="mapeditor-summary">
      {STATION_TYPES.map((st) => {
        const n = counts.get(st) ?? 0;
        return (
          <span key={st} className={n > 0 ? "mapeditor-summary-has" : ""}>
            {STATION_EMOJI[st]} {n}
          </span>
        );
      })}
      <span className="mapeditor-summary-total">
        total: {layout.stations.length}
      </span>
    </div>
  );
}

function JsonPanel({
  layout,
  onClose,
  onImport,
}: {
  layout: BackroomLayout;
  onClose: () => void;
  onImport: (layout: BackroomLayout) => void;
}) {
  const [text, setText] = useState(JSON.stringify(layout, null, 2));
  const [error, setError] = useState("");

  useEffect(() => {
    setText(JSON.stringify(layout, null, 2));
  }, [layout]);

  const handleImport = useCallback(() => {
    try {
      const parsed = JSON.parse(text);
      if (
        typeof parsed.cols !== "number" ||
        typeof parsed.rows !== "number" ||
        !Array.isArray(parsed.stations)
      ) {
        setError("Invalid layout: must have cols, rows, stations[]");
        return;
      }
      setError("");
      onImport(parsed as BackroomLayout);
    } catch {
      setError("Invalid JSON");
    }
  }, [text, onImport]);

  return (
    <div className="mapeditor-json-panel">
      <div className="mapeditor-json-header">
        <span>Layout JSON</span>
        <button onClick={onClose}>{"\u2715"}</button>
      </div>
      <textarea
        className="mapeditor-json-textarea"
        value={text}
        onChange={(e) => setText(e.target.value)}
        spellCheck={false}
      />
      {error && <div className="mapeditor-json-error">{error}</div>}
      <div className="mapeditor-json-actions">
        <button onClick={handleImport}>Import</button>
        <button onClick={() => { navigator.clipboard.writeText(text).catch(() => {}); }}>
          Copy
        </button>
      </div>
    </div>
  );
}
