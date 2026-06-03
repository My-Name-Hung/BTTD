import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiEdit2,
  FiEye,
  FiPlus,
  FiSearch,
  FiTrash2,
  FiX,
} from "react-icons/fi";
import {
  ConfirmModal,
  EmptyState,
  Loading,
  Modal,
  Pagination,
} from "../components/Common";
import { SearchableDropdown } from "../components/SearchableDropdown";
import { usePagination, useToast } from "../hooks";
import {
  layDanhSachTaiXe,
  layDanhSachXe,
  suaXe,
  taoXe,
  xoaXe,
} from "../services/api";
import {
  Xe,
} from "../types";
import styles from "./QuanLyXePage.module.css";

const TRANG_THAI_LABELS: Record<string, string> = {
  san_sang: "Sẵn sàng",
  dang_giao: "Đang giao",
  bao_tri: "Bảo trì",
};

const TRANG_THAI_CLASS: Record<string, string> = {
  san_sang: styles.badgeSanSang,
  dang_giao: styles.badgeDangGiao,
  bao_tri: styles.badgeBaoTri,
};

export default function QuanLyXePage() {
  const navigate = useNavigate();
  const { toasts, showToast } = useToast();
  const { page, resetPage, goToPage } = usePagination(1, 10);
  const userVaiTro = JSON.parse(
    localStorage.getItem("bttd_user") || "{}",
  )?.vaiTro;
  const canDelete = ["admin"].includes(userVaiTro);

  const [xes, setXes] = useState<Xe[]>([]);
  const [taiXeList, setTaiXeList] = useState<
    { id: number; hoTen: string; soDienThoai: string | null }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Xe | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showCancel, setShowCancel] = useState(false);

  // Filters
  const [tuKhoa, setTuKhoa] = useState("");
  const [taiTrongFilter, setTaiTrongFilter] = useState("");
  const [trangThaiFilter, setTrangThaiFilter] = useState("");

  const [form, setForm] = useState({
    bienSo: "",
    idTaiKhoan: "" as string | number,
    taiTrong: "",
    trangThai: "san_sang" as Xe["trangThai"],
  });
  const [initialForm, setInitialForm] = useState(form);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [xeData, txData] = await Promise.all([
        layDanhSachXe(),
        layDanhSachTaiXe(),
      ]);
      setXes(xeData);
      setTaiXeList(txData);
    } catch {
      showToast("Lỗi tải dữ liệu", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredXes = xes.filter((x) => {
    const matchBienSo =
      !tuKhoa || x.bienSo.toLowerCase().includes(tuKhoa.toLowerCase());
    const matchTaiXe =
      !tuKhoa ||
      (x.tenTaiXe && x.tenTaiXe.toLowerCase().includes(tuKhoa.toLowerCase()));
    const matchTaiTrong =
      !taiTrongFilter ||
      (x.taiTrong !== null &&
        x.taiTrong !== undefined &&
        String(x.taiTrong) === taiTrongFilter);
    const matchTrangThai = !trangThaiFilter || x.trangThai === trangThaiFilter;
    return matchBienSo && matchTaiXe && matchTaiTrong && matchTrangThai;
  });

  const hasFilters = !!tuKhoa || !!taiTrongFilter || !!trangThaiFilter;

  const clearFilters = () => {
    setTuKhoa("");
    setTaiTrongFilter("");
    setTrangThaiFilter("");
    resetPage();
  };

  // Pagination
  const limit = 10;
  const total = filteredXes.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const paginatedXes = filteredXes.slice((page - 1) * limit, page * limit);

  const openCreate = () => {
    const f = {
      bienSo: "",
      idTaiKhoan: "" as string | number,
      taiTrong: "",
      trangThai: "san_sang" as Xe["trangThai"],
    };
    setEditingId(null);
    setForm(f);
    setInitialForm(f);
    setModalOpen(true);
  };

  const openEdit = (x: Xe) => {
    const f = {
      bienSo: x.bienSo,
      idTaiKhoan: (x.idTaiKhoan ?? "") as string | number,
      taiTrong: x.taiTrong ? String(x.taiTrong) : "",
      trangThai: x.trangThai,
    };
    setEditingId(x.id);
    setForm(f);
    setInitialForm(f);
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.bienSo.trim()) {
      showToast("Biển số xe là bắt buộc", "error");
      return;
    }
    setFormLoading(true);
    try {
      const payload = {
        bienSo: form.bienSo,
        idTaiKhoan: form.idTaiKhoan ? Number(form.idTaiKhoan) : null,
        taiTrong: form.taiTrong ? parseFloat(form.taiTrong) : null,
        trangThai: form.trangThai,
      };
      if (editingId) {
        await suaXe(editingId, payload);
      } else {
        await taoXe(payload);
      }
      setModalOpen(false);
      setShowSuccess(true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Lỗi", "error");
    } finally {
      setFormLoading(false);
    }
  };

  const resetForm = () => {
    const f = {
      bienSo: "",
      idTaiKhoan: "" as string | number,
      taiTrong: "",
      trangThai: "san_sang" as Xe["trangThai"],
    };
    setForm(f);
    setInitialForm(f);
    setEditingId(null);
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
      await xoaXe(deleteTarget.id);
      showToast("Xóa xe thành công");
      setDeleteTarget(null);
      loadData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Lỗi", "error");
    } finally {
      setDeleteLoading(false);
    }
  };

  // Unique tai trong options from data
  const taiTrongOptions = Array.from(
    new Set(
      xes
        .map((x) => x.taiTrong)
        .filter((v): v is number => v !== null && v !== undefined),
    ),
  ).sort((a, b) => a - b);

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <div className={styles.pageHeaderTitle}>Quản lý phương tiện</div>
          <div className={styles.pageHeaderDesc}>
            Thêm, sửa, xóa xe vận chuyển bê tông
          </div>
        </div>
        <button className="btn btn-add" onClick={openCreate}>
          <FiPlus /> Thêm xe
        </button>
      </div>

      {/* Filter Bar */}
      <div className={styles.filterBar}>
        <div className={styles.filterSearchWrap}>
          <FiSearch className={styles.filterSearchIcon} />
          <input
            className={styles.filterSearchInput}
            placeholder="Tìm biển số, tên tài xế..."
            value={tuKhoa}
            onChange={(e) => {
              setTuKhoa(e.target.value);
              resetPage();
            }}
          />
        </div>

        {/* Tải trọng filter */}
        <div
          className={`${styles.selectWrap} ${taiTrongFilter ? styles.activeFilter : ""}`}
        >
          <span className={styles.selectLabel}>Tải trọng</span>
          <div className={styles.selectControl}>
            <select
              className={styles.selectInput}
              value={taiTrongFilter}
              onChange={(e) => {
                setTaiTrongFilter(e.target.value);
                resetPage();
              }}
            >
              <option value="">Tất cả</option>
              {taiTrongOptions.map((t) => (
                <option key={t} value={String(t)}>
                  {t} tấn
                </option>
              ))}
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
              onChange={(e) => {
                setTrangThaiFilter(e.target.value);
                resetPage();
              }}
            >
              <option value="">Tất cả</option>
              <option value="san_sang">Sẵn sàng</option>
              <option value="dang_giao">Đang giao</option>
              <option value="bao_tri">Bảo trì</option>
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

      <div className={styles.card}>
        {/* Stats row */}
        <div className={styles.statsRow}>
          <div className={styles.statItem}>
            <span className={styles.statNum}>{filteredXes.length}</span> phương
            tiện
            {hasFilters && <> / {xes.length} tổng</>}
          </div>
          <div className={styles.statDot} />
          <div className={styles.statItem}>
            <span className={styles.statNum}>
              {filteredXes.filter((x) => x.trangThai === "san_sang").length}
            </span>{" "}
            sẵn sàng
          </div>
          <div className={styles.statDot} />
          <div className={styles.statItem}>
            <span className={styles.statNum}>
              {filteredXes.filter((x) => x.trangThai === "dang_giao").length}
            </span>{" "}
            đang giao
          </div>
        </div>

        <div className={styles.tableWrap}>
          {loading ? (
            <Loading />
          ) : filteredXes.length === 0 ? (
            <EmptyState
              icon="🚛"
              text={
                hasFilters
                  ? "Không có phương tiện phù hợp với bộ lọc"
                  : "Chưa có phương tiện nào"
              }
            />
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Biển số</th>
                  <th>Tài xế</th>
                  <th>SĐT</th>
                  <th>Tải trọng</th>
                  <th>Trạng thái</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {paginatedXes.map((x) => (
                  <tr key={x.id}>
                    <td>
                      <strong className={styles.tableName}>{x.bienSo}</strong>
                    </td>
                    <td>
                      {x.tenTaiXe || (
                        <span className={styles.placeholder}>—</span>
                      )}
                    </td>
                    <td className={styles.tablePhone}>
                      {x.soDienThoaiTaiXe || (
                        <span className={styles.placeholder}>—</span>
                      )}
                    </td>
                    <td>
                      {x.taiTrong ? (
                        `${x.taiTrong} tấn`
                      ) : (
                        <span className={styles.placeholder}>—</span>
                      )}
                    </td>
                    <td>
                      <span
                        className={`${styles.badge} ${TRANG_THAI_CLASS[x.trangThai] || ""}`}
                      >
                        {TRANG_THAI_LABELS[x.trangThai] || x.trangThai}
                      </span>
                    </td>
                    <td>
                      <div className={styles.rowActions}>
                        <button
                          className={`${styles.actionBtn} ${styles.actionBtnEye}`}
                          onClick={() => navigate(`/quan-ly/xe/don-hang/${x.id}`)}
                          title="Xem đơn hàng"
                        >
                          <FiEye size={14} />
                        </button>
                        <button
                          className={`${styles.actionBtn} ${styles.actionBtnEdit}`}
                          onClick={() => openEdit(x)}
                          title="Sửa"
                        >
                          <FiEdit2 size={14} />
                        </button>
                        {canDelete && (
                          <button
                            className={`${styles.actionBtn} ${styles.actionBtnDelete}`}
                            onClick={() => setDeleteTarget(x)}
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

        {/* Pagination */}
        {!loading && total > 10 && (
          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            limit={limit}
            onPageChange={goToPage}
          />
        )}
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editingId ? "Sửa phương tiện" : "Thêm phương tiện mới"}
        footer={
          <>
            <button
              className="btn btn-cancel"
              onClick={closeModal}
              disabled={formLoading}
            >
              Hủy
            </button>
            <button
              className="btn btn-save"
              onClick={handleSubmit}
              disabled={formLoading}
            >
              {formLoading ? "Đang lưu..." : editingId ? "Cập nhật" : "Thêm xe"}
            </button>
          </>
        }
      >
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Biển số xe *</label>
          <input
            className={styles.formInput}
            value={form.bienSo}
            onChange={(e) => setForm({ ...form, bienSo: e.target.value })}
            placeholder="VD: 59C1-12345"
          />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Tài xế</label>
          <SearchableDropdown
            value={form.idTaiKhoan}
            onChange={(id) => setForm({ ...form, idTaiKhoan: id as number })}
            options={taiXeList.map((tx) => ({
              id: tx.id,
              label: tx.hoTen,
              subLabel: tx.soDienThoai || undefined,
            }))}
            placeholder="-- Chọn tài xế --"
          />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Tải trọng (tấn)</label>
          <input
            type="number"
            className={styles.formInput}
            value={form.taiTrong}
            onChange={(e) => setForm({ ...form, taiTrong: e.target.value })}
            placeholder="VD: 10"
          />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Trạng thái</label>
          <select
            className={styles.formSelect}
            value={form.trangThai}
            onChange={(e) =>
              setForm({ ...form, trangThai: e.target.value as Xe["trangThai"] })
            }
          >
            <option value="san_sang">Sẵn sàng</option>
            <option value="dang_giao">Đang giao</option>
            <option value="bao_tri">Bảo trì</option>
          </select>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Xóa phương tiện"
        message={`Bạn có chắc muốn xóa phương tiện "${deleteTarget?.bienSo}"? Hành động này không thể hoàn tác.`}
        confirmText="Xóa"
        cancelText="Hủy"
        type="danger"
        loading={deleteLoading}
      />

      <ConfirmModal
        isOpen={showSuccess}
        onClose={() => {
          setShowSuccess(false);
          loadData();
          resetForm();
        }}
        onConfirm={() => {
          setShowSuccess(false);
          loadData();
          resetForm();
        }}
        message={
          editingId
            ? "Cập nhật phương tiện thành công!"
            : "Thêm phương tiện thành công!"
        }
        confirmText="Đồng ý"
        cancelText=""
        title="Thành công"
        type="success"
      />

      <ConfirmModal
        isOpen={showCancel}
        onClose={() => setShowCancel(false)}
        onConfirm={() => {
          setShowCancel(false);
          setModalOpen(false);
          resetForm();
        }}
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
