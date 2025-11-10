-- ============================================
-- 다중 카테고리를 지원하기 위한 junction 테이블 생성
-- Supabase SQL Editor에서 전체를 복사하여 실행하세요
-- ============================================

-- 1. drum_sheet_categories 테이블 생성
CREATE TABLE IF NOT EXISTS drum_sheet_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sheet_id UUID NOT NULL REFERENCES drum_sheets(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_sheet_category UNIQUE(sheet_id, category_id)
);

-- 2. 인덱스 생성 (성능 향상)
CREATE INDEX IF NOT EXISTS idx_drum_sheet_categories_sheet_id 
  ON drum_sheet_categories(sheet_id);

CREATE INDEX IF NOT EXISTS idx_drum_sheet_categories_category_id 
  ON drum_sheet_categories(category_id);

-- 3. RLS (Row Level Security) 활성화
ALTER TABLE drum_sheet_categories ENABLE ROW LEVEL SECURITY;

-- 4. 정책 설정 - 모든 사용자가 읽기 가능
DROP POLICY IF EXISTS "Anyone can view drum_sheet_categories" ON drum_sheet_categories;
CREATE POLICY "Anyone can view drum_sheet_categories"
  ON drum_sheet_categories
  FOR SELECT
  USING (true);

-- 5. 정책 설정 - 인증된 사용자는 모두 삽입 가능 (임시로 단순화)
-- 나중에 관리자만 가능하도록 변경 가능
DROP POLICY IF EXISTS "Authenticated users can insert drum_sheet_categories" ON drum_sheet_categories;
CREATE POLICY "Authenticated users can insert drum_sheet_categories"
  ON drum_sheet_categories
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- 6. 정책 설정 - 인증된 사용자는 모두 수정 가능 (임시로 단순화)
DROP POLICY IF EXISTS "Authenticated users can update drum_sheet_categories" ON drum_sheet_categories;
CREATE POLICY "Authenticated users can update drum_sheet_categories"
  ON drum_sheet_categories
  FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- 7. 정책 설정 - 인증된 사용자는 모두 삭제 가능 (임시로 단순화)
DROP POLICY IF EXISTS "Authenticated users can delete drum_sheet_categories" ON drum_sheet_categories;
CREATE POLICY "Authenticated users can delete drum_sheet_categories"
  ON drum_sheet_categories
  FOR DELETE
  USING (auth.uid() IS NOT NULL);
