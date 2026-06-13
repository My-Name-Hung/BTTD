import { useCallback, useEffect, useState } from "react";
import {
  FiAlertCircle,
  FiArrowLeft,
  FiCheck,
  FiClock,
  FiDollarSign,
  FiFileText,
  FiPrinter,
  FiUser,
  FiTruck,
} from "react-icons/fi";
import { useNavigate, useParams } from "react-router-dom";
import { Loading } from "../../../shared/components/Common";
import { useToast } from "../../../shared/hooks";
import {
  layDonHang,
  layLichSanXuat,
  layHoaDonTheoDonHang,
  taoHoaDon,
} from "../../../shared/services/api";
import { DonHang, HoaDon, LichSanXuat } from "../../../shared/types";
import styles from "./XuatHoaDonPage.module.css";

type HinhThucThanhToan = "tra_het" | "cong_no";

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

function sortHoaDonsByTime(items: HoaDon[]) {
  return [...items].sort((a, b) => {
    const aTime = new Date(a.ngayLap || a.createdAt || 0).getTime();
    const bTime = new Date(b.ngayLap || b.createdAt || 0).getTime();
    if (aTime !== bTime) return aTime - bTime;
    return a.id - b.id;
  });
}

const LOAI_HINH_THUC: { value: HinhThucThanhToan; label: string; desc: string }[] = [
  { value: "tra_het", label: "Trả hết", desc: "Thanh toán đầy đủ 1 lần" },
  { value: "cong_no", label: "Công nợ", desc: "Thanh toán trước một phần, còn lại ghi nợ" },
];

