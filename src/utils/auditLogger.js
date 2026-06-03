// src/utils/auditLogger.js
// Audit Logging — records all employee actions with timestamp, user, and details
// This provides a tamper-evident trail for compliance and security investigations

import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/config";

/**
 * Log an employee action to the audit_logs collection in Firestore
 * @param {string} uid - employee's Firebase UID
 * @param {string} username - employee's username
 * @param {string} action - action type (e.g. "VERIFY_TRANSACTION", "SUBMIT_TO_SWIFT")
 * @param {object} details - additional context
 */
export const logAuditEvent = async (uid, username, action, details = {}) => {
  try {
    await addDoc(collection(db, "audit_logs"), {
      uid,
      username,
      action,
      details,
      timestamp: serverTimestamp(),
      userAgent: navigator.userAgent,
      // Never log sensitive data like passwords or full account numbers
    });
  } catch (err) {
    // Silently fail — don't break the UI if logging fails
    console.warn("Audit log failed:", err.message);
  }
};

export const AUDIT_ACTIONS = {
  LOGIN:            "EMPLOYEE_LOGIN",
  LOGOUT:           "EMPLOYEE_LOGOUT",
  VIEW_TRANSACTIONS:"VIEW_TRANSACTIONS",
  VERIFY_TX:        "VERIFY_TRANSACTION",
  UNVERIFY_TX:      "UNVERIFY_TRANSACTION",
  SUBMIT_SWIFT:     "SUBMIT_TO_SWIFT",
  SESSION_TIMEOUT:  "SESSION_TIMEOUT",
};
