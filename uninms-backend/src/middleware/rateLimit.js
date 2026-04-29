'use strict';

const rateLimit = require('express-rate-limit');

const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'); // 15 min default

/**
 * General API rate limiter — applied to most authenticated routes.
 */
const api = rateLimit({
  windowMs,
  max:               parseInt(process.env.RATE_LIMIT_API_MAX || '200'),
  standardHeaders:   true,
  legacyHeaders:     false,
  message:           { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later.' } },
  skip:              (req) => req.method === 'OPTIONS',
});

/**
 * Search / intelligence limiter — slightly tighter to protect heavy queries.
 */
const search = rateLimit({
  windowMs,
  max:               parseInt(process.env.RATE_LIMIT_SEARCH_MAX || '60'),
  standardHeaders:   true,
  legacyHeaders:     false,
  message:           { success: false, error: { code: 'RATE_LIMITED', message: 'Search rate limit exceeded, please slow down.' } },
  skip:              (req) => req.method === 'OPTIONS',
});

module.exports = { api, search };
