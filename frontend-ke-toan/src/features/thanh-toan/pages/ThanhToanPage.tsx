import { useCallback, useEffect, useState } from "react";
import {
  FiAlertTriangle,
  FiClock,
  FiDollarSign,
  FiDownload,
  FiPrinter,
  FiSearch,
  FiX,
} from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import {
  EmptyState,
  Loading,
  Pagination,
} from "../../../shared/components/Common";
import { usePageRole, usePagination, useToast } from "../../../shared/hooks";
import {
  BatchNghiemThuResponse,
  BatchThanhToanResponse,
  exportThanhToan,
  ExportThanhToan,
  layDanhSachDonHang,
  layHoaDonBatch,
  layNghiemThuBatch,
  layThanhToanBatch,
} from "../../../shared/services/api";
import { DonHang } from "../../../shared/types";
import {
  exportToExcel,
  formatDateForExport,
} from "../../../shared/utils/exportData";
import styles from "./ThanhToanPage.module.css";

function formatCurrency(v: number) {
  return v?.toLocaleString("vi-VN") + " đ" || "0 đ";
}

type TabFilter = "chua_tat_toan" | "cong_no" | "da_tat_toan";

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
  soTienDu?: number;
  soTienThanhToan?: number;
  hanTraCongNo?: string | null;
}

