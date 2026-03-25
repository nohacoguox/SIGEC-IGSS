import axios from 'axios';

// Crea una instancia de Axios (base URL desde env o por defecto localhost:3001)
const baseURL = process.env.REACT_APP_API_URL
  ? `${process.env.REACT_APP_API_URL.replace(/\/$/, '')}/api`
  : 'http://localhost:3001/api';

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
    const isLoginRequest = config.url?.includes('/auth/login');

    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }
    if (token && !isLoginRequest) {
      config.headers.Authorization = `Bearer ${token}`; // Añade el token al encabezado de autorización
      console.log(`[API] Token adjuntado a solicitud ${config.method?.toUpperCase()} ${config.url}`);
    } else if (!token && !isLoginRequest) {
      // Solo advertir si no es una solicitud de login y no hay token
      console.warn(`[API] No se encontró token para solicitud ${config.method?.toUpperCase()} ${config.url}`);
    }
    // Si es una solicitud de login, simplemente continúa sin hacer nada.
    return config;
  },
  (error) => Promise.reject(error)
);

export default api;