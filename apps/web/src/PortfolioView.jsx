import { useCallback, useEffect, useRef, useState } from 'react';
import { api, apiStream, GEMINI_KEY_STORAGE } from './api.js';
import {
  ArrowRight, CheckCircle2, Download, FileText, KeyRound, Loader2, Play, ShieldCheck, XCircle,
} from 'lucide-react';

// ─── Portfolio — 실제 portfolio_demo 파이프라인 실행 + 네이티브 리포트 ────────
// 실행 버튼은 /api/portfolio/run (SSE)로 선택한 학습 실행의 텔레메트리로 생성 파이프라인을 돌리고,
// /api/portfolio/data (스키마 JSON)를 받아 하나의 괘선 시트로 렌더링한다.
// 내보내기: MD는 백엔드가 실제 .md 파일을 내려주고, PDF는 브라우저 인쇄를 쓴다.

function lineTone(line) {
  if (line.includes('✅') || line.includes('[OK]')) return 'text-mint';
  if (line.startsWith('[Step')) return 'text-cobalt';
  if (line.includes('Error') || line.includes('Traceback') || line.includes('실패')) return 'text-ember';
  if (line.startsWith('=')) return 'text-dim';
  return 'text-mist';
}

function diffTone(line) {
  const t = line.trimStart();
  if (t.startsWith('-')) return 'text-ember bg-ember/10';
  if (t.startsWith('+')) return 'text-mint bg-mint/10';
  return 'text-mist';
}

