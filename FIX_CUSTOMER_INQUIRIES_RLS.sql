-- 고객 문의(customer_inquiries) RLS 복구 스크립트
-- 증상: 403 오류로 문의 등록/조회 불가, 관리자 페이지 목록 비어 있음
-- 원인: RLS 활성화 후 INSERT/SELECT 정책이 없어 기본 거부됨

-- 1) RLS 활성화 (이미 활성화되어 있어도 안전)
ALTER TABLE public.customer_inquiries ENABLE ROW LEVEL SECURITY;

-- 2) 기존 정책 정리
DROP POLICY IF EXISTS "Users can insert inquiries" ON public.customer_inquiries;
DROP POLICY IF EXISTS "Users can select own inquiries" ON public.customer_inquiries;
DROP POLICY IF EXISTS "Admins can select all inquiries" ON public.customer_inquiries;
DROP POLICY IF EXISTS "Admins can update inquiries" ON public.customer_inquiries;

-- 3) 문의 등록 허용
-- - 로그인 사용자: user_id가 자신의 uid이거나 NULL인 경우 허용
-- - 비로그인(익명) 문의도 허용하려면 user_id IS NULL 조건 추가
-- - 서비스 키(Edge Function)는 auth.role() = 'service_role' 로 우회 허용
CREATE POLICY "Users can insert inquiries"
ON public.customer_inquiries
FOR INSERT
WITH CHECK (
  auth.role() = 'service_role'
  OR (auth.uid() IS NOT NULL AND (user_id IS NULL OR user_id = auth.uid()))
  OR (auth.uid() IS NULL AND user_id IS NULL) -- 익명 문의 허용
);

-- 4) 사용자 본인 문의 조회 허용
CREATE POLICY "Users can select own inquiries"
ON public.customer_inquiries
FOR SELECT
USING (
  auth.role() = 'service_role'
  OR (auth.uid() IS NOT NULL AND user_id = auth.uid())
);

-- 5) 관리자 전체 조회/업데이트 허용
-- 관리자 이메일 리스트는 필요에 맞게 수정
CREATE POLICY "Admins can select all inquiries"
ON public.customer_inquiries
FOR SELECT
USING (
  auth.role() = 'service_role'
  OR auth.email() IN ('copydrum@hanmail.net', 'admin@copydrum.com')
);

CREATE POLICY "Admins can update inquiries"
ON public.customer_inquiries
FOR UPDATE
USING (
  auth.role() = 'service_role'
  OR auth.email() IN ('copydrum@hanmail.net', 'admin@copydrum.com')
)
WITH CHECK (
  auth.role() = 'service_role'
  OR auth.email() IN ('copydrum@hanmail.net', 'admin@copydrum.com')
);

-- 6) 필요 시 관리자 삭제 권한 추가 (주석 해제하여 사용)
-- CREATE POLICY "Admins can delete inquiries"
-- ON public.customer_inquiries
-- FOR DELETE
-- USING (
--   auth.role() = 'service_role'
--   OR auth.email() IN ('copydrum@hanmail.net', 'admin@copydrum.com')
-- );

-- 실행 후 확인:
-- - 일반/로그인 사용자가 문의 등록 시 200 OK
-- - 관리자 페이지 문의 목록 정상 조회
-- - 기존 RLS 충돌 없음 확인

