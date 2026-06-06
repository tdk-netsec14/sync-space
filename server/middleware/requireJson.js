/**
 * server/middleware/requireJson.js
 *
 * Enforces Content-Type: application/json on all state-mutating requests
 * (POST, PUT, PATCH). GET, DELETE, OPTIONS etc. pass through freely.
 *
 * Returns 415 Unsupported Media Type if the header is missing or incorrect,
 * preventing Express from silently parsing a body as an empty object when
 * the client forgot to set the header.
 */

/**
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function requireJson(req, res, next) {
  const METHOD_NEEDS_JSON = ['POST', 'PUT', 'PATCH'];

  if (!METHOD_NEEDS_JSON.includes(req.method)) {
    return next();
  }

  const contentType = req.headers['content-type'] || '';

  // Allow absence of body (no Content-Length + no Transfer-Encoding)
  const hasBody =
    (req.headers['content-length'] !== '0' && req.headers['content-length'] !== undefined) ||
    req.headers['transfer-encoding'] !== undefined;

  if (hasBody && !contentType.startsWith('application/json')) {
    return res.status(415).json({
      success: false,
      error: {
        code: 'UNSUPPORTED_MEDIA_TYPE',
        message: `Content-Type must be 'application/json'. Got: '${contentType || 'none'}'`
      }
    });
  }

  return next();
}

module.exports = requireJson;
