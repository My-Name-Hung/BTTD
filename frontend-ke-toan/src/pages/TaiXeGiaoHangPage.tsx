import { useCallback, useEffect, useState } from "react";
import {
  FiCheck,
  FiMapPin,
  FiNavigation,
  FiPackage,
  FiPhone,
  FiTruck,
} from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { ConfirmModal, Loading } from "../components/Common";
import { useAuth, useToast } from "../hooks";
import {
  layDonHangGiaoCuaToi,
  taiXeCapNhatTrangThaiGiao,
  layThongKeTaiXe,
} from "../services/api";
import { DonHang } from "../types";
import styles from "./TaiXeGiaoHangPage.module.css";

function formatCurrency(v: number) {
  return v?.toLocaleString("vi-VN") + " đ" || "0 đ";
}
function formatDate(d: string) {
  return d ? new Date(d).toLocaleDateString("vi-VN") : "";
}

export default function TaiXeGiaoHangPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toasts, showToast } = useToast();
  const [donHangList, setDonHangList] = useState<DonHang[]>([]);
  const [thongKe, setThongKe] = useState({ tongDon: 0, chuaGiao: 0, daGiao: 0 });
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<number | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<DonHang | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [data, stats] = await Promise.all([
        layDonHangGiaoCuaToi(),
        layThongKeTaiXe(),
      ]);
      setDonHangList(data);
      setThongKe(stats);
    } catch {
      showToast("Không tải được danh sách đơn giao", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleXacNhanDangGiao = async (dh: DonHang) => {
    setUpdating(dh.id);
    try {
      await taiXeCapNhatTrangThaiGiao(dh.id, "dang_giao");
      showToast("Đã cập nhật trạng thái đang giao");
      loadData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Lỗi cập nhật", "error");
    } finally {
      setUpdating(null);
    }
  };

  const handleXacNhanDaGiao = async () => {
    if (!confirmTarget) return;
    setUpdating(confirmTarget.id);
    try {
      await taiXeCapNhatTrangThaiGiao(confirmTarget.id, "da_giao");
      showToast("Xác nhận giao hàng thành công");
      setConfirmTarget(null);
      loadData();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Lỗi xác nhận giao",
        "error",
      );
    } finally {
      setUpdating(null);
    }
  };

  const statusColor = (s: string) => {
    if (s === "dang_giao") return { bg: "#00968822", color: "#009688" };
    if (s === "dang_cho_giao") return { bg: "#f9731622", color: "#f97316" };
    return { bg: "#4caf5022", color: "#4caf50" };
  };

  const statusLabel = (s: string) => {
    if (s === "dang_cho_giao") return "Chờ giao";
    if (s === "dang_giao") return "Đang giao";
    if (s === "da_giao") return "Đã giao";
    return s;
  };

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div className={styles.pageTitle}>
          <FiTruck size={22} />
          <span>Giao hàng</span>
        </div>
        <div className={styles.pageSubtitle}>Xin chào, {user?.hoTen}</div>
      </div>

      {/* KPI */}
      <div className={styles.kpiRow}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiValue}>{donHangList.length}</div>
          <div className={styles.kpiLabel}>Đơn cần giao</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={`${styles.kpiValue} ${styles.kpiSuccess}`}>
            {thongKe.daGiao}
          </div>
          <div className={styles.kpiLabel}>Đã giao</div>
        </div>
      </div>

      {/* Order List */}
      {loading ? (
        <Loading />
      ) : donHangList.length === 0 ? (
        <div className={styles.emptyState}>
          <FiPackage size={48} />
          <p>Không có đơn giao nào</p>
        </div>
      ) : (
        <div className={styles.orderList}>
          {donHangList.map((dh) => {
            const sc = statusColor(dh.trangThaiDon);
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
                    {statusLabel(dh.trangThaiDon)}
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

                {dh.soDienThoai && (
                  <div className={styles.infoRow}>
                    <FiPhone size={14} />
                    <a
                      href={`tel:${dh.soDienThoai}`}
                      className={styles.phoneLink}
                    >
                      {dh.soDienThoai}
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
                  {dh.trangThaiDon === "dang_cho_giao" && (
                    <button
                      className={styles.btnDangGiao}
                      onClick={() => handleXacNhanDangGiao(dh)}
                      disabled={updating === dh.id}
                    >
                      {updating === dh.id ? "..." : <><FiNavigation size={14} /> Đang giao</>}
                    </button>
                  )}
                  {dh.trangThaiDon === "dang_giao" && (
                    <button
                      className={styles.btnDaGiao}
                      onClick={() => setConfirmTarget(dh)}
                      disabled={updating === dh.id}
                    >
                      {updating === dh.id ? "..." : <><FiCheck size={14} /> Đã giao</>}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={!!confirmTarget}
        title="Xác nhận đã giao"
        message={`Xác nhận giao đơn ${confirmTarget?.maDonHang} cho ${confirmTarget?.tenKhachHang}?`}
        confirmText="Xác nhận đã giao"
        cancelText="Hủy"
        onConfirm={handleXacNhanDaGiao}
        onClose={() => setConfirmTarget(null)}
        loading={updating !== null}
      />

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
