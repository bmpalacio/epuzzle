/**
 * ePuzzle — client-side jigsaw (grid cut, optional snap + guides)
 */

const PIECE_COUNTS = [3, 5, 10, 15, 20, 50, 100, 150, 200];
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_IMAGE_EDGE = 16384;
const MIN_SOURCE_EDGE = 480;
const PROCESS_MAX_EDGE = 2048;
const SNAP_DIST = 36;
const WIN_TOL = 8;

const SURFACES = [
  { id: "table", label: "Wood table", className: "surface-table" },
  { id: "floor", label: "Wood floor", className: "surface-floor" },
  { id: "mat", label: "Puzzle mat", className: "surface-mat" },
];

/** @type {{ rows: number, cols: number }} */
let grid = { rows: 1, cols: 1 };
/** @type {HTMLImageElement | null} */
let sourceFile = null;
let pieceCountChoice = 10;
let snapMode = true;
let surfaceId = "table";
let fullImageDataUrl = "";

let pieces = [];
/** @type {ResizeObserver | null} */
let layoutObserver = null;
let layoutRef = null;
let timerStart = 0;
let timerId = 0;
let won = false;

const $ = (id) => document.getElementById(id);

function closestGrid(n, iw, ih) {
  const target = iw / ih;
  let best = { rows: 1, cols: n };
  let bestScore = Infinity;
  for (let r = 1; r <= n; r++) {
    if (n % r !== 0) continue;
    const c = n / r;
    const score = Math.abs(c / r - target);
    if (score < bestScore) {
      bestScore = score;
      best = { rows: r, cols: c };
    }
  }
  return best;
}

function prepareImage(img) {
  let w = img.naturalWidth;
  let h = img.naturalHeight;
  if (w <= 0 || h <= 0) throw new Error("Invalid image.");
  if (w > MAX_IMAGE_EDGE || h > MAX_IMAGE_EDGE) {
    throw new Error(`Image too large (max edge ${MAX_IMAGE_EDGE}px).`);
  }

  if (Math.min(w, h) < MIN_SOURCE_EDGE) {
    const tx = Math.ceil(MIN_SOURCE_EDGE / w);
    const ty = Math.ceil(MIN_SOURCE_EDGE / h);
    const outW = w * tx;
    const outH = h * ty;
    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unsupported.");
    for (let x = 0; x < outW; x += w) {
      for (let y = 0; y < outH; y += h) {
        ctx.drawImage(img, x, y);
      }
    }
    return downscaleCanvas(canvas, outW, outH);
  }

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unsupported.");
  ctx.drawImage(img, 0, 0);
  return downscaleCanvas(canvas, w, h);
}

function downscaleCanvas(source, w, h) {
  const longest = Math.max(w, h);
  if (longest <= PROCESS_MAX_EDGE) {
    return { canvas: source, width: w, height: h };
  }
  const scale = PROCESS_MAX_EDGE / longest;
  const nw = Math.round(w * scale);
  const nh = Math.round(h * scale);
  const out = document.createElement("canvas");
  out.width = nw;
  out.height = nh;
  const ctx = out.getContext("2d");
  if (!ctx) throw new Error("Canvas unsupported.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, nw, nh);
  return { canvas: out, width: nw, height: nh };
}

function cutPieces(prepared, g) {
  const { canvas, width, height } = prepared;
  const { rows, cols } = g;
  const pw = width / cols;
  const ph = height / rows;
  const list = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const slice = document.createElement("canvas");
      slice.width = Math.ceil(pw);
      slice.height = Math.ceil(ph);
      const sctx = slice.getContext("2d");
      if (!sctx) throw new Error("Canvas unsupported.");
      sctx.drawImage(
        canvas,
        c * pw,
        r * ph,
        pw,
        ph,
        0,
        0,
        slice.width,
        slice.height,
      );
      list.push({
        id: `${r}-${c}`,
        row: r,
        col: c,
        width: slice.width,
        height: slice.height,
        src: slice.toDataURL("image/jpeg", 0.92),
        x: 0,
        y: 0,
        z: 0,
        locked: false,
      });
    }
  }
  return list;
}

