import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { OfflineProvider } from './contexts/OfflineContext';
import { ThemeProvider } from './contexts/ThemeContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Scanner from './pages/Scanner';
import Products from './pages/Products';
import Batches from './pages/Batches';
import Recalls from './pages/Recalls';
import Reports from './pages/Reports';
import UserManagement from './pages/Admin/Users';
import AuditLogs from './pages/Admin/AuditLogs';
import Layout from './components/layout';

const PrivateRoute = ({ children }) => {
    const { isAuthenticated, loading } = useAuth();
    if (loading) return <div className="flex justify-center items-center h-screen dark:bg-gray-900">Loading...</div>;
    return isAuthenticated ? children : <Navigate to="/login" />;
};

function AppContent() {
    return (
        <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/dashboard" element={
                <PrivateRoute>
                    <Layout>
                        <Dashboard />
                    </Layout>
                </PrivateRoute>
            } />
            <Route path="/scanner" element={
                <PrivateRoute>
                    <Layout>
                        <Scanner />
                    </Layout>
                </PrivateRoute>
            } />
            <Route path="/products" element={
                <PrivateRoute>
                    <Layout>
                        <Products />
                    </Layout>
                </PrivateRoute>
            } />
            <Route path="/batches" element={
                <PrivateRoute>
                    <Layout>
                        <Batches />
                    </Layout>
                </PrivateRoute>
            } />
            <Route path="/recalls" element={
                <PrivateRoute>
                    <Layout>
                        <Recalls />
                    </Layout>
                </PrivateRoute>
            } />
            <Route path="/reports" element={
                <PrivateRoute>
                    <Layout>
                        <Reports />
                    </Layout>
                </PrivateRoute>
            } />
            <Route path="/admin/users" element={
                <PrivateRoute>
                    <Layout>
                        <UserManagement />
                    </Layout>
                </PrivateRoute>
            } />
            <Route path="/admin/audit-logs" element={
                <PrivateRoute>
                    <Layout>
                        <AuditLogs />
                    </Layout>
                </PrivateRoute>
            } />
            <Route path="/" element={<Navigate to="/dashboard" />} />
        </Routes>
    );
}

function App() {
    return (
        <BrowserRouter>
            <ThemeProvider>
                <AuthProvider>
                    <OfflineProvider>
                        <AppContent />
                    </OfflineProvider>
                </AuthProvider>
            </ThemeProvider>
        </BrowserRouter>
    );
}

export default App;