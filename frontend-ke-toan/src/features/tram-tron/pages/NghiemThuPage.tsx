import { useCallback, useEffect, useRef, useState } from "react";
import {
  FiAlertCircle,
  FiCalendar,
  FiCamera,
  FiCheck,
  FiCheckCircle,
  FiClock,
  FiExternalLink,
  FiFile,
  FiImage,
  FiSearch,
  FiTruck,
  FiUpload,
  FiX,
} from "react-icons/fi";
import { EmptyState, Loading, Modal } from "../../../shared/components/Common";
import { useToast } from "../../../shared/hooks";
import {
  layDanhSachDonHang,
  layLichSanXuatBatch,
  layNghiemThuBatch,
  layThanhToanBatch,
  uploadBienBanNghiemThu,
  xacNhanNghiemThu,
  capNhatThongTinNghiemThu,
  uploadAnhNghiemThu,
  BatchNghiemThuResponse,
  BatchThanhToanResponse,
} from "../../../shared/services/api";
import { buildFileUrl } from "../../../shared/utils";
import { formatDateVN } from "../../../shared/utils/dateUtils";
import { DonHang } from "../../../shared/types";
import styles from "./NghiemThuPage.module.css";

function formatCurrency(v: number) {
  return v?.toLocaleString("vi-VN") + " đ" || "0 đ";
}

type TabType = "can_nghiem_thu" | "da_nghiem_thu";

// Mỗi mục trong danh sách file của form nhập thông tin nghiệm thu
// có thể từ 2 nguồn: upload từ máy hoặc chụp từ camera
type NguonFile = "upload" | "camera";

interface FileNghiemThu {
  id: string; // id tạm để React key ổn định
  file: File;
  nguon: NguonFile;
  preview?: string; // object URL cho ảnh (nếu là ảnh)
}

// Parse bienBanFile: có thể là string, string[], hoặc JSON string
function parseBienBanFiles(
  bienBanFile: string | string[] | null | undefined,
): string[] {
  if (!bienBanFile) return [];
  if (Array.isArray(bienBanFile)) return bienBanFile;
  if (typeof bienBanFile === "string") {
    if (bienBanFile.startsWith("[")) {
      try {
        return JSON.parse(bienBanFile);
      } catch {
        return [];
      }
    }
    return [bienBanFile];
  }
  return [];
}

// Sinh id tạm duy nhất
function taoIdTam(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// Convert data URL → File
async function dataUrlSangFile(
  dataUrl: string,
  baseName: string,
): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const ext = blob.type.includes("png") ? "png" : "jpg";
  return new File([blob], `${baseName}_${Date.now()}.${ext}`, {
    type: blob.type || "image/jpeg",
  });
}

