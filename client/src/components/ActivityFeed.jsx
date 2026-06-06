import React from 'react';
import { History, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';

function formatTimeAgo(value) {
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.floor(diff / 60000));

  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function ActivityFeed({ activities = [], onLoadMore, loadingMore = false }) {
  return (
    <section className="w-full border-editorial bg-white p-6 shadow-editorial rounded-3xl relative overflow-hidden font-sans">
      {/* Activity Section Header */}
      <div className="flex items-center justify-between border-b border-brand-black/10 pb-5">
        <div>
          <h2 className="font-editorial text-xl font-bold tracking-tight text-brand-black flex items-center gap-2 uppercase">
            <History className="h-5 w-5 text-brand-purple" />
            <span>Activity Log</span>
          </h2>
          <p className="text-[10px] font-sans-editorial font-bold text-brand-black/45 mt-1">
            Real-time collaboration stream.
          </p>
        </div>
      </div>

      {/* Activity List Container */}
      <div className="mt-6 space-y-3">
        {activities.map((activity, index) => (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: Math.min(index * 0.05, 0.4) }}
            key={activity.id}
            className="flex items-start gap-4 rounded-2xl border border-brand-black/10 bg-brand-offwhite/40 p-4 transition-all hover:border-brand-black hover:bg-white duration-200"
          >
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-black text-brand-black border border-brand-black/10 shadow-sm"
              style={{ backgroundColor: activity.user?.avatar || '#DCC7FF' }}
            >
              {(activity.user?.name || 'U').slice(0, 1).toUpperCase()}
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold leading-relaxed text-brand-black/85 font-sans-editorial">
                {activity.description}
              </p>
              <span className="inline-block mt-1.5 text-[9px] font-black text-brand-black/35 tracking-widest uppercase">
                {formatTimeAgo(activity.createdAt)}
              </span>
            </div>
          </motion.div>
        ))}

        {!activities.length ? (
          <div className="rounded-2xl border border-dashed border-brand-black/15 px-4 py-10 text-center text-xs font-bold text-brand-black/40 uppercase tracking-widest">
            No activities logged on canvas
          </div>
        ) : null}
      </div>

      {/* Load More Trigger */}
      {onLoadMore && (
        <div className="mt-6 flex justify-start">
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <button
              type="button"
              onClick={onLoadMore}
              disabled={loadingMore}
              className="inline-flex items-center gap-2 rounded-full bg-brand-black border-editorial px-4 py-2.5 text-[10px] font-editorial font-bold text-brand-yellow shadow-editorial-sm hover:bg-brand-black/90 transition-all cursor-pointer disabled:opacity-75"
            >
              {loadingMore ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin text-brand-yellow" />
              ) : null}
              <span>{loadingMore ? 'Syncing...' : 'Sync Older logs'}</span>
            </button>
          </motion.div>
        </div>
      )}
    </section>
  );
}
