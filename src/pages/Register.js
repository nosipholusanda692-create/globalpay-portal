// src/pages/Register.js
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../components/AuthContext";
import { validateRegistration, validateField } from "../utils/validators";

const EyeIcon = ({ show }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    {show ? (
      <>
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </>
    ) : (
      <>
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </>
    )}
  </svg>
);

const getStrength = (password) => {
  if (!password) return { score: 0, label: "", color: "" };
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[@$!%*?&_\-#]/.test(password)) score++;
  if (password.length >= 12) score++;

  const levels = [
    { label: "Very Weak", color: "#e74c3c" },
    { label: "Weak",      color: "#e67e22" },
    { label: "Fair",      color: "#f39c12" },
    { label: "Strong",    color: "#27ae60" },
    { label: "Very Strong", color: "#2ecc71" },
  ];
  return { score, ...levels[Math.min(score, 4)] };
};

export default function Register() {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [form, setForm] = useState({
    fullName: "", idNumber: "", accountNumber: "",
    username: "", password: "", confirmPassword: "",
  });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [globalError, setGlobalError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const strength = getStrength(form.password);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    // Live validation after first touch
    if (touched[name]) {
      if (name === "confirmPassword") {
        setErrors((prev) => ({
          ...prev,
          confirmPassword: value !== form.password ? "Passwords do not match." : null,
        }));
      } else {
        const result = validateField(name, value);
        setErrors((prev) => ({ ...prev, [name]: result.valid ? null : result.error }));
      }
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    if (name === "confirmPassword") {
      setErrors((prev) => ({
        ...prev,
        confirmPassword: value !== form.password ? "Passwords do not match." : null,
      }));
    } else {
      const result = validateField(name, value);
      setErrors((prev) => ({ ...prev, [name]: result.valid ? null : result.error }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGlobalError("");

    const { valid, errors: validationErrors } = validateRegistration(form);
    if (!valid) {
      setErrors(validationErrors);
      setTouched({ fullName: true, idNumber: true, accountNumber: true, username: true, password: true, confirmPassword: true });
      return;
    }

    setLoading(true);
    try {
      await register(form);
      setSuccess(true);
      setTimeout(() => navigate("/dashboard"), 2000);
    } catch (err) {
      if (err.code === "auth/email-already-in-use") {
        setGlobalError("That username is already registered. Please choose another.");
      } else if (err.code === "auth/weak-password") {
        setGlobalError("Password is too weak. Please use a stronger password.");
      } else {
        setGlobalError("Registration failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const inputClass = (field) => {
    if (!touched[field]) return "form-input";
    return `form-input ${errors[field] ? "error" : "success"}`;
  };

  if (success) {
    return (
      <div className="page-center">
        <div className="card page-enter" style={{ textAlign: "center" }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>✅</div>
          <h2 className="page-title">Account Created!</h2>
          <p className="page-subtitle">Redirecting you to your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-center">
      <div className="card card-wide page-enter">
        <div className="brand">
          <div className="brand-icon">🏦</div>
          <div>
            <div className="brand-name">GlobalPay</div>
            <div className="brand-tagline">International Banking</div>
          </div>
        </div>

        <h1 className="page-title">Create Account</h1>
        <p className="page-subtitle">Register to access international payments</p>

        {globalError && (
          <div className="alert alert-error">⚠ {globalError}</div>
        )}

        <form onSubmit={handleSubmit} noValidate autoComplete="off">
          {/* Full Name */}
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input
              type="text" name="fullName" className={inputClass("fullName")}
              placeholder="e.g. John Smith"
              value={form.fullName} onChange={handleChange} onBlur={handleBlur}
              maxLength={60} autoComplete="off"
            />
            {touched.fullName && errors.fullName && (
              <div className="field-error">⚠ {errors.fullName}</div>
            )}
          </div>

          <div className="form-row">
            {/* ID Number */}
            <div className="form-group">
              <label className="form-label">SA ID Number</label>
              <input
                type="text" name="idNumber" className={inputClass("idNumber")}
                placeholder="13-digit ID number"
                value={form.idNumber} onChange={handleChange} onBlur={handleBlur}
                maxLength={13} inputMode="numeric" autoComplete="off"
              />
              {touched.idNumber && errors.idNumber && (
                <div className="field-error">⚠ {errors.idNumber}</div>
              )}
            </div>

            {/* Account Number */}
            <div className="form-group">
              <label className="form-label">Account Number</label>
              <input
                type="text" name="accountNumber" className={inputClass("accountNumber")}
                placeholder="8–12 digit account no."
                value={form.accountNumber} onChange={handleChange} onBlur={handleBlur}
                maxLength={12} inputMode="numeric" autoComplete="off"
              />
              {touched.accountNumber && errors.accountNumber && (
                <div className="field-error">⚠ {errors.accountNumber}</div>
              )}
            </div>
          </div>

          {/* Username */}
          <div className="form-group">
            <label className="form-label">Username</label>
            <input
              type="text" name="username" className={inputClass("username")}
              placeholder="e.g. john_smith92"
              value={form.username} onChange={handleChange} onBlur={handleBlur}
              maxLength={30} autoComplete="off"
            />
            {touched.username && errors.username && (
              <div className="field-error">⚠ {errors.username}</div>
            )}
          </div>

          {/* Password */}
          <div className="form-group">
            <label className="form-label">Password</label>
            <div className="password-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                name="password" className={inputClass("password")}
                placeholder="Min 8 chars, uppercase, number, special"
                value={form.password} onChange={handleChange} onBlur={handleBlur}
                maxLength={64} autoComplete="new-password"
                style={{ paddingRight: "2.75rem" }}
              />
              <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)}>
                <EyeIcon show={showPassword} />
              </button>
            </div>
            {form.password && (
              <div className="strength-bar-container">
                <div className="strength-label">
                  <span>Password strength</span>
                  <span style={{ color: strength.color }}>{strength.label}</span>
                </div>
                <div className="strength-bar-track">
                  <div className="strength-bar-fill" style={{
                    width: `${(strength.score / 5) * 100}%`,
                    background: strength.color,
                  }} />
                </div>
              </div>
            )}
            {touched.password && errors.password && (
              <div className="field-error">⚠ {errors.password}</div>
            )}
          </div>

          {/* Confirm Password */}
          <div className="form-group">
            <label className="form-label">Confirm Password</label>
            <div className="password-wrapper">
              <input
                type={showConfirm ? "text" : "password"}
                name="confirmPassword" className={inputClass("confirmPassword")}
                placeholder="Re-enter your password"
                value={form.confirmPassword} onChange={handleChange} onBlur={handleBlur}
                maxLength={64} autoComplete="new-password"
                style={{ paddingRight: "2.75rem" }}
              />
              <button type="button" className="password-toggle" onClick={() => setShowConfirm(!showConfirm)}>
                <EyeIcon show={showConfirm} />
              </button>
            </div>
            {touched.confirmPassword && errors.confirmPassword && (
              <div className="field-error">⚠ {errors.confirmPassword}</div>
            )}
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? <><span className="spinner" />Creating account...</> : "Create Account →"}
          </button>
        </form>

        <div className="security-panel">
          <div className="security-panel-title">🔒 Security Features Active</div>
          <ul>
            <li>Passwords hashed & salted by Firebase (bcrypt)</li>
            <li>All inputs validated with RegEx whitelisting</li>
            <li>XSS protection via input sanitization</li>
            <li>Served over HTTPS/SSL</li>
          </ul>
        </div>

        <div className="link-text">
          Already have an account?{" "}
          <button className="link-btn" onClick={() => navigate("/login")}>Sign in</button>
        </div>
      </div>
    </div>
  );
}
