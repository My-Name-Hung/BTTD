import React, { useState, useEffect, useCallback } from 'react';
import { FiPlus } from 'react-icons/fi';
import { layDanhSachMacBeTong, taoMacBeTong, layDanhSachTramTron, layDanhSachXe } from '../services/api';
import { MacBeTong, TramTron, Xe } from '../types';
import { useToast, usePageRole } from '../hooks';
import { Modal, Loading, EmptyState } from '../components/Common';
import styles from './ThamSoPage.module.css';

function formatCurrency(v: number) { return v?.toLocaleString('vi-VN') + ' đ' || '0 đ'; }

export default function ThamSoPage() {
  const { hasPermission } = usePageRole();
  const { toasts, showToast } = useToast();
  const [macBeTongs, setMacBeTongs] = useState<MacBeTong[]>([]);
  const [tramTrons, setTramTrons] = useState<TramTron[]>([]);
  const [xes, setXes] = useState<Xe[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'mac' | 'tram' | 'xe'>('mac');
  const [form, setForm] = useState({ tenMac: '', donGia: '', moTa: '' });

  const canManageMac = hasPermission('thamso.mac.create');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [mac, tram, xe] = await Promise.all([
        layDanhSachMacBeTong(),
        layDanhSachTramTron(),
        layDanhSachXe(),
      ]);
      setMacBeTongs(mac || []);
      setTramTrons(tram);
      setXes(xe);
    } catch { showToast('Lỗi tải dữ liệu', 'error'); }
    finally { setLoading(false); }
  }, [showToast]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleTaoMac = async () => {
    if (!form.tenMac.trim() || !form.donGia) return;
    setFormLoading(true);
    try {
      await taoMacBeTong({ tenMac: form.tenMac, donGia: parseFloat(form.donGia), moTa: form.moTa || null });
      showToast('Thêm mác bê tông thành công');
      setModalOpen(false);
      setForm({ tenMac: '', donGia: '', moTa: '' });
      loadData();
    } catch (err) { showToast(err instanceof Error ? err.message : 'Lỗi', 'error'); }
    finally { setFormLoading(false); }
  };

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <div className={styles.pageHeaderTitle}>Tham số hệ thống</div>
          <div className={styles.pageHeaderDesc}>Quản lý mác bê tông, trạm trộn và phương tiện</div>
        </div>
      </div>

      <div className={styles.tabBar}>
        <div className={styles.tabBarLeft}>
          {(['mac', 'tram', 'xe'] as const).map((tab) => (
            <button key={tab} className={`${styles.tabBtn} ${activeTab === tab ? styles.tabBtnActive : ''}`} onClick={() => setActiveTab(tab)}>
              {tab === 'mac' ? 'Mác bê tông' : tab === 'tram' ? 'Trạm trộn' : 'Xe'}
            </button>
          ))}
        </div>
        <div className={styles.tabBarRight}>
          {activeTab === 'mac' && canManageMac && (
            <button className="btn btn-add" onClick={() => setModalOpen(true)}><FiPlus /> Thêm mác</button>
          )}
        </div>
      </div>

      {loading ? <Loading /> : (
        activeTab === 'mac' ? (
          <div className={styles.card}>
            <div className={styles.tableWrap}>
              {macBeTongs.length === 0 ? (
                <EmptyState icon="🏗️" text="Chưa có mác bê tông" />
              ) : (
                <table className={styles.table}>
                  <thead><tr><th>Tên mác</th><th>Đơn giá</th><th>Mô tả</th></tr></thead>
                  <tbody>
                    {macBeTongs.map((m) => (
                      <tr key={m.id}>
                        <td><strong className={styles.tableName}>{m.tenMac}</strong></td>
                        <td><strong>{formatCurrency(m.donGia)}</strong></td>
                        <td>{m.moTa || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        ) : activeTab === 'tram' ? (
          <div className={styles.card}>
            <div className={styles.tableWrap}>
              {tramTrons.length === 0 ? (
                <EmptyState icon="🏭" text="Chưa có trạm trộn" />
              ) : (
                <table className={styles.table}>
                  <thead><tr><th>Tên trạm</th><th>Địa chỉ</th><th>SĐT</th></tr></thead>
                  <tbody>
                    {tramTrons.map((t) => (
                      <tr key={t.id}>
                        <td><strong className={styles.tableName}>{t.tenTram}</strong></td>
                        <td>{t.diaChi || '—'}</td>
                        <td>{t.soDienThoai || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        ) : (
          <div className={styles.card}>
            <div className={styles.tableWrap}>
              {xes.length === 0 ? (
                <EmptyState icon="🚛" text="Chưa có xe" />
              ) : (
                <table className={styles.table}>
                  <thead><tr><th>Biển số</th><th>Tài xế</th><th>SĐT</th><th>Tải trọng</th><th>Trạng thái</th></tr></thead>
                  <tbody>
                    {xes.map((x) => (
                      <tr key={x.id}>
                        <td><strong className={styles.tableName}>{x.bienSo}</strong></td>
                        <td>{x.tenTaiXe || '—'}</td>
                        <td>{x.soDienThoaiTaiXe || '—'}</td>
                        <td>{x.taiTrong ? `${x.taiTrong} tấn` : '—'}</td>
                        <td>
                          <span className={`${styles.badge} ${x.trangThai === 'san_sang' ? styles.badgeDaThanhToan : x.trangThai === 'dang_giao' ? styles.badgeDangGiao : styles.badgeTuChoi}`}>
                            {x.trangThai === 'san_sang' ? 'Sẵn sàng' : x.trangThai === 'dang_giao' ? 'Đang giao' : 'Bảo trì'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Thêm mác bê tông"
        footer={<><button className="btn btn-cancel" onClick={() => setModalOpen(false)} disabled={formLoading}>Hủy</button><button className="btn btn-save" onClick={handleTaoMac} disabled={formLoading}>{formLoading ? 'Đang lưu...' : 'Thêm'}</button></>}
      >
        <div className={styles.formGroup}><label className={styles.formLabel}>Tên mác *</label><input className={styles.formInput} value={form.tenMac} onChange={(e) => setForm({ ...form, tenMac: e.target.value })} placeholder="VD: M300" /></div>
        <div className={styles.formGroup}><label className={styles.formLabel}>Đơn giá (VNĐ) *</label><input type="number" className={styles.formInput} value={form.donGia} onChange={(e) => setForm({ ...form, donGia: e.target.value })} placeholder="VD: 1300000" /></div>
        <div className={styles.formGroup}><label className={styles.formLabel}>Mô tả</label><input className={styles.formInput} value={form.moTa} onChange={(e) => setForm({ ...form, moTa: e.target.value })} /></div>
      </Modal>

      <div className={styles.toastContainer}>
        {toasts.map((t) => <div key={t.id} className={`${styles.toast} ${t.type === 'error' ? styles.toastError : styles.toastSuccess}`}>{t.message}</div>)}
      </div>
    </div>
  );
}
