import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { query } from "../config/database";

export interface ImportResult {
  total: number;
  success: number;
  failed: number;
  errors: string[];
  details: { row: number; message: string; data: Record<string, unknown> }[];
}

export interface ImportHistory {
  id: number;
  loai: string;
  tenFile: string;
  tongSo: number;
  thanhCong: number;
  thatBai: number;
  nguoiTaiId: number;
  nguoiTaiHoTen: string;
  ngayTai: Date;
}

// ===== Lịch sử import =====
export async function xoaLichSuImportCu(): Promise<number> {
  const result = await query(
    `DELETE FROM ImportHistory WHERE ngayTai < DATEADD(DAY, -2, GETDATE())`,
  );
  return result.rowsAffected[0];
}
export async function layLichSuImport(
  loai: string,
  page = 1,
  limit = 20,
  tuNgay?: string,
  denNgay?: string,
): Promise<{ data: ImportHistory[]; total: number }> {
  const offset = (page - 1) * limit;
  let where = "WHERE 1=1 AND ih.loai = @loai";
  const params: Record<string, unknown> = { loai, offset, limit };

  if (tuNgay) {
    where += " AND ih.ngayTai >= @tuNgay";
    params.tuNgay = tuNgay;
  }
  if (denNgay) {
    where += " AND ih.ngayTai <= @denNgay";
    params.denNgay = denNgay + "T23:59:59";
  }

  const [countRow] = await query<{ total: number }>(
    `SELECT COUNT(*) as total FROM ImportHistory ih ${where}`,
    params,
  );

  const rows = await query<ImportHistory>(
    `SELECT ih.*, nd.hoTen as nguoiTaiHoTen
     FROM ImportHistory ih
     LEFT JOIN NguoiDung nd ON ih.nguoiTaiId = nd.id
     ${where}
     ORDER BY ih.ngayTai DESC
     OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`,
    params,
  );

  return { data: rows, total: countRow?.total || 0 };
}

async function ghiLichSuImport(
  loai: string,
  tenFile: string,
  tongSo: number,
  thanhCong: number,
  thatBai: number,
  nguoiTaiId: number,
): Promise<void> {
  await query(
    `INSERT INTO ImportHistory (loai, tenFile, tongSo, thanhCong, thatBai, nguoiTaiId)
     VALUES (@loai, @tenFile, @tongSo, @thanhCong, @thatBai, @nguoiTaiId)`,
    { loai, tenFile, tongSo, thanhCong, thatBai, nguoiTaiId },
  );
}

