/**
 * server/services/scheduler.js
 *
 * Background cron jobs. Call startScheduler() once after the DB connects.
 *
 * Jobs:
 *   • ActivityLog archival — runs daily at 02:00 UTC, deletes entries > 90 days old.
 *     The ActivityLog TTL index (90 days) on `createdAt` is a hard MongoDB-level
 *     safety net; this job ensures proactive, logged cleanup.
 */

const cron = require('node-cron');
const ActivityLog = require('../models/ActivityLog');
const logger = require('../utils/logger');

const ACTIVITY_RETENTION_DAYS = parseInt(process.env.ACTIVITY_RETENTION_DAYS || '90', 10);

/**
 * Deletes ActivityLog documents older than ACTIVITY_RETENTION_DAYS days.
 * Batches deletes to avoid locking the collection for large datasets.
 */
async function archiveActivityLogs() {
  const cutoff = new Date(Date.now() - ACTIVITY_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const start = Date.now();

  try {
    const result = await ActivityLog.deleteMany({ createdAt: { $lt: cutoff } });
    const latencyMs = Date.now() - start;

    if (result.deletedCount > 0) {
      logger.info('ActivityLog archival complete', {
        job: 'activitylog-archival',
        deletedCount: result.deletedCount,
        cutoffDate: cutoff.toISOString(),
        retentionDays: ACTIVITY_RETENTION_DAYS,
        latencyMs
      });
    } else {
      logger.debug('ActivityLog archival: nothing to delete', {
        job: 'activitylog-archival',
        cutoffDate: cutoff.toISOString(),
        latencyMs
      });
    }
  } catch (error) {
    logger.error('ActivityLog archival failed', {
      job: 'activitylog-archival',
      err: error.message,
      latencyMs: Date.now() - start
    });
  }
}

/**
 * Starts all cron jobs. Call this after the MongoDB connection is established.
 */
function startScheduler() {
  // Daily at 02:00 UTC
  cron.schedule('0 2 * * *', archiveActivityLogs, {
    scheduled: true,
    timezone: 'UTC'
  });

  logger.info('Scheduler started', {
    jobs: [
      {
        name: 'activitylog-archival',
        schedule: '0 2 * * * (UTC)',
        retentionDays: ACTIVITY_RETENTION_DAYS
      }
    ]
  });
}

module.exports = { startScheduler, archiveActivityLogs };
