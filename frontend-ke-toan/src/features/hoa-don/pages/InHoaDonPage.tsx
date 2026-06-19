import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { useCallback, useEffect, useRef, useState } from "react";
import { FiArrowLeft, FiDownload, FiPrinter } from "react-icons/fi";
import { useNavigate, useParams } from "react-router-dom";
import { useReactToPrint } from "react-to-print";
import logo from "../../../assets/Logo.png";
import { Loading } from "../../../shared/components/Common";
import { useToast } from "../../../shared/hooks";
import {
  layDanhSachMacBeTong,
  layHoaDon,
  layHoaDonTheoDonHang,
  layLichSanXuat,
  layNghiemThu,
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
  const digits = [
    "không",
    "một",
    "hai",
    "ba",
    "bốn",
    "năm",
    "sáu",
    "bảy",
    "tám",
    "chín",
  ];
  function readThree(num: number): string {
    if (num === 0) return "";
    const hundred = Math.floor(num / 100);
    const rest = num % 100;
    const ten = Math.floor(rest / 10);
    const unit = rest % 10;
    let result = "";
    if (hundred > 0)
      result += (hundred === 1 ? "một" : digits[hundred]) + " trăm";
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
  soTienDu?: number;
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
  // Tổng tiền gốc của đơn (thanhTien), đơn giá gốc, đã thanh toán (daThanhToan)
  // để hiển thị đúng "Thành tiền" bê tông gốc ở mọi lần HĐ (không bị
  // phân bổ tỷ lệ nhỏ khi khách trả một phần).
  donHangThanhTien?: number;
  donHangDonGia?: number;
  donHangDaThanhToan?: number;
  // Tổng nghĩa vụ GỐC của đơn tại thời điểm lập hóa đơn (lưu trong HoaDon.tongNghiaVuDon)
  // = tiền bê tông gốc + bv + pp - gt, đầy đủ cho mọi lần thanh toán
  tongNghiaVuDon?: number;
  // Snapshot cứng "Công nợ còn lại" tại thời điểm lập hóa đơn này
  // (lưu trong HoaDon.congNoConLai). Ưu tiên dùng để in "Công nợ còn lại"
  // trên hóa đơn, giữ nguyên giá trị của thời điểm lập dù DonHang.conLai
  // có thay đổi sau này khi khách thanh toán hết các lần sau.
  congNoConLai?: number;
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
  const [macBeTongs, setMacBeTongs] = useState<
    { id: number; tenMac: string; donGia: number }[]
  >([]);
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

      const fileName = hoaDon
        ? `hoa-don-${hoaDon.maHoaDon}.pdf`
        : `hoa-don.pdf`;
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
  const isCongNo =
    hd.loaiThanhToan === "cong_no" || hd.loaiThanhToan === "cong_no_du";
  const isCongNoDu = hd.loaiThanhToan === "cong_no_du";
  const debtHoaDons = sortHoaDonsByTime(
    allHoaDons.filter(
      (item) =>
        item.loaiThanhToan === "cong_no" || item.loaiThanhToan === "cong_no_du",
    ),
  );
  const currentDebtIndex = debtHoaDons.findIndex((item) => item.id === hd.id);
  const debtStepLabel =
    currentDebtIndex >= 0 ? `Thanh toán lần ${currentDebtIndex + 1}` : "";
  const isLastDebtInvoice =
    currentDebtIndex >= 0 && currentDebtIndex === debtHoaDons.length - 1;
  // Tổng nghĩa vụ tài chính của đơn hàng = tổng phải trả GỐC của cả đơn
  // (bao gồm tiền bê tông + bù vận chuyển + chi phí phát sinh - giảm trừ).
  // Đây là tổng "nghĩa vụ" khách phải trả, dùng để:
  // 1) Tính "Dư" cuối cùng khi khách trả vượt (công nợ dư)
  // 2) Quyết định hóa đơn công nợ đã "tất toán" hay chưa
  //
  // Nguồn ưu tiên (theo độ chính xác):
  // 1) Tính tổng từ MAX(tienBeTong) + MAX(buuVanChuyen) + MAX(phiPhatSinh)
  //    - MAX(tienBeTong): tiền bê tông đầy đủ (lúc tạo đơn, hoặc HĐ đầu
  //      chia tỷ lệ thì lấy MAX để có giá trị gốc).
  //    - MAX(buuVanChuyen) / MAX(phiPhatSinh): bv/pp có thể thêm ở lần
  //      sau nên lấy MAX qua tất cả HĐ để có tổng đầy đủ.
  // 2) tongNghiaVuDon của HĐ đầu tiên (nếu không có data bv/pp/tienBeTong)
  // 3) donHangThanhTien (gốc đơn) + ước lượng bv/pp từ lần đầu
  // 4) Fallback cuối: hd.thanhTien / hd.tongCong
  // Lấy max tienBeTông từ:
  // 1) hd.donHangThanhTien (giá gốc đơn - LUÔN đúng, ưu tiên cao nhất)
  // 2) tất cả debtHoaDons[i].tienBeTông (có thể đã chia tỷ lệ)
  // 3) hd.tienBeTông (HĐ hiện tại, có thể đã chia tỷ lệ)
  // Lý do: nếu HĐ hiện tại là HĐ công nợ lần 1 và lưu tienBeTông = phân bổ
  // tỷ lệ của khoản khách trả (vd: 1tr/2tr → tienBeTông = 1tr thay vì 2tr),
  // lấy MAX chỉ giữa các HĐ sẽ ra 1tr → tính nhầm "đã tất toán".
  // → Phải đưa hd.donHangThanhTien (giá gốc đơn) vào MAX để ra 2tr.
  const donHangThanhTienNum = Number(hd.donHangThanhTien) || 0;
  const maxTienBeTong = Math.max(
    0,
    donHangThanhTienNum,
    ...debtHoaDons.map((d) => Number(d.tienBeTong) || 0),
    Number(hd.tienBeTong) || 0,
  );
  const maxBuuVanChuyen = Math.max(
    0,
    ...debtHoaDons.map((d) => Number(d.buuVanChuyen) || 0),
    Number(hd.buuVanChuyen) || 0,
  );
  const maxPhiPhatSinh = Math.max(
    0,
    ...debtHoaDons.map((d) => Number(d.phiPhatSinh) || 0),
    Number(hd.phiPhatSinh) || 0,
  );
  const maxGiamTru = Math.max(
    0,
    ...debtHoaDons.map((d) => Number(d.giamTru) || 0),
    Number(hd.giamTru) || 0,
  );
  const tongNghiaVuTinhTuThanhPhan =
    maxTienBeTong + maxBuuVanChuyen + maxPhiPhatSinh - maxGiamTru;
  const tongNghiaVuHoaDonDau =
    debtHoaDons.length > 0 && debtHoaDons[0].tongNghiaVuDon != null
      ? Number(debtHoaDons[0].tongNghiaVuDon) || 0
      : 0;
  // Ưu tiên 1: tổng từ thành phần (chính xác nhất, ổn định qua các lần)
  // Ưu tiên 2: tongNghiaVuDon của HĐ đầu (nếu thành phần = 0)
  // Ưu tiên 3: tongNghiaVuDon của HĐ hiện tại (snapshot tại thời điểm lập)
  // Ưu tiên 4: donHangThanhTien (giá gốc đơn - LUÔN đúng với mọi HĐ)
  // Ưu tiên 5: hd.thanhTien
  // Lưu ý: hd.tongCong ở mỗi HĐ công nợ chỉ = số tiền khách trả kỳ đó
  // (chia tỷ lệ), KHÔNG phải tổng nghĩa vụ đơn. Nên KHÔNG fallback về
  // hd.tongCong vì sẽ khiến "đã tất toán" bị nhầm khi mới trả 1 phần
  // (vd: đơn 2tr, trả kỳ 1 = 1tr → tongNghiaVu = 1tr → isDaTatToan=true
  //  → công nợ còn lại = 0 thay vì 1tr).
  const tongNghiaVu =
    (tongNghiaVuTinhTuThanhPhan > 0 ? tongNghiaVuTinhTuThanhPhan : 0) ||
    tongNghiaVuHoaDonDau ||
    (hd.tongNghiaVuDon ?? 0) ||
    (hd.donHangThanhTien ?? 0) ||
    (hd.thanhTien ?? 0);
  // Tính bảng tổng hợp các lần thanh toán.
  // amount = tổng tiền khách THỰC TRẢ trong lần đó (gồm cả dư nếu có).
  // Đây là cách hiển thị "đã trả" cho từng lần, khớp với form xuất HĐ
  // (Khách trả: 700.000 → bảng TỔNG HỢP Lần 2 = 700.000).
  // SỐ TIỀN DƯ cuối cùng = tổng thực trả - tổng nghĩa vụ (chỉ > 0 khi dư).
  const debtInvoiceSummary = debtHoaDons.map((item) => {
    const laLoaiDu =
      item.loaiThanhToan === "tra_het_du" ||
      item.loaiThanhToan === "cong_no_du";
    const soTienThucTra = item.soTienThanhToan || item.tongCong || 0;
    const soTienDuFromBackend = Number(item.soTienDu) || 0;
    // Phần dư thực của lần này: ưu tiên backend, fallback = 0
    // (công thức tienDuCuoi ở dưới sẽ tính dư cuối cùng tổng thể).
    const soTienDu = laLoaiDu ? soTienDuFromBackend : 0;
    return {
      id: item.id,
      label: `Lần ${debtHoaDons.findIndex((d) => d.id === item.id) + 1}`,
      // amount = tổng KH trả trong lần (gồm dư nếu có)
      amount: soTienThucTra,
      soTienThucTra,
      soTienDu,
      laLoaiDu,
    };
  });
  // Tổng thực khách đã trả cho cả đơn hàng (tính cộng dồn tất cả hóa đơn).
  // Tính từ danh sách hóa đơn (soTienThanhToan gốc của mỗi hóa đơn, KHÔNG clamp).
  // KHÔNG dùng hd.donHangDaThanhToan vì backend có thể đã clamp tại tongNghiaVu
  // (vd: trả 250k khi còn lại 200k → daThanhToan chỉ +200k, dư 50k mất → tienDuCuoi sai).
  const tongDaThanhToanToanBo = debtInvoiceSummary.reduce(
    (sum, item) => sum + item.amount,
    0,
  );
  // (tongNghiaVu đã được tính ở trên, dùng cho cả tienDuCuoi lẫn phần hiển thị)
  // Số tiền dư cuối cùng = lấy thẳng từ hd.soTienDu (HĐ hiện tại) để đảm bảo
  // khớp tuyệt đối với dòng "Số tiền dư" trong THÔNG TIN THANH TOÁN của cùng hóa đơn.
  // Lý do không dùng "tongDaThanhToanToanBo - tongNghiaVu":
  //   tongNghiaVu ở trên có thể = tongNghiaVuTinhTuThanhPhan (MAX các thành phần)
  //   và nếu HĐ lần đầu bị backend lưu tienBeTong theo phân bổ tỷ lệ (chia nhỏ),
  //   MAX tienBeTong sẽ ra con số chia tỷ lệ → tienDuCuoi bị sai lớn.
  // Đồng thời tổng kết chỉ hiển thị 1 dòng "SỐ TIỀN DƯ" duy nhất từ HĐ cuối
  // (vì dư chỉ phát sinh khi tất toán), nên dùng hd.soTienDu là chính xác.
  const tienDuCuoi = Math.max(0, Number(hd.soTienDu) || 0);
  // Số tiền thực tế khách trả kỳ này (lưu trong HoaDon.soTienThanhToan).
  // Với HĐ trả hết dư / công nợ dư, soTienThanhToan = tổng khách trả GỒM CẢ DƯ.
  // Khai báo sớm để dùng cho cả daThanhToanTruoc (fallback) lẫn phần
  // tính toán hiển thị bên dưới.
  const soTienTraKyNay = hd.soTienThanhToan || 0;
  // Số tiền dư riêng của KỲ NÀY (chỉ > 0 với HĐ trả hết dư / công nợ dư).
  // Ưu tiên lấy từ hd.soTienDu (backend lưu riêng), fallback tính ngược từ
  // soTienThanhToan - phanConLaiCanTruocKhiLap (áp dụng cho HĐ cũ chưa lưu
  // đúng soTienDu, hoặc HĐ loại _du).
  const laLoaiDuHienTai =
    hd.loaiThanhToan === "tra_het_du" || hd.loaiThanhToan === "cong_no_du";
  const soTienDuHienTaiBackend = Number(hd.soTienDu) || 0;
  let soTienDuKyNay = laLoaiDuHienTai
    ? soTienDuHienTaiBackend > 0
      ? soTienDuHienTaiBackend
      : 0
    : 0;
  // Phần khách trả kỳ này DÙNG ĐỂ TRỪ NGHĨA VỤ (= soTienThanhToan - soTienDu)
  // Dùng để tính "SỐ TIỀN TRẢ KỲ NÀY" (chỉ phần trừ nợ) và "TIỀN DƯ".
  // - Công nợ lần 2 dư: soTienThanhToan=400k, soTienDu=50k → phanTruNghiaVu=350k
  //   → SỐ TIỀN TRẢ KỲ NÀY hiển thị 300k (phanConLaiCanTra), DƯ = 50k
  // - Trả hết dư: soTienThanhToan=600k, soTienDu=100k → phanTruNghiaVu=500k
  //   → TỔNG CỘNG hiển thị 500k (tongNghiaVu), DƯ = 100k
  let phanTruNghiaVuKyNay = Math.max(0, soTienTraKyNay - soTienDuKyNay);
  // Số tiền đã thanh toán ở các lần hóa đơn TRƯỚC lần hiện tại
  // (công nợ lần 1, 2, ..., lần hiện tại - 1) — hiển thị "ĐÃ THANH TOÁN (các lần trước)"
  // trong bảng trước TỔNG CỘNG.
  // Ưu tiên tính từ danh sách hóa đơn (chính xác tuyệt đối). Fallback về
  // hd.donHangDaThanhToan - soTienTraKyNay (tổng thực đã trên đơn trừ kỳ này)
  // khi danh sách hóa đơn rỗng / không tải được.
  const daThanhToanTruocFromList = debtInvoiceSummary
    .slice(0, currentDebtIndex >= 0 ? currentDebtIndex : 0)
    .reduce((sum, item) => sum + item.amount, 0);
  const daThanhToanTruocFromDon = Math.max(
    0,
    (hd.donHangDaThanhToan ?? 0) - phanTruNghiaVuKyNay,
  );
  const daThanhToanTruoc =
    daThanhToanTruocFromList > 0 || debtInvoiceSummary.length > 0
      ? daThanhToanTruocFromList
      : daThanhToanTruocFromDon;
  // Số tiền nghĩa vụ còn lại cần trả để tất toán đơn hàng TẠI THỜI ĐIỂM TRƯỚC
  // khi lập hóa đơn kỳ này (= tongNghiaVu - đã thanh toán các lần trước).
  // Dùng để tính số tiền dư kỳ này từ dữ liệu cũ (HĐ chưa lưu soTienDu đúng).
  const phanConLaiCanTruocKhiLap = Math.max(0, tongNghiaVu - daThanhToanTruoc);
  // Fallback tính soTienDu cho HĐ cũ (DB chưa có soTienDu) dựa trên
  // phanConLaiCanTruocKhiLap. Áp dụng khi: laLoaiDuHienTai và soTienThanhToan
  // > phanConLaiCanTruocKhiLap (tức là khách trả vượt nghĩa vụ còn lại).
  if (
    laLoaiDuHienTai &&
    soTienDuKyNay === 0 &&
    hd.soTienThanhToan != null &&
    phanConLaiCanTruocKhiLap > 0
  ) {
    soTienDuKyNay = Math.max(0, hd.soTienThanhToan - phanConLaiCanTruocKhiLap);
    // Cập nhật lại phanTruNghiaVuKyNay cho phản ánh soTienDuKyNay mới
    phanTruNghiaVuKyNay = Math.max(0, soTienTraKyNay - soTienDuKyNay);
  }

  // ── SỐ TIỀN HIỂN THỊ TRÊN HÓA ĐƠN ──
  // - Công nợ chưa tất toán (lần đầu/giữa): TỔNG CỘNG = số tiền khách trả kỳ này
  //   (soTienThanhToan), KHÔNG hiển thị các thành phần bv/pp vì lúc này khách
  //   mới trả 1 phần, chưa đủ tiền → tách chi tiết chỉ gây rối.
  // - Công nợ lần cuối (tất toán) / trả hết / trả hết dư: TỔNG CỘNG = tongNghiaVu,
  //   hiển thị đầy đủ Tiền bê tông + Bù vận chuyển + Chi phí phát sinh
  //   vì lúc này khách đã thanh toán đủ toàn bộ đơn hàng.
  // (soTienTraKyNay đã được khai báo ở trên, dùng cho cả daThanhToanTruoc fallback)
  // Hóa đơn công nợ CHƯA tất toán (soTienThanhToan < còn lại phải trả):
  // chỉ hiển thị số tiền trả, không tách thành phần bv/pp vì khách
  // mới trả 1 phần, chưa đủ tiền → tách chi tiết gây rối.
  // Hóa đơn công nợ ĐÃ tất toán (soTienThanhToan >= còn lại phải trả)
  // hoặc TRẢ HẾT: hiển thị đầy đủ thành phần + tổng nghĩa vụ.
  // Đánh dấu "đã tất toán" khi đạt/vượt tổng nghĩa vụ (kể cả khi
  // loaiThanhToan="cong_no" nhưng khách trả đủ, hoặc "cong_no_du"/"tra_het_du").
  const isDaTatToan =
    hd.loaiThanhToan === "tra_het" ||
    hd.loaiThanhToan === "tra_het_du" ||
    hd.loaiThanhToan === "cong_no_du" ||
    (isCongNo && soTienTraKyNay >= Math.max(0, tongNghiaVu - daThanhToanTruoc));
  const isCongNoChuaTatToan = isCongNo && !isDaTatToan;
  const tongCongHienThi = isCongNoChuaTatToan
    ? soTienTraKyNay
    : hd.tongCong || 0;
  // Tiền bê tông hiển thị: nếu là công nợ chưa tất toán → ẩn, dùng soTienTraKyNay;
  // ngược lại hiển thị giá trị đầy đủ.
  // Ưu tiên: donHang.thanhTien (giá gốc đơn) > allHoaDons[0].tienBeTong (HĐ đầu)
  // > hd.tienBeTong (HĐ hiện tại, có thể đã chia tỷ lệ).
  // Lý do: HĐ sau thường lưu tienBeTong theo phân bổ tỷ lệ (vd: lần 1 trả 200k
  // của đơn 500k → tienBeTong = 434.782,61 thay vì 500.000). Lấy từ donHang
  // hoặc HĐ đầu sẽ ra con số GỐC đúng.
  const tienBeTongGoc =
    hd.donHangThanhTien ||
    (isLastDebtInvoice && allHoaDons.length > 0
      ? allHoaDons[0].tienBeTong
      : 0) ||
    hd.tienBeTong ||
    0;
  const tienBeTongHienThi = isCongNoChuaTatToan
    ? soTienTraKyNay
    : tienBeTongGoc;
  // Phần nghĩa vụ tài chính CÒN LẠI cần trả để tất toán đơn hàng
  // (= tổng tiền gốc đơn - tổng đã trả các lần trước)
  // - Công nợ lần 1: phanConLaiCanTra = tongNghiaVu (= toàn bộ đơn)
  // - Công nợ lần 2: phanConLaiCanTra = tongNghiaVu - daThanhToanTruoc
  const phanConLaiCanTra = Math.max(0, tongNghiaVu - daThanhToanTruoc);
  // Số tiền hiển thị ở dòng "SỐ TIỀN TRẢ KỲ NÀY"
  // = phần khách trả kỳ này dùng để tất toán nghĩa vụ
  //   (= min(phanTruNghiaVuKyNay, phanConLaiCanTra))
  // - Trả đủ hoặc dư: hiển thị đúng phần còn lại (lấp đầy nghĩa vụ)
  // - Trả thiếu: hiển thị toàn bộ phần khách trả cho nghĩa vụ
  const soTienTraTatToan = Math.min(phanTruNghiaVuKyNay, phanConLaiCanTra);
  // Tiền dư riêng của kỳ này = phần khách trả vượt nghĩa vụ còn lại
  // (chỉ > 0 khi phanTruNghiaVuKyNay > phanConLaiCanTra)
  // Dùng phanTruNghiaVuKyNay (không gồm dư) thay vì soTienTraKyNay
  // (vì soTienTraKyNay = soTienThanhToan gồm cả soTienDu → sẽ cộng dồn dư 2 lần).
  const tienDuKyNay = Math.max(0, phanTruNghiaVuKyNay - phanConLaiCanTra);

  const phuongThucText =
    hd.phuongThucThanhToan === "chuyen_khoan" ? "Chuyển khoản" : "Tiền mặt";

  // Helper: xác định hóa đơn có hiển thị dòng DƯ riêng hay không
  // Dùng soTienDuKyNay (phần dư user nhập riêng từ form xuất HĐ) làm nguồn
  // chính — đã tách rõ với phần trừ nghĩa vụ. Cũ hiển thị tienDuKyNay
  // (= phanTruNghiaVu - phanConLaiCanTra) sẽ = 0 với HĐ đã tất toán
  // đúng bằng phanConLaiCanTra, che mất phần dư user thực sự nhập.
  const coHienThiDu = laLoaiDuHienTai && soTienDuKyNay > 0;

  // Helper: số tiền hiển thị ở dòng "SỐ TIỀN TRẢ KỲ NÀY" / "TỔNG CỘNG"
  // - Trả hết dư (tra_het_du): hiển thị tongNghiaVu (= 1.150.000), dư riêng = 50.000
  // - Công nợ lần cuối dư (cong_no_du): hiển thị soTienTraKyNay (= 700.000)
  //   là TỔNG tiền khách trả kỳ này (gồm dư), dư riêng = 50.000
  //   → "Khách thanh toán kỳ này" cũng = 700.000 cho khớp
  // - Công nợ chưa tất toán: hiển thị soTienTraKyNay (= 200.000), không có dòng dư
  // - Trả hết / tất toán đủ (không dư): hiển thị tongCong (= 1.150.000), không có dòng dư
  const soTienHienThiTongCong = coHienThiDu
    ? hd.loaiThanhToan === "tra_het_du"
      ? tongNghiaVu
      : soTienTraKyNay
    : isCongNoChuaTatToan
      ? soTienTraKyNay
      : tongCongHienThi;
  // Helper: số tiền ở dòng DƯ riêng
  // Lấy từ soTienDuKyNay (phần dư user nhập riêng) — KHÔNG dùng tienDuKyNay
  // (= phanTruNghiaVu - phanConLaiCanTra) vì giá trị này = 0 khi khách
  // trả đúng bằng phanConLaiCanTra dù thực tế có dư.
  const soTienHienThiDu = soTienDuKyNay;

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
                <img src={logo} alt="Logo BTTD" className={styles.logoImg} />
              </div>
              <div className={styles.companyDetails}>
                <div className={styles.companyName}>{COMPANY.tenCongTy}</div>
                <div className={styles.companyInfo}>
                  <span>Địa chỉ: {COMPANY.diaChi}</span>
                  <span>
                    ĐT: {COMPANY.dienThoai} – MST: {COMPANY.mst}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.invoiceTitle}>
            <h2>HÓA ĐƠN BÁN HÀNG</h2>
            <p className={styles.titleSub}>VAT INVOICE</p>
            {debtStepLabel && (
              <p className={styles.titleSub}>
                {debtStepLabel}
                {isLastDebtInvoice ? " · Lần tất toán cuối" : ""}
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
                  {hd.maDonHang ||
                    hd.maHoaDon?.split("-").slice(1, -1).join("-") ||
                    ""}
                </span>
              </div>
            </div>
            <div className={styles.metaRight}>
              <div className={styles.metaRow}>
                <span className={styles.metaLabel}>Ngày lập:</span>
                <span className={styles.metaValue}>
                  {formatDate(hd.ngayLap)}
                </span>
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
            <div className={styles.sectionTitle}>
              THÔNG TIN SẢN PHẨM / DỊCH VỤ
            </div>
            <div className={styles.infoGrid}>
              <div className={styles.infoCol}>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Mác bê tông:</span>
                  <span className={styles.infoValue}>
                    {hd.tenMacBeTong || "—"}
                    {donGiaMacCatalog() != null && (
                      <span className={styles.infoValueSub}>
                        {" "}
                        — {formatCurrency(donGiaMacCatalog() as number)}/m³
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
                    <span className={styles.infoLabel}>
                      Hạng mục / Cấu kiện:
                    </span>
                    <span className={styles.infoValue}>{hd.hangMuc}</span>
                  </div>
                )}
                {hd.phuongPhapDo && (
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Phương pháp đổ:</span>
                    <span className={styles.infoValue}>
                      {phuongPhapDoLabel}
                    </span>
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
                        // Lấy giờ đổ từ lịch sản xuất (thoiGianBatDauDo →
                        // thoiGianTron), KHÔNG fallback sang hd.gioDo vì
                        // hd.gioDo là giá trị cũ lưu trong HĐ có thể không
                        // khớp với thời gian thực tế trong lịch sản xuất.
                        // Logic đồng bộ với ChiTietDonHangPage.
                        const tg =
                          t.thoiGianBatDauDo || t.thoiGianTron || null;
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
                <td>{`Bê tông thương phẩm (${hd.tenMacBeTong || ""})`}</td>
                <td className={styles.tdCenter}>m³</td>
                <td className={styles.tdRight}>{hd.khoiLuongDat || 0}</td>
                <td className={styles.tdRight}>
                  {(hd.donHangDonGia || hd.donGia || 0).toLocaleString("vi-VN")}
                </td>
                <td className={styles.tdRight}>
                  {tienBeTongHienThi.toLocaleString("vi-VN")}
                </td>
              </tr>
            </tbody>
            <tfoot>
              {isCongNo && currentDebtIndex > 0 && (
                <tr className={styles.paidRow}>
                  <td colSpan={5} className={styles.tdRightBold}>
                    ĐÃ THANH TOÁN
                  </td>
                  <td className={styles.tdRightBold}>
                    {daThanhToanTruoc.toLocaleString("vi-VN")}
                  </td>
                </tr>
              )}
              <tr className={styles.totalRow}>
                <td colSpan={5} className={styles.tdRightBold}>
                  {coHienThiDu
                    ? hd.loaiThanhToan === "tra_het_du"
                      ? "TỔNG CỘNG"
                      : "SỐ TIỀN TRẢ KỲ NÀY"
                    : isCongNoChuaTatToan
                      ? currentDebtIndex === 0
                        ? "SỐ TIỀN TRẢ"
                        : "SỐ TIỀN TRẢ KỲ NÀY"
                      : "TỔNG CỘNG"}
                </td>
                <td className={styles.tdRightBold}>
                  {soTienHienThiTongCong.toLocaleString("vi-VN")}
                </td>
              </tr>
              <tr>
                <td colSpan={6} className={styles.soTienChu}>
                  Số tiền bằng chữ: {numberToVietnamese(soTienHienThiTongCong)}
                </td>
              </tr>
            </tfoot>
          </table>

          {isLastDebtInvoice && debtInvoiceSummary.length > 1 && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>
                TỔNG HỢP CÁC LẦN THANH TOÁN
              </div>
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
                      <td className={styles.tdRight}>
                        {item.amount.toLocaleString("vi-VN")}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
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
                        SỐ TIỀN DƯ
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
                  <span className={styles.infoLabel}>
                    Khách thanh toán kỳ này:
                  </span>
                  <span className={styles.infoValue}>
                    {formatCurrency(soTienHienThiTongCong)}
                  </span>
                </div>
                {/* Dòng DƯ riêng khi khách trả vượt nghĩa vụ
                    (công nợ lần cuối có dư, công nợ dư, hoặc trả hết dư) */}
                {coHienThiDu && (
                  <div className={styles.infoRow}>
                    <span className={`${styles.infoLabel} ${styles.duLabel}`}>
                      Số tiền dư:
                    </span>
                    <span className={`${styles.infoValue} ${styles.duValue}`}>
                      {formatCurrency(soTienHienThiDu)}
                    </span>
                  </div>
                )}
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
                    {/* Chỉ hiển thị 2 trạng thái: CÔNG NỢ hoặc TRẢ HẾT
                        (bỏ các biến thể "(tất toán)", "(dư)" theo yêu cầu). */}
                    {isCongNo ? "CÔNG NỢ" : "TRẢ HẾT"}
                  </span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Công nợ còn lại:</span>
                  <span className={styles.infoValue}>
                    {formatCurrency(
                      // Đồng bộ với ChiTietDonHangPage:
                      // - Hiển thị khi là HĐ công nợ (bất kể đã tất toán hay
                      //   chưa) — chỉ cần hdIsCongNo.
                      // - Nguồn: snapshot congNoConLai (lưu cứng trong HĐ
                      //   tại thời điểm lập).
                      // - HĐ trả hết (không phải công nợ): hiển thị 0.
                      isCongNo
                        ? Math.max(0, Number(hd.congNoConLai) || 0)
                        : 0,
                    )}
                  </span>
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
                          <span className={styles.infoLabel}>
                            Vận hành bơm:
                          </span>
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
