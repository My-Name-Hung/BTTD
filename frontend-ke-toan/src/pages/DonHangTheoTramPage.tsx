import { useCallback, useEffect, useState } from "react";
import { FiArrowLeft, FiSearch, FiX } from "react-icons/fi";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Loading } from "../components/Common";
import { usePagination, useToast } from "../hooks";
import { layDonHangTheoTram, layDanhSachTramTron } from "../services/api";
import { DonHang, TRANG_THAI_DON_COLORS, TRANG_THAI_DON_LABELS } from "../types";
import styles from "./DonHangTheoTramPage.module.css";

function formatCurrency(v: number | null | undefined) {
  if (v == null) return "—";
  return v.toLocaleString("vi-VN") + " đ";
}

function getBadgeStyle(trangThai: string): React.CSSProperties {
  const color = TRANG_THAI_DON_COLORS[trangThai] || "#64748b";
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "3px 10px",
    borderRadius: "20px",
    fontSize: "12px",
    fontWeight: 600,
    whiteSpace: "nowrap",
    background: `rgba(${r}, ${g}, ${b}, 0.12)`,
    color: color,
  };
}

export default function DonHangTheoTramPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { toasts, showToast } = useToast();
  const { page, resetPage, goToPage } = usePagination(1, 20);

  const [trams, setTrams] = useState<{ id: number; tenTram: string }[]>([]);
  const [selectedTram, setSelectedTram] = useState<string>(() => id || searchParams.get("tram") || "");
  const [data, setData] = useState<{ data: DonHang[]; pagination: { total: number; totalPages: number } }>({ data: [], pagination: { total: 0, totalPages: 1 } });
  const [loading, setLoading] = useState(true);

  const [maDonFilter, setMaDonFilter] = useState("");
  const [trangThaiFilter, setTrangThaiFilter] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const tramId = selectedTram ? parseInt(selectedTram, 10) : undefined;
      const res = await layDonHangTheoTram(page, 20, trangThaiFilter || undefined, tramId);
      setData({ data: res.data || [], pagination: res.pagination });
    } catch {
      showToast("Lỗi tải dữ liệu", "error");
    } finally {
      setLoading(false);
    }
  }, [page, trangThaiFilter, selectedTram, showToast]);

  const loadTrams = useCallback(async () => {
    try {
      const res = await layDanhSachTramTron();
      setTrams(Array.isArray(res) ? res : []);
    } catch { /* silently */ }
  }, []);

  useEffect(() => {
    loadTrams();
  }, [loadTrams]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredOrders = data.data?.filter(o =>
    !maDonFilter || (o.maDonHang || "").toLowerCase().includes(maDonFilter.toLowerCase())
  ) || [];

  const totalPages = data.pagination.totalPages;
  const hasFilters = !!maDonFilter || !!trangThaiFilter || !!selectedTram;

  const clearFilters = () => {
    setMaDonFilter("");
    setTrangThaiFilter("");
    setSelectedTram("");
    resetPage();
  };

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
              {selectedTram
                ? `Trạm: ${trams.find(t => String(t.id) === selectedTram)?.tenTram || "—"}${id ? " (Admin đang xem)" : ""}`
                : "Tất cả trạm trộn"}
            </div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className={styles.filterBar}>
        <div className={styles.selectWrap} style={{ minWidth: 200 }}>
          <select
            className={styles.selectInput}
            value={selectedTram}
            onChange={(e) => {
              setSelectedTram(e.target.value);
              resetPage();
            }}
          >
            <option value="">Tất cả trạm trộn</option>
            {trams.map((t) => (
              <option key={t.id} value={String(t.id)}>{t.tenTram}</option>
            ))}
          </select>
        </div>
        <div className={styles.filterSearchWrap}>
          <FiSearch className={styles.filterSearchIcon} />
          <input
            className={styles.filterSearchInput}
            placeholder="Tìm mã đơn hàng..."
            value={maDonFilter}
            onChange={(e) => { setMaDonFilter(e.target.value); }}
          />
          {maDonFilter && (
            <button className={styles.filterSearchClear} onClick={() => setMaDonFilter("")}>
              <FiX size={13} />
            </button>
          )}
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
                      <span style={getBadgeStyle(o.trangThaiDon)}>
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
