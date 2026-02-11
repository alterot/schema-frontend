// Backend API Wrapper
// Provides clean interface for all backend tool endpoints
// All tool endpoints send localStorage data (personal/bemanningsbehov) to backend

import { API_ENDPOINTS } from '../config.js';
import { loadStaffData, loadRequirements } from '../utils/storage.js';

/**
 * Load localStorage overrides for backend calls.
 * Returns { personal, bemanningsbehov } or empty object if no local data.
 */
async function getLocalOverrides() {
  try {
    const [personal, bemanningsbehov] = await Promise.all([
      loadStaffData(),
      loadRequirements(),
    ]);
    const overrides = {};
    if (personal && personal.length > 0) overrides.personal = personal;
    if (bemanningsbehov) overrides.bemanningsbehov = bemanningsbehov;
    return overrides;
  } catch (e) {
    console.warn('[backend.js] Could not load local overrides:', e.message);
    return {};
  }
}

/**
 * Fetch schedule for a specific period
 * Tool: read_schedule
 * Sends localStorage data via POST so backend uses frontend settings.
 *
 * @param {string} period - Period in YYYY-MM format (e.g., "2025-04")
 * @returns {Promise<{schema: Array, metrics: Object}>}
 */
export async function fetchSchedule(period, { regenerate = false, personal_overrides } = {}) {
  const overrides = await getLocalOverrides();

  const body = { ...overrides, regenerate };
  if (personal_overrides) {
    body.personal_overrides = personal_overrides;
  }

  const response = await fetch(API_ENDPOINTS.schedule(period), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detaljer || error.error || 'Failed to fetch schedule');
  }

  return response.json();
}

/**
 * Propose changes based on a problem description
 * Tool: propose_changes
 *
 * @param {string} problem - Description of the problem to solve
 * @returns {Promise<{proposals: Array, reasoning: string}>}
 */
export async function proposeChanges(problem) {
  const overrides = await getLocalOverrides();

  const response = await fetch(API_ENDPOINTS.propose, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ problem, ...overrides }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detaljer || error.error || 'Failed to propose changes');
  }

  return response.json();
}

/**
 * Simulate impact of proposed changes
 * Tool: simulate_impact
 *
 * @param {Array} changes - List of proposed changes to simulate
 * @returns {Promise<{metrics_before: Object, metrics_after: Object, impact: string}>}
 */
export async function simulateImpact(changes) {
  const overrides = await getLocalOverrides();

  const response = await fetch(API_ENDPOINTS.simulate, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ changes, ...overrides }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detaljer || error.error || 'Failed to simulate impact');
  }

  return response.json();
}

/**
 * Apply confirmed changes to the schedule
 * Tool: apply_changes
 *
 * @param {Object} schema - The schedule to apply
 * @param {boolean} confirmed - Whether the changes are confirmed
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function applyChanges(schema, confirmed = false) {
  const response = await fetch(API_ENDPOINTS.apply, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ schema, confirmed }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detaljer || error.error || 'Failed to apply changes');
  }

  return response.json();
}

/**
 * Generate a full schedule from personal and requirements
 * Main generation endpoint
 *
 * @param {Object} data - { personal: Array, behov: Array, config: Object }
 * @returns {Promise<{schema: Array, konflikter: Array, metrics: Object, statistik: Object}>}
 */
export async function generateSchedule(data) {
  const response = await fetch(API_ENDPOINTS.generate, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detaljer || error.error || 'Failed to generate schedule');
  }

  return response.json();
}

/**
 * Health check for backend API
 *
 * @returns {Promise<{status: string, service: string, version: string}>}
 */
export async function healthCheck() {
  const response = await fetch(API_ENDPOINTS.health, {
    method: 'GET',
  });

  if (!response.ok) {
    throw new Error('Backend health check failed');
  }

  return response.json();
}
