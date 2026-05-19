export const API_CONFIG = {
  // In production, we use the relative path so the Nginx proxy handles it.
  // This ensures cross-device connectivity (phone, laptop) works without hardcoding IPs.
  BASE_URL: import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:3001'),
  MOCK_USER_ID: 'mock-user-123'
};

export const API_ENDPOINTS = {
  PORTFOLIO: `${API_CONFIG.BASE_URL}/api/portfolio`,
  TAX: `${API_CONFIG.BASE_URL}/api/tax`,
  FAMILY: `${API_CONFIG.BASE_URL}/api/family`,
  HEALTH: `${API_CONFIG.BASE_URL}/api/health`,
};
