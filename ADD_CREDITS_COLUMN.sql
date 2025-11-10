-- profiles 테이블에 credits (적립금) 컬럼 추가
-- 이 SQL을 Supabase SQL Editor에서 실행하세요.

-- 1. credits 컬럼 추가 (기본값 0)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS credits INTEGER DEFAULT 0;

-- 2. 기존 데이터의 credits를 0으로 설정 (NULL인 경우)
UPDATE profiles 
SET credits = 0 
WHERE credits IS NULL;

-- 3. NOT NULL 제약 조건 추가 (선택사항)
-- ALTER TABLE profiles 
-- ALTER COLUMN credits SET NOT NULL;

-- 4. 컬럼이 제대로 추가되었는지 확인
-- SELECT column_name, data_type, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'profiles' AND column_name = 'credits';





