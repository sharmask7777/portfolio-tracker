export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_URL || 'http://localhost:3001',
  MOCK_USER_ID: 'mock-user-123'
};

export const API_ENDPOINTS = {
  PORTFOLIO: `${API_CONFIG.BASE_URL}/api/portfolio`,
  TAX: `${API_CONFIG.BASE_URL}/api/tax`,
  FAMILY: `${API_CONFIG.BASE_URL}/api/family`,
  HEALTH: `${API_CONFIG.BASE_URL}/api/health`,
};
