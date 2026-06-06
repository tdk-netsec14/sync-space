import React, { useEffect } from 'react';
import { BrowserRouter, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import CreateWorkspacePage from './pages/CreateWorkspacePage';
import WorkspaceDashboard from './pages/WorkspaceDashboard';
import WorkspaceSettings from './pages/WorkspaceSettings';
import ProfilePage from './pages/ProfilePage';
import AIInsightsPage from './pages/AIInsightsPage';
import BoardsListPage from './pages/BoardsListPage';
import BoardPage from './pages/BoardPage';
import NotFoundPage from './pages/NotFoundPage';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import { AuthProvider, useAuth } from './context/AuthContext';
import { WorkspaceProvider, useWorkspace } from './context/WorkspaceContext';
import { SocketProvider } from './context/SocketContext';
import { getInviteInfo, joinInvite } from './services/api';

// ---------------------------------------------------------------------------
// Global network-error toast listener
// Listens for the 'syncspace:toast' CustomEvent dispatched by the Axios
// interceptor on network failures, then shows it in the DOM.
// ---------------------------------------------------------------------------
function NetworkToastListener() {
  const [toast, setToast] = React.useState(null);

  useEffect(() => {
    function onToast(e) {
      setToast(e.detail);
      setTimeout(() => setToast(null), 5000);
    }
    window.addEventListener('syncspace:toast', onToast);
    return () => window.removeEventListener('syncspace:toast', onToast);
  }, []);

  if (!toast) return null;

  return (
    <div
      role="alert"
      className="fixed bottom-6 left-1/2 z-[9999] -translate-x-1/2 animate-fade-in rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3 shadow-xl text-xs font-bold text-rose-800"
    >
      {toast.message}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Join workspace page
// ---------------------------------------------------------------------------
function JoinPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, logout, user } = useAuth();
  const { workspaces, reloadWorkspaces } = useWorkspace();
  const [state, setState] = React.useState({ loading: true, info: null, error: '' });

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await getInviteInfo(token);
        if (active) setState({ loading: false, info: response.data, error: '' });
      } catch {
        if (active)
          setState({ loading: false, info: null, error: 'Invite link is invalid or expired.' });
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [token]);

  const isAlreadyMember = React.useMemo(() => {
    if (!state.info?.workspace?.id || !workspaces) return false;
    return workspaces.some((w) => String(w.id || w._id) === String(state.info.workspace.id));
  }, [state.info?.workspace?.id, workspaces]);

  async function handleJoin() {
    try {
      await joinInvite(token);
      if (reloadWorkspaces) await reloadWorkspaces();
      navigate(
        state.info?.workspace?.id ? `/workspace/${state.info.workspace.id}` : '/workspace/new'
      );
    } catch (error) {
      setState((cur) => ({
        ...cur,
        error: error.response?.data?.error?.message || 'Unable to join workspace'
      }));
    }
  }

  if (state.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50/50 text-xs font-bold text-slate-400 uppercase tracking-widest animate-pulse">
        Fetching Invitation Data…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50/50 px-6 font-sans antialiased">
      <div className="w-full max-w-md rounded-2xl border border-slate-100 bg-white p-8 shadow-2xl animate-fade-in">
        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
          Collaboration Request
        </p>
        <h1 className="text-xl font-black text-slate-900 tracking-tight mt-1 leading-none">
          Join workspace
        </h1>

        {state.error && (
          <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50/40 px-4 py-3 text-xs font-bold text-rose-800">
            {state.error}
          </p>
        )}

        {state.info?.valid && (
          <div className="mt-5 space-y-5">
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
              <p className="text-xs font-medium text-slate-650 leading-relaxed">
                {isAlreadyMember ? (
                  <>
                    You are already an active member of{' '}
                    <span className="text-indigo-650 font-extrabold">
                      {state.info.workspace.name}
                    </span>
                    .
                  </>
                ) : (
                  <>
                    You have been invited to join{' '}
                    <span className="text-indigo-650 font-extrabold">
                      {state.info.workspace.name}
                    </span>{' '}
                    as{' '}
                    <span className="text-slate-800 font-extrabold uppercase tracking-wide">
                      {state.info.role}
                    </span>
                    .
                  </>
                )}
              </p>
              {isAuthenticated && user?.email && (
                <p className="mt-2.5 border-t border-slate-200/60 pt-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Logged in as: <span className="text-slate-700 normal-case">{user.email}</span>
                </p>
              )}
            </div>

            {isAlreadyMember ? (
              <button
                type="button"
                onClick={() => navigate(`/workspace/${state.info.workspace.id}`)}
                className="btn-active-scale w-full rounded-lg bg-indigo-650 px-4 py-3 text-xs font-bold text-white hover:bg-indigo-750 transition shadow-md cursor-pointer"
              >
                Go to Workspace Dashboard
              </button>
            ) : isAuthenticated ? (
              <div className="space-y-3.5">
                <button
                  type="button"
                  onClick={handleJoin}
                  className="btn-active-scale w-full rounded-lg bg-indigo-650 px-4 py-3 text-xs font-bold text-white hover:bg-indigo-750 transition shadow-md cursor-pointer"
                >
                  Accept Invite & Join
                </button>
                <p className="text-center text-[11px] text-slate-450 font-bold">
                  Not your account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      logout();
                      navigate(`/login?invite=${token}`);
                    }}
                    className="text-indigo-650 hover:underline font-extrabold cursor-pointer"
                  >
                    Sign out & Switch
                  </button>
                </p>
              </div>
            ) : (
              <div className="space-y-3.5">
                <button
                  type="button"
                  onClick={() => navigate(`/register?invite=${token}`)}
                  className="btn-active-scale w-full rounded-lg bg-slate-900 px-4 py-3 text-xs font-bold text-white hover:bg-slate-800 transition cursor-pointer"
                >
                  Create Account to Join
                </button>
                <p className="text-center text-xs text-slate-500 font-bold">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => navigate(`/login?invite=${token}`)}
                    className="text-indigo-650 hover:underline font-extrabold cursor-pointer"
                  >
                    Sign in to Join
                  </button>
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Route tree
// ---------------------------------------------------------------------------
function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/join/:token" element={<JoinPage />} />
      <Route
        path="/workspace/new"
        element={
          <ProtectedRoute>
            <CreateWorkspacePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/workspace/:workspaceId"
        element={
          <ProtectedRoute>
            <WorkspaceDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/workspace/:workspaceId/boards"
        element={
          <ProtectedRoute>
            <BoardsListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/workspace/:workspaceId/boards/:boardId"
        element={
          <ProtectedRoute>
            <BoardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/workspace/:workspaceId/ai"
        element={
          <ProtectedRoute>
            <AIInsightsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/workspace/:workspaceId/settings"
        element={
          <ProtectedRoute>
            <WorkspaceSettings />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        }
      />
      {/* 404 — catch all unmatched routes */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

// ---------------------------------------------------------------------------
// Root App
// ---------------------------------------------------------------------------
export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <WorkspaceProvider>
            <SocketProvider>
              <div style={{ fontFamily: 'Inter, sans-serif' }}>
                <AppRoutes />
                <NetworkToastListener />
              </div>
            </SocketProvider>
          </WorkspaceProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
