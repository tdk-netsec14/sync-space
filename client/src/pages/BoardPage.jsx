import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { DragDropContext, Draggable } from '@hello-pangea/dnd';
import Sidebar from '../components/Sidebar';
import KanbanColumn from '../components/KanbanColumn';
import TaskCard from '../components/TaskCard';
import TaskDetailPanel from '../components/TaskDetailPanel';
import CreateTaskInline from '../components/CreateTaskInline';
import Toast from '../components/Toast';
import LoadingSkeleton from '../components/LoadingSkeleton';
import { api, createTaskComment, deleteTaskComment, fetchTaskComments, generateTaskDescription, suggestAssignee, updateTaskComment } from '../services/api';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { Menu, Layout } from 'lucide-react';
import { motion } from 'framer-motion';

export default function BoardPage() {
  const { workspaceId, boardId } = useParams();
  const socket = useSocket();
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
  const currentMember = members.find((member) => String(member.user?.id) === String(user?.id));
  const boardContext = {
    boardName: board?.name || '',
    existingTaskTitles: columns.flatMap((column) => (column.tasks || []).map((task) => task.title))
  };

  const accentColor = board?.color || '#8B5CF6';

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const [workspaceResponse, boardResponse, membersResponse] = await Promise.all([
          api.get(`/api/workspaces/${workspaceId}`),
          api.get(`/api/workspaces/${workspaceId}/boards/${boardId}`),
          api.get(`/api/workspaces/${workspaceId}/members`)
        ]);

        if (!active) return;
        setWorkspace(workspaceResponse.data.workspace);
        setBoard(boardResponse.data.board);
        setColumns(boardResponse.data.columns || []);
        setMembers(membersResponse.data.members || []);
      } catch (err) {
        console.error("Failed to load Board Page data bundle:", err);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [workspaceId, boardId]);

  useEffect(() => {
    let active = true;

    async function loadComments() {
      if (!selectedTask?.id) {
        setComments([]);
        return;
      }

      try {
        const response = await fetchTaskComments(workspaceId, selectedTask.id);
        if (active) {
          setComments(response.data.comments || []);
        }
      } catch (error) {
        if (active) {
          setComments([]);
        }
      }
    }

    loadComments();

    return () => {
      active = false;
    };
  }, [workspaceId, selectedTask?.id]);

  useEffect(() => {
    if (!socket || !boardId || !workspaceId) {
      return undefined;
    }

    socket.emit('join:workspace', workspaceId);
    socket.emit('join:board', boardId);

    const onCreated = ({ task, senderId }) => {
      if (senderId && String(senderId) === String(user?.id)) return;
      setColumns((current) => {
        const exists = current.some((col) => (col.tasks || []).some((t) => String(t.id) === String(task.id)));
        if (exists) return current;
        return current.map((column) => (String(column.id) === String(task.columnId) ? { ...column, tasks: [task, ...(column.tasks || [])] } : column));
      });
      setToast('A teammate created a task');
    };

    const onUpdated = ({ task, senderId }) => {
      if (senderId && String(senderId) === String(user?.id)) return;
      setColumns((current) => current.map((column) => ({ ...column, tasks: (column.tasks || []).map((item) => (String(item.id) === String(task.id) ? task : item)) })));
      setSelectedTask((current) => (current && String(current.id) === String(task.id) ? task : current));
      setToast('A teammate updated a task');
    };

    const onDeleted = ({ taskId: deletedTaskId, senderId }) => {
      if (senderId && String(senderId) === String(user?.id)) return;
      setColumns((current) => current.map((column) => ({ ...column, tasks: (column.tasks || []).filter((item) => String(item.id) !== String(deletedTaskId)) })));
      setToast('A teammate deleted a task');
    };

    const onMoved = ({ updatedTask, senderId }) => {
      if (senderId && String(senderId) === String(user?.id)) return;
      setColumns((current) => {
        const without = current.map((column) => ({ ...column, tasks: (column.tasks || []).filter((item) => String(item.id) !== String(updatedTask.id)) }));
        return without.map((column) => ({
          ...column,
          tasks: String(column.id) === String(updatedTask.columnId) ? [updatedTask, ...(column.tasks || [])] : column.tasks
        }));
      });
      setToast('A teammate moved a task');
    };

    socket.on('task:created', onCreated);
    socket.on('task:updated', onUpdated);
    socket.on('task:deleted', onDeleted);
    socket.on('task:moved', onMoved);

    const upsertComment = (comment) => {
      if (!selectedTask || String(comment.taskId) !== String(selectedTask.id)) {
        return;
      }

      setComments((current) => {
        const filtered = current.filter((item) => String(item.id) !== String(comment.id));
        return [...filtered, comment].sort((left, right) => new Date(left.createdAt) - new Date(right.createdAt));
      });
    };

    const onCommentCreated = ({ comment }) => upsertComment(comment);
    const onCommentUpdated = ({ comment }) => upsertComment(comment);
    const onCommentDeleted = ({ commentId }) => {
      setComments((current) => current.filter((item) => String(item.id) !== String(commentId)));
    };

    socket.on('comment:created', onCommentCreated);
    socket.on('comment:updated', onCommentUpdated);
    socket.on('comment:deleted', onCommentDeleted);

    return () => {
      socket.off('task:created', onCreated);
      socket.off('task:updated', onUpdated);
      socket.off('task:deleted', onDeleted);
      socket.off('task:moved', onMoved);
      socket.off('comment:created', onCommentCreated);
      socket.off('comment:updated', onCommentUpdated);
      socket.off('comment:deleted', onCommentDeleted);
    };
  }, [socket, workspaceId, boardId, selectedTask?.id, user?.id]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => {
      setToast('');
    }, 5500);
    return () => clearTimeout(timer);
  }, [toast]);

  function updateTaskInState(taskId, patch) {
    setColumns((current) => current.map((column) => ({
      ...column,
      tasks: (column.tasks || []).map((task) => (String(task.id) === String(taskId) ? { ...task, ...patch } : task))
    })));
    if (selectedTask && String(selectedTask.id) === String(taskId)) {
      setSelectedTask((current) => ({ ...current, ...patch }));
    }
  }

  async function handleCreateTask(columnId, title) {
    if (!title) return;
    const response = await api.post(`/api/workspaces/${workspaceId}/boards/${boardId}/tasks`, { title, columnId });
    setColumns((current) => current.map((column) => {
      if (String(column.id) !== String(columnId)) return column;
      const exists = (column.tasks || []).some((t) => String(t.id) === String(response.data.task.id));
      if (exists) return column;
      return { ...column, tasks: [response.data.task, ...(column.tasks || [])] };
    }));
    setInlineCreate(null);
  }

  async function handleTaskChange(taskId, patch) {
    updateTaskInState(taskId, patch);
    const response = await api.patch(`/api/workspaces/${workspaceId}/boards/${boardId}/tasks/${taskId}`, patch);
    updateTaskInState(taskId, response.data.task);
  }

  async function handleDeleteTask(taskId) {
    await api.delete(`/api/workspaces/${workspaceId}/boards/${boardId}/tasks/${taskId}`);
    setSelectedTask(null);
    setComments([]);
    setColumns((current) => current.map((column) => ({ ...column, tasks: (column.tasks || []).filter((task) => String(task.id) !== String(taskId)) })));
  }

  async function handleCreateComment(content) {
    if (!selectedTask) return;
    const response = await createTaskComment(workspaceId, selectedTask.id, { content });
    const nextComment = response.data.comment;
    setComments((current) => {
      const filtered = current.filter((item) => String(item.id) !== String(nextComment.id));
      return [...filtered, nextComment].sort((left, right) => new Date(left.createdAt) - new Date(right.createdAt));
    });
  }

  async function handleUpdateComment(commentId, content) {
    if (!selectedTask) return;
    const response = await updateTaskComment(workspaceId, selectedTask.id, commentId, { content });
    const nextComment = response.data.comment;
    setComments((current) => current.map((item) => (String(item.id) === String(nextComment.id) ? nextComment : item)));
  }

  async function handleDeleteComment(commentId) {
    if (!selectedTask) return;
    await deleteTaskComment(workspaceId, selectedTask.id, commentId);
    setComments((current) => current.filter((item) => String(item.id) !== String(commentId)));
  }

  async function handleSuggestDescription() {
    if (!selectedTask) return '';
    const response = await generateTaskDescription(workspaceId, {
      taskTitle: selectedTask.title,
      boardId
    });
    return response.data.description || '';
  }

  async function handleSuggestAssignee() {
    if (!selectedTask) return null;
    const response = await suggestAssignee(workspaceId, {
      taskId: selectedTask.id
    });
    return response.data.suggestion || null;
  }

  async function handleDragEnd(result) {
    const { destination, draggableId, source } = result;
    if (!destination) return;

    const fromColumnId = source.droppableId;
    const toColumnId = destination.droppableId;
    const newOrder = destination.index + 1;
    if (fromColumnId === toColumnId && source.index === destination.index) return;

    setColumns((current) => {
      const next = current.map((column) => ({ ...column, tasks: [...(column.tasks || [])] }));
      const fromColumn = next.find((column) => String(column.id) === String(fromColumnId));
      const toColumn = next.find((column) => String(column.id) === String(toColumnId));
      if (!fromColumn || !toColumn) return current;

      const [moved] = fromColumn.tasks.splice(source.index, 1);
      moved.columnId = toColumnId;
      toColumn.tasks.splice(destination.index, 0, moved);
      toColumn.tasks = toColumn.tasks.map((task, index) => ({ ...task, order: index + 1 }));
      fromColumn.tasks = fromColumn.tasks.map((task, index) => ({ ...task, order: index + 1 }));
      return next;
    });

    await api.patch(`/api/workspaces/${workspaceId}/boards/${boardId}/tasks/reorder`, {
      taskId: draggableId,
      fromColumnId,
      toColumnId,
      newOrder
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-offwhite dot-grid relative">
        <Sidebar workspace={workspace} workspaceId={workspaceId} isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        <main className="flex-1 p-6 md:ml-[260px] md:p-10">
          <LoadingSkeleton />
        </main>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-brand-offwhite text-brand-black relative dot-grid flex font-sans">
      
      {/* Sidebar Command Console */}
      <Sidebar workspace={workspace} workspaceId={workspaceId} isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      
      {/* Board Layout Deck */}
      <main className="flex flex-1 flex-col h-screen overflow-hidden p-6 md:ml-[260px] md:p-10 animate-fade-in min-w-0">
        
        {/* Sprint Header Dashboard Banner */}
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
                <span className="h-3.5 w-3.5 rounded-full shrink-0 border border-brand-black/20" style={{ backgroundColor: accentColor }} />
                <h1 className="truncate font-editorial text-4xl sm:text-5xl font-black text-brand-black leading-none uppercase">
                  {board?.name}
                </h1>
              </div>
              <p className="mt-2.5 truncate text-xs font-sans-editorial font-bold text-brand-black/45">
                {board?.description || 'Active sprint canvas tracks.'}
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

        {/* Kanban Board Columns Horizontal Slider */}
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex flex-1 gap-6 overflow-x-auto pb-6 scrollbar-elegant items-start min-h-0">
            {columns.map((column) => (
              <KanbanColumn
                key={column.id}
                column={column}
                onAddTask={() => setInlineCreate(column.id)}
                isCreatingTask={inlineCreate === column.id}
              >
                {inlineCreate === column.id ? (
                  <CreateTaskInline 
                    onSave={(title) => handleCreateTask(column.id, title)} 
                    onCancel={() => setInlineCreate(null)} 
                  />
                ) : null}
                
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
      </main>

      {/* Task Detail Slide-over Sheet Panel */}
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