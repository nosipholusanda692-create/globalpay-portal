// src/utils/rateLimiter.js
// Client-side brute force protection (Security Requirement #4)
// Firebase Auth also enforces server-side rate limiting automatically.

const ATTEMPT_LIMIT = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

const STORAGE_KEY = "loginAttempts";

/**
 * Get current attempt data from sessionStorage
 */
const getAttemptData = () => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { count: 0, firstAttempt: null, lockedUntil: null };
  } catch {
    return { count: 0, firstAttempt: null, lockedUntil: null };
  }
};

/**
 * Save attempt data to sessionStorage
 */
const saveAttemptData = (data) => {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

/**
 * Check if the user is currently locked out
 * @returns {{ locked: boolean, remainingMs: number }}
 */
export const checkLockout = () => {
  const data = getAttemptData();
  if (data.lockedUntil && Date.now() < data.lockedUntil) {
    return { locked: true, remainingMs: data.lockedUntil - Date.now() };
  }
  // Clear expired lockout
  if (data.lockedUntil && Date.now() >= data.lockedUntil) {
    saveAttemptData({ count: 0, firstAttempt: null, lockedUntil: null });
  }
  return { locked: false, remainingMs: 0 };
};

/**
 * Record a failed login attempt
 * @returns {{ locked: boolean, attemptsLeft: number }}
 */
export const recordFailedAttempt = () => {
  const data = getAttemptData();
  const now = Date.now();

  const newCount = data.count + 1;
  if (newCount >= ATTEMPT_LIMIT) {
    const lockedUntil = now + LOCKOUT_DURATION_MS;
    saveAttemptData({ count: newCount, firstAttempt: data.firstAttempt || now, lockedUntil });
    return { locked: true, attemptsLeft: 0 };
  }

  saveAttemptData({ count: newCount, firstAttempt: data.firstAttempt || now, lockedUntil: null });
  return { locked: false, attemptsLeft: ATTEMPT_LIMIT - newCount };
};

/**
 * Clear attempt data after successful login
 */
export const clearAttempts = () => {
  sessionStorage.removeItem(STORAGE_KEY);
};

/**
 * Format remaining lockout time for display
 */
export const formatLockoutTime = (remainingMs) => {
  const minutes = Math.ceil(remainingMs / 60000);
  return `${minutes} minute${minutes !== 1 ? "s" : ""}`;
};
