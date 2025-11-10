-- Supabase RLS 정책 수정 (무한 재귀 해결)

-- 1. 기존 profiles 테이블의 모든 정책 삭제
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Allow users to select their own profile" ON profiles;
DROP POLICY IF EXISTS "Allow admin to view all profiles" ON profiles;
-- 기타 profiles 관련 정책들 삭제
-- Supabase 대시보드에서 확인 후 모두 삭제하세요.

-- 2. 올바른 정책 생성 (무한 재귀 없는 버전)

-- 정책 1: 모든 인증된 사용자는 자신의 프로필만 조회 가능
CREATE POLICY "Users can view own profile"
ON profiles FOR SELECT
USING (auth.uid() = id);

-- 정책 2: 관리자는 모든 프로필 조회 가능 (JWT 클레임 사용)
-- 단, 이 정책을 사용하려면 JWT에 role 클레임이 있어야 합니다.
-- 아래의 함수를 먼저 실행해야 합니다.

-- 3. JWT에 role 클레임 추가하는 함수 (선택사항)
CREATE OR REPLACE FUNCTION public.get_user_role(user_id uuid)
RETURNS text AS $$
DECLARE
  user_role text;
BEGIN
  -- SECURITY DEFINER로 실행하여 RLS를 우회하고 role 조회
  SELECT role INTO user_role
  FROM profiles
  WHERE id = user_id;
  
  RETURN COALESCE(user_role, 'user');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. 관리자 정책 (대안 - 별도 테이블이나 설정 사용)
-- 방법 A: 모든 인증된 사용자가 자신의 프로필 + 관리자 이메일 목록 확인
-- (이 방법은 profiles 테이블을 다시 조회하지 않음)
CREATE POLICY "Admins can view all profiles"
ON profiles FOR SELECT
USING (
  -- 관리자 이메일 목록 (하드코딩)
  auth.email() = 'copydrum@hanmail.net'
  OR auth.email() = ANY(ARRAY['admin1@example.com', 'admin2@example.com'])
  OR auth.uid() = id  -- 자신의 프로필은 항상 조회 가능
);

-- 방법 B: 더 안전한 방법 - 별도의 admin_users 테이블 사용
-- (이 방법을 권장합니다)

-- 관리자 사용자 테이블 생성 (선택사항)
CREATE TABLE IF NOT EXISTS admin_users (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- admin_users에 관리자 추가
INSERT INTO admin_users (user_id, email)
SELECT id, email FROM auth.users WHERE email = 'copydrum@hanmail.net'
ON CONFLICT (user_id) DO NOTHING;

-- admin_users 테이블에 대한 RLS 정책
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view admin list"
ON admin_users FOR SELECT
USING (auth.uid() = user_id);

-- profiles 테이블의 관리자 정책 (admin_users 테이블 사용)
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;

CREATE POLICY "Admins can view all profiles"
ON profiles FOR SELECT
USING (
  auth.uid() = id  -- 자신의 프로필
  OR EXISTS (
    SELECT 1 FROM admin_users 
    WHERE user_id = auth.uid()
  )  -- admin_users에 등록된 사용자는 모든 프로필 조회 가능
);

-- 5. 최종 권장 정책 (가장 간단하고 안전한 방법)

-- 기존 정책 모두 삭제
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;

-- 간단한 정책: 자신의 프로필만 조회 가능
CREATE POLICY "Users can view own profile"
ON profiles FOR SELECT
USING (auth.uid() = id);

-- UPDATE 정책
CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- INSERT 정책 (회원가입 시)
CREATE POLICY "Users can insert own profile"
ON profiles FOR INSERT
WITH CHECK (auth.uid() = id);

-- 6. 관리자 페이지 접근을 위한 별도 방법
-- 클라이언트에서 role을 확인하는 대신, 
-- 서버 사이드 함수나 Edge Function을 사용하거나,
-- 아래와 같이 간단하게 처리:

-- 임시 해결책: 관리자 이메일 체크를 클라이언트에서만 수행
-- (보안상 완벽하지 않지만, 개발 단계에서는 사용 가능)









