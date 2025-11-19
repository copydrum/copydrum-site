-- ==========================================
-- Profiles 테이블 RLS 정책 수정
-- 캐시 잔액 조회 문제 해결을 위한 정책 적용
-- ==========================================
-- 
-- 문제: 사용자가 자신의 프로필을 조회할 때 credits 필드가 0으로 표시됨
-- 원인: RLS 정책이 제대로 적용되지 않았거나, 정책이 없을 수 있음
-- 해결: 명확한 RLS 정책을 생성하여 사용자가 자신의 프로필을 조회할 수 있도록 함
--
-- 캐시 잔액의 기준(source of truth): profiles 테이블의 credits 필드
-- - 관리자 페이지와 사용자 페이지 모두 동일한 소스를 사용합니다.
-- ==========================================

-- ==========================================
-- 1단계: 기존 정책 모두 삭제
-- ==========================================
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow users to select their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow admin to view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view their own profile" ON public.profiles;

-- ==========================================
-- 2단계: RLS 활성화 확인
-- ==========================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- 3단계: SELECT 정책 생성 (무한 재귀 없음)
-- ==========================================

-- 정책 1: 모든 인증된 사용자는 자신의 프로필 조회 가능
-- 이 정책은 auth.uid()와 id를 직접 비교하므로 재귀가 발생하지 않습니다.
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

-- 정책 2: 관리자 이메일로 로그인한 사용자는 모든 프로필 조회 가능
-- 관리자 페이지에서 모든 회원의 캐시 잔액을 조회할 수 있도록 합니다.
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (
  auth.uid() = id  -- 자신의 프로필은 항상 조회 가능
  OR auth.email() = 'copydrum@hanmail.net'  -- 관리자 이메일
);

-- ==========================================
-- 4단계: UPDATE 정책 (자신의 프로필만 수정 가능)
-- ==========================================
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- ==========================================
-- 5단계: INSERT 정책 (회원가입 시 자신의 프로필 생성)
-- ==========================================
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

CREATE POLICY "Users can insert own profile"
ON public.profiles
FOR INSERT
WITH CHECK (auth.uid() = id);

-- ==========================================
-- 6단계: DELETE 정책 (관리자만 삭제 가능)
-- ==========================================
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;

CREATE POLICY "Admins can delete profiles"
ON public.profiles
FOR DELETE
USING (
  auth.email() = 'copydrum@hanmail.net'  -- 관리자만 삭제 가능
);

-- ==========================================
-- 확인 쿼리 (실행 후 확인)
-- ==========================================
-- 다음 쿼리들을 Supabase SQL Editor에서 실행하여 정책이 제대로 적용되었는지 확인하세요:
--
-- 1. 현재 정책 확인:
--    SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
--    FROM pg_policies 
--    WHERE tablename = 'profiles';
--
-- 2. RLS 활성화 확인:
--    SELECT tablename, rowsecurity 
--    FROM pg_tables 
--    WHERE schemaname = 'public' AND tablename = 'profiles';
--
-- 3. 테스트 쿼리 (브라우저 콘솔에서 실행):
--    const { data, error } = await supabase
--      .from('profiles')
--      .select('id, email, credits')
--      .eq('id', (await supabase.auth.getUser()).data.user.id)
--      .single();
--    console.log('Profile data:', data);
--    console.log('Error:', error);

-- ==========================================
-- 완료!
-- ==========================================
-- 위 SQL을 실행한 후:
-- 1. 브라우저에서 페이지를 새로고침하세요.
-- 2. 개발자 도구 콘솔에서 에러 메시지를 확인하세요.
-- 3. Network 탭에서 profiles 테이블 조회 요청이 성공하는지 확인하세요.
-- 4. copydrum@hanmail.net 계정으로 로그인했을 때 
--    관리자 페이지(233,500원)와 동일한 금액이 
--    사이드바/마이페이지에서 표시되는지 확인하세요.

