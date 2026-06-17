import React, { useState, useEffect, useCallback, useMemo } from "react";
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
import { layDonHangTramTron } from "../../../shared/services/api";
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

/** Trạng thái giao của 1 trạm (LichSanXuat) */
function tramGiaoBadge(trangThaiGiao?: string | null) {
  if (trangThaiGiao === "da_giao") {
    return { label: "Đã giao", cls: styles.tramBadgeXong };
  }
  if (trangThaiGiao === "tron_lai") {
    return { label: "Đã trộn lại", cls: styles.tramBadgeCho };
  }
  return { label: "Đang giao", cls: styles.tramBadgeGiao };
}

/** Trạng thái sản xuất của 1 trạm (LichSanXuat.trangThai) */
function tramSxBadge(trangThai?: string | null) {
  if (trangThai === "da_xong") {
    return { label: "Đã trộn xong", cls: styles.tramBadgeXong };
  }
  if (trangThai === "dang_san_xuat") {
    return { label: "Đang trộn", cls: styles.tramBadgeGiao };
  }
  return { label: "Chờ trộn", cls: styles.tramBadgeCho };
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
  id?: number;
  idTramTron?: number | null;
  tenTram?: string | null;
  idTaiXe?: number | null;
  tenTaiXe?: string | null;
  bienSoXe?: string | null;
  kyThuatCongTrinh?: string | null;
  nguoiOmOng?: string | null;
  nguoiBatOng?: string | null;
  phuongAnDo?: string | null;
  ghiChu?: string | null;
  thoiGianTron?: string | null;
  thoiGianXuatBen?: string | null;
  thoiGianBatDauDo?: string | null;
  thoiGianKetThucDo?: string | null;
  trangThai?: string | null;
  khoiLuongDaTron?: number | null;
  // Trạng thái giao theo từng trạm (từ backend)
  trangThaiGiao?: string | null;
  khoiLuongGiaoThucTe?: number | null;
  ngayXacNhanGiao?: string | null;
  ghiChuXe?: string | null;
  // Danh sách các lần trộn riêng biệt (xe/tài xế/khối lượng) của trạm này
  lanTrons?: Array<{
    id: number;
    idXe?: number | null;
    idTaiXe?: number | null;
    tenTaiXe?: string | null;
    bienSoXe?: string | null;
    khoiLuongTron?: number | null;
    ngayTron?: string | null;
    thoiGianBatDauDo?: string | null;
    ghiChuXe?: string | null;
  }>;
}

