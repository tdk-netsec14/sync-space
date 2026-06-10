import React, { useEffect, useState } from 'react';
import { Copy, MailPlus, Menu, CheckCircle2 } from 'lucide-react';
import { useParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import ActivityFeed from '../components/ActivityFeed';
import { DashboardSkeleton } from '../components/SkeletonScreens';
import EmptyState from '../components/EmptyState';
import PresenceDot from '../components/PresenceDot';
import { useSocket, usePresence } from '../context/SocketContext';
import { useWorkspace } from '../context/WorkspaceContext';
import {
  createInvite,
  fetchMembers,
  fetchWorkspaceActivity,
  fetchWorkspaceStats,
  getWorkspace
} from '../services/api';
import { motion } from 'framer-motion';

export default function WorkspaceDashboard() {
  const { workspaceId } = useParams();
  const { socket, joinWorkspace } = useSocket();
  const onlineUsers = usePresence(workspaceId); // Set<userId> of online members
  const { currentWorkspace, setCurrentWorkspace } = useWorkspace();
  const [workspace, setWorkspace] = useState(currentWorkspace);
  const [members, setMembers] = useState([]);
  const [stats, setStats] = useState({
    totalTasks: 0,
    completedThisWeek: 0,
    activeMembers: 0,
    overdueTasks: 0
  });
  const [activities, setActivities] = useState([]);
  const [activityCursor, setActivityCursor] = useState(null);
  const [hasMoreActivities, setHasMoreActivities] = useState(false);
  const [loadingMoreActivities, setLoadingMoreActivities] = useState(false);
  const [loading, setLoading] = useState(true);
  const [inviteUrl, setInviteUrl] = useState('');
  const [inviteMessage, setInviteMessage] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const themeColor = workspace?.color || '#8B5CF6';

  useEffect(() => {
    let active = true;
    setLoading(true);
    async function load() {
      try {
        const [workspaceResponse, membersResponse, statsResponse, activityResponse] =
          await Promise.all([
            getWorkspace(workspaceId),
            fetchMembers(workspaceId),
            fetchWorkspaceStats(workspaceId),
            fetchWorkspaceActivity(workspaceId, { limit: 8 })
          ]);
        if (!active) return;
        const nextActivities = activityResponse.data.activities || [];
        setWorkspace(workspaceResponse.data.workspace);
        setCurrentWorkspace(workspaceResponse.data.workspace);
        setMembers(membersResponse.data.members || []);
        setStats(
          statsResponse.data.stats || {
            totalTasks: 0,
            completedThisWeek: 0,
            activeMembers: 0,
            overdueTasks: 0
          }
        );
        setActivities(nextActivities);
        setActivityCursor(nextActivities[nextActivities.length - 1]?.createdAt || null);
        setHasMoreActivities(nextActivities.length === 8);
      } catch {
        if (active) {
          setMembers([]);
          setActivities([]);
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [workspaceId, setCurrentWorkspace]);

  useEffect(() => {
    if (!socket || !workspaceId) return undefined;

    // Use the context helper — it emits join:workspace AND tracks the room
    // in joinedWorkspaces ref so it rejoins after reconnects.
    joinWorkspace(workspaceId);

    async function refreshStats() {
      try {
        const response = await fetchWorkspaceStats(workspaceId);
        setStats(
          response.data.stats || {
            totalTasks: 0,
            completedThisWeek: 0,
            activeMembers: 0,
            overdueTasks: 0
          }
        );
      } catch {
        // ignore transient stat refresh failures
      }
    }

    const onActivity = ({ activity }) => {
      if (!activity) return;
      setActivities((current) =>
        [activity, ...current.filter((item) => String(item.id) !== String(activity.id))].slice(
          0,
          50
        )
      );
      void refreshStats();
    };

    socket.on('activity:new', onActivity);

    return () => {
      socket.off('activity:new', onActivity);
    };
  }, [socket, workspaceId, joinWorkspace]);

  async function handleInvite() {
    try {
      const response = await createInvite(workspaceId, { role: 'member' });
      setInviteUrl(response.data.inviteUrl);
      setInviteMessage('Authorized invite link generated.');
    } catch (error) {
      setInviteMessage(error.response?.data?.error?.message || error.response?.data?.error || 'Unable to create invite');
    }
  }

  function copyInvite() {
    if (inviteUrl) {
      navigator.clipboard.writeText(inviteUrl);
      setInviteMessage('Authorized link copied to clipboard.');
    }
  }

  async function loadMoreActivities() {
    if (!activityCursor) {
      return;
    }

    setLoadingMoreActivities(true);
    try {
      const response = await fetchWorkspaceActivity(workspaceId, {
        limit: 8,
        before: activityCursor
      });
      const nextActivities = response.data.activities || [];
      setActivities((current) => [...current, ...nextActivities]);
      setActivityCursor(nextActivities[nextActivities.length - 1]?.createdAt || null);
      setHasMoreActivities(nextActivities.length === 8);
    } finally {
      setLoadingMoreActivities(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-offwhite dot-grid relative">
        <Sidebar
          workspace={workspace}
          workspaceId={workspaceId}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />
        <div className="md:ml-[260px]">
          <DashboardSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-offwhite text-brand-black relative dot-grid font-sans overflow-x-hidden">
      {/* Premium Sidebar Component */}
      <Sidebar
        workspace={workspace}
        workspaceId={workspaceId}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Main Workspace Frame */}
      <main className="flex-1 p-6 md:ml-[260px] md:p-10 animate-fade-in">
        {/* Editorial Title & Action Header */}
        <div className="mb-10 flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div className="flex items-center gap-4 min-w-0">
            <button
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              className="rounded-xl border-editorial bg-white p-3 text-brand-black md:hidden hover:bg-brand-beige transition-all shadow-editorial-sm shrink-0"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <h1 className="font-editorial text-4xl sm:text-5xl font-black text-brand-black leading-none uppercase truncate">
                {workspace?.name || 'Sprint Canvas'}
              </h1>
              <p className="mt-2 text-xs font-sans-editorial font-bold text-brand-black/45">
                Track team activity logs, Kanban status maps, and collaborative seat operations.
              </p>
            </div>
          </div>

          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="shrink-0">
            <button
              type="button"
              onClick={handleInvite}
              className="inline-flex items-center gap-2 rounded-full bg-brand-yellow border-editorial px-5 py-3 text-xs font-editorial font-bold text-brand-black shadow-editorial hover:bg-[#ffcf29] transition-all cursor-pointer"
            >
              <MailPlus className="h-4 w-4" /> Invite Operator
            </button>
          </motion.div>
        </div>

        {/* Asymmetrical High-Contrast Stats Cards Grid */}
        <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1 */}
          <div className="border-editorial bg-white p-6 shadow-editorial rounded-3xl relative overflow-hidden transition-all duration-300 shadow-editorial-hover">
            <span
              className="absolute left-0 top-0 bottom-0 w-[6px]"
              style={{ backgroundColor: themeColor }}
            />
            <p className="text-[10px] font-bold uppercase tracking-wider text-brand-black/45 font-sans-editorial">
              Total Cards
            </p>
            <div className="mt-4 text-5xl font-editorial font-black text-brand-black tracking-tight leading-none">
              {stats.totalTasks}
            </div>
          </div>

          {/* Card 2 */}
          <div className="border-editorial bg-white p-6 shadow-editorial rounded-3xl relative overflow-hidden transition-all duration-300 shadow-editorial-hover">
            <span className="absolute left-0 top-0 bottom-0 w-[6px] bg-green-500" />
            <p className="text-[10px] font-bold uppercase tracking-wider text-brand-black/45 font-sans-editorial">
              Completed Tasks
            </p>
            <div className="mt-4 text-5xl font-editorial font-black text-brand-black tracking-tight leading-none">
              {stats.completedThisWeek}
            </div>
          </div>

          {/* Card 3 */}
          <div className="border-editorial bg-white p-6 shadow-editorial rounded-3xl relative overflow-hidden transition-all duration-300 shadow-editorial-hover">
            <span className="absolute left-0 top-0 bottom-0 w-[6px] bg-brand-purple" />
            <p className="text-[10px] font-bold uppercase tracking-wider text-brand-black/45 font-sans-editorial">
              Active Seats
            </p>
            <div className="mt-4 flex items-baseline gap-1 text-5xl font-editorial font-black text-brand-black tracking-tight leading-none">
              {stats.activeMembers}
              <span className="text-[9px] font-bold text-brand-black/35 font-sans-editorial uppercase tracking-wider ml-1">
                occupied
              </span>
            </div>
          </div>

          {/* Card 4 */}
          <div className="border-editorial bg-white p-6 shadow-editorial rounded-3xl relative overflow-hidden transition-all duration-300 shadow-editorial-hover">
            <span className="absolute left-0 top-0 bottom-0 w-[6px] bg-rose-500 animate-pulse" />
            <p className="text-[10px] font-bold uppercase tracking-wider text-brand-black/45 font-sans-editorial">
              Overdue Items
            </p>
            <div className="mt-4 text-5xl font-editorial font-black text-brand-black tracking-tight leading-none">
              {stats.overdueTasks}
            </div>
          </div>
        </section>

        {/* Two-Column Grid Layout: Activities and Members */}
        <div className="mt-10 grid gap-8 lg:grid-cols-[1.15fr_0.85fr] items-start">
          {/* Real-time Activity Feed */}
          {activities.length === 0 ? (
            <EmptyState variant="activity" />
          ) : (
            <ActivityFeed
              activities={activities}
              onLoadMore={hasMoreActivities ? loadMoreActivities : null}
              loadingMore={loadingMoreActivities}
            />
          )}

          {/* Asymmetrical Team Members Container */}
          <section className="border-editorial rounded-3xl bg-white p-6 shadow-editorial relative overflow-hidden">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-brand-black/10 pb-5">
              <div>
                <h2 className="font-editorial text-xl font-bold tracking-tight text-brand-black uppercase">
                  Grid Operators
                </h2>
                <p className="text-[10px] font-sans-editorial font-bold text-brand-black/45 mt-1">
                  Authorized seats allocated on this space.
                </p>
              </div>
              <div className="flex items-center gap-3">
                {/* Online count badge */}
                {onlineUsers.size > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-emerald-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    {onlineUsers.size} online
                  </span>
                )}
                {inviteUrl && (
                  <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                    <button
                      type="button"
                      onClick={copyInvite}
                      className="inline-flex items-center gap-1.5 rounded-full border border-brand-black/10 bg-brand-offwhite px-3.5 py-1.5 text-[10px] font-bold text-brand-black hover:border-brand-black transition-all cursor-pointer shadow-sm"
                    >
                      <Copy className="h-3.5 w-3.5" /> Copy Invite
                    </button>
                  </motion.div>
                )}
              </div>
            </div>

            {/* Invite generated glowing notification banner */}
            {inviteMessage && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 flex items-start gap-2.5 rounded-2xl border-editorial border-brand-purple bg-brand-lavender/15 px-4 py-3.5 text-xs font-bold text-brand-black"
              >
                <CheckCircle2 className="h-4.5 w-4.5 shrink-0 text-brand-purple mt-0.5" />
                <div>
                  <span className="text-[10px] uppercase font-editorial tracking-wider text-brand-purple">
                    Invitation Generated
                  </span>
                  <p className="mt-1 font-sans-editorial text-brand-black/85 leading-normal font-medium">
                    {inviteMessage}
                  </p>
                </div>
              </motion.div>
            )}

            {/* Members List Grid */}
            <div className="mt-6 space-y-3">
              {members.map((member) => {
                const isOnline = onlineUsers.has(String(member.user?.id));
                return (
                  <div
                    key={member.id}
                    className="flex items-center justify-between rounded-2xl border border-brand-black/10 bg-brand-offwhite/40 p-3.5 hover:border-brand-black hover:bg-white transition duration-200"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Avatar with presence ring */}
                      <div className="relative shrink-0">
                        <div
                          className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-black text-brand-black shadow-sm border border-brand-black/10"
                          style={{ backgroundColor: themeColor }}
                        >
                          {member.user?.name?.[0]?.toUpperCase() || 'U'}
                        </div>
                        {/* Presence dot — bottom-right of avatar */}
                        <span className="absolute -bottom-0.5 -right-0.5">
                          <PresenceDot isOnline={isOnline} size="sm" />
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-editorial font-bold text-brand-black leading-none">
                          {member.user?.name}
                        </p>
                        <p className="truncate text-[10px] text-brand-black/45 font-medium font-sans-editorial mt-1.5">
                          {member.user?.email}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <PresenceDot isOnline={isOnline} showLabel size="sm" />
                      <span className="rounded-full bg-brand-beige border border-brand-black/10 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-brand-black">
                        {member.role}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
