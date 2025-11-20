CREATE TABLE IF NOT EXISTS public.site_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES public.profiles(id)
);

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "관리자 설정 조회 허용"
  ON public.site_settings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_admin = TRUE
    )
    OR auth.role() = 'service_role'
  );

CREATE POLICY "관리자 설정 관리"
  ON public.site_settings
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

CREATE OR REPLACE FUNCTION public.set_site_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_site_settings_updated_at ON public.site_settings;

CREATE TRIGGER set_site_settings_updated_at
  BEFORE UPDATE ON public.site_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_site_settings_updated_at();













