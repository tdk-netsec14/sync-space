import React, { memo, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, AlertCircle } from 'lucide-react';
import DOMPurify from 'dompurify';

const priorityColors = {
  urgent: 'bg-rose-500 animate-pulse',
  high: 'bg-brand-yellow border border-brand-black/10',
  medium: 'bg-brand-purple',
  low: 'bg-brand-black/25'
};

/**
 * TaskCard — memoized to prevent re-renders when an unrelated task updates.
 *
 * Portal approach for drag:
 *   When isDragging, we render through a React portal into document.body.
 *   This prevents the drag clone from being offset by any scrolled/overflow
 *   ancestor container (the common cause of "cursor is far from the card").
 */
const TaskCard = memo(function TaskCard({ task, onClick, provided, snapshot }) {
  const overdue = task.dueDate && new Date(task.dueDate).getTime() < Date.now();
  const isDragging = snapshot?.isDragging;

  const safeTitle = useMemo(() => DOMPurify.sanitize(task.title || ''), [task.title]);
  const safeLabels = useMemo(
    () => (task.labels || []).map((l) => DOMPurify.sanitize(l)),
    [task.labels]
  );

  const card = (
    <div
      ref={provided?.innerRef}
      {...provided?.draggableProps}
      {...provided?.dragHandleProps}
      // Explicitly pass style — required for portal to get correct drag coordinates
      style={provided?.draggableProps?.style}
      onClick={onClick}
      className={`group cursor-pointer rounded-2xl border-editorial bg-white p-4 shadow-editorial-sm ${
        isDragging
          ? 'rotate-[1.5deg] shadow-editorial border-brand-purple bg-brand-lavender/10 ring-2 ring-brand-purple/20 opacity-95'
          : 'border-brand-black hover:-translate-y-0.5 hover:shadow-editorial transition-all duration-200'
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

      {/* Task Title */}
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
            className="flex h-6 w-6 items-center justify-center rounded-full text-[8px] font-black text-brand-black border border-brand-black/10 shadow-sm shrink-0"
            style={{ backgroundColor: '#DCC7FF' }}
            title={DOMPurify.sanitize(task.assignee.name || '')}
          >
            {DOMPurify.sanitize(task.assignee.name?.slice(0, 2).toUpperCase() || '')}
          </div>
        )}
      </div>
    </div>
  );

  // When dragging, portal to document.body so position is viewport-relative,
  // not relative to the scrolled overflow-x:auto Kanban container.
  if (isDragging) {
    return createPortal(card, document.body);
  }

  return card;
});

export default TaskCard;
