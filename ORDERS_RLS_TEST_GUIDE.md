# Orders RLS 정책 테스트 가이드

## 적용 전 확인사항

1. **RLS 정책 적용**
   - Supabase Dashboard → SQL Editor에서 `ADD_ORDERS_SELECT_RLS_POLICY.sql` 실행
   - 정책이 올바르게 생성되었는지 확인:
     ```sql
     SELECT * FROM pg_policies WHERE tablename = 'orders';
     ```

2. **관리자 계정 확인**
   - `profiles` 테이블에서 관리자 계정 확인:
     ```sql
     SELECT id, email, role, is_admin 
     FROM profiles 
     WHERE email = 'copydrum@hanmail.net';
     ```
   - `is_admin = TRUE` 또는 `role = 'admin'`인지 확인

## 테스트 시나리오

### 시나리오 1: 일반 회원 A의 주문 조회

**목표**: 일반 회원은 본인 주문만 볼 수 있는지 확인

**절차**:
1. 일반 회원 A 계정으로 로그인
2. 주문 생성 (테스트 주문 또는 실제 주문)
3. 마이페이지(`/mypage`) 또는 주문 내역 페이지(`/my-orders`) 접속
4. 확인 사항:
   - ✅ 회원 A의 주문만 표시됨
   - ✅ 다른 회원의 주문은 표시되지 않음

**콘솔 확인**:
- 브라우저 개발자 도구 → Network 탭
- `orders` 쿼리 요청 확인
- 요청 URL에 `user_id=eq.[회원A의ID]` 필터가 포함되어 있는지 확인
- 응답 데이터에 회원 A의 주문만 포함되어 있는지 확인

**예상 쿼리**:
```javascript
// src/pages/mypage/page.tsx 또는 src/pages/my-orders/page.tsx
.eq('user_id', currentUser.id)  // 필터 적용됨
```

---

### 시나리오 2: 일반 회원 B의 주문 조회

**목표**: 다른 일반 회원도 본인 주문만 볼 수 있는지 확인

**절차**:
1. 일반 회원 B 계정으로 로그인 (회원 A와 다른 계정)
2. 주문 생성
3. 마이페이지 또는 주문 내역 페이지 접속
4. 확인 사항:
   - ✅ 회원 B의 주문만 표시됨
   - ✅ 회원 A의 주문은 표시되지 않음

**콘솔 확인**:
- Network 탭에서 `user_id=eq.[회원B의ID]` 필터 확인
- 응답에 회원 B의 주문만 포함되어 있는지 확인

---

### 시나리오 3: 관리자 계정의 전체 주문 조회

**목표**: 관리자는 모든 회원의 주문을 볼 수 있는지 확인

**절차**:
1. 관리자 계정(`copydrum@hanmail.net`)으로 로그인
2. 관리자 페이지(`/admin`) 접속
3. 주문 관리 섹션 확인
4. 확인 사항:
   - ✅ 회원 A의 주문이 표시됨
   - ✅ 회원 B의 주문이 표시됨
   - ✅ 다른 모든 회원의 주문이 표시됨
   - ✅ 무통장 입금 주문도 포함되어 표시됨

**콘솔 확인**:
- 브라우저 개발자 도구 → Network 탭
- `orders` 쿼리 요청 확인
- 요청 URL에 `user_id` 필터가 **없는지** 확인 (필터 없음)
- 응답 데이터에 여러 회원의 주문이 포함되어 있는지 확인

**예상 쿼리**:
```javascript
// src/pages/admin/page.tsx
// .eq('user_id', ...) 필터 없음 - 모든 주문 조회
```

**RLS 정책 동작 확인**:
- Supabase Dashboard → Table Editor → `orders` 테이블
- 관리자 계정으로 직접 쿼리 실행:
  ```sql
  SELECT id, user_id, total_amount, status, created_at 
  FROM orders 
  ORDER BY created_at DESC;
  ```
- 모든 주문이 조회되는지 확인

---

## 디버깅 방법

### 1. RLS 정책 확인

Supabase Dashboard → SQL Editor에서 실행:

```sql
-- 현재 orders 테이블의 모든 정책 확인
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'orders';
```

**예상 결과**:
- `orders_select_own`: 일반 유저용 (auth.uid() = user_id)
- `orders_select_admin`: 관리자용 (is_admin = TRUE 또는 role = 'admin')
- `orders_update_admin`: UPDATE용 (기존 정책)

### 2. 현재 사용자 권한 확인

브라우저 콘솔에서 실행:

```javascript
// Supabase 클라이언트가 이미 로드되어 있다고 가정
const { data: { user } } = await supabase.auth.getUser();
console.log('현재 사용자:', user?.email, user?.id);

// 프로필 확인
const { data: profile } = await supabase
  .from('profiles')
  .select('id, email, role, is_admin')
  .eq('id', user.id)
  .single();
console.log('프로필:', profile);
```

