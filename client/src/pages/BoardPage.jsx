import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { DragDropContext, Draggable } from '@hello-pangea/dnd';
import Sidebar from '../components/Sidebar';
import KanbanColumn from '../components/KanbanColumn';
import TaskCard from '../components/TaskCard';
import TaskDetailPanel from '../components/TaskDetailPanel';
import CreateTaskInline from '../components/CreateTaskInline';
import Toast from '../components/Toast';
import { BoardSkeleton } from '../components/SkeletonScreens';
import EmptyState from '../components/EmptyState';
import {
  api,
  createTask,
  updateTask,
  deleteTask,
  reorderTask,
  createTaskComment,
  deleteTaskComment,
  fetchTaskComments,
  generateTaskDescription,
  suggestAssignee,
  updateTaskComment
} from '../services/api';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { Menu, Layout } from 'lucide-react';

export default function BoardPage() {
  const { workspaceId, boardId } = useParams();
  const { socket, joinWorkspace, joinBoard } = useSocket();
  const { user } = useAuth();

  const [workspace, setWorkspace] = useState(null);
  const [board, setBoard] = useState(null);
  const [columns, setColumns] = useState([]);
  const [members, setMembers] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [comments, setComments] = useState([]);
  const [toast, setToast] = useState('');
  const [loading, setLoading] = useState(true);
  const [inlineCreate, setInlineCreate] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Optimistic comment ID counter (negative IDs = temporary)
  const optimisticIdRef = useRef(-1);

  const currentMember = members.find((m) => String(m.user?.id) === String(user?.id));
  const boardContext = {
    boardName: board?.name || '',
    existingTaskTitles: columns.flatMap((c) => (c.tasks || []).map((t) => t.title))
  };
  const accentColor = board?.color || '#8B5CF6';

  // -------------------------------------------------------------------------
  // Initial data load
  // -------------------------------------------------------------------------
  useEffect(() => {
    let active = true;
    setLoading(true);

    async function load() {
      try {
        const [workspaceRes, boardRes, membersRes] = await Promise.all([
          api.get(`/api/v1/workspaces/${workspaceId}`),
          api.get(`/api/v1/workspaces/${workspaceId}/boards/${boardId}`),
          api.get(`/api/v1/workspaces/${workspaceId}/members`)
        ]);
        if (!active) return;
        setWorkspace(workspaceRes.data.workspace);
        setBoard(boardRes.data.board);
        setColumns(boardRes.data.columns || []);
        setMembers(membersRes.data.members || []);
      } catch (err) {
        console.error('Failed to load board:', err);
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [workspaceId, boardId]);

  // -------------------------------------------------------------------------
  // Load comments when task is selected
  // -------------------------------------------------------------------------
  useEffect(() => {
    let active = true;
    if (!selectedTask?.id) {
      setComments([]);
      return undefined;
    }

    fetchTaskComments(workspaceId, selectedTask.id)
      .then((res) => {
        if (active) setComments(res.data.comments || []);
      })
      .catch(() => {
        if (active) setComments([]);
      });

    return () => {
      active = false;
    };
  }, [workspaceId, selectedTask?.id]);

  // -------------------------------------------------------------------------
  // Socket.IO — join rooms + listen for real-time events
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!socket || !boardId || !workspaceId) return undefined;

    joinWorkspace(workspaceId);
    joinBoard(boardId);

    const addTask = ({ task, senderId }) => {
      if (senderId && String(senderId) === String(user?.id)) return;
      setColumns((cols) => {
        const exists = cols.some((c) =>
          (c.tasks || []).some((t) => String(t.id) === String(task.id))
        );
        if (exists) return cols;
        return cols.map((c) =>
          String(c.id) === String(task.columnId) ? { ...c, tasks: [task, ...(c.tasks || [])] } : c
        );
      });
      setToast('A teammate created a task');
    };

    const updateTaskSocket = ({ task, senderId }) => {
      if (senderId && String(senderId) === String(user?.id)) return;
      setColumns((cols) =>
        cols.map((c) => ({
          ...c,
          tasks: (c.tasks || []).map((t) => (String(t.id) === String(task.id) ? task : t))
        }))
      );
      setSelectedTask((cur) => (cur && String(cur.id) === String(task.id) ? task : cur));
      setToast('A teammate updated a task');
    };

    const deleteTaskSocket = ({ taskId: tid, senderId }) => {
      if (senderId && String(senderId) === String(user?.id)) return;
      setColumns((cols) =>
        cols.map((c) => ({
          ...c,
          tasks: (c.tasks || []).filter((t) => String(t.id) !== String(tid))
        }))
      );
      setToast('A teammate deleted a task');
    };

    const moveTask = ({ updatedTask, senderId }) => {
      if (senderId && String(senderId) === String(user?.id)) return;
      setColumns((cols) => {
        const without = cols.map((c) => ({
          ...c,
          tasks: (c.tasks || []).filter((t) => String(t.id) !== String(updatedTask.id))
        }));
        return without.map((c) => ({
          ...c,
          tasks:
            String(c.id) === String(updatedTask.columnId)
              ? [updatedTask, ...(c.tasks || [])]
              : c.tasks
        }));
      });
      setToast('A teammate moved a task');
    };

    const upsertComment = (comment) => {
      setComments((cur) => {
        // Replace optimistic (negative id) or existing comment
        const filtered = cur.filter(
          (item) =>
            String(item.id) !== String(comment.id) &&
            !(item._optimistic && item.content === comment.content)
        );
        return [...filtered, comment].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      });
    };

    const onCommentCreated = ({ comment }) => upsertComment(comment);
    const onCommentUpdated = ({ comment }) => upsertComment(comment);
    const onCommentDeleted = ({ commentId }) =>
      setComments((cur) => cur.filter((item) => String(item.id) !== String(commentId)));

    socket.on('task:created', addTask);
    socket.on('task:updated', updateTaskSocket);
    socket.on('task:deleted', deleteTaskSocket);
    socket.on('task:moved', moveTask);
    socket.on('comment:created', onCommentCreated);
    socket.on('comment:updated', onCommentUpdated);
    socket.on('comment:deleted', onCommentDeleted);

    return () => {
      socket.off('task:created', addTask);
      socket.off('task:updated', updateTaskSocket);
      socket.off('task:deleted', deleteTaskSocket);
      socket.off('task:moved', moveTask);
      socket.off('comment:created', onCommentCreated);
      socket.off('comment:updated', onCommentUpdated);
      socket.off('comment:deleted', onCommentDeleted);
    };
  }, [socket, workspaceId, boardId, user?.id, joinWorkspace, joinBoard]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(''), 5500);
    return () => clearTimeout(t);
  }, [toast]);

  // -------------------------------------------------------------------------
  // State helpers
  // -------------------------------------------------------------------------
  const updateTaskInState = useCallback((taskId, patch) => {
    setColumns((cols) =>
      cols.map((c) => ({
        ...c,
        tasks: (c.tasks || []).map((t) =>
          String(t.id) === String(taskId) ? { ...t, ...patch } : t
        )
      }))
    );
    setSelectedTask((cur) =>
      cur && String(cur.id) === String(taskId) ? { ...cur, ...patch } : cur
    );
  }, []);

  // -------------------------------------------------------------------------
  // Optimistic task creation
  // -------------------------------------------------------------------------
  const handleCreateTask = useCallback(
    async (columnId, title) => {
      if (!title) return;

      // Optimistic insert
      const tempId = `opt_${Date.now()}`;
      const optimisticTask = {
        id: tempId,
        _optimistic: true,
        columnId,
        boardId,
        workspaceId,
        title,
        description: '',
        priority: 'medium',
        labels: [],
        dueDate: null,
        assigneeId: null,
        assignee: null,
        createdAt: new Date().toISOString(),
        order: 9999
      };
      setColumns((cols) =>
        cols.map((c) =>
          String(c.id) === String(columnId)
            ? { ...c, tasks: [optimisticTask, ...(c.tasks || [])] }
            : c
        )
      );
      setInlineCreate(null);

      try {
        const res = await createTask(workspaceId, boardId, { title, columnId });
        const realTask = res.data.task;
        // Replace optimistic with real
        setColumns((cols) =>
          cols.map((c) => ({
            ...c,
            tasks: (c.tasks || []).map((t) => (t.id === tempId ? realTask : t))
          }))
        );
      } catch {
        // Roll back
        setColumns((cols) =>
          cols.map((c) => ({ ...c, tasks: (c.tasks || []).filter((t) => t.id !== tempId) }))
        );
        setToast('Failed to create task');
      }
    },
    [workspaceId, boardId]
  );

  const handleTaskChange = useCallback(
    async (taskId, patch) => {
      // Optimistic update
      updateTaskInState(taskId, patch);
      try {
        const res = await updateTask(workspaceId, boardId, taskId, patch);
        updateTaskInState(taskId, res.data.task);
      } catch {
        setToast('Failed to update task');
      }
    },
    [workspaceId, boardId, updateTaskInState]
  );

  const handleDeleteTask = useCallback(
    async (taskId) => {
      setSelectedTask(null);
      setComments([]);
      setColumns((cols) =>
        cols.map((c) => ({
          ...c,
          tasks: (c.tasks || []).filter((t) => String(t.id) !== String(taskId))
        }))
      );
      try {
        await deleteTask(workspaceId, boardId, taskId);
      } catch {
        setToast('Failed to delete task');
      }
    },
    [workspaceId, boardId]
  );

  // -------------------------------------------------------------------------
  // Optimistic comment creation
  // -------------------------------------------------------------------------
  const handleCreateComment = useCallback(
    async (content) => {
      if (!selectedTask) return;

      const tempId = optimisticIdRef.current--;
      const optimisticComment = {
        id: tempId,
        _optimistic: true,
        taskId: selectedTask.id,
        workspaceId,
        content,
        authorId: { id: user?.id, name: user?.name, email: user?.email },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      setComments((cur) => [...cur, optimisticComment]);

      try {
        const res = await createTaskComment(workspaceId, selectedTask.id, { content });
        const real = res.data.comment;
        setComments((cur) =>
          cur
            .map((c) => (c.id === tempId ? real : c))
            .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
        );
      } catch {
        setComments((cur) => cur.filter((c) => c.id !== tempId));
        setToast('Failed to post comment');
      }
    },
    [selectedTask, workspaceId, user]
  );

  const handleUpdateComment = useCallback(
    async (commentId, content) => {
      if (!selectedTask) return;
      const res = await updateTaskComment(workspaceId, selectedTask.id, commentId, { content });
      const next = res.data.comment;
      setComments((cur) => cur.map((c) => (String(c.id) === String(next.id) ? next : c)));
    },
    [selectedTask, workspaceId]
  );

  const handleDeleteComment = useCallback(
    async (commentId) => {
      if (!selectedTask) return;
      await deleteTaskComment(workspaceId, selectedTask.id, commentId);
      setComments((cur) => cur.filter((c) => String(c.id) !== String(commentId)));
    },
    [selectedTask, workspaceId]
  );

  // -------------------------------------------------------------------------
  // AI helpers
  // -------------------------------------------------------------------------
  const handleSuggestDescription = useCallback(async () => {
    if (!selectedTask) return '';
    const res = await generateTaskDescription(workspaceId, {
      taskTitle: selectedTask.title,
      boardId
    });
    return res.data.description || '';
  }, [selectedTask, workspaceId, boardId]);

  const handleSuggestAssignee = useCallback(async () => {
    if (!selectedTask) return null;
    const res = await suggestAssignee(workspaceId, { taskId: selectedTask.id });
    return res.data.suggestion || null;
  }, [selectedTask, workspaceId]);

  // -------------------------------------------------------------------------
  // Optimistic drag-and-drop reorder
  // -------------------------------------------------------------------------
  const handleDragEnd = useCallback(
    async (result) => {
      const { destination, draggableId, source } = result;
      if (!destination) return;

      const fromColumnId = source.droppableId;
      const toColumnId = destination.droppableId;
      const newOrder = destination.index + 1;
      if (fromColumnId === toColumnId && source.index === destination.index) return;

      // Optimistic state update
      setColumns((current) => {
        const next = current.map((c) => ({ ...c, tasks: [...(c.tasks || [])] }));
        const from = next.find((c) => String(c.id) === String(fromColumnId));
        const to = next.find((c) => String(c.id) === String(toColumnId));
        if (!from || !to) return current;
        const [moved] = from.tasks.splice(source.index, 1);
        moved.columnId = toColumnId;
        to.tasks.splice(destination.index, 0, moved);
        to.tasks = to.tasks.map((t, i) => ({ ...t, order: i + 1 }));
        from.tasks = from.tasks.map((t, i) => ({ ...t, order: i + 1 }));
        return next;
      });

      try {
        await reorderTask(workspaceId, boardId, {
          taskId: draggableId,
          fromColumnId,
          toColumnId,
          newOrder
        });
      } catch {
        setToast('Failed to reorder — refreshing…');
        // Re-fetch authoritative board state on failure
        try {
          const res = await api.get(`/api/v1/workspaces/${workspaceId}/boards/${boardId}`);
          setColumns(res.data.columns || []);
        } catch {
          /* ignore */
        }
      }
    },
    [workspaceId, boardId]
  );

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="min-h-screen bg-brand-offwhite dot-grid relative">
        <Sidebar
          workspace={workspace}
          workspaceId={workspaceId}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />
        <main className="flex-1 p-6 md:ml-[260px] md:p-10">
          <BoardSkeleton />
        </main>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-brand-offwhite text-brand-black relative dot-grid flex font-sans">
      <Sidebar
        workspace={workspace}
        workspaceId={workspaceId}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <main className="flex flex-1 flex-col h-screen overflow-hidden p-6 md:ml-[260px] md:p-10 animate-fade-in min-w-0">
        {/* Header */}
        <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4 min-w-0">
            <button
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              className="rounded-xl border-editorial bg-white p-3 text-brand-black md:hidden hover:bg-brand-beige transition-all shadow-editorial-sm shrink-0"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <span
                  className="h-3.5 w-3.5 rounded-full shrink-0 border border-brand-black/20"
                  style={{ backgroundColor: accentColor }}
                />
                <h1 className="truncate font-editorial text-4xl sm:text-5xl font-black text-brand-black leading-none uppercase">
                  {board?.name}
                </h1>
              </div>
              <p className="mt-2.5 truncate text-xs font-sans-editorial font-bold text-brand-black/45">
                {board?.description || 'Active sprint canvas.'}
              </p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-black/10 bg-white px-4 py-2.5 text-[10px] font-editorial font-bold uppercase tracking-widest text-brand-black shadow-editorial-sm">
              <Layout className="h-3.5 w-3.5 text-brand-purple" />
              <span>Sprint Canvas</span>
            </span>
          </div>
        </div>

        {/* Kanban Board */}
        {columns.length === 0 ? (
          <EmptyState variant="boards" />
        ) : (
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="flex flex-1 gap-6 overflow-x-auto pb-6 scrollbar-elegant items-start min-h-0">
              {columns.map((column) => (
                <KanbanColumn
                  key={column.id}
                  column={column}
                  onAddTask={() => setInlineCreate(column.id)}
                  isCreatingTask={inlineCreate === column.id}
                >
                  {inlineCreate === column.id && (
                    <CreateTaskInline
                      onSave={(title) => handleCreateTask(column.id, title)}
                      onCancel={() => setInlineCreate(null)}
                    />
                  )}
                  {(column.tasks || []).map((task, index) => (
                    <Draggable key={task.id} draggableId={String(task.id)} index={index}>
                      {(provided, snapshot) => (
                        <TaskCard
                          task={task}
                          provided={provided}
                          snapshot={snapshot}
                          onClick={() => setSelectedTask(task)}
                        />
                      )}
                    </Draggable>
                  ))}
                </KanbanColumn>
              ))}
            </div>
          </DragDropContext>
        )}
      </main>

      <TaskDetailPanel
        task={selectedTask}
        columns={columns}
        members={members}
        comments={comments}
        currentUser={user}
        currentMemberRole={currentMember?.role}
        boardContext={boardContext}
        onClose={() => setSelectedTask(null)}
        onChange={(patch) => selectedTask && handleTaskChange(selectedTask.id, patch)}
        onDelete={() => selectedTask && handleDeleteTask(selectedTask.id)}
        onCreateComment={handleCreateComment}
        onUpdateComment={handleUpdateComment}
        onDeleteComment={handleDeleteComment}
        onSuggestDescription={handleSuggestDescription}
        onSuggestAssignee={handleSuggestAssignee}
      />
      <Toast message={toast} />
    </div>
  );
}
