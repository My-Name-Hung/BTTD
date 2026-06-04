import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FiArrowLeft, FiPrinter, FiDownload } from "react-icons/fi";
import { Loading } from "../components/Common";
import { layHoaDonTheoDonHang, layHoaDonTheoId } from "../services/api";
import styles from "./InHoaDonPage.module.css";

function formatCurrency(v: number): string {
  if (!v && v !== 0) return "0";
  return v.toLocaleString("vi-VN");
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
  return `${dt.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })} ${dt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`;
}

function numberToVietnamese(n: number): string {
  if (!n || n === 0) return "Không đồng";
  const units = ["", "nghìn", "triệu", "tỷ", "nghìn tỷ"];
  const digits = [
    "không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín",
  ];

  const numStr = Math.round(n).toString();
  const parts: string[] = [];
  let currentPart = "";

  for (let i = numStr.length - 1; i >= 0; i--) {
    currentPart = numStr[i] + currentPart;
    if (currentPart.length === 3 || i === 0) {
      parts.unshift(currentPart);
      currentPart = "";
    }
  }

  const result: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const num = parseInt(parts[i]);
    if (num > 0) {
      const subResult: string[] = [];
      const hundred = Math.floor(num / 100);
      const tens = Math.floor((num % 100) / 10);
      const ones = num % 10;

      if (hundred > 0) {
        subResult.push(hundred === 1 ? "một trăm" : `${digits[hundred]} trăm`);
      }
      if (tens > 0) {
        if (tens === 1) {
          subResult.push("mười");
        } else {
          subResult.push(`${digits[tens]} mươi`);
        }
      }
      if (ones > 0) {
        if (tens === 1) {
          subResult.push(digits[ones]);
        } else if (ones === 1 && tens > 1) {
          subResult.push("mốt");
        } else if (ones === 5 && tens > 0) {
          subResult.push("lăm");
        } else {
          subResult.push(digits[ones]);
        }
      }
      result.push(subResult.join(" ") + " " + units[parts.length - 1 - i]);
    }
  }

  return result.join(" ").trim().replace(/\s+/g, " ") + " đồng";
}

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
  tenKhachHang?: string;
  diaChiNhan?: string;
  tenMacBeTong?: string;
  khoiLuongDat?: number;
  donGia?: number;
  thanhTien?: number;
  maDonHang?: string;
  kyThuatCongTrinh?: string;
  nguoiOmOng?: string;
  nguoiBatOng?: string;
  bienSoXe?: string;
  tenTaiXe?: string;
  tenTram?: string;
}

