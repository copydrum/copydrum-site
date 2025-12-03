-- drum_sheets 테이블에 popularity_rank 컬럼 추가
-- 인기곡 순위 관리 기능을 위한 컬럼

-- 컬럼 추가 (NULL 허용, 1-10 범위)
ALTER TABLE drum_sheets 
ADD COLUMN IF NOT EXISTS popularity_rank INTEGER CHECK (popularity_rank IS NULL OR (popularity_rank >= 1 AND popularity_rank <= 10));

-- 인덱스 추가 (category_id와 popularity_rank 복합 인덱스)
-- 같은 장르 내에서 순위 조회 성능 향상
CREATE INDEX IF NOT EXISTS idx_drum_sheets_category_popularity 
ON drum_sheets(category_id, popularity_rank) 
WHERE popularity_rank IS NOT NULL;

-- 코멘트 추가
COMMENT ON COLUMN drum_sheets.popularity_rank IS '장르별 인기곡 순위 (1-10위). NULL이면 순위 미지정으로 기존 방식(구매수/조회수) 사용';

