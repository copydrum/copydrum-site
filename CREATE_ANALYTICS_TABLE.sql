-- 방문자 추적 테이블 생성 스크립트
-- Supabase SQL Editor에서 실행하세요.

CREATE TABLE IF NOT EXISTS page_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  session_id UUID,
  page_url TEXT NOT NULL,
  referrer TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 최근 조회/필터에 사용할 인덱스
CREATE INDEX IF NOT EXISTS idx_page_views_created_at ON page_views(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_views_user_id ON page_views(user_id);

-- 기본 RLS 설정
ALTER TABLE page_views ENABLE ROW LEVEL SECURITY;

-- 서비스 역할 전체 접근 허용 (서버 측 통계 집계용)
CREATE POLICY IF NOT EXISTS "Service role full access"
  ON page_views
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 인증 사용자 수집 허용 (user_id가 본인인 경우 또는 미식별 방문 기록)
CREATE POLICY IF NOT EXISTS "Authenticated users insert own page views"
  ON page_views FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND (
      user_id IS NULL
      OR user_id = auth.uid()
    )
  );













