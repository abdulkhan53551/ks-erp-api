const helmet = require('helmet');
const hpp = require('hpp');
const { rateLimit } = require('express-rate-limit');
const { ERROR_CODES } = require('../../../config/constants/errorCodes');

/**
 * 1. REST API-Safe Helmet Configuration
 * - Content-Security-Policy disabled: Preserves React SPA, inline styling, CDN fonts, and Puppeteer PDF rendering
 * - crossOriginResourcePolicy: 'cross-origin' allows streaming generated PDFs & loading Cloudinary assets
 * - hidePoweredBy: Strips 'X-Powered-By: Express' header to conceal underlying backend technology
 * - frameguard: DENY prevents Clickjacking by blocking iframe embedding
 * - noSniff: Prevents MIME-type sniffing attacks
 * - xssFilter: Enables reflective XSS protection in legacy browsers
 */
const configuredHelmet = helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginEmbedderPolicy: false,
    frameguard: { action: 'deny' },
    hidePoweredBy: true,
    noSniff: true,
    xssFilter: true
});

/**
 * 2. HTTP Parameter Pollution (HPP) Middleware
 * - Protects against duplicate query parameter manipulation (e.g. ?partyId=1&partyId=2)
 */
const hppMiddleware = hpp();

/**
 * 3. Global API Rate Limiter
 * - Window: 15 minutes
 * - Limit: 1,000 requests per IP (sufficient for heavy daily operations while preventing DoS flooding)
 * - Excludes Render.com health check probes (/health), PDF test routes, and pre-flight OPTIONS requests
 */
const globalRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 1000, // Max 1,000 requests per windowMs per IP
    standardHeaders: 'draft-7', // Returns RateLimit headers conforming to RFC standards
    legacyHeaders: false, // Disables X-RateLimit-* headers
    skip: (req) => {
        // Exempt Render health check and pre-flight CORS requests
        return (
            req.method === 'OPTIONS' ||
            req.path === '/health' ||
            req.path === '/test-pdf'
        );
    },
    handler: (req, res) => {
        return res.status(429).json({
            success: false,
            errorCode: 'RATE_LIMIT_EXCEEDED',
            status: 429,
            message: 'Too many requests from this IP. Please try again after 15 minutes.'
        });
    }
});

/**
 * 4. Strict Authentication Rate Limiter
 * - Window: 15 minutes
 * - Limit: 15 attempts per IP on sensitive auth endpoints (/login, /forgot-password, /reset-password)
 * - Blocks brute-force dictionary attacks and credential stuffing
 */
const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 15, // Max 15 attempts per windowMs per IP
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (req, res) => {
        return res.status(429).json({
            success: false,
            errorCode: 'AUTH_RATE_LIMIT_EXCEEDED',
            status: 429,
            message: 'Too many authentication attempts. For your security, this IP has been temporarily throttled. Please try again after 15 minutes.'
        });
    }
});

module.exports = {
    configuredHelmet,
    hppMiddleware,
    globalRateLimiter,
    authRateLimiter
};

