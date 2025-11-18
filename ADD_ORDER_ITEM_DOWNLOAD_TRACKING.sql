ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS download_attempt_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_downloaded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_download_ip TEXT;

COMMENT ON COLUMN order_items.download_attempt_count IS '구매자가 시도한 다운로드 횟수';
COMMENT ON COLUMN order_items.last_downloaded_at IS '마지막으로 다운로드를 시도한 시각';
COMMENT ON COLUMN order_items.last_download_ip IS '마지막 다운로드 요청 시 확인된 IP';






