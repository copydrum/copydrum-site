<!-- c929dc25-2b10-48cf-87f4-2afed1a02f9f c5c152da-e87f-48b6-8771-fc9233e3481d -->
# 무료악보 페이지 구현 계획

## 1. 새 페이지 생성

`src/pages/free-sheets/page.tsx` 파일을 생성하여 무료악보 전용 페이지 구현

**핵심 기능:**

- 드럼레슨 카테고리(name === '드럼레슨') 악보만 필터링
- **하위 카테고리 필터링**: 드럼테크닉, 루디먼트, 드럼솔로, 기초/입문, 리듬패턴, 필인
- 기존 `drum_sheet_categories` 조인 테이블 활용 (다중 카테고리)
- Supabase에서 해당 악보 데이터 로드
- 16:9 비율 썸네일 그리드 레이아웃
- 검색 및 정렬 기능 (최신순, 제목순, 난이도순)
- 찜하기 기능
- 반응형 디자인 (모바일 1열, 태블릿 2열, 데스크탑 3-4열)

**디자인 요소:**

- 상단: "무료 드럼레슨 악보" 헤더 배너 (초록/파랑 계열)
- **가로 스크롤 가능한 카테고리 탭** (전체, 드럼테크닉, 루디먼트 등)
- 각 카드에 "FREE" 배지 표시
- 썸네일 hover시 재생/악보 아이콘 오버레이
- 카드 정보: 제목, 아티스트, 난이도

## 2. 라우터 설정

`src/router/config.tsx`에 `/free-sheets` 경로 추가

## 3. 참고할 기존 코드

- `src/pages/categories/page.tsx`: 악보 리스트, 필터링, 정렬 로직
- `src/pages/home/page.tsx`: 카드 레이아웃 참고
- 기존 컴포넌트: MainHeader, UserSidebar, 찜하기 기능 재사용

### To-dos

- [ ] src/pages/free-sheets/page.tsx 파일 생성 및 기본 구조 구현
- [ ] src/router/config.tsx에 /free-sheets 라우트 추가