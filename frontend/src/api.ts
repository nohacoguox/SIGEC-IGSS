import axios from 'axios';

/**
 * URL del API:
 * 1) REACT_APP_API_URL si está definida (sin /api; aquí se añade)
 * 2) Si no, mismo host desde el que abrieron el frontend + puerto 3001
 *    (así funciona en localhost y desde otra PC con la IP de la red)
 */
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

// Interceptor para añadir el token JWT a todas las solicitudes salientes
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token'); // Obtiene el token del almacenamiento local
    const isPublicAuthRequest =
      config.url?.includes('/auth/login') || config.url?.includes('/auth/forgot-password');

    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }
    if (token && !isPublicAuthRequest) {
      config.headers.Authorization = `Bearer ${token}`; // Añade el token al encabezado de autorización
      console.log(`[API] Token adjuntado a solicitud ${config.method?.toUpperCase()} ${config.url}`);
    } else if (!token && !isPublicAuthRequest) {
      // Solo advertir si no es una solicitud de login y no hay token
      console.warn(`[API] No se encontró token para solicitud ${config.method?.toUpperCase()} ${config.url}`);
    }
    // Si es una solicitud de login, simplemente continúa sin hacer nada.
    return config;
  },
  (error) => Promise.reject(error)
);

export default api;