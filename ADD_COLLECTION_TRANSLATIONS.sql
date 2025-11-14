-- Add translation columns for collection titles and descriptions
ALTER TABLE collections
  ADD COLUMN IF NOT EXISTS title_translations JSONB DEFAULT '{}'::jsonb;

ALTER TABLE collections
  ADD COLUMN IF NOT EXISTS description_translations JSONB DEFAULT '{}'::jsonb;

-- Ensure updated_at trigger exists (idempotent)
CREATE OR REPLACE FUNCTION update_collections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_collections_updated_at_trigger ON collections;

CREATE TRIGGER update_collections_updated_at_trigger
  BEFORE UPDATE ON collections
  FOR EACH ROW
  EXECUTE FUNCTION update_collections_updated_at();
