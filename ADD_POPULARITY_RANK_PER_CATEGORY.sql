-- ============================================
-- 카테고리별 인기 순위 저장 컬럼 추가
-- drum_sheet_categories 테이블에 popularity_rank 컬럼을 추가하고
-- (category_id, popularity_rank) 유니크 인덱스를 생성합니다.
-- ============================================

-- 컬럼 추가
ALTER TABLE drum_sheet_categories
  ADD COLUMN IF NOT EXISTS popularity_rank INTEGER;

-- 동일 카테고리 내에서 순위 중복 방지 (NULL은 허용)
CREATE UNIQUE INDEX IF NOT EXISTS uq_drum_sheet_categories_category_rank
  ON drum_sheet_categories (category_id, popularity_rank)
  WHERE popularity_rank IS NOT NULL;

-- 참고: 기존 drum_sheets.popularity_rank 컬럼은 더 이상 사용하지 않습니다.
-- 필요하면 아래와 같이 초기화할 수 있습니다.
-- UPDATE drum_sheets SET popularity_rank = NULL;


