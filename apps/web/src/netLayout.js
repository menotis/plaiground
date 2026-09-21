// TrainRecorder schema → 2D/3D 공용 레이아웃 + 프레임(Float32Array) 해석.
// 엣지 총합이 MAX_EDGES 이하면 전부 그리고, 넘으면 선택 노드의 엣지만 그린다.
export const MAX_EDGES = 30000;
export const W = 960, H = 440, PAD = 56;

export function buildLayout(schema) {
  const byName = Object.fromEntries(schema.layers.map((l) => [l.name, l]));
  const seen = new Set();
  const wl = [];
  for (const name of schema.flow) {
    const l = byName[name];
    if (!l || seen.has(name)) continue;
    seen.add(name);
    const w = l.params.find((p) => p.name.endsWith('.weight') && p.shape.length >= 2 && p.offset != null);
    if (w) wl.push({ ...l, w, outN: w.shape[0], inN: w.shape[1], k: w.shape.slice(2).reduce((a, b) => a * b, 1) });
  }
  if (!wl.length) return null;

  // 컬럼: 입력 → (in≠직전 out 이면 flatten 컬럼) → 각 가중치 레이어의 출력 노드
  const cols = [];
  const first = wl[0];
  const inShape = first.in_shape || [first.inN];
  if (inShape.length === 3) cols.push({ label: `input ${inShape.join('×')}`, count: inShape[1] * inShape[2], grid: [inShape[1], inShape[2]], anchors: inShape[0], ks: first.k > 1 ? Math.sqrt(first.k) | 0 : 0 });
  else cols.push({ label: `input ${first.inN}`, count: first.inN });
  wl.forEach((l, i) => {
    const prevOut = i === 0 ? cols[0].anchors ?? cols[0].count : wl[i - 1].outN;
    if (l.inN !== prevOut) cols.push({ label: `${l.name} in ${l.inN}`, count: l.inN, flatten: true, shape: l.in_shape });
    cols.push({ label: `${l.name} · ${l.type} ${l.outN}`, count: l.outN, layer: l, colIn: cols.length - 1, shape: l.out_shape });
  });

  const gap = (W - PAD * 2) / Math.max(1, cols.length - 1);
  cols.forEach((c, ci) => {
    c.x = PAD + ci * gap;
    c.local = new Float32Array(c.count * 2);
    const list = c.count <= 40 && !c.grid;
    const rows = c.grid ? c.grid[0] : list ? c.count : Math.ceil(Math.sqrt(c.count * 2.2));
    const nCols = c.grid ? c.grid[1] : list ? 1 : Math.ceil(c.count / rows);
    c.cell = Math.min((H - PAD * 2) / rows, 26);
    const totalW = c.cell * nCols, totalH = c.cell * rows;
    for (let i = 0; i < c.count; i++) {
      const r = list ? i : Math.floor(i / nCols), q = list ? 0 : i % nCols;
      c.local[i * 2] = (q + 0.5) * c.cell - totalW / 2;
      c.local[i * 2 + 1] = (r + 0.5) * c.cell - totalH / 2;
    }
    c.extent = [totalW, totalH];
    c.r = list ? 7 : Math.max(1.2, c.cell * 0.36);
    // 입력 격자의 오른쪽 가장자리를 채널별로 나눈 괄호 — "픽셀 하나"가 아니라 "이미지 전체 → 필터"로 읽히게
    if (c.anchors) {
      const seg = totalH / c.anchors;
      c.anchorLocal = Array.from({ length: c.anchors }, (_, a) => [totalW / 2 + 14, (a + 0.5) * seg - totalH / 2]);
      c.anchorSpan = seg;
    }
  });

  return { cols, wl, totalEdges: wl.reduce((s, l) => s + l.outN * l.inN, 0) };
}

// 입력 격자 위를 한 칸씩 훑는 커널 창. t = 위치 인덱스(행 우선). 같은 가중치가 모든 위치에 적용된다는 걸 보여주는 용도.
export function kernelWindow(c, t) {
  const [rows, colsN] = c.grid, n = colsN - c.ks + 1, m = rows - c.ks + 1, total = n * m;
  const p = ((t % total) + total) % total, r = Math.floor(p / n), q = p % n;
  const pix = [];
  for (let dr = 0; dr < c.ks; dr++) for (let dq = 0; dq < c.ks; dq++) pix.push((r + dr) * colsN + q + dq);
  const [w, h] = c.extent;
  return { pix, center: [(q + c.ks / 2) * c.cell - w / 2, (r + c.ks / 2) * c.cell - h / 2], size: c.ks * c.cell, total };
}

