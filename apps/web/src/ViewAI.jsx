import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api.js';
import { Activity, Box, Maximize2, Minimize2, Pause, Play, Square } from 'lucide-react';
import { H, MAX_EDGES, W, anchor2d, buildLayout, edgeDim, edgeMask, edgeWeights, heatCss, kernelWindow, nodeValues, pt2d } from './netLayout.js';

// ─── View AI — 학습 재생 (실데이터) ───────────────────────────────────────────
// TrainRecorder가 남긴 스텝별 가중치(/api/viz/*)를 그대로 그린다. 시뮬레이션 없음.
// 전 노드 표시. 엣지는 MAX_EDGES 이하면 전부, 넘으면 클릭한 노드의 것만.

const Network3D = lazy(() => import('./Network3D.jsx'));  // three.js(~600KB)는 3D를 켤 때만 받는다

const fmt = (v, d = 4) => (v == null || Number.isNaN(+v) ? '—' : (+v).toFixed(d));

// 모델 구조를 한 줄로: 입력 → 각 레이어 → 출력, 그리고 매 스텝 무엇이 갱신되는지
function describe(layout, schema) {
  const parts = layout.cols.map((c) => {
    if (c.flatten) return `펼치기 ${c.count.toLocaleString()}`;
    if (!c.layer) return `입력 ${c.grid ? c.grid.join('×') + (c.anchors === 1 ? ' 흑백' : ` ×${c.anchors}채널`) : c.count}`;
    const l = c.layer;
    if (l.type.startsWith('Conv')) return `${l.name} ${Math.sqrt(l.k) | 0}×${Math.sqrt(l.k) | 0} 필터 ${l.outN}개`;
    return `${l.name} 출력 ${l.outN}`;
  });
  return `${schema.model_class}: ${parts.join(' → ')} — 출력 중 가장 큰 값이 예측입니다.`;
}

// 한 스텝에 실제로 일어나는 일 — 레코더가 남긴 hparams로 문장을 만든다
function describeStep(schema) {
  const h = schema.hparams || {};
  const batch = h.batch_size ? `이미지 ${h.batch_size}장 배치` : '배치 1개';
  const loss = h.loss ? `${h.loss} 손실` : '손실';
  const opt = h.optimizer ? `${h.optimizer}${h.learning_rate ? ` (lr ${h.learning_rate})` : ''}` : '옵티마이저';
  return `한 스텝 = ${batch} 순전파 → ${loss} 계산 → 역전파로 기울기 → ${opt}가 가중치 ${schema.trainable_params.toLocaleString()}개를 한 번에 갱신. 슬라이더의 한 칸이 이 스텝 ${schema.record_every}번입니다.`;
}