function initSetupUI() {
  const pieceRow = $("pieceOptions");
  pieceRow.innerHTML = "";
  PIECE_COUNTS.forEach((n) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip";
    b.textContent = String(n);
    b.dataset.count = String(n);
    b.setAttribute("aria-pressed", n === pieceCountChoice ? "true" : "false");
    if (n === pieceCountChoice) b.classList.add("active");
    b.addEventListener("click", () => {
      pieceCountChoice = n;
      pieceRow.querySelectorAll(".chip").forEach((el) => {
        el.setAttribute("aria-pressed", "false");
        el.classList.remove("active");
      });
      b.setAttribute("aria-pressed", "true");
      b.classList.add("active");
    });
    pieceRow.appendChild(b);
  });

  const surfRow = $("surfaceOptions");
  surfRow.innerHTML = "";
  SURFACES.forEach((s) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip";
    b.textContent = s.label;
    b.dataset.surface = s.id;
    b.setAttribute("aria-pressed", s.id === surfaceId ? "true" : "false");
    if (s.id === surfaceId) b.classList.add("active");
    b.addEventListener("click", () => {
      surfaceId = s.id;
      surfRow.querySelectorAll(".chip").forEach((el) => {
        el.setAttribute("aria-pressed", "false");
        el.classList.remove("active");
      });
      b.setAttribute("aria-pressed", "true");
      b.classList.add("active");
    });
    surfRow.appendChild(b);
  });

  document.querySelectorAll('.chip-row [data-mode]').forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = btn.dataset.mode;
      snapMode = mode === "snap";
      document.querySelectorAll('.chip-row [data-mode]').forEach((el) => {
        el.setAttribute("aria-pressed", el === btn ? "true" : "false");
      });
    });
  });

  $("fileInput").addEventListener("change", (e) => {
    const f = e.target.files?.[0];
    const err = $("fileError");
    err.hidden = true;
    $("fileName").textContent = "";
    sourceFile = null;
    $("startBtn").disabled = true;
    if (!f) return;
    if (f.size > MAX_FILE_BYTES) {
      err.textContent = `File too large (max ${Math.round(MAX_FILE_BYTES / (1024 * 1024))} MB).`;
      err.hidden = false;
      return;
    }
    if (!f.type.startsWith("image/")) {
      err.textContent = "Please choose an image file.";
      err.hidden = false;
      return;
    }
    const img = new Image();
    const url = URL.createObjectURL(f);
    img.onload = () => {
      URL.revokeObjectURL(url);
      sourceFile = img;
      $("fileName").textContent = f.name;
      $("startBtn").disabled = false;
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      err.textContent = "Could not read that image.";
      err.hidden = false;
    };
    img.src = url;
  });

  $("startBtn").addEventListener("click", () => startPuzzle());
}

function measureLayout() {
  const layer = $("piecesLayer");
  const pile = $("pileZone");
  const board = $("boardSurface");
  if (!layer || !pile || !board) return null;
  const lr = layer.getBoundingClientRect();
  const pr = pile.getBoundingClientRect();
  const br = board.getBoundingClientRect();
  const cellW = br.width / grid.cols;
  const cellH = br.height / grid.rows;
  return {
    cellW,
    cellH,
    boardX: br.left - lr.left,
    boardY: br.top - lr.top,
    layerW: lr.width,
    layerH: lr.height,
    pile: {
      left: pr.left - lr.left,
      top: pr.top - lr.top,
      width: pr.width,
      height: pr.height,
    },
  };
}

function targetXY(p, L) {
  return {
    x: L.boardX + p.col * L.cellW,
    y: L.boardY + p.row * L.cellH,
  };
}

function scatter(L) {
  pieces = pieces.map((p, i) => ({
    ...p,
    x: L.pile.left + Math.random() * Math.max(2, L.pile.width - L.cellW),
    y: L.pile.top + Math.random() * Math.max(2, L.pile.height - L.cellH),
    z: i + 1,
    locked: false,
  }));
}

function applySurface() {
  const board = $("boardSurface");
  const s = SURFACES.find((x) => x.id === surfaceId);
  board.className = `board-surface ${s?.className ?? "surface-table"}`;
}

function applyGridOverlay(show) {
  const gridLayer = $("gridLayer");
  if (!gridLayer) return;
  gridLayer.hidden = !show;
  if (!show) return;
  const c = grid.cols;
  const r = grid.rows;
  gridLayer.style.backgroundImage = [
    `repeating-linear-gradient(90deg, rgba(255,255,255,0.2) 0, rgba(255,255,255,0.2) 1px, transparent 1px, transparent calc(100% / ${c}))`,
    `repeating-linear-gradient(180deg, rgba(255,255,255,0.2) 0, rgba(255,255,255,0.2) 1px, transparent 1px, transparent calc(100% / ${r}))`,
  ].join(",");
}

