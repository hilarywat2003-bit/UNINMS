const { Router } = require('express');
const { body, query: qv, param, validationResult } = require('express-validator');
const { authenticate, optionalAuth, isAdmin, isManagement } = require('../middleware/auth');
const { api: apiLimiter, search: searchLimiter } = require('../middleware/rateLimit');
const graphService           = require('../services/knowledgeGraph.service');
const gapService             = require('../services/gapDetection.service');
const recommendationsService = require('../services/recommendations.service');
const leaderboardService     = require('../services/leaderboard.service');
const { AppError, formatValidationErrors } = require('../utils/AppError');

const router = Router();

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new AppError('Validation failed', 422, 'VALIDATION_ERROR', formatValidationErrors(errors)));
  }
  next();
};

// ─────────────────────────────────────────────────────────────────────────────
// KNOWLEDGE GRAPH
// ─────────────────────────────────────────────────────────────────────────────

// ── GET /intelligence/graph — national research map ───────────────────────────
router.get(
  '/graph',
  optionalAuth,
  searchLimiter,
  [
    qv('universityId').optional().isUUID(),
    qv('researchArea').optional().trim(),
    qv('limit').optional().isInt({ min: 10, max: 200 }).toInt(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const map = await graphService.getNationalResearchMap(req.query);
      res.json({ success: true, data: map });
    } catch (err) { next(err); }
  }
);

// ── GET /intelligence/collaborators — find potential collaborators ─────────────
router.get(
  '/collaborators',
  authenticate,
  apiLimiter,
  [qv('limit').optional().isInt({ min: 1, max: 20 }).toInt()],
  validate,
  async (req, res, next) => {
    try {
      const { limit = 10 } = req.query;
      const collaborators = await graphService.findCollaborators(req.user.id, limit);
      res.json({ success: true, data: collaborators });
    } catch (err) { next(err); }
  }
);

