-- ═══════════════════════════════════════════════════════════════
-- UniNMS Migration 014 — Plagiarism schema completions
-- Adds columns referenced by the plagiarism service that were
-- omitted from migration 011.
-- ═══════════════════════════════════════════════════════════════

-- content_hash on documents: SHA-256 of normalised title+abstract
-- used for exact-duplicate detection (Pass 1 of the pipeline)
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS content_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_docs_content_hash
  ON documents(content_hash) WHERE deleted_at IS NULL;

-- methods_used: which detection passes ran (e.g. ['exact_hash','semantic_vector','text_shingle'])
-- is_duplicate: true when score >= DUPLICATE_THRESHOLD (0.97)
ALTER TABLE plagiarism_reports
  ADD COLUMN IF NOT EXISTS methods_used TEXT[]   DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_duplicate BOOLEAN  DEFAULT FALSE;
