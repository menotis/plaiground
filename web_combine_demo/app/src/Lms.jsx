import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, FileText } from 'lucide-react';

// ─── Faculty LMS — 교수용 대시보드 (샘플 데이터) ──────────────────────────────
// 백엔드가 아직 없는 화면. 학생 60명 데이터는 고정 시드로 생성한 가상 데이터라
// 새로고침해도 같은 값이 나오며, SAMPLE DATA 배지로 명시한다.

const SURNAMES = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권', '황', '안', '송', '류', '홍'];
const GIVEN = ['민준', '서연', '도윤', '지우', '하준', '서현', '시우', '하윤', '지호', '수아', '예준', '지민', '주원', '채원', '건우', '유진', '현우', '다은', '지훈', '수빈', '태윤', '예린', '준서', '소율', '우진', '가은', '민재', '아린', '승현', '나윤'];

// 고정 시드 PRNG — 데모 데이터가 렌더마다 흔들리지 않게
function seeded(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

function buildStudents() {
  const rnd = seeded(20260904);
  const rows = [];
  for (let i = 0; i < 60; i++) {
    const name = SURNAMES[Math.floor(rnd() * SURNAMES.length)] + GIVEN[Math.floor(rnd() * GIVEN.length)];
    const id = `2023${String(10001 + i).padStart(5, '0')}`;
    // 마지막 2명은 미시작 → 활성화율 58/60
    const notStarted = i >= 58;
    const completed = !notStarted && rnd() < 0.55;
    const exc = notStarted ? 0 : 1 + Math.floor(rnd() * 8);
    const loss = notStarted ? null : completed ? 0.08 + rnd() * 0.18 : 0.25 + rnd() * 0.5;
    rows.push({
      name,
      id,
      hw: 'CLOUD · A5000',
      status: notStarted ? 'NOT STARTED' : completed ? 'COMPLETED' : 'IN PROGRESS',
      exc,
      loss: loss === null ? '—' : loss.toFixed(4),
    });
  }
  return rows;
}

const STATUS_TEXT = {
  'COMPLETED': 'text-mint',
  'IN PROGRESS': 'text-cobalt',
  'NOT STARTED': 'text-dim',
};

const FILTERS = [['전체', null], ['진행 중', 'IN PROGRESS'], ['완료', 'COMPLETED'], ['미시작', 'NOT STARTED']];
const PAGE_SIZE = 10;

export default function Lms({ go, addToast }) {
  const students = useMemo(buildStudents, []);
  const [filter, setFilter] = useState(null);
  const [page, setPage] = useState(1);

  const active = students.filter((s) => s.status !== 'NOT STARTED');
  const totalErrors = students.reduce((sum, s) => sum + s.exc, 0);
  const filtered = filter ? students.filter((s) => s.status === filter) : students;

  // 페이지네이션 — 10명씩, 필터를 바꾸면 1페이지로
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const visible = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const changeFilter = (value) => { setFilter(value); setPage(1); };

  return (
    <div className="max-w-6xl mx-auto px-6 pb-24">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display font-bold tracking-[-0.025em] text-4xl">Faculty LMS</h1>
          <p className="mt-3 text-[15px] text-mist leading-relaxed max-w-2xl">
            2026-2 캡스톤 디자인 · AI 파인튜닝 실습 — B2B Faculty Package (60명 · 9개월).
            학생별 실습 현황과 검증 포트폴리오를 한 화면에서 관리합니다.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => addToast?.('평가 데이터 CSV 내보내기가 큐에 등록되었습니다. (데모)')}
            className="px-5 py-3 rounded-full border border-line text-[14px] text-mist hover:text-ink hover:border-white/25 transition-colors flex items-center gap-2"
          >
            <FileText className="w-4 h-4" /> 평가 CSV
          </button>
          <button
            onClick={() => addToast?.('전체 포트폴리오 일괄 내보내기가 큐에 등록되었습니다. (데모)')}
            className="px-6 py-3 rounded-full bg-ink text-void text-[14px] font-semibold hover:bg-white transition-colors flex items-center gap-2"
          >
            <Download className="w-4 h-4" /> 포트폴리오 일괄 다운로드
          </button>
        </div>
      </div>

      {/* KPI — 박스 없이 상하 괘선만으로 지면에 얹는다 */}
      <div className="mt-10 border-y border-line grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-line">
        {[
          ['학생 활성화율', `${active.length} / ${students.length}`, `${students.length - active.length}명 미시작 · ${((active.length / students.length) * 100).toFixed(1)}%`, '#f2f0eb'],
          ['누적 에러 해결', `${totalErrors}건`, `학생당 평균 ${(totalErrors / active.length).toFixed(2)}건`, '#fb7185'],
          ['주간 평균 실습', '6시간 12분', 'Cloud A5000 · 60명 동일 환경', '#4ade9b'],
        ].map(([label, value, sub, color]) => (
          <div key={label} className="px-6 py-6">
            <p className="text-[14px] text-mist">{label}</p>
            <p className="mt-1.5 font-display font-bold text-3xl tabular" style={{ color }}>{value}</p>
            <p className="mt-1.5 text-[13px] text-dim">{sub}</p>
          </div>
        ))}
      </div>

      {/* 학생 실습 현황 — 상태 탭 + 괘선 표 */}
      <div className="mt-12 flex items-end justify-between flex-wrap gap-3 border-b border-line">
        <div className="flex items-center gap-6" role="group" aria-label="상태 필터">
          {FILTERS.map(([label, value]) => (
            <button
              key={label}
              onClick={() => changeFilter(value)}
              aria-pressed={filter === value}
              className={`pb-3 text-[14px] transition-colors border-b-2 -mb-px ${
                filter === value ? 'text-ink font-semibold border-gold' : 'text-mist hover:text-ink border-transparent'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="pb-3 font-mono text-[13px] text-dim tabular">{filtered.length}명</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-[15px]">
          <thead>
            <tr className="font-mono text-[12px] text-dim border-b border-line">
              {['이름', '학번', '인프라', '상태', '에러 해결', 'Final Loss', ''].map((h, i) => (
                <th key={i} className="py-3.5 pr-6 font-normal whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {visible.map((s) => (
              <tr key={s.id} className="hover:bg-white/[0.025] transition-colors">
                <td className="py-3 pr-6 font-medium whitespace-nowrap">{s.name}</td>
                <td className="py-3 pr-6 font-mono text-[13px] text-mist tabular">{s.id}</td>
                <td className="py-3 pr-6 text-mist whitespace-nowrap">{s.hw}</td>
                <td className={`py-3 pr-6 font-mono text-[13px] whitespace-nowrap ${STATUS_TEXT[s.status]}`}>{s.status}</td>
                <td className="py-3 pr-6 tabular text-ember">{s.exc > 0 ? `${s.exc}건` : '—'}</td>
                <td className="py-3 pr-6 font-mono text-[13px] tabular">{s.loss}</td>
                <td className="py-3 text-right">
                  {s.status !== 'NOT STARTED' ? (
                    <button
                      onClick={() => go('portfolio')}
                      className="text-[14px] text-mist hover:text-gold underline underline-offset-4 decoration-line hover:decoration-gold transition-colors whitespace-nowrap"
                    >
                      포트폴리오 보기
                    </button>
                  ) : (
                    <span className="text-[14px] text-dim">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 — 범위·이전/다음·번호를 한 묶음으로 */}
      <div className="mt-4 pt-4 border-t border-line flex items-center justify-end flex-wrap gap-x-5 gap-y-2">
        <span className="font-mono text-[13px] text-dim tabular">
          {filtered.length === 0 ? '0' : `${(current - 1) * PAGE_SIZE + 1}–${Math.min(current * PAGE_SIZE, filtered.length)}`} / {filtered.length}명
        </span>
        <nav className="flex items-center gap-1" aria-label="페이지">
          <button
            onClick={() => setPage(current - 1)}
            disabled={current === 1}
            aria-label="이전 페이지"
            className="p-2 rounded-md text-mist hover:text-ink hover:bg-white/[0.04] transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              onClick={() => setPage(n)}
              aria-current={n === current ? 'page' : undefined}
              className={`min-w-9 h-9 px-2 rounded-md font-mono text-[13px] tabular transition-colors ${
                n === current ? 'bg-white/6 text-ink font-semibold' : 'text-mist hover:text-ink hover:bg-white/[0.04]'
              }`}
            >
              {n}
            </button>
          ))}
          <button
            onClick={() => setPage(current + 1)}
            disabled={current === pageCount}
            aria-label="다음 페이지"
            className="p-2 rounded-md text-mist hover:text-ink hover:bg-white/[0.04] transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </nav>
      </div>
    </div>
  );
}
