ALTER TABLE public.custom_order_messages ENABLE ROW LEVEL SECURITY;

-- 고객: 자신의 주문에 대한 메시지만 조회
CREATE POLICY IF NOT EXISTS "custom_order_messages_select_customer"
ON public.custom_order_messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.custom_orders co
    WHERE co.id = custom_order_messages.custom_order_id
      AND co.user_id = auth.uid()
  )
  OR auth.role() = 'service_role'
);

-- 고객: 자신의 주문에 대한 메시지만 작성
CREATE POLICY IF NOT EXISTS "custom_order_messages_insert_customer"
ON public.custom_order_messages
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND sender_type = 'customer'
  AND EXISTS (
    SELECT 1
    FROM public.custom_orders co
    WHERE co.id = custom_order_messages.custom_order_id
      AND co.user_id = auth.uid()
  )
  OR auth.role() = 'service_role'
);

-- 관리자: 모든 메시지 조회
CREATE POLICY IF NOT EXISTS "custom_order_messages_select_admin"
ON public.custom_order_messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
  )
  OR auth.role() = 'service_role'
);

-- 관리자: Edge Function에서 서비스 키로만 삽입하므로 별도 INSERT 정책 불필요




