// LLM의 STAR 서술문("상황: … 과제: … 조치: … 결과: …")을 라벨 불릿으로 분해.
// 마커가 없으면 문장 단위 불릿으로 폴백한다.
function starBullets(text) {
  if (!text) return [];
  const matches = [...text.matchAll(/(상황|과제|조치|결과)\s*:\s*([^]*?)(?=(?:상황|과제|조치|결과)\s*:|$)/g)];
  if (matches.length >= 2) {
    return matches.map((m) => ({ label: m[1], body: m[2].trim().replace(/^[,.\s]+|[\s,]+$/g, '') }));
  }
  return text
    .split(/(?<=다\.)\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((body) => ({ label: null, body }));
}

function Bullets({ text, accent = 'text-dim' }) {
  return (
    <ul className="space-y-1.5">
      {starBullets(text).map((b, i) => (
        <li key={i} className="flex items-start gap-2.5 text-[14px] leading-relaxed">
          {b.label
            ? <span className={`font-mono text-[11px] mt-0.5 w-7 shrink-0 ${accent}`}>{b.label}</span>
            : <span className={`mt-2 w-1 h-1 rounded-full bg-current shrink-0 ${accent}`} />}
          <span className="text-mist">{b.body}</span>
        </li>
      ))}
    </ul>
  );
}

// 문서형 섹션 헤딩 — 모노 소형 라벨이 곧 제목
function SecHead({ children }) {
  return <h3 className="font-mono text-[11px] tracking-[0.15em] uppercase text-dim">{children}</h3>;
}

// ─── 네이티브 포트폴리오 리포트 — 하나의 괘선 시트 ────────────────────────────
function Report({ data, telemetry }) {
  const { overview, data_engineering: de, benchmarks: bm, troubleshooting: ts, verification: vf } = data;
  const ds = telemetry?.dataset || {};
  const hp = telemetry?.benchmarks?.hyperparameters || {};
  const issuedAt = vf.generated_at ? vf.generated_at.slice(0, 19).replace('T', ' ') + ' UTC' : '';

  return (
    <article className="mt-6 border border-line rounded-lg divide-y divide-line">
      {/* 1. 무엇을 — 제목·메타·서명 */}
      <header className="p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-8">
        <div className="min-w-0">
          <h2 className="font-display font-bold tracking-tight text-2xl leading-snug">{overview.title}</h2>
          <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-5 gap-y-1.5 text-[14px]">
            {[
              ['기반 모델', overview.base_model],
              ['태스크', overview.task_type],
              ['하드웨어', vf.hardware],
              ['검증 엔진', 'plAI-ground / DiffStack v1.0'],
              ...(vf.total_training_time && vf.total_training_time.toUpperCase() !== 'N/A'
                ? [['총 학습 시간', vf.total_training_time]] : []),
            ].map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-dim">{k}</dt>
                <dd className="font-mono text-mist">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="lg:border-l lg:border-line lg:pl-8">
          <p className="flex items-center gap-2 text-[13px] font-medium text-gold">
            <ShieldCheck className="w-4 h-4" /> SHA-256 무결성 서명
          </p>
          <p className="mt-2 font-mono text-[11px] leading-5 text-gold/90 break-all">{vf.integrity_hash}</p>
          {issuedAt && <p className="mt-2 font-mono text-[11px] text-dim">발급 {issuedAt}</p>}
          <p className="mt-1.5 flex items-center gap-1.5 font-mono text-[11px] text-mint">
            <CheckCircle2 className="w-3 h-3" /> 데이터 무결성 검증 완료
          </p>
        </div>
      </header>

      {/* 2. 얼마나 — 성능 델타 */}
      <section className="p-6 sm:p-8">
        <SecHead>성능 벤치마크 — {bm.evaluation_metric}</SecHead>
        <div className="mt-4 flex items-end gap-5 flex-wrap">
          <div>
            <p className="text-[11px] text-dim">Baseline</p>
            <p className="font-display font-bold text-4xl tabular text-mist mt-1">{bm.baseline_performance}</p>
          </div>
          <ArrowRight className="w-6 h-6 text-dim mb-2" aria-hidden="true" />
          <div>
            <p className="text-[11px] text-dim">Fine-tuned</p>
            <p className="font-display font-bold text-4xl tabular text-mint mt-1">{bm.optimized_performance}</p>
          </div>
          <span className="mb-2 font-mono text-[15px] font-medium text-mint">{bm.improvement_rate}</span>
        </div>
        {bm.baseline_performance <= 1 && bm.optimized_performance <= 1 && (
          <>
            <div className="mt-5 h-1.5 rounded-full bg-white/8 overflow-hidden" aria-hidden="true">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cobalt/70 to-mint transition-all duration-700"
                style={{ width: `${Math.min(100, Math.max(4, bm.optimized_performance * 100))}%` }}
              />
            </div>
            <div className="mt-1.5 flex justify-between font-mono text-[11px] text-dim" aria-hidden="true">
              <span>0.0</span>
              <span>1.0</span>
            </div>
          </>
        )}
      </section>

      {/* 3. 어떻게 — 전처리 | 학습 방법 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-line">
        <section className="p-6 sm:p-8">
          <SecHead>데이터 전처리</SecHead>
          {ds.raw_len != null && (
            <p className="mt-4 font-mono text-[14px] text-mist">
              {ds.raw_len.toLocaleString()} <span className="text-dim">→</span>{' '}
              <span className="text-cobalt font-medium">{ds.processed_len?.toLocaleString()}</span> 샘플
              {ds.reduction_rate_pct != null && <span className="text-dim"> · {ds.reduction_rate_pct}% 정제</span>}
            </p>
          )}
          <ul className="mt-4 space-y-1.5">
            {de.preprocessing_techniques.map((t) => (
              <li key={t} className="flex items-start gap-2.5 text-[14px] text-mist leading-relaxed">
                <span className="mt-2 w-1 h-1 rounded-full bg-cobalt shrink-0" />
                {t}
              </li>
            ))}
          </ul>
          <div className="mt-5 pt-4 border-t border-line">
            <Bullets text={de.data_efficiency_impact} accent="text-cobalt" />
          </div>
        </section>

        <section className="p-6 sm:p-8">
          <SecHead>학습 방법 · 성능 향상</SecHead>
          {Object.keys(hp).length > 0 && (
            <p className="mt-4 font-mono text-[13px] text-mist leading-6">
              {Object.entries(hp).map(([k, v]) => `${k}=${v}`).join(' · ')}
            </p>
          )}
          <ul className="mt-4 space-y-1.5">
            {bm.optimization_methods.map((m) => (
              <li key={m} className="flex items-start gap-2.5 text-[14px] text-mist leading-relaxed">
                <span className="mt-2 w-1 h-1 rounded-full bg-gold shrink-0" />
                {m}
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* 4. 무엇을 극복 — 에러·문제 해결 */}
      <section className="p-6 sm:p-8">
        <SecHead>에러 · 문제 해결</SecHead>
        {ts.errors?.length ? (
          /* 에러 하나 = 원인 하나 = 해결 하나 — 발생 순서대로 */
          <div className="mt-4 divide-y divide-line border-y border-line">
            {ts.errors.map((e, i) => (
              <div key={i} className="py-5">
                {/* 에러명은 전체 폭 — 두 줄로 꺾여도 아래 원인/해결 라벨이 나란히 정렬된다 */}
                <p className="font-mono text-[14px] text-ember">
                  <span className="text-dim">#{i + 1}</span> {e.error_type}
                </p>
                <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-x-10 gap-y-3">
                  <div>
                    <p className="text-[13px] text-dim mb-1.5">원인</p>
                    <Bullets text={e.cause} accent="text-ember" />
                  </div>
                  <div>
                    <p className="text-[13px] text-dim mb-1.5">해결</p>
                    <Bullets text={e.fix} accent="text-mint" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            <p className="mt-4 font-mono text-[14px] text-ember">{ts.error_type}</p>
            <p className="mt-4 text-[13px] text-dim mb-2">원인</p>
            <Bullets text={ts.root_cause} accent="text-ember" />
          </>
        )}
        <div className="mt-6">
          <p className="text-[13px] text-dim mb-2">
            해결 Code Diff
            {telemetry?.script_diff && <span className="ml-2 font-mono text-[11px] text-mint">실제 수정 이력 (실패 시점 → 성공 시점)</span>}
          </p>
          <div className="rounded-md bg-pit border border-line p-4 font-mono text-[13px] leading-6 overflow-x-auto">
            {(telemetry?.script_diff || ts.resolution_diff).split('\n').map((line, i) => (
              <p key={i} className={`px-2 rounded whitespace-pre-wrap ${diffTone(line)}`}>{line}</p>
            ))}
          </div>
        </div>
        <div className="mt-6 pt-5 border-t border-line">
          <p className="text-[13px] font-medium text-gold mb-2">Engineering Takeaway</p>
          <Bullets text={ts.engineering_takeaway} accent="text-gold" />
        </div>
      </section>
    </article>
  );
}

export default function PortfolioView({ addToast }) {
  const [telemetry, setTelemetry] = useState(null);
  const [report, setReport] = useState(null); // /api/portfolio/data — 스키마 JSON
  const [runs, setRuns] = useState([]);      // /api/portfolio/runs — 학습 실행 이력 (최신순)
  const [runId, setRunId] = useState('');    // 선택된 실행 ('' = 최신 raw_telemetry)
  const [phase, setPhase] = useState('idle'); // idle | running | done | error
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState('');
  const logRef = useRef(null);
  const sourceRef = useRef(null);

  // Gemini BYOK — api.js가 sessionStorage에서 읽어 /api/portfolio/run에만 붙인다
  const [geminiKey, setGeminiKey] = useState(() => {
    const saved = sessionStorage.getItem(GEMINI_KEY_STORAGE) ?? localStorage.getItem(GEMINI_KEY_STORAGE) ?? '';
    if (saved) sessionStorage.setItem(GEMINI_KEY_STORAGE, saved);
    return saved;
  });
  const [rememberKey, setRememberKey] = useState(() => !!localStorage.getItem(GEMINI_KEY_STORAGE));

  const changeGeminiKey = (value) => {
    setGeminiKey(value);
    if (value) sessionStorage.setItem(GEMINI_KEY_STORAGE, value);
    else sessionStorage.removeItem(GEMINI_KEY_STORAGE);
    if (rememberKey) {
      if (value) localStorage.setItem(GEMINI_KEY_STORAGE, value);
      else localStorage.removeItem(GEMINI_KEY_STORAGE);
    }
  };

  const toggleRememberKey = (checked) => {
    setRememberKey(checked);
    if (checked && geminiKey) localStorage.setItem(GEMINI_KEY_STORAGE, geminiKey);
    if (!checked) localStorage.removeItem(GEMINI_KEY_STORAGE);
  };

  // 선택된 실행의 텔레메트리 요약 + 생성된 리포트
  const loadRun = useCallback((rid) => {
    const q = rid ? `?run=${encodeURIComponent(rid)}` : '';
    api(`/api/portfolio/telemetry${q}`)
      .then((r) => r.json())
      .then(setTelemetry)
      .catch(() => setError('API 서버에 연결할 수 없습니다. `python -m plaiground_host.api_server`를 실행하세요.'));
    api(`/api/portfolio/data${q}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setReport)
      .catch(() => {});
  }, []);

  // 실행 이력 목록 → 가장 최근 실행을 기본 선택
  const loadRuns = useCallback((prefer) => {
    api('/api/portfolio/runs')
      .then((r) => r.json())
      .then((list) => {
        setRuns(list);
        const pick = prefer && list.some((r) => r.run_id === prefer) ? prefer : (list[0]?.run_id ?? '');
        setRunId(pick);
        loadRun(pick);
      })
      .catch(() => loadRun(''));
  }, [loadRun]);

  useEffect(() => { loadRuns(); }, [loadRuns]);
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);
  useEffect(() => () => sourceRef.current?.close(), []);

  const run = useCallback((mode = '') => {
    setLogs([]);
    setError('');
    setPhase('running');

    const params = new URLSearchParams();
    if (mode) params.set('mode', mode);
    if (runId && mode !== 'demo') params.set('run', runId);
    const source = apiStream(`/api/portfolio/run${params.toString() ? `?${params}` : ''}`, (event, data) => {
      if (event === 'log') {
        setLogs((prev) => [...prev, JSON.parse(data)]);
      } else if (event === 'ready') {
        source.close();
        const payload = JSON.parse(data);
        setPhase('done');
        loadRuns(payload.run_id || runId);
        addToast?.('포트폴리오 생성 완료 — 아래에서 결과를 확인하세요.');
      } else if (event === 'error') {
        source.close();
        setError(data ? JSON.parse(data) : '스트림이 끊겼습니다. 서버 로그를 확인하세요.');
        setPhase('error');
      }
    });
    sourceRef.current = source;
  }, [addToast, runId, loadRuns]);

  const running = phase === 'running';
  const runQuery = runId ? `?run=${encodeURIComponent(runId)}` : '';

  return (
    <div className="max-w-6xl mx-auto px-6 pb-24">
      <div className="flex items-start justify-between flex-wrap gap-4 print:hidden">
        <div>
          <h1 className="font-display font-bold tracking-[-0.025em] text-4xl flex items-center gap-3">
            Portfolio
            <span className="font-mono text-[11px] font-medium text-gold flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" /> VERIFIED LEDGER
            </span>
          </h1>
          <p className="mt-3 text-[15px] text-mist leading-relaxed max-w-2xl">
            수집된 텔레메트리(에러 이력·성능 지표·Code Diff)를 LLM 서사와 SHA-256 서명이
            포함된 검증형 포트폴리오로 만듭니다. 버튼을 누르면 실제 파이프라인이 실행됩니다.
          </p>
          {telemetry && (
            <p className="mt-2 font-mono text-[13px] text-dim">
              {telemetry.exists
                ? <>생성 소스 · <span className="text-mist">{telemetry.overview?.project_name || '이름 없는 학습'}</span>{telemetry.run_id && <span className="text-gold"> · {telemetry.run_id}</span>}{telemetry.saved_at && ` · 저장 ${telemetry.saved_at.slice(0, 16).replace('T', ' ')}`}</>
                : '생성 소스 · 아직 학습 텔레메트리가 없습니다 — Web IDE에서 학습을 먼저 실행하세요'}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {report && (
            <>
              <a
                href={`/api/portfolio/export.md${runQuery}`}
                download
                className="px-3.5 py-2 rounded-md border border-line text-[13px] text-mist hover:text-ink hover:border-white/25 transition-colors flex items-center gap-1.5"
              >
                <FileText className="w-3.5 h-3.5" /> MD 내보내기
              </a>
              <button
                onClick={() => window.print()}
                className="px-3.5 py-2 rounded-md border border-line text-[13px] text-mist hover:text-ink hover:border-white/25 transition-colors flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" /> PDF로 저장
              </button>
            </>
          )}
          <button
            onClick={() => run()}
            disabled={running || (telemetry && !telemetry.exists)}
            className="px-4 py-2 rounded-md bg-ink text-void text-[14px] font-semibold hover:bg-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {running
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> 파이프라인 실행 중…</>
              : <><Play className="w-3.5 h-3.5" /> 포트폴리오 생성 실행</>}
          </button>
        </div>
      </div>

      {/* Gemini BYOK 키 입력 */}
      <div className="mt-6 rounded-md border border-line bg-pit/60 p-4 print:hidden">
        <div className="flex items-center gap-2.5 flex-wrap">
          <KeyRound className="w-4 h-4 text-gold shrink-0" />
          <input
            type="password"
            value={geminiKey}
            onChange={(e) => changeGeminiKey(e.target.value)}
            placeholder="Gemini API 키 (AI Studio)"
            autoComplete="off"
            aria-label="Gemini API 키"
            className="flex-1 min-w-55 bg-transparent border border-line rounded-md px-3 py-1.5 text-[13px] font-mono placeholder:text-dim focus:outline-none focus:border-white/30"
          />
          <label className="flex items-center gap-1.5 text-[12px] text-mist cursor-pointer select-none">
            <input
              type="checkbox"
              checked={rememberKey}
              onChange={(e) => toggleRememberKey(e.target.checked)}
            />
            이 브라우저에 기억
          </label>
        </div>
        <p className="mt-2 text-[12px] text-dim leading-relaxed">
          키는 이 브라우저 탭에만 저장되고 서버에 남지 않습니다. 무료 키를 쓰면 입력 데이터가
          Google의 모델 개선에 쓰일 수 있습니다.{' '}
          <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="text-cobalt hover:underline">
            키 발급 →
          </a>
        </p>
      </div>

      {/* 학습 실행 이력 — 모델별로 따로 보관된 텔레메트리 중 하나를 고른다 */}
      {runs.length > 0 && (
        <div className="mt-8 print:hidden">
          <div className="flex items-end justify-between border-b border-line pb-3">
            <SecHead>학습 실행 이력</SecHead>
            <span className="font-mono text-[13px] text-dim tabular">{runs.length}개 실행</span>
          </div>
          <div className="divide-y divide-line" role="radiogroup" aria-label="학습 실행 선택">
            {runs.map((r) => (
              <div
                key={r.run_id}
                role="radio"
                aria-checked={runId === r.run_id}
                tabIndex={0}
                onClick={() => { setRunId(r.run_id); loadRun(r.run_id); }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setRunId(r.run_id); loadRun(r.run_id); } }}
                className={`px-4 py-3.5 cursor-pointer grid grid-cols-1 md:grid-cols-[1fr_auto] gap-x-6 gap-y-1 transition-colors ${
                  runId === r.run_id ? 'bg-white/5' : 'hover:bg-white/[0.025]'
                }`}
              >
                <div className="min-w-0">
                  <p className="font-display font-bold text-[15px] truncate flex items-center gap-2">
                    {r.project_name || r.run_id}
                    {runId === r.run_id && <CheckCircle2 className="w-4 h-4 text-gold shrink-0" />}
                  </p>
                  <p className="mt-0.5 font-mono text-[13px] text-dim truncate">{r.run_id}{r.base_model && ` · ${r.base_model}`}</p>
                </div>
                <div className="font-mono text-[13px] text-dim md:text-right whitespace-nowrap">
                  {r.saved_at.slice(0, 16).replace('T', ' ')}
                  <span className="text-ember"> · 에러 {r.error_count}건</span>
                  {r.has_portfolio && <span className="text-mint"> · 포트폴리오 있음</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="mt-6 flex items-start gap-2.5 rounded-md border border-ember/40 bg-ember/10 p-4 text-[14px] text-ember print:hidden">
          <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="leading-relaxed">{error}</span>
        </div>
      )}

      {/* 파이프라인 로그 */}
      {(running || logs.length > 0) && (
        <div className="mt-6 border border-line rounded-lg p-5 print:hidden">
          <div className="flex items-center justify-between mb-3">
            <SecHead>포트폴리오 생성 로그</SecHead>
            <span className="text-[13px] flex items-center gap-1.5">
              {running
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin text-cobalt" /><span className="text-cobalt">RUNNING</span></>
                : phase === 'done'
                  ? <><CheckCircle2 className="w-3.5 h-3.5 text-mint" /><span className="text-mint">COMPLETE</span></>
                  : phase === 'error'
                    ? <><XCircle className="w-3.5 h-3.5 text-ember" /><span className="text-ember">FAILED</span></>
                    : null}
            </span>
          </div>
          <div ref={logRef} className="h-44 overflow-y-auto rounded-md bg-pit border border-line p-4 font-mono text-[11px] leading-6">
            {logs.length === 0 && <p className="text-dim">파이프라인을 시작하는 중입니다…</p>}
            {logs.map((line, i) => (
              <p key={i} className={`whitespace-pre-wrap break-all ${lineTone(line)}`}>{line}</p>
            ))}
          </div>
        </div>
      )}

      {/* 네이티브 리포트 */}
      {report ? (
        <Report data={report} telemetry={telemetry} />
      ) : (
        !running && (
          <div className="mt-8 border border-line rounded-lg p-10 text-center">
            <p className="font-display font-bold text-lg">아직 생성된 포트폴리오가 없습니다</p>
            <p className="mt-2 text-[14px] text-mist leading-relaxed">
              위의 실행 버튼을 누르면 선택한 학습 실행의 텔레메트리(에러 이력·성능 지표·Code Diff)로
              포트폴리오를 생성해 이 자리에 렌더링합니다.
            </p>
          </div>
        )
      )}
    </div>
  );
}
