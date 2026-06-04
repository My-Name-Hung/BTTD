import * as ExcelJS from "exceljs";

/**
 * Download blob as file
 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Header style for export
 */
function applyHeaderStyle(cell: ExcelJS.Cell, bgColor = "FF073CEB") {
  cell.font = { bold: true, size: 11, color: { argb: "FFFFFFFF" } };
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
}

/**
 * Cell style
 */
function applyCellStyle(cell: ExcelJS.Cell, alignRight = false) {
  cell.border = {
    top: { style: "thin", color: { argb: "FFD0D0D0" } },
    bottom: { style: "thin", color: { argb: "FFD0D0D0" } },
    left: { style: "thin", color: { argb: "FFD0D0D0" } },
    right: { style: "thin", color: { argb: "FFD0D0D0" } },
  };
  if (alignRight) {
    cell.alignment = { horizontal: "right", vertical: "middle" };
    cell.numFmt = "#,##0";
  } else {
    cell.alignment = { horizontal: "left", vertical: "middle" };
  }
}

interface ExportHeader {
  key: string;
  label: string;
  width?: number;
  alignRight?: boolean;
}

/**
 * Export array of objects to Excel
 */
export async function exportToExcel(
  title: string,
  headers: ExportHeader[],
  data: Record<string, unknown>[],
  filename: string,
  sheetName = "Sheet1"
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "BTTD";
  wb.created = new Date();

  const ws = wb.addWorksheet(sheetName);

  // Set column widths
  ws.columns = headers.map((h) => ({ width: h.width || 18 }));

  // Title row
  const titleRow = ws.getRow(1);
  titleRow.height = 30;
  const titleCell = titleRow.getCell(1);
  titleCell.value = title;
  titleCell.font = { bold: true, size: 14, color: { argb: "FF073CEB" } };
  titleCell.alignment = { horizontal: "left", vertical: "middle" };
  ws.mergeCells(1, 1, 1, headers.length);

  // Header row
  const headerRow = ws.getRow(2);
  headerRow.height = 24;
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h.label;
    applyHeaderStyle(cell);
  });

  // Data rows
  data.forEach((row, rowIndex) => {
    const dataRow = ws.getRow(rowIndex + 3);
    dataRow.height = 20;
    headers.forEach((h, colIndex) => {
      const cell = dataRow.getCell(colIndex + 1);
      let value: string | number | Date | null | undefined = row[h.key];
      // Handle null, undefined, dates
      if (value === null || value === undefined) {
        value = "";
      } else if (value instanceof Date) {
        value = value.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
      } else if (typeof value === "object") {
        value = String(value);
      }
      cell.value = value as string | number | null;
      applyCellStyle(cell, h.alignRight);
    });
  });

  // Auto filter
  ws.autoFilter = {
    from: { row: 2, column: 1 },
    to: { row: data.length + 2, column: headers.length },
  };

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  downloadBlob(blob, filename);
}

/**
 * Format number as currency
 */
export function formatCurrencyForExport(v: number | string | null | undefined): string {
  if (v === null || v === undefined || v === "") return "";
  const num = typeof v === "string" ? parseFloat(v.replace(/[^\d.,]/g, "").replace(",", ".")) : v;
  if (isNaN(num)) return "";
  return num.toLocaleString("vi-VN");
}

/**
 * Format date for export
 */
export function formatDateForExport(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return "";
  try {
    const d = dateStr instanceof Date ? dateStr : new Date(dateStr as string);
    if (isNaN(d.getTime())) return String(dateStr);
    return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return String(dateStr);
  }
}
