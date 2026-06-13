import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FiAlertCircle,
  FiArrowLeft,
  FiCamera,
  FiCheck,
  FiCheckCircle,
  FiCheckSquare,
  FiClock,
  FiDollarSign,
  FiDownload,
  FiEdit2,
  FiExternalLink,
  FiFile,
  FiFileText,
  FiPackage,
  FiPrinter,
  FiRefreshCw,
  FiTrash2,
  FiTruck,
  FiUpload,
  FiUser,
  FiX,
  FiImage,
} from "react-icons/fi";
import { useNavigate, useParams } from "react-router-dom";
import { ConfirmModal, Loading, Modal } from "../../../shared/components/Common";
import { usePageRole, useToast } from "../../../shared/hooks";
import {
  duyetDonHang,
  layDonHang,
  layHoaDonTheoDonHang,
  layLichSanXuat,
  layNghiemThu,
  tuChoiDonHang,
  xoaDonHang,
  BangChungDonHang,
  layBangChungDonHang,
  uploadBangChungDonHang,
  uploadBangChungCamera,
  xoaBangChungDonHang,
  layLichSuTraLai,
} from "../../../shared/services/api";
import { buildFileUrl } from "../../../shared/utils";
import {
  DonHang,
  HoaDon,
  LichSanXuat,
  NghiemThu,
  TRANG_THAI_DON_COLORS,
  TRANG_THAI_DON_LABELS,
} from "../../../shared/types";
import { formatDateVN } from "../../../shared/utils/dateUtils";
import styles from "./ChiTietDonHangPage.module.css";

/** Parse bienBanFile — có thể là JSON array (file mới), string, hoặc string[] */
function parseBienBanFiles(raw: string | string[] | null | undefined): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw as string);
    if (Array.isArray(parsed)) return parsed;
    return [parsed];
  } catch {
    return [raw as string];
  }
}

/** Kiểm tra URL có phải là Google Drive link */
function isDriveLink(url: string): boolean {
  return url.includes("drive.google.com") || url.includes("drive.google.com/file");
}

/** Lấy tên file từ URL (dùng cho display) */
function getFileNameFromUrl(url: string): string {
  // Google Drive link
  if (isDriveLink(url)) {
    const parts = url.split("/");
    const idIdx = parts.findIndex((p) => p === "d" || p === "file");
    if (idIdx >= 0 && parts[idIdx + 1]) {
      return `Tệp đính kèm (${parts.length > idIdx + 1 ? "xem trên Drive" : ""})`;
    }
    return "Xem trên Google Drive";
  }
  // Local upload path
  const filename = url.split("/").pop() || url;
  const dotIdx = filename.lastIndexOf(".");
  const ext = dotIdx >= 0 ? filename.slice(dotIdx + 1).toUpperCase() : "";
  const name = dotIdx >= 0 ? filename.slice(0, dotIdx) : filename;
  return ext ? `${name}.${ext}` : filename;
}

/** Icon phù hợp theo loại file */
function getFileIcon(url: string) {
  if (isDriveLink(url)) return <FiFileText size={16} />;
  const ext = (url.split(".").pop() || "").toLowerCase();
  if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) return <FiImage size={16} />;
  if (ext === "pdf") return <FiFileText size={16} />;
  return <FiFileText size={16} />;
}

const TRANG_THAI_STEPS = [
  { key: "cho_duyet", label: "Chờ duyệt" },
  { key: "da_duyet", label: "Đã duyệt" },
  { key: "dang_san_xuat", label: "Đang SX" },
  { key: "dang_giao", label: "Đang giao" },
  { key: "da_giao", label: "Đã giao" },
  { key: "nghiem_thu", label: "Nghiệm thu" },
  { key: "hoan_thanh", label: "Hoàn thành" },
];

function formatCurrency(v: number) {
  return v?.toLocaleString("vi-VN") + " đ" || "0 đ";
}

function formatDate(d: string | null | undefined) {
  return d ? formatDateVN(d) : "";
}

function sortHoaDonsByTime(items: HoaDon[]) {
  return [...items].sort((a, b) => {
    const aTime = new Date(a.ngayLap || a.createdAt || 0).getTime();
    const bTime = new Date(b.ngayLap || b.createdAt || 0).getTime();
    if (aTime !== bTime) return aTime - bTime;
    return a.id - b.id;
  });
}

function getDebtInvoiceStepLabel(items: HoaDon[], invoiceId: number) {
  const debtInvoices = sortHoaDonsByTime(
    items.filter(
      (item) => item.loaiThanhToan === "cong_no" || item.loaiThanhToan === "cong_no_du",
    ),
  );
  const index = debtInvoices.findIndex((item) => item.id === invoiceId);
  if (index === -1) return "";
  return `Thanh toán lần ${index + 1}`;
}

function formatDateTime(d: string | null | undefined): string {
  return d ? formatDateVN(d) : "";
}

function statusColor(key: string) {
  return TRANG_THAI_DON_COLORS[key] || "#64748b";
}

function statusBg(key: string) {
  const c = statusColor(key);
  return `rgba(${hexToRgb(c)}, 0.1)`;
}

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}