export default function InHoaDonPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const printRef = useRef<HTMLDivElement>(null);
  const [hoaDon, setHoaDon] = useState<HoaDonData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      // Ưu tiên đọc data từ location state (truyền qua navigate từ XuatHoaDonPage)
      const stateData = location.state as HoaDonData | null;
      if (stateData && stateData.id) {
        setHoaDon(stateData);
        setLoading(false);
        return;
      }

      // Đọc data từ query param (base64 encoded JSON)
      const params = new URLSearchParams(location.search);
      const dataParam = params.get("data");
      if (dataParam) {
        try {
          const decoded = JSON.parse(atob(dataParam)) as HoaDonData;
          setHoaDon(decoded);
          setLoading(false);
          return;
        } catch {
          // fall through to fetch
        }
      }

      // Đọc từ URL param (id hóa đơn)
      const pathParts = location.pathname.split("/");
      const idPart = pathParts[pathParts.length - 1];
      const hoaDonId = parseInt(idPart, 10);

      if (!hoaDonId || isNaN(hoaDonId)) {
        setLoading(false);
        return;
      }

      try {
        // Thử fetch trực tiếp theo ID hóa đơn
        const hd = await layHoaDonTheoId(hoaDonId);
        if (hd) {
          setHoaDon(hd as HoaDonData);
        } else {
          // Fallback: lấy theo idDonHang từ query param
          const idDonHangParam = params.get("idDonHang");
          if (idDonHangParam) {
            const idDonHang = parseInt(idDonHangParam, 10);
            const list = await layHoaDonTheoDonHang(idDonHang);
            const found = list.find((h: any) => h.id === hoaDonId) || list[0];
            setHoaDon(found as HoaDonData || null);
          } else {
            setHoaDon(null);
          }
        }
      } catch {
        setHoaDon(null);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [location]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = async () => {
    if (!hoaDon) return;
    try {
      // Lấy data đầy đủ từ backend
      const fullData = await layHoaDonTheoId(hoaDon.id);
      const merged = { ...hoaDon, ...fullData };
      const dataStr = btoa(JSON.stringify(merged));
      window.open(`/in-hoa-don/${hoaDon.id}?data=${dataStr}`, "_blank");
    } catch {
      // Fallback: mở với data hiện có
      const dataStr = btoa(JSON.stringify(hoaDon));
      window.open(`/in-hoa-don/${hoaDon.id}?data=${dataStr}`, "_blank");
    }
  };

  if (loading) return <Loading />;

  if (!hoaDon) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.notFoundWrap}>
          <div className={styles.notFoundCard}>
            <div className={styles.notFoundIcon}>
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M9 12h.01M15 12h.01M10 16l.01-.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h2>Không tìm thấy hóa đơn</h2>
            <p>Hóa đơn có thể chưa được tạo hoặc liên kết đã hết hạn.</p>
            <div className={styles.notFoundActions}>
              <button className={styles.btnSecondary} onClick={() => navigate(-1)}>
                <FiArrowLeft size={16} /> Quay lại
              </button>
              <button className={styles.btnPrimary} onClick={() => navigate("/thanh-toan")}>
                Danh sách hóa đơn
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const hd = hoaDon;
  const isCongNo = hd.loaiThanhToan === "cong_no";
  const tenKH = hd.khachHang || hd.tenKhachHang || "";
  const diaChi = hd.diaChiNhan || "";
  const macBeTong = hd.tenMacBeTong || "";
  const khoiLuong = hd.khoiLuongDat || hd.soTienThanhToan ? 0 : 0;
  const donGia = hd.donGia || 0;
  const thanhTien = hd.thanhTien || hd.tienBeTong || 0;
  const ptTT = hd.phuongThucThanhToan === "chuyen_khoan" ? "Chuyển khoản" : "Tiền mặt";

  // Tính tổng bê tông để hiển thị
  const tienBeTongHienThi = hd.tienBeTong > 0 ? hd.tienBeTong : thanhTien;
  const tongHienThi = hd.tongCong;

  return (
    <div className={styles.wrapper}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <button className={styles.backBtn} onClick={() => navigate(-1)}>
          <FiArrowLeft size={16} /> Quay lại
        </button>
        <div className={styles.toolbarActions}>
          <button className={styles.downloadBtn} onClick={handleDownload} title="Mở trang hóa đơn">
            <FiDownload size={16} /> Mở trang
          </button>
          <button className={styles.printBtn} onClick={handlePrint}>
            <FiPrinter size={16} /> In hóa đơn
          </button>
        </div>
      </div>

      {/* Invoice Print Area */}
      <div className={styles.printArea}>
        <div className={styles.invoice} ref={printRef} id="invoice-content">

          {/* ─── HEADER ─── */}
          <div className={styles.invHeader}>
            <div className={styles.invHeaderLeft}>
              <div className={styles.invLogo}>
                <img
                  src="https://betongtaydo.com/wp-content/uploads/2024/06/Logo-Be-Tong-Tay-Do-xanh-duong-1024x1024.png"
                  alt="Bê Tông Tây Đô"
                  className={styles.invLogoImg}
                />
              </div>
              <div className={styles.invCompanyInfo}>
                <div className={styles.invCompanyName}>CÔNG TY BÊ TÔNG TÂY ĐÔ</div>
                <div className={styles.invCompanyDetail}>Bê Tông Thương Phẩm & Xây Dựng</div>
                <div className={styles.invCompanyContact}>
                  ĐC: Ấp 7, Xã Nhơn Thạnh, TP. Cần Thơ | ĐT: 0292 3 789 789
                </div>
                <div className={styles.invCompanyContact}>
                  MST: 1801 567 890 | Email: betongtaydo@gmail.com
                </div>
              </div>
            </div>
            <div className={styles.invHeaderRight}>
              <div className={styles.invFormTitle}>HÓA ĐƠN GIÁ TRỊ GIA TĂNG</div>
              <div className={styles.invFormSub}>Mẫu số: 01GTKT3/001</div>
              <div className={styles.invFormSub}>Ký hiệu: BTTD/26P</div>
            </div>
          </div>

          {/* ─── TITLE ─── */}
          <div className={styles.invTitle}>
            <div className={styles.invTitleText}>HÓA ĐƠN BÁN HÀNG</div>
            <div className={styles.invTitleSub}>Invoice</div>
          </div>

          {/* ─── INVOICE INFO ─── */}
          <div className={styles.invInfoRow}>
            <div className={styles.invInfoBlock}>
              <table className={styles.invInfoTable}>
                <tbody>
                  <tr>
                    <td className={styles.invInfoLabel}>Số hóa đơn</td>
                    <td className={styles.invInfoValue}><strong>{hd.maHoaDon}</strong></td>
                  </tr>
                  <tr>
                    <td className={styles.invInfoLabel}>Ngày lập</td>
                    <td className={styles.invInfoValue}>{formatDate(hd.ngayLap)}</td>
                  </tr>
                  <tr>
                    <td className={styles.invInfoLabel}>Mã đơn hàng</td>
                    <td className={styles.invInfoValue}>{hd.maDonHang || hd.idDonHang}</td>
                  </tr>
                  <tr>
                    <td className={styles.invInfoLabel}>Hình thức TT</td>
                    <td className={styles.invInfoValue}>{ptTT}</td>
                  </tr>
                  {isCongNo && hd.hanTraCongNo && (
                    <tr>
                      <td className={styles.invInfoLabel}>Hạn thanh toán</td>
                      <td className={`${styles.invInfoValue} ${styles.invWarning}`}>{formatDate(hd.hanTraCongNo)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ─── PARTIES ─── */}
          <div className={styles.invParties}>
            <div className={styles.invPartyBlock}>
              <div className={styles.invPartyTitle}>ĐƠN VỊ BÁN HÀNG</div>
              <div className={styles.invPartyName}>CÔNG TY BÊ TÔNG TÂY ĐÔ</div>
              <div className={styles.invPartyDetail}>Địa chỉ: Ấp 7, Xã Nhơn Thạnh, TP. Cần Thơ</div>
              <div className={styles.invPartyDetail}>Điện thoại: 0292 3 789 789</div>
              <div className={styles.invPartyDetail}>MST: 1801 567 890</div>
            </div>
            <div className={styles.invPartyBlock}>
              <div className={styles.invPartyTitle}>ĐƠN VỊ MUA HÀNG</div>
              <div className={styles.invPartyName}>{tenKH || "—"}</div>
              <div className={styles.invPartyDetail}>Địa chỉ: {diaChi || "—"}</div>
              {hd.loaiXiMang && <div className={styles.invPartyDetail}>Loại xi măng: {hd.loaiXiMang}</div>}
            </div>
          </div>

          {/* ─── ORDER DETAILS ─── */}
          <div className={styles.invSection}>
            <div className={styles.invSectionTitle}>THÔNG TIN ĐƠN HÀNG</div>
            <div className={styles.invDetailGrid}>
              <div className={styles.invDetailItem}>
                <span className={styles.invDetailLabel}>Công trình</span>
                <span className={styles.invDetailValue}>{diaChi || "—"}</span>
              </div>
              <div className={styles.invDetailItem}>
                <span className={styles.invDetailLabel}>Mác bê tông</span>
                <span className={styles.invDetailValue}>{macBeTong || "—"}</span>
              </div>
              <div className={styles.invDetailItem}>
                <span className={styles.invDetailLabel}>Khối lượng</span>
                <span className={styles.invDetailValue}>{khoiLuong || 0} m³</span>
              </div>
              <div className={styles.invDetailItem}>
                <span className={styles.invDetailLabel}>Đơn giá</span>
                <span className={styles.invDetailValue}>{formatCurrency(donGia)} đ/m³</span>
              </div>
              <div className={styles.invDetailItem}>
                <span className={styles.invDetailLabel}>Giờ đổ</span>
                <span className={styles.invDetailValue}>{hd.gioDo ? formatDateTime(hd.gioDo) : "—"}</span>
              </div>
              {hd.kyThuatCongTrinh && (
                <div className={styles.invDetailItem}>
                  <span className={styles.invDetailLabel}>Kỹ thuật</span>
                  <span className={styles.invDetailValue}>{hd.kyThuatCongTrinh}</span>
                </div>
              )}
              {hd.bienSoXe && (
                <div className={styles.invDetailItem}>
                  <span className={styles.invDetailLabel}>Xe giao</span>
                  <span className={styles.invDetailValue}>{hd.bienSoXe} {hd.tenTaiXe ? `- ${hd.tenTaiXe}` : ""}</span>
                </div>
              )}
              {hd.tenTram && (
                <div className={styles.invDetailItem}>
                  <span className={styles.invDetailLabel}>Trạm trộn</span>
                  <span className={styles.invDetailValue}>{hd.tenTram}</span>
                </div>
              )}
            </div>
          </div>

          {/* ─── ITEMS TABLE ─── */}
          <div className={styles.invSection}>
            <table className={styles.invTable}>
              <thead>
                <tr>
                  <th className={styles.invTHNum}>STT</th>
                  <th className={styles.invTHContent}>Tên hàng hóa, dịch vụ</th>
                  <th className={styles.invTHUnit}>ĐVT</th>
                  <th className={styles.invTHQty}>Số lượng</th>
                  <th className={styles.invTHPrice}>Đơn giá</th>
                  <th className={styles.invTHTotal}>Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className={styles.invTDNum}>1</td>
                  <td className={styles.invTDContent}>
                    Bê tông thương phẩm mác {macBeTong || "—"}
                    {hd.loaiXiMang ? ` | Xi măng ${hd.loaiXiMang}` : ""}
                  </td>
                  <td className={styles.invTDUnit}>m³</td>
                  <td className={styles.invTDQty}>{khoiLuong || 0}</td>
                  <td className={styles.invTDPrice}>{formatCurrency(donGia)}</td>
                  <td className={styles.invTDTotal}>{formatCurrency(thanhTien)}</td>
                </tr>
                {hd.buuVanChuyen > 0 && (
                  <tr>
                    <td className={styles.invTDNum}>2</td>
                    <td className={styles.invTDContent}>Phí bù vận chuyển</td>
                    <td className={styles.invTDUnit}>—</td>
                    <td className={styles.invTDQty}>—</td>
                    <td className={styles.invTDPrice}>—</td>
                    <td className={styles.invTDTotal}>{formatCurrency(hd.buuVanChuyen)}</td>
                  </tr>
                )}
                {hd.phiPhatSinh > 0 && (
                  <tr>
                    <td className={styles.invTDNum}>{hd.buuVanChuyen > 0 ? "3" : "2"}</td>
                    <td className={styles.invTDContent}>Chi phí phát sinh</td>
                    <td className={styles.invTDUnit}>—</td>
                    <td className={styles.invTDQty}>—</td>
                    <td className={styles.invTDPrice}>—</td>
                    <td className={styles.invTDTotal}>{formatCurrency(hd.phiPhatSinh)}</td>
                  </tr>
                )}
                {hd.giamTru > 0 && (
                  <tr>
                    <td className={styles.invTDNum}>{hd.buuVanChuyen > 0 || hd.phiPhatSinh > 0 ? "4" : "2"}</td>
                    <td className={styles.invTDContent}>Giảm trừ / Khuyến mãi</td>
                    <td className={styles.invTDUnit}>—</td>
                    <td className={styles.invTDQty}>—</td>
                    <td className={styles.invTDPrice}>—</td>
                    <td className={`${styles.invTDTotal} ${styles.invTDMinus}`}>-{formatCurrency(hd.giamTru)}</td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className={styles.invTotalRow}>
                  <td colSpan={5} className={styles.invTotalLabel}>
                    TỔNG CỘNG (Tiền bê tông + Bù VC + Phát sinh - Giảm trừ)
                  </td>
                  <td className={styles.invTotalValue}>{formatCurrency(tongHienThi)}</td>
                </tr>
                <tr className={styles.invAmountWordRow}>
                  <td colSpan={5} className={styles.invAmountWordLabel}>
                    Số tiền bằng chữ
                  </td>
                  <td className={styles.invAmountWordValue}>
                    {numberToVietnamese(tongHienThi)}
                  </td>
                </tr>
                {hd.loaiThanhToan === "cong_no" && hd.soTienThanhToan > 0 && (
                  <>
                    <tr>
                      <td colSpan={5} className={styles.invTotalLabel}>Đã thanh toán trước</td>
                      <td className={`${styles.invTotalValue} ${styles.invTDMinus}`}>-{formatCurrency(hd.soTienThanhToan)}</td>
                    </tr>
                    <tr className={styles.invTotalRow}>
                      <td colSpan={5} className={styles.invTotalLabel}>CÒN LẠI PHẢI THANH TOÁN</td>
                      <td className={styles.invTotalValue}>{formatCurrency(Math.max(0, tongHienThi - hd.soTienThanhToan))}</td>
                    </tr>
                  </>
                )}
              </tfoot>
            </table>
          </div>

          {/* ─── PAYMENT STATUS ─── */}
          <div className={styles.invPaymentBanner}>
            <div className={`${styles.invPayBadge} ${isCongNo ? styles.invPayBadgeDebt : styles.invPayBadgePaid}`}>
              {isCongNo ? "⚠ CÔNG NỢ" : "✓ ĐÃ THANH TOÁN ĐỦ"}
            </div>
          </div>

          {/* ─── NOTES ─── */}
          {hd.ghiChu && (
            <div className={styles.invNoteSection}>
              <div className={styles.invNoteTitle}>GHI CHÚ</div>
              <div className={styles.invNoteText}>{hd.ghiChu}</div>
            </div>
          )}

          {/* ─── SIGNATURES ─── */}
          <div className={styles.invSignatures}>
            <div className={styles.invSigCol}>
              <div className={styles.invSigTitle}>NGƯỜI LẬP HÓA ĐƠN</div>
              <div className={styles.invSigNote}>(Ký, ghi rõ họ tên)</div>
              <div className={styles.invSigBlank}></div>
              <div className={styles.invSigName}></div>
            </div>
            <div className={styles.invSigCol}>
              <div className={styles.invSigTitle}>NGƯỜI NHẬN HÀNG</div>
              <div className={styles.invSigNote}>(Ký, ghi rõ họ tên)</div>
              <div className={styles.invSigBlank}></div>
              <div className={styles.invSigName}></div>
            </div>
            <div className={styles.invSigCol}>
              <div className={styles.invSigTitle}>THỦ TRƯỞNG ĐƠN VỊ</div>
              <div className={styles.invSigNote}>(Ký, ghi rõ họ tên, đóng dấu)</div>
              <div className={styles.invSigBlank}></div>
              <div className={styles.invSigName}></div>
            </div>
          </div>

          {/* ─── FOOTER ─── */}
          <div className={styles.invFooter}>
            <div className={styles.invFooterLine}></div>
            <p className={styles.invFooterText}>
              <strong>BÊ TÔNG TÂY ĐÔ</strong> — Chất lượng tạo niềm tin | Hotline: 0292 3 789 789
            </p>
            <p className={styles.invFooterSub}>Cảm ơn quý khách đã tin tưởng sử dụng sản phẩm và dịch vụ của chúng tôi!</p>
          </div>
        </div>
      </div>
    </div>
  );
}
