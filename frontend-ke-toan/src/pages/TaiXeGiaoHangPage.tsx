import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiCheck,
  FiChevronDown,
  FiMapPin,
  FiNavigation,
  FiPackage,
  FiPhone,
  FiSearch,
  FiTruck,
  FiX,
} from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { ConfirmModal, Loading } from "../components/Common";
import { useAuth, useToast } from "../hooks";
import {
  layDonHangGiaoCuaToi,
  layLichSuGiaoHangTaiXe,
  taiXeCapNhatTrangThaiGiao,
  layThongKeTaiXe,
} from "../services/api";
import { DonHang } from "../types";
import styles from "./TaiXeGiaoHangPage.module.css";
import { formatDateVN } from "../utils/dateUtils";

function formatCurrency(v: number) {
  return v?.toLocaleString("vi-VN") + " đ" || "0 đ";
}
function formatDate(d: string | null | undefined): string {
  return d ? formatDateVN(d) : "";
}

type TabType = "can_giao" | "lich_su";

export default function TaiXeGiaoHangPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toasts, showToast } = useToast();

  const [allCanGiao, setAllCanGiao] = useState<DonHang[]>([]);
  const [allLichSu, setAllLichSu] = useState<DonHang[]>([]);
  const [thongKe, setThongKe] = useState({ tongDon: 0, chuaGiao: 0, daGiao: 0 });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>("can_giao");

  // Search & filter state
  const [search, setSearch] = useState("");
  const [filterKhachHang, setFilterKhachHang] = useState("");
  const [showKhachHangDropdown, setShowKhachHangDropdown] = useState(false);

  // Confirm state
  const [updating, setUpdating] = useState<number | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<DonHang | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [canGiao, lichSu, stats] = await Promise.all([
        layDonHangGiaoCuaToi(),
        layLichSuGiaoHangTaiXe(),
        layThongKeTaiXe(),
      ]);
      setAllCanGiao(canGiao);
      setAllLichSu(lichSu);
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
    const list = activeTab === "can_giao" ? allCanGiao : allLichSu;
    const unique = Array.from(new Set(list.map((d) => d.tenKhachHang || "")))
      .filter(Boolean)
      .sort();
    return unique;
  }, [activeTab, allCanGiao, allLichSu]);

  // Lọc danh sách theo search + filter khách hàng
  const filteredList = useMemo(() => {
    const list = activeTab === "can_giao" ? allCanGiao : allLichSu;
    return list.filter((d) => {
      const matchSearch =
        !search ||
        d.maDonHang?.toLowerCase().includes(search.toLowerCase()) ||
        d.tenKhachHang?.toLowerCase().includes(search.toLowerCase()) ||
        d.diaChiNhan?.toLowerCase().includes(search.toLowerCase());
      const matchKhachHang =
        !filterKhachHang || d.tenKhachHang === filterKhachHang;
      return matchSearch && matchKhachHang;
    });
  }, [activeTab, allCanGiao, allLichSu, search, filterKhachHang]);

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
    const targetId = confirmTarget.id;

    // Optimistic: xóa khỏi danh sách "cần giao" ngay, không block UI
    setAllCanGiao((prev) => prev.filter((d) => d.id !== targetId));
    setConfirmTarget(null);

    try {
      await taiXeCapNhatTrangThaiGiao(targetId, "da_giao");
      showToast("Xác nhận giao hàng thành công");
      // Reload nền sau khi xác nhận thành công
      loadData();
    } catch (err) {
      // Rollback nếu lỗi
      loadData();
      showToast(err instanceof Error ? err.message : "Lỗi xác nhận giao", "error");
    } finally {
      setUpdating(null);
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

  const getStatusColorLichSu = (s: string) => {
    if (s === "nghiem_thu" || s === "da_thanh_toan")
      return { bg: "#10b98122", color: "#10b981" };
    if (s === "hoan_thanh") return { bg: "#073ceb22", color: "#073ceb" };
    return { bg: "#00968822", color: "#009688" };
  };

  const getStatusLabelLichSu = (s: string) => {
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
          <span>Giao hàng</span>
        </div>
        <div className={styles.pageSubtitle}>Xin chào, {user?.hoTen}</div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === "can_giao" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("can_giao")}
        >
          <FiNavigation size={15} />
          Cần giao
          {allCanGiao.length > 0 && (
            <span className={styles.tabBadge}>{allCanGiao.length}</span>
          )}
        </button>
        <button
          className={`${styles.tab} ${activeTab === "lich_su" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("lich_su")}
        >
          <FiCheck size={15} />
          Lịch sử
          {allLichSu.length > 0 && (
            <span className={`${styles.tabBadge} ${styles.tabBadgeSuccess}`}>
              {allLichSu.length}
            </span>
          )}
        </button>
      </div>

      {/* KPI row */}
      <div className={styles.kpiRow}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiValue}>{thongKe.chuaGiao}</div>
          <div className={styles.kpiLabel}>Chưa giao</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiValue} style={{ color: "#009688" }}>
            {thongKe.daGiao}
          </div>
          <div className={styles.kpiLabel}>Đã giao</div>
        </div>
      </div>

      {/* Search + Filter bar */}
      <div className={styles.filterBar}>
        <div className={styles.searchWrap}>
          <FiSearch size={15} className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            placeholder="Tìm theo mã đơn, khách hàng, địa chỉ..."
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
            {activeTab === "can_giao"
              ? "Không có đơn cần giao"
              : "Chưa có đơn hàng nào được giao"}
          </p>
        </div>
      ) : (
        <div className={styles.orderGrid}>
          {filteredList.map((dh) => {
            const isCanGiao = activeTab === "can_giao";
            const sc = isCanGiao
              ? statusColor(dh.trangThaiDon)
              : getStatusColorLichSu(dh.trangThaiDon);
            const label = isCanGiao
              ? statusLabel(dh.trangThaiDon)
              : getStatusLabelLichSu(dh.trangThaiDon);

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
                    {label}
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
                  {dh.thanhTien && (
                    <span className={styles.orderAmount}>
                      {formatCurrency(dh.thanhTien)}
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className={styles.actionRow}>
                  <button
                    className={styles.btnDetail}
                    onClick={() => navigate(`/tai-xe/don-hang/${dh.id}`)}
                  >
                    Chi tiết
                  </button>
                  {isCanGiao && dh.trangThaiDon === "dang_san_xuat" && (
                    <button
                      className={styles.btnDangGiao}
                      onClick={() => handleXacNhanDangGiao(dh)}
                      disabled={updating === dh.id}
                    >
                      {updating === dh.id ? (
                        "..."
                      ) : (
                        <>
                          <FiNavigation size={14} /> Đang giao
                        </>
                      )}
                    </button>
                  )}
                  {isCanGiao && dh.trangThaiDon === "dang_giao" && (
                    <button
                      className={styles.btnDaGiao}
                      onClick={() => setConfirmTarget(dh)}
                      disabled={updating === dh.id}
                    >
                      {updating === dh.id ? (
                        "..."
                      ) : (
                        <>
                          <FiCheck size={14} /> Đã giao
                        </>
                      )}
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
