import * as ExcelJS from "exceljs";

function toExcelNum(v: number | string): number {
  if (typeof v === "number") return v;
  const n = parseFloat(
    String(v)
      .replace(/[^\d.,]/g, "")
      .replace(",", "."),
  );
  return isNaN(n) ? 0 : n;
}

// ==================== TEMPLATE ====================
export async function generateCongNoBravoTemplate(): Promise<Blob> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "BTTD";
  wb.created = new Date();

  const ws = wb.addWorksheet("Cong_no");

  // Column widths
  ws.columns = [
    { width: 14 }, // A: Mã
    { width: 42 }, // B: Tên khách hàng
    { width: 18 }, // C: Dư đầu Nợ
    { width: 18 }, // D: Dư đầu Có
    { width: 18 }, // E: Phát sinh Nợ
    { width: 18 }, // F: Phát sinh Có
    { width: 18 }, // G: Dư cuối Nợ
    { width: 18 }, // H: Dư cuối Có
  ];

  // 6 empty rows at top
  for (let r = 1; r <= 6; r++) {
    ws.getRow(r).height = 15;
  }

  // ── Row 7: Main headers (1-indexed in ExcelJS)
  const row7 = ws.getRow(7);
  row7.height = 20;

  // A7: "Mã"
  const cellA7 = row7.getCell(1);
  cellA7.value = "Mã";
  cellA7.font = { bold: true, size: 11 };
  cellA7.alignment = { horizontal: "center", vertical: "middle" };
  cellA7.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFDAE8F3" },
  };
  cellA7.border = {
    top: { style: "thin", color: { argb: "FF8EA9C6" } },
    bottom: { style: "thin", color: { argb: "FF8EA9C6" } },
    left: { style: "thin", color: { argb: "FF8EA9C6" } },
    right: { style: "thin", color: { argb: "FF8EA9C6" } },
  };

  // B7: "Tên khách hàng"
  const cellB7 = row7.getCell(2);
  cellB7.value = "Tên khách hàng";
  cellB7.font = { bold: true, size: 11 };
  cellB7.alignment = { horizontal: "center", vertical: "middle" };
  cellB7.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFDAE8F3" },
  };
  cellB7.border = {
    top: { style: "thin", color: { argb: "FF8EA9C6" } },
    bottom: { style: "thin", color: { argb: "FF8EA9C6" } },
    left: { style: "thin", color: { argb: "FF8EA9C6" } },
    right: { style: "thin", color: { argb: "FF8EA9C6" } },
  };

  // C7: "Dư đầu" (spans C7:D7 via merge + style)
  const cellC7 = row7.getCell(3);
  cellC7.value = "Dư đầu";
  cellC7.font = { bold: true, size: 11 };
  cellC7.alignment = { horizontal: "center", vertical: "middle" };
  cellC7.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFFC000" },
  };
  cellC7.border = {
    top: { style: "thin", color: { argb: "FF8EA9C6" } },
    bottom: { style: "thin", color: { argb: "FF8EA9C6" } },
    left: { style: "thin", color: { argb: "FF8EA9C6" } },
    right: { style: "thin", color: { argb: "FF8EA9C6" } },
  };
  ws.mergeCells(7, 3, 7, 4);

  // E7: "Phát sinh" (spans E7:F7)
  const cellE7 = row7.getCell(5);
  cellE7.value = "Phát sinh";
  cellE7.font = { bold: true, size: 11 };
  cellE7.alignment = { horizontal: "center", vertical: "middle" };
  cellE7.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF92D050" },
  };
  cellE7.border = {
    top: { style: "thin", color: { argb: "FF8EA9C6" } },
    bottom: { style: "thin", color: { argb: "FF8EA9C6" } },
    left: { style: "thin", color: { argb: "FF8EA9C6" } },
    right: { style: "thin", color: { argb: "FF8EA9C6" } },
  };
  ws.mergeCells(7, 5, 7, 6);

  // G7: "Dư cuối" (spans G7:H7)
  const cellG7 = row7.getCell(7);
  cellG7.value = "Dư cuối";
  cellG7.font = { bold: true, size: 11 };
  cellG7.alignment = { horizontal: "center", vertical: "middle" };
  cellG7.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF00B0F0" },
  };
  cellG7.border = {
    top: { style: "thin", color: { argb: "FF8EA9C6" } },
    bottom: { style: "thin", color: { argb: "FF8EA9C6" } },
    left: { style: "thin", color: { argb: "FF8EA9C6" } },
    right: { style: "thin", color: { argb: "FF8EA9C6" } },
  };
  ws.mergeCells(7, 7, 7, 8);

  // ── Row 8: Sub-headers Nợ/Có
  const row8 = ws.getRow(8);
  row8.height = 18;

  const subHeaderStyle = (col: number, label: string, bgColor: string) => {
    const cell = row8.getCell(col);
    cell.value = label;
    cell.font = { bold: true, size: 10 };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: bgColor },
    };
    cell.border = {
      top: { style: "thin", color: { argb: "FF8EA9C6" } },
      bottom: { style: "thin", color: { argb: "FF8EA9C6" } },
      left: { style: "thin", color: { argb: "FF8EA9C6" } },
      right: { style: "thin", color: { argb: "FF8EA9C6" } },
    };
    cell.numFmt = "#,##0";
  };

  subHeaderStyle(1, "", "FFDAE8F3"); // A8: empty (under "Mã")
  subHeaderStyle(2, "", "FFDAE8F3"); // B8: empty (under "Tên KH")
  subHeaderStyle(3, "Nợ", "FFFFC000"); // C8: Nợ under Dư đầu
  subHeaderStyle(4, "Có", "FFFFC000"); // D8: Có under Dư đầu
  subHeaderStyle(5, "Nợ", "FF92D050"); // E8: Nợ under Phát sinh
  subHeaderStyle(6, "Có", "FF92D050"); // F8: Có under Phát sinh
  subHeaderStyle(7, "Nợ", "FF00B0F0"); // G8: Nợ under Dư cuối
  subHeaderStyle(8, "Có", "FF00B0F0"); // H8: Có under Dư cuối

  // ── Row 9: Column numbers 1-8
  const row9 = ws.getRow(9);
  row9.height = 14;
  for (let c = 1; c <= 8; c++) {
    const cell = row9.getCell(c);
    cell.value = c;
    cell.font = { bold: false, size: 9, italic: true };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF2F2F2" },
    };
    cell.border = {
      top: { style: "thin", color: { argb: "FFCCCCCC" } },
      bottom: { style: "thin", color: { argb: "FFCCCCCC" } },
      left: { style: "thin", color: { argb: "FFCCCCCC" } },
      right: { style: "thin", color: { argb: "FFCCCCCC" } },
    };
  }

  // ── Row 10: Sample data row
  const sampleData = [
    "100001",
    "Nguyễn Văn A",
    toExcelNum(0),
    toExcelNum(10000000),
    toExcelNum(5000000),
    toExcelNum(8000000),
    toExcelNum(0),
    toExcelNum(7000000),
  ];

  const row10 = ws.getRow(10);
  row10.height = 16;

  const dataCellStyle = (cell: ExcelJS.Cell, isText: boolean) => {
    cell.font = { size: 10 };
    cell.alignment = isText
      ? { horizontal: "left", vertical: "middle" }
      : { horizontal: "right", vertical: "middle" };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFFFFFF" },
    };
    cell.border = {
      top: { style: "thin", color: { argb: "FFCCCCCC" } },
      bottom: { style: "thin", color: { argb: "FFCCCCCC" } },
      left: { style: "thin", color: { argb: "FFCCCCCC" } },
      right: { style: "thin", color: { argb: "FFCCCCCC" } },
    };
    if (!isText) cell.numFmt = "#,##0";
  };

  sampleData.forEach((v, idx) => {
    const cell = row10.getCell(idx + 1);
    cell.value = v as string | number;
    dataCellStyle(cell, idx === 0 || idx === 1);
  });

  // Freeze pane: freeze first 9 rows
  ws.views = [{ state: "frozen", xSplit: 0, ySplit: 9, activeCell: "A10" }];

  // Print settings
  ws.pageSetup = {
    paperSize: 9, // A4
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
  };
  (ws as any).pageMargins = { left: 0.5, right: 0.5, top: 0.75, bottom: 0.75 };

  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

// ==================== BÁO CÁO CÔNG NỢ ====================
export interface CongNoReportRow {
  nhom: string | null;
  maKhachHang: string | null;
  tenKhachHang: string;
  duDauNo: number;
  duDauCo: number;
  phatSinhNo: number;
  phatSinhCo: number;
  duCuoiNo: number;
  duCuoiCo: number;
}

export async function exportCongNoReport(data: CongNoReportRow[]): Promise<Blob> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "BTTD";
  wb.created = new Date();

  const ws = wb.addWorksheet("Cong_no");

  // Column widths
  ws.columns = [
    { width: 14 }, // A: Mã
    { width: 42 }, // B: Tên khách hàng
    { width: 18 }, // C: Dư đầu Nợ
    { width: 18 }, // D: Dư đầu Có
    { width: 18 }, // E: Phát sinh Nợ
    { width: 18 }, // F: Phát sinh Có
    { width: 18 }, // G: Dư cuối Nợ
    { width: 18 }, // H: Dư cuối Có
  ];

  // 6 empty rows at top
  for (let r = 1; r <= 6; r++) {
    ws.getRow(r).height = 15;
  }

  // ── Row 7: Main headers
  const row7 = ws.getRow(7);
  row7.height = 20;

  const headerStyle = (cell: ExcelJS.Cell, bgColor: string) => {
    cell.font = { bold: true, size: 11 };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: bgColor },
    };
    cell.border = {
      top: { style: "thin", color: { argb: "FF8EA9C6" } },
      bottom: { style: "thin", color: { argb: "FF8EA9C6" } },
      left: { style: "thin", color: { argb: "FF8EA9C6" } },
      right: { style: "thin", color: { argb: "FF8EA9C6" } },
    };
  };

  // A7: "Mã"
  const cellA7 = row7.getCell(1);
  cellA7.value = "Mã";
  headerStyle(cellA7, "FFDAE8F3");

  // B7: "Tên khách hàng"
  const cellB7 = row7.getCell(2);
  cellB7.value = "Tên khách hàng";
  headerStyle(cellB7, "FFDAE8F3");

  // C7: "Dư đầu" (spans C7:D7)
  const cellC7 = row7.getCell(3);
  cellC7.value = "Dư đầu";
  headerStyle(cellC7, "FFFFC000");
  ws.mergeCells(7, 3, 7, 4);

  // E7: "Phát sinh" (spans E7:F7)
  const cellE7 = row7.getCell(5);
  cellE7.value = "Phát sinh";
  headerStyle(cellE7, "FF92D050");
  ws.mergeCells(7, 5, 7, 6);

  // G7: "Dư cuối" (spans G7:H7)
  const cellG7 = row7.getCell(7);
  cellG7.value = "Dư cuối";
  headerStyle(cellG7, "FF00B0F0");
  ws.mergeCells(7, 7, 7, 8);

  // ── Row 8: Sub-headers Nợ/Có
  const row8 = ws.getRow(8);
  row8.height = 18;

  const subHeaderStyle = (col: number, label: string, bgColor: string) => {
    const cell = row8.getCell(col);
    cell.value = label;
    cell.font = { bold: true, size: 10 };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: bgColor },
    };
    cell.border = {
      top: { style: "thin", color: { argb: "FF8EA9C6" } },
      bottom: { style: "thin", color: { argb: "FF8EA9C6" } },
      left: { style: "thin", color: { argb: "FF8EA9C6" } },
      right: { style: "thin", color: { argb: "FF8EA9C6" } },
    };
    cell.numFmt = "#,##0";
  };

  subHeaderStyle(1, "", "FFDAE8F3");
  subHeaderStyle(2, "", "FFDAE8F3");
  subHeaderStyle(3, "Nợ", "FFFFC000");
  subHeaderStyle(4, "Có", "FFFFC000");
  subHeaderStyle(5, "Nợ", "FF92D050");
  subHeaderStyle(6, "Có", "FF92D050");
  subHeaderStyle(7, "Nợ", "FF00B0F0");
  subHeaderStyle(8, "Có", "FF00B0F0");

  // ── Row 9: Column numbers
  const row9 = ws.getRow(9);
  row9.height = 14;
  for (let c = 1; c <= 8; c++) {
    const cell = row9.getCell(c);
    cell.value = c;
    cell.font = { bold: false, size: 9, italic: true };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF2F2F2" },
    };
    cell.border = {
      top: { style: "thin", color: { argb: "FFCCCCCC" } },
      bottom: { style: "thin", color: { argb: "FFCCCCCC" } },
      left: { style: "thin", color: { argb: "FFCCCCCC" } },
      right: { style: "thin", color: { argb: "FFCCCCCC" } },
    };
  }

  // Helper: style cho data row
  const dataCellStyle = (cell: ExcelJS.Cell, isText: boolean) => {
    cell.font = { size: 10 };
    cell.alignment = isText
      ? { horizontal: "left", vertical: "middle" }
      : { horizontal: "right", vertical: "middle" };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFFFFFF" },
    };
    cell.border = {
      top: { style: "thin", color: { argb: "FFCCCCCC" } },
      bottom: { style: "thin", color: { argb: "FFCCCCCC" } },
      left: { style: "thin", color: { argb: "FFCCCCCC" } },
      right: { style: "thin", color: { argb: "FFCCCCCC" } },
    };
    if (!isText) cell.numFmt = "#,##0";
  };

  // Helper: style cho group header
  const groupHeaderStyle = (cell: ExcelJS.Cell, isText: boolean) => {
    cell.font = { bold: true, size: 10 };
    cell.alignment = isText
      ? { horizontal: "left", vertical: "middle" }
      : { horizontal: "right", vertical: "middle" };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE2EFDA" }, // Xanh nhạt
    };
    cell.border = {
      top: { style: "thin", color: { argb: "FF92D050" } },
      bottom: { style: "thin", color: { argb: "FF92D050" } },
      left: { style: "thin", color: { argb: "FF92D050" } },
      right: { style: "thin", color: { argb: "FF92D050" } },
    };
    if (!isText) cell.numFmt = "#,##0";
  };

  // Helper: style cho total row
  const totalCellStyle = (cell: ExcelJS.Cell, isText: boolean) => {
    cell.font = { bold: true, size: 10 };
    cell.alignment = isText
      ? { horizontal: "left", vertical: "middle" }
      : { horizontal: "right", vertical: "middle" };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFFC000" }, // Vàng
    };
    cell.border = {
      top: { style: "medium", color: { argb: "FF000000" } },
      bottom: { style: "medium", color: { argb: "FF000000" } },
      left: { style: "medium", color: { argb: "FF000000" } },
      right: { style: "medium", color: { argb: "FF000000" } },
    };
    if (!isText) cell.numFmt = "#,##0";
  };

  // Group data by nhom
  const groupedData = new Map<string, CongNoReportRow[]>();
  for (const row of data) {
    const nhom = row.nhom || "Chưa phân nhóm";
    if (!groupedData.has(nhom)) {
      groupedData.set(nhom, []);
    }
    groupedData.get(nhom)!.push(row);
  }

  // Tính tổng
  let totalDuDauNo = 0;
  let totalDuDauCo = 0;
  let totalPhatSinhNo = 0;
  let totalPhatSinhCo = 0;
  let totalDuCuoiNo = 0;
  let totalDuCuoiCo = 0;

  let currentRow = 10;

  // Ghi dữ liệu theo nhóm
  const sortedNhom = Array.from(groupedData.keys()).sort();

  for (const nhom of sortedNhom) {
    const items = groupedData.get(nhom)!;

    // Group header row
    const headerRow = ws.getRow(currentRow);
    headerRow.height = 18;

    const headerCell1 = headerRow.getCell(1);
    headerCell1.value = nhom.toUpperCase();
    groupHeaderStyle(headerCell1, true);

    const headerCell2 = headerRow.getCell(2);
    headerCell2.value = `${items.length} khách hàng`;
    groupHeaderStyle(headerCell2, true);

    // Tính tổng nhóm
    let groupDuDauNo = 0;
    let groupDuDauCo = 0;
    let groupPhatSinhNo = 0;
    let groupPhatSinhCo = 0;
    let groupDuCuoiNo = 0;
    let groupDuCuoiCo = 0;

    for (let i = 3; i <= 8; i++) {
      groupHeaderStyle(headerRow.getCell(i), false);
      headerRow.getCell(i).value = 0;
    }

    currentRow++;

    // Data rows
    for (const item of items) {
      const row = ws.getRow(currentRow);
      row.height = 16;

      row.getCell(1).value = item.maKhachHang || "";
      dataCellStyle(row.getCell(1), true);

      row.getCell(2).value = item.tenKhachHang;
      dataCellStyle(row.getCell(2), true);

      row.getCell(3).value = item.duDauNo;
      dataCellStyle(row.getCell(3), false);

      row.getCell(4).value = item.duDauCo;
      dataCellStyle(row.getCell(4), false);

      row.getCell(5).value = item.phatSinhNo;
      dataCellStyle(row.getCell(5), false);

      row.getCell(6).value = item.phatSinhCo;
      dataCellStyle(row.getCell(6), false);

      row.getCell(7).value = item.duCuoiNo;
      dataCellStyle(row.getCell(7), false);

      row.getCell(8).value = item.duCuoiCo;
      dataCellStyle(row.getCell(8), false);

      groupDuDauNo += item.duDauNo;
      groupDuDauCo += item.duDauCo;
      groupPhatSinhNo += item.phatSinhNo;
      groupPhatSinhCo += item.phatSinhCo;
      groupDuCuoiNo += item.duCuoiNo;
      groupDuCuoiCo += item.duCuoiCo;

      currentRow++;
    }

    // Update group header với tổng nhóm
    const updateHeaderRow = ws.getRow(currentRow - items.length - 1);
    updateHeaderRow.getCell(3).value = groupDuDauNo;
    updateHeaderRow.getCell(4).value = groupDuDauCo;
    updateHeaderRow.getCell(5).value = groupPhatSinhNo;
    updateHeaderRow.getCell(6).value = groupPhatSinhCo;
    updateHeaderRow.getCell(7).value = groupDuCuoiNo;
    updateHeaderRow.getCell(8).value = groupDuCuoiCo;

    // Cộng vào tổng
    totalDuDauNo += groupDuDauNo;
    totalDuDauCo += groupDuDauCo;
    totalPhatSinhNo += groupPhatSinhNo;
    totalPhatSinhCo += groupPhatSinhCo;
    totalDuCuoiNo += groupDuCuoiNo;
    totalDuCuoiCo += groupDuCuoiCo;

    // Empty row giữa các nhóm
    currentRow++;
  }

  // Total row
  const totalRow = ws.getRow(currentRow);
  totalRow.height = 20;

  totalRow.getCell(1).value = "TỔNG CỘNG";
  totalCellStyle(totalRow.getCell(1), true);

  totalRow.getCell(2).value = `${data.length} khách hàng`;
  totalCellStyle(totalRow.getCell(2), true);

  totalRow.getCell(3).value = totalDuDauNo;
  totalCellStyle(totalRow.getCell(3), false);

  totalRow.getCell(4).value = totalDuDauCo;
  totalCellStyle(totalRow.getCell(4), false);

  totalRow.getCell(5).value = totalPhatSinhNo;
  totalCellStyle(totalRow.getCell(5), false);

  totalRow.getCell(6).value = totalPhatSinhCo;
  totalCellStyle(totalRow.getCell(6), false);

  totalRow.getCell(7).value = totalDuCuoiNo;
  totalCellStyle(totalRow.getCell(7), false);

  totalRow.getCell(8).value = totalDuCuoiCo;
  totalCellStyle(totalRow.getCell(8), false);

  // Freeze pane
  ws.views = [{ state: "frozen", xSplit: 0, ySplit: 9, activeCell: "A10" }];

  // Print settings
  ws.pageSetup = {
    paperSize: 9,
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
  };
  (ws as any).pageMargins = { left: 0.5, right: 0.5, top: 0.75, bottom: 0.75 };

  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
