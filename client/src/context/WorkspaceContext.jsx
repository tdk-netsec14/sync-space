import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { fetchWorkspaces, storageKeys } from '../services/api';
import { useAuth } from './AuthContext';

const WorkspaceContext = createContext(null);

export function WorkspaceProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [workspaces, setWorkspaces] = useState([]);
  const [currentWorkspace, setCurrentWorkspaceState] = useState(() => {
    const saved = localStorage.getItem(storageKeys.workspaceKey);
    return saved ? JSON.parse(saved) : null;
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      setWorkspaces([]);
      setIsLoading(false);
      return;
    }

    let active = true;

    async function loadWorkspaces() {
      try {
        const response = await fetchWorkspaces();
        if (!active) {
          return;
        }

        setWorkspaces(response.data.workspaces || []);

        const savedWorkspace = localStorage.getItem(storageKeys.workspaceKey);
        if (savedWorkspace) {
          const parsed = JSON.parse(savedWorkspace);
          const match = response.data.workspaces.find(
            (workspace) => String(workspace.id) === String(parsed.id)
          );
          if (match) {
            setCurrentWorkspaceState(match);
          }
        }
      } catch (error) {
        setWorkspaces([]);
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    loadWorkspaces();

    return () => {
      active = false;
    };
  }, [isAuthenticated]);

  const setCurrentWorkspace = useCallback((workspace) => {
    setCurrentWorkspaceState(workspace);
    if (workspace) {
      localStorage.setItem(storageKeys.workspaceKey, JSON.stringify(workspace));
    } else {
      localStorage.removeItem(storageKeys.workspaceKey);
    }
  }, []);

  const reloadWorkspaces = useCallback(async () => {
    try {
      const response = await fetchWorkspaces();
      const list = response.data.workspaces || [];
      setWorkspaces(list);
      return list;
    } catch (error) {
      console.error('Failed to reload workspaces:', error);
      return [];
    }
  }, []);

  const value = useMemo(
    () => ({
      workspaces,
      currentWorkspace,
      isLoading,
      fetchWorkspaces,
      setCurrentWorkspace,
      reloadWorkspaces
    }),
    [workspaces, currentWorkspace, isLoading, setCurrentWorkspace, reloadWorkspaces]
  );


  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);

  if (!context) {
    throw new Error('useWorkspace must be used within WorkspaceProvider');
  }

  return context;
}

export default WorkspaceContext;
