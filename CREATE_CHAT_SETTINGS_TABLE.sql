CREATE TABLE IF NOT EXISTS public.chat_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  offline_message TEXT NOT NULL DEFAULT '현재 오프라인 상태입니다. 남겨주신 메시지는 확인 후 이메일로 답변드립니다.',
  business_hours TEXT NOT NULL DEFAULT '평일 10:00-17:00 (점심시간 12:00-13:00)',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS chat_settings_single_row
  ON public.chat_settings ((TRUE));

ALTER TABLE public.chat_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "채팅 설정 조회 허용"
  ON public.chat_settings
  FOR SELECT
  USING (TRUE);

CREATE POLICY "관리자 채팅 설정 관리"
  ON public.chat_settings
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_admin = TRUE
    )
    OR auth.role() = 'service_role'
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_admin = TRUE
    )
    OR auth.role() = 'service_role'
  );

CREATE OR REPLACE FUNCTION public.set_chat_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_chat_settings_updated_at ON public.chat_settings;

CREATE TRIGGER set_chat_settings_updated_at
  BEFORE UPDATE ON public.chat_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_chat_settings_updated_at();









