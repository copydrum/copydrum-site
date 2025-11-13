ALTER TABLE public.custom_orders
  ADD COLUMN IF NOT EXISTS completed_pdf_url TEXT,
  ADD COLUMN IF NOT EXISTS completed_pdf_filename TEXT,
  ADD COLUMN IF NOT EXISTS download_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_download_count INTEGER DEFAULT 5,
  ADD COLUMN IF NOT EXISTS download_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS song_url TEXT,
  ADD COLUMN IF NOT EXISTS requirements TEXT,
  ADD COLUMN IF NOT EXISTS admin_reply TEXT;