### 3. 직접 쿼리 테스트

**일반 유저로 테스트**:
```javascript
// 일반 유저 계정으로 로그인한 상태에서
const { data, error } = await supabase
  .from('orders')
  .select('*')
  .limit(10);

console.log('조회된 주문 수:', data?.length);
console.log('모든 주문의 user_id:', data?.map(o => o.user_id));
// 예상: 모든 주문의 user_id가 현재 사용자의 ID와 일치해야 함
```

**관리자로 테스트**:
```javascript
// 관리자 계정으로 로그인한 상태에서
const { data, error } = await supabase
  .from('orders')
  .select('*')
  .limit(10);

console.log('조회된 주문 수:', data?.length);
console.log('다양한 user_id:', [...new Set(data?.map(o => o.user_id))]);
// 예상: 여러 다른 user_id가 포함되어야 함
```

### 4. RLS 정책 테스트 (Supabase SQL Editor)

```sql
-- 현재 인증된 사용자 확인
SELECT auth.uid(), auth.email();

-- 관리자 여부 확인
SELECT 
  p.id,
  p.email,
  p.role,
  p.is_admin,
  CASE 
    WHEN p.is_admin = TRUE OR p.role = 'admin' THEN '관리자'
    ELSE '일반 유저'
  END as user_type
FROM profiles p
WHERE p.id = auth.uid();

-- RLS 정책 시뮬레이션 (일반 유저)
-- 이 쿼리는 RLS 정책이 적용된 상태로 실행됨
SELECT 
  id,
  user_id,
  total_amount,
  status,
  created_at
FROM orders
ORDER BY created_at DESC
LIMIT 10;
```

---

## 문제 해결

### 문제 1: 관리자가 모든 주문을 볼 수 없음

**원인**:
- RLS 정책이 올바르게 생성되지 않음
- `profiles` 테이블의 `is_admin` 또는 `role` 값이 올바르지 않음

**해결**:
1. RLS 정책 재생성:
   ```sql
   -- 기존 정책 삭제 후 재생성
   DROP POLICY IF EXISTS "orders_select_admin" ON public.orders;
   
   CREATE POLICY "orders_select_admin"
   ON public.orders
   FOR SELECT
   USING (
     auth.role() = 'service_role'
     OR EXISTS (
       SELECT 1
       FROM public.profiles p
       WHERE p.id = auth.uid()
         AND (
           p.is_admin = TRUE
           OR p.role = 'admin'
           OR p.email = 'copydrum@hanmail.net'
         )
     )
   );
   ```

2. 관리자 권한 확인 및 수정:
   ```sql
   -- 관리자 권한 부여
   UPDATE profiles 
   SET is_admin = TRUE, role = 'admin'
   WHERE email = 'copydrum@hanmail.net';
   ```

### 문제 2: 일반 유저가 다른 유저의 주문을 볼 수 있음

**원인**:
- RLS 정책이 올바르게 작동하지 않음
- 프론트엔드 필터가 누락됨

**해결**:
1. RLS 정책 확인:
   ```sql
   -- orders_select_own 정책 확인
   SELECT qual FROM pg_policies 
   WHERE tablename = 'orders' AND policyname = 'orders_select_own';
   ```

2. 프론트엔드 필터 확인:
   - `src/pages/mypage/page.tsx`의 `loadOrders` 함수
   - `src/pages/my-orders/page.tsx`의 `loadOrders` 함수
   - `.eq('user_id', currentUser.id)` 필터가 있는지 확인

### 문제 3: 쿼리 성능 저하

**원인**:
- RLS 정책의 서브쿼리가 인덱스 없이 실행됨

**해결**:
```sql
-- profiles 테이블에 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin 
  ON profiles(is_admin) WHERE is_admin = TRUE;
  
CREATE INDEX IF NOT EXISTS idx_profiles_role 
  ON profiles(role) WHERE role = 'admin';

-- orders 테이블에 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_orders_user_id 
  ON orders(user_id);
```

---

## 체크리스트

테스트 완료 후 확인:

- [ ] 일반 회원 A는 본인 주문만 조회 가능
- [ ] 일반 회원 B는 본인 주문만 조회 가능
- [ ] 관리자는 모든 회원의 주문 조회 가능
- [ ] 관리자 페이지에서 무통장 입금 주문도 표시됨
- [ ] Network 탭에서 쿼리 필터가 올바르게 적용됨
- [ ] RLS 정책이 Supabase Dashboard에서 확인됨
- [ ] 콘솔에 오류 메시지가 없음

---

## 참고

- RLS 정책 파일: `ADD_ORDERS_SELECT_RLS_POLICY.sql`
- 관리자 페이지: `src/pages/admin/page.tsx` (1786-1833줄)
- 일반 유저 페이지: 
  - `src/pages/mypage/page.tsx` (490-529줄)
  - `src/pages/my-orders/page.tsx` (155-194줄)

