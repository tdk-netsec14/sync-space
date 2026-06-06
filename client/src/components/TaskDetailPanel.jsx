import React, { useEffect, useMemo, useState } from 'react';
import { Check, PencilLine, Send, Sparkles, Trash2, X, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import DOMPurify from 'dompurify';

function formatTimeAgo(value) {
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.floor(diff / 60000));

  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function TaskDetailPanel({
  task,
  columns,
  members,
  comments = [],
  currentUser,
  currentMemberRole,
  _boardContext,
  onClose,
  onChange,
  onDelete,
  onCreateComment,
  onUpdateComment,
  onDeleteComment,
  onSuggestDescription,
  onSuggestAssignee
}) {
  const [draft, setDraft] = useState('');
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingValue, setEditingValue] = useState('');
  const [descriptionLoading, setDescriptionLoading] = useState(false);
  const [assigneeLoading, setAssigneeLoading] = useState(false);
  const [suggestion, setSuggestion] = useState(null);
  const [aiMessage, setAiMessage] = useState('');
  const isAiThinking = descriptionLoading || assigneeLoading;

  useEffect(() => {
    setDraft('');
    setEditingCommentId(null);
    setEditingValue('');
    setSuggestion(null);
    setAiMessage('');
  }, [task?.id]);

  const canManageAllComments = currentMemberRole === 'owner' || currentMemberRole === 'admin';
  const commentsCount = useMemo(() => comments.length, [comments]);

  const currentMember = useMemo(() => {
    return members.find((m) => m.user?.id === currentUser?.id);
  }, [members, currentUser]);

  const visibleMembers = useMemo(() => members, [members]);

  async function submitComment() {
    const content = draft.trim();
    if (!content) return;
    await onCreateComment(content);
    setDraft('');
  }

  function beginEdit(comment) {
    setEditingCommentId(comment.id);
    setEditingValue(comment.content || '');
  }

  async function saveEdit(commentId) {
    const content = editingValue.trim();
    if (!content) return;
    await onUpdateComment(commentId, content);
    setEditingCommentId(null);
    setEditingValue('');
  }

  async function suggestDescription() {
    if (!onSuggestDescription) return;
    setDescriptionLoading(true);
    setAiMessage('');
    try {
      const description = await onSuggestDescription();
      if (description) {
        onChange({ description });
        setAiMessage('Description automatically upgraded by AI.');
      }
    } catch (error) {
      setAiMessage(
        error.response?.data?.error?.message || 'AI assistance is temporarily unavailable.'
      );
    } finally {
      setDescriptionLoading(false);
    }
  }

  async function suggestTaskAssignee() {
    if (!onSuggestAssignee) return;
    setAssigneeLoading(true);
    setAiMessage('');
    try {
      const nextSuggestion = await onSuggestAssignee();
      setSuggestion(nextSuggestion);
      setAiMessage('Optimal assignee suggested by AI.');
    } catch (error) {
      setAiMessage(
        error.response?.data?.error?.message || 'AI assistance is temporarily unavailable.'
      );
    } finally {
      setAssigneeLoading(false);
    }
  }

  return (
    <AnimatePresence>
      {task && (
        <>
          {/* Blur Glass Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-brand-black/60 backdrop-blur-md cursor-pointer"
            onClick={onClose}
          />

          {/* Slide-over Frame */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
            className="fixed inset-y-0 right-0 z-50 w-full sm:max-w-md md:max-w-xl overflow-y-auto border-l-2 border-brand-black bg-brand-offwhite p-6 sm:p-8 shadow-2xl scrollbar-elegant font-sans"
          >
            {/* Detail Sheet Header */}
            <div className="flex items-center justify-between border-b border-brand-black/10 pb-5 mb-6">
              <div>
                <h2 className="font-editorial text-2xl font-black text-brand-black uppercase">
                  Card Inspector
                </h2>
                <p className="text-[10px] font-sans-editorial font-bold text-brand-black/45 mt-1">
                  Configure sprint credentials.
                </p>
              </div>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-full border border-brand-black/10 bg-white px-3.5 py-2 text-[10px] font-editorial font-bold text-brand-black hover:border-brand-black cursor-pointer shadow-sm"
                >
                  Close Console
                </button>
              </motion.div>
            </div>

            {/* Config Fields */}
            <div className="space-y-5">
              <label className="block">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-brand-black/65 font-sans-editorial">
                  Task Name
                </span>
                <input
                  value={task.title || ''}
                  onChange={(event) => onChange({ title: event.target.value })}
                  className="w-full rounded-2xl border border-brand-black bg-white px-4 py-3 text-xs font-bold text-brand-black outline-none transition focus:shadow-editorial-sm"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-brand-black/65 font-sans-editorial">
                  Description Description
                </span>
                <textarea
                  value={task.description || ''}
                  onChange={(event) => onChange({ description: event.target.value })}
                  rows="4"
                  placeholder="Insert sprint criteria and milestones here."
                  className="w-full rounded-2xl border border-brand-black bg-white px-4 py-3 text-xs leading-relaxed text-brand-black outline-none transition focus:shadow-editorial-sm resize-none"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-brand-black/65 font-sans-editorial">
                    Status Column
                  </span>
                  <select
                    value={task.columnId || ''}
                    onChange={(event) => onChange({ columnId: event.target.value })}
                    className="w-full rounded-2xl border border-brand-black bg-white px-3.5 py-3 text-xs font-bold text-brand-black outline-none transition focus:shadow-editorial-sm cursor-pointer"
                  >
                    {columns.map((column) => (
                      <option key={column.id} value={column.id}>
                        {column.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-brand-black/65 font-sans-editorial">
                    Priority Tier
                  </span>
                  <select
                    value={task.priority || 'medium'}
                    onChange={(event) => onChange({ priority: event.target.value })}
                    className="w-full rounded-2xl border border-brand-black bg-white px-3.5 py-3 text-xs font-bold text-brand-black outline-none transition focus:shadow-editorial-sm cursor-pointer"
                  >
                    <option value="low">Low Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="high">High Priority</option>
                    <option value="urgent">Urgent Priority</option>
                  </select>
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-brand-black/65 font-sans-editorial">
                    Operator assignee
                  </span>
                  <select
                    value={task.assigneeId || ''}
                    onChange={(event) => onChange({ assigneeId: event.target.value || null })}
                    className="w-full rounded-2xl border border-brand-black bg-white px-3.5 py-3 text-xs font-bold text-brand-black outline-none transition focus:shadow-editorial-sm cursor-pointer"
                  >
                    <option value="">Unassigned</option>
                    {visibleMembers.map((member) => (
                      <option key={member.user?.id} value={member.user?.id}>
                        {member.user?.name} {member.user?.id === currentUser?.id ? '(You)' : ''}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-brand-black/65 font-sans-editorial">
                    Due Timeline
                  </span>
                  <input
                    type="date"
                    value={task.dueDate ? String(task.dueDate).slice(0, 10) : ''}
                    onChange={(event) => onChange({ dueDate: event.target.value || null })}
                    className="w-full rounded-2xl border border-brand-black bg-white px-3.5 py-3 text-xs font-bold text-brand-black outline-none transition focus:shadow-editorial-sm cursor-pointer"
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-brand-black/65 font-sans-editorial">
                  Scope Tags
                </span>
                <input
                  value={(task.labels || []).join(', ')}
                  onChange={(event) =>
                    onChange({
                      labels: event.target.value
                        .split(',')
                        .map((item) => item.trim())
                        .filter(Boolean)
                    })
                  }
                  placeholder="frontend, backend, design, bug"
                  className="w-full rounded-2xl border border-brand-black bg-white px-4 py-3 text-xs font-bold text-brand-black outline-none transition focus:shadow-editorial-sm"
                />
                <span className="mt-2 block text-[9px] font-bold text-brand-black/35 font-sans-editorial">
                  Comma-separated keyword items.
                </span>
              </label>

              {/* AI Suite Operations */}
              <div className="grid gap-3 sm:grid-cols-2 pt-2">
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <button
                    type="button"
                    onClick={suggestDescription}
                    disabled={descriptionLoading}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-brand-yellow border-editorial px-4 py-3 text-[10px] font-editorial font-bold text-brand-black shadow-editorial-sm hover:bg-[#ffcf29] transition-all cursor-pointer disabled:opacity-60"
                  >
                    <Sparkles className="h-4 w-4 text-brand-black animate-pulse" />
                    <span>AI Description</span>
                  </button>
                </motion.div>

                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <button
                    type="button"
                    onClick={suggestTaskAssignee}
                    disabled={assigneeLoading}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-brand-yellow border-editorial px-4 py-3 text-[10px] font-editorial font-bold text-brand-black hover:bg-[#ffcf29] cursor-pointer shadow-editorial-sm transition-all"
                  >
                    <Sparkles className="h-4 w-4 text-brand-black animate-pulse" />
                    <span>AI Assignee</span>
                  </button>
                </motion.div>
              </div>

              {isAiThinking && (
                <div className="flex items-center gap-3 rounded-2xl border-editorial border-brand-purple bg-brand-lavender/10 px-4 py-3 text-xs font-bold text-brand-black animate-pulse">
                  <Sparkles className="h-4.5 w-4.5 text-brand-purple animate-spin" />
                  <span className="font-sans-editorial">
                    AI Operator compiling recommendations...
                  </span>
                </div>
              )}

              {aiMessage && (
                <div className="rounded-2xl border border-brand-purple bg-brand-lavender/10 px-4 py-3.5 text-xs font-bold text-brand-black font-sans-editorial">
                  {aiMessage}
                </div>
              )}

              {suggestion && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-3xl border-editorial bg-white p-5 shadow-editorial"
                >
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-brand-black/10">
                    <p className="text-xs font-bold text-brand-black font-editorial uppercase">
                      Recommended:{' '}
                      <span className="text-brand-purple font-black">
                        {suggestion.suggestedMemberName || 'Unknown'}
                      </span>
                    </p>
                    <span className="rounded-full bg-brand-beige border border-brand-black/10 px-2.5 py-0.5 text-[8px] font-black uppercase tracking-widest text-brand-black">
                      Optimal
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-brand-black/60 font-sans-editorial font-bold">
                    {suggestion.reason}
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      suggestion?.suggestedMemberId &&
                      onChange({ assigneeId: suggestion.suggestedMemberId })
                    }
                    className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand-black border-editorial px-4 py-2 text-[10px] font-editorial font-bold text-brand-yellow hover:bg-brand-black/90 cursor-pointer shadow-editorial-sm transition-all"
                  >
                    Apply Assignment
                  </button>
                </motion.div>
              )}

              <div className="pt-4 border-t border-brand-black/10 flex justify-end">
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <button
                    type="button"
                    onClick={onDelete}
                    className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 border border-rose-200 px-4 py-2.5 text-xs font-bold text-rose-600 hover:bg-rose-100 transition-all cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>Delete Card</span>
                  </button>
                </motion.div>
              </div>
            </div>

            {/* Operator Timeline Comments */}
            <section className="mt-8 border-t border-brand-black/10 pt-6">
              <div className="flex items-center justify-between border-b border-brand-black/10 pb-4">
                <h3 className="font-editorial text-sm font-bold uppercase tracking-widest text-brand-black">
                  Operator timeline
                </h3>
                <span className="rounded-full bg-brand-beige border border-brand-black/10 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-brand-black/60">
                  {commentsCount} events
                </span>
              </div>

              <div className="mt-5 space-y-3">
                {comments.map((comment) => {
                  const isOwnComment = String(comment.author?.id) === String(currentUser?.id);
                  const canDelete = isOwnComment || canManageAllComments;
                  const canEdit = isOwnComment;
                  const isEditing = editingCommentId === comment.id;

                  return (
                    <div
                      key={comment.id}
                      className="group rounded-2xl border border-brand-black/10 bg-white px-4 py-4 transition hover:border-brand-black duration-150"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-black text-brand-black border border-brand-black/10 shadow-sm"
                          style={{ backgroundColor: comment.author?.avatar || '#DCC7FF' }}
                        >
                          {DOMPurify.sanitize(
                            (comment.author?.name || 'U').slice(0, 1).toUpperCase()
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-xs font-bold text-brand-black font-editorial uppercase">
                                {DOMPurify.sanitize(comment.author?.name || 'Operator')}
                              </p>
                              <p className="text-[9px] text-brand-black/40 mt-1 font-bold font-sans-editorial uppercase">
                                {formatTimeAgo(comment.createdAt)}
                              </p>
                            </div>

                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition duration-150">
                              {canEdit && (
                                <button
                                  type="button"
                                  onClick={() => beginEdit(comment)}
                                  className="rounded-full p-1.5 text-brand-black/40 hover:bg-brand-offwhite hover:text-brand-black transition cursor-pointer"
                                  aria-label="Edit comment"
                                >
                                  <PencilLine className="h-3.5 w-3.5" />
                                </button>
                              )}
                              {canDelete && (
                                <button
                                  type="button"
                                  onClick={() => onDeleteComment(comment.id)}
                                  className="rounded-full p-1.5 text-brand-black/40 hover:bg-brand-offwhite hover:text-rose-600 transition cursor-pointer"
                                  aria-label="Delete comment"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          {isEditing ? (
                            <div className="mt-3 space-y-2">
                              <textarea
                                value={editingValue}
                                onChange={(event) => setEditingValue(event.target.value)}
                                rows="2"
                                className="w-full rounded-2xl border border-brand-black px-3 py-2 text-xs leading-relaxed text-brand-black outline-none focus:shadow-editorial-sm resize-none bg-brand-offwhite"
                              />
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => saveEdit(comment.id)}
                                  className="inline-flex items-center gap-1 rounded-full bg-brand-black border-editorial px-3 py-1.5 text-[10px] font-editorial font-bold text-brand-yellow hover:bg-brand-black/90 cursor-pointer shadow-editorial-sm"
                                >
                                  <Check className="h-3.5 w-3.5" />
                                  <span>Save</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingCommentId(null)}
                                  className="inline-flex items-center gap-1 rounded-full border border-brand-black/10 bg-white px-3 py-1.5 text-[10px] font-editorial font-bold text-brand-black hover:border-brand-black cursor-pointer shadow-sm"
                                >
                                  <X className="h-3.5 w-3.5" />
                                  <span>Cancel</span>
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className="mt-2.5 whitespace-pre-wrap text-xs leading-relaxed text-brand-black/75 font-sans-editorial font-bold">
                              {DOMPurify.sanitize(comment.content || '')}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {!comments.length && (
                  <div className="rounded-2xl border border-dashed border-brand-black/25 px-4 py-8 text-center text-[9px] font-bold text-brand-black/40 uppercase tracking-widest">
                    No timeline updates logged
                  </div>
                )}
              </div>

              {/* Add Comment Box */}
              <div className="mt-5 flex gap-3 rounded-2xl border border-brand-black/10 bg-brand-offwhite p-4">
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-black text-brand-black border border-brand-black/10 shadow-sm"
                  style={{ backgroundColor: currentUser?.avatar || '#DCC7FF' }}
                >
                  {(currentUser?.name || 'U').slice(0, 1).toUpperCase()}
                </div>
                <div className="flex-1">
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                        event.preventDefault();
                        submitComment();
                      }
                    }}
                    placeholder="Commit live response to canvas timeline..."
                    rows="3"
                    className="w-full resize-none rounded-2xl border border-brand-black bg-white px-3 py-2 text-xs outline-none transition focus:shadow-editorial-sm placeholder:text-brand-black/30 font-bold font-sans-editorial"
                  />
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-[8px] font-bold text-brand-black/45 uppercase tracking-widest font-sans-editorial">
                      Press <kbd className="text-brand-purple font-black">Ctrl + Enter</kbd>
                    </span>
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <button
                        type="button"
                        onClick={submitComment}
                        className="inline-flex items-center gap-1.5 rounded-full bg-brand-black border-editorial px-3.5 py-1.5 text-[10px] font-editorial font-bold text-brand-yellow hover:bg-brand-black/90 cursor-pointer shadow-editorial-sm"
                      >
                        <Send className="h-3.5 w-3.5" />
                        <span>Commit</span>
                      </button>
                    </motion.div>
                  </div>
                </div>
              </div>
            </section>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
