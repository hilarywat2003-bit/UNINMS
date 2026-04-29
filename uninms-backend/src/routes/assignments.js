'use strict';

const express  = require('express');
const multer   = require('multer');
const { pool } = require('../config/database');
const { AppError } = require('../utils/AppError');
const { authenticate, requireRole } = require('../middleware/auth');
const { z } = require('zod');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

const isLecturer = requireRole('lecturer', 'admin', 'super_admin', 'management');

// Helper: verify course access
async function getCourse(courseId, userId, roles) {
  const { rows: [course] } = await pool.query(
    'SELECT id, lecturer_id FROM courses WHERE id = $1 AND deleted_at IS NULL', [courseId]
  );
  if (!course) throw new AppError('Course not found', 404, 'NOT_FOUND');
  const isAdmin = roles.some(r => ['admin','super_admin','management'].includes(r));
  const isOwner = course.lecturer_id === userId;
  return { course, canManage: isAdmin || isOwner };
}

// Helper: verify enrollment
async function isEnrolled(courseId, userId) {
  const { rows: [row] } = await pool.query(
    'SELECT id FROM course_enrollments WHERE course_id = $1 AND student_id = $2', [courseId, userId]
  );
  return !!row;
}

// ── GET /assignments  — all assignments for the current user across all courses ─
router.get('/assignments', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const roles  = req.user.roles ?? [req.user.role];
    const isStaff = roles.some(r => ['lecturer','admin','super_admin','management'].includes(r));

    let rows;
    if (isStaff) {
      // Lecturers / admins: assignments on courses they manage
      ({ rows } = await pool.query(
        `SELECT a.*,
                c.title AS course_title, c.course_code,
                u.full_name AS created_by_name,
                (SELECT COUNT(*) FROM submissions s WHERE s.assignment_id = a.id AND s.deleted_at IS NULL) AS submission_count
         FROM assignments a
         JOIN courses c ON c.id = a.course_id AND c.deleted_at IS NULL
         JOIN users u ON u.id = a.created_by
         WHERE a.deleted_at IS NULL
           AND (c.lecturer_id = $1 OR $2 = true)
         ORDER BY a.due_date ASC NULLS LAST, a.created_at DESC
         LIMIT 200`,
        [userId, roles.some(r => ['admin','super_admin','management'].includes(r))]
      ));
    } else {
      // Students: assignments from enrolled courses
      ({ rows } = await pool.query(
        `SELECT a.*,
                c.title AS course_title, c.course_code,
                u.full_name AS created_by_name,
                sub.id    AS my_submission_id,
                sub.status AS my_status,
                sub.marks  AS my_marks,
                sub.grade  AS my_grade
         FROM assignments a
         JOIN courses c ON c.id = a.course_id AND c.deleted_at IS NULL
         JOIN course_enrollments ce ON ce.course_id = c.id AND ce.student_id = $1
         JOIN users u ON u.id = a.created_by
         LEFT JOIN submissions sub ON sub.assignment_id = a.id AND sub.student_id = $1 AND sub.deleted_at IS NULL
         WHERE a.deleted_at IS NULL
         ORDER BY a.due_date ASC NULLS LAST, a.created_at DESC`,
        [userId]
      ));
    }

    res.json({ success: true, data: { assignments: rows, total: rows.length } });
  } catch (err) { next(err); }
});

// ── GET /courses/:courseId/assignments ────────────────────────────────────────
router.get('/courses/:courseId/assignments', authenticate, async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const roles = req.user.roles ?? [];
    const { canManage } = await getCourse(courseId, req.user.id, roles);

    // Students must be enrolled
    if (!canManage && !await isEnrolled(courseId, req.user.id)) {
      throw new AppError('Access denied', 403, 'FORBIDDEN');
    }

    const { rows } = await pool.query(
      `SELECT a.*,
              u.full_name AS created_by_name,
              (SELECT COUNT(*) FROM submissions s WHERE s.assignment_id = a.id AND s.deleted_at IS NULL) AS submission_count,
              (SELECT s.id FROM submissions s WHERE s.assignment_id = a.id AND s.student_id = $2 AND s.deleted_at IS NULL LIMIT 1) AS my_submission_id,
              (SELECT s.status FROM submissions s WHERE s.assignment_id = a.id AND s.student_id = $2 AND s.deleted_at IS NULL LIMIT 1) AS my_status,
              (SELECT s.marks FROM submissions s WHERE s.assignment_id = a.id AND s.student_id = $2 AND s.deleted_at IS NULL LIMIT 1) AS my_marks,
              (SELECT s.grade FROM submissions s WHERE s.assignment_id = a.id AND s.student_id = $2 AND s.deleted_at IS NULL LIMIT 1) AS my_grade
       FROM assignments a
       JOIN users u ON u.id = a.created_by
       WHERE a.course_id = $1 AND a.deleted_at IS NULL
       ORDER BY a.due_date ASC NULLS LAST, a.created_at DESC`,
      [courseId, req.user.id]
    );

    res.json({ success: true, data: { assignments: rows, total: rows.length } });
  } catch (err) { next(err); }
});

