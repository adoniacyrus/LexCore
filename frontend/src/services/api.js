import axios from 'axios';

/**
 * Shared Axios client for LexCore API calls.
 * Auth headers are attached per-request by authService (no interceptors yet).
 */
// Prefer VITE_API_BASE_URL. In local dev use same-origin "/api" (Vite proxies to Django)
// so the browser does not call http://127.0.0.1:8000 from http://localhost:5173.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

export default api;
