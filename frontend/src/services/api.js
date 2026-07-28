import axios from 'axios';

/**
 * Shared Axios client for LexCore API calls.
 * Auth headers are attached per-request by authService (no interceptors yet).
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

export default api;