// ── POST /courses/:courseId/assignments ───────────────────────────────────────
router.post('/courses/:courseId/assignments', authenticate, isLecturer, async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const roles = req.user.roles ?? [];
    const { canManage } = await getCourse(courseId, req.user.id, roles);
    if (!canManage) throw new AppError('Only the course lecturer can create assignments', 403, 'FORBIDDEN');

    const schema = z.object({
      title:       z.string().min(2).max(255),
      instructions:z.string().max(5000).optional(),
      type:        z.enum(['individual','group']).default('individual'),
      maxMarks:    z.coerce.number().int().min(1).max(1000).default(100),
      dueDate:     z.string().datetime({ offset: true }).optional().or(z.literal('')),
      allowLate:   z.boolean().default(false),
    });
    const data = schema.parse(req.body);

    const { rows: [assignment] } = await pool.query(
      `INSERT INTO assignments (course_id, created_by, title, instructions, type, max_marks, due_date, allow_late)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [courseId, req.user.id, data.title, data.instructions ?? null,
       data.type, data.maxMarks, data.dueDate || null, data.allowLate]
    );

    res.status(201).json({ success: true, data: assignment });
  } catch (err) {
    if (err instanceof z.ZodError) return next(new AppError('Validation failed', 422, 'VALIDATION_ERROR', err.errors));
    next(err);
  }
});

// ── PATCH /assignments/:id ── update assignment ───────────────────────────────
router.patch('/assignments/:id', authenticate, isLecturer, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rows: [a] } = await pool.query('SELECT * FROM assignments WHERE id = $1 AND deleted_at IS NULL', [id]);
    if (!a) throw new AppError('Assignment not found', 404, 'NOT_FOUND');
    const roles = req.user.roles ?? [];
    const isAdmin = roles.some(r => ['admin','super_admin','management'].includes(r));
    if (!isAdmin && a.created_by !== req.user.id) throw new AppError('Access denied', 403, 'FORBIDDEN');

    const { title, instructions, maxMarks, dueDate, allowLate, type } = req.body;
    const { rows: [updated] } = await pool.query(
      `UPDATE assignments SET
         title        = COALESCE($1, title),
         instructions = COALESCE($2, instructions),
         max_marks    = COALESCE($3, max_marks),
         due_date     = COALESCE($4, due_date),
         allow_late   = COALESCE($5, allow_late),
         type         = COALESCE($6, type),
         updated_at   = NOW()
       WHERE id = $7 RETURNING *`,
      [title ?? null, instructions ?? null, maxMarks ?? null, dueDate ?? null, allowLate ?? null, type ?? null, id]
    );
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

// ── DELETE /assignments/:id ───────────────────────────────────────────────────
router.delete('/assignments/:id', authenticate, isLecturer, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rows: [a] } = await pool.query('SELECT * FROM assignments WHERE id = $1 AND deleted_at IS NULL', [id]);
    if (!a) throw new AppError('Assignment not found', 404, 'NOT_FOUND');
    const roles = req.user.roles ?? [];
    const isAdmin = roles.some(r => ['admin','super_admin','management'].includes(r));
    if (!isAdmin && a.created_by !== req.user.id) throw new AppError('Access denied', 403, 'FORBIDDEN');

    await pool.query('UPDATE assignments SET deleted_at = NOW() WHERE id = $1', [id]);
    res.json({ success: true, message: 'Assignment deleted' });
  } catch (err) { next(err); }
});

// ── GET /assignments/:id/submissions ── lecturer views all submissions ─────────
router.get('/assignments/:id/submissions', authenticate, isLecturer, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rows: [a] } = await pool.query(
      'SELECT a.*, c.lecturer_id FROM assignments a JOIN courses c ON c.id = a.course_id WHERE a.id = $1 AND a.deleted_at IS NULL', [id]
    );
    if (!a) throw new AppError('Assignment not found', 404, 'NOT_FOUND');
    const roles = req.user.roles ?? [];
    const isAdmin = roles.some(r => ['admin','super_admin','management'].includes(r));
    if (!isAdmin && a.lecturer_id !== req.user.id) throw new AppError('Access denied', 403, 'FORBIDDEN');

    const { rows } = await pool.query(
      `SELECT s.*, u.full_name AS student_name, u.email AS student_email,
              dep.name AS student_department, u.matric_number
       FROM submissions s
       JOIN users u ON u.id = s.student_id
       LEFT JOIN departments dep ON dep.id = u.department_id
       WHERE s.assignment_id = $1 AND s.deleted_at IS NULL
       ORDER BY s.submitted_at DESC`,
      [id]
    );

    res.json({ success: true, data: { submissions: rows, total: rows.length } });
  } catch (err) { next(err); }
});

// ── POST /assignments/:id/submit ── student submits ───────────────────────────
router.post('/assignments/:id/submit', authenticate, upload.single('file'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const roles = req.user.roles ?? [];
    if (roles.some(r => ['lecturer','admin','super_admin','management'].includes(r))) {
      throw new AppError('Only students can submit assignments', 403, 'FORBIDDEN');
    }

    const { rows: [assignment] } = await pool.query(
      `SELECT a.*, c.id AS course_id FROM assignments a
       JOIN courses c ON c.id = a.course_id
       WHERE a.id = $1 AND a.deleted_at IS NULL`, [id]
    );
    if (!assignment) throw new AppError('Assignment not found', 404, 'NOT_FOUND');

    // Must be enrolled
    if (!await isEnrolled(assignment.course_id, req.user.id)) {
      throw new AppError('You are not enrolled in this course', 403, 'FORBIDDEN');
    }

    // Check due date
    const isLate = assignment.due_date && new Date() > new Date(assignment.due_date);
    if (isLate && !assignment.allow_late) {
      throw new AppError('The due date has passed and late submissions are not allowed', 403, 'SUBMISSION_CLOSED');
    }

    // Check for existing submission
    const { rows: [existing] } = await pool.query(
      'SELECT id FROM submissions WHERE assignment_id = $1 AND student_id = $2 AND deleted_at IS NULL', [id, req.user.id]
    );
    if (existing) throw new AppError('You have already submitted this assignment', 409, 'ALREADY_SUBMITTED');

    const note     = req.body.note ?? null;
    const fileName = req.file?.originalname ?? null;
    // In production: upload to S3/Cloudinary and get URL. For now store filename.
    const fileUrl  = req.file ? `/uploads/${Date.now()}_${req.file.originalname}` : null;

    const { rows: [submission] } = await pool.query(
      `INSERT INTO submissions (assignment_id, student_id, course_id, note, file_name, file_url, status, is_late, submitted_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'submitted', $7, NOW()) RETURNING *`,
      [id, req.user.id, assignment.course_id, note, fileName, fileUrl, !!isLate]
    );

    res.status(201).json({ success: true, data: submission });

    // Fire-and-forget plagiarism check — runs after response is sent
    setImmediate(async () => {
      try {
        const { checkSubmissionText } = require('../services/plagiarism');
        let text = note || '';
        if (req.file?.mimetype === 'application/pdf') {
          const pdfParse = require('pdf-parse');
          const pdfData = await pdfParse(req.file.buffer);
          text = `${text} ${pdfData.text || ''}`.trim().slice(0, 8000);
        }
        if (text.length >= 50) {
          const result = await checkSubmissionText(text);
          await pool.query(
            'UPDATE submissions SET plagiarism_score=$1, check_status=$2 WHERE id=$3',
            [result.overallScore, result.status, submission.id]
          );
        }
      } catch (_) { /* non-fatal */ }
    });
  } catch (err) { next(err); }
});

// ── PATCH /submissions/:id/grade ── lecturer grades a submission ──────────────
router.patch('/submissions/:id/grade', authenticate, isLecturer, async (req, res, next) => {
  try {
    const { id } = req.params;
    const schema = z.object({
      marks:    z.coerce.number().min(0).max(1000).optional(),
      grade:    z.string().max(10).optional(),
      feedback: z.string().max(2000).optional(),
      status:   z.enum(['graded','returned']).default('graded'),
    });
    const data = schema.parse(req.body);

    const { rows: [sub] } = await pool.query(
      `SELECT s.*, a.created_by AS lecturer_id, a.max_marks
       FROM submissions s
       JOIN assignments a ON a.id = s.assignment_id
       WHERE s.id = $1 AND s.deleted_at IS NULL`, [id]
    );
    if (!sub) throw new AppError('Submission not found', 404, 'NOT_FOUND');
    const roles = req.user.roles ?? [];
    const isAdmin = roles.some(r => ['admin','super_admin','management'].includes(r));
    if (!isAdmin && sub.lecturer_id !== req.user.id) throw new AppError('Access denied', 403, 'FORBIDDEN');

    const { rows: [updated] } = await pool.query(
      `UPDATE submissions SET
         marks     = COALESCE($1, marks),
         grade     = COALESCE($2, grade),
         feedback  = COALESCE($3, feedback),
         status    = $4,
         graded_at = NOW()
       WHERE id = $5 RETURNING *`,
      [data.marks ?? null, data.grade ?? null, data.feedback ?? null, data.status, id]
    );

    res.json({ success: true, data: updated });
  } catch (err) {
    if (err instanceof z.ZodError) return next(new AppError('Validation failed', 422, 'VALIDATION_ERROR', err.errors));
    next(err);
  }
});

module.exports = router;
