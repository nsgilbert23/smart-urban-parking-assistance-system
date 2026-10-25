import { useEffect, useState } from "react";
import api from "../services/api";
import { storage } from "../utils/storage";
import { AuthContext } from "./authContextValue";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(storage.getUser());

  useEffect(() => {
    const handleExpiredSession = () => setUser(null);
    window.addEventListener("supas:session-expired", handleExpiredSession);
    return () => window.removeEventListener("supas:session-expired", handleExpiredSession);
  }, []);

  async function login(credentials) {
    const response = await api.post("/auth/login/", credentials);

    storage.setAuth(response.data);

    setUser(response.data.user);

    return response.data;
  }

  async function loginWithGoogle(credential) {
    const response = await api.post("/auth/google/", { credential });
    storage.setAuth(response.data);
    setUser(response.data.user);
    return response.data;
  }

  function logout() {
    const refresh = storage.getRefreshToken();
    if (refresh) api.post("/auth/logout/", { refresh }).catch(() => {});
    storage.clear();
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        loginWithGoogle,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
