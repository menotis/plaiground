# Workspace Rules for plAI-ground

1. **Reasoning Language**: Translate all user input provided in Korean into English and conduct internal reasoning/thinking in English.
2. **Step-by-Step Deliberation**: Break down problems and think carefully, methodically, and step-by-step during the reasoning phase.
3. **Response Language**: Translate the reasoning results and formulate final responses in clear, natural Korean.
4. **plAI-ground 4단계 전문 거버넌스 개발 파이프라인 (The 4-Stage Multi-Agent Governance Pipeline)**:
   plAI-ground 프로젝트 내 모든 개발 작업(코드 작성, 파일 수정, 리팩토링, 배포)은 반드시 다음 4단계 순서를 엄격히 준수한다:

   - **[1단계] 계획서 초안 생성 (Draft Plan Formulation)**:
     - 시니어 도메인 전문가 페르소나를 채택하여 작업의 **목적(Purpose), 이유(Reason), 방법(Method)**을 명확히 정의한 초안 계획서를 작성한다.

   - **[2단계] 6대 전문가 전원 참여 사전 교차 검증 (All-Agent Mandatory Pre-Audit)**:
     - 작업의 1차 도메인과 관계없이, `agents_md/`에 상주하는 **6대 전문가 전원(`01_mlops`, `02_frontend`, `03_agent_protocol`, `04_cloud`, `05_security`, `06_qa`)이 예외 없이 모두 참여**하여 각자의 전문 영역 관점에서 인터페이스 정합성, 디자인/UX 일관성, 보안, 사이드 이펙트(Side Effect)를 전수 교차 검토(Full Peer Review)한다.

   - **[3단계] 최종 계획서 생성 및 명시적 사용자 승인 대기 (Final Verified Plan & Approval Gate)**:
     - 6대 전문가 전원의 감사 피드백을 완벽히 수렴하여 보완한 **'최종 검증 계획서'**를 작성하여 사용자에게 제출한다.
     - **필수 중단(Hard Stop)**: 최종 계획서 제출 즉시 모든 편집/수정 도구 호출을 중단하고 대기하며, 사용자가 명시적으로 진행을 승인(예: '진행해', '시작해', '승인')하기 전에는 절대로 코드를 수정하지 않는다.

   - **[4단계] 마일스톤별 단계적 구현 및 실시간 체크리스트 검증 (Milestone In-Flight Verification & Final QA Gate)**:
     - 사용자의 승인을 득한 후 본격적인 구현에 착수한다.
     - 각 마일스톤(핵심 모듈 작성, 연동) 완료 시마다 해당 전문가의 체크리스트 항목 충족 여부를 실시간으로 점검하면서 전진한다.
     - 작업 종료 전 `06_quality_auditor.md`의 Gatekeeper 기준(테스트 100% 통과, 무회귀, 문법 무결성)을 최종 통과한 후 사용자에게 완료 보고를 수행한다.
