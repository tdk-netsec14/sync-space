/**
 * client/src/components/PresenceDot.jsx
 *
 * A small animated indicator dot that shows whether a user is currently online.
 *
 * Usage:
 *   import { usePresence } from '../context/SocketContext';
 *
 *   const onlineUsers = usePresence(workspaceId);
 *   <PresenceDot isOnline={onlineUsers.has(member.user?.id)} />
 *
 * Props:
 *   isOnline  {boolean}  Whether the user is online
 *   size      {'sm'|'md'} Dot size — sm=6px, md=9px (default: 'sm')
 *   showLabel {boolean}   Show "Online" / "Offline" text label (default: false)
 */
import React from 'react';

export default function PresenceDot({ isOnline, size = 'sm', showLabel = false }) {
  const dotSize = size === 'md' ? 'h-2.5 w-2.5' : 'h-2 w-2';

  return (
    <span className="inline-flex items-center gap-1.5" aria-label={isOnline ? 'Online' : 'Offline'}>
      <span className="relative flex shrink-0">
        {isOnline && (
          <span
            className={`absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60`}
          />
        )}
        <span
          className={`relative inline-flex rounded-full ${dotSize} ${
            isOnline ? 'bg-emerald-500' : 'bg-brand-black/20'
          }`}
        />
      </span>
      {showLabel && (
        <span
          className={`text-[9px] font-black uppercase tracking-widest ${
            isOnline ? 'text-emerald-600' : 'text-brand-black/35'
          }`}
        >
          {isOnline ? 'Online' : 'Offline'}
        </span>
      )}
    </span>
  );
}
