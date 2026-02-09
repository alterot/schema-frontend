// Auto-detect environment
const isDev = import.meta.env.DEV; // Vite's built-in dev mode check

// Backend URL - auto-switch mellan local och production
export const BACKEND_URL = isDev 
  ? 'http://localhost:5000'
  : 'https://schema-backend-weym.onrender.com';

// Claude API URL - Cloudflare Worker proxy for secure API calls
export const CLAUDE_API_URL = import.meta.env.VITE_CLAUDE_API_URL || 'https://your-worker.your-subdomain.workers.dev';

// Mock mode toggle
export const USE_MOCK_MODE = true;

// API Endpoints
export const API_ENDPOINTS = {
  health: `${BACKEND_URL}/api/health`,
  generate: `${BACKEND_URL}/api/generate`,
  validate: `${BACKEND_URL}/api/validate`,
  schedule: (period) => `${BACKEND_URL}/api/schedule/${period}`,
  propose: `${BACKEND_URL}/api/propose`,
  simulate: `${BACKEND_URL}/api/simulate`,
  apply: `${BACKEND_URL}/api/apply`,
  personal: `${BACKEND_URL}/api/data/personal`,
  bemanningsbehov: `${BACKEND_URL}/api/data/bemanningsbehov`,
  regler: `${BACKEND_URL}/api/data/regler`,
};