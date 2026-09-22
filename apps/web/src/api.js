// ─── 호스트 API 클라이언트 ────────────────────────────────────────────────────
// 모든 /api/* 호출은 이 파일을 거친다. 주소(VITE_API_BASE)와 헤더는 여기서만 붙인다.
// 로컬 개발은 VITE_API_BASE가 빈 값이라 vite 프록시(→ 127.0.0.1:8770)를 그대로 탄다.

const API_BASE = import.meta.env.VITE_API_BASE || '';

// Supabase 세션 토큰 공급자. B2-4(로그인)에서 실제 세션을 돌려주도록 교체한다.
// null을 돌려주면 Authorization 헤더를 생략한다(로컬 서버는 헤더를 무시).
let getAccessToken = () => null;
export function setAccessTokenGetter(fn) {
  getAccessToken = fn;
}

// 포트폴리오 화면의 키 입력 칸이 이 키 이름으로 sessionStorage에 저장한다.
export const GEMINI_KEY_STORAGE = 'plaiground.gemini_key';

function readGeminiKey() {
  try {
    return sessionStorage.getItem(GEMINI_KEY_STORAGE);
  } catch {
    return null;
  }
}

function buildHeaders(path, extra) {
  const headers = { ...extra };
  const token = getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  // X-Gemini-Key는 /api/portfolio/run에만 붙인다 (/api/portfolio/runs와 혼동 주의).
  if (path.split('?')[0] === '/api/portfolio/run') {
    const key = readGeminiKey();
    if (key) headers['X-Gemini-Key'] = key;
  }
  return headers;
}

export function api(path, options = {}) {
  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers: buildHeaders(path, options.headers),
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
      if (!res.ok) {
        // 스트림 전에 돌아온 400/401 JSON — 본문의 error를 SSE data와 같은
        // 형식(JSON 문자열)으로 넘겨서 호출부의 JSON.parse가 그대로 동작한다.
        let msg;
        try {
          const body = await res.json();
          if (typeof body?.error === 'string') msg = body.error;
        } catch { /* JSON 아님 — 일반 오류로 처리 */ }
        if (!closed) onEvent('error', msg ? JSON.stringify(msg) : undefined);
        return;
      }
      if (!res.body) throw new Error('빈 응답');

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
