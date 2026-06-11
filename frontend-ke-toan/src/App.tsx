import React, { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./shared/components";
import { Loading } from "./shared/components/ui";
import { AuthProvider, useAuth } from "./shared/hooks";
import { useMaintenanceCheck } from "./shared/hooks/useMaintenanceCheck";

// Auth
const LoginPage = lazy(() => import("./features/auth/pages/LoginPage"));

// Dashboard
const DashboardPage = lazy(() => import("./features/dashboard/pages/DashboardPage"));

// Đơn hàng
const QuanLyDonHangPage = lazy(() => import("./features/don-hang/pages/QuanLyDonHangPage"));
const TaoDonHangPage = lazy(() => import("./features/don-hang/pages/TaoDonHangPage"));
const ChiTietDonHangPage = lazy(() => import("./features/don-hang/pages/ChiTietDonHangPage"));
const SaleDonHangPage = lazy(() => import("./features/don-hang/pages/SaleDonHangPage"));
const DonHangTheoXePage = lazy(() => import("./features/don-hang/pages/DonHangTheoXePage"));
const DonHangTheoTramPage = lazy(() => import("./features/don-hang/pages/DonHangTheoTramPage"));

// Kho
const KhoDashboardPage = lazy(() => import("./features/kho/pages/KhoDashboardPage"));
const KhoDonHangPage = lazy(() => import("./features/kho/pages/KhoDonHangPage"));
const KhoLichSanXuatPage = lazy(() => import("./features/kho/pages/KhoLichSanXuatPage"));

// Trạm trộn
const QuanLyTramTronPage = lazy(() => import("./features/tram-tron/pages/QuanLyTramTronPage"));
const DieuPhoiPage = lazy(() => import("./features/tram-tron/pages/DieuPhoiPage"));
const TaoLichSanXuatPage = lazy(() => import("./features/tram-tron/pages/TaoLichSanXuatPage"));
const DieuPhoiLichSanXuatPage = lazy(() => import("./features/tram-tron/pages/DieuPhoiLichSanXuatPage"));
const NghiemThuPage = lazy(() => import("./features/tram-tron/pages/NghiemThuPage"));
const ThamSoPage = lazy(() => import("./features/tram-tron/pages/ThamSoPage"));

// Tài xế
const TaiXeGiaoHangPage = lazy(() => import("./features/tai-xe/pages/TaiXeGiaoHangPage"));
const LichSuGiaoHangPage = lazy(() => import("./features/tai-xe/pages/LichSuGiaoHangPage"));

// Kỹ thuật
const KyThuatNghiemThuPage = lazy(() => import("./features/ky-thuat/pages/KyThuatNghiemThuPage"));

// Thanh toán
const ThanhToanPage = lazy(() => import("./features/thanh-toan/pages/ThanhToanPage"));
const XuatHoaDonPage = lazy(() => import("./features/hoa-don/pages/XuatHoaDonPage"));
const InHoaDonPage = lazy(() => import("./features/hoa-don/pages/InHoaDonPage"));
const InTamTinhPage = lazy(() => import("./features/hoa-don/pages/InTamTinhPage"));

// Công nợ
const CongNoPage = lazy(() => import("./features/cong-no/pages/CongNoPage"));

// Khách hàng
const KhachHangPage = lazy(() => import("./features/khach-hang/pages/KhachHangPage"));

// Người dùng
const QuanLyNguoiDungPage = lazy(() => import("./features/nguoi-dung/pages/QuanLyNguoiDungPage"));
const TaoNguoiDungPage = lazy(() => import("./features/nguoi-dung/pages/TaoNguoiDungPage"));

// Quản lý
const QuanLyXePage = lazy(() => import("./features/quan-ly/pages/QuanLyXePage"));
const QuanLyMacBeTongPage = lazy(() => import("./features/quan-ly/pages/QuanLyMacBeTongPage"));
const AccessHistoryPage = lazy(() => import("./features/quan-ly/pages/AccessHistoryPage"));
const AccessHistoryDetailPage = lazy(() => import("./features/lich-su/pages/AccessHistoryDetailPage"));

// Import/Export
const TaiLenDanhSachPage = lazy(() => import("./features/import-export/pages/TaiLenDanhSachPage"));

// Thông báo
const NotificationsPage = lazy(() => import("./features/thong-bao/pages/NotificationsPage"));

// Bảo trì
const BaoTriPage = lazy(() => import("./features/bao-tri/pages/BaoTriPage"));
const MaintenanceBlockPage = lazy(() => import("./features/maintenance/pages/MaintenanceBlockPage"));

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
                    <Route
                      path="/quan-ly/don-hang/sua/:id"
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

                    {/* Trạm trộn */}
                    <Route
                      path="/tram-tron/lich-san-xuat"
                      element={<KhoLichSanXuatPage />}
                    />
                    <Route
                      path="/tram-tron/don-hang/:id"
                      element={<KhoDonHangPage />}
                    />
                    <Route
                      path="/tram-tron/don-hang-list"
                      element={<DonHangTheoTramPage />}
                    />

                    {/* Điều phối - Lịch sản xuất */}
                    <Route
                      path="/dieu-phoi/lich-san-xuat"
                      element={<DieuPhoiLichSanXuatPage />}
                    />

                    {/* Quản lý trạm trộn - đơn hàng theo trạm */}
                    <Route
                      path="/quan-ly/tram/don-hang/:id"
                      element={<DonHangTheoTramPage />}
                    />

                    {/* Quản lý xe */}
                    <Route
                      path="/quan-ly/xe/don-hang/:id"
                      element={<DonHangTheoXePage />}
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
                    <Route path="/thanh-toan/xuat/:id" element={<XuatHoaDonPage />} />
                    <Route path="/in-hoa-don/:id" element={<InHoaDonPage />} />
                    <Route path="/in-tam-tinh/:id" element={<InTamTinhPage />} />
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
                    <Route
                      path="/quan-ly/nguoi-dung/tao"
                      element={<TaoNguoiDungPage />}
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
                    <Route
                      path="/lich-su-truy-cap"
                      element={<AccessHistoryPage />}
                    />
                    <Route
                      path="/lich-su-truy-cap/:id"
                      element={<AccessHistoryDetailPage />}
                    />

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
