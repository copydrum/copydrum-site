-- Drop existing status check constraint
ALTER TABLE public.marketing_posts DROP CONSTRAINT IF EXISTS marketing_posts_status_check;

-- Add new status check constraint including 'manual_copy' and 'skipped'
ALTER TABLE public.marketing_posts 
ADD CONSTRAINT marketing_posts_status_check 
CHECK (status IN ('success', 'failed', 'manual_copy', 'skipped'));
