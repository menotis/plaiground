# plaiground-base
#
# 공용 베이스 이미지 1개: CUDA + PyTorch + code-server(오픈소스 VS Code 웹 IDE).
# 근거: ai_set_demo/DECISION_ENV_PROVISIONING.md 어댑터 D.
#
# 여기 안 들어있는 것 (의도적):
# - portfolio_demo/, ai_set_demo/ 소스 코드: 이미지에 굽지 않는다. `docker run`에서
#   레포 루트를 /workspace로 bind mount 한다. 텔레메트리/제너레이터 코드가 계속
#   바뀌는 단계라, 코드 한 줄 바꿀 때마다 이미지 재빌드하지 않기 위함.
# - 모델별 라이브러리(transformers 추가옵션 등 세부 버전): entrypoint.sh가 컨테이너
#   시작 시 동적으로 설치한다. 여기서 설치하는 건 두 MVP 모델이 공통으로 쓰는
#   무거운 레이어(torch, torchvision, transformers, datasets)뿐.

FROM nvidia/cuda:12.4.1-base-ubuntu22.04

RUN apt-get update && apt-get install -y --no-install-recommends \
        python3 python3-pip git curl ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && ln -sf /usr/bin/python3 /usr/bin/python

# nvidia/cuda 베이스 이미지에 기본 포함된 CUDA Forward-Compat 패키지를 제거한다.
# 이 패키지가 /usr/lib/x86_64-linux-gnu/libcuda.so.1에 2023년 구버전을 미리 깔아두면,
# Docker Desktop WSL2 GPU 주입이 "이미 파일이 있다"고 보고 실제 호스트 드라이버
# libcuda.so로 덮어쓰지 않는다 (libnvidia-ml.so.1은 이 자리에 없어서 정상 주입됨 —
# nvidia-smi는 되는데 torch.cuda.is_available()이 False인 증상으로 나타남).
# 우리 대상 드라이버(로컬 GPU, RunPod A5000/A6000)는 CUDA 12.1보다 훨씬 최신이라
# forward-compat 자체가 필요 없다.
RUN apt-get remove -y --purge cuda-compat-12-4 2>/dev/null || true

# code-server: 오픈소스 VS Code 웹 IDE. 직접 구현하지 않고 공식 설치 스크립트 사용.
RUN curl -fsSL https://code-server.dev/install.sh | sh

# 공용 ML 스택 — klue-bert-finetune, mnist-cnn-lite 두 모델이 공유하는 무거운 레이어.
# torch/torchvision은 반드시 같은 pip 호출에서 cu121 인덱스로 함께 설치할 것 —
# 따로 설치하면 torchvision이 PyPI 기본 인덱스에서 최신 torch(CUDA 13계열)를
# 별도로 끌어와 검증된 드라이버(CUDA 12.x)와 버전이 어긋난다.
RUN pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cu124 \
    && pip install --no-cache-dir \
        transformers \
        datasets \
        scikit-learn \
        pydantic \
        jinja2

WORKDIR /workspace
EXPOSE 8080

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
