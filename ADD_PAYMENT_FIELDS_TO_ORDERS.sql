-- Orders 테이블 결제 관련 필드 확장
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS payment_status TEXT,
ADD COLUMN IF NOT EXISTS transaction_id TEXT,
ADD COLUMN IF NOT EXISTS virtual_account_info JSONB,
ADD COLUMN IF NOT EXISTS payment_confirmed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS depositor_name TEXT,
ADD COLUMN IF NOT EXISTS raw_status TEXT,
ADD COLUMN IF NOT EXISTS metadata JSONB;

ALTER TABLE orders
ALTER COLUMN payment_status SET DEFAULT 'pending';

ALTER TABLE orders
ADD CONSTRAINT orders_payment_status_check CHECK (
  payment_status IN (
    'pending',
    'awaiting_deposit',
    'paid',
    'failed',
    'cancelled',
    'refunded'
  )
);

-- 결제 트랜잭션 로그 테이블
CREATE TABLE IF NOT EXISTS payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  payment_method TEXT NOT NULL,
  payment_provider TEXT,
  amount INTEGER NOT NULL,
  status TEXT NOT NULL,
  pg_transaction_id TEXT,
  raw_request JSONB,
  raw_response JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS payment_transactions_order_id_idx ON payment_transactions (order_id);
CREATE INDEX IF NOT EXISTS payment_transactions_user_id_idx ON payment_transactions (user_id);
CREATE INDEX IF NOT EXISTS payment_transactions_status_idx ON payment_transactions (status);

