# 노트북 로컬 실행과 Tailscale 접속

작성일: 2026-09-22 · 대상: 박준형, 한상협

두 가지 상황을 다룬다.
- **A. 노트북에서 로컬로 실행** — 각자 자기 노트북에서 전체 흐름을 돌린다. 지금 바로 쓴다.
- **B. Tailscale로 접속** — 상협의 노트북에서 준형의 PC(GPU 호스트)에 접속한다. Stage C에서 쓴다. 지금은 설치만.

---

## A. 노트북에서 로컬로 실행

### A1. 필요한 것

| 도구 | 버전 | 확인 |
|---|---|---|
| Git | 아무 버전 | `git --version` |
| Python | 3.10 이상 | `python --version` |
| Node.js | 20 이상 | `node --version` |
| Docker Desktop | 최신 | 설치 후 실행. `docker info`가 오류 없이 나오면 됨 |

GPU는 없어도 된다. 없으면 CPU로 돌고, mnist 실습은 몇 분이면 끝난다. klue-bert는 느리고, llama·gemma는 CPU로는 사실상 불가능하다.

Windows에서 Docker Desktop은 WSL2를 쓴다. 처음 설치하면 재부팅을 요구할 수 있다.

### A2. 코드 받기와 설치 (최초 1회, 약 10분 + 이미지 다운로드)

```bash
git clone git@github.com:menotis/plaiground.git
cd plaiground

pip install -e packages/telemetry -e apps/host
cd apps/web && npm install && cd ../..

docker pull ghcr.io/menotis/plaiground-base:dev      # 7GB. 회선에 따라 10~30분
```

이미 클론한 적이 있으면 `git pull`만 한다. 옛 구조(`web_combine_demo` 등)로 클론한 폴더는 지우고 새로 받는다.

`docker pull`이 "denied" 또는 "unauthorized"로 실패하면 이미지가 아직 비공개인 것이다. 준형에게 공개 전환을 요청하거나, 임시로 본인 GitHub 토큰(`read:packages`)으로 `docker login ghcr.io`를 한 뒤 다시 받는다.

### A3. Gemini 키 (포트폴리오 생성에만 필요)

