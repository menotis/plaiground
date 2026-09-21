import { useEffect, useState } from 'react';
import { AlertTriangle, Check, Copy, Cpu, ExternalLink, Eye, Loader2, Play, Terminal } from 'lucide-react';

// ─── Web IDE — 컨테이너 안 code-server를 iframe으로 임베딩 ────────────────────
// Start AI 세션이 없어도 code-server(8080)가 살아 있으면 바로 접속한다.
// 워크스페이스는 호스트 디렉토리 마운트라 재세팅해도 파일은 그대로 유지된다.

export default function IdeView({ session, staged, go, addToast }) {
  const [copied, setCopied] = useState(false);
  const [ide, setIde] = useState(null); // /api/ide/status — {running, ide_url}

  useEffect(() => {
    fetch('/api/ide/status')
      .then((r) => r.json())
      .then(setIde)
      .catch(() => setIde({ running: false }));
  }, []);

  const url = session?.ide_url || (ide?.running ? ide.ide_url : null);

  if (ide === null && !session) {
    return (
      <p className="min-h-[60vh] flex items-center justify-center text-[13px] text-dim gap-2">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> 워크스페이스 확인 중…
      </p>
    );
  }

  if (!url) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-6">
        <div className="max-w-md text-center space-y-4">
          <Cpu className="w-10 h-10 text-dim mx-auto" />
          <p className="font-display font-bold text-lg">워크스페이스가 꺼져 있습니다</p>
          {staged && (
            <div className="rounded-md border border-gold/30 bg-gold/5 p-4 text-left">
              <p className="text-[12px] font-medium text-gold">커뮤니티 실습 코드가 준비되었습니다</p>
              <p className="mt-1.5 text-[13px] text-mist leading-relaxed">{staged.title}</p>
              <p className="mt-1.5 font-mono text-[11px] text-ink break-all">{staged.script_path}</p>
            </div>
          )}
          <p className="text-[13px] text-mist leading-relaxed">
            Start AI에서 환경을 세팅하면 code-server가 켜집니다. 재세팅해도 워크스페이스
            디렉토리와 작성한 파일은 그대로 유지되고, 실행 환경만 새로 준비됩니다.
          </p>
          <button
            onClick={() => go('start')}
            className="px-6 py-2.5 rounded-md bg-ink text-void text-[13px] font-semibold hover:bg-white transition-colors"
          >
            Start AI로 이동
          </button>
        </div>
      </div>
    );
  }

  const copyCommand = () => {
    navigator.clipboard?.writeText(session.run_command);
    setCopied(true);
    addToast?.('실행 명령을 복사했습니다.');
    setTimeout(() => setCopied(false), 2000);
  };

  // 풀블리드 — IDE가 화면을 꽉 채운다
  return (
    <div className="h-[calc(100vh-8.5rem)] md:h-[calc(100vh-4.5rem)] flex flex-col px-2 pb-2 w-full">
      <div className="border border-line border-b-0 rounded-t-md px-4 py-2 flex items-center justify-between flex-wrap gap-2 bg-pit/60">
        <div className="flex items-center gap-2.5 min-w-0">
          <Terminal className="w-4 h-4 text-cobalt shrink-0" />
          {session ? (
            <p className="text-[13px] font-medium truncate">
              {session.model_id}
              <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-mono ${
                session.gpu_available ? 'bg-mint/15 text-mint' : 'bg-white/10 text-mist'
              }`}>
                {session.gpu_available ? 'GPU' : 'CPU'}
              </span>
              <span className="ml-2 font-mono text-[11px] text-dim">{session.script_path}</span>
            </p>
          ) : (
            <p className="text-[13px] font-medium">
              Workspace
              <span className="ml-2 font-mono text-[11px] text-dim">code-server · /workspace 마운트 (파일 영구 보존)</span>
            </p>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {session && (
            <span className="flex items-center gap-2 rounded-md border border-line bg-pit px-3 py-1">
              <Play className="w-3 h-3 text-mint shrink-0" />
              <code className="font-mono text-[11px]">{session.run_command}</code>
              <button onClick={copyCommand} aria-label="실행 명령 복사" className="text-dim hover:text-ink transition-colors">
                {copied ? <Check className="w-3 h-3 text-mint" /> : <Copy className="w-3 h-3" />}
              </button>
            </span>
          )}
          {staged && (
            <span className="rounded-md border border-gold/30 bg-gold/5 px-3 py-1 font-mono text-[11px] text-gold">
              커뮤니티 실습: {staged.run_command}
            </span>
          )}
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="px-2.5 py-1 rounded-md border border-line text-[12px] text-mist hover:text-ink hover:border-white/25 transition-colors flex items-center gap-1.5"
          >
            <ExternalLink className="w-3 h-3" /> 새 탭
          </a>
          <button
            onClick={() => go('portfolio')}
            className="px-2.5 py-1 rounded-md border border-line text-[12px] text-mist hover:text-ink hover:border-white/25 transition-colors flex items-center gap-1.5"
          >
            <Eye className="w-3 h-3" /> 포트폴리오
          </button>
        </div>
      </div>

      <iframe
        src={url}
        title="Web IDE (code-server)"
        className="flex-1 w-full rounded-b-md border border-line bg-[#1e1e1e]"
        allow="clipboard-read; clipboard-write"
      />

      <p className="mt-1.5 text-[11px] text-dim flex items-center gap-1.5 px-1">
        <AlertTriangle className="w-3 h-3 text-amber-300 shrink-0" />
        터미널(Ctrl+`)에서 학습을 직접 실행하세요. 에러는 자동 수집되어 포트폴리오로 이어집니다.
      </p>
    </div>
  );
}
