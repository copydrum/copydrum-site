-- Orders 테이블 SELECT RLS 정책 추가
-- 일반 유저: 본인 주문만 조회 가능
-- 관리자: 모든 주문 조회 가능

-- 기존 SELECT 정책이 있다면 삭제
DROP POLICY IF EXISTS "orders_select_own" ON public.orders;
DROP POLICY IF EXISTS "orders_select_admin" ON public.orders;
DROP POLICY IF EXISTS "users_see_own_orders_admins_see_all" ON public.orders;

-- RLS 활성화 (이미 활성화되어 있어도 안전하게 실행)
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- 정책 1: 일반 유저는 본인 주문만 조회 가능
CREATE POLICY "orders_select_own"
ON public.orders
FOR SELECT
USING (
  auth.uid() = user_id
);

-- 정책 2: 관리자는 모든 주문 조회 가능
-- is_admin 컬럼 또는 role = 'admin' 둘 다 지원
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
        OR p.email = 'copydrum@hanmail.net'  -- 관리자 이메일 예외 처리
      )
  )
);

-- 참고: 두 정책이 모두 적용되므로 OR 조건으로 동작합니다.
-- 일반 유저는 정책 1만 통과하고, 관리자는 정책 1과 2 모두 통과하여 모든 주문을 볼 수 있습니다.


























