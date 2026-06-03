import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FiArrowLeft, FiPrinter } from "react-icons/fi";
import { Loading } from "../components/Common";
import { layHoaDonTheoDonHang, layDonHang } from "../services/api";
import styles from "./InHoaDonPage.module.css";

function formatCurrency(v: number): string {
  return v?.toLocaleString("vi-VN") + " đ" || "0 đ";
}

export default function InHoaDonPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [hoaDon, setHoaDon] = useState<any>(null);
  const [donHang, setDonHang] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!id) return;
      setLoading(true);
      try {
        const [hdList, dh] = await Promise.all([
          layHoaDonTheoDonHang(parseInt(id.replace(/[^0-9]/g, ""), 10)),
          layDonHang(parseInt(id.replace(/[^0-9]/g, ""), 10)).catch(() => null),
        ]);
        // Tìm hóa đơn với id = route param
        const hd = hdList.find((h: any) => h.id === parseInt(id, 10)) || hdList[0];
        setHoaDon(hd);
        setDonHang(dh);
      } catch {
        // fallback
        setHoaDon(null);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) return <Loading />;
  if (!hoaDon) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.notFound}>
          <p>Không tìm thấy hóa đơn</p>
          <button onClick={() => navigate(-1)}>Quay lại</button>
        </div>
      </div>
    );
  }

  const hd = hoaDon;
  const dh = donHang || {};
  const isCongNo = hd.loaiThanhToan === "cong_no";

  return (
    <div className={styles.wrapper}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <button className={styles.backBtn} onClick={() => navigate(-1)}>
          <FiArrowLeft size={16} /> Quay lại
        </button>
        <button className={styles.printBtn} onClick={handlePrint}>
          <FiPrinter size={16} /> In hóa đơn
        </button>
      </div>

      {/* Invoice */}
      <div className={styles.invoice} id="invoice-print">
        {/* Header */}
        <div className={styles.invoiceHeader}>
          <div className={styles.companyInfo}>
            <h1 className={styles.companyName}>CÔNG TY BÊ TÔNG TÂY ĐÔ</h1>
            <p>Địa chỉ: ...</p>
            <p>Điện thoại: ...</p>
          </div>
          <div className={styles.invoiceTitle}>
            <h2>HÓA ĐƠN BÁN HÀNG</h2>
            <p className={styles.soHoaDon}>
              Số: <strong>{hd.maHoaDon}</strong>
            </p>
            <p className={styles.ngayLap}>
              Ngày: {hd.ngayLap ? new Date(hd.ngayLap).toLocaleDateString("vi-VN") : ""}
            </p>
          </div>
        </div>

        {/* Info Grid */}
        <div className={styles.infoGrid}>
          <div className={styles.infoCol}>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Mã đơn hàng:</span>
              <span className={styles.infoValue}>{dh.maDonHang || hd.maHoaDon?.split("-").pop() || ""}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Khách hàng:</span>
              <span className={styles.infoValue}>{hd.khachHang || dh.tenKhachHang || ""}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Địa chỉ giao hàng:</span>
              <span className={styles.infoValue}>{dh.diaChiNhan || ""}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Mác bê tông:</span>
              <span className={styles.infoValue}>{dh.tenMacBeTong || hd.tenMacBeTong || ""}</span>
            </div>
          </div>
          <div className={styles.infoCol}>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Khối lượng:</span>
              <span className={styles.infoValue}>{dh.khoiLuongDat || 0} m³</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Đơn giá:</span>
              <span className={styles.infoValue}>{formatCurrency(dh.donGia || 0)}/m³</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Loại xi măng:</span>
              <span className={styles.infoValue}>{hd.loaiXiMang || ""}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Giờ đổ:</span>
              <span className={styles.infoValue}>{hd.gioDo || ""}</span>
            </div>
          </div>
        </div>

        {/* Table */}
        <table className={styles.table}>
          <thead>
            <tr>
              <th>STT</th>
              <th>Nội dung</th>
              <th>Đơn vị tính</th>
              <th>Số lượng</th>
              <th>Đơn giá (đ)</th>
              <th>Thành tiền (đ)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={styles.center}>1</td>
              <td>Bê tông thương phẩm ({dh.tenMacBeTong || ""})</td>
              <td className={styles.center}>m³</td>
              <td className={styles.right}>{dh.khoiLuongDat || 0}</td>
              <td className={styles.right}>{(dh.donGia || 0).toLocaleString("vi-VN")}</td>
              <td className={styles.right}>{(dh.thanhTien || 0).toLocaleString("vi-VN")}</td>
            </tr>
            {hd.buuVanChuyen > 0 && (
              <tr>
                <td className={styles.center}>2</td>
                <td>Phí bù vận chuyển</td>
                <td className={styles.center}></td>
                <td className={styles.right}></td>
                <td className={styles.right}></td>
                <td className={styles.right}>{hd.buuVanChuyen.toLocaleString("vi-VN")}</td>
              </tr>
            )}
            {hd.phiPhatSinh > 0 && (
              <tr>
                <td className={styles.center}>{hd.buuVanChuyen > 0 ? "3" : "2"}</td>
                <td>Chi phí phát sinh</td>
                <td className={styles.center}></td>
                <td className={styles.right}></td>
                <td className={styles.right}></td>
                <td className={styles.right}>{hd.phiPhatSinh.toLocaleString("vi-VN")}</td>
              </tr>
            )}
            {hd.giamTru > 0 && (
              <tr>
                <td className={styles.center}>{hd.phiPhatSinh > 0 || hd.buuVanChuyen > 0 ? "4" : "2"}</td>
                <td>Giảm trừ / Khuyến mãi</td>
                <td className={styles.center}></td>
                <td className={styles.right}></td>
                <td className={styles.right}></td>
                <td className={`${styles.right} ${styles.red}`}>-{hd.giamTru.toLocaleString("vi-VN")}</td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className={styles.totalRow}>
              <td colSpan={5} className={styles.right}><strong>TỔNG CỘNG</strong></td>
              <td className={styles.right}><strong>{hd.tongCong.toLocaleString("vi-VN")} đ</strong></td>
            </tr>
            <tr>
              <td colSpan={5} className={styles.right}>Số tiền bằng chữ:</td>
              <td className={styles.right}>{numberToVietnamese(hd.tongCong)}</td>
            </tr>
          </tfoot>
        </table>

        {/* Payment Info */}
        <div className={styles.paymentInfo}>
          <div className={styles.paymentBadge}>
            {isCongNo ? "CÔNG NỢ" : "TRẢ HẾT"}
          </div>
          {isCongNo && hd.hanTraCongNo && (
            <p className={styles.hanTra}>Hạn thanh toán: {new Date(hd.hanTraCongNo).toLocaleDateString("vi-VN")}</p>
          )}
        </div>

        {/* Notes */}
        {hd.ghiChu && (
          <div className={styles.ghiChu}>
            <strong>Ghi chú:</strong> {hd.ghiChu}
          </div>
        )}

        {/* Signatures */}
        <div className={styles.signatures}>
          <div className={styles.sigCol}>
            <p className={styles.sigTitle}><strong>Người lập hóa đơn</strong></p>
            <p className={styles.sigNote}>(Ký và ghi rõ họ tên)</p>
            <div className={styles.sigArea}></div>
          </div>
          <div className={styles.sigCol}>
            <p className={styles.sigTitle}><strong>Khách hàng</strong></p>
            <p className={styles.sigNote}>(Ký và ghi rõ họ tên)</p>
            <div className={styles.sigArea}></div>
          </div>
        </div>

        {/* Footer */}
        <div className={styles.invoiceFooter}>
          <p>Cảm ơn quý khách đã sử dụng dịch vụ của Bê Tông Tây Đô!</p>
        </div>
      </div>
    </div>
  );
}

// Hàm đọc số thành chữ tiếng Việt
function numberToVietnamese(n: number): string {
  if (n === 0) return "Không đồng";
  const units = ["", "nghìn", "triệu", "tỷ"];
  const digits = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
  if (n < 1000) return `${Math.round(n)} đồng`;
  return `${Math.round(n).toLocaleString("vi-VN")} đồng`;
}
