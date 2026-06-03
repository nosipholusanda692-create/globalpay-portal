// src/pages/EmployeeDashboard.js
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useEmployeeAuth } from "../components/EmployeeAuthContext";
import { collection, query, orderBy, onSnapshot, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/config";
import { logAuditEvent, AUDIT_ACTIONS } from "../utils/auditLogger";
import { getCSRFToken, validateCSRFToken, rotateCSRFToken } from "../utils/csrf";
import { sanitizeInput } from "../utils/validators";

const PATTERNS = {
  swiftCode: /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/,
  recipientAccount: /^[A-Z0-9]{8,34}$/,
};

function validateTransaction(tx) {
  const errors = [];
  if (!PATTERNS.swiftCode.test(tx.swiftCode?.toUpperCase())) errors.push("Invalid SWIFT/BIC code format");
  if (!PATTERNS.recipientAccount.test(tx.recipientAccount?.toUpperCase())) errors.push("Invalid recipient account format");
  if (!tx.amount || isNaN(tx.amount) || tx.amount <= 0) errors.push("Invalid amount");
  if (!tx.currency || tx.currency.length !== 3) errors.push("Invalid currency");
  return errors;
}

export default function EmployeeDashboard() {
  const navigate = useNavigate();
  const { employeeUser, employeeData, employeeLogout, sessionWarning, dismissWarning } = useEmployeeAuth();

  const [transactions, setTransactions]   = useState([]);
  const [loading, setLoading]             = useState(true);
  const [actionLoading, setActionLoading] = useState({});
  const [successMsg, setSuccessMsg]       = useState("");
  const [errorMsg, setErrorMsg]           = useState("");
  const [filter, setFilter]               = useState("pending");
  const [csrfToken]                       = useState(getCSRFToken());

  // Real-time listener for ALL transactions
  useEffect(() => {
    const q = query(collection(db, "transactions"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setTransactions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));

    // Log that employee viewed transactions
    if (employeeUser && employeeData) {
      logAuditEvent(employeeUser.uid, employeeData.username, AUDIT_ACTIONS.VIEW_TRANSACTIONS, {});
    }
    return unsub;
  }, [employeeUser]);

  const showMessage = (msg, isError = false) => {
    if (isError) { setErrorMsg(msg); setTimeout(() => setErrorMsg(""), 5000); }
    else { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(""), 5000); }
  };

  // Verify a transaction
  const handleVerify = async (tx) => {
    // CSRF check
    if (!validateCSRFToken(csrfToken)) {
      showMessage("Security token invalid. Please refresh the page.", true); return;
    }

    // Validate transaction data before verifying
    const errors = validateTransaction(tx);
    if (errors.length > 0) {
      showMessage(`Cannot verify — ${errors.join(", ")}`, true); return;
    }

    setActionLoading((p) => ({ ...p, [`verify_${tx.id}`]: true }));
    try {
      await updateDoc(doc(db, "transactions", tx.id), {
        status: "verified",
        verifiedBy: sanitizeInput(employeeData.username),
        verifiedAt: serverTimestamp(),
      });
      await logAuditEvent(employeeUser.uid, employeeData.username, AUDIT_ACTIONS.VERIFY_TX, {
        transactionId: tx.id, reference: tx.reference, amount: tx.amount, currency: tx.currency,
      });
      rotateCSRFToken();
      showMessage(`Transaction ${tx.reference} verified successfully!`);
    } catch (err) {
      showMessage("Verification failed. Please try again.", true);
    } finally {
      setActionLoading((p) => ({ ...p, [`verify_${tx.id}`]: false }));
    }
  };

  // Unverify a transaction
  const handleUnverify = async (tx) => {
    if (!validateCSRFToken(csrfToken)) {
      showMessage("Security token invalid. Please refresh.", true); return;
    }
    setActionLoading((p) => ({ ...p, [`unverify_${tx.id}`]: true }));
    try {
      await updateDoc(doc(db, "transactions", tx.id), {
        status: "pending",
        verifiedBy: null,
        verifiedAt: null,
      });
      await logAuditEvent(employeeUser.uid, employeeData.username, AUDIT_ACTIONS.UNVERIFY_TX, {
        transactionId: tx.id, reference: tx.reference,
      });
      showMessage(`Transaction ${tx.reference} returned to pending.`);
    } catch (err) {
      showMessage("Action failed. Please try again.", true);
    } finally {
      setActionLoading((p) => ({ ...p, [`unverify_${tx.id}`]: false }));
    }
  };

  // Submit all verified transactions to SWIFT
  const handleSubmitToSwift = async (tx) => {
    if (!validateCSRFToken(csrfToken)) {
      showMessage("Security token invalid. Please refresh.", true); return;
    }
    if (tx.status !== "verified") {
      showMessage("Only verified transactions can be submitted to SWIFT.", true); return;
    }

    setActionLoading((p) => ({ ...p, [`swift_${tx.id}`]: true }));
    try {
      await updateDoc(doc(db, "transactions", tx.id), {
        status: "submitted",
        submittedBy: sanitizeInput(employeeData.username),
        submittedAt: serverTimestamp(),
      });
      await logAuditEvent(employeeUser.uid, employeeData.username, AUDIT_ACTIONS.SUBMIT_SWIFT, {
        transactionId: tx.id, reference: tx.reference, swiftCode: tx.swiftCode,
        amount: tx.amount, currency: tx.currency,
      });
      rotateCSRFToken();
      showMessage(`Transaction ${tx.reference} submitted to SWIFT!`);
    } catch (err) {
      showMessage("Submission failed. Please try again.", true);
    } finally {
      setActionLoading((p) => ({ ...p, [`swift_${tx.id}`]: false }));
    }
  };

  const handleLogout = () => employeeLogout("manual").then(() => navigate("/employee/login"));

  const filtered = transactions.filter((tx) => filter === "all" ? true : tx.status === filter);

  const counts = {
    pending:   transactions.filter((t) => t.status === "pending").length,
    verified:  transactions.filter((t) => t.status === "verified").length,
    submitted: transactions.filter((t) => t.status === "submitted").length,
  };

  const formatDate = (ts) => {
    if (!ts) return "—";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="app-container">
      {/* Session Warning Modal */}
      {sessionWarning && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999,
        }}>
          <div className="card" style={{ maxWidth: 400, textAlign: "center" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>⏰</div>
            <h2 className="page-title" style={{ fontSize: "1.4rem" }}>Session Expiring</h2>
            <p className="page-subtitle">You will be automatically logged out in 2 minutes due to inactivity.</p>
            <div style={{ display: "flex", gap: "1rem" }}>
              <button className="btn btn-primary" onClick={dismissWarning}>Stay Logged In</button>
              <button className="btn btn-danger" style={{ width: "100%" }} onClick={handleLogout}>Logout Now</button>
            </div>
          </div>
        </div>
      )}

      {/* Navbar */}
      <nav className="navbar">
        <div className="nav-brand">
          <div className="brand-icon">🏛️</div>
          <div>
            <div className="brand-name">Global<span style={{ color: "var(--gold)" }}>Pay</span></div>
            <div style={{ fontSize: "0.65rem", color: "var(--gold)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Employee Portal</div>
          </div>
        </div>
        <div className="nav-actions">
          <div className="nav-user">
            <div className="nav-user-dot" />
            <span>{employeeData?.fullName || employeeData?.username || "Employee"}</span>
            <span style={{
              fontSize: "0.65rem", background: "rgba(201,168,76,0.15)",
              border: "1px solid rgba(201,168,76,0.3)", color: "var(--gold)",
              padding: "0.1rem 0.4rem", borderRadius: "99px", letterSpacing: "0.08em",
            }}>STAFF</span>
          </div>
          <button className="btn btn-danger" onClick={handleLogout}>Sign Out</button>
        </div>
      </nav>

      <div className="dashboard-container page-enter">
        {/* Header */}
        <div className="dashboard-header">
          <h1 className="greeting">
            Payments <span>Review</span>
          </h1>
          <div className="dashboard-meta">
            <span className="ssl-badge">🔒 HTTPS Secured</span>
            <span className="ssl-badge" style={{ background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.25)", color: "var(--gold)" }}>
              🛡 CSRF Protected
            </span>
            <span style={{ color: "var(--white-dim)" }}>
              {new Date().toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </span>
          </div>
        </div>

        {/* Stats */}
        <div className="info-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
          <div className="info-card" style={{ cursor: "pointer" }} onClick={() => setFilter("pending")}>
            <div className="info-card-label">Pending</div>
            <div className="info-card-value" style={{ fontSize: "1.8rem", fontFamily: "inherit", color: "var(--warning)" }}>{counts.pending}</div>
          </div>
          <div className="info-card" style={{ cursor: "pointer" }} onClick={() => setFilter("verified")}>
            <div className="info-card-label">Verified</div>
            <div className="info-card-value" style={{ fontSize: "1.8rem", fontFamily: "inherit", color: "var(--gold)" }}>{counts.verified}</div>
          </div>
          <div className="info-card" style={{ cursor: "pointer" }} onClick={() => setFilter("submitted")}>
            <div className="info-card-label">Submitted to SWIFT</div>
            <div className="info-card-value" style={{ fontSize: "1.8rem", fontFamily: "inherit", color: "var(--success)" }}>{counts.submitted}</div>
          </div>
        </div>

        {/* Alerts */}
        {successMsg && <div className="alert alert-success">✅ {successMsg}</div>}
        {errorMsg && <div className="alert alert-error">⚠ {errorMsg}</div>}

        {/* Filter tabs */}
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
          {["all","pending","verified","submitted"].map((f) => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: "0.45rem 1rem", borderRadius: "99px", border: "1px solid",
              borderColor: filter === f ? "var(--gold)" : "var(--gold-border)",
              background: filter === f ? "rgba(201,168,76,0.15)" : "transparent",
              color: filter === f ? "var(--gold)" : "var(--white-dim)",
              cursor: "pointer", fontSize: "0.82rem", fontFamily: "inherit",
              textTransform: "capitalize", letterSpacing: "0.05em", transition: "all 0.2s",
            }}>
              {f} {f !== "all" && `(${counts[f] ?? transactions.length})`}
            </button>
          ))}
        </div>

        {/* Transaction List */}
        <h2 className="section-title">📋 Transactions</h2>

        {loading ? (
          <div style={{ textAlign: "center", padding: "3rem", color: "var(--white-dim)" }}>
            <span className="spinner" style={{ width: 32, height: 32 }} />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{
            textAlign: "center", padding: "2.5rem",
            background: "var(--white-faint)", border: "1px solid var(--gold-border)",
            borderRadius: "var(--radius)", color: "var(--white-dim)",
          }}>
            No {filter !== "all" ? filter : ""} transactions found.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {filtered.map((tx) => {
              const validationErrors = validateTransaction(tx);
              const isValid = validationErrors.length === 0;
              return (
                <div key={tx.id} style={{
                  background: "linear-gradient(160deg, rgba(26,16,24,0.9), rgba(8,6,8,0.98))",
                  border: "1px solid var(--gold-border)",
                  borderRadius: "var(--radius)",
                  padding: "1.5rem",
                  position: "relative",
                  overflow: "hidden",
                }}>
                  {/* Status stripe */}
                  <div style={{
                    position: "absolute", top: 0, left: 0, bottom: 0, width: "4px",
                    background: tx.status === "submitted" ? "var(--success)"
                      : tx.status === "verified" ? "var(--gold)"
                      : "var(--red-bright)",
                  }} />

                  <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem", paddingLeft: "0.5rem" }}>
                    {/* Left info */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.78rem", color: "var(--white-dim)" }}>{tx.reference}</span>
                        <span className={`transaction-status status-${tx.status}`}>{tx.status}</span>
                        {!isValid && (
                          <span style={{
                            fontSize: "0.68rem", padding: "0.15rem 0.55rem", borderRadius: "99px",
                            background: "rgba(230,57,70,0.12)", color: "#ff6b7a",
                            border: "1px solid rgba(230,57,70,0.2)", fontWeight: 700,
                          }}>⚠ VALIDATION FAILED</span>
                        )}
                      </div>

                      <div style={{ fontSize: "0.92rem", color: "var(--white)", fontWeight: 500 }}>
                        {tx.recipientName} — <span style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.85rem" }}>{tx.recipientAccount}</span>
                      </div>

                      <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
                        <div>
                          <div style={{ fontSize: "0.67rem", color: "var(--gold)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "2px" }}>SWIFT Code</div>
                          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.88rem", color: isValid ? "var(--white)" : "#ff6b7a" }}>{tx.swiftCode}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: "0.67rem", color: "var(--gold)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "2px" }}>Customer</div>
                          <div style={{ fontSize: "0.88rem", color: "var(--white-dim)" }}>{tx.customerName}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: "0.67rem", color: "var(--gold)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "2px" }}>Date</div>
                          <div style={{ fontSize: "0.85rem", color: "var(--white-dim)" }}>{formatDate(tx.createdAt)}</div>
                        </div>
                        {tx.verifiedBy && (
                          <div>
                            <div style={{ fontSize: "0.67rem", color: "var(--gold)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "2px" }}>Verified By</div>
                            <div style={{ fontSize: "0.85rem", color: "var(--white-dim)" }}>{tx.verifiedBy}</div>
                          </div>
                        )}
                      </div>

                      {/* Validation errors */}
                      {!isValid && (
                        <div style={{ fontSize: "0.78rem", color: "#ff6b7a", marginTop: "0.25rem" }}>
                          {validationErrors.map((e, i) => <div key={i}>⚠ {e}</div>)}
                        </div>
                      )}
                    </div>

                    {/* Right — amount + actions */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.75rem" }}>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1.2rem", color: "var(--gold-light)", fontWeight: 500 }}>
                        {tx.currency} {parseFloat(tx.amount).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
                      </div>

                      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
                        {tx.status === "pending" && (
                          <button
                            className="btn btn-ghost"
                            disabled={!isValid || actionLoading[`verify_${tx.id}`]}
                            onClick={() => handleVerify(tx)}
                            style={{ borderColor: isValid ? "rgba(34,197,94,0.4)" : undefined, color: isValid ? "#6fcf97" : undefined }}
                          >
                            {actionLoading[`verify_${tx.id}`] ? <><span className="spinner" />Verifying...</> : "✓ Verify"}
                          </button>
                        )}
                        {tx.status === "verified" && (
                          <>
                            <button
                              className="btn btn-ghost"
                              disabled={actionLoading[`unverify_${tx.id}`]}
                              onClick={() => handleUnverify(tx)}
                            >
                              {actionLoading[`unverify_${tx.id}`] ? <><span className="spinner" /></> : "↩ Unverify"}
                            </button>
                            <button
                              className="btn btn-primary"
                              disabled={actionLoading[`swift_${tx.id}`]}
                              onClick={() => handleSubmitToSwift(tx)}
                              style={{ width: "auto", padding: "0.6rem 1.1rem" }}
                            >
                              {actionLoading[`swift_${tx.id}`] ? <><span className="spinner" />Submitting...</> : "🚀 Submit to SWIFT"}
                            </button>
                          </>
                        )}
                        {tx.status === "submitted" && (
                          <span style={{
                            fontSize: "0.78rem", color: "#6fcf97", display: "flex",
                            alignItems: "center", gap: "0.3rem",
                          }}>✅ Submitted to SWIFT</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