function Network2D({ layout, frame, nodeVals, selected, onSelect, fs, density, sweepT }) {
  const ref = useRef(null);
  const [cssW, setCssW] = useState(W);

  // 표시 크기만큼 백킹 스토어를 잡는다 — 고정 960px을 CSS로 늘리면 전체화면에서 흐려진다
  useEffect(() => {
    const parent = ref.current?.parentElement;
    if (!parent) return;
    const ro = new ResizeObserver(() => {
      const pw = parent.clientWidth, ph = parent.clientHeight;
      setCssW(Math.max(200, fs && ph ? Math.min(pw, ph * (W / H)) : pw));
    });
    ro.observe(parent);
    return () => ro.disconnect();
  }, [fs]);

  useEffect(() => {
    const cv = ref.current;
    if (!cv || !layout) return;
    const dpr = window.devicePixelRatio || 1, k = (cssW * dpr) / W;
    cv.width = Math.round(W * k); cv.height = Math.round(H * k);
    const ctx = cv.getContext('2d');
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, W, H);
    const { cols } = layout;
    const win = cols[0].ks && sweepT != null ? kernelWindow(cols[0], sweepT) : null;
    const winPt = win ? [cols[0].x + win.center[0], H / 2 + win.center[1]] : null;

    if (frame) {
      const drawAll = layout.totalEdges <= MAX_EDGES;
      cols.forEach((c, ci) => {
        if (!c.layer) return;
        const src = cols[c.colIn];
        const { w, maxAbs } = edgeWeights(frame, c.layer);
        if (src.ks && !win) {
          // 이미지 → 필터: 커널은 이미지 전체에 한 번에 적용된다. 격자 오른쪽 변 전체에서 노드로 가는 쐐기로 그린다
          const gx = src.x + src.extent[0] / 2 + 4, top = H / 2 - src.extent[1] / 2, bot = H / 2 + src.extent[1] / 2;
          for (let o = 0; o < c.count; o++) {
            const [dx, dy] = pt2d(c, o), v = w[o * c.layer.inN], a = Math.abs(v) / maxAbs;
            ctx.fillStyle = v < 0 ? `rgba(251,113,133,${0.03 + a * 0.09})` : `rgba(74,222,155,${0.03 + a * 0.09})`;
            ctx.beginPath(); ctx.moveTo(gx, top); ctx.lineTo(gx, bot); ctx.lineTo(dx, dy); ctx.closePath(); ctx.fill();
          }
          return;
        }
        const dim = edgeDim(c.layer.inN), mask = edgeMask(w, c.layer, density);
        for (let o = 0; o < c.count; o++) {
          const selHere = selected && selected.col === ci && selected.i === o;
          const selSrc = selected && selected.col === c.colIn;
          if (!drawAll && !selHere && !selSrc) continue;
          const [dx, dy] = pt2d(c, o);
          for (let i = 0; i < c.layer.inN; i++) {
            if (!drawAll && !selHere && selected.i !== i) continue;
            const e = o * c.layer.inN + i;
            if (mask && !mask[e] && !selHere) continue;
            const v = w[e], a = Math.abs(v) / maxAbs;
            if (a < 0.04 && !selHere) continue;
            const [sx, sy] = src.anchorLocal ? (winPt ?? anchor2d(src, i)) : pt2d(src, i);
            const alpha = (selHere ? 1 : dim) * (0.08 + a * 0.6);
            ctx.strokeStyle = v < 0 ? `rgba(251,113,133,${alpha})` : `rgba(74,222,155,${alpha})`;
            ctx.lineWidth = selHere ? 1.2 : 0.5 + a;
            ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(dx, dy); ctx.stroke();
          }
        }
      });
    }

    ctx.font = '500 15px JetBrains Mono, ui-monospace, monospace';
    ctx.textAlign = 'center';
    cols.forEach((c, ci) => {
      const vals = nodeVals?.[ci];
      for (let i = 0; i < c.count; i++) {
        const [x, y] = pt2d(c, i);
        ctx.fillStyle = vals ? heatCss(vals[i]) : (c.flatten ? '#2a2c34' : '#1c1e26');
        ctx.beginPath(); ctx.arc(x, y, c.r, 0, Math.PI * 2); ctx.fill();
        if (c.r >= 4) { ctx.strokeStyle = '#050505'; ctx.lineWidth = 1.5; ctx.stroke(); }  // 선 위에서 노드 윤곽이 분리되게
        if (selected && selected.col === ci && selected.i === i) {
          ctx.strokeStyle = '#f2f0eb'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(x, y, c.r + 3, 0, Math.PI * 2); ctx.stroke();
        }
      }
      if (win && ci === 0) {
        // 커널 창: 덮인 픽셀을 금색으로, 창 테두리를 그린다
        for (const p of win.pix) { const [x, y] = pt2d(c, p); ctx.fillStyle = '#e8b34b'; ctx.beginPath(); ctx.arc(x, y, c.r + 0.6, 0, Math.PI * 2); ctx.fill(); }
        ctx.strokeStyle = '#e8b34b'; ctx.lineWidth = 1.5;
        ctx.strokeRect(winPt[0] - win.size / 2, winPt[1] - win.size / 2, win.size, win.size);
      }
      // 입력 채널 수가 적은 conv 레이어는 노드 옆에 실제 커널(3×3 등)을 미니 히트맵으로
      if (frame && c.layer && c.layer.k > 1 && c.layer.inN === 1 && c.count <= 40) {
        const l = c.layer, ks = Math.sqrt(l.k) | 0, cell = 4;
        for (let o = 0; o < c.count; o++) {
          const [x, y] = pt2d(c, o), base = l.w.offset + o * l.k;
          let mx = 1e-9;
          for (let j = 0; j < l.k; j++) mx = Math.max(mx, Math.abs(frame[base + j]));
          for (let j = 0; j < l.k; j++) {
            const v = frame[base + j] / mx;
            ctx.fillStyle = v < 0 ? `rgba(251,113,133,${Math.abs(v)})` : `rgba(74,222,155,${v})`;
            ctx.fillRect(x + c.r + 6 + (j % ks) * cell, y - (ks * cell) / 2 + Math.floor(j / ks) * cell, cell - 0.5, cell - 0.5);
          }
        }
      }
      ctx.fillStyle = '#a8a49b';
      ctx.fillText(c.label, c.x, H - 10);
    });
  }, [layout, frame, nodeVals, selected, cssW, density, sweepT]);

  const pick = (e) => {
    const rect = ref.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (W / rect.width), y = (e.clientY - rect.top) * (H / rect.height);
    let best = null, bd = Infinity;
    layout.cols.forEach((c, ci) => {
      if (!c.layer && !c.flatten) return;
      for (let i = 0; i < c.count; i++) {
        const [px, py] = pt2d(c, i), d = Math.hypot(px - x, py - y);
        if (d < bd && d <= Math.max(c.r + 3, 6)) { bd = d; best = { col: ci, i }; }
      }
    });
    onSelect(best);
  };

  return (
    <canvas
      ref={ref} onClick={pick} role="img" aria-label="학습 네트워크 — 노드 전체와 가중치 엣지"
      className="block cursor-crosshair mx-auto" style={{ width: cssW, aspectRatio: `${W}/${H}` }}
    />
  );
}

