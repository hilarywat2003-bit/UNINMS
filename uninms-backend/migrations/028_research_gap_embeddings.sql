-- ═══════════════════════════════════════════════════════════════
-- UniNMS Migration 028 — Research Gap Embeddings
-- Enables semantic matching of research gaps to a researcher's
-- interests (derived from their own document embeddings).
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE research_gaps
  ADD COLUMN IF NOT EXISTS embedding vector(1536);
