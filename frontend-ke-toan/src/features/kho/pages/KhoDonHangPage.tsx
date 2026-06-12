import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  FiArrowLeft,
  FiCheck,
  FiUser,
  FiPackage,
  FiDollarSign,
  FiTruck,
  FiCheckCircle,
  FiClock,
} from "react-icons/fi";
import { layDonHangTramTron, xacNhanBatDauGiao } from "../../../shared/services/api";
import { TRANG_THAI_DON_LABELS, TRANG_THAI_DON_COLORS } from "../../../shared/types";
import { useToast } from "../../../shared/hooks";
import { Loading } from "../../../shared/components/Common";
import styles from "./KhoDonHangPage.module.css";
import { formatDateVN } from "../../../shared/utils/dateUtils";

const TRANG_THAI_STEPS = [
  { key: "dang_san_xuat", label: "Đang SX" },
  { key: "dang_giao", label: "Đang giao" },
  { key: "da_giao", label: "Đã giao" },
  { key: "nghiem_thu", label: "Nghiệm thu" },
  { key: "hoan_thanh", label: "Hoàn thành" },
];

function formatCurrency(v: number) {
  return v?.toLocaleString("vi-VN") + " đ" || "0 đ";
}

function formatDate(d: string) {
  return d ? formatDateVN(d) : '';
}

function formatDateTime(d: string) {
  return d ? formatDateVN(d) : '';
}

function statusColor(key: string) {
  return TRANG_THAI_DON_COLORS[key] || "#64748b";
}

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}

function statusBg(key: string) {
  const c = statusColor(key);
  return `rgba(${hexToRgb(c)}, 0.12)`;
}

interface DonHangData {
  id: number;
  maDonHang?: string;
  tenKhachHang?: string;
  soDienThoai?: string;
  diaChiNhan?: string;
  tenMacBeTong?: string;
  khoiLuongDat?: number;
  khoiLuongThucTe?: number;
  donGia?: number;
  thanhTien?: number;
  daThanhToan?: number;
  thoiGianGiaoDuKien?: string;
  ngayTaoDon?: string;
  ngayDuyet?: string;
  ngayGiao?: string;
  ghiChu?: string;
  trangThaiDon?: string;
}

interface LichSanXuatData {
  bienSoXe?: string;
  tenTaiXe?: string;
}

