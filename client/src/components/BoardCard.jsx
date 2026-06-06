import React from 'react';
import { ArrowRight, Kanban } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function BoardCard({ board, workspaceId }) {
  const navigate = useNavigate();
  const accentColor = board.color || '#8B5CF6';

  return (
    <div className="group relative overflow-hidden rounded-3xl border-editorial bg-white shadow-editorial-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-editorial flex flex-col justify-between min-h-[200px]">
      {/* Editorial top accent bar */}
      <span
        className="absolute left-0 right-0 top-0 h-1.5"
        style={{ backgroundColor: accentColor }}
      />

      <div className="p-6 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate font-editorial text-base font-bold uppercase tracking-tight text-brand-black leading-snug group-hover:text-brand-purple transition duration-150">
              {board.name}
            </h3>
            <p className="mt-2 text-[11px] leading-relaxed text-brand-black/50 font-sans-editorial font-bold line-clamp-2">
              {board.description || 'No project description configured.'}
            </p>
          </div>

          <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-brand-beige border border-brand-black/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-brand-black/65">
            <Kanban className="h-3 w-3 text-brand-purple" />
            <span>{board.taskCount || 0} tasks</span>
          </span>
        </div>
      </div>

      <div className="px-6 pb-6 pt-2">
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <button
            type="button"
            onClick={() => navigate(`/workspace/${workspaceId}/boards/${board.id}`)}
            className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-brand-black border-editorial px-4 py-3 text-[10px] font-editorial font-bold text-brand-yellow hover:bg-brand-black/90 cursor-pointer shadow-editorial-sm transition-all uppercase tracking-widest"
          >
            <span>Open Sprint Board</span>
            <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1 text-brand-yellow" />
          </button>
        </motion.div>
      </div>
    </div>
  );
}
