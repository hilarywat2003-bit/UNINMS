-- 023_article_metrics.sql
-- Article view/download counters + submission_guidelines on journals

ALTER TABLE manuscripts
  ADD COLUMN IF NOT EXISTS view_count     INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS download_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE journals
  ADD COLUMN IF NOT EXISTS submission_guidelines TEXT,
  ADD COLUMN IF NOT EXISTS author_instructions   TEXT;
