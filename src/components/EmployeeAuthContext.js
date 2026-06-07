// src/components/EmployeeAuthContext.js
// Separate auth context for employees — keeps employee and customer sessions isolated

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase/config";
import { startSessionTimer, stopSessionTimer } from "../utils/sessionTimeout";
import { logAuditEvent, AUDIT_ACTIONS } from "../utils/auditLogger";

const EmployeeAuthContext = createContext();
export const useEmployeeAuth = () => useContext(EmployeeAuthContext);

export const EmployeeAuthProvider = ({ children }) => {
  const [employeeUser, setEmployeeUser] = useState(null);
  const [employeeData, setEmployeeData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionWarning, setSessionWarning] = useState(false);

  const fetchEmployeeData = async (uid) => {
    const snap = await getDoc(doc(db, "employees", uid));
    if (snap.exists()) {
      setEmployeeData(snap.data());
      return snap.data();
    }
    return null;
  };

    const employeeLogin = async ({ username, password }) => {
        const syntheticEmail = `${username.toLowerCase().trim()}@globalpay-employee.internal`;
        console.log("1. Trying email:", syntheticEmail);

        const credential = await signInWithEmailAndPassword(auth, syntheticEmail, password);
        console.log("2. Firebase Auth success, UID:", credential.user.uid);

        const data = await fetchEmployeeData(credential.user.uid);
        console.log("3. Firestore data:", data);
        console.log("4. Role:", data?.role);

        if (!data || (data.role !== "employee" && data.role !== "admin")) {
            console.log("5. ACCESS DENIED - role is:", data?.role);
            await signOut(auth);
            throw new Error("Access denied. Employee accounts only.");
        }

        await logAuditEvent(credential.user.uid, username, AUDIT_ACTIONS.LOGIN, {});
        return { ...credential.user, role: data.role };
    };

  const employeeLogout = async (reason = "manual") => {
    if (employeeUser && employeeData) {
      await logAuditEvent(
        employeeUser.uid,
        employeeData.username,
        reason === "timeout" ? AUDIT_ACTIONS.SESSION_TIMEOUT : AUDIT_ACTIONS.LOGOUT,
        { reason }
      );
    }
    stopSessionTimer();
    setSessionWarning(false);
    await signOut(auth);
  };

  const dismissWarning = () => setSessionWarning(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const data = await fetchEmployeeData(user.uid);
        if (data?.role === "employee" || data?.role === "admin") {
          setEmployeeUser(user);
          // Start session timeout — warn at 13 min, logout at 15 min
          startSessionTimer(
            () => setSessionWarning(true),
            () => employeeLogout("timeout")
          );
        } else {
          setEmployeeUser(null);
          setEmployeeData(null);
        }
      } else {
        setEmployeeUser(null);
        setEmployeeData(null);
        stopSessionTimer();
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return (
    <EmployeeAuthContext.Provider value={{
      employeeUser, employeeData, loading,
      sessionWarning, dismissWarning,
      employeeLogin, employeeLogout,
    }}>
      {!loading && children}
    </EmployeeAuthContext.Provider>
  );
};
