/**
 * server/utils/asyncHandler.js
 *
 * Wraps an async Express route handler and automatically forwards any
 * rejected promise to Express's next(error) — eliminating the need for
 * repetitive try/catch blocks in every route.
 *
 * Usage:
 *   const asyncHandler = require('../utils/asyncHandler');
 *
 *   router.get('/path', asyncHandler(async (req, res) => {
 *     const data = await someAsyncCall();
 *     res.json({ data });
 *   }));
 *
 * If the async function throws, the error is forwarded to the centralized
 * errorHandler middleware in middleware/errorHandler.js.
 */

/**
 * @param {(req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => Promise<any>} fn
 * @returns {import('express').RequestHandler}
 */
function asyncHandler(fn) {
  return function asyncRouteHandler(req, res, next) {
    return Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;