// ===== Import đơn hàng =====
export async function importDonHang(
  rows: Record<string, unknown>[],
  nguoiTaiId: number,
  tenFile: string,
): Promise<ImportResult> {
  const errors: ImportResult["errors"] = [];
  const details: ImportResult["details"] = [];
  let success = 0;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowNum = i + 2;
    try {
      // Helper: fuzzy match key bằng cách so sánh normalized substrings
      const getRowValFuzzy = (
        row: Record<string, unknown>,
        ...patterns: string[]
      ): unknown => {
        const normalizedMap = new Map<string, string>();
        for (const key of Object.keys(row)) {
          normalizedMap.set(
            key
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .replace(/[^a-zA-Z0-9]/g, "")
              .toLowerCase(),
            key,
          );
        }
        for (const pattern of patterns) {
          const normPattern = pattern
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-zA-Z0-9]/g, "")
            .toLowerCase();
          for (const [normKey, origKey] of normalizedMap) {
            // Match: key chứa pattern HOẶC pattern chứa key (substring match)
            if (
              normKey.includes(normPattern) ||
              normPattern.includes(normKey)
            ) {
              return row[origKey];
            }
            // Match từng từ trong pattern ( VD: "Khoi luong dat" match "Khoiluongatm" )
            const patternWords = normPattern.split(/\s+/).filter(Boolean);
            if (
              patternWords.length > 0 &&
              patternWords.every((word) => normKey.includes(word))
            ) {
              return row[origKey];
            }
          }
        }
        return undefined;
      };
      const parseNum = (v: unknown): number => {
        const s = String(v ?? "0");
        return parseFloat(s.replace(/[^\d.,]/g, "").replace(",", ".")) || 0;
      };

      const tenKhachHang = String(
        getRowValFuzzy(r, "Tên khách hàng") || "",
      ).trim();
      const diaChiNhan = String(getRowValFuzzy(r, "Địa chỉ nhận") || "").trim();
      const soDienThoai = String(
        getRowValFuzzy(r, "Số điện thoại") || "",
      ).trim();
      const tenMacBeTong = String(
        getRowValFuzzy(r, "Tên mác bê tông") || "",
      ).trim();
      const khoiLuongDat = parseNum(
        getRowValFuzzy(r, "Khối lượng đặt", "Khối lượng"),
      );
      const donGia = parseNum(getRowValFuzzy(r, "Đơn giá"));
      const thoiGianGiaoDuKien =
        getRowValFuzzy(r, "Thời gian giao dự kiến") || null;
      const ghiChu = String(getRowValFuzzy(r, "Ghi chú") || "").trim();
      const tramTronTen = String(getRowValFuzzy(r, "Trạm trộn") || "").trim();

      if (!tenKhachHang) {
        errors.push(`Dòng ${rowNum}: Thiếu tên khách hàng`);
        details.push({ row: rowNum, message: "Thiếu tên khách hàng", data: r });
        continue;
      }
      if (!diaChiNhan) {
        errors.push(`Dòng ${rowNum}: Thiếu địa chỉ nhận`);
        details.push({ row: rowNum, message: "Thiếu địa chỉ nhận", data: r });
        continue;
      }

      const maDonHang = `DH${Date.now().toString().slice(-8)}-${uuidv4().slice(0, 4).toUpperCase()}`;
      const thanhTien = khoiLuongDat * donGia;
      const conLai = thanhTien;

      // Lookup idTramTron theo tên (case-insensitive)
      let idTramTron: number | null = null;
      if (tramTronTen) {
        const tramRows = await query<{ id: number }[]>(
          `SELECT TOP 1 id FROM TramTron WHERE LOWER(tenTram) = LOWER(@tenTram)`,
          { tenTram: tramTronTen },
        );
        if (tramRows.length > 0) idTramTron = tramRows[0].id;
      }

      await query(
        `INSERT INTO DonHang (
          maDonHang, idTramTron, tenKhachHang, diaChiNhan, soDienThoai,
          tenMacBeTong, khoiLuongDat, donGia, thanhTien, conLai,
          thoiGianGiaoDuKien, trangThaiDon, trangThaiHoanThanh,
          nguoiTaoId, ghiChu
        ) VALUES (
          @maDonHang, @idTramTron, @tenKhachHang, @diaChiNhan, @soDienThoai,
          @tenMacBeTong, @khoiLuongDat, @donGia, @thanhTien, @conLai,
          @thoiGianGiaoDuKien, N'cho_duyet', N'chua_hoan_thanh',
          @nguoiTaiId, @ghiChu
        )`,
        {
          maDonHang,
          idTramTron,
          tenKhachHang,
          diaChiNhan,
          soDienThoai,
          tenMacBeTong,
          khoiLuongDat,
          donGia,
          thanhTien,
          conLai,
          thoiGianGiaoDuKien: thoiGianGiaoDuKien
            ? new Date(String(thoiGianGiaoDuKien))
            : null,
          nguoiTaiId,
          ghiChu: ghiChu || null,
        },
      );
      success++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Lỗi không xác định";
      errors.push(`Dòng ${rowNum}: ${msg}`);
      details.push({ row: rowNum, message: msg, data: r });
    }
  }

  const failed = rows.length - success;
  await ghiLichSuImport(
    "don_hang",
    tenFile,
    rows.length,
    success,
    failed,
    nguoiTaiId,
  );
  return { total: rows.length, success, failed, errors, details };
}

// ===== Import khách hàng =====
export async function importKhachHang(
  rows: Record<string, unknown>[],
  nguoiTaiId: number,
  tenFile: string,
): Promise<ImportResult> {
  const errors: ImportResult["errors"] = [];
  const details: ImportResult["details"] = [];
  let success = 0;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowNum = i + 2;
    try {
      const tenKhachHang = String(
        r["Tên khách hàng"] || r["tenKhachHang"] || "",
      ).trim();
      const diaChi = String(r["Địa chỉ"] || r["diaChi"] || "").trim();
      const soDienThoai = String(
        r["Số điện thoại"] || r["soDienThoai"] || "",
      ).trim();
      const email = String(r["Email"] || r["email"] || "").trim();
      const ghiChu = String(r["Ghi chú"] || r["ghiChu"] || "").trim();

      if (!tenKhachHang) {
        errors.push(`Dòng ${rowNum}: Thiếu tên khách hàng`);
        details.push({ row: rowNum, message: "Thiếu tên khách hàng", data: r });
        continue;
      }

      await query(
        `INSERT INTO KhachHang (tenKhachHang, diaChi, soDienThoai, email, ghiChu)
         VALUES (@tenKhachHang, @diaChi, @soDienThoai, @email, @ghiChu)`,
        {
          tenKhachHang,
          diaChi: diaChi || null,
          soDienThoai: soDienThoai || null,
          email: email || null,
          ghiChu: ghiChu || null,
        },
      );
      success++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Lỗi không xác định";
      errors.push(`Dòng ${rowNum}: ${msg}`);
      details.push({ row: rowNum, message: msg, data: r });
    }
  }

  const failed = rows.length - success;
  await ghiLichSuImport(
    "khach_hang",
    tenFile,
    rows.length,
    success,
    failed,
    nguoiTaiId,
  );
  return { total: rows.length, success, failed, errors, details };
}

