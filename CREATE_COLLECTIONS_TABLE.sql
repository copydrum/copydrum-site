-- 모음집 테이블 생성
CREATE TABLE IF NOT EXISTS collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  original_price INTEGER DEFAULT 0,
  sale_price INTEGER DEFAULT 0,
  discount_percentage INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 기존 테이블이 있는 경우 컬럼 추가 (이미 생성된 경우 실행)
ALTER TABLE collections ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
ALTER TABLE collections ADD COLUMN IF NOT EXISTS original_price INTEGER DEFAULT 0;
ALTER TABLE collections ADD COLUMN IF NOT EXISTS sale_price INTEGER DEFAULT 0;
ALTER TABLE collections ADD COLUMN IF NOT EXISTS discount_percentage INTEGER DEFAULT 0;

-- 모음집-악보 연결 테이블 생성
CREATE TABLE IF NOT EXISTS collection_sheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  drum_sheet_id UUID NOT NULL REFERENCES drum_sheets(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(collection_id, drum_sheet_id)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_collections_is_active ON collections(is_active);
CREATE INDEX IF NOT EXISTS idx_collection_sheets_collection_id ON collection_sheets(collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_sheets_drum_sheet_id ON collection_sheets(drum_sheet_id);

-- updated_at 자동 업데이트 트리거 함수
CREATE OR REPLACE FUNCTION update_collections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
CREATE TRIGGER update_collections_updated_at_trigger
  BEFORE UPDATE ON collections
  FOR EACH ROW
  EXECUTE FUNCTION update_collections_updated_at();

-- RLS 정책 설정 (필요한 경우)
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_sheets ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 모음집 조회 가능
CREATE POLICY "모음집 조회 허용" ON collections
  FOR SELECT
  USING (true);

-- 관리자만 모음집 생성/수정/삭제 가능
CREATE POLICY "관리자 모음집 관리" ON collections
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- 모든 사용자가 모음집-악보 연결 조회 가능
CREATE POLICY "모음집-악보 연결 조회 허용" ON collection_sheets
  FOR SELECT
  USING (true);

-- 관리자만 모음집-악보 연결 생성/수정/삭제 가능
CREATE POLICY "관리자 모음집-악보 연결 관리" ON collection_sheets
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

