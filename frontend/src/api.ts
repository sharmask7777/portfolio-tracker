import axios from 'axios';

export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:3001'),
};

const api = axios.create({
  baseURL: API_CONFIG.BASE_URL,
});

// Add a request interceptor to include the JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add a response interceptor to handle 401 Unauthorized
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isAuthRoute = error.config?.url?.includes('/auth/login') || error.config?.url?.includes('/auth/register');
    if (error.response?.status === 401 && localStorage.getItem('bypass-auth') !== 'true' && !isAuthRoute) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;

export const API_ENDPOINTS = {
  AUTH: `${API_CONFIG.BASE_URL}/api/auth`,
  PORTFOLIO: `${API_CONFIG.BASE_URL}/api/portfolio`,
  TAX: `${API_CONFIG.BASE_URL}/api/tax`,
  FAMILY: `${API_CONFIG.BASE_URL}/api/family`,
  HEALTH: `${API_CONFIG.BASE_URL}/api/health`,
};
