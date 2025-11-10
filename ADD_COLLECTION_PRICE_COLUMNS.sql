-- 모음집 가격 컬럼 추가 (기존 테이블이 있는 경우 실행)
-- Supabase SQL Editor에서 실행하세요

ALTER TABLE collections ADD COLUMN IF NOT EXISTS original_price INTEGER DEFAULT 0;
ALTER TABLE collections ADD COLUMN IF NOT EXISTS sale_price INTEGER DEFAULT 0;
ALTER TABLE collections ADD COLUMN IF NOT EXISTS discount_percentage INTEGER DEFAULT 0;

-- 기존 데이터가 있는 경우 기본값 설정
UPDATE collections SET original_price = 0 WHERE original_price IS NULL;
UPDATE collections SET sale_price = 0 WHERE sale_price IS NULL;
UPDATE collections SET discount_percentage = 0 WHERE discount_percentage IS NULL;





