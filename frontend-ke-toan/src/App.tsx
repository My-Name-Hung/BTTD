import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components";
import { AuthProvider } from "./hooks";
import {
  ChiTietDonHangPage,
  CongNoPage,
  DashboardPage,
  DieuPhoiPage,
  KhachHangPage,
  LoginPage,
  NghiemThuPage,
  NotificationsPage,
  QuanLyDonHangPage,
  QuanLyNguoiDungPage,
  QuanLyTramTronPage,
  QuanLyXePage,
  TaoDonHangPage,
  ThamSoPage,
  ThanhToanPage,
} from "./pages";

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
                <Route path="/dieu-phoi" element={<DieuPhoiPage />} />
                <Route path="/nghiem-thu" element={<NghiemThuPage />} />
                <Route path="/thanh-toan" element={<ThanhToanPage />} />
                <Route path="/thong-bao" element={<NotificationsPage />} />
                <Route path="/cong-no" element={<CongNoPage />} />
                <Route path="/khach-hang" element={<KhachHangPage />} />
                <Route path="/tham-so" element={<ThamSoPage />} />
                {/* Admin / Ke toan / Dieu phoi */}
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
                {/* Admin-only */}
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
                  path="/"
                  element={<Navigate to="/dashboard" replace />}
                />
                <Route
                  path="*"
                  element={<Navigate to="/dashboard" replace />}
                />
              </Routes>
            </Layout>
          }
        />
      </Routes>
    </AuthProvider>
  );
}

export default App;
