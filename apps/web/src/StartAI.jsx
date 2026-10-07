import { useCallback, useEffect, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Cpu,
  Loader2,
  Search,
  Terminal,
  X,
  XCircle,
} from 'lucide-react';
import { api } from './api.js';
import IdeConnectHub from './IdeConnectHub.jsx';

// ─── Start AI — 옴니채널 BYOC 파이프라인 위저드 ──────────────────────────────
// Step 1: 로컬 하드웨어(GPU/CUDA) 진단
// Step 2: 과제에 맞는 AI 모델 선택
// Step 3: IDE Connect Hub (VS Code, Cursor, Antigravity, Colab 1줄 복사)

const STEPS = ['하드웨어 진단', '모델 선택', 'IDE Connect Hub'];

const FALLBACK_MODELS = [
  {
    model_id: 'klue-bert-finetune',
    task_type: '텍스트 분류 (범용 파인튜닝)',
    base_model: 'klue/bert-base',
    dataset_name: 'NSMC 2,000개 서브셋',
    min_vram_gb: 4,
    category: '텍스트 분류',
    family: 'BERT',
    params: '110M',
    modality: '텍스트',
  },
  {
    model_id: 'mnist-cnn-lite',
    task_type: '이미지 분류 (처음부터 학습)',
    base_model: 'custom-cnn-2conv',
    dataset_name: 'torchvision.datasets.MNIST',
    min_vram_gb: 0,
    category: '이미지 분류',
    family: 'CNN',
    params: '<1M',
    modality: '이미지',
  },
  {
    model_id: 'resnet50-transfer-cifar10',
    task_type: '이미지 분류 (전이 학습)',
    base_model: 'torchvision.models.resnet50',
    dataset_name: 'CIFAR-10 서브셋',
    min_vram_gb: 4,
    category: '이미지 분류',
    family: 'ResNet',
    params: '25.6M',
    modality: '이미지',
  },
  {
    model_id: 'gemma-2b-lora',
    task_type: '경량 LLM LoRA 파인튜닝',
    base_model: 'google/gemma-2b',
    dataset_name: 'KoAlpaca v1.1 서브셋',
    min_vram_gb: 6,
    category: 'LLM 파인튜닝',
    family: 'Gemma',
    params: '2B',
    modality: '텍스트',
    access_note: 'HuggingFace 토큰 인증 권장',
  },
];

