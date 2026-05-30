import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { NguoiDung } from '../types';
import { layThongTinNguoiDung, logout as apiLogout } from '../services/api';

interface AuthContextType {
  user: NguoiDung | null;
  loading: boolean;
  setUser: (user: NguoiDung | null) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  setUser: () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<NguoiDung | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('bttd_token');
    const savedUser = localStorage.getItem('bttd_user');

    if (token && savedUser) {
      setUser(JSON.parse(savedUser));
      layThongTinNguoiDung()
        .then((u) => setUser(u))
        .catch(() => {
          localStorage.removeItem('bttd_token');
          localStorage.removeItem('bttd_user');
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const logout = async () => {
    try {
      await apiLogout();
    } catch { /* ignore */ }
    localStorage.removeItem('bttd_token');
    localStorage.removeItem('bttd_user');
    setUser(null);
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ user, loading, setUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
