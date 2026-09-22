# -*- coding: utf-8 -*-
"""posts.py의 글 40건을 Supabase posts 테이블 INSERT SQL로 출력한다.

사용법:
    python plaiground_deployment/supabase/seed_posts.py > plaiground_deployment/supabase/migrations/0002_seed_posts.sql

views/likes/bookmarks는 가상 시드값이라 옮기지 않는다(집계는 post_interactions에서 시작).
"""
import sys

from plaiground_host.community.posts import POSTS

# Windows 콘솔(cp949) 리다이렉트에서도 UTF-8로 나가게 고정
sys.stdout.reconfigure(encoding="utf-8")


def lit(value):
    if value is None:
        return "null"
    return "'" + str(value).replace("'", "''") + "'"


def tags_lit(tags):
    if not tags:
        return "'{}'"
    return "array[" + ", ".join(lit(t) for t in tags) + "]"


def main():
    print("-- 0002_seed_posts.sql — 커뮤니티 글 40건 시드 (B2-3)")
    print("-- 생성: python plaiground_deployment/supabase/seed_posts.py")
    print("-- 실행: service_role 권한인 SQL Editor에서만 (posts는 쓰기 정책이 없다)")
    print()
    for p in POSTS:
        source = p.get("source") or {}
        practice = p.get("practice") or {}
        cols = (
            "id, category, title, summary, content, tags, author, "
            "source_name, source_url, practice_filename, practice_code, created_at"
        )
        vals = ", ".join(
            [
                lit(p["id"]),
                lit(p["category"]),
                lit(p["title"]),
                lit(p.get("summary")),
                lit(p.get("content")),
                tags_lit(p.get("tags")),
                lit(p.get("author")),
                lit(source.get("name")),
                lit(source.get("url")),
                lit(practice.get("filename")),
                lit(practice.get("code")),
                lit(p.get("created_at")),
            ]
        )
        print(f"insert into posts ({cols})\nvalues ({vals});")
        print()


if __name__ == "__main__":
    main()
