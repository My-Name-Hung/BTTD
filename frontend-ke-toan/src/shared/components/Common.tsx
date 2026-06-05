import React, { ReactNode } from 'react';

interface ToastProps {
  toasts: Array<{ id: number; message: string; type: string }>;
}

export function ToastContainer({ toasts }: ToastProps) {
  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.type}`}>
          {toast.type === 'success' ? '✓' : toast.type === 'error' ? '✕' : '⚠'} {toast.message}
        </div>
      ))}
    </div>
  );
}

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info' | 'success';
  loading?: boolean;
  extra?: ReactNode;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Xác nhận',
  cancelText = 'Hủy',
  type = 'danger',
  loading = false,
  extra,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const iconMap = {
    danger: (
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" stroke="#ef4444" strokeWidth="2" />
        <path d="M12 7v6" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
        <circle cx="12" cy="16" r="1" fill="#ef4444" />
      </svg>
    ),
    warning: (
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2L2 20h20L12 2z" stroke="#f59e0b" strokeWidth="2" strokeLinejoin="round" />
        <path d="M12 9v5" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
        <circle cx="12" cy="17" r="1" fill="#f59e0b" />
      </svg>
    ),
    info: (
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" stroke="#3b82f6" strokeWidth="2" />
        <path d="M12 16v-4m0-4h.01" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    success: (
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" stroke="#22c55e" strokeWidth="2" />
        <path d="M8 12l3 3 5-5" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  };

  const btnColorMap = {
    danger: 'confirm-btn-danger',
    warning: 'confirm-btn-warning',
    info: 'confirm-btn-info',
    success: 'confirm-btn-success',
  };

  const showCancel = cancelText !== '';

  return (
    <div className="confirm-modal-overlay" onClick={onClose}>
      <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-modal-icon">{iconMap[type]}</div>
        <div className="confirm-modal-title">{title}</div>
        <div className="confirm-modal-message">{message}</div>
        {extra && <div>{extra}</div>}
        <div className="confirm-modal-footer">
          {showCancel && (
            <button className="confirm-btn confirm-btn-stay" onClick={onClose} disabled={loading}>
              {cancelText}
            </button>
          )}
          <button
            className={`confirm-btn ${btnColorMap[type]}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Đang xử lý...' : (showCancel ? confirmText : confirmText)}
          </button>
        </div>
      </div>
    </div>
  );
}

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export function Modal({ isOpen, onClose, title, children, footer, size = 'md' }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal modal-${size}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

interface LoadingProps {
  text?: string;
}

export function Loading({ text = 'Đang tải...' }: LoadingProps) {
  return (
    <div className="loading">
      <div className="loading-spinner"></div>
      <span>{text}</span>
    </div>
  );
}

export function EmptyState({ icon = '📋', text = 'Không có dữ liệu' }: { icon?: string; text?: string }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">{icon}</div>
      <div className="empty-state-text">{text}</div>
    </div>
  );
}

interface PaginationProps {
  page: number;
  totalPages: number;
  total?: number;
  limit?: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, totalPages, total, limit = 20, onPageChange }: PaginationProps) {
  if (totalPages <= 1 && (!total || total <= limit)) return null;

  const from = total ? Math.min((page - 1) * limit + 1, total) : 0;
  const to = total ? Math.min(page * limit, total) : 0;

  // Build page window: show at most 5 pages centered on current
  const windowSize = 5;
  const half = Math.floor(windowSize / 2);
  let start = Math.max(1, page - half);
  let end = Math.min(totalPages, page + half);
  if (end - start < windowSize - 1) {
    if (start === 1) end = Math.min(totalPages, start + windowSize - 1);
    else start = Math.max(1, end - windowSize + 1);
  }

  const items: (number | '...')[] = [];
  if (start > 1) {
    items.push(1);
    if (start > 2) items.push('...');
  }
  for (let i = start; i <= end; i++) items.push(i);
  if (end < totalPages) {
    if (end < totalPages - 1) items.push('...');
    items.push(totalPages);
  }

  return (
    <div className="pagination-wrap">
      {total !== undefined && (
        <div className="pagination-info">
          Hiển thị <strong>{from}–{to}</strong> trong <strong>{total}</strong>
        </div>
      )}
      <div className="pagination-controls">
        <button
          className="pagination-btn"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          title="Trang trước"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>

        {items.map((p, i) =>
          p === '...' ? (
            <span key={`ellipsis-${i}`} className="pagination-ellipsis">…</span>
          ) : (
            <button
              key={p}
              className={`pagination-btn ${p === page ? 'pagination-btn-active' : ''}`}
              onClick={() => onPageChange(p)}
            >
              {p}
            </button>
          )
        )}

        <button
          className="pagination-btn"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          title="Trang sau"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
        </button>
      </div>
    </div>
  );
}
