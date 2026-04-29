const jwt      = require('jsonwebtoken');
const { pool } = require('../config/database');
const { client: redis } = require('../config/redis');
const { AppError } = require('../utils/AppError');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }

    const token = authHeader.slice(7);

    // Check blacklist
    const blacklisted = await redis.get(`bl:${token}`);
    if (blacklisted) throw new AppError('Token has been revoked', 401, 'TOKEN_REVOKED');

    // Verify
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

    // Load user
    const { rows } = await pool.query(
      `SELECT u.id, u.full_name, u.email, u.status, u.university_id,
              array_agg(DISTINCT r.name) FILTER (WHERE r.name IS NOT NULL) AS roles
       FROM users u
       LEFT JOIN user_roles ur ON ur.user_id = u.id
       LEFT JOIN roles r ON r.id = ur.role_id
       WHERE u.id = $1 AND u.deleted_at IS NULL
       GROUP BY u.id`,
      [payload.userId]
    );

    if (!rows[0]) throw new AppError('User not found', 401, 'USER_NOT_FOUND');
    if (rows[0].status === 'suspended') throw new AppError('Account suspended', 403, 'ACCOUNT_SUSPENDED');

    const user = rows[0];
    // Backward-compat: any lingering 'researcher' role tokens are treated as lecturer
    if (user.roles) {
      user.roles = user.roles.map(r => r === 'researcher' ? 'lecturer' : r);
    }
    if (user.role === 'researcher') user.role = 'lecturer';
    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError') return next(new AppError('Invalid token', 401, 'INVALID_TOKEN'));
    if (err.name === 'TokenExpiredError') return next(new AppError('Token expired', 401, 'TOKEN_EXPIRED'));
    next(err);
  }
};

const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
  const userRoles = req.user.roles || [];
  const hasRole = roles.some(r => userRoles.includes(r));
  if (!hasRole) return next(new AppError('Insufficient permissions', 403, 'FORBIDDEN'));
  next();
};

const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return next();
    await authenticate(req, res, next);
  } catch {
    next();
  }
};

// Convenience middlewares used by intelligence routes
const isAdmin = requireRole('admin', 'super_admin');
const isManagement = requireRole('admin', 'super_admin', 'management', 'vc', 'dvc');

module.exports = { authenticate, requireRole, optionalAuth, isAdmin, isManagement };
