import { query, vnNow } from '../config/database';
import { CongNoKhachHang, CongNoKhachHangGroup } from '../models';

export async function taoCongNoKhachHang(data: {
  maKhachHang?: string | null;
  tenKhachHang: string;
  nhom?: string | null;
}): Promise<CongNoKhachHang> {
  // Tự sinh mã nếu chưa có
  let maKH = data.maKhachHang?.trim() || null;
  if (!maKH) {
    const countResult = await query<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM CongNoKhachHang`,
      {}
    );
    const nextNum = (countResult[0]?.cnt || 0) + 1;
    maKH = 'KH' + String(nextNum).padStart(4, '0');
  }
  const result = await query<CongNoKhachHang>(
    `INSERT INTO CongNoKhachHang (maKhachHang, tenKhachHang, nhom)
     OUTPUT INSERTED.*
     VALUES (@maKhachHang, @tenKhachHang, @nhom)`,
    {
      maKhachHang: maKH,
      tenKhachHang: data.tenKhachHang,
      nhom: data.nhom || null,
    }
  );
  return result[0];
}

export async function layCongNoKhachHangGrouped(
  opts?: { nhom?: string; search?: string }
): Promise<CongNoKhachHangGroup[]> {
  let whereClause = 'WHERE 1=1';
  const params: Record<string, unknown> = {};

  if (opts?.nhom) {
    whereClause += ' AND nhom = @nhom';
    params.nhom = opts.nhom;
  }
  if (opts?.search) {
    whereClause += ' AND (maKhachHang LIKE @search OR tenKhachHang LIKE @search)';
    params.search = `%${opts.search}%`;
  }

  const rows = await query<CongNoKhachHang>(
    `SELECT * FROM CongNoKhachHang ${whereClause} ORDER BY nhom ASC, tenKhachHang ASC`,
    params,
  );

  const groupMap = new Map<string, CongNoKhachHangGroup>();

  for (const row of rows) {
    // Bỏ qua dòng Tổng cộng
    if (row.tenKhachHang === 'Tổng cộng') continue;

    const nhom = row.nhom || 'Chưa phân nhóm';
    if (!groupMap.has(nhom)) {
      groupMap.set(nhom, {
        nhom,
        items: [],
        tongDuDauNo: 0,
        tongDuDauCo: 0,
        tongPhatSinhNo: 0,
        tongPhatSinhCo: 0,
        tongDuCuoiNo: 0,
        tongDuCuoiCo: 0,
      });
    }
    const g = groupMap.get(nhom)!;
    g.items.push(row);
    g.tongDuDauNo += row.duDauNo;
    g.tongDuDauCo += row.duDauCo;
    g.tongPhatSinhNo += row.phatSinhNo;
    g.tongPhatSinhCo += row.phatSinhCo;
    g.tongDuCuoiNo += row.duCuoiNo;
    g.tongDuCuoiCo += row.duCuoiCo;
  }

  return Array.from(groupMap.values());
}

export async function layDanhSachNhomCongNoKhachHang(): Promise<{ nhom: string; soLuong: number }[]> {
  const rows = await query<{ nhom: string; soLuong: number }>(
    `SELECT nhom, COUNT(*) as soLuong
     FROM CongNoKhachHang
     WHERE nhom IS NOT NULL AND nhom <> '' AND nhom <> N'Tổng cộng'
     GROUP BY nhom
     ORDER BY MIN(ngayTao) ASC`,
  );
  return rows;
}

export async function suaCongNoKhachHang(
  id: number,
  data: Partial<Omit<CongNoKhachHang, 'id' | 'ngayTao' | 'ngayCapNhat'>>,
): Promise<CongNoKhachHang> {
  const sets: string[] = [];
  const params: Record<string, unknown> = { id };

  if (data.maKhachHang !== undefined) { sets.push('maKhachHang = @maKhachHang'); params.maKhachHang = data.maKhachHang; }
  if (data.tenKhachHang !== undefined) { sets.push('tenKhachHang = @tenKhachHang'); params.tenKhachHang = data.tenKhachHang; }
  if (data.duDauNo !== undefined) { sets.push('duDauNo = @duDauNo'); params.duDauNo = data.duDauNo; }
  if (data.duDauCo !== undefined) { sets.push('duDauCo = @duDauCo'); params.duDauCo = data.duDauCo; }
  if (data.phatSinhNo !== undefined) { sets.push('phatSinhNo = @phatSinhNo'); params.phatSinhNo = data.phatSinhNo; }
  if (data.phatSinhCo !== undefined) { sets.push('phatSinhCo = @phatSinhCo'); params.phatSinhCo = data.phatSinhCo; }
  if (data.duCuoiNo !== undefined) { sets.push('duCuoiNo = @duCuoiNo'); params.duCuoiNo = data.duCuoiNo; }
  if (data.duCuoiCo !== undefined) { sets.push('duCuoiCo = @duCuoiCo'); params.duCuoiCo = data.duCuoiCo; }
  if (data.nhom !== undefined) { sets.push('nhom = @nhom'); params.nhom = data.nhom; }

  if (sets.length > 0) {
    sets.push(`ngayCapNhat = ${vnNow()}`);
    await query(
      `UPDATE CongNoKhachHang SET ${sets.join(', ')} WHERE id = @id`,
      params,
    );
  }

  const rows = await query<CongNoKhachHang>(
    `SELECT * FROM CongNoKhachHang WHERE id = @id`,
    { id },
  );
  return rows[0];
}

export async function xoaCongNoKhachHang(id: number): Promise<void> {
  await query(`DELETE FROM CongNoKhachHang WHERE id = @id`, { id });
}
