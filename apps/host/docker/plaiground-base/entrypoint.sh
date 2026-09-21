#!/usr/bin/env bash
# entrypoint.sh — 컨테이너 시작 시 1회 실행.
#
# 호출 계약 (LocalDockerAdapter가 `docker run`에 넘겨야 하는 것):
#   -v <repo_root>:/workspace          레포 전체를 마운트 (portfolio_demo, ai_set_demo 포함)
#   -e MODEL_REQUIREMENTS_FILE=<path>  (선택) 모델별 추가 pip 패키지 목록 파일 경로
#   -p 127.0.0.1:<port>:8080           호스트 루프백에만 바인딩 — 절대 0.0.0.0으로 열지 말 것
#
# ponytail: 인증 없이(--auth none) 띄운다. LAN/외부 노출 시 반드시 --auth password로
# 바꿔야 하는 천장이 있음 — 지금은 로컬 루프백 전용이라 괜찮음.
set -euo pipefail

if [[ -n "${MODEL_REQUIREMENTS_FILE:-}" ]]; then
  if [[ -f "$MODEL_REQUIREMENTS_FILE" ]]; then
    echo "[entrypoint] installing model-specific requirements: $MODEL_REQUIREMENTS_FILE"
    pip install --no-cache-dir -r "$MODEL_REQUIREMENTS_FILE"
  else
    echo "[entrypoint] warning: MODEL_REQUIREMENTS_FILE=$MODEL_REQUIREMENTS_FILE not found, skipping" >&2
  fi
fi

# 준비 완료 표시. provisioner의 ensure_ready()가 이 파일이 생길 때까지 기다린다 —
# 없으면 모델별 pip install이 끝나기 전에 docker exec으로 학습이 시작된다.
touch /tmp/.plaiground_ready

exec code-server --bind-addr 0.0.0.0:8080 --auth none /workspace
