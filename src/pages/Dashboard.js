// src/pages/Dashboard.js
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../components/AuthContext";
import { validatePayment, validateField, sanitizeInput } from "../utils/validators";
import {
  collection, addDoc, query, where, orderBy, onSnapshot, serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase/config";

const CURRENCIES = [
  { code: "USD", label: "USD — US Dollar" },
  { code: "EUR", label: "EUR — Euro" },
  { code: "GBP", label: "GBP — British Pound" },
  { code: "ZAR", label: "ZAR — South African Rand" },
  { code: "AUD", label: "AUD — Australian Dollar" },
  { code: "JPY", label: "JPY — Japanese Yen" },
  { code: "CAD", label: "CAD — Canadian Dollar" },
  { code: "CHF", label: "CHF — Swiss Franc" },
  { code: "CNY", label: "CNY — Chinese Yuan" },
];

const PROVIDERS = ["SWIFT"];

function generateRef() {
  return "TXN" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
}

export default function Dashboard() {
  const { currentUser, userData, logout } = useAuth();
  const navigate = useNavigate();

  const [payment, setPayment] = useState({
    amount: "", currency: "USD", provider: "SWIFT",
    recipientAccount: "", swiftCode: "", recipientName: "",
  });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [submitState, setSubmitState] = useState("idle"); // idle | loading | success | error
  const [submitError, setSubmitError] = useState("");
  const [transactions, setTransactions] = useState([]);
  const [txLoading, setTxLoading] = useState(true);

  // Real-time transaction listener
  useEffect(() => {
    if (!currentUser) return;
    const q = query(
      collection(db, "transactions"),
      where("uid", "==", currentUser.uid),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setTransactions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setTxLoading(false);
    }, () => setTxLoading(false));
    return unsub;
  }, [currentUser]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    const upperFields = ["swiftCode", "recipientAccount", "currency"];
    const finalValue = upperFields.includes(name) ? value.toUpperCase() : value;
    setPayment((prev) => ({ ...prev, [name]: finalValue }));

    if (touched[name]) {
      const validateFields = ["amount", "currency", "swiftCode", "recipientAccount"];
      if (validateFields.includes(name)) {
        const result = validateField(name, finalValue);
        setErrors((prev) => ({ ...prev, [name]: result.valid ? null : result.error }));
      }
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    const validateFields = ["amount", "currency", "swiftCode", "recipientAccount"];
    if (validateFields.includes(name)) {
      const result = validateField(name, value);
      setErrors((prev) => ({ ...prev, [name]: result.valid ? null : result.error }));
    } else if (!value.trim()) {
      setErrors((prev) => ({ ...prev, [name]: "This field is required." }));
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const handlePayment = async (e) => {
    e.preventDefault();
    setSubmitError("");

    // Validate required payment fields
    const { valid, errors: validationErrors } = validatePayment({
      amount: payment.amount,
      currency: payment.currency,
      swiftCode: payment.swiftCode,
      recipientAccount: payment.recipientAccount,
    });

    // Also validate recipientName
    if (!payment.recipientName.trim()) {
      validationErrors.recipientName = "Recipient name is required.";
    }

    if (!valid || validationErrors.recipientName) {
      setErrors(validationErrors);
      setTouched({ amount: true, currency: true, swiftCode: true, recipientAccount: true, recipientName: true });
      return;
    }

    setSubmitState("loading");
    try {
      // Sanitize all inputs before storing
      const txData = {
        uid: currentUser.uid,
        customerName: sanitizeInput(userData?.fullName || ""),
        customerAccount: sanitizeInput(userData?.accountNumber || ""),
        amount: parseFloat(payment.amount),
        currency: sanitizeInput(payment.currency.toUpperCase()),
        provider: sanitizeInput(payment.provider),
        recipientAccount: sanitizeInput(payment.recipientAccount.toUpperCase()),
        swiftCode: sanitizeInput(payment.swiftCode.toUpperCase()),
        recipientName: sanitizeInput(payment.recipientName),
        reference: generateRef(),
        status: "pending",
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, "transactions"), txData);

      setSubmitState("success");
      setPayment({ amount: "", currency: "USD", provider: "SWIFT", recipientAccount: "", swiftCode: "", recipientName: "" });
      setErrors({});
      setTouched({});
      setTimeout(() => setSubmitState("idle"), 4000);
    } catch (err) {
      setSubmitState("error");
      setSubmitError("Payment submission failed. Please try again.");
      setTimeout(() => setSubmitState("idle"), 4000);
    }
  };

  const inputClass = (field) => {
    if (!touched[field]) return "form-input";
    return `form-input ${errors[field] ? "error" : "success"}`;
  };

  const formatDate = (ts) => {
    if (!ts) return "—";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="app-container">
      {/* Navbar */}
      <nav className="navbar">
        <div className="nav-brand">
          <div className="brand-icon">🏦</div>
          <div>
            <div className="brand-name">GlobalPay</div>
          </div>
        </div>
        <div className="nav-actions">
          <div className="nav-user">
            <div className="nav-user-dot" />
            <span>{userData?.username || currentUser?.displayName || "Customer"}</span>
          </div>
          <button className="btn btn-danger" onClick={handleLogout}>Sign Out</button>
        </div>
      </nav>

      <div className="dashboard-container page-enter">
        {/* Header */}
        <div className="dashboard-header">
          <h1 className="greeting">
            Good day, <span>{userData?.fullName?.split(" ")[0] || "Customer"}</span>
          </h1>
          <div className="dashboard-meta">
            <span className="ssl-badge">🔒 HTTPS Secured</span>
            <span style={{ color: "var(--white-dim)" }}>
              {new Date().toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </span>
          </div>
        </div>

        {/* Account Info Cards */}
        <div className="info-grid">
          <div className="info-card">
            <div className="info-card-label">Account Holder</div>
            <div className="info-card-value">{userData?.fullName || "—"}</div>
          </div>
          <div className="info-card">
            <div className="info-card-label">Account Number</div>
            <div className="info-card-value">
              {"•".repeat((userData?.accountNumber?.length || 4) - 4) + (userData?.accountNumber?.slice(-4) || "••••")}
            </div>
          </div>
          <div className="info-card">
            <div className="info-card-label">Payment Provider</div>
            <div className="info-card-value">SWIFT Network</div>
          </div>
        </div>

        {/* Payment Form */}
        <h2 className="section-title">💸 New International Payment</h2>
        <div className="payment-card" style={{ marginBottom: "2.5rem" }}>

          {submitState === "success" && (
            <div className="alert alert-success">
              ✅ Payment submitted successfully! It is now pending verification by our staff.
            </div>
          )}
          {submitState === "error" && (
            <div className="alert alert-error">⚠ {submitError}</div>
          )}

          <form onSubmit={handlePayment} noValidate autoComplete="off">
            <div className="form-row">
              {/* Amount */}
              <div className="form-group">
                <label className="form-label">Amount</label>
                <input
                  type="text" name="amount" className={inputClass("amount")}
                  placeholder="e.g. 1500.00"
                  value={payment.amount} onChange={handleChange} onBlur={handleBlur}
                  inputMode="decimal" maxLength={12}
                />
                {touched.amount && errors.amount && (
                  <div className="field-error">⚠ {errors.amount}</div>
                )}
              </div>

              {/* Currency */}
              <div className="form-group">
                <label className="form-label">Currency</label>
                <select
                  name="currency" className="form-select"
                  value={payment.currency} onChange={handleChange}
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>{c.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row">
              {/* Provider */}
              <div className="form-group">
                <label className="form-label">Payment Provider</label>
                <select
                  name="provider" className="form-select"
                  value={payment.provider} onChange={handleChange}
                >
                  {PROVIDERS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              {/* SWIFT Code */}
              <div className="form-group">
                <label className="form-label">SWIFT / BIC Code</label>
                <input
                  type="text" name="swiftCode" className={inputClass("swiftCode")}
                  placeholder="e.g. ABCDZAJJXXX"
                  value={payment.swiftCode} onChange={handleChange} onBlur={handleBlur}
                  maxLength={11} style={{ fontFamily: "var(--font-mono, 'DM Mono', monospace)" }}
                />
                {touched.swiftCode && errors.swiftCode && (
                  <div className="field-error">⚠ {errors.swiftCode}</div>
                )}
              </div>
            </div>

            {/* Recipient Name */}
            <div className="form-group">
              <label className="form-label">Recipient Name</label>
              <input
                type="text" name="recipientName" className={inputClass("recipientName")}
                placeholder="Name of the recipient / beneficiary"
                value={payment.recipientName} onChange={handleChange} onBlur={handleBlur}
                maxLength={60}
              />
              {touched.recipientName && errors.recipientName && (
                <div className="field-error">⚠ {errors.recipientName}</div>
              )}
            </div>

            {/* Recipient Account */}
            <div className="form-group">
              <label className="form-label">Recipient Account / IBAN</label>
              <input
                type="text" name="recipientAccount" className={inputClass("recipientAccount")}
                placeholder="e.g. GB29NWBK60161331926819"
                value={payment.recipientAccount} onChange={handleChange} onBlur={handleBlur}
                maxLength={34} style={{ fontFamily: "var(--font-mono, 'DM Mono', monospace)" }}
              />
              {touched.recipientAccount && errors.recipientAccount && (
                <div className="field-error">⚠ {errors.recipientAccount}</div>
              )}
            </div>

            <button
              type="submit" className="btn btn-primary"
              disabled={submitState === "loading"}
              style={{ marginTop: "0.5rem" }}
            >
              {submitState === "loading"
                ? <><span className="spinner" />Processing...</>
                : "💳 Pay Now"}
            </button>
          </form>
        </div>

        {/* Transaction History */}
        <h2 className="section-title">📋 Recent Transactions</h2>
        {txLoading ? (
          <div style={{ textAlign: "center", padding: "2rem", color: "var(--white-dim)" }}>
            <span className="spinner" style={{ width: 28, height: 28 }} />
          </div>
        ) : transactions.length === 0 ? (
          <div style={{
            textAlign: "center", padding: "2rem",
            color: "var(--white-dim)", background: "var(--white-faint)",
            borderRadius: "var(--radius)", border: "1px solid var(--border)"
          }}>
            No transactions yet. Make your first payment above!
          </div>
        ) : (
          <div className="transaction-list">
            {transactions.map((tx) => (
              <div className="transaction-item" key={tx.id}>
                <div className="transaction-left">
                  <span className="transaction-id">{tx.reference} · {formatDate(tx.createdAt)}</span>
                  <span className="transaction-to">To: {tx.recipientName} — {tx.recipientAccount}</span>
                  <span className="transaction-id">SWIFT: {tx.swiftCode}</span>
                </div>
                <div className="transaction-right">
                  <span className="transaction-amount">{tx.currency} {parseFloat(tx.amount).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  <span className={`transaction-status status-${tx.status}`}>{tx.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
