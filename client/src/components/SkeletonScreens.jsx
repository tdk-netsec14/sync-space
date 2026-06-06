/**
 * client/src/components/SkeletonScreens.jsx
 *
 * A collection of purpose-built skeleton screens for every major loading state.
 * All use the same animated shimmer effect from index.css.
 */
import React from 'react';

// ---------------------------------------------------------------------------
// Base shimmer block
// ---------------------------------------------------------------------------
function Shimmer({ className = '' }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-gradient-to-r from-[#111111]/5 via-[#111111]/10 to-[#111111]/5 bg-[length:200%_100%] ${className}`}
      style={{ animation: 'shimmer 1.5s ease-in-out infinite' }}
    />
  );
}

// ---------------------------------------------------------------------------
// Board (Kanban) skeleton — 3 columns × 4 cards
// ---------------------------------------------------------------------------
export function BoardSkeleton() {
  return (
    <div className="flex gap-6 overflow-hidden pt-2">
      {[0, 1, 2].map((col) => (
        <div
          key={col}
          className="flex w-[310px] shrink-0 flex-col rounded-3xl border border-[#111111]/10 bg-white p-5 shadow-sm"
        >
          {/* Column header */}
          <div className="mb-4 flex items-center justify-between border-b border-[#111111]/10 pb-3">
            <div className="space-y-1.5">
              <Shimmer className="h-3 w-24" />
              <Shimmer className="h-2 w-12 rounded-full" />
            </div>
            <Shimmer className="h-7 w-7 rounded-full" />
          </div>
          {/* Task cards */}
          <div className="flex flex-col gap-3">
            {[0, 1, 2, 3].map((card) => (
              <div
                key={card}
                className="rounded-2xl border border-[#111111]/8 bg-white p-4 space-y-3"
                style={{ opacity: 1 - card * 0.15 }}
              >
                <div className="flex items-center gap-2">
                  <Shimmer className="h-2.5 w-2.5 rounded-full" />
                  <Shimmer className="h-2 w-14" />
                </div>
                <Shimmer className="h-3 w-full" />
                <Shimmer className="h-2.5 w-3/4" />
                <div className="flex justify-between pt-1 border-t border-[#111111]/8">
                  <Shimmer className="h-2.5 w-16" />
                  <Shimmer className="h-5 w-5 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dashboard skeleton
// ---------------------------------------------------------------------------
export function DashboardSkeleton() {
  return (
    <div className="space-y-8 p-6 md:p-10">
      {/* Header */}
      <div className="space-y-2">
        <Shimmer className="h-8 w-56" />
        <Shimmer className="h-3 w-40" />
      </div>
      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl border border-[#111111]/10 bg-white p-5 space-y-3">
            <Shimmer className="h-8 w-8 rounded-xl" />
            <Shimmer className="h-6 w-14" />
            <Shimmer className="h-2.5 w-24" />
          </div>
        ))}
      </div>
      {/* Activity feed */}
      <div className="rounded-2xl border border-[#111111]/10 bg-white p-6 space-y-4">
        <Shimmer className="h-4 w-32 mb-6" />
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-start gap-3">
            <Shimmer className="h-7 w-7 rounded-full shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Shimmer className="h-2.5 w-full" />
              <Shimmer className="h-2 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Board list skeleton (cards grid)
// ---------------------------------------------------------------------------
export function BoardListSkeleton() {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="rounded-2xl border border-[#111111]/10 bg-white p-6 space-y-4"
          style={{ opacity: 1 - i * 0.1 }}
        >
          <div className="flex items-center justify-between">
            <Shimmer className="h-6 w-6 rounded-full" />
            <Shimmer className="h-5 w-16 rounded-full" />
          </div>
          <Shimmer className="h-4 w-3/4" />
          <Shimmer className="h-2.5 w-full" />
          <Shimmer className="h-2.5 w-2/3" />
          <div className="flex justify-between pt-2 border-t border-[#111111]/8">
            <Shimmer className="h-2.5 w-16" />
            <Shimmer className="h-2.5 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AI generation skeleton — shimmer lines mimicking text output
// ---------------------------------------------------------------------------
export function AIGeneratingSkeleton({ label = 'Generating AI insights…' }) {
  return (
    <div className="rounded-2xl border border-[#DCC7FF]/50 bg-gradient-to-br from-[#DCC7FF]/10 to-white p-6 space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <div className="h-5 w-5 rounded-full bg-[#8B5CF6]/20 animate-pulse" />
        <span className="text-xs font-bold text-[#8B5CF6]/60 uppercase tracking-widest animate-pulse">
          {label}
        </span>
      </div>
      {[100, 85, 92, 70, 88, 60].map((w, i) => (
        <Shimmer key={i} className={`h-2.5 w-[${w}%]`} style={{ width: `${w}%` }} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Task list skeleton (inside detail panel)
// ---------------------------------------------------------------------------
export function TaskListSkeleton() {
  return (
    <div className="space-y-2">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="flex items-start gap-3 rounded-xl border border-[#111111]/8 bg-white p-3"
        >
          <Shimmer className="h-4 w-4 rounded shrink-0 mt-0.5" />
          <div className="flex-1 space-y-1.5">
            <Shimmer className="h-2.5 w-3/4" />
            <Shimmer className="h-2 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
