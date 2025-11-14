<!-- 775cc8d9-36f7-45be-8140-0dded3ecb400 65ac7b0a-80aa-4eb6-ad3d-facd18584492 -->
# 모바일 컴포넌트 다국어화

## 개요

모바일 전용 컴포넌트 5개의 하드코딩된 한국어 텍스트를 `i18n` 시스템으로 교체하여, 이미 구축된 다국어 시스템이 모바일에서도 작동하도록 함.

## 작업 범위

- `src/components/mobile/` 내 5개 컴포넌트
- 18개 언어 번역 파일에 모바일 관련 키 추가

## 상세 단계

### 1. 번역 키 정의 및 추가

각 언어별 `src/i18n/local/{언어}/common.ts`에 모바일 관련 키 추가:

**주요 번역 키 그룹:**

- `mobile.header.*` - 헤더 관련
- `mobile.nav.*` - 하단 내비게이션
- `mobile.menu.*` - 사이드 메뉴
- `mobile.search.*` - 검색 오버레이
- `mobile.cash.*` - 캐시 충전 모달

예시 (영어):

```typescript
"mobile.nav.mypage": "My Page",
"mobile.nav.login": "Login",
"mobile.nav.cart": "Cart",
"mobile.cash.title": "Cash Charge",
"mobile.cash.currentBalance": "Current Balance",
```

### 2. 컴포넌트 수정

#### MobileHeader.tsx

- `useTranslation` 훅 import 및 사용
- aria-label, alt 텍스트를 `t()` 호출로 교체

#### MobileBottomNav.tsx

- `useTranslation` 훅 추가
- `actions` 배열의 `label` 값을 `t()` 호출로 교체

#### MobileMenuSidebar.tsx

- `useTranslation` 훅 추가
- `menuItems` 배열의 `label`을 `t()` 호출로 교체
- `greeting` 메시지를 `t()` 호출로 교체

#### MobileSearchOverlay.tsx

- `useTranslation` 훅 추가
- placeholder, 섹션 제목 등을 `t()` 호출로 교체

#### MobileCashChargeModal.tsx (가장 많은 텍스트)

- `useTranslation` 훅 추가
- 모든 UI 텍스트를 `t()` 호출로 교체
- chargeOptions, paymentMethods는 유지하되 표시 텍스트만 번역

### 3. 18개 언어 번역 추가

이미 구축된 언어별 파일에 모바일 키 추가:

- ko, en, ja, zh-CN, zh-TW, de, fr, es, vi, th, hi, id, pt, ru, it, tr, uk

## 검증 포인트

- 언어 변경 시 모바일 UI 텍스트도 함께 변경
- 모든 모바일 컴포넌트에서 하드코딩된 한국어 제거
- 18개 언어 모두 모바일에서 정상 표시

### To-dos

- [ ] 18개 언어 번역 파일에 모바일 관련 번역 키 추가 (mobile.header.*, mobile.nav.*, mobile.menu.*, mobile.search.*, mobile.cash.*)
- [ ] MobileHeader.tsx에 useTranslation 추가 및 텍스트 다국어화
- [ ] MobileBottomNav.tsx에 useTranslation 추가 및 내비게이션 라벨 다국어화
- [ ] MobileMenuSidebar.tsx에 useTranslation 추가 및 메뉴 아이템 다국어화
- [ ] MobileSearchOverlay.tsx에 useTranslation 추가 및 검색 텍스트 다국어화
- [ ] MobileCashChargeModal.tsx에 useTranslation 추가 및 충전 관련 텍스트 다국어화