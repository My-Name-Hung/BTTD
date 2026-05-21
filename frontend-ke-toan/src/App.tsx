import React, { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components";
import { AuthProvider } from "./hooks";
import { Loading } from "./components/Common";

const ChiTietDonHangPage = lazy(() => import("./pages/ChiTietDonHangPage"));
const CongNoPage = lazy(() => import("./pages/CongNoPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const DieuPhoiPage = lazy(() => import("./pages/DieuPhoiPage"));
const KhachHangPage = lazy(() => import("./pages/KhachHangPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const NghiemThuPage = lazy(() => import("./pages/NghiemThuPage"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));
const QuanLyDonHangPage = lazy(() => import("./pages/QuanLyDonHangPage"));
const QuanLyNguoiDungPage = lazy(() => import("./pages/QuanLyNguoiDungPage"));
const QuanLyTramTronPage = lazy(() => import("./pages/QuanLyTramTronPage"));
const QuanLyXePage = lazy(() => import("./pages/QuanLyXePage"));
const TaoDonHangPage = lazy(() => import("./pages/TaoDonHangPage"));
const TaoLichSanXuatPage = lazy(() => import("./pages/TaoLichSanXuatPage"));
const ThamSoPage = lazy(() => import("./pages/ThamSoPage"));
const ThanhToanPage = lazy(() => import("./pages/ThanhToanPage"));

function PageFallback() {
  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "60vh" }}>
      <Loading />
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/*"
            element={
              <Layout>
                <Routes>
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/dieu-phoi" element={<DieuPhoiPage />} />
                  <Route path="/dieu-phoi/lich-san-xuat/:id" element={<TaoLichSanXuatPage />} />
                  <Route path="/nghiem-thu" element={<NghiemThuPage />} />
                  <Route path="/thanh-toan" element={<ThanhToanPage />} />
                  <Route path="/thong-bao" element={<NotificationsPage />} />
                  <Route path="/cong-no" element={<CongNoPage />} />
                  <Route path="/khach-hang" element={<KhachHangPage />} />
                  <Route path="/tham-so" element={<ThamSoPage />} />
                  <Route path="/quan-ly/don-hang" element={<QuanLyDonHangPage />} />
                  <Route path="/quan-ly/don-hang/chi-tiet/:id" element={<ChiTietDonHangPage />} />
                  <Route path="/quan-ly/don-hang/tao" element={<TaoDonHangPage />} />
                  <Route path="/quan-ly/don-hang/sua/:id" element={<TaoDonHangPage />} />
                  <Route path="/quan-ly/nguoi-dung" element={<QuanLyNguoiDungPage />} />
                  <Route path="/quan-ly/xe" element={<QuanLyXePage />} />
                  <Route path="/quan-ly/tram-tron" element={<QuanLyTramTronPage />} />
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
              </Layout>
            }
          />
        </Routes>
      </Suspense>
    </AuthProvider>
  );
}

export default App;
