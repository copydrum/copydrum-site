-- cash_transactions 테이블 생성 및 RLS 정책 설정
-- Supabase SQL Editor에서 실행하세요.

CREATE TABLE IF NOT EXISTS public.cash_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('charge', 'use', 'admin_add', 'admin_deduct')),
  amount INTEGER NOT NULL,
  bonus_amount INTEGER NOT NULL DEFAULT 0,
  balance_after INTEGER NOT NULL,
  description TEXT DEFAULT '',
  sheet_id UUID REFERENCES public.drum_sheets(id) ON DELETE SET NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cash_transactions_user_created_at
  ON public.cash_transactions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cash_transactions_type_created_at
  ON public.cash_transactions (transaction_type, created_at DESC);

ALTER TABLE public.cash_transactions ENABLE ROW LEVEL SECURITY;

-- 사용자 본인 내역 조회 + 관리자 전체 조회
CREATE POLICY "cash_transactions_select_policy"
  ON public.cash_transactions
  FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR auth.uid() = user_id
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_admin = TRUE
    )
  );

-- 사용자 본인 충전/사용 기록 생성
CREATE POLICY "cash_transactions_insert_self"
  ON public.cash_transactions
  FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR auth.uid() = user_id
  );

-- 관리자는 모든 사용자에 대해 트랜잭션 생성 가능
CREATE POLICY "cash_transactions_insert_admin"
  ON public.cash_transactions
  FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_admin = TRUE
    )
  );

-- 관리자는 트랜잭션 정정(필요 시) 가능
CREATE POLICY "cash_transactions_update_admin"
  ON public.cash_transactions
  FOR UPDATE
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_admin = TRUE
    )
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_admin = TRUE
    )
  );

-- 관리자는 트랜잭션 삭제 가능 (필요 시)
CREATE POLICY "cash_transactions_delete_admin"
  ON public.cash_transactions
  FOR DELETE
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_admin = TRUE
    )
  );
















