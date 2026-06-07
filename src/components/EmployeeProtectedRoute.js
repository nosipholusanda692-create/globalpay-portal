// src/components/EmployeeProtectedRoute.js
import React from "react";
import { Navigate } from "react-router-dom";
import { useEmployeeAuth } from "./EmployeeAuthContext";

export default function EmployeeProtectedRoute({ children, adminOnly = false }) {
  const { employeeUser, employeeData } = useEmployeeAuth();

  if (!employeeUser) return <Navigate to="/employee/login" replace />;

  // If adminOnly and user is not admin, redirect to employee dashboard
  if (adminOnly && employeeData?.role !== "admin") {
    return <Navigate to="/employee/dashboard" replace />;
  }

  return children;
}
