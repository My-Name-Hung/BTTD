import React, { useState, useEffect, useCallback } from 'react';
import { FiBell, FiCheck, FiTrash2, FiMail } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import {
  layDanhSachThongBao,
  danhDauTatCaDaDocThongBao,
  danhDauDaDocThongBao,
  xoaThongBao,
} from '../services/api';
import { ThongBao } from '../types';
import { NOTIFICATION_TYPE_ICONS } from '../types';
import { Loading } from '../components/Common';
import '../styles/notifications.css';

const LIMIT = 15;

type FilterTab = 'all' | 'unread' | 'read';

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'Tất cả' },
  { key: 'unread', label: 'Chưa đọc' },
  { key: 'read', label: 'Đã đọc' },
];

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = Date.now();
  const diff = now - d.getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'Vừa xong';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ngày trước`;
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<ThongBao[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [readAllLoading, setReadAllLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  // Theo dõi notification đang hiển thị trong popup
  const [currentPopupId, setCurrentPopupId] = useState<number | null>(null);
  useEffect(() => {
    const update = () => {
      const id = (window as unknown as Record<string, unknown>).__bttdCurrentPopupId as number | null;
      setCurrentPopupId(id ?? null);
    };
    update();
    const interval = setInterval(update, 500);
    return () => clearInterval(interval);
  }, []);

  // Theo dõi notification đang hiển thị trong popup

  // Số thông báo riêng cho mỗi tab (từ API không phân trang)
  const [countAll, setCountAll] = useState(0);
  const [countUnread, setCountUnread] = useState(0);
  const [countRead, setCountRead] = useState(0);

  const isReadMap: Record<FilterTab, boolean | undefined> = {
    all: undefined,
    unread: false,
    read: true,
  };

  // Lấy số lượng từng tab
  const loadCounts = useCallback(async () => {
    try {
      const [resAll, resUnread, resRead] = await Promise.all([
        layDanhSachThongBao(1, 1, undefined),
        layDanhSachThongBao(1, 1, false),
        layDanhSachThongBao(1, 1, true),
      ]);
      setCountAll(resAll.total);
      setCountUnread(resUnread.total);
      setCountRead(resRead.total);
    } catch { /* silent */ }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await layDanhSachThongBao(page, LIMIT, isReadMap[filterTab]);
      // Lọc notification đang hiển thị trong popup (tránh trùng lặp)
      const filtered = currentPopupId
        ? res.data.filter((n) => n.id !== currentPopupId)
        : res.data;
      setNotifications(filtered);
      setTotal(res.total);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [page, filterTab, currentPopupId]);

  useEffect(() => {
    setPage(1);
  }, [filterTab]);

  // Lọc notification đang hiển thị trong popup khỏi danh sách
  useEffect(() => {
    if (!currentPopupId) return;
    setNotifications((prev) => {
      const exists = prev.some((n) => n.id === currentPopupId);
      if (exists) return prev.filter((n) => n.id !== currentPopupId);
      return prev;
    });
  }, [currentPopupId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    loadCounts();
  }, [loadCounts]);

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  const handleMarkAllRead = async () => {
    setReadAllLoading(true);
    try {
      await danhDauTatCaDaDocThongBao();
      await loadCounts();
      await loadData();
      setFilterTab('read');
      // Báo cho Layout cập nhật badge
      window.dispatchEvent(new CustomEvent('bttd:notifications-refresh'));
    } catch { /* silent */ }
    finally { setReadAllLoading(false); }
  };

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    setDeletingId(id);
    try {
      await xoaThongBao(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      setTotal((t) => Math.max(0, t - 1));
      await loadCounts();
      window.dispatchEvent(new CustomEvent('bttd:notifications-refresh'));
    } catch { /* silent */ }
    finally { setDeletingId(null); }
  };

  const handleItemClick = async (item: ThongBao) => {
    if (!item.isRead) {
      try {
        await danhDauDaDocThongBao(item.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n)),
        );
        await loadCounts();
        window.dispatchEvent(new CustomEvent('bttd:notifications-refresh'));
      } catch { /* silent */ }
    }
    if (item.duongDan) {
      navigate(item.duongDan);
    }
  };

  const renderPaginationButtons = () => {
    const pages: (number | '...')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push('...');
      for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
      if (page < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className="notif-page">
      <div className="notif-page__header">
        <div className="notif-page__header-left">
          <div>
            <div className="notif-page__title">Thông báo</div>
            <div className="notif-page__subtitle">
              Theo dõi các sự kiện và cập nhật từ hệ thống
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {countUnread > 0 && (
            <button
              className="notif-filter-tab"
              onClick={handleMarkAllRead}
              disabled={readAllLoading}
              style={{ fontSize: 12 }}
            >
              <FiCheck size={13} />
              Đánh dấu tất cả đã đọc
            </button>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="notif-filter-bar">
        <button
          className={`notif-filter-tab ${filterTab === 'all' ? 'notif-filter-tab--active' : ''}`}
          onClick={() => setFilterTab('all')}
        >
          Tất cả
          {countAll > 0 && (
            <span className="notif-filter-tab__count">{countAll}</span>
          )}
        </button>
        <button
          className={`notif-filter-tab ${filterTab === 'unread' ? 'notif-filter-tab--active' : ''}`}
          onClick={() => setFilterTab('unread')}
        >
          Chưa đọc
          {countUnread > 0 && (
            <span className="notif-filter-tab__count">{countUnread}</span>
          )}
        </button>
        <button
          className={`notif-filter-tab ${filterTab === 'read' ? 'notif-filter-tab--active' : ''}`}
          onClick={() => setFilterTab('read')}
        >
          Đã đọc
          {countRead > 0 && (
            <span className="notif-filter-tab__count">{countRead}</span>
          )}
        </button>
      </div>

      {/* Card */}
      <div className="notif-card">
        {loading ? (
          <div style={{ padding: '48px', display: 'flex', justifyContent: 'center' }}>
            <Loading />
          </div>
        ) : notifications.length === 0 ? (
          <div className="notif-empty">
            <div className="notif-empty__icon">🔔</div>
            <p className="notif-empty__text">
              {filterTab === 'unread'
                ? 'Không có thông báo chưa đọc'
                : filterTab === 'read'
                ? 'Không có thông báo đã đọc'
                : 'Chưa có thông báo nào'}
            </p>
          </div>
        ) : (
          <ul className="notif-list">
            {notifications.map((item) => (
              <li
                key={item.id}
                className={`notif-list__item ${!item.isRead ? 'notif-list__item--unread' : ''}`}
                onClick={() => handleItemClick(item)}
              >
                <div className="notif-list__icon">
                  {NOTIFICATION_TYPE_ICONS[item.loai] || '🔔'}
                </div>

                <div className="notif-list__content">
                  <div className="notif-list__header">
                    <div className={`notif-list__title ${!item.isRead ? 'notif-list__title--unread' : ''}`}>
                      {item.tieuDe}
                    </div>
                    <div className="notif-list__time">{formatTime(item.ngayTao)}</div>
                  </div>
                  <p className="notif-list__message">{item.noiDung}</p>
                </div>

                <div className="notif-list__actions">
                  <button
                    className="notif-action-btn notif-action-btn--delete"
                    onClick={(e) => handleDelete(e, item.id)}
                    disabled={deletingId === item.id}
                    title="Xóa thông báo"
                  >
                    <FiTrash2 size={13} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Pagination */}
        {!loading && total > LIMIT && (
          <div className="notif-pagination">
            <div className="notif-pagination__info">
              Hiển thị <strong>{(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)}</strong> trong <strong>{total}</strong> thông báo
            </div>
            <div className="notif-pagination__controls">
              <button
                className="notif-pagination__btn"
                onClick={() => setPage((p) => p - 1)}
                disabled={page <= 1}
              >‹</button>
              {renderPaginationButtons().map((p, i) =>
                p === '...' ? (
                  <span key={`ellipsis-${i}`} style={{ padding: '0 4px', color: 'var(--color-text-secondary)', fontSize: 13 }}>…</span>
                ) : (
                  <button
                    key={p}
                    className={`notif-pagination__btn ${p === page ? 'notif-pagination__btn--active' : ''}`}
                    onClick={() => setPage(p as number)}
                  >
                    {p}
                  </button>
                ),
              )}
              <button
                className="notif-pagination__btn"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages}
              >›</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
