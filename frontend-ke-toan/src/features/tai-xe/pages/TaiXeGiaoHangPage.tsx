import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiCheck,
  FiChevronDown,
  FiMapPin,
  FiNavigation,
  FiPackage,
  FiPhone,
  FiRefreshCw,
  FiSearch,
  FiTruck,
  FiX,
} from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { ConfirmModal, Loading, Modal } from "../../../shared/components/Common";
import { useAuth, useToast, usePageRole } from "../../../shared/hooks";
import {
  layDonHangDaGiao,
  layDonHangGiaoCuaToi,
  taiXeCapNhatTrangThaiGiao,
  taiXeTronLai,
  layThongKeTaiXe,
} from "../../../shared/services/api";
import styles from "./TaiXeGiaoHangPage.module.css";
import { formatDateVN } from "../../../shared/utils/dateUtils";

function formatCurrency(v: number) {
  return v?.toLocaleString("vi-VN") + " đ" || "0 đ";
}
function formatDate(d: string | null | undefined): string {
  return d ? formatDateVN(d) : "";
}

type TabType = "dang_giao" | "da_giao";

/**
 * Mỗi row trong danh sách là 1 TRẠM (LichSanXuat) của 1 đơn hàng.
 * API backend trả về 1 row / trạm vì đơn hàng có thể có nhiều trạm,
 * mỗi trạm có 1 tài xế riêng và hành động (Đã giao / Trộn lại) độc lập.
 */
interface DonHangTheoTram {
  // Các trường DonHang
  id: number;
  maDonHang: string;
  tenKhachHang: string;
  diaChiNhan: string;
  soDienThoai: string;
  tenMacBeTong: string | null;
  khoiLuongDat: number;
  khoiLuongThucTe: number | null;
  thanhTien: number | null;
  trangThaiDon: string;
  ngayGiao: string | null;
  // Trường lichSX bổ sung
  idLichSanXuat: number;
  idTramTron: number | null;
  tenTram: string | null;
  tenTaiXe: string | null;
  bienSoXe: string | null;
  trangThaiGiao: string | null;
  khoiLuongDaTron: number | null;
  khoiLuongGiaoThucTe: number | null;
  ngayXacNhanGiao: string | null;
}