// ===== Import người dùng =====
export async function importNguoiDung(
  rows: Record<string, unknown>[],
  nguoiTaiId: number,
  tenFile: string,
): Promise<ImportResult> {
  const errors: ImportResult["errors"] = [];
  const details: ImportResult["details"] = [];
  let success = 0;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowNum = i + 2;
    try {
      const tenDangNhap = String(
        r["Tên đăng nhập"] || r["tenDangNhap"] || "",
      ).trim();
      const matKhau = String(r["Mật khẩu"] || r["matKhau"] || "").trim();
      const hoTen = String(r["Họ tên"] || r["hoTen"] || "").trim();
      const email = String(r["Email"] || r["email"] || "").trim();
      const soDienThoai = String(
        r["Số điện thoại"] || r["soDienThoai"] || "",
      ).trim();
      const vaiTro = String(r["Vai trò"] || r["vaiTro"] || "ke_toan")
        .trim()
        .toLowerCase();

      if (!tenDangNhap) {
        errors.push(`Dòng ${rowNum}: Thiếu tên đăng nhập`);
        details.push({ row: rowNum, message: "Thiếu tên đăng nhập", data: r });
        continue;
      }
      if (!matKhau) {
        errors.push(`Dòng ${rowNum}: Thiếu mật khẩu`);
        details.push({ row: rowNum, message: "Thiếu mật khẩu", data: r });
        continue;
      }
      if (!hoTen) {
        errors.push(`Dòng ${rowNum}: Thiếu họ tên`);
        details.push({ row: rowNum, message: "Thiếu họ tên", data: r });
        continue;
      }

      const validRoles = [
        "admin",
        "ke_toan",
        "dieu_phoi",
        "lanh_dao",
        "kho",
        "sale",
        "tai_xe",
        "ky_thuat",
      ];
      const normalizedRole = validRoles.includes(vaiTro) ? vaiTro : "ke_toan";

      const hashed = await bcrypt.hash(matKhau, 10);
      await query(
        `INSERT INTO NguoiDung (tenDangNhap, matKhau, hoTen, email, soDienThoai, vaiTro)
         VALUES (@tenDangNhap, @matKhau, @hoTen, @email, @soDienThoai, @vaiTro)`,
        {
          tenDangNhap,
          matKhau: hashed,
          hoTen,
          email: email || null,
          soDienThoai: soDienThoai || null,
          vaiTro: normalizedRole,
        },
      );
      success++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Lỗi không xác định";
      errors.push(`Dòng ${rowNum}: ${msg}`);
      details.push({ row: rowNum, message: msg, data: r });
    }
  }

  const failed = rows.length - success;
  await ghiLichSuImport(
    "nguoi_dung",
    tenFile,
    rows.length,
    success,
    failed,
    nguoiTaiId,
  );
  return { total: rows.length, success, failed, errors, details };
}

