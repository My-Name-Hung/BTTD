import { useCallback, useEffect, useState } from "react";
import {
  FiArrowLeft,
  FiCalendar,
  FiCheck,
  FiClock,
  FiSave,
  FiTruck,
} from "react-icons/fi";
import { useNavigate, useParams } from "react-router-dom";
import { Loading } from "../../../shared/components/Common";
import { useToast } from "../../../shared/hooks";
import {
  layDanhSachXe,
  layDonHang,
  layLichSanXuat,
  layLichSanXuatTramTron,
  xacNhanSanXuatXong,
} from "../../../shared/services/api";
import { DonHang, LichSanXuat, Xe } from "../../../shared/types";
import styles from "./KhoXacNhanSanXuatPage.module.css";

function formatDateTimeLocal(d: string | null | undefined): string {
  if (!d) return "";
  const dt = new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  const h = String(dt.getHours()).padStart(2, "0");
  const min = String(dt.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${h}:${min}`;
}

function parseDateParts(d: string) {
  if (!d) return null;
  const cleaned = d.replace("Z", "").replace(/\.\d+$/, "");
  const [datePart] = cleaned.split("T");
  if (!datePart) return null;
  const [y, mo, day] = datePart.split("-").map(Number);
  if (!y || !mo || !day) return null;
  return { y, mo, day };
}

function getDateKey(d: string) {
  const parts = parseDateParts(d);
  if (!parts) return "";
  return `${parts.y}-${String(parts.mo).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

interface LichSanXuatItem {
  id: number;
  idDonHang: number;
  idTramTron: number;
  tenTram: string;
  thoiGianTron: string;
  trangThai: string;
}

export default function KhoXacNhanSanXuatPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const idDonHang = id ? parseInt(id) : null;
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [donHang, setDonHang] = useState<DonHang | null>(null);
  const [xes, setXes] = useState<Xe[]>([]);
  const [lichTramTrons, setLichTramTrons] = useState<LichSanXuatItem[]>([]);

  // Form state
  const [khoiLuongDaTron, setKhoiLuongDaTron] = useState("");
  const [ngayGioDo, setNgayGioDo] = useState(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const h = String(now.getHours()).padStart(2, "0");
    const min = String(now.getMinutes()).padStart(2, "0");
    return `${y}-${m}-${day}T${h}:${min}`;
  });
  const [idXe, setIdXe] = useState("");
  const [bienSoXe, setBienSoXe] = useState("");
  const [tenTaiXeHienThi, setTenTaiXeHienThi] = useState("");
  const [ghiChuXe, setGhiChuXe] = useState("");

  const loadData = useCallback(async () => {
    if (!idDonHang) return;
    setLoading(true);
    try {
      const [dh, xesData, lichs, allLich] = await Promise.all([
        layDonHang(idDonHang),
        layDanhSachXe(),
        layLichSanXuat(idDonHang),
        layLichSanXuatTramTron(),
      ]);

      setDonHang(dh);
      setXes(xesData);

      // Lấy thông tin lịch sản xuất theo trạm trộn
      const tramLichs = (Array.isArray(lichs) ? lichs : [])
        .filter((l: any) => l.idTramTron && l.tenTram)
        .map((l: any) => ({
          id: l.id,
          idDonHang: l.idDonHang,
          idTramTron: l.idTramTron,
          tenTram: l.tenTram,
          thoiGianTron: l.thoiGianTron,
          trangThai: l.trangThai,
        }));
      setLichTramTrons(tramLichs);

      // Auto-fill từ lịch sản xuất đầu tiên
      if (Array.isArray(lichs) && lichs.length > 0) {
        const firstLich = lichs[0];
        if (firstLich.idXe) {
          setIdXe(String(firstLich.idXe));
          const xe = xesData.find((x: Xe) => x.id === firstLich.idXe);
          if (xe) {
            setBienSoXe(xe.bienSo || "");
            setTenTaiXeHienThi(xe.tenTaiXe || "");
          }
        }
        if (firstLich.bienSoXe) setBienSoXe(firstLich.bienSoXe);
        if (firstLich.ghiChuXe) setGhiChuXe(firstLich.ghiChuXe);
        if (firstLich.thoiGianBatDauDo) {
          setNgayGioDo(formatDateTimeLocal(firstLich.thoiGianBatDauDo));
        }
      }
    } catch {
      showToast("Lỗi tải dữ liệu", "error");
    } finally {
      setLoading(false);
    }
  }, [idDonHang, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleXeChange = (xeId: string) => {
    const xe = xes.find((x) => x.id === parseInt(xeId));
    setIdXe(xeId);
    setBienSoXe(xe?.bienSo || "");
    setTenTaiXeHienThi(xe?.tenTaiXe || "");
  };

  // Tính tổng khối lượng đã trộn từ tất cả trạm trong đơn
  const tongKhoiLuongDaTron = lichTramTrons.reduce((sum, l) => {
    // Hiện tại chỉ có thông tin cơ bản, khối lượng đã trộn sẽ được cập nhật từ backend
    // Khi load lại dữ liệu sau khi submit, tổng này sẽ được cập nhật
    return sum;
  }, 0);

  // Tính số khối còn lại
  const khoiLuongBanDau = donHang?.khoiLuongDat || 0;
  const khoiLuongDaTronSo = parseFloat(khoiLuongDaTron) || 0;
  const khoiLuongConLai = Math.max(0, khoiLuongBanDau - khoiLuongDaTronSo);

  const handleSubmit = async () => {
    if (!idDonHang) return;

    if (!khoiLuongDaTron || parseFloat(khoiLuongDaTron) <= 0) {
      showToast("Vui lòng nhập số khối đã trộn", "error");
      return;
    }

    if (parseFloat(khoiLuongDaTron) > khoiLuongBanDau) {
      showToast("Số khối đã trộn không được lớn hơn khối lượng đặt hàng", "error");
      return;
    }

    setSubmitting(true);
    try {
      // Format ngày giờ từ datetime-local (YYYY-MM-DDTHH:mm) sang SQL Server (YYYY-MM-DD HH:mm:ss)
      const formattedNgayGioDo = ngayGioDo ? `${ngayGioDo}:00` : null;

      await xacNhanSanXuatXong(idDonHang, {
        khoiLuongDaTron: parseFloat(khoiLuongDaTron),
        ngayGioDo: formattedNgayGioDo,
        idXe: idXe ? parseInt(idXe) : null,
        bienSoXe,
        ghiChuXe,
      });

      showToast("Đã xác nhận sản xuất xong!");
      // Reload data trước khi navigate để đảm bảo dữ liệu mới nhất
      await loadData();
      navigate("/tram-tron/lich-san-xuat");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Lỗi xác nhận", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    navigate("/tram-tron/lich-san-xuat");
  };

  if (loading) return <Loading />;

  if (!donHang) {
    return (
      <div className={styles.pageWrapper}>
        <div className={styles.notFound}>
          <p>Không tìm thấy đơn hàng</p>
          <button onClick={handleBack}>Quay lại</button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.pageWrapper}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <button className={styles.backBtn} onClick={handleBack}>
            <FiArrowLeft size={18} />
          </button>
          <div>
            <div className={styles.pageTitle}>Xác nhận sản xuất xong</div>
            <div className={styles.pageSubtitle}>
              Mã đơn: <strong>{donHang.maDonHang}</strong> ·{" "}
              {donHang.tenKhachHang}
            </div>
          </div>
        </div>
      </div>

      {/* Order Info */}
      <div className={styles.orderInfoCard}>
        <div className={styles.orderInfoGrid}>
          <div className={styles.orderInfoItem}>
            <span className={styles.orderInfoLabel}>Mác bê tông</span>
            <span className={styles.orderInfoValue}>{donHang.tenMacBeTong}</span>
          </div>
          <div className={styles.orderInfoItem}>
            <span className={styles.orderInfoLabel}>Khối lượng đặt</span>
            <span className={styles.orderInfoValue}>
              {khoiLuongBanDau} m³
            </span>
          </div>
          <div className={styles.orderInfoItem}>
            <span className={styles.orderInfoLabel}>Địa chỉ giao</span>
            <span className={styles.orderInfoValue}>{donHang.diaChiNhan}</span>
          </div>
          <div className={styles.orderInfoItem}>
            <span className={styles.orderInfoLabel}>Trạm trộn</span>
            <span className={styles.orderInfoValue}>
              {lichTramTrons.map((l) => l.tenTram).join(", ") || "—"}
            </span>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className={styles.formCard}>
        {/* Số khối đã trộn */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <FiCheck size={18} />
            <h3>Thông tin sản xuất</h3>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>
                Số khối đã trộn (m³) <span className={styles.required}>*</span>
              </label>
              <input
                className={styles.formInput}
                type="number"
                value={khoiLuongDaTron}
                onChange={(e) => setKhoiLuongDaTron(e.target.value)}
                placeholder={`0 - ${khoiLuongBanDau}`}
                min="0"
                max={khoiLuongBanDau}
                step="0.5"
              />
              <span className={styles.formHint}>
                Khối lượng đặt: {khoiLuongBanDau} m³ · Còn lại:{" "}
                <strong style={{ color: khoiLuongConLai > 0 ? "#f59e0b" : "#10b981" }}>
                  {khoiLuongConLai} m³
                </strong>
              </span>
            </div>
          </div>
        </div>

        {/* Ngày giờ đổ */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <FiCalendar size={18} />
            <h3>Thời gian đổ</h3>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>
                Ngày giờ đổ <span className={styles.required}>*</span>
              </label>
              <input
                className={styles.formInput}
                type="datetime-local"
                value={ngayGioDo}
                onChange={(e) => setNgayGioDo(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Thông tin xe giao */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <FiTruck size={18} />
            <h3>Thông tin xe giao</h3>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Xe giao hàng</label>
              <select
                className={styles.formSelect}
                value={idXe}
                onChange={(e) => handleXeChange(e.target.value)}
              >
                <option value="">— Chọn xe —</option>
                {xes.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.bienSo} — {x.tenTaiXe || "Không có tài xế"}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Biển số xe</label>
              <input
                className={styles.formInput}
                value={bienSoXe}
                onChange={(e) => setBienSoXe(e.target.value)}
                placeholder="VD: 59C1-12345"
              />
            </div>
          </div>

          {/* Hiển thị thông tin tài xế */}
          {tenTaiXeHienThi && (
            <div className={styles.taiXeInfo}>
              <span className={styles.taiXeLabel}>Tài xế:</span>
              <span className={styles.taiXeName}>{tenTaiXeHienThi}</span>
            </div>
          )}

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Ghi chú xe giao</label>
            <textarea
              className={styles.formTextarea}
              value={ghiChuXe}
              onChange={(e) => setGhiChuXe(e.target.value)}
              placeholder="VD: Xe cần vào trước 8h, liên hệ tài xế trước 30 phút..."
              rows={2}
            />
          </div>
        </div>

        {/* Actions */}
        <div className={styles.formActions}>
          <button
            type="button"
            className={styles.btnCancel}
            onClick={handleBack}
            disabled={submitting}
          >
            Hủy
          </button>
          <button
            type="button"
            className={styles.btnSubmit}
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <Loading text="Đang xử lý..." />
            ) : (
              <>
                <FiCheck size={16} />
                Xác nhận sản xuất xong
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
