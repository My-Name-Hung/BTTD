import { useCallback, useEffect, useState } from "react";
import {
  FiAlertCircle,
  FiArrowLeft,
  FiCheck,
  FiClock,
  FiDollarSign,
  FiFileText,
  FiTruck,
  FiUser,
} from "react-icons/fi";
import { useNavigate, useParams } from "react-router-dom";
import { Loading } from "../../../shared/components/Common";
import { useToast } from "../../../shared/hooks";
import {
  layDanhSachMacBeTong,
  layDonHang,
  layHoaDonTheoDonHang,
  layLichSanXuat,
  taoHoaDon,
} from "../../../shared/services/api";
import { DonHang, HoaDon, LichSanXuat, MacBeTong } from "../../../shared/types";
import styles from "./XuatHoaDonPage.module.css";

type HinhThucThanhToan = "tra_het" | "cong_no";
type PhuongThucTaoDon =
  | "tra_het"
  | "tra_het_du"
  | "cong_no"
  | "cong_no_du"
  | null
  | undefined;

// Map phương thức tạo đơn → tab mặc định khi xuất hóa đơn
function mapPhuongThucToTab(ptt: PhuongThucTaoDon): HinhThucThanhToan {
  if (ptt === "cong_no" || ptt === "cong_no_du") return "cong_no";
  return "tra_het";
}

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

const LOAI_HINH_THUC: {
  value: HinhThucThanhToan;
  label: string;
  desc: string;
}[] = [
  { value: "tra_het", label: "Trả hết", desc: "Thanh toán đầy đủ 1 lần" },
  {
    value: "cong_no",
    label: "Công nợ",
    desc: "Thanh toán trước một phần, còn lại ghi nợ",
  },
];

