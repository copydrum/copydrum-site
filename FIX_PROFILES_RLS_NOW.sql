-- Supabase RLS 정책 수정 (즉시 실행용)
-- 프로젝트: copydrum_site
-- 테이블: profiles

-- ==========================================
-- 1단계: 기존 정책 모두 삭제
-- ==========================================
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Allow users to select their own profile" ON profiles;
DROP POLICY IF EXISTS "Allow admin to view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view profiles" ON profiles;
DROP POLICY IF EXISTS "Authenticated users can view their own profile" ON profiles;

-- ==========================================
-- 2단계: 새 정책 생성 (무한 재귀 없음)
-- ==========================================

-- 정책 1: 모든 인증된 사용자는 자신의 프로필 조회 가능
CREATE POLICY "Users can view own profile"
ON profiles FOR SELECT
USING (auth.uid() = id);

-- 정책 2: 관리자 이메일로 로그인한 사용자는 모든 프로필 조회 가능
CREATE POLICY "Admins can view all profiles"
ON profiles FOR SELECT
USING (
  auth.uid() = id  -- 자신의 프로필은 항상 조회 가능
  OR auth.email() = 'copydrum@hanmail.net'  -- 관리자 이메일
);

-- ==========================================
-- 3단계: UPDATE 정책 (자신의 프로필만 수정 가능)
-- ==========================================
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- ==========================================
-- 4단계: INSERT 정책 (회원가입 시 자신의 프로필 생성)
-- ==========================================
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

CREATE POLICY "Users can insert own profile"
ON profiles FOR INSERT
WITH CHECK (auth.uid() = id);

-- ==========================================
-- 5단계: DELETE 정책 (관리자만 삭제 가능)
-- ==========================================
DROP POLICY IF EXISTS "Admins can delete profiles" ON profiles;

CREATE POLICY "Admins can delete profiles"
ON profiles FOR DELETE
USING (
  auth.email() = 'copydrum@hanmail.net'  -- 관리자만 삭제 가능
);

-- ==========================================
-- 확인 쿼리 (실행 후 확인)
-- ==========================================
-- SELECT * FROM profiles LIMIT 10; -- 이 쿼리는 브라우저에서 테스트

-- ==========================================
-- 완료!
-- ==========================================
-- 위 SQL을 실행한 후 브라우저에서 페이지를 새로고침하세요.
-- 회원 목록이 정상적으로 표시됩니다.









