import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Bell, CheckCheck, ChevronDown, CircleDot, MessageSquareText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import {
  fetchNotifications,
  fetchUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead
} from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';

function formatTimeAgo(value) {
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.floor(diff / 60000));

  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function iconForType(type) {
  if (type === 'task_commented') return MessageSquareText;
  if (type === 'task_assigned') return CircleDot;
  return Bell;
}

export default function NotificationBell() {
  const socket = useSocket();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
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

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const [listResponse, countResponse] = await Promise.all([fetchNotifications(), fetchUnreadNotificationCount()]);
        if (!active) return;
        setNotifications(listResponse.data.notifications || []);
        setUnreadCount(countResponse.data.count || 0);
      } catch (error) {
        if (active) {
          setNotifications([]);
          setUnreadCount(0);
        }
      }
    }

    load();
    const timer = window.setInterval(async () => {
      try {
        const response = await fetchUnreadNotificationCount();
        if (active) {
          setUnreadCount(response.data.count || 0);
        }
      } catch (error) {
        // ignore polling failures
      }
    }, 30000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!socket) return undefined;

    const onNotification = (event) => {
      const nextNotification = event?.notification || event;
      if (!nextNotification) return;

      if (nextNotification.userId && user?.id && String(nextNotification.userId) !== String(user.id)) {
        return;
      }

      setNotifications((current) => [nextNotification, ...current.filter((item) => String(item.id) !== String(nextNotification.id))].slice(0, 15));
      setUnreadCount((current) => current + 1);
    };

    socket.on('notification:new', onNotification);
    return () => {
      socket.off('notification:new', onNotification);
    };
  }, [socket]);

  const unreadIndicator = useMemo(() => unreadCount > 0, [unreadCount]);

  async function handleOpen(notification) {
    try {
      if (!notification.read) {
        await markNotificationRead(notification.id);
        setUnreadCount((current) => Math.max(0, current - 1));
      }
    } finally {
      setNotifications((current) => current.map((item) => (String(item.id) === String(notification.id) ? { ...item, read: true } : item)));
      setOpen(false);
      if (notification.link) {
        navigate(notification.link);
      }
    }
  }

  async function handleMarkAllRead() {
    await markAllNotificationsRead();
    setNotifications((current) => current.map((item) => ({ ...item, read: true })));
    setUnreadCount(0);
  }

  return (
    <div className="relative font-sans-editorial" ref={containerRef}>
      <motion.button
        whileTap={{ scale: 0.98 }}
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-left text-white transition-all hover:bg-white/10 cursor-pointer shadow-sm"
      >
        <span className="flex items-center gap-3">
          <span className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white/70">
            <Bell className="h-4 w-4" />
            {unreadIndicator ? (
              <span className="absolute right-0.5 top-0.5 flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-purple opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-purple"></span>
              </span>
            ) : null}
          </span>
          <div>
            <span className="block text-xs font-bold text-white/90">Alert Center</span>
            <span className="block text-[9px] font-bold text-white/40 uppercase tracking-widest mt-0.5">
              {unreadCount > 0 ? `${unreadCount} unread` : 'All updates read'}
            </span>
          </div>
        </span>
        <ChevronDown className={`h-4 w-4 text-white/40 transition-transform duration-250 ${open ? 'rotate-180 text-white' : ''}`} />
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div 
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
            className="absolute left-0 top-[calc(100%+0.5rem)] z-50 w-[320px] overflow-hidden rounded-2xl border border-white/15 bg-[#161616] p-1.5 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/10 px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">Notifications</p>
              {unreadIndicator && (
                <button 
                  type="button" 
                  onClick={handleMarkAllRead} 
                  className="flex items-center gap-1 text-[10px] font-bold text-brand-yellow hover:underline transition duration-150 cursor-pointer"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  <span>Clear All</span>
                </button>
              )}
            </div>

            <div className="max-h-[340px] overflow-y-auto space-y-1 p-1 mt-1 scrollbar-elegant">
              {notifications.slice(0, 15).map((notification) => {
                const Icon = iconForType(notification.type);
                return (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={() => handleOpen(notification)}
                    className={`flex w-full items-start gap-3 rounded-xl px-2.5 py-2.5 text-left transition duration-150 cursor-pointer border ${
                      notification.read 
                        ? 'text-white/50 border-transparent hover:bg-white/5 hover:text-white' 
                        : 'bg-brand-purple/10 text-white border-brand-purple/20 hover:bg-brand-purple/15'
                    }`}
                  >
                    <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                      notification.read ? 'bg-white/5 text-white/40' : 'bg-brand-purple text-white shadow-sm'
                    }`}>
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-semibold leading-normal font-sans-editorial">{notification.message}</span>
                      <span className="block text-[9px] font-bold text-white/30 mt-1">{formatTimeAgo(notification.createdAt)}</span>
                    </span>
                    
                    {!notification.read && (
                      <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-purple pulse-glow-yellow" />
                    )}
                  </button>
                );
              })}

              {!notifications.length ? (
                <div className="py-8 text-center text-[10px] font-bold text-white/30 uppercase tracking-widest">
                  All caught up
                </div>
              ) : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}