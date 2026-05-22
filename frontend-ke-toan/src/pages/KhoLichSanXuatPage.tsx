import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiEye, FiPackage } from "react-icons/fi";
import { Loading } from "../components/Common";
import { layLichSanXuatKho } from "../services/api";
import { LichSanXuat, TRANG_THAI_DON_COLORS } from "../types";
import styles from "./KhoLichSanXuatPage.module.css";

interface DonHang extends LichSanXuat {
  maDonHang?: string;
  tenKhachHang?: string;
  diaChiNhan?: string;
  tenMacBeTong?: string;
  khoiLuongDat?: number;
  ngayTaoDon?: string;
}

function formatDate(d: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function getLichSXStatusLabel(trangThai: string) {
  switch (trangThai) {
    case "da_xong": return "Hoàn thành";
    case "dang_san_xuat": return "Đang sản xuất";
    case "chua_san_xuat": return "Chưa sản xuất";
    default: return trangThai;
  }
}

function getLichSXStatusColor(trangThai: string) {
  switch (trangThai) {
    case "da_xong": return "#10b981";
    case "dang_san_xuat": return "#8b5cf6";
    case "chua_san_xuat": return "#f59e0b";
    default: return "#64748b";
  }
}

export default function KhoLichSanXuatPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<DonHang[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("bttd_token");
    if (!token) { navigate("/login"); return; }
    loadData();
  }, [navigate]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await layLichSanXuatKho();
      setData(res || []);
    } catch (err) {
      console.error("Lỗi tải lịch sản xuất:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Loading />;

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Lịch sản xuất</h1>
          <p className={styles.pageDesc}>Danh sách đơn hàng đã lên lịch sản xuất</p>
        </div>
      </div>

      {/* Table */}
      <div className={styles.tableCard}>
        {data.length === 0 ? (
          <div className={styles.empty}>
            <FiPackage size={48} />
            <p>Chưa có lịch sản xuất nào</p>
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Mã đơn</th>
                  <th>Khách hàng</th>
                  <th>Địa chỉ</th>
                  <th>Mác bê tông</th>
                  <th>Khối lượng</th>
                  <th>Biểu đồ xe</th>
                  <th>Ngày tạo lịch</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {data.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <span className={styles.tableCode}>{item.maDonHang || `#${item.idDonHang}`}</span>
                    </td>
                    <td>
                      <div className={styles.tableName}>{item.tenKhachHang || "—"}</div>
                    </td>
                    <td>
                      <div className={styles.tableAddress}>{item.diaChiNhan || "—"}</div>
                    </td>
                    <td>
                      <div className={styles.tableMac}>{item.tenMacBeTong || "—"}</div>
                    </td>
                    <td>
                      <span>{item.khoiLuongDat ? `${item.khoiLuongDat} m³` : "—"}</span>
                    </td>
                    <td>
                      <span className={styles.tableXe}>{item.bienSoXe || "—"}</span>
                    </td>
                    <td>
                      <span className={styles.tableDate}>
                        {item.thoiGianTron ? formatDate(item.thoiGianTron) : "—"}
                      </span>
                    </td>
                    <td>
                      <div className={styles.rowActions}>
                        <button
                          className={`${styles.actionBtn} ${styles.actionBtnView}`}
                          onClick={() => navigate(`/kho/don-hang/${item.idDonHang}`)}
                          title="Xem chi tiết"
                        >
                          <FiEye size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