export default function KhoDonHangPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toasts, showToast } = useToast();

  const [donHang, setDonHang] = useState<DonHangData | null>(null);
  const [lichSanXuatList, setLichSanXuatList] = useState<LichSanXuatData[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await layDonHangTramTron(parseInt(id));
      setDonHang(res.donHang);
      setLichSanXuatList(Array.isArray(res.lichSanXuat) ? res.lichSanXuat : []);
    } catch {
      showToast("Không tải được thông tin đơn hàng", "error");
    } finally {
      setLoading(false);
    }
  }, [id, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleXacNhanBatDauGiao = async () => {
    if (!donHang) return;
    setConfirmLoading(true);
    try {
      await xacNhanBatDauGiao(donHang.id);
      showToast("Đã xác nhận sản xuất xong");
      loadData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Lỗi xác nhận", "error");
    } finally {
      setConfirmLoading(false);
    }
  };

  if (loading) return <Loading />;

  if (!donHang) {
    return (
      <div className={styles.loading}>
        <div className={styles.loadingSpinner} />
        <span>Không tìm thấy đơn hàng</span>
      </div>
    );
  }

  const currentStepIdx = TRANG_THAI_STEPS.findIndex(
    (s) => s.key === donHang.trangThaiDon
  );
  const connLai = (donHang.thanhTien || 0) - (donHang.daThanhToan || 0);
  const trangThai = donHang.trangThaiDon || "dang_san_xuat";

  return (
    <div className={styles.detailPage}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <button
            className={styles.backBtn}
            onClick={() => navigate("/tram-tron/lich-san-xuat")}
          >
            <FiArrowLeft size={18} />
          </button>
          <div>
            <div className={styles.pageTitle}>{donHang.maDonHang || `#${donHang.id}`}</div>
            <div className={styles.pageSubtitle}>
              Ngày tạo: {formatDate(donHang.ngayTaoDon || "")} ·{" "}
              <span
                style={{
                  color: statusColor(trangThai),
                  fontWeight: 600,
                }}
              >
                {TRANG_THAI_DON_LABELS[trangThai]}
              </span>
            </div>
          </div>
        </div>

        {/* Action buttons for Kho */}
        <div className={styles.pageActions}>
          {trangThai === "dang_san_xuat" && (
            <button
              className={`${styles.actionBtn} ${styles.actionBtnSuccess}`}
              onClick={handleXacNhanBatDauGiao}
              disabled={confirmLoading}
            >
              <FiCheck size={16} />
              {confirmLoading ? "Đang xử lý..." : "Xác nhận sản xuất xong"}
            </button>
          )}
          {(trangThai === "dang_giao") && (
            <span className={styles.completedBadge}>
              <FiTruck size={16} />
              {lichSanXuatList[0]?.tenTaiXe ? `Tài xế ${lichSanXuatList[0].tenTaiXe} đang giao` : "Đang giao hàng"}
            </span>
          )}
          {trangThai === "da_giao" && (
            <span className={styles.completedBadge}>
              <FiCheckCircle size={16} />
              Đã giao thành công
            </span>
          )}
        </div>
      </div>

      {/* Step Progress */}
      <div className={styles.stepProgressWrap}>
        <div className={styles.stepProgressTitle}>Tiến trình đơn hàng</div>
        <div className={styles.stepTrack}>
          <div className={styles.stepConnector}>
            <div className={styles.stepConnectorBg} />
            <div
              className={styles.stepConnectorFill}
              style={{
                width:
                  currentStepIdx >= 0
                    ? `${(currentStepIdx / (TRANG_THAI_STEPS.length - 1)) * 100}%`
                    : "0%",
              }}
            />
          </div>
          {TRANG_THAI_STEPS.map((step, idx) => {
            const lastStepIdx = TRANG_THAI_STEPS.length - 1;
            const isLastDone = idx === lastStepIdx && currentStepIdx === lastStepIdx;
            const done = idx < currentStepIdx || isLastDone;
            const active = idx === currentStepIdx;
            let circleClass = styles.stepCirclePending;
            if (done) circleClass = styles.stepCircleDone;
            else if (active) circleClass = styles.stepCircleActive;

            let labelClass = styles.stepLabel;
            if (done) labelClass = `${styles.stepLabel} ${styles.stepLabelDone}`;
            else if (active)
              labelClass = `${styles.stepLabel} ${styles.stepLabelActive}`;

            return (
              <div key={step.key} className={styles.stepItem}>
                <div className={`${styles.stepCircle} ${circleClass}`}>
                  {done ? <FiCheck size={14} /> : idx + 1}
                </div>
                <div className={labelClass}>{step.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Info Cards Grid */}
      <div className={styles.infoGrid}>
        {/* Card: Khách hàng */}
        <div className={styles.infoCard}>
          <div className={styles.infoCardTitle}>
            <FiUser size={14} /> Thông tin khách hàng
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Khách hàng</span>
            <span className={styles.infoValue}>{donHang.tenKhachHang || "—"}</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Số điện thoại</span>
            <span className={styles.infoValue}>{donHang.soDienThoai || "—"}</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Địa chỉ nhận</span>
            <span
              className={styles.infoValue}
              style={{ maxWidth: 220 }}
            >
              {donHang.diaChiNhan || "—"}
            </span>
          </div>
        </div>

        {/* Card: Sản phẩm */}
        <div className={styles.infoCard}>
          <div className={styles.infoCardTitle}>
            <FiPackage size={14} /> Thông tin sản phẩm
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Mác bê tông</span>
            <span
              className={`${styles.infoValue} ${styles.infoValuePrimary}`}
            >
              {donHang.tenMacBeTong || "—"}
            </span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Khối lượng đặt</span>
            <span className={styles.infoValue}>
              {donHang.khoiLuongDat ? `${donHang.khoiLuongDat} m³` : "—"}
            </span>
          </div>
          {donHang.khoiLuongThucTe && (
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Khối lượng thực tế</span>
              <span
                className={`${styles.infoValue} ${styles.infoValueSuccess}`}
              >
                {donHang.khoiLuongThucTe} m³
              </span>
            </div>
          )}
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Đơn giá</span>
            <span className={styles.infoValue}>
              {donHang.donGia ? formatCurrency(donHang.donGia) + "/m³" : "—"}
            </span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Giao dự kiến</span>
            <span className={styles.infoValue}>
              {formatDateTime(donHang.thoiGianGiaoDuKien || "")}
            </span>
          </div>
        </div>

        {/* Card: Thanh toán */}
        <div className={styles.infoCard}>
          <div className={styles.infoCardTitle}>
            <FiDollarSign size={14} /> Thông tin thanh toán
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Tổng tiền</span>
            <span
              className={`${styles.infoValue} ${styles.infoValuePrimary}`}
            >
              {formatCurrency(donHang.thanhTien || 0)}
            </span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Đã thanh toán</span>
            <span
              className={`${styles.infoValue} ${styles.infoValueSuccess}`}
            >
              {formatCurrency(donHang.daThanhToan || 0)}
            </span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Còn lại</span>
            <span
              className={`${styles.infoValue} ${
                connLai > 0
                  ? styles.infoValueDanger
                  : styles.infoValueSuccess
              }`}
            >
              {formatCurrency(connLai)}
            </span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Ngày duyệt</span>
            <span className={styles.infoValue}>
              {formatDate(donHang.ngayDuyet || "")}
            </span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Ngày giao</span>
            <span className={styles.infoValue}>
              {formatDate(donHang.ngayGiao || "")}
            </span>
          </div>
        </div>

        {/* Card: Giao hàng */}
        <div className={styles.infoCard}>
          <div className={styles.infoCardTitle}>
            <FiTruck size={14} /> Thông tin giao hàng
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Biển số xe</span>
            <span className={styles.infoValue}>
              {lichSanXuatList[0]?.bienSoXe || "—"}
            </span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Tài xế</span>
            <span className={styles.infoValue}>
              {lichSanXuatList[0]?.tenTaiXe || "—"}
            </span>
          </div>
        </div>
      </div>

      {/* Ghi chú đơn hàng */}
      {donHang.ghiChu && (
        <div className={styles.infoCard}>
          <div className={styles.infoCardTitle}>
            <FiClock size={14} /> Ghi chú đơn hàng
          </div>
          <div className={styles.infoRow} style={{ flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
            <span className={styles.infoValue} style={{ textAlign: "left", fontSize: 13 }}>
              {donHang.ghiChu}
            </span>
          </div>
        </div>
      )}

      {/* Toast */}
      <div
        style={{
          position: "fixed",
          top: 20,
          right: 20,
          zIndex: 300,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            style={{
              padding: "12px 16px",
              borderRadius: 8,
              boxShadow: "var(--shadow-md)",
              fontSize: 13,
              fontWeight: 500,
              display: "flex",
              alignItems: "center",
              gap: 10,
              background:
                t.type === "error" ? "var(--color-danger)" : "var(--color-success)",
              color: "white",
              minWidth: 280,
              animation: "taSlideIn 0.3s ease",
            }}
          >
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}
