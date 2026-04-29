-- ── Migration 013: Course enrollments & materials ────────────────────────────
-- Adds course_enrollments (students enrolled in a course) and
-- course_materials (documents assigned to a course by the lecturer).

DO $$ BEGIN

  -- Enroll students in courses
  CREATE TABLE IF NOT EXISTS course_enrollments (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id   UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    student_id  UUID NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
    enrolled_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (course_id, student_id)
  );

  -- Link documents as materials for a course
  CREATE TABLE IF NOT EXISTS course_materials (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id     UUID NOT NULL REFERENCES courses(id)    ON DELETE CASCADE,
    document_id   UUID NOT NULL REFERENCES documents(id)  ON DELETE CASCADE,
    assigned_by   UUID REFERENCES users(id),
    order_index   INTEGER DEFAULT 0,
    assigned_at   TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (course_id, document_id)
  );

EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

-- Add description column to courses if it doesn't exist
ALTER TABLE courses ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS semester     VARCHAR(20);
ALTER TABLE courses ADD COLUMN IF NOT EXISTS level        VARCHAR(10);  -- e.g. '100', '200'

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON course_enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course  ON course_enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_materials_course    ON course_materials(course_id);
