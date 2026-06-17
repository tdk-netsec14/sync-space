import React, { useState } from 'react';
import { ArrowRight, Kanban, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { deleteBoard } from '../services/api';

export default function BoardCard({ board, workspaceId, onDelete }) {
  const navigate = useNavigate();
  const accentColor = board.color || '#8B5CF6';
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteBoard(workspaceId, board.id);
      if (onDelete) onDelete(board.id);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to delete board:', err);
      setDeleting(false);
      setShowConfirm(false);
    }
  }

  return (
    <>
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

            <div className="flex items-center gap-2 shrink-0">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-beige border border-brand-black/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-brand-black/65">
                <Kanban className="h-3 w-3 text-brand-purple" />
                <span>{board.taskCount || 0} tasks</span>
              </span>

              {/* Delete button — always visible, highlights red on hover */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowConfirm(true);
                }}
                className="p-1.5 rounded-lg text-brand-black/25 hover:text-rose-600 hover:bg-rose-50 transition-colors duration-150"
                title="Delete sprint track"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
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

      {/* Delete confirmation modal */}
      <AnimatePresence>
        {showConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-brand-black/50 backdrop-blur-sm"
              onClick={() => setShowConfirm(false)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ type: 'spring', duration: 0.3 }}
              className="relative w-full max-w-sm overflow-hidden rounded-3xl border-editorial bg-white p-6 shadow-editorial z-10"
            >
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-rose-500" />
              <div className="flex items-center gap-2 text-rose-600 mb-3">
                <Trash2 className="h-4 w-4 shrink-0" />
                <h3 className="font-editorial text-sm font-bold uppercase tracking-widest">
                  Delete Sprint Track
                </h3>
              </div>
              <p className="text-xs font-sans-editorial font-bold text-brand-black/60 leading-relaxed mb-5">
                Are you sure you want to delete{' '}
                <span className="text-brand-black font-extrabold">{board.name}</span>? All tasks and
                history inside this track will be permanently removed.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowConfirm(false)}
                  className="rounded-full border border-brand-black/10 px-4 py-2 text-xs font-editorial font-bold uppercase tracking-widest text-brand-black hover:bg-brand-beige transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="rounded-full bg-rose-600 px-4 py-2 text-xs font-editorial font-bold uppercase tracking-widest text-white hover:bg-rose-700 transition-all cursor-pointer disabled:opacity-60"
                >
                  {deleting ? 'Deleting…' : 'Yes, Delete'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
