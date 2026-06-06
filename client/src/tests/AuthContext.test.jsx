/**
 * client/src/tests/AuthContext.test.jsx
 *
 * Unit tests for AuthContext — login/logout state transitions.
 *
 * We test the context in isolation by:
 *   1. Mocking the api module so no real HTTP calls are made.
 *   2. Rendering a minimal consumer component that reads from the context.
 *   3. Triggering login/logout via userEvent or direct function calls.
 *
 * Covers:
 *   - Initial unauthenticated state
 *   - login() sets token + user and isAuthenticated becomes true
 *   - logout() clears token + user and isAuthenticated becomes false
 *   - localStorage is written on login and cleared on logout
 *   - Persisted token in localStorage initialises state on mount
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../context/AuthContext';

// ---------------------------------------------------------------------------
// Mock the api module so AuthContext does not make real HTTP calls.
// fetchMe() is called on mount when a token is found in localStorage.
// ---------------------------------------------------------------------------
vi.mock('../services/api', () => ({
  fetchMe: vi.fn(),
  loginUser: vi.fn(),
  registerUser: vi.fn(),
  tokenKey: 'syncspace_token',
  storageKeys: {
    tokenKey: 'syncspace_token',
    userKey: 'syncspace_user',
    workspaceKey: 'syncspace_workspace'
  }
}));

import { fetchMe, storageKeys } from '../services/api';

// ---------------------------------------------------------------------------
// Helper — a minimal component that reads from AuthContext and exposes
// the values via data-testid attributes for easy assertions.
// ---------------------------------------------------------------------------
function AuthConsumer() {
  const { user, token, isAuthenticated, login, logout } = useAuth();

  return (
    <div>
      <span data-testid="is-authenticated">{String(isAuthenticated)}</span>
      <span data-testid="user-email">{user?.email ?? 'none'}</span>
      <span data-testid="token">{token || 'empty'}</span>
      <button
        data-testid="login-btn"
        onClick={() =>
          login('test-access-token', { id: '1', email: 'alice@example.com', name: 'Alice' })
        }
      >
        Login
      </button>
      <button data-testid="logout-btn" onClick={logout}>
        Logout
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderWithAuth() {
  return render(
    <AuthProvider>
      <AuthConsumer />
    </AuthProvider>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  // Clear localStorage and mocks before each test
  localStorage.clear();
  vi.clearAllMocks();

  // Default: fetchMe resolves but we don't have a token → isLoading settles fast
  fetchMe.mockResolvedValue({ data: { user: null } });
});

afterEach(() => {
  localStorage.clear();
});

describe('AuthContext', () => {
  it('starts in an unauthenticated state when no token is stored', async () => {
    renderWithAuth();

    await waitFor(() => {
      expect(screen.getByTestId('is-authenticated').textContent).toBe('false');
    });
    expect(screen.getByTestId('user-email').textContent).toBe('none');
    expect(screen.getByTestId('token').textContent).toBe('empty');
  });

  it('login() sets token and user, making isAuthenticated true', async () => {
    renderWithAuth();

    // Wait for initial load to settle
    await waitFor(() => {
      expect(screen.getByTestId('is-authenticated').textContent).toBe('false');
    });

    // Trigger login
    await act(async () => {
      screen.getByTestId('login-btn').click();
    });

    expect(screen.getByTestId('is-authenticated').textContent).toBe('true');
    expect(screen.getByTestId('user-email').textContent).toBe('alice@example.com');
    expect(screen.getByTestId('token').textContent).toBe('test-access-token');
  });

  it('login() persists token and user to localStorage', async () => {
    renderWithAuth();

    await waitFor(() => {
      expect(screen.getByTestId('is-authenticated').textContent).toBe('false');
    });

    await act(async () => {
      screen.getByTestId('login-btn').click();
    });

    expect(localStorage.getItem(storageKeys.tokenKey)).toBe('test-access-token');
    const stored = JSON.parse(localStorage.getItem(storageKeys.userKey));
    expect(stored.email).toBe('alice@example.com');
  });

  it('logout() clears token and user, making isAuthenticated false', async () => {
    // Pre-populate localStorage as if a session exists
    localStorage.setItem(storageKeys.tokenKey, 'existing-token');
    localStorage.setItem(
      storageKeys.userKey,
      JSON.stringify({ id: '1', email: 'alice@example.com', name: 'Alice' })
    );

    // fetchMe resolves with the user so AuthProvider accepts the saved token
    fetchMe.mockResolvedValue({
      data: { user: { id: '1', email: 'alice@example.com', name: 'Alice' } }
    });

    renderWithAuth();

    // Wait until the token is validated and the user is set
    await waitFor(() => {
      expect(screen.getByTestId('is-authenticated').textContent).toBe('true');
    });

    // Mock window.location.href assignment (jsdom doesn't navigate)
    const locationSpy = vi.spyOn(window, 'location', 'get').mockReturnValue({
      ...window.location,
      href: ''
    });
    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true
    });

    await act(async () => {
      screen.getByTestId('logout-btn').click();
    });

    expect(screen.getByTestId('is-authenticated').textContent).toBe('false');
    expect(screen.getByTestId('user-email').textContent).toBe('none');
    expect(localStorage.getItem(storageKeys.tokenKey)).toBeNull();
    expect(localStorage.getItem(storageKeys.userKey)).toBeNull();

    locationSpy.mockRestore();
  });

  it('restores authenticated state from localStorage on mount', async () => {
    // Pre-seed localStorage
    localStorage.setItem(storageKeys.tokenKey, 'persisted-token');
    localStorage.setItem(
      storageKeys.userKey,
      JSON.stringify({ id: '2', email: 'bob@example.com', name: 'Bob' })
    );

    // fetchMe confirms the stored token is still valid
    fetchMe.mockResolvedValue({
      data: { user: { id: '2', email: 'bob@example.com', name: 'Bob' } }
    });

    renderWithAuth();

    await waitFor(() => {
      expect(screen.getByTestId('is-authenticated').textContent).toBe('true');
      expect(screen.getByTestId('user-email').textContent).toBe('bob@example.com');
    });
  });

  it('clears state when fetchMe returns 401 for a stored (expired) token', async () => {
    localStorage.setItem(storageKeys.tokenKey, 'expired-token');
    localStorage.setItem(
      storageKeys.userKey,
      JSON.stringify({ id: '3', email: 'carol@example.com' })
    );

    // fetchMe rejects with a 401 — simulating an expired access token
    fetchMe.mockRejectedValue({ response: { status: 401 } });

    renderWithAuth();

    await waitFor(() => {
      expect(screen.getByTestId('is-authenticated').textContent).toBe('false');
    });

    expect(localStorage.getItem(storageKeys.tokenKey)).toBeNull();
  });
});
