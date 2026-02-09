// Toggle för att spara API tokens under utveckling
export const USE_MOCK_MODE = true; // Sätt till false för riktiga API-anrop

// API Configuration

// Backend URL - Flask server running OR-Tools constraint solver
export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://schema-backend-weym.onrender.com';

// Claude API URL - Cloudflare Worker proxy for secure API calls
// TODO: Replace with actual Cloudflare Worker URL when deployed
export const CLAUDE_API_URL = import.meta.env.VITE_CLAUDE_API_URL || 'https://your-worker.your-subdomain.workers.dev';

// API Endpoints
export const API_ENDPOINTS = {
  health: `${BACKEND_URL}/api/health`,
  generate: `${BACKEND_URL}/api/generate`,
  validate: `${BACKEND_URL}/api/validate`,
  schedule: (period) => `${BACKEND_URL}/api/schedule/${period}`,
  propose: `${BACKEND_URL}/api/propose`,
  simulate: `${BACKEND_URL}/api/simulate`,
  apply: `${BACKEND_URL}/api/apply`,
};