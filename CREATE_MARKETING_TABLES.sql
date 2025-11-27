-- Create marketing_settings table
CREATE TABLE IF NOT EXISTS public.marketing_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    platform TEXT NOT NULL CHECK (platform IN ('tistory', 'pinterest')),
    credentials JSONB DEFAULT '{}'::jsonb,
    is_enabled BOOLEAN DEFAULT false,
    daily_limit INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(platform)
);

-- Create marketing_posts table
CREATE TABLE IF NOT EXISTS public.marketing_posts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sheet_id UUID NOT NULL REFERENCES public.drum_sheets(id),
    platform TEXT NOT NULL CHECK (platform IN ('tistory', 'pinterest')),
    status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
    post_url TEXT,
    error_message TEXT,
    posted_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add RLS policies
ALTER TABLE public.marketing_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_posts ENABLE ROW LEVEL SECURITY;

-- Only admins can view/edit settings
CREATE POLICY "Admins can view marketing settings" ON public.marketing_settings
    FOR SELECT USING (auth.role() = 'service_role' OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Admins can update marketing settings" ON public.marketing_settings
    FOR UPDATE USING (auth.role() = 'service_role' OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Admins can insert marketing settings" ON public.marketing_settings
    FOR INSERT WITH CHECK (auth.role() = 'service_role' OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

-- Only admins can view posts history
CREATE POLICY "Admins can view marketing posts" ON public.marketing_posts
    FOR SELECT USING (auth.role() = 'service_role' OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Admins can insert marketing posts" ON public.marketing_posts
    FOR INSERT WITH CHECK (auth.role() = 'service_role' OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

-- Insert default settings rows
INSERT INTO public.marketing_settings (platform, is_enabled, daily_limit)
VALUES 
    ('tistory', false, 1),
    ('pinterest', false, 1)
ON CONFLICT (platform) DO NOTHING;
