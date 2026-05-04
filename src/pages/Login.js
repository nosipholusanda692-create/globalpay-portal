// src/pages/Login.js
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../components/AuthContext";
import { validateField } from "../utils/validators";
import {
    checkLockout,
    recordFailedAttempt,
    clearAttempts,
    formatLockoutTime,
} from "../utils/rateLimiter";

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

export default function Login() {
    const navigate = useNavigate();
    const { login } = useAuth();

    const [form, setForm] = useState({ username: "", password: "" });
    const [errors, setErrors] = useState({});
    const [touched, setTouched] = useState({});
    const [showPassword, setShowPassword] = useState(false);
    const [globalError, setGlobalError] = useState("");
    const [loading, setLoading] = useState(false);
    const [lockout, setLockout] = useState({ locked: false, remainingMs: 0 });
    const [attemptsLeft, setAttemptsLeft] = useState(null);

    useEffect(() => {
        const check = () => setLockout(checkLockout());
        check();
        const interval = setInterval(check, 1000);
        return () => clearInterval(interval);
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
        if (touched[name]) {
            if (!value.trim()) {
                setErrors((prev) => ({ ...prev, [name]: "This field is required." }));
            } else if (name === "username") {
                const result = validateField("username", value);
                setErrors((prev) => ({ ...prev, [name]: result.valid ? null : result.error }));
            } else {
                setErrors((prev) => ({ ...prev, [name]: null }));
            }
        }
    };

    const handleBlur = (e) => {
        const { name, value } = e.target;
        setTouched((prev) => ({ ...prev, [name]: true }));
        if (!value.trim()) {
            setErrors((prev) => ({ ...prev, [name]: "This field is required." }));
        } else if (name === "username") {
            const result = validateField("username", value);
            setErrors((prev) => ({ ...prev, [name]: result.valid ? null : result.error }));
        } else {
            setErrors((prev) => ({ ...prev, [name]: null }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setGlobalError("");
        setAttemptsLeft(null);

        const lockoutState = checkLockout();
        if (lockoutState.locked) { setLockout(lockoutState); return; }

        const newErrors = {};
        if (!form.username.trim()) newErrors.username = "This field is required.";
        else { const r = validateField("username", form.username); if (!r.valid) newErrors.username = r.error; }
        if (!form.password.trim()) newErrors.password = "This field is required.";

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            setTouched({ username: true, password: true });
            return;
        }

        setLoading(true);
        try {
            await login({ username: form.username, password: form.password });
            clearAttempts();
            navigate("/dashboard");
        } catch (err) {
            const result = recordFailedAttempt();
            if (result.locked) {
                setLockout({ locked: true, remainingMs: 15 * 60 * 1000 });
                setGlobalError("Too many failed attempts. Your account is locked for 15 minutes.");
            } else {
                setAttemptsLeft(result.attemptsLeft);
                if (["auth/user-not-found", "auth/wrong-password", "auth/invalid-credential"].includes(err.code)) {
                    setGlobalError("Invalid username or password.");
                } else if (err.code === "auth/too-many-requests") {
                    setGlobalError("Too many login attempts. Please try again later.");
                } else {
                    setGlobalError("Login failed. Please check your credentials and try again.");
                }
            }
        } finally {
            setLoading(false);
        }
    };

    const inputClass = (field) =>
        `form-input${touched[field] && errors[field] ? " error" : ""}`;

    return (
        <div className="page-center">
            <div className="card page-enter">
                <div className="brand">
                    <div className="brand-icon">🏦</div>
                    <div>
                        <div className="brand-name">GlobalPay</div>
                        <div className="brand-tagline">International Banking</div>
                    </div>
                </div>

                <h1 className="page-title">Welcome Back</h1>
                <p className="page-subtitle">Sign in to your account to continue</p>

                {lockout.locked && (
                    <div className="alert alert-error">
                        🔒 Account temporarily locked due to too many failed login attempts.
                        Please try again in <strong>{formatLockoutTime(lockout.remainingMs)}</strong>.
                    </div>
                )}
                {globalError && !lockout.locked && (
                    <div className="alert alert-error">⚠ {globalError}</div>
                )}
                {attemptsLeft !== null && attemptsLeft <= 3 && !lockout.locked && (
                    <div className="alert alert-warning">
                        ⚠ Warning: {attemptsLeft} attempt{attemptsLeft !== 1 ? "s" : ""} remaining before lockout.
                    </div>
                )}

                <form onSubmit={handleSubmit} noValidate autoComplete="off">
                    <div className="form-group">
                        <label className="form-label">Username</label>
                        <input
                            type="text" name="username" className={inputClass("username")}
                            placeholder="Your username"
                            value={form.username} onChange={handleChange} onBlur={handleBlur}
                            maxLength={30} autoComplete="off" disabled={lockout.locked}
                        />
                        {touched.username && errors.username && (
                            <div className="field-error">⚠ {errors.username}</div>
                        )}
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
                        {touched.password && errors.password && (
                            <div className="field-error">⚠ {errors.password}</div>
                        )}
                    </div>

                    <button type="submit" className="btn btn-primary" disabled={loading || lockout.locked}>
                        {loading ? <><span className="spinner" />Signing in...</> : "Sign In →"}
                    </button>
                </form>

                <div className="security-panel">
                    <div className="security-panel-title">🔒 Security Features Active</div>
                    <ul>
                        <li>Brute force protection (5 attempts → 15 min lockout)</li>
                        <li>Session tokens managed by Firebase Auth</li>
                        <li>HTTPS enforced — credentials never sent over plain HTTP</li>
                        <li>Firebase also enforces server-side rate limiting</li>
                    </ul>
                </div>

                <div className="link-text">
                    Don't have an account?{" "}
                    <button className="link-btn" onClick={() => navigate("/register")}>Register here</button>
                </div>
            </div>
        </div>
    );
}
