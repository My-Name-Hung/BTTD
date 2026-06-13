import { useCallback, useEffect, useState } from "react";
import {
  FiDollarSign,
  FiDownload,
  FiPrinter,
  FiSearch,
  FiX,
  FiAlertTriangle,
  FiClock,
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
  const [selectedHoaDonIds, setSelectedHoaDonIds] = useState<Record<number, boolean>>({});

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
          mapHD[dh.id] = hoaDonList.map(
            (h: any) => ({
              id: h.id,
              maHoaDon: h.soHoaDon,
              ngayLap: h.ngayTao,
              khachHang: dh.tenKhachHang,
              tienBeTong: (h.tongCong || 0) - (h.giamTru || 0),
              buuVanChuyen: 0,
              phiPhatSinh: 0,
              giamTru: h.giamTru || 0,
              tongCong: (h.tongCong || 0),
              loaiThanhToan: h.loaiThanhToan || "tra_het",
              soTienDu: h.soTienDu || 0,
              hanTraCongNo: h.hanTraCongNo || null,
            }),
          );
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

  useEffect(() => {
    const handleClickOutside = () => {
      setSelectedHoaDonIds({});
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

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
            <span className={styles.tabBadgeWarning}>{soDonQuaHan} quá hạn</span>
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
                    <th
                      className={styles.hideOnMobile}
                      style={{ minWidth: 80, textAlign: "right" }}
                    >
                      Tiền dư
                    </th>
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
                  const tienDu = hds.reduce((sum, h) => sum + (h.soTienDu || 0), 0);

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
                            <span style={{ color: "var(--color-success)", fontWeight: 600 }}>
                              +{formatCurrency(tienDu)}
                            </span>
                          ) : (
                            <span style={{ color: "var(--color-text-secondary)" }}>
                              0 đ
                            </span>
                          )}
                        </td>
                      )}
                      {activeTab === "cong_no" && (
                        <td>
                          {(() => {
                            const cnHD = hds.find(
                              (h) =>
                                h.loaiThanhToan === "cong_no" ||
                                h.loaiThanhToan === "cong_no_du",
                            );
                            if (!cnHD?.hanTraCongNo) return (
                              <span style={{ color: "var(--color-text-secondary)" }}>
                                —
                              </span>
                            );
                            return (
                              <span
                                style={{
                                  color: isQuaHanOrder
                                    ? "var(--color-danger)"
                                    : "var(--color-text)",
                                  fontWeight: isQuaHanOrder ? 700 : 500,
                                }}
                              >
                                {new Date(cnHD.hanTraCongNo!).toLocaleDateString(
                                  "vi-VN",
                                )}
                                {isQuaHanOrder && (
                                  <FiAlertTriangle
                                    size={12}
                                    style={{ marginLeft: 4, verticalAlign: "middle" }}
                                  />
                                )}
                              </span>
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

                          {/* Xem hóa đơn đã xuất */}
                          {hds.length > 0 && (
                            <div className={styles.hoaDonDropdown}>
                              <button
                                className={styles.btnHoaDon}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedHoaDonIds((prev) => ({
                                    ...prev,
                                    [dh.id]: prev[dh.id] ? false : true,
                                  }));
                                }}
                                title="Xem hóa đơn đã xuất"
                              >
                                <FiPrinter size={13} />
                                HĐ {hds.length > 1 ? `(${hds.length})` : ""}
                              </button>
                              {selectedHoaDonIds[dh.id] && hds.length > 1 && (
                                <div
                                  className={styles.dropdownMenu}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {hds.map((hd) => (
                                    <button
                                      key={hd.id}
                                      className={styles.dropdownItem}
                                      onClick={() => {
                                        handlePrintHD(hd.id);
                                        setSelectedHoaDonIds((prev) => ({
                                          ...prev,
                                          [dh.id]: false,
                                        }));
                                      }}
                                    >
                                      <span>{hd.maHoaDon}</span>
                                      <span className={styles.dropdownAmount}>
                                        {formatCurrency(hd.tongCong)}
                                      </span>
                                    </button>
                                  ))}
                                </div>
                              )}
                              {selectedHoaDonIds[dh.id] && hds.length === 1 && (
                                <button
                                  className={styles.btnPrintSingle}
                                  onClick={() => {
                                    handlePrintHD(hds[0].id);
                                    setSelectedHoaDonIds((prev) => ({
                                      ...prev,
                                      [dh.id]: false,
                                    }));
                                  }}
                                >
                                  <FiPrinter size={12} /> Xem HĐ
                                </button>
                              )}
                            </div>
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
