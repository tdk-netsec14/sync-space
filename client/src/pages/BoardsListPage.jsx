import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Menu, Plus, Compass } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import BoardCard from '../components/BoardCard';
import BoardModal from '../components/BoardModal';
import { BoardListSkeleton } from '../components/SkeletonScreens';
import { api } from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';

export default function BoardsListPage() {
  const { workspaceId } = useParams();
  const [boards, setBoards] = useState([]);
  const [workspace, setWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const [workspaceResponse, boardsResponse] = await Promise.all([
          api.get(`/api/v1/workspaces/${workspaceId}`),
          api.get(`/api/v1/workspaces/${workspaceId}/boards`)
        ]);
        if (!active) return;
        setWorkspace(workspaceResponse.data.workspace);
        setBoards(boardsResponse.data.boards || []);
      } finally {
        if (active) setLoading(false);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [workspaceId]);

  async function handleCreateBoard(payload) {
    // Let errors propagate up to BoardModal's catch block
    const response = await api.post(`/api/v1/workspaces/${workspaceId}/boards`, payload);
    const newBoard = response.data.board;
    if (!newBoard) throw new Error('Server did not return board data');
    setBoards((current) => [newBoard, ...current]);
    setShowModal(false);
  }


  function handleDeleteBoard(boardId) {
    setBoards((current) => current.filter((b) => b.id !== boardId));
  }


  if (loading) {
    return (
      <div className="min-h-screen bg-brand-offwhite dot-grid relative flex">
        <Sidebar
          workspace={workspace}
          workspaceId={workspaceId}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />
        <main className="flex-1 p-6 md:ml-[260px] md:p-10 max-w-7xl mx-auto w-full">
          <BoardListSkeleton />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-offwhite text-brand-black relative dot-grid flex overflow-x-hidden">
      {/* Sidebar Navigation */}
      <Sidebar
        workspace={workspace}
        workspaceId={workspaceId}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Sprint Tracks Canvas */}
      <main className="flex-1 p-6 md:ml-[260px] md:p-10 max-w-7xl mx-auto w-full transition-all">
        {/* Editorial Header Block */}
        <div className="mb-10 flex flex-col items-start justify-between gap-6 border-b border-brand-black/10 pb-8 md:flex-row md:items-center">
          <div className="flex items-center gap-4 min-w-0">
            <button
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              className="rounded-xl border-editorial bg-white p-3 text-brand-black md:hidden hover:bg-brand-beige transition-all shadow-editorial-sm shrink-0"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <span className="text-[9px] font-black uppercase tracking-widest text-brand-black/45 block font-sans-editorial">
                Sprint sequences
              </span>
              <h1 className="font-editorial text-4xl sm:text-5xl font-black text-brand-black leading-none uppercase mt-1 truncate">
                Sprint Tracks
              </h1>
              <p className="mt-2.5 text-xs font-sans-editorial font-bold text-brand-black/45 leading-relaxed">
                Deploy modular Kanban boards to sequence task flows and milestone tracks.
              </p>
            </div>
          </div>

          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="shrink-0">
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-2 rounded-full bg-brand-yellow border-editorial px-5 py-3.5 text-xs font-editorial font-bold text-brand-black shadow-editorial hover:bg-[#ffcf29] transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4 text-brand-black" />
              <span>Create Track</span>
            </button>
          </motion.div>
        </div>

        {/* Tracks List Grid */}
        <AnimatePresence mode="wait">
          {boards.length > 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3"
            >
              {boards.map((board) => (
                <BoardCard key={board.id} board={board} workspaceId={workspaceId} onDelete={handleDeleteBoard} />
              ))}

            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="border-editorial bg-white p-12 text-center max-w-lg mx-auto shadow-editorial rounded-3xl mt-12 relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-brand-purple" />
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-lavender/35 border border-brand-black/10 mb-4">
                <Compass className="h-6 w-6 text-brand-purple" />
              </div>
              <h3 className="font-editorial text-sm font-bold uppercase tracking-widest text-brand-black">
                No active tracks found
              </h3>
              <p className="text-xs font-sans-editorial font-bold text-brand-black/45 mt-2 leading-relaxed">
                Initialize your collaborative space by deploying a new Kanban sprint board.
              </p>
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="mt-6 inline-block"
              >
                <button
                  type="button"
                  onClick={() => setShowModal(true)}
                  className="inline-flex items-center gap-2 rounded-full bg-brand-black border-editorial px-5 py-3 text-xs font-editorial font-bold text-brand-yellow hover:bg-brand-black/90 cursor-pointer shadow-editorial-sm transition-all"
                >
                  <Plus className="h-4 w-4" />
                  <span>Create First Track</span>
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {showModal && (
          <BoardModal onClose={() => setShowModal(false)} onCreate={handleCreateBoard} />
        )}
      </main>
    </div>
  );
}