function LossCurve({ rows, idx, onSeek }) {
  const w = 640, h = 200;
  if (!rows.length) return null;
  let max = -Infinity, min = Infinity;
  for (const r of rows) { if (r.loss > max) max = r.loss; if (r.loss < min) min = r.loss; }
  const px = (i) => (i / Math.max(1, rows.length - 1)) * w;
  const py = (v) => h - 8 - ((v - min) / Math.max(1e-9, max - min)) * (h - 16);
  const path = rows.map((r, i) => `${i ? 'L' : 'M'}${px(i)},${py(r.loss)}`).join(' ');
  return (
    <svg
      viewBox={`0 0 ${w} ${h + 24}`} className="mt-5 w-full cursor-pointer" role="img" aria-label="스텝별 학습 손실 곡선 — 클릭하면 그 스텝으로 이동"
      onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); onSeek(Math.round(((e.clientX - r.left) / r.width) * (rows.length - 1))); }}
    >
      {[0.25, 0.5, 0.75].map((t) => (
        <g key={t}>
          <line x1="0" x2={w} y1={h - 8 - t * (h - 16)} y2={h - 8 - t * (h - 16)} stroke="rgba(255,255,255,0.07)" strokeDasharray="4 6" />
          <text x="4" y={h - 8 - t * (h - 16) - 6} fill="#8d897f" fontSize="13" fontFamily="JetBrains Mono">{(min + (max - min) * t).toFixed(2)}</text>
        </g>
      ))}
      <path d={path} fill="none" stroke="#4ade9b" strokeWidth="2" strokeLinejoin="round" />
      <line x1={px(idx)} x2={px(idx)} y1="0" y2={h} stroke="#f2f0eb" strokeOpacity="0.6" strokeDasharray="3 3" />
      <circle cx={px(idx)} cy={py(rows[idx]?.loss ?? min)} r="4" fill="#f2f0eb" />
      <text x={w - 4} y={h + 18} textAnchor="end" fill="#8d897f" fontSize="13" fontFamily="JetBrains Mono">step {rows[rows.length - 1].step}</text>
    </svg>
  );
}

const Seg = ({ value, options, onChange }) => (
  <div className="flex rounded-full bg-white/5 p-0.5 text-[15px]">
    {options.map(([v, label, Icon]) => (
      <button
        key={v} onClick={() => onChange(v)} aria-pressed={value === v}
        className={`px-4 py-2 rounded-full flex items-center gap-2 transition-colors ${value === v ? 'bg-white/12 text-ink' : 'text-mist hover:text-ink'}`}
      >
        {Icon && <Icon className="w-4 h-4" />}{label}
      </button>
    ))}
  </div>
);

export default function ViewAI({ addToast }) {
  const [runs, setRuns] = useState(null);
  const [runId, setRunId] = useState('');
  const [schema, setSchema] = useState(null);
  const [rows, setRows] = useState([]);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [metric, setMetric] = useState('delta');
  const [mode, setMode] = useState('2d');
  const [density, setDensity] = useState('top');
  const [sweepT, setSweepT] = useState(null);  // 커널 훑기 시연 — 버튼으로 한 바퀴만
  const [selected, setSelected] = useState(null);
  const [frames, setFrames] = useState({});
  const [fs, setFs] = useState(false);
  const cache = useRef(new Map());
  const fsRef = useRef(null);

  useEffect(() => {
    api('/api/viz/runs').then((r) => r.json()).then((list) => { setRuns(list); if (list[0]) setRunId(list[0].run_id); }).catch(() => setRuns([]));
    const onFs = () => setFs(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  useEffect(() => {
    if (!runId) return;
    cache.current = new Map();
    Promise.all([
      api(`/api/viz/${runId}/schema`).then((r) => r.json()),
      api(`/api/viz/${runId}/rows`).then((r) => r.json()),
    ]).then(([s, rs]) => { setSchema(s); setRows(rs); setIdx(0); setSelected(null); setFrames({}); });
  }, [runId]);

  const layout = useMemo(() => (schema ? buildLayout(schema) : null), [schema]);
  const frameCount = schema?.frame_count ?? 0;

  useEffect(() => {
    if (!runId || !frameCount) return;
    const want = [idx, idx - 1].filter((k) => k >= 0 && k < frameCount && !cache.current.has(k));
    let live = true;
    Promise.all(want.map((k) => api(`/api/viz/${runId}/frame?index=${k}`).then((r) => r.arrayBuffer()).then((b) => cache.current.set(k, new Float32Array(b)))))
      .then(() => { if (live) setFrames({ cur: cache.current.get(idx), prev: cache.current.get(idx - 1) }); });
    return () => { live = false; };
  }, [runId, idx, frameCount]);

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setIdx((i) => { if (i + 1 >= frameCount) { setPlaying(false); return i; } return i + 1; }), 110);
    return () => clearInterval(t);
  }, [playing, frameCount]);

  useEffect(() => {
    if (sweepT == null || !layout?.cols[0].ks) return;
    const total = kernelWindow(layout.cols[0], 0).total;
    const id = setInterval(() => setSweepT((v) => (v + 3 >= total ? null : v + 3)), 30);
    return () => clearInterval(id);
  }, [sweepT == null, layout]);

  const row = rows[idx];
  const nodeVals = useMemo(() => nodeValues(layout, frames.cur, frames.prev, row, metric), [layout, frames, row, metric]);
  const stepOf = (k) => (k + 1) * (schema?.record_every ?? 1);

  const sel = selected && layout ? layout.cols[selected.col] : null;
  const selInfo = useMemo(() => {
    if (!sel || !frames.cur) return null;
    if (!sel.layer) {
      const per = sel.shape && sel.shape.length === 3 ? sel.shape[1] * sel.shape[2] : 0;
      const where = per ? ` — 직전 conv 채널 ${Math.floor(selected.i / per)}번의 위치 (${Math.floor((selected.i % per) / sel.shape[2])}, ${selected.i % sel.shape[2]})` : '';
      return { title: `${sel.label} · 노드 #${selected.i}`, cells: [['설명', `펼치기(flatten)로 모양만 바꾼 값이라 자체 가중치가 없습니다${where}. 오른쪽 레이어 노드를 누르면 연결 가중치가 보입니다.`]] };
    }
    const l = sel.layer, n = l.inN * l.k, base = l.w.offset + selected.i * n;
    const vals = frames.cur.subarray(base, base + n);
    let sum = 0, mn = Infinity, mx = -Infinity;
    for (const v of vals) { sum += v; if (v < mn) mn = v; if (v > mx) mx = v; }
    const mean = sum / n;
    let sq = 0, dsq = 0;
    const prev = frames.prev ? frames.prev.subarray(base, base + n) : vals;
    for (let i = 0; i < n; i++) { sq += (vals[i] - mean) ** 2; dsq += (vals[i] - prev[i]) ** 2; }
    const bias = l.params.find((p) => p.name.endsWith('.bias') && p.offset != null);
    const { w } = edgeWeights(frames.cur, l);
    const top = Array.from({ length: l.inN }, (_, i) => [i, w[selected.i * l.inN + i]]).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 6);
    return {
      title: `${l.name} 레이어 · ${l.type === 'Linear' ? '출력 뉴런' : '출력 채널(필터)'} #${selected.i}`,
      cells: [
        ['이 노드로 들어오는 가중치', `${n.toLocaleString()}개${l.k > 1 ? ` (입력 채널 ${l.inN} × 커널 ${l.k})` : ''}`],
        ['가중치 평균 / 표준편차', `${fmt(mean)} / ${fmt(Math.sqrt(sq / n))}`],
        ['가중치 최소 / 최대', `${fmt(mn)} / ${fmt(mx)}`],
        ['편향(bias)', bias ? fmt(frames.cur[bias.offset + selected.i]) : '—'],
        ['기울기 크기 — 이 스텝에서 손실이 이 노드에 반응한 정도', fmt(row?.node_grad?.[l.name]?.[selected.i])],
        ['가중치 변화량 — 직전 프레임 대비', fmt(Math.sqrt(dsq), 5)],
      ],
      top,
      topLabel: l.k > 1 ? '가장 강한 입력 채널 (채널 번호 → 커널 크기)' : '가장 강한 연결 (입력 노드 번호 → 가중치)',
    };
  }, [sel, selected, frames, row]);

  const toggleFs = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else fsRef.current?.requestFullscreen().catch(() => addToast?.('브라우저가 전체화면을 허용하지 않았습니다.'));
  };

  const hasData = !!(runs && runs.length && layout);

  return (
    <div className="max-w-6xl mx-auto px-6 pb-24">
      <div className="flex items-end justify-between flex-wrap gap-5">
        <div>
          <h1 className="font-display font-bold tracking-tight text-4xl flex items-center gap-3">
            View AI
            {runs === null ? null : hasData
              ? <span className="px-3 py-1 rounded-full bg-mint/15 text-mint text-[14px] font-mono font-medium">REAL DATA</span>
              : <span className="px-3 py-1 rounded-full bg-white/8 text-mist text-[14px] font-mono font-medium">NO RUNS</span>}
          </h1>
          <p className="mt-3 text-[17px] text-mist leading-relaxed max-w-3xl">
            학습 중 저장된 스텝별 가중치·grad를 노드 전체로 재생합니다 — 슬라이더로 시점을 고르고, 노드를 누르면 그때의 값이 보입니다.
          </p>
        </div>
        {runs?.length > 0 && (
          <select
            value={runId} onChange={(e) => setRunId(e.target.value)} aria-label="학습 실행 선택"
            className="px-5 py-3 rounded-full bg-white/5 text-[15px] text-ink font-mono focus:outline-none focus:bg-white/10"
          >
            {runs.map((r) => <option key={r.run_id} value={r.run_id}>{r.run_id} · {r.model_class} · {r.total_params.toLocaleString()} params</option>)}
          </select>
        )}
      </div>

      {runs && !runs.length && (
        <div className="mt-12">
          <p className="text-xl font-medium">아직 기록된 학습이 없습니다.</p>
          <p className="mt-3 text-[16px] text-mist leading-relaxed">
            Start AI에서 <span className="text-ink">mnist-cnn-lite</span>를 세팅하고 Web IDE에서 학습을 실행하면
            <code className="font-mono text-[15px] text-ink"> var/telemetry/viz/&lt;run_id&gt;/</code>에 스텝별 가중치가 저장되고 여기서 재생됩니다.
          </p>
        </div>
      )}

      {hasData && (
        <>
          <div className="mt-12 grid grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              ['Step', `${stepOf(idx)} / ${stepOf(frameCount - 1)}`, '#f2f0eb'],
              ['Epoch', fmt(row?.epoch, 3), '#f2f0eb'],
              ['Loss', fmt(row?.loss), '#4ade9b'],
              ['Params', schema.total_params.toLocaleString(), '#e8b34b'],
            ].map(([label, value, color]) => (
              <div key={label}>
                <p className="text-[15px] text-mist">{label}</p>
                <p className="mt-1 font-display font-bold text-4xl tabular" style={{ color }}>{value}</p>
              </div>
            ))}
          </div>

          <div className="mt-14">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <p className="text-xl font-medium">Network Weight Flow</p>
                <p className="mt-2 text-[16px] text-mist leading-relaxed">{describe(layout, schema)}</p>
                <p className="mt-1 text-[16px] text-mist leading-relaxed">{describeStep(schema)}</p>
                <p className="mt-1 font-mono text-[15px] text-dim">
                  노드 {layout.cols.reduce((s, c) => s + c.count, 0).toLocaleString()} · 엣지 {layout.totalEdges.toLocaleString()}
                  {layout.totalEdges <= MAX_EDGES ? ' 전부 표시' : ' — 클릭한 노드만'}
                </p>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <Seg value={mode} onChange={setMode} options={[['2d', '2D', Square], ['3d', '3D', Box]]} />
                <Seg value={metric} onChange={setMetric} options={[['grad', 'grad 크기'], ['delta', 'Δ가중치']]} />
                <Seg value={density} onChange={setDensity} options={[['top', '선 상위 8%'], ['all', '선 전부']]} />
                {layout.cols[0].ks > 0 && (
                  <button
                    onClick={() => setSweepT(sweepT == null ? 0 : null)}
                    className={`px-4 py-2 rounded-full text-[15px] transition-colors ${sweepT != null ? 'bg-gold/20 text-gold' : 'bg-white/5 text-mist hover:text-ink'}`}
                  >
                    {sweepT != null ? '커널 훑기 시연 중…' : '커널이 훑는 방식 보기'}
                  </button>
                )}
                <button
                  onClick={toggleFs} aria-label={fs ? '전체화면 종료' : '노드 전체화면'}
                  className="p-2.5 rounded-full bg-white/5 text-mist hover:text-ink hover:bg-white/10 transition-colors"
                >
                  {fs ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div ref={fsRef} className={`mt-6 relative rounded-2xl overflow-hidden bg-void ${fs ? 'flex flex-col' : ''}`}>
              <div className={fs ? 'flex-1 min-h-0 flex items-center justify-center' : ''} style={{ height: fs ? undefined : mode === '3d' ? 560 : undefined }}>
                {mode === '2d'
                  ? <Network2D layout={layout} frame={frames.cur} nodeVals={nodeVals} selected={selected} onSelect={setSelected} fs={fs} density={density} sweepT={sweepT} />
                  : (
                    <div className="w-full h-full" style={{ minHeight: fs ? undefined : 560 }}>
                      <Suspense fallback={<p className="p-6 font-mono text-[15px] text-dim">3D 엔진 로딩…</p>}>
                        <Network3D layout={layout} frame={frames.cur} nodeVals={nodeVals} selected={selected} onSelect={setSelected} density={density} sweepT={sweepT} />
                      </Suspense>
                    </div>
                  )}
              </div>

              {fs && (
                <button onClick={toggleFs} aria-label="전체화면 종료" className="absolute top-4 right-4 p-2.5 rounded-full bg-pit/80 text-mist hover:text-ink">
                  <Minimize2 className="w-5 h-5" />
                </button>
              )}

              {/* 노드 정보 — 재생바 위 가로 블록 */}
              <div className="px-6 py-4 bg-pit font-mono text-[18px] leading-8 min-h-16 flex items-center">
                {!selInfo && <p className="text-dim">노드를 클릭하면 이 스텝의 가중치·grad 값이 여기에 표시됩니다.{mode === '3d' && '  ·  W/S 앞뒤 · A/D 좌우 · Q/E 위아래 · Shift 가속'}</p>}
                {selInfo && (
                  <div className="w-full flex flex-wrap items-start gap-x-10 gap-y-2">
                    <p className="text-ink font-medium text-[20px]">{selInfo.title}</p>
                    {selInfo.cells.map(([k, v]) => (
                      <p key={k} className="tabular"><span className="text-dim">{k} </span><span className="text-ink">{v}</span></p>
                    ))}
                    {selInfo.top && (
                      <p className="tabular flex flex-wrap items-center gap-x-4">
                        <span className="text-dim">{selInfo.topLabel}</span>
                        {selInfo.top.map(([i, v]) => (
                          <span key={i} className={v < 0 ? 'text-ember' : 'text-mint'}>#{i} → {v >= 0 ? '+' : ''}{fmt(v, 3)}</span>
                        ))}
                      </p>
                    )}
                    <button onClick={() => setSelected(null)} className="text-dim hover:text-ink ml-auto">선택 해제</button>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-5 px-6 py-4 bg-pit font-mono text-[17px]">
                <button
                  onClick={() => { if (!playing && idx >= frameCount - 1) setIdx(0); setPlaying((p) => !p); }} aria-label={playing ? '일시정지' : '재생'}
                  className="p-2.5 rounded-full bg-white/5 text-ink hover:bg-white/10"
                >
                  {playing ? <Pause className="w-5 h-5 text-amber-300" /> : <Play className="w-5 h-5 text-mint" />}
                </button>
                <input
                  type="range" min={0} max={Math.max(0, frameCount - 1)} value={idx} aria-label="학습 스텝 슬라이더"
                  onChange={(e) => setIdx(+e.target.value)} className="flex-1 min-w-24 h-2 accent-[#4ade9b]"
                />
                <label className="flex items-center gap-2 text-dim">step
                  <input
                    type="number" min={stepOf(0)} max={stepOf(frameCount - 1)} step={schema.record_every} value={stepOf(idx)}
                    onChange={(e) => setIdx(Math.min(frameCount - 1, Math.max(0, Math.round(+e.target.value / schema.record_every) - 1)))}
                    className="w-28 bg-white/5 rounded-lg px-3 py-1.5 text-ink tabular focus:outline-none focus:bg-white/10"
                  />
                </label>
                <span className="text-dim hidden sm:inline">epoch <span className="text-ink tabular">{fmt(row?.epoch, 3)}</span></span>
                <span className="text-dim">loss <span className="text-mint tabular">{fmt(row?.loss)}</span></span>
              </div>
            </div>

            <p className="mt-4 font-mono text-[15px] text-dim">
              선 <span className="text-mint">양(+)</span>/<span className="text-ember">음(−)</span> · 진하기 = |w| · 노드 <span className="text-cobalt">낮음</span>→<span className="text-gold">높음</span>
              {density === 'top' && ' · 입력 64개 초과 레이어는 노드별 |w| 상위 8%만 (클릭한 노드는 전부)'}
              {layout.cols[0].ks > 0 && ' · 이미지→필터 쐐기 = 커널이 이미지 전체에 한 번에 적용됨'}
              {mode === '3d' && ' · 드래그 회전 · 휠 줌 · 우클릭 이동 · WASD/QE 키 비행'}
            </p>
          </div>

          <div className="mt-14">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <p className="text-xl font-medium flex items-center gap-2.5">
                <Activity className="w-5 h-5 text-mint" />
                Training Loss Curve
              </p>
              <p className="font-mono text-[15px] text-dim">
                {frameCount} frames · {schema.record_every} step 간격 · 레이어 grad {row && Object.entries(row.layer_grad).map(([k, v]) => `${k} ${fmt(v, 3)}`).join(' · ')}
              </p>
            </div>
            <LossCurve rows={rows} idx={idx} onSeek={setIdx} />
          </div>
        </>
      )}
    </div>
  );
}
