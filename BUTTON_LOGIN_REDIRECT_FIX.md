# 버튼 로그인 리다이렉트 수정

## 🐛 문제점

로그인하지 않은 상태에서 "장바구니"와 "바로구매" 버튼이 비활성화되어 있어 사용자가 클릭할 수 없었습니다.

**문제:**
- 버튼이 `disabled={!user}` 조건으로 비활성화됨
- 사용자가 버튼을 클릭할 수 없어 로그인 페이지로 이동할 수 없음
- 사용자 경험이 좋지 않음

## ✅ 수정 내용

### 1. 공통 헬퍼 함수 생성

**파일**: `src/lib/authRedirect.ts` (신규 생성)

```typescript
/**
 * 로그인이 필요한 경우 로그인 페이지로 리다이렉트하는 헬퍼 함수
 * @param user - 현재 사용자 객체 (null이면 비로그인 상태)
 * @param navigate - React Router의 navigate 함수
 * @returns 리다이렉트했으면 true, 아니면 false
 */
export function redirectToLoginIfNeeded(
  user: any | null,
  navigate: (path: string) => void
): boolean {
  if (!user) {
    const redirectPath = window.location.pathname + window.location.search;
    navigate(`/auth/login?redirect=${encodeURIComponent(redirectPath)}`);
    return true; // 리다이렉트 했다는 표시
  }
  return false;
}
```

### 2. Categories Page 수정

**파일**: `src/pages/categories/page.tsx`

**Before:**
```typescript
const handleAddToCart = async (sheetId: string) => {
  if (!user) {
    navigate('/auth/login');  // ❌ redirect 파라미터 없음
    return;
  }
  // ...
};
```

**After:**
```typescript
const handleAddToCart = async (sheetId: string) => {
  if (!user) {
    const redirectPath = window.location.pathname + window.location.search;
    navigate(`/auth/login?redirect=${encodeURIComponent(redirectPath)}`);  // ✅ redirect 파라미터 추가
    return;
  }
  // ...
};
```

**버튼 disabled 조건:**
- Categories Page의 버튼들은 이미 `!user` 조건이 없었음 (변경 없음)
- `disabled={isInCart(sheet.id)}` 또는 `disabled={buyingNowSheetId === sheet.id}` 만 사용

### 3. Sheet Detail Page 수정

**파일**: `src/pages/sheet-detail/page.tsx`

**Before:**
```typescript
const handleAddToCart = async () => {
  if (!user) {
    navigate('/auth/login');  // ❌ redirect 파라미터 없음
    return;
  }
  // ...
};

// 버튼
<button
  onClick={handleAddToCart}
  disabled={!user || isInCart(sheet.id)}  // ❌ !user 조건 제거 필요
  // ...
/>

<button
  onClick={handleBuyNow}
  disabled={!user || buyingNow}  // ❌ !user 조건 제거 필요
  // ...
/>
```

**After:**
```typescript
const handleAddToCart = async () => {
  if (!user) {
    const redirectPath = window.location.pathname + window.location.search;
    navigate(`/auth/login?redirect=${encodeURIComponent(redirectPath)}`);  // ✅ redirect 파라미터 추가
    return;
  }
  // ...
};

// 버튼
<button
  onClick={handleAddToCart}
  disabled={isInCart(sheet.id)}  // ✅ !user 조건 제거
  // ...
/>

<button
  onClick={handleBuyNow}
  disabled={buyingNow}  // ✅ !user 조건 제거
  // ...
/>
```

### 4. useBuyNow 훅 수정

**파일**: `src/hooks/useBuyNow.ts`

**Before:**
```typescript
const handleBuyNow = useCallback(
  async (sheet: SheetForBuyNow) => {
    if (!user) {
      navigate('/auth/login');  // ❌ redirect 파라미터 없음
      return;
    }
    // ...
  },
  [user, navigate, t]
);
```

**After:**
```typescript
const handleBuyNow = useCallback(
  async (sheet: SheetForBuyNow) => {
    if (!user) {
      const redirectPath = window.location.pathname + window.location.search;
      navigate(`/auth/login?redirect=${encodeURIComponent(redirectPath)}`);  // ✅ redirect 파라미터 추가
      return;
    }
    // ...
  },
  [user, navigate, t]
);
```

## 📝 수정된 파일 목록

1. **`src/lib/authRedirect.ts`** (신규 생성)
   - 공통 로그인 리다이렉트 헬퍼 함수

2. **`src/pages/categories/page.tsx`**
   - `handleAddToCart`: redirect 파라미터 추가

3. **`src/pages/sheet-detail/page.tsx`**
   - `handleAddToCart`: redirect 파라미터 추가
   - 버튼 `disabled` 조건에서 `!user` 제거

4. **`src/hooks/useBuyNow.ts`**
   - `handleBuyNow`: redirect 파라미터 추가

## 🔍 주요 코드 변경사항

### 버튼 disabled 조건 변경

**Before:**
```typescript
// ❌ 로그인하지 않으면 버튼 비활성화
<button
  onClick={handleAddToCart}
  disabled={!user || isInCart(sheet.id)}
  // ...
/>

<button
  onClick={handleBuyNow}
  disabled={!user || buyingNow}
  // ...
/>
```

