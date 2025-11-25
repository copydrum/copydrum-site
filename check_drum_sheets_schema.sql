-- drum_sheets 테이블의 실제 스키마 확인
-- Supabase SQL Editor에서 실행하세요

-- 1. 테이블 구조 확인
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default,
    ordinal_position
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'drum_sheets'
ORDER BY ordinal_position;

-- 2. difficulty 필드의 제약 조건 확인
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.drum_sheets'::regclass
  AND conname LIKE '%difficulty%';

-- 3. "기타" 카테고리가 있는지 확인
SELECT id, name 
FROM categories 
WHERE name = '기타';

-- 4. drum_sheets 테이블의 모든 CHECK 제약 조건 확인
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.drum_sheets'::regclass
  AND contype = 'c';

