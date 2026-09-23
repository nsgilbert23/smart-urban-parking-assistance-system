import axios from "axios";
import { storage } from "../utils/storage";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000/api",
  headers: {
    "Content-Type": "application/json",
  },
});

// Add JWT access token to protected requests
api.interceptors.request.use(
  (config) => {
    const access = storage.getAccessToken();

    const publicEndpoints = [
      "/auth/login/",
      "/auth/register/",
      "/auth/token/",
      "/auth/token/refresh/",
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

export default api;
