export const storage = {
  getAccessToken: () => localStorage.getItem("accessToken"),

  getRefreshToken: () => localStorage.getItem("refreshToken"),

  getUser: () => {
    const user = localStorage.getItem("user");
    if (!user) return null;
    try {
      return JSON.parse(user);
    } catch {
      return null;
    }
  },

  setAccessToken(access) {
    localStorage.setItem("accessToken", access);
  },

  setRefreshToken(refresh) {
    localStorage.setItem("refreshToken", refresh);
  },

  setAuth(data) {
    localStorage.setItem("accessToken", data.access);
    localStorage.setItem("refreshToken", data.refresh);
    localStorage.setItem("user", JSON.stringify(data.user));
  },

  clear() {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
  },
};
