import React, { useState, useEffect } from 'react';
import { FiAlertTriangle, FiPlay, FiSquare } from 'react-icons/fi';
import { layTrangThaiBaoTri, batBaoTri, tatBaoTri } from '../../../shared/services/api';
import { MaintenanceStatus } from '../../../shared/types';
import { useToast, usePageRole } from '../../../shared/hooks';
import { Loading } from '../../../shared/components/Common';
import styles from './BaoTriPage.module.css';

export default function BaoTriPage() {
  const { showToast } = useToast();
  const [status, setStatus] = useState<MaintenanceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    noiDung: '',
    thoiGianBatDau: '',
    thoiGianKetThuc: '',
  });

  const loadStatus = async () => {
    try {
      const s = await layTrangThaiBaoTri();
      setStatus(s);
      if (s.isMaintenance) {
        setForm((f) => ({
          ...f,
          noiDung: s.noiDung ?? '',
          thoiGianBatDau: s.thoiGianBatDau?.slice(0, 16) ?? '',
          thoiGianKetThuc: s.thoiGianKetThuc?.slice(0, 16) ?? '',
        }));
      }
    } catch {
      showToast('Không tải được trạng thái bảo trì', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleBatBaoTri = async () => {
    if (!form.noiDung.trim()) {
      showToast('Vui lòng nhập nội dung bảo trì', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await batBaoTri({
        noiDung: form.noiDung.trim(),
        thoiGianBatDau: form.thoiGianBatDau || null,
        thoiGianKetThuc: form.thoiGianKetThuc || null,
      });
      showToast('Đã bật chế độ bảo trì', 'success');
      loadStatus();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Lỗi bật bảo trì', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTatBaoTri = async () => {
    setSubmitting(true);
    try {
      await tatBaoTri();
      showToast('Đã tắt bảo trì — hệ thống hoạt động trở lại', 'success');
      setStatus({ isMaintenance: false, noiDung: null, thoiGianBatDau: null, thoiGianKetThuc: null, daLich: false });
      setForm({ noiDung: '', thoiGianBatDau: '', thoiGianKetThuc: '' });
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Lỗi tắt bảo trì', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Loading />;

  const isOn = status?.isMaintenance;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <FiAlertTriangle size={24} className={styles.icon} />
          <h1 className={styles.title}>Bảo trì hệ thống</h1>
        </div>
        <p className={styles.subtitle}>
          Quản lý trạng thái bảo trì toàn hệ thống. Khi bật, kế toán và điều phối sẽ bị chặn truy cập.
        </p>
      </div>

      {/* Trạng thái hiện tại */}
      <div className={`${styles.statusCard} ${isOn ? styles.cardOff : styles.cardOn}`}>
        <div className={styles.statusDot} data-on={!isOn} />
        <div>
          <div className={styles.statusLabel}>
            Trạng thái: <strong>{isOn ? 'ĐANG BẢO TRÌ' : 'HOẠT ĐỘNG BÌNH THƯỜNG'}</strong>
          </div>
          {isOn && status?.noiDung && (
            <div className={styles.statusNoiDung}>Nội dung: {status.noiDung}</div>
          )}
          {isOn && status?.thoiGianKetThuc && (
            <div className={styles.statusTime}>
              Dự kiến hoàn thành: {new Date(status.thoiGianKetThuc).toLocaleString('vi-VN')}
            </div>
          )}
        </div>
      </div>

      {/* Form bảo trì */}
      <div className={styles.formCard}>
        <h2 className={styles.formTitle}>{isOn ? 'Cập nhật bảo trì' : 'Thông tin bảo trì'}</h2>

        <div className={styles.field}>
          <label className={styles.label}>Nội dung bảo trì *</label>
          <textarea
            className={styles.textarea}
            value={form.noiDung}
            onChange={(e) => setForm({ ...form, noiDung: e.target.value })}
            placeholder="VD: Nâng cấp hệ thống database, bảo trì server..."
            rows={4}
          />
        </div>

        <div className={styles.row}>
          <div className={styles.field}>
            <label className={styles.label}>Lịch bắt đầu (không bắt buộc)</label>
            <input
              type="datetime-local"
              className={styles.input}
              value={form.thoiGianBatDau}
              onChange={(e) => setForm({ ...form, thoiGianBatDau: e.target.value })}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Lịch hoàn tất (không bắt buộc)</label>
            <input
              type="datetime-local"
              className={styles.input}
              value={form.thoiGianKetThuc}
              onChange={(e) => setForm({ ...form, thoiGianKetThuc: e.target.value })}
            />
          </div>
        </div>

        <div className={styles.actions}>
          {isOn ? (
            <button
              className={styles.btnOn}
              onClick={handleTatBaoTri}
              disabled={submitting}
            >
              <FiPlay size={16} />
              {submitting ? 'Đang xử lý...' : 'Hoàn tất bảo trì'}
            </button>
          ) : (
            <button
              className={styles.btnOff}
              onClick={handleBatBaoTri}
              disabled={submitting}
            >
              <FiSquare size={16} />
              {submitting ? 'Đang xử lý...' : 'Tạm dừng hệ thống'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
