import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { FiSave, FiUser, FiTool, FiArrowLeft, FiHome, FiInfo } from 'react-icons/fi';
import {
  layDanhSachDonHang, layDanhSachTramTron,
  layLichSanXuat, taoLichSanXuat, capNhatLichSanXuat,
  goTramKhoiLichSanXuat,
} from '../../../shared/services/api';
import { DonHang, LichSanXuat, TramTron } from '../../../shared/types';
import { useToast } from '../../../shared/hooks';
import { ConfirmModal } from '../../../shared/components/Common';
import styles from './TaoLichSanXuatPage.module.css';

function formatCurrency(v: number) { return v?.toLocaleString('vi-VN') + ' đ' || '0 đ'; }

export default function TaoLichSanXuatPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const idDonHang = id ? parseInt(id) : null;

  // Đọc chế độ từ state - 'tiepTuc' nghĩa là đang thêm trạm mới cho đơn đã có lịch
  const cheDo = (location.state as any)?.cheDo as 'tiepTuc' | undefined;
  const isCheDoTiepTuc = cheDo === 'tiepTuc';

  const { toasts, showToast } = useToast();

  const [tramTrons, setTramTrons] = useState<TramTron[]>([]);
  const [donHang, setDonHang] = useState<DonHang | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showCancel, setShowCancel] = useState(false);

  const [tongKhoiLuongDaTron, setTongKhoiLuongDaTron] = useState(0);
  const [khoiLuongDat, setKhoiLuongDat] = useState(0);

  const [existingLichMap, setExistingLichMap] = useState<Map<number, number>>(new Map());

  const [form, setForm] = useState({
    idTramTron: '', tenTramTron: '',
    kyThuatCongTrinh: '', nguoiOmOng: '', nguoiBatOng: '',
    ghiChu: '',
  });

  const [initialForm, setInitialForm] = useState(form);
  const hasChanges = JSON.stringify(form) !== JSON.stringify(initialForm);

  const [selectedTramIds, setSelectedTramIds] = useState<number[]>([]);
  const [initialSelectedTramIds, setInitialSelectedTramIds] = useState<number[]>([]);
  const tramSelectionDirty = useMemo(() => {
    if (selectedTramIds.length !== initialSelectedTramIds.length) return true;
    const a = [...selectedTramIds].sort((x, y) => x - y);
    const b = [...initialSelectedTramIds].sort((x, y) => x - y);
    return a.some((v, i) => v !== b[i]);
  }, [selectedTramIds, initialSelectedTramIds]);
  const isDirty = hasChanges || tramSelectionDirty;

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [tramRes] = await Promise.all([
          layDanhSachTramTron(),
        ]);
        const uniqueTrams = tramRes.filter((t, idx, arr) =>
          arr.findIndex((x) => x.id === t.id) === idx
        );
        setTramTrons(uniqueTrams);

        if (idDonHang) {
          const dhRes = await layDanhSachDonHang(1, 100, 'da_duyet');
          const found = dhRes.data?.find((d: DonHang) => d.id === idDonHang);
          if (found) setDonHang(found);

          const lichs = await layLichSanXuat(idDonHang);
          if (lichs?.length) {
            // Ưu tiên lấy lịch đã có thông tin tài xế/xe (không null) để hiển thị form
            const lichCoTaiXe = lichs.find((l: any) => l.idXe || l.bienSoXe || l.idTaiXe) || lichs[0];
            const lich = lichCoTaiXe;
            const tram = tramRes.find((t: TramTron) => t.id === lich.idTramTron);

            const tongDaTron = lichs.reduce((sum: number, l: any) => {
              return sum + (l.khoiLuongDaTron || 0);
            }, 0);

            setTongKhoiLuongDaTron(tongDaTron);
            if (found) setKhoiLuongDat(found.khoiLuongDat || 0);

            const allTramIds = lichs
              .map((l: LichSanXuat) => l.idTramTron)
              .filter((id): id is number => id != null);
            const uniqueTramIds = [...new Set(allTramIds)];
            setSelectedTramIds(uniqueTramIds);
            setInitialSelectedTramIds(uniqueTramIds);

            const lichMap = new Map<number, number>();
            lichs.forEach((l: LichSanXuat) => {
              if (l.idTramTron) {
                lichMap.set(l.idTramTron, l.id);
              }
            });
            setExistingLichMap(lichMap);

            setForm({
              idTramTron: lich.idTramTron ? String(lich.idTramTron) : '',
              tenTramTron: tram?.tenTram || '',
              kyThuatCongTrinh: lich.kyThuatCongTrinh || '',
              nguoiOmOng: lich.nguoiOmOng || '',
              nguoiBatOng: lich.nguoiBatOng || '',
              ghiChu: lich.ghiChu || '',
            });
            setInitialForm({
              idTramTron: lich.idTramTron ? String(lich.idTramTron) : '',
              tenTramTron: tram?.tenTram || '',
              kyThuatCongTrinh: lich.kyThuatCongTrinh || '',
              nguoiOmOng: lich.nguoiOmOng || '',
              nguoiBatOng: lich.nguoiBatOng || '',
              ghiChu: lich.ghiChu || '',
            });
          } else {
            setSelectedTramIds([]);
            setInitialSelectedTramIds([]);
            setExistingLichMap(new Map());
            setTongKhoiLuongDaTron(0);
            setKhoiLuongDat(found?.khoiLuongDat || 0);
          }
        }
      } catch {
        showToast('Lỗi tải dữ liệu', 'error');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [idDonHang, showToast]);

  // Auto reload dữ liệu lịch sản xuất mỗi 30s (silent - không block UI)
  // Chỉ refresh existingLichMap/selectedTramIds/tongKhoiLuongDaTron, không đụng form
  // BỎ QUA khi người dùng đang có thay đổi chưa lưu (form dirty) để tránh ghi đè lựa chọn
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;
  useEffect(() => {
    if (!idDonHang) return;
    const interval = setInterval(async () => {
      if (isDirtyRef.current) {
        // Có thay đổi chưa lưu - bỏ qua auto-reload để không ghi đè lựa chọn của người dùng
        return;
      }
      try {
        const lichs = await layLichSanXuat(idDonHang);
        const tongDaTron = (lichs || []).reduce((sum: number, l: any) => {
          return sum + (l.khoiLuongDaTron || 0);
        }, 0);
        setTongKhoiLuongDaTron(tongDaTron);

        const allTramIds = (lichs || [])
          .map((l: LichSanXuat) => l.idTramTron)
          .filter((id): id is number => id != null);
        const uniqueTramIds = [...new Set(allTramIds)];
        setSelectedTramIds(uniqueTramIds);
        setInitialSelectedTramIds(uniqueTramIds);

        const lichMap = new Map<number, number>();
        (lichs || []).forEach((l: LichSanXuat) => {
          if (l.idTramTron) {
            lichMap.set(l.idTramTron, l.id);
          }
        });
        setExistingLichMap(lichMap);
        if (donHang?.khoiLuongDat) setKhoiLuongDat(donHang.khoiLuongDat);
      } catch (err) {
        console.error('Lỗi auto-reload lịch sản xuất:', err);
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [idDonHang]);

  const handleMultiTramToggle = (tramId: number) => {
    setSelectedTramIds((prev) => {
      if (prev.includes(tramId)) {
        return prev.filter((id) => id !== tramId);
      }
      return [...prev, tramId];
    });
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!idDonHang) return;

    if (selectedTramIds.length === 0) {
      showToast('Vui lòng chọn ít nhất một trạm trộn', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const existingTramIds = Array.from(existingLichMap.keys());
      const selectedSet = new Set(selectedTramIds);

      // Ở chế độ "tiếp tục": chỉ thêm trạm mới, KHÔNG gỡ trạm cũ, KHÔNG update trạm cũ
      if (isCheDoTiepTuc) {
        const createTargets = selectedTramIds.filter((id) => !existingLichMap.has(id));
        if (createTargets.length === 0) {
          showToast('Không có trạm mới nào để thêm. Vui lòng chọn trạm chưa có trong lịch.', 'error');
          setSubmitting(false);
          return;
        }
        const createResults = await Promise.allSettled(
          createTargets.map((tramId) => {
            const payload: Partial<LichSanXuat> = {
              idDonHang: idDonHang!,
              idTramTron: tramId,
              kyThuatCongTrinh: form.kyThuatCongTrinh || null,
              nguoiOmOng: form.nguoiOmOng || null,
              nguoiBatOng: form.nguoiBatOng || null,
              ghiChu: form.ghiChu || null,
            };
            return taoLichSanXuat(payload);
          }),
        );
        const createFailures: { tramId: number; reason: unknown }[] = [];
        createTargets.forEach((tramId, idx) => {
          if (createResults[idx].status === "rejected") {
            createFailures.push({ tramId, reason: (createResults[idx] as PromiseRejectedResult).reason });
          }
        });
        if (createFailures.length > 0) {
          const first = createFailures[0];
          const msg = first.reason instanceof Error ? first.reason.message : "Lỗi tạo lịch sản xuất";
          throw new Error(`Tạo mới thất bại ${createFailures.length}/${createTargets.length} trạm: ${msg}`);
        }
        showToast(`Đã thêm ${createTargets.length} trạm trộn mới vào lịch sản xuất.`);
        setTimeout(() => {
          navigate('/dieu-phoi/lich-san-xuat', { state: { refresh: Date.now() } });
        }, 300);
        return;
      }

      // 1. Gỡ các trạm đã bỏ chọn - set idTramTron = NULL, giữ nguyên record lịch
      const removedTramIds: number[] = [];
      for (const tramId of existingTramIds) {
        if (!selectedSet.has(tramId)) {
          const lichId = existingLichMap.get(tramId)!;
          try {
            await goTramKhoiLichSanXuat(lichId);
            removedTramIds.push(tramId);
          } catch (removeErr) {
            throw removeErr;
          }
        }
      }

      // 2. Cập nhật các trạm đã có - chạy song song, gom lỗi
      const updateTargets = selectedTramIds.filter((id) => existingLichMap.has(id));
      const updateResults = await Promise.allSettled(
        updateTargets.map((tramId) => {
          const lichId = existingLichMap.get(tramId)!;
          const payload: Partial<LichSanXuat> = {
            kyThuatCongTrinh: form.kyThuatCongTrinh || null,
            nguoiOmOng: form.nguoiOmOng || null,
            nguoiBatOng: form.nguoiBatOng || null,
            ghiChu: form.ghiChu || null,
          };
          return capNhatLichSanXuat(lichId, payload);
        }),
      );
      const updateFailures = updateResults.filter((r) => r.status === "rejected");
      if (updateFailures.length > 0) {
        const firstReason = (updateFailures[0] as PromiseRejectedResult).reason;
        const msg = firstReason instanceof Error ? firstReason.message : "Lỗi cập nhật lịch sản xuất";
        throw new Error(`Cập nhật thất bại ${updateFailures.length}/${updateResults.length} trạm: ${msg}`);
      }

      // 3. Tạo mới các trạm chưa có - chạy song song, gom lỗi
      const createTargets = selectedTramIds.filter((id) => !existingLichMap.has(id));
      const createdTramIds: number[] = [];
      if (createTargets.length > 0) {
        const createResults = await Promise.allSettled(
          createTargets.map((tramId) => {
            const payload: Partial<LichSanXuat> = {
              idDonHang: idDonHang!,
              idTramTron: tramId,
              kyThuatCongTrinh: form.kyThuatCongTrinh || null,
              nguoiOmOng: form.nguoiOmOng || null,
              nguoiBatOng: form.nguoiBatOng || null,
              ghiChu: form.ghiChu || null,
            };
            return taoLichSanXuat(payload);
          }),
        );
        const createFailures: { tramId: number; reason: unknown }[] = [];
        createTargets.forEach((tramId, idx) => {
          const r = createResults[idx];
          if (r.status === "rejected") {
            createFailures.push({ tramId, reason: r.reason });
          } else {
            createdTramIds.push(tramId);
          }
        });
        if (createFailures.length > 0) {
          const first = createFailures[0];
          const msg = first.reason instanceof Error ? first.reason.message : "Lỗi tạo lịch sản xuất";
          throw new Error(
            `Tạo mới thất bại ${createFailures.length}/${createTargets.length} trạm: ${msg}`,
          );
        }
      }

      // 4. Cập nhật lại state map & danh sách trạm sau khi thao tác xong
      const newSelectedTramIds = selectedTramIds.filter((id) => !removedTramIds.includes(id));
      const newLichMap = new Map<number, number>();

      // Giữ nguyên các trạm đã update (lichId cũ)
      for (const tramId of updateTargets) {
        if (newSelectedTramIds.includes(tramId)) {
          newLichMap.set(tramId, existingLichMap.get(tramId)!);
        }
      }

      // Tra id cho các trạm mới tạo - chạy 1 lần thay vì gọi API cho từng trạm
      if (createdTramIds.length > 0) {
        const lichs = await layLichSanXuat(idDonHang!);
        for (const tramId of createdTramIds) {
          const newLich = lichs.find((l) => l.idTramTron === tramId);
          if (newLich) {
            newLichMap.set(tramId, newLich.id);
          }
        }
      }

      setSelectedTramIds(newSelectedTramIds);
      setInitialSelectedTramIds(newSelectedTramIds);
      setExistingLichMap(newLichMap);
      setInitialForm(form);
      setTimeout(() => {
        navigate('/dieu-phoi/lich-san-xuat', { state: { refresh: Date.now() } });
      }, 300);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Lỗi', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (hasChanges) {
      setShowCancel(true);
    } else {
      navigate('/dieu-phoi/lich-san-xuat', { state: { refresh: Date.now() } });
    }
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.loadingSpinner} />
        <span>Đang tải...</span>
      </div>
    );
  }

  return (
    <div>
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderBack}>
          <button type="button" className={styles.backBtn} onClick={handleCancel}>
            <FiArrowLeft size={18} />
          </button>
          <div>
            <div className={styles.pageHeaderTitle}>
              {isCheDoTiepTuc
                ? 'Tiếp tục lịch sản xuất'
                : existingLichMap.size > 0
                  ? 'Sửa lịch sản xuất'
                  : 'Tạo lịch sản xuất'}
            </div>
            <div className={styles.pageHeaderDesc}>
              {isCheDoTiepTuc
                ? 'Thêm trạm trộn để tiếp tục sản xuất phần còn lại'
                : existingLichMap.size > 0
                  ? 'Cập nhật thông tin lịch sản xuất'
                  : 'Nhập thông tin để tạo lịch sản xuất'}
            </div>
          </div>
        </div>
      </div>

      {donHang && (
        <div className={styles.orderInfoCard}>
          <div className={styles.orderInfoHeader}>
            <div className={styles.orderInfoTitle}>{donHang.maDonHang}</div>
            <div className={styles.orderInfoBadge}>{donHang.tenKhachHang}</div>
          </div>

          {(tongKhoiLuongDaTron > 0 || isCheDoTiepTuc) && (
            <div className={styles.khoiLuongInfo}>
              <div className={styles.khoiLuongItem}>
                <span className={styles.khoiLuongLabel}>Tổng đã trộn</span>
                <span className={styles.khoiLuongValue} style={{ color: '#10b981' }}>
                  {tongKhoiLuongDaTron} m³
                </span>
              </div>
              {khoiLuongDat > 0 && (
                <div className={styles.khoiLuongItem}>
                  <span className={styles.khoiLuongLabel}>Còn lại</span>
                  <span
                    className={styles.khoiLuongValue}
                    style={{ color: Math.max(0, khoiLuongDat - tongKhoiLuongDaTron) > 0 ? '#f59e0b' : '#10b981' }}
                  >
                    {Math.max(0, khoiLuongDat - tongKhoiLuongDaTron)} m³
                  </span>
                </div>
              )}
            </div>
          )}

          <div className={styles.orderInfoGrid}>
            <div className={styles.orderInfoItem}>
              <span className={styles.orderInfoLabel}>Địa chỉ</span>
              <span className={styles.orderInfoValue}>{donHang.diaChiNhan}</span>
            </div>
            <div className={styles.orderInfoItem}>
              <span className={styles.orderInfoLabel}>Mác bê tông</span>
              <span className={styles.orderInfoValue}>{donHang.tenMacBeTong}</span>
            </div>
            <div className={styles.orderInfoItem}>
              <span className={styles.orderInfoLabel}>Khối lượng đặt</span>
              <span className={styles.orderInfoValue}>{donHang.khoiLuongDat} m³</span>
            </div>
            <div className={styles.orderInfoItem}>
              <span className={styles.orderInfoLabel}>Thành tiền</span>
              <span className={`${styles.orderInfoValue} ${styles.orderInfoValueHighlight}`}>
                {formatCurrency(donHang.thanhTien || 0)}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className={styles.card}>
        {/* Banner cảnh báo chế độ tiếp tục */}
        {isCheDoTiepTuc && (
          <div className={styles.tiepTucBanner}>
            <FiInfo size={18} />
            <div>
              <div className={styles.tiepTucBannerTitle}>Chế độ tiếp tục</div>
              <div className={styles.tiepTucBannerDesc}>
                Đơn hàng đã trộn một phần. Hãy chọn thêm trạm trộn để trộn nốt phần còn lại.
                Thông tin tài xế, nhân sự bên dưới sẽ áp dụng cho <strong>trạm mới thêm</strong>.
              </div>
            </div>
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <div className={styles.sectionTitle}>
            <FiHome size={15} /> Thông tin trạm trộn
          </div>
          <div className={styles.tramChecklist}>
            <label className={styles.tramChecklistLabel}>Trạm trộn *</label>
            <div className={styles.tramList}>
              {tramTrons.map((tram) => (
                <label key={tram.id} className={styles.tramItem}>
                  <input
                    type="checkbox"
                    checked={selectedTramIds.includes(tram.id)}
                    onChange={() => handleMultiTramToggle(tram.id)}
                    disabled={submitting}
                    className={styles.checkboxInput}
                  />
                  <span className={styles.checkboxCustom} />
                  <div className={styles.tramItemInfo}>
                    <span className={styles.tramItemName}>{tram.tenTram}</span>
                    {tram.diaChi && (
                      <span className={styles.tramItemAddress}>{tram.diaChi}</span>
                    )}
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className={styles.formDivider} />
          <div className={styles.sectionTitle}>
            <FiUser size={15} /> Thông tin nhân sự
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Kỹ thuật công trình</label>
              <input
                className={styles.formInput}
                value={form.kyThuatCongTrinh}
                onChange={(e) => setForm({ ...form, kyThuatCongTrinh: e.target.value })}
                placeholder="VD: Nguyễn Văn A"
              />
            </div>
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Người ôm ống</label>
              <input
                className={styles.formInput}
                value={form.nguoiOmOng}
                onChange={(e) => setForm({ ...form, nguoiOmOng: e.target.value })}
                placeholder="VD: Trần Văn B"
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Người bắt ống</label>
              <input
                className={styles.formInput}
                value={form.nguoiBatOng}
                onChange={(e) => setForm({ ...form, nguoiBatOng: e.target.value })}
                placeholder="VD: Lê Văn C"
              />
            </div>
          </div>

          <div className={styles.formDivider} />
          <div className={styles.sectionTitle}>
            <FiTool size={15} /> Ghi chú
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Ghi chú lịch sản xuất</label>
            <textarea
              className={styles.formTextarea}
              value={form.ghiChu}
              onChange={(e) => setForm({ ...form, ghiChu: e.target.value })}
              placeholder="VD: Cần xe bơm, đường vào hẹp, liên hệ trước 30 phút..."
              rows={3}
            />
          </div>

          <div className={styles.formActions}>
            <button type="button" className="btn btn-cancel" onClick={handleCancel}>
              Hủy bỏ
            </button>
            <button type="submit" className="btn btn-save" disabled={submitting}>
              <FiSave /> {submitting ? 'Đang lưu...' : (isCheDoTiepTuc ? 'Thêm trạm trộn' : (existingLichMap.size > 0 ? 'Lưu thay đổi' : 'Tạo lịch sản xuất'))}
            </button>
          </div>
        </form>
      </div>

      <ConfirmModal
        isOpen={showCancel}
        onClose={() => setShowCancel(false)}
        onConfirm={() => { setShowCancel(false); navigate('/dieu-phoi/lich-san-xuat', { state: { refresh: Date.now() } }); }}
        message="Bạn có chắc muốn hủy bỏ? Dữ liệu đã nhập sẽ không được lưu."
        confirmText="Hủy bỏ"
        cancelText="Ở lại"
        title="Xác nhận hủy bỏ"
        type="warning"
      />

      <div className={styles.toastContainer}>
        {toasts.map((t) => (
          <div key={t.id} className={`${styles.toast} ${t.type === 'error' ? styles.toastError : styles.toastSuccess}`}>
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}
