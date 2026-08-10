import { createContext, useState } from "react";
import api from "../services/api";
import { storage } from "../utils/storage";

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(storage.getUser());

  async function login(credentials) {
    const response = await api.post("/auth/login/", credentials);

    storage.setAuth(response.data);

    setUser(response.data.user);

    return response.data;
  }

  function logout() {
    storage.clear();
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}