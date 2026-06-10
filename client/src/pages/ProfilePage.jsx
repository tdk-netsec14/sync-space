import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { changePassword, fetchMe, updateProfile } from '../services/api';
import {
  ArrowLeft,
  BadgeCheck,
  ShieldAlert,
  Sparkles,
  Terminal,
  BarChart2,
  Briefcase,
  Users,
  Timer,
  Palette
} from 'lucide-react';
import { motion } from 'framer-motion';

const avatarChoices = ['#DCC7FF', '#F4C318', '#8B5CF6', '#F6EFD8', '#10b981', '#ef4444'];

const emojiMap = {
  '💻': Terminal,
  '🎨': Palette,
  '📊': BarChart2,
  '💼': Briefcase,
  '👥': Users,
  '⏱️': Timer
};

export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const [profile, setProfile] = useState({ name: '', avatar: '#6366f1' });
  const [passwords, setPasswords] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [workspaces, setWorkspaces] = useState([]);
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const response = await fetchMe();
        if (!active) return;
        setProfile({
          name: response.data.user?.name || '',
          avatar: response.data.user?.avatar || '#6366f1'
        });
        setWorkspaces(response.data.memberships || []);
      } catch (error) {
        if (active) {
          setMessage(error.response?.data?.error?.message || error.response?.data?.error || 'Unable to load profile information.');
          setIsSuccess(false);
        }
      }
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  async function saveProfile(event) {
    event.preventDefault();
    setMessage('');
    setIsSuccess(true);

    try {
      const response = await updateProfile(profile);
      updateUser(response.data.user, response.data.token);
      setMessage('Profile updated successfully.');
    } catch (error) {
      setMessage(error.response?.data?.error?.message || error.response?.data?.error || 'Unable to update profile.');
      setIsSuccess(false);
    }
  }

  async function savePassword(event) {
    event.preventDefault();
    setMessage('');
    setIsSuccess(true);

    try {
      await changePassword(passwords);
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setMessage('Security credentials updated successfully.');
    } catch (error) {
      setMessage(error.response?.data?.error?.message || error.response?.data?.error || 'Unable to change password.');
      setIsSuccess(false);
    }
  }

  return (
    <div className="min-h-screen bg-brand-offwhite px-6 py-12 text-brand-black font-sans antialiased dot-grid relative">
      <div className="mx-auto max-w-5xl">
        {/* Header Block */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-brand-black/10 pb-8 mb-8">
          <div>
            <span className="text-[9px] font-black uppercase tracking-widest text-brand-black/45 block font-sans-editorial">
              Identity Registry
            </span>
            <h1 className="font-editorial text-3xl sm:text-4xl font-black text-brand-black leading-none uppercase mt-1">
              Account Configuration
            </h1>
            <p className="text-xs font-sans-editorial font-bold text-brand-black/45 mt-2 leading-relaxed">
              Configure personal sprint credentials and secure key credentials.
            </p>
          </div>

          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="self-start sm:self-auto"
          >
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 rounded-full border border-brand-black/10 bg-white px-4 py-2.5 text-[10px] font-editorial font-bold text-brand-black hover:border-brand-black transition shadow-sm"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Return Home</span>
            </Link>
          </motion.div>
        </div>

        {/* Message Banner */}
        {message && (
          <div
            className={`mb-6 rounded-2xl border px-4 py-3.5 text-xs font-bold flex items-center gap-2 animate-fade-in font-sans-editorial ${
              isSuccess
                ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                : 'border-rose-500 bg-rose-50 text-rose-800'
            }`}
          >
            {isSuccess ? (
              <BadgeCheck className="h-4.5 w-4.5 text-emerald-600 shrink-0" />
            ) : (
              <ShieldAlert className="h-4.5 w-4.5 text-rose-600 shrink-0" />
            )}
            <span>{message}</span>
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          {/* Identity details form */}
          <form
            onSubmit={saveProfile}
            className="border-editorial bg-white p-6 shadow-editorial rounded-3xl flex flex-col relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-brand-yellow" />
            <h2 className="font-editorial text-sm font-bold text-brand-black border-b border-brand-black/10 pb-3 mb-5 uppercase tracking-widest">
              Identity details
            </h2>

            <div className="space-y-4 flex-1">
              <label className="block">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-brand-black/65 font-sans-editorial">
                  Full Name
                </span>
                <input
                  value={profile.name}
                  onChange={(event) =>
                    setProfile((current) => ({ ...current, name: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-brand-black bg-brand-offwhite px-4 py-3 text-xs font-bold text-brand-black outline-none transition focus:shadow-editorial-sm font-sans-editorial"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-brand-black/65 font-sans-editorial">
                  Email Address
                </span>
                <input
                  value={user?.email || ''}
                  readOnly
                  className="w-full rounded-2xl border border-brand-black/15 bg-brand-beige px-4 py-3 text-xs font-bold text-brand-black/50 outline-none cursor-not-allowed font-sans-editorial"
                />
              </label>

              <div>
                <span className="mb-3 block text-[10px] font-bold uppercase tracking-wider text-brand-black/65 font-sans-editorial">
                  Avatar color tag
                </span>
                <div className="flex flex-wrap gap-2.5">
                  {avatarChoices.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setProfile((current) => ({ ...current, avatar: color }))}
                      className={`h-9 w-9 rounded-full border-2 transition-all duration-150 btn-active-scale cursor-pointer ${
                        profile.avatar === color
                          ? 'border-brand-black scale-105 ring-2 ring-brand-purple/20 shadow-editorial-sm'
                          : 'border-transparent hover:scale-105'
                      }`}
                      style={{ backgroundColor: color }}
                      aria-label={`Pick ${color}`}
                    />
                  ))}
                </div>
              </div>
            </div>

            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="mt-6">
              <button
                type="submit"
                className="w-full rounded-full bg-brand-yellow border-editorial px-4 py-3.5 text-xs font-editorial font-bold text-brand-black hover:bg-[#ffcf29] transition-all cursor-pointer shadow-editorial uppercase tracking-widest"
              >
                Save Profile Identity
              </button>
            </motion.div>
          </form>

          {/* Security Form */}
          <form
            onSubmit={savePassword}
            className="border-editorial bg-white p-6 shadow-editorial rounded-3xl flex flex-col relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-brand-purple" />
            <h2 className="font-editorial text-sm font-bold text-brand-black border-b border-brand-black/10 pb-3 mb-5 uppercase tracking-widest">
              Security credential
            </h2>

            <div className="space-y-4 flex-1">
              <input
                type="password"
                placeholder="Current password"
                value={passwords.currentPassword}
                onChange={(event) =>
                  setPasswords((current) => ({ ...current, currentPassword: event.target.value }))
                }
                className="w-full rounded-2xl border border-brand-black bg-brand-offwhite px-4 py-3 text-xs font-bold text-brand-black outline-none transition focus:shadow-editorial-sm font-sans-editorial"
              />
              <input
                type="password"
                placeholder="New password"
                value={passwords.newPassword}
                onChange={(event) =>
                  setPasswords((current) => ({ ...current, newPassword: event.target.value }))
                }
                className="w-full rounded-2xl border border-brand-black bg-brand-offwhite px-4 py-3 text-xs font-bold text-brand-black outline-none transition focus:shadow-editorial-sm font-sans-editorial"
              />
              <input
                type="password"
                placeholder="Confirm new password"
                value={passwords.confirmPassword}
                onChange={(event) =>
                  setPasswords((current) => ({ ...current, confirmPassword: event.target.value }))
                }
                className="w-full rounded-2xl border border-brand-black bg-brand-offwhite px-4 py-3 text-xs font-bold text-brand-black outline-none transition focus:shadow-editorial-sm font-sans-editorial"
              />
            </div>

            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="mt-6">
              <button
                type="submit"
                className="w-full rounded-full bg-brand-black border-editorial px-4 py-3.5 text-xs font-editorial font-bold text-brand-yellow hover:bg-brand-black/90 transition-all cursor-pointer shadow-editorial uppercase tracking-widest"
              >
                Update Security Credentials
              </button>
            </motion.div>
          </form>
        </div>

        {/* Workspaces list */}
        <section className="mt-8 border-editorial bg-white p-6 shadow-editorial rounded-3xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-brand-black" />

          <div className="flex items-center justify-between border-b border-brand-black/10 pb-3 mb-5">
            <h2 className="font-editorial text-sm font-bold text-brand-black uppercase tracking-widest">
              Workspace Memberships
            </h2>
            <span className="rounded-full bg-brand-beige border border-brand-black/10 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-brand-black/60 font-sans-editorial">
              {workspaces.length} active spaces
            </span>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {workspaces.map((membership) => (
              <Link
                key={membership.id}
                to={`/workspace/${membership.workspace.id}`}
                className="group rounded-2xl border border-brand-black/10 p-4 transition-all duration-300 hover:border-brand-black bg-brand-offwhite hover:bg-white hover:shadow-editorial flex items-center gap-4"
              >
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-brand-black border border-brand-black/15 shadow-sm transition group-hover:scale-105"
                  style={{ backgroundColor: membership.workspace.color || '#DCC7FF' }}
                >
                  {emojiMap[membership.workspace.logo] ? (
                    React.createElement(emojiMap[membership.workspace.logo], {
                      className: 'h-5 w-5 text-brand-black'
                    })
                  ) : (
                    <span className="text-sm font-black">{membership.workspace.logo || 'S'}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-brand-black group-hover:text-brand-purple transition-all truncate font-editorial uppercase tracking-wider">
                    {membership.workspace.name}
                  </p>
                  <span className="mt-1.5 inline-block rounded-full bg-brand-beige border border-brand-black/10 px-2.5 py-0.5 text-[8px] font-black uppercase tracking-widest text-brand-black/60 group-hover:text-brand-purple group-hover:border-brand-purple/20 transition-all font-sans-editorial">
                    {membership.role}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
