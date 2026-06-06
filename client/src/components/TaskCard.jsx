import React, { memo, useMemo } from 'react';
import { Calendar, AlertCircle } from 'lucide-react';
import DOMPurify from 'dompurify';

const priorityColors = {
  urgent: 'bg-rose-500 pulse-glow-yellow animate-pulse',
  high: 'bg-brand-yellow border border-brand-black/10',
  medium: 'bg-brand-purple',
  low: 'bg-brand-black/25'
};

/**
 * TaskCard — memoized to prevent re-renders when an unrelated task updates.
 * All user-generated text (title, labels) is sanitized with DOMPurify.
 */
const TaskCard = memo(function TaskCard({ task, onClick, provided, snapshot }) {
  const overdue = task.dueDate && new Date(task.dueDate).getTime() < Date.now();

  // Sanitize user-generated content — prevents XSS from malicious task titles
  const safeTitle = useMemo(() => DOMPurify.sanitize(task.title || ''), [task.title]);
  const safeLabels = useMemo(
    () => (task.labels || []).map((l) => DOMPurify.sanitize(l)),
    [task.labels]
  );

  return (
    <div
      ref={provided?.innerRef}
      {...provided?.draggableProps}
      {...provided?.dragHandleProps}
      onClick={onClick}
      className={`group cursor-pointer rounded-2xl border-editorial bg-white p-4 shadow-editorial-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-editorial ${
        snapshot?.isDragging
          ? 'scale-[1.03] rotate-[1.5deg] shadow-editorial border-brand-purple bg-brand-lavender/10 ring-2 ring-brand-purple/20'
          : 'border-brand-black'
      }`}
    >
      {/* Task Priority Tag */}
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5">
          <span
            className={`h-2.5 w-2.5 rounded-full ${priorityColors[task.priority] || priorityColors.medium}`}
          />
          <span className="text-[9px] font-black uppercase tracking-widest text-brand-black/60 font-sans-editorial">
            {task.priority || 'medium'}
          </span>
        </span>
      </div>

      {/* Task Title — rendered as sanitized plain text (not innerHTML) */}
      <h4 className="mt-2.5 text-xs font-editorial font-bold text-brand-black leading-snug group-hover:text-brand-purple transition duration-150">
        {safeTitle}
      </h4>

      {/* Labels */}
      {safeLabels.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {safeLabels.map((label) => (
            <span
              key={label}
              className="rounded-full bg-brand-beige border border-brand-black/10 px-2.5 py-0.5 text-[8px] font-black uppercase tracking-widest text-brand-black/75"
            >
              {label}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between border-t border-brand-black/10 pt-3">
        <div className="flex items-center gap-3">
          {task.dueDate && (
            <span
              className={`inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider ${
                overdue ? 'text-rose-500 animate-pulse' : 'text-brand-black/50'
              }`}
            >
              {overdue ? (
                <AlertCircle className="h-3.5 w-3.5" />
              ) : (
                <Calendar className="h-3.5 w-3.5 text-brand-purple" />
              )}
              <span className="font-sans-editorial">
                {new Date(task.dueDate).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric'
                })}
              </span>
            </span>
          )}
        </div>

        {task.assignee && (
          <div
            className="flex h-6.5 w-6.5 items-center justify-center rounded-full text-[8px] font-black text-brand-black border border-brand-black/10 shadow-sm"
            style={{ backgroundColor: '#DCC7FF' }}
            title={DOMPurify.sanitize(task.assignee.name || '')}
          >
            {DOMPurify.sanitize(task.assignee.name?.slice(0, 2).toUpperCase() || '')}
          </div>
        )}
      </div>
    </div>
  );
});

export default TaskCard;
