-- Drop existing check constraints
ALTER TABLE public.marketing_settings DROP CONSTRAINT IF EXISTS marketing_settings_platform_check;
ALTER TABLE public.marketing_posts DROP CONSTRAINT IF EXISTS marketing_posts_platform_check;

-- Add new check constraints including all platforms
ALTER TABLE public.marketing_settings 
ADD CONSTRAINT marketing_settings_platform_check 
CHECK (platform IN ('tistory', 'pinterest', 'naver', 'facebook', 'google'));

ALTER TABLE public.marketing_posts 
ADD CONSTRAINT marketing_posts_platform_check 
CHECK (platform IN ('tistory', 'pinterest', 'naver', 'facebook', 'google'));

-- Insert default settings for new platforms
INSERT INTO public.marketing_settings (platform, is_enabled, daily_limit)
VALUES 
    ('naver', false, 1),
    ('facebook', false, 1),
    ('google', false, 1)
ON CONFLICT (platform) DO NOTHING;
