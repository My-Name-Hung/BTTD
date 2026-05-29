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

export async function generateCongNoBravoTemplate(): Promise<Buffer> {
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
  ws.pageMargins = { left: 0.5, right: 0.5, top: 0.75, bottom: 0.75 };

  const buf = (await wb.xlsx.writeBuffer()) as Buffer;
  return buf;
}
