import axios from 'axios';

/** Base del API: REACT_APP_API_URL o hostname:3001 */
function resolveApiBaseUrl(): string {
  const fromEnv = process.env.REACT_APP_API_URL?.trim().replace(/\/$/, '');
  if (fromEnv) return `${fromEnv}/api`;

  if (typeof window !== 'undefined' && window.location?.hostname) {
    const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
    return `${protocol}//${window.location.hostname}:3001/api`;
  }

  return 'http://localhost:3001/api';
}

const baseURL = resolveApiBaseUrl();

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    const isPublicAuthRequest =
      config.url?.includes('/auth/login') || config.url?.includes('/auth/forgot-password');

    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }
    if (token && !isPublicAuthRequest) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default api;