function renderPieces() {
  const layer = $("piecesLayer");
  const L = layoutRef;
  if (!layer || !L) return;
  layer.innerHTML = "";
  pieces.forEach((p) => {
    const el = document.createElement("div");
    el.className = `piece${p.locked ? " locked" : ""}`;
    el.dataset.id = p.id;
    el.style.left = `${p.x}px`;
    el.style.top = `${p.y}px`;
    el.style.width = `${L.cellW}px`;
    el.style.height = `${L.cellH}px`;
    el.style.zIndex = String(p.z);
    const img = document.createElement("img");
    img.src = p.src;
    img.alt = "";
    img.draggable = false;
    el.appendChild(img);
    el.addEventListener("pointerdown", onPointerDown);
    layer.appendChild(el);
  });
}

function syncPieceDOM() {
  const L = layoutRef;
  if (!L) return;
  const layer = $("piecesLayer");
  pieces.forEach((p) => {
    const el = layer.querySelector(`[data-id="${p.id}"]`);
    if (!el) return;
    el.style.left = `${p.x}px`;
    el.style.top = `${p.y}px`;
    el.style.width = `${L.cellW}px`;
    el.style.height = `${L.cellH}px`;
    el.style.zIndex = String(p.z);
    el.classList.toggle("locked", p.locked);
  });
}

let drag = null;

function onPointerDown(e) {
  if (won) return;
  const el = e.currentTarget;
  const id = el.dataset.id;
  const p = pieces.find((x) => x.id === id);
  const L = layoutRef;
  if (!p || p.locked || !L) return;
  e.preventDefault();
  const layer = $("piecesLayer");
  const lr = layer.getBoundingClientRect();
  const ox = e.clientX - lr.left - p.x;
  const oy = e.clientY - lr.top - p.y;
  const nextZ = pieces.reduce((m, x) => Math.max(m, x.z), 0) + 1;
  pieces = pieces.map((x) => (x.id === id ? { ...x, z: nextZ } : x));
  drag = { id, ox, oy, pid: e.pointerId };
  syncPieceDOM();
  $("ghostLayer").hidden = !snapMode;
  updateGhost();

  window.addEventListener("pointermove", onPointerMove, { passive: false });
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerUp);
}

function onPointerMove(e) {
  if (!drag || e.pointerId !== drag.pid) return;
  e.preventDefault();
  const L = layoutRef;
  const layer = $("piecesLayer");
  if (!L || !layer) return;
  const lr = layer.getBoundingClientRect();
  let nx = e.clientX - drag.ox - lr.left;
  let ny = e.clientY - drag.oy - lr.top;
  nx = Math.max(0, Math.min(nx, L.layerW - L.cellW));
  ny = Math.max(0, Math.min(ny, L.layerH - L.cellH));
  pieces = pieces.map((x) =>
    x.id === drag.id ? { ...x, x: nx, y: ny } : x,
  );
  syncPieceDOM();
  updateGhost();
}

function onPointerUp(e) {
  if (!drag || e.pointerId !== drag.pid) return;
  e.preventDefault();
  const id = drag.id;
  drag = null;
  window.removeEventListener("pointermove", onPointerMove);
  window.removeEventListener("pointerup", onPointerUp);
  window.removeEventListener("pointercancel", onPointerUp);

  const L = layoutRef;
  if (!L) return;
  const p = pieces.find((x) => x.id === id);
  if (!p) return;
  const t = targetXY(p, L);
  const cx = p.x + L.cellW / 2;
  const cy = p.y + L.cellH / 2;
  const tcx = t.x + L.cellW / 2;
  const tcy = t.y + L.cellH / 2;
  const dist = Math.hypot(cx - tcx, cy - tcy);

  if (snapMode && dist < SNAP_DIST * 2.2) {
    pieces = pieces.map((x) =>
      x.id === id ? { ...x, x: t.x, y: t.y, locked: true } : x,
    );
  }
  syncPieceDOM();
  $("ghostLayer").hidden = true;
  $("ghostLayer").innerHTML = "";
  checkWin();
}

function updateGhost() {
  if (!snapMode || !drag) return;
  const L = layoutRef;
  const gh = $("ghostLayer");
  if (!L || !gh) return;
  const p = pieces.find((x) => x.id === drag.id);
  if (!p) return;
  gh.innerHTML = "";
  const slot = document.createElement("div");
  slot.className = "ghost-slot";
  const t = targetXY(p, L);
  slot.style.left = `${t.x - L.boardX}px`;
  slot.style.top = `${t.y - L.boardY}px`;
  slot.style.width = `${L.cellW}px`;
  slot.style.height = `${L.cellH}px`;
  gh.appendChild(slot);
}