// ===== Import phương tiện =====
export async function importPhuongTien(
  rows: Record<string, unknown>[],
  nguoiTaiId: number,
  tenFile: string,
): Promise<ImportResult> {
  const errors: ImportResult["errors"] = [];
  const details: ImportResult["details"] = [];
  let success = 0;

  const getRowValFuzzy = (
    row: Record<string, unknown>,
    ...patterns: string[]
  ): unknown => {
    const normalizedMap = new Map<string, string>();
    for (const key of Object.keys(row)) {
      normalizedMap.set(
        key
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-zA-Z0-9]/g, "")
          .toLowerCase(),
        key,
      );
    }
    for (const pattern of patterns) {
      const normPattern = pattern
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9]/g, "")
        .toLowerCase();
      for (const [normKey, origKey] of normalizedMap) {
        if (normKey.includes(normPattern) || normPattern.includes(normKey)) {
          return row[origKey];
        }
        const patternWords = normPattern.split(/\s+/).filter(Boolean);
        if (
          patternWords.length > 0 &&
          patternWords.every((word) => normKey.includes(word))
        ) {
          return row[origKey];
        }
      }
    }
    return undefined;
  };

  const parseNum = (v: unknown): number => {
    const s = String(v ?? "0");
    return parseFloat(s.replace(/[^\d.,]/g, "").replace(",", ".")) || 0;
  };

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowNum = i + 2;
    try {
      const bienSo = String(
        getRowValFuzzy(r, "Biển số", "Biển số xe", "bienSo") || "",
      ).trim();
      const tenTaiXe = String(
        getRowValFuzzy(r, "Tên tài xế", "tenTaiXe") || "",
      ).trim();
      const soDienThoaiTaiXe = String(
        getRowValFuzzy(r, "SĐT tài xế", "Điện thoại tài xế") || "",
      ).trim();
      const taiTrong = parseNum(
        getRowValFuzzy(r, "Tải trọng", "Tải trọng (tấn)", "taiTrong"),
      );

      if (!bienSo) {
        errors.push(`Dòng ${rowNum}: Thiếu biển số xe`);
        details.push({ row: rowNum, message: "Thiếu biển số xe", data: r });
        continue;
      }

      // Tra cứu idTaiKhoan từ bảng NguoiDung nếu có tên tài xế
      let idTaiKhoan: number | null = null;
      if (tenTaiXe) {
        const tx = await query<{ id: number }>(
          `SELECT id FROM NguoiDung WHERE hoTen = @hoTen AND vaiTro = N'tai_xe'`,
          { hoTen: tenTaiXe },
        );
        if (tx.length > 0) {
          idTaiKhoan = tx[0].id;
        }
      }

      // UPSERT: update nếu biển số đã tồn tại, insert nếu chưa
      const existing = await query<{ id: number }>(
        `SELECT id FROM Xe WHERE bienSo = @bienSo`,
        { bienSo: bienSo.toUpperCase() },
      );

      if (existing.length > 0) {
        await query(
          `UPDATE Xe SET idTaiKhoan = @idTaiKhoan, tenTaiXe = @tenTaiXe, soDienThoaiTaiXe = @soDienThoaiTaiXe, taiTrong = @taiTrong WHERE bienSo = @bienSo`,
          {
            bienSo: bienSo.toUpperCase(),
            idTaiKhoan,
            tenTaiXe: tenTaiXe || null,
            soDienThoaiTaiXe: soDienThoaiTaiXe || null,
            taiTrong: taiTrong || null,
          },
        );
      } else {
        await query(
          `INSERT INTO Xe (bienSo, idTaiKhoan, tenTaiXe, soDienThoaiTaiXe, taiTrong, trangThai)
           VALUES (@bienSo, @idTaiKhoan, @tenTaiXe, @soDienThoaiTaiXe, @taiTrong, N'san_sang')`,
          {
            bienSo: bienSo.toUpperCase(),
            idTaiKhoan,
            tenTaiXe: tenTaiXe || null,
            soDienThoaiTaiXe: soDienThoaiTaiXe || null,
            taiTrong: taiTrong || null,
          },
        );
      }
      success++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Lỗi không xác định";
      errors.push(`Dòng ${rowNum}: ${msg}`);
      details.push({ row: rowNum, message: msg, data: r });
    }
  }

  const failed = rows.length - success;
  await ghiLichSuImport(
    "phuong_tien",
    tenFile,
    rows.length,
    success,
    failed,
    nguoiTaiId,
  );
  return { total: rows.length, success, failed, errors, details };
}

