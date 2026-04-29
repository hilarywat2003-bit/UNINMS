-- ═══════════════════════════════════════════════════════════════
-- UniNMS Migration 011 — Plagiarism & Similarity Detection
-- ═══════════════════════════════════════════════════════════════

-- Add plagiarism tracking columns to documents
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS plagiarism_score  NUMERIC(5,4),
  ADD COLUMN IF NOT EXISTS plagiarism_status VARCHAR(20) DEFAULT 'unchecked';

-- Detailed plagiarism reports (one report per document, updated on re-check)
CREATE TABLE IF NOT EXISTS plagiarism_reports (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id    UUID NOT NULL UNIQUE REFERENCES documents(id) ON DELETE CASCADE,
  matched_doc_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  overall_score  NUMERIC(5,4) NOT NULL DEFAULT 0,
  semantic_score NUMERIC(5,4),
  text_score     NUMERIC(5,4),
  matched_title  TEXT,
  match_details  JSONB DEFAULT '[]',
  checked_at     TIMESTAMPTZ DEFAULT NOW(),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plagiarism_doc   ON plagiarism_reports(document_id);
CREATE INDEX IF NOT EXISTS idx_plagiarism_score ON plagiarism_reports(overall_score DESC);
CREATE INDEX IF NOT EXISTS idx_docs_plag_status ON documents(plagiarism_status) WHERE deleted_at IS NULL;
