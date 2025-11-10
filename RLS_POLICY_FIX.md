# Supabase RLS 정책 수정 가이드
## 무한 재귀 오류 해결: `infinite recursion detected in policy for relation "profiles"`

---

## 문제 원인

`profiles` 테이블의 RLS 정책이 자기 자신(`profiles`)을 다시 조회하면서 무한 재귀가 발생합니다.

**예시 (문제가 있는 정책):**
```sql
-- ❌ 이렇게 하면 무한 재귀 발생!
CREATE POLICY "bad policy"
ON profiles FOR SELECT
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);
```

---

## 해결 방법

### 방법 1: 간단한 정책으로 교체 (권장)

Supabase 대시보드 → Authentication → Policies → `profiles` 테이블

**기존 정책 모두 삭제 후 다음 정책만 생성:**

```sql
-- 1. 자신의 프로필만 조회 가능
CREATE POLICY "Users can view own profile"
ON profiles FOR SELECT
USING (auth.uid() = id);
```

이 정책은 `profiles` 테이블을 다시 조회하지 않으므로 재귀가 발생하지 않습니다.

---

### 방법 2: 관리자 접근 허용 (하드코딩)

관리자 이메일을 직접 명시하는 방법:

```sql
-- 기존 정책 삭제
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;

-- 새 정책 생성
CREATE POLICY "Users can view profiles"
ON profiles FOR SELECT
USING (
  auth.uid() = id  -- 자신의 프로필
  OR auth.email() = 'copydrum@hanmail.net'  -- 관리자 이메일
);
```

---

### 방법 3: 서버 사이드 함수 사용 (가장 안전)

관리자 권한 체크를 Edge Function이나 PostgreSQL 함수로 처리:

```sql
-- PostgreSQL 함수 생성
CREATE OR REPLACE FUNCTION is_admin(user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = user_id AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 정책에서 함수 사용
CREATE POLICY "Users can view profiles"
ON profiles FOR SELECT
USING (
  auth.uid() = id
  OR is_admin(auth.uid())
);
```

---

## 실행 순서

### 1단계: Supabase 대시보드 접속
1. https://app.supabase.com 접속
2. 프로젝트 선택

### 2단계: 기존 정책 확인 및 삭제
1. 왼쪽 메뉴 → **Authentication** → **Policies**
2. `profiles` 테이블 선택
3. 기존 정책 모두 삭제

### 3단계: 새 정책 생성
SQL Editor에서 실행:

```sql
-- 기존 정책 모두 삭제 (반복 실행해도 안전)
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Allow users to select their own profile" ON profiles;
DROP POLICY IF EXISTS "Allow admin to view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;

-- 새 정책 생성 (간단한 버전)
CREATE POLICY "Users can view own profile"
ON profiles FOR SELECT
USING (auth.uid() = id);
```

### 4단계: 관리자 권한 추가 (선택사항)

만약 관리자가 모든 프로필을 조회해야 한다면:

```sql
-- 관리자 이메일 하드코딩 방식
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;

CREATE POLICY "Users can view profiles"
ON profiles FOR SELECT
USING (
  auth.uid() = id  -- 자신의 프로필
  OR auth.email() = 'copydrum@hanmail.net'  -- 관리자
);
```

### 5단계: 테스트
1. 브라우저 새로고침 (Ctrl + F5)
2. `/admin` 페이지 접속
3. 콘솔에서 오류 확인

---

## 추가 참고사항

### 현재 코드 수정 필요

관리자 페이지 코드에서는 여전히 `role`을 체크하지만, 
정책 수정 후에는 정상적으로 작동할 것입니다.

만약 여전히 문제가 있다면, 클라이언트 측에서 role 체크를 우회하는 방법도 있습니다:

```typescript
// 임시 해결책: 특정 이메일을 관리자로 인정
const ADMIN_EMAILS = ['copydrum@hanmail.net'];

if (ADMIN_EMAILS.includes(session.user.email || '')) {
  setIsAdmin(true);
  // ...
}
```

하지만 이 방법은 보안상 완벽하지 않으므로, 
가장 좋은 방법은 서버 사이드에서 처리하는 것입니다.