// ── GET /intelligence/top-researchers ─────────────────────────────────────────
router.get(
  '/top-researchers',
  optionalAuth,
  apiLimiter,
  [
    qv('tagName').optional().trim(),
    qv('universityId').optional().isUUID(),
    qv('limit').optional().isInt({ min: 1, max: 50 }).toInt(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const researchers = await graphService.getTopResearchers(req.query);
      res.json({ success: true, data: researchers });
    } catch (err) { next(err); }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// RESEARCH GAPS
// ─────────────────────────────────────────────────────────────────────────────

// ── GET /intelligence/gaps ────────────────────────────────────────────────────
router.get(
  '/gaps',
  authenticate,
  apiLimiter,
  [
    qv('universityId').optional().isUUID(),
    qv('status').optional().isIn(['unaddressed','being_researched','solved','dismissed']),
    qv('autoDetected').optional().isBoolean().toBoolean(),
    qv('page').optional().isInt({ min: 1 }).toInt(),
    qv('limit').optional().isInt({ min: 1, max: 50 }).toInt(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const result = await gapService.listGaps(req.query);
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  }
);

// ── GET /intelligence/gaps/recommended — gaps matching the caller's interests ──
router.get(
  '/gaps/recommended',
  authenticate,
  apiLimiter,
  [qv('limit').optional().isInt({ min: 1, max: 20 }).toInt()],
  validate,
  async (req, res, next) => {
    try {
      const { limit = 10 } = req.query;
      const gaps = await gapService.getRecommendedGaps(req.user.id, limit);
      res.json({ success: true, data: gaps });
    } catch (err) { next(err); }
  }
);

// ── POST /intelligence/gaps — submit manual gap ───────────────────────────────
router.post(
  '/gaps',
  authenticate,
  apiLimiter,
  [
    body('description').trim().notEmpty().isLength({ min: 20, max: 2000 }),
    body('researchArea').optional().trim().isLength({ max: 255 }),
    body('priorityScore').optional().isInt({ min: 1, max: 10 }),
    body('universityId').optional().isUUID(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const gap = await gapService.submitGap({
        userId:        req.user.id,
        universityId:  req.body.universityId,
        description:   req.body.description,
        researchArea:  req.body.researchArea,
        priorityScore: req.body.priorityScore,
      });
      res.status(201).json({ success: true, data: gap });
    } catch (err) { next(err); }
  }
);

// ── POST /intelligence/gaps/detect — trigger auto detection ──────────────────
router.post(
  '/gaps/detect',
  authenticate,
  isAdmin,
  apiLimiter,
  [qv('universityId').optional().isUUID()],
  validate,
  async (req, res, next) => {
    try {
      const gaps = await gapService.detectGaps(req.query.universityId);
      res.json({ success: true, data: { gapsDetected: gaps.length, gaps } });
    } catch (err) { next(err); }
  }
);

// ── PATCH /intelligence/gaps/:id — update gap status ─────────────────────────
router.patch(
  '/gaps/:id',
  authenticate,
  isAdmin,
  apiLimiter,
  [
    param('id').isUUID(),
    body('status').isIn(['unaddressed','being_researched','solved','dismissed']),
  ],
  validate,
  async (req, res, next) => {
    try {
      const gap = await gapService.updateGapStatus(req.params.id, req.body.status);
      if (!gap) return next(new AppError('Gap not found', 404, 'NOT_FOUND'));
      res.json({ success: true, data: gap });
    } catch (err) { next(err); }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// STRATEGIC RECOMMENDATIONS
// ─────────────────────────────────────────────────────────────────────────────

// ── GET /intelligence/recommendations ────────────────────────────────────────
router.get(
  '/recommendations',
  authenticate,
  isManagement,
  apiLimiter,
  [
    qv('universityId').optional().isUUID(),
    qv('status').optional().isIn(['pending_review','accepted','rejected','implemented','dismissed']),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { universityId, status } = req.query;
      const result = await recommendationsService.listRecommendations(universityId, status);
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  }
);

// ── POST /intelligence/recommendations/generate ───────────────────────────────
router.post(
  '/recommendations/generate',
  authenticate,
  isAdmin,
  apiLimiter,
  [body('universityId').isUUID()],
  validate,
  async (req, res, next) => {
    try {
      const recs = await recommendationsService.generateRecommendations(req.body.universityId);
      res.json({ success: true, data: { generated: recs.length, recommendations: recs } });
    } catch (err) { next(err); }
  }
);

// ── PATCH /intelligence/recommendations/:id ───────────────────────────────────
router.patch(
  '/recommendations/:id',
  authenticate,
  isManagement,
  apiLimiter,
  [
    param('id').isUUID(),
    body('status').isIn(['accepted','rejected','implemented','dismissed']),
  ],
  validate,
  async (req, res, next) => {
    try {
      const rec = await recommendationsService.updateStatus(req.params.id, req.body.status, req.user.id);
      if (!rec) return next(new AppError('Recommendation not found', 404, 'NOT_FOUND'));
      res.json({ success: true, data: rec });
    } catch (err) { next(err); }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// LEADERBOARD
// ─────────────────────────────────────────────────────────────────────────────

// ── GET /intelligence/leaderboard ─────────────────────────────────────────────
router.get(
  '/leaderboard',
  optionalAuth,
  apiLimiter,
  [qv('period').optional().isIn(['monthly','quarterly','annual'])],
  validate,
  async (req, res, next) => {
    try {
      const { period = 'quarterly' } = req.query;
      const data = await leaderboardService.getLeaderboard(period);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }
);

// ── POST /intelligence/leaderboard/compute — admin trigger ───────────────────
router.post(
  '/leaderboard/compute',
  authenticate,
  isAdmin,
  apiLimiter,
  [body('period').optional().isIn(['monthly','quarterly','annual'])],
  validate,
  async (req, res, next) => {
    try {
      const { period = 'quarterly' } = req.body;
      const result = await leaderboardService.computeLeaderboard(period);
      res.json({ success: true, data: { computed: result.length, rankings: result } });
    } catch (err) { next(err); }
  }
);

module.exports = router;
