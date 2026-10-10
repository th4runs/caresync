import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, getToken, setToken } from '../lib/api';
import { disconnectSocket } from '../lib/socket';

const AuthContext = createContext(null);

export const HOME_FOR_ROLE = { PATIENT: '/patient', DOCTOR: '/doctor', ADMIN: '/admin' };

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  const [offline, setOffline] = useState(false);

  const loadMe = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setReady(true);
      return;
    }
    try {
      const { user } = await api.get('/auth/me');
      setUser(user);
      setOffline(false);
      setReady(true);
    } catch (e) {
      if (e.status === 401 || e.status === 403) {
        // The server rejected the session: log out
        setToken(null);
        setUser(null);
        setOffline(false);
        setReady(true);
      } else {
        // Network problem or server down: keep the login and try again
        setOffline(true);
      }
    }
  }, []);

  // Retry while the server can't be reached
  useEffect(() => {
    if (!offline) return;
    const t = setTimeout(loadMe, 3000);
    return () => clearTimeout(t);
  }, [offline, loadMe]);

  useEffect(() => {
    loadMe();
    const onLogout = () => setUser(null);
    window.addEventListener('caresync:logout', onLogout);
    return () => window.removeEventListener('caresync:logout', onLogout);
  }, [loadMe]);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    disconnectSocket();
    setToken(res.token);
    const { user } = await api.get('/auth/me');
    setUser(user);
    return user;
  };

  const register = async (data) => {
    const res = await api.post('/auth/register', data);
    setToken(res.token);
    const { user } = await api.get('/auth/me');
    setUser(user);
    return user;
  };

  const logout = () => {
    disconnectSocket();
    setToken(null);
    setUser(null);
  };

  if (!ready && offline) {
    return (
      <div className="min-h-screen bg-canvas flex flex-col items-center justify-center px-6 text-center">
        <div className="h-6 w-6 rounded-full border-2 border-brand-200 border-t-brand-600 animate-spin" />
        <p className="mt-4 font-medium">Can't reach CareSync right now</p>
        <p className="text-sm text-ink-muted mt-1">Check your internet connection. We'll keep trying and you'll stay logged in.</p>
        <button onClick={loadMe} className="mt-4 text-sm font-medium text-brand-600 hover:underline">
          Try again now
        </button>
      </div>
    );
  }

  return <AuthContext.Provider value={{ user, ready, login, register, logout, refresh: loadMe }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
