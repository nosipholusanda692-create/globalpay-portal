// src/utils/validators.js
// Full input whitelisting using RegEx patterns (Security Requirement #2)

export const PATTERNS = {
  // Full name: letters, spaces, hyphens, apostrophes only
  fullName: /^[a-zA-Z\s'\-]{2,60}$/,

  // South African ID number: 13 digits
  idNumber: /^\d{13}$/,

  // Account number: 8–12 digits
  accountNumber: /^\d{8,12}$/,

  // Password: min 8 chars, at least 1 uppercase, 1 lowercase, 1 digit, 1 special char
  password: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&_\-#])[A-Za-z\d@$!%*?&_\-#]{8,64}$/,

  // Username: alphanumeric + underscores, 3–30 chars
  username: /^[a-zA-Z0-9_]{3,30}$/,

  // Payment amount: positive number, up to 2 decimal places, max 10 million
  amount: /^\d{1,7}(\.\d{1,2})?$/,

  // SWIFT/BIC code: 8 or 11 alphanumeric characters
  swiftCode: /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/,

  // Recipient account / IBAN: alphanumeric, 8–34 chars
  recipientAccount: /^[A-Z0-9]{8,34}$/,

  // Currency: exactly 3 uppercase letters (ISO 4217)
  currency: /^[A-Z]{3}$/,
};

export const ERROR_MESSAGES = {
  fullName: "Full name must be 2–60 letters only (no numbers or special characters).",
  idNumber: "ID number must be exactly 13 digits.",
  accountNumber: "Account number must be 8–12 digits.",
  password:
    "Password must be 8–64 characters with at least one uppercase letter, lowercase letter, number, and special character (@$!%*?&_-#).",
  username: "Username must be 3–30 characters (letters, numbers, underscores only).",
  amount: "Amount must be a positive number up to 10,000,000 with max 2 decimal places.",
  swiftCode: "SWIFT code must be 8 or 11 characters (e.g. ABCDZAJJ or ABCDZAJJXXX).",
  recipientAccount: "Recipient account must be 8–34 uppercase alphanumeric characters.",
  currency: "Currency must be a valid 3-letter ISO code (e.g. USD, EUR, GBP).",
};

/**
 * Sanitize a string to prevent XSS — strip HTML tags and dangerous chars
 */
export const sanitizeInput = (value) => {
  return String(value)
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;")
    .trim();
};

/**
 * Validate a single field against its pattern
 * @param {string} field - key from PATTERNS
 * @param {string} value - raw input value
 * @returns {{ valid: boolean, error: string|null }}
 */
export const validateField = (field, value) => {
  if (!value || value.trim() === "") {
    return { valid: false, error: "This field is required." };
  }
  const pattern = PATTERNS[field];
  if (!pattern) return { valid: true, error: null };

  // For SWIFT code: convert to uppercase before testing
  const testValue = ["swiftCode", "recipientAccount", "currency"].includes(field)
    ? value.toUpperCase()
    : value;

  if (!pattern.test(testValue)) {
    return { valid: false, error: ERROR_MESSAGES[field] };
  }
  return { valid: true, error: null };
};

/**
 * Validate the full registration form
 */
export const validateRegistration = ({ fullName, idNumber, accountNumber, username, password, confirmPassword }) => {
  const errors = {};

  const fields = { fullName, idNumber, accountNumber, username, password };
  for (const [key, val] of Object.entries(fields)) {
    const result = validateField(key, val);
    if (!result.valid) errors[key] = result.error;
  }

  if (!confirmPassword || confirmPassword.trim() === "") {
    errors.confirmPassword = "Please confirm your password.";
  } else if (password !== confirmPassword) {
    errors.confirmPassword = "Passwords do not match.";
  }

  return { valid: Object.keys(errors).length === 0, errors };
};

/**
 * Validate the login form
 */
export const validateLogin = ({ username, accountNumber, password }) => {
  const errors = {};
  const fields = { username, accountNumber, password };
  for (const [key, val] of Object.entries(fields)) {
    if (!val || val.trim() === "") {
      errors[key] = "This field is required.";
    }
  }
  return { valid: Object.keys(errors).length === 0, errors };
};

/**
 * Validate the payment form
 */
export const validatePayment = ({ amount, currency, swiftCode, recipientAccount }) => {
  const errors = {};
  const fields = { amount, currency, swiftCode, recipientAccount };
  for (const [key, val] of Object.entries(fields)) {
    const result = validateField(key, val);
    if (!result.valid) errors[key] = result.error;
  }
  return { valid: Object.keys(errors).length === 0, errors };
};