export default function TaiXeGiaoHangPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { hasAnyRole } = usePageRole();
  const { toasts, showToast } = useToast();
  const isKyThuat = hasAnyRole(["ky_thuat"]);

  const [allDangGiao, setAllDangGiao] = useState<DonHangTheoTram[]>([]);
  const [allDaGiao, setAllDaGiao] = useState<DonHangTheoTram[]>([]);
  const [thongKe, setThongKe] = useState({ tongDon: 0, chuaGiao: 0, daGiao: 0 });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>("dang_giao");

  // Search & filter state
  const [search, setSearch] = useState("");
  const [filterKhachHang, setFilterKhachHang] = useState("");
  const [showKhachHangDropdown, setShowKhachHangDropdown] = useState(false);

  // Confirm state
  const [updating, setUpdating] = useState<number | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<DonHangTheoTram | null>(null);

  // Trộn lại modal state
  const [tronLaiModalOpen, setTronLaiModalOpen] = useState(false);
  const [tronLaiTarget, setTronLaiTarget] = useState<DonHangTheoTram | null>(null);
  const [lyDoTronLai, setLyDoTronLai] = useState("");
  const [tronLaiLoading, setTronLaiLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [dangGiao, daGiao, stats] = await Promise.all([
        layDonHangGiaoCuaToi(),
        layDonHangDaGiao(),
        layThongKeTaiXe(),
      ]);
      setAllDangGiao(dangGiao || []);
      setAllDaGiao(daGiao || []);
      setThongKe(stats);
    } catch {
      showToast("Không tải được danh sách", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Danh sách khách hàng duy nhất cho dropdown filter
  const khachHangOptions = useMemo(() => {
    const list = activeTab === "dang_giao" ? allDangGiao : allDaGiao;
    const unique = Array.from(new Set(list.map((d) => d.tenKhachHang || "")))
      .filter(Boolean)
      .sort();
    return unique;
  }, [activeTab, allDangGiao, allDaGiao]);

  // Lọc danh sách theo search + filter khách hàng
  const filteredList = useMemo(() => {
    const list = activeTab === "dang_giao" ? allDangGiao : allDaGiao;
    return list.filter((d) => {
      const matchSearch =
        !search ||
        d.maDonHang?.toLowerCase().includes(search.toLowerCase()) ||
        d.tenKhachHang?.toLowerCase().includes(search.toLowerCase()) ||
        d.diaChiNhan?.toLowerCase().includes(search.toLowerCase()) ||
        d.tenTram?.toLowerCase().includes(search.toLowerCase()) ||
        d.tenTaiXe?.toLowerCase().includes(search.toLowerCase());
      const matchKhachHang =
        !filterKhachHang || d.tenKhachHang === filterKhachHang;
      return matchSearch && matchKhachHang;
    });
  }, [activeTab, allDangGiao, allDaGiao, search, filterKhachHang]);

  const handleXacNhanDangGiao = async (row: DonHangTheoTram) => {
    setUpdating(row.idLichSanXuat);
    try {
      await taiXeCapNhatTrangThaiGiao(row.id, "dang_giao", undefined, row.idLichSanXuat);
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
    const targetId = confirmTarget.id;
    const idLichSanXuat = confirmTarget.idLichSanXuat;

    // Optimistic: xóa khỏi danh sách "đang giao" ngay
    setAllDangGiao((prev) => prev.filter((d) => d.idLichSanXuat !== idLichSanXuat));
    setConfirmTarget(null);

    try {
      await taiXeCapNhatTrangThaiGiao(targetId, "da_giao", undefined, idLichSanXuat);
      showToast("Xác nhận giao hàng thành công");
      loadData();
    } catch (err) {
      loadData();
      showToast(err instanceof Error ? err.message : "Lỗi xác nhận giao", "error");
    } finally {
      setUpdating(null);
    }
  };

  // Mở modal trộn lại
  const handleOpenTronLai = (row: DonHangTheoTram) => {
    setTronLaiTarget(row);
    setLyDoTronLai("");
    setTronLaiModalOpen(true);
  };

  // Xác nhận trộn lại
  const handleTronLai = async () => {
    if (!tronLaiTarget || !lyDoTronLai.trim()) return;
    const idDonHang = tronLaiTarget.id;
    const idLichSanXuat = tronLaiTarget.idLichSanXuat;
    setTronLaiLoading(true);
    try {
      // Reset trạng thái đơn về "dang_san_xuat" + lưu lịch sử (theo trạm)
      await taiXeTronLai(idDonHang, lyDoTronLai.trim(), idLichSanXuat);
      showToast("Đã trộn lại. Đang chuyển sang trang điều phối lịch sản xuất.");
      setTronLaiModalOpen(false);
      setTronLaiTarget(null);
      setLyDoTronLai("");
      navigate("/dieu-phoi/lich-san-xuat", {
        state: { refresh: Date.now(), idDonHangTronLai: idDonHang },
      });
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Lỗi trộn lại", "error");
    } finally {
      setTronLaiLoading(false);
    }
  };

  const statusColor = (s: string) => {
    if (s === "dang_giao") return { bg: "#00968822", color: "#009688" };
    return { bg: "#4caf5022", color: "#4caf50" };
  };

  const statusLabel = (s: string) => {
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
        {isKyThuat && (
          <div className={styles.pageSubtitle} style={{ fontSize: 12, color: '#f59e0b', marginTop: 4 }}>
            Kỹ thuật công trình - Xác nhận giao hàng
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === "dang_giao" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("dang_giao")}
        >
          <FiNavigation size={15} />
          Đang giao
          {allDangGiao.length > 0 && (
            <span className={styles.tabBadge}>{allDangGiao.length}</span>
          )}
        </button>
        <button
          className={`${styles.tab} ${activeTab === "da_giao" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("da_giao")}
        >
          <FiCheck size={15} />
          Đã giao
          {allDaGiao.length > 0 && (
            <span className={`${styles.tabBadge} ${styles.tabBadgeSuccess}`}>
              {allDaGiao.length}
            </span>
          )}
        </button>
      </div>

      {/* Search + Filter bar */}
      <div className={styles.filterBar}>
        <div className={styles.searchWrap}>
          <FiSearch size={15} className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            placeholder="Tìm theo mã đơn, khách hàng, địa chỉ, trạm, tài xế..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              className={styles.searchClear}
              onClick={() => setSearch("")}
            >
              <FiX size={14} />
            </button>
          )}
        </div>

        {/* Dropdown khách hàng */}
        <div className={styles.dropdownWrap}>
          <button
            className={styles.dropdownTrigger}
            onClick={() => setShowKhachHangDropdown((v) => !v)}
          >
            <span>{filterKhachHang || "Tất cả khách hàng"}</span>
            <FiChevronDown size={15} />
          </button>
          {showKhachHangDropdown && (
            <>
              <div
                className={styles.dropdownOverlay}
                onClick={() => setShowKhachHangDropdown(false)}
              />
              <div className={styles.dropdownMenu}>
                <button
                  className={`${styles.dropdownItem} ${!filterKhachHang ? styles.dropdownItemActive : ""}`}
                  onClick={() => {
                    setFilterKhachHang("");
                    setShowKhachHangDropdown(false);
                  }}
                >
                  Tất cả khách hàng
                </button>
                {khachHangOptions.map((kh) => (
                  <button
                    key={kh}
                    className={`${styles.dropdownItem} ${filterKhachHang === kh ? styles.dropdownItemActive : ""}`}
                    onClick={() => {
                      setFilterKhachHang(kh);
                      setShowKhachHangDropdown(false);
                    }}
                  >
                    {kh}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {filterKhachHang && (
        <div className={styles.activeFilter}>
          <span>Khách hàng: <strong>{filterKhachHang}</strong></span>
          <button onClick={() => setFilterKhachHang("")}>
            <FiX size={12} /> Xóa
          </button>
        </div>
      )}

      {/* Order List */}
      {loading ? (
        <Loading />
      ) : filteredList.length === 0 ? (
        <div className={styles.emptyState}>
          <FiPackage size={48} />
          <p>
            {activeTab === "dang_giao"
              ? "Không có đơn đang giao"
              : "Chưa có đơn hàng nào được giao"}
          </p>
        </div>
      ) : (
        <div className={styles.orderGrid}>
          {filteredList.map((row) => {
            const isDangGiao = activeTab === "dang_giao";
            const sc = isDangGiao
              ? statusColor(row.trangThaiDon)
              : { bg: "#4caf5022", color: "#4caf50" };
            const label = isDangGiao
              ? statusLabel(row.trangThaiDon)
              : "Đã giao";

            return (
              <div key={row.idLichSanXuat} className={styles.orderCard}>
                {/* Card header: mã đơn + trạm + tài xế + trạng thái */}
                <div className={styles.orderCardHeader}>
                  <div className={styles.orderCardHeaderLeft}>
                    <div className={styles.orderMa}>{row.maDonHang}</div>
                    <div className={styles.orderKhach}>{row.tenKhachHang}</div>
                  </div>
                  <span
                    className={styles.orderStatus}
                    style={{ background: sc.bg, color: sc.color }}
                  >
                    {label}
                  </span>
                </div>

                {/* Trạm chip */}
                <div className={styles.tramChipRow}>
                  <span className={styles.tramChip}>
                    <FiPackage size={12} />
                    {row.tenTram || "Chưa gán trạm"}
                  </span>
                  {row.tenTaiXe && (
                    <span className={styles.tramChip}>
                      <FiTruck size={12} />
                      {row.tenTaiXe}
                      {row.bienSoXe ? ` · ${row.bienSoXe}` : ""}
                    </span>
                  )}
                </div>

                <div className={styles.infoRow}>
                  <FiMapPin size={14} />
                  <span>{row.diaChiNhan || "Chưa có địa chỉ"}</span>
                </div>

                <div className={styles.infoRow}>
                  <FiPackage size={14} />
                  <span>
                    <strong>
                      {(() => {
                        // Ưu tiên hiển thị KL thực tế đã giao > KL thực tế đã trộn > KL đặt ban đầu
                        const klThucTe =
                          (row.khoiLuongGiaoThucTe && row.khoiLuongGiaoThucTe > 0
                            ? row.khoiLuongGiaoThucTe
                            : null) ??
                          (row.khoiLuongDaTron && row.khoiLuongDaTron > 0
                            ? row.khoiLuongDaTron
                            : null);
                        return `${(klThucTe ?? row.khoiLuongDat ?? 0).toFixed(1)} m³`;
                      })()}
                    </strong>{" "}
                    · {row.tenMacBeTong || "—"}
                  </span>
                </div>

                {row.soDienThoai && (
                  <div className={styles.infoRow}>
                    <FiPhone size={14} />
                    <a
                      href={`tel:${row.soDienThoai}`}
                      className={styles.phoneLink}
                    >
                      {row.soDienThoai}
                    </a>
                  </div>
                )}

                <div className={styles.orderFooter}>
                  <span className={styles.orderDate}>
                    Giao: {formatDate(
                      (row.ngayXacNhanGiao as unknown as string) ||
                        (row.ngayGiao as unknown as string)
                    )}
                  </span>
                  {row.thanhTien && (
                    <span className={styles.orderAmount}>
                      {formatCurrency(row.thanhTien)}
                    </span>
                  )}
                </div>

                {/* Actions - theo từng trạm (idLichSanXuat) */}
                <div className={styles.actionRow}>
                  <button
                    className={styles.btnDetail}
                    onClick={() => navigate(`/tai-xe/don-hang/${row.id}`)}
                  >
                    Chi tiết
                  </button>
                  {isDangGiao && row.trangThaiDon === "dang_giao" && (
                    <>
                      <button
                        className={`${styles.btnDaGiao} ${styles.btnTronLai}`}
                        onClick={() => handleOpenTronLai(row)}
                        disabled={updating === row.idLichSanXuat}
                      >
                        <FiRefreshCw size={14} /> Trộn lại
                      </button>
                      <button
                        className={styles.btnDaGiao}
                        onClick={() => setConfirmTarget(row)}
                        disabled={updating === row.idLichSanXuat}
                      >
                        {updating === row.idLichSanXuat ? (
                          "..."
                        ) : (
                          <>
                            <FiCheck size={14} /> Đã giao
                          </>
                        )}
                      </button>
                    </>
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
        message={
          confirmTarget
            ? `Xác nhận giao đơn ${confirmTarget.maDonHang} - ${confirmTarget.tenTram || "trạm"} (${confirmTarget.tenTaiXe || "tài xế"}) cho ${confirmTarget.tenKhachHang}?`
            : ""
        }
        confirmText="Xác nhận đã giao"
        cancelText="Hủy"
        onConfirm={handleXacNhanDaGiao}
        onClose={() => setConfirmTarget(null)}
        loading={updating !== null}
      />

      {/* Modal Trộn lại */}
      <Modal
        isOpen={tronLaiModalOpen}
        onClose={() => setTronLaiModalOpen(false)}
        title={`Trộn lại - ${tronLaiTarget?.maDonHang}${tronLaiTarget?.tenTram ? ` (${tronLaiTarget.tenTram})` : ""}`}
        footer={
          <>
            <button
              className="btn btn-cancel"
              onClick={() => setTronLaiModalOpen(false)}
              disabled={tronLaiLoading}
            >
              Hủy
            </button>
            <button
              className="btn btn-save"
              onClick={handleTronLai}
              disabled={!lyDoTronLai.trim() || tronLaiLoading}
            >
              {tronLaiLoading ? "Đang xử lý..." : "Xác nhận trộn lại"}
            </button>
          </>
        }
      >
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 16 }}>
            Trộm lại cho <strong>{tronLaiTarget?.tenTram || "trạm"}</strong> · Tài xế <strong>{tronLaiTarget?.tenTaiXe || "—"}</strong>.
            Đơn hàng sẽ được trả về bước <strong>tạo lịch sản xuất</strong> để điều phối lên lịch lại cho trạm này.
          </p>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>
              Lý do trộn lại <span style={{ color: "var(--color-danger)" }}>*</span>
            </label>
            <textarea
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                fontSize: 14,
                fontFamily: "inherit",
                resize: "vertical",
                minHeight: 100,
                boxSizing: "border-box",
              }}
              value={lyDoTronLai}
              onChange={(e) => setLyDoTronLai(e.target.value)}
              placeholder="VD: Bê tông bị lỗi, cần trộn lại đơn mới..."
              autoFocus
            />
          </div>
          <div
            style={{
              padding: "10px 12px",
              background: "rgba(234, 88, 12, 0.08)",
              border: "1px solid rgba(234, 88, 12, 0.3)",
              borderRadius: 8,
              fontSize: 12,
              color: "#ea580c",
            }}
          >
            <strong>Lưu ý:</strong> Lịch sản xuất của trạm này sẽ được reset. Đơn hàng sẽ được chuyển sang trang điều phối để tạo lịch sản xuất mới cho trạm đó. Các trạm khác giữ nguyên trạng thái.
          </div>
        </div>
      </Modal>

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
