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
import AdminDashboard from "./pages/AdminDashboard";
import "./styles/global.css";

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Navigate to="/login" replace />} />

                {/* ── Customer routes — wrapped in AuthProvider ── */}
                <Route path="/register" element={
                    <AuthProvider><Register /></AuthProvider>
                } />
                <Route path="/login" element={
                    <AuthProvider><Login /></AuthProvider>
                } />
                <Route path="/dashboard" element={
                    <AuthProvider>
                        <ProtectedRoute><Dashboard /></ProtectedRoute>
                    </AuthProvider>
                } />

                {/* ── Employee + Admin routes — wrapped in EmployeeAuthProvider ONLY ── */}
                <Route path="/employee/*" element={
                    <EmployeeAuthProvider>
                        <Routes>
                            <Route path="login" element={<EmployeeLogin />} />
                            <Route path="dashboard" element={
                                <EmployeeProtectedRoute>
                                    <EmployeeDashboard />
                                </EmployeeProtectedRoute>
                            } />
                            <Route path="admin" element={
                                <EmployeeProtectedRoute adminOnly={true}>
                                    <AdminDashboard />
                                </EmployeeProtectedRoute>
                            } />
                            <Route path="*" element={<Navigate to="/employee/login" replace />} />
                        </Routes>
                    </EmployeeAuthProvider>
                } />

                <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;