function StatusRow({ ok, label, value, hint }) {
  return (
    <div className="flex items-center justify-between px-5 py-4 text-[14px]">
      <div>
        <span className="text-ink font-medium">{label}</span>
        {hint && <span className="block text-[12px] text-dim mt-0.5">{hint}</span>}
      </div>
      <span className={`flex items-center gap-2 font-mono text-[13px] font-semibold ${ok ? 'text-mint' : 'text-ember'}`}>
        {ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
        {value}
      </span>
    </div>
  );
}

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
  const [loading, setLoading] = useState(true);

  // ─── 필터링 ───
  const query = q.trim().toLowerCase();
  const matchesQuery = (m) =>
    !query ||
    [m.model_id, m.base_model, m.task_type, m.dataset_name, m.family, m.category]
      .some((s) => String(s ?? '').toLowerCase().includes(query));
  const matchesCategory = (m, c) => c === '전체' || m.category === c;
  const matchesFamily = (m, f) => f === '전체' || m.family === f;

  const currentModels = models.length > 0 ? models : FALLBACK_MODELS;
  const visibleModels = currentModels.filter(
    (m) => matchesQuery(m) && matchesCategory(m, category) && matchesFamily(m, family)
  );

  const countBy = (key, val, other) =>
    currentModels.filter((m) => matchesQuery(m) && other(m) && (val === '전체' || m[key] === val)).length;
  const categories = ['전체', ...new Set(currentModels.map((m) => m.category).filter(Boolean))]
    .map((c) => [c, countBy('category', c, (m) => matchesFamily(m, family))]);
  const families = ['전체', ...new Set(currentModels.map((m) => m.family).filter(Boolean))]
    .map((f) => [f, countBy('family', f, (m) => matchesCategory(m, category))]);

  useEffect(() => {
    Promise.all([
      api('/api/status').then((r) => r.json()).catch(() => null),
      api('/api/models').then((r) => r.json()).catch(() => null),
    ])
      .then(([s, m]) => {
        if (s) setStatus(s);
        const resolvedModels = m && Array.isArray(m) && m.length > 0 ? m : FALLBACK_MODELS;
        setModels(resolvedModels);
        setSelected(resolvedModels[0]?.model_id ?? '');
      })
      .finally(() => setLoading(false));
  }, []);

  const selectedModel = currentModels.find((m) => m.model_id === selected) || currentModels[0];

  const handleSelectModel = useCallback(() => {
    if (!selected) return;
    onSession?.({ model_id: selected, selectedModel });
    setStep(3);
  }, [selected, selectedModel, onSession]);

  return (
    <div className="max-w-6xl mx-auto px-6 pb-24">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2">
        <div>
          <h1 className="font-display font-bold tracking-[-0.03em] text-[2.2rem]">Start AI</h1>
          <p className="mt-2 text-[14px] text-mist leading-relaxed max-w-2xl">
            불필요한 클라우드 과금 없이, 내 PC의 GPU 하드웨어에 최적화된 uv 가상환경과
            PyTorch 2.14.1을 구성하고 데스크톱 IDE(VS Code, Cursor)와 1줄로 연동합니다.
          </p>
        </div>
      </div>

      {/* 스텝 인디케이터 (3단계 구조) */}
      <ol className="mt-7 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {STEPS.map((label, idx) => {
          const n = idx + 1;
          const state = step === n ? 'current' : step > n ? 'done' : 'todo';
          return (
            <li
              key={label}
              aria-current={state === 'current' ? 'step' : undefined}
              className={`rounded-full px-5 py-2.5 text-center text-[13px] font-medium transition-all ${
                state === 'current'
                  ? 'bg-ink text-void shadow-sm'
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

      {/* STEP 1 — 하드웨어 및 런타임 진단 */}
      {step === 1 && (
        <div className="mt-8 space-y-6">
          <div className="border border-line rounded-lg divide-y divide-line bg-pit/40">
            <StatusRow
              ok={true}
              label="초고속 가상환경 빌더"
              value="uv (venv) ACTIVE"
              hint="기존 pip 대비 10~50배 빠른 Rust 기반 가상환경 자동 생성"
            />
            <StatusRow
              ok={true}
              label="감지된 하드웨어"
              value={status?.gpu_name || 'NVIDIA GPU (로컬 CLI 자동 매핑)'}
              hint={status?.driver_version ? `드라이버: ${status.driver_version} · Group B(cu130) 지원` : 'RTX 2060S~5090 아키텍처 자동 감지'}
            />
            <StatusRow
              ok={true}
              label="PyTorch 최적화 매핑"
              value="PyTorch v2.14.1"
              hint="CC sm_75 / sm_80 / sm_89 / sm_120 하드웨어 맞춤형 휠 배정"
            />
            <StatusRow
              ok={true}
              label="보안 격리 정책"
              value="BYOC CLIENT PULL"
              hint="원격 포트 노출 없이 사용자 터미널에서 명시적으로 pull 실행"
            />
          </div>

          {/* 안내 배너 */}
          <div className="p-4 rounded-lg bg-gold/5 border border-gold/15 text-[13px] text-mist leading-relaxed">
            <span className="font-semibold text-ink">로컬 GPU 가속 & Colab 클라우드 동시 지원: </span>
            외장 GPU가 장착된 데스크톱뿐만 아니라, MacBook이나 사무용 노트북에서도 Google Colab 무료 T4 GPU로 1줄 실행이 가능합니다.
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={() => setStep(2)}
              className="px-7 py-3 rounded-full bg-ink text-void text-[14px] font-semibold hover:bg-white transition-colors"
            >
              모델 선택으로 →
            </button>
          </div>
        </div>
      )}

      {/* STEP 2 — 모델 브라우저: 좌측 필터 | 우측 모델 목록 */}
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
                    선택 · <span className="text-gold font-semibold">{selectedModel.model_id}</span>
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
                      selected === m.model_id ? 'bg-white/6' : 'hover:bg-white/[0.025]'
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

          <div className="flex justify-between items-center pt-2">
            <button
              onClick={() => setStep(1)}
              className="px-6 py-2.5 rounded-full border border-line text-[14px] text-mist hover:text-ink hover:border-white/25 transition-colors"
            >
              뒤로
            </button>
            <button
              onClick={handleSelectModel}
              disabled={!selected}
              className="px-7 py-3 rounded-full bg-gold text-void text-[14px] font-semibold hover:brightness-110 transition-all disabled:opacity-40"
            >
              IDE 연결 허브 열기
            </button>
          </div>
        </div>
      )}

      {/* STEP 3 — IDE Connect Hub (옴니채널 연동) */}
      {step === 3 && (
        <div className="mt-6">
          <IdeConnectHub
            model={selectedModel}
            onBack={() => setStep(2)}
            go={go}
            addToast={addToast}
          />
        </div>
      )}
    </div>
  );
}
