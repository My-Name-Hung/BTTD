import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { FiEye, FiPackage, FiTruck, FiCheck, FiClock, FiAlertTriangle } from "react-icons/fi";
import { Loading } from "../components/Common";
import { layLichSanXuatKho, xacNhanBatDauGiao, xacNhanDaGiaoKho } from "../services/api";
import { TRANG_THAI_DON_LABELS, TRANG_THAI_DON_COLORS } from "../types";
import { useToast } from "../hooks";
import styles from "./KhoLichSanXuatPage.module.css";

interface LichSanXuatItem {
  id: number;
  idDonHang: number;
  maDonHang?: string;
  tenKhachHang?: string;
  diaChiNhan?: string;
  tenMacBeTong?: string;
  khoiLuongDat?: number;
  trangThaiDon?: string;
  bienSoXe?: string;
  thoiGianTron?: string;
  thoiGianBatDauDo?: string;
  thoiGianKetThucDo?: string;
  trangThai?: string;
  ngayTao?: string;
}

function formatDate(d: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function statusColor(key: string) {
  return TRANG_THAI_DON_COLORS[key] || "#64748b";
}

function statusBg(key: string) {
  const c = statusColor(key);
  const hex = c.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return `rgba(${r},${g},${b},0.12)`;
}

export default function KhoLichSanXuatPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [data, setData] = useState<LichSanXuatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await layLichSanXuatKho();
      const sorted = (res || []).sort(
        (a, b) => new Date(b.ngayTao || 0).getTime() - new Date(a.ngayTao || 0).getTime()
      );
      setData(sorted);
    } catch (err) {
      console.error("Lỗi tải lịch sản xuất:", err);
      showToast("Không tải được dữ liệu lịch sản xuất", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    const token = localStorage.getItem("bttd_token");
    if (!token) { navigate("/login"); return; }
    loadData();
  }, [navigate, loadData]);

  const handleXacNhanBatDauGiao = async (item: LichSanXuatItem) => {
    if (!item.idDonHang) return;
    setActionLoading(item.idDonHang);
    try {
      await xacNhanBatDauGiao(item.idDonHang);
      showToast("Đã xác nhận bắt đầu giao hàng");
      loadData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Lỗi xác nhận", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleXacNhanDaGiao = async (item: LichSanXuatItem) => {
    if (!item.idDonHang) return;
    setActionLoading(item.idDonHang);
    try {
      await xacNhanDaGiaoKho(item.idDonHang);
      showToast("Đã xác nhận giao hàng thành công");
      loadData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Lỗi xác nhận", "error");
    } finally {
      setActionLoading(null);
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
                  <th>Trạng thái</th>
                  <th>Biển số xe</th>
                  <th>Ngày tạo lịch</th>
                  <th>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {data.map((item) => {
                  const trangThai = item.trangThaiDon || "cho_duyet";
                  const isLoading = actionLoading === item.idDonHang;
                  return (
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
                        <span
                          className={styles.statusBadge}
                          style={{
                            background: statusBg(trangThai),
                            color: statusColor(trangThai),
                          }}
                        >
                          {TRANG_THAI_DON_LABELS[trangThai] || trangThai}
                        </span>
                      </td>
                      <td>
                        <span className={styles.tableXe}>{item.bienSoXe || "—"}</span>
                      </td>
                      <td>
                        <span className={styles.tableDate}>
                          {item.ngayTao ? formatDate(item.ngayTao) : "—"}
                        </span>
                      </td>
                      <td>
                        <div className={styles.rowActions}>
                          {/* Xác nhận bắt đầu giao */}
                          {trangThai === "dang_san_xuat" && (
                            <button
                              className={`${styles.actionBtn} ${styles.actionBtnWarning}`}
                              onClick={() => handleXacNhanBatDauGiao(item)}
                              disabled={isLoading}
                              title="Xác nhận bắt đầu giao"
                            >
                              {isLoading ? <FiClock size={14} /> : <FiTruck size={14} />}
                              {isLoading ? "Đang xử lý..." : "Bắt đầu giao"}
                            </button>
                          )}
                          {/* Xác nhận đã giao */}
                          {trangThai === "dang_giao" && (
                            <button
                              className={`${styles.actionBtn} ${styles.actionBtnSuccess}`}
                              onClick={() => handleXacNhanDaGiao(item)}
                              disabled={isLoading}
                              title="Xác nhận đã giao thành công"
                            >
                              {isLoading ? <FiClock size={14} /> : <FiCheck size={14} />}
                              {isLoading ? "Đang xử lý..." : "Đã giao"}
                            </button>
                          )}
                          {/* Đã hoàn thành */}
                          {trangThai === "da_giao" && (
                            <span className={styles.completedBadge}>
                              <FiCheck size={13} /> Đã hoàn thành
                            </span>
                          )}
                          {/* Xem chi tiết */}
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
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
