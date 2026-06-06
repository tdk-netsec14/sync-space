import React from 'react';
import {
  LayoutDashboard,
  KanbanSquare,
  Settings,
  Users,
  LogOut,
  UserCircle2,
  Sparkles,
  X,
  ChevronRight,
  Terminal,
  BarChart2,
  Briefcase,
  Timer,
  Palette
} from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';
import WorkspaceSwitcher from './WorkspaceSwitcher';
import NotificationBell from './NotificationBell';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';

const emojiMap = {
  '💻': Terminal,
  '🎨': Palette,
  '📊': BarChart2,
  '💼': Briefcase,
  '👥': Users,
  '⏱️': Timer
};

const navItems = [
  { label: 'Overview', icon: LayoutDashboard, to: '' },
  { label: 'Agile Boards', icon: KanbanSquare, to: 'boards' },
  { label: 'AI Intelligence', icon: Sparkles, to: 'ai' },
  { label: 'Team Members', icon: Users, to: '' },
  { label: 'Canvas Settings', icon: Settings, to: 'settings' }
];

export default function Sidebar({ workspace, workspaceId, isOpen, onClose }) {
  const { user, logout } = useAuth();
  const themeColor = workspace?.color || '#8B5CF6';

  return (
    <>
      {/* Mobile Drawer Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-brand-black/60 md:hidden backdrop-blur-md transition-all"
          onClick={onClose}
        />
      )}

      {/* Sidebar Drawer Container */}
      <aside
        className={`fixed left-0 top-0 z-50 flex h-screen w-[260px] flex-col bg-brand-black px-5 py-7 text-white transition-all duration-350 md:translate-x-0 border-r border-white/10 shadow-2xl ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Workspace Title & Mobile Close Trigger */}
        <div className="mb-6 flex items-center justify-between px-1">
          <div className="flex items-center gap-3 min-w-0">
            <motion.div
              whileHover={{ scale: 1.05, rotate: 5 }}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-brand-black border border-white/15 shadow-lg"
              style={{ backgroundColor: themeColor }}
            >
              {emojiMap[workspace?.logo] ? (
                React.createElement(emojiMap[workspace?.logo], {
                  className: 'h-4.5 w-4.5 text-brand-black'
                })
              ) : (
                <span className="text-sm font-black">{workspace?.logo || 'S'}</span>
              )}
            </motion.div>
            <div className="min-w-0">
              <p className="truncate text-sm font-editorial font-bold text-white tracking-wide">
                {workspace?.name || 'Workspace'}
              </p>
              <span className="inline-block truncate text-[9px] font-sans-editorial font-bold tracking-widest text-[#DCC7FF] uppercase mt-0.5 opacity-90">
                {workspace?.slug || 'no slug'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="md:hidden rounded-full p-2 text-white/50 hover:bg-white/10 hover:text-white transition-all cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Workspace Switcher Panel */}
        <div className="mt-2">
          <WorkspaceSwitcher />
        </div>

        {/* Notification Bell Panel */}
        <div className="mt-3">
          <NotificationBell />
        </div>

        <div className="h-px bg-white/10 my-5" />

        {/* Workspace Navigation Channels */}
        <span className="px-3 text-[9px] font-bold tracking-widest uppercase text-white/30 font-sans-editorial block mb-2">
          Workspace Hub
        </span>
        <nav className="flex-1 space-y-1.5 scrollbar-elegant overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const path = item.to
              ? `/workspace/${workspaceId}/${item.to}`
              : `/workspace/${workspaceId}`;

            return (
              <NavLink
                key={item.label}
                to={path}
                end={!item.to}
                className={({ isActive }) =>
                  `group relative flex items-center justify-between rounded-xl px-3 py-3 text-xs font-bold transition-all duration-200 ${
                    isActive
                      ? 'bg-white/10 text-white border border-white/5'
                      : 'text-white/60 border border-transparent hover:bg-white/5 hover:text-white'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className="flex items-center gap-3">
                      <Icon
                        className={`h-4.5 w-4.5 shrink-0 transition-colors ${
                          isActive ? 'text-white' : 'text-white/40 group-hover:text-white/80'
                        }`}
                        style={isActive ? { color: themeColor } : {}}
                      />
                      <span className="font-sans-editorial">{item.label}</span>
                    </div>
                    {isActive && (
                      <motion.div
                        layoutId="activeIndicator"
                        className="h-1.5 w-1.5 rounded-full bg-white pulse-glow-yellow"
                        style={{ backgroundColor: themeColor }}
                      />
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Workspace Footer Profile Deck */}
        <div className="mt-auto border-t border-white/10 pt-5">
          <div className="flex items-center gap-3 px-2">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-black text-brand-black shadow-md border border-white/20"
              style={{ backgroundColor: themeColor }}
            >
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-editorial font-bold text-white tracking-wide">
                {user?.name || 'User'}
              </p>
              <p className="truncate text-[10px] text-white/40 font-medium font-sans-editorial mt-0.5">
                {user?.email || ''}
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Link
                to="/profile"
                className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 py-2.5 text-[10px] font-bold text-white/85 hover:bg-white/10 hover:text-white transition-all w-full font-sans-editorial"
              >
                <UserCircle2 className="h-3.5 w-3.5 text-white/50" />
                <span>Profile</span>
              </Link>
            </motion.div>

            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <button
                type="button"
                onClick={logout}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 py-2.5 text-[10px] font-bold text-white/85 hover:bg-white/10 hover:text-white transition-all w-full cursor-pointer font-sans-editorial"
              >
                <LogOut className="h-3.5 w-3.5 text-white/50" />
                <span>Logout</span>
              </button>
            </motion.div>
          </div>
        </div>
      </aside>
    </>
  );
}
