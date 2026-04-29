const express  = require('express');
const { pool } = require('../config/database');
const { AppError } = require('../utils/AppError');
const { authenticate, requireRole } = require('../middleware/auth');
const { z } = require('zod');

const router = express.Router();

const isLecturer  = requireRole('lecturer', 'admin', 'super_admin', 'management');
const isAdminRole = requireRole('admin', 'super_admin', 'management');

// ── GET /courses ── list courses relevant to the current user ─────────────────
// Lecturer: their own courses. Student: enrolled courses. Admin: all courses.
router.get('/', authenticate, async (req, res, next) => {
  try {
    const roles  = req.user.roles ?? [];
    const userId = req.user.id;

    let rows;

    if (roles.some(r => ['admin', 'super_admin', 'management'].includes(r))) {
      // Admin sees all
      ({ rows } = await pool.query(
        `SELECT c.*, u.full_name AS lecturer_name, dep.name AS department_name,
                (SELECT COUNT(*) FROM course_enrollments ce WHERE ce.course_id = c.id) AS enrolled_count,
                (SELECT COUNT(*) FROM course_materials cm WHERE cm.course_id = c.id) AS material_count
         FROM courses c
         LEFT JOIN users u ON u.id = c.lecturer_id
         LEFT JOIN departments dep ON dep.id = c.department_id
         WHERE c.deleted_at IS NULL
         ORDER BY c.created_at DESC`
      ));

    } else if (roles.includes('lecturer')) {
      // Lecturer sees their courses
      ({ rows } = await pool.query(
        `SELECT c.*, u.full_name AS lecturer_name, dep.name AS department_name,
                (SELECT COUNT(*) FROM course_enrollments ce WHERE ce.course_id = c.id) AS enrolled_count,
                (SELECT COUNT(*) FROM course_materials cm WHERE cm.course_id = c.id) AS material_count
         FROM courses c
         LEFT JOIN users u ON u.id = c.lecturer_id
         LEFT JOIN departments dep ON dep.id = c.department_id
         WHERE c.lecturer_id = $1 AND c.deleted_at IS NULL
         ORDER BY c.created_at DESC`,
        [userId]
      ));

    } else {
      // Student sees enrolled courses
      ({ rows } = await pool.query(
        `SELECT c.*, u.full_name AS lecturer_name, dep.name AS department_name,
                (SELECT COUNT(*) FROM course_materials cm WHERE cm.course_id = c.id) AS material_count,
                ce.enrolled_at
         FROM courses c
         JOIN course_enrollments ce ON ce.course_id = c.id AND ce.student_id = $1
         LEFT JOIN users u ON u.id = c.lecturer_id
         LEFT JOIN departments dep ON dep.id = c.department_id
         WHERE c.deleted_at IS NULL
         ORDER BY ce.enrolled_at DESC`,
        [userId]
      ));
    }

    res.json({ success: true, data: { courses: rows, total: rows.length } });
  } catch (err) { next(err); }
});

// ── GET /courses/:id ── course details ───────────────────────────────────────
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!/^[0-9a-f-]{36}$/.test(id)) throw new AppError('Invalid course ID', 422, 'VALIDATION_ERROR');

    const { rows: [course] } = await pool.query(
      `SELECT c.*, u.full_name AS lecturer_name, dep.name AS department_name,
              (SELECT COUNT(*) FROM course_enrollments ce WHERE ce.course_id = c.id) AS enrolled_count
       FROM courses c
       LEFT JOIN users u ON u.id = c.lecturer_id
       LEFT JOIN departments dep ON dep.id = c.department_id
       WHERE c.id = $1 AND c.deleted_at IS NULL`,
      [id]
    );
    if (!course) throw new AppError('Course not found', 404, 'NOT_FOUND');

    // Check access: admin, lecturer of course, or enrolled student
    const roles  = req.user.roles ?? [];
    const isAdmin = roles.some(r => ['admin', 'super_admin', 'management'].includes(r));
    const isOwner = course.lecturer_id === req.user.id;

    if (!isAdmin && !isOwner) {
      const { rows: [enr] } = await pool.query(
        'SELECT id FROM course_enrollments WHERE course_id = $1 AND student_id = $2',
        [id, req.user.id]
      );
      if (!enr) throw new AppError('Access denied', 403, 'FORBIDDEN');
    }

    res.json({ success: true, data: course });
  } catch (err) { next(err); }
});

