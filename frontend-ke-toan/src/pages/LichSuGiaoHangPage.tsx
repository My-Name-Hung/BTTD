import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiCheck,
  FiChevronDown,
  FiMapPin,
  FiPackage,
  FiPhone,
  FiSearch,
  FiTruck,
  FiX,
} from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { Loading } from "../components/Common";
import { useAuth, useToast } from "../hooks";
import { layDonHangDaGiao } from "../services/api";
import { DonHang } from "../types";
import styles from "./TaiXeGiaoHangPage.module.css";
import { formatDateVN } from "../utils/dateUtils";

function formatCurrency(v: number) {
  return v?.toLocaleString("vi-VN") + " đ" || "0 đ";
}
function formatDate(d: string | null | undefined): string {
  return d ? formatDateVN(d) : "";
}

export default function LichSuGiaoHangPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toasts, showToast } = useToast();
  const [donHangList, setDonHangList] = useState<DonHang[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & filter
  const [search, setSearch] = useState("");
  const [filterKhachHang, setFilterKhachHang] = useState("");
  const [showKhachHangDropdown, setShowKhachHangDropdown] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await layDonHangDaGiao();
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

  const khachHangOptions = useMemo(() => {
    const unique = Array.from(
      new Set(donHangList.map((d) => d.tenKhachHang || "")),
    )
      .filter(Boolean)
      .sort();
    return unique;
  }, [donHangList]);

  const filteredList = useMemo(() => {
    return donHangList.filter((d) => {
      const matchSearch =
        !search ||
        d.maDonHang?.toLowerCase().includes(search.toLowerCase()) ||
        d.tenKhachHang?.toLowerCase().includes(search.toLowerCase()) ||
        d.diaChiNhan?.toLowerCase().includes(search.toLowerCase());
      const matchKhachHang =
        !filterKhachHang || d.tenKhachHang === filterKhachHang;
      return matchSearch && matchKhachHang;
    });
  }, [donHangList, search, filterKhachHang]);

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

      {/* Search + Filter */}
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
          <span>
            Khách hàng: <strong>{filterKhachHang}</strong>
          </span>
          <button onClick={() => setFilterKhachHang("")}>
            <FiX size={12} /> Xóa
          </button>
        </div>
      )}

      {/* Order Grid */}
      {loading ? (
        <Loading />
      ) : filteredList.length === 0 ? (
        <div className={styles.emptyState}>
          <FiPackage size={48} />
          <p>Chưa có đơn hàng nào được giao</p>
        </div>
      ) : (
        <div className={styles.orderGrid}>
          {filteredList.map((dh) => (
              <div key={dh.id} className={styles.orderCard}>
                <div className={styles.orderCardHeader}>
                  <div>
                    <div className={styles.orderMa}>{dh.maDonHang}</div>
                    <div className={styles.orderKhach}>{dh.tenKhachHang}</div>
                  </div>
                  <span
                    className={styles.orderStatus}
                    style={{ background: "#4caf5022", color: "#4caf50" }}
                  >
                    <FiCheck size={10} style={{ marginRight: 4 }} />
                    Đã giao
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

                <div className={styles.actionRow}>
                  <button
                    className={styles.btnDetail}
                    onClick={() => navigate(`/tai-xe/don-hang/${dh.id}`)}
                  >
                    Chi tiết
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
