-- Per-category option lists for SELECT attributes (e.g. size differs for Plywood vs Laminates)
ALTER TABLE "AttributeCategoryLink" ADD COLUMN IF NOT EXISTS "optionsOverride" JSONB;
