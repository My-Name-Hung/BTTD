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
  layNghiemThu,
  layLichSanXuat,
  layHoaDonTheoDonHang,
  layDanhSachMacBeTong,
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

/** Đọc số tiền thành chữ tiếng Việt */
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
  // Join fields
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
  // Hạng mục / phương pháp đổ
  hangMuc?: string | null;
  phuongPhapDo?: "do_xa" | "do_bom" | null;
  loaiBom?: "bom_ngang" | "bom_can" | null;
  chieuDaiBom?: number | null;
  kieuNoi?: "khong_dau" | "noi_dau" | "noi_dit" | null;
  chieuDaiNoi?: number | null;
  // Tổng tiền gốc của đơn (thanhTien) và đã thanh toán (daThanhToan)
  // để tính "ĐÃ THANH TOÁN (các lần trước)" ở công nợ
  donHangThanhTien?: number;
  donHangDaThanhToan?: number;
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
  idTramTron?: number | null;
  tenTram?: string | null;
  thoiGianTron?: string | null;
  thoiGianBatDauDo?: string | null;
  trangThai?: string | null;
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

  const invoiceRef = useRef<HTMLDivElement>(null);

  const [hoaDon, setHoaDon] = useState<HoaDonData | null>(null);
  const [allHoaDons, setAllHoaDons] = useState<HoaDonData[]>([]);
  const [nghiemThu, setNghiemThu] = useState<NghiemThuData | null>(null);
  const [lichSX, setLichSX] = useState<LichSanXuatItem[]>([]);
  const [macBeTongs, setMacBeTongs] = useState<{ id: number; tenMac: string; donGia: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadLoading, setDownloadLoading] = useState(false);

  // Tra cứu đơn giá catalog của mác bê tông; ưu tiên theo tên, fallback về đơn giá trên hóa đơn
  const donGiaMacCatalog = (): number | null => {
    if (!hoaDon) return null;
    if (hoaDon.tenMacBeTong) {
      const found = macBeTongs.find((m) => m.tenMac === hoaDon.tenMacBeTong);
      if (found) return found.donGia;
    }
    if (hoaDon.donGia && hoaDon.donGia > 0) return hoaDon.donGia;
    return null;
  };

  /* In bằng react-to-print */
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
      const numId = parseInt(id.replace(/[^0-9]/g, ""), 10);
      if (!numId) throw new Error("ID không hợp lệ");

      const hd: HoaDonData = await layHoaDon(numId);
      if (!hd) {
        setError("Không tìm thấy hóa đơn");
        setLoading(false);
        return;
      }

      const [nt, lsArr, hdArr, macList] = await Promise.all([
        layNghiemThu(hd.idDonHang).catch(() => null),
        layLichSanXuat(hd.idDonHang).catch(() => null),
        layHoaDonTheoDonHang(hd.idDonHang).catch(() => []),
        layDanhSachMacBeTong().catch(() => []),
      ]);

      setHoaDon(hd);
      setAllHoaDons(Array.isArray(hdArr) ? hdArr : []);
      setNghiemThu(nt || null);
      setLichSX(Array.isArray(lsArr) ? lsArr : []);
      setMacBeTongs(Array.isArray(macList) ? macList : []);
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
  // Danh sách trạm trộn của đơn (1 row / trạm) lấy từ lịch sản xuất
  // Fallback: nếu không có lichSX thì tạo 1 row rỗng từ tenTramTron
  const danhSachTram: LichSanXuatItem[] =
    Array.isArray(lichSX) && lichSX.length > 0
      ? lichSX
      : hd.tenTramTron
        ? [
            {
              id: 0,
              idTramTron: 0,
              tenTram: hd.tenTramTron,
              bienSoXe: hd.bienSoXe ?? null,
              tenTaiXe: hd.tenTaiXe ?? null,
              nguoiOmOng: hd.nguoiOmOng ?? null,
              nguoiBatOng: hd.nguoiBatOng ?? null,
              kyThuatCongTrinh: hd.kyThuatCongTrinh ?? null,
            },
          ]
        : [];
  const isCongNo = hd.loaiThanhToan === "cong_no" || hd.loaiThanhToan === "cong_no_du";
  const isCongNoDu = hd.loaiThanhToan === "cong_no_du";
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
    amount: item.soTienThanhToan || item.tongCong || 0,
  }));
  const tongDaThanhToanToanBo = debtInvoiceSummary.reduce(
    (sum, item) => sum + item.amount,
    0,
  );
  // Tổng nghĩa vụ tài chính của đơn hàng = tongCong lần đầu tiên
  // (do XuatHoaDonPage tính = tienBeTong + bv + pp - gt, lưu xuống DB).
  // Dùng để tính "Dư" cuối cùng khi khách trả vượt (công nợ dư).
  const tongNghiaVu = allHoaDons.length > 0
    ? allHoaDons[0].tongCong || 0
    : hd.tongCong || 0;
  // Số tiền dư cuối cùng = tổng thực khách đã trả - tổng nghĩa vụ đơn hàng
  // (chỉ > 0 khi loại thanh toán cuối cùng là "cong_no_du" / "tra_het_du")
  const tienDuCuoi = Math.max(0, tongDaThanhToanToanBo - tongNghiaVu);
  // Số tiền đã thanh toán ở các lần hóa đơn TRƯỚC lần hiện tại
  // (công nợ lần 1, 2, ..., lần hiện tại - 1) — hiển thị "ĐÃ THANH TOÁN (các lần trước)"
  // trong bảng trước TỔNG CỘNG
  const daThanhToanTruoc = debtInvoiceSummary
    .slice(0, currentDebtIndex >= 0 ? currentDebtIndex : 0)
    .reduce((sum, item) => sum + item.amount, 0);
  // Tổng cộng hóa đơn (do XuatHoaDonPage tính và lưu) =
  // tienBeTong + buuVanChuyen + phiPhatSinh - giamTru
  // Tất cả các loại hóa đơn (trả hết / công nợ / công nợ dư) đều hiển thị cùng một tongCong.
  const tongCongHienThi = hd.tongCong || 0;
  const phuongThucText =
    hd.phuongThucThanhToan === "chuyen_khoan" ? "Chuyển khoản" : "Tiền mặt";

  // Phương pháp đổ label
  const phuongPhapDoLabel = (() => {
    if (!hd.phuongPhapDo) return "—";
    let label = hd.phuongPhapDo === "do_xa" ? "Đổ xã" : "Đổ bơm";
    if (hd.phuongPhapDo === "do_bom") {
      if (hd.loaiBom === "bom_ngang") label += " – Bơm ngang";
      else if (hd.loaiBom === "bom_can") label += " – Bơm cần";
      if (hd.chieuDaiBom) label += ` (${hd.chieuDaiBom}m)`;
    }
    if (hd.phuongPhapDo === "do_xa") {
      if (hd.kieuNoi === "khong_dau") label += " – Không đầu";
      else if (hd.kieuNoi === "noi_dau") label += " – Nối đầu";
      else if (hd.kieuNoi === "noi_dit") label += " – Nối đít";
      if (hd.chieuDaiNoi) label += ` (${hd.chieuDaiNoi}m)`;
    }
    return label;
  })();

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

      {/* ── Invoice content ── */}
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
              {/* Hiển thị đầy đủ các trạm trộn (1 row / trạm) */}
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Trạm trộn:</span>
                <span className={styles.infoValue}>
                  {danhSachTram.length === 0
                    ? "—"
                    : danhSachTram
                        .map((t, i) => t.tenTram || `Trạm ${i + 1}`)
                        .join(", ")}
                </span>
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
                    {donGiaMacCatalog() != null && (
                      <span className={styles.infoValueSub}>
                        {" "}— {formatCurrency(donGiaMacCatalog() as number)}/m³
                      </span>
                    )}
                  </span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Loại xi măng:</span>
                  <span className={styles.infoValue}>
                    {hd.loaiXiMang || "PCB40"}
                  </span>
                </div>
                {hd.hangMuc && (
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Hạng mục / Cấu kiện:</span>
                    <span className={styles.infoValue}>{hd.hangMuc}</span>
                  </div>
                )}
                {hd.phuongPhapDo && (
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Phương pháp đổ:</span>
                    <span className={styles.infoValue}>{phuongPhapDoLabel}</span>
                  </div>
                )}
              </div>
              <div className={styles.infoCol}>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Khối lượng đặt:</span>
                  <span className={styles.infoValue}>
                    {hd.khoiLuongDat || 0} m³
                  </span>
                </div>
                {/* Giờ đổ theo từng trạm, format: "Tên trạm - Thời gian đổ" */}
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Giờ đổ:</span>
                  <span className={styles.infoValue}>
                    {(() => {
                      // Lấy danh sách "tên trạm - thời gian" từ lịch sản xuất
                      const lines: string[] = [];
                      const seenTram = new Set<string>();
                      danhSachTram.forEach((t, idx) => {
                        const tramLabel = t.tenTram || `Trạm ${idx + 1}`;
                        const tg =
                          (t as any).thoiGianBatDauDo ||
                          (t as any).thoiGianTron ||
                          hd.gioDo;
                        if (seenTram.has(tramLabel)) return;
                        seenTram.add(tramLabel);
                        if (tg) {
                          lines.push(`${tramLabel} - ${formatDateTime(tg)}`);
                        } else {
                          lines.push(tramLabel);
                        }
                      });
                      if (lines.length === 0) return "—";
                      return (
                        <div className={styles.gioDoList}>
                          {lines.map((l, i) => (
                            <div key={i}>{l}</div>
                          ))}
                        </div>
                      );
                    })()}
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
            </tbody>
            <tfoot>
              {isCongNo && currentDebtIndex > 0 && (
                <tr className={styles.paidRow}>
                  <td colSpan={5} className={styles.tdRightBold}>
                    ĐÃ THANH TOÁN (các lần trước)
                  </td>
                  <td className={styles.tdRightBold}>
                    {daThanhToanTruoc.toLocaleString("vi-VN")}
                  </td>
                </tr>
              )}
              <tr className={styles.totalRow}>
                <td colSpan={5} className={styles.tdRightBold}>
                  TỔNG CỘNG
                </td>
                <td className={styles.tdRightBold}>
                  {tongCongHienThi.toLocaleString("vi-VN")}
                </td>
              </tr>
              <tr>
                <td colSpan={6} className={styles.soTienChu}>
                  Số tiền bằng chữ:{" "}
                  {numberToVietnamese(tongCongHienThi)}
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
                  {/* Tổng nghĩa vụ tài chính của đơn hàng (= tongCong lần đầu) */}
                  <tr className={styles.totalRow}>
                    <td colSpan={2} className={styles.tdRightBold}>
                      TỔNG NGHĨA VỤ ĐƠN HÀNG
                    </td>
                    <td className={styles.tdRightBold}>
                      {tongNghiaVu.toLocaleString("vi-VN")}
                    </td>
                  </tr>
                  {/* Tổng thực khách đã trả (sum soTienThanhToan tất cả lần) */}
                  <tr className={styles.totalRow}>
                    <td colSpan={2} className={styles.tdRightBold}>
                      TỔNG ĐÃ THANH TOÁN
                    </td>
                    <td className={styles.tdRightBold}>
                      {tongDaThanhToanToanBo.toLocaleString("vi-VN")}
                    </td>
                  </tr>
                  {/* Số tiền dư cuối cùng — chỉ hiển thị khi > 0
                      (= tổng thực trả - tổng nghĩa vụ đơn) */}
                  {tienDuCuoi > 0 && (
                    <tr className={styles.duRow}>
                      <td colSpan={2} className={styles.tdRightBold}>
                        DƯ (tiền thừa của khách)
                      </td>
                      <td className={styles.tdRightBold}>
                        {tienDuCuoi.toLocaleString("vi-VN")}
                      </td>
                    </tr>
                  )}
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

          {/* ── Thông tin nhân sự & xe (hiển thị đầy đủ từng trạm) ── */}
          {(danhSachTram.length > 0 || nghiemThu || hd.ngayNghiemThu) && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>
                THÔNG TIN NHÂN SỰ &amp; XE
              </div>
              {danhSachTram.map((t, idx) => (
                <div key={t.id ?? idx} className={styles.tramNhanSuBlock}>
                  <div className={styles.tramNhanSuHeader}>
                    Trạm {idx + 1}: <strong>{t.tenTram || "—"}</strong>
                  </div>
                  <div className={styles.infoGrid}>
                    <div className={styles.infoCol}>
                      {(t.bienSoXe || hd.bienSoXe) && (
                        <div className={styles.infoRow}>
                          <span className={styles.infoLabel}>Biển số xe:</span>
                          <span className={styles.infoValue}>
                            {t.bienSoXe || hd.bienSoXe}
                          </span>
                        </div>
                      )}
                      {(t.tenTaiXe || hd.tenTaiXe) && (
                        <div className={styles.infoRow}>
                          <span className={styles.infoLabel}>Tài xế:</span>
                          <span className={styles.infoValue}>
                            {t.tenTaiXe || hd.tenTaiXe}
                          </span>
                        </div>
                      )}
                      {(t.nguoiOmOng || hd.nguoiOmOng) && (
                        <div className={styles.infoRow}>
                          <span className={styles.infoLabel}>Vận hành bơm:</span>
                          <span className={styles.infoValue}>
                            {t.nguoiOmOng || hd.nguoiOmOng}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className={styles.infoCol}>
                      {(t.nguoiBatOng || hd.nguoiBatOng) && (
                        <div className={styles.infoRow}>
                          <span className={styles.infoLabel}>Lắp ống:</span>
                          <span className={styles.infoValue}>
                            {t.nguoiBatOng || hd.nguoiBatOng}
                          </span>
                        </div>
                      )}
                      {(t.kyThuatCongTrinh || hd.kyThuatCongTrinh) && (
                        <div className={styles.infoRow}>
                          <span className={styles.infoLabel}>
                            Kỹ sư công trình:
                          </span>
                          <span className={styles.infoValue}>
                            {t.kyThuatCongTrinh || hd.kyThuatCongTrinh}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {/* Ngày nghiệm thu: ưu tiên hd.ngayNghiemThu (từ DonHang), fallback nghiemThu.ngayLapBienBan */}
              {(hd.ngayNghiemThu || nghiemThu?.ngayLapBienBan) && (
                <div className={styles.infoRow} style={{ marginTop: 8 }}>
                  <span className={styles.infoLabel}>Ngày nghiệm thu:</span>
                  <span className={styles.infoValue}>
                    {formatDate(hd.ngayNghiemThu || nghiemThu?.ngayLapBienBan)}
                  </span>
                </div>
              )}
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
