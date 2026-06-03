import { useCallback, useEffect, useState } from "react";
import {
  FiFileText, FiSearch, FiX, FiPrinter, FiEye, FiDollarSign,
} from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { EmptyState, Loading, Pagination, Modal } from "../components/Common";
import { usePageRole, usePagination, useToast } from "../hooks";
import {
  layDanhSachDonHang,
  layLichSuThanhToan,
  layHoaDonTheoDonHang,
} from "../services/api";
import { DonHang, ThanhToan, HoaDon } from "../types";
import styles from "./ThanhToanPage.module.css";

function formatCurrency(v: number) {
  return v?.toLocaleString("vi-VN") + " đ" || "0 đ";
}

type TabFilter = "chua_tat_toan" | "da_tat_toan";

interface HoaDonItem {
  id: number;
  maHoaDon: string;
  ngayLap: string | null;
  khachHang: string;
  tienBeTong: number;
  buuVanChuyen: number;
  phiPhatSinh: number;
  giamTru: number;
  tongCong: number;
  loaiThanhToan: string;
}

export default function ThanhToanPage() {
  const { hasPermission } = usePageRole();
  const { toasts, showToast } = useToast();
  const { page, resetPage, goToPage } = usePagination(1, 20);
  const navigate = useNavigate();
  const [donHangs, setDonHangs] = useState<DonHang[]>([]);
  const [thanhToans, setThanhToans] = useState<Record<number, ThanhToan[]>>({});
  const [hoaDons, setHoaDons] = useState<Record<number, HoaDonItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [tuKhoa, setTuKhoa] = useState("");
  const [activeTab, setActiveTab] = useState<TabFilter>("chua_tat_toan");
  const [modalHoaDon, setModalHoaDon] = useState<{ donHang: DonHang; hoaDons: HoaDonItem[] } | null>(null);

  const canCreate = hasPermission("thanhtoan.create");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const dhRes = await layDanhSachDonHang(page, 50, undefined, tuKhoa || undefined);
      setDonHangs(dhRes.data || []);

      const dhs = dhRes.data || [];

      const [histories, hoaDonLists] = await Promise.all([
        Promise.all(dhs.map((dh: DonHang) => layLichSuThanhToan(dh.id))),
        Promise.all(dhs.map((dh: DonHang) => layHoaDonTheoDonHang(dh.id))),
      ]);

      const mapTT: Record<number, ThanhToan[]> = {};
      const mapHD: Record<number, HoaDonItem[]> = {};
      dhs.forEach((dh: DonHang, i: number) => {
        mapTT[dh.id] = histories[i] || [];
        mapHD[dh.id] = (hoaDonLists[i] || []).map((h: any) => ({
          id: h.id,
          maHoaDon: h.maHoaDon,
          ngayLap: h.ngayLap,
          khachHang: h.khachHang,
          tienBeTong: h.tienBeTong,
          buuVanChuyen: h.buuVanChuyen,
          phiPhatSinh: h.phiPhatSinh,
          giamTru: h.giamTru,
          tongCong: h.tongCong,
          loaiThanhToan: h.loaiThanhToan,
        }));
      });
      setThanhToans(mapTT);
      setHoaDons(mapHD);
    } catch {
      showToast("Lỗi tải dữ liệu", "error");
    } finally {
      setLoading(false);
    }
  }, [page, tuKhoa, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Lọc theo tab — chỉ dựa vào tiền, không dựa vào trạng thái đơn hàng
  const chuaTatToan = donHangs.filter((dh) => {
    const conLai = Math.max(0, (dh.thanhTien || 0) - (dh.daThanhToan || 0));
    return conLai > 0;
  });

  const daTatToan = donHangs.filter((dh) => {
    const conLai = Math.max(0, (dh.thanhTien || 0) - (dh.daThanhToan || 0));
    return conLai <= 0;
  });

  const displayList = activeTab === "chua_tat_toan" ? chuaTatToan : daTatToan;
  const LIMIT = 20;
  const totalPages = Math.max(1, Math.ceil(displayList.length / LIMIT));
  const paginatedList = displayList.slice((page - 1) * LIMIT, page * LIMIT);

  const tongCongNo = chuaTatToan.reduce(
    (sum, dh) => sum + Math.max(0, (dh.thanhTien || 0) - (dh.daThanhToan || 0)),
    0,
  );
  const tongDaTT = donHangs.reduce((sum, dh) => sum + (dh.daThanhToan || 0), 0);

  const handleOpenModal = (dh: DonHang) => {
    const hds = hoaDons[dh.id] || [];
    setModalHoaDon({ donHang: dh, hoaDons: hds });
  };

  const handlePrintHD = (hoaDonId: number) => {
    window.open(`/in-hoa-don/${hoaDonId}`, "_blank");
  };

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <div className={styles.pageHeaderTitle}>Thanh toán</div>
          <div className={styles.pageHeaderDesc}>
            Ghi nhận thanh toán và theo dõi công nợ
          </div>
        </div>
      </div>

      <div className={styles.kpiGrid} style={{ marginBottom: 20 }}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Tổng công nợ</div>
          <div className={styles.kpiValue} style={{ color: "var(--color-warning)" }}>
            {formatCurrency(tongCongNo)}
          </div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Đã thanh toán</div>
          <div className={styles.kpiValue} style={{ color: "var(--color-success)" }}>
            {formatCurrency(tongDaTT)}
          </div>
        </div>
      </div>

      {/* Tab filter */}
      <div className={styles.tabBar}>
        <button
          className={`${styles.tabBtn} ${activeTab === "chua_tat_toan" ? styles.tabBtnActive : ""}`}
          onClick={() => { setActiveTab("chua_tat_toan"); resetPage(); }}
        >
          Chưa tất toán ({chuaTatToan.length})
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === "da_tat_toan" ? styles.tabBtnActive : ""}`}
          onClick={() => { setActiveTab("da_tat_toan"); resetPage(); }}
        >
          Đã tất toán ({daTatToan.length})
        </button>
      </div>

      <div className={styles.filterBar}>
        <div className={styles.filterBarLeft}>
          <div className={styles.filterSearch}>
            <FiSearch className={styles.filterSearchIcon} />
            <input
              className={styles.filterSearchInput}
              placeholder="Tìm đơn hàng..."
              value={tuKhoa}
              onChange={(e) => { setTuKhoa(e.target.value); resetPage(); }}
            />
          </div>
          {tuKhoa && (
            <button className={styles.filterClearBtn} onClick={() => { setTuKhoa(""); resetPage(); }}>
              <FiX size={13} /> Xóa lọc
            </button>
          )}
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.tableWrap}>
          {loading ? (
            <Loading />
          ) : paginatedList.length === 0 ? (
            <EmptyState icon="💰" text="Không có dữ liệu" />
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th style={{ minWidth: 90 }}>Mã đơn</th>
                  <th style={{ minWidth: 110 }}>Khách hàng</th>
                  <th className={styles.hideOnMobile} style={{ minWidth: 100, textAlign: "right" }}>
                    Tổng tiền
                  </th>
                  <th className={styles.hideOnMobile} style={{ minWidth: 90, textAlign: "right" }}>
                    Đã Thanh Toán
                  </th>
                  <th style={{ minWidth: 80 }}>Còn lại</th>
                  <th style={{ minWidth: 160 }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {paginatedList.map((dh) => {
                  const daThanhToan = dh.daThanhToan || 0;
                  const conLai = Math.max(0, (dh.thanhTien || 0) - daThanhToan);
                  const hds = hoaDons[dh.id] || [];
                  const daTatToanOrder = conLai <= 0;

                  return (
                    <tr key={dh.id}>
                      <td>
                        <span className={styles.tableCode}>{dh.maDonHang}</span>
                      </td>
                      <td>
                        <div className={styles.tableName}>{dh.tenKhachHang}</div>
                      </td>
                      <td className={`${styles.tableRight} ${styles.hideOnMobile}`}>
                        <strong>{formatCurrency(dh.thanhTien || 0)}</strong>
                      </td>
                      <td className={`${styles.tableRight} ${styles.hideOnMobile}`} style={{ color: "var(--color-success)" }}>
                        {formatCurrency(daThanhToan)}
                      </td>
                      <td>
                        <span style={{ color: conLai > 0 ? "var(--color-warning)" : "var(--color-success)", fontWeight: 700 }}>
                          {formatCurrency(conLai)}
                        </span>
                      </td>
                      <td>
                        <div className={styles.actionBtns}>
                          {/* Đã tất toán: chỉ hiện icon mắt xem HĐ */}
                          {daTatToanOrder && hds.length > 0 && canCreate && (
                            <button
                              className={styles.btnViewIcon}
                              onClick={() => handleOpenModal(dh)}
                              title="Xem hóa đơn"
                            >
                              <FiEye size={16} />
                            </button>
                          )}

                          {/* Chưa tất toán: hiện nút thanh toán + xuất HĐ (nếu đã thanh toán > 0) */}
                          {!daTatToanOrder && canCreate && (
                            <>
                              <button
                                className={styles.btnPay}
                                onClick={() => navigate(`/thanh-toan/xuat/${dh.id}`)}
                                title="Thanh toán"
                              >
                                <FiDollarSign size={13} />{" "}
                                {daThanhToan > 0 && conLai > 0 ? formatCurrency(conLai) : "Thanh toán"}
                              </button>
                              {daThanhToan > 0 && (
                                <button
                                  className={styles.btnHoaDon}
                                  onClick={() => navigate(`/thanh-toan/xuat/${dh.id}`)}
                                  title="Xuất hóa đơn"
                                >
                                  <FiFileText size={13} /> Xuất HĐ
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {!loading && displayList.length > LIMIT && (
          <Pagination
            page={page}
            totalPages={totalPages}
            total={displayList.length}
            limit={LIMIT}
            onPageChange={goToPage}
          />
        )}
      </div>

      {/* Modal xem hóa đơn */}
      {modalHoaDon && (
        <ModalHoaDon
          donHang={modalHoaDon.donHang}
          hoaDons={modalHoaDon.hoaDons}
          onClose={() => setModalHoaDon(null)}
          onPrint={handlePrintHD}
        />
      )}

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

// ─── Modal xem hóa đơn ───────────────────────────────────────────────────────
function ModalHoaDon({
  donHang,
  hoaDons,
  onClose,
  onPrint,
}: {
  donHang: DonHang;
  hoaDons: HoaDonItem[];
  onClose: () => void;
  onPrint: (id: number) => void;
}) {
  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>
            <FiFileText size={18} />
            Hóa đơn - {donHang.maDonHang}
          </h3>
          <button className={styles.modalClose} onClick={onClose}>×</button>
        </div>
        <div className={styles.modalBody}>
          {hoaDons.length === 0 ? (
            <div className={styles.emptyHoaDon}>Chưa có hóa đơn nào</div>
          ) : (
            hoaDons.map((hd, idx) => (
              <div key={hd.id} className={styles.hoaDonItem}>
                <div className={styles.hoaDonItemHeader}>
                  <div>
                    <strong>Hóa đơn #{idx + 1}</strong>
                    <span className={styles.hoaDonSo}>Số: {hd.maHoaDon}</span>
                    {hd.ngayLap && (
                      <span className={styles.hoaDonNgay}>
                        Ngày: {new Date(hd.ngayLap).toLocaleDateString("vi-VN")}
                      </span>
                    )}
                    <span className={`${styles.hoaDonBadge} ${hd.loaiThanhToan === "tra_het" ? styles.badgeTraHet : styles.badgeCongNo}`}>
                      {hd.loaiThanhToan === "tra_het" ? "Trả hết" : "Công nợ"}
                    </span>
                  </div>
                  <button className={styles.btnPrint} onClick={() => onPrint(hd.id)}>
                    <FiPrinter size={14} /> In
                  </button>
                </div>
                <div className={styles.hoaDonDetails}>
                  <div className={styles.hdRow}><span>Tiền bê tông:</span><span>{formatCurrency(hd.tienBeTong)}</span></div>
                  {hd.buuVanChuyen > 0 && <div className={styles.hdRow}><span>Bù vận chuyển:</span><span>{formatCurrency(hd.buuVanChuyen)}</span></div>}
                  {hd.phiPhatSinh > 0 && <div className={styles.hdRow}><span>Chi phí phát sinh:</span><span>{formatCurrency(hd.phiPhatSinh)}</span></div>}
                  {hd.giamTru > 0 && <div className={styles.hdRow}><span>Giảm trừ:</span><span style={{ color: "var(--color-success)" }}>- {formatCurrency(hd.giamTru)}</span></div>}
                  <div className={`${styles.hdRow} ${styles.hdTotal}`}><span>Tổng cộng:</span><span>{formatCurrency(hd.tongCong)}</span></div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// Label map
const TRANG_THAI_DON_LABELS: Record<string, string> = {
  cho_duyet: "Chờ duyệt",
  da_duyet: "Đã duyệt",
  dang_san_xuat: "Đang sản xuất",
  dang_giao: "Đang giao",
  da_giao: "Đã giao",
  nghiem_thu: "Nghiệm thu",
  da_thanh_toan: "Thanh toán",
  da_hoan_thanh: "Hoàn thành",
  tu_choi: "Từ chối",
};
