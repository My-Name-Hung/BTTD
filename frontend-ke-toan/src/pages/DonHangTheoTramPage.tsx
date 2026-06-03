import { useCallback, useEffect, useMemo, useState } from "react";
import { FiArrowLeft, FiSearch, FiX } from "react-icons/fi";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Loading } from "../components/Common";
import { usePagination, useToast } from "../hooks";
import { layDanhSachDonHang, layDanhSachTramTron, layTatCaLichSanXuat } from "../services/api";
import { DonHang, TramTron, TRANG_THAI_DON_COLORS, TRANG_THAI_DON_LABELS } from "../types";
import styles from "./DonHangTheoTramPage.module.css";

export default function DonHangTheoTramPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toasts, showToast } = useToast();
  const { page, resetPage, goToPage } = usePagination(1, 20);

  const [trams, setTrams] = useState<TramTron[]>([]);
  const [allOrders, setAllOrders] = useState<DonHang[]>([]);
  const [lichSans, setLichSans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters - auto-select tram from URL param
  const [tramFilter, setTramFilter] = useState<string>(() => {
    return id || searchParams.get("tram") || "";
  });
  const [maDonFilter, setMaDonFilter] = useState(searchParams.get("maDon") || "");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [tramData, lsData, dhData] = await Promise.all([
        layDanhSachTramTron(),
        layTatCaLichSanXuat(),
        layDanhSachDonHang(1, 100),
      ]);
      setTrams(tramData || []);
      setLichSans(Array.isArray(lsData) ? lsData : []);
      setAllOrders(Array.isArray(dhData) ? dhData : []);
    } catch {
      showToast("Lỗi tải dữ liệu", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Map tram -> don hang ids
  const tramToDonHangIds = useMemo(() => {
    const map: Record<number, Set<number>> = {};
    lichSans.forEach((ls) => {
      const idTram = ls.idTramTron;
      if (idTram) {
        if (!map[idTram]) map[idTram] = new Set();
        map[idTram].add(ls.idDonHang);
      }
    });
    return map;
  }, [lichSans]);

  const filteredOrders = useMemo(() => {
    let orders = allOrders;

    // Lọc theo trạm
    if (tramFilter) {
      const tramId = parseInt(tramFilter);
      const ids = tramToDonHangIds[tramId] || new Set();
      orders = orders.filter(o => ids.has(o.id));
    }

    // Lọc theo mã đơn
    if (maDonFilter) {
      orders = orders.filter(o =>
        (o.maDonHang || "").toLowerCase().includes(maDonFilter.toLowerCase())
      );
    }

    return orders;
  }, [allOrders, tramFilter, maDonFilter, tramToDonHangIds]);

  const LIMIT = 20;
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / LIMIT));
  const paginatedOrders = filteredOrders.slice((page - 1) * LIMIT, page * LIMIT);

  const hasFilters = !!tramFilter || !!maDonFilter;

  const clearFilters = () => {
    setTramFilter("");
    setMaDonFilter("");
    setSearchParams({});
    resetPage();
  };

  const formatCurrency = (v: number) => v?.toLocaleString("vi-VN") + " đ" || "0 đ";

  if (loading) return <Loading />;

  return (
    <div>
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderBack}>
          <button className={styles.backBtn} onClick={() => navigate(-1)}>
            <FiArrowLeft size={18} />
          </button>
          <div>
            <div className={styles.pageHeaderTitle}>Đơn hàng theo trạm trộn</div>
            <div className={styles.pageHeaderDesc}>
              {tramFilter ? `Đơn hàng của trạm ${trams.find(t => String(t.id) === tramFilter)?.tenTram}` : "Tất cả đơn hàng"}
            </div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className={styles.filterBar}>
        <div className={styles.filterSearchWrap}>
          <FiSearch className={styles.filterSearchIcon} />
          <input
            className={styles.filterSearchInput}
            placeholder="Tìm mã đơn hàng..."
            value={maDonFilter}
            onChange={(e) => { setMaDonFilter(e.target.value); resetPage(); }}
          />
        </div>
        <div className={styles.selectWrap}>
          <span className={styles.selectLabel}>Trạm trộn</span>
          <div className={styles.selectControl}>
            <select
              className={styles.selectInput}
              value={tramFilter}
              onChange={(e) => {
                setTramFilter(e.target.value);
                setSearchParams(e.target.value ? { tram: e.target.value } : {});
                resetPage();
              }}
            >
              <option value="">Tất cả trạm</option>
              {trams.map((t) => (
                <option key={t.id} value={String(t.id)}>
                  {t.tenTram}
                </option>
              ))}
            </select>
            <span className={styles.selectArrow}>▼</span>
          </div>
        </div>
        {hasFilters && (
          <button className={styles.filterClearBtn} onClick={clearFilters}>
            <FiX size={13} /> Xóa lọc
          </button>
        )}
      </div>

      {/* Stats */}
      <div className={styles.statsRow}>
        <div className={styles.statItem}>
          <span className={styles.statNum}>{filteredOrders.length}</span> đơn hàng
          {hasFilters && <> / {allOrders.length} tổng</>}
        </div>
      </div>

      {/* Table */}
      <div className={styles.card}>
        <div className={styles.tableWrap}>
          {paginatedOrders.length === 0 ? (
            <div className={styles.emptyState}>
              <span>📦</span>
              <p>Không có đơn hàng nào</p>
            </div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Mã đơn</th>
                  <th>Khách hàng</th>
                  <th className={styles.hideOnMobile}>Địa chỉ</th>
                  <th className={styles.hideOnMobile}>Mác bê tông</th>
                  <th>Khối lượng</th>
                  <th className={styles.hideOnMobile}>Thành tiền</th>
                  <th>Trạng thái</th>
                  <th className={styles.hideOnMobile}>Trạm trộn</th>
                </tr>
              </thead>
              <tbody>
                {paginatedOrders.map((o) => {
                  // Tìm trạm trộn của đơn hàng này
                  const tramId = lichSans.find(ls => ls.idDonHang === o.id)?.idTramTron;
                  const tramName = tramId ? (trams.find(t => t.id === tramId)?.tenTram || "—") : "—";
                  return (
                    <tr key={o.id}>
                      <td>
                        <span className={styles.tableCode}>{o.maDonHang}</span>
                      </td>
                      <td>
                        <div className={styles.tableName}>{o.tenKhachHang}</div>
                      </td>
                      <td className={styles.hideOnMobile}>
                        <div className={styles.tableAddress}>{o.diaChiNhan || "—"}</div>
                      </td>
                      <td className={styles.hideOnMobile}>
                        <div>{o.tenMacBeTong || "—"}</div>
                      </td>
                      <td>{o.khoiLuongDat ? `${o.khoiLuongDat} m³` : "—"}</td>
                      <td className={`${styles.tableRight} ${styles.hideOnMobile}`}>
                        {formatCurrency(o.thanhTien)}
                      </td>
                      <td>
                        <span
                          className={styles.statusBadge}
                          style={{
                            background: `${TRANG_THAI_DON_COLORS[o.trangThaiDon] || "#6b7280"}18`,
                            color: TRANG_THAI_DON_COLORS[o.trangThaiDon] || "#6b7280",
                          }}
                        >
                          {TRANG_THAI_DON_LABELS[o.trangThaiDon] || o.trangThaiDon}
                        </span>
                      </td>
                      <td className={styles.hideOnMobile}>{tramName}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {filteredOrders.length > LIMIT && (
          <div className={styles.paginationWrap}>
            <Pagination
              page={page}
              totalPages={totalPages}
              total={filteredOrders.length}
              limit={LIMIT}
              onPageChange={goToPage}
            />
          </div>
        )}
      </div>

      <div className={styles.toastContainer}>
        {toasts.map((t) => (
          <div key={t.id} className={`${styles.toast} ${t.type === "error" ? styles.toastError : styles.toastSuccess}`}>
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}

// Inline Pagination component
function Pagination({ page, totalPages, total, limit, onPageChange }: {
  page: number; totalPages: number; total: number; limit: number; onPageChange: (p: number) => void;
}) {
  const pages = [];
  for (let i = 1; i <= totalPages; i++) pages.push(i);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center", padding: 16 }}>
      <button
        onClick={() => onPageChange(Math.max(1, page - 1))}
        disabled={page === 1}
        style={{ padding: "6px 12px", border: "1px solid #e5e7eb", borderRadius: 6, background: "#fff", cursor: page === 1 ? "not-allowed" : "pointer", opacity: page === 1 ? 0.5 : 1 }}
      >
        ‹
      </button>
      {pages.map((p) => (
        <button
          key={p}
          onClick={() => onPageChange(p)}
          style={{
            padding: "6px 12px",
            border: "1px solid #e5e7eb",
            borderRadius: 6,
            background: p === page ? "#073ceb" : "#fff",
            color: p === page ? "#fff" : "#374151",
            cursor: "pointer",
          }}
        >
          {p}
        </button>
      ))}
      <button
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        disabled={page === totalPages}
        style={{ padding: "6px 12px", border: "1px solid #e5e7eb", borderRadius: 6, background: "#fff", cursor: page === totalPages ? "not-allowed" : "pointer", opacity: page === totalPages ? 0.5 : 1 }}
      >
        ›
      </button>
    </div>
  );
}
