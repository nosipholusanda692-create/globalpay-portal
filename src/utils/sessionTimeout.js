// src/utils/sessionTimeout.js
// Auto-logout after inactivity — protects against session hijacking
// If a user leaves their screen unattended, they are automatically signed out

const TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes inactivity
const WARNING_MS = 2 * 60 * 1000;  // Warn 2 minutes before logout
let timeoutId = null;
let warningId = null;
let onWarningCallback = null;
let onLogoutCallback = null;

const resetTimer = () => {
  clearTimeout(timeoutId);
  clearTimeout(warningId);

  warningId = setTimeout(() => {
    if (onWarningCallback) onWarningCallback();
  }, TIMEOUT_MS - WARNING_MS);

  timeoutId = setTimeout(() => {
    if (onLogoutCallback) onLogoutCallback();
  }, TIMEOUT_MS);
};

const EVENTS = ["mousedown", "mousemove", "keydown", "scroll", "touchstart", "click"];

export const startSessionTimer = (onWarning, onLogout) => {
  onWarningCallback = onWarning;
  onLogoutCallback = onLogout;

  EVENTS.forEach((event) => window.addEventListener(event, resetTimer, { passive: true }));
  resetTimer();
};

export const stopSessionTimer = () => {
  clearTimeout(timeoutId);
  clearTimeout(warningId);
  EVENTS.forEach((event) => window.removeEventListener(event, resetTimer));
  onWarningCallback = null;
  onLogoutCallback = null;
};
