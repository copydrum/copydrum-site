-- 기존 주문 데이터의 order_type 보정
-- 주문 타입 추가

-- 1. order_items가 있는 주문은 'product'로 설정
UPDATE public.orders
SET order_type = 'product'
WHERE order_type IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.order_items
    WHERE order_items.order_id = orders.id
  );

-- 2. order_items가 없고 metadata에 cash_charge 관련 정보가 있는 주문은 'cash'로 설정
UPDATE public.orders
SET order_type = 'cash'
WHERE order_type IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.order_items
    WHERE order_items.order_id = orders.id
  )
  AND (
    (metadata->>'type' = 'cash_charge')
    OR (metadata->>'purpose' = 'cash_charge')
    OR (metadata->>'type' = 'cash')
  );

-- 3. order_items가 없고 metadata에 sheet_purchase 관련 정보가 있는 주문은 'product'로 설정
UPDATE public.orders
SET order_type = 'product'
WHERE order_type IS NULL
  AND (
    (metadata->>'type' = 'sheet_purchase')
    OR (metadata->>'type' = 'product')
  );

-- 4. cash_transactions 테이블과 연결된 주문 중 order_items가 없는 경우 'cash'로 설정
UPDATE public.orders
SET order_type = 'cash'
WHERE order_type IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.order_items
    WHERE order_items.order_id = orders.id
  )
  AND EXISTS (
    SELECT 1
    FROM public.cash_transactions
    WHERE cash_transactions.order_id = orders.id
      AND cash_transactions.transaction_type = 'charge'
  );

-- 참고: 위 조건에 맞지 않는 주문은 order_type이 NULL로 남게 됩니다.
-- UI에서는 이러한 주문을 '알 수 없음'으로 표시합니다.

-- 보정 결과 확인 쿼리
-- SELECT 
--   order_type,
--   COUNT(*) as count
-- FROM public.orders
-- GROUP BY order_type
-- ORDER BY order_type;


