function checkWin() {
  const L = layoutRef;
  if (!L || won) return;
  const tol = Math.min(WIN_TOL, Math.min(L.cellW, L.cellH) * 0.12);
  const ok = pieces.every((p) => {
    const t = targetXY(p, L);
    return (
      Math.abs(p.x - t.x) <= tol && Math.abs(p.y - t.y) <= tol
    );
  });
  if (ok) {
    won = true;
    window.clearInterval(timerId);
    const sec = Math.floor((performance.now() - timerStart) / 1000);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    $("winTime").textContent = `Time ${m}:${String(s).padStart(2, "0")}`;
    $("winModal").classList.remove("hidden");
  }
}

function fmtClock(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function startTimer() {
  timerStart = performance.now();
  timerId = window.setInterval(() => {
    const sec = Math.floor((performance.now() - timerStart) / 1000);
    $("timer").textContent = fmtClock(sec);
  }, 500);
}

function startPuzzle() {
  if (!sourceFile) return;
  won = false;
  try {
    const prep = prepareImage(sourceFile);
    grid = closestGrid(pieceCountChoice, prep.width, prep.height);
    pieces = cutPieces(prep, grid);
    fullImageDataUrl = prep.canvas.toDataURL("image/jpeg", 0.9);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not prepare image.";
    $("fileError").textContent = msg;
    $("fileError").hidden = false;
    return;
  }

  $("setup").classList.add("hidden");
  $("game").classList.remove("hidden");
  $("game").setAttribute("aria-hidden", "false");

  applySurface();
  applyGridOverlay(snapMode);

  const board = $("boardSurface");
  const natW = pieces[0].width * grid.cols;
  const natH = pieces[0].height * grid.rows;
  board.style.aspectRatio = `${natW} / ${natH}`;
  board.style.width = "100%";
  board.style.maxWidth = `min(96vw, calc((100dvh - 220px) * ${natW / natH}))`;

  let bootTries = 0;
  const boot = () => {
    layoutRef = measureLayout();
    bootTries += 1;
    if ((!layoutRef || layoutRef.layerW < 50) && bootTries < 40) {
      requestAnimationFrame(boot);
      return;
    }
    if (!layoutRef) return;
    scatter(layoutRef);
    renderPieces();
    startTimer();
    $("timer").textContent = "0:00";
  };
  requestAnimationFrame(() => requestAnimationFrame(boot));

  if (layoutObserver) layoutObserver.disconnect();
  layoutObserver = new ResizeObserver(() => {
    layoutRef = measureLayout();
    if (!layoutRef || !pieces.length) return;
    pieces = pieces.map((p) => {
      if (p.locked) {
        const t = targetXY(p, layoutRef);
        return { ...p, x: t.x, y: t.y };
      }
      const nx = Math.min(Math.max(0, p.x), layoutRef.layerW - layoutRef.cellW);
      const ny = Math.min(Math.max(0, p.y), layoutRef.layerH - layoutRef.cellH);
      return { ...p, x: nx, y: ny };
    });
    syncPieceDOM();
  });
  const stage = $("gameMain");
  if (stage) layoutObserver.observe(stage);

  $("refImg").src = fullImageDataUrl;
}

function bindGameChrome() {
  $("backBtn").addEventListener("click", () => {
    window.clearInterval(timerId);
    if (layoutObserver) {
      layoutObserver.disconnect();
      layoutObserver = null;
    }
    $("game").classList.add("hidden");
    $("setup").classList.remove("hidden");
    $("winModal").classList.add("hidden");
    pieces = [];
    layoutRef = null;
    $("piecesLayer").innerHTML = "";
    $("boardSurface").removeAttribute("style");
  });
  $("refBtn").addEventListener("click", () => {
    $("refModal").classList.remove("hidden");
  });
  $("refClose").addEventListener("click", () => {
    $("refModal").classList.add("hidden");
  });
  $("refModal").addEventListener("click", (e) => {
    if (e.target === $("refModal")) $("refModal").classList.add("hidden");
  });
  $("winMenu").addEventListener("click", () => {
    $("winModal").classList.add("hidden");
    $("backBtn").click();
  });
}

initSetupUI();
bindGameChrome();
