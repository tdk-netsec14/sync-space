import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Plus, Terminal, BarChart2, Briefcase, Timer, Users, Palette } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useWorkspace } from '../context/WorkspaceContext';
import { motion, AnimatePresence } from 'framer-motion';

const emojiMap = {
  '💻': Terminal,
  '🎨': Palette,
  '📊': BarChart2,
  '💼': Briefcase,
  '👥': Users,
  '⏱️': Timer
};

export default function WorkspaceSwitcher() {
  const navigate = useNavigate();
  const { workspaces, currentWorkspace, setCurrentWorkspace } = useWorkspace();
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleSelect(workspace) {
    setCurrentWorkspace(workspace);
    navigate(`/workspace/${workspace.id}`);
    setOpen(false);
  }

  return (
    <div className="relative font-sans-editorial" ref={containerRef}>
      <motion.button
        whileTap={{ scale: 0.98 }}
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3.5 py-3 text-left text-xs font-bold text-white/80 hover:text-white hover:bg-white/10 transition-all cursor-pointer shadow-sm animate-fade-in"
      >
        <span 
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-brand-black shadow-sm animate-fade-in" 
          style={{ backgroundColor: currentWorkspace?.color || '#8B5CF6' }}
        >
          {emojiMap[currentWorkspace?.logo] ? (
            React.createElement(emojiMap[currentWorkspace?.logo], { className: "h-3.5 w-3.5 text-brand-black" })
          ) : (
            <span className="text-[10px] font-black">{currentWorkspace?.logo?.[0]?.toUpperCase() || 'W'}</span>
          )}
        </span>
        <span className="truncate flex-1 text-white">{currentWorkspace?.name || 'Select workspace'}</span>
        <ChevronDown className={`h-4 w-4 text-white/40 transition-transform duration-250 ${open ? 'rotate-180 text-white' : ''}`} />
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div 
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
            className="absolute left-0 right-0 z-50 mt-2 overflow-hidden rounded-2xl border border-white/15 bg-[#161616] p-1.5 shadow-2xl"
          >
            <div className="max-h-[220px] overflow-y-auto space-y-0.5 scrollbar-elegant">
              {workspaces.map((workspace) => (
                <button
                  key={workspace.id}
                  type="button"
                  onClick={() => handleSelect(workspace)}
                  className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left text-xs font-bold tracking-tight transition duration-150 cursor-pointer ${
                    currentWorkspace?.id === workspace.id
                      ? 'bg-white/10 text-white'
                      : 'text-white/60 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <span 
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-brand-black shadow-sm" 
                    style={{ backgroundColor: workspace.color || '#8B5CF6' }}
                  >
                    {emojiMap[workspace.logo] ? (
                      React.createElement(emojiMap[workspace.logo], { className: "h-4 w-4 text-brand-black" })
                    ) : (
                      <span className="text-[10px] font-black">{workspace.logo?.[0]?.toUpperCase() || 'W'}</span>
                    )}
                  </span>
                  <span className="truncate">{workspace.name}</span>
                </button>
              ))}
            </div>
            
            <div className="mt-1.5 pt-1.5 border-t border-white/10">
              <button
                type="button"
                onClick={() => {
                  navigate('/workspace/new');
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-bold text-brand-yellow hover:bg-white/5 transition duration-150 cursor-pointer"
              >
                <Plus className="h-4 w-4 shrink-0 text-brand-yellow" />
                <span>Create New Workspace</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}