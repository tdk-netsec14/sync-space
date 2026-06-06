/**
 * client/src/components/EmptyState.jsx
 *
 * Reusable empty-state component used across boards, tasks, notifications,
 * and activity feed. Pass a pre-built variant or fully custom props.
 *
 * Usage:
 *   <EmptyState variant="boards" onAction={() => setShowCreate(true)} />
 *   <EmptyState icon={<Bell />} title="All caught up" description="No notifications yet." />
 */
import React from 'react';
import { Layout, ListTodo, Bell, Activity, SearchX } from 'lucide-react';

// ---------------------------------------------------------------------------
// Pre-built variants
// ---------------------------------------------------------------------------
const VARIANTS = {
  boards: {
    icon: <Layout className="h-8 w-8" />,
    title: 'No boards yet',
    description: 'Create your first board to start tracking work with your team.',
    actionLabel: 'Create a board'
  },
  tasks: {
    icon: <ListTodo className="h-8 w-8" />,
    title: 'Empty column',
    description: 'No tasks here. Add one to get started.',
    actionLabel: 'Add task'
  },
  notifications: {
    icon: <Bell className="h-8 w-8" />,
    title: 'All caught up',
    description: "No notifications right now. You're on top of everything.",
    actionLabel: null
  },
  activity: {
    icon: <Activity className="h-8 w-8" />,
    title: 'No activity yet',
    description: 'Activity will appear here as your team makes changes.',
    actionLabel: null
  },
  search: {
    icon: <SearchX className="h-8 w-8" />,
    title: 'No results found',
    description: "Try adjusting your search or filter to find what you're looking for.",
    actionLabel: null
  }
};

export default function EmptyState({
  variant,
  icon,
  title,
  description,
  actionLabel,
  onAction,
  compact = false
}) {
  const preset = variant ? VARIANTS[variant] : null;
  const resolvedIcon = icon ?? preset?.icon;
  const resolvedTitle = title ?? preset?.title ?? 'Nothing here';
  const resolvedDescription = description ?? preset?.description ?? '';
  const resolvedActionLabel = actionLabel ?? preset?.actionLabel ?? null;

  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${
        compact ? 'py-8 px-4' : 'py-16 px-8'
      }`}
    >
      {resolvedIcon && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#111111]/10 bg-white text-[#111111]/25 shadow-sm">
          {resolvedIcon}
        </div>
      )}

      <h3
        className={`font-black text-[#111111] tracking-tight ${compact ? 'text-sm' : 'text-base'}`}
      >
        {resolvedTitle}
      </h3>

      {resolvedDescription && (
        <p
          className={`mt-1.5 text-[#111111]/45 leading-relaxed max-w-xs ${compact ? 'text-xs' : 'text-sm'}`}
        >
          {resolvedDescription}
        </p>
      )}

      {resolvedActionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#111111] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#333] transition cursor-pointer shadow-sm"
        >
          {resolvedActionLabel}
        </button>
      )}
    </div>
  );
}
