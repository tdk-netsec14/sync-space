/**
 * server/middleware/etag.js
 *
 * Provides ETag and Last-Modified cache-control helpers for GET endpoints
 * that return deterministic, cacheable data.
 *
 * Usage (inside an asyncHandler):
 *
 *   const { sendWithETag } = require('../middleware/etag');
 *
 *   // Checks If-None-Match / If-Modified-Since and responds 304 if unchanged.
 *   // Otherwise sends the payload and sets ETag + Last-Modified headers.
 *   if (sendWithETag(req, res, payload, lastModifiedDate)) return;
 *
 * sendWithETag returns `true` if it sent a 304 (so the caller should return).
 * Returns `false` if it sent a 200 — caller does NOT need to call res.json().
 */

const crypto = require('crypto');

/**
 * Generates a weak ETag from the JSON representation of a value.
 * @param {*} data
 * @returns {string}  e.g. W/"a1b2c3d4"
 */
function generateETag(data) {
  const hash = crypto.createHash('sha1').update(JSON.stringify(data)).digest('hex').slice(0, 16);
  return `W/"${hash}"`;
}

/**
 * Sends a response with ETag and Last-Modified headers, supporting
 * conditional GET (If-None-Match, If-Modified-Since).
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {object} payload        - The response body to send.
 * @param {Date}   [lastModified] - The last-modified date. Defaults to now.
 * @returns {boolean} true if a 304 was sent (caller must return), false otherwise.
 */
function sendWithETag(req, res, payload, lastModified = new Date()) {
  const etag = generateETag(payload);
  const lastModifiedUtc = lastModified instanceof Date ? lastModified : new Date(lastModified);

  res.setHeader('ETag', etag);
  res.setHeader('Last-Modified', lastModifiedUtc.toUTCString());
  res.setHeader('Cache-Control', 'private, no-cache');

  // Conditional GET — If-None-Match (ETag)
  const clientEtag = req.headers['if-none-match'];
  if (clientEtag && clientEtag === etag) {
    res.status(304).end();
    return true;
  }

  // Conditional GET — If-Modified-Since
  const ifModifiedSince = req.headers['if-modified-since'];
  if (ifModifiedSince) {
    const since = new Date(ifModifiedSince);
    if (!Number.isNaN(since.getTime()) && lastModifiedUtc <= since) {
      res.status(304).end();
      return true;
    }
  }

  res.json(payload);
  return false;
}

module.exports = { generateETag, sendWithETag };
