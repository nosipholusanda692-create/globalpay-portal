// src/utils/csrf.js
// CSRF Protection — generates and validates tokens to prevent Cross-Site Request Forgery
// A CSRF token is a unique random value tied to the user's session.
// Every form submission must include a valid token — if it doesn't match, the request is rejected.

const TOKEN_KEY = "csrf_token";

/**
 * Generate a cryptographically secure CSRF token and store it in sessionStorage
 */
export const generateCSRFToken = () => {
  const array = new Uint8Array(32);
  window.crypto.getRandomValues(array);
  const token = Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
  sessionStorage.setItem(TOKEN_KEY, token);
  return token;
};

/**
 * Get the current CSRF token, generating one if it doesn't exist
 */
export const getCSRFToken = () => {
  let token = sessionStorage.getItem(TOKEN_KEY);
  if (!token) token = generateCSRFToken();
  return token;
};

/**
 * Validate a submitted token against the stored token
 * @param {string} submittedToken - token from the form submission
 * @returns {boolean}
 */
export const validateCSRFToken = (submittedToken) => {
  const storedToken = sessionStorage.getItem(TOKEN_KEY);
  if (!storedToken || !submittedToken) return false;
  // Constant-time comparison to prevent timing attacks
  if (storedToken.length !== submittedToken.length) return false;
  let mismatch = 0;
  for (let i = 0; i < storedToken.length; i++) {
    mismatch |= storedToken.charCodeAt(i) ^ submittedToken.charCodeAt(i);
  }
  return mismatch === 0;
};

/**
 * Rotate the CSRF token after successful form submission
 */
export const rotateCSRFToken = () => {
  sessionStorage.removeItem(TOKEN_KEY);
  return generateCSRFToken();
};
