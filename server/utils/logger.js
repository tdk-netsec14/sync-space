/**
 * server/utils/logger.js
 *
 * Application-wide Winston logger.
 *
 * Transports:
 *   • Console  — always on (pretty in dev, JSON in prod)
 *   • Error file — logs/error.log, max 20 MB, 14 days retention (prod)
 *   • Combined file — logs/combined.log, max 20 MB, 14 days retention (prod)
 *
 * Usage:
 *   const logger = require('../utils/logger');
 *   logger.info('message', { extra: 'context' });
 *   logger.warn('warning');
 *   logger.error('error message', { err });
 */

const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

const isProduction = process.env.NODE_ENV === 'production';
const LOG_DIR = path.join(__dirname, '../../logs');

// ---------------------------------------------------------------------------
// Custom formats
// ---------------------------------------------------------------------------

const { combine, timestamp, errors, json, colorize, printf, splat } = winston.format;

/** Dev-friendly human-readable format */
const devFormat = combine(
  colorize({ all: true }),
  timestamp({ format: 'HH:mm:ss' }),
  errors({ stack: true }),
  splat(),
  printf(({ level, message, timestamp: ts, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length ? `\n  ${JSON.stringify(meta)}` : '';
    return `${ts} [${level}] ${message}${stack ? `\n${stack}` : ''}${metaStr}`;
  })
);

/** Production JSON format — structured, machine-parseable */
const prodFormat = combine(timestamp(), errors({ stack: true }), splat(), json());

// ---------------------------------------------------------------------------
// Transports
// ---------------------------------------------------------------------------

const transports = [
  new winston.transports.Console({
    format: isProduction ? prodFormat : devFormat
  })
];

if (isProduction) {
  transports.push(
    new DailyRotateFile({
      filename: path.join(LOG_DIR, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '20m',
      maxFiles: '14d',
      format: prodFormat
    }),
    new DailyRotateFile({
      filename: path.join(LOG_DIR, 'combined-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      format: prodFormat
    })
  );
}

// ---------------------------------------------------------------------------
// Logger instance
// ---------------------------------------------------------------------------

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  transports,
  // Do not exit on handled exceptions — we manage that ourselves
  exitOnError: false
});

/**
 * A write-stream compatible object for piping morgan output into winston.
 */
logger.stream = {
  write(message) {
    // Morgan adds a trailing newline — strip it
    logger.http(message.trimEnd());
  }
};

module.exports = logger;
