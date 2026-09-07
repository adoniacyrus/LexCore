import axios from 'axios';

/**
 * Shared Axios client for LexCore API calls.
 *
 * Access tokens may be passed per-request by services; a request interceptor
 * always prefers the latest access token from localStorage so retries after
 * refresh use the new JWT. A response interceptor refreshes on 401.
 */

const ACCESS_KEY = 'lexcore_access';
const REFRESH_KEY = 'lexcore_refresh';
const USER_KEY = 'lexcore_user';

const AUTH_CLEARED_EVENT = 'lexcore:auth-cleared';
const TOKENS_UPDATED_EVENT = 'lexcore:tokens-updated';

import { API_BASE_URL } from './apiConfig';

const baseURL = API_BASE_URL;

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

/** Paths that must never trigger a token refresh (public auth or the refresh call itself). */
function isRefreshExemptUrl(url = '') {
  return [
    '/auth/login/',
    '/auth/register/',
    '/auth/google/',
    '/auth/forgot-password/',
    '/auth/reset-password/',
    '/auth/token/refresh/',
  ].some((path) => url.includes(path));
}

function clearStoredAuth() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
}

function persistRefreshedTokens({ access, refresh }) {
  if (access) {
    localStorage.setItem(ACCESS_KEY, access);
  }
  if (refresh) {
    localStorage.setItem(REFRESH_KEY, refresh);
  }
  window.dispatchEvent(
    new CustomEvent(TOKENS_UPDATED_EVENT, {
      detail: { access: access || null, refresh: refresh || null },
    })
  );
}

function forceLogoutSession() {
  clearStoredAuth();
  window.dispatchEvent(new Event(AUTH_CLEARED_EVENT));
  const path = window.location.pathname || '';
  if (!path.startsWith('/login') && !path.startsWith('/register')) {
    window.location.assign('/login');
  }
}

/** Single in-flight refresh so concurrent 401s share one POST. */
let refreshPromise = null;

async function refreshAccessToken() {
  const refresh = localStorage.getItem(REFRESH_KEY);
  if (!refresh) {
    throw new Error('Missing refresh token');
  }

  // Use bare axios (not `api`) so this call never enters the 401 interceptor.
  const refreshUrl = `${String(baseURL).replace(/\/$/, '')}/auth/token/refresh/`;
  const { data } = await axios.post(
    refreshUrl,
    { refresh },
    {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    }
  );

  if (!data?.access) {
    throw new Error('Refresh response missing access token');
  }

  // ROTATE_REFRESH_TOKENS may return a new refresh token — persist when present.
  persistRefreshedTokens({
    access: data.access,
    refresh: data.refresh || refresh,
  });

  return data.access;
}

function getSharedRefreshPromise() {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

api.interceptors.request.use((config) => {
  const url = config.url || '';
  if (isRefreshExemptUrl(url)) {
    return config;
  }

  const access = localStorage.getItem(ACCESS_KEY);
  if (access) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${access}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;
    const url = originalRequest?.url || '';

    if (status !== 401 || !originalRequest || originalRequest._lexcoreRetry) {
      return Promise.reject(error);
    }

    if (isRefreshExemptUrl(url)) {
      return Promise.reject(error);
    }

    originalRequest._lexcoreRetry = true;

    try {
      const newAccess = await getSharedRefreshPromise();
      originalRequest.headers = originalRequest.headers || {};
      originalRequest.headers.Authorization = `Bearer ${newAccess}`;
      return api(originalRequest);
    } catch {
      forceLogoutSession();
      return Promise.reject(error);
    }
  }
);

export {
  ACCESS_KEY,
  REFRESH_KEY,
  USER_KEY,
  AUTH_CLEARED_EVENT,
  TOKENS_UPDATED_EVENT,
};

export default api;
