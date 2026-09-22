"""
recorder.py — TrainRecorder: 학습 시각화용 스텝별 가중치·grad 기록.

산출물 (var/telemetry/viz/<run_id>/):
  schema.json  — 모델 껍데기: 레이어/파라미터 shape, 실행 순서, 프레임 내 offset
  frames.bin   — step마다 학습 가능한 파라미터 전체를 fp16으로 이어붙인 고정 크기 프레임
  frames.jsonl — step, epoch, loss, 레이어별 grad norm, 출력 뉴런별 grad norm (한 줄/프레임)

frame k의 가중치 = frames.bin[k*frame_bytes : (k+1)*frame_bytes] → schema의 offset으로 파라미터별 분할.
"""

import json
from pathlib import Path
from typing import Any

import torch
import torch.nn as nn

from .paths import TELEMETRY_DIR

_VIZ_DIR = TELEMETRY_DIR / "viz"


class TrainRecorder:
    def __init__(self, model: nn.Module, run_id: str, every: int = 1, out_dir: Path | None = None, hparams: dict[str, Any] | None = None) -> None:
        self.model = model
        self.every = every
        self.hparams = hparams or {}  # batch_size, optimizer, loss 등 — 뷰어가 "한 스텝에 무슨 일이 일어나는지" 설명할 때 쓴다
        self.dir = (out_dir or _VIZ_DIR) / run_id
        self.dir.mkdir(parents=True, exist_ok=True)
        self.step = 0

        self._params = [(n, p) for n, p in model.named_parameters() if p.requires_grad]
        self._numel = sum(p.numel() for _, p in self._params)
        self._flow: list[dict[str, Any]] = []
        self._hooks = [m.register_forward_hook(self._on_forward(name)) for name, m in model.named_modules() if name]
        # 루트 훅은 자식들 뒤에 실행됨 → 첫 forward 한 번만 추적하고 전부 해제
        self._hooks.append(model.register_forward_hook(lambda *_: self._stop_trace()))
        self._schema_written = False

    def _stop_trace(self) -> None:
        for h in self._hooks:
            h.remove()
        self._hooks = []

        (self.dir / "frames.bin").write_bytes(b"")
        (self.dir / "frames.jsonl").write_text("", encoding="utf-8")

    def _on_forward(self, name: str):
        def hook(mod, inp, out):
            x = inp[0] if isinstance(inp, tuple) and inp else inp
            self._flow.append({
                "name": name,
                "in_shape": list(x.shape[1:]) if torch.is_tensor(x) else None,
                "out_shape": list(out.shape[1:]) if torch.is_tensor(out) else None,
            })
        return hook

    def _write_schema(self) -> None:
        self._stop_trace()
        offsets: dict[str, int] = {}
        cur = 0
        for n, p in self._params:
            offsets[n] = cur
            cur += p.numel()
        params = [{
            "name": n, "shape": list(p.shape), "numel": p.numel(),
            "trainable": p.requires_grad, "offset": offsets.get(n),
        } for n, p in self.model.named_parameters()]
        shapes = {f["name"]: f for f in self._flow}
        layers = []
        for name, m in self.model.named_modules():
            if not name or list(m.children()):
                continue
            own = [f for f in params if f["name"].rsplit(".", 1)[0] == name]
            layers.append({
                "name": name, "type": type(m).__name__,
                "params": own,
                "in_shape": shapes.get(name, {}).get("in_shape"),
                "out_shape": shapes.get(name, {}).get("out_shape"),
            })
        schema = {
            "format_version": 1,  # 저장 방식이 바뀌면 올린다 — 뷰어가 옛 실행을 구분해 읽는다 (FORMAT.md)
            "model_class": type(self.model).__name__,
            "total_params": sum(p.numel() for p in self.model.parameters()),
            "trainable_params": self._numel,
            "frame_dtype": "float16",
            "frame_numel": self._numel,
            "frame_bytes": self._numel * 2,
            "record_every": self.every,
            "hparams": self.hparams,
            "layers": layers,
            "flow": [f["name"] for f in self._flow],
        }
        (self.dir / "schema.json").write_text(json.dumps(schema, ensure_ascii=False, indent=2), encoding="utf-8")
        self._schema_written = True

    @torch.no_grad()
    def record(self, loss: float, epoch: float = 0.0) -> None:
        """optimizer.step() 직후 호출. 이번 step의 loss와 갱신된 가중치를 기록."""
        self.step += 1
        if self.step % self.every:
            return
        if not self._schema_written:
            self._write_schema()

        frame = torch.cat([p.detach().flatten() for _, p in self._params]).to(torch.float16).cpu()
        with open(self.dir / "frames.bin", "ab") as f:
            f.write(frame.numpy().tobytes())

        node_grad: dict[str, list[float]] = {}
        layer_grad: dict[str, float] = {}
        for n, p in self._params:
            if p.grad is None or p.dim() < 2:
                continue
            layer = n.rsplit(".", 1)[0]
            per_out = p.grad.flatten(1).norm(dim=1)
            node_grad[layer] = [round(v, 6) for v in per_out.tolist()]
            layer_grad[layer] = round(per_out.norm().item(), 6)
        row = {"step": self.step, "epoch": round(epoch, 4), "loss": round(float(loss), 6),
               "layer_grad": layer_grad, "node_grad": node_grad}
        with open(self.dir / "frames.jsonl", "a", encoding="utf-8") as f:
            f.write(json.dumps(row) + "\n")

    def read_frame(self, index: int) -> dict[str, torch.Tensor]:
        """저장된 index번째 프레임을 파라미터 이름별 텐서로 복원 (뷰어/검증용)."""
        nbytes = self._numel * 2
        with open(self.dir / "frames.bin", "rb") as f:
            f.seek(index * nbytes)
            buf = f.read(nbytes)
        flat = torch.frombuffer(bytearray(buf), dtype=torch.float16)
        out, cur = {}, 0
        for n, p in self._params:
            out[n] = flat[cur:cur + p.numel()].view(p.shape)
            cur += p.numel()
        return out


