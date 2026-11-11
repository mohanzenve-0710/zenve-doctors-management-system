import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api, { clearToken, getToken, storeToken } from './api';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [doctor, setDoctor] = useState(null);
  const [loading, setLoading] = useState(!!getToken());

  useEffect(() => {
    if (!getToken()) return;
    api.get('/auth/me')
      .then((r) => setDoctor(r.data.doctor))
      .catch(() => clearToken())
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email, password, remember) => {
    const r = await api.post('/auth/login', { email, password, remember });
    storeToken(r.data.token, remember);
    setDoctor(r.data.doctor);
  }, []);

  const logout = useCallback(async () => {
    try { await api.post('/auth/logout'); } catch { /* token may already be invalid */ }
    clearToken();
    setDoctor(null);
  }, []);

  const refresh = useCallback(async () => {
    const r = await api.get('/auth/me');
    setDoctor(r.data.doctor);
  }, []);

  return (
    <AuthContext.Provider value={{ doctor, loading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}
