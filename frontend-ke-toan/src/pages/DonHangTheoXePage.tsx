import { useCallback, useEffect, useState } from "react";
import { FiArrowLeft, FiSearch, FiX } from "react-icons/fi";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Loading } from "../components/Common";
import { usePagination, useToast } from "../hooks";
import { layDonHangTheoXe, layDanhSachXe } from "../services/api";
import { DonHang, Xe, TRANG_THAI_DON_COLORS, TRANG_THAI_DON_LABELS } from "../types";
import styles from "./DonHangTheoXePage.module.css";

function formatCurrency(v: number) {
  return v?.toLocaleString("vi-VN") + " đ" || "0 đ";
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

export default function DonHangTheoXePage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toasts, showToast } = useToast();
  const { page, resetPage, goToPage } = usePagination(1, 20);

  const [xes, setXes] = useState<Xe[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [xeFilter, setXeFilter] = useState<string>(() => id || searchParams.get("xe") || "");
  const [taiXeFilter, setTaiXeFilter] = useState(searchParams.get("taiXe") || "");
  const [maDonFilter, setMaDonFilter] = useState(searchParams.get("maDon") || "");

  const loadXes = useCallback(async () => {
    try {
      const data = await layDanhSachXe();
      setXes(Array.isArray(data) ? data : []);
    } catch { /* silently */ }
  }, []);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      if (!xeFilter) {
        setOrders([]);
        return;
      }
      const data = await layDonHangTheoXe(parseInt(xeFilter, 10));
      setOrders(Array.isArray(data) ? data : []);
    } catch {
      showToast("Lỗi tải dữ liệu", "error");
    } finally {
      setLoading(false);
    }
  }, [xeFilter, showToast]);

  useEffect(() => {
    loadXes();
  }, [loadXes]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const filteredOrders = orders.filter((o) => {
    const matchMa = !maDonFilter || (o.maDonHang || "").toLowerCase().includes(maDonFilter.toLowerCase());
    const matchTx = !taiXeFilter || (o.tenTaiXe || "").toLowerCase().includes(taiXeFilter.toLowerCase());
    return matchMa && matchTx;
  });

  const LIMIT = 20;
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / LIMIT));
  const paginatedOrders = filteredOrders.slice((page - 1) * LIMIT, page * LIMIT);

  const hasFilters = !!xeFilter || !!taiXeFilter || !!maDonFilter;

  const clearFilters = () => {
    setXeFilter("");
    setTaiXeFilter("");
    setMaDonFilter("");
    setSearchParams({});
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
            <div className={styles.pageHeaderTitle}>Đơn hàng theo xe</div>
            <div className={styles.pageHeaderDesc}>
              {xeFilter
                ? `Đơn hàng của xe ${xes.find((x) => String(x.id) === xeFilter)?.bienSo || ""}`
                : "Chọn xe để xem đơn hàng"}
            </div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className={styles.filterBar}>
        <div className={styles.selectWrap}>
          <select
            className={styles.selectInput}
            value={xeFilter}
            onChange={(e) => {
              setXeFilter(e.target.value);
              setSearchParams(e.target.value ? { xe: e.target.value } : {});
              resetPage();
            }}
          >
            <option value="">— Chọn xe —</option>
            {xes.map((x) => (
              <option key={x.id} value={String(x.id)}>
                {x.bienSo} {x.tenTaiXe ? `- ${x.tenTaiXe}` : ""}
              </option>
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
        <div className={styles.filterSearchWrap}>
          <FiSearch className={styles.filterSearchIcon} />
          <input
            className={styles.filterSearchInput}
            placeholder="Tìm tên tài xế..."
            value={taiXeFilter}
            onChange={(e) => { setTaiXeFilter(e.target.value); }}
          />
          {taiXeFilter && (
            <button className={styles.filterSearchClear} onClick={() => setTaiXeFilter("")}>
              <FiX size={13} />
            </button>
          )}
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
          {hasFilters && <> / {orders.length} tổng</>}
        </div>
      </div>

      {/* Table */}
      <div className={styles.card}>
        <div className={styles.tableWrap}>
          {!xeFilter ? (
            <div className={styles.emptyState}>
              <span>🚛</span>
              <p>Vui lòng chọn xe để xem đơn hàng</p>
            </div>
          ) : paginatedOrders.length === 0 ? (
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
                  <th className={styles.hideOnMobile}>Tài xế</th>
                </tr>
              </thead>
              <tbody>
                {paginatedOrders.map((o) => (
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
                    <td className={styles.hideOnMobile}>{o.tenTaiXe || "—"}</td>
                  </tr>
                ))}
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