def demo() -> None:
    import tempfile

    torch.manual_seed(0)
    model = nn.Sequential(nn.Linear(4, 3), nn.ReLU(), nn.Linear(3, 2))
    opt = torch.optim.SGD(model.parameters(), lr=0.1)
    with tempfile.TemporaryDirectory() as tmp:
        rec = TrainRecorder(model, run_id="t", every=1, out_dir=Path(tmp))
        with torch.no_grad():
            model(torch.randn(2, 4)); model(torch.randn(2, 4))  # 기록 전 평가 forward — flow가 중복되면 안 됨
        for i in range(3):
            opt.zero_grad()
            loss = model(torch.randn(8, 4)).pow(2).mean()
            loss.backward()
            opt.step()
            rec.record(loss.item(), epoch=i / 3)
        schema = json.loads((rec.dir / "schema.json").read_text(encoding="utf-8"))
        assert schema["frame_numel"] == 4 * 3 + 3 + 3 * 2 + 2 == 23
        assert schema["format_version"] == 1
        assert schema["flow"] == ["0", "1", "2"], schema["flow"]
        assert [l["type"] for l in schema["layers"]] == ["Linear", "ReLU", "Linear"]
        assert schema["layers"][0]["in_shape"] == [4] and schema["layers"][0]["out_shape"] == [3]
        assert (rec.dir / "frames.bin").stat().st_size == 3 * 23 * 2
        rows = [json.loads(l) for l in (rec.dir / "frames.jsonl").read_text().splitlines()]
        assert len(rows) == 3 and rows[-1]["step"] == 3
        assert len(rows[0]["node_grad"]["2"]) == 2, "출력 뉴런 수만큼 grad norm"
        last = rec.read_frame(2)
        assert torch.allclose(last["2.weight"].float(), model[2].weight.detach(), atol=1e-3)
        assert not torch.allclose(rec.read_frame(0)["2.weight"], last["2.weight"]), "프레임 간 가중치가 변해야 함"
    print("recorder.py self-check OK")


if __name__ == "__main__":
    demo()