export const pt2d = (c, i) => [c.x + c.local[i * 2], H / 2 + c.local[i * 2 + 1]];
export const anchor2d = (c, a) => [c.x + c.anchorLocal[a][0], H / 2 + c.anchorLocal[a][1]];
export const pt3d = (c, ci, i, gap) => [c.local[i * 2], -c.local[i * 2 + 1], ci * gap];
export const anchor3d = (c, ci, a, gap) => [c.anchorLocal[a][0], -c.anchorLocal[a][1], ci * gap];

// 한 레이어의 엣지 가중치 (Linear: w[out][in], Conv: 커널 L2 norm) — out-major
export function edgeWeights(frame, l) {
  const base = l.w.offset, out = new Float32Array(l.outN * l.inN);
  let maxAbs = 1e-9;
  for (let o = 0; o < l.outN; o++) for (let i = 0; i < l.inN; i++) {
    const p = base + (o * l.inN + i) * l.k;
    let v = frame[p];
    if (l.k > 1) { let s = 0; for (let j = 0; j < l.k; j++) s += frame[p + j] * frame[p + j]; v = Math.sqrt(s); }
    out[o * l.inN + i] = v;
    if (Math.abs(v) > maxAbs) maxAbs = Math.abs(v);
  }
  return { w: out, maxAbs };
}

export function rowNorms(frame, l) {
  const n = l.inN * l.k, res = new Float32Array(l.outN);
  for (let o = 0; o < l.outN; o++) {
    let s = 0;
    for (let j = 0; j < n; j++) { const v = frame[l.w.offset + o * n + j]; s += v * v; }
    res[o] = Math.sqrt(s);
  }
  return res;
}

// 컬럼별 노드 값(0~1 정규화). metric: 'grad' = 이 스텝 grad norm, 'delta' = 직전 프레임 대비 ‖Δw‖
export function nodeValues(layout, frame, prevFrame, row, metric) {
  if (!layout || !frame) return null;
  return layout.cols.map((c) => {
    if (!c.layer) return null;
    let vals;
    if (metric === 'grad') vals = Float32Array.from(row?.node_grad?.[c.layer.name] ?? new Array(c.count).fill(0));
    else {
      const cur = rowNorms(frame, c.layer), prev = prevFrame ? rowNorms(prevFrame, c.layer) : cur;
      vals = cur.map((v, i) => Math.abs(v - prev[i]));
    }
    let max = 1e-9;
    for (const v of vals) if (v > max) max = v;
    return vals.map((v) => v / max);
  });
}

// 입력이 많은 레이어(fc 1568)는 선이 겹쳐 뭉치므로 밝기를 낮춘다
export const edgeDim = (inN) => Math.min(1, Math.sqrt(96 / inN));

// 그릴 엣지 마스크. density 'top': 입력 64개 초과 레이어는 출력 노드별 |w| 상위 8%(최소 32개)만. 'all': 전부.
export function edgeMask(w, l, density) {
  if (density === 'all' || l.inN <= 64) return null;
  const keep = Math.max(32, Math.round(l.inN * 0.08));
  const mask = new Uint8Array(w.length);
  const idx = new Uint32Array(l.inN);
  for (let o = 0; o < l.outN; o++) {
    const row = w.subarray(o * l.inN, (o + 1) * l.inN);
    for (let i = 0; i < l.inN; i++) idx[i] = i;
    idx.sort((a, b) => Math.abs(row[b]) - Math.abs(row[a]));
    for (let j = 0; j < keep; j++) mask[o * l.inN + idx[j]] = 1;
  }
  return mask;
}

// cobalt(낮음) → gold(높음)
const LO = [91, 120, 255], HI = [232, 179, 75];
export const heatRGB = (t) => LO.map((a, i) => (a + (HI[i] - a) * t) / 255);
export const heatCss = (t) => `rgb(${LO.map((a, i) => Math.round(a + (HI[i] - a) * t)).join(',')})`;
export const POS = [74 / 255, 222 / 255, 155 / 255], NEG = [251 / 255, 113 / 255, 133 / 255]; // mint / ember
