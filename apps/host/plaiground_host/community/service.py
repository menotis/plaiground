# -*- coding: utf-8 -*-
"""
service.py — 커뮤니티 상호작용 상태와 '실습해보기' 스테이징.

- 글 원본은 posts.py(시드). 추천/조회/즐겨찾기 델타는 state.json에 쌓아 merge한다.
- stage_practice()는 글의 실습 코드를 사용자 워크스페이스에 실제 파일로 저장한다.
  그 폴더가 컨테이너의 /workspace이므로 Web IDE 터미널에서 바로 실행된다.

ponytail: 파일 잠금 없음(로컬 데모, 사용자 1명). 동시성 필요해지면 sqlite로.
"""

import json
import threading
from pathlib import Path

from ..paths import COMMUNITY_DIR, DEFAULT_USER, workspace_dir
from .posts import POSTS

COMMUNITY_DIR.mkdir(parents=True, exist_ok=True)
_STATE_FILE = COMMUNITY_DIR / "state.json"
_LOCK = threading.Lock()  # ThreadingHTTPServer 워커 간 state.json 쓰기 보호

_ACTIONS = {"view": ("views", 1), "like": ("likes", 1), "unlike": ("likes", -1),
            "bookmark": ("bookmarks", 1), "unbookmark": ("bookmarks", -1)}

_COMMENTS_FILE = COMMUNITY_DIR / "comments.json"

# 시드 댓글 — 글과 같은 원칙: 페르소나는 가상, 기술 내용은 검증 가능한 사실만
_SEED_COMMENTS = {
    "err-001": [
        {"author": "ml_sora", "created_at": "2026-08-29",
         "text": "grad_accum을 걸고도 OOM이면 max_length부터 줄여보세요. 512→256만 해도 활성화 메모리가 크게 떨어집니다."},
        {"author": "fresh_mj", "created_at": "2026-08-30",
         "text": "덕분에 3060에서 klue/bert 파인튜닝 성공했습니다. empty_cache()가 근본 해결이 아니라는 부분이 특히 도움됐어요."},
    ],
    "res-001": [
        {"author": "cju_ai_21", "created_at": "2026-08-28",
         "text": "lr 3e-5로 올리면 수렴은 빨라지는데 최종 F1이 조금 떨어졌습니다. YNAT은 2e-5가 안정적이네요."},
    ],
    "qna-010": [
        {"author": "nlp_jun", "created_at": "2026-07-25",
         "text": "면접에서 OOM 잡은 과정을 5분 넘게 물어봤습니다. 성공 지표 나열보다 디버깅 서사가 확실히 먹힙니다."},
    ],
    "data-003": [
        {"author": "data_yj", "created_at": "2026-08-22",
         "text": "NSMC는 라벨 노이즈가 있어서 90% 초중반이 사실상 상한선이라는 점도 참고하세요."},
    ],
}

_BY_ID = {p["id"]: p for p in POSTS}


def _load_state() -> dict:
    if not _STATE_FILE.exists():
        return {}
    return json.loads(_STATE_FILE.read_text(encoding="utf-8"))


def list_posts() -> list[dict]:
    """시드 글 + 상호작용 델타 merge. 프론트에 그대로 내려간다."""
    state = _load_state()
    merged = []
    for p in POSTS:
        delta = state.get(p["id"], {})
        item = {**p, "practice_available": bool(p["practice"])}
        if p["practice"]:
            item["practice_command"] = f"python {p['practice']['filename']}"
        item.pop("practice")  # 코드 본문은 목록 응답에서 제외 (스테이징 시점에 사용)
        for key in ("views", "likes", "bookmarks"):
            item[key] = p[key] + delta.get(key, 0)
        merged.append(item)
    return merged


def interact(post_id: str, action: str) -> dict:
    """추천/조회/즐겨찾기 증감. 갱신된 카운트를 돌려준다."""
    if post_id not in _BY_ID:
        raise KeyError(f"존재하지 않는 글: {post_id}")
    if action not in _ACTIONS:
        raise ValueError(f"지원하지 않는 action: {action}")
    field, step = _ACTIONS[action]
    with _LOCK:
        state = _load_state()
        entry = state.setdefault(post_id, {})
        entry[field] = max(0, entry.get(field, 0) + step)
        _STATE_FILE.write_text(json.dumps(state, ensure_ascii=False, indent=1), encoding="utf-8")
    base = _BY_ID[post_id]
    return {key: base[key] + state[post_id].get(key, 0) for key in ("views", "likes", "bookmarks")}


def list_comments(post_id: str) -> list[dict]:
    """시드 댓글 + 사용자가 단 댓글(comments.json)."""
    if post_id not in _BY_ID:
        raise KeyError(f"존재하지 않는 글: {post_id}")
    stored = {}
    if _COMMENTS_FILE.exists():
        stored = json.loads(_COMMENTS_FILE.read_text(encoding="utf-8"))
    return list(_SEED_COMMENTS.get(post_id, [])) + stored.get(post_id, [])


def add_comment(post_id: str, author: str, text: str) -> list[dict]:
    """댓글 추가 후 전체 목록 반환. 로컬 데모라 인증은 없다."""
    if post_id not in _BY_ID:
        raise KeyError(f"존재하지 않는 글: {post_id}")
    text = (text or "").strip()
    if not text:
        raise ValueError("댓글 내용이 비어 있습니다.")
    if len(text) > 1000:
        raise ValueError("댓글은 1,000자 이내로 작성해 주세요.")
    author = (author or "").strip()[:30] or "익명"
    from datetime import date
    entry = {"author": author, "text": text, "created_at": date.today().isoformat()}
    with _LOCK:
        stored = json.loads(_COMMENTS_FILE.read_text(encoding="utf-8")) if _COMMENTS_FILE.exists() else {}
        stored.setdefault(post_id, []).append(entry)
        _COMMENTS_FILE.write_text(json.dumps(stored, ensure_ascii=False, indent=1), encoding="utf-8")
    return list_comments(post_id)


def stage_practice(post_id: str, user: str = DEFAULT_USER) -> dict:
    """글의 실습 코드를 사용자 워크스페이스에 저장하고 IDE 실행 정보를 돌려준다."""
    post = _BY_ID.get(post_id)
    if post is None:
        raise KeyError(f"존재하지 않는 글: {post_id}")
    practice = post["practice"]
    if not practice:
        raise ValueError("이 글에는 실습 코드가 없습니다.")
    ws = workspace_dir(user)
    ws.mkdir(parents=True, exist_ok=True)
    target = ws / practice["filename"]
    header = f'# 출처: plAI-ground 커뮤니티 "{post["title"]}" ({post["id"]})\n'
    if post.get("source"):
        header += f'# 참고: {post["source"]["name"]} — {post["source"]["url"]}\n'
    target.write_text(header + "\n" + practice["code"], encoding="utf-8")
    rel = practice['filename']  # 컨테이너 /workspace 기준
    return {
        "post_id": post_id,
        "title": post["title"],
        "script_path": rel,
        "run_command": f"python {rel}",
    }


def demo() -> None:
    posts = list_posts()
    assert len(posts) == 40 and "practice" not in posts[0] and "practice_available" in posts[0]
    before = interact("err-001", "view")
    after = interact("err-001", "view")
    assert after["views"] == before["views"] + 1
    staged = stage_practice("res-002")
    assert (workspace_dir() / staged["script_path"]).exists()
    print(f"service.py self-check OK - staged={staged['script_path']}, views={after['views']}")


if __name__ == "__main__":
    demo()
