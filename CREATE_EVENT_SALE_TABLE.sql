-- 이벤트 할인 악보 테이블 생성
CREATE TABLE IF NOT EXISTS event_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drum_sheet_id UUID NOT NULL REFERENCES drum_sheets(id) ON DELETE CASCADE,
  event_price INTEGER DEFAULT 100 NOT NULL, -- 이벤트 가격 (기본 100원)
  original_price INTEGER NOT NULL, -- 원래 가격
  start_date TIMESTAMP WITH TIME ZONE NOT NULL, -- 이벤트 시작일
  end_date TIMESTAMP WITH TIME ZONE NOT NULL, -- 이벤트 종료일
  is_active BOOLEAN DEFAULT true, -- 활성화 여부
  display_order INTEGER DEFAULT 0, -- 표시 순서
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(drum_sheet_id) -- 한 악보당 하나의 이벤트만
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_event_sales_is_active ON event_sales(is_active);
CREATE INDEX IF NOT EXISTS idx_event_sales_drum_sheet_id ON event_sales(drum_sheet_id);
CREATE INDEX IF NOT EXISTS idx_event_sales_dates ON event_sales(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_event_sales_display_order ON event_sales(display_order);

-- updated_at 자동 업데이트 트리거 함수
CREATE OR REPLACE FUNCTION update_event_sales_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
CREATE TRIGGER update_event_sales_updated_at_trigger
  BEFORE UPDATE ON event_sales
  FOR EACH ROW
  EXECUTE FUNCTION update_event_sales_updated_at();

-- RLS 정책 설정
ALTER TABLE event_sales ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 활성화된 이벤트 할인 악보 조회 가능 (시작일이 지나지 않아도 조회 가능)
CREATE POLICY "이벤트 할인 악보 조회 허용" ON event_sales
  FOR SELECT
  USING (
    is_active = true 
    AND NOW() <= end_date
  );

-- 관리자만 이벤트 할인 악보 관리 가능
CREATE POLICY "관리자 이벤트 할인 악보 관리" ON event_sales
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
