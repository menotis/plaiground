// ─── 호스트 API 클라이언트 ────────────────────────────────────────────────────
// 모든 /api/* 호출은 이 파일을 거친다. 주소(VITE_API_BASE)와 헤더는 여기서만 붙인다.
// 로컬 개발은 VITE_API_BASE가 빈 값이라 vite 프록시(→ 127.0.0.1:8770)를 그대로 탄다.

const API_BASE = import.meta.env.VITE_API_BASE || '';

function buildHeaders(extra) {
  // 인증(Authorization)·Gemini 키 헤더는 이후 단계에서 여기에만 추가한다.
  return { ...extra };
}

export function api(path, options = {}) {
  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers: buildHeaders(options.headers),
  });
}

// SSE 구독 — EventSource는 헤더를 못 붙이므로 fetch 스트리밍으로 직접 파싱한다.
// onEvent(eventName, data)로 전달하며 data는 원문 문자열(호출부에서 JSON.parse).
// 스트림이 'close() 없이' 끊기면 EventSource처럼 ('error', undefined)를 전달한다.
export function apiStream(path, onEvent) {
  const controller = new AbortController();
  let closed = false;

  (async () => {
    try {
      const res = await api(path, {
        headers: { Accept: 'text/event-stream' },
        signal: controller.signal,
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      let eventName = 'message';
      let dataLines = [];

      const flush = () => {
        if (dataLines.length && !closed) onEvent(eventName, dataLines.join('\n'));
        eventName = 'message';
        dataLines = [];
      };

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl;
        while ((nl = buf.indexOf('\n')) !== -1) {
          const line = buf.slice(0, nl).replace(/\r$/, '');
          buf = buf.slice(nl + 1);
          if (line === '') flush();
          else if (line.startsWith('event:')) eventName = line.slice(6).trim();
          else if (line.startsWith('data:')) dataLines.push(line.slice(5).replace(/^ /, ''));
        }
      }
      flush();
      if (!closed) onEvent('error', undefined);
    } catch {
      if (!closed) onEvent('error', undefined);
    }
  })();

  return {
    close() {
      closed = true;
      controller.abort();
    },
  };
}
