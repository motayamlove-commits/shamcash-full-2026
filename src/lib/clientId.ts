// Client ID management utility
// Generates and stores a unique client ID for each browser/device

const CLIENT_ID_KEY = 'newsham_client_id';

/**
 * Get or create a unique client ID for the current browser/device
 * The ID persists in localStorage and is used to link all user data
 */
export function getClientId(): string {
  // Try to get existing client ID from localStorage
  let clientId = localStorage.getItem(CLIENT_ID_KEY);
  
  // If no client ID exists, create a new one
  if (!clientId) {
    // Generate a unique ID (UUID v4 format)
    clientId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
    
    // Store in localStorage
    localStorage.setItem(CLIENT_ID_KEY, clientId);
  }
  
  return clientId;
}

/**
 * Get the client ID, creating one if it doesn't exist
 * Also stores it in sessionStorage for easy access during the session
 */
export function initClientId(): string {
  const clientId = getClientId();
  
  // Also store in sessionStorage for easier access during the session
  if (!sessionStorage.getItem(CLIENT_ID_KEY)) {
    sessionStorage.setItem(CLIENT_ID_KEY, clientId);
  }
  
  return clientId;
}

/**
 * Clear the client ID (for testing or logout)
 */
export function clearClientId(): void {
  localStorage.removeItem(CLIENT_ID_KEY);
  sessionStorage.removeItem(CLIENT_ID_KEY);
}
