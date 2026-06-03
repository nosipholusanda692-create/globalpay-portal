// src/components/EmployeeProtectedRoute.js
import React from "react";
import { Navigate } from "react-router-dom";
import { useEmployeeAuth } from "./EmployeeAuthContext";

export default function EmployeeProtectedRoute({ children }) {
  const { employeeUser } = useEmployeeAuth();
  if (!employeeUser) return <Navigate to="/employee/login" replace />;
  return children;
}
