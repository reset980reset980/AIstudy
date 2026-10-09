# 스마트 스터디 AI

문제를 찍어 올리면 AI 선생님이 **단계별 풀이 · 유사 문제 · 자동 채점 시험**을 제공하는 학습 도우미입니다.
배포 주소: https://a-istudy-five.vercel.app

## 주요 기능
- 사진/PDF 업로드, 카메라 촬영, 풀 문제만 잘라서 분석
- AI 3종 선택: **Google Gemini**(AQ.·AIza 키 모두 지원) · **OpenAI** · **Anthropic Claude**, 설정창에서 키 테스트
- 학년별 눈높이 설명, 유사 문제 3개 자동 생성
- 학습 기록 검색·태그 필터·삭제
- 유사 문제로 시험 → 자동 채점(AI) → 틀린 문제 다시 풀기, 최근 점수 기록

## AI 모델 (2026년 10월 가격 기준)
| 공급자 | 기본(추천) | 대안 |
|---|---|---|
| Gemini | gemini-3.8-flash | gemini-3.5-flash-lite (절약) |
| OpenAI | gpt-6-luna | gpt-6.1-sol (고성능) |
| Claude | claude-haiku-5-5 | claude-sonnet-5-5 (고성능) |

모델 목록은 `shared/ai/models.ts`에서 바꿉니다.

## 키 저장 방식
- **일반 사용자**: 본인 Firestore 문서(`users/{uid}/settings/config`)에 저장, 브라우저에서 AI로 직접 호출
- **관리자(reset98@gmail.com)**: `/api/ai` 서버 함수가 AES-256-GCM으로 암호화한 **암호문만** 저장. 호출 시 서버에서만 복호화
  - Vercel 환경변수 `KEY_ENCRYPTION_SECRET`(32자 이상) 필요. 바꾸면 관리자 키를 다시 저장해야 함
  - 관리자 이메일은 `server/ai.ts`, `services/aiClient.ts`의 `ADMIN_EMAILS`

## 구조
```
App.tsx, components/      화면
services/aiClient.ts      AI 호출(직접/서버), 이미지 축소, 재시도, 채점
services/userData.ts      Firestore(Lite) 저장
shared/ai/                공급자·모델·스키마 (브라우저와 서버가 함께 사용)
server/ai.ts              관리자 서버 함수 원본 → npm run build:api → api/ai.js
firestore.rules           Firestore 보안 규칙 (콘솔에 붙여 넣기)
```

## 개발
```
npm install
npm run dev          # 로컬 실행
npm run typecheck
npm run build:api    # server/ai.ts 수정 후 반드시 실행해서 api/ai.js 갱신
npm run build
```
