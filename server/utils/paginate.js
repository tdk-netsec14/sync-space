/**
 * server/utils/paginate.js
 *
 * Shared pagination utilities for all list endpoints.
 *
 * Strategy: cursor-based pagination using MongoDB `_id` (ObjectId) as the cursor.
 * ObjectIds are monotonically increasing by insertion time, so they make a
 * stable, index-friendly cursor — no skip() needed.
 *
 * For endpoints that need stable sort by a non-_id field (e.g. createdAt DESC),
 * we use the compound cursor approach: filter on (sortField, _id) pairs.
 *
 * Usage:
 *   const { limit, before, buildFilter, buildMeta } = require('../utils/paginate');
 *   const opts = parsePaginationQuery(req.query);
 *   const docs  = await Model.find(buildCursorFilter(opts, filter)).sort(...).limit(opts.limit).lean();
 *   res.json({ ...buildMeta(docs, opts), items: docs });
 */

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * Parses and validates limit / cursor from query parameters.
 *
 * @param {object} query  - req.query
 * @returns {{ limit: number, before: string|null, after: string|null }}
 */
function parsePaginationQuery(query) {
  const raw = parseInt(query.limit, 10);
  const limit = !Number.isNaN(raw) && raw > 0 ? Math.min(raw, MAX_LIMIT) : DEFAULT_LIMIT;
  const before = query.before || null; // ISO date string (createdAt-based cursor)
  const after = query.after || null; // ObjectId string (_id-based cursor)
  return { limit, before, after };
}

/**
 * Builds the cursor-based filter clause to merge into an existing filter object.
 *
 * For createdAt-DESC pagination (activity, notifications):
 *   Use `before` — a createdAt ISO timestamp. Returns docs created BEFORE that date.
 *
 * For _id-ASC pagination (members):
 *   Use `after` — an ObjectId string. Returns docs with _id AFTER that value.
 *
 * @param {{ before: string|null, after: string|null }} opts
 * @param {object} baseFilter - Existing Mongoose filter
 * @returns {object} Merged filter with cursor condition applied
 */
function applyCursor(opts, baseFilter) {
  const filter = { ...baseFilter };

  if (opts.before) {
    const d = new Date(opts.before);
    if (!Number.isNaN(d.getTime())) {
      filter.createdAt = { ...(filter.createdAt || {}), $lt: d };
    }
  }

  if (opts.after) {
    const mongoose = require('mongoose');
    if (mongoose.Types.ObjectId.isValid(opts.after)) {
      filter._id = { ...(filter._id || {}), $gt: new mongoose.Types.ObjectId(opts.after) };
    }
  }

  return filter;
}

/**
 * Builds pagination metadata from the result set.
 *
 * @param {Array}  docs    - The result documents (plain objects after lean())
 * @param {{ limit: number }} opts
 * @returns {{ hasMore: boolean, nextCursor: string|null, count: number }}
 */
function buildMeta(docs, opts) {
  const hasMore = docs.length === opts.limit;
  const last = docs[docs.length - 1];
  const nextCursor =
    hasMore && last
      ? last.createdAt
        ? new Date(last.createdAt).toISOString()
        : String(last._id)
      : null;

  return { hasMore, nextCursor, count: docs.length };
}

module.exports = { parsePaginationQuery, applyCursor, buildMeta, DEFAULT_LIMIT, MAX_LIMIT };
