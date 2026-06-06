/**
 * server/middleware/validate.js
 *
 * Factory that wraps a Zod schema into an Express middleware.
 * On validation failure returns 400 with structured field errors.
 * On success, replaces req.body with the parsed (coerced + stripped) data.
 *
 * Usage:
 *   const { z } = require('zod');
 *   const validate = require('../middleware/validate');
 *
 *   const schema = z.object({ name: z.string().min(1) });
 *   router.post('/', validate(schema), handler);
 */

const { ZodError } = require('zod');

/**
 * @param {import('zod').ZodTypeAny} schema
 * @returns {import('express').RequestHandler}
 */
function validate(schema) {
  return function validationMiddleware(req, res, next) {
    try {
      // Parse and strip unknown keys; replace req.body with safe parsed value
      req.body = schema.parse(req.body);
      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        const fields = {};
        if (Array.isArray(error.errors)) {
          error.errors.forEach((issue) => {
            const key = issue.path.join('.') || 'body';
            if (!fields[key]) {
              fields[key] = issue.message;
            }
          });
        }
        return res.status(400).json({
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: 'Validation failed',
            fields
          }
        });
      }
      return next(error);
    }
  };
}

module.exports = validate;
