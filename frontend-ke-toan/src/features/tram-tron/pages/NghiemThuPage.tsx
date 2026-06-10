import { useCallback, useEffect, useRef, useState } from "react";
import {
  FiCamera,
  FiCheck,
  FiCheckCircle,
  FiClock,
  FiExternalLink,
  FiFile,
  FiImage,
  FiSearch,
  FiUpload,
  FiX,
} from "react-icons/fi";
import { EmptyState, Loading, Modal } from "../../../shared/components/Common";
import { usePageRole, useToast } from "../../../shared/hooks";
import {
  layDanhSachDonHang,
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
import { DonHang } from "../../../shared/types";
import styles from "./NghiemThuPage.module.css";

function formatCurrency(v: number) {
  return v?.toLocaleString("vi-VN") + " đ" || "0 đ";
}

type TabType = "can_nghiem_thu" | "da_nghiem_thu";

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

export default function NghiemThuPage() {
  const { hasPermission } = usePageRole();
  const { toasts, showToast } = useToast();
  const [donHangs, setDonHangs] = useState<DonHang[]>([]);
  const [nghiemThus, setNghiemThus] = useState<
    Record<number, BatchNghiemThuResponse[number]>
  >({});
  const [lichSuTT, setLichSuTT] = useState<
    Record<number, BatchThanhToanResponse[number]>
  >({});
  const [loading, setLoading] = useState(true);
  const [tuKhoa, setTuKhoa] = useState("");
  const [tab, setTab] = useState<TabType>("can_nghiem_thu");

  // --- Option modal (chọn upload file / ghi nhận trực tiếp) ---
  const [optionModalOpen, setOptionModalOpen] = useState(false);

  // --- Upload file modal ---
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedDonHang, setSelectedDonHang] = useState<DonHang | null>(
    null,
  );
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadLoading, setUploadLoading] = useState(false);

  // --- Camera capture modal ---
  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [cameraLoading, setCameraLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // --- Thông tin nghiệm thu modal ---
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const [infoLoading, setInfoLoading] = useState(false);
  const [pendingDonHang, setPendingDonHang] = useState<DonHang | null>(null);
  const [infoKyThuat, setInfoKyThuat] = useState("");
  const [infoOmOng, setInfoOmOng] = useState("");
  const [infoBatOng, setInfoBatOng] = useState("");
  // Track files đã upload từ modal upload file (trước khi mở info modal)
  const [uploadedFilesData, setUploadedFilesData] = useState<{ idDonHang: number; files: File[] } | null>(null);

  const canConfirm = hasPermission("nghiemthu.confirm");

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
    setUploadedFilesData(null);
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
        const [batchNT, batchTT] = await Promise.all([
          layNghiemThuBatch(donHangIds),
          layThanhToanBatch(donHangIds),
        ]);

        const ntMap: Record<number, BatchNghiemThuResponse[number]> = {};
        const ttMap: Record<number, BatchThanhToanResponse[number]> = {};
        dhs.forEach((dh: DonHang) => {
          ntMap[dh.id] = batchNT[dh.id] || null;
          ttMap[dh.id] = batchTT[dh.id] || [];
        });
        setNghiemThus(ntMap);
        setLichSuTT(ttMap);
      } else {
        setNghiemThus({});
        setLichSuTT({});
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

  // Bước 3: Xác nhận nghiệm thu + mở modal thông tin
  const hoanTatNghiemThu = async (donHang: DonHang) => {
    // Đóng camera / upload modal
    setCameraModalOpen(false);
    setUploadModalOpen(false);

    // Dừng camera nếu đang chạy
    if (videoRef.current) {
      const stream = videoRef.current.srcObject as MediaStream;
      if (stream) stream.getTracks().forEach((t) => t.stop());
    }

    // Mở modal thông tin nghiệm thu
    setPendingDonHang(donHang);
    setInfoKyThuat("");
    setInfoOmOng("");
    setInfoBatOng("");
    setInfoModalOpen(true);
  };

  // Upload file xong → mở modal nhập 3 trường thông tin
  const handleUploadAndOpenInfo = async () => {
    if (!selectedDonHang || uploadFiles.length === 0) return;
    setUploadLoading(true);
    try {
      await uploadBienBanNghiemThu(selectedDonHang.id, uploadFiles);
      // Lưu lại files đã upload + đơn hàng, mở modal thông tin
      setUploadedFilesData({ idDonHang: selectedDonHang.id, files: uploadFiles });
      setPendingDonHang(selectedDonHang);
      setInfoKyThuat("");
      setInfoOmOng("");
      setInfoBatOng("");
      setUploadModalOpen(false);
      setOptionModalOpen(false);
      setInfoModalOpen(true);
      showToast(`Đã tải ${uploadFiles.length} file. Vui lòng nhập thông tin nghiệm thu.`);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Lỗi tải file",
        "error",
      );
    } finally {
      setUploadLoading(false);
    }
  };

  // Lưu thông tin nghiệm thu + xác nhận (chụp ảnh)
  const handleCaptureAndFinish = async () => {
    if (!selectedDonHang || !capturedImage) return;
    setCameraLoading(true);
    try {
      // Convert dataUrl → File
      const res = await fetch(capturedImage);
      const blob = await res.blob();
      const fileName = `nghiemthu_${selectedDonHang.id}_${Date.now()}.jpg`;
      const file = new File([blob], fileName, { type: "image/jpeg" });

      await uploadAnhNghiemThu(selectedDonHang.id, file);
      await xacNhanNghiemThu(selectedDonHang.id, "da");
      showToast("Đã chụp ảnh và xác nhận nghiệm thu thành công");
      resetAll();
      loadData();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Lỗi tải ảnh",
        "error",
      );
    } finally {
      setCameraLoading(false);
    }
  };

  // Lưu thông tin nghiệm thu (3 trường) + xác nhận nghiệm thu
  // - Nếu có uploadedFilesData → đã upload file ở bước trước → chỉ xác nhận
  // - Nếu có capturedImage → flow camera → cần upload ảnh + xác nhận
  const handleLuuThongTin = async () => {
    if (!pendingDonHang) return;
    setInfoLoading(true);
    try {
      // Upload ảnh chụp nếu có (flow camera)
      if (capturedImage) {
        const res = await fetch(capturedImage);
        const blob = await res.blob();
        const fileName = `nghiemthu_${pendingDonHang.id}_${Date.now()}.jpg`;
        const file = new File([blob], fileName, { type: "image/jpeg" });
        await uploadAnhNghiemThu(pendingDonHang.id, file);
      }

      // Update thông tin kỹ thuật vào LichSanXuat (chỉ khi có nhập)
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

      showToast("Xác nhận nghiệm thu thành công");
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
                Chụp 1 tấm ảnh tại công trình và gửi lên server
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
          setSelectedDonHang(null);
          setUploadFiles([]);
        }}
        title={`Tải biên bản nghiệm thu - ${selectedDonHang?.maDonHang}`}
        footer={
          <>
            <button
              className="btn btn-cancel"
              onClick={() => {
                setUploadModalOpen(false);
                setUploadFiles([]);
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
                await handleUploadAndOpenInfo();
              }}
              disabled={uploadFiles.length === 0 || uploadLoading}
            >
              {uploadLoading ? "Đang tải..." : "Tiếp tục nhập thông tin"}
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
          setSelectedDonHang(null);
        }}
        title={`Chụp ảnh nghiệm thu - ${selectedDonHang?.maDonHang}`}
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
                  onClick={() => hoanTatNghiemThu(selectedDonHang!)}
                >
                  Tiếp tục
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
                <strong> Xác nhận nghiệm thu</strong> để tiếp tục.
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

      {/* ========== MODAL 4: Thông tin nghiệm thu (3 trường) ========== */}
      <Modal
        isOpen={infoModalOpen}
        onClose={() => {
          setInfoModalOpen(false);
          setPendingDonHang(null);
        }}
        title={`Thông tin nghiệm thu - ${pendingDonHang?.maDonHang}`}
        footer={
          <>
            <button
              className="btn btn-cancel"
              onClick={() => {
                setInfoModalOpen(false);
                setPendingDonHang(null);
              }}
            >
              Bỏ qua
            </button>
            <button
              className="btn btn-save"
              onClick={handleLuuThongTin}
              disabled={infoLoading}
            >
              {infoLoading ? "Đang lưu..." : "Lưu thông tin"}
            </button>
          </>
        }
      >
        <p
          style={{
            fontSize: 13,
            color: "var(--color-text-secondary)",
            marginBottom: 20,
          }}
        >
          Nhập thông tin kỹ thuật nghiệm thu. Có thể bỏ qua nếu không cần
          cập nhật.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 16,
          }}
        >
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