export default function KhoDonHangPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toasts, showToast } = useToast();

  const [donHang, setDonHang] = useState<DonHangData | null>(null);
  const [lichSanXuatList, setLichSanXuatList] = useState<LichSanXuatData[]>([]);

  const loadData = useCallback(async () => {
    if (!id) return;
    try {
      const res = await layDonHangTramTron(parseInt(id));
      setDonHang(res.donHang);
      setLichSanXuatList(Array.isArray(res.lichSanXuat) ? res.lichSanXuat : []);
    } catch {
      showToast("Không tải được thông tin đơn hàng", "error");
    }
  }, [id, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Tổng hợp khối lượng đã trộn / đã giao từ tất cả các trạm
  const tongKhoiLuongDaTron = useMemo(
    () =>
      lichSanXuatList.reduce(
        (sum, ls) => sum + (ls.khoiLuongDaTron || 0),
        0,
      ),
    [lichSanXuatList],
  );
  const tongKhoiLuongGiaoThucTe = useMemo(
    () =>
      lichSanXuatList.reduce(
        (sum, ls) => sum + (ls.khoiLuongGiaoThucTe || 0),
        0,
      ),
    [lichSanXuatList],
  );

  if (!donHang) {
    return <Loading />;
  }

  const currentStepIdx = TRANG_THAI_STEPS.findIndex(
    (s) => s.key === donHang.trangThaiDon
  );
  const connLai = (donHang.thanhTien || 0) - (donHang.daThanhToan || 0);
  const trangThai = donHang.trangThaiDon || "dang_san_xuat";
  const khoiLuongDat = donHang.khoiLuongDat || 0;

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

        {/* Trạng thái hiện tại */}
        <div className={styles.pageActions}>
          {trangThai === "dang_san_xuat" && (
            <span className={styles.completedBadge}>
              <FiClock size={16} />
              {lichSanXuatList.length} trạm đang sản xuất
            </span>
          )}
          {trangThai === "dang_giao" && (
            <span className={styles.completedBadge}>
              <FiTruck size={16} />
              Đang giao hàng
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
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Đã trộn (tất cả trạm)</span>
            <span
              className={`${styles.infoValue} ${
                tongKhoiLuongDaTron > 0 ? styles.infoValueSuccess : ""
              }`}
            >
              {tongKhoiLuongDaTron > 0
                ? `${tongKhoiLuongDaTron.toFixed(1)} m³`
                : "—"}
            </span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Đã giao (tất cả trạm)</span>
            <span
              className={`${styles.infoValue} ${
                tongKhoiLuongGiaoThucTe > 0 ? styles.infoValueSuccess : ""
              }`}
            >
              {tongKhoiLuongGiaoThucTe > 0
                ? `${tongKhoiLuongGiaoThucTe.toFixed(1)} m³`
                : "—"}
            </span>
          </div>
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
      </div>

      {/* Section: Lịch sản xuất (theo từng trạm) */}
      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitle}>
            <div className={styles.sectionAccent} />
            <FiTruck size={16} style={{ color: "var(--color-primary)" }} />
            Lịch sản xuất ({lichSanXuatList.length} trạm)
          </div>
        </div>

        {lichSanXuatList.length > 0 ? (
          <div className={styles.subTableWrap}>
            {lichSanXuatList.map((ls, idx) => {
              const sxBadge = tramSxBadge(ls.trangThai);
              const giaoBadge = tramGiaoBadge(ls.trangThaiGiao);
              const khoiLuongCuaTram = ls.khoiLuongDaTron || 0;
              return (
                <div key={ls.id ?? idx} className={styles.tramBlock}>
                  <div className={styles.tramBlockHeader}>
                    <FiPackage size={14} style={{ color: "var(--color-primary)" }} />
                    <span className={styles.tramBlockTitle}>
                      Trạm {idx + 1}: {ls.tenTram || "Chưa gán trạm"}
                    </span>
                    <span className={`${styles.tramBadge} ${sxBadge.cls}`}>
                      {sxBadge.label}
                      {khoiLuongCuaTram > 0 ? ` · ${khoiLuongCuaTram.toFixed(1)}/${khoiLuongDat.toFixed(1)} m³` : ""}
                    </span>
                    <span className={`${styles.tramBadge} ${giaoBadge.cls}`}>
                      {giaoBadge.label}
                      {ls.khoiLuongGiaoThucTe ? ` · ${ls.khoiLuongGiaoThucTe.toFixed(1)} m³` : ""}
                    </span>
                  </div>

                  <div className={styles.tramBlockBody}>
                    <div className={styles.tramRow}>
                      <span className={styles.tramRowLabel}>Biển số xe:</span>
                      <span className={styles.tramRowValue}>{ls.bienSoXe || "—"}</span>
                    </div>
                    <div className={styles.tramRow}>
                      <span className={styles.tramRowLabel}>Tài xế:</span>
                      <span className={styles.tramRowValue}>{ls.tenTaiXe || "—"}</span>
                    </div>

                    {/* Hiển thị chi tiết từng lần trộn riêng biệt nếu có > 1 lần */}
                    {ls.lanTrons && ls.lanTrons.length > 1 && (
                      <div className={`${styles.tramRow} ${styles.tramRowFull}`}>
                        <span className={styles.tramRowLabel}>
                          Chi tiết {ls.lanTrons.length} lần trộn:
                        </span>
                        <div className={styles.tramRowValue} style={{ width: "100%" }}>
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                            <thead>
                              <tr style={{ background: "rgba(7,60,235,0.06)" }}>
                                <th style={{ padding: "6px 8px", textAlign: "left", borderBottom: "1px solid var(--color-border)", fontWeight: 600 }}>
                                  Lần
                                </th>
                                <th style={{ padding: "6px 8px", textAlign: "left", borderBottom: "1px solid var(--color-border)", fontWeight: 600 }}>
                                  Thời gian
                                </th>
                                <th style={{ padding: "6px 8px", textAlign: "left", borderBottom: "1px solid var(--color-border)", fontWeight: 600 }}>
                                  Biển số xe
                                </th>
                                <th style={{ padding: "6px 8px", textAlign: "left", borderBottom: "1px solid var(--color-border)", fontWeight: 600 }}>
                                  Tài xế
                                </th>
                                <th style={{ padding: "6px 8px", textAlign: "right", borderBottom: "1px solid var(--color-border)", fontWeight: 600 }}>
                                  Khối lượng
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {ls.lanTrons.map((lt, ltIdx) => (
                                <tr key={lt.id}>
                                  <td style={{ padding: "6px 8px", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                                    {ltIdx + 1}
                                  </td>
                                  <td style={{ padding: "6px 8px", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                                    {formatDateTime(lt.thoiGianBatDauDo || lt.ngayTron || "") || "—"}
                                  </td>
                                  <td style={{ padding: "6px 8px", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                                    {lt.bienSoXe || "—"}
                                  </td>
                                  <td style={{ padding: "6px 8px", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                                    {lt.tenTaiXe || "—"}
                                  </td>
                                  <td style={{ padding: "6px 8px", textAlign: "right", borderBottom: "1px solid rgba(0,0,0,0.05)", fontWeight: 600 }}>
                                    {lt.khoiLuongTron ? `${lt.khoiLuongTron.toFixed(1)} m³` : "—"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    <div className={styles.tramRow}>
                      <span className={styles.tramRowLabel}>Kỹ thuật:</span>
                      <span className={styles.tramRowValue}>{ls.kyThuatCongTrinh || "—"}</span>
                    </div>
                    <div className={styles.tramRow}>
                      <span className={styles.tramRowLabel}>Người ôm ống:</span>
                      <span className={styles.tramRowValue}>{ls.nguoiOmOng || "—"}</span>
                    </div>
                    <div className={styles.tramRow}>
                      <span className={styles.tramRowLabel}>Người bắt ống:</span>
                      <span className={styles.tramRowValue}>{ls.nguoiBatOng || "—"}</span>
                    </div>
                    <div className={styles.tramRow}>
                      <span className={styles.tramRowLabel}>Phương án đổ:</span>
                      <span className={styles.tramRowValue}>{ls.phuongAnDo || "—"}</span>
                    </div>
                    <div className={styles.tramRow}>
                      <span className={styles.tramRowLabel}>Khối lượng giao thực tế:</span>
                      <span className={styles.tramRowValue}>
                        {ls.khoiLuongGiaoThucTe ? `${ls.khoiLuongGiaoThucTe.toFixed(1)} m³` : "—"}
                      </span>
                    </div>
                    {ls.ghiChuXe && (
                      <div className={`${styles.tramRow} ${styles.tramRowFull}`}>
                        <span className={styles.tramRowLabel}>Ghi chú xe:</span>
                        <span className={styles.tramRowValue}>{ls.ghiChuXe}</span>
                      </div>
                    )}
                    {ls.ghiChu && (
                      <div className={`${styles.tramRow} ${styles.tramRowFull}`}>
                        <span className={styles.tramRowLabel}>Ghi chú:</span>
                        <span className={styles.tramRowValue}>{ls.ghiChu}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className={styles.subTableEmpty}>
            <FiTruck size={24} style={{ opacity: 0.3, marginBottom: 8 }} />
            <div>Chưa có lịch sản xuất</div>
          </div>
        )}
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
