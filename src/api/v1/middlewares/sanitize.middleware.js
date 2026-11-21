/**
 * Input Sanitization & XSS / SSRF Injection Defense Middleware
 * 
 * Recursively deep-cleans `req.body`, `req.query`, and `req.params`.
 * Neutralizes:
 * 1. Stored XSS (<script>, event handlers: onerror=, onload=, onclick=)
 * 2. Puppeteer PDF Server-Side Request Forgery & Local File Inclusion (<iframe src="file://...">, <object>, <embed>)
 * 3. Pseudo-protocols (javascript:, vbscript:)
 * 4. Prototype Pollution (__proto__, constructor, prototype)
 * 5. Null-byte injection attacks (\0)
 * 
 * Preserves standard ERP engineering symbols:
 * - Part dimensions (e.g. 10mm x 20mm, 6" pipe)
 * - Math/relational operators (e.g. < 100mm, > 50kg)
 * - Ampersands and special business punctuation (e.g. L&T Ltd, A&B Co.)
 */

function sanitizeString(val) {
    if (typeof val !== 'string') return val;

    let clean = val;

    // 1. Remove null-byte injection
    clean = clean.replace(/\0/g, '');

    // 2. Remove script tags and their content
    clean = clean.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

    // 3. Remove iframe tags and their content (CRITICAL: prevents Puppeteer PDF SSRF / local file leaks)
    clean = clean.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');

    // 4. Remove object, embed, applet, style, form tags and their content
    clean = clean.replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '');
    clean = clean.replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '');
    clean = clean.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
    clean = clean.replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, '');

    // 5. Remove any remaining dangerous standalone or unclosed tags
    clean = clean.replace(/<\/?(?:script|iframe|object|embed|applet|style|form|meta|link|base)\b[^>]*>/gi, '');

    // 6. Strip dangerous inline event handlers (e.g. onerror=, onload=, onclick=)
    clean = clean.replace(/\bon[a-zA-Z]+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, '');

    // 7. Defang javascript: and vbscript: pseudo-protocols
    clean = clean.replace(/(?:javascript|vbscript):\s*/gi, '');

    return clean.trim();
}

function sanitizeObject(obj) {
    if (!obj || typeof obj !== 'object') {
        return typeof obj === 'string' ? sanitizeString(obj) : obj;
    }

    if (Buffer.isBuffer(obj)) {
        return obj;
    }

    if (Array.isArray(obj)) {
        for (let i = 0; i < obj.length; i++) {
            obj[i] = sanitizeObject(obj[i]);
        }
        return obj;
    }

    for (const key of Object.keys(obj)) {
        // Prevent Object prototype pollution
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
            delete obj[key];
            continue;
        }

        const cleanKey = sanitizeString(key);
        const val = obj[key];

        if (cleanKey !== key) {
            delete obj[key];
            obj[cleanKey] = sanitizeObject(val);
        } else {
            obj[key] = sanitizeObject(val);
        }
    }

    return obj;
}

const sanitizeMiddleware = (req, res, next) => {
    try {
        if (req.body && typeof req.body === 'object') {
            sanitizeObject(req.body);
        }
        if (req.query && typeof req.query === 'object') {
            sanitizeObject(req.query);
        }
        if (req.params && typeof req.params === 'object') {
            sanitizeObject(req.params);
        }
    } catch (err) {
        // Failsafe: Continue on processing without unhandled exception
        console.error('Error during request sanitization:', err);
    }
    next();
};

module.exports = {
    sanitizeString,
    sanitizeObject,
    sanitizeMiddleware
};

