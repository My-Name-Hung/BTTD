import { useCallback, useEffect, useState } from "react";
import {
  FiAlertCircle,
  FiArrowLeft,
  FiCheck,
  FiClock,
  FiDollarSign,
  FiFileText,
  FiPackage,
  FiTruck,
  FiUser,
} from "react-icons/fi";
import { useNavigate, useParams } from "react-router-dom";
import { Loading } from "../../../shared/components/Common";
import { useToast } from "../../../shared/hooks";
import {
  layDonHang,
  layDonHangGiaoTrongNgay,
  layHoaDonTheoDonHang,
  layLichSanXuat,
  taoHoaDon,
} from "../../../shared/services/api";
import { DonHang, HoaDon, LichSanXuat } from "../../../shared/types";
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
  const [existingHoaDon, setExistingHoaDon] = useState<HoaDon | null>(null);
  const [khoiLuongNgay, setKhoiLuongNgay] = useState(0);
  const [soDonNgay, setSoDonNgay] = useState(0);
  const [isDonCuoiNgay, setIsDonCuoiNgay] = useState(false); // Đánh dấu có phải đơn cuối ngày không

  const [donGiaBuVC, setDonGiaBuVC] = useState("");
  const [donGiaBuVCDaSet, setDonGiaBuVCDaSet] = useState(false);
  const [soKhoiCanBu, setSoKhoiCanBu] = useState("");
  const [soKhoiCanBuDaSet, setSoKhoiCanBuDaSet] = useState(false);
  const [phiPhatSinh, setPhiPhatSinh] = useState("");
  const [giamTru, setGiamTru] = useState("");
  const [soTienThanhToanTruoc, setSoTienThanhToanTruoc] = useState("");
  const [ngayLap, setNgayLap] = useState(() =>
    formatDate(new Date().toISOString()),
  );
  const [khachHang, setKhachHang] = useState("");
  const [loaiXiMang, setLoaiXiMang] = useState("");
  const [gioDo, setGioDo] = useState("");
  const [phuongThuc, setPhuongThuc] = useState("tien_mat");
  const [ghiChu, setGhiChu] = useState("");
  const [hanTraCongNo, setHanTraCongNo] = useState("");

  // Thông tin nhân sự & xe – auto-fill từ lịch sản xuất
  const [kySu, setKySu] = useState("");
  const [vanHanhBom, setVanHanhBom] = useState("");
  const [lapOng, setLapOng] = useState("");
  const [xeTaiXe, setXeTaiXe] = useState("");

  const [soHoaDon] = useState(() => {
    const random = Math.floor(1000 + Math.random() * 9000);
    return `BBTD-${random}`;
  });

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [dh, ls, existingHDs] = await Promise.all([
        layDonHang(parseInt(id, 10)),
        layLichSanXuat(parseInt(id, 10)).catch(() => null),
        layHoaDonTheoDonHang(parseInt(id, 10)).catch(() => []),
      ]);
      setDonHang(dh);
      setLichSX(Array.isArray(ls) ? ls[0] : ls);
      setKhachHang(dh.tenKhachHang || "");

      // Lấy hóa đơn công nợ đã xuất trước đó (lọc theo loaiThanhToan = cong_no)
      const hoaDonCongNo = (Array.isArray(existingHDs) ? existingHDs : [])
        .filter((h: any) => h.loaiThanhToan === "cong_no")
        .sort(
          (a: any, b: any) =>
            new Date(b.ngayLap || 0).getTime() -
            new Date(a.ngayLap || 0).getTime(),
        );
      if (hoaDonCongNo.length > 0) {
        setExistingHoaDon(hoaDonCongNo[0]);
        setActiveTab("cong_no");
      }

      if (dh.ngayGiao) {
        try {
          const dsNgay = await layDonHangGiaoTrongNgay(dh.ngayGiao);
          // Lọc chỉ đơn cùng khách hàng
          const dsCungKhach = dsNgay.filter(
            (d: DonHang) => d.idKhachHang === dh.idKhachHang,
          );
          // Sort theo ngày tạo để xác định đơn cuối ngày
          const dsSorted = [...dsCungKhach].sort(
            (a: DonHang, b: DonHang) =>
              new Date(a.ngayTaoDon).getTime() -
              new Date(b.ngayTaoDon).getTime(),
          );
          // Tìm đơn cuối cùng trong ngày của khách này
          const lastOrder = dsSorted[dsSorted.length - 1];
          const isLast = lastOrder?.id === dh.id;
          setIsDonCuoiNgay(isLast);

          const tongKL = dsNgay.reduce(
            (sum: number, d: any) => sum + (d.khoiLuongDat || 0),
            0,
          );
          setKhoiLuongNgay(tongKL);
          setSoDonNgay(dsNgay.length);
        } catch {
          setKhoiLuongNgay(dh.khoiLuongDat || 0);
          setSoDonNgay(1);
          setIsDonCuoiNgay(true);
        }
      } else {
        setKhoiLuongNgay(dh.khoiLuongDat || 0);
        setSoDonNgay(1);
        setIsDonCuoiNgay(true);
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

  const donGiaBuVCSo = parseCurrency(donGiaBuVC) || MUC_GIA_BU_VC;
  const phiPhatSinhSo = parseCurrency(phiPhatSinh);
  const giamTruSo = parseCurrency(giamTru);
  const soTTTS = parseCurrency(soTienThanhToanTruoc);

  const khoiLuongDisplay = donHang?.khoiLuongDat || 0;
  const donGiaDisplay = donHang?.donGia || 0;
  const tienBeTong = khoiLuongDisplay * donGiaDisplay;

  // Số khối cần bù - MỖI ĐƠN đều có bù VC riêng
  // - Đơn cuối ngày: dùng tổng KL ngày (của tất cả đơn cùng khách) để tính bù
  // - Đơn trước đó: dùng KL của chính đơn đó để tính bù (riêng biệt)
  const soKhoiCanBuSo = parseFloat(soKhoiCanBu) || 0;

  // Với đơn cuối ngày: dùng khoiLuongNgay (tổng), đơn khác: dùng KL đơn đó
  const khoiLuongTinhBuVC = isDonCuoiNgay ? khoiLuongNgay : khoiLuongDisplay;
  const khoiBuVC = Math.max(0, NGƯỠNG_TOI_THIEU_M3 - khoiLuongTinhBuVC);

  // Tiền bù VC = Số khối cần bù × Đơn giá bù VC
  const tienBuVC = soKhoiCanBuSo * donGiaBuVCSo;

  // Nếu đã có hóa đơn công nợ trước đó → tổng tiền = số còn lại thực tế của đơn hàng
  // Đây là lần thanh toán phần còn lại, không tính lại từ đầu
  const isTraPhanConLai = !!existingHoaDon;
  const tongCong = isTraPhanConLai
    ? Math.max(0, (donHang?.conLai || 0) - soTTTS)
    : tienBeTong + tienBuVC + phiPhatSinhSo - giamTruSo;
  const soTienConLai = isTraPhanConLai
    ? Math.max(0, (donHang?.conLai || 0) - soTTTS)
    : Math.max(0, tongCong - soTTTS);

  // Auto-fill tiền thanh toán trước từ hóa đơn công nợ đã xuất
  useEffect(() => {
    if (!loading && existingHoaDon) {
      const daTT =
        existingHoaDon.soTienThanhToan || existingHoaDon.tongCong || 0;
      if (daTT > 0) {
        setSoTienThanhToanTruoc(formatNumberInput(daTT));
      }
    }
  }, [loading, existingHoaDon]);

  // Auto-fill số khối cần bù - MỖI ĐƠN đều được tính bù riêng
  useEffect(() => {
    if (!loading && khoiLuongTinhBuVC > 0 && !soKhoiCanBuDaSet) {
      setSoKhoiCanBu(khoiBuVC.toString());
    } else if (!loading && !soKhoiCanBuDaSet) {
      setSoKhoiCanBu("0");
    }
  }, [loading, khoiLuongTinhBuVC, khoiBuVC, soKhoiCanBuDaSet]);

  // Auto-fill đơn giá bù VC - dùng mặc định 110.000 nếu chưa chỉnh sửa
  useEffect(() => {
    if (!loading && !donGiaBuVCDaSet) {
      setDonGiaBuVC(formatNumberInput(MUC_GIA_BU_VC));
    }
  }, [loading, donGiaBuVCDaSet]);

  // Auto-fill thông tin nhân sự & xe từ lịch sản xuất
  useEffect(() => {
    if (!loading && lichSX) {
      const ls = Array.isArray(lichSX) ? lichSX[0] : lichSX;
      if (ls) {
        if (ls.kyThuatCongTrinh) setKySu(ls.kyThuatCongTrinh);
        if (ls.nguoiOmOng) setVanHanhBom(ls.nguoiOmOng);
        if (ls.nguoiBatOng) setLapOng(ls.nguoiBatOng);
        // Xe (biển số - tài xế)
        const bienSo = ls.bienSoXe || "";
        const taiXe = ls.tenTaiXe || "";
        if (bienSo) {
          setXeTaiXe(taiXe ? `${bienSo} – ${taiXe}` : bienSo);
        } else if (taiXe) {
          setXeTaiXe(taiXe);
        }
      }
    }
  }, [loading, lichSX]);

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
        buuVanChuyen: tienBuVC,
        phiPhatSinh: phiPhatSinhSo,
        giamTru: giamTruSo,
        ngayLap: ngayLap,
        khachHang,
        loaiXiMang,
        gioDo,
        phuongThucThanhToan: phuongThuc,
        ghiChu,
        hanTraCongNo: activeTab === "cong_no" ? hanTraCongNo : undefined,
      });

      showToast(
        activeTab === "tra_het"
          ? "Đã xác nhận trả hết và xuất hóa đơn"
          : "Đã ghi công nợ và xuất hóa đơn",
      );

      navigate(`/in-hoa-don/${hoaDon.id}`);
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
              Mã đơn: <strong>{donHang.maDonHang}</strong> ·{" "}
              {donHang.tenKhachHang}
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
              <span className={styles.summaryValue}>
                {donHang.tenMacBeTong}
              </span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Khối lượng đặt</span>
              <span className={styles.summaryValue}>{khoiLuongDisplay} m³</span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Đơn giá</span>
              <span className={styles.summaryValue}>
                {formatCurrency(donHang.donGia)}
              </span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Thành tiền</span>
              <span className={styles.summaryValue}>
                {formatCurrency(donHang.thanhTien || 0)}
              </span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Còn lại</span>
              <span
                className={styles.summaryValue}
                style={{ color: "var(--color-warning)" }}
              >
                {formatCurrency(donHang.conLai || 0)}
              </span>
            </div>
            {existingHoaDon && (
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>
                  Đã thanh toán (HĐ cũ)
                </span>
                <span
                  className={styles.summaryValue}
                  style={{ color: "var(--color-success)" }}
                >
                  {formatCurrency(existingHoaDon.soTienThanhToan || 0)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Tab bar - full width */}
        <div className={`${styles.tabBarWrap} ${styles.fullWidth}`}>
          <button
            className={`${styles.tabCard} ${activeTab === "tra_het" ? styles.tabCardActive : ""}`}
            onClick={() => setActiveTab("tra_het")}
          >
            <div className={styles.tabCardIcon}>
              <FiDollarSign size={24} />
            </div>
            <div className={styles.tabCardContent}>
              <div className={styles.tabCardTitle}>Trả hết</div>
              <div className={styles.tabCardDesc}>
                Thanh toán đầy đủ và xuất hóa đơn
              </div>
            </div>
            {activeTab === "tra_het" && (
              <div className={styles.tabCardCheck}>
                <FiCheck size={18} />
              </div>
            )}
          </button>
          <button
            className={`${styles.tabCard} ${activeTab === "cong_no" ? styles.tabCardActive : ""}`}
            onClick={() => setActiveTab("cong_no")}
          >
            <div className={styles.tabCardIcon}>
              <FiClock size={24} />
            </div>
            <div className={styles.tabCardContent}>
              <div className={styles.tabCardTitle}>Công nợ</div>
              <div className={styles.tabCardDesc}>
                Thanh toán trước một phần và ghi nợ
              </div>
            </div>
            {activeTab === "cong_no" && (
              <div className={styles.tabCardCheck}>
                <FiCheck size={18} />
              </div>
            )}
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
            <strong>Quy tắc tính bù vận chuyển:</strong>
            <br />• <strong>Đơn cuối ngày:</strong> Dùng{" "}
            <strong>Tổng KL ngày</strong> (tổng tất cả đơn cùng khách) để tính
            bù
            <br />• <strong>Đơn trước đó:</strong> Dùng{" "}
            <strong>KL đơn này</strong> để tính bù (riêng biệt)
            <br />• <strong>Công thức:</strong> Số khối bù ={" "}
            {NGƯỠNG_TOI_THIEU_M3} - KL tính bù
            <br />• <strong>Tiền bù VC</strong> = Số khối bù × Đơn giá bù VC (
            <strong>{formatCurrency(MUC_GIA_BU_VC)}/m³</strong>)
          </div>

          <div className={styles.buVcGrid}>
            <div className={styles.buVcCard}>
              <span className={styles.buVcLabel}>
                Tổng khối lượng trong ngày
              </span>
              <span className={styles.buVcValue}>{khoiLuongNgay} m³</span>
            </div>
            <div className={styles.buVcCard}>
              <span className={styles.buVcLabel}>Số đơn trong ngày</span>
              <span className={styles.buVcValue}>{soDonNgay} đơn</span>
            </div>
            <div className={styles.buVcCard}>
              <span className={styles.buVcLabel}>Số khối cần bù</span>
              <span
                className={`${styles.buVcValue} ${khoiBuVC > 0 ? styles.buVcWarning : styles.buVcZero}`}
              >
                {soKhoiCanBuSo} m³
              </span>
            </div>
            <div className={styles.buVcCard}>
              <span className={styles.buVcLabel}>Đơn giá bù VC</span>
              <span className={styles.buVcValue}>
                {formatCurrency(donGiaBuVCSo)}/m³
              </span>
            </div>
          </div>

          {/* Input editable cho Số khối cần bù */}
          <div className={styles.formRow}>
            <div className={styles.formGroup} style={{ flex: 1 }}>
              <label className={styles.formLabel}>Số khối cần bù (m³)</label>
              <input
                className={styles.formInput}
                type="number"
                value={soKhoiCanBu}
                onChange={(e) => {
                  setSoKhoiCanBuDaSet(true);
                  setSoKhoiCanBu(e.target.value);
                }}
                min="0"
                step="0.5"
                placeholder="0"
              />
              <span className={styles.formHint}>
                {isDonCuoiNgay
                  ? `Auto: ${NGƯỠNG_TOI_THIEU_M3} - ${khoiLuongNgay} = ${khoiBuVC} m³ (dùng tổng KL ngày)`
                  : `Auto: ${NGƯỠNG_TOI_THIEU_M3} - ${khoiLuongDisplay} = ${khoiBuVC} m³ (dùng KL đơn này)`}
              </span>
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup} style={{ flex: 1 }}>
              <label className={styles.formLabel}>Đơn giá bù VC (đ/m³)</label>
              <input
                className={styles.formInput}
                type="text"
                value={donGiaBuVC}
                onChange={(e) => {
                  setDonGiaBuVCDaSet(true);
                  setDonGiaBuVC(formatNumberInput(e.target.value));
                }}
                placeholder={formatNumberInput(MUC_GIA_BU_VC)}
              />
              <span className={styles.formHint}>
                Mặc định: {formatCurrency(MUC_GIA_BU_VC)}/m³ - Có thể điều chỉnh
              </span>
            </div>
            <div className={styles.formGroup} style={{ flex: 1 }}>
              <label className={styles.formLabel}>Tiền bù vận chuyển (đ)</label>
              <input
                className={`${styles.formInput} ${styles.inputReadOnly}`}
                type="text"
                value={formatNumberInput(tienBuVC)}
                readOnly
              />
              <span className={styles.formHint}>
                = {soKhoiCanBuSo} × {formatCurrency(donGiaBuVCSo)} = {formatCurrency(tienBuVC)}
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
                onChange={(e) =>
                  setPhiPhatSinh(formatNumberInput(e.target.value))
                }
                placeholder="0"
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>
                Giảm trừ / Khuyến mãi (đ)
              </label>
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
              <input
                className={styles.formInput}
                type="text"
                value={kySu}
                onChange={(e) => setKySu(e.target.value)}
                placeholder="Tên kỹ sư công trình"
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Vận hành bơm</label>
              <input
                className={styles.formInput}
                type="text"
                value={vanHanhBom}
                onChange={(e) => setVanHanhBom(e.target.value)}
                placeholder="Tên vận hành bơm"
              />
            </div>
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Lắp ống</label>
              <input
                className={styles.formInput}
                type="text"
                value={lapOng}
                onChange={(e) => setLapOng(e.target.value)}
                placeholder="Tên người lắp ống"
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Xe (Biển số – Tài xế)</label>
              <input
                className={styles.formInput}
                type="text"
                value={xeTaiXe}
                onChange={(e) => setXeTaiXe(e.target.value)}
                placeholder="VD: 59C1-12345 – Nguyễn Văn A"
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
              <input
                className={`${styles.formInput} ${styles.inputReadOnly}`}
                type="text"
                value={`${soHoaDon}-${donHang.maDonHang}`}
                readOnly
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Ngày lập hóa đơn</label>
              <input
                className={styles.formInput}
                type="date"
                value={ngayLap}
                onChange={(e) => setNgayLap(e.target.value)}
              />
            </div>
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Khách hàng</label>
              <input
                className={styles.formInput}
                type="text"
                value={khachHang}
                onChange={(e) => setKhachHang(e.target.value)}
                placeholder="Tên khách hàng"
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Loại xi măng</label>
              <input
                className={styles.formInput}
                type="text"
                value={loaiXiMang}
                onChange={(e) => setLoaiXiMang(e.target.value)}
                placeholder="VD: PCB40"
              />
            </div>
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Giờ đổ</label>
              <input
                className={styles.formInput}
                type="datetime-local"
                value={gioDo}
                onChange={(e) => setGioDo(e.target.value)}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Phương thức thanh toán</label>
              <select
                className={styles.formSelect}
                value={phuongThuc}
                onChange={(e) => setPhuongThuc(e.target.value)}
              >
                <option value="tien_mat">Tiền mặt</option>
                <option value="chuyen_khoan">Chuyển khoản</option>
              </select>
            </div>
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup} style={{ flex: 1 }}>
              <label className={styles.formLabel}>Ghi chú</label>
              <textarea
                className={styles.formTextarea}
                value={ghiChu}
                onChange={(e) => setGhiChu(e.target.value)}
                placeholder="Nhập ghi chú (nếu có)"
                rows={2}
              />
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
                <label className={styles.formLabel}>
                  Tiền thanh toán trước (đ)
                </label>
                <input
                  className={styles.formInput}
                  type="text"
                  value={soTienThanhToanTruoc}
                  onChange={(e) =>
                    setSoTienThanhToanTruoc(formatNumberInput(e.target.value))
                  }
                  placeholder="0"
                />
                <span className={styles.formHint}>
                  Nhập số tiền khách thanh toán trước (auto phân cách phần
                  nghìn)
                </span>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Hạn thanh toán</label>
                <input
                  className={styles.formInput}
                  type="date"
                  value={hanTraCongNo}
                  onChange={(e) => setHanTraCongNo(e.target.value)}
                />
              </div>
            </div>
            {soTTTS > 0 && (
              <div className={styles.conLaiBox}>
                <span className={styles.conLaiLabel}>
                  Số tiền còn lại cần thanh toán:
                </span>
                <span className={styles.conLaiValue}>
                  {formatCurrency(soTienConLai)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Tổng hợp */}
        <div
          className={`${styles.section} ${styles.sectionTotal} ${styles.fullWidth}`}
        >
          <div className={styles.sectionHeader}>
            <FiPackage size={18} />
            <h3>Tổng hợp</h3>
          </div>
          <div className={styles.totalRows}>
            {/* Khi thanh toán phần 2 công nợ: chỉ hiện số còn lại, không hiện chi tiết (đã nằm trong HĐ trước) */}
            {!isTraPhanConLai && (
              <>
                <div className={styles.totalRow}>
                  <span>Tiền bê tông</span>
                  <span>{formatCurrency(tienBeTong)}</span>
                </div>
                {tienBuVC > 0 && (
                  <div className={styles.totalRow}>
                    <span>Bù vận chuyển</span>
                    <span>{formatCurrency(tienBuVC)}</span>
                  </div>
                )}
                {phiPhatSinhSo > 0 && (
                  <div className={styles.totalRow}>
                    <span>Chi phí phát sinh</span>
                    <span>+ {formatCurrency(phiPhatSinhSo)}</span>
                  </div>
                )}
                {giamTruSo > 0 && (
                  <div className={styles.totalRow}>
                    <span>Giảm trừ / Khuyến mãi</span>
                    <span style={{ color: "var(--color-success)" }}>
                      - {formatCurrency(giamTruSo)}
                    </span>
                  </div>
                )}
                {tienBuVC === 0 && phiPhatSinhSo === 0 && giamTruSo === 0 && (
                  <div className={styles.totalRowNote}>
                    <span>Không có chi phí bù VC, phát sinh hay giảm trừ</span>
                  </div>
                )}
              </>
            )}
            {isTraPhanConLai && (
              <div className={styles.totalRow}>
                <span>Còn lại (đơn hàng)</span>
                <span>{formatCurrency(donHang?.conLai || 0)}</span>
              </div>
            )}
            {soTTTS > 0 && (
              <div className={styles.totalRow}>
                <span>Đã thanh toán trước</span>
                <span style={{ color: "var(--color-success)" }}>
                  - {formatCurrency(soTTTS)}
                </span>
              </div>
            )}
            <div className={`${styles.totalRow} ${styles.totalRowBold}`}>
              <span>
                {isTraPhanConLai
                  ? "CẦN THANH TOÁN PHẦN CÒN LẠI"
                  : activeTab === "cong_no" && soTTTS > 0
                    ? "CÒN LẠI CẦN THANH TOÁN"
                    : "TỔNG CỘNG"}
              </span>
              <span>{formatCurrency(tongCong)}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className={`${styles.actionsWrap} ${styles.fullWidth}`}>
          <div className={styles.actions}>
            <button
              className={styles.btnCancel}
              onClick={() => navigate(-1)}
              disabled={submitting}
            >
              Hủy
            </button>
            <button
              className={styles.btnSubmit}
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <Loading text="Đang xử lý..." />
              ) : (
                <>
                  <FiCheck size={16} />
                  {activeTab === "tra_het"
                    ? "Xác nhận trả hết & xuất hóa đơn"
                    : "Ghi công nợ & xuất hóa đơn"}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
