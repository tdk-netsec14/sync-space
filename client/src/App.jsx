import React, { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
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
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider, useAuth } from './context/AuthContext';
import { WorkspaceProvider, useWorkspace } from './context/WorkspaceContext';
import { SocketProvider } from './context/SocketContext';
import { getInviteInfo, joinInvite } from './services/api';

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
        if (active) {
          setState({ loading: false, info: response.data, error: '' });
        }
      } catch (error) {
        if (active) {
          setState({ loading: false, info: null, error: 'Invite link is invalid or expired.' });
        }
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
      if (reloadWorkspaces) {
        await reloadWorkspaces();
      }
      if (state.info?.workspace?.id) {
        navigate(`/workspace/${state.info.workspace.id}`);
      } else {
        navigate('/workspace/new');
      }
    } catch (error) {
      setState((current) => ({ ...current, error: error.response?.data?.error || 'Unable to join workspace' }));
    }
  }

  if (state.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50/50 text-xs font-bold text-slate-400 uppercase tracking-widest animate-pulse">
        Fetching Invitation Data...
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50/50 px-6 font-sans antialiased">
      <div className="w-full max-w-md rounded-2xl border border-slate-100 bg-white p-8 shadow-2xl animate-fade-in">
        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Collaboration Request</p>
        <h1 className="text-xl font-black text-slate-900 tracking-tight mt-1 leading-none">Join workspace</h1>
        
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
                  <>You are already an active member of the workspace <span className="text-indigo-650 font-extrabold">{state.info.workspace.name}</span>.</>
                ) : (
                  <>You have been invited to join the workspace <span className="text-indigo-650 font-extrabold">{state.info.workspace.name}</span> in the capacity of <span className="text-slate-800 font-extrabold uppercase tracking-wide">{state.info.role}</span>.</>
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
                className="btn-active-scale w-full rounded-lg bg-indigo-650 px-4 py-3 text-xs font-bold text-white hover:bg-indigo-750 transition shadow-md shadow-indigo-100 cursor-pointer"
              >
                Go to Workspace Dashboard
              </button>
            ) : isAuthenticated ? (
              <div className="space-y-3.5">
                <button 
                  type="button" 
                  onClick={handleJoin} 
                  className="btn-active-scale w-full rounded-lg bg-indigo-650 px-4 py-3 text-xs font-bold text-white hover:bg-indigo-750 transition shadow-md shadow-indigo-100 cursor-pointer"
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
                    Sign out & Switch Accounts
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
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap';
    document.head.appendChild(link);

    return () => {
      document.head.removeChild(link);
    };
  }, []);

  return (
    <BrowserRouter>
      <AuthProvider>
        <WorkspaceProvider>
          <SocketProvider>
            <div style={{ fontFamily: 'Inter, sans-serif' }}>
              <AppRoutes />
            </div>
          </SocketProvider>
        </WorkspaceProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}