// ===== Import mác bê tông =====
export async function importMacBeTong(
  rows: Record<string, unknown>[],
  nguoiTaiId: number,
  tenFile: string,
): Promise<ImportResult> {
  const errors: ImportResult["errors"] = [];
  const details: ImportResult["details"] = [];
  let success = 0;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowNum = i + 2;
    try {
      const tenMac = String(r["Tên mác"] || r["tenMac"] || "").trim();
      const donGiaRaw = String(
        r["DonGia"] || r["Đơn giá"] || r["dongia"] || "0",
      )
        .replace(/[^\d.,]/g, "")
        .replace(",", ".");
      const donGia = parseFloat(donGiaRaw) || 0;
      const chiPhiRaw = String(
        r["ChiPhiPhatSinh"] ||
          r["Chi phí phát sinh"] ||
          r["chiphiphatsinh"] ||
          "0",
      )
        .replace(/[^\d.,]/g, "")
        .replace(",", ".");
      const chiPhiPhatSinh = parseFloat(chiPhiRaw) || 0;
      const buRaw = String(
        r["BuVanChuyen"] || r["Bù vận chuyển"] || r["buvanchuyen"] || "0",
      )
        .replace(/[^\d.,]/g, "")
        .replace(",", ".");
      const buVanChuyen = parseFloat(buRaw) || 0;
      const moTa = String(r["MoTa"] || r["Mô tả"] || r["moTa"] || "").trim();

      if (!tenMac) {
        errors.push(`Dòng ${rowNum}: Thiếu tên mác bê tông`);
        details.push({
          row: rowNum,
          message: "Thiếu tên mác bê tông",
          data: r,
        });
        continue;
      }

      // Upsert: update nếu đã tồn tại, insert nếu chưa
      const existing = await query<{ id: number }[]>(
        `SELECT id FROM MacBeTong WHERE LOWER(tenMac) = LOWER(@tenMac)`,
        { tenMac },
      );
      if (existing.length > 0) {
        await query(
          `UPDATE MacBeTong SET donGia = @donGia, chiPhiPhatSinh = @chiPhiPhatSinh, buVanChuyen = @buVanChuyen, moTa = @moTa WHERE id = @id`,
          {
            donGia,
            chiPhiPhatSinh,
            buVanChuyen,
            moTa: moTa || null,
            id: existing[0].id,
          },
        );
      } else {
        await query(
          `INSERT INTO MacBeTong (tenMac, donGia, chiPhiPhatSinh, buVanChuyen, moTa) VALUES (@tenMac, @donGia, @chiPhiPhatSinh, @buVanChuyen, @moTa)`,
          { tenMac, donGia, chiPhiPhatSinh, buVanChuyen, moTa: moTa || null },
        );
      }
      success++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Lỗi không xác định";
      errors.push(`Dòng ${rowNum}: ${msg}`);
      details.push({ row: rowNum, message: msg, data: r });
    }
  }

  const failed = rows.length - success;
  await ghiLichSuImport(
    "mac_be_tong",
    tenFile,
    rows.length,
    success,
    failed,
    nguoiTaiId,
  );
  return { total: rows.length, success, failed, errors, details };
}

