import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  FiArrowLeft,
  FiPrinter,
  FiDownload,
  FiCheck,
  FiAlertCircle,
  FiTruck,
  FiUser,
  FiFileText,
  FiDollarSign,
  FiClock,
  FiPackage,
} from "react-icons/fi";
import { Loading } from "../components/Common";
import { useToast } from "../hooks";
import {
  layDonHang,
  layLichSanXuat,
  taoHoaDon,
  taiHoaDonDoc,
  layDonHangGiaoTrongNgay,
} from "../services/api";
import { DonHang, LichSanXuat } from "../types";
import styles from "./XuatHoaDonPage.module.css";

type TabType = "tra_het" | "cong_no";

function formatCurrency(v: number): string {
  return v?.toLocaleString("vi-VN") + " đ" || "0 đ";
}

function parseCurrency(str: string): number {
  return parseInt(str.replace(/[^\d]/g, ""), 10) || 0;
}

function formatNumberInput(value: number | string): string {
  if (!value && value !== 0) return "";
  const num = typeof value === "string" ? parseCurrency(value) : value;
  return num.toLocaleString("vi-VN");
}

function formatDate(d: string | null | undefined): string {
  if (!d) return "";
  const dt = new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const MUC_GIA_BU_VC = 110000;
const NGƯỠNG_TOI_THIEU_M3 = 5;

export default function XuatHoaDonPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("tra_het");
  const [donHang, setDonHang] = useState<DonHang | null>(null);
  const [lichSX, setLichSX] = useState<LichSanXuat | null>(null);
  const [khoiLuongNgay, setKhoiLuongNgay] = useState(0);
  const [soDonNgay, setSoDonNgay] = useState(0);

  const [buVanChuyen, setBuVanChuyen] = useState("");
  const [phiPhatSinh, setPhiPhatSinh] = useState("");
  const [giamTru, setGiamTru] = useState("");
  const [soTienThanhToanTruoc, setSoTienThanhToanTruoc] = useState("");
  const [ngayLap, setNgayLap] = useState(() => formatDate(new Date().toISOString()));
  const [khachHang, setKhachHang] = useState("");
  const [loaiXiMang, setLoaiXiMang] = useState("");
  const [gioDo, setGioDo] = useState("");
  const [phuongThuc, setPhuongThuc] = useState("tien_mat");
  const [ghiChu, setGhiChu] = useState("");
  const [hanTraCongNo, setHanTraCongNo] = useState("");

  const [soHoaDon] = useState(() => {
    const random = Math.floor(1000 + Math.random() * 9000);
    return `BBTD-${random}`;
  });

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [dh, ls] = await Promise.all([
        layDonHang(parseInt(id, 10)),
        layLichSanXuat(parseInt(id, 10)).catch(() => null),
      ]);
      setDonHang(dh);
      setLichSX(ls);
      setKhachHang(dh.tenKhachHang || "");

      if (dh.ngayGiao) {
        try {
          const dsNgay = await layDonHangGiaoTrongNgay(dh.ngayGiao);
          const tongKL = dsNgay.reduce((sum: number, d: any) => sum + (d.khoiLuongDat || 0), 0);
          setKhoiLuongNgay(tongKL);
          setSoDonNgay(dsNgay.length);
        } catch {
          setKhoiLuongNgay(dh.khoiLuongDat || 0);
          setSoDonNgay(1);
        }
      } else {
        setKhoiLuongNgay(dh.khoiLuongDat || 0);
        setSoDonNgay(1);
      }
    } catch (err) {
      showToast("Không tải được thông tin đơn hàng", "error");
    } finally {
      setLoading(false);
    }
  }, [id, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const buVanChuyenSo = parseCurrency(buVanChuyen);
  const phiPhatSinhSo = parseCurrency(phiPhatSinh);
  const giamTruSo = parseCurrency(giamTru);
  const soTTTS = parseCurrency(soTienThanhToanTruoc);

  const khoiLuongDisplay = donHang?.khoiLuongDat || 0;
  const donGiaDisplay = donHang?.donGia || 0;
  const tienBeTong = khoiLuongDisplay * donGiaDisplay;
  const tongCong = tienBeTong + buVanChuyenSo + phiPhatSinhSo - giamTruSo;
  const soTienConLai = Math.max(0, tongCong - soTTTS);

  const handleSubmit = async () => {
    if (!donHang) return;
    if (activeTab === "cong_no" && !hanTraCongNo) {
      showToast("Vui lòng nhập hạn trả công nợ", "error");
      return;
    }
    setSubmitting(true);
    try {
      const hoaDon = await taoHoaDon({
        idDonHang: donHang.id,
        loaiThanhToan: activeTab,
        buuVanChuyen: buVanChuyenSo,
        phiPhatSinh: phiPhatSinhSo,
        giamTru: giamTruSo,
        ngayLap: ngayLap,
        khachHang,
        loaiXiMang,
        gioDo,
        phuongThucThanhToan: phuongThuc,
        ghiChu,
        hanTraCongNo: activeTab === "cong_no" ? hanTraCongNo : undefined,
        soTienThanhToan: tongCong,
      });

      window.open(`/in-hoa-don/${hoaDon.id}`, "_blank");
      await taiHoaDonDoc(hoaDon.id);

      showToast(
        activeTab === "tra_het"
          ? "Đã xác nhận trả hết và xuất hóa đơn"
          : "Đã ghi công nợ và xuất hóa đơn",
      );

      navigate("/thanh-toan");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Lỗi tạo hóa đơn",
        "error",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Loading />;

  if (!donHang) {
    return (
      <div className={styles.pageWrapper}>
        <div className={styles.notFound}>
          <FiAlertCircle size={48} />
          <p>Không tìm thấy đơn hàng</p>
          <button onClick={() => navigate(-1)}>Quay lại</button>
        </div>
      </div>
    );
  }

  const khoiBuVC = Math.max(0, NGƯỠNG_TOI_THIEU_M3 - khoiLuongNgay);
  const tienBuVCAuto = khoiBuVC * MUC_GIA_BU_VC;

  return (
    <div className={styles.pageWrapper}>
      {/* Header bar */}
      <div className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <button className={styles.backBtn} onClick={() => navigate(-1)}>
            <FiArrowLeft size={18} />
          </button>
          <div>
            <div className={styles.pageTitle}>Xuất hóa đơn</div>
            <div className={styles.pageSubtitle}>
              Mã đơn: <strong>{donHang.maDonHang}</strong> · {donHang.tenKhachHang}
            </div>
          </div>
        </div>
        <div className={styles.headerBadge}>
          <FiFileText size={16} />
          {activeTab === "tra_het" ? "Trả hết" : "Công nợ"}
        </div>
      </div>

      <div className={styles.formBody}>
        {/* Order Summary - full width */}
        <div className={`${styles.section} ${styles.fullWidth}`}>
          <div className={styles.summaryGrid}>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Mác bê tông</span>
              <span className={styles.summaryValue}>{donHang.tenMacBeTong}</span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Khối lượng đặt</span>
              <span className={styles.summaryValue}>{khoiLuongDisplay} m³</span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Đơn giá</span>
              <span className={styles.summaryValue}>{formatCurrency(donHang.donGia)}</span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Thành tiền</span>
              <span className={styles.summaryValue}>{formatCurrency(donHang.thanhTien)}</span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Còn lại</span>
              <span className={styles.summaryValue} style={{ color: "var(--color-warning)" }}>
                {formatCurrency(donHang.conLai || 0)}
              </span>
            </div>
          </div>
        </div>

        {/* Tab cards - full width */}
        <div className={`${styles.tabCardWrap} ${styles.fullWidth}`}>
          <button
            className={`${styles.tabCard} ${activeTab === "tra_het" ? styles.tabCardActive : ""}`}
            onClick={() => setActiveTab("tra_het")}
          >
            <div className={styles.tabCardIcon}>
              <FiDollarSign size={28} />
            </div>
            <div className={styles.tabCardContent}>
              <div className={styles.tabCardTitle}>Trả hết</div>
              <div className={styles.tabCardDesc}>Thanh toán toàn bộ số tiền còn lại của đơn hàng</div>
            </div>
            <div className={styles.tabCardCheck}>
              {activeTab === "tra_het" && (
                <div className={styles.tabCardCheckInner}>
                  <FiCheck size={16} />
                </div>
              )}
            </div>
          </button>
          <button
            className={`${styles.tabCard} ${activeTab === "cong_no" ? styles.tabCardActive : ""}`}
            onClick={() => setActiveTab("cong_no")}
          >
            <div className={styles.tabCardIcon}>
              <FiClock size={28} />
            </div>
            <div className={styles.tabCardContent}>
              <div className={styles.tabCardTitle}>Công nợ</div>
              <div className={styles.tabCardDesc}>Ghi nhận công nợ, thanh toán trước một phần hoặc ghi hạn trả</div>
            </div>
            <div className={styles.tabCardCheck}>
              {activeTab === "cong_no" && (
                <div className={styles.tabCardCheckInner}>
                  <FiCheck size={16} />
                </div>
              )}
            </div>
          </button>
        </div>

        {/* ====== LEFT COLUMN ====== */}
        {/* Bù vận chuyển */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <FiTruck size={18} />
            <h3>Bù vận chuyển</h3>
          </div>
          <div className={styles.sectionHint}>
            <strong>Quy tắc tính bù vận chuyển:</strong><br />
            • Đơn hàng có khối lượng giao trong ngày dưới <strong>{NGƯỠNG_TOI_THIEU_M3}m³</strong> sẽ tính bù vận chuyển<br />
            • <strong>Công thức:</strong> Số khối bù = {NGƯỠNG_TOI_THIEU_M3} - Tổng khối lượng giao trong ngày<br />
            • <strong>Tiền bù VC</strong> = Số khối bù × Đơn giá bù VC (<strong>{formatCurrency(MUC_GIA_BU_VC)}/m³</strong>)<br />
            • <strong>Ví dụ:</strong> Giao {khoiLuongNgay} m³ → Bù {khoiBuVC} m³ → Tiền bù = {khoiBuVC} × {formatCurrency(MUC_GIA_BU_VC)} = <strong>{formatCurrency(tienBuVCAuto)}</strong>
          </div>

          <div className={styles.buVcGrid}>
            <div className={styles.buVcCard}>
              <span className={styles.buVcLabel}>Tổng khối lượng trong ngày</span>
              <span className={styles.buVcValue}>{khoiLuongNgay} m³</span>
            </div>
            <div className={styles.buVcCard}>
              <span className={styles.buVcLabel}>Số đơn trong ngày</span>
              <span className={styles.buVcValue}>{soDonNgay} đơn</span>
            </div>
            <div className={styles.buVcCard}>
              <span className={styles.buVcLabel}>Số khối cần bù</span>
              <span className={`${styles.buVcValue} ${khoiLuongNgay < NGƯỠNG_TOI_THIEU_M3 ? styles.buVcWarning : styles.buVcOk}`}>
                {khoiBuVC} m³
              </span>
            </div>
            <div className={styles.buVcCard}>
              <span className={styles.buVcLabel}>Đơn giá bù VC</span>
              <span className={styles.buVcValue}>{formatCurrency(MUC_GIA_BU_VC)}/m³</span>
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup} style={{ flex: 1 }}>
              <label className={styles.formLabel}>Tiền bù vận chuyển (đ)</label>
              <input
                className={styles.formInput}
                type="text"
                value={buVanChuyen}
                onChange={(e) => setBuVanChuyen(formatNumberInput(e.target.value))}
                placeholder="0"
              />
              <span className={styles.formHint}>
                Auto: {khoiBuVC} × {formatCurrency(MUC_GIA_BU_VC)} = {formatCurrency(tienBuVCAuto)}
              </span>
            </div>
          </div>
        </div>

        {/* Chi phí phát sinh & Khuyến mãi */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <FiDollarSign size={18} />
            <h3>Chi phí phát sinh &amp; Khuyến mãi</h3>
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Chi phí phát sinh (đ)</label>
              <input
                className={styles.formInput}
                type="text"
                value={phiPhatSinh}
                onChange={(e) => setPhiPhatSinh(formatNumberInput(e.target.value))}
                placeholder="0"
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Giảm trừ / Khuyến mãi (đ)</label>
              <input
                className={styles.formInput}
                type="text"
                value={giamTru}
                onChange={(e) => setGiamTru(formatNumberInput(e.target.value))}
                placeholder="0"
              />
            </div>
          </div>
        </div>

        {/* ====== RIGHT COLUMN ====== */}
        {/* Thông tin nhân sự & xe */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <FiUser size={18} />
            <h3>Thông tin nhân sự &amp; xe</h3>
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Kỹ sư</label>
              <input className={styles.formInput} type="text" defaultValue={lichSX?.kyThuatCongTrinh || ""} placeholder="Tên kỹ sư" />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Vận hành bơm</label>
              <input className={styles.formInput} type="text" defaultValue={lichSX?.nguoiOmOng || ""} placeholder="Tên vận hành bơm" />
            </div>
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Lắp ống</label>
              <input className={styles.formInput} type="text" defaultValue={lichSX?.nguoiBatOng || ""} placeholder="Tên người lắp ống" />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Xe (Biển số - Tài xế)</label>
              <input
                className={styles.formInput}
                type="text"
                defaultValue={
                  lichSX?.bienSoXe
                    ? `${lichSX.bienSoXe} ${(lichSX as any).tenTaiXe ? "- " + (lichSX as any).tenTaiXe : ""}`
                    : ""
                }
                placeholder="VD: 59C1-12345 - Nguyễn Văn A"
              />
            </div>
          </div>
        </div>

        {/* Thông tin hóa đơn */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <FiFileText size={18} />
            <h3>Thông tin hóa đơn</h3>
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Số hóa đơn</label>
              <input className={`${styles.formInput} ${styles.inputReadOnly}`} type="text" value={`${soHoaDon}-${donHang.maDonHang}`} readOnly />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Ngày lập hóa đơn</label>
              <input className={styles.formInput} type="date" value={ngayLap} onChange={(e) => setNgayLap(e.target.value)} />
            </div>
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Khách hàng</label>
              <input className={styles.formInput} type="text" value={khachHang} onChange={(e) => setKhachHang(e.target.value)} placeholder="Tên khách hàng" />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Loại xi măng</label>
              <input className={styles.formInput} type="text" value={loaiXiMang} onChange={(e) => setLoaiXiMang(e.target.value)} placeholder="VD: PCB40" />
            </div>
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Giờ đổ</label>
              <input className={styles.formInput} type="datetime-local" value={gioDo} onChange={(e) => setGioDo(e.target.value)} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Phương thức thanh toán</label>
              <select className={styles.formSelect} value={phuongThuc} onChange={(e) => setPhuongThuc(e.target.value)}>
                <option value="tien_mat">Tiền mặt</option>
                <option value="chuyen_khoan">Chuyển khoản</option>
              </select>
            </div>
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup} style={{ flex: 1 }}>
              <label className={styles.formLabel}>Ghi chú</label>
              <textarea className={styles.formTextarea} value={ghiChu} onChange={(e) => setGhiChu(e.target.value)} placeholder="Nhập ghi chú (nếu có)" rows={2} />
            </div>
          </div>
        </div>

        {/* ====== FULL WIDTH SECTIONS ====== */}
        {/* Thông tin công nợ */}
        {activeTab === "cong_no" && (
          <div className={`${styles.section} ${styles.fullWidth}`}>
            <div className={styles.sectionHeader}>
              <FiClock size={18} />
              <h3>Thông tin công nợ</h3>
            </div>
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Tiền thanh toán trước (đ)</label>
                <input
                  className={styles.formInput}
                  type="text"
                  value={soTienThanhToanTruoc}
                  onChange={(e) => setSoTienThanhToanTruoc(formatNumberInput(e.target.value))}
                  placeholder="0"
                />
                <span className={styles.formHint}>Nhập số tiền khách thanh toán trước (auto phân cách phần nghìn)</span>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Hạn thanh toán</label>
                <input className={styles.formInput} type="date" value={hanTraCongNo} onChange={(e) => setHanTraCongNo(e.target.value)} />
              </div>
            </div>
            {soTTTS > 0 && (
              <div className={styles.conLaiBox}>
                <span className={styles.conLaiLabel}>Số tiền còn lại cần thanh toán:</span>
                <span className={styles.conLaiValue}>{formatCurrency(soTienConLai)}</span>
              </div>
            )}
          </div>
        )}

        {/* Tổng hợp */}
        <div className={`${styles.section} ${styles.sectionTotal} ${styles.fullWidth}`}>
          <div className={styles.sectionHeader}>
            <FiPackage size={18} />
            <h3>Tổng hợp</h3>
          </div>
          <div className={styles.totalRows}>
            <div className={styles.totalRow}>
              <span>Tiền bê tông</span>
              <span>{formatCurrency(tienBeTong)}</span>
            </div>
            <div className={styles.totalRow}>
              <span>Bù vận chuyển</span>
              <span>{formatCurrency(buVanChuyenSo)}</span>
            </div>
            {phiPhatSinhSo > 0 && (
              <div className={styles.totalRow}>
                <span>Chi phí phát sinh</span>
                <span>+ {formatCurrency(phiPhatSinhSo)}</span>
              </div>
            )}
            {giamTruSo > 0 && (
              <div className={styles.totalRow}>
                <span>Giảm trừ / Khuyến mãi</span>
                <span style={{ color: "var(--color-success)" }}>- {formatCurrency(giamTruSo)}</span>
              </div>
            )}
            {soTTTS > 0 && (
              <div className={styles.totalRow}>
                <span>Đã thanh toán trước</span>
                <span style={{ color: "var(--color-success)" }}>- {formatCurrency(soTTTS)}</span>
              </div>
            )}
            <div className={`${styles.totalRow} ${styles.totalRowBold}`}>
              <span>{activeTab === "cong_no" && soTTTS > 0 ? "CÒN LẠI CẦN THANH TOÁN" : "TỔNG CỘNG"}</span>
              <span>{formatCurrency(activeTab === "cong_no" ? soTienConLai : Math.max(0, tongCong))}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className={`${styles.actionsWrap} ${styles.fullWidth}`}>
          <div className={styles.actions}>
            <button className={styles.btnCancel} onClick={() => navigate(-1)} disabled={submitting}>
              Hủy
            </button>
            <button className={styles.btnSubmit} onClick={handleSubmit} disabled={submitting}>
              {submitting ? (
                <Loading small />
              ) : (
                <>
                  <FiCheck size={16} />
                  {activeTab === "tra_het" ? "Xác nhận trả hết & xuất hóa đơn" : "Ghi công nợ & xuất hóa đơn"}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
