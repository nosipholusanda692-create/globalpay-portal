// src/pages/EmployeeLogin.js
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useEmployeeAuth } from "../components/EmployeeAuthContext";
import { validateField } from "../utils/validators";
import { checkLockout, recordFailedAttempt, clearAttempts, formatLockoutTime } from "../utils/rateLimiter";
import { getCSRFToken, validateCSRFToken, rotateCSRFToken } from "../utils/csrf";

const EyeIcon = ({ show }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    {show ? (
      <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></>
    ) : (
      <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>
    )}
  </svg>
);

export default function EmployeeLogin() {
  const navigate = useNavigate();
  const { employeeLogin } = useEmployeeAuth();

  const [form, setForm]           = useState({ username: "", password: "" });
  const [errors, setErrors]       = useState({});
  const [touched, setTouched]     = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [globalError, setGlobalError]   = useState("");
  const [loading, setLoading]     = useState(false);
  const [lockout, setLockout]     = useState({ locked: false, remainingMs: 0 });
  const [attemptsLeft, setAttemptsLeft] = useState(null);
  const [csrfToken, setCsrfToken] = useState("");

  // Generate CSRF token on mount
  useEffect(() => {
    setCsrfToken(getCSRFToken());
    const check = () => setLockout(checkLockout());
    check();
    const interval = setInterval(check, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
    if (touched[name]) {
      if (!value.trim()) setErrors((p) => ({ ...p, [name]: "This field is required." }));
      else if (name === "username") {
        const r = validateField("username", value);
        setErrors((p) => ({ ...p, [name]: r.valid ? null : r.error }));
      } else setErrors((p) => ({ ...p, [name]: null }));
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched((p) => ({ ...p, [name]: true }));
    if (!value.trim()) setErrors((p) => ({ ...p, [name]: "This field is required." }));
    else if (name === "username") {
      const r = validateField("username", value);
      setErrors((p) => ({ ...p, [name]: r.valid ? null : r.error }));
    } else setErrors((p) => ({ ...p, [name]: null }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGlobalError("");
    setAttemptsLeft(null);

    // CSRF validation
    if (!validateCSRFToken(csrfToken)) {
      setGlobalError("Security token invalid. Please refresh the page and try again.");
      return;
    }

    const lockoutState = checkLockout();
    if (lockoutState.locked) { setLockout(lockoutState); return; }

    const newErrors = {};
    if (!form.username.trim()) newErrors.username = "This field is required.";
    else { const r = validateField("username", form.username); if (!r.valid) newErrors.username = r.error; }
    if (!form.password.trim()) newErrors.password = "This field is required.";
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors); setTouched({ username: true, password: true }); return;
    }

    setLoading(true);
    try {
      await employeeLogin({ username: form.username, password: form.password });
      clearAttempts();
      rotateCSRFToken(); // Rotate token after successful login
      navigate("/employee/dashboard");
    } catch (err) {
      const result = recordFailedAttempt();
      if (result.locked) {
        setLockout({ locked: true, remainingMs: 15 * 60 * 1000 });
        setGlobalError("Too many failed attempts. Account locked for 15 minutes.");
      } else {
        setAttemptsLeft(result.attemptsLeft);
        if (["auth/user-not-found","auth/wrong-password","auth/invalid-credential"].includes(err.code) || err.message === "Access denied. Employee accounts only.") {
          setGlobalError("Invalid credentials or insufficient access.");
        } else {
          setGlobalError("Login failed. Please try again.");
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const inputClass = (f) => `form-input${touched[f] && errors[f] ? " error" : ""}`;

  return (
    <div className="page-center">
      <div className="card page-enter">
        {/* Hidden CSRF token field */}
        <input type="hidden" name="_csrf" value={csrfToken} readOnly />

        <div className="brand">
          <div className="brand-icon">🏛️</div>
          <div className="brand-text">
            <div className="brand-name">Global<span>Pay</span></div>
            <div className="brand-tagline">Employee Portal</div>
          </div>
        </div>

        {/* Employee badge */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          gap: "0.5rem", marginBottom: "1.5rem",
          background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.2)",
          borderRadius: "99px", padding: "0.4rem 1rem",
        }}>
          <span style={{ fontSize: "0.7rem", color: "var(--gold)", letterSpacing: "0.15em", textTransform: "uppercase", fontWeight: 600 }}>
            🔐 Authorised Personnel Only
          </span>
        </div>

        <h1 className="page-title">Staff Sign In</h1>
        <p className="page-subtitle">Access restricted to registered bank employees</p>

        {lockout.locked && (
          <div className="alert alert-error">
            🔒 Account locked. Try again in <strong>{formatLockoutTime(lockout.remainingMs)}</strong>.
          </div>
        )}
        {globalError && !lockout.locked && (
          <div className="alert alert-error">⚠ {globalError}</div>
        )}
        {attemptsLeft !== null && attemptsLeft <= 3 && !lockout.locked && (
          <div className="alert alert-warning">
            ⚠ {attemptsLeft} attempt{attemptsLeft !== 1 ? "s" : ""} remaining before lockout.
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate autoComplete="off">
          <div className="form-group">
            <label className="form-label">Employee Username</label>
            <input
              type="text" name="username" className={inputClass("username")}
              placeholder="Your employee username"
              value={form.username} onChange={handleChange} onBlur={handleBlur}
              maxLength={30} autoComplete="off" disabled={lockout.locked}
            />
            {touched.username && errors.username && <div className="field-error">⚠ {errors.username}</div>}
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div className="password-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                name="password" className={inputClass("password")}
                placeholder="Your password"
                value={form.password} onChange={handleChange} onBlur={handleBlur}
                maxLength={64} autoComplete="current-password" disabled={lockout.locked}
                style={{ paddingRight: "2.75rem" }}
              />
              <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)}>
                <EyeIcon show={showPassword} />
              </button>
            </div>
            {touched.password && errors.password && <div className="field-error">⚠ {errors.password}</div>}
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading || lockout.locked}>
            {loading ? <><span className="spinner" />Signing in...</> : "Access Portal →"}
          </button>
        </form>

        <div className="security-panel">
          <div className="security-panel-title">🔒 Security Features Active</div>
          <ul>
            <li>CSRF token protection on every request</li>
            <li>Brute force protection (5 attempts → 15 min lockout)</li>
            <li>Session auto-timeout after 15 minutes inactivity</li>
            <li>All actions logged to tamper-evident audit trail</li>
            <li>Role-based access — employees only</li>
          </ul>
        </div>

        <div className="link-text" style={{ marginTop: "1rem" }}>
          <button className="link-btn" onClick={() => navigate("/login")}>← Customer Portal</button>
        </div>
      </div>
    </div>
  );
}
