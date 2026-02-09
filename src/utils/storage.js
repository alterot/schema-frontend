import { API_ENDPOINTS } from '../config';

const STORAGE_KEYS = {
  personal: 'schema_personal',
  bemanningsbehov: 'schema_bemanningsbehov',
};

/**
 * Hämta personal från localStorage, eller baseline från backend
 * @returns {Promise<Array>} Array med personal, eller tom array vid fel
 */
export async function loadStaffData() {
  const stored = localStorage.getItem(STORAGE_KEYS.personal);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      // Säkerställ att det är en array
      if (Array.isArray(parsed)) {
        return parsed;
      }
      console.warn('Stored staff data is not an array, fetching from backend');
    } catch (e) {
      console.error('Failed to parse stored staff data:', e);
    }
  }

  // Hämta baseline från backend
  try {
    const response = await fetch(API_ENDPOINTS.personal);
    if (!response.ok) {
      console.error('Backend returned error:', response.status, response.statusText);
      return [];
    }

    const data = await response.json();
    console.log('Backend personal response:', data);

    // Backend returnerar { personal: [...], antal: N }
    if (data && Array.isArray(data.personal)) {
      return data.personal;
    }

    // Fallback om det är en array direkt
    if (Array.isArray(data)) {
      return data;
    }

    console.error('Unexpected personal data format:', data);
    return [];
  } catch (e) {
    console.error('Failed to fetch baseline staff data:', e);
    return [];
  }
}

/**
 * Spara personal till localStorage
 */
export function saveStaffData(personal) {
  localStorage.setItem(STORAGE_KEYS.personal, JSON.stringify(personal));
}

/**
 * Hämta bemanningsbehov från localStorage, eller baseline från backend
 * @returns {Promise<Object|null>} Objekt med { vardag: {...}, helg: {...} }, eller null vid fel
 */
export async function loadRequirements() {
  const stored = localStorage.getItem(STORAGE_KEYS.bemanningsbehov);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      // Validera struktur
      if (parsed && typeof parsed === 'object' && parsed.vardag && parsed.helg) {
        return parsed;
      }
      console.warn('Stored requirements has invalid format, fetching from backend');
    } catch (e) {
      console.error('Failed to parse stored requirements:', e);
    }
  }

  // Hämta baseline från backend
  try {
    const response = await fetch(API_ENDPOINTS.bemanningsbehov);
    if (!response.ok) {
      console.error('Backend returned error:', response.status, response.statusText);
      return null;
    }

    const data = await response.json();
    console.log('Backend bemanningsbehov response:', data);

    // Backend returnerar { vardag: {...}, helg: {...} }
    if (data && typeof data === 'object' && data.vardag && data.helg) {
      return data;
    }

    console.error('Unexpected bemanningsbehov data format:', data);
    return null;
  } catch (e) {
    console.error('Failed to fetch baseline requirements:', e);
    return null;
  }
}

/**
 * Spara bemanningsbehov till localStorage
 */
export function saveRequirements(bemanningsbehov) {
  localStorage.setItem(STORAGE_KEYS.bemanningsbehov, JSON.stringify(bemanningsbehov));
}

/**
 * Återställ till baseline från backend
 */
export async function resetToBaseline() {
  localStorage.removeItem(STORAGE_KEYS.personal);
  localStorage.removeItem(STORAGE_KEYS.bemanningsbehov);

  const personal = await loadStaffData();
  const bemanningsbehov = await loadRequirements();

  return { personal, bemanningsbehov };
}

/**
 * Kontrollera om det finns lokala ändringar
 */
export function hasLocalChanges() {
  return localStorage.getItem(STORAGE_KEYS.personal) !== null ||
         localStorage.getItem(STORAGE_KEYS.bemanningsbehov) !== null;
}