// ===== Import công nợ (định dạng Bravo) =====
export async function importCongNo(
  rows: Record<string, unknown>[],
  nguoiTaiId: number,
  tenFile: string,
): Promise<ImportResult> {
  const errors: ImportResult["errors"] = [];
  const details: ImportResult["details"] = [];
  let success = 0;

  // Bravo dùng key __EMPTY, __EMPTY_1... nên lấy theo index từ values
  const getRowVal = (row: unknown, idx: number): unknown => {
    if (Array.isArray(row)) return row[idx];
    const vals = Object.values(row as Record<string, unknown>);
    return vals[idx];
  };

  const parseNum = (v: unknown): number => {
    if (typeof v === "number") return v;
    const s = String(v ?? "0");
    return parseFloat(s.replace(/[^\d.,]/g, "").replace(",", ".")) || 0;
  };

  // Nhóm cố định từ Bravo
  const NHOM_LABELS: Record<string, string> = {
    "Các công ty thuộc Tây Đô Group": "Các công ty thuộc Tây Đô Group",
    "Đơn vị, cá nhân, tổ chức có MST": "Đơn vị, cá nhân, tổ chức có MST",
    "Đơn vị trong nước có MST": "Đơn vị trong nước có MST",
    "Cá nhân có MST": "Cá nhân có MST",
    "Đơn vị, cá nhân, tổ chức không có MST": "Đơn vị, cá nhân, tổ chức không có MST",
    "Bê tông Tây Đô": "Bê tông Tây Đô",
    "Nội bộ từng công ty": "Nội bộ từng công ty",
    "Nội bộ công ty Bê Tông Tây Đô": "Nội bộ công ty Bê Tông Tây Đô",
  };

  let currentNhom = "Chưa phân nhóm";

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowNum = i + 2;
    try {
      // Lấy theo index hoặc cell ref
      const maRaw = getRowVal(r, 0);
      const tenRaw = getRowVal(r, 1);
      const duDauNoRaw = getRowVal(r, 2);
      const duDauCoRaw = getRowVal(r, 3);
      const psNoRaw = getRowVal(r, 4);
      const psCoRaw = getRowVal(r, 5);
      const duCuoiNoRaw = getRowVal(r, 6);
      const duCuoiCoRaw = getRowVal(r, 7);

      const maKhachHang = String(maRaw ?? "").trim().replace(/\s+$/, "");
      const tenKhachHang = String(tenRaw ?? "").trim();
      const duDauNo = parseNum(duDauNoRaw);
      const duDauCo = parseNum(duDauCoRaw);
      const phatSinhNo = parseNum(psNoRaw);
      const phatSinhCo = parseNum(psCoRaw);
      const duCuoiNo = parseNum(duCuoiNoRaw);
      const duCuoiCo = parseNum(duCuoiCoRaw);

      // Bỏ qua dòng trống
      if (!tenKhachHang && !maKhachHang) continue;

      // Bỏ qua dòng số thứ tự 1-8
      if (/^[1-8]$/.test(tenKhachHang)) continue;

      // Kiểm tra dòng NHÓM
      const isGroupRow = !maKhachHang && NHOM_LABELS[tenKhachHang];
      if (isGroupRow) {
        currentNhom = NHOM_LABELS[tenKhachHang];
        continue;
      }

      // Kiểm tra dòng data thực sự
      const hasAmounts = duDauNo > 0 || duDauCo > 0 || phatSinhNo > 0 || phatSinhCo > 0 || duCuoiNo > 0 || duCuoiCo > 0;
      const isDataRow = maKhachHang || (tenKhachHang && hasAmounts);
      if (!isDataRow) continue;

      // Tính công nợ
      const duCuoi = duCuoiNo - duCuoiCo;
      const duDau = duDauNo - duDauCo;
      const phatSinh = phatSinhNo - phatSinhCo;
      const tongCongNo = Math.max(0, duCuoi);
      const daThanhToan = Math.max(0, duDau + phatSinh - duCuoi);

      let trangThai = "chua_thanh_toan";
      if (tongCongNo === 0) trangThai = "da_thanh_toan";
      else if (duCuoiCo > 0) trangThai = "da_thanh_toan";
      else if (duCuoiNo > 0) trangThai = "chua_thanh_toan";

      // Tìm đơn hàng
      let idDonHang: number | null = null;
      if (maKhachHang) {
        const dhRows = await query<{ id: number }[]>(
          `SELECT TOP 1 id FROM DonHang WHERE maDonHang LIKE @ma OR tenKhachHang LIKE @ma ORDER BY ngayTao DESC`,
          { ma: `%${maKhachHang.trim()}%` },
        );
        if (dhRows.length > 0) idDonHang = dhRows[0].id;
      }

      if (!idDonHang && tenKhachHang) {
        const dhByName = await query<{ id: number }[]>(
          `SELECT TOP 1 id FROM DonHang WHERE LOWER(tenKhachHang) LIKE @name ORDER BY ngayTao DESC`,
          { name: `%${tenKhachHang.toLowerCase()}%` },
        );
        if (dhByName.length > 0) idDonHang = dhByName[0].id;
      }

      if (!idDonHang) {
        errors.push(`Dòng ${rowNum}: Không tìm thấy đơn hàng cho "${tenKhachHang || maKhachHang}"`);
        details.push({ row: rowNum, message: `Không tìm thấy đơn hàng "${tenKhachHang || maKhachHang}"`, data: r });
        continue;
      }

      // Upsert
      const existing = await query<{ id: number }[]>(
        `SELECT id FROM CongNo WHERE idDonHang = @idDonHang`,
        { idDonHang },
      );

      if (existing.length > 0) {
        await query(
          `UPDATE CongNo
           SET tongTien = @tongTien, daThanhToan = @daThanhToan, conLai = @conLai,
               trangThai = @trangThai, nhom = @nhom, ngayCapNhat = GETDATE()
           WHERE idDonHang = @idDonHang`,
          { idDonHang, tongTien: tongCongNo, daThanhToan, conLai: tongCongNo, trangThai, nhom: currentNhom },
        );
      } else {
        await query(
          `INSERT INTO CongNo (idDonHang, tongTien, daThanhToan, conLai, trangThai, nhom)
           VALUES (@idDonHang, @tongTien, @daThanhToan, @conLai, @trangThai, @nhom)`,
          { idDonHang, tongTien: tongCongNo, daThanhToan, conLai: tongCongNo, trangThai, nhom: currentNhom },
        );
      }

      // Cập nhật đơn hàng
      await query(
        `UPDATE DonHang SET daThanhToan = @daThanhToan, conLai = @conLai, ngayCapNhat = GETDATE() WHERE id = @id`,
        { daThanhToan, conLai: tongCongNo, id: idDonHang },
      );

      success++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Lỗi không xác định";
      errors.push(`Dòng ${rowNum}: ${msg}`);
      details.push({ row: rowNum, message: msg, data: r });
    }
  }

  const failed = rows.length - success;
  await ghiLichSuImport("cong_no", tenFile, rows.length, success, failed, nguoiTaiId);
  return { total: rows.length, success, failed, errors, details };
}