export default function XuatHoaDonPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [hinhThuc, setHinhThuc] = useState<HinhThucThanhToan>("tra_het");
  const [donHang, setDonHang] = useState<DonHang | null>(null);
  const [lichSX, setLichSX] = useState<LichSanXuat | null>(null);
  const [allHoaDons, setAllHoaDons] = useState<HoaDon[]>([]);
  const existingCongNoHD = sortHoaDonsByTime(
    allHoaDons.filter(
      (h) => h.loaiThanhToan === "cong_no" || h.loaiThanhToan === "cong_no_du",
    ),
  );

  // Tổng tiền gốc đơn hàng
  const tongTienGoc = donHang ? (donHang.thanhTien || 0) : 0;

  // ── Form fields (tất cả nhập thủ công) ──
  const [ngayLap, setNgayLap] = useState(() =>
    formatDate(new Date().toISOString()),
  );
  const [khachHang, setKhachHang] = useState("");
  const [diaChiNhan, setDiaChiNhan] = useState("");
  const [hangMuc, setHangMuc] = useState("");
  const [phuongPhapDo, setPhuongPhapDo] = useState("");
  const [chieuDaiPhuongPhap, setChieuDaiPhuongPhap] = useState("");
  const [loaiXiMang, setLoaiXiMang] = useState("");
  const [gioDo, setGioDo] = useState("");
  const [phuongThuc, setPhuongThuc] = useState("tien_mat");
  const [ghiChu, setGhiChu] = useState("");

  // Tiền bê tông (auto từ đơn hàng, readonly)
  const [tienBeTong, setTienBeTong] = useState(0);
  // Bù vận chuyển (nhập thủ công)
  const [buuVanChuyen, setBuuVanChuyen] = useState("");
  // Chi phí phát sinh (nhập thủ công)
  const [phiPhatSinh, setPhiPhatSinh] = useState("");
  // Giảm trừ (nhập thủ công)
  const [giamTru, setGiamTru] = useState("");
  // Tổng cộng (tính = tienBeTong + buuVanChuyen + phiPhatSinh - giamTru)
  const [tongCong, setTongCong] = useState(0);

  // Trả hết
  const [soTienTra, setSoTienTra] = useState("");
  const [soTienDu, setSoTienDu] = useState("");

  // Công nợ
  const [soTienTraTruoc, setSoTienTraTruoc] = useState("");
  const [hanTraCongNo, setHanTraCongNo] = useState("");
  const [soTienNoConLai, setSoTienNoConLai] = useState("");

  // Nhân sự & xe
  const [kySu, setKySu] = useState("");
  const [vanHanhBom, setVanHanhBom] = useState("");
  const [lapOng, setLapOng] = useState("");
  const [xeTaiXe, setXeTaiXe] = useState("");

  // Số hóa đơn
  const [soHoaDon] = useState(() => {
    const random = Math.floor(1000 + Math.random() * 9000);
    return `BBTD-${random}`;
  });

  // Tính tổng cộng mỗi khi các trường thay đổi
  useEffect(() => {
    const bv = parseCurrency(buuVanChuyen);
    const pp = parseCurrency(phiPhatSinh);
    const gt = parseCurrency(giamTru);
    setTongCong(Math.max(0, tienBeTong + bv + pp - gt));
  }, [buuVanChuyen, phiPhatSinh, giamTru, tienBeTong]);

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
      setAllHoaDons(Array.isArray(existingHDs) ? existingHDs : []);

      // Pre-fill thông tin cơ bản
      setKhachHang(dh.tenKhachHang || "");
      setDiaChiNhan(dh.diaChiNhan || "");
      setHangMuc(dh.hangMuc || "");
      setTienBeTong(dh.thanhTien || 0);

      // Phương pháp đổ
      if (dh.phuongPhapDo === "do_xa") {
        setPhuongPhapDo("do_xa");
        setChieuDaiPhuongPhap(dh.chieuDaiNoi ? String(dh.chieuDaiNoi) : "");
      } else if (dh.phuongPhapDo === "do_bom") {
        setPhuongPhapDo("do_bom");
        setChieuDaiPhuongPhap(dh.chieuDaiBom ? String(dh.chieuDaiBom) : "");
      }

      // Auto-fill từ lịch sản xuất
      if (ls) {
        const lsData = Array.isArray(ls) ? ls[0] : ls;
        if (lsData) {
          if (lsData.kyThuatCongTrinh) setKySu(lsData.kyThuatCongTrinh);
          if (lsData.nguoiOmOng) setVanHanhBom(lsData.nguoiOmOng);
          if (lsData.nguoiBatOng) setLapOng(lsData.nguoiBatOng);
          const bienSo = lsData.bienSoXe || "";
          const taiXe = lsData.tenTaiXe || "";
          if (bienSo) {
            setXeTaiXe(taiXe ? `${bienSo} – ${taiXe}` : bienSo);
          } else if (taiXe) {
            setXeTaiXe(taiXe);
          }
          // Giờ đổ
          if (lsData.thoiGianBatDauDo) {
            const dt = new Date(lsData.thoiGianBatDauDo);
            const y = dt.getFullYear();
            const m = String(dt.getMonth() + 1).padStart(2, "0");
            const day = String(dt.getDate()).padStart(2, "0");
            const h = String(dt.getHours()).padStart(2, "0");
            const min = String(dt.getMinutes()).padStart(2, "0");
            setGioDo(`${y}-${m}-${day}T${h}:${min}`);
          }
        }
      }

      // Nếu đã có hóa đơn công nợ -> auto chọn công nợ
      if (existingCongNoHD.length > 0) {
        setHinhThuc("cong_no");
      }
    } catch {
      showToast("Không tải được thông tin đơn hàng", "error");
    } finally {
      setLoading(false);
    }
  }, [id, showToast, tienBeTong]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSubmit = async () => {
    if (!donHang) return;

    // Validate
    if (hinhThuc === "cong_no" && !hanTraCongNo) {
      showToast("Vui lòng nhập hạn thanh toán công nợ", "error");
      return;
    }

    const soTienTraNum = parseCurrency(soTienTra);
    const soTienDuNum = parseCurrency(soTienDu);
    const soTienTraTruocNum = parseCurrency(soTienTraTruoc);
    const bvNum = parseCurrency(buuVanChuyen);
    const ppNum = parseCurrency(phiPhatSinh);
    const gtNum = parseCurrency(giamTru);
    const noConLaiNum = parseCurrency(soTienNoConLai);

    setSubmitting(true);
    try {
      const loaiTT: "tra_het" | "tra_het_du" | "cong_no" | "cong_no_du" =
        hinhThuc === "tra_het"
          ? soTienDuNum > 0
            ? "tra_het_du"
            : "tra_het"
          : soTienDuNum > 0
            ? "cong_no_du"
            : "cong_no";

      const hoaDon = await taoHoaDon({
        idDonHang: donHang.id,
        loaiThanhToan: loaiTT,
        buuVanChuyen: bvNum,
        phiPhatSinh: ppNum,
        giamTru: gtNum,
        ngayLap: ngayLap,
        khachHang,
        loaiXiMang,
        gioDo,
        phuongThucThanhToan: phuongThuc,
        ghiChu,
        hanTraCongNo: hinhThuc === "cong_no" ? hanTraCongNo : undefined,
        soTienThanhToanTruoc:
          hinhThuc === "cong_no" ? soTienTraTruocNum : soTienTraNum,
        soTienDu: soTienDuNum,
        soTienDuSuDung: 0,
      });

      showToast(
        hinhThuc === "tra_het"
          ? "Đã xác nhận thanh toán và xuất hóa đơn"
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

  // Thông tin hạng mục/phương pháp đổ
  const phuongPhapDoLabel =
    phuongPhapDo === "do_xa"
      ? `Đổ xã${chieuDaiPhuongPhap ? ` (${chieuDaiPhuongPhap}m)` : ""}`
      : phuongPhapDo === "do_bom"
        ? `Đổ bơm${chieuDaiPhuongPhap ? ` (${chieuDaiPhuongPhap}m)` : ""}`
        : "—";

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
          {hinhThuc === "tra_het" ? "Trả hết" : "Công nợ"}
          {existingCongNoHD.length > 0 && ` · Lần ${existingCongNoHD.length + 1}`}
        </div>
      </div>

      <div className={styles.formBody}>
        {/* ── Thông tin đơn hàng (readonly) ── */}
        <div className={`${styles.section} ${styles.fullWidth}`}>
          <div className={styles.sectionHeader}>
            <FiFileText size={18} />
            <h3>Thông tin đơn hàng</h3>
          </div>
          <div className={styles.orderInfoGrid}>
            <div className={styles.orderInfoItem}>
              <span className={styles.orderInfoLabel}>Khách hàng</span>
              <span className={styles.orderInfoValue}>{donHang.tenKhachHang}</span>
            </div>
            <div className={styles.orderInfoItem}>
              <span className={styles.orderInfoLabel}>Địa chỉ giao</span>
              <span className={styles.orderInfoValue}>{donHang.diaChiNhan || "—"}</span>
            </div>
            <div className={styles.orderInfoItem}>
              <span className={styles.orderInfoLabel}>Mác bê tông</span>
              <span className={styles.orderInfoValue}>{donHang.tenMacBeTong || "—"}</span>
            </div>
            <div className={styles.orderInfoItem}>
              <span className={styles.orderInfoLabel}>Khối lượng đặt</span>
              <span className={styles.orderInfoValue}>{donHang.khoiLuongDat} m³</span>
            </div>
            <div className={styles.orderInfoItem}>
              <span className={styles.orderInfoLabel}>Đơn giá</span>
              <span className={styles.orderInfoValue}>{formatCurrency(donHang.donGia)}</span>
            </div>
            <div className={styles.orderInfoItem}>
              <span className={styles.orderInfoLabel}>Thành tiền</span>
              <span className={styles.orderInfoValue}>{formatCurrency(donHang.thanhTien || 0)}</span>
            </div>
            <div className={styles.orderInfoItem}>
              <span className={styles.orderInfoLabel}>Hạng mục / Cấu kiện</span>
              <span className={styles.orderInfoValue}>{hangMuc || "—"}</span>
            </div>
            <div className={styles.orderInfoItem}>
              <span className={styles.orderInfoLabel}>Phương pháp đổ</span>
              <span className={styles.orderInfoValue}>{phuongPhapDoLabel}</span>
            </div>
            {existingCongNoHD.length > 0 && (
              <div className={styles.orderInfoItem} style={{ gridColumn: "1 / -1" }}>
                <span className={styles.orderInfoLabel}>Hóa đơn công nợ đã xuất</span>
                <div className={styles.congNoDaXuat}>
                  {existingCongNoHD.map((hd, i) => (
                    <div key={hd.id} className={styles.congNoItem}>
                      <span>{hd.maHoaDon}</span>
                      <span>{formatCurrency(hd.soTienThanhToan || 0)}</span>
                      <button
                        className={styles.btnXemHdSmall}
                        onClick={() => navigate(`/in-hoa-don/${hd.id}`)}
                      >
                        Xem
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Chọn hình thức thanh toán ── */}
        <div className={`${styles.section} ${styles.fullWidth}`}>
          <div className={styles.sectionHeader}>
            <FiDollarSign size={18} />
            <h3>Hình thức thanh toán</h3>
          </div>
          <div className={styles.hinhThucGrid}>
            {LOAI_HINH_THUC.map((ht) => (
              <button
                key={ht.value}
                className={`${styles.hinhThucCard} ${hinhThuc === ht.value ? styles.hinhThucCardActive : ""}`}
                onClick={() => setHinhThuc(ht.value)}
              >
                <div className={styles.hinhThucCheck}>
                  {hinhThuc === ht.value && <FiCheck size={14} />}
                </div>
                <div>
                  <div className={styles.hinhThucLabel}>{ht.label}</div>
                  <div className={styles.hinhThucDesc}>{ht.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── Chi phí (nhập thủ công) ── */}
        <div className={`${styles.section} ${styles.fullWidth}`}>
          <div className={styles.sectionHeader}>
            <FiDollarSign size={18} />
            <h3>Chi phí (nhập thủ công)</h3>
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Tiền bê tông (đ)</label>
              <input
                className={`${styles.formInput} ${styles.inputReadOnly}`}
                type="text"
                value={formatNumberInput(tienBeTong)}
                readOnly
              />
              <span className={styles.formHint}>Auto từ đơn hàng</span>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Bù vận chuyển (đ)</label>
              <input
                className={styles.formInput}
                type="text"
                value={buuVanChuyen}
                onChange={(e) => setBuuVanChuyen(formatNumberInput(e.target.value))}
                placeholder="0"
              />
            </div>
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
              <label className={styles.formLabel}>Giảm trừ (đ)</label>
              <input
                className={styles.formInput}
                type="text"
                value={giamTru}
                onChange={(e) => setGiamTru(formatNumberInput(e.target.value))}
                placeholder="0"
              />
            </div>
          </div>
          <div className={styles.tongCongRow}>
            <span className={styles.tongCongLabel}>TỔNG CỘNG</span>
            <span className={styles.tongCongValue}>{formatCurrency(tongCong)}</span>
          </div>
        </div>

        {/* ── Thông tin thanh toán ── */}
        <div className={`${styles.section} ${styles.fullWidth}`}>
          <div className={styles.sectionHeader}>
            <FiClock size={18} />
            <h3>Thông tin thanh toán</h3>
          </div>

          {/* Trả hết */}
          {hinhThuc === "tra_het" && (
            <div className={styles.thanhToanGroup}>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Số tiền trả (đ)</label>
                  <input
                    className={styles.formInput}
                    type="text"
                    value={soTienTra}
                    onChange={(e) => setSoTienTra(formatNumberInput(e.target.value))}
                    placeholder={formatNumberInput(tongCong)}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Tiền trả dư (đ)</label>
                  <input
                    className={styles.formInput}
                    type="text"
                    value={soTienDu}
                    onChange={(e) => setSoTienDu(formatNumberInput(e.target.value))}
                    placeholder="0"
                  />
                  <span className={styles.formHint}>Khách trả vượt, ghi nhận dư</span>
                </div>
              </div>
            </div>
          )}

          {/* Công nợ */}
          {hinhThuc === "cong_no" && (
            <div className={styles.thanhToanGroup}>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Số tiền trả trước (đ)</label>
                  <input
                    className={styles.formInput}
                    type="text"
                    value={soTienTraTruoc}
                    onChange={(e) => setSoTienTraTruoc(formatNumberInput(e.target.value))}
                    placeholder="0"
                  />
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
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Nợ còn lại (đ)</label>
                  <input
                    className={styles.formInput}
                    type="text"
                    value={soTienNoConLai}
                    onChange={(e) => setSoTienNoConLai(formatNumberInput(e.target.value))}
                    placeholder="0"
                  />
                  <span className={styles.formHint}>
                    = {formatCurrency(tongCong)} - {formatCurrency(parseCurrency(soTienTraTruoc))}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Thông tin hóa đơn ── */}
        <div className={`${styles.section} ${styles.fullWidth}`}>
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
              <label className={styles.formLabel}>Ngày lập</label>
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
              <label className={styles.formLabel}>Phương thức TT</label>
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

        {/* ── Nhân sự & xe ── */}
        <div className={`${styles.section} ${styles.fullWidth}`}>
          <div className={styles.sectionHeader}>
            <FiUser size={18} />
            <h3>Thông tin nhân sự &amp; xe</h3>
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Kỹ sư công trình</label>
              <input
                className={styles.formInput}
                type="text"
                value={kySu}
                onChange={(e) => setKySu(e.target.value)}
                placeholder="Tên kỹ sư"
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Vận hành bơm</label>
              <input
                className={styles.formInput}
                type="text"
                value={vanHanhBom}
                onChange={(e) => setVanHanhBom(e.target.value)}
                placeholder="Tên người vận hành bơm"
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

        {/* ── Actions ── */}
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
                  {hinhThuc === "tra_het"
                    ? "Xác nhận & xuất hóa đơn"
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
