import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Menu,
  ShieldAlert,
  Users,
  Trash2,
  LogOut,
  Settings,
  Terminal,
  BarChart2,
  Briefcase,
  Timer,
  Palette,
  Smile,
  Search,
  Link,
  Copy,
  Check,
  Loader2
} from 'lucide-react';
import Sidebar from '../components/Sidebar';
import {
  deleteWorkspace,
  fetchMembers,
  getWorkspace,
  removeMember,
  updateMemberRole,
  updateWorkspace,
  leaveWorkspace,
  createInvite
} from '../services/api';
import { useWorkspace } from '../context/WorkspaceContext';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import useDebounce from '../hooks/useDebounce';

const emojis = ['💻', '🎨', '📊', '💼', '👥', '⏱️'];

const emojiMap = {
  '💻': Terminal,
  '🎨': Palette,
  '📊': BarChart2,
  '💼': Briefcase,
  '👥': Users,
  '⏱️': Timer
};

export default function WorkspaceSettings() {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const { currentWorkspace, setCurrentWorkspace, reloadWorkspaces } = useWorkspace();
  const { user } = useAuth();
  const [workspace, setWorkspace] = useState(currentWorkspace);
  const [members, setMembers] = useState([]);
  const [tab, setTab] = useState('general');
  const [form, setForm] = useState({ name: '', description: '', logo: 'S', color: '#8B5CF6' });
  const [isLoading, setIsLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const debouncedSearch = useDebounce(memberSearch, 300);

  const [inviteRole, setInviteRole] = useState('member');
  const [inviteLink, setInviteLink] = useState('');
  const [isGeneratingInvite, setIsGeneratingInvite] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const [workspaceResponse, membersResponse] = await Promise.all([
          getWorkspace(workspaceId),
          fetchMembers(workspaceId)
        ]);
        if (!active) return;
        setWorkspace(workspaceResponse.data.workspace);
        setCurrentWorkspace(workspaceResponse.data.workspace);
        setMembers(membersResponse.data.members || []);
        setForm({
          name: workspaceResponse.data.workspace.name,
          description: workspaceResponse.data.workspace.description || '',
          logo: workspaceResponse.data.workspace.logo || 'S',
          color: workspaceResponse.data.workspace.color || '#8B5CF6'
        });
      } catch (error) {
        navigate(`/workspace/${workspaceId}`);
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [workspaceId, navigate, setCurrentWorkspace]);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSave(event) {
    event.preventDefault();
    const response = await updateWorkspace(workspaceId, form);
    setWorkspace(response.data.workspace);
    setCurrentWorkspace(response.data.workspace);
  }

  async function handleRoleChange(userId, role) {
    const response = await updateMemberRole(workspaceId, userId, { role });
    setMembers((current) =>
      current.map((member) =>
        member.user?.id === userId ? { ...member, role: response.data.member.role } : member
      )
    );
  }

  async function handleRemove(userId) {
    await removeMember(workspaceId, userId);
    setMembers((current) => current.filter((member) => member.user?.id !== userId));
  }

  async function confirmDeleteWorkspace() {
    await deleteWorkspace(workspaceId);
    const updatedList = await reloadWorkspaces();
    if (updatedList && updatedList.length > 0) {
      const nextWorkspace = updatedList[0];
      setCurrentWorkspace(nextWorkspace);
      navigate(`/workspace/${nextWorkspace.id}`);
    } else {
      setCurrentWorkspace(null);
      navigate('/workspace/new');
    }
  }

  async function confirmLeaveWorkspace() {
    await leaveWorkspace(workspaceId);
    const updatedList = await reloadWorkspaces();
    if (updatedList && updatedList.length > 0) {
      const nextWorkspace = updatedList[0];
      setCurrentWorkspace(nextWorkspace);
      navigate(`/workspace/${nextWorkspace.id}`);
    } else {
      setCurrentWorkspace(null);
      navigate('/workspace/new');
    }
  }

  async function handleGenerateInvite() {
    if (isGeneratingInvite) return;
    setIsGeneratingInvite(true);
    setInviteLink('');
    setCopied(false);
    try {
      const response = await createInvite(workspaceId, { role: inviteRole });
      setInviteLink(response.data.inviteUrl);
    } catch (err) {
      console.error('Failed to generate invite:', err);
    } finally {
      setIsGeneratingInvite(false);
    }
  }

  function handleCopyInvite() {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }


  // Compare as strings — member.user.id comes from MongoDB (ObjectId) and user.id from JWT
  const currentMember = members.find(
    (member) => String(member.user?._id || member.user?.id) === String(user?.id)
  );
  const canManage = currentMember && ['owner', 'admin'].includes(currentMember.role);

  const filteredMembers = debouncedSearch.trim()
    ? members.filter(
        (m) =>
          m.user?.name?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
          m.user?.email?.toLowerCase().includes(debouncedSearch.toLowerCase())
      )
    : members;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-brand-offwhite relative flex">
        <Sidebar
          workspace={workspace}
          workspaceId={workspaceId}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />
        <main className="flex flex-1 items-center justify-center p-6 text-brand-black/55 md:ml-[260px] font-editorial font-bold uppercase tracking-widest">
          Loading settings...
        </main>
      </div>
    );
  }

  if (!isLoading && !canManage) {
    return (
      <div className="min-h-screen bg-brand-offwhite relative flex">
        <Sidebar
          workspace={workspace}
          workspaceId={workspaceId}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />
        <main className="flex flex-1 items-center justify-center p-6 text-rose-700 md:ml-[260px] font-editorial font-bold uppercase tracking-widest">
          You do not have access to workspace settings.
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

      {/* Settings Console Panel */}
      <main className="flex-1 p-6 md:ml-[260px] md:p-10 max-w-5xl mx-auto w-full transition-all">
        {/* Editorial Header */}
        <div className="mb-8 flex items-start gap-4">
          <button
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            className="rounded-xl border-editorial bg-white p-3 text-brand-black md:hidden hover:bg-brand-beige transition-all shadow-editorial-sm shrink-0"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div>
            <span className="text-[9px] font-black uppercase tracking-widest text-brand-black/45 block font-sans-editorial">
              Control Console
            </span>
            <h1 className="font-editorial text-3xl sm:text-4xl font-black text-brand-black leading-none uppercase mt-1">
              Workspace settings
            </h1>
            <p className="mt-2 text-xs font-sans-editorial font-bold text-brand-black/45 leading-relaxed">
              Manage workspace details, configuration models, operators, and permissions.
            </p>
          </div>
        </div>

        {/* Tab Selectors */}
        <div className="mb-8 flex gap-3 flex-wrap">
          {['general', 'members', 'danger'].map((item) => (
            <motion.div key={item} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <button
                type="button"
                onClick={() => setTab(item)}
                className={`rounded-full border-editorial px-5 py-2.5 text-xs font-editorial font-bold uppercase tracking-widest cursor-pointer transition-all ${
                  tab === item
                    ? 'bg-brand-black text-brand-yellow shadow-editorial-sm'
                    : 'bg-white text-brand-black hover:bg-brand-beige shadow-sm'
                }`}
              >
                {item === 'general' ? 'General' : item === 'members' ? 'Members' : 'Danger Zone'}
              </button>
            </motion.div>
          ))}
        </div>

        {/* Tab content panels */}
        {tab === 'general' && (
          <form
            onSubmit={handleSave}
            className="max-w-2xl border-editorial bg-white p-6 sm:p-8 shadow-editorial rounded-3xl relative overflow-hidden flex flex-col"
          >
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-brand-yellow" />
            <h2 className="font-editorial text-sm font-bold text-brand-black border-b border-brand-black/10 pb-3 mb-5 uppercase tracking-widest flex items-center gap-2">
              <Settings className="h-4.5 w-4.5 text-brand-purple" />
              <span>General parameters</span>
            </h2>

            <div className="space-y-4 mb-6">
              <label className="block">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-brand-black/65 font-sans-editorial">
                  Workspace Name
                </span>
                <input
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  className="w-full rounded-2xl border border-brand-black bg-brand-offwhite px-4 py-3.5 text-xs font-bold text-brand-black outline-none transition focus:shadow-editorial-sm font-sans-editorial"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-brand-black/65 font-sans-editorial">
                  Description
                </span>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  rows="4"
                  className="w-full rounded-2xl border border-brand-black bg-brand-offwhite px-4 py-3.5 text-xs font-bold text-brand-black outline-none transition focus:shadow-editorial-sm font-sans-editorial resize-none"
                />
              </label>

              {/* Upgraded Logo preset system */}
              <div className="mb-4">
                <span className="mb-2.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-brand-black/65 font-sans-editorial">
                  <Smile className="h-3.5 w-3.5 text-brand-purple shrink-0" />
                  <span>Workspace Logo Identity</span>
                </span>
                <div className="grid grid-cols-6 gap-2.5">
                  {emojis.map((emoji) => {
                    const VectorIcon = emojiMap[emoji];
                    return (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setForm((current) => ({ ...current, logo: emoji }))}
                        className={`btn-active-scale rounded-2xl border py-3 flex items-center justify-center transition-all duration-200 cursor-pointer ${
                          form.logo === emoji
                            ? 'border-brand-black bg-brand-yellow shadow-editorial-sm scale-105'
                            : 'border-brand-black/10 bg-white hover:border-brand-black hover:bg-brand-beige'
                        }`}
                      >
                        {VectorIcon ? (
                          <VectorIcon
                            className={`h-4.5 w-4.5 transition-colors ${form.logo === emoji ? 'text-brand-black' : 'text-brand-black/40'}`}
                          />
                        ) : (
                          <span className="text-base">{emoji}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Upgraded Accent Color preset system */}
              <div className="mb-4">
                <span className="mb-2.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-brand-black/65 font-sans-editorial">
                  <Palette className="h-3.5 w-3.5 text-brand-purple shrink-0" />
                  <span>Accent color</span>
                </span>
                <div className="grid grid-cols-6 gap-2.5">
                  {['#8B5CF6', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#DCC7FF'].map(
                    (color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setForm((current) => ({ ...current, color }))}
                        className="btn-active-scale flex h-10 w-full items-center justify-center rounded-xl cursor-pointer transition-transform hover:scale-105 border border-brand-black/10"
                        style={{ backgroundColor: color }}
                      >
                        {form.color === color && (
                          <span className="h-2 w-2 rounded-full bg-white shadow-sm ring-1 ring-brand-black/10" />
                        )}
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>

            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="self-start"
            >
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-black border-editorial px-6 py-3.5 text-xs font-editorial font-bold text-brand-yellow hover:bg-brand-black/90 cursor-pointer shadow-editorial-sm transition-all uppercase tracking-widest"
              >
                Save General Details
              </button>
            </motion.div>
          </form>
        )}

        {tab === 'members' && (
          <section className="max-w-3xl border-editorial bg-white p-6 sm:p-8 shadow-editorial rounded-3xl relative overflow-hidden flex flex-col">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-brand-purple" />
            
            {/* Invite Section (Only visible to admins/owners) */}
            {canManage && (
              <div className="mb-8 border-b border-brand-black/10 pb-8">
                <h2 className="font-editorial text-sm font-bold text-brand-black uppercase tracking-widest flex items-center gap-2 mb-4">
                  <Link className="h-4.5 w-4.5 text-brand-purple" />
                  <span>Invite Operator</span>
                </h2>
                
                <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 bg-brand-offwhite p-4 rounded-2xl border border-brand-black/10">
                  <div className="flex-1">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-black/65 font-sans-editorial mb-1.5">
                      Role Access Level
                    </label>
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value)}
                      className="w-full rounded-xl border border-brand-black/15 bg-white px-3 py-2.5 text-xs font-bold text-brand-black outline-none transition focus:border-brand-black focus:shadow-editorial-sm cursor-pointer"
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  
                  <button
                    type="button"
                    onClick={handleGenerateInvite}
                    disabled={isGeneratingInvite}
                    className="shrink-0 inline-flex h-[42px] items-center justify-center gap-2 rounded-xl bg-brand-black border-editorial px-5 text-[10px] font-editorial font-bold text-brand-yellow hover:bg-brand-black/90 cursor-pointer shadow-editorial-sm transition-all uppercase tracking-widest disabled:opacity-70"
                  >
                    {isGeneratingInvite ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Link className="h-3.5 w-3.5" />
                    )}
                    <span>Generate Link</span>
                  </button>
                </div>

                {/* Invite Link Result */}
                {inviteLink && (
                  <motion.div 
                    initial={{ opacity: 0, y: -5 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    className="mt-3 flex items-center gap-2 rounded-xl border border-brand-purple/30 bg-brand-lavender/10 p-2 pl-4"
                  >
                    <span className="flex-1 truncate text-xs font-sans-editorial font-bold text-brand-purple">
                      {inviteLink}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyInvite}
                      className="shrink-0 flex h-8 items-center gap-1.5 rounded-lg bg-white px-3 text-[10px] font-black uppercase tracking-widest text-brand-purple hover:bg-brand-purple hover:text-white transition-colors border border-brand-purple/20 shadow-sm"
                    >
                      {copied ? (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </motion.div>
                )}
              </div>
            )}

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-brand-black/10 pb-4 mb-5">
              <h2 className="font-editorial text-sm font-bold text-brand-black uppercase tracking-widest flex items-center gap-2">
                <Users className="h-4.5 w-4.5 text-brand-purple" />
                <span>Workspace operators</span>
              </h2>
              <div className="relative max-w-xs w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-brand-black/35 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search members…"
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  className="w-full rounded-xl border border-brand-black/15 bg-brand-offwhite pl-8 pr-3 py-2 text-[11px] font-bold text-brand-black outline-none transition focus:border-brand-black focus:shadow-editorial-sm placeholder:text-brand-black/30"
                />
              </div>
            </div>

            <div className="space-y-4">
              {filteredMembers.length === 0 && (
                <p className="text-center text-xs font-bold text-brand-black/35 py-6 uppercase tracking-widest">
                  No members match &ldquo;{debouncedSearch}&rdquo;
                </p>
              )}
              {filteredMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-brand-black/10 px-4 py-3.5 bg-brand-offwhite hover:bg-white hover:border-brand-black hover:shadow-editorial-sm transition-all duration-300"
                >
                  <div className="min-w-0">
                    <p className="font-editorial text-xs font-bold uppercase tracking-wider text-brand-black truncate">
                      {member.user?.name}
                    </p>
                    <p className="text-[11px] text-brand-black/45 font-sans-editorial font-bold truncate mt-0.5">
                      {member.user?.email}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 shrink-0">
                    <select
                      value={member.role}
                      onChange={(event) => handleRoleChange(member.user?.id, event.target.value)}
                      disabled={member.role === 'owner'}
                      className="rounded-xl border border-brand-black bg-white px-3 py-2 text-[10px] font-sans-editorial font-bold text-brand-black outline-none transition focus:shadow-editorial-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="owner">owner</option>
                      <option value="admin">admin</option>
                      <option value="member">member</option>
                    </select>

                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <button
                        type="button"
                        onClick={() => handleRemove(member.user?.id)}
                        disabled={member.role === 'owner'}
                        className="rounded-full border border-brand-black/10 px-4 py-2 text-[9px] font-editorial font-bold uppercase tracking-widest text-brand-black hover:border-brand-black hover:bg-brand-beige transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Remove
                      </button>
                    </motion.div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {tab === 'danger' && (
          <section className="max-w-2xl border-editorial bg-white p-6 sm:p-8 shadow-editorial rounded-3xl relative overflow-hidden flex flex-col">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-rose-500" />

            <div className="flex items-center gap-2 text-rose-700 border-b border-brand-black/10 pb-3 mb-5">
              <ShieldAlert className="h-5 w-5 animate-bounce shrink-0" />
              <h2 className="font-editorial text-base font-bold uppercase tracking-wider">
                Danger Zone
              </h2>
            </div>

            <p className="text-xs font-sans-editorial font-bold text-brand-black/50 leading-relaxed">
              These operations are destructive. Revoking permissions or deleting the active
              workspace will wipe all Sprint Tracks, boards, tasks, and history permanently.
            </p>

            <div className="mt-6 flex flex-wrap gap-4">
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <button
                  type="button"
                  onClick={() => setShowLeaveConfirm(true)}
                  className="rounded-full border border-brand-black/15 bg-white hover:bg-brand-beige text-xs font-editorial font-bold uppercase tracking-widest px-5 py-3 cursor-pointer inline-flex items-center gap-2 text-brand-black"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Leave Workspace</span>
                </button>
              </motion.div>

              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="rounded-full bg-rose-600 border-editorial px-5 py-3 text-xs font-editorial font-bold uppercase tracking-widest text-white hover:bg-rose-700 cursor-pointer shadow-editorial-sm inline-flex items-center gap-2"
                >
                  <Trash2 className="h-4 w-4 text-white" />
                  <span>Delete Workspace</span>
                </button>
              </motion.div>
            </div>
          </section>
        )}
      </main>
      {/* Confirmation Modals */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-brand-black/60 backdrop-blur-md"
              onClick={() => setShowDeleteConfirm(false)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              transition={{ type: 'spring', duration: 0.4 }}
              className="relative w-full max-w-md overflow-hidden rounded-3xl border-editorial bg-white p-6 sm:p-8 shadow-editorial z-10 flex flex-col"
            >
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-rose-600" />
              <div className="flex items-center gap-2 text-rose-600 mb-4">
                <ShieldAlert className="h-5 w-5 animate-bounce shrink-0" />
                <h3 className="font-editorial text-sm font-bold uppercase tracking-widest">
                  Confirm deletion
                </h3>
              </div>
              <p className="font-editorial text-lg font-black text-brand-black uppercase leading-tight mb-3">
                Are you absolutely sure you want to delete this workspace?
              </p>
              <p className="text-xs font-sans-editorial font-bold text-brand-black/50 leading-relaxed mb-6">
                This process is completely irreversible. All sprint boards, task cards, teammates,
                history logs, and details associated with{' '}
                <span className="text-rose-600 font-extrabold">{workspace?.name}</span> will be
                deleted permanently.
              </p>
              <div className="flex gap-3 justify-end mt-auto">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="rounded-full border border-brand-black/10 px-5 py-2.5 text-xs font-editorial font-bold uppercase tracking-widest text-brand-black hover:bg-brand-beige transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteWorkspace}
                  className="rounded-full bg-rose-600 border-editorial px-5 py-2.5 text-xs font-editorial font-bold uppercase tracking-widest text-white hover:bg-rose-700 transition-all cursor-pointer shadow-editorial-sm"
                >
                  Yes, Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showLeaveConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-brand-black/60 backdrop-blur-md"
              onClick={() => setShowLeaveConfirm(false)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              transition={{ type: 'spring', duration: 0.4 }}
              className="relative w-full max-w-md overflow-hidden rounded-3xl border-editorial bg-white p-6 sm:p-8 shadow-editorial z-10 flex flex-col"
            >
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-brand-yellow" />
              <div className="flex items-center gap-2 text-brand-yellow mb-4">
                <LogOut className="h-5 w-5 shrink-0 text-brand-black" />
                <h3 className="font-editorial text-sm font-bold uppercase tracking-widest text-brand-black">
                  Confirm exit
                </h3>
              </div>
              <p className="font-editorial text-lg font-black text-brand-black uppercase leading-tight mb-3">
                Are you sure you want to leave this workspace?
              </p>
              <p className="text-xs font-sans-editorial font-bold text-brand-black/50 leading-relaxed mb-6">
                You will lose all operator access, active assignments, and administrative controls
                within the workspace{' '}
                <span className="text-brand-black font-extrabold">{workspace?.name}</span>. An admin
                will need to invite you back to restore access.
              </p>
              <div className="flex gap-3 justify-end mt-auto">
                <button
                  type="button"
                  onClick={() => setShowLeaveConfirm(false)}
                  className="rounded-full border border-brand-black/10 px-5 py-2.5 text-xs font-editorial font-bold uppercase tracking-widest text-brand-black hover:bg-brand-beige transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmLeaveWorkspace}
                  className="rounded-full bg-brand-black border-editorial px-5 py-2.5 text-xs font-editorial font-bold uppercase tracking-widest text-brand-yellow hover:bg-brand-black/95 transition-all cursor-pointer shadow-editorial-sm"
                >
                  Yes, Leave
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
