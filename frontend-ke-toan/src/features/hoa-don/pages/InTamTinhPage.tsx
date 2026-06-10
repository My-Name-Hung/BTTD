import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FiArrowLeft, FiPrinter, FiDownload } from "react-icons/fi";
import { useReactToPrint } from "react-to-print";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { Loading } from "../../../shared/components/Common";
import { useToast } from "../../../shared/hooks";
import logo from "../../../assets/Logo.png";
import { layDonHang } from "../../../shared/services/api";
import { DonHang } from "../../../shared/types";
import styles from "./InHoaDonPage.module.css";

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
  if (!donHang) return null;

  return (
    <div className="wrapper">
      {/* Toolbar */}
      <div
        className="toolbar"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: "#fff",
          borderBottom: "1px solid var(--color-border)",
          padding: "10px 20px",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <button
          onClick={() => navigate(-1)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 14px",
            border: "1.5px solid var(--color-border)",
            borderRadius: 8,
            background: "transparent",
            cursor: "pointer",
            fontSize: 14,
            fontWeight: 600,
            fontFamily: "inherit",
          }}
        >
          <FiArrowLeft size={16} /> Quay lại
        </button>
        <button
          onClick={handlePrint}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 16px",
            border: "none",
            borderRadius: 8,
            background: "var(--color-primary)",
            color: "#fff",
            cursor: "pointer",
            fontSize: 14,
            fontWeight: 700,
            fontFamily: "inherit",
          }}
        >
          <FiPrinter size={16} /> In tạm tính
        </button>
        <button
          onClick={handleDownload}
          disabled={downloadLoading}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 16px",
            border: "1.5px solid var(--color-primary)",
            borderRadius: 8,
            background: "transparent",
            color: "var(--color-primary)",
            cursor: "pointer",
            fontSize: 14,
            fontWeight: 700,
            fontFamily: "inherit",
          }}
        >
          <FiDownload size={16} />
          {downloadLoading ? "Đang xử lý..." : "Tải PDF"}
        </button>
        <span
          style={{
            marginLeft: "auto",
            fontSize: 13,
            color: "var(--color-text-secondary)",
            fontWeight: 600,
          }}
        >
          Hóa đơn tạm tính – {donHang.maDonHang}
        </span>
      </div>

      {/* Invoice A4 */}
      <div
        ref={printRef}
        style={{
          width: 210,
          minHeight: 297,
          background: "#fff",
          margin: "20px auto",
          padding: "40px 36px",
          boxSizing: "border-box",
          fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <img
              src={logo}
              alt="Bê Tông Tây Đô"
              style={{ height: 52, objectFit: "contain" }}
            />
            <div style={{ fontSize: 10, color: "#666", marginTop: 4, lineHeight: 1.4 }}>
              CÔNG TY CP BÊ TÔNG TÂY ĐÔ<br />
              Bến Tre, Việt Nam
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div
              style={{
                display: "inline-block",
                background: "#e53935",
                color: "#fff",
                fontSize: 10,
                fontWeight: 700,
                padding: "3px 10px",
                borderRadius: 4,
                letterSpacing: 1,
              }}
            >
              HÓA ĐƠN TẠM TÍNH
            </div>
            <div style={{ fontSize: 11, color: "#666", marginTop: 4 }}>
              Mã đơn: <strong>{donHang.maDonHang}</strong>
            </div>
            <div style={{ fontSize: 11, color: "#666" }}>
              Ngày: <strong>{formatDate(donHang.ngayTaoDon)}</strong>
            </div>
          </div>
        </div>

        <div
          style={{
            borderTop: "2px solid var(--color-primary)",
            borderBottom: "1px solid var(--color-border)",
            padding: "10px 0",
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--color-primary)", textAlign: "center" }}>
            PHIẾU TẠM TÍNH
          </div>
        </div>

        {/* Thông tin khách hàng */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-primary)", textTransform: "uppercase", marginBottom: 6, letterSpacing: 0.5 }}>
            Thông tin khách hàng
          </div>
          <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
            <tbody>
              <tr>
                <td style={{ color: "#666", width: "40%", paddingBottom: 4 }}>Khách hàng:</td>
                <td style={{ fontWeight: 600, paddingBottom: 4 }}>{donHang.tenKhachHang}</td>
              </tr>
              <tr>
                <td style={{ color: "#666", paddingBottom: 4 }}>Địa chỉ:</td>
                <td style={{ paddingBottom: 4 }}>{donHang.diaChiNhan}</td>
              </tr>
              <tr>
                <td style={{ color: "#666", paddingBottom: 4 }}>Điện thoại:</td>
                <td style={{ paddingBottom: 4 }}>{donHang.soDienThoai}</td>
              </tr>
              {donHang.nguoiNhanHang && (
                <tr>
                  <td style={{ color: "#666", paddingBottom: 4 }}>Người nhận hàng:</td>
                  <td style={{ paddingBottom: 4 }}>{donHang.nguoiNhanHang}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Bảng chi tiết */}
        <div style={{ marginBottom: 16 }}>
          <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse", border: "1px solid var(--color-border)" }}>
            <thead>
              <tr style={{ background: "var(--color-primary)", color: "#fff" }}>
                <th style={{ padding: "7px 8px", textAlign: "left", fontWeight: 700 }}>Nội dung</th>
                <th style={{ padding: "7px 8px", textAlign: "right", fontWeight: 700 }}>Khối lượng</th>
                <th style={{ padding: "7px 8px", textAlign: "right", fontWeight: 700 }}>Đơn giá</th>
                <th style={{ padding: "7px 8px", textAlign: "right", fontWeight: 700 }}>Thành tiền</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                <td style={{ padding: "7px 8px" }}>
                  Bê tông thương phẩm<br />
                  <span style={{ fontSize: 10, color: "#666" }}>{donHang.tenMacBeTong}</span>
                </td>
                <td style={{ padding: "7px 8px", textAlign: "right" }}>
                  {donHang.khoiLuongDat?.toLocaleString("vi-VN")} m³
                </td>
                <td style={{ padding: "7px 8px", textAlign: "right" }}>
                  {formatCurrency(donHang.donGia || 0)}
                </td>
                <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: 600 }}>
                  {formatCurrency(donHang.thanhTien || 0)}
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr style={{ background: "#f0f4ff" }}>
                <td colSpan={3} style={{ padding: "8px", textAlign: "right", fontWeight: 700, fontSize: 13 }}>
                  TỔNG CỘNG (TẠM TÍNH)
                </td>
                <td style={{ padding: "8px", textAlign: "right", fontWeight: 700, fontSize: 14, color: "var(--color-primary)" }}>
                  {formatCurrency(donHang.thanhTien || 0)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Thông tin bổ sung */}
        <div style={{ marginBottom: 20 }}>
          <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
            <tbody>
              <tr>
                <td style={{ color: "#666", paddingBottom: 4 }}>Ngày giao dự kiến:</td>
                <td style={{ paddingBottom: 4 }}>{donHang.thoiGianGiaoDuKien ? formatDate(donHang.thoiGianGiaoDuKien) : "—"}</td>
              </tr>
              {donHang.hangMuc && (
                <tr>
                  <td style={{ color: "#666", paddingBottom: 4 }}>Hạng mục:</td>
                  <td style={{ paddingBottom: 4 }}>{donHang.hangMuc}</td>
                </tr>
              )}
              {donHang.phuongPhapDo && (
                <tr>
                  <td style={{ color: "#666", paddingBottom: 4 }}>Phương pháp đổ:</td>
                  <td style={{ paddingBottom: 4 }}>
                    {donHang.phuongPhapDo === "do_xa" ? "Đổ xa" : donHang.phuongPhapDo === "do_bom" ? "Đổ bơm" : donHang.phuongPhapDo}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Ghi chú */}
        <div
          style={{
            background: "#fffbeb",
            border: "1px solid #f59e0b",
            borderRadius: 6,
            padding: "8px 12px",
            fontSize: 11,
            color: "#92400e",
            marginBottom: 24,
          }}
        >
          <strong>Lưu ý:</strong> Đây là phiếu tạm tính. Hóa đơn chính thức sẽ được xuất sau khi thanh toán.
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#666", marginTop: 32 }}>
          <div style={{ textAlign: "center", flex: 1 }}>
            <div style={{ fontWeight: 700, marginBottom: 40 }}>Người lập</div>
            <div style={{ fontSize: 10 }}>(Ký, họ tên)</div>
          </div>
          <div style={{ textAlign: "center", flex: 1 }}>
            <div style={{ fontWeight: 700, marginBottom: 40 }}>Khách hàng</div>
            <div style={{ fontSize: 10 }}>(Ký, họ tên)</div>
          </div>
        </div>

        <div style={{ textAlign: "center", fontSize: 10, color: "#999", marginTop: 24, borderTop: "1px solid #eee", paddingTop: 12 }}>
          Công ty CP Bê Tông Tây Đô · Bến Tre · Hotline: 1900 xxxx
        </div>
      </div>
    </div>
  );
}
