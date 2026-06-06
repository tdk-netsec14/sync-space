/**
 * server/middleware/validateObjectId.js
 *
 * Factory that creates a middleware validating named route params as valid
 * MongoDB ObjectIds. Returns 400 immediately if any param fails validation,
 * preventing a downstream Mongoose CastError.
 *
 * Usage:
 *   router.get('/:workspaceId/boards/:boardId',
 *     validateObjectId('workspaceId', 'boardId'),
 *     asyncHandler(handler));
 */

const mongoose = require('mongoose');

/**
 * @param {...string} paramNames  Names of req.params keys to validate.
 * @returns {import('express').RequestHandler}
 */
function validateObjectId(...paramNames) {
  return (req, res, next) => {
    for (const name of paramNames) {
      const value = req.params[name];
      if (value !== undefined && !mongoose.Types.ObjectId.isValid(value)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: `Invalid ${name}: '${value}' is not a valid ObjectId`
          }
        });
      }
    }
    return next();
  };
}

module.exports = validateObjectId;
