// src/components/ProtectedRoute.js
// Prevents unauthenticated users from accessing protected pages
// Protects against unauthorized session access (Security Requirement #4 - session hijacking)
import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

export default function ProtectedRoute({ children }) {
  const { currentUser } = useAuth();

  if (!currentUser) {
    // Redirect to login if not authenticated
    return <Navigate to="/login" replace />;
  }

  return children;
}