// ===== Import công nợ theo khách hàng (Bravo - nhanh, batch) =====
export async function importCongNoKhachHang(
  rows: Record<string, unknown>[],
  nguoiTaiId: number,
  tenFile: string,
): Promise<ImportResult> {
  const errors: string[] = [];
  let success = 0;

  // Nhóm cố định từ Bravo
  const NHOM_LABELS: Record<string, string> = {
    "Các công ty thuộc Tây Đô Group": "Các công ty thuộc Tây Đô Group",
    "Đơn vị, cá nhân, tổ chức có MST": "Đơn vị, cá nhân, tổ chức có MST",
    "Đơn vị trong nước có MST": "Đơn vị trong nước có MST",
    "Cá nhân có MST": "Cá nhân có MST",
    "Đơn vị, cá nhân, tổ chức không có MST": "Đơn vị, cá nhân, tổ chức không có MST",
    "Bê tông Tây Đô": "Bê tông Tây Đô",
    "Nội bộ từng công ty": "Nội bộ từng công ty",
    "Nội bộ công ty Bê Tông Tây Đô": "Nội bộ công ty Bê Tông Tây Đô",
  };

  const parseNum = (v: unknown): number => {
    if (typeof v === "number") return v;
    const s = String(v ?? "0");
    return parseFloat(s.replace(/[^\d.,]/g, "").replace(",", ".")) || 0;
  };

  const getVal = (row: unknown, idx: number): unknown => {
    if (Array.isArray(row)) return row[idx];
    const vals = Object.values(row as Record<string, unknown>);
    return vals[idx];
  };

  const dataRows: {
    maKhachHang: string;
    tenKhachHang: string;
    duDauNo: number;
    duDauCo: number;
    phatSinhNo: number;
    phatSinhCo: number;
    duCuoiNo: number;
    duCuoiCo: number;
    nhom: string;
    rowNum: number;
  }[] = [];

  let currentNhom = "Chưa phân nhóm";

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowNum = i + 2;

    const maRaw = getVal(r, 0);
    const tenRaw = getVal(r, 1);
    const duDauNoRaw = getVal(r, 2);
    const duDauCoRaw = getVal(r, 3);
    const psNoRaw = getVal(r, 4);
    const psCoRaw = getVal(r, 5);
    const duCuoiNoRaw = getVal(r, 6);
    const duCuoiCoRaw = getVal(r, 7);

    const maKhachHang = String(maRaw ?? "").trim().replace(/\s+$/, "");
    const tenKhachHang = String(tenRaw ?? "").trim();
    const duDauNo = parseNum(duDauNoRaw);
    const duDauCo = parseNum(duDauCoRaw);
    const phatSinhNo = parseNum(psNoRaw);
    const phatSinhCo = parseNum(psCoRaw);
    const duCuoiNo = parseNum(duCuoiNoRaw);
    const duCuoiCo = parseNum(duCuoiCoRaw);

    // Bỏ qua dòng trống
    if (!tenKhachHang && !maKhachHang) continue;

    // Bỏ qua dòng header (số 1-8)
    if (/^[1-8]$/.test(tenKhachHang)) continue;

    // Dòng NHÓM
    const isGroupRow = !maKhachHang && NHOM_LABELS[tenKhachHang];
    if (isGroupRow) {
      currentNhom = NHOM_LABELS[tenKhachHang];
      continue;
    }

    // Dòng data thực sự: phải có mã hoặc có số tiền
    const hasAmounts = duDauNo > 0 || duDauCo > 0 || phatSinhNo > 0 || phatSinhCo > 0 || duCuoiNo > 0 || duCuoiCo > 0;
    const isDataRow = maKhachHang || (tenKhachHang && hasAmounts);
    if (!isDataRow) continue;

    dataRows.push({
      maKhachHang,
      tenKhachHang,
      duDauNo,
      duDauCo,
      phatSinhNo,
      phatSinhCo,
      duCuoiNo,
      duCuoiCo,
      nhom: currentNhom,
      rowNum,
    });
  }

  // Batch upsert — không query per row
  if (dataRows.length > 0) {
    // Xây dựng câu MERGE (SQL Server) để upsert nhanh
    const values = dataRows
      .map((r, idx) =>
        `SELECT ${idx + 1} as rn, N'${r.maKhachHang.replace(/'/g, "''")}', N'${r.tenKhachHang.replace(/'/g, "''")}', ${r.duDauNo}, ${r.duDauCo}, ${r.phatSinhNo}, ${r.phatSinhCo}, ${r.duCuoiNo}, ${r.duCuoiCo}, N'${r.nhom.replace(/'/g, "''")}', ${r.rowNum}`
      )
      .join(" UNION ALL ");

    try {
      // Merge: match theo tenKhachHang (luôn có, unique trong file Bravo)
      await query(
        `MERGE INTO CongNoKhachHang AS target
         USING (
           ${values}
         ) AS source (rn, maKhachHang, tenKhachHang, duDauNo, duDauCo, phatSinhNo, phatSinhCo, duCuoiNo, duCuoiCo, nhom, rowNum)
         ON (target.tenKhachHang = source.tenKhachHang)
         WHEN MATCHED THEN
           UPDATE SET
             target.maKhachHang = source.maKhachHang,
             target.duDauNo = source.duDauNo,
             target.duDauCo = source.duDauCo,
             target.phatSinhNo = source.phatSinhNo,
             target.phatSinhCo = source.phatSinhCo,
             target.duCuoiNo = source.duCuoiNo,
             target.duCuoiCo = source.duCuoiCo,
             target.nhom = source.nhom,
             target.ngayCapNhat = GETDATE()
         WHEN NOT MATCHED THEN
           INSERT (maKhachHang, tenKhachHang, duDauNo, duDauCo, phatSinhNo, phatSinhCo, duCuoiNo, duCuoiCo, nhom)
           VALUES (source.maKhachHang, source.tenKhachHang, source.duDauNo, source.duDauCo, source.phatSinhNo, source.phatSinhCo, source.duCuoiNo, source.duCuoiCo, source.nhom);`,
      );
      success = dataRows.length;

      // Tính tổng cộng từ dataRows
      const tongCong = {
        duDauNo: dataRows.reduce((s, r) => s + r.duDauNo, 0),
        duDauCo: dataRows.reduce((s, r) => s + r.duDauCo, 0),
        phatSinhNo: dataRows.reduce((s, r) => s + r.phatSinhNo, 0),
        phatSinhCo: dataRows.reduce((s, r) => s + r.phatSinhCo, 0),
        duCuoiNo: dataRows.reduce((s, r) => s + r.duCuoiNo, 0),
        duCuoiCo: dataRows.reduce((s, r) => s + r.duCuoiCo, 0),
      };

      // Upsert dòng Tổng cộng (tenKhachHang = 'Tổng cộng', nhom = 'Tổng cộng')
      await query(
        `MERGE INTO CongNoKhachHang AS target
         USING (SELECT 1 as rn) AS source
         ON (target.tenKhachHang = N'Tổng cộng')
         WHEN MATCHED THEN
           UPDATE SET
             maKhachHang = NULL,
             duDauNo = @duDauNo, duDauCo = @duDauCo,
             phatSinhNo = @phatSinhNo, phatSinhCo = @phatSinhCo,
             duCuoiNo = @duCuoiNo, duCuoiCo = @duCuoiCo,
             nhom = N'Tổng cộng', ngayCapNhat = GETDATE()
         WHEN NOT MATCHED THEN
           INSERT (maKhachHang, tenKhachHang, duDauNo, duDauCo, phatSinhNo, phatSinhCo, duCuoiNo, duCuoiCo, nhom)
           VALUES (NULL, N'Tổng cộng', @duDauNo, @duDauCo, @phatSinhNo, @phatSinhCo, @duCuoiNo, @duCuoiCo, N'Tổng cộng');`,
        tongCong,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Lỗi không xác định";
      errors.push(msg);
    }
  }

  await ghiLichSuImport("cong_no_khach_hang", tenFile, rows.length, success, rows.length - success, nguoiTaiId);
  return { total: rows.length, success, failed: rows.length - success, errors, details: [] };
}