export default function NghiemThuPage() {
  const { toasts, showToast } = useToast();
  const [donHangs, setDonHangs] = useState<DonHang[]>([]);
  const [nghiemThus, setNghiemThus] = useState<
    Record<number, BatchNghiemThuResponse[number]>
  >({});
  const [lichSuTT, setLichSuTT] = useState<
    Record<number, BatchThanhToanResponse[number]>
  >({});
  // Map idDonHang → ngày giờ giao thực tế (lấy từ LichSanXuat.ngayXacNhanGiao qua batch)
  // Hiển thị ở card nghiệm thu để kỹ thuật biết đơn đã được giao từ khi nào.
  const [thoiGianGiaoMap, setThoiGianGiaoMap] = useState<
    Record<number, string | null>
  >({});
  const [loading, setLoading] = useState(true);
  const [tuKhoa, setTuKhoa] = useState("");
  const [tab, setTab] = useState<TabType>("can_nghiem_thu");

  // --- Option modal (chọn upload file / ghi nhận trực tiếp) ---
  const [optionModalOpen, setOptionModalOpen] = useState(false);

  // --- Upload file modal ---
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedDonHang, setSelectedDonHang] = useState<DonHang | null>(null);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadLoading, setUploadLoading] = useState(false);

  // --- Camera capture modal ---
  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [cameraLoading, setCameraLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // --- Thông tin nghiệm thu modal (form nhập thông tin + danh sách file) ---
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const [infoLoading, setInfoLoading] = useState(false);
  const [pendingDonHang, setPendingDonHang] = useState<DonHang | null>(null);
  const [infoKyThuat, setInfoKyThuat] = useState("");
  const [infoOmOng, setInfoOmOng] = useState("");
  const [infoBatOng, setInfoBatOng] = useState("");
  // Danh sách file đã ghi nhận (cả từ upload lẫn chụp ảnh) trong phiên hiện tại
  const [danhSachFile, setDanhSachFile] = useState<FileNghiemThu[]>([]);

  // Khi đang trong form thông tin mà muốn chụp thêm ảnh
  const [captureInInfo, setCaptureInInfo] = useState(false);
  // Khi đang trong form thông tin mà muốn upload thêm file
  const [uploadInInfo, setUploadInInfo] = useState(false);

  const userVaiTro = JSON.parse(
    localStorage.getItem("bttd_user") || "{}",
  )?.vaiTro;
  const isKyThuat = userVaiTro === "ky_thuat" || userVaiTro === "admin";

  const resetAll = () => {
    setOptionModalOpen(false);
    setUploadModalOpen(false);
    setSelectedDonHang(null);
    setUploadFiles([]);
    setCapturedImage(null);
    setInfoModalOpen(false);
    setPendingDonHang(null);
    setInfoKyThuat("");
    setInfoOmOng("");
    setInfoBatOng("");
    setDanhSachFile((prev) => {
      // thu hồi object URL ảnh trước khi xoá
      prev.forEach((f) => f.preview && URL.revokeObjectURL(f.preview));
      return [];
    });
    setCaptureInInfo(false);
    setUploadInInfo(false);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [dangGiaoRes, nghiemThuRes] = await Promise.all([
        layDanhSachDonHang(1, 100, "da_giao"),
        layDanhSachDonHang(1, 100, "nghiem_thu"),
      ]);
      const dhs = [
        ...(dangGiaoRes.data || []),
        ...(nghiemThuRes.data || []),
      ];
      setDonHangs(dhs);

      if (dhs.length > 0) {
        const donHangIds = dhs.map((dh: DonHang) => dh.id);
        const [batchNT, batchTT, batchLSX] = await Promise.all([
          layNghiemThuBatch(donHangIds),
          layThanhToanBatch(donHangIds),
          // Lấy thời gian giao thực tế từng đơn (ngayXacNhanGiao của LichSanXuat)
          // 1 đơn có thể có nhiều lịch sản xuất — lấy NGÀY GIAO MUỘN NHẤT
          // (vì đơn chỉ vào tab "nghiệm thu" khi TẤT CẢ các trạm đã giao xong).
          layLichSanXuatBatch(donHangIds).catch(() => ({})),
        ]);

        const ntMap: Record<number, BatchNghiemThuResponse[number]> = {};
        const ttMap: Record<number, BatchThanhToanResponse[number]> = {};
        const tgMap: Record<number, string | null> = {};
        dhs.forEach((dh: DonHang) => {
          ntMap[dh.id] = batchNT[dh.id] || null;
          ttMap[dh.id] = batchTT[dh.id] || [];
          // batchLSX trả theo từng LichSanXuat.id — lấy item có ngayXacNhanGiao mới nhất
          // Nếu API không trả ngayXacNhanGiao (chưa nâng cấp backend) thì fallback null
          // và hiển thị "—" trên UI thay vì crash.
          const lsx = (batchLSX as any)[dh.id];
          tgMap[dh.id] = lsx?.ngayXacNhanGiao || null;
        });
        setNghiemThus(ntMap);
        setLichSuTT(ttMap);
        setThoiGianGiaoMap(tgMap);
      } else {
        setNghiemThus({});
        setLichSuTT({});
        setThoiGianGiaoMap({});
      }
    } catch {
      showToast("Lỗi tải dữ liệu", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    resetAll();
  }, [tab]);

  // Dừng camera khi modal đóng
  useEffect(() => {
    if (!cameraModalOpen && videoRef.current) {
      const stream = videoRef.current.srcObject as MediaStream;
      if (stream) stream.getTracks().forEach((t) => t.stop());
    }
  }, [cameraModalOpen]);

  // Bật camera khi modal mở và video element đã mount
  useEffect(() => {
    if (!cameraModalOpen || !videoRef.current) return;

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
        setCameraModalOpen(false);
      });

    return () => {
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [cameraModalOpen, capturedImage, showToast]);

  const canNghiemThu = donHangs.filter((dh) => {
    const nt = nghiemThus[dh.id];
    return !nt || dh.trangThaiDon === "da_giao";
  });

  const daNghiemThu = donHangs.filter((dh) => {
    const nt = nghiemThus[dh.id];
    return nt && dh.trangThaiDon !== "da_giao";
  });

  const filteredCan = canNghiemThu.filter(
    (dh) =>
      !tuKhoa ||
      dh.maDonHang.toLowerCase().includes(tuKhoa.toLowerCase()) ||
      dh.tenKhachHang.toLowerCase().includes(tuKhoa.toLowerCase()),
  );

  const filteredDa = daNghiemThu.filter(
    (dh) =>
      !tuKhoa ||
      dh.maDonHang.toLowerCase().includes(tuKhoa.toLowerCase()) ||
      dh.tenKhachHang.toLowerCase().includes(tuKhoa.toLowerCase()),
  );

  // Bước 1: Mở option modal
  const handleDaNghiemThu = (dh: DonHang) => {
    setSelectedDonHang(dh);
    setOptionModalOpen(true);
  };

  // Bước 2a: Chọn upload file → mở modal upload
  const handleChonUploadFile = () => {
    setOptionModalOpen(false);
    setUploadFiles([]);
    setUploadModalOpen(true);
  };

  // Bước 2b: Chọn ghi nhận trực tiếp → mở modal camera
  const handleChonGhiNhanTrucTiep = () => {
    setOptionModalOpen(false);
    setCapturedImage(null);
    setCameraModalOpen(true);
  };

  // Chụp ảnh
  const handleCapture = () => {
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
    // Stop camera
    const stream = video.srcObject as MediaStream;
    if (stream) stream.getTracks().forEach((t) => t.stop());
  };

  // Chụp lại
  const handleRetake = () => {
    setCapturedImage(null);
  };

  // Upload file xong → mở modal nhập thông tin
  const handleUploadAndOpenInfo = async () => {
    if (!selectedDonHang || uploadFiles.length === 0) return;
    setUploadLoading(true);
    try {
      await uploadBienBanNghiemThu(selectedDonHang.id, uploadFiles);
      // Thêm các file vừa upload vào danh sách file của form thông tin
      const filesMoi: FileNghiemThu[] = uploadFiles.map((f) => ({
        id: taoIdTam(),
        file: f,
        nguon: "upload" as const,
        preview: f.type.startsWith("image/")
          ? URL.createObjectURL(f)
          : undefined,
      }));
      setDanhSachFile((prev) => [...prev, ...filesMoi]);
      setPendingDonHang(selectedDonHang);
      setInfoKyThuat("");
      setInfoOmOng("");
      setInfoBatOng("");
      setUploadFiles([]);
      setUploadModalOpen(false);
      setOptionModalOpen(false);
      setInfoModalOpen(true);
      showToast(
        `Đã tải ${filesMoi.length} file. Có thể chụp thêm ảnh hoặc hoàn thành.`,
      );
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Lỗi tải file",
        "error",
      );
    } finally {
      setUploadLoading(false);
    }
  };

  // Sau khi chụp xong và bấm "Tiếp tục" trong modal camera
  // → upload ảnh + mở form thông tin nghiệm thu
  const handleCaptureAndOpenInfo = async () => {
    if (!selectedDonHang || !capturedImage) return;
    setCameraLoading(true);
    try {
      const file = await dataUrlSangFile(
        capturedImage,
        `nghiemthu_${selectedDonHang.id}`,
      );
      await uploadAnhNghiemThu(selectedDonHang.id, file);
      // Thêm ảnh vừa chụp vào danh sách file
      const fileMoi: FileNghiemThu = {
        id: taoIdTam(),
        file,
        nguon: "camera",
        preview: capturedImage,
      };
      setDanhSachFile((prev) => [...prev, fileMoi]);
      setPendingDonHang(selectedDonHang);
      setInfoKyThuat("");
      setInfoOmOng("");
      setInfoBatOng("");
      setCapturedImage(null);
      setCameraModalOpen(false);
      setOptionModalOpen(false);
      setInfoModalOpen(true);
      showToast(
        "Đã chụp ảnh. Có thể tải thêm file hoặc hoàn thành.",
      );
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Lỗi lưu ảnh",
        "error",
      );
    } finally {
      setCameraLoading(false);
    }
  };

  // Từ form thông tin: bấm "Tiếp tục tải lên" → mở file picker
  const handleInfoUploadMore = () => {
    setUploadInInfo(true);
    // đóng info form, mở lại upload modal
    setInfoModalOpen(false);
    setUploadFiles([]);
    setUploadModalOpen(true);
  };

  // Khi upload xong trong luồng "tiếp tục tải lên" từ form thông tin
  const handleUploadMoreFromInfo = async () => {
    if (!pendingDonHang || uploadFiles.length === 0) return;
    setUploadLoading(true);
    try {
      await uploadBienBanNghiemThu(pendingDonHang.id, uploadFiles);
      const filesMoi: FileNghiemThu[] = uploadFiles.map((f) => ({
        id: taoIdTam(),
        file: f,
        nguon: "upload" as const,
        preview: f.type.startsWith("image/")
          ? URL.createObjectURL(f)
          : undefined,
      }));
      setDanhSachFile((prev) => [...prev, ...filesMoi]);
      setUploadFiles([]);
      setUploadModalOpen(false);
      setUploadInInfo(false);
      // Quay lại form thông tin
      setInfoModalOpen(true);
      showToast(`Đã tải thêm ${filesMoi.length} file.`);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Lỗi tải file",
        "error",
      );
    } finally {
      setUploadLoading(false);
    }
  };

  // Từ form thông tin: bấm "Tiếp tục chụp ảnh" → mở camera
  const handleInfoCaptureMore = () => {
    setCaptureInInfo(true);
    setInfoModalOpen(false);
    setCapturedImage(null);
    setCameraModalOpen(true);
  };

  // Khi chụp xong trong luồng "tiếp tục chụp ảnh" từ form thông tin
  const handleCaptureMoreFromInfo = async () => {
    if (!pendingDonHang || !capturedImage) return;
    setCameraLoading(true);
    try {
      const file = await dataUrlSangFile(
        capturedImage,
        `nghiemthu_${pendingDonHang.id}`,
      );
      await uploadAnhNghiemThu(pendingDonHang.id, file);
      const fileMoi: FileNghiemThu = {
        id: taoIdTam(),
        file,
        nguon: "camera",
        preview: capturedImage,
      };
      setDanhSachFile((prev) => [...prev, fileMoi]);
      setCapturedImage(null);
      setCameraModalOpen(false);
      setCaptureInInfo(false);
      // Quay lại form thông tin
      setInfoModalOpen(true);
      showToast("Đã chụp thêm 1 ảnh.");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Lỗi lưu ảnh",
        "error",
      );
    } finally {
      setCameraLoading(false);
    }
  };

  // Xoá một file khỏi danh sách file trong form thông tin
  const handleXoaFileKhoiDanhSach = (id: string) => {
    setDanhSachFile((prev) => {
      const target = prev.find((f) => f.id === id);
      if (target?.preview) URL.revokeObjectURL(target.preview);
      return prev.filter((f) => f.id !== id);
    });
  };

  // Hoàn thành nghiệm thu: lưu thông tin + xác nhận
  const handleLuuThongTin = async () => {
    if (!pendingDonHang) return;
    setInfoLoading(true);
    try {
      // Cập nhật thông tin kỹ thuật vào LichSanXuat (chỉ khi có nhập)
      const hasInfo =
        infoKyThuat.trim() || infoOmOng.trim() || infoBatOng.trim();
      if (hasInfo) {
        await capNhatThongTinNghiemThu(pendingDonHang.id, {
          kyThuatCongTrinh: infoKyThuat.trim() || undefined,
          nguoiOmOng: infoOmOng.trim() || undefined,
          nguoiBatOng: infoBatOng.trim() || undefined,
        });
      }

      // Xác nhận nghiệm thu
      await xacNhanNghiemThu(pendingDonHang.id, "da");

      showToast("Hoàn thành nghiệm thu thành công");
      resetAll();
      loadData();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Lỗi lưu thông tin",
        "error",
      );
    } finally {
      setInfoLoading(false);
    }
  };

  // Mở xem chi tiết đơn đã nghiệm thu (upload modal)
  const openUploadFile = (dh: DonHang) => {
    setSelectedDonHang(dh);
    setUploadFiles([]);
    setUploadModalOpen(true);
  };

  const currentList = tab === "can_nghiem_thu" ? filteredCan : filteredDa;

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <div className={styles.pageHeaderTitle}>Nghiệm thu đơn hàng</div>
          <div className={styles.pageHeaderDesc}>
            Chỉ hiển thị đơn hàng đã giao thành công
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${tab === "can_nghiem_thu" ? styles.tabActive : ""}`}
          onClick={() => setTab("can_nghiem_thu")}
        >
          <FiClock size={14} /> Cần nghiệm thu ({filteredCan.length})
        </button>
        <button
          className={`${styles.tab} ${tab === "da_nghiem_thu" ? styles.tabActive : ""}`}
          onClick={() => setTab("da_nghiem_thu")}
        >
          <FiCheckCircle size={14} /> Đã nghiệm thu ({filteredDa.length})
        </button>
      </div>

      <div className={styles.filterBar}>
        <div className={styles.filterBarLeft}>
          <div className={styles.filterSearch}>
            <FiSearch className={styles.filterSearchIcon} />
            <input
              className={styles.filterSearchInput}
              placeholder="Tìm đơn hàng..."
              value={tuKhoa}
              onChange={(e) => setTuKhoa(e.target.value)}
            />
          </div>
          {tuKhoa && (
            <button
              className={styles.filterClearBtn}
              onClick={() => setTuKhoa("")}
            >
              <FiX size={13} /> Xóa lọc
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <Loading />
      ) : currentList.length === 0 ? (
        <div className={styles.card}>
          <EmptyState
            icon={tab === "can_nghiem_thu" ? "📋" : "✅"}
            text={
              tab === "can_nghiem_thu"
                ? "Không có đơn cần nghiệm thu"
                : "Không có đơn đã nghiệm thu"
            }
          />
        </div>
      ) : (
        <div className={styles.cardGrid}>
          {currentList.map((dh) => {
            const nt = nghiemThus[dh.id];
            const thanhToans = lichSuTT[dh.id] || [];
            const daTT = thanhToans.reduce((sum, t) => sum + t.soTien, 0);
            const isDaNT = tab === "da_nghiem_thu";
            const bienBanFiles = parseBienBanFiles(nt?.bienBanFile);

            return (
              <div
                key={dh.id}
                className={`${styles.cardGridItem} ${isDaNT ? styles.cardGridItemSuccess : styles.cardGridItemInfo}`}
              >
                <div className={styles.cardBody}>
                  <div className={styles.cardGridHeader}>
                    <span className={styles.cardGridTitle}>{dh.maDonHang}</span>
                    <div className={styles.cardGridStatus}>
                      <span
                        className={`${styles.statusDot} ${isDaNT ? styles.statusDotSuccess : styles.statusDotWarning}`}
                      />
                      <span
                        className={`${styles.badge} ${isDaNT ? styles.badgeDaNghiemThu : styles.badgeChoNghiemThu}`}
                      >
                        {isDaNT ? "Đã nghiệm thu" : "Cần nghiệm thu"}
                      </span>
                    </div>
                  </div>

                  <div className={styles.cardGridMeta}>
                    <strong>{dh.tenKhachHang}</strong>
                  </div>
                  <div className={styles.cardGridMetaSecondary}>
                    {dh.diaChiNhan}
                  </div>

                  <div className={styles.cardGridDateList}>
                    <div className={styles.cardGridDateItem}>
                      <FiCalendar size={12} />
                      <span>Tạo đơn:</span>
                      <strong>{formatDateVN(dh.ngayTaoDon)}</strong>
                    </div>
                    <div className={styles.cardGridDateItem}>
                      <FiClock size={12} />
                      <span>Dự kiến giao:</span>
                      <strong>
                        {formatDateVN(
                          dh.thoiGianGiaoDuKien || dh.ngayGiao || null,
                        )}
                      </strong>
                    </div>
                    {thoiGianGiaoMap[dh.id] && (
                      <div
                        className={`${styles.cardGridDateItem} ${styles.cardGridDateItemActual}`}
                      >
                        <FiCheckCircle size={12} />
                        <span>Đã giao thực tế:</span>
                        <strong>{formatDateVN(thoiGianGiaoMap[dh.id])}</strong>
                      </div>
                    )}
                  </div>

                  <div className={styles.cardGridDivider} />

                  <div className={styles.cardGridValue}>
                    {dh.tenMacBeTong} &bull;{" "}
                    <strong>{formatCurrency(dh.thanhTien || 0)}</strong>
                  </div>
                  <div className={styles.cardGridValueSmall}>
                    KL đặt: {dh.khoiLuongDat} m³
                    {dh.khoiLuongThucTe && (
                      <>
                        {" "}
                        &bull; KL thực tế:{" "}
                        <strong>{dh.khoiLuongThucTe} m³</strong>
                      </>
                    )}
                  </div>

                  {nt && (
                    <div className={styles.infoBox}>
                      <div className={styles.infoBoxRow}>
                        <div>
                          <div className={styles.infoBoxLabel}>
                            Đã thanh toán
                          </div>
                          <div
                            className={`${styles.infoBoxValue} ${styles.infoBoxValueSuccess}`}
                          >
                            {formatCurrency(daTT)}
                          </div>
                        </div>
                        <div>
                          <div className={styles.infoBoxLabel}>Giá trị đơn</div>
                          <div
                            className={`${styles.infoBoxValue} ${styles.infoBoxValueHighlight}`}
                          >
                            {formatCurrency(dh.thanhTien || 0)}
                          </div>
                        </div>
                      </div>

                      {/* Biên bản / Ảnh nghiệm thu */}
                      {bienBanFiles.length > 0 && (
                        <div className={styles.infoBoxRow}>
                          <div>
                            <div className={styles.infoBoxLabel}>
                              Biên bản / Ảnh (
                              {bienBanFiles.length})
                            </div>
                            <div className={styles.bienBanFileList}>
                              {bienBanFiles.map((fileUrl, idx) => {
                                const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(
                                  fileUrl,
                                );
                                return (
                                  <a
                                    key={idx}
                                    href={buildFileUrl(fileUrl)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={styles.bienBanLink}
                                  >
                                    {isImage ? (
                                      <FiImage size={12} />
                                    ) : (
                                      <FiExternalLink size={12} />
                                    )}{" "}
                                    {isImage ? "Ảnh" : "File"} {idx + 1}
                                  </a>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className={styles.cardGridFooter}>
                  {!isDaNT && isKyThuat && (
                    <button
                      className="btn btn-save"
                      onClick={() => handleDaNghiemThu(dh)}
                    >
                      <FiCheck /> Đã nghiệm thu
                    </button>
                  )}
                  {isDaNT && bienBanFiles.length > 0 && (
                    <div className={styles.bienBanMultiLinks}>
                      {bienBanFiles.map((fileUrl, idx) => {
                        const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(
                          fileUrl,
                        );
                        return (
                          <a
                            key={idx}
                            href={buildFileUrl(fileUrl)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.bienBanLink}
                          >
                            {isImage ? (
                              <FiImage size={14} />
                            ) : (
                              <FiExternalLink size={14} />
                            )}{" "}
                            {isImage ? "Ảnh" : "File"} {idx + 1}
                          </a>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========== MODAL 1: Chọn tùy chọn ========== */}
      <Modal
        isOpen={optionModalOpen}
        onClose={() => {
          setOptionModalOpen(false);
          setSelectedDonHang(null);
        }}
        title={`Nghiệm thu - ${selectedDonHang?.maDonHang}`}
      >
        <p
          style={{
            fontSize: 13,
            color: "var(--color-text-secondary)",
            marginBottom: 20,
            textAlign: "center",
          }}
        >
          Chọn hình thức ghi nhận nghiệm thu cho đơn hàng này
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <button
            className={styles.optionBtn}
            onClick={handleChonUploadFile}
          >
            <div className={styles.optionBtnIcon}>
              <FiUpload size={28} />
            </div>
            <div>
              <div className={styles.optionBtnTitle}>Upload file biên bản</div>
              <div className={styles.optionBtnDesc}>
                Tải lên file .doc, .pdf, .jpg đã ký với khách hàng
              </div>
            </div>
          </button>
          <button
            className={styles.optionBtn}
            onClick={handleChonGhiNhanTrucTiep}
          >
            <div className={styles.optionBtnIcon}>
              <FiCamera size={28} />
            </div>
            <div>
              <div className={styles.optionBtnTitle}>Ghi nhận trực tiếp</div>
              <div className={styles.optionBtnDesc}>
                Chụp 1 tấm ảnh tại công trình và gửi lên hệ thống
              </div>
            </div>
          </button>
        </div>
      </Modal>

      {/* ========== MODAL 2: Upload file ========== */}
      <Modal
        isOpen={uploadModalOpen}
        onClose={() => {
          setUploadModalOpen(false);
          // Nếu đang trong luồng "tiếp tục tải lên" từ form thông tin
          // mà huỷ thì quay lại form thông tin
          if (uploadInInfo && pendingDonHang) {
            setInfoModalOpen(true);
          } else {
            setSelectedDonHang(null);
          }
          setUploadFiles([]);
          setUploadInInfo(false);
        }}
        title={
          uploadInInfo
            ? `Tải thêm file - ${pendingDonHang?.maDonHang}`
            : `Tải biên bản nghiệm thu - ${selectedDonHang?.maDonHang}`
        }
        footer={
          <>
            <button
              className="btn btn-cancel"
              onClick={() => {
                setUploadModalOpen(false);
                if (uploadInInfo && pendingDonHang) {
                  setInfoModalOpen(true);
                } else {
                  setSelectedDonHang(null);
                }
                setUploadFiles([]);
                setUploadInInfo(false);
              }}
            >
              Hủy
            </button>
            <button
              className="btn btn-save"
              onClick={async () => {
                if (uploadFiles.length === 0) {
                  showToast("Vui lòng chọn ít nhất 1 file", "error");
                  return;
                }
                if (uploadInInfo) {
                  await handleUploadMoreFromInfo();
                } else {
                  await handleUploadAndOpenInfo();
                }
              }}
              disabled={uploadFiles.length === 0 || uploadLoading}
            >
              {uploadLoading
                ? "Đang tải..."
                : uploadInInfo
                  ? `Tải thêm (${uploadFiles.length})`
                  : "Tiếp tục nhập thông tin"}
            </button>
          </>
        }
      >
        <p
          style={{
            fontSize: 13,
            color: "var(--color-text-secondary)",
            marginBottom: 16,
          }}
        >
          Hỗ trợ: <strong>.doc, .docx, .pdf, .jpg, .jpeg, .png</strong> (tối
          đa 10 file, 50MB/file)
        </p>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>
            Chọn file biên bản nghiệm thu (có thể chọn nhiều file)
          </label>
          <input
            type="file"
            className={styles.formInput}
            accept=".doc,.docx,.pdf,.jpg,.jpeg,.png"
            multiple
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              setUploadFiles((prev) => [...prev, ...files]);
            }}
          />
        </div>

        {uploadFiles.length > 0 && (
          <div className={styles.uploadFileList}>
            <div className={styles.uploadFileListHeader}>
              <span>Đã chọn {uploadFiles.length} file</span>
              <button
                className={styles.clearAllBtn}
                onClick={() => setUploadFiles([])}
              >
                <FiX size={12} /> Xóa tất cả
              </button>
            </div>
            {uploadFiles.map((file, idx) => {
              const isImage = file.type.startsWith("image/");
              return (
                <div key={idx} className={styles.uploadFileItem}>
                  <div className={styles.uploadFileIcon}>
                    {isImage ? <FiImage size={16} /> : <FiFile size={16} />}
                  </div>
                  <div className={styles.uploadFileInfo}>
                    <span className={styles.uploadFileName}>{file.name}</span>
                    <span className={styles.uploadFileSize}>
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </span>
                  </div>
                  <button
                    className={styles.removeFileBtn}
                    onClick={() =>
                      setUploadFiles((prev) =>
                        prev.filter((_, i) => i !== idx),
                      )
                    }
                  >
                    <FiX size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </Modal>

      {/* ========== MODAL 3: Camera capture ========== */}
      <Modal
        isOpen={cameraModalOpen}
        onClose={() => {
          setCameraModalOpen(false);
          setCapturedImage(null);
          if (videoRef.current) {
            const stream = videoRef.current.srcObject as MediaStream;
            if (stream) stream.getTracks().forEach((t) => t.stop());
          }
          // Nếu đang trong luồng "tiếp tục chụp ảnh" từ form thông tin
          // mà huỷ thì quay lại form thông tin
          if (captureInInfo && pendingDonHang) {
            setInfoModalOpen(true);
          } else {
            setSelectedDonHang(null);
          }
          setCaptureInInfo(false);
        }}
        title={
          captureInInfo
            ? `Chụp thêm ảnh - ${pendingDonHang?.maDonHang}`
            : `Chụp ảnh nghiệm thu - ${selectedDonHang?.maDonHang}`
        }
        footer={
          <>
            <button
              className="btn btn-cancel"
              onClick={() => {
                setCameraModalOpen(false);
                setCapturedImage(null);
                if (videoRef.current) {
                  const stream =
                    videoRef.current.srcObject as MediaStream;
                  if (stream) stream.getTracks().forEach((t) => t.stop());
                }
                if (captureInInfo && pendingDonHang) {
                  setInfoModalOpen(true);
                } else {
                  setSelectedDonHang(null);
                }
                setCaptureInInfo(false);
              }}
            >
              Hủy
            </button>
            {capturedImage ? (
              <>
                <button className="btn btn-cancel" onClick={handleRetake}>
                  Chụp lại
                </button>
                <button
                  className="btn btn-save"
                  onClick={() => {
                    if (captureInInfo) {
                      handleCaptureMoreFromInfo();
                    } else {
                      handleCaptureAndOpenInfo();
                    }
                  }}
                  disabled={cameraLoading}
                >
                  {cameraLoading
                    ? "Đang lưu..."
                    : captureInInfo
                      ? "Lưu ảnh"
                      : "Tiếp tục"}
                </button>
              </>
            ) : (
              <button
                className="btn btn-save"
                onClick={handleCapture}
              >
                <FiCamera size={16} /> Chụp ảnh
              </button>
            )}
          </>
        }
      >
        <div style={{ textAlign: "center" }}>
          {!capturedImage ? (
            <>
              <p
                style={{
                  fontSize: 13,
                  color: "var(--color-text-secondary)",
                  marginBottom: 12,
                }}
              >
                Hướng camera về phía công trình và bấm <strong>Chụp ảnh</strong>
              </p>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{
                  width: "100%",
                  maxWidth: 400,
                  borderRadius: 12,
                  background: "#000",
                  display: "block",
                  margin: "0 auto",
                }}
              />
              <canvas ref={canvasRef} style={{ display: "none" }} />
            </>
          ) : (
            <>
              <p
                style={{
                  fontSize: 13,
                  color: "var(--color-text-secondary)",
                  marginBottom: 12,
                }}
              >
                Ảnh đã chụp. Bấm <strong>Chụp lại</strong> để chụp lại hoặc
                <strong> Tiếp tục</strong> để ghi nhận.
              </p>
              <img
                src={capturedImage}
                alt="Ảnh nghiệm thu"
                style={{
                  width: "100%",
                  maxWidth: 400,
                  borderRadius: 12,
                  border: "2px solid var(--color-success)",
                  display: "block",
                  margin: "0 auto",
                }}
              />
            </>
          )}
        </div>
      </Modal>

      {/* ========== MODAL 4: Form thông tin nghiệm thu ========== */}
      <Modal
        isOpen={infoModalOpen}
        onClose={() => {
          setInfoModalOpen(false);
          setPendingDonHang(null);
        }}
        title={`Hoàn thành nghiệm thu - ${pendingDonHang?.maDonHang}`}
        footer={
          <>
            <button
              className="btn btn-cancel"
              onClick={() => {
                setInfoModalOpen(false);
                setPendingDonHang(null);
              }}
            >
              Đóng
            </button>
            <button
              className="btn btn-save"
              onClick={handleLuuThongTin}
              disabled={infoLoading}
            >
              {infoLoading ? "Đang lưu..." : "Hoàn thành"}
            </button>
          </>
        }
      >
        <p className={styles.infoHint}>
          Tệp đã ghi nhận cho đơn hàng này. Có thể tiếp tục chụp ảnh hoặc tải
          thêm file, hoặc bấm <strong>Hoàn thành</strong> để kết thúc nghiệm thu.
        </p>

        {/* Danh sách file đã ghi nhận (cả upload lẫn chụp ảnh) */}
        <div className={styles.infoSection}>
          <div className={styles.infoSectionHeader}>
            <span className={styles.infoSectionTitle}>
              Tệp nghiệm thu ({danhSachFile.length})
            </span>
            <div className={styles.infoSectionActions}>
              <button
                type="button"
                className={styles.infoActionBtn}
                onClick={handleInfoCaptureMore}
              >
                <FiCamera size={14} /> Tiếp tục chụp ảnh
              </button>
              <button
                type="button"
                className={styles.infoActionBtn}
                onClick={handleInfoUploadMore}
              >
                <FiUpload size={14} /> Tiếp tục tải lên
              </button>
            </div>
          </div>

          {danhSachFile.length === 0 ? (
            <div className={styles.infoEmpty}>
              <FiAlertCircle size={16} />
              <span>Chưa có tệp nào. Hãy chụp ảnh hoặc tải file lên.</span>
            </div>
          ) : (
            <div className={styles.infoFileGrid}>
              {danhSachFile.map((item) => {
                const isImage = item.file.type.startsWith("image/");
                const ext = (item.file.name.split(".").pop() || "FILE")
                  .toUpperCase()
                  .slice(0, 4);
                return (
                  <div
                    key={item.id}
                    className={styles.infoFileCard}
                  >
                    <button
                      type="button"
                      className={styles.infoFileRemove}
                      onClick={() => handleXoaFileKhoiDanhSach(item.id)}
                      title="Xóa file"
                    >
                      <FiX size={14} />
                    </button>
                    <span
                      className={`${styles.infoFileSource} ${
                        item.nguon === "camera"
                          ? styles.infoFileSourceCamera
                          : styles.infoFileSourceUpload
                      }`}
                    >
                      {item.nguon === "camera" ? (
                        <>
                          <FiCamera size={10} /> Chụp ảnh
                        </>
                      ) : (
                        <>
                          <FiUpload size={10} /> Tải lên
                        </>
                      )}
                    </span>
                    {isImage && item.preview ? (
                      <img
                        src={item.preview}
                        alt={item.file.name}
                        className={styles.infoFileThumb}
                      />
                    ) : (
                      <div className={styles.infoFileIconWrap}>
                        <FiFile size={28} />
                        <span className={styles.infoFileExt}>{ext}</span>
                      </div>
                    )}
                    <div className={styles.infoFileInfo}>
                      <span
                        className={styles.infoFileName}
                        title={item.file.name}
                      >
                        {item.file.name}
                      </span>
                      <span className={styles.infoFileSize}>
                        {(item.file.size / 1024 / 1024).toFixed(2)} MB
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Thông tin kỹ thuật */}
        <div className={styles.infoSection}>
          <div className={styles.infoSectionHeader}>
            <span className={styles.infoSectionTitle}>
              Thông tin kỹ thuật
            </span>
          </div>
          <p className={styles.infoHint} style={{ marginBottom: 12 }}>
            Có thể bỏ trống nếu không cần cập nhật.
          </p>
          <div className={styles.infoFormGrid}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Kỹ thuật công trình</label>
              <input
                type="text"
                className={styles.formInput}
                placeholder="Nhập tên kỹ thuật..."
                value={infoKyThuat}
                onChange={(e) => setInfoKyThuat(e.target.value)}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Người ôm ống</label>
              <input
                type="text"
                className={styles.formInput}
                placeholder="Nhập tên người ôm ống..."
                value={infoOmOng}
                onChange={(e) => setInfoOmOng(e.target.value)}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Người bắt ống</label>
              <input
                type="text"
                className={styles.formInput}
                placeholder="Nhập tên người bắt ống..."
                value={infoBatOng}
                onChange={(e) => setInfoBatOng(e.target.value)}
              />
            </div>
          </div>
        </div>
      </Modal>

      <div className={styles.toastContainer}>
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`${styles.toast} ${t.type === "error" ? styles.toastError : styles.toastSuccess}`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}