// ── GET /courses/:id/materials ── list materials for a course ─────────────────
router.get('/:id/materials', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!/^[0-9a-f-]{36}$/.test(id)) throw new AppError('Invalid course ID', 422, 'VALIDATION_ERROR');

    // Verify access (reuse same check as course detail)
    const { rows: [course] } = await pool.query(
      'SELECT id, lecturer_id FROM courses WHERE id = $1 AND deleted_at IS NULL', [id]
    );
    if (!course) throw new AppError('Course not found', 404, 'NOT_FOUND');

    const roles   = req.user.roles ?? [];
    const isAdmin = roles.some(r => ['admin', 'super_admin', 'management'].includes(r));
    const isOwner = course.lecturer_id === req.user.id;

    if (!isAdmin && !isOwner) {
      const { rows: [enr] } = await pool.query(
        'SELECT id FROM course_enrollments WHERE course_id = $1 AND student_id = $2',
        [id, req.user.id]
      );
      if (!enr) throw new AppError('Access denied', 403, 'FORBIDDEN');
    }

    const { rows } = await pool.query(
      `SELECT cm.id AS material_id, cm.order_index, cm.assigned_at,
              d.id, d.title, d.abstract, d.doc_type, d.mime_type,
              d.file_size_bytes, d.view_count, d.download_count,
              d.published_at, u.full_name AS uploader_name
       FROM course_materials cm
       JOIN documents d ON d.id = cm.document_id AND d.deleted_at IS NULL
       LEFT JOIN users u ON u.id = d.uploader_id
       WHERE cm.course_id = $1
       ORDER BY cm.order_index ASC, cm.assigned_at ASC`,
      [id]
    );

    res.json({ success: true, data: { materials: rows, total: rows.length } });
  } catch (err) { next(err); }
});

