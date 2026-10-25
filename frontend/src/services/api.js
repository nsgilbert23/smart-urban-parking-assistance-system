import axios from "axios";
import { storage } from "../utils/storage";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000/api",
  headers: {
    "Content-Type": "application/json",
  },
});

let refreshPromise = null;

// Add JWT access token to protected requests
api.interceptors.request.use(
  (config) => {
    const access = storage.getAccessToken();

    const publicEndpoints = [
      "/auth/login/",
      "/auth/register/",
      "/auth/google/",
      "/auth/token/",
      "/auth/token/refresh/",
      "/auth/logout/",
      "/auth/password-reset/",
    ];

    const isPublicEndpoint = publicEndpoints.some((endpoint) =>
      config.url?.includes(endpoint)
    );

    if (isPublicEndpoint) {
      delete config.headers.Authorization;
    } else if (access) {
      config.headers.Authorization = `Bearer ${access}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const request = error.config;
    const url = request?.url || "";
    const isPublicAuthRequest = [
      "/auth/login/",
      "/auth/register/",
      "/auth/google/",
      "/auth/token/",
      "/auth/logout/",
      "/auth/password-reset/",
    ].some((endpoint) => url.includes(endpoint));

    if (error.response?.status !== 401 || !request || request._retry || isPublicAuthRequest) {
      return Promise.reject(error);
    }

    const refresh = storage.getRefreshToken();
    if (!refresh) {
      storage.clear();
      window.dispatchEvent(new Event("supas:session-expired"));
      return Promise.reject(error);
    }

    request._retry = true;
    if (!refreshPromise) {
      refreshPromise = axios
        .post(`${api.defaults.baseURL}/auth/token/refresh/`, { refresh })
        .then(({ data }) => {
          storage.setAccessToken(data.access);
          if (data.refresh) storage.setRefreshToken(data.refresh);
          return data.access;
        })
        .catch((refreshError) => {
          storage.clear();
          window.dispatchEvent(new Event("supas:session-expired"));
          throw refreshError;
        })
        .finally(() => {
          refreshPromise = null;
        });
    }

    try {
      const access = await refreshPromise;
      request.headers = request.headers || {};
      request.headers.Authorization = `Bearer ${access}`;
      return api(request);
    } catch {
      return Promise.reject(error);
    }
  }
);

export default api;
