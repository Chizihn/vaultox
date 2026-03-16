import axios from "axios";
import { useAuthStore } from "../store";
import { getAccessToken, clearAuthSession } from "@/utils/session";

export interface PaginatedResponse<T> {
  data?: T[];
  items?: T[];
  events?: T[];
  total: number;
  page?: number;
  limit?: number;
  [key: string]: unknown;
}

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1",
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use(
  (config) => {
    const storeJwt = useAuthStore.getState().jwt;
    const cookieJwt = typeof window !== "undefined" ? getAccessToken() : "";
    const jwt = storeJwt || cookieJwt;
    if (jwt) {
      config.headers.Authorization = `Bearer ${jwt}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== "undefined") {
        clearAuthSession();
        window.dispatchEvent(new Event("vaultox:auth:expired"));
      } else {
        useAuthStore.getState().disconnect();
      }
    }
    return Promise.reject(error);
  },
);

export default api;