export default function XuatHoaDonPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [macBeTongs, setMacBeTongs] = useState<MacBeTong[]>([]);
  const [loading, setLoading] = useState(true);

  // Tra cứu đơn giá catalog của mác bê tông; ưu tiên theo idMacBeTong, sau đó tên
  const getDonGiaMacCatalog = (): number | null => {
    if (!donHang) return null;
    if (donHang.idMacBeTong) {
      const found = macBeTongs.find((m) => m.id === donHang.idMacBeTong);
      if (found) return found.donGia;
    }
    if (donHang.tenMacBeTong) {
      const found = macBeTongs.find((m) => m.tenMac === donHang.tenMacBeTong);
      if (found) return found.donGia;
    }
    if (donHang.donGia && donHang.donGia > 0) return donHang.donGia;
    return null;
  };
  const [submitting, setSubmitting] = useState(false);
  const [hinhThuc, setHinhThuc] = useState<HinhThucThanhToan>("tra_het");
  const [donHang, setDonHang] = useState<DonHang | null>(null);
  const [lichSXs, setLichSXs] = useState<LichSanXuat[]>([]);
  const [allHoaDons, setAllHoaDons] = useState<HoaDon[]>([]);
  const existingCongNoHD = sortHoaDonsByTime(
    allHoaDons.filter(
      (h) => h.loaiThanhToan === "cong_no" || h.loaiThanhToan === "cong_no_du",
    ),
  );

  // Tổng tiền KHÁCH ĐÃ THANH TOÁN ở các lần hóa đơn trước (công nợ lần 1, 2, ...)
  // = sum soTienThanhToan của tất cả hóa đơn đã xuất cho đơn này.
  // Hiển thị ở tab "Công nợ" để kế toán biết còn lại bao nhiêu cần trả tiếp.
  const daThanhToanTruoc = allHoaDons.reduce(
    (sum, h) => sum + (h.soTienThanhToan || 0),
    0,
  );
  // Tổng gốc đã ghi nhận trên hóa đơn (tongCong của lần đầu, không đổi qua các lần)
  // Dùng để auto-suggest tongCong khi tạo lần tiếp theo mà user chưa nhập chi phí
  const tongCongGoc = allHoaDons.length > 0 ? allHoaDons[0].tongCong || 0 : 0;

  // Tổng tiền gốc đơn hàng
  const tongTienGoc = donHang ? donHang.thanhTien || 0 : 0;

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

  // Số tiền khách trả (dùng chung cho cả 2 tab) — tự động tính dư/nợ còn lại
  const [soTienTra, setSoTienTra] = useState("");

  // Công nợ — hạn thanh toán (chỉ dùng cho tab công nợ)
  const [hanTraCongNo, setHanTraCongNo] = useState("");

  // Nhân sự & xe (mảng theo từng trạm)
  const [kySu, setKySu] = useState("");
  const [vanHanhBom, setVanHanhBom] = useState("");
  const [lapOng, setLapOng] = useState("");
  // Mỗi phần tử = 1 trạm: { tram, bienSo, taiXe }
  const [xeTheoTram, setXeTheoTram] = useState<
    { tram: string; bienSo: string; taiXe: string }[]
  >([]);

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

  // ── Tính tiền dư / nợ còn lại + tự động chuyển tab dựa trên 'Số tiền trả' ──
  // Cả 2 tab (trả hết + công nợ) đều dùng chung input "Số tiền trả".
  // - soTienTra == 0: giữ tab hiện tại (chưa nhập gì)
  // - soTienTra < tongCong: tab "tra_het" → tự chuyển sang "cong_no"
  // - soTienTra == tongCong: tab "tra_het", không dư
  // - soTienTra > tongCong: status "tra_het_du" hoặc "cong_no_du" tùy tab hiện tại
  const soTienTraNum = parseCurrency(soTienTra);
  const chenhLech = soTienTraNum - tongCong;
  const tienDu = chenhLech > 0 ? chenhLech : 0;
  const noConLai = chenhLech < 0 ? -chenhLech : 0;
  // Trạng thái thanh toán dựa trên tab hiện tại + chênh lệch
  const trangThaiThanhToan:
    | "tra_het"
    | "tra_het_du"
    | "cong_no"
    | "cong_no_du" =
    hinhThuc === "tra_het"
      ? chenhLech > 0
        ? "tra_het_du"
        : "tra_het"
      : chenhLech > 0
        ? "cong_no_du"
        : chenhLech < 0
          ? "cong_no"
          : "cong_no";

  // Tự động chuyển tab "tra_het" → "cong_no" khi khách trả thiếu
  // (khi đang ở tab trả hết mà số tiền trả < tổng cộng, hệ thống tự ghi nhận làm công nợ)
  useEffect(() => {
    if (
      hinhThuc === "tra_het" &&
      tongCong > 0 &&
      soTienTraNum > 0 &&
      chenhLech < 0
    ) {
      setHinhThuc("cong_no");
    }
  }, [hinhThuc, tongCong, soTienTraNum, chenhLech]);

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [dh, lsArr, existingHDs, macList] = await Promise.all([
        layDonHang(parseInt(id, 10)),
        layLichSanXuat(parseInt(id, 10)).catch(() => []),
        layHoaDonTheoDonHang(parseInt(id, 10)).catch(() => []),
        layDanhSachMacBeTong().catch(() => []),
      ]);

      setDonHang(dh);
      const lichArr: LichSanXuat[] = Array.isArray(lsArr)
        ? lsArr
        : lsArr
          ? [lsArr]
          : [];
      setLichSXs(lichArr);
      setAllHoaDons(Array.isArray(existingHDs) ? existingHDs : []);
      setMacBeTongs(Array.isArray(macList) ? macList : []);

      // Pre-fill thông tin cơ bản
      setKhachHang(dh.tenKhachHang || "");
      setDiaChiNhan(dh.diaChiNhan || "");
      setHangMuc(dh.hangMuc || "");
      // Nếu đã có hóa đơn cũ → "Tiền bê tông" tự động = số tiền còn lại phải trả
      // (thanhTien - daThanhToan) để TỔNG CỘNG khớp với số còn lại hiển thị ở ThanhToanPage
      // Nếu chưa có hóa đơn cũ → dùng thanhTien gốc của đơn
      const existingHDsArr = Array.isArray(existingHDs) ? existingHDs : [];
      const tienBeTongKhoiTao =
        existingHDsArr.length > 0 && dh.conLai != null && dh.conLai >= 0
          ? dh.conLai
          : dh.thanhTien || 0;
      setTienBeTong(tienBeTongKhoiTao);

      // Phương pháp đổ
      if (dh.phuongPhapDo === "do_xa") {
        setPhuongPhapDo("do_xa");
        setChieuDaiPhuongPhap(dh.chieuDaiNoi ? String(dh.chieuDaiNoi) : "");
      } else if (dh.phuongPhapDo === "do_bom") {
        setPhuongPhapDo("do_bom");
        setChieuDaiPhuongPhap(dh.chieuDaiBom ? String(dh.chieuDaiBom) : "");
      }

      // Auto-fill từ lịch sản xuất - duyệt qua TẤT CẢ row LichSanXuat của đơn
      // (đơn 1 trạm hay 2+ trạm, hoặc có row cũ đã hoàn thành)
      if (lichArr.length > 0) {
        // Ưu tiên lấy thông tin từ row MỚI NHẤT (id lớn nhất)
        const lichMoiNhat = [...lichArr].sort((a, b) => b.id - a.id)[0];

        if (lichMoiNhat.kyThuatCongTrinh) setKySu(lichMoiNhat.kyThuatCongTrinh);
        if (lichMoiNhat.nguoiOmOng) setVanHanhBom(lichMoiNhat.nguoiOmOng);
        if (lichMoiNhat.nguoiBatOng) setLapOng(lichMoiNhat.nguoiBatOng);

        // Xây danh sách tài xế + biển số theo từng trạm (1 row / trạm)
        // Mỗi trạm trộn = 1 dòng hiển thị riêng để xuất hóa đơn đầy đủ
        const tramMap = new Map<
          number,
          { tram: string; bienSo: string; taiXe: string }
        >();
        for (const ls of lichArr) {
          if (ls.idTramTron == null) continue;
          if (!tramMap.has(ls.idTramTron)) {
            tramMap.set(ls.idTramTron, {
              tram: ls.tenTram || `Trạm #${ls.idTramTron}`,
              bienSo: "",
              taiXe: "",
            });
          }
          const entry = tramMap.get(ls.idTramTron)!;
          // Ưu tiên row có dữ liệu xe (bienSoXe/tenTaiXe)
          if (ls.bienSoXe && !entry.bienSo) entry.bienSo = ls.bienSoXe;
          if (ls.tenTaiXe && !entry.taiXe) entry.taiXe = ls.tenTaiXe;
        }
        setXeTheoTram(Array.from(tramMap.values()));
      }

      // Nếu đã có hóa đơn công nợ -> auto chọn công nợ
      if (existingCongNoHD.length > 0) {
        setHinhThuc("cong_no");
      } else {
        // Auto chọn tab theo phương thức thanh toán đã chọn lúc tạo đơn hàng
        setHinhThuc(mapPhuongThucToTab(dh.phuongThucThanhToan));
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

  // Build phần ghi chú tự động từ danh sách xe theo trạm
  // Thông tin xe giao theo từng trạm (xeTheoTram) chỉ phục vụ hiển thị UI trong form.
  // Không ghép vào ghiChu lưu DB — dữ liệu xe đã có sẵn ở LichSanXuat và InHoaDonPage
  // lấy trực tiếp từ đó để hiển thị trên hóa đơn in.

  const handleSubmit = async () => {
    if (!donHang) return;

    // Validate
    if (hinhThuc === "cong_no" && !hanTraCongNo) {
      showToast("Vui lòng nhập hạn thanh toán công nợ", "error");
      return;
    }
    if (tongCong > 0 && soTienTraNum === 0) {
      showToast("Vui lòng nhập số tiền trả", "error");
      return;
    }

    const bvNum = parseCurrency(buuVanChuyen);
    const ppNum = parseCurrency(phiPhatSinh);
    const gtNum = parseCurrency(giamTru);

    setSubmitting(true);
    try {
      const loaiTT = trangThaiThanhToan;

      const hoaDon = await taoHoaDon({
        idDonHang: donHang.id,
        loaiThanhToan: loaiTT,
        // Gửi tiền bê tông đã hiển thị ở input "Tiền bê tông (đ)"
        // (không để backend auto tính = khoiLuongDat * donGia)
        tienBeTong: tienBeTong,
        buuVanChuyen: bvNum,
        phiPhatSinh: ppNum,
        giamTru: gtNum,
        ngayLap: ngayLap,
        khachHang,
        loaiXiMang,
        phuongThucThanhToan: phuongThuc,
        // Ghi chú lưu DB = đúng ghi chú người dùng nhập trong textarea
        // "Thông tin hóa đơn" ở trang XuatHoaDonPage. KHÔNG ghép thông tin xe giao
        // vì thông tin xe đã có riêng ở LichSanXuat và InHoaDonPage hiển thị từ đó.
        ghiChu: ghiChu,
        hanTraCongNo: hinhThuc === "cong_no" ? hanTraCongNo : undefined,
        soTienThanhToanTruoc: soTienTraNum,
        soTienDu: tienDu,
        soTienDuSuDung: 0,
      });

      showToast(
        hinhThuc === "tra_het"
          ? tienDu > 0
            ? `Đã xác nhận trả hết dư ${formatCurrency(tienDu)} và xuất hóa đơn`
            : "Đã xác nhận thanh toán và xuất hóa đơn"
          : tienDu > 0
            ? `Đã ghi công nợ dư ${formatCurrency(tienDu)} và xuất hóa đơn`
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
          {existingCongNoHD.length > 0 &&
            ` · Lần ${existingCongNoHD.length + 1}`}
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
              <span className={styles.orderInfoValue}>
                {donHang.tenKhachHang}
              </span>
            </div>
            <div className={styles.orderInfoItem}>
              <span className={styles.orderInfoLabel}>Địa chỉ giao</span>
              <span className={styles.orderInfoValue}>
                {donHang.diaChiNhan || "—"}
              </span>
            </div>
            <div className={styles.orderInfoItem}>
              <span className={styles.orderInfoLabel}>Mác bê tông</span>
              <span className={styles.orderInfoValue}>
                {donHang.tenMacBeTong || "—"}
                {(() => {
                  const gia = getDonGiaMacCatalog();
                  return gia != null ? (
                    <span className={styles.orderInfoValueSub}>
                      {" "}
                      — {formatCurrency(gia)}/m³
                    </span>
                  ) : null;
                })()}
              </span>
            </div>
            <div className={styles.orderInfoItem}>
              <span className={styles.orderInfoLabel}>Khối lượng đặt</span>
              <span className={styles.orderInfoValue}>
                {donHang.khoiLuongDat} m³
              </span>
            </div>
            <div className={styles.orderInfoItem}>
              <span className={styles.orderInfoLabel}>Đơn giá</span>
              <span className={styles.orderInfoValue}>
                {formatCurrency(donHang.donGia)}
                {(() => {
                  const gia = getDonGiaMacCatalog();
                  if (gia == null || gia === donHang.donGia) return null;
                  return (
                    <span
                      className={styles.orderInfoValueSub}
                      title="Đơn giá hiện tại trong bảng mác bê tông"
                    >
                      {" "}
                      (catalog: {formatCurrency(gia)}/m³)
                    </span>
                  );
                })()}
              </span>
            </div>
            <div className={styles.orderInfoItem}>
              <span className={styles.orderInfoLabel}>Thành tiền</span>
              <span className={styles.orderInfoValue}>
                {formatCurrency(donHang.thanhTien || 0)}
              </span>
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
              <div
                className={styles.orderInfoItem}
                style={{ gridColumn: "1 / -1" }}
              >
                <span className={styles.orderInfoLabel}>
                  Hóa đơn công nợ đã xuất
                </span>
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
                onChange={(e) =>
                  setBuuVanChuyen(formatNumberInput(e.target.value))
                }
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
                onChange={(e) =>
                  setPhiPhatSinh(formatNumberInput(e.target.value))
                }
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
          <div className={styles.tongCongBlock}>
            {/* Tab công nợ + đã có lần thanh toán trước: hiển thị
                "ĐÃ THANH TOÁN" (các lần trước) trước "TỔNG CỘNG" */}
            {hinhThuc === "cong_no" && daThanhToanTruoc > 0 && (
              <div className={styles.tongCongSubRow}>
                <span className={styles.tongCongSubLabel}>
                  ĐÃ THANH TOÁN (các lần trước)
                </span>
                <span className={styles.tongCongSubValue}>
                  {formatCurrency(daThanhToanTruoc)}
                </span>
              </div>
            )}
            <div className={styles.tongCongRow}>
              <span className={styles.tongCongLabel}>TỔNG CỘNG</span>
              <span className={styles.tongCongValue}>
                {formatCurrency(tongCong)}
              </span>
            </div>
            {/* Gợi ý khi tạo lần tiếp theo: tổng gốc (lần đầu) - đã thanh toán = còn lại */}
            {hinhThuc === "cong_no" &&
              allHoaDons.length > 0 &&
              tongCong === 0 && (
                <div className={styles.tongCongSuggest}>
                  Tổng gốc lần 1: <strong>{formatCurrency(tongCongGoc)}</strong>{" "}
                  · Đã thanh toán:{" "}
                  <strong>{formatCurrency(daThanhToanTruoc)}</strong> → Còn lại:{" "}
                  <strong>
                    {formatCurrency(
                      Math.max(0, tongCongGoc - daThanhToanTruoc),
                    )}
                  </strong>
                  . Nhập chi phí phía trên hoặc dùng số còn lại làm số tiền trả.
                </div>
              )}
          </div>
        </div>

        {/* ── Thông tin thanh toán ── */}
        <div className={`${styles.section} ${styles.fullWidth}`}>
          <div className={styles.sectionHeader}>
            <FiClock size={18} />
            <h3>Thông tin thanh toán</h3>
          </div>

          {/* Cả 2 tab (trả hết + công nợ) đều dùng chung input "Số tiền trả".
              Khi nhập số tiền trả, hệ thống tự so với tổng cộng để:
              - Số tiền trả >= Tổng cộng: hiển thị "Tiền dư" (auto-calc) + status _du
              - Số tiền trả <  Tổng cộng: tự chuyển sang tab "Công nợ" + hiển thị "Nợ còn lại" */}
          <div className={styles.thanhToanGroup}>
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>
                  Số tiền trả (đ)
                </label>
                <input
                  className={styles.formInput}
                  type="text"
                  value={soTienTra}
                  onChange={(e) =>
                    setSoTienTra(formatNumberInput(e.target.value))
                  }
                  placeholder={formatNumberInput(tongCong)}
                />
                <span className={styles.formHint}>
                  Tổng cộng phải trả:{" "}
                  <strong>{formatCurrency(tongCong)}</strong>
                </span>
              </div>
              {/* Tab trả hết + dư */}
              {hinhThuc === "tra_het" && (
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Tiền trả dư (đ)</label>
                  <input
                    className={`${styles.formInput} ${styles.inputReadOnly}`}
                    type="text"
                    value={formatNumberInput(tienDu)}
                    readOnly
                    placeholder="0"
                  />
                  <span className={styles.formHint}>
                    {tienDu > 0
                      ? `Khách trả vượt ${formatCurrency(tienDu)} → trạng thái "Trả hết dư"`
                      : "Số tiền trả ≥ tổng cộng sẽ ghi nhận dư"}
                  </span>
                </div>
              )}
              {/* Tab công nợ: hạn + nợ còn lại */}
              {hinhThuc === "cong_no" && (
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Hạn thanh toán</label>
                  <input
                    className={styles.formInput}
                    type="date"
                    value={hanTraCongNo}
                    onChange={(e) => setHanTraCongNo(e.target.value)}
                  />
                </div>
              )}
            </div>
            {/* Hàng phụ: nợ còn lại (công nợ) hoặc dư (công nợ dư) */}
            {hinhThuc === "cong_no" && (
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Nợ còn lại (đ)</label>
                  <input
                    className={`${styles.formInput} ${styles.inputReadOnly}`}
                    type="text"
                    value={formatNumberInput(noConLai)}
                    readOnly
                    placeholder="0"
                  />
                  <span className={styles.formHint}>
                    {noConLai > 0
                      ? `Còn nợ ${formatCurrency(noConLai)} → trạng thái "Công nợ"`
                      : tienDu > 0
                        ? `Trả vượt ${formatCurrency(tienDu)} → trạng thái "Công nợ dư"`
                        : "Đã trả đủ tổng cộng"}
                  </span>
                </div>
                {tienDu > 0 && (
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Tiền dư (đ)</label>
                    <input
                      className={`${styles.formInput} ${styles.inputReadOnly}`}
                      type="text"
                      value={formatNumberInput(tienDu)}
                      readOnly
                      placeholder="0"
                    />
                    <span className={styles.formHint}>
                      Khách trả vượt, ghi nhận dư
                    </span>
                  </div>
                )}
              </div>
            )}
            {/* Trạng thái thanh toán hiện tại */}
            <div className={styles.trangThaiTTBadge}>
              {trangThaiThanhToan === "tra_het" && "Trạng thái: Trả hết"}
              {trangThaiThanhToan === "tra_het_du" && (
                <span style={{ color: "#0284c7" }}>
                  Trạng thái: Trả hết dư ({formatCurrency(tienDu)})
                </span>
              )}
              {trangThaiThanhToan === "cong_no" && (
                <span style={{ color: "#d97706" }}>
                  Trạng thái: Công nợ (còn nợ {formatCurrency(noConLai)})
                </span>
              )}
              {trangThaiThanhToan === "cong_no_du" && (
                <span style={{ color: "#dc2626" }}>
                  Trạng thái: Công nợ dư (dư {formatCurrency(tienDu)})
                </span>
              )}
            </div>
          </div>
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
          </div>
          {/* Danh sách xe + tài xế theo từng trạm (mỗi trạm 1 dòng đầy đủ) */}
          <div className={styles.xeTheoTramList}>
            {xeTheoTram.length === 0 ? (
              <div className={styles.xeTheoTramEmpty}>
                <FiTruck size={20} />
                <span>Chưa có thông tin xe / tài xế (chưa phân công xe)</span>
              </div>
            ) : (
              xeTheoTram.map((xe, idx) => (
                <div
                  key={`${xe.tram}-${idx}`}
                  className={styles.xeTheoTramItem}
                >
                  <div className={styles.xeTheoTramHeader}>
                    <FiTruck size={16} />
                    <span className={styles.xeTheoTramLabel}>
                      Trạm {idx + 1}: {xe.tram}
                    </span>
                  </div>
                  <div className={styles.xeTheoTramRow}>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Biển số xe</label>
                      <input
                        className={styles.formInput}
                        type="text"
                        value={xe.bienSo}
                        onChange={(e) => {
                          const v = e.target.value;
                          setXeTheoTram((prev) =>
                            prev.map((it, i) =>
                              i === idx ? { ...it, bienSo: v } : it,
                            ),
                          );
                        }}
                        placeholder="VD: 59C1-12345"
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Tài xế</label>
                      <input
                        className={styles.formInput}
                        type="text"
                        value={xe.taiXe}
                        onChange={(e) => {
                          const v = e.target.value;
                          setXeTheoTram((prev) =>
                            prev.map((it, i) =>
                              i === idx ? { ...it, taiXe: v } : it,
                            ),
                          );
                        }}
                        placeholder="Tên tài xế"
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
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