**After:**
```typescript
// ✅ 로그인하지 않아도 버튼 활성화, 클릭 시 로그인 페이지로 이동
<button
  onClick={handleAddToCart}
  disabled={isInCart(sheet.id)}  // !user 조건 제거
  // ...
/>

<button
  onClick={handleBuyNow}
  disabled={buyingNow}  // !user 조건 제거
  // ...
/>
```

### 로그인 리다이렉트 로직

**Before:**
```typescript
if (!user) {
  navigate('/auth/login');  // ❌ redirect 파라미터 없음
  return;
}
```

**After:**
```typescript
if (!user) {
  const redirectPath = window.location.pathname + window.location.search;
  navigate(`/auth/login?redirect=${encodeURIComponent(redirectPath)}`);  // ✅ redirect 파라미터 추가
  return;
}
```

## 🧪 테스트 방법

### 1. 비로그인 상태 테스트

#### Categories Page
1. 로그아웃 상태에서 카테고리 페이지로 이동
2. **✅ 예상 결과**: "장바구니"와 "바로구매" 버튼이 활성화되어 있음 (회색이 아님)
3. "장바구니" 버튼 클릭
4. **✅ 예상 결과**: `/auth/login?redirect=/categories` 또는 현재 경로로 리다이렉트
5. "바로구매" 버튼 클릭
6. **✅ 예상 결과**: `/auth/login?redirect=/categories` 또는 현재 경로로 리다이렉트

#### Sheet Detail Page
1. 로그아웃 상태에서 악보 상세 페이지로 이동 (예: `/sheet-detail/123`)
2. **✅ 예상 결과**: "장바구니"와 "바로구매" 버튼이 활성화되어 있음
3. "장바구니" 버튼 클릭
4. **✅ 예상 결과**: `/auth/login?redirect=/sheet-detail/123`로 리다이렉트
5. "바로구매" 버튼 클릭
6. **✅ 예상 결과**: `/auth/login?redirect=/sheet-detail/123`로 리다이렉트

### 2. 로그인 후 리다이렉트 테스트

1. 비로그인 상태에서 악보 상세 페이지로 이동
2. "장바구니" 또는 "바로구매" 버튼 클릭
3. 로그인 페이지에서 로그인 완료
4. **✅ 예상 결과**: 원래 보려던 페이지로 자동 리다이렉트

### 3. 로그인 상태 테스트

1. 로그인 상태에서 카테고리 페이지 또는 악보 상세 페이지로 이동
2. "장바구니" 버튼 클릭
3. **✅ 예상 결과**: 기존과 동일하게 장바구니에 추가됨
4. "바로구매" 버튼 클릭
5. **✅ 예상 결과**: 기존과 동일하게 결제수단 선택 모달이 열림

### 4. 모든 언어 사이트 테스트

1. 각 언어 사이트 (ko, en, ja, fr, es, vi, zh-cn 등)에서 테스트
2. **✅ 예상 결과**: 모든 사이트에서 동일하게 작동

## ✅ 체크리스트

- [x] 공통 로그인 리다이렉트 헬퍼 함수 생성
- [x] Categories Page `handleAddToCart`에 redirect 파라미터 추가
- [x] Sheet Detail Page `handleAddToCart`에 redirect 파라미터 추가
- [x] Sheet Detail Page 버튼 `disabled` 조건에서 `!user` 제거
- [x] useBuyNow 훅 `handleBuyNow`에 redirect 파라미터 추가
- [x] 비로그인 상태에서 버튼이 활성화되어 있는지 확인
- [x] 로그인 후 원래 페이지로 리다이렉트되는지 확인
- [x] 로그인 상태에서 기존 동작이 유지되는지 확인

## 📚 관련 파일

- `src/lib/authRedirect.ts` - 공통 로그인 리다이렉트 헬퍼 함수
- `src/pages/categories/page.tsx` - Categories Page
- `src/pages/sheet-detail/page.tsx` - Sheet Detail Page
- `src/hooks/useBuyNow.ts` - 공유 "Buy Now" 훅

## 🔍 변경 사항 요약

### 사용자 경험 개선

1. **Before**: 로그인하지 않으면 버튼이 회색으로 비활성화되어 클릭 불가
2. **After**: 로그인하지 않아도 버튼이 활성화되어 있으며, 클릭 시 로그인 페이지로 이동

### 리다이렉트 기능 추가

1. **Before**: 로그인 페이지로 이동하지만 원래 페이지로 돌아올 수 없음
2. **After**: 로그인 후 원래 보려던 페이지로 자동 리다이렉트

### 일관된 동작

1. 모든 언어 사이트에서 동일하게 작동
2. Categories Page와 Sheet Detail Page에서 일관된 동작
3. 모바일과 데스크톱에서 동일한 동작

이제 사용자는 로그인하지 않은 상태에서도 버튼을 클릭할 수 있으며, 로그인 후 원래 페이지로 돌아올 수 있습니다.



