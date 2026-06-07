// src/pages/AdminDashboard.js
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useEmployeeAuth } from "../components/EmployeeAuthContext";
import {
  collection, onSnapshot, doc, updateDoc, serverTimestamp, setDoc,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { logAuditEvent, AUDIT_ACTIONS } from "../utils/auditLogger";
import { getCSRFToken, validateCSRFToken, rotateCSRFToken } from "../utils/csrf";
import { sanitizeInput, validateField } from "../utils/validators";
import {
  getAuth, createUserWithEmailAndPassword,
} from "firebase/auth";

// ── helpers ────────────────────────────────────────────────────────────────
const STATUS_COLORS = {
  active:      { bg: "rgba(34,197,94,0.1)",  border: "rgba(34,197,94,0.25)",  text: "#6fcf97" },
  suspended:   { bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.25)", text: "#fcd34d" },
  deactivated: { bg: "rgba(230,57,70,0.1)",  border: "rgba(230,57,70,0.25)",  text: "#ff8a94" },
};

const StatusBadge = ({ status }) => {
  const c = STATUS_COLORS[status] || STATUS_COLORS.active;
  return (
    <span style={{
      fontSize: "0.67rem", padding: "0.15rem 0.6rem", borderRadius: "99px",
      fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
      background: c.bg, border: `1px solid ${c.border}`, color: c.text,
    }}>{status}</span>
  );
};

const EMPTY_FORM = { fullName: "", username: "", password: "", role: "employee" };

export default function AdminDashboard() {
  const navigate   = useNavigate();
  const { employeeUser, employeeData, employeeLogout, sessionWarning, dismissWarning } = useEmployeeAuth();

  const [tab, setTab]                 = useState("users"); // users | transactions
  const [employees, setEmployees]     = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loadingEmp, setLoadingEmp]   = useState(true);
  const [loadingTx, setLoadingTx]     = useState(true);

  // Modal state
  const [showModal, setShowModal]     = useState(false);
  const [modalMode, setModalMode]     = useState("create"); // create | edit
  const [editTarget, setEditTarget]   = useState(null);
  const [form, setForm]               = useState(EMPTY_FORM);
  const [formErrors, setFormErrors]   = useState({});
  const [formLoading, setFormLoading] = useState(false);

  const [successMsg, setSuccessMsg]   = useState("");
  const [errorMsg, setErrorMsg]       = useState("");
  const [csrfToken]                   = useState(getCSRFToken());
  const [txFilter, setTxFilter]       = useState("pending");

  const showMsg = (msg, isErr = false) => {
    if (isErr) { setErrorMsg(msg); setTimeout(() => setErrorMsg(""), 5000); }
    else       { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(""), 5000); }
  };

  // Real-time employees listener
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "employees"), (snap) => {
      setEmployees(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoadingEmp(false);
    }, () => setLoadingEmp(false));
    return unsub;
  }, []);

  // Real-time transactions listener
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "transactions"), (snap) => {
      setTransactions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoadingTx(false);
    }, () => setLoadingTx(false));
    return unsub;
  }, []);

  // ── Form helpers ──────────────────────────────────────────────────────────
  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
    if (formErrors[name]) {
      setFormErrors((p) => ({ ...p, [name]: null }));
    }
  };

  const validateForm = () => {
    const errors = {};
    if (!form.fullName.trim()) errors.fullName = "Full name is required.";
    else { const r = validateField("fullName", form.fullName); if (!r.valid) errors.fullName = r.error; }

    if (!form.username.trim()) errors.username = "Username is required.";
    else { const r = validateField("username", form.username); if (!r.valid) errors.username = r.error; }

    if (modalMode === "create") {
      if (!form.password.trim()) errors.password = "Password is required.";
      else { const r = validateField("password", form.password); if (!r.valid) errors.password = r.error; }
    }

    return errors;
  };

  // ── Create employee ───────────────────────────────────────────────────────
  const handleCreateEmployee = async () => {
    if (!validateCSRFToken(csrfToken)) { showMsg("Security token invalid. Refresh and try again.", true); return; }
    const errors = validateForm();
    if (Object.keys(errors).length > 0) { setFormErrors(errors); return; }

    setFormLoading(true);
    try {
      const auth = getAuth();
      const syntheticEmail = `${sanitizeInput(form.username).toLowerCase()}@globalpay-employee.internal`;

      // Create Firebase Auth user
      const credential = await createUserWithEmailAndPassword(auth, syntheticEmail, form.password);
      const uid = credential.user.uid;

      // Create Firestore employee document
      await setDoc(doc(db, "employees", uid), {
        uid,
        fullName:  sanitizeInput(form.fullName),
        username:  sanitizeInput(form.username).toLowerCase(),
        role:      form.role,
        status:    "active",
        createdAt: serverTimestamp(),
        createdBy: sanitizeInput(employeeData.username),
      });

      await logAuditEvent(employeeUser.uid, employeeData.username, "CREATE_EMPLOYEE", {
        newEmployee: sanitizeInput(form.username), role: form.role,
      });

      rotateCSRFToken();
      setShowModal(false);
      setForm(EMPTY_FORM);
      showMsg(`Employee "${form.username}" created successfully!`);
    } catch (err) {
      if (err.code === "auth/email-already-in-use") {
        showMsg("Username already exists. Please choose another.", true);
      } else {
        showMsg(`Failed to create employee: ${err.message}`, true);
      }
    } finally {
      setFormLoading(false);
    }
  };

  // ── Edit employee ─────────────────────────────────────────────────────────
  const handleEditEmployee = async () => {
    if (!validateCSRFToken(csrfToken)) { showMsg("Security token invalid. Refresh and try again.", true); return; }
    const errors = validateForm();
    if (Object.keys(errors).length > 0) { setFormErrors(errors); return; }

    setFormLoading(true);
    try {
      await updateDoc(doc(db, "employees", editTarget.id), {
        fullName:  sanitizeInput(form.fullName),
        role:      form.role,
        updatedAt: serverTimestamp(),
        updatedBy: sanitizeInput(employeeData.username),
      });

      await logAuditEvent(employeeUser.uid, employeeData.username, "EDIT_EMPLOYEE", {
        employeeId: editTarget.id, username: editTarget.username,
      });

      rotateCSRFToken();
      setShowModal(false);
      setForm(EMPTY_FORM);
      setEditTarget(null);
      showMsg(`Employee "${editTarget.username}" updated successfully!`);
    } catch (err) {
      showMsg("Failed to update employee.", true);
    } finally {
      setFormLoading(false);
    }
  };

  // ── Change status ─────────────────────────────────────────────────────────
  const handleStatusChange = async (emp, newStatus) => {
    if (!validateCSRFToken(csrfToken)) { showMsg("Security token invalid.", true); return; }
    if (emp.id === employeeUser.uid) { showMsg("You cannot change your own account status.", true); return; }

    try {
      await updateDoc(doc(db, "employees", emp.id), {
        status:    newStatus,
        updatedAt: serverTimestamp(),
        updatedBy: sanitizeInput(employeeData.username),
      });
      await logAuditEvent(employeeUser.uid, employeeData.username, `${newStatus.toUpperCase()}_EMPLOYEE`, {
        employeeId: emp.id, username: emp.username,
      });
      rotateCSRFToken();
      showMsg(`${emp.username} has been ${newStatus}.`);
    } catch (err) {
      showMsg("Status change failed.", true);
    }
  };

  const openCreate = () => {
    setModalMode("create");
    setForm(EMPTY_FORM);
    setFormErrors({});
    setShowModal(true);
  };

  const openEdit = (emp) => {
    setModalMode("edit");
    setEditTarget(emp);
    setForm({ fullName: emp.fullName, username: emp.username, password: "", role: emp.role });
    setFormErrors({});
    setShowModal(true);
  };

  const handleLogout = () => employeeLogout("manual").then(() => navigate("/employee/login"));

  const filteredTx = transactions.filter((t) => txFilter === "all" ? true : t.status === txFilter);
  const txCounts = {
    pending:   transactions.filter((t) => t.status === "pending").length,
    verified:  transactions.filter((t) => t.status === "verified").length,
    submitted: transactions.filter((t) => t.status === "submitted").length,
  };

  const formatDate = (ts) => {
    if (!ts) return "—";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" });
  };

  // ── Input class ───────────────────────────────────────────────────────────
  const inp = (f) => `form-input${formErrors[f] ? " error" : ""}`;

  return (
    <div className="app-container">
      {/* Session Warning */}
      {sessionWarning && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }}>
          <div className="card" style={{ maxWidth: 400, textAlign: "center" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>⏰</div>
            <h2 className="page-title" style={{ fontSize: "1.4rem" }}>Session Expiring</h2>
            <p className="page-subtitle">You will be logged out in 2 minutes due to inactivity.</p>
            <div style={{ display: "flex", gap: "1rem" }}>
              <button className="btn btn-primary" onClick={dismissWarning}>Stay Logged In</button>
              <button className="btn btn-danger" style={{ width: "100%" }} onClick={handleLogout}>Logout Now</button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, padding: "1rem" }}>
          <div className="card" style={{ maxWidth: 480, width: "100%" }}>
            <h2 className="page-title" style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>
              {modalMode === "create" ? "➕ Create Employee" : "✏️ Edit Employee"}
            </h2>
            <p className="page-subtitle" style={{ marginBottom: "1.5rem" }}>
              {modalMode === "create" ? "Add a new employee account" : `Editing ${editTarget?.username}`}
            </p>

            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input type="text" name="fullName" className={inp("fullName")}
                placeholder="e.g. Jane Smith" value={form.fullName}
                onChange={handleFormChange} maxLength={60} />
              {formErrors.fullName && <div className="field-error">⚠ {formErrors.fullName}</div>}
            </div>

            <div className="form-group">
              <label className="form-label">Username</label>
              <input type="text" name="username" className={inp("username")}
                placeholder="e.g. jane_smith" value={form.username}
                onChange={handleFormChange} maxLength={30}
                disabled={modalMode === "edit"} />
              {formErrors.username && <div className="field-error">⚠ {formErrors.username}</div>}
              {modalMode === "edit" && <div style={{ fontSize: "0.75rem", color: "var(--white-dim)", marginTop: "0.3rem" }}>Username cannot be changed after creation</div>}
            </div>

            {modalMode === "create" && (
              <div className="form-group">
                <label className="form-label">Password</label>
                <input type="password" name="password" className={inp("password")}
                  placeholder="Min 8 chars, upper, lower, number, special"
                  value={form.password} onChange={handleFormChange} maxLength={64} />
                {formErrors.password && <div className="field-error">⚠ {formErrors.password}</div>}
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Role</label>
              <select name="role" className="form-select" value={form.role} onChange={handleFormChange}>
                <option value="employee">Employee</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
              <button className="btn btn-primary" style={{ flex: 1 }}
                disabled={formLoading}
                onClick={modalMode === "create" ? handleCreateEmployee : handleEditEmployee}>
                {formLoading
                  ? <><span className="spinner" />{modalMode === "create" ? "Creating..." : "Saving..."}</>
                  : modalMode === "create" ? "Create Employee" : "Save Changes"}
              </button>
              <button className="btn btn-ghost" style={{ flex: 1 }}
                onClick={() => { setShowModal(false); setForm(EMPTY_FORM); setFormErrors({}); }}>
                Cancel
              </button>
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
            <div style={{ fontSize: "0.65rem", color: "var(--gold)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Admin Portal</div>
          </div>
        </div>
        <div className="nav-actions">
          <div className="nav-user">
            <div className="nav-user-dot" />
            <span>{employeeData?.fullName || "Admin"}</span>
            <span style={{
              fontSize: "0.65rem", background: "rgba(201,168,76,0.15)",
              border: "1px solid rgba(201,168,76,0.3)", color: "var(--gold)",
              padding: "0.1rem 0.4rem", borderRadius: "99px", letterSpacing: "0.08em",
            }}>ADMIN</span>
          </div>
          <button className="btn btn-danger" onClick={handleLogout}>Sign Out</button>
        </div>
      </nav>

      <div className="dashboard-container page-enter">
        {/* Header */}
        <div className="dashboard-header">
          <h1 className="greeting">Admin <span>Control Panel</span></h1>
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

        {/* Alerts */}
        {successMsg && <div className="alert alert-success">✅ {successMsg}</div>}
        {errorMsg   && <div className="alert alert-error">⚠ {errorMsg}</div>}

        {/* Tabs */}
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "2rem", borderBottom: "1px solid var(--gold-border)", paddingBottom: "0" }}>
          {[
            { key: "users", label: "👥 User Management" },
            { key: "transactions", label: "📋 Transactions" },
          ].map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: "0.75rem 1.25rem", border: "none", background: "transparent",
              color: tab === t.key ? "var(--gold)" : "var(--white-dim)",
              borderBottom: tab === t.key ? "2px solid var(--gold)" : "2px solid transparent",
              cursor: "pointer", fontFamily: "inherit", fontSize: "0.9rem", fontWeight: 600,
              letterSpacing: "0.02em", marginBottom: "-1px", transition: "all 0.2s",
            }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── USER MANAGEMENT TAB ──────────────────────────────────── */}
        {tab === "users" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", flexWrap: "wrap", gap: "1rem" }}>
              <h2 className="section-title" style={{ marginBottom: 0 }}>👥 Employee Accounts</h2>
              <button className="btn btn-primary" style={{ width: "auto", padding: "0.65rem 1.25rem" }} onClick={openCreate}>
                ➕ Create Employee
              </button>
            </div>

            {/* Stats */}
            <div className="info-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)", marginBottom: "1.5rem" }}>
              <div className="info-card">
                <div className="info-card-label">Total Employees</div>
                <div className="info-card-value" style={{ fontSize: "1.8rem", fontFamily: "inherit", color: "var(--white)" }}>{employees.length}</div>
              </div>
              <div className="info-card">
                <div className="info-card-label">Active</div>
                <div className="info-card-value" style={{ fontSize: "1.8rem", fontFamily: "inherit", color: "var(--success)" }}>
                  {employees.filter((e) => e.status === "active" || !e.status).length}
                </div>
              </div>
              <div className="info-card">
                <div className="info-card-label">Suspended / Deactivated</div>
                <div className="info-card-value" style={{ fontSize: "1.8rem", fontFamily: "inherit", color: "var(--error)" }}>
                  {employees.filter((e) => e.status === "suspended" || e.status === "deactivated").length}
                </div>
              </div>
            </div>

            {loadingEmp ? (
              <div style={{ textAlign: "center", padding: "3rem" }}><span className="spinner" style={{ width: 32, height: 32 }} /></div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {employees.map((emp) => (
                  <div key={emp.id} style={{
                    background: "linear-gradient(160deg, rgba(26,16,24,0.9), rgba(8,6,8,0.98))",
                    border: "1px solid var(--gold-border)",
                    borderRadius: "var(--radius)",
                    padding: "1.25rem 1.5rem",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    flexWrap: "wrap", gap: "1rem",
                    opacity: emp.status === "deactivated" ? 0.6 : 1,
                  }}>
                    {/* Left */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                        <span style={{ fontSize: "1rem", fontWeight: 600, color: "var(--white)" }}>{emp.fullName}</span>
                        <StatusBadge status={emp.status || "active"} />
                        <span style={{
                          fontSize: "0.67rem", padding: "0.15rem 0.5rem", borderRadius: "99px",
                          background: emp.role === "admin" ? "rgba(201,168,76,0.15)" : "rgba(255,255,255,0.07)",
                          border: emp.role === "admin" ? "1px solid rgba(201,168,76,0.3)" : "1px solid rgba(255,255,255,0.1)",
                          color: emp.role === "admin" ? "var(--gold)" : "var(--white-dim)",
                          fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em",
                        }}>{emp.role}</span>
                      </div>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.8rem", color: "var(--white-dim)" }}>
                        @{emp.username}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--white-dim)" }}>
                        Created: {formatDate(emp.createdAt)}
                        {emp.createdBy && ` by ${emp.createdBy}`}
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                      {/* Edit */}
                      <button className="btn btn-ghost" onClick={() => openEdit(emp)}
                        style={{ fontSize: "0.78rem", padding: "0.5rem 0.9rem" }}>
                        ✏️ Edit
                      </button>

                      {/* Status actions */}
                      {(emp.status === "active" || !emp.status) && emp.id !== employeeUser.uid && (
                        <>
                          <button className="btn btn-ghost"
                            onClick={() => handleStatusChange(emp, "suspended")}
                            style={{ fontSize: "0.78rem", padding: "0.5rem 0.9rem", borderColor: "rgba(245,158,11,0.4)", color: "#fcd34d" }}>
                            ⏸ Suspend
                          </button>
                          <button className="btn btn-danger"
                            onClick={() => handleStatusChange(emp, "deactivated")}
                            style={{ fontSize: "0.78rem", padding: "0.5rem 0.9rem" }}>
                            🚫 Deactivate
                          </button>
                        </>
                      )}

                      {emp.status === "suspended" && (
                        <button className="btn btn-ghost"
                          onClick={() => handleStatusChange(emp, "active")}
                          style={{ fontSize: "0.78rem", padding: "0.5rem 0.9rem", borderColor: "rgba(34,197,94,0.4)", color: "#6fcf97" }}>
                          ✅ Reactivate
                        </button>
                      )}

                      {emp.status === "deactivated" && (
                        <button className="btn btn-ghost"
                          onClick={() => handleStatusChange(emp, "active")}
                          style={{ fontSize: "0.78rem", padding: "0.5rem 0.9rem", borderColor: "rgba(34,197,94,0.4)", color: "#6fcf97" }}>
                          ✅ Reactivate
                        </button>
                      )}

                      {emp.id === employeeUser.uid && (
                        <span style={{ fontSize: "0.75rem", color: "var(--white-dim)", alignSelf: "center" }}>
                          (your account)
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── TRANSACTIONS TAB ─────────────────────────────────────── */}
        {tab === "transactions" && (
          <>
            {/* Stats */}
            <div className="info-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
              {[
                { label: "Pending",   count: txCounts.pending,   color: "var(--warning)", filter: "pending" },
                { label: "Verified",  count: txCounts.verified,  color: "var(--gold)",    filter: "verified" },
                { label: "Submitted", count: txCounts.submitted, color: "var(--success)", filter: "submitted" },
              ].map((s) => (
                <div key={s.filter} className="info-card" style={{ cursor: "pointer" }} onClick={() => setTxFilter(s.filter)}>
                  <div className="info-card-label">{s.label}</div>
                  <div className="info-card-value" style={{ fontSize: "1.8rem", fontFamily: "inherit", color: s.color }}>{s.count}</div>
                </div>
              ))}
            </div>

            {/* Filter tabs */}
            <div style={{ display: "flex", gap: "0.5rem", margin: "1.5rem 0", flexWrap: "wrap" }}>
              {["all", "pending", "verified", "submitted"].map((f) => (
                <button key={f} onClick={() => setTxFilter(f)} style={{
                  padding: "0.45rem 1rem", borderRadius: "99px", border: "1px solid",
                  borderColor: txFilter === f ? "var(--gold)" : "var(--gold-border)",
                  background: txFilter === f ? "rgba(201,168,76,0.15)" : "transparent",
                  color: txFilter === f ? "var(--gold)" : "var(--white-dim)",
                  cursor: "pointer", fontSize: "0.82rem", fontFamily: "inherit",
                  textTransform: "capitalize", letterSpacing: "0.05em", transition: "all 0.2s",
                }}>
                  {f} {f !== "all" && `(${txCounts[f] ?? 0})`}
                </button>
              ))}
            </div>

            <h2 className="section-title">📋 All Transactions</h2>

            {loadingTx ? (
              <div style={{ textAlign: "center", padding: "3rem" }}><span className="spinner" style={{ width: 32, height: 32 }} /></div>
            ) : filteredTx.length === 0 ? (
              <div style={{
                textAlign: "center", padding: "2.5rem",
                background: "var(--white-faint)", border: "1px solid var(--gold-border)",
                borderRadius: "var(--radius)", color: "var(--white-dim)",
              }}>No {txFilter !== "all" ? txFilter : ""} transactions found.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {filteredTx.map((tx) => (
                  <div key={tx.id} style={{
                    background: "linear-gradient(160deg, rgba(26,16,24,0.9), rgba(8,6,8,0.98))",
                    border: "1px solid var(--gold-border)", borderRadius: "var(--radius)",
                    padding: "1.25rem 1.5rem",
                    borderLeft: `4px solid ${tx.status === "submitted" ? "var(--success)" : tx.status === "verified" ? "var(--gold)" : "var(--red-bright)"}`,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.75rem", color: "var(--white-dim)" }}>{tx.reference}</span>
                          <span className={`transaction-status status-${tx.status}`}>{tx.status}</span>
                        </div>
                        <div style={{ fontSize: "0.9rem", color: "var(--white)", fontWeight: 500 }}>
                          {tx.recipientName} — <span style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.82rem" }}>{tx.recipientAccount}</span>
                        </div>
                        <div style={{ fontSize: "0.8rem", color: "var(--white-dim)" }}>
                          SWIFT: {tx.swiftCode} · Customer: {tx.customerName} · {tx.createdAt?.toDate ? tx.createdAt.toDate().toLocaleDateString("en-ZA") : "—"}
                        </div>
                      </div>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "1.05rem", color: "var(--gold-light)", fontWeight: 500, alignSelf: "center" }}>
                        {tx.currency} {parseFloat(tx.amount).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
