-- ============================================
-- 회원탈퇴 기능을 위한 RLS 정책 추가
-- 사용자가 본인 데이터를 삭제할 수 있도록 허용
-- ============================================

-- 1. cart_items 테이블: 사용자가 본인 장바구니 아이템 삭제 가능
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can delete own cart items" ON public.cart_items;
CREATE POLICY "Users can delete own cart items"
ON public.cart_items
FOR DELETE
USING (auth.uid() = user_id);

-- 2. customer_inquiries 테이블: 사용자가 본인 문의 삭제 가능
ALTER TABLE public.customer_inquiries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can delete own inquiries" ON public.customer_inquiries;
CREATE POLICY "Users can delete own inquiries"
ON public.customer_inquiries
FOR DELETE
USING (auth.uid() = user_id);

-- 3. custom_orders 테이블: 사용자가 본인 맞춤 주문 삭제 가능
ALTER TABLE public.custom_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can delete own custom orders" ON public.custom_orders;
CREATE POLICY "Users can delete own custom orders"
ON public.custom_orders
FOR DELETE
USING (auth.uid() = user_id);

-- 4. orders 테이블: 사용자가 본인 주문 삭제 가능 (기존 관리자 정책 유지)
-- 기존 관리자 정책은 유지하고, 사용자 본인 삭제 정책 추가
DROP POLICY IF EXISTS "Users can delete own orders" ON public.orders;
CREATE POLICY "Users can delete own orders"
ON public.orders
FOR DELETE
USING (auth.uid() = user_id);

-- 5. profiles 테이블: 사용자가 본인 프로필 삭제 가능 (기존 관리자 정책 유지)
-- 기존 관리자 정책은 유지하고, 사용자 본인 삭제 정책 추가
DROP POLICY IF EXISTS "Users can delete own profile" ON public.profiles;
CREATE POLICY "Users can delete own profile"
ON public.profiles
FOR DELETE
USING (auth.uid() = id);

-- 6. user_favorites 테이블: 이미 DELETE 정책이 있지만 확인용
-- (CREATE_USER_FAVORITES_TABLE.sql에서 이미 설정됨)

-- ============================================
-- 완료!
-- ============================================
-- 이 정책들은 Edge Function의 Service Role Key가 RLS를 우회하더라도
-- 보안상 좋은 관행으로 추가되었습니다.
-- 사용자가 직접 클라이언트에서 삭제를 시도할 경우를 대비한 정책입니다.

