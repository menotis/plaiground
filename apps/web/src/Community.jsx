import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from './api.js';
import {
  AlertCircle, ArrowLeft, Bookmark, Bug, Database, Eye, ExternalLink, FlaskConical,
  Loader2, MessageCircle, MessageCircleQuestion, Play, Search, Send, ThumbsUp, X,
} from 'lucide-react';

// ─── 커뮤니티 — community_demo 백엔드 연동 ────────────────────────────────────
// 글 목록/상세/댓글/추천/조회/즐겨찾기는 /api/community/* 를 실제로 호출한다.
// 글은 오버레이가 아니라 해시 라우트(#/community/<id>)를 가진 실제 페이지로 열린다.
// '실습해보기'는 글의 코드를 var/generated/에 스테이징하고 Web IDE로 이동.

const CATEGORIES = ['전체', '오류해결', '학습 결과', 'Q&A', '데이터 정보'];

// 카테고리별 커버 아이덴티티 (대표 이미지 — 시스템 그래머로 그린 커버)
const COVER = {
  '오류해결':   { icon: Bug,                   from: 'rgba(251,113,133,0.22)', to: 'rgba(251,113,133,0.04)', tint: '#fb7185' },
  '학습 결과':  { icon: FlaskConical,          from: 'rgba(74,222,155,0.20)',  to: 'rgba(74,222,155,0.04)',  tint: '#4ade9b' },
  'Q&A':        { icon: MessageCircleQuestion, from: 'rgba(91,120,255,0.22)',  to: 'rgba(91,120,255,0.04)',  tint: '#5b78ff' },
  '데이터 정보': { icon: Database,              from: 'rgba(232,179,75,0.22)',  to: 'rgba(232,179,75,0.05)',  tint: '#e8b34b' },
};

// 카테고리 라벨은 pill이 아니라 잉크 — 색만 빌린 모노 텍스트
const CATEGORY_TEXT = {
  '오류해결': 'text-ember',
  '학습 결과': 'text-mint',
  'Q&A': 'text-cobalt',
  '데이터 정보': 'text-gold',
};

function Cover({ post, tall = false }) {
  const c = COVER[post.category];
  const Icon = c.icon;
  return (
    <div
      className={`${tall ? 'h-40' : 'h-28'} rounded-md border border-line flex flex-col items-center justify-center gap-2`}
      style={{ background: `linear-gradient(150deg, ${c.from}, ${c.to} 70%)` }}
      aria-hidden="true"
    >
      <Icon className={tall ? 'w-9 h-9' : 'w-7 h-7'} style={{ color: c.tint }} />
      <span className="font-mono text-[10px] text-mist">#{post.tags[0]}</span>
    </div>
  );
}

function MetaCounts({ post, liked, bookmarked }) {
  return (
    <div className="flex items-center gap-3.5 font-mono text-[11px] text-mist tabular">
      <span className="flex items-center gap-1"><Eye className="w-3 h-3 text-dim" />{post.views.toLocaleString()}</span>
      <span className={`flex items-center gap-1 ${liked ? 'text-gold' : ''}`}><ThumbsUp className="w-3 h-3" />{post.likes.toLocaleString()}</span>
      <span className={`flex items-center gap-1 ${bookmarked ? 'text-gold' : ''}`}><Bookmark className="w-3 h-3" />{post.bookmarks.toLocaleString()}</span>
    </div>
  );
}

