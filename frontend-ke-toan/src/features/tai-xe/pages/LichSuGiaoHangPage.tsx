import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FiCalendar,
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
import { Loading } from "../../../shared/components/Common";
import { useAuth, useToast } from "../../../shared/hooks";
import { layDonHangDaGiao } from "../../../shared/services/api";
import { DonHang } from "../../../shared/types";
import styles from "./TaiXeGiaoHangPage.module.css";
import { formatDateVN } from "../../../shared/utils/dateUtils";

function formatCurrency(v: number) {
  return v?.toLocaleString("vi-VN") + " đ" || "0 đ";
}
function formatDate(d: string | null | undefined): string {
  return d ? formatDateVN(d) : "";
}

function getDateKey(d: string | null | undefined): string {
  if (!d) return "";
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
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
  const [khachHangSearch, setKhachHangSearch] = useState("");
  const khachHangSearchRef = useRef<HTMLInputElement>(null);

  // Date filter - mặc định không lọc (xem tất cả)
  const [filterDate, setFilterDate] = useState("");
  const [showDateDropdown, setShowDateDropdown] = useState(false);
  const dateDropdownRef = useRef<HTMLDivElement>(null);

  // Quick date options
  const quickDateOptions = [
    { label: "Hôm nay", getValue: () => {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    }},
    { label: "Hôm qua", getValue: () => {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }},
    { label: "7 ngày qua", getValue: () => {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }},
    { label: "30 ngày qua", getValue: () => {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }},
  ];

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

  // Focus search input when dropdown opens
  useEffect(() => {
    if (showKhachHangDropdown && khachHangSearchRef.current) {
      khachHangSearchRef.current.focus();
    }
  }, [showKhachHangDropdown]);

  // Close date dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dateDropdownRef.current && !dateDropdownRef.current.contains(e.target as Node)) {
        setShowDateDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const khachHangOptions = useMemo(() => {
    const unique = Array.from(
      new Set(donHangList.map((d) => d.tenKhachHang || "")),
    )
      .filter(Boolean)
      .sort();
    return unique;
  }, [donHangList]);

  const filteredKhachHangOptions = useMemo(() => {
    if (!khachHangSearch) return khachHangOptions;
    const q = khachHangSearch.toLowerCase();
    return khachHangOptions.filter((kh) => kh.toLowerCase().includes(q));
  }, [khachHangOptions, khachHangSearch]);

  // Get unique dates for quick select
  const availableDates = useMemo(() => {
    const dates = new Set<string>();
    donHangList.forEach((d) => {
      const key = getDateKey(d.ngayGiao as unknown as string);
      if (key) dates.add(key);
    });
    return Array.from(dates).sort().reverse();
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
      const matchDate = !filterDate || getDateKey(d.ngayGiao as unknown as string) === filterDate;
      return matchSearch && matchKhachHang && matchDate;
    });
  }, [donHangList, search, filterKhachHang, filterDate]);

  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split("-");
    const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  const handleDateInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilterDate(e.target.value);
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

      {/* Filter Bar - Compact */}
      <div className={styles.lichSuFilterBar}>
        {/* Search */}
        <div className={styles.lichSuSearchWrap}>
          <FiSearch size={16} className={styles.lichSuSearchIcon} />
          <input
            className={styles.lichSuSearchInput}
            placeholder="Tìm kiếm..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              className={styles.lichSuSearchClear}
              onClick={() => setSearch("")}
            >
              <FiX size={14} />
            </button>
          )}
        </div>

        {/* Date Picker */}
        <div className={styles.lichSuDateWrap} ref={dateDropdownRef}>
          <button
            className={`${styles.lichSuDateBtn} ${filterDate ? styles.lichSuDateBtnActive : ""}`}
            onClick={() => setShowDateDropdown(!showDateDropdown)}
          >
            <FiCalendar size={16} />
            <span>{filterDate ? formatDisplayDate(filterDate) : "Chọn ngày"}</span>
            <FiChevronDown size={14} className={showDateDropdown ? styles.rotated : ""} />
          </button>

          {showDateDropdown && (
            <>
              <div
                className={styles.dropdownOverlay}
                onClick={() => setShowDateDropdown(false)}
              />
              <div className={styles.lichSuDateDropdown}>
                {/* Date input */}
                <div className={styles.lichSuDateInputWrap}>
                  <input
                    type="date"
                    className={styles.lichSuDateInput}
                    value={filterDate}
                    onChange={handleDateInputChange}
                    max={new Date().toISOString().split("T")[0]}
                  />
                </div>

                {/* Quick select */}
                <div className={styles.lichSuDateQuick}>
                  {quickDateOptions.map((opt) => (
                    <button
                      key={opt.label}
                      className={`${styles.lichSuQuickBtn} ${filterDate === opt.getValue() ? styles.lichSuQuickBtnActive : ""}`}
                      onClick={() => {
                        setFilterDate(opt.getValue());
                        setShowDateDropdown(false);
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {/* Recent dates with data */}
                {availableDates.length > 0 && (
                  <div className={styles.lichSuDateRecent}>
                    <div className={styles.lichSuDateRecentLabel}>Ngày có đơn</div>
                    {availableDates.slice(0, 5).map((date) => (
                      <button
                        key={date}
                        className={`${styles.lichSuDateItem} ${filterDate === date ? styles.lichSuDateItemActive : ""}`}
                        onClick={() => {
                          setFilterDate(date);
                          setShowDateDropdown(false);
                        }}
                      >
                        {formatDisplayDate(date)}
                      </button>
                    ))}
                  </div>
                )}

                {/* Clear */}
                {filterDate && (
                  <button
                    className={styles.lichSuDateClear}
                    onClick={() => {
                      setFilterDate("");
                      setShowDateDropdown(false);
                    }}
                  >
                    <FiX size={12} /> Bỏ lọc ngày
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* Customer Filter */}
        <div className={styles.dropdownWrap}>
          <button
            className={`${styles.lichSuCustomerBtn} ${filterKhachHang ? styles.lichSuCustomerBtnActive : ""}`}
            onClick={() => setShowKhachHangDropdown((v) => !v)}
          >
            <span>{filterKhachHang || "Khách hàng"}</span>
            <FiChevronDown size={14} />
          </button>
          {showKhachHangDropdown && (
            <>
              <div
                className={styles.dropdownOverlay}
                onClick={() => { setShowKhachHangDropdown(false); setKhachHangSearch(""); }}
              />
              <div className={styles.dropdownMenu}>
                {/* Search input in dropdown */}
                <div className={styles.dropdownSearchWrap}>
                  <FiSearch size={13} className={styles.dropdownSearchIcon} />
                  <input
                    ref={khachHangSearchRef}
                    className={styles.dropdownSearchInput}
                    placeholder="Tìm khách hàng..."
                    value={khachHangSearch}
                    onChange={(e) => setKhachHangSearch(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  {khachHangSearch && (
                    <button
                      className={styles.dropdownSearchClear}
                      onClick={(e) => { e.stopPropagation(); setKhachHangSearch(""); }}
                    >
                      <FiX size={12} />
                    </button>
                  )}
                </div>
                <button
                  className={`${styles.dropdownItem} ${!filterKhachHang ? styles.dropdownItemActive : ""}`}
                  onClick={() => {
                    setFilterKhachHang("");
                    setShowKhachHangDropdown(false);
                    setKhachHangSearch("");
                  }}
                >
                  Tất cả khách hàng
                </button>
                {filteredKhachHangOptions.length === 0 ? (
                  <div className={styles.dropdownEmpty}>Không tìm thấy</div>
                ) : (
                  filteredKhachHangOptions.map((kh) => (
                    <button
                      key={kh}
                      className={`${styles.dropdownItem} ${filterKhachHang === kh ? styles.dropdownItemActive : ""}`}
                      onClick={() => {
                        setFilterKhachHang(kh);
                        setShowKhachHangDropdown(false);
                        setKhachHangSearch("");
                      }}
                    >
                      {kh}
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Active Filters Tags */}
      {(filterKhachHang || filterDate) && (
        <div className={styles.lichSuActiveFilters}>
          {filterKhachHang && (
            <span className={styles.lichSuFilterTag}>
              {filterKhachHang}
              <button onClick={() => setFilterKhachHang("")}>
                <FiX size={12} />
              </button>
            </span>
          )}
          {filterDate && (
            <span className={styles.lichSuFilterTag}>
              {formatDisplayDate(filterDate)}
              <button onClick={() => setFilterDate("")}>
                <FiX size={12} />
              </button>
            </span>
          )}
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
          {filteredList.map((dh) => {
            return (
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