git에 들어 있지 않으므로 직접 만든다. 본인 Google 계정으로 [AI Studio](https://aistudio.google.com/apikey)에서 키를 발급받아 아래 파일을 만든다.

```
apps/host/plaiground_host/portfolio/.env
```
```
GEMINI_API_KEY=발급받은키
GEMINI_MODEL=gemini-3.8-flash
```

이 파일은 gitignore 대상이라 커밋되지 않는다. 키를 채팅이나 문서에 옮기지 않는다. 무료 등급은 모델당 하루 20회이고, 503(과부하)이 나면 `GEMINI_MODEL`을 다른 flash 모델로 바꾸면 된다.

### A4. Windows 8080 포트 문제 (Windows만, 최초 1회)

Windows가 8002~8101 범위를 예약해 Docker가 code-server 포트 8080을 열지 못하는 경우가 있다. 증상은 Start AI에서 "ports are not available … 8080". 관리자 PowerShell에서 한 번 실행한다.

```
net stop winnat
netsh int ipv4 add excludedportrange protocol=tcp startport=8080 numberofports=1
net start winnat
```

### A5. 점검과 실행

```bash
python scripts/check.py            # pytest 12건 + 프론트 빌드. 전부 통과해야 정상
python -m plaiground_host.server   # http://127.0.0.1:8770
```

브라우저에서 `http://127.0.0.1:8770`을 연다. 프론트를 고치면서 볼 때는 터미널을 하나 더 연다.

```bash
cd apps/web && npm run dev         # http://127.0.0.1:5173 (API는 8770으로 자동 프록시)
```

### A6. 실습 흐름

1. **Start AI** → `mnist-cnn-lite` 선택 → 환경 세팅 실행. Docker가 켜져 있어야 한다. 첫 실행은 컨테이너 기동에 1~2분.
2. **Web IDE** → 터미널에서 `python train_mnist_cnn_lite.py`. 첫 실행은 의도된 오류로 실패한다. 오류 메시지를 읽고 고쳐서 다시 실행하는 것이 실습이다. (mnist는 `nn.Linear`의 입력 크기)
3. 학습이 끝나면 **Portfolio** → 실행 선택 → 포트폴리오 생성 실행 (Gemini 키 필요, 20~60초).
4. **View AI** → 같은 실행을 선택해 스텝별 가중치를 재생.

### A7. 데이터는 git에 없다

학습 기록, 생성된 포트폴리오, 직접 고친 스크립트는 전부 `var/` 아래에 있고 gitignore 대상이다. 노트북에서는 빈 상태로 시작한다.

| 폴더 | 내용 |
|---|---|
| `var/workspaces/local/` | 학습 스크립트(고친 것 포함), `.telemetry/`(실행 기록, View AI 프레임) |
| `var/portfolios/local/` | 생성된 포트폴리오 HTML/JSON |
| `var/community/` | 커뮤니티 추천·조회, 댓글 |

데스크톱의 기록을 노트북에서도 보려면 `var/` 폴더를 USB나 클라우드로 복사해 같은 위치에 둔다. 서버를 다시 시작하면 그대로 보인다.

### A8. 자주 나는 문제

| 증상 | 원인과 해결 |
|---|---|
| Start AI에 "Docker 데몬 STOPPED" | Docker Desktop이 안 켜짐. 켜고 새로고침 |
| "이미지가 없습니다" | `docker pull ghcr.io/menotis/plaiground-base:dev` |
| 8080 포트 오류 | A4 |
| 포트폴리오 생성이 503으로 중단 | Gemini 과부하. 몇 분 뒤 재시도 또는 `.env`의 모델 변경 |
| `ModuleNotFoundError: plaiground_host` | `pip install -e packages/telemetry -e apps/host`를 안 했거나 다른 Python으로 실행 |
| 프론트가 옛 화면 | `cd apps/web && npm run build` 후 서버 재시작 |

---

## B. Tailscale로 접속 (Stage C)

### B1. 무엇을 위한 것인가

준형의 PC에서 도는 API 서버(8770)와 Web IDE(8080)는 `127.0.0.1`에만 열려 있어 다른 컴퓨터에서 접속할 수 없다. Tailscale은 두 컴퓨터 사이에 암호화된 사설 연결을 만든다. 공유기 포트를 열지 않고, 인터넷에는 노출되지 않으며, tailnet에 초대된 기기만 접속할 수 있다.

**켜져 있어야 하는 것은 GPU 호스트(준형 PC) 한 대다.** 상협의 노트북은 접속하는 쪽이라 켜고 싶을 때 켠다. 준형이 자리에 있을 필요는 없고 PC가 잠자기 상태가 아니면 된다.

Tailscale 무료 Personal 플랜은 비상업적 용도 한정이다. 두 사람의 개발·시연에만 쓰고, 외부 사용자를 받을 때는 도메인을 사서 Cloudflare Tunnel로 바꾼다(DEPLOYMENT_PLAN 8장).

### B2. 준비 (두 사람 모두, 지금 해 둔다)

1. Tailscale 설치. [tailscale.com/download](https://tailscale.com/download)
2. 로그인. **루트 Gmail(`menotis.team`)로 만든 tailnet**에 들어가야 한다. 준형은 루트 Gmail로, 상협은 초대받은 본인 Google 계정으로 로그인한다. 상협의 초대는 준형이 관리 콘솔 → Users → Invite에서 상협의 **Google 계정 이메일**로 보낸다(네이버 메일은 안 됨).
3. 관리 콘솔([login.tailscale.com/admin](https://login.tailscale.com/admin))에서:
   - **DNS** → MagicDNS 켜기, **HTTPS Certificates** 켜기. `tailscale serve`가 HTTPS 인증서를 받으려면 필요하다.
   - **Machines** → 준형 PC 행의 `...` → **Disable key expiry**. 서버 역할 기기는 180일마다 재로그인하지 않게.
4. 준형 PC의 tailnet 이름을 확인해 둔다. 관리 콘솔 DNS 탭에 `xxxx.ts.net` 형태로 표시된다. 기기 이름은 Machines 탭(예: `desktop-6ehhk0m`). 둘을 Bitwarden의 Tailscale 항목 메모에 적는다.

### B3. 호스트(준형 PC)에서 열기

가장 단순한 구성은 **API 서버가 프론트도 함께 서빙하게 하고, 그것 하나를 443으로 여는 것**이다. 브라우저 입장에서 화면과 API가 같은 주소라 CORS 설정이 필요 없다.

```bash
cd plaiground
cd apps/web && npm run build && cd ../..          # 서버가 dist를 정적으로 서빙한다
```

PowerShell(관리자 아님)에서 서버를 띄운다. Tailscale 주소로 열 IDE 주소를 환경변수로 준다.

```powershell
$env:PLAIGROUND_IDE_URL = "https://<기기이름>.<tailnet>.ts.net:8443"
python -m plaiground_host.server
```

다른 터미널에서 Tailscale로 두 포트를 연다. `--bg`는 터미널을 닫아도 유지된다는 뜻이다.

```powershell
tailscale serve --bg --https=443  http://127.0.0.1:8770    # 화면 + API
tailscale serve --bg --https=8443 http://127.0.0.1:8080    # Web IDE (code-server)
tailscale serve status                                       # 확인
```

`tailscale` 명령이 없다고 나오면 `"C:\Program Files\Tailscale\tailscale.exe"`로 전체 경로를 쓴다.

**인증은 어떻게 되나.** 이 단계에서는 tailnet 안의 두 사람만 접속할 수 있으므로 `PLAIGROUND_AUTH=off`(기본)로 두어도 안전하다. Supabase 로그인(B2-4)이 붙은 뒤에는 `PLAIGROUND_AUTH=supabase`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`를 환경변수로 주고 서버를 다시 띄운다. 값은 `apps/host/.env.example`에 이름이 있다.

끄려면 `tailscale serve reset`.

### B4. 상협 노트북에서 접속

브라우저에서 아래를 연다. 로그인 없이 바로 화면이 뜬다.

```
https://<기기이름>.<tailnet>.ts.net
```

- Start AI → 환경 세팅은 **준형 PC의 Docker**에서 돈다. 컨테이너가 하나라 두 사람이 동시에 세팅하면 뒤 사람이 앞 사람의 컨테이너를 교체한다. 시연 중에는 한 사람만 쓴다.
- Web IDE 화면은 `:8443` 주소를 iframe으로 연다. 첫 접속 때 인증서 경고가 없어야 정상이다. 있으면 B2의 HTTPS Certificates 설정을 확인한다.
- 학습 기록과 포트폴리오는 준형 PC의 `var/workspaces/local/`에 쌓인다.

프론트를 고치면서 원격 API에 붙이고 싶으면, 노트북에서 `apps/web/.env.local`에 `VITE_API_BASE=https://<기기이름>.<tailnet>.ts.net`을 적고 `npm run dev`를 띄운다. 이때는 주소가 달라 CORS가 필요하므로 준형이 서버에 `PLAIGROUND_ALLOWED_ORIGINS=http://localhost:5173`을 준다.

### B5. Cloudflare Pages와 붙일 때 (B2-6 이후)

Pages 주소(`https://<이름>.pages.dev`)에서 이 API를 부르려면:
- 준형: `PLAIGROUND_ALLOWED_ORIGINS=https://<이름>.pages.dev`
- 상협: Pages 환경변수 `VITE_API_BASE=https://<기기이름>.<tailnet>.ts.net`

공개 사이트에서 사설 대역 주소(`ts.net`은 100.x로 해석됨)를 호출할 때 크롬이 "로컬 네트워크 접근"을 물을 수 있다. 직접 시험해 보지 못했다. 막히면 API만 `tailscale funnel --bg --https=443 http://127.0.0.1:8770`으로 공개 주소로 바꾸고, 반드시 `PLAIGROUND_AUTH=supabase`를 켠 상태여야 한다. Funnel은 인터넷에 열리는 것이라 인증 없이 켜면 안 된다.

### B6. 문제가 날 때

| 증상 | 확인할 것 |
|---|---|
| 주소가 안 열림 | 준형 PC가 켜져 있고 잠자기가 아닌지. 양쪽 Tailscale 아이콘이 Connected인지. `tailscale status`에서 서로 보이는지 |
| 인증서 경고 | 관리 콘솔 DNS → HTTPS Certificates 켜짐 여부. 처음 한 번은 발급에 몇 초 걸린다 |
| 화면은 뜨는데 API 오류 | 준형 PC에서 서버가 8770으로 떠 있는지. `tailscale serve status`에 443 → 8770이 있는지 |
| Web IDE 칸이 비어 있음 | `PLAIGROUND_IDE_URL`이 `:8443` 주소로 설정된 채 서버를 띄웠는지. 컨테이너가 떠 있는지(`docker ps`) |
| 상협이 tailnet에 없음 | 초대가 Google 계정 이메일로 갔는지. 상협이 같은 계정으로 로그인했는지 |
