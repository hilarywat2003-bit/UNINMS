-- ═══════════════════════════════════════════════════════════════
-- UniNMS Migration 020 — Plagiarism: full-text + external sources
-- ═══════════════════════════════════════════════════════════════

-- Enable pg_trgm for trigram-based title pre-filtering
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Store extracted plain text (from PDF/DOCX) so the plagiarism
-- engine operates on full document content instead of just the abstract.
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS full_text TEXT;

-- Trigram index on title — used to pre-filter similar documents
-- when the vector (semantic) pass is unavailable.
CREATE INDEX IF NOT EXISTS idx_docs_title_trgm
  ON documents USING GIN (title gin_trgm_ops)
  WHERE deleted_at IS NULL;

-- Persist external-source findings (CrossRef, Semantic Scholar)
-- and the best sentence-level match pairs found during the check.
ALTER TABLE plagiarism_reports
  ADD COLUMN IF NOT EXISTS external_matches       JSONB   DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS external_source_checked BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sentence_matches        JSONB   DEFAULT '[]';
