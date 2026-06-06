import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { LoaderCircle, Sparkles, MailOpen, ArrowLeft } from 'lucide-react';
import { fetchMe, getInviteInfo, registerUser } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const query = useQuery();
  const { token: inviteTokenFromPath } = useParams();
  const inviteToken = query.get('invite') || inviteTokenFromPath || '';
  const { login } = useAuth();
  const [inviteInfo, setInviteInfo] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingInvite, setIsLoadingInvite] = useState(Boolean(inviteToken));

  useEffect(() => {
    let active = true;

    async function loadInvite() {
      if (!inviteToken) {
        setIsLoadingInvite(false);
        return;
      }

      try {
        const response = await getInviteInfo(inviteToken);
        if (active) {
          setInviteInfo(response.data);
        }
      } catch (error) {
        if (active) {
          setInviteInfo({ valid: false, reason: 'invalid' });
        }
      } finally {
        if (active) {
          setIsLoadingInvite(false);
        }
      }
    }

    loadInvite();

    return () => {
      active = false;
    };
  }, [inviteToken]);

  const validation = useMemo(() => {
    const nextErrors = {};
    if (!form.name) nextErrors.name = 'Name is required';
    if (!form.email) nextErrors.email = 'Email is required';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      nextErrors.email = 'Enter a valid email';
    if (!form.password) nextErrors.password = 'Password is required';
    if (form.password && form.password.length < 6)
      nextErrors.password = 'Password must be at least 6 characters';
    return nextErrors;
  }, [form]);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setErrors(validation);
    if (Object.keys(validation).length) {
      return;
    }

    try {
      setIsSubmitting(true);
      setSubmitError('');
      const response = await registerUser(form, inviteToken);
      login(response.data.token, response.data.user);
      const meResponse = await fetchMe();
      const firstMembership = meResponse.data.memberships?.[0];
      if (inviteToken && inviteInfo?.workspace?.id) {
        navigate(`/workspace/${inviteInfo.workspace.id}`);
      } else if (firstMembership?.workspace?.id) {
        navigate(`/workspace/${firstMembership.workspace.id}`);
      } else {
        navigate('/workspace/new');
      }
    } catch (error) {
      setSubmitError(error.response?.data?.error || 'Registration failed');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[0.95fr_1.05fr] bg-brand-offwhite">
      {/* 1. Asymmetrical Left Editorial Panel */}
      <aside className="relative hidden flex-col justify-between bg-brand-black px-12 py-16 text-brand-offwhite lg:flex overflow-hidden border-r-2 border-brand-black">
        <div className="absolute inset-0 dot-grid-dark opacity-10" />
        <div className="absolute -bottom-48 -left-48 h-96 w-96 rounded-full bg-brand-purple/20 blur-[120px]" />
        <div className="absolute top-12 right-[-100px] h-[300px] w-[300px] rounded-full bg-brand-yellow/10 blur-[80px]" />

        <div className="relative z-10">
          <Link to="/" className="flex items-center gap-2 group">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-yellow text-sm font-black text-brand-black transition-transform group-hover:rotate-12">
              S
            </span>
            <span className="font-editorial text-lg font-bold tracking-tight text-white">
              Sync
              <span className="font-serif-editorial italic font-normal text-brand-lavender lowercase ml-0.5">
                space
              </span>
            </span>
          </Link>

          <h1 className="mt-28 max-w-md font-editorial text-5xl font-extrabold tracking-tight leading-none text-white uppercase">
            Create <br />
            your team <br />
            <span className="font-serif-editorial italic font-normal text-brand-yellow lowercase">
              grid today
            </span>
            .
          </h1>
          <p className="mt-8 max-w-sm text-brand-offwhite/60 leading-relaxed text-sm font-sans-editorial">
            Join the new standard of sprint canvases. Fluid columns, multi-tenant boundaries, and
            instant socketed boards.
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-2 text-[10px] font-bold tracking-wider uppercase text-brand-offwhite/40 font-sans-editorial">
          <Sparkles className="h-4 w-4 text-brand-purple animate-pulse" /> Custom Design System UI
        </div>
      </aside>

      {/* 2. Floating Card Form Section */}
      <main className="flex items-center justify-center px-6 py-12 relative dot-grid">
        <Link
          to="/"
          className="absolute top-6 left-6 inline-flex items-center gap-1.5 text-xs font-bold text-brand-black/60 hover:text-brand-black transition-colors bg-white border border-brand-black/10 px-3 py-1.5 rounded-full shadow-sm"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back home
        </Link>

        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
          className="w-full max-w-md border-editorial bg-white p-8 sm:p-10 shadow-editorial rounded-3xl"
        >
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <h2 className="font-editorial text-3xl font-bold tracking-tight text-brand-black uppercase">
                Create account
              </h2>
              <p className="mt-2 text-xs font-sans-editorial font-bold text-brand-black/45">
                Configure your custom agile command console.
              </p>

              {inviteToken ? (
                <div className="mt-4 flex items-start gap-3 rounded-2xl border-editorial border-brand-purple bg-brand-lavender/10 p-4 text-xs font-bold text-brand-black">
                  <MailOpen className="h-4.5 w-4.5 shrink-0 text-brand-purple mt-0.5" />
                  <div>
                    <span className="font-editorial uppercase text-brand-purple tracking-wider text-[10px]">
                      Workspace Invitation
                    </span>
                    <p className="mt-1 text-[11px] leading-relaxed text-brand-black/85 font-medium">
                      {isLoadingInvite
                        ? 'Validating token with server...'
                        : inviteInfo?.valid
                          ? `You are joining "${inviteInfo.workspace.name}" as an authorized ${inviteInfo.role}.`
                          : 'This workspace invite token is invalid or has expired.'}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="space-y-3.5">
              <label className="block">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-brand-black/65 font-sans-editorial">
                  Full Name
                </span>
                <input
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Sarah Connor"
                  className="w-full rounded-2xl border border-brand-black bg-brand-offwhite px-4 py-3 text-sm text-brand-black outline-none transition-all placeholder:text-brand-black/30 font-medium focus:bg-white focus:shadow-editorial-sm"
                />
                {errors.name ? (
                  <p className="mt-1 text-[11px] font-bold text-red-500">{errors.name}</p>
                ) : null}
              </label>

              <label className="block">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-brand-black/65 font-sans-editorial">
                  Email Address
                </span>
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="sarah@skynet.com"
                  className="w-full rounded-2xl border border-brand-black bg-brand-offwhite px-4 py-3 text-sm text-brand-black outline-none transition-all placeholder:text-brand-black/30 font-medium focus:bg-white focus:shadow-editorial-sm"
                />
                {errors.email ? (
                  <p className="mt-1 text-[11px] font-bold text-red-500">{errors.email}</p>
                ) : null}
              </label>

              <label className="block">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-brand-black/65 font-sans-editorial">
                  Password
                </span>
                <input
                  type="password"
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className="w-full rounded-2xl border border-brand-black bg-brand-offwhite px-4 py-3 text-sm text-brand-black outline-none transition-all placeholder:text-brand-black/30 font-medium focus:bg-white focus:shadow-editorial-sm"
                />
                {errors.password ? (
                  <p className="mt-1 text-[11px] font-bold text-red-500">{errors.password}</p>
                ) : null}
              </label>
            </div>

            {submitError ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-600">
                {submitError}
              </div>
            ) : null}

            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#111111] border-editorial px-5 py-4 font-editorial text-xs font-bold text-brand-yellow shadow-editorial-sm hover:bg-brand-black/90 transition-all disabled:opacity-75 disabled:cursor-not-allowed cursor-pointer"
              >
                {isSubmitting ? (
                  <LoaderCircle className="h-4.5 w-4.5 animate-spin text-brand-yellow" />
                ) : null}
                <span>{isSubmitting ? 'Registering...' : 'Build Sprint Grid'}</span>
              </button>
            </motion.div>

            <p className="mt-6 text-center text-xs text-brand-black/55 font-sans-editorial font-bold">
              Already have an account?{' '}
              <Link
                to={inviteToken ? `/login?invite=${inviteToken}` : '/login'}
                className="text-brand-purple hover:underline"
              >
                Sign in instead
              </Link>
            </p>
          </form>
        </motion.div>
      </main>
    </div>
  );
}
