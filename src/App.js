// src/App.js
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./components/AuthContext";
import { EmployeeAuthProvider } from "./components/EmployeeAuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import EmployeeProtectedRoute from "./components/EmployeeProtectedRoute";
import Register from "./pages/Register";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import EmployeeLogin from "./pages/EmployeeLogin";
import EmployeeDashboard from "./pages/EmployeeDashboard";
import "./styles/global.css";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* ── Customer routes ── */}
        <Route path="/register" element={
          <AuthProvider>
            <Register />
          </AuthProvider>
        } />
        <Route path="/login" element={
          <AuthProvider>
            <Login />
          </AuthProvider>
        } />
        <Route path="/dashboard" element={
          <AuthProvider>
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          </AuthProvider>
        } />

        {/* ── Employee routes ── */}
        <Route path="/employee/login" element={
          <EmployeeAuthProvider>
            <EmployeeLogin />
          </EmployeeAuthProvider>
        } />
        <Route path="/employee/dashboard" element={
          <EmployeeAuthProvider>
            <EmployeeProtectedRoute>
              <EmployeeDashboard />
            </EmployeeProtectedRoute>
          </EmployeeAuthProvider>
        } />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