export default function ChiTietDonHangPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toasts, showToast } = useToast();
  const { hasAnyRole } = usePageRole();

  // Hiển thị chi tiết thanh toán cho vai trò admin, sale, dieu_phoi, tram_tron
  const hienThiChiTietThanhToan = hasAnyRole([
    "admin",
    "sale",
    "dieu_phoi",
    "tram_tron",
  ]);

  const [donHang, setDonHang] = useState<DonHang | null>(null);
  const [lichSXs, setLichSXs] = useState<LichSanXuat[]>([]);
  const [nghiemThu, setNghiemThu] = useState<NghiemThu | null>(null);
  const [hoaDons, setHoaDons] = useState<HoaDon[]>([]);
  const [bangChungs, setBangChungs] = useState<BangChungDonHang[]>([]);
  const [lichSuTraLai, setLichSuTraLai] = useState<Array<{
    id: number;
    idDonHang: number;
    lyDo: string;
    idNguoiTra: number;
    hoTen: string;
    vaiTro: string;
    ngayTra: string;
    daXuLy: boolean;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [rejectLoading, setRejectLoading] = useState(false);
  const [approveLoading, setApproveLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [lyDoTuChoi, setLyDoTuChoi] = useState("");

  // Bằng chứng đơn hàng - modal states
  const [bangChungModalOpen, setBangChungModalOpen] = useState(false);
  const [bangChungOptionModalOpen, setBangChungOptionModalOpen] = useState(false);
  const [bangChungUploadModalOpen, setBangChungUploadModalOpen] = useState(false);
  const [bangChungCameraModalOpen, setBangChungCameraModalOpen] = useState(false);
  const [bangChungFiles, setBangChungFiles] = useState<File[]>([]);
  const [bangChungUploadLoading, setBangChungUploadLoading] = useState(false);
  const [bangChungCameraLoading, setBangChungCameraLoading] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const userVaiTro = JSON.parse(
    localStorage.getItem("bttd_user") || "{}",
  )?.vaiTro;
  const userId = JSON.parse(localStorage.getItem("bttd_user") || "{}")?.id;
  const isAdmin = userVaiTro === "admin";
  const isSale = userVaiTro === "sale";
  const canApproveReject = ["admin", "giam_doc_kinh_doanh", "ke_toan"].includes(userVaiTro);
  // Sửa: admin/GDKD/kế toán sửa tất cả đơn đến trước nghiệm thu; sales chỉ sửa đơn của mình
  const canEditAll = ["admin", "giam_doc_kinh_doanh", "ke_toan"].includes(userVaiTro);
  const canEdit = canEditAll || isSale;
  const canDelete = ["admin"].includes(userVaiTro);
  const isStep1 = donHang?.trangThaiDon === "cho_duyet";
  const isStep2 = donHang?.trangThaiDon === "cho_ke_toan_duyet";
  // Hiện hóa đơn tạm tính khi đơn đã qua 2 lần duyệt (không còn chờ duyệt)
  const showTamTinh = !isStep1 && !isStep2 && donHang?.trangThaiDon != null;
  const approveLabel = isAdmin
    ? (isStep1 ? "Duyệt lần 1" : isStep2 ? "Duyệt lần 2" : "Duyệt đơn")
    : "Duyệt đơn";

  const isDonHangHoanThanh = donHang?.trangThaiDon === "hoan_thanh" || donHang?.trangThaiDon === "da_thanh_toan";
  const canUploadBangChung = isDonHangHoanThanh && (isAdmin || isSale);

  const loadAll = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [dh, lsArr, ntArr, hdArr, bcArr, lsTraLaiArr] = await Promise.all([
        layDonHang(parseInt(id)),
        layLichSanXuat(parseInt(id)),
        layNghiemThu(parseInt(id)),
        layHoaDonTheoDonHang(parseInt(id)),
        layBangChungDonHang(parseInt(id)),
        layLichSuTraLai(parseInt(id)),
      ]);
      setDonHang(dh);
      setLichSXs(lsArr || []);
      setNghiemThu(ntArr || null);
      setHoaDons(hdArr || []);
      setBangChungs(bcArr || []);
      setLichSuTraLai(lsTraLaiArr || []);
    } catch {
      showToast("Không tải được thông tin đơn hàng", "error");
    } finally {
      setLoading(false);
    }
  }, [id, showToast]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Dedup theo idTramTron - 1 trạm chỉ hiển thị 1 block.
  // Trường hợp DB có 2 bản ghi LichSanXuat cùng trạm (lịch cũ đã hoàn thành + tạo lại),
  // chỉ giữ bản ghi mới nhất (theo ngayTao/id desc) cho mỗi trạm.
  // Đồng bộ với logic de-dup của KhoLichSanXuatPage.
  const lichSXsHienThi = useMemo(() => {
    const map = new Map<number, LichSanXuat>();
    for (const ls of lichSXs) {
      const key = ls.idTramTron ?? -ls.id; // lịch không có idTramTron (dữ liệu cũ) thì group theo id
      const existing = map.get(key);
      if (!existing) {
        map.set(key, ls);
        continue;
      }
      // Ưu tiên bản ghi có id lớn hơn (mới tạo sau)
      if (ls.id >= existing.id) {
        map.set(key, ls);
      }
    }
    return Array.from(map.values()).sort((a, b) => a.id - b.id);
  }, [lichSXs]);

  const handleDuyet = async () => {
    if (!donHang) return;
    setApproveLoading(true);
    try {
      await duyetDonHang(donHang.id);
      showToast("Duyệt đơn hàng thành công");
      loadAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Lỗi duyệt đơn", "error");
    } finally {
      setApproveLoading(false);
    }
  };

  const handleTuChoi = async () => {
    if (!donHang || !lyDoTuChoi.trim()) return;
    setRejectLoading(true);
    try {
      await tuChoiDonHang(donHang.id, lyDoTuChoi);
      showToast("Từ chối đơn hàng thành công");
      setShowRejectModal(false);
      setLyDoTuChoi("");
      loadAll();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Lỗi từ chối đơn",
        "error",
      );
    } finally {
      setRejectLoading(false);
    }
  };

  const handleXoa = async () => {
    if (!donHang) return;
    setDeleteLoading(true);
    try {
      await xoaDonHang(donHang.id);
      showToast("Xóa đơn hàng thành công");
      navigate("/quan-ly/don-hang");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Lỗi xóa đơn", "error");
    } finally {
      setDeleteLoading(false);
      setShowDeleteModal(false);
    }
  };

  // === Bằng chứng đơn hàng handlers ===

  const handleOpenBangChungOption = () => {
    setBangChungOptionModalOpen(true);
  };

  const handleChonUploadFileBangChung = () => {
    setBangChungOptionModalOpen(false);
    setBangChungFiles([]);
    setBangChungUploadModalOpen(true);
  };

  const handleChonCameraBangChung = () => {
    setBangChungOptionModalOpen(false);
    setCapturedImage(null);
    setBangChungCameraModalOpen(true);
  };

  // Camera: bật camera khi modal mở
  useEffect(() => {
    if (!bangChungCameraModalOpen || !videoRef.current) return;
    let stream: MediaStream | null = null;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then((s) => {
        stream = s;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      })
      .catch(() => {
        showToast("Không thể truy cập camera", "error");
        setBangChungCameraModalOpen(false);
      });
    return () => {
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [bangChungCameraModalOpen, showToast]);

  const handleCaptureBangChung = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setCapturedImage(dataUrl);
    const stream = video.srcObject as MediaStream;
    if (stream) stream.getTracks().forEach((t) => t.stop());
  };

  const handleRetakeBangChung = () => {
    setCapturedImage(null);
  };

  const handleUploadBangChung = async () => {
    if (!donHang || bangChungFiles.length === 0) return;
    setBangChungUploadLoading(true);
    try {
      await uploadBangChungDonHang(donHang.id, bangChungFiles);
      showToast(`Đã tải lên ${bangChungFiles.length} file bằng chứng thành công!`);
      setBangChungUploadModalOpen(false);
      setBangChungFiles([]);
      loadAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Lỗi tải bằng chứng", "error");
    } finally {
      setBangChungUploadLoading(false);
    }
  };

  const handleCaptureAndSaveBangChung = async () => {
    if (!donHang || !capturedImage) return;
    setBangChungCameraLoading(true);
    try {
      await uploadBangChungCamera(donHang.id, capturedImage);
      showToast("Đã chụp ảnh và lưu bằng chứng thành công!");
      setBangChungCameraModalOpen(false);
      setCapturedImage(null);
      loadAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Lỗi lưu ảnh", "error");
    } finally {
      setBangChungCameraLoading(false);
    }
  };

  const handleXoaBangChung = async (bangChungId: number) => {
    try {
      await xoaBangChungDonHang(bangChungId);
      showToast("Đã xóa bằng chứng");
      loadAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Lỗi xóa bằng chứng", "error");
    }
  };

  if (loading) return <Loading />;

  if (!donHang) {
    return (
      <div className={styles.loading}>
        <div className={styles.loadingSpinner} />
        <span>Không tìm thấy đơn hàng</span>
      </div>
    );
  }

  // Map trạng thái thực tế → step hiển thị trên thanh progress
  const displayTrangThai =
    donHang.trangThaiDon === "da_nghiem_thu"
      ? "nghiem_thu"
      : donHang.trangThaiDon === "da_thanh_toan" ||
        donHang.trangThaiDon === "hoan_thanh"
        ? "hoan_thanh"
        : donHang.trangThaiDon;
  const currentDisplayIdx = TRANG_THAI_STEPS.findIndex(
    (s) => s.key === displayTrangThai,
  );
  const connLai = donHang.conLai ?? (donHang.thanhTien || 0) - (donHang.daThanhToan || 0);
  const sortedHoaDons = sortHoaDonsByTime(hoaDons);

  return (
    <div className={styles.detailPage}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <button
            className={styles.backBtn}
            onClick={() => navigate("/quan-ly/don-hang")}
          >
            <FiArrowLeft size={18} />
          </button>
          <div>
            <div className={styles.pageTitle}>{donHang.maDonHang}</div>
            <div className={styles.pageSubtitle}>
              Ngày tạo: {formatDate(donHang.ngayTaoDon)}
              {(isStep1 || isStep2) && isAdmin && (
                <span style={{ marginLeft: 8, fontWeight: 600, color: "#073ceb" }}>
                  · {isStep1 ? "Chờ duyệt lần 1" : "Chờ duyệt lần 2"}
                </span>
              )}
              ·{" "}
              <span
                style={{
                  color: statusColor(donHang.trangThaiDon),
                  fontWeight: 600,
                }}
              >
                {donHang.trangThaiDon === "da_thanh_toan"
                  ? "Hoàn thành"
                  : TRANG_THAI_DON_LABELS[donHang.trangThaiDon]}
              </span>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className={styles.pageActions}>
          {(donHang.trangThaiDon === "cho_duyet" || (donHang.trangThaiDon === "cho_ke_toan_duyet" && isAdmin)) && canApproveReject && (
            <>
              <button
                className={`${styles.actionBtn} ${styles.actionBtnSuccess}`}
                onClick={handleDuyet}
                disabled={approveLoading}
              >
                <FiCheck /> {approveLoading ? "Đang duyệt..." : approveLabel}
              </button>
              <button
                className={`${styles.actionBtn} ${styles.actionBtnWarning}`}
                onClick={() => setShowRejectModal(true)}
              >
                <FiX /> Từ chối
              </button>
            </>
          )}
          {canEdit && !["nghiem_thu", "da_nghiem_thu", "da_thanh_toan", "hoan_thanh", "tu_choi"].includes(donHang.trangThaiDon) && (canEditAll || donHang.nguoiTaoId === userId) && (
              <button
                className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
                onClick={() => navigate(`/quan-ly/don-hang/sua/${donHang.id}`)}
              >
                <FiEdit2 /> Chỉnh sửa
              </button>
            )}
          {canDelete &&
            ["cho_duyet", "tu_choi"].includes(donHang.trangThaiDon) && (
              <button
                className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                onClick={() => setShowDeleteModal(true)}
              >
                <FiTrash2 /> Xóa
              </button>
            )}
          {canEdit &&
            ["dang_san_xuat", "dang_giao", "da_giao"].includes(
              donHang.trangThaiDon,
            ) && (canEditAll || donHang.nguoiTaoId === userId) && (
              <button
                className={`${styles.actionBtn} ${styles.actionBtnSecondary}`}
                onClick={() => navigate("/dieu-phoi")}
              >
                <FiTruck /> Điều phối
              </button>
            )}
          {canEdit &&
            ["da_giao", "nghiem_thu"].includes(donHang.trangThaiDon) && (canEditAll || donHang.nguoiTaoId === userId) && (
              <button
                className={`${styles.actionBtn} ${styles.actionBtnSecondary}`}
                onClick={() => navigate("/nghiem-thu")}
              >
                <FiCheckSquare /> Nghiệm thu
              </button>
            )}
          {canApproveReject &&
            ["nghiem_thu", "da_nghiem_thu", "da_giao"].includes(donHang.trangThaiDon) && (
              <button
                className={`${styles.actionBtn} ${styles.actionBtnSecondary}`}
                onClick={() => navigate(`/thanh-toan/xuat/${donHang.id}`)}
              >
                <FiDollarSign /> Xuất hóa đơn
              </button>
            )}
          {/* Nút tải lên bằng chứng - chỉ hiện khi đơn hoàn thành + role admin/sale */}
          {canUploadBangChung && (
            <button
              className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
              onClick={handleOpenBangChungOption}
              title="Tải lên bằng chứng đơn hàng"
            >
              <FiUpload /> Bằng chứng
            </button>
          )}
        </div>
      </div>

      {/* Step Progress */}
      <div className={styles.stepProgressWrap}>
        <div className={styles.stepProgressTitle}>Tiến trình đơn hàng</div>
        <div className={styles.stepTrack}>
          <div className={styles.stepConnector}>
            <div className={styles.stepConnectorBg} />
            <div
              className={styles.stepConnectorFill}
              style={{
                width:
                  currentDisplayIdx >= 0
                    ? `${(currentDisplayIdx / (TRANG_THAI_STEPS.length - 1)) * 100}%`
                    : "0%",
              }}
            />
          </div>
          {TRANG_THAI_STEPS.map((step, idx) => {
            const lastStepIdx = TRANG_THAI_STEPS.length - 1;
            const isLastDone =
              idx === lastStepIdx &&
              (donHang.trangThaiDon === "hoan_thanh" ||
                donHang.trangThaiDon === "da_thanh_toan");
            const done = idx < currentDisplayIdx || isLastDone;
            const active = idx === currentDisplayIdx;
            const pending = idx > currentDisplayIdx;
            let circleClass = styles.stepCirclePending;
            if (done) circleClass = styles.stepCircleDone;
            else if (active) circleClass = styles.stepCircleActive;

            let labelClass = styles.stepLabel;
            if (done)
              labelClass = `${styles.stepLabel} ${styles.stepLabelDone}`;
            else if (active)
              labelClass = `${styles.stepLabel} ${styles.stepLabelActive}`;

            return (
              <div key={step.key} className={styles.stepItem}>
                <div className={`${styles.stepCircle} ${circleClass}`}>
                  {done ? <FiCheck size={14} /> : idx + 1}
                </div>
                <div className={labelClass}>{step.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Info Cards Grid */}
      <div className={styles.infoGrid}>
        {/* Card: Khách hàng */}
        <div className={styles.infoCard}>
          <div className={styles.infoCardTitle}>
            <FiUser size={14} /> Thông tin khách hàng
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Khách hàng</span>
            <span className={styles.infoValue}>{donHang.tenKhachHang}</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Số điện thoại</span>
            <span className={styles.infoValue}>{donHang.soDienThoai}</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Địa chỉ nhận</span>
            <span className={styles.infoValue} style={{ maxWidth: 220 }}>
              {donHang.diaChiNhan}
            </span>
          </div>
          {donHang.nguoiNhanHang && (
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Người nhận hàng</span>
              <span className={styles.infoValue}>{donHang.nguoiNhanHang}</span>
            </div>
          )}
        </div>

        {/* Card: Sản phẩm */}
        <div className={styles.infoCard}>
          <div className={styles.infoCardTitle}>
            <FiPackage size={14} /> Thông tin sản phẩm
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Mác bê tông</span>
            <span className={`${styles.infoValue} ${styles.infoValuePrimary}`}>
              {donHang.tenMacBeTong}
            </span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Khối lượng đặt</span>
            <span className={styles.infoValue}>{donHang.khoiLuongDat} m³</span>
          </div>
          {donHang.khoiLuongThucTe && (
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Khối lượng thực tế</span>
              <span
                className={`${styles.infoValue} ${styles.infoValueSuccess}`}
              >
                {donHang.khoiLuongThucTe} m³
              </span>
            </div>
          )}
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Đơn giá</span>
            <span className={styles.infoValue}>
              {formatCurrency(donHang.donGia)}/m³
            </span>
          </div>
          {(donHang.chiPhiPhatSinh ?? 0) > 0 && (
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Chi phí phát sinh</span>
              <span className={styles.infoValue}>
                {formatCurrency(donHang.chiPhiPhatSinh ?? 0)}
              </span>
            </div>
          )}
          {(donHang.buVanChuyen ?? 0) > 0 && (
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Bù vận chuyển</span>
              <span className={styles.infoValue}>
                {formatCurrency(donHang.buVanChuyen ?? 0)}
              </span>
            </div>
          )}
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Giao dự kiến</span>
            <span className={styles.infoValue}>
              {formatDateTime(donHang.thoiGianGiaoDuKien || "")}
            </span>
          </div>
        </div>

        {/* Card: Hạng mục & Phương pháp đổ */}
        {(donHang.hangMuc || donHang.phuongPhapDo) && (
          <div className={styles.infoCard}>
            <div className={styles.infoCardTitle}>
              <FiPackage size={14} /> Hạng mục & Phương pháp đổ
            </div>
            {donHang.hangMuc && (
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Hạng mục / Cấu kiện</span>
                <span className={styles.infoValue}>{donHang.hangMuc}</span>
              </div>
            )}
            {donHang.phuongPhapDo && (
              <>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Phương pháp đổ</span>
                  <span className={`${styles.infoValue} ${styles.infoValuePrimary}`}>
                    {donHang.phuongPhapDo === "do_xa"
                      ? "Đổ xả"
                      : donHang.phuongPhapDo === "do_bom"
                        ? "Đổ bơm"
                        : donHang.phuongPhapDo}
                  </span>
                </div>
                {donHang.phuongPhapDo === "do_bom" && donHang.chieuDaiBom && (
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Chiều dài bơm</span>
                    <span className={styles.infoValue}>
                      {donHang.chieuDaiBom} m
                    </span>
                  </div>
                )}
                {donHang.chieuDaiNoi && (
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Chiều dài nội</span>
                    <span className={styles.infoValue}>
                      {donHang.chieuDaiNoi} m
                    </span>
                  </div>
                )}
                {donHang.loaiBom && (
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Loại bơm</span>
                    <span className={styles.infoValue}>
                      {donHang.loaiBom === "bom_ngang"
                        ? "Bơm ngang"
                        : donHang.loaiBom === "bom_can"
                          ? "Bơm cần"
                          : donHang.loaiBom}
                    </span>
                  </div>
                )}
                {donHang.kieuNoi && (
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Kiểu nối</span>
                    <span className={styles.infoValue}>
                      {donHang.kieuNoi === "khong_dau"
                        ? "Không đầu"
                        : donHang.kieuNoi === "noi_dau"
                          ? "Nối đầu"
                          : donHang.kieuNoi === "noi_dit"
                            ? "Nối đít"
                            : donHang.kieuNoi}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Card: Thanh toán */}
        <div className={styles.infoCard}>
          <div className={styles.infoCardTitle}>
            <FiDollarSign size={14} /> Thông tin thanh toán
          </div>

          {/* Tính từ hóa đơn - đồng bộ với phần hóa đơn bên dưới */}
          {(() => {
            const hienThiTongTien = donHang.thanhTien || 0;
            const hienThiPhatSinh = (donHang.chiPhiPhatSinh ?? 0) > 0;
            const hienThiBuVC = (donHang.buVanChuyen ?? 0) > 0;
            const hienThiGiamTru = (donHang.giamTru ?? 0) > 0;
            const daThanhToan = hoaDons.reduce((sum, hd) => sum + (hd.soTienThanhToan || 0), 0);
            const conLai = hienThiTongTien - daThanhToan;

            return (
              <>
                <div className={styles.chiTietThanhToanGrid}>
                  <div>
                    <div className={`${styles.chiTietRow}`}>
                      <span className={styles.infoLabel}>Tiền bê tông</span>
                      <span className={styles.infoValue}>
                        {formatCurrency(hienThiTongTien)}
                      </span>
                    </div>
                    {hienThiPhatSinh && (
                      <div className={`${styles.chiTietRow}`}>
                        <span className={styles.infoLabel}>Chi phí phát sinh</span>
                        <span className={styles.infoValue}>
                          {formatCurrency(donHang.chiPhiPhatSinh ?? 0)}
                        </span>
                      </div>
                    )}
                  </div>
                  <div>
                    {hienThiBuVC && (
                      <div className={`${styles.chiTietRow}`}>
                        <span className={styles.infoLabel}>Phí bù vận chuyển</span>
                        <span className={styles.infoValue}>
                          {formatCurrency(donHang.buVanChuyen ?? 0)}
                        </span>
                      </div>
                    )}
                    {hienThiGiamTru && (
                      <div className={`${styles.chiTietRow}`}>
                        <span className={styles.infoLabel}>Giảm trừ</span>
                        <span className={styles.infoValue}>
                          -{formatCurrency(donHang.giamTru ?? 0)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Tổng tiền</span>
                  <span className={`${styles.infoValue} ${styles.infoValuePrimary}`}>
                    {formatCurrency(hienThiTongTien)}
                  </span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Đã thanh toán</span>
                  <span className={`${styles.infoValue} ${styles.infoValueSuccess}`}>
                    {formatCurrency(daThanhToan)}
                  </span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Còn lại</span>
                  <span
                    className={`${styles.infoValue} ${conLai > 0 ? styles.infoValueDanger : styles.infoValueSuccess}`}
                  >
                    {formatCurrency(Math.max(0, conLai))}
                  </span>
                </div>
              </>
            );
          })()}
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Ngày duyệt</span>
            <span className={styles.infoValue}>
              {formatDate(donHang.ngayDuyet || "")}
            </span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Ngày giao</span>
            <span className={styles.infoValue}>
              {formatDate(donHang.ngayGiao || "")}
            </span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Ngày nghiệm thu</span>
            <span className={styles.infoValue}>
              {formatDate(donHang.ngayNghiemThu || "")}
            </span>
          </div>
        </div>

        {/* Card: Trạng thái */}
        <div className={styles.infoCard}>
          <div className={styles.infoCardTitle}>
            <FiClock size={14} /> Trạng thái & Ghi chú
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Trạng thái</span>
            <span>
              <span
                className={styles.infoBadge}
                style={{
                  background: statusBg(donHang.trangThaiDon),
                  color: statusColor(donHang.trangThaiDon),
                }}
              >
                {donHang.trangThaiDon === "da_thanh_toan"
                  ? "Hoàn thành"
                  : TRANG_THAI_DON_LABELS[donHang.trangThaiDon]}
              </span>
            </span>
          </div>
          {donHang.trangThaiDon === "tu_choi" && donHang.lyDoTuChoi && (
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Đã từ chối bởi</span>
              <span className={`${styles.infoValue} ${styles.infoValueDanger}`}>
                {donHang.buocTuChoi === 1
                  ? "Giám đốc kinh doanh"
                  : donHang.buocTuChoi === 2
                    ? "Kế toán"
                    : donHang.nguoiDuyetGDKDId
                      ? "Kế toán"
                      : "Giám đốc kinh doanh"}
                {donHang.nguoiTuChoi && ` (${donHang.nguoiTuChoi})`}
              </span>
            </div>
          )}
          {donHang.lyDoTuChoi && (
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Lý do từ chối</span>
              <span className={`${styles.infoValue} ${styles.infoValueDanger}`}>
                {donHang.lyDoTuChoi}
              </span>
            </div>
          )}
          <div
            className={styles.infoRow}
            style={{ flexDirection: "column", gap: 4 }}
          >
            <span className={styles.infoLabel}>Ghi chú</span>
            <span
              className={styles.infoValue}
              style={{ textAlign: "left", fontSize: 13 }}
            >
              {donHang.ghiChu || "—"}
            </span>
          </div>
        </div>
      </div>

      {/* Lịch sản xuất */}
      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitle}>
            <div
              className={`${styles.sectionAccent} ${styles.sectionAccentBlue}`}
            />
            <FiTruck size={16} style={{ color: "var(--color-primary)" }} />
            Lịch sản xuất
          </div>
        </div>

        {lichSXsHienThi.length > 0 ? (
          <div className={styles.subTableWrap}>
            {lichSXsHienThi.map((lichSX, idx) => (
              <div key={lichSX.id} className={styles.tramBlock}>
                <div className={styles.tramBlockHeader}>
                  <FiPackage size={14} style={{ color: "var(--color-primary)" }} />
                  <span className={styles.tramBlockTitle}>
                    Trạm {idx + 1}: {lichSX.tenTram || "Chưa gán trạm"}
                  </span>
                </div>
                <table className={styles.subTable}>
                  <tbody>
                    <tr>
                      <th style={{ width: 160 }}>Biển số xe</th>
                      <td>{lichSX.bienSoXe || "—"}</td>
                      <th style={{ width: 160 }}>Tài xế</th>
                      <td>{lichSX.tenTaiXe || "—"}</td>
                    </tr>
                    <tr>
                      <th>Kỹ thuật</th>
                      <td>{lichSX.kyThuatCongTrinh || "—"}</td>
                      <th>Người ôm ống</th>
                      <td>{lichSX.nguoiOmOng || "—"}</td>
                    </tr>
                    <tr>
                      <th>Người bắt ống</th>
                      <td>{lichSX.nguoiBatOng || "—"}</td>
                      <th>Phương án đổ</th>
                      <td>{lichSX.phuongAnDo || "—"}</td>
                    </tr>
                    {lichSX.ghiChu && (
                      <tr>
                        <th>Ghi chú</th>
                        <td colSpan={3}>{lichSX.ghiChu}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.subTableEmpty}>
            <FiTruck size={24} style={{ opacity: 0.3, marginBottom: 8 }} />
            <div>Chưa có lịch sản xuất</div>
          </div>
        )}
      </div>

      {/* Lịch sử trả lại (trộn lại) */}
      {lichSuTraLai.length > 0 && (
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitle}>
              <div
                className={`${styles.sectionAccent} ${styles.sectionAccentOrange}`}
              />
              <FiRefreshCw
                size={16}
                style={{ color: "#ea580c" }}
              />
              Lịch sử trả lại (Trộn lại)
            </div>
          </div>
          <div style={{ padding: "8px 0" }}>
            {lichSuTraLai.map((item, idx) => (
              <div
                key={item.id}
                style={{
                  padding: "12px",
                  background: "rgba(234, 88, 12, 0.04)",
                  border: "1px solid rgba(234, 88, 12, 0.15)",
                  borderRadius: 8,
                  marginBottom: idx < lichSuTraLai.length - 1 ? 8 : 0,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "3px 10px",
                        borderRadius: 20,
                        fontSize: 11,
                        fontWeight: 700,
                        background: "rgba(234, 88, 12, 0.12)",
                        color: "#ea580c",
                      }}
                    >
                      Lần trả {lichSuTraLai.length - idx}
                    </span>
                  </div>
                  <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                    {item.ngayTra ? new Date(item.ngayTra).toLocaleString("vi-VN") : ""}
                  </span>
                </div>
                <div style={{ marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-secondary)" }}>
                    Người trả lại:
                  </span>{" "}
                  <span style={{ fontSize: 13, fontWeight: 600 }}>
                    {item.hoTen || "—"}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--color-text-secondary)", marginLeft: 8 }}>
                    ({item.vaiTro === 'ky_thuat' ? 'Kỹ thuật' : item.vaiTro === 'tai_xe' ? 'Tài xế' : item.vaiTro || "—"})
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-secondary)" }}>
                    Lý do:
                  </span>
                  <div
                    style={{
                      marginTop: 4,
                      padding: "8px 10px",
                      background: "white",
                      border: "1px solid var(--color-border)",
                      borderRadius: 6,
                      fontSize: 13,
                    }}
                  >
                    {item.lyDo}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Nghiệm thu — chỉ hiện khi đã có record nghiệm thu */}
      {nghiemThu && (
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitle}>
              <div
                className={`${styles.sectionAccent} ${styles.sectionAccentGreen}`}
              />
              <FiCheckCircle
                size={16}
                style={{ color: "var(--color-success)" }}
              />
              Biên bản nghiệm thu
            </div>
          </div>
          <div style={{ padding: "8px 0" }}>
            {(() => {
              const files = parseBienBanFiles(nghiemThu.bienBanFile);
              if (files.length === 0) {
                return (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      color: "var(--color-text-secondary)",
                      fontSize: 14,
                    }}
                  >
                    <FiAlertCircle size={16} />
                    Chưa có file biên bản nghiệm thu
                  </div>
                );
              }

              // Nếu chỉ có 1 file
              if (files.length === 1) {
                const url = files[0];
                return (
                  <a
                    href={buildFileUrl(url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: "var(--color-primary)",
                      fontSize: 14,
                      fontWeight: 600,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      textDecoration: "none",
                    }}
                  >
                    {getFileIcon(url)}
                    {isDriveLink(url) ? "Xem biên bản trên Google Drive" : "Mở biên bản nghiệm thu"}
                    <FiExternalLink size={13} />
                  </a>
                );
              }

              // Nhiều file
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-secondary)" }}>
                    {files.length} tệp đính kèm:
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {files.map((url, idx) => (
                      <a
                        key={idx}
                        href={buildFileUrl(url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "6px 12px",
                          border: "1.5px solid var(--color-border)",
                          borderRadius: 8,
                          background: "white",
                          color: "var(--color-primary)",
                          fontSize: 13,
                          fontWeight: 600,
                          textDecoration: "none",
                          transition: "all 0.2s",
                        }}
                      >
                        {getFileIcon(url)}
                        {getFileNameFromUrl(url)}
                        <FiExternalLink size={12} />
                      </a>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Bằng chứng đơn hàng */}
      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitle}>
            <div
              className={`${styles.sectionAccent} ${styles.sectionAccentBlue}`}
            />
            <FiImage size={16} style={{ color: "var(--color-primary)" }} />
            Bằng chứng đơn hàng
            {bangChungs.length > 0 && (
              <span style={{ fontSize: 12, fontWeight: 400, color: "var(--color-text-secondary)", marginLeft: 4 }}>
                ({bangChungs.length} tệp)
              </span>
            )}
          </div>
        </div>
        <div style={{ padding: "8px 0" }}>
          {bangChungs.length === 0 ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                color: "var(--color-text-secondary)",
                fontSize: 14,
              }}
            >
              <FiAlertCircle size={16} />
              Chưa có bằng chứng đơn hàng
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {bangChungs.map((bc) => {
                const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(bc.fileUrl);
                return (
                  <div
                    key={bc.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 12px",
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                      gap: 12,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                      <span style={{ color: bc.loai === "camera" ? "var(--color-success)" : "var(--color-primary)" }}>
                        {isImage ? <FiImage size={16} /> : <FiFile size={16} />}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {isImage ? "Hình ảnh" : getFileNameFromUrl(bc.fileUrl)}
                        </div>
                        {bc.ngayTao && (
                          <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>
                            {new Date(bc.ngayTao).toLocaleString("vi-VN")}
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <a
                        href={buildFileUrl(bc.fileUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          padding: "5px 10px",
                          border: "1.5px solid var(--color-primary)",
                          borderRadius: 7,
                          background: "transparent",
                          color: "var(--color-primary)",
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: "pointer",
                          textDecoration: "none",
                        }}
                      >
                        <FiExternalLink size={12} /> Xem
                      </a>
                      {canUploadBangChung && (
                        <button
                          onClick={() => handleXoaBangChung(bc.id)}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            padding: "5px 10px",
                            border: "1.5px solid var(--color-danger)",
                            borderRadius: 7,
                            background: "transparent",
                            color: "var(--color-danger)",
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          <FiTrash2 size={12} /> Xóa
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Hóa đơn */}
      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitle}>
            <div
              className={`${styles.sectionAccent} ${styles.sectionAccentBlue}`}
            />
            <FiFileText size={16} style={{ color: "var(--color-primary)" }} />
            Hóa đơn
            {hoaDons.length > 0 && (
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 400,
                  color: "var(--color-text-secondary)",
                  marginLeft: 4,
                }}
              >
                ({hoaDons.length} hóa đơn)
              </span>
            )}
          </div>
        </div>
        <div style={{ padding: "8px 0" }}>
          {/* Hóa đơn tạm tính — hiện sau khi duyệt 2 lần, chưa có hóa đơn thật */}
          {showTamTinh && hoaDons.length === 0 && (
            <div
              style={{
                border: "2px dashed var(--color-primary)",
                borderRadius: 10,
                overflow: "hidden",
                marginBottom: 12,
              }}
            >
              {/* Header */}
              <div
                style={{
                  padding: "10px 14px",
                  background: "linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)",
                  borderBottom: "1px solid var(--color-border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span
                    style={{
                      padding: "3px 10px",
                      borderRadius: 20,
                      fontSize: 11,
                      fontWeight: 700,
                      background: "var(--color-primary)",
                      color: "white",
                    }}
                  >
                    HÓA ĐƠN TẠM TÍNH
                  </span>
                  <strong style={{ fontSize: 13 }}>{donHang.maDonHang}</strong>
                  <span
                    style={{
                      fontSize: 12,
                      color: "var(--color-text-secondary)",
                    }}
                  >
                    {new Date().toLocaleDateString("vi-VN")}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    onClick={() => navigate(`/in-tam-tinh/${donHang.id}`)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "5px 10px",
                      border: "1.5px solid var(--color-primary)",
                      borderRadius: 7,
                      background: "transparent",
                      color: "var(--color-primary)",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    <FiPrinter size={12} /> In tạm tính
                  </button>
                  <button
                    onClick={() => {
                      if (navigator.share) {
                        navigator.share({
                          title: "Hóa đơn tạm tính",
                          text: `Hóa đơn tạm tính ${donHang.maDonHang} - ${formatCurrency(donHang.thanhTien || 0)}`,
                        });
                      } else {
                        navigator.clipboard.writeText(
                          `Hóa đơn tạm tính ${donHang.maDonHang}: ${formatCurrency(donHang.thanhTien || 0)}`,
                        );
                      }
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "5px 10px",
                      border: "1.5px solid var(--color-border)",
                      borderRadius: 7,
                      background: "transparent",
                      color: "var(--color-text-secondary)",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    <FiDownload size={12} /> Gửi khách
                  </button>
                </div>
              </div>

              {/* Body */}
              <div style={{ padding: "12px 14px" }}>
                {/* Thông tin cơ bản */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: 8,
                    marginBottom: 12,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: "var(--color-primary)",
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                        marginBottom: 4,
                      }}
                    >
                      Khách hàng
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>
                      {donHang.tenKhachHang}
                    </div>
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: "var(--color-primary)",
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                        marginBottom: 4,
                      }}
                    >
                      Địa chỉ công trình
                    </div>
                    <div style={{ fontSize: 13 }}>{donHang.diaChiNhan}</div>
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: "var(--color-primary)",
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                        marginBottom: 4,
                      }}
                    >
                      Mác bê tông
                    </div>
                    <div style={{ fontSize: 13 }}>{donHang.tenMacBeTong}</div>
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: "var(--color-primary)",
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                        marginBottom: 4,
                      }}
                    >
                      Ngày duyệt
                    </div>
                    <div style={{ fontSize: 13 }}>
                      {donHang.ngayDuyet
                        ? new Date(donHang.ngayDuyet).toLocaleDateString("vi-VN")
                        : "—"}
                    </div>
                  </div>
                </div>

                {/* Bảng chi tiết tạm tính */}
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: 12,
                    marginBottom: 8,
                    borderRadius: 6,
                    overflow: "hidden",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        background: "var(--color-primary)",
                        color: "white",
                      }}
                    >
                      <th
                        style={{
                          padding: "6px 8px",
                          textAlign: "left",
                          fontWeight: 700,
                          fontSize: 11,
                        }}
                      >
                        Nội dung
                      </th>
                      <th
                        style={{
                          padding: "6px 8px",
                          textAlign: "right",
                          fontWeight: 700,
                          fontSize: 11,
                        }}
                      >
                        Khối lượng
                      </th>
                      <th
                        style={{
                          padding: "6px 8px",
                          textAlign: "right",
                          fontWeight: 700,
                          fontSize: 11,
                        }}
                      >
                        Đơn giá
                      </th>
                      <th
                        style={{
                          padding: "6px 8px",
                          textAlign: "right",
                          fontWeight: 700,
                          fontSize: 11,
                        }}
                      >
                        Thành tiền
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      style={{
                        borderBottom: "1px solid var(--color-border)",
                      }}
                    >
                      <td style={{ padding: "6px 8px" }}>
                        Bê tông thương phẩm
                      </td>
                      <td
                        style={{
                          padding: "6px 8px",
                          textAlign: "right",
                        }}
                      >
                        {donHang.khoiLuongDat?.toLocaleString("vi-VN")} m³
                      </td>
                      <td
                        style={{
                          padding: "6px 8px",
                          textAlign: "right",
                        }}
                      >
                        {formatCurrency(donHang.donGia || 0)}
                      </td>
                      <td
                        style={{
                          padding: "6px 8px",
                          textAlign: "right",
                          fontWeight: 600,
                        }}
                      >
                        {formatCurrency(donHang.thanhTien || 0)}
                      </td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr style={{ background: "#f0f4ff" }}>
                      <td
                        colSpan={3}
                        style={{
                          padding: "7px 8px",
                          textAlign: "right",
                          fontWeight: 700,
                          fontSize: 13,
                        }}
                      >
                        TỔNG CỘNG (TẠM TÍNH)
                      </td>
                      <td
                        style={{
                          padding: "7px 8px",
                          textAlign: "right",
                          fontWeight: 700,
                          fontSize: 14,
                          color: "var(--color-primary)",
                        }}
                      >
                        {formatCurrency(donHang.thanhTien || 0)}
                      </td>
                    </tr>
                  </tfoot>
                </table>

                {/* Ghi chú */}
                <div
                  style={{
                    fontSize: 12,
                    color: "#92400e",
                    background: "#fffbeb",
                    border: "1px solid #f59e0b",
                    borderRadius: 6,
                    padding: "6px 10px",
                  }}
                >
                  Đây là hóa đơn tạm tính. Hóa đơn chính thức sẽ được xuất sau khi thanh toán.
                </div>
              </div>
            </div>
          )}
          {hoaDons.length === 0 ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                color: "var(--color-text-secondary)",
                fontSize: 14,
              }}
            >
              <FiAlertCircle size={16} />
              Chưa có hóa đơn nào
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {sortedHoaDons.map((hd, idx) => {
                const debtLabel = getDebtInvoiceStepLabel(sortedHoaDons, hd.id);
                return (
                <div
                  key={hd.id}
                  style={{
                    border: "1px solid var(--color-border)",
                    borderRadius: 10,
                    overflow: "hidden",
                  }}
                >
                  {/* Header hóa đơn */}
                  <div
                    style={{
                      padding: "10px 14px",
                      background: "var(--color-bg)",
                      borderBottom: "1px solid var(--color-border)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        flexWrap: "wrap",
                      }}
                    >
                      <strong style={{ fontSize: 13 }}>
                        {debtLabel || `HĐ #${idx + 1}`}
                      </strong>
                      <span
                        style={{
                          fontSize: 12,
                          color: "var(--color-text-secondary)",
                          fontWeight: 600,
                        }}
                      >
                        {hd.maHoaDon}
                      </span>
                      {hd.ngayLap && (
                        <span
                          style={{
                            fontSize: 12,
                            color: "var(--color-text-secondary)",
                          }}
                        >
                          {new Date(hd.ngayLap).toLocaleDateString("vi-VN")}
                        </span>
                      )}
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: 20,
                          fontSize: 11,
                          fontWeight: 700,
                          background:
                            hd.loaiThanhToan === "tra_het"
                              ? "rgba(34,197,94,0.12)"
                              : "rgba(255,152,0,0.12)",
                          color:
                            hd.loaiThanhToan === "tra_het"
                              ? "var(--color-success)"
                              : "var(--color-warning)",
                        }}
                      >
                        {hd.loaiThanhToan === "tra_het" || hd.loaiThanhToan === "tra_het_du"
                          ? "Trả hết"
                          : debtLabel || "Công nợ"}
                      </span>
                      {hd.loaiThanhToan === "cong_no" && hd.hanTraCongNo && (
                        <span
                          style={{
                            fontSize: 11,
                            color: "#e53935",
                            fontWeight: 600,
                          }}
                        >
                          Hạn:{" "}
                          {new Date(hd.hanTraCongNo).toLocaleDateString(
                            "vi-VN",
                          )}
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        onClick={() => navigate(`/in-hoa-don/${hd.id}`)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          padding: "5px 10px",
                          border: "1.5px solid var(--color-primary)",
                          borderRadius: 7,
                          background: "transparent",
                          color: "var(--color-primary)",
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: "pointer",
                          fontFamily: "inherit",
                        }}
                      >
                        <FiPrinter size={12} /> In
                      </button>
                      <button
                        onClick={() => navigate(`/in-hoa-don/${hd.id}`)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          padding: "5px 10px",
                          border: "1.5px solid var(--color-border)",
                          borderRadius: 7,
                          background: "transparent",
                          color: "var(--color-text-secondary)",
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: "pointer",
                          fontFamily: "inherit",
                        }}
                      >
                        <FiDownload size={12} /> Tải
                      </button>
                    </div>
                  </div>

                  {/* Thông tin chi tiết */}
                  <div style={{ padding: "10px 14px" }}>
                    {/* Thông tin khách + sản phẩm */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit, minmax(180px, 1fr))",
                        gap: 8,
                        marginBottom: 8,
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: "var(--color-primary)",
                            textTransform: "uppercase",
                            letterSpacing: 0.5,
                            marginBottom: 4,
                          }}
                        >
                          Khách hàng
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>
                          {hd.khachHang}
                        </div>
                      </div>
                      <div>
                        <div
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: "var(--color-primary)",
                            textTransform: "uppercase",
                            letterSpacing: 0.5,
                            marginBottom: 4,
                          }}
                        >
                          Loại xi măng
                        </div>
                        <div style={{ fontSize: 13 }}>
                          {hd.loaiXiMang || "—"}
                        </div>
                      </div>
                      <div>
                        <div
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: "var(--color-primary)",
                            textTransform: "uppercase",
                            letterSpacing: 0.5,
                            marginBottom: 4,
                          }}
                        >
                          Giờ đổ
                        </div>
                        <div style={{ fontSize: 13 }}>
                          {hd.gioDo
                            ? new Date(hd.gioDo).toLocaleString("vi-VN")
                            : "—"}
                        </div>
                      </div>
                      <div>
                        <div
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: "var(--color-primary)",
                            textTransform: "uppercase",
                            letterSpacing: 0.5,
                            marginBottom: 4,
                          }}
                        >
                          Phương thức TT
                        </div>
                        <div style={{ fontSize: 13 }}>
                          {hd.phuongThucThanhToan === "chuyen_khoan"
                            ? "Chuyển khoản"
                            : "Tiền mặt"}
                        </div>
                      </div>
                    </div>

                    {/* Bảng chi tiết */}
                    <table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        fontSize: 12,
                        marginBottom: 8,
                        borderRadius: 6,
                        overflow: "hidden",
                        border: "1px solid var(--color-border)",
                      }}
                    >
                      <thead>
                        <tr
                          style={{
                            background: "var(--color-primary)",
                            color: "white",
                          }}
                        >
                          <th
                            style={{
                              padding: "6px 8px",
                              textAlign: "left",
                              fontWeight: 700,
                              fontSize: 11,
                            }}
                          >
                            Nội dung
                          </th>
                          <th
                            style={{
                              padding: "6px 8px",
                              textAlign: "right",
                              fontWeight: 700,
                              fontSize: 11,
                            }}
                          >
                            Đơn giá
                          </th>
                          <th
                            style={{
                              padding: "6px 8px",
                              textAlign: "right",
                              fontWeight: 700,
                              fontSize: 11,
                            }}
                          >
                            Thành tiền
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr
                          style={{
                            borderBottom: "1px solid var(--color-border)",
                          }}
                        >
                          <td style={{ padding: "6px 8px" }}>
                            Bê tông thương phẩm
                          </td>
                          <td
                            style={{ padding: "6px 8px", textAlign: "right" }}
                          >
                            {hd.tienBeTong?.toLocaleString("vi-VN")} đ
                          </td>
                          <td
                            style={{
                              padding: "6px 8px",
                              textAlign: "right",
                              fontWeight: 600,
                            }}
                          >
                            {hd.tienBeTong?.toLocaleString("vi-VN")} đ
                          </td>
                        </tr>
                        {(hd.buuVanChuyen || 0) > 0 && (
                          <tr
                            style={{
                              borderBottom: "1px solid var(--color-border)",
                            }}
                          >
                            <td
                              style={{
                                padding: "6px 8px",
                                color: "var(--color-text-secondary)",
                              }}
                            >
                              Bù vận chuyển
                            </td>
                            <td
                              style={{ padding: "6px 8px", textAlign: "right" }}
                            ></td>
                            <td
                              style={{
                                padding: "6px 8px",
                                textAlign: "right",
                                fontWeight: 600,
                              }}
                            >
                              {hd.buuVanChuyen?.toLocaleString("vi-VN")} đ
                            </td>
                          </tr>
                        )}
                        {(hd.phiPhatSinh || 0) > 0 && (
                          <tr
                            style={{
                              borderBottom: "1px solid var(--color-border)",
                            }}
                          >
                            <td
                              style={{
                                padding: "6px 8px",
                                color: "var(--color-text-secondary)",
                              }}
                            >
                              Chi phí phát sinh
                            </td>
                            <td
                              style={{ padding: "6px 8px", textAlign: "right" }}
                            ></td>
                            <td
                              style={{
                                padding: "6px 8px",
                                textAlign: "right",
                                fontWeight: 600,
                              }}
                            >
                              {hd.phiPhatSinh?.toLocaleString("vi-VN")} đ
                            </td>
                          </tr>
                        )}
                        {(hd.giamTru || 0) > 0 && (
                          <tr
                            style={{
                              borderBottom: "1px solid var(--color-border)",
                            }}
                          >
                            <td
                              style={{
                                padding: "6px 8px",
                                color: "var(--color-text-secondary)",
                              }}
                            >
                              Giảm trừ / Khuyến mãi
                            </td>
                            <td
                              style={{ padding: "6px 8px", textAlign: "right" }}
                            ></td>
                            <td
                              style={{
                                padding: "6px 8px",
                                textAlign: "right",
                                fontWeight: 600,
                                color: "var(--color-success)",
                              }}
                            >
                              -{hd.giamTru?.toLocaleString("vi-VN")} đ
                            </td>
                          </tr>
                        )}
                      </tbody>
                      <tfoot>
                        <tr style={{ background: "#f0f4ff" }}>
                          <td
                            colSpan={2}
                            style={{
                              padding: "7px 8px",
                              textAlign: "right",
                              fontWeight: 700,
                              fontSize: 13,
                            }}
                          >
                            TỔNG CỘNG
                          </td>
                          <td
                            style={{
                              padding: "7px 8px",
                              textAlign: "right",
                              fontWeight: 700,
                              fontSize: 14,
                              color: "var(--color-primary)",
                            }}
                          >
                            {hd.tongCong?.toLocaleString("vi-VN")} đ
                          </td>
                        </tr>
                      </tfoot>
                    </table>

                    {/* Ghi chú */}
                    {hd.ghiChu && (
                      <div
                        style={{
                          fontSize: 12,
                          color: "#92400e",
                          background: "#fffbeb",
                          border: "1px solid #f59e0b",
                          borderRadius: 6,
                          padding: "6px 10px",
                          marginTop: 4,
                        }}
                      >
                        <strong>Ghi chú:</strong> {hd.ghiChu}
                      </div>
                    )}
                  </div>
                </div>
              );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
      <div
        style={{
          position: "fixed",
          top: 20,
          right: 20,
          zIndex: 300,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            style={{
              padding: "12px 16px",
              borderRadius: 8,
              boxShadow: "var(--shadow-md)",
              fontSize: 13,
              fontWeight: 500,
              display: "flex",
              alignItems: "center",
              gap: 10,
              background:
                t.type === "error"
                  ? "var(--color-danger)"
                  : "var(--color-success)",
              color: "white",
              minWidth: 280,
              animation: "taSlideIn 0.3s ease",
            }}
          >
            {t.message}
          </div>
        ))}
      </div>

      {/* Modal từ chối */}
      <ConfirmModal
        isOpen={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        onConfirm={handleTuChoi}
        title="Từ chối đơn hàng"
        message="Bạn có chắc muốn từ chối đơn hàng này? Vui lòng nhập lý do."
        confirmText="Xác nhận từ chối"
        cancelText="Hủy"
        type="warning"
        loading={rejectLoading}
        extra={
          <div style={{ marginTop: 16, textAlign: "left" }}>
            <label
              style={{
                fontSize: 13,
                fontWeight: 600,
                display: "block",
                marginBottom: 6,
              }}
            >
              Lý do từ chối *
            </label>
            <textarea
              style={{
                width: "100%",
                padding: "9px 12px",
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                fontSize: 14,
                fontFamily: "inherit",
                resize: "vertical",
                minHeight: 80,
                boxSizing: "border-box",
              }}
              value={lyDoTuChoi}
              onChange={(e) => setLyDoTuChoi(e.target.value)}
              placeholder="VD: Khách hàng chưa thanh toán đơn cũ..."
              autoFocus
            />
          </div>
        }
      />

      {/* Modal xóa */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleXoa}
        title="Xóa đơn hàng"
        message={`Bạn có chắc muốn xóa đơn hàng "${donHang.maDonHang}"? Hành động này không thể hoàn tác.`}
        confirmText="Xóa"
        cancelText="Hủy"
        type="danger"
        loading={deleteLoading}
      />

      {/* ========== MODAL: Chọn tùy chọn bằng chứng ========== */}
      <Modal
        isOpen={bangChungOptionModalOpen}
        onClose={() => setBangChungOptionModalOpen(false)}
        title={`Bằng chứng đơn hàng - ${donHang.maDonHang}`}
      >
        <p style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 20, textAlign: "center" }}>
          Chọn hình thức ghi nhận bằng chứng cho đơn hàng này
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <button
            className={styles.optionBtn}
            onClick={handleChonUploadFileBangChung}
          >
            <div className={styles.optionBtnIcon}>
              <FiUpload size={28} />
            </div>
            <div>
              <div className={styles.optionBtnTitle}>Upload file</div>
              <div className={styles.optionBtnDesc}>
                Tải lên file hình ảnh, PDF, DOCX
              </div>
            </div>
          </button>
          <button
            className={styles.optionBtn}
            onClick={handleChonCameraBangChung}
          >
            <div className={styles.optionBtnIcon}>
              <FiCamera size={28} />
            </div>
            <div>
              <div className={styles.optionBtnTitle}>Ghi nhận trực tiếp</div>
              <div className={styles.optionBtnDesc}>
                Chụp ảnh tại công trình
              </div>
            </div>
          </button>
        </div>
      </Modal>

      {/* ========== MODAL: Upload file bằng chứng ========== */}
      <Modal
        isOpen={bangChungUploadModalOpen}
        onClose={() => { setBangChungUploadModalOpen(false); setBangChungFiles([]); }}
        title={`Upload bằng chứng - ${donHang.maDonHang}`}
        footer={
          <>
            <button className="btn btn-cancel" onClick={() => { setBangChungUploadModalOpen(false); setBangChungFiles([]); }}>
              Hủy
            </button>
            <button
              className="btn btn-save"
              onClick={handleUploadBangChung}
              disabled={bangChungFiles.length === 0 || bangChungUploadLoading}
            >
              {bangChungUploadLoading ? "Đang tải..." : `Tải lên (${bangChungFiles.length})`}
            </button>
          </>
        }
      >
        <p style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 16 }}>
          Hỗ trợ: <strong>.doc, .docx, .pdf, .jpg, .jpeg, .png</strong>
        </p>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Chọn file (có thể chọn nhiều file)</label>
          <input
            type="file"
            className={styles.formInput}
            accept=".doc,.docx,.pdf,.jpg,.jpeg,.png"
            multiple
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              setBangChungFiles((prev) => [...prev, ...files]);
            }}
          />
        </div>
        {bangChungFiles.length > 0 && (
          <div className={styles.uploadFileList}>
            <div className={styles.uploadFileListHeader}>
              <span>Đã chọn {bangChungFiles.length} file</span>
              <button className={styles.clearAllBtn} onClick={() => setBangChungFiles([])}>
                <FiX size={12} /> Xóa tất cả
              </button>
            </div>
            {bangChungFiles.map((file, idx) => {
              const isImage = file.type.startsWith("image/");
              return (
                <div key={idx} className={styles.uploadFileItem}>
                  <div className={styles.uploadFileIcon}>
                    {isImage ? <FiImage size={16} /> : <FiFile size={16} />}
                  </div>
                  <div className={styles.uploadFileInfo}>
                    <span className={styles.uploadFileName}>{file.name}</span>
                    <span className={styles.uploadFileSize}>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                  </div>
                  <button
                    className={styles.removeFileBtn}
                    onClick={() => setBangChungFiles((prev) => prev.filter((_, i) => i !== idx))}
                  >
                    <FiX size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </Modal>

      {/* ========== MODAL: Camera bằng chứng ========== */}
      <Modal
        isOpen={bangChungCameraModalOpen}
        onClose={() => {
          setBangChungCameraModalOpen(false);
          setCapturedImage(null);
          if (videoRef.current) {
            const stream = videoRef.current.srcObject as MediaStream;
            if (stream) stream.getTracks().forEach((t) => t.stop());
          }
        }}
        title={`Chụp ảnh bằng chứng - ${donHang.maDonHang}`}
        footer={
          <>
            <button
              className="btn btn-cancel"
              onClick={() => {
                setBangChungCameraModalOpen(false);
                setCapturedImage(null);
                if (videoRef.current) {
                  const stream = videoRef.current.srcObject as MediaStream;
                  if (stream) stream.getTracks().forEach((t) => t.stop());
                }
              }}
            >
              Hủy
            </button>
            {capturedImage ? (
              <>
                <button className="btn btn-cancel" onClick={handleRetakeBangChung}>
                  Chụp lại
                </button>
                <button className="btn btn-save" onClick={handleCaptureAndSaveBangChung} disabled={bangChungCameraLoading}>
                  {bangChungCameraLoading ? "Đang lưu..." : "Lưu ảnh"}
                </button>
              </>
            ) : (
              <button className="btn btn-save" onClick={handleCaptureBangChung}>
                <FiCamera size={16} /> Chụp ảnh
              </button>
            )}
          </>
        }
      >
        <div style={{ textAlign: "center" }}>
          {!capturedImage ? (
            <>
              <p style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 12 }}>
                Hướng camera về phía công trình và bấm <strong>Chụp ảnh</strong>
              </p>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{ width: "100%", maxWidth: 400, borderRadius: 12, background: "#000", display: "block", margin: "0 auto" }}
              />
              <canvas ref={canvasRef} style={{ display: "none" }} />
            </>
          ) : (
            <>
              <p style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 12 }}>
                Ảnh đã chụp. Bấm <strong>Chụp lại</strong> để chụp lại hoặc <strong>Lưu ảnh</strong> để xác nhận.
              </p>
              <img
                src={capturedImage}
                alt="Ảnh bằng chứng"
                style={{ width: "100%", maxWidth: 400, borderRadius: 12, border: "2px solid var(--color-success)", display: "block", margin: "0 auto" }}
              />
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
