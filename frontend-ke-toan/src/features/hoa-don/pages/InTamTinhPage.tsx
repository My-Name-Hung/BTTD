import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { useCallback, useEffect, useRef, useState } from "react";
import { FiArrowLeft, FiDownload, FiPrinter } from "react-icons/fi";
import { useNavigate, useParams } from "react-router-dom";
import { useReactToPrint } from "react-to-print";
import logo from "../../../assets/Logo.png";
import { Loading } from "../../../shared/components/Common";
import { useToast } from "../../../shared/hooks";
import { layDonHang } from "../../../shared/services/api";
import { DonHang } from "../../../shared/types";
import styles from "./InTamTinhPage.module.css";

function formatCurrency(v: number): string {
  if (!v && v !== 0) return "0 đ";
  return v.toLocaleString("vi-VN") + " đ";
}

function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function InTamTinhPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const printRef = useRef<HTMLDivElement>(null);
  const [donHang, setDonHang] = useState<DonHang | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloadLoading, setDownloadLoading] = useState(false);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: donHang ? `TamTinh-${donHang.maDonHang}` : "TamTinh",
    pageStyle: `
      @page { size: A4; margin: 0; }
      @media print {
        .toolbar { display: none !important; }
        .wrapper { background: #e8ecf0 !important; padding-bottom: 40px !important; }
      }
    `,
  });

  const handleDownload = async () => {
    if (!printRef.current) return;
    setDownloadLoading(true);
    try {
      const element = printRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });
      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position -= pageHeight;
        pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`tam-tinh-${donHang?.maDonHang}.pdf`);
    } catch {
      showToast("Lỗi tạo file PDF", "error");
    } finally {
      setDownloadLoading(false);
    }
  };

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const numId = parseInt(id.replace(/[^0-9]/g, ""), 10);
      const dh = await layDonHang(numId);
      setDonHang(dh);
    } catch {
      showToast("Không tải được thông tin đơn hàng", "error");
    } finally {
      setLoading(false);
    }
  }, [id, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) return <Loading />;

  if (!donHang) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.toolbar}>
          <button className={styles.backBtn} onClick={() => navigate(-1)}>
            <FiArrowLeft size={16} /> Quay lại
          </button>
        </div>
        <div className={styles.errorBox}>
          <p>Không tìm thấy thông tin đơn hàng</p>
          <button className={styles.retryBtn} onClick={() => navigate(-1)}>
            Quay lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <button className={styles.backBtn} onClick={() => navigate(-1)}>
          <FiArrowLeft size={16} /> Quay lại
        </button>
        <button className={styles.printBtn} onClick={handlePrint}>
          <FiPrinter size={16} /> In tạm tính
        </button>
        <button
          className={styles.downloadBtn}
          onClick={handleDownload}
          disabled={downloadLoading}
        >
          <FiDownload size={16} />
          {downloadLoading ? "Đang xử lý..." : "Tải PDF"}
        </button>
        <span className={styles.toolbarTitle}>
          Hóa đơn tạm tính – {donHang.maDonHang}
        </span>
      </div>

      {/* Invoice A4 */}
      <div ref={printRef} className={styles.invoiceContainer}>
        {/* Header */}
        <div className={styles.invoiceHeader}>
          <div className={styles.headerLeft}>
            <img
              src={logo}
              alt="Bê Tông Tây Đô"
              className={styles.companyLogo}
            />
            <div className={styles.companyName}>
              CÔNG TY CP BÊ TÔNG TÂY ĐÔ - MST: 1801286137
              <br />
              Km 14, Quốc lộ 91, Phường Phước Thới, Tp. Cần Thơ, Việt Nam
            </div>
          </div>
          <div className={styles.headerRight}>
            <div className={styles.invoiceBadge}>HÓA ĐƠN TẠM TÍNH</div>
            <div className={styles.invoiceMetaText}>
              Mã đơn: <strong>{donHang.maDonHang}</strong>
            </div>
            <div className={styles.invoiceMetaText}>
              Ngày: <strong>{formatDate(donHang.ngayTaoDon)}</strong>
            </div>
          </div>
        </div>

        <div className={styles.titleBar}>
          <div className={styles.titleBarText}>PHIẾU TẠM TÍNH</div>
        </div>

        {/* Thông tin khách hàng */}
        <div className={styles.customerSection}>
          <div className={styles.sectionLabel}>Thông tin khách hàng</div>
          <table className={styles.customerTable}>
            <tbody>
              <tr>
                <td className={styles.customerLabel}>Khách hàng:</td>
                <td className={styles.customerValue}>{donHang.tenKhachHang}</td>
              </tr>
              <tr>
                <td className={styles.customerLabel}>Địa chỉ:</td>
                <td className={styles.customerValue}>{donHang.diaChiNhan}</td>
              </tr>
              <tr>
                <td className={styles.customerLabel}>Điện thoại:</td>
                <td className={styles.customerValue}>{donHang.soDienThoai}</td>
              </tr>
              {donHang.nguoiNhanHang && (
                <tr>
                  <td className={styles.customerLabel}>Người nhận hàng:</td>
                  <td className={styles.customerValue}>{donHang.nguoiNhanHang}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Bảng chi tiết */}
        <div className={styles.detailsSection}>
          <table className={styles.detailsTable}>
            <thead>
              <tr>
                <th>Nội dung</th>
                <th className={styles.thRight}>Khối lượng</th>
                <th className={styles.thRight}>Đơn giá</th>
                <th className={styles.thRight}>Thành tiền</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <div className={styles.productName}>Bê tông thương phẩm</div>
                  <div className={styles.productSub}>{donHang.tenMacBeTong}</div>
                </td>
                <td className={styles.thRight}>
                  {donHang.khoiLuongDat?.toLocaleString("vi-VN")} m³
                </td>
                <td className={styles.thRight}>
                  {formatCurrency(donHang.donGia || 0)}
                </td>
                <td className={styles.thRight}>
                  {formatCurrency(donHang.thanhTien || 0)}
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td className={styles.totalLabel} colSpan={3}>
                  TỔNG CỘNG (TẠM TÍNH)
                </td>
                <td className={styles.totalValue}>
                  {formatCurrency(donHang.thanhTien || 0)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Thông tin bổ sung */}
        <div className={styles.additionalSection}>
          <table className={styles.additionalTable}>
            <tbody>
              <tr>
                <td className={styles.customerLabel}>Ngày giao dự kiến:</td>
                <td className={styles.customerValue}>
                  {donHang.thoiGianGiaoDuKien
                    ? formatDate(donHang.thoiGianGiaoDuKien)
                    : "—"}
                </td>
              </tr>
              {donHang.hangMuc && (
                <tr>
                  <td className={styles.customerLabel}>Hạng mục / Cấu kiện:</td>
                  <td className={styles.customerValue}>{donHang.hangMuc}</td>
                </tr>
              )}
              {donHang.phuongPhapDo && (
                <tr>
                  <td className={styles.customerLabel}>Phương pháp đổ:</td>
                  <td className={styles.customerValue}>
                    {donHang.phuongPhapDo === "do_xa"
                      ? "Đổ xã"
                      : donHang.phuongPhapDo === "do_bom"
                        ? "Đổ bơm"
                        : donHang.phuongPhapDo}
                    {donHang.phuongPhapDo === "do_bom" && donHang.loaiBom && (
                      <span>
                        {donHang.loaiBom === "bom_ngang" ? " – Bơm ngang" : " – Bơm cần"}
                      </span>
                    )}
                    {donHang.phuongPhapDo === "do_xa" && donHang.kieuNoi && (
                      <span>
                        {donHang.kieuNoi === "khong_dau" ? " – Không đầu" :
                         donHang.kieuNoi === "noi_dau" ? " – Nối đầu" :
                         donHang.kieuNoi === "noi_dit" ? " – Nối đít" : ""}
                      </span>
                    )}
                    {donHang.phuongPhapDo === "do_bom" && donHang.chieuDaiBom && (
                      <span> (chiều dài bơm {donHang.chieuDaiBom}m)</span>
                    )}
                    {donHang.phuongPhapDo === "do_xa" && donHang.chieuDaiNoi && (
                      <span> (chiều dài nối {donHang.chieuDaiNoi}m)</span>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Ghi chú */}
        <div className={styles.noticeBox}>
          <strong>Lưu ý:</strong> Đây là phiếu tạm tính. Hóa đơn chính thức sẽ
          được xuất sau khi thanh toán.
        </div>

        {/* Footer */}
        <div className={styles.signatures}>
          <div className={styles.sigCol}>
            <div className={styles.sigTitle}>Người lập</div>
            <div className={styles.sigNote}>(Ký, họ tên)</div>
          </div>
          <div className={styles.sigCol}>
            <div className={styles.sigTitle}>Khách hàng</div>
            <div className={styles.sigNote}>(Ký, họ tên)</div>
          </div>
        </div>

        <div className={styles.invoiceFooter}>
          Công ty CP Bê Tông Tây Đô
          <br />
          Km 14, Quốc lộ 91, Phường Phước Thới, Tp. Cần Thơ, Việt Nam
        </div>
      </div>
    </div>
  );
}