// ── POST /courses ── create a course (lecturer/admin) ────────────────────────
router.post('/', authenticate, isLecturer, async (req, res, next) => {
  try {
    const schema = z.object({
      title:       z.string().min(2).max(255),
      courseCode:  z.string().max(20).optional(),
      description: z.string().max(2000).optional(),
      semester:    z.string().max(20).optional(),
      level:       z.string().max(10).optional(),
    });
    const data = schema.parse(req.body);

    // Resolve department from user profile
    const { rows: [userRow] } = await pool.query(
      'SELECT department_id FROM users WHERE id = $1', [req.user.id]
    );

    const { rows: [course] } = await pool.query(
      `INSERT INTO courses (lecturer_id, department_id, title, course_code, description, semester, level)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [req.user.id, userRow?.department_id, data.title, data.courseCode ?? null,
       data.description ?? null, data.semester ?? null, data.level ?? null]
    );

    res.status(201).json({ success: true, data: course });
  } catch (err) {
    if (err instanceof z.ZodError) return next(new AppError('Validation failed', 422, 'VALIDATION_ERROR', err.errors));
    next(err);
  }
});

// ── POST /courses/:id/materials ── assign a document to a course ──────────────
router.post('/:id/materials', authenticate, isLecturer, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!/^[0-9a-f-]{36}$/.test(id)) throw new AppError('Invalid course ID', 422, 'VALIDATION_ERROR');

    const { documentId, orderIndex = 0 } = req.body;
    if (!documentId) throw new AppError('documentId is required', 422, 'VALIDATION_ERROR');

    // Verify lecturer owns the course (or admin)
    const { rows: [course] } = await pool.query(
      'SELECT id, lecturer_id FROM courses WHERE id = $1 AND deleted_at IS NULL', [id]
    );
    if (!course) throw new AppError('Course not found', 404, 'NOT_FOUND');

    const roles   = req.user.roles ?? [];
    const isAdmin = roles.some(r => ['admin', 'super_admin', 'management'].includes(r));
    if (!isAdmin && course.lecturer_id !== req.user.id) {
      throw new AppError('Only the course lecturer can assign materials', 403, 'FORBIDDEN');
    }

    // Verify document exists
    const { rows: [doc] } = await pool.query(
      'SELECT id FROM documents WHERE id = $1 AND deleted_at IS NULL', [documentId]
    );
    if (!doc) throw new AppError('Document not found', 404, 'NOT_FOUND');

    const { rows: [material] } = await pool.query(
      `INSERT INTO course_materials (course_id, document_id, assigned_by, order_index)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (course_id, document_id) DO UPDATE SET order_index = $4
       RETURNING *`,
      [id, documentId, req.user.id, orderIndex]
    );

    res.status(201).json({ success: true, data: material });
  } catch (err) { next(err); }
});

// ── DELETE /courses/:id/materials/:materialId ── remove material ──────────────
router.delete('/:id/materials/:materialId', authenticate, isLecturer, async (req, res, next) => {
  try {
    const { id, materialId } = req.params;

    const { rows: [course] } = await pool.query(
      'SELECT id, lecturer_id FROM courses WHERE id = $1 AND deleted_at IS NULL', [id]
    );
    if (!course) throw new AppError('Course not found', 404, 'NOT_FOUND');

    const roles   = req.user.roles ?? [];
    const isAdmin = roles.some(r => ['admin', 'super_admin', 'management'].includes(r));
    if (!isAdmin && course.lecturer_id !== req.user.id) {
      throw new AppError('Only the course lecturer can remove materials', 403, 'FORBIDDEN');
    }

    const { rowCount } = await pool.query(
      'DELETE FROM course_materials WHERE id = $1 AND course_id = $2', [materialId, id]
    );
    if (!rowCount) throw new AppError('Material not found', 404, 'NOT_FOUND');

    res.json({ success: true, message: 'Material removed' });
  } catch (err) { next(err); }
});

// ── POST /courses/:id/enroll ── enroll a student (lecturer/admin or self) ─────
router.post('/:id/enroll', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!/^[0-9a-f-]{36}$/.test(id)) throw new AppError('Invalid course ID', 422, 'VALIDATION_ERROR');

    const roles   = req.user.roles ?? [];
    const isAdmin = roles.some(r => ['admin', 'super_admin', 'management', 'lecturer'].includes(r));

    // Lecturers/admins can enroll a specific student; others enroll themselves
    const studentId = (isAdmin && req.body.studentId) ? req.body.studentId : req.user.id;

    const { rows: [course] } = await pool.query(
      'SELECT id FROM courses WHERE id = $1 AND deleted_at IS NULL', [id]
    );
    if (!course) throw new AppError('Course not found', 404, 'NOT_FOUND');

    await pool.query(
      `INSERT INTO course_enrollments (course_id, student_id) VALUES ($1, $2)
       ON CONFLICT (course_id, student_id) DO NOTHING`,
      [id, studentId]
    );

    await pool.query(
      `UPDATE courses SET enrollment_count = (
         SELECT COUNT(*) FROM course_enrollments WHERE course_id = $1
       ) WHERE id = $1`,
      [id]
    );

    res.json({ success: true, message: 'Enrolled successfully' });
  } catch (err) { next(err); }
});

// ── GET /courses/:id/students ── list enrolled students (lecturer/admin) ──────
router.get('/:id/students', authenticate, isLecturer, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!/^[0-9a-f-]{36}$/.test(id)) throw new AppError('Invalid course ID', 422, 'VALIDATION_ERROR');

    const { rows: [course] } = await pool.query(
      'SELECT id, lecturer_id FROM courses WHERE id = $1 AND deleted_at IS NULL', [id]
    );
    if (!course) throw new AppError('Course not found', 404, 'NOT_FOUND');

    const roles   = req.user.roles ?? [];
    const isAdmin = roles.some(r => ['admin', 'super_admin', 'management'].includes(r));
    if (!isAdmin && course.lecturer_id !== req.user.id) {
      throw new AppError('Access denied', 403, 'FORBIDDEN');
    }

    const { rows } = await pool.query(
      `SELECT u.id, u.full_name, u.email, dep.name AS department_name, ce.enrolled_at
       FROM course_enrollments ce
       JOIN users u ON u.id = ce.student_id
       LEFT JOIN departments dep ON dep.id = u.department_id
       WHERE ce.course_id = $1
       ORDER BY ce.enrolled_at DESC`,
      [id]
    );

    res.json({ success: true, data: { students: rows, total: rows.length } });
  } catch (err) { next(err); }
});

module.exports = router;
