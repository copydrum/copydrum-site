-- Orders 테이블에 주문 타입 필드 추가
-- 주문 타입 추가

-- 1. order_type 컬럼 추가
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS order_type TEXT;

-- 2. CHECK 제약조건 추가 (선택사항 - 데이터 무결성 보장)
ALTER TABLE public.orders
DROP CONSTRAINT IF EXISTS orders_order_type_check;

ALTER TABLE public.orders
ADD CONSTRAINT orders_order_type_check CHECK (
  order_type IS NULL OR order_type IN ('product', 'cash')
);

-- 3. 인덱스 추가 (주문 타입으로 필터링 성능 향상)
CREATE INDEX IF NOT EXISTS idx_orders_order_type ON public.orders (order_type);

-- 4. 주석 추가
COMMENT ON COLUMN public.orders.order_type IS '주문 타입: product(악보 구매), cash(캐시 충전)';











