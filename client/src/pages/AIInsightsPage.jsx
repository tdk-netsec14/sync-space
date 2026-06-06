import React, { useEffect, useState } from 'react';
import { Copy, RefreshCcw, Sparkles, Loader2, Menu, AlertCircle } from 'lucide-react';
import { useParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { useWorkspace } from '../context/WorkspaceContext';
import {
  fetchWorkspaceBoards,
  generateSprintReport,
  generateStandup,
  getWorkspace
} from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';

function startOfWeek(date = new Date()) {
  const current = new Date(date);
  const day = current.getDay();
  const diff = day === 0 ? 6 : day - 1;
  current.setDate(current.getDate() - diff);
  return current;
}

function toDateInputValue(date) {
  return new Date(date).toISOString().slice(0, 10);
}

function parseMarkdownSections(markdown = '') {
  const lines = String(markdown).split(/\r?\n/);
  const sections = [];
  let current = null;

  lines.forEach((line) => {
    if (/^##\s+/.test(line)) {
      if (current) sections.push(current);
      current = { title: line.replace(/^##\s+/, '').trim(), lines: [] };
      return;
    }

    if (current) {
      current.lines.push(line);
    }
  });

  if (current) sections.push(current);
  return sections;
}

function parseStandupText(text = '') {
  const sections = { Yesterday: '', Today: '', Blockers: '' };
  String(text)
    .split(/\r?\n/)
    .forEach((line) => {
      const yesterday = line.match(/^\*\*Yesterday:\*\*\s*(.*)$/);
      const today = line.match(/^\*\*Today:\*\*\s*(.*)$/);
      const blockers = line.match(/^\*\*Blockers:\*\*\s*(.*)$/);

      if (yesterday) sections.Yesterday = yesterday[1];
      if (today) sections.Today = today[1];
      if (blockers) sections.Blockers = blockers[1];
    });

  return sections;
}

function AiBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-black/10 bg-brand-lavender/35 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-brand-black">
      <Sparkles className="h-3 w-3 text-brand-purple animate-pulse" />
      <span>AI Engine</span>
    </span>
  );
}

function AiThinking({ message }) {
  return (
    <div className="flex items-center gap-3.5 rounded-2xl border-editorial border-brand-purple bg-brand-lavender/10 px-4 py-4 text-xs font-bold text-brand-black animate-pulse font-sans-editorial">
      <Loader2 className="h-4.5 w-4.5 animate-spin text-brand-purple" />
      <span>{message}</span>
      <span className="flex items-center gap-1">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-purple [animation-delay:0ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-purple [animation-delay:150ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-purple [animation-delay:300ms]" />
      </span>
    </div>
  );
}

function HumanMessage({ text }) {
  if (!text) return null;
  return (
    <div className="rounded-2xl border border-brand-yellow bg-brand-beige px-4 py-3 text-xs font-bold text-brand-black flex items-center gap-2 font-sans-editorial">
      <AlertCircle className="h-4.5 w-4.5 text-brand-purple shrink-0" />
      <span>{text}</span>
    </div>
  );
}

export default function AIInsightsPage() {
  const { workspaceId } = useParams();
  const { currentWorkspace, setCurrentWorkspace } = useWorkspace();
  const [workspace, setWorkspace] = useState(currentWorkspace);
  const [boards, setBoards] = useState([]);
  const [selectedBoardId, setSelectedBoardId] = useState('');
  const [weekStart, setWeekStart] = useState(toDateInputValue(startOfWeek()));
  const [weekEnd, setWeekEnd] = useState(toDateInputValue(new Date()));
  const [sprintReport, setSprintReport] = useState('');
  const [standup, setStandup] = useState('');
  const [reportLoading, setReportLoading] = useState(false);
  const [standupLoading, setStandupLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [standupMessage, setStandupMessage] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const [workspaceResponse, boardsResponse] = await Promise.all([
          getWorkspace(workspaceId),
          fetchWorkspaceBoards(workspaceId)
        ]);
        if (!active) return;
        setWorkspace(workspaceResponse.data.workspace);
        setCurrentWorkspace(workspaceResponse.data.workspace);
        setBoards(boardsResponse.data.boards || []);
        setSelectedBoardId((boardsResponse.data.boards || [])[0]?.id || '');
      } catch (error) {
        if (active) {
          setBoards([]);
        }
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [workspaceId, setCurrentWorkspace]);

  async function handleGenerateReport() {
    if (!selectedBoardId) return;
    setReportLoading(true);
    setMessage('');
    try {
      const response = await generateSprintReport(workspaceId, {
        boardId: selectedBoardId,
        weekStart,
        weekEnd
      });
      setSprintReport(response.data.report || '');
    } catch (error) {
      setMessage(error.response?.data?.error?.message || 'Unable to generate report right now.');
    } finally {
      setReportLoading(false);
    }
  }

  async function handleGenerateStandup() {
    setStandupLoading(true);
    setStandupMessage('');
    try {
      const response = await generateStandup(workspaceId);
      setStandup(response.data.standup || '');
    } catch (error) {
      setStandupMessage(
        error.response?.data?.error?.message || 'Unable to generate standup right now.'
      );
    } finally {
      setStandupLoading(false);
    }
  }

  async function copyReport() {
    if (sprintReport) {
      await navigator.clipboard.writeText(sprintReport);
      setMessage('Sprint report copied to clipboard.');
    }
  }

  async function copyStandup() {
    if (standup) {
      await navigator.clipboard.writeText(standup);
      setStandupMessage('Standup text copied to clipboard.');
    }
  }

  const reportSections = parseMarkdownSections(sprintReport);
  const standupSections = parseStandupText(standup);

  return (
    <div className="min-h-screen bg-brand-offwhite text-brand-black font-sans antialiased flex dot-grid overflow-x-hidden">
      {/* Sidebar Navigation */}
      <Sidebar
        workspace={workspace}
        workspaceId={workspaceId}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Insights Frame */}
      <main className="flex-1 p-6 md:ml-[260px] md:p-10 max-w-7xl mx-auto w-full transition-all">
        {/* Editorial header block */}
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
                Workspace intelligence
              </span>
              <h1 className="font-editorial text-4xl sm:text-5xl font-black text-brand-black leading-none uppercase mt-1 truncate">
                AI Insights
              </h1>
              <p className="mt-2.5 text-xs font-sans-editorial font-bold text-brand-black/45 leading-relaxed">
                Generate structured sprint reports and standup timelines using predictive canvas
                parameters.
              </p>
            </div>
          </div>
          <div className="shrink-0">
            <AiBadge />
          </div>
        </div>

        {/* Dynamic AI Report Containers */}
        <div className="grid gap-8 xl:grid-cols-2 items-start">
          {/* Sprint Report Section */}
          <section className="border-editorial bg-white p-6 shadow-editorial rounded-3xl flex flex-col relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-brand-black/10 pb-4 mb-5">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-brand-purple font-sans-editorial">
                  Canvas Analysis
                </p>
                <h2 className="font-editorial text-xl font-bold text-brand-black uppercase leading-tight mt-0.5">
                  Sprint summary
                </h2>
              </div>
              <AiBadge />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-brand-black/65 font-sans-editorial">
                  Scope Board
                </span>
                <select
                  value={selectedBoardId}
                  onChange={(event) => setSelectedBoardId(event.target.value)}
                  className="w-full rounded-2xl border border-brand-black bg-brand-offwhite px-3.5 py-3 text-xs font-bold text-brand-black outline-none transition focus:shadow-editorial-sm cursor-pointer"
                >
                  <option value="" disabled>
                    Select board
                  </option>
                  {boards.map((board) => (
                    <option key={board.id} value={board.id}>
                      {board.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-brand-black/65 font-sans-editorial">
                  Week Start
                </span>
                <input
                  type="date"
                  value={weekStart}
                  onChange={(event) => setWeekStart(event.target.value)}
                  className="w-full rounded-2xl border border-brand-black bg-brand-offwhite px-3.5 py-3 text-xs font-bold text-brand-black outline-none transition focus:shadow-editorial-sm cursor-pointer"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-brand-black/65 font-sans-editorial">
                  Week End
                </span>
                <input
                  type="date"
                  value={weekEnd}
                  onChange={(event) => setWeekEnd(event.target.value)}
                  className="w-full rounded-2xl border border-brand-black bg-brand-offwhite px-3.5 py-3 text-xs font-bold text-brand-black outline-none transition focus:shadow-editorial-sm cursor-pointer"
                />
              </label>

              <div className="sm:col-span-2 pt-2">
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <button
                    type="button"
                    onClick={handleGenerateReport}
                    disabled={reportLoading || !selectedBoardId}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-yellow border-editorial px-5 py-4 text-xs font-editorial font-bold text-brand-black shadow-editorial hover:bg-[#ffcf29] transition duration-150 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
                  >
                    {reportLoading ? (
                      <Loader2 className="h-4.5 w-4.5 animate-spin text-brand-black" />
                    ) : (
                      <Sparkles className="h-4.5 w-4.5 text-brand-black animate-pulse" />
                    )}
                    <span>Compile Sprint report</span>
                  </button>
                </motion.div>
              </div>
            </div>

            <div className="mt-6 space-y-4 flex-1 flex flex-col justify-start">
              <AnimatePresence>
                {reportLoading && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <AiThinking message="Analyzing deliverable structures..." />
                  </motion.div>
                )}
                {message && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <HumanMessage text={message} />
                  </motion.div>
                )}

                {sprintReport && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-3xl border-editorial bg-brand-offwhite/40 p-5 flex-1"
                  >
                    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-brand-black/10 pb-3">
                      <AiBadge />
                      <div className="flex items-center gap-2">
                        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                          <button
                            type="button"
                            onClick={copyReport}
                            className="inline-flex items-center gap-1.5 rounded-full border border-brand-black/10 bg-white px-3.5 py-1.5 text-[10px] font-bold text-brand-black hover:border-brand-black transition-all cursor-pointer shadow-sm"
                          >
                            <Copy className="h-3.5 w-3.5" />
                            <span>Copy</span>
                          </button>
                        </motion.div>
                        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                          <button
                            type="button"
                            onClick={handleGenerateReport}
                            className="inline-flex items-center gap-1.5 rounded-full bg-brand-black border-editorial px-3.5 py-1.5 text-[10px] font-editorial font-bold text-brand-yellow hover:bg-brand-black/90 cursor-pointer shadow-editorial-sm transition-all"
                          >
                            <RefreshCcw className="h-3.5 w-3.5" />
                            <span>Regen</span>
                          </button>
                        </motion.div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {reportSections.map((section) => (
                        <article
                          key={section.title}
                          className="rounded-2xl border border-brand-black/10 bg-white p-4 shadow-sm"
                        >
                          <h3 className="font-editorial text-[10px] font-black text-brand-black uppercase tracking-widest border-b border-brand-black/5 pb-2 mb-3">
                            {section.title}
                          </h3>
                          <div className="space-y-2 text-xs leading-relaxed text-brand-black/85 font-sans-editorial font-bold">
                            {section.lines.length ? (
                              section.lines.map((line, index) =>
                                /^-\s+/.test(line) ? (
                                  <div key={index} className="flex gap-2 items-start">
                                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-purple" />
                                    <p>{line.replace(/^-\s+/, '')}</p>
                                  </div>
                                ) : line.trim() ? (
                                  <p key={index}>{line}</p>
                                ) : null
                              )
                            ) : (
                              <p className="text-brand-black/35 font-medium">
                                No contents generated.
                              </p>
                            )}
                          </div>
                        </article>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </section>

          {/* Standup Report Section */}
          <section className="border-editorial bg-white p-6 shadow-editorial rounded-3xl flex flex-col relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-brand-black/10 pb-4 mb-5">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-brand-purple font-sans-editorial">
                  Operational Status
                </p>
                <h2 className="font-editorial text-xl font-bold text-brand-black uppercase leading-tight mt-0.5">
                  My Standup summary
                </h2>
              </div>
              <AiBadge />
            </div>

            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <button
                type="button"
                onClick={handleGenerateStandup}
                disabled={standupLoading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-black border-editorial px-5 py-4 text-xs font-editorial font-bold text-brand-yellow hover:bg-brand-black/90 transition disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer shadow-editorial"
              >
                {standupLoading ? (
                  <Loader2 className="h-4.5 w-4.5 animate-spin" />
                ) : (
                  <Sparkles className="h-4.5 w-4.5 text-brand-yellow animate-pulse" />
                )}
                <span>Generate standup report</span>
              </button>
            </motion.div>

            <div className="mt-6 space-y-4 flex-1 flex flex-col justify-start">
              <AnimatePresence>
                {standupLoading && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <AiThinking message="Reviewing timeline updates..." />
                  </motion.div>
                )}
                {standupMessage && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <HumanMessage text={standupMessage} />
                  </motion.div>
                )}

                {standup && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-3xl border-editorial bg-brand-offwhite/40 p-5 flex-1"
                  >
                    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-brand-black/10 pb-3">
                      <AiBadge />
                      <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                        <button
                          type="button"
                          onClick={copyStandup}
                          className="inline-flex items-center gap-1.5 rounded-full border border-brand-black/10 bg-white px-3.5 py-1.5 text-[10px] font-bold text-brand-black hover:border-brand-black transition-all cursor-pointer shadow-sm"
                        >
                          <Copy className="h-3.5 w-3.5" />
                          <span>Copy Standup</span>
                        </button>
                      </motion.div>
                    </div>

                    <div className="space-y-4">
                      {Object.entries(standupSections).map(([title, content]) => (
                        <div
                          key={title}
                          className="rounded-2xl border border-brand-black/10 bg-white p-4 shadow-sm"
                        >
                          <h3 className="font-editorial text-[9px] font-black uppercase tracking-widest text-brand-black/45 border-b border-brand-black/5 pb-2 mb-3">
                            {title}
                          </h3>
                          <p className="whitespace-pre-wrap text-xs leading-relaxed text-brand-black/80 font-bold font-sans-editorial">
                            {content || 'No timeline activity reported.'}
                          </p>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
