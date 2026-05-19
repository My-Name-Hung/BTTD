import { useCallback, useEffect, useState } from "react";
import { FiEdit2, FiPlus, FiSearch, FiTrash2, FiX } from "react-icons/fi";
import {
  ConfirmModal,
  EmptyState,
  Loading,
  Modal,
  Pagination,
} from "../components/Common";
import { usePagination, useToast } from "../hooks";
import {
  layDanhSachNguoiDung,
  suaNguoiDung,
  taoNguoiDung,
  xoaNguoiDung,
} from "../services/api";
import { ApiResponseWithPagination, NguoiDung } from "../types";
import styles from "./QuanLyNguoiDungPage.module.css";

const VAI_TRO_SORT_ORDER: Record<string, number> = {
  admin: 1,
  lanh_dao: 2,
  ke_toan: 3,
  dieu_phoi: 4,
};

const VAI_TRO_LABELS: Record<string, string> = {
  admin: "Quản trị",
  ke_toan: "Kế toán",
  dieu_phoi: "Điều phối",
  lanh_dao: "Lãnh đạo",
};

const VAI_TRO_CLASS: Record<string, string> = {
  admin: styles.roleBadgeAdmin,
  ke_toan: styles.roleBadgeKeToan,
  dieu_phoi: styles.roleBadgeDieuPhoi,
  lanh_dao: styles.roleBadgeLanhDao,
};

const VAI_TRO_COLORS: Record<string, string> = {
  admin: "#073ceb",
  ke_toan: "#047857",
  dieu_phoi: "#ea6b00",
  lanh_dao: "#7c3aed",
};

