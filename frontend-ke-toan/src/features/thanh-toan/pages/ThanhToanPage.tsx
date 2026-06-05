import { useCallback, useEffect, useState } from "react";
import {
  FiDollarSign,
  FiDownload,
  FiExternalLink,
  FiPrinter,
  FiSearch,
  FiX,
} from "react-icons/fi";
import { exportToExcel, formatDateForExport } from "../../../shared/utils/exportData";
import { useNavigate } from "react-router-dom";
import { EmptyState, Loading, Pagination } from "../../../shared/components/Common";
import { usePageRole, usePagination, useToast } from "../../../shared/hooks";
import {
  exportThanhToan,
  ExportThanhToan,
  layDanhSachDonHang,
  layThanhToanBatch,
  layHoaDonBatch,
} from "../../../shared/services/api";
import { DonHang, ThanhToan } from "../../../shared/types";
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
  const [exporting, setExporting] = useState(false);

  const canCreate = hasPermission("thanhtoan.create");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const dhRes = await layDanhSachDonHang(
        page,
        50,
        undefined,
        tuKhoa || undefined,
      );
      setDonHangs(dhRes.data || []);

      const dhs = dhRes.data || [];

      // OPTIMIZED: Batch API calls thay vì N+1 queries
      if (dhs.length > 0) {
        const donHangIds = dhs.map((dh: DonHang) => dh.id);
        const [batchTT, batchHD] = await Promise.all([
          layThanhToanBatch(donHangIds),
          layHoaDonBatch(donHangIds),
        ]);

        const mapTT: Record<number, ThanhToan[]> = {};
        const mapHD: Record<number, HoaDonItem[]> = {};
        dhs.forEach((dh: DonHang) => {
          mapTT[dh.id] = batchTT[dh.id] || [];
          mapHD[dh.id] = (batchHD[dh.id] ? [batchHD[dh.id]] : []).map((h: any) => ({
            id: h.id,
            maHoaDon: h.soHoaDon,
            ngayLap: h.ngayTao,
            khachHang: dh.tenKhachHang,
            tienBeTong: h.tongTien,
            buuVanChuyen: 0,
            phiPhatSinh: 0,
            giamTru: h.giamTru || 0,
            tongCong: (h.tongCong || 0) - (h.giamTru || 0),
            loaiThanhToan: 'tra_het',
          }));
        });
        setThanhToans(mapTT);
        setHoaDons(mapHD);
      } else {
        setThanhToans({});
        setHoaDons({});
      }
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

  const handlePrintHD = (hoaDonId: number) => {
    navigate(`/in-hoa-don/${hoaDonId}`);
  };

  const handleDownloadHD = (hoaDonId: number) => {
    navigate(`/in-hoa-don/${hoaDonId}`);
  };

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const allData = await exportThanhToan();

      const rows = allData.map((dh: ExportThanhToan) => ({
        maDonHang: dh.maDonHang,
        tenKhachHang: dh.tenKhachHang,
        tenMacBeTong: dh.tenMacBeTong || "",
        khoiLuongDat: dh.khoiLuongDat,
        thanhTien: dh.thanhTien || 0,
        daThanhToan: dh.daThanhToan,
        conLai: dh.conLai || 0,
        ngayTaoDon: formatDateForExport(dh.ngayTaoDon),
      }));

      const headers: { key: string; label: string; width?: number; alignRight?: boolean }[] = [
        { key: "maDonHang", label: "Mã đơn", width: 16 },
        { key: "tenKhachHang", label: "Khách hàng", width: 28 },
        { key: "tenMacBeTong", label: "Mác BT", width: 18 },
        { key: "khoiLuongDat", label: "Khối lượng", width: 14, alignRight: true },
        { key: "thanhTien", label: "Thành tiền", width: 16, alignRight: true },
        { key: "daThanhToan", label: "Đã TT", width: 14, alignRight: true },
        { key: "conLai", label: "Còn lại", width: 14, alignRight: true },
        { key: "ngayTaoDon", label: "Ngày tạo", width: 14 },
      ];

      await exportToExcel("BÁO CÁO THANH TOÁN", headers, rows, `BaoCaoThanhToan_${new Date().toISOString().slice(0, 10)}.xlsx`, "Thanh toán");
      showToast("Xuất báo cáo thành công!");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Lỗi xuất báo cáo", "error");
    } finally {
      setExporting(false);
    }
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
        <div className={styles.pageHeaderActions}>
          <button
            className={`btn btn-export ${styles.btnExport}`}
            onClick={handleExportExcel}
            disabled={exporting}
          >
            <FiDownload size={15} />
            {exporting ? "Đang xuất..." : "Xuất báo cáo"}
          </button>
        </div>
      </div>

      <div className={styles.kpiGrid} style={{ marginBottom: 20 }}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Tổng công nợ</div>
          <div
            className={styles.kpiValue}
            style={{ color: "var(--color-warning)" }}
          >
            {formatCurrency(tongCongNo)}
          </div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Đã thanh toán</div>
          <div
            className={styles.kpiValue}
            style={{ color: "var(--color-success)" }}
          >
            {formatCurrency(tongDaTT)}
          </div>
        </div>
      </div>

      {/* Tab filter */}
      <div className={styles.tabBar}>
        <button
          className={`${styles.tabBtn} ${activeTab === "chua_tat_toan" ? styles.tabBtnActive : ""}`}
          onClick={() => {
            setActiveTab("chua_tat_toan");
            resetPage();
          }}
        >
          Chưa tất toán ({chuaTatToan.length})
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === "da_tat_toan" ? styles.tabBtnActive : ""}`}
          onClick={() => {
            setActiveTab("da_tat_toan");
            resetPage();
          }}
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
              onChange={(e) => {
                setTuKhoa(e.target.value);
                resetPage();
              }}
            />
          </div>
          {tuKhoa && (
            <button
              className={styles.filterClearBtn}
              onClick={() => {
                setTuKhoa("");
                resetPage();
              }}
            >
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
                  <th
                    className={styles.hideOnMobile}
                    style={{ minWidth: 100, textAlign: "right" }}
                  >
                    Tổng tiền
                  </th>
                  <th
                    className={styles.hideOnMobile}
                    style={{ minWidth: 90, textAlign: "right" }}
                  >
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
                        <div className={styles.tableName}>
                          {dh.tenKhachHang}
                        </div>
                      </td>
                      <td
                        className={`${styles.tableRight} ${styles.hideOnMobile}`}
                      >
                        <strong>{formatCurrency(dh.thanhTien || 0)}</strong>
                      </td>
                      <td
                        className={`${styles.tableRight} ${styles.hideOnMobile}`}
                        style={{ color: "var(--color-success)" }}
                      >
                        {formatCurrency(daThanhToan)}
                      </td>
                      <td>
                        <span
                          style={{
                            color:
                              conLai > 0
                                ? "var(--color-warning)"
                                : "var(--color-success)",
                            fontWeight: 700,
                          }}
                        >
                          {formatCurrency(conLai)}
                        </span>
                      </td>
                      <td>
                        <div className={styles.actionBtns}>
                          {/* Chưa tất toán: nút thanh toán luôn hiện */}
                          {!daTatToanOrder && canCreate && (
                            <button
                              className={styles.btnPay}
                              onClick={() =>
                                navigate(`/thanh-toan/xuat/${dh.id}`)
                              }
                              title="Thanh toán"
                            >
                              <FiDollarSign size={13} />{" "}
                              {conLai > 0 ? formatCurrency(conLai) : "Thanh toán"}
                            </button>
                          )}

                          {/* Nếu đã có hóa đơn (công nợ đã xuất HĐ trước đó): hiện nút xem HĐ */}
                          {!daTatToanOrder && hds.length > 0 && (
                            <button
                              className={styles.btnHoaDon}
                              onClick={() => handlePrintHD(hds[0].id)}
                              title="Xem hóa đơn đã xuất"
                            >
                              <FiPrinter size={13} /> Xem HĐ
                            </button>
                          )}

                          {/* Đã tất toán: nút xem hóa đơn */}
                          {daTatToanOrder && hds.length > 0 && (
                            <button
                              className={styles.btnHoaDon}
                              onClick={() => handlePrintHD(hds[0].id)}
                              title="Xem hóa đơn"
                            >
                              <FiPrinter size={13} /> Xem HĐ
                            </button>
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
