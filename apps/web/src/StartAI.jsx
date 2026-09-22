import { useCallback, useEffect, useRef, useState } from 'react';
import { api, apiStream } from './api.js';
import {
  AlertTriangle, ArrowRight, CheckCircle2, ExternalLink, Loader2, Play, Search, X, XCircle,
} from 'lucide-react';

// ─── Start AI — 실제 ai_set_demo 파이프라인 위저드 ────────────────────────────
// /api/status, /api/models, /api/setup(SSE)을 그대로 호출한다. 목업 아님.
// 학습은 여기서 돌리지 않는다 — 세팅과 코드 생성까지만 하고 Web IDE로 넘긴다.

const STEPS = ['환경 감지', '모델 선택', '환경 세팅', 'Web IDE'];

function lineTone(line) {
  if (line.startsWith('경고') || line.includes('  경고:') || line.startsWith('Warning')) return 'text-amber-300';
  if (line.startsWith('완료') || line.includes('✅')) return 'text-mint';
  if (/^\[\d\/\d\]/.test(line)) return 'text-cobalt font-medium';
  if (line.includes('Traceback') || line.includes('Error') || line.includes('실패')) return 'text-ember';
  return 'text-mist';
}

function StatusRow({ ok, label, value }) {
  return (
    <div className="flex items-center justify-between px-5 py-4 text-[15px]">
      <span className="text-mist">{label}</span>
      <span className={`flex items-center gap-2 font-medium font-mono text-[13px] ${ok ? 'text-mint' : 'text-ember'}`}>
        {ok ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
        {value}
      </span>
    </div>
  );
}

// 필터 패널의 한 그룹 — 항목마다 해당 조건의 모델 수를 함께 보여준다
function FilterGroup({ title, items, value, onChange }) {
  return (
    <div>
      <h3 className="font-mono text-[11px] tracking-[0.15em] uppercase text-dim">{title}</h3>
      <ul className="mt-2.5 space-y-0.5" role="group" aria-label={title}>
        {items.map(([label, count]) => {
          const active = value === label;
          return (
            <li key={label}>
              <button
                onClick={() => onChange(label)}
                aria-pressed={active}
                className={`w-full flex items-center justify-between rounded-md px-3 py-1.5 text-[14px] transition-colors ${
                  active ? 'bg-white/6 text-ink font-semibold' : 'text-mist hover:text-ink hover:bg-white/[0.03]'
                }`}
              >
                <span>{label}</span>
                <span className={`font-mono text-[12px] tabular ${active ? 'text-gold' : 'text-dim'}`}>{count}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function StartAI({ go, onSession, addToast }) {
  const [step, setStep] = useState(1);
  const [status, setStatus] = useState(null);
  const [models, setModels] = useState([]);
  const [selected, setSelected] = useState('');
  const [category, setCategory] = useState('전체');
  const [family, setFamily] = useState('전체');
  const [q, setQ] = useState('');
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState('');
  const [session, setSession] = useState(null);
  const logRef = useRef(null);
  const sourceRef = useRef(null);

  // ─── 필터링 — 검색어 · 카테고리 · 계열 세 조건의 교집합 ───
  const query = q.trim().toLowerCase();
  const matchesQuery = (m) =>
    !query ||
    [m.model_id, m.base_model, m.task_type, m.dataset_name, m.family, m.category]
      .some((s) => String(s ?? '').toLowerCase().includes(query));
  const matchesCategory = (m, c) => c === '전체' || m.category === c;
  const matchesFamily = (m, f) => f === '전체' || m.family === f;

  const visibleModels = models.filter((m) => matchesQuery(m) && matchesCategory(m, category) && matchesFamily(m, family));

  // 그룹별 카운트 — 다른 두 조건을 적용한 상태에서 이 항목을 고르면 몇 개가 남는지
  const countBy = (key, val, other) => models.filter((m) => matchesQuery(m) && other(m) && (val === '전체' || m[key] === val)).length;
  const categories = ['전체', ...new Set(models.map((m) => m.category).filter(Boolean))]
    .map((c) => [c, countBy('category', c, (m) => matchesFamily(m, family))]);
  const families = ['전체', ...new Set(models.map((m) => m.family).filter(Boolean))]
    .map((f) => [f, countBy('family', f, (m) => matchesCategory(m, category))]);

  useEffect(() => {
    Promise.all([
      api('/api/status').then((r) => r.json()),
      api('/api/models').then((r) => r.json()),
    ])
      .then(([s, m]) => {
        setStatus(s);
        setModels(m);
        setSelected(m[0]?.model_id ?? '');
      })
      .catch(() => setError('API 서버에 연결할 수 없습니다. `python -m plaiground_host.api_server`를 실행하세요.'));
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  useEffect(() => () => sourceRef.current?.close(), []);

  const start = useCallback(() => {
    setLogs([]);
    setError('');
    setSession(null);
    setStep(3);

    const source = apiStream(`/api/setup?model_id=${encodeURIComponent(selected)}`, (event, data) => {
      if (event === 'log') {
        setLogs((prev) => [...prev, JSON.parse(data)]);
      } else if (event === 'ready') {
        source.close();
        const payload = JSON.parse(data);
        setSession(payload);
        onSession?.(payload);
        setStep(4);
        addToast?.('환경 세팅 완료 — Web IDE에서 학습을 실행하세요.');
      } else if (event === 'error') {
        source.close();
        setError(data ? JSON.parse(data) : '스트림이 끊겼습니다. 서버 로그를 확인하세요.');
        setStep(4);
      }
    });
    sourceRef.current = source;
  }, [selected, onSession, addToast]);

  const running = step === 3;
  const selectedModel = models.find((m) => m.model_id === selected);

  return (
    <div className="max-w-6xl mx-auto px-6 pb-24">
      <h1 className="font-display font-bold tracking-[-0.025em] text-[2rem]">Start AI</h1>
      <p className="mt-2 text-[14px] text-mist leading-relaxed max-w-2xl">
        하드웨어 감지부터 컨테이너 기동까지 실제 파이프라인이 실행됩니다. 세팅이 끝나면
        생성된 학습 코드가 열린 Web IDE로 이동합니다.
      </p>

      {/* 스텝 인디케이터 */}
      <ol className="mt-7 grid grid-cols-2 sm:grid-cols-4 gap-2">
        {STEPS.map((label, idx) => {
          const n = idx + 1;
          const state = step === n ? 'current' : step > n ? 'done' : 'todo';
          return (
            <li
              key={label}
              aria-current={state === 'current' ? 'step' : undefined}
              className={`rounded-full px-4 py-2 text-center text-[13px] font-medium transition-colors ${
                state === 'current'
                  ? 'bg-ink text-void'
                  : state === 'done'
                    ? 'bg-mint/15 text-mint border border-mint/30'
                    : 'border border-line text-dim'
              }`}
            >
              {n}. {label}
            </li>
          );
        })}
      </ol>

      {error && (
        <div className="mt-8 flex items-start gap-3 rounded-lg border border-ember/40 bg-ember/10 p-4 text-[14px] text-ember">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="leading-relaxed">{error}</span>
        </div>
      )}

      {/* STEP 1 — 실제 감지 결과 */}
      {step === 1 && (
        <div className="mt-8 space-y-4">
          {!status && !error && (
            <p className="text-[14px] text-dim flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> 환경 감지 중…
            </p>
          )}
          {status && (
            <>
              {/* 같은 성격의 상태 행은 하나의 괘선 목록으로 */}
              <div className="border border-line rounded-lg divide-y divide-line bg-pit/40">
                <StatusRow ok={status.docker_running} label="Docker 데몬" value={status.docker_running ? 'RUNNING' : 'STOPPED'} />
                <StatusRow ok={status.image_exists} label={`베이스 이미지 (${status.image})`} value={status.image_exists ? 'READY' : 'MISSING'} />
                <StatusRow ok={!!status.gpu_name} label="감지된 GPU" value={status.gpu_name || 'NOT DETECTED'} />
                {status.driver_version && <StatusRow ok label="NVIDIA 드라이버" value={status.driver_version} />}
              </div>

              {!status.docker_running && (
                <p className="text-[14px] text-amber-300">Docker Desktop을 먼저 실행하세요.</p>
              )}
              {status.docker_running && !status.image_exists && (
                <p className="text-[14px] text-amber-300 leading-relaxed">
                  apps/host/docker/plaiground-base 에서 <code className="font-mono">docker build -t {status.image} .</code> 를 먼저 실행하세요.
                </p>
              )}
              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setStep(2)}
                  disabled={!status.docker_running || !status.image_exists}
                  className="px-7 py-3 rounded-full bg-ink text-void text-[14px] font-semibold hover:bg-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  모델 선택으로 <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* STEP 2 — 모델 브라우저: 좌측 필터 패널 | 우측 모델 목록 */}
      {step === 2 && (
        <div className="mt-6 space-y-4">
          <div className="border border-line rounded-lg grid grid-cols-1 lg:grid-cols-[280px_1fr] divide-y lg:divide-y-0 lg:divide-x divide-line">
            {/* 필터 패널 */}
            <aside className="p-4 space-y-5">
              <label className="flex items-center gap-2.5 rounded-md border border-line bg-pit px-3.5 py-2.5 focus-within:border-gold/50 transition-colors">
                <Search className="w-4 h-4 text-dim shrink-0" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="모델·데이터셋·태스크 검색"
                  className="bg-transparent outline-none text-[14px] text-ink placeholder:text-dim w-full"
                />
                {q && (
                  <button onClick={() => setQ('')} aria-label="검색어 지우기" className="text-dim hover:text-ink transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </label>
              <FilterGroup title="카테고리" items={categories} value={category} onChange={setCategory} />
              <FilterGroup title="계열" items={families} value={family} onChange={setFamily} />
            </aside>

            {/* 모델 목록 */}
            <section className="min-h-[360px] flex flex-col">
              <div className="px-5 py-3 border-b border-line flex items-center justify-between gap-3 flex-wrap">
                <span className="text-[14px] text-mist">
                  <span className="font-mono text-ink tabular">{visibleModels.length}</span>개 모델
                  {(query || category !== '전체' || family !== '전체') && (
                    <button
                      onClick={() => { setQ(''); setCategory('전체'); setFamily('전체'); }}
                      className="ml-3 text-[13px] text-dim hover:text-ink underline underline-offset-4 transition-colors"
                    >
                      필터 초기화
                    </button>
                  )}
                </span>
                {selectedModel && (
                  <span className="font-mono text-[12px] text-dim">
                    선택 · <span className="text-gold">{selectedModel.model_id}</span>
                  </span>
                )}
              </div>

              <div className="divide-y divide-line flex-1" role="radiogroup" aria-label="AI 모델 선택">
                {visibleModels.length === 0 && (
                  <p className="px-5 py-16 text-center text-[14px] text-mist">해당 조건의 모델이 없습니다.</p>
                )}
                {visibleModels.map((m) => (
                  <div
                    key={m.model_id}
                    role="radio"
                    aria-checked={selected === m.model_id}
                    tabIndex={0}
                    onClick={() => setSelected(m.model_id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(m.model_id); }
                    }}
                    className={`px-5 py-3.5 cursor-pointer transition-colors ${
                      selected === m.model_id ? 'bg-white/5' : 'hover:bg-white/[0.025]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <span className="font-display font-bold text-[16px] flex items-center gap-2 min-w-0">
                        <span className="truncate">{m.model_id}</span>
                        {selected === m.model_id && <CheckCircle2 className="w-[18px] h-[18px] text-gold shrink-0" />}
                      </span>
                      <span className="font-mono text-[12px] text-dim shrink-0">
                        {m.family} · {m.params} · <span className="text-cobalt">{m.min_vram_gb > 0 ? `${m.min_vram_gb}GB+ VRAM` : 'GPU 불필요'}</span>
                      </span>
                    </div>
                    <p className="mt-1 text-[14px] text-mist">{m.task_type} · {m.dataset_name}</p>
                    <p className="mt-1 font-mono text-[12px] text-dim">
                      {m.base_model}{m.modality && m.modality !== '텍스트' ? ` · ${m.modality}` : ''}
                    </p>
                    {m.access_note && (
                      <p className="mt-1 font-mono text-[12px] text-gold">{m.access_note}</p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="flex justify-between">
            <button
              onClick={() => setStep(1)}
              className="px-6 py-3 rounded-full border border-line text-[14px] text-mist hover:text-ink hover:border-white/25 transition-colors"
            >
              뒤로
            </button>
            <button
              onClick={start}
              disabled={!selected}
              className="px-7 py-3 rounded-full bg-ink text-void text-[14px] font-semibold hover:bg-white transition-colors disabled:opacity-40 flex items-center gap-2"
            >
              <Play className="w-4 h-4" /> 환경 세팅 실행
            </button>
          </div>
        </div>
      )}

      {/* STEP 3 & 4 — 실시간 로그 */}
      {(step === 3 || step === 4) && (
        <div className="mt-8 space-y-5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[13px] text-mist">{selected}</span>
            <span className="text-[13px] font-medium flex items-center gap-2">
              {running ? (
                <><Loader2 className="w-4 h-4 animate-spin text-cobalt" /><span className="text-cobalt">PROVISIONING</span></>
              ) : error ? (
                <><XCircle className="w-4 h-4 text-ember" /><span className="text-ember">FAILED</span></>
              ) : (
                <><CheckCircle2 className="w-4 h-4 text-mint" /><span className="text-mint">READY</span></>
              )}
            </span>
          </div>

          <div
            ref={logRef}
            className="h-96 overflow-y-auto rounded-lg border border-line bg-pit p-5 font-mono text-[13px] leading-7"
          >
            {logs.length === 0 && <p className="text-dim">컨테이너를 준비하는 중입니다…</p>}
            {logs.map((line, i) => (
              <p key={i} className={`whitespace-pre-wrap break-all ${lineTone(line)}`}>{line}</p>
            ))}
          </div>

          {step === 4 && !error && session && (
            <div className="rounded-lg border border-mint/30 bg-mint/5 p-6 space-y-3">
              <p className="text-[15px] font-medium text-mint flex items-center gap-2">
                <CheckCircle2 className="w-[18px] h-[18px]" />
                환경 세팅 완료 — 학습은 Web IDE에서 직접 실행합니다
              </p>
              <p className="text-[14px] text-mist">
                생성된 코드 <code className="font-mono text-ink">{session.script_path}</code>
              </p>
              <p className="text-[14px] text-mist">
                IDE 터미널에서 <code className="font-mono text-cobalt">{session.run_command}</code>
              </p>
              <div className="flex justify-end pt-1">
                <button
                  onClick={() => go('ide')}
                  className="px-7 py-3 rounded-full bg-mint text-void text-[14px] font-semibold hover:brightness-110 transition-all flex items-center gap-2"
                >
                  <ExternalLink className="w-4 h-4" /> Web IDE 열기
                </button>
              </div>
            </div>
          )}
          {step === 4 && error && (
            <div className="flex justify-end">
              <button
                onClick={() => setStep(2)}
                className="px-6 py-3 rounded-full border border-line text-[14px] text-mist hover:text-ink transition-colors"
              >
                모델 다시 선택
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