export default function QuanLyNguoiDungPage() {
  const { toasts, showToast } = useToast();
  const { page, resetPage, goToPage } = usePagination(1, 50);
  const userVaiTro = JSON.parse(
    localStorage.getItem("bttd_user") || "{}",
  )?.vaiTro;
  const canDelete = ["admin"].includes(userVaiTro);

  const [data, setData] = useState<ApiResponseWithPagination<NguoiDung[]>>({
    success: true,
    message: "",
    data: [],
    pagination: { page: 1, limit: 50, total: 0, totalPages: 1 },
  });
  const [loading, setLoading] = useState(true);
  const [tuKhoa, setTuKhoa] = useState("");
  const [vaiTroFilter, setVaiTroFilter] = useState("");
  const [trangThaiFilter, setTrangThaiFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<NguoiDung | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<NguoiDung | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [form, setForm] = useState({
    tenDangNhap: "",
    matKhau: "",
    hoTen: "",
    email: "",
    soDienThoai: "",
    vaiTro: "ke_toan",
    trangThai: "hoat_dong",
  });
  const [initialForm, setInitialForm] = useState(form);

  const filteredUsers = (data.data?.filter((u) => {
    const matchVaiTro = !vaiTroFilter || u.vaiTro === vaiTroFilter;
    const matchTrangThai = !trangThaiFilter || u.trangThai === trangThaiFilter;
    return matchVaiTro && matchTrangThai;
  }) ?? []).sort((a, b) => (VAI_TRO_SORT_ORDER[a.vaiTro] ?? 99) - (VAI_TRO_SORT_ORDER[b.vaiTro] ?? 99));

  const hasFilters = !!vaiTroFilter || !!trangThaiFilter || !!tuKhoa;

  const clearFilters = () => {
    setVaiTroFilter("");
    setTrangThaiFilter("");
    setTuKhoa("");
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await layDanhSachNguoiDung(page, 50, tuKhoa || undefined);
      setData(res);
    } catch {
      showToast("Lỗi tải dữ liệu", "error");
    } finally {
      setLoading(false);
    }
  }, [page, tuKhoa, showToast]);

  useEffect(() => {
    if (modalOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [modalOpen]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openCreate = () => {
    const f = {
      tenDangNhap: "",
      matKhau: "",
      hoTen: "",
      email: "",
      soDienThoai: "",
      vaiTro: "ke_toan",
      trangThai: "hoat_dong",
    };
    setEditingUser(null);
    setForm(f);
    setInitialForm(f);
    setModalOpen(true);
  };

  const openEdit = (u: NguoiDung) => {
    setEditingUser(u);
    const f = {
      tenDangNhap: u.tenDangNhap,
      matKhau: "",
      hoTen: u.hoTen,
      email: u.email || "",
      soDienThoai: u.soDienThoai || "",
      vaiTro: u.vaiTro,
      trangThai: u.trangThai,
    };
    setForm(f);
    setInitialForm(f);
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.hoTen.trim() || (!form.tenDangNhap.trim() && !editingUser)) {
      showToast("Vui lòng nhập đầy đủ thông tin bắt buộc", "error");
      return;
    }
    if (!editingUser && !form.matKhau.trim()) {
      showToast("Vui lòng nhập mật khẩu", "error");
      return;
    }
    try {
      if (editingUser) {
        await suaNguoiDung(editingUser.id, {
          hoTen: form.hoTen,
          email: form.email || undefined,
          soDienThoai: form.soDienThoai || undefined,
          vaiTro: form.vaiTro,
          trangThai: form.trangThai,
          matKhauMoi: form.matKhau || undefined,
        });
      } else {
        await taoNguoiDung({
          tenDangNhap: form.tenDangNhap,
          matKhau: form.matKhau,
          hoTen: form.hoTen,
          email: form.email || undefined,
          soDienThoai: form.soDienThoai || undefined,
          vaiTro: form.vaiTro,
        });
      }
      setModalOpen(false);
      setShowSuccess(true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Lỗi", "error");
    }
  };

  const resetForm = () => {
    const f = { tenDangNhap: "", matKhau: "", hoTen: "", email: "", soDienThoai: "", vaiTro: "ke_toan", trangThai: "hoat_dong" };
    setForm(f);
    setInitialForm(f);
    setEditingUser(null);
  };

  const closeModal = () => {
    if (JSON.stringify(form) !== JSON.stringify(initialForm)) {
      setShowCancel(true);
    } else {
      setModalOpen(false);
      resetForm();
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await xoaNguoiDung(deleteTarget.id);
      showToast("Xóa người dùng thành công");
      setDeleteTarget(null);
      loadData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Lỗi", "error");
    } finally {
      setDeleteLoading(false);
    }
  };

  // Pagination helpers
  const totalPages = data.pagination.totalPages;
  const total = data.pagination.total;
  const LIMIT = 50;

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <div className={styles.pageHeaderTitle}>Quản lý người dùng</div>
          <div className={styles.pageHeaderDesc}>
            Quản lý tài khoản và phân quyền người dùng hệ thống
          </div>
        </div>
        <button className="btn btn-add" onClick={openCreate}>
          <FiPlus /> Thêm người dùng
        </button>
      </div>

      {/* Filter Bar */}
      <div className={styles.filterBar}>
        <div className={styles.filterSearchWrap}>
          <FiSearch className={styles.filterSearchIcon} />
          <input
            className={styles.filterSearchInput}
            placeholder="Tìm tên đăng nhập, họ tên..."
            value={tuKhoa}
            onChange={(e) => {
              setTuKhoa(e.target.value);
              resetPage();
            }}
          />
        </div>

        {/* Vai trò filter */}
        <div
          className={`${styles.selectWrap} ${vaiTroFilter ? styles.activeFilter : ""}`}
        >
          <span className={styles.selectLabel}>Vai trò</span>
          <div className={styles.selectControl}>
            <select
              className={styles.selectInput}
              value={vaiTroFilter}
              onChange={(e) => setVaiTroFilter(e.target.value)}
            >
              <option value="">Tất cả</option>
              <option value="admin">Quản trị</option>
              <option value="ke_toan">Kế toán</option>
              <option value="dieu_phoi">Điều phối</option>
              <option value="lanh_dao">Lãnh đạo</option>
            </select>
            <span className={styles.selectArrow}>▼</span>
          </div>
        </div>

        {/* Trạng thái filter */}
        <div
          className={`${styles.selectWrap} ${trangThaiFilter ? styles.activeFilter : ""}`}
        >
          <span className={styles.selectLabel}>Trạng thái</span>
          <div className={styles.selectControl}>
            <select
              className={styles.selectInput}
              value={trangThaiFilter}
              onChange={(e) => setTrangThaiFilter(e.target.value)}
            >
              <option value="">Tất cả</option>
              <option value="hoat_dong">Hoạt động</option>
              <option value="khong_hoat_dong">Không hoạt động</option>
            </select>
            <span className={styles.selectArrow}>▼</span>
          </div>
        </div>

        {hasFilters && (
          <button className={styles.filterClearBtn} onClick={clearFilters}>
            <FiX size={13} /> Xóa lọc
          </button>
        )}
      </div>

      {/* Card */}
      <div className={styles.card}>
        {/* Stats row */}
        <div className={styles.statsRow}>
          <div className={styles.statItem}>
            <span className={styles.statNum}>{filteredUsers.length}</span> tài khoản
            {hasFilters && <> / {total} tổng</>}
          </div>
          <div className={styles.statDot} />
          <div className={styles.statItem}>
            <span className={styles.statNum}>
              {filteredUsers.filter((u) => u.trangThai === "hoat_dong").length}
            </span>{" "}
            hoạt động
          </div>
        </div>

        <div className={styles.tableWrap}>
          {loading ? (
            <Loading />
          ) : filteredUsers.length === 0 ? (
            <EmptyState
              icon="👤"
              text={
                hasFilters
                  ? "Không có người dùng phù hợp với bộ lọc"
                  : "Chưa có người dùng nào"
              }
            />
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Tên đăng nhập</th>
                  <th>Họ tên</th>
                  <th>Email</th>
                  <th>SĐT</th>
                  <th>Vai trò</th>
                  <th>Trạng thái</th>
                  <th>Ngày tạo</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <span className={styles.tableName}>{u.tenDangNhap}</span>
                    </td>
                    <td>{u.hoTen}</td>
                    <td className={styles.tableEmail}>
                      {u.email || <span style={{ opacity: 0.4 }}>—</span>}
                    </td>
                    <td className={styles.tablePhone}>
                      {u.soDienThoai || <span style={{ opacity: 0.4 }}>—</span>}
                    </td>
                    <td>
                      <span
                        className={`${styles.roleBadge} ${VAI_TRO_CLASS[u.vaiTro] || ""}`}
                      >
                        {VAI_TRO_LABELS[u.vaiTro] || u.vaiTro}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`${styles.statusBadge} ${u.trangThai === "hoat_dong" ? styles.statusHoatDong : styles.statusKhongHoatDong}`}
                      >
                        {u.trangThai === "hoat_dong"
                          ? "Hoạt động"
                          : "Không hoạt động"}
                      </span>
                    </td>
                    <td className={styles.tableDate}>
                      {u.ngayTao
                        ? new Date(u.ngayTao).toLocaleDateString("vi-VN")
                        : "—"}
                    </td>
                    <td>
                      <div className={styles.rowActions}>
                        <button
                          className={`${styles.actionBtn} ${styles.actionBtnEdit}`}
                          onClick={() => openEdit(u)}
                          title="Sửa"
                        >
                          <FiEdit2 size={14} />
                        </button>
                        {canDelete && (
                          <button
                            className={`${styles.actionBtn} ${styles.actionBtnDelete}`}
                            onClick={() => setDeleteTarget(u)}
                            title="Xóa"
                          >
                            <FiTrash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination — centered, show when > 10 items */}
        {!loading && total > 10 && (
          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            limit={LIMIT}
            onPageChange={goToPage}
          />
        )}
      </div>

      {/* Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editingUser ? "Sửa người dùng" : "Thêm người dùng mới"}
        footer={
          <>
            <button className="btn btn-cancel" onClick={closeModal}>
              Hủy
            </button>
            <button className="btn btn-save" onClick={handleSubmit}>
              {editingUser ? "Cập nhật" : "Tạo người dùng"}
            </button>
          </>
        }
      >
        {!editingUser && (
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Tên đăng nhập *</label>
            <input
              className={styles.formInput}
              value={form.tenDangNhap}
              onChange={(e) =>
                setForm({ ...form, tenDangNhap: e.target.value })
              }
              placeholder="VD: nhanvien01"
            />
          </div>
        )}
        {!editingUser && (
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Mật khẩu *</label>
            <input
              type="password"
              className={styles.formInput}
              value={form.matKhau}
              onChange={(e) => setForm({ ...form, matKhau: e.target.value })}
              placeholder="Nhập mật khẩu (tối thiểu 6 ký tự)"
            />
          </div>
        )}
        {editingUser && (
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Đổi mật khẩu mới</label>
            <input
              type="password"
              className={styles.formInput}
              value={form.matKhau}
              onChange={(e) => setForm({ ...form, matKhau: e.target.value })}
              placeholder="Để trống nếu không đổi"
            />
          </div>
        )}
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Họ tên *</label>
          <input
            className={styles.formInput}
            value={form.hoTen}
            onChange={(e) => setForm({ ...form, hoTen: e.target.value })}
            placeholder="VD: Nguyễn Văn A"
          />
        </div>
        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Email</label>
            <input
              type="email"
              className={styles.formInput}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>SĐT</label>
            <input
              className={styles.formInput}
              value={form.soDienThoai}
              onChange={(e) =>
                setForm({ ...form, soDienThoai: e.target.value })
              }
            />
          </div>
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Vai trò *</label>
          <select
            className={styles.formSelect}
            value={form.vaiTro}
            onChange={(e) => setForm({ ...form, vaiTro: e.target.value })}
          >
            <option value="admin">Quản trị</option>
            <option value="ke_toan">Kế toán</option>
            <option value="dieu_phoi">Điều phối</option>
            <option value="lanh_dao">Lãnh đạo</option>
          </select>
        </div>
        {editingUser && (
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Trạng thái</label>
            <select
              className={styles.formSelect}
              value={form.trangThai}
              onChange={(e) =>
                setForm({ ...form, trangThai: e.target.value })
              }
            >
              <option value="hoat_dong">Hoạt động</option>
              <option value="khong_hoat_dong">Không hoạt động</option>
            </select>
          </div>
        )}
      </Modal>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Xóa người dùng"
        message={`Bạn có chắc muốn xóa người dùng "${deleteTarget?.hoTen}"? Hành động này không thể hoàn tác.`}
        confirmText="Xóa"
        cancelText="Hủy"
        type="danger"
        loading={deleteLoading}
      />

      <ConfirmModal
        isOpen={showSuccess}
        onClose={() => { setShowSuccess(false); loadData(); resetForm(); }}
        onConfirm={() => { setShowSuccess(false); loadData(); resetForm(); }}
        message={editingUser ? "Cập nhật người dùng thành công!" : "Tạo người dùng thành công!"}
        confirmText="Đồng ý"
        cancelText=""
        title="Thành công"
        type="success"
      />

      <ConfirmModal
        isOpen={showCancel}
        onClose={() => setShowCancel(false)}
        onConfirm={() => { setShowCancel(false); setModalOpen(false); resetForm(); }}
        message="Bạn có chắc muốn hủy bỏ? Dữ liệu đã nhập sẽ không được lưu."
        confirmText="Hủy bỏ"
        cancelText="Ở lại"
        title="Xác nhận hủy bỏ"
        type="warning"
      />

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
