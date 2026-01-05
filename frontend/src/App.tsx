import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import VerificationPage from './pages/user/VerificationPage';
import StatusPage from './pages/user/StatusPage';
import LoginPage from './pages/admin/LoginPage';
import DashboardPage from './pages/admin/DashboardPage';
import ReviewPage from './pages/admin/ReviewPage';

function App() {
  return (
    <div className="min-h-screen bg-navy-50">
      <Routes>
        {/* User Routes */}
        <Route path="/" element={<Navigate to="/verify" replace />} />
        <Route path="/verify" element={<VerificationPage />} />
        <Route path="/verify/:sessionId" element={<VerificationPage />} />
        <Route path="/status/:sessionId" element={<StatusPage />} />

        {/* Admin Routes */}
        <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="/admin/login" element={<LoginPage />} />
        <Route path="/admin/dashboard" element={<DashboardPage />} />
        <Route path="/admin/review/:reviewId" element={<ReviewPage />} />

        {/* 404 */}
        <Route path="*" element={<Navigate to="/verify" replace />} />
      </Routes>
    </div>
  );
}

export default App;
