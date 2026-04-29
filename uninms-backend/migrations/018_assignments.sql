-- ═══════════════════════════════════════════════════════════════
-- UniNMS Migration 018 — Assignments & Submission columns
-- Creates the assignments table and extends submissions with the
-- columns required by the assignments route.
-- ═══════════════════════════════════════════════════════════════

-- ── Assignments ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS assignments (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id     UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  created_by    UUID NOT NULL REFERENCES users(id),
  title         VARCHAR(255) NOT NULL,
  instructions  TEXT,
  type          VARCHAR(20)  NOT NULL DEFAULT 'individual', -- individual | group
  max_marks     INTEGER NOT NULL DEFAULT 100,
  due_date      TIMESTAMPTZ,
  allow_late    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_assignments_course ON assignments(course_id) WHERE deleted_at IS NULL;

-- ── Extend submissions with assignment-related columns ─────────
ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS assignment_id UUID REFERENCES assignments(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS marks         NUMERIC(7,2),
  ADD COLUMN IF NOT EXISTS is_late       BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS file_name     VARCHAR(500),
  ADD COLUMN IF NOT EXISTS file_url      TEXT,
  ADD COLUMN IF NOT EXISTS note          TEXT;

-- Index for fast lookups per assignment
CREATE INDEX IF NOT EXISTS idx_submissions_assignment ON submissions(assignment_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_submissions_student    ON submissions(student_id)    WHERE deleted_at IS NULL;
