ALTER TABLE public.custom_orders
  ADD COLUMN IF NOT EXISTS completed_pdf_url TEXT,
  ADD COLUMN IF NOT EXISTS completed_pdf_filename TEXT,
  ADD COLUMN IF NOT EXISTS download_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_download_count INTEGER DEFAULT 5,
  ADD COLUMN IF NOT EXISTS download_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS song_url TEXT,
  ADD COLUMN IF NOT EXISTS requirements TEXT,
  ADD COLUMN IF NOT EXISTS admin_reply TEXT;

ALTER TABLE public.custom_orders
  ALTER COLUMN status SET DEFAULT 'pending';

ALTER TABLE public.custom_orders
  DROP CONSTRAINT IF EXISTS custom_orders_status_check;

ALTER TABLE public.custom_orders
  ADD CONSTRAINT custom_orders_status_check CHECK (
    status IN (
      'pending',
      'quoted',
      'payment_confirmed',
      'in_progress',
      'completed',
      'cancelled'
    )
  );






