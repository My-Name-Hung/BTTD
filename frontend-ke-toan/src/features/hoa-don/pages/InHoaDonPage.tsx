import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FiArrowLeft, FiPrinter, FiDownload } from "react-icons/fi";
import { useReactToPrint } from "react-to-print";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { Loading } from "../../../shared/components/Common";
import { useToast } from "../../../shared/hooks";
import logo from "../../../assets/Logo.png";
import {
  layHoaDon,
  layDonHang,
  layNghiemThu,
  layLichSanXuat,
  layHoaDonTheoDonHang,
} from "../../../shared/services/api";
import styles from "./InHoaDonPage.module.css";

/* ── Helpers ─────────────────────────────────────────── */
function formatCurrency(v: number): string {
  if (!v && v !== 0) return "0 đ";
  return v.toLocaleString("vi-VN") + " đ";
}

function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatDateTime(d: string | Date | null | undefined): string {
  if (!d) return "";
  const dt = new Date(d);
  return `${formatDate(dt)} lúc ${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
}

function sortHoaDonsByTime(items: HoaDonData[]) {
  return [...items].sort((a, b) => {
    const aTime = new Date(a.ngayLap || a.createdAt || 0).getTime();
    const bTime = new Date(b.ngayLap || b.createdAt || 0).getTime();
    if (aTime !== bTime) return aTime - bTime;
    return a.id - b.id;
  });
}

/** Đọc số tiền thành chữ tiếng Việt (hỗ trợ đến hàng tỷ) */
function numberToVietnamese(n: number): string {
  if (n === 0) return "Không đồng";
  if (n < 0) return "Âm " + numberToVietnamese(-n);
  const units = ["", "nghìn", "triệu", "tỷ"];
  const digits = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
  function readThree(num: number): string {
    if (num === 0) return "";
    const hundred = Math.floor(num / 100);
    const rest = num % 100;
    const ten = Math.floor(rest / 10);
    const unit = rest % 10;
    let result = "";
    if (hundred > 0) result += (hundred === 1 ? "một" : digits[hundred]) + " trăm";
    if (rest > 0) {
      if (hundred > 0) result += " ";
      if (rest < 10) {
        result += digits[unit];
      } else if (rest < 20) {
        result += "mười" + (unit > 0 ? " " + digits[unit] : "");
      } else {
        result +=
          (ten === 1 ? "mười" : digits[ten] + " mươi") +
          (unit > 0 ? " " + (unit === 1 ? "mốt" : digits[unit]) : "");
      }
    }
    return result;
  }
  const str = Math.round(n).toString();
  const len = str.length;
  const parts: string[] = [];
  for (let i = len; i > 0; i -= 3) {
    const start = Math.max(0, i - 3);
    const part = parseInt(str.slice(start, i), 10);
    const unitIdx = Math.floor((len - i) / 3);
    const partText = readThree(part);
    if (partText) {
      parts.unshift(partText + (units[unitIdx] ? " " + units[unitIdx] : ""));
    }
  }
  return parts.join(" ") + " đồng";
}

/* ── Types ───────────────────────────────────────────── */
interface HoaDonData {
  id: number;
  idDonHang: number;
  maHoaDon: string;
  soHoaDon: string;
  ngayLap: string | null;
  khachHang: string;
  loaiXiMang: string;
  gioDo: string;
  phuongThucThanhToan: string;
  ghiChu: string;
  tienBeTong: number;
  buuVanChuyen: number;
  phiPhatSinh: number;
  giamTru: number;
  tongCong: number;
  soTienThanhToan: number;
  loaiThanhToan: string;
  hanTraCongNo: string | null;
  nguoiTaoId: number | null;
  createdAt: string;
  // Join fields (từ layHoaDonTheoId)
  maDonHang?: string;
  tenKhachHang?: string;
  diaChiNhan?: string;
  tenMacBeTong?: string;
  khoiLuongDat?: number;
  donGia?: number;
  thanhTien?: number;
  ngayGiao?: string;
  tenTramTron?: string;
  diaChiTramTron?: string;
  bienSoXe?: string | null;
  tenTaiXe?: string | null;
  nguoiOmOng?: string | null;
  nguoiBatOng?: string | null;
  kyThuatCongTrinh?: string | null;
  ngayNghiemThu?: string | null;
  [key: string]: any;
}

interface NghiemThuData {
  id: number;
  ngayLapBienBan: string | null;
  nguoiLap: string | null;
  nguoiKy: string | null;
  chucVu: string | null;
  bienBanFile: string | string[] | null;
  bienBanFiles?: string[];
  ghiChu: string | null;
}

interface LichSanXuatItem {
  id: number;
  bienSoXe: string | null;
  tenTaiXe: string | null;
  nguoiOmOng: string | null;
  nguoiBatOng: string | null;
  kyThuatCongTrinh: string | null;
  [key: string]: any;
}

const COMPANY = {
  tenCongTy: "CÔNG TY CỔ PHẦN BÊ TÔNG TÂY ĐÔ",
  diaChi: "Km14, QL91, P.Phước Thới, TP.Cần Thơ",
  dienThoai: "0292 651 8375",
  mst: "1801286137",
  taiKhoan: "123 456 7890",
  nganHang: "Ngân hàng TMCP Ngoại thương Việt Nam (VCB)",
};

/* ── Component ─────────────────────────────────────────── */
export default function InHoaDonPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();

  // Ref đúng element cần in
  const invoiceRef = useRef<HTMLDivElement>(null);

  const [hoaDon, setHoaDon] = useState<HoaDonData | null>(null);
  const [allHoaDons, setAllHoaDons] = useState<HoaDonData[]>([]);
  const [nghiemThu, setNghiemThu] = useState<NghiemThuData | null>(null);
  const [lichSX, setLichSX] = useState<LichSanXuatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadLoading, setDownloadLoading] = useState(false);

  /* In bằng react-to-print – trỏ trực tiếp vào element */
  const handlePrint = useReactToPrint({
    contentRef: invoiceRef,
    documentTitle: hoaDon ? `HoaDon-${hoaDon.maHoaDon}` : "HoaDon",
    pageStyle: `
      @page { size: A4; margin: 0; }
      @media print {
        .toolbar { display: none !important; }
        .wrapper { background: #e8ecf0 !important; padding-bottom: 40px !important; }
      }
    `,
  });

  const handleDownload = async () => {
    if (!invoiceRef.current) return;
    setDownloadLoading(true);
    try {
      const element = invoiceRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });
      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position -= pageHeight;
        pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const fileName = hoaDon ? `hoa-don-${hoaDon.maHoaDon}.pdf` : `hoa-don.pdf`;
      pdf.save(fileName);
    } catch {
      showToast("Lỗi tạo file PDF", "error");
    } finally {
      setDownloadLoading(false);
    }
  };

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);

    try {
      // Bước 1: Lấy hóa đơn theo ID (API mới /hoa-don/:id)
      const numId = parseInt(id.replace(/[^0-9]/g, ""), 10);
      if (!numId) throw new Error("ID không hợp lệ");

      const hd: HoaDonData = await layHoaDon(numId);
      if (!hd) {
        setError("Không tìm thấy hóa đơn");
        setLoading(false);
        return;
      }

      // Bước 2: Lấy thêm nghiệm thu + lịch sản xuất (song song)
      const [nt, lsArr, hdArr] = await Promise.all([
        layNghiemThu(hd.idDonHang).catch(() => null),
        layLichSanXuat(hd.idDonHang).catch(() => null),
        layHoaDonTheoDonHang(hd.idDonHang).catch(() => []),
      ]);

      setHoaDon(hd);
      setAllHoaDons(Array.isArray(hdArr) ? hdArr : []);
      setNghiemThu(nt || null);
      setLichSX(Array.isArray(lsArr) ? lsArr : []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Không tải được thông tin hóa đơn",
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) return <Loading />;

  if (error || !hoaDon) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.toolbar}>
          <button className={styles.backBtn} onClick={() => navigate(-1)}>
            <FiArrowLeft size={16} /> Quay lại
          </button>
        </div>
        <div className={styles.errorBox}>
          <p>{error || "Không tìm thấy hóa đơn"}</p>
          <button className={styles.retryBtn} onClick={() => navigate(-1)}>
            Quay lại
          </button>
        </div>
      </div>
    );
  }

  const hd = hoaDon;
  const ls = Array.isArray(lichSX) && lichSX.length > 0 ? lichSX[0] : null;
  const isCongNo = hd.loaiThanhToan === "cong_no" || hd.loaiThanhToan === "cong_no_du";
  const debtHoaDons = sortHoaDonsByTime(
    allHoaDons.filter(
      (item) => item.loaiThanhToan === "cong_no" || item.loaiThanhToan === "cong_no_du",
    ),
  );
  const currentDebtIndex = debtHoaDons.findIndex((item) => item.id === hd.id);
  const debtStepLabel = currentDebtIndex >= 0 ? `Thanh toán lần ${currentDebtIndex + 1}` : "";
  const isLastDebtInvoice = currentDebtIndex >= 0 && currentDebtIndex === debtHoaDons.length - 1;
  const debtInvoiceSummary = debtHoaDons.map((item, index) => ({
    id: item.id,
    label: `Lần ${index + 1}`,
    amount: item.tongCong || item.soTienThanhToan || 0,
  }));
  const tongDaThanhToanToanBo = debtInvoiceSummary.reduce(
    (sum, item) => sum + item.amount,
    0,
  );
  const phuongThucText =
    hd.phuongThucThanhToan === "chuyen_khoan" ? "Chuyển khoản" : "Tiền mặt";

  // Địa chỉ trạm trộn đầy đủ
  const tramTronLabel = hd.tenTramTron || "—";

  return (
    <div className={styles.wrapper}>
      {/* ── Toolbar ── */}
      <div className={styles.toolbar}>
        <button className={styles.backBtn} onClick={() => navigate(-1)}>
          <FiArrowLeft size={16} /> Quay lại
        </button>
        <div className={styles.toolbarRight}>
          <button
            className={styles.downloadBtn}
            onClick={handleDownload}
            disabled={downloadLoading || loading}
          >
            <FiDownload size={16} />
            {downloadLoading ? "Đang tải..." : "Tải về"}
          </button>
          <button className={styles.printBtn} onClick={handlePrint}>
            <FiPrinter size={16} /> In hóa đơn
          </button>
        </div>
      </div>

      {/* ── Invoice content – ref trỏ vào đây ── */}
      <div
        ref={invoiceRef}
        style={{ maxWidth: 800, margin: "0 auto", padding: "0 16px 40px" }}
      >
        <div className={styles.invoice}>
          {/* ── Header ── */}
          <div className={styles.invoiceHeader}>
            <div className={styles.headerLeft}>
              <div className={styles.companyLogo}>
                <img
                  src={logo}
                  alt="Logo BTTD"
                  className={styles.logoImg}
                />
              </div>
              <div className={styles.companyDetails}>
                <div className={styles.companyName}>{COMPANY.tenCongTy}</div>
                <div className={styles.companyInfo}>
                  <span>Địa chỉ: {COMPANY.diaChi}</span>
                  <span>ĐT: {COMPANY.dienThoai} – MST: {COMPANY.mst}</span>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.invoiceTitle}>
            <h2>HÓA ĐƠN BÁN HÀNG</h2>
            <p className={styles.titleSub}>VAT INVOICE</p>
            {debtStepLabel && (
              <p className={styles.titleSub}>
                {debtStepLabel}{isLastDebtInvoice ? " · Lần tất toán cuối" : ""}
              </p>
            )}
          </div>

          {/* ── Số hóa đơn + Ngày ── */}
          <div className={styles.invoiceMeta}>
            <div className={styles.metaLeft}>
              <div className={styles.metaRow}>
                <span className={styles.metaLabel}>Số hóa đơn:</span>
                <span className={styles.metaValue}>{hd.maHoaDon}</span>
              </div>
              <div className={styles.metaRow}>
                <span className={styles.metaLabel}>Mã đơn hàng:</span>
                <span className={styles.metaValue}>
                  {hd.maDonHang || hd.maHoaDon?.split("-").slice(1, -1).join("-") || ""}
                </span>
              </div>
            </div>
            <div className={styles.metaRight}>
              <div className={styles.metaRow}>
                <span className={styles.metaLabel}>Ngày lập:</span>
                <span className={styles.metaValue}>{formatDate(hd.ngayLap)}</span>
              </div>
              {isCongNo && hd.hanTraCongNo && (
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Hạn thanh toán:</span>
                  <span className={styles.metaValueDanger}>
                    {formatDate(hd.hanTraCongNo)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* ── Thông tin khách hàng ── */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>THÔNG TIN KHÁCH HÀNG</div>
            <div className={styles.infoGrid}>
              <div className={styles.infoCol}>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Tên khách hàng:</span>
                  <span className={styles.infoValue}>
                    {hd.khachHang || hd.tenKhachHang || ""}
                  </span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Địa chỉ giao hàng:</span>
                  <span className={styles.infoValue}>
                    {hd.diaChiNhan || ""}
                  </span>
                </div>
              </div>
              <div className={styles.infoCol}>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Ngày giao hàng:</span>
                  <span className={styles.infoValue}>
                    {formatDate(hd.ngayGiao)}
                  </span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Trạm trộn:</span>
                  <span className={styles.infoValue}>{hd.tenTramTron || "—"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Thông tin sản phẩm ── */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>THÔNG TIN SẢN PHẨM / DỊCH VỤ</div>
            <div className={styles.infoGrid}>
              <div className={styles.infoCol}>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Mác bê tông:</span>
                  <span className={styles.infoValue}>
                    {hd.tenMacBeTong || "—"}
                  </span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Loại xi măng:</span>
                  <span className={styles.infoValue}>
                    {hd.loaiXiMang || "PCB40"}
                  </span>
                </div>
              </div>
              <div className={styles.infoCol}>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Khối lượng đặt:</span>
                  <span className={styles.infoValue}>
                    {hd.khoiLuongDat || 0} m³
                  </span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Giờ đổ:</span>
                  <span className={styles.infoValue}>
                    {hd.gioDo ? formatDateTime(hd.gioDo) : "—"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Bảng chi tiết ── */}
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.thSTT}>STT</th>
                <th className={styles.thNoiDung}>Nội dung</th>
                <th className={styles.thDonVi}>ĐVT</th>
                <th className={styles.thSoLuong}>Số lượng</th>
                <th className={styles.thDonGia}>Đơn giá (đ)</th>
                <th className={styles.thThanhTien}>Thành tiền (đ)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className={styles.tdCenter}>1</td>
                <td>Bê tông thương phẩm ({hd.tenMacBeTong || ""})</td>
                <td className={styles.tdCenter}>m³</td>
                <td className={styles.tdRight}>{hd.khoiLuongDat || 0}</td>
                <td className={styles.tdRight}>
                  {(hd.donGia || 0).toLocaleString("vi-VN")}
                </td>
                <td className={styles.tdRight}>
                  {(hd.tienBeTong || 0).toLocaleString("vi-VN")}
                </td>
              </tr>
              {(hd.buuVanChuyen || 0) > 0 && (
                <tr>
                  <td className={styles.tdCenter}>2</td>
                  <td>Phí bù vận chuyển</td>
                  <td className={styles.tdCenter}></td>
                  <td className={styles.tdRight}></td>
                  <td className={styles.tdRight}></td>
                  <td className={styles.tdRight}>
                    {(hd.buuVanChuyen || 0).toLocaleString("vi-VN")}
                  </td>
                </tr>
              )}
              {(hd.phiPhatSinh || 0) > 0 && (
                <tr>
                  <td className={styles.tdCenter}>
                    {(hd.buuVanChuyen || 0) > 0 ? "3" : "2"}
                  </td>
                  <td>Chi phí phát sinh</td>
                  <td className={styles.tdCenter}></td>
                  <td className={styles.tdRight}></td>
                  <td className={styles.tdRight}></td>
                  <td className={styles.tdRight}>
                    {(hd.phiPhatSinh || 0).toLocaleString("vi-VN")}
                  </td>
                </tr>
              )}
              {(hd.giamTru || 0) > 0 && (
                <tr>
                  <td className={styles.tdCenter}>
                    {(hd.buuVanChuyen || 0) > 0 || (hd.phiPhatSinh || 0) > 0
                      ? "4"
                      : "2"}
                  </td>
                  <td>Giảm trừ / Khuyến mãi</td>
                  <td className={styles.tdCenter}></td>
                  <td className={styles.tdRight}></td>
                  <td className={styles.tdRight}></td>
                  <td className={`${styles.tdRight} ${styles.red}`}>
                    -{(hd.giamTru || 0).toLocaleString("vi-VN")}
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className={styles.totalRow}>
                <td colSpan={5} className={styles.tdRightBold}>
                  TỔNG CỘNG
                </td>
                <td className={styles.tdRightBold}>
                  {(hd.tongCong || 0).toLocaleString("vi-VN")}
                </td>
              </tr>
              <tr>
                <td colSpan={6} className={styles.soTienChu}>
                  Số tiền bằng chữ:{" "}
                  {numberToVietnamese(hd.tongCong || 0)}
                </td>
              </tr>
            </tfoot>
          </table>

          {isLastDebtInvoice && debtInvoiceSummary.length > 1 && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>TỔNG HỢP CÁC LẦN THANH TOÁN</div>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.thSTT}>STT</th>
                    <th className={styles.thNoiDung}>Nội dung</th>
                    <th className={styles.thThanhTien}>Số tiền (đ)</th>
                  </tr>
                </thead>
                <tbody>
                  {debtInvoiceSummary.map((item, index) => (
                    <tr key={item.id}>
                      <td className={styles.tdCenter}>{index + 1}</td>
                      <td>{item.label}</td>
                      <td className={styles.tdRight}>{item.amount.toLocaleString("vi-VN")}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className={styles.totalRow}>
                    <td colSpan={2} className={styles.tdRightBold}>
                      TỔNG ĐÃ THANH TOÁN TOÀN BỘ
                    </td>
                    <td className={styles.tdRightBold}>
                      {tongDaThanhToanToanBo.toLocaleString("vi-VN")}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* ── Thông tin thanh toán ── */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>THÔNG TIN THANH TOÁN</div>
            <div className={styles.infoGrid}>
              <div className={styles.infoCol}>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Phương thức TT:</span>
                  <span className={styles.infoValue}>{phuongThucText}</span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Khách thanh toán kỳ này:</span>
                  <span className={styles.infoValue}>{formatCurrency(hd.soTienThanhToan || 0)}</span>
                </div>
              </div>
              <div className={styles.infoCol}>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Loại thanh toán:</span>
                  <span
                    className={`${styles.infoValue} ${
                      isCongNo
                        ? styles.statusBadgeCongNo
                        : styles.statusBadgeTraHet
                    }`}
                  >
                    {isCongNo ? "CÔNG NỢ" : "TRẢ HẾT"}
                  </span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Công nợ còn lại:</span>
                  <span className={styles.infoValue}>{formatCurrency(hd.donHangConLai || 0)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Thông tin nhân sự & xe ── */}
          {(ls || nghiemThu || hd.bienSoXe || hd.tenTaiXe) && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>
                THÔNG TIN NHÂN SỰ &amp; XE
              </div>
              <div className={styles.infoGrid}>
                <div className={styles.infoCol}>
                  {(hd.bienSoXe || ls?.bienSoXe) && (
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Xe (Biển số):</span>
                      <span className={styles.infoValue}>
                        {hd.bienSoXe || ls?.bienSoXe}
                      </span>
                    </div>
                  )}
                  {(hd.tenTaiXe || ls?.tenTaiXe) && (
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Tài xế:</span>
                      <span className={styles.infoValue}>
                        {hd.tenTaiXe || ls?.tenTaiXe}
                      </span>
                    </div>
                  )}
                  {(hd.nguoiOmOng || ls?.nguoiOmOng) && (
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Vận hành bơm:</span>
                      <span className={styles.infoValue}>
                        {hd.nguoiOmOng || ls?.nguoiOmOng}
                      </span>
                    </div>
                  )}
                  {(hd.nguoiBatOng || ls?.nguoiBatOng) && (
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Lắp ống:</span>
                      <span className={styles.infoValue}>
                        {hd.nguoiBatOng || ls?.nguoiBatOng}
                      </span>
                    </div>
                  )}
                </div>
                <div className={styles.infoCol}>
                  {(hd.kyThuatCongTrinh ||
                    ls?.kyThuatCongTrinh) && (
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>
                        Kỹ sư công trình:
                      </span>
                      <span className={styles.infoValue}>
                        {hd.kyThuatCongTrinh ||
                          ls?.kyThuatCongTrinh ||
                          ""}
                      </span>
                    </div>
                  )}
                  {nghiemThu && (
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Ngày nghiệm thu:</span>
                      <span className={styles.infoValue}>
                        {formatDate(nghiemThu.ngayLapBienBan)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Ghi chú ── */}
          {hd.ghiChu && (
            <div className={styles.ghiChuBox}>
              <strong>Ghi chú:</strong> {hd.ghiChu}
            </div>
          )}

          {/* ── Chữ ký ── */}
          <div className={styles.signatures}>
            <div className={styles.sigCol}>
              <p className={styles.sigTitle}>NGƯỜI LẬP HÓA ĐƠN</p>
              <p className={styles.sigNote}>(Ký và ghi rõ họ tên)</p>
              <div className={styles.sigLine}></div>
            </div>
            <div className={styles.sigCol}>
              <p className={styles.sigTitle}>KẾ TOÁN TRƯỞNG</p>
              <p className={styles.sigNote}>(Ký và ghi rõ họ tên)</p>
              <div className={styles.sigLine}></div>
            </div>
            <div className={styles.sigCol}>
              <p className={styles.sigTitle}>KHÁCH HÀNG</p>
              <p className={styles.sigNote}>(Ký và ghi rõ họ tên)</p>
              <div className={styles.sigLine}></div>
            </div>
          </div>

          {/* ── Footer ── */}
          <div className={styles.invoiceFooter}>
            <p>
              Cảm ơn quý khách đã tin tưởng sử dụng dịch vụ của{" "}
              <strong>BÊ TÔNG TÂY ĐÔ</strong>!
            </p>
            <p className={styles.footerContact} />
          </div>
        </div>
      </div>
    </div>
  );
}
