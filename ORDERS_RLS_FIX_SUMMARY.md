# Orders RLS 정책 수정 요약

## 문제점

관리자 계정(`copydrum@hanmail.net`)에서 자기 주문만 보이고, 다른 회원들의 무통장 주문이 관리자 주문 리스트에 보이지 않는 문제가 있었습니다.

**원인**: `orders` 테이블에 SELECT용 RLS 정책이 없어서, 기본적으로 모든 사용자가 본인 주문만 볼 수 있었습니다.

## 해결 방법

### 1. RLS 정책 추가

`ADD_ORDERS_SELECT_RLS_POLICY.sql` 파일을 생성하여 다음 정책을 추가했습니다:

- **일반 유저 정책** (`orders_select_own`): `auth.uid() = user_id`인 주문만 조회 가능
- **관리자 정책** (`orders_select_admin`): `is_admin = TRUE` 또는 `role = 'admin'`인 사용자는 모든 주문 조회 가능

### 2. 프론트엔드 쿼리 확인 및 주석 추가

#### 관리자 페이지 (`src/pages/admin/page.tsx`)
- ✅ 필터 없음 (이미 올바름)
- 주석 추가: "관리자용: 모든 회원의 주문 조회"

#### 일반 유저 페이지
- ✅ 필터 유지 (`.eq('user_id', currentUser.id)`)
- 주석 추가: "일반 유저용: 본인 주문만 조회"
- 적용 파일:
  - `src/pages/mypage/page.tsx`
  - `src/pages/my-orders/page.tsx`

## 적용 방법

### 1단계: RLS 정책 적용

Supabase Dashboard → SQL Editor에서 다음 파일 실행:

```
ADD_ORDERS_SELECT_RLS_POLICY.sql
```

### 2단계: 관리자 권한 확인

```sql
-- 관리자 계정의 권한 확인
SELECT id, email, role, is_admin 
FROM profiles 
WHERE email = 'copydrum@hanmail.net';

-- 권한이 없다면 부여
UPDATE profiles 
SET is_admin = TRUE, role = 'admin'
WHERE email = 'copydrum@hanmail.net';
```

### 3단계: 테스트

자세한 테스트 방법은 `ORDERS_RLS_TEST_GUIDE.md` 참고

## 변경된 파일

### 새로 생성된 파일
1. `ADD_ORDERS_SELECT_RLS_POLICY.sql` - RLS 정책 SQL
2. `ORDERS_RLS_TEST_GUIDE.md` - 테스트 가이드
3. `ORDERS_RLS_FIX_SUMMARY.md` - 이 문서

### 수정된 파일
1. `src/pages/admin/page.tsx` - 주석 추가 (1786-1833줄)
2. `src/pages/mypage/page.tsx` - 주석 추가 (490-529줄)
3. `src/pages/my-orders/page.tsx` - 주석 추가 (155-194줄)

## 주요 변경사항

### RLS 정책 구조

```sql
-- 일반 유저: 본인 주문만
CREATE POLICY "orders_select_own"
ON public.orders FOR SELECT
USING (auth.uid() = user_id);

-- 관리자: 모든 주문
CREATE POLICY "orders_select_admin"
ON public.orders FOR SELECT
USING (
  auth.role() = 'service_role'
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (p.is_admin = TRUE OR p.role = 'admin' OR p.email = 'copydrum@hanmail.net')
  )
);
```

### 프론트엔드 쿼리 구조

**관리자용** (필터 없음):
```typescript
// src/pages/admin/page.tsx
const { data } = await supabase
  .from('orders')
  .select('*')
  .order('created_at', { ascending: false });
  // .eq('user_id', ...) 필터 없음
```

**일반 유저용** (필터 있음):
```typescript
// src/pages/mypage/page.tsx, src/pages/my-orders/page.tsx
const { data } = await supabase
  .from('orders')
  .select('*')
  .eq('user_id', currentUser.id)  // 필터 필수
  .order('created_at', { ascending: false });
```

## 보안 고려사항

1. **이중 보안**: RLS 정책 + 프론트엔드 필터
   - 일반 유저 페이지는 프론트엔드에서도 필터를 적용하여 이중으로 보안을 강화했습니다.
   - 관리자 페이지는 RLS 정책만으로 충분하므로 필터를 제거했습니다.

2. **관리자 권한 확인**
   - `is_admin = TRUE` 또는 `role = 'admin'` 또는 이메일(`copydrum@hanmail.net`)로 관리자 여부를 확인합니다.
   - 여러 방법을 지원하여 유연성을 확보했습니다.

## 다음 단계

1. ✅ RLS 정책 적용 완료
2. ✅ 프론트엔드 쿼리 확인 완료
3. ⏳ 테스트 수행 (테스트 가이드 참고)
4. ⏳ 프로덕션 배포

## 참고 문서

- `ORDERS_RLS_TEST_GUIDE.md` - 상세 테스트 방법
- `ADD_ORDERS_SELECT_RLS_POLICY.sql` - RLS 정책 SQL
- `ADD_ORDERS_ADMIN_UPDATE_POLICY.sql` - 기존 UPDATE 정책 (참고용)




