import React, { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components";
import { Loading } from "./components/Common";
import { AuthProvider, useAuth } from "./hooks";
import { useMaintenanceCheck } from "./hooks/useMaintenanceCheck";

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
const TaiLenDanhSachPage = lazy(() => import("./pages/TaiLenDanhSachPage"));
const BaoTriPage = lazy(() => import("./pages/BaoTriPage"));
const MaintenanceBlockPage = lazy(() => import("./pages/MaintenanceBlockPage"));
const KhoDashboardPage = lazy(() => import("./pages/KhoDashboardPage"));
const KhoLichSanXuatPage = lazy(() => import("./pages/KhoLichSanXuatPage"));
const KhoDonHangPage = lazy(() => import("./pages/KhoDonHangPage"));
const QuanLyMacBeTongPage = lazy(() => import("./pages/QuanLyMacBeTongPage"));
const AccessHistoryPage = lazy(() => import("./pages/AccessHistoryPage"));

// Role-specific pages
const SaleDonHangPage = lazy(() => import("./pages/SaleDonHangPage"));
const TaiXeGiaoHangPage = lazy(() => import("./pages/TaiXeGiaoHangPage"));
const LichSuGiaoHangPage = lazy(() => import("./pages/LichSuGiaoHangPage"));
const KyThuatNghiemThuPage = lazy(() => import("./pages/KyThuatNghiemThuPage"));

function PageFallback() {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "60vh",
      }}
    >
      <Loading />
    </div>
  );
}

/** Chỉ admin được bypass maintenance, tất cả role khác đều bị block */
function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { maintenanceStatus, loading } = useMaintenanceCheck();

  if (user?.vaiTro === "admin") return <>{children}</>;

  if (loading) return <PageFallback />;

  if (maintenanceStatus?.isMaintenance) {
    return (
      <Suspense fallback={<PageFallback />}>
        <MaintenanceBlockPage
          noiDung={maintenanceStatus.noiDung}
          thoiGianKetThuc={maintenanceStatus.thoiGianKetThuc}
        />
      </Suspense>
    );
  }

  return <>{children}</>;
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
              <MaintenanceGate>
                <Layout>
                  <Routes>
                    {/* Dashboard */}
                    <Route path="/dashboard" element={<DashboardPage />} />

                    {/* Đơn hàng - admin, ke_toan, dieu_phoi, sale */}
                    <Route
                      path="/quan-ly/don-hang"
                      element={<QuanLyDonHangPage />}
                    />
                    <Route
                      path="/quan-ly/don-hang/chi-tiet/:id"
                      element={<ChiTietDonHangPage />}
                    />
                    <Route
                      path="/quan-ly/don-hang/tao"
                      element={<TaoDonHangPage />}
                    />

                    {/* Sales - chỉ tạo đơn + xem đơn của mình */}
                    <Route
                      path="/sale/don-hang"
                      element={<SaleDonHangPage />}
                    />
                    <Route
                      path="/sale/don-hang/tao"
                      element={<TaoDonHangPage />}
                    />

                    {/* Điều phối */}
                    <Route path="/dieu-phoi" element={<DieuPhoiPage />} />
                    <Route
                      path="/dieu-phoi/lich-san-xuat/:id"
                      element={<TaoLichSanXuatPage />}
                    />
                    <Route
                      path="/dieu-phoi/mac-be-tong"
                      element={<QuanLyMacBeTongPage />}
                    />

                    {/* Kho */}
                    <Route
                      path="/kho/dashboard"
                      element={<KhoDashboardPage />}
                    />
                    <Route
                      path="/kho/lich-san-xuat"
                      element={<KhoLichSanXuatPage />}
                    />
                    <Route
                      path="/kho/don-hang/:id"
                      element={<KhoDonHangPage />}
                    />

                    {/* Tài xế */}
                    <Route path="/tai-xe" element={<TaiXeGiaoHangPage />} />
                    <Route
                      path="/tai-xe/lich-su-giao"
                      element={<LichSuGiaoHangPage />}
                    />
                    <Route
                      path="/tai-xe/don-hang/:id"
                      element={<ChiTietDonHangPage />}
                    />

                    {/* Kỹ thuật */}
                    <Route
                      path="/ky-thuat"
                      element={<KyThuatNghiemThuPage />}
                    />
                    <Route
                      path="/ky-thuat/don-hang/:id"
                      element={<ChiTietDonHangPage />}
                    />

                    {/* Nghiệm thu - ke_toan, ky_thuat */}
                    <Route path="/nghiem-thu" element={<NghiemThuPage />} />

                    {/* Tài chính */}
                    <Route path="/thanh-toan" element={<ThanhToanPage />} />
                    <Route path="/cong-no" element={<CongNoPage />} />

                    {/* Thông báo */}
                    <Route path="/thong-bao" element={<NotificationsPage />} />

                    {/* Khách hàng */}
                    <Route path="/khach-hang" element={<KhachHangPage />} />

                    {/* Quản trị */}
                    <Route
                      path="/quan-ly/nguoi-dung"
                      element={<QuanLyNguoiDungPage />}
                    />
                    <Route path="/quan-ly/xe" element={<QuanLyXePage />} />
                    <Route
                      path="/quan-ly/tram-tron"
                      element={<QuanLyTramTronPage />}
                    />
                    <Route
                      path="/tai-len-danh-sach"
                      element={<TaiLenDanhSachPage />}
                    />
                    <Route path="/bao-tri" element={<BaoTriPage />} />
                    <Route path="/tham-so" element={<ThamSoPage />} />
                    <Route path="/lich-su-truy-cap" element={<AccessHistoryPage />} />

                    {/* Redirects */}
                    <Route
                      path="/"
                      element={<Navigate to="/dashboard" replace />}
                    />
                    <Route
                      path="*"
                      element={<Navigate to="/dashboard" replace />}
                    />
                  </Routes>
                </Layout>
              </MaintenanceGate>
            }
          />
        </Routes>
      </Suspense>
    </AuthProvider>
  );
}

export default App;
