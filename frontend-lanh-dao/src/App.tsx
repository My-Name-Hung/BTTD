import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks';
import { Layout } from './components';
import { LoginPage, DashboardPage } from './pages';
import DonHangDangXuLyPage from './pages/DonHangDangXuLyPage';
import GiaoHangPage from './pages/GiaoHangPage';
import DoanhThuPage from './pages/DoanhThuPage';
import CongNoPage from './pages/CongNoPage';
import CanhBaoPage from './pages/CanhBaoPage';

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/*"
          element={
            <Layout>
              <Routes>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/don-hang-dang-xu-ly" element={<DonHangDangXuLyPage />} />
                <Route path="/giao-hang" element={<GiaoHangPage />} />
                <Route path="/doanh-thu" element={<DoanhThuPage />} />
                <Route path="/cong-no" element={<CongNoPage />} />
                <Route path="/canh-bao" element={<CanhBaoPage />} />
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </Layout>
          }
        />
      </Routes>
    </AuthProvider>
  );
}

export default App;
