import { useCallback, useEffect, useState } from "react";
import { FiCheck, FiMapPin, FiPackage, FiPhone, FiTruck } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { Loading } from "../components/Common";
import { useAuth, useToast } from "../hooks";
import { layLichSuGiaoHangTaiXe } from "../services/api";
import { DonHang } from "../types";
import styles from "./TaiXeGiaoHangPage.module.css";

function formatDate(d: string) {
  return d ? new Date(d).toLocaleDateString("vi-VN") : "";
}

export default function LichSuGiaoHangPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toasts, showToast } = useToast();
  const [donHangList, setDonHangList] = useState<DonHang[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await layLichSuGiaoHangTaiXe();
      setDonHangList(data);
    } catch {
      showToast("Không tải được lịch sử giao hàng", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getStatusColor = (s: string) => {
    if (s === "nghiem_thu" || s === "da_thanh_toan") return { bg: "#10b98122", color: "#10b981" };
    if (s === "hoan_thanh") return { bg: "#073ceb22", color: "#073ceb" };
    return { bg: "#00968822", color: "#009688" };
  };

  const getStatusLabel = (s: string) => {
    const labels: Record<string, string> = {
      da_giao: "Đã giao",
      nghiem_thu: "Nghiệm thu",
      da_thanh_toan: "Thanh toán",
      hoan_thanh: "Hoàn thành",
    };
    return labels[s] || s;
  };

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div className={styles.pageTitle}>
          <FiTruck size={22} />
          <span>Lịch sử giao hàng</span>
        </div>
        <div className={styles.pageSubtitle}>Xin chào, {user?.hoTen}</div>
      </div>

      {/* KPI */}
      <div className={styles.kpiRow}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiValue}>{donHangList.length}</div>
          <div className={styles.kpiLabel}>Tổng đã giao</div>
        </div>
      </div>

      {/* Order List */}
      {loading ? (
        <Loading />
      ) : donHangList.length === 0 ? (
        <div className={styles.emptyState}>
          <FiPackage size={48} />
          <p>Chưa có đơn hàng nào được giao</p>
        </div>
      ) : (
        <div className={styles.orderList}>
          {donHangList.map((dh) => {
            const sc = getStatusColor(dh.trangThaiDon);
            return (
              <div key={dh.id} className={styles.orderCard}>
                <div className={styles.orderCardHeader}>
                  <div>
                    <div className={styles.orderMa}>{dh.maDonHang}</div>
                    <div className={styles.orderKhach}>{dh.tenKhachHang}</div>
                  </div>
                  <span
                    className={styles.orderStatus}
                    style={{ background: sc.bg, color: sc.color }}
                  >
                    <FiCheck size={10} style={{ marginRight: 4 }} />
                    {getStatusLabel(dh.trangThaiDon)}
                  </span>
                </div>

                <div className={styles.infoRow}>
                  <FiMapPin size={14} />
                  <span>{dh.diaChiNhan || "Chưa có địa chỉ"}</span>
                </div>

                <div className={styles.infoRow}>
                  <FiPackage size={14} />
                  <span>
                    <strong>{dh.khoiLuongDat || 0} m³</strong> ·{" "}
                    {dh.tenMacBeTong || "—"}
                  </span>
                </div>

                {dh.soDienThoaiNguoiNhan && (
                  <div className={styles.infoRow}>
                    <FiPhone size={14} />
                    <a
                      href={`tel:${dh.soDienThoaiNguoiNhan}`}
                      className={styles.phoneLink}
                    >
                      {dh.soDienThoaiNguoiNhan}
                    </a>
                  </div>
                )}

                <div className={styles.orderFooter}>
                  <span className={styles.orderDate}>
                    Giao: {formatDate(dh.ngayGiao as unknown as string)}
                  </span>
                </div>

                {/* Actions */}
                <div className={styles.actionRow}>
                  <button
                    className={styles.btnDetail}
                    onClick={() => navigate(`/tai-xe/don-hang/${dh.id}`)}
                  >
                    Xem chi tiết
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className={styles.toastContainer}>
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`${styles.toast} ${t.type === "error" ? styles.toastError : styles.toastSuccess}`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}
