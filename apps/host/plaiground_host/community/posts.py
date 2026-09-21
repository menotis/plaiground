# -*- coding: utf-8 -*-
"""
posts.py — 커뮤니티 시드 글 40건 (카테고리별 10건).

가상의 AI 전공생/실습생 페르소나가 작성했다는 설정이지만, 인용하는 데이터셋·에러·
해결책·출처(URL)는 전부 실재하는 것만 쓴다. practice가 있는 글은 '실습해보기'를
누르면 코드가 var/generated/에 저장되어 Web IDE에서 바로 실행할 수 있다.

숫자(views/likes/bookmarks)는 시드값이며, 사용자 상호작용 델타는 state.json에 쌓인다.
"""

POSTS = [
    # ─── 오류해결 (err) ────────────────────────────────────────────────────────
    {
        "id": "err-001", "category": "오류해결",
        "title": "CUDA out of memory — batch_size만 줄이지 말고 Gradient Accumulation을 쓰자",
        "summary": "OOM에서 실효 배치를 유지한 채 VRAM 피크만 낮추는 표준 패턴 정리.",
        "content": "RTX 3060 12GB에서 klue/bert-base 파인튜닝 중 'CUDA out of memory. Tried to allocate 2.50 GiB'를 만났습니다. batch_size 64→16으로 줄이고 gradient_accumulation_steps=4를 걸면 실효 배치 64를 유지하면서 메모리 피크가 크게 내려갑니다. torch.cuda.empty_cache()는 근본 해결이 아니라는 점도 PyTorch 공식 문서에 명시돼 있습니다.",
        "tags": ["CUDA", "OOM", "PyTorch", "GradientAccumulation"],
        "views": 2841, "likes": 163, "bookmarks": 97, "created_at": "2026-08-28", "author": "cju_ai_21",
        "source": {"name": "PyTorch CUDA semantics", "url": "https://pytorch.org/docs/stable/notes/cuda.html"},
        "practice": {
            "filename": "community_grad_accum.py",
            "code": '''"""Gradient Accumulation 패턴 최소 재현 (GPU 없어도 CPU로 동작)."""
import torch, torch.nn as nn

model = nn.Linear(128, 2)
opt = torch.optim.AdamW(model.parameters(), lr=2e-5)
loss_fn = nn.CrossEntropyLoss()
accum = 4  # 실효 배치 = micro_batch(16) x 4 = 64

opt.zero_grad()
for step in range(8):
    x, y = torch.randn(16, 128), torch.randint(0, 2, (16,))
    loss = loss_fn(model(x), y) / accum
    loss.backward()
    if (step + 1) % accum == 0:
        opt.step(); opt.zero_grad()
        print(f"step {step+1}: optimizer.step() (accumulated {accum} micro-batches)")
print("done - VRAM 피크는 micro_batch 크기에만 비례합니다")
''',
        },
    },
    {
        "id": "err-002", "category": "오류해결",
        "title": "LlamaTokenizer 'pad_token' KeyError — eos_token을 pad로 지정하면 끝",
        "summary": "Llama 계열 토크나이저는 pad_token이 기본 정의되지 않아 배치 패딩에서 터진다.",
        "content": "Llama 계열 모델은 사전학습 시 패딩을 쓰지 않아 tokenizer.pad_token이 None입니다. DataCollator가 패딩을 시도하는 순간 KeyError/ValueError가 납니다. Hugging Face 공식 권장대로 tokenizer.pad_token = tokenizer.eos_token 한 줄이면 해결됩니다.",
        "tags": ["HuggingFace", "Llama", "Tokenizer", "pad_token"],
        "views": 1922, "likes": 118, "bookmarks": 88, "created_at": "2026-08-25", "author": "nlp_jun",
        "source": {"name": "HF Transformers - Padding & truncation", "url": "https://huggingface.co/docs/transformers/pad_truncation"},
        "practice": None,
    },
    {
        "id": "err-003", "category": "오류해결",
        "title": "ImportError: Using the Trainer with PyTorch requires accelerate>=0.26",
        "summary": "transformers 최신 버전에서 Trainer를 쓰려면 accelerate를 명시적으로 설치해야 한다.",
        "content": "pip install transformers만 하고 Trainer를 쓰면 accelerate 버전 오류가 납니다. transformers는 학습 경로에서 accelerate에 의존하며, 'pip install \"transformers[torch]\"' 또는 'pip install accelerate -U'로 해결됩니다. 컨테이너 이미지를 만들 때 requirements에 accelerate를 고정해 두는 게 안전합니다.",
        "tags": ["transformers", "accelerate", "ImportError", "환경설정"],
        "views": 1710, "likes": 92, "bookmarks": 60, "created_at": "2026-08-22", "author": "cju_ai_21",
        "source": {"name": "HF Transformers installation", "url": "https://huggingface.co/docs/transformers/installation"},
        "practice": None,
    },
    {
        "id": "err-004", "category": "오류해결",
        "title": "Windows에서 DataLoader num_workers>0이면 멈추는 문제",
        "summary": "if __name__ == '__main__' 가드 없이는 spawn 방식 멀티프로세싱이 무한 재귀한다.",
        "content": "Windows는 fork가 없어 DataLoader 워커를 spawn으로 띄웁니다. 학습 코드가 모듈 최상위에 있으면 워커가 스크립트를 다시 import하며 무한 재귀/프리징이 발생합니다. PyTorch 공식 FAQ대로 학습 진입점을 if __name__ == '__main__': 아래로 옮기면 해결됩니다.",
        "tags": ["PyTorch", "DataLoader", "Windows", "multiprocessing"],
        "views": 1544, "likes": 77, "bookmarks": 52, "created_at": "2026-08-19", "author": "vision_hb",
        "source": {"name": "PyTorch Windows FAQ", "url": "https://pytorch.org/docs/stable/notes/windows.html"},
        "practice": None,
    },
    {
        "id": "err-005", "category": "오류해결",
        "title": "fp16 학습 중 loss가 NaN — GradScaler 없이 half()만 부르면 터진다",
        "summary": "혼합 정밀도는 autocast + GradScaler 세트로 써야 언더플로를 막는다.",
        "content": "model.half()로 강제 fp16을 걸면 작은 gradient가 0으로 언더플로되어 loss가 NaN이 됩니다. torch.autocast와 torch.cuda.amp.GradScaler를 함께 쓰는 것이 공식 AMP 레시피입니다. 스케일러가 gradient를 키웠다가 step 전에 되돌려 언더플로를 방지합니다.",
        "tags": ["AMP", "fp16", "NaN", "GradScaler"],
        "views": 1288, "likes": 71, "bookmarks": 49, "created_at": "2026-08-16", "author": "ml_sora",
        "source": {"name": "PyTorch AMP recipe", "url": "https://pytorch.org/tutorials/recipes/recipes/amp_recipe.html"},
        "practice": {
            "filename": "community_amp_pattern.py",
            "code": '''"""AMP(autocast + GradScaler) 표준 패턴. CUDA 없으면 CPU autocast로 대체 동작."""
import torch, torch.nn as nn

device = "cuda" if torch.cuda.is_available() else "cpu"
model = nn.Linear(64, 2).to(device)
opt = torch.optim.SGD(model.parameters(), lr=0.1)
scaler = torch.cuda.amp.GradScaler(enabled=(device == "cuda"))

for step in range(3):
    x = torch.randn(32, 64, device=device)
    y = torch.randint(0, 2, (32,), device=device)
    with torch.autocast(device_type=device, enabled=True):
        loss = nn.functional.cross_entropy(model(x), y)
    opt.zero_grad()
    scaler.scale(loss).backward()
    scaler.step(opt)
    scaler.update()
    print(f"step {step}: loss={loss.item():.4f} (finite={torch.isfinite(loss).item()})")
''',
        },
    },
    {
        "id": "err-006", "category": "오류해결",
        "title": "RuntimeError: CUDA error: no kernel image — 드라이버/휠 조합 확인법",
        "summary": "설치된 torch 휠의 CUDA 버전과 GPU 아키텍처가 안 맞을 때 나는 에러.",
        "content": "오래된 torch 휠(cu113 등)을 최신 GPU에서 돌리면 'no kernel image is available for execution'이 납니다. python -c \"import torch; print(torch.version.cuda, torch.cuda.get_arch_list())\"로 휠의 지원 아키텍처를 확인하고, pytorch.org 공식 설치 매트릭스에서 GPU에 맞는 휠을 다시 받는 것이 정석입니다.",
        "tags": ["CUDA", "PyTorch", "드라이버", "설치"],
        "views": 1149, "likes": 58, "bookmarks": 44, "created_at": "2026-08-12", "author": "vision_hb",
        "source": {"name": "PyTorch Get Started (설치 매트릭스)", "url": "https://pytorch.org/get-started/locally/"},
        "practice": None,
    },
    {
        "id": "err-007", "category": "오류해결",
        "title": "Hugging Face 캐시가 C 드라이브를 다 먹을 때 — HF_HOME 옮기기",
        "summary": "모델/데이터셋 캐시 위치는 환경변수 하나로 다른 드라이브로 옮길 수 있다.",
        "content": "기본 캐시는 ~/.cache/huggingface에 쌓여 수십 GB가 됩니다. HF_HOME(또는 HF_HUB_CACHE) 환경변수를 D 드라이브로 지정하면 이후 다운로드가 그쪽에 저장됩니다. 공식 문서의 'Manage huggingface_hub cache' 항목에 옮기는 절차가 정리돼 있습니다.",
        "tags": ["HuggingFace", "캐시", "디스크", "환경변수"],
        "views": 987, "likes": 51, "bookmarks": 63, "created_at": "2026-08-09", "author": "nlp_jun",
        "source": {"name": "HF Hub cache 관리", "url": "https://huggingface.co/docs/huggingface_hub/guides/manage-cache"},
        "practice": None,
    },
    {
        "id": "err-008", "category": "오류해결",
        "title": "Tokenizer max_length 경고 무시했다가 성능 하락 — truncation 명시하기",
        "summary": "'Token indices sequence length is longer than…' 경고는 실제로 입력이 잘려나간다는 뜻.",
        "content": "BERT 계열은 최대 512 토큰입니다. truncation=True, max_length=512를 명시하지 않으면 긴 문서가 조용히 잘리거나 인덱스 에러가 납니다. 문서 분류라면 앞부분 512토큰만으로도 성능이 유지되는지 검증 셋으로 먼저 확인하는 습관이 필요합니다.",
        "tags": ["Tokenizer", "truncation", "BERT", "max_length"],
        "views": 861, "likes": 39, "bookmarks": 28, "created_at": "2026-08-05", "author": "ml_sora",
        "source": {"name": "HF Padding & truncation", "url": "https://huggingface.co/docs/transformers/pad_truncation"},
        "practice": None,
    },
    {
        "id": "err-009", "category": "오류해결",
        "title": "Docker 컨테이너에서 GPU가 안 잡힐 때 체크리스트 (--gpus all)",
        "summary": "nvidia-smi는 되는데 컨테이너 안에서 torch.cuda.is_available()이 False인 경우.",
        "content": "docker run에 --gpus all 플래그를 빼먹었거나 NVIDIA Container Toolkit이 설치되지 않은 경우가 대부분입니다. 'docker run --rm --gpus all nvidia/cuda:12.1.0-base-ubuntu22.04 nvidia-smi'로 툴킷 동작을 먼저 검증하는 것이 NVIDIA 공식 가이드 순서입니다.",
        "tags": ["Docker", "GPU", "NVIDIA", "ContainerToolkit"],
        "views": 812, "likes": 46, "bookmarks": 39, "created_at": "2026-08-02", "author": "infra_dw",
        "source": {"name": "NVIDIA Container Toolkit 설치 가이드", "url": "https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html"},
        "practice": None,
    },
    {
        "id": "err-010", "category": "오류해결",
        "title": "학습이 재현이 안 될 때 — seed 고정만으로는 부족하다",
        "summary": "torch/numpy/random 시드에 더해 cudnn deterministic 설정까지 걸어야 한다.",
        "content": "같은 시드인데 결과가 달라지는 건 cuDNN의 비결정적 커널 때문입니다. torch.use_deterministic_algorithms(True)와 cudnn.benchmark=False 설정이 공식 재현성 가이드에 있습니다. 속도가 느려질 수 있으니 디버깅 때만 켜는 것을 권장합니다.",
        "tags": ["재현성", "seed", "cuDNN", "PyTorch"],
        "views": 733, "likes": 41, "bookmarks": 35, "created_at": "2026-07-29", "author": "cju_ai_21",
        "source": {"name": "PyTorch Reproducibility", "url": "https://pytorch.org/docs/stable/notes/randomness.html"},
        "practice": None,
    },

    # ─── 학습 결과 (res) ───────────────────────────────────────────────────────
    {
        "id": "res-001", "category": "학습 결과",
        "title": "KLUE-YNAT 뉴스 토픽 분류 — klue/bert-base 파인튜닝 F1 0.86 달성기",
        "summary": "3 epoch, lr 2e-5, batch 16 조합으로 검증 macro F1 0.86 재현.",
        "content": "KLUE 벤치마크의 YNAT(연합뉴스 토픽 분류, 7클래스) 태스크를 klue/bert-base로 파인튜닝했습니다. KLUE 논문의 베이스라인과 유사한 lr 2e-5, batch 16, 3 epoch 설정으로 검증 macro F1 0.86 부근이 재현됩니다. 데이터셋과 리더보드는 Hugging Face klue 저장소에서 그대로 받을 수 있습니다.",
        "tags": ["KLUE", "BERT", "텍스트분류", "파인튜닝"],
        "views": 2103, "likes": 141, "bookmarks": 119, "created_at": "2026-08-27", "author": "nlp_jun",
        "source": {"name": "KLUE 벤치마크 (Hugging Face)", "url": "https://huggingface.co/datasets/klue/klue"},
        "practice": {
            "filename": "community_klue_ynat.py",
            "code": '''"""KLUE-YNAT 데이터셋 로드 + 라벨 분포 확인 (datasets 라이브러리 필요)."""
from datasets import load_dataset
from collections import Counter

ds = load_dataset("klue", "ynat")  # 실제 KLUE 벤치마크 데이터
print(ds)
labels = ds["train"].features["label"].names
dist = Counter(ds["train"]["label"])
for i, name in enumerate(labels):
    print(f"{name:12s} {dist[i]:6d}건")
print("\\n다음 단계: klue/bert-base 로드 후 Trainer로 3 epoch 파인튜닝 (lr=2e-5, batch=16)")
''',
        },
    },
    {
        "id": "res-002", "category": "학습 결과",
        "title": "MNIST CNN 3 epoch 만에 정확도 99.0% — 입문 실습 결과 공유",
        "summary": "Conv 2층 + FC 구조, CPU로도 10분 내 학습 완료.",
        "content": "torchvision 내장 MNIST(6만 장)로 Conv2d 두 층짜리 CNN을 3 epoch 학습해 테스트 정확도 99.0%가 나왔습니다. GPU 없이 CPU로도 10분 내로 끝나서 환경 검증용 첫 실습으로 추천합니다. PyTorch 공식 examples 저장소의 mnist 예제와 같은 구조입니다.",
        "tags": ["MNIST", "CNN", "torchvision", "입문"],
        "views": 1876, "likes": 97, "bookmarks": 74, "created_at": "2026-08-24", "author": "vision_hb",
        "source": {"name": "pytorch/examples - mnist", "url": "https://github.com/pytorch/examples/tree/main/mnist"},
        "practice": {
            "filename": "community_mnist_quick.py",
            "code": '''"""MNIST 미니 학습 - 1 epoch 축약판 (torchvision이 데이터 자동 다운로드)."""
import torch, torch.nn as nn
from torchvision import datasets, transforms
from torch.utils.data import DataLoader

def main():
    tfm = transforms.ToTensor()
    train = datasets.MNIST("./data", train=True, download=True, transform=tfm)
    loader = DataLoader(train, batch_size=128, shuffle=True)
    model = nn.Sequential(nn.Flatten(), nn.Linear(784, 128), nn.ReLU(), nn.Linear(128, 10))
    opt = torch.optim.Adam(model.parameters(), lr=1e-3)
    for i, (x, y) in enumerate(loader):
        loss = nn.functional.cross_entropy(model(x), y)
        opt.zero_grad(); loss.backward(); opt.step()
        if i % 100 == 0:
            print(f"batch {i}: loss={loss.item():.4f}")
        if i >= 300:
            break
    print("완료 - 전체 3 epoch을 돌리면 단순 MLP로도 ~97%, CNN이면 ~99%까지 갑니다")

if __name__ == "__main__":
    main()
''',
        },
    },
    {
        "id": "res-003", "category": "학습 결과",
        "title": "NSMC 영화리뷰 감성분석 — KcELECTRA로 정확도 90% 넘긴 기록",
        "summary": "댓글체 데이터엔 댓글로 사전학습된 KcELECTRA가 klue/bert보다 유리했다.",
        "content": "네이버 영화리뷰 NSMC(20만 문장, 긍/부정)를 beomi/KcELECTRA-base로 파인튜닝해 테스트 정확도 90%대 초반을 얻었습니다. NSMC는 e9t/nsmc 저장소에서 공개 배포되는 실제 데이터셋이고, KcELECTRA는 한국어 댓글로 사전학습되어 구어체에 강합니다.",
        "tags": ["NSMC", "감성분석", "KcELECTRA", "한국어NLP"],
        "views": 1650, "likes": 105, "bookmarks": 92, "created_at": "2026-08-21", "author": "ml_sora",
        "source": {"name": "NSMC (e9t/nsmc)", "url": "https://github.com/e9t/nsmc"},
        "practice": {
            "filename": "community_nsmc_load.py",
            "code": '''"""NSMC 데이터 로드 - 공개 저장소 raw 파일을 pandas로 바로 읽는다."""
import pandas as pd

url = "https://raw.githubusercontent.com/e9t/nsmc/master/ratings_train.txt"
df = pd.read_csv(url, sep="\\t")
print(df.shape)                       # (150000, 3)
print(df["label"].value_counts())     # 긍정/부정 균형 확인
print(df.sample(5, random_state=42)[["document", "label"]].to_string(index=False))
print("\\n다음 단계: beomi/KcELECTRA-base 토크나이저로 인코딩 후 파인튜닝")
''',
        },
    },
    {
        "id": "res-004", "category": "학습 결과",
        "title": "CIFAR-10에서 ResNet-18 전이학습 vs 스크래치 — 92% vs 85%",
        "summary": "ImageNet 사전학습 가중치로 시작하면 같은 epoch에서 7%p 차이가 났다.",
        "content": "CIFAR-10(6만 장, 10클래스)에서 torchvision의 resnet18을 (1) 랜덤 초기화, (2) IMAGENET1K_V1 가중치로 각각 20 epoch 학습해 비교했습니다. 전이학습 쪽이 92%대, 스크래치는 85%대로 수렴 속도와 최종 정확도 모두 앞섰습니다. 32x32 입력이라 첫 conv를 3x3으로 바꾸는 관례도 적용했습니다.",
        "tags": ["CIFAR10", "ResNet", "전이학습", "torchvision"],
        "views": 1421, "likes": 83, "bookmarks": 66, "created_at": "2026-08-18", "author": "vision_hb",
        "source": {"name": "CIFAR-10 (공식 배포처)", "url": "https://www.cs.toronto.edu/~kriz/cifar.html"},
        "practice": {
            "filename": "community_cifar10_load.py",
            "code": '''"""CIFAR-10 로드 + 클래스 분포/텐서 shape 확인 (자동 다운로드 ~170MB)."""
from torchvision import datasets, transforms

train = datasets.CIFAR10("./data", train=True, download=True, transform=transforms.ToTensor())
print(f"train: {len(train)}장, 클래스: {train.classes}")
x, y = train[0]
print(f"이미지 텐서 shape: {tuple(x.shape)}, 라벨: {train.classes[y]}")
print("\\n다음 단계: torchvision.models.resnet18(weights='IMAGENET1K_V1')로 전이학습")
''',
        },
    },
    {
        "id": "res-005", "category": "학습 결과",
        "title": "KorQuAD 1.0 리딩컴프리헨션 — klue/roberta-base로 EM 84 부근",
        "summary": "한국어 SQuAD 포맷 QA, 학습 3 epoch에 EM/F1이 공개 베이스라인 수준으로 수렴.",
        "content": "KorQuAD 1.0(위키 기반 한국어 QA, 7만 질문)을 klue/roberta-base로 파인튜닝했습니다. 공식 리더보드의 BERT 계열 베이스라인과 비슷한 EM 84/F1 92 부근이 나옵니다. 데이터는 korquad.github.io에서 공개 배포되며 Hugging Face에는 squad_kor_v1로 등록돼 있습니다.",
        "tags": ["KorQuAD", "QA", "RoBERTa", "한국어NLP"],
        "views": 1180, "likes": 69, "bookmarks": 58, "created_at": "2026-08-14", "author": "nlp_jun",
        "source": {"name": "KorQuAD 공식", "url": "https://korquad.github.io/KorQuad%201.0/"},
        "practice": {
            "filename": "community_korquad_load.py",
            "code": '''"""KorQuAD 1.0 로드 - Hugging Face datasets에 squad_kor_v1로 등록되어 있다."""
from datasets import load_dataset

ds = load_dataset("squad_kor_v1")
print(ds)
sample = ds["train"][0]
print("질문:", sample["question"])
print("정답:", sample["answers"]["text"][0])
print("\\n다음 단계: klue/roberta-base + QuestionAnswering 헤드로 파인튜닝")
''',
        },
    },
    {
        "id": "res-006", "category": "학습 결과",
        "title": "YOLOv8n으로 COCO128 미니 학습 — 10 epoch 결과와 mAP 읽는 법",
        "summary": "ultralytics 패키지 기본 예제 그대로, 노트북 GPU에서 5분 학습.",
        "content": "ultralytics의 yolov8n을 COCO128(128장 미니 데이터셋)로 10 epoch 돌리는 공식 퀵스타트를 따라 했습니다. mAP50-95, precision/recall 곡선이 runs/ 폴더에 자동 저장되어 지표 읽는 연습에 좋습니다. 실전 데이터로 가기 전 파이프라인 검증용으로 추천합니다.",
        "tags": ["YOLOv8", "ObjectDetection", "COCO", "ultralytics"],
        "views": 1098, "likes": 61, "bookmarks": 47, "created_at": "2026-08-11", "author": "vision_hb",
        "source": {"name": "Ultralytics YOLOv8 Docs", "url": "https://docs.ultralytics.com/modes/train/"},
        "practice": None,
    },
    {
        "id": "res-007", "category": "학습 결과",
        "title": "LoRA로 7B 모델을 12GB GPU에서 — r=8 설정 학습 로그 공유",
        "summary": "전체 파인튜닝 대비 학습 파라미터 0.1%로 손실이 안정적으로 수렴했다.",
        "content": "PEFT 라이브러리의 LoRA(r=8, alpha=16, q/v_proj 대상)로 7B 모델을 4bit 양자화(QLoRA)와 함께 12GB GPU에서 학습했습니다. 학습 가능한 파라미터가 전체의 0.1% 수준이라 옵티마이저 메모리가 급감합니다. 설정값은 PEFT 공식 문서의 권장 범위를 따랐습니다.",
        "tags": ["LoRA", "QLoRA", "PEFT", "LLM"],
        "views": 1755, "likes": 122, "bookmarks": 108, "created_at": "2026-08-08", "author": "ml_sora",
        "source": {"name": "HF PEFT LoRA 문서", "url": "https://huggingface.co/docs/peft/conceptual_guides/lora"},
        "practice": None,
    },
    {
        "id": "res-008", "category": "학습 결과",
        "title": "Titanic 생존 예측 — 피처 엔지니어링 전후 정확도 0.78 → 0.83",
        "summary": "결측 처리와 파생변수(가족 수, 호칭)만으로 로지스틱 회귀 성능이 5%p 상승.",
        "content": "Kaggle 입문 대회 Titanic으로 전처리 효과를 실험했습니다. Age 결측을 호칭(Mr/Mrs/Miss) 그룹 중앙값으로 채우고 SibSp+Parch로 가족 수 파생변수를 만들었더니 5-fold 교차검증 정확도가 0.78에서 0.83으로 올랐습니다. seaborn 내장 titanic 데이터로도 같은 실험이 가능합니다.",
        "tags": ["Kaggle", "Titanic", "전처리", "피처엔지니어링"],
        "views": 1332, "likes": 74, "bookmarks": 55, "created_at": "2026-08-04", "author": "data_yj",
        "source": {"name": "Kaggle Titanic Competition", "url": "https://www.kaggle.com/competitions/titanic"},
        "practice": {
            "filename": "community_titanic_features.py",
            "code": '''"""Titanic 피처 엔지니어링 실험 - seaborn 내장 데이터셋으로 재현."""
import seaborn as sns
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import cross_val_score

df = sns.load_dataset("titanic").copy()
df["family"] = df["sibsp"] + df["parch"]
df["age"] = df["age"].fillna(df.groupby("class", observed=True)["age"].transform("median"))
X = pd.get_dummies(df[["pclass", "sex", "age", "fare", "family"]], drop_first=True).fillna(0)
y = df["survived"]
score = cross_val_score(LogisticRegression(max_iter=1000), X, y, cv=5).mean()
print(f"5-fold 평균 정확도: {score:.3f} (파생변수 family + age 결측 보정 적용)")
''',
        },
    },
    {
        "id": "res-009", "category": "학습 결과",
        "title": "Early Stopping 적용 전후 — 과적합 곡선이 이렇게 달라진다",
        "summary": "patience=3으로 검증 손실 기준 조기 종료, 테스트 성능은 오히려 상승.",
        "content": "AG News 분류에서 10 epoch를 다 돌리면 8 epoch부터 검증 손실이 올라가는 전형적 과적합이 보였습니다. patience=3 조기 종료를 걸자 6 epoch에서 멈추고 테스트 정확도는 0.4%p 올랐습니다. Keras/PyTorch Lightning 모두 콜백 한 줄로 적용됩니다.",
        "tags": ["EarlyStopping", "과적합", "검증손실", "학습전략"],
        "views": 954, "likes": 52, "bookmarks": 40, "created_at": "2026-07-31", "author": "cju_ai_21",
        "source": {"name": "PyTorch Lightning EarlyStopping", "url": "https://lightning.ai/docs/pytorch/stable/common/early_stopping.html"},
        "practice": None,
    },
    {
        "id": "res-010", "category": "학습 결과",
        "title": "혼동행렬로 본 클래스 불균형 — accuracy 92%의 함정",
        "summary": "다수 클래스만 잘 맞히는 모델을 macro F1과 혼동행렬로 잡아냈다.",
        "content": "불균형 이진 분류(양성 8%)에서 accuracy 92%가 나왔지만 혼동행렬을 그려보니 양성 재현율이 31%였습니다. 전부 음성으로 찍어도 92%가 나오는 데이터였던 것. scikit-learn의 classification_report와 macro F1을 기본 지표로 삼는 계기가 됐습니다.",
        "tags": ["혼동행렬", "클래스불균형", "F1", "평가지표"],
        "views": 1207, "likes": 88, "bookmarks": 71, "created_at": "2026-07-27", "author": "data_yj",
        "source": {"name": "scikit-learn 평가지표 문서", "url": "https://scikit-learn.org/stable/modules/model_evaluation.html"},
        "practice": None,
    },

    # ─── Q&A (qna) ────────────────────────────────────────────────────────────
    {
        "id": "qna-001", "category": "Q&A",
        "title": "batch size를 키우면 learning rate도 같이 키워야 하나요?",
        "summary": "Linear Scaling Rule의 근거와 워밍업이 필요한 이유가 궁금합니다.",
        "content": "batch 32→256으로 키웠더니 수렴이 느려졌습니다. 'Accurate, Large Minibatch SGD' 논문(Goyal et al., 2017)의 Linear Scaling Rule처럼 lr도 8배 키우고 워밍업을 거는 게 맞을까요? 소규모 파인튜닝에도 적용되는 규칙인지 경험 공유 부탁드립니다.",
        "tags": ["LearningRate", "BatchSize", "하이퍼파라미터", "질문"],
        "views": 1489, "likes": 66, "bookmarks": 59, "created_at": "2026-08-26", "author": "cju_ai_21",
        "source": {"name": "Goyal et al. 2017 (arXiv)", "url": "https://arxiv.org/abs/1706.02677"},
        "practice": None,
    },
    {
        "id": "qna-002", "category": "Q&A",
        "title": "실험 기록은 TensorBoard vs W&B 중 뭘 쓰는 게 좋을까요?",
        "summary": "개인 프로젝트 규모에서 둘의 실질적인 차이가 궁금합니다.",
        "content": "지금은 print 로그만 쌓고 있는데 실험이 20개를 넘어가니 관리가 안 됩니다. TensorBoard는 로컬에서 무료로 끝나고, W&B는 팀 공유와 하이퍼파라미터 스윕이 편하다고 들었습니다. 캡스톤(2인 팀) 규모에서는 어느 쪽이 낫나요?",
        "tags": ["TensorBoard", "WandB", "실험관리", "질문"],
        "views": 1120, "likes": 43, "bookmarks": 37, "created_at": "2026-08-23", "author": "ml_sora",
        "source": {"name": "TensorBoard 공식", "url": "https://www.tensorflow.org/tensorboard"},
        "practice": None,
    },
    {
        "id": "qna-003", "category": "Q&A",
        "title": "Colab 무료 GPU vs 로컬 3060 — 파인튜닝 실습엔 뭐가 낫나요?",
        "summary": "세션 끊김과 VRAM 한계 사이에서 실습 환경을 고민 중입니다.",
        "content": "Colab 무료 티어는 T4를 주지만 세션이 끊기면 체크포인트가 날아가고, 로컬 3060(12GB)은 안정적이지만 VRAM이 아쉽습니다. BERT-base 파인튜닝과 7B QLoRA 실습 기준으로 어떤 조합이 현실적일까요? 체크포인트를 Drive에 붙이는 팁도 궁금합니다.",
        "tags": ["Colab", "GPU", "실습환경", "질문"],
        "views": 1345, "likes": 57, "bookmarks": 42, "created_at": "2026-08-20", "author": "vision_hb",
        "source": {"name": "Colab FAQ", "url": "https://research.google.com/colaboratory/faq.html"},
        "practice": None,
    },
    {
        "id": "qna-004", "category": "Q&A",
        "title": "데이터 증강은 언제 쓰고 언제 독이 되나요? (이미지 분류)",
        "summary": "RandAugment를 걸었더니 오히려 검증 정확도가 떨어졌습니다.",
        "content": "CIFAR-10에서 RandAugment를 추가했더니 작은 모델(ResNet-18 축소판)에서는 정확도가 떨어졌습니다. 증강 강도가 모델 용량 대비 과한 걸까요? '데이터가 적을수록 증강이 이득'이라는 통념이 항상 맞는지, 증강 강도를 고르는 기준이 궁금합니다.",
        "tags": ["데이터증강", "RandAugment", "이미지분류", "질문"],
        "views": 876, "likes": 38, "bookmarks": 29, "created_at": "2026-08-15", "author": "vision_hb",
        "source": {"name": "torchvision transforms 문서", "url": "https://pytorch.org/vision/stable/transforms.html"},
        "practice": None,
    },
    {
        "id": "qna-005", "category": "Q&A",
        "title": "검증셋 성능은 좋은데 실서비스 입력에서 무너집니다 — 분포 차이 진단법?",
        "summary": "학습/검증은 정제 문장, 실제 입력은 오타투성이 구어체라 생기는 문제 같습니다.",
        "content": "NSMC로 학습한 감성분석 모델이 실제 커뮤니티 댓글에서는 눈에 띄게 틀립니다. 학습 분포와 서비스 분포가 다른 domain shift로 보이는데, 이를 정량적으로 진단하는 방법(예: 서비스 샘플 라벨링 후 평가셋 구축)과 완화 전략이 궁금합니다.",
        "tags": ["DomainShift", "일반화", "감성분석", "질문"],
        "views": 792, "likes": 45, "bookmarks": 33, "created_at": "2026-08-10", "author": "ml_sora",
        "source": {"name": "NSMC (e9t/nsmc)", "url": "https://github.com/e9t/nsmc"},
        "practice": None,
    },
    {
        "id": "qna-006", "category": "Q&A",
        "title": "체크포인트 저장 전략 — best만 남길까요, 주기 저장할까요?",
        "summary": "디스크는 아끼고 싶고, 중단 복구도 하고 싶은 초심자 질문입니다.",
        "content": "지금은 매 epoch 저장이라 디스크가 금방 찹니다. 검증 지표 기준 best 1개 + 최신(last) 1개만 남기는 게 표준인가요? 학습 중단 후 optimizer/scheduler 상태까지 복구하려면 state_dict에 뭘 포함해야 하는지도 정리 부탁드립니다.",
        "tags": ["체크포인트", "학습재개", "state_dict", "질문"],
        "views": 684, "likes": 31, "bookmarks": 27, "created_at": "2026-08-06", "author": "cju_ai_21",
        "source": {"name": "PyTorch 체크포인트 튜토리얼", "url": "https://pytorch.org/tutorials/recipes/recipes/saving_and_loading_a_general_checkpoint.html"},
        "practice": None,
    },
    {
        "id": "qna-007", "category": "Q&A",
        "title": "한국어 임베딩 모델 추천 — 문서 검색(RAG) 용도",
        "summary": "ko-sbert 계열과 다국어 e5 계열 중 실측 비교해보신 분 있나요?",
        "content": "교내 규정 문서 검색 챗봇을 만들며 임베딩 모델을 고르고 있습니다. jhgan/ko-sroberta-multitask 같은 한국어 특화 모델과 intfloat/multilingual-e5 계열 중 한국어 검색 성능(Recall@k) 실측 경험이 궁금합니다. 벤치마크로는 MTEB 한국어 태스크를 참고하고 있습니다.",
        "tags": ["임베딩", "RAG", "한국어NLP", "질문"],
        "views": 1023, "likes": 54, "bookmarks": 61, "created_at": "2026-08-03", "author": "nlp_jun",
        "source": {"name": "MTEB 리더보드", "url": "https://huggingface.co/spaces/mteb/leaderboard"},
        "practice": None,
    },
    {
        "id": "qna-008", "category": "Q&A",
        "title": "GPU 없는 노트북으로 시작하는데 뭐부터 실습해야 할까요?",
        "summary": "CPU만으로 의미 있는 커리큘럼을 짜고 싶습니다.",
        "content": "전공 1학년이고 내장그래픽 노트북뿐입니다. MNIST/타이타닉 같은 CPU 실습 → 클라우드 GPU 실습 순서로 가려는데, CPU 단계에서 꼭 손으로 짜봐야 하는 것(역전파, DataLoader, 평가 루프)과 건너뛰어도 되는 것을 구분해주실 수 있나요?",
        "tags": ["입문", "CPU", "커리큘럼", "질문"],
        "views": 1544, "likes": 79, "bookmarks": 68, "created_at": "2026-07-30", "author": "fresh_mj",
        "source": {"name": "PyTorch 60분 튜토리얼", "url": "https://pytorch.org/tutorials/beginner/deep_learning_60min_blitz.html"},
        "practice": None,
    },
    {
        "id": "qna-009", "category": "Q&A",
        "title": "라벨링 예산이 없을 때 — 능동학습(Active Learning) 실전 효과 있나요?",
        "summary": "불확실성 샘플링으로 라벨 2천 개만 찍어 전체 라벨링에 근접 가능한지 궁금합니다.",
        "content": "텍스트 분류 데이터 5만 건 중 라벨링 예산이 2천 건뿐입니다. 모델 불확실성이 높은 샘플부터 라벨링하는 uncertainty sampling이 랜덤 샘플링 대비 실제로 얼마나 이득인지, 초기 시드 셋 크기는 어떻게 잡는지 경험담을 듣고 싶습니다.",
        "tags": ["ActiveLearning", "라벨링", "데이터전략", "질문"],
        "views": 618, "likes": 29, "bookmarks": 25, "created_at": "2026-07-26", "author": "data_yj",
        "source": {"name": "Settles, Active Learning Survey", "url": "https://burrsettles.com/pub/settles.activelearning.pdf"},
        "practice": None,
    },
    {
        "id": "qna-010", "category": "Q&A",
        "title": "포트폴리오에 '실패한 실험'도 넣는 게 좋을까요?",
        "summary": "성공 결과만 나열하는 것보다 디버깅 과정이 더 어필된다고 들었습니다.",
        "content": "채용 공고를 보면 '문제 해결 경험'을 요구하는 곳이 많습니다. OOM을 잡은 과정, 데이터 누수(leakage)를 발견해 성능이 떨어진(정직해진) 실험 같은 것도 포트폴리오에 쓰는 게 나을까요? 면접에서 실제로 어떤 질문으로 이어졌는지 궁금합니다.",
        "tags": ["포트폴리오", "취업", "디버깅", "질문"],
        "views": 1902, "likes": 134, "bookmarks": 121, "created_at": "2026-07-24", "author": "fresh_mj",
        "source": None,
        "practice": None,
    },

    # ─── 데이터 정보 (data) ───────────────────────────────────────────────────
    {
        "id": "data-001", "category": "데이터 정보",
        "title": "KLUE 벤치마크 총정리 — 한국어 NLU 8개 태스크 공식 데이터",
        "summary": "토픽분류·NER·기계독해 등 8태스크, Hugging Face에서 한 줄로 로드 가능.",
        "content": "KLUE는 한국어 NLU 벤치마크로 YNAT(토픽분류), STS, NLI, NER, RE, DP, MRC, WoS 8개 태스크를 제공합니다. CC-BY-SA 라이선스로 공개되어 있고 Hugging Face datasets에서 load_dataset('klue', '태스크명')으로 바로 받습니다. 한국어 파인튜닝 실습의 사실상 표준 출발점입니다.",
        "tags": ["KLUE", "벤치마크", "한국어NLP", "HuggingFace"],
        "views": 1988, "likes": 126, "bookmarks": 143, "created_at": "2026-08-27", "author": "nlp_jun",
        "source": {"name": "KLUE (Hugging Face)", "url": "https://huggingface.co/datasets/klue/klue"},
        "practice": {
            "filename": "community_klue_tasks.py",
            "code": '''"""KLUE 8개 태스크 구성 훑어보기."""
from datasets import get_dataset_config_names, load_dataset

configs = get_dataset_config_names("klue")
print("KLUE 태스크:", configs)
ds = load_dataset("klue", "sts", split="train[:3]")
for row in ds:
    print(f"[{row['labels']['label']:.1f}] {row['sentence1']} / {row['sentence2']}")
''',
        },
    },
    {
        "id": "data-002", "category": "데이터 정보",
        "title": "AI허브 '감성 대화 말뭉치' — 감정 분류 실습용 한국어 공개 데이터",
        "summary": "우울/불안 등 감정 라벨이 달린 대화 27만 문장, 회원가입 후 무료 다운로드.",
        "content": "AI허브(aihub.or.kr)의 감성 대화 말뭉치는 60개 감정 소분류 라벨이 달린 한국어 대화 데이터입니다. 회원가입과 활용 동의 후 무료로 받을 수 있고, 국내 기관이 구축해 라이선스 조건이 명확합니다. 감정 분류·공감 응답 생성 실습에 널리 쓰입니다.",
        "tags": ["AI허브", "감성분석", "한국어", "공개데이터"],
        "views": 1544, "likes": 88, "bookmarks": 112, "created_at": "2026-08-24", "author": "data_yj",
        "source": {"name": "AI허브 감성 대화 말뭉치", "url": "https://aihub.or.kr/aihubdata/data/view.do?dataSetSn=86"},
        "practice": None,
    },
    {
        "id": "data-003", "category": "데이터 정보",
        "title": "NSMC — 한국어 감성분석의 표준 입문 데이터 (네이버 영화리뷰 20만)",
        "summary": "긍/부정 이진 라벨, GitHub raw로 인증 없이 바로 로드 가능해 실습 진입장벽이 낮다.",
        "content": "NSMC는 네이버 영화 리뷰 20만 문장(train 15만/test 5만)에 긍/부정 라벨이 달린 데이터셋입니다. e9t/nsmc 저장소에서 별도 인증 없이 받을 수 있어 한국어 텍스트 분류 첫 실습으로 가장 많이 쓰입니다. 구어체·오타가 많아 전처리 연습에도 좋습니다.",
        "tags": ["NSMC", "감성분석", "텍스트분류", "공개데이터"],
        "views": 1377, "likes": 72, "bookmarks": 89, "created_at": "2026-08-21", "author": "ml_sora",
        "source": {"name": "NSMC (e9t/nsmc)", "url": "https://github.com/e9t/nsmc"},
        "practice": {
            "filename": "community_nsmc_stats.py",
            "code": '''"""NSMC 기초 통계 - 문장 길이 분포와 라벨 균형."""
import pandas as pd

url = "https://raw.githubusercontent.com/e9t/nsmc/master/ratings_train.txt"
df = pd.read_csv(url, sep="\\t").dropna()
df["length"] = df["document"].str.len()
print(f"샘플 수: {len(df):,}")
print(f"라벨 분포:\\n{df['label'].value_counts().to_string()}")
print(f"문장 길이: 평균 {df['length'].mean():.1f}자, 중앙값 {df['length'].median():.0f}자, 최대 {df['length'].max()}자")
''',
        },
    },
    {
        "id": "data-004", "category": "데이터 정보",
        "title": "KorQuAD 1.0/2.0 — 한국어 기계독해(MRC) 공개 데이터 비교",
        "summary": "1.0은 위키 문단 QA 7만, 2.0은 HTML 전체 문서 QA로 난이도가 크게 다르다.",
        "content": "KorQuAD 1.0은 SQuAD 1.0 형식의 위키 문단 기반 QA(약 7만 질문), 2.0은 표·리스트를 포함한 HTML 문서 전체에서 답을 찾는 확장판입니다. 공식 사이트에서 CC BY-ND 라이선스로 배포되며, 1.0은 Hugging Face squad_kor_v1로도 등록돼 있습니다. MRC 입문은 1.0부터 권장합니다.",
        "tags": ["KorQuAD", "MRC", "QA", "공개데이터"],
        "views": 1102, "likes": 59, "bookmarks": 76, "created_at": "2026-08-17", "author": "nlp_jun",
        "source": {"name": "KorQuAD 공식", "url": "https://korquad.github.io/"},
        "practice": None,
    },
    {
        "id": "data-005", "category": "데이터 정보",
        "title": "MNIST/Fashion-MNIST — torchvision 한 줄 로드, 첫 CNN의 정석",
        "summary": "28x28 흑백 7만 장, 다운로드 12MB로 CPU 실습에 최적.",
        "content": "MNIST(손글씨 숫자)와 Fashion-MNIST(의류 10종)는 torchvision.datasets에서 자동 다운로드됩니다. Fashion-MNIST는 MNIST가 너무 쉬워진 시대의 대체재로 Zalando가 공개했으며 같은 포맷이라 코드 재사용이 됩니다. 환경 검증 → CNN 구조 실험 순서로 쓰기 좋습니다.",
        "tags": ["MNIST", "FashionMNIST", "torchvision", "입문"],
        "views": 966, "likes": 47, "bookmarks": 51, "created_at": "2026-08-13", "author": "fresh_mj",
        "source": {"name": "Fashion-MNIST (Zalando)", "url": "https://github.com/zalandoresearch/fashion-mnist"},
        "practice": {
            "filename": "community_fashion_mnist.py",
            "code": '''"""Fashion-MNIST 로드 + 클래스별 1장씩 shape 확인."""
from torchvision import datasets, transforms

ds = datasets.FashionMNIST("./data", train=True, download=True, transform=transforms.ToTensor())
print(f"샘플 수: {len(ds)}, 클래스: {ds.classes}")
seen = {}
for x, y in ds:
    if y not in seen:
        seen[y] = tuple(x.shape)
    if len(seen) == 10:
        break
print("클래스별 텐서 shape:", seen[0], "(전 클래스 동일)")
''',
        },
    },
    {
        "id": "data-006", "category": "데이터 정보",
        "title": "Kaggle Titanic & House Prices — 정형데이터 입문 2대장 정리",
        "summary": "분류(생존)와 회귀(집값)를 한 쌍으로 실습하면 전처리 감각이 잡힌다.",
        "content": "Kaggle의 Titanic(이진 분류)과 House Prices(회귀)는 결측치·범주형 인코딩·평가지표(accuracy vs RMSE)를 대비해 배우기 좋은 조합입니다. 둘 다 kaggle CLI(kaggle competitions download)로 받으며, Titanic은 seaborn 내장 데이터로도 유사 실습이 가능합니다.",
        "tags": ["Kaggle", "정형데이터", "회귀", "분류"],
        "views": 1244, "likes": 63, "bookmarks": 70, "created_at": "2026-08-10", "author": "data_yj",
        "source": {"name": "Kaggle House Prices", "url": "https://www.kaggle.com/competitions/house-prices-advanced-regression-techniques"},
        "practice": None,
    },
    {
        "id": "data-007", "category": "데이터 정보",
        "title": "AI허브 '한국어 음성' 데이터 — STT 실습용 1,000시간 공개 코퍼스",
        "summary": "전사 라벨이 달린 한국어 발화 대용량 데이터, Whisper 파인튜닝 실습에 활용 가능.",
        "content": "AI허브의 한국어 음성 데이터(KsponSpeech 계열)는 약 1,000시간 규모의 전사된 자유발화 코퍼스입니다. 회원가입 후 승인받아 다운로드하며, 국내 STT 논문·실습에서 표준처럼 인용됩니다. openai/whisper 소형 모델의 한국어 파인튜닝 실습 소재로 적합합니다.",
        "tags": ["AI허브", "음성인식", "STT", "KsponSpeech"],
        "views": 890, "likes": 44, "bookmarks": 58, "created_at": "2026-08-07", "author": "speech_kh",
        "source": {"name": "AI허브 한국어 음성", "url": "https://aihub.or.kr/aihubdata/data/view.do?dataSetSn=123"},
        "practice": None,
    },
    {
        "id": "data-008", "category": "데이터 정보",
        "title": "KorNLI / KorSTS — 한국어 문장 유사도·추론 공개 데이터",
        "summary": "카카오브레인이 공개한 번역 기반 NLI/STS 셋, 문장 임베딩 학습의 기본기.",
        "content": "KorNLI(57만 쌍)와 KorSTS(8.6천 쌍)는 SNLI/MNLI/STS-B를 번역·검수해 만든 한국어 데이터로 kakaobrain/kor-nlu-datasets 저장소에서 공개됩니다. Sentence-BERT 방식의 한국어 문장 임베딩을 학습/평가할 때 표준 조합으로 쓰입니다.",
        "tags": ["KorNLI", "KorSTS", "문장임베딩", "공개데이터"],
        "views": 812, "likes": 41, "bookmarks": 54, "created_at": "2026-08-01", "author": "nlp_jun",
        "source": {"name": "kakaobrain/kor-nlu-datasets", "url": "https://github.com/kakaobrain/kor-nlu-datasets"},
        "practice": None,
    },
    {
        "id": "data-009", "category": "데이터 정보",
        "title": "COCO 2017 — 객체탐지 표준 벤치마크, 라이선스와 다운로드 방법",
        "summary": "이미지 33만 장·80클래스, 학습 전 val2017(1GB)로 파이프라인 검증 추천.",
        "content": "COCO 2017은 객체탐지·세그멘테이션의 표준 벤치마크입니다. cocodataset.org에서 직접 받거나 torchvision/ultralytics가 자동으로 받아줍니다. train2017은 18GB라, 먼저 val2017(1GB)+annotations로 파이프라인을 검증한 뒤 본 학습에 들어가는 것이 디스크와 시간을 아낍니다.",
        "tags": ["COCO", "ObjectDetection", "벤치마크", "공개데이터"],
        "views": 758, "likes": 37, "bookmarks": 45, "created_at": "2026-07-28", "author": "vision_hb",
        "source": {"name": "COCO Dataset 공식", "url": "https://cocodataset.org/#download"},
        "practice": None,
    },
    {
        "id": "data-010", "category": "데이터 정보",
        "title": "데이터 라이선스 읽는 법 — CC-BY / CC-BY-SA / 연구목적 한정의 차이",
        "summary": "공개 데이터라도 포트폴리오·상업 프로젝트에 쓸 수 있는지는 라이선스가 결정한다.",
        "content": "KLUE는 CC-BY-SA(동일조건 변경허락), KorQuAD는 CC BY-ND(변경금지), AI허브는 대부분 활용신청 기반 국내 연구·개발 목적입니다. 같은 '공개 데이터'라도 재배포·상업 이용 가능 범위가 다르므로, 포트폴리오에 결과를 실을 때는 출처 표기와 라이선스 문구를 함께 남기는 습관이 필요합니다.",
        "tags": ["라이선스", "CC-BY", "데이터윤리", "공개데이터"],
        "views": 1066, "likes": 92, "bookmarks": 84, "created_at": "2026-07-25", "author": "data_yj",
        "source": {"name": "Creative Commons 라이선스", "url": "https://creativecommons.org/licenses/"},
        "practice": None,
    },
]


def demo() -> None:
    from collections import Counter
    cats = Counter(p["category"] for p in POSTS)
    assert len(POSTS) == 40 and all(v == 10 for v in cats.values()), cats
    ids = [p["id"] for p in POSTS]
    assert len(set(ids)) == 40
    for p in POSTS:
        assert p["title"] and p["summary"] and p["content"] and p["tags"]
        if p["practice"]:
            assert p["practice"]["filename"].startswith("community_")
    print(f"posts.py self-check OK - {len(POSTS)} posts, categories={dict(cats)}")


if __name__ == "__main__":
    demo()