// ─── 게시글 페이지 ────────────────────────────────────────────────────────────
function PostPage({ post, liked, bookmarked, onToggle, onPractice, practicing, onBack, onTag, addToast }) {
  const [comments, setComments] = useState(null);
  const [author, setAuthor] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    setComments(null);
    api(`/api/community/comments?post_id=${encodeURIComponent(post.id)}`)
      .then((r) => r.json())
      .then((d) => setComments(Array.isArray(d) ? d : []))
      .catch(() => setComments([]));
  }, [post.id]);

  const submit = useCallback((e) => {
    e.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    api('/api/community/comment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ post_id: post.id, author, text }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setComments(d);
        setText('');
        addToast?.('댓글이 등록되었습니다.');
      })
      .catch((err) => addToast?.(`댓글 등록 실패: ${err.message}`))
      .finally(() => setSending(false));
  }, [post.id, author, text, sending, addToast]);

  return (
    <div className="max-w-3xl mx-auto px-6 pb-20">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-[13px] text-mist hover:text-ink transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> 목록으로
      </button>

      {/* 글 본문 */}
      <article className="mt-6">
        <span className={`font-mono text-[12px] ${CATEGORY_TEXT[post.category]}`}>{post.category}</span>
        <h1 className="mt-3 font-display font-bold tracking-tight text-2xl sm:text-3xl leading-snug">{post.title}</h1>
        <div className="mt-3 flex items-center justify-between flex-wrap gap-3">
          <p className="font-mono text-[12px] text-dim">{post.author} · {post.created_at}</p>
          <MetaCounts post={post} liked={liked} bookmarked={bookmarked} />
        </div>

        <div className="mt-6">
          <Cover post={post} tall />
        </div>

        <p className="mt-6 text-[15px] text-mist leading-relaxed">{post.content}</p>

        {post.practice_command && (
          <div className="mt-5 rounded-lg bg-pit border border-line px-4 py-3 flex items-center gap-2.5 font-mono text-[12px]">
            <Play className="w-3.5 h-3.5 text-mint shrink-0" />
            <code className="text-ink truncate">{post.practice_command}</code>
          </div>
        )}

        <div className="mt-5 flex items-center gap-4 flex-wrap font-mono text-[12px]">
          {post.tags.map((t) => (
            <button
              key={t}
              onClick={() => onTag(t)}
              className="text-cobalt hover:underline underline-offset-4 transition-colors"
            >
              #{t}
            </button>
          ))}
        </div>

        {post.source && (
          <a
            href={post.source.url}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-2 text-[13px] text-cobalt hover:underline underline-offset-4"
          >
            <ExternalLink className="w-3.5 h-3.5" /> 출처: {post.source.name}
          </a>
        )}

        <div className="mt-7 pt-5 border-t border-line flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-6 text-[13px]">
            <button
              onClick={() => onToggle(post.id, liked ? 'unlike' : 'like')}
              aria-pressed={liked}
              className={`flex items-center gap-1.5 transition-colors ${liked ? 'text-gold' : 'text-mist hover:text-ink'}`}
            >
              <ThumbsUp className="w-4 h-4" /> 추천 <span className="font-mono tabular">{post.likes.toLocaleString()}</span>
            </button>
            <button
              onClick={() => onToggle(post.id, bookmarked ? 'unbookmark' : 'bookmark')}
              aria-pressed={bookmarked}
              className={`flex items-center gap-1.5 transition-colors ${bookmarked ? 'text-gold' : 'text-mist hover:text-ink'}`}
            >
              <Bookmark className="w-4 h-4" /> 즐겨찾기 <span className="font-mono tabular">{post.bookmarks.toLocaleString()}</span>
            </button>
          </div>
          {post.practice_available && (
            <button
              onClick={() => onPractice(post)}
              disabled={practicing}
              className="px-4 py-2 rounded-md border border-line text-[13px] text-ink hover:border-white/30 hover:bg-white/5 transition-colors disabled:opacity-40 flex items-center gap-2"
            >
              {practicing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 text-mint" />}
              {post.category === '데이터 정보' ? '데이터 가져와서 실습' : '실습해보기'}
            </button>
          )}
        </div>
      </article>

      {/* 댓글 */}
      <section className="mt-10">
        <h2 className="font-display font-bold text-lg flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-cobalt" />
          댓글 {comments ? comments.length : ''}
        </h2>

        {/* 댓글 목록 — 박스 나열 대신 괘선으로 이어지는 스레드 */}
        <div className="mt-4 divide-y divide-line border-y border-line">
          {comments === null && (
            <p className="py-5 text-[13px] text-dim flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> 댓글을 불러오는 중…
            </p>
          )}
          {comments?.length === 0 && (
            <p className="py-6 text-[13px] text-mist text-center">아직 댓글이 없습니다. 첫 댓글을 남겨보세요.</p>
          )}
          {comments?.map((c, i) => (
            <div key={i} className="py-4">
              <p className="font-mono text-[12px]">
                <span className="text-ink">{c.author}</span>
                <span className="text-dim"> · {c.created_at}</span>
              </p>
              <p className="mt-1.5 text-[14px] text-mist leading-relaxed">{c.text}</p>
            </div>
          ))}
        </div>

        {/* 댓글 작성 */}
        <form onSubmit={submit} className="mt-6 space-y-3">
          <input
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="닉네임 (비우면 익명)"
            maxLength={30}
            className="w-full sm:w-56 rounded-md bg-pit border border-line px-3.5 py-2 text-[13px] text-ink placeholder:text-dim outline-none focus:border-gold/50 transition-colors"
          />
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="댓글을 입력하세요"
            rows={3}
            maxLength={1000}
            required
            className="w-full rounded-md bg-pit border border-line px-3.5 py-3 text-[14px] text-ink placeholder:text-dim outline-none focus:border-gold/50 transition-colors resize-y"
          />
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] text-dim tabular">{text.length}/1000</span>
            <button
              type="submit"
              disabled={sending || !text.trim()}
              className="px-4 py-2 rounded-md bg-ink text-void text-[13px] font-semibold hover:bg-white transition-colors disabled:opacity-40 flex items-center gap-2"
            >
              {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              댓글 등록
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default function Community({ go, postId, onStaged, addToast }) {
  const [posts, setPosts] = useState(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('전체');
  const [sort, setSort] = useState('views'); // 'views' | 'latest'
  const [liked, setLiked] = useState(() => new Set());
  const [bookmarked, setBookmarked] = useState(() => new Set());
  const [viewed, setViewed] = useState(() => new Set());
  const [practicing, setPracticing] = useState(false);

  useEffect(() => {
    api('/api/community/posts')
      .then((r) => r.json())
      .then(setPosts)
      .catch(() => setError('API 서버에 연결할 수 없습니다. `python -m plaiground_host.api_server`를 실행하세요.'));
  }, []);

  const patchPost = useCallback((id, counts) => {
    setPosts((prev) => prev?.map((p) => (p.id === id ? { ...p, ...counts } : p)));
  }, []);

  const interact = useCallback((id, action) => {
    api('/api/community/interact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ post_id: id, action }),
    })
      .then((r) => r.json())
      .then((counts) => patchPost(id, counts))
      .catch(() => {});
  }, [patchPost]);

  const toggle = useCallback((id, action) => {
    interact(id, action);
    const [set, setter] = action.includes('like') && !action.includes('book')
      ? [liked, setLiked] : [bookmarked, setBookmarked];
    const next = new Set(set);
    if (action.startsWith('un')) next.delete(id); else next.add(id);
    setter(next);
  }, [interact, liked, bookmarked]);

  // 게시글 페이지 진입 시 세션당 1회 조회수 증가
  useEffect(() => {
    if (postId && posts && !viewed.has(postId)) {
      setViewed((prev) => new Set(prev).add(postId));
      interact(postId, 'view');
    }
  }, [postId, posts, viewed, interact]);

  const practice = useCallback((post) => {
    setPracticing(true);
    api('/api/community/practice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ post_id: post.id }),
    })
      .then((r) => r.json())
      .then((payload) => {
        if (payload.error) throw new Error(payload.error);
        onStaged?.(payload);
        addToast?.(`실습 코드가 준비되었습니다 — ${payload.script_path}`);
        go('ide');
      })
      .catch((e) => addToast?.(`실습 준비 실패: ${e.message}`))
      .finally(() => setPracticing(false));
  }, [onStaged, addToast, go]);

  const filtered = useMemo(() => {
    if (!posts) return [];
    const query = q.trim().toLowerCase();
    const tagQuery = query.startsWith('#') ? query.slice(1) : null;
    let list = posts.filter((p) => {
      if (category !== '전체' && p.category !== category) return false;
      if (!query) return true;
      if (tagQuery) return p.tags.some((t) => t.toLowerCase().includes(tagQuery));
      return (
        p.title.toLowerCase().includes(query) ||
        p.summary.toLowerCase().includes(query) ||
        p.tags.some((t) => t.toLowerCase().includes(query))
      );
    });
    list = [...list].sort((a, b) =>
      sort === 'views' ? b.views - a.views : b.created_at.localeCompare(a.created_at),
    );
    return list;
  }, [posts, q, category, sort]);

  // ─── 게시글 페이지 ───
  const currentPost = postId ? posts?.find((p) => p.id === postId) : null;
  if (postId) {
    if (!posts && !error) {
      return (
        <p className="max-w-3xl mx-auto px-6 text-[13px] text-dim flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> 글을 불러오는 중…
        </p>
      );
    }
    if (!currentPost) {
      return (
        <div className="max-w-3xl mx-auto px-6 pb-20 text-center pt-10">
          <p className="font-display font-bold text-lg">글을 찾을 수 없습니다</p>
          <button onClick={() => go('community')} className="mt-4 px-5 py-2 rounded-full border border-line text-[13px] text-mist hover:text-ink transition-colors">
            목록으로
          </button>
        </div>
      );
    }
    return (
      <PostPage
        post={currentPost}
        liked={liked.has(currentPost.id)}
        bookmarked={bookmarked.has(currentPost.id)}
        onToggle={toggle}
        onPractice={practice}
        practicing={practicing}
        onBack={() => go('community')}
        onTag={(t) => { setQ(`#${t}`); go('community'); }}
        addToast={addToast}
      />
    );
  }

  // ─── 목록 페이지 ───
  return (
    <div className="max-w-6xl mx-auto px-6 pb-20">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display font-bold tracking-tight text-3xl flex items-center gap-3">
            Community
            <span className="px-2.5 py-1 rounded-full bg-white/10 text-mist text-[11px] font-mono font-medium">SAMPLE DATA</span>
          </h1>
          <p className="mt-2 text-sm text-mist leading-relaxed max-w-xl">
            오류 해결 기록, 학습 결과, 데이터 정보를 나누는 공간입니다. 글과 수치는 데모용
            시드이지만 인용된 데이터셋·출처·코드는 모두 실재하며, 실습해보기 버튼으로
            Web IDE 워크스페이스에 바로 가져올 수 있습니다.
          </p>
        </div>
        {/* 검색 — #태그 또는 키워드 */}
        <label className="flex items-center gap-2.5 rounded-md border border-line bg-pit px-4 py-2.5 w-full sm:w-72 focus-within:border-gold/50 transition-colors">
          <Search className="w-4 h-4 text-dim shrink-0" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="#해시태그 또는 키워드 검색"
            className="bg-transparent outline-none text-[13px] text-ink placeholder:text-dim w-full"
          />
          {q && (
            <button onClick={() => setQ('')} aria-label="검색어 지우기" className="text-dim hover:text-ink transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </label>
      </div>

      {/* 필터 + 정렬 — 언더라인 탭 (게시판의 문법) */}
      <div className="mt-8 border-b border-line flex items-end justify-between flex-wrap gap-3">
        <div className="flex items-center gap-6" role="group" aria-label="카테고리 필터">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              aria-pressed={category === c}
              className={`pb-3 text-[13px] transition-colors border-b-2 -mb-px ${
                category === c
                  ? 'text-ink font-semibold border-gold'
                  : 'text-mist hover:text-ink border-transparent'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-4 pb-3 font-mono text-[12px]" role="group" aria-label="정렬">
          {[['views', '조회순'], ['latest', '최신순']].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setSort(id)}
              aria-pressed={sort === id}
              className={`transition-colors ${sort === id ? 'text-ink font-semibold' : 'text-dim hover:text-ink'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mt-6 flex items-start gap-2.5 rounded-lg border border-ember/40 bg-ember/10 p-4 text-[13px] text-ember">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="leading-relaxed">{error}</span>
        </div>
      )}

      {!posts && !error && (
        <p className="mt-10 text-[13px] text-dim flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> 글을 불러오는 중…
        </p>
      )}

      {posts && filtered.length === 0 && (
        <div className="mt-10 rounded-lg border border-line p-10 text-center">
          <p className="font-display font-bold text-lg">검색 결과가 없습니다</p>
          <p className="mt-2 text-[13px] text-mist">다른 키워드나 해시태그로 검색해 보세요.</p>
        </div>
      )}

      {/* 피드 그리드 — 박스 없이 콘텐츠가 직접 선다: 제목 / 대표 이미지 / 한 줄 요약 */}
      <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12">
        {filtered.map((p) => (
          <article
            key={p.id}
            role="button"
            tabIndex={0}
            onClick={() => go('community', p.id)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go('community', p.id); } }}
            className="cursor-pointer group focus-visible:outline-2 focus-visible:outline-gold/75 flex flex-col gap-3"
          >
            {/* 1) 제목 */}
            <div>
              <div className="flex items-center justify-between gap-2 font-mono text-[11px]">
                <span className={CATEGORY_TEXT[p.category]}>{p.category}</span>
                {p.practice_available && (
                  <span className="text-gold flex items-center gap-1">
                    <Play className="w-3 h-3" /> 실습 가능
                  </span>
                )}
              </div>
              <h2 className="mt-2 font-display font-bold text-[16px] leading-snug line-clamp-2 group-hover:text-gold transition-colors">
                {p.title}
              </h2>
            </div>

            {/* 2) 대표 이미지 */}
            <Cover post={p} />

            {/* 3) 한 줄 요약 + 메타 */}
            <div className="mt-auto">
              <p className="text-[13px] text-mist leading-relaxed truncate">{p.summary}</p>
              <div className="mt-2.5 flex items-center justify-between gap-2">
                <MetaCounts post={p} liked={liked.has(p.id)} bookmarked={bookmarked.has(p.id)} />
                <span className="font-mono text-[10px] text-dim">{p.created_at}</span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
