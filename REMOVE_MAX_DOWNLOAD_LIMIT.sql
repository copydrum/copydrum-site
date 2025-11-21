ALTER TABLE public.custom_orders
  ALTER COLUMN max_download_count DROP DEFAULT;

UPDATE public.custom_orders
SET max_download_count = NULL
WHERE max_download_count = 5;











