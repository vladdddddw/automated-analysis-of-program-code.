import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { authApi } from "../api/mockApi.js";

const AuthContext = createContext(null);

// Стан автентифікації: поточний користувач і дії входу/виходу.
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // true, поки перевіряємо збережену сесію

  useEffect(() => {
    let alive = true;
    authApi.me().then((u) => {
      if (alive) {
        setUser(u);
        setLoading(false);
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  const login = useCallback(async (credentials) => setUser(await authApi.login(credentials)), []);
  const register = useCallback(async (data) => setUser(await authApi.register(data)), []);
  const logout = useCallback(() => {
    authApi.logout();
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, loading, login, register, logout }), [user, loading, login, register, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
