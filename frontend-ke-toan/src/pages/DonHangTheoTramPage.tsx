import { useCallback, useEffect, useState } from "react";
import { FiArrowLeft, FiSearch, FiX } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { Loading } from "../components/Common";
import { usePagination, useToast } from "../hooks";
import { layDonHangTheoTram } from "../services/api";
import { DonHang, TRANG_THAI_DON_COLORS, TRANG_THAI_DON_LABELS } from "../types";
import styles from "./DonHangTheoTramPage.module.css";

export default function DonHangTheoTramPage() {
  const navigate = useNavigate();
  const { toasts, showToast } = useToast();
  const { page, resetPage, goToPage } = usePagination(1, 20);

  const [data, setData] = useState<{ data: DonHang[]; pagination: { total: number; totalPages: number } }>({ data: [], pagination: { total: 0, totalPages: 1 } });
  const [loading, setLoading] = useState(true);

  // Filters - the backend already filters by user's tram
  const [maDonFilter, setMaDonFilter] = useState("");
  const [trangThaiFilter, setTrangThaiFilter] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await layDonHangTheoTram(page, 20, trangThaiFilter || undefined);
      setData(res);
    } catch {
      showToast("Lỗi tải dữ liệu", "error");
    } finally {
      setLoading(false);
    }
  }, [page, trangThaiFilter, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Client-side filter by mã đơn
  const filteredOrders = data.data?.filter(o =>
    !maDonFilter || (o.maDonHang || "").toLowerCase().includes(maDonFilter.toLowerCase())
  ) || [];

  const totalPages = data.pagination.totalPages;
  const hasFilters = !!maDonFilter || !!trangThaiFilter;

  const clearFilters = () => {
    setMaDonFilter("");
    setTrangThaiFilter("");
    resetPage();
  };

  const formatCurrency = (v: number) => v?.toLocaleString("vi-VN") + " đ" || "0 đ";

  const statusColor = (s: string) => TRANG_THAI_DON_COLORS[s] || "#64748b";

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
            <div className={styles.pageHeaderDesc}>Danh sách đơn hàng thuộc trạm của bạn</div>
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
            onChange={(e) => { setMaDonFilter(e.target.value); }}
          />
        </div>
        <div className={styles.selectWrap}>
          <select
            className={styles.selectInput}
            value={trangThaiFilter}
            onChange={(e) => { setTrangThaiFilter(e.target.value); resetPage(); }}
          >
            <option value="">Tất cả trạng thái</option>
            {Object.entries(TRANG_THAI_DON_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
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
          <span className={styles.statNum}>{data.pagination.total}</span> đơn hàng
        </div>
      </div>

      {/* Table */}
      <div className={styles.card}>
        <div className={styles.tableWrap}>
          {filteredOrders.length === 0 ? (
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
                {filteredOrders.map((o) => (
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
                          background: `${statusColor(o.trangThaiDon)}18`,
                          color: statusColor(o.trangThaiDon),
                        }}
                      >
                        {TRANG_THAI_DON_LABELS[o.trangThaiDon] || o.trangThaiDon}
                      </span>
                    </td>
                    <td className={styles.hideOnMobile}>{(o as any).tenTramTron || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {totalPages > 1 && (
          <div className={styles.paginationWrap}>
            <Pagination
              page={page}
              totalPages={totalPages}
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
function Pagination({ page, totalPages, onPageChange }: {
  page: number; totalPages: number; onPageChange: (p: number) => void;
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