export default function ThanhToanPage() {
  const { hasPermission } = usePageRole();
  const { toasts, showToast } = useToast();
  const { page, resetPage, goToPage } = usePagination(1, 20);
  const navigate = useNavigate();
  const [donHangs, setDonHangs] = useState<DonHang[]>([]);
  const [thanhToans, setThanhToans] = useState<BatchThanhToanResponse>({});
  const [hoaDons, setHoaDons] = useState<Record<number, HoaDonItem[]>>({});
  const [nghiemThus, setNghiemThus] = useState<BatchNghiemThuResponse>({});
  const [loading, setLoading] = useState(true);
  const [tuKhoa, setTuKhoa] = useState("");
  const [activeTab, setActiveTab] = useState<TabFilter>("chua_tat_toan");
  const [exporting, setExporting] = useState(false);
  // Lưu đơn hàng đang mở modal xem danh sách hóa đơn (khi 1 đơn có nhiều HĐ)
  const [modalDanhSachHoaDon, setModalDanhSachHoaDon] = useState<DonHang | null>(
    null,
  );

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

      if (dhs.length > 0) {
        const donHangIds = dhs.map((dh: DonHang) => dh.id);
        const [batchTT, batchHD, batchNT] = await Promise.all([
          layThanhToanBatch(donHangIds),
          layHoaDonBatch(donHangIds),
          layNghiemThuBatch(donHangIds),
        ]);

        const mapTT: BatchThanhToanResponse = {};
        const mapHD: Record<number, HoaDonItem[]> = {};
        dhs.forEach((dh: DonHang) => {
          mapTT[dh.id] = batchTT[dh.id] || [];
          const hoaDonList = batchHD[dh.id] || [];
          mapHD[dh.id] = hoaDonList.map((h: any) => ({
            id: h.id,
            maHoaDon: h.soHoaDon,
            ngayLap: h.ngayTao,
            khachHang: dh.tenKhachHang,
            // tongCong đã được XuatHoaDonPage tính sẵn và lưu xuống DB
            // = tienBeTong + buuVanChuyen + phiPhatSinh - giamTru
            // Tuyệt đối KHÔNG tính ngược từ tongCong (sẽ trừ giamTru 2 lần)
            tienBeTong: h.tienBeTong || 0,
            buuVanChuyen: h.buuVanChuyen || 0,
            phiPhatSinh: h.phiPhatSinh || 0,
            giamTru: h.giamTru || 0,
            tongCong: h.tongCong || 0,
            loaiThanhToan: h.loaiThanhToan || "tra_het",
            soTienDu: h.soTienDu || 0,
            soTienThanhToan: h.soTienThanhToan || 0,
            hanTraCongNo: h.hanTraCongNo || null,
          }));
        });
        setThanhToans(mapTT);
        setHoaDons(mapHD);
        setNghiemThus(batchNT);
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

  // Đóng modal danh sách hóa đơn bằng phím ESC
  useEffect(() => {
    if (!modalDanhSachHoaDon) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModalDanhSachHoaDon(null);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [modalDanhSachHoaDon]);

  // Kiểm tra đơn có được phép thanh toán (đã nghiệm thu với kết quả 'dat')
  const isChoPhepThanhToan = (dh: DonHang) => {
    if (dh.trangThaiDon === "tu_choi") return false;
    const nt = nghiemThus[dh.id];
    if (!nt || nt.ketQua !== "dat") return false;
    return true;
  };

  // Kiểm tra đơn có phải công nợ không (đã xuất hóa đơn công nợ nhưng chưa tất toán hết)
  const isCongNo = (dh: DonHang) => {
    const hds = hoaDons[dh.id] || [];
    const hasCongNoHoaDon = hds.some(
      (h) => h.loaiThanhToan === "cong_no" || h.loaiThanhToan === "cong_no_du",
    );
    return hasCongNoHoaDon && Math.max(0, dh.conLai || 0) > 0;
  };

  // Kiểm tra công nợ có quá hạn không
  const isQuaHan = (dh: DonHang) => {
    const hds = hoaDons[dh.id] || [];
    const congNoHoaDon = hds.find(
      (h) => h.loaiThanhToan === "cong_no" || h.loaiThanhToan === "cong_no_du",
    );
    if (!congNoHoaDon?.hanTraCongNo) return false;
    const han = new Date(congNoHoaDon.hanTraCongNo);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return han < now && Math.max(0, dh.conLai || 0) > 0;
  };

  // Lọc đơn chưa tất toán (chưa xuất hóa đơn công nợ, còn nợ tiền)
  const chuaTatToan = donHangs.filter((dh) => {
    if (dh.trangThaiDon === "tu_choi") return false;
    const nt = nghiemThus[dh.id];
    if (!nt || nt.ketQua !== "dat") return false;
    const hds = hoaDons[dh.id] || [];
    const hasCongNoHoaDon = hds.some(
      (h) => h.loaiThanhToan === "cong_no" || h.loaiThanhToan === "cong_no_du",
    );
    if (hasCongNoHoaDon) return false;
    const conLai = Math.max(0, dh.conLai || 0);
    return conLai > 0;
  });

  // Lọc đơn công nợ (đã xuất hóa đơn công nợ, chưa tất toán hết)
  const listCongNo = donHangs.filter((dh) => {
    if (dh.trangThaiDon === "tu_choi") return false;
    const nt = nghiemThus[dh.id];
    if (!nt || nt.ketQua !== "dat") return false;
    const conLai = Math.max(0, dh.conLai || 0);
    if (conLai <= 0) return false;
    const hds = hoaDons[dh.id] || [];
    return hds.some(
      (h) => h.loaiThanhToan === "cong_no" || h.loaiThanhToan === "cong_no_du",
    );
  });

  // Lọc đơn đã tất toán
  const daTatToan = donHangs.filter((dh) => {
    const nt = nghiemThus[dh.id];
    if (!nt || nt.ketQua !== "dat") return false;
    const conLai = Math.max(0, dh.conLai || 0);
    return conLai <= 0;
  });

  const displayList =
    activeTab === "chua_tat_toan"
      ? chuaTatToan
      : activeTab === "cong_no"
        ? listCongNo
        : daTatToan;

  const LIMIT = 20;
  const totalPages = Math.max(1, Math.ceil(displayList.length / LIMIT));
  const paginatedList = displayList.slice((page - 1) * LIMIT, page * LIMIT);

  const tongCongNo = [...chuaTatToan, ...listCongNo].reduce(
    (sum, dh) => sum + Math.max(0, dh.conLai || 0),
    0,
  );
  const tongDaTT = [...chuaTatToan, ...listCongNo, ...daTatToan].reduce(
    (sum, dh) => sum + (dh.daThanhToan || 0),
    0,
  );
  const soDonQuaHan = listCongNo.filter((dh) => isQuaHan(dh)).length;

  const handlePrintHD = (hoaDonId: number) => {
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

      const headers: {
        key: string;
        label: string;
        width?: number;
        alignRight?: boolean;
      }[] = [
        { key: "maDonHang", label: "Mã đơn", width: 16 },
        { key: "tenKhachHang", label: "Khách hàng", width: 28 },
        { key: "tenMacBeTong", label: "Mác BT", width: 18 },
        {
          key: "khoiLuongDat",
          label: "Khối lượng",
          width: 14,
          alignRight: true,
        },
        { key: "thanhTien", label: "Thành tiền", width: 16, alignRight: true },
        { key: "daThanhToan", label: "Đã TT", width: 14, alignRight: true },
        { key: "conLai", label: "Còn lại", width: 14, alignRight: true },
        { key: "ngayTaoDon", label: "Ngày tạo", width: 14 },
      ];

      await exportToExcel(
        "BÁO CÁO THANH TOÁN",
        headers,
        rows,
        `BaoCaoThanhToan_${new Date().toISOString().slice(0, 10)}.xlsx`,
        "Thanh toán",
      );
      showToast("Xuất báo cáo thành công!");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Lỗi xuất báo cáo",
        "error",
      );
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
        {soDonQuaHan > 0 && (
          <div className={styles.kpiCard}>
            <div className={styles.kpiLabel}>Quá hạn thanh toán</div>
            <div
              className={styles.kpiValue}
              style={{ color: "var(--color-danger)" }}
            >
              {soDonQuaHan} đơn
            </div>
          </div>
        )}
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
          className={`${styles.tabBtn} ${activeTab === "cong_no" ? styles.tabBtnActive : ""}`}
          onClick={() => {
            setActiveTab("cong_no");
            resetPage();
          }}
        >
          <FiClock size={14} />
          Công nợ ({listCongNo.length})
          {soDonQuaHan > 0 && (
            <span className={styles.tabBadgeWarning}>
              {soDonQuaHan} quá hạn
            </span>
          )}
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
                    Đã TT
                  </th>
                  <th style={{ minWidth: 80 }}>Còn lại</th>
                  {activeTab === "da_tat_toan" && (
                    <th className={styles.hideOnMobile}>Tiền dư</th>
                  )}
                  {activeTab === "cong_no" && (
                    <th style={{ minWidth: 90 }}>Hạn thanh toán</th>
                  )}
                  <th style={{ minWidth: 180 }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {paginatedList.map((dh) => {
                  const daThanhToan = dh.daThanhToan || 0;
                  const conLai = Math.max(0, dh.conLai || 0);
                  const hds = hoaDons[dh.id] || [];
                  const daTatToanOrder = conLai <= 0;
                  const isQuaHanOrder = isQuaHan(dh);
                  const tienDu = hds.reduce(
                    (sum, h) => sum + (h.soTienDu || 0),
                    0,
                  );

                  return (
                    <tr
                      key={dh.id}
                      className={isQuaHanOrder ? styles.rowQuaHan : ""}
                    >
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
                      {activeTab === "da_tat_toan" && (
                        <td
                          className={`${styles.tableRight} ${styles.hideOnMobile}`}
                        >
                          {tienDu > 0 ? (
                            <span
                              style={{
                                color: "var(--color-success)",
                                fontWeight: 600,
                              }}
                            >
                              +{formatCurrency(tienDu)}
                            </span>
                          ) : (
                            <span
                              style={{ color: "var(--color-text-secondary)" }}
                            >
                              0 đ
                            </span>
                          )}
                        </td>
                      )}
                      {activeTab === "cong_no" && (
                        <td>
                          {(() => {
                            // Tìm tất cả hóa đơn công nợ, ưu tiên hóa đơn mới nhất (id lớn nhất)
                            const cnHDs = hds
                              .filter(
                                (h) =>
                                  h.loaiThanhToan === "cong_no" ||
                                  h.loaiThanhToan === "cong_no_du",
                              )
                              .sort((a, b) => b.id - a.id);
                            const cnHD = cnHDs[0];
                            if (!cnHD?.hanTraCongNo)
                              return (
                                <span
                                  style={{
                                    color: "var(--color-text-secondary)",
                                  }}
                                >
                                  —
                                </span>
                              );
                            const hanDate = new Date(cnHD.hanTraCongNo!);
                            const hanLabel =
                              hanDate.toLocaleDateString("vi-VN");
                            // Số ngày còn lại / quá hạn
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            const diffDays = Math.ceil(
                              (hanDate.getTime() - today.getTime()) /
                                (1000 * 60 * 60 * 24),
                            );
                            const remainingLabel =
                              diffDays > 0
                                ? `còn ${diffDays} ngày`
                                : diffDays === 0
                                  ? "hôm nay"
                                  : `quá ${Math.abs(diffDays)} ngày`;
                            // Hiển thị thêm: nếu có nhiều hóa đơn công nợ → "Lần X"
                            const lanText =
                              cnHDs.length > 1 ? ` (lần ${cnHDs.length})` : "";
                            return (
                              <div
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: 2,
                                }}
                              >
                                <span
                                  style={{
                                    color: isQuaHanOrder
                                      ? "var(--color-danger)"
                                      : "var(--color-text)",
                                    fontWeight: isQuaHanOrder ? 700 : 500,
                                  }}
                                >
                                  {hanLabel}
                                  {isQuaHanOrder && (
                                    <FiAlertTriangle
                                      size={12}
                                      style={{
                                        marginLeft: 4,
                                        verticalAlign: "middle",
                                      }}
                                    />
                                  )}
                                </span>
                                <span
                                  style={{
                                    fontSize: 11,
                                    color: isQuaHanOrder
                                      ? "var(--color-danger)"
                                      : "var(--color-text-secondary)",
                                    fontWeight: isQuaHanOrder ? 600 : 400,
                                  }}
                                >
                                  {remainingLabel}
                                  {lanText}
                                </span>
                              </div>
                            );
                          })()}
                        </td>
                      )}
                      <td>
                        <div className={styles.actionBtns}>
                          {/* Tab chưa tất toán: nút thanh toán */}
                          {activeTab === "chua_tat_toan" &&
                            !daTatToanOrder &&
                            canCreate &&
                            isChoPhepThanhToan(dh) && (
                              <button
                                className={styles.btnPay}
                                onClick={() =>
                                  navigate(`/thanh-toan/xuat/${dh.id}`)
                                }
                                title="Thanh toán"
                              >
                                <FiDollarSign size={13} />
                                {conLai > 0
                                  ? formatCurrency(conLai)
                                  : "Thanh toán"}
                              </button>
                            )}

                          {/* Tab công nợ: nút tất toán */}
                          {activeTab === "cong_no" &&
                            canCreate &&
                            isChoPhepThanhToan(dh) && (
                              <button
                                className={styles.btnPay}
                                onClick={() =>
                                  navigate(`/thanh-toan/xuat/${dh.id}`)
                                }
                                title="Tất toán công nợ"
                              >
                                <FiDollarSign size={13} />
                                Tất toán
                              </button>
                            )}

                          {/* Tab đã tất toán: hiện mặc định đã hoàn tất */}
                          {activeTab === "da_tat_toan" && (
                            <span className={styles.badgeDaHoanTat}>
                              Hoàn tất
                            </span>
                          )}

                          {/* Xem hóa đơn đã xuất — mở popup modal khi 1 đơn có nhiều hóa đơn */}
                          {hds.length > 0 && (
                            <button
                              className={styles.btnHoaDon}
                              onClick={() => {
                                if (hds.length === 1) {
                                  // Chỉ 1 hóa đơn → in trực tiếp
                                  handlePrintHD(hds[0].id);
                                } else {
                                  // Nhiều hóa đơn → mở modal danh sách
                                  setModalDanhSachHoaDon(dh);
                                }
                              }}
                              title="Xem hóa đơn đã xuất"
                            >
                              <FiPrinter size={13} />
                              HĐ {hds.length > 1 ? `(${hds.length})` : ""}
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

      {/* ── Modal danh sách hóa đơn (khi 1 đơn có nhiều hóa đơn) ── */}
      {modalDanhSachHoaDon && (
        <div
          className={styles.modalOverlay}
          onClick={() => setModalDanhSachHoaDon(null)}
        >
          <div
            className={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <div>
                <div className={styles.modalTitle}>
                  <FiPrinter size={18} />
                  Danh sách hóa đơn
                </div>
                <div className={styles.modalSubtitle}>
                  Đơn hàng <strong>{modalDanhSachHoaDon.maDonHang}</strong> ·{" "}
                  {modalDanhSachHoaDon.tenKhachHang}
                </div>
              </div>
              <button
                className={styles.modalClose}
                onClick={() => setModalDanhSachHoaDon(null)}
                title="Đóng (ESC)"
                type="button"
              >
                <FiX size={20} />
              </button>
            </div>
            <div className={styles.modalBody}>
              {(() => {
                const modalHds = (hoaDons[modalDanhSachHoaDon.id] || []).slice(
                  0,
                );
                // Sắp xếp theo thời gian lập (cũ → mới) để hiển thị "Lần 1, 2, 3..."
                modalHds.sort((a, b) => {
                  const aTime = a.ngayLap ? new Date(a.ngayLap).getTime() : 0;
                  const bTime = b.ngayLap ? new Date(b.ngayLap).getTime() : 0;
                  if (aTime !== bTime) return aTime - bTime;
                  return a.id - b.id;
                });
                const tongTatCa = modalHds.reduce(
                  (sum, h) => sum + (h.tongCong || 0),
                  0,
                );
                return (
                  <>
                    <div className={styles.modalSummary}>
                      <div className={styles.modalSummaryItem}>
                        <span>Số hóa đơn</span>
                        <strong>{modalHds.length}</strong>
                      </div>
                      <div className={styles.modalSummaryItem}>
                        <span>Tổng tiền các HĐ</span>
                        <strong className={styles.modalSummaryAmount}>
                          {formatCurrency(tongTatCa)}
                        </strong>
                      </div>
                    </div>
                    <div className={styles.hoaDonList}>
                      {modalHds.map((hd, idx) => {
                        const isCongNoHD =
                          hd.loaiThanhToan === "cong_no" ||
                          hd.loaiThanhToan === "cong_no_du";
                        return (
                          <div key={hd.id} className={styles.hoaDonCard}>
                            <div className={styles.hoaDonCardLeft}>
                              <div className={styles.hoaDonCardLan}>
                                Lần {idx + 1}
                              </div>
                              <div className={styles.hoaDonCardMa}>
                                {hd.maHoaDon}
                              </div>
                              <div className={styles.hoaDonCardDate}>
                                {hd.ngayLap
                                  ? new Date(hd.ngayLap).toLocaleDateString(
                                      "vi-VN",
                                    )
                                  : "—"}
                              </div>
                              <span
                                className={`${styles.hoaDonCardBadge} ${
                                  isCongNoHD
                                    ? styles.badgeCongNo
                                    : styles.badgeTraHet
                                }`}
                              >
                                {isCongNoHD
                                  ? hd.loaiThanhToan === "cong_no_du"
                                    ? "Công nợ (dư)"
                                    : "Công nợ"
                                  : "Trả hết"}
                              </span>
                            </div>
                            <div className={styles.hoaDonCardRight}>
                              <span className={styles.hoaDonCardLabel}>
                                Tổng cộng
                              </span>
                              <span className={styles.hoaDonCardTongCong}>
                                {formatCurrency(hd.tongCong || 0)}
                              </span>
                              {(hd.soTienThanhToan || 0) > 0 && (
                                <span className={styles.hoaDonCardDaTT}>
                                  Khách trả:{" "}
                                  {formatCurrency(hd.soTienThanhToan || 0)}
                                </span>
                              )}
                              <button
                                className={styles.hoaDonCardBtn}
                                onClick={() => {
                                  handlePrintHD(hd.id);
                                  setModalDanhSachHoaDon(null);
                                }}
                                type="button"
                              >
                                <FiPrinter size={13} /> Xem & In
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
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
