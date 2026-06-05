import { query, vnNow } from '../config/database';
import { CongNoKhachHang, CongNoKhachHangGroup } from '../models';

export async function layDuCuoiCoKhachHang(data: {
  idKhachHang?: number | null;
  maKhachHang?: string | null;
  tenKhachHang?: string | null;
}): Promise<number> {
  let normalizedMaKhachHang = data.maKhachHang?.trim() || null;

  if (!normalizedMaKhachHang && data.idKhachHang) {
    const khachHang = await query<{ maKhachHang: string | null }>(
      `SELECT TOP 1 maKhachHang FROM KhachHang WHERE id = @idKhachHang`,
      { idKhachHang: data.idKhachHang },
    );
    normalizedMaKhachHang = khachHang[0]?.maKhachHang?.trim() || null;
  }

  const rows = await query<CongNoKhachHang>(
    normalizedMaKhachHang
      ? `SELECT TOP 1 * FROM CongNoKhachHang
         WHERE maKhachHang = @maKhachHang
         ORDER BY id ASC`
      : `SELECT TOP 1 * FROM CongNoKhachHang WHERE tenKhachHang = @tenKhachHang ORDER BY id ASC`,
    {
      maKhachHang: normalizedMaKhachHang,
      tenKhachHang: data.tenKhachHang || '',
    },
  );

  return rows[0]?.duCuoiCo || 0;
}

export async function capNhatSoDuCoKhachHang(data: {
  idKhachHang?: number | null;
  maKhachHang?: string | null;
  tenKhachHang?: string | null;
  tangDuCo?: number;
  giamDuCo?: number;
}): Promise<CongNoKhachHang | null> {
  let normalizedMaKhachHang = data.maKhachHang?.trim() || null;

  if (!normalizedMaKhachHang && data.idKhachHang) {
    const khachHang = await query<{ maKhachHang: string | null }>(
      `SELECT TOP 1 maKhachHang FROM KhachHang WHERE id = @idKhachHang`,
      { idKhachHang: data.idKhachHang },
    );
    normalizedMaKhachHang = khachHang[0]?.maKhachHang?.trim() || null;
  }

  const rows = await query<CongNoKhachHang>(
    normalizedMaKhachHang
      ? `SELECT TOP 1 * FROM CongNoKhachHang
         WHERE maKhachHang = @maKhachHang
         ORDER BY id ASC`
      : `SELECT TOP 1 * FROM CongNoKhachHang WHERE tenKhachHang = @tenKhachHang ORDER BY id ASC`,
    {
      maKhachHang: normalizedMaKhachHang,
      tenKhachHang: data.tenKhachHang || '',
    },
  );

  const row = rows[0];
  if (!row) return null;

  const duCuoiCo = Math.max(0, (row.duCuoiCo || 0) + (data.tangDuCo || 0) - (data.giamDuCo || 0));
  const duCuoiNo = Math.max(0, (row.duCuoiNo || 0) - (data.tangDuCo || 0) + (data.giamDuCo || 0));

  await query(
    `UPDATE CongNoKhachHang
     SET duCuoiCo = @duCuoiCo,
         duCuoiNo = @duCuoiNo,
         ngayCapNhat = ${vnNow()}
     WHERE id = @id`,
    {
      id: row.id,
      duCuoiCo,
      duCuoiNo,
    },
  );

  return (await query<CongNoKhachHang>(`SELECT * FROM CongNoKhachHang WHERE id = @id`, { id: row.id }))[0];
}

export async function dongBoCongNoKhachHangTheoPhatSinh(data: {
  idKhachHang?: number | null;
  maKhachHang?: string | null;
  tenKhachHang: string;
  nhom?: string | null;
  phatSinhNoTang?: number;
  phatSinhCoTang?: number;
}): Promise<CongNoKhachHang> {
  const phatSinhNoTang = data.phatSinhNoTang || 0;
  const phatSinhCoTang = data.phatSinhCoTang || 0;

  let normalizedMaKhachHang = data.maKhachHang?.trim() || null;
  if (!normalizedMaKhachHang && data.idKhachHang) {
    const khachHang = await query<{ maKhachHang: string | null }>(
      `SELECT TOP 1 maKhachHang FROM KhachHang WHERE id = @idKhachHang`,
      { idKhachHang: data.idKhachHang },
    );
    normalizedMaKhachHang = khachHang[0]?.maKhachHang?.trim() || null;
  }

  const existing = await query<CongNoKhachHang>(
    normalizedMaKhachHang
      ? `SELECT TOP 1 * FROM CongNoKhachHang
         WHERE maKhachHang = @maKhachHang
         ORDER BY id ASC`
      : `SELECT TOP 1 * FROM CongNoKhachHang WHERE tenKhachHang = @tenKhachHang ORDER BY id ASC`,
    {
      maKhachHang: normalizedMaKhachHang,
      tenKhachHang: data.tenKhachHang,
    },
  );

  if (existing.length === 0) {
    const created = await taoCongNoKhachHang({
      maKhachHang: normalizedMaKhachHang,
      tenKhachHang: data.tenKhachHang,
      nhom: data.nhom,
    });

    const duCuoiNo = Math.max(0, (created.duDauNo || 0) + phatSinhNoTang - phatSinhCoTang - (created.duDauCo || 0));
    const duCuoiCo = Math.max(0, (created.duDauCo || 0) + phatSinhCoTang - phatSinhNoTang - (created.duDauNo || 0));

    await query(
      `UPDATE CongNoKhachHang
       SET maKhachHang = COALESCE(@maKhachHang, maKhachHang),
           phatSinhNo = @phatSinhNo,
           phatSinhCo = @phatSinhCo,
           duCuoiNo = @duCuoiNo,
           duCuoiCo = @duCuoiCo,
           ngayCapNhat = ${vnNow()}
       WHERE id = @id`,
      {
        id: created.id,
        maKhachHang: normalizedMaKhachHang,
        phatSinhNo: phatSinhNoTang,
        phatSinhCo: phatSinhCoTang,
        duCuoiNo,
        duCuoiCo,
      },
    );

    return (await query<CongNoKhachHang>(`SELECT * FROM CongNoKhachHang WHERE id = @id`, { id: created.id }))[0];
  }

  const row = existing[0];
  const duDauNo = row.duDauNo || 0;
  const duDauCo = row.duDauCo || 0;
  const phatSinhNo = (row.phatSinhNo || 0) + phatSinhNoTang;
  const phatSinhCo = (row.phatSinhCo || 0) + phatSinhCoTang;
  const chenhLech = duDauNo + phatSinhNo - duDauCo - phatSinhCo;
  const duCuoiNo = Math.max(0, chenhLech);
  const duCuoiCo = Math.max(0, -chenhLech);

  await query(
    `UPDATE CongNoKhachHang
     SET maKhachHang = COALESCE(@maKhachHang, maKhachHang),
         tenKhachHang = COALESCE(@tenKhachHang, tenKhachHang),
         nhom = COALESCE(@nhom, nhom),
         phatSinhNo = @phatSinhNo,
         phatSinhCo = @phatSinhCo,
         duCuoiNo = @duCuoiNo,
         duCuoiCo = @duCuoiCo,
         ngayCapNhat = ${vnNow()}
     WHERE id = @id`,
    {
      id: row.id,
      maKhachHang: normalizedMaKhachHang,
      tenKhachHang: data.tenKhachHang || null,
      nhom: data.nhom || null,
      phatSinhNo,
      phatSinhCo,
      duCuoiNo,
      duCuoiCo,
    },
  );

  return (await query<CongNoKhachHang>(`SELECT * FROM CongNoKhachHang WHERE id = @id`, { id: row.id }))[0];
}

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
    `WITH RankedCongNo AS (
       SELECT *,
         ROW_NUMBER() OVER (
           PARTITION BY COALESCE(NULLIF(LTRIM(RTRIM(maKhachHang)), ''), LOWER(LTRIM(RTRIM(tenKhachHang))))
           ORDER BY id ASC
         ) AS rn
       FROM CongNoKhachHang ${whereClause}
     )
     SELECT *
     FROM RankedCongNo
     WHERE rn = 1
     ORDER BY nhom ASC, tenKhachHang ASC`,
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

export async function dongBoLaiCongNoKhachHangTuHoaDonVaThanhToan(): Promise<{
  soKhachHang: number;
  tongPhatSinhNo: number;
  tongPhatSinhCo: number;
}> {
  const customers = await query<{
    id: number;
    tenKhachHang: string;
    maKhachHang: string | null;
    nhom: string | null;
    duDauNo: number;
    duDauCo: number;
  }>(
    `SELECT
       c.id,
       c.tenKhachHang,
       c.maKhachHang,
       c.nhom,
       ISNULL(c.duDauNo, 0) as duDauNo,
       ISNULL(c.duDauCo, 0) as duDauCo
     FROM CongNoKhachHang c
     WHERE c.tenKhachHang <> N'Tổng cộng'`,
  );

  const hoaDonRows = await query<{
    idKhachHang: number | null;
    maKhachHang: string | null;
    tenKhachHang: string;
    tongCong: number;
  }>(
    `SELECT
       dh.idKhachHang,
       kh.maKhachHang,
       dh.tenKhachHang,
       ISNULL(hd.tongCong, 0) as tongCong
     FROM HoaDon hd
     INNER JOIN DonHang dh ON hd.idDonHang = dh.id
     LEFT JOIN KhachHang kh ON dh.idKhachHang = kh.id`,
  );

  const thanhToanRows = await query<{
    idKhachHang: number | null;
    maKhachHang: string | null;
    tenKhachHang: string;
    soTien: number;
  }>(
    `SELECT
       dh.idKhachHang,
       kh.maKhachHang,
       dh.tenKhachHang,
       ISNULL(tt.soTien, 0) as soTien
     FROM ThanhToan tt
     INNER JOIN DonHang dh ON tt.idDonHang = dh.id
     LEFT JOIN KhachHang kh ON dh.idKhachHang = kh.id`,
  );

  const taoKey = (row: { idKhachHang: number | null; maKhachHang: string | null; tenKhachHang: string }) => {
    if (row.idKhachHang) return `id:${row.idKhachHang}`;
    if (row.maKhachHang?.trim()) return `ma:${row.maKhachHang.trim()}`;
    return `ten:${row.tenKhachHang.trim().toLowerCase()}`;
  };

  const phatSinhNoMap = new Map<string, number>();
  const phatSinhCoMap = new Map<string, number>();

  for (const row of hoaDonRows) {
    const key = taoKey(row);
    phatSinhNoMap.set(key, (phatSinhNoMap.get(key) || 0) + (row.tongCong || 0));
  }

  for (const row of thanhToanRows) {
    const key = taoKey(row);
    phatSinhCoMap.set(key, (phatSinhCoMap.get(key) || 0) + (row.soTien || 0));
  }

  let tongPhatSinhNo = 0;
  let tongPhatSinhCo = 0;

  for (const customer of customers) {
    let resolvedKey = '';

    if (customer.maKhachHang?.trim()) {
      const khRows = await query<{ id: number }>(
        `SELECT TOP 1 id FROM KhachHang WHERE maKhachHang = @maKhachHang`,
        { maKhachHang: customer.maKhachHang.trim() },
      );
      if (khRows[0]?.id) {
        resolvedKey = `id:${khRows[0].id}`;
      } else {
        resolvedKey = `ma:${customer.maKhachHang.trim()}`;
      }
    }

    if (!resolvedKey) {
      const khRows = await query<{ id: number; maKhachHang: string | null }>(
        `SELECT TOP 1 id, maKhachHang FROM KhachHang WHERE tenKhachHang = @tenKhachHang ORDER BY id ASC`,
        { tenKhachHang: customer.tenKhachHang },
      );
      if (khRows[0]?.id) {
        resolvedKey = `id:${khRows[0].id}`;
      } else if (khRows[0]?.maKhachHang?.trim()) {
        resolvedKey = `ma:${khRows[0].maKhachHang.trim()}`;
      }
    }

    if (!resolvedKey) {
      resolvedKey = `ten:${customer.tenKhachHang.trim().toLowerCase()}`;
    }

    const phatSinhNo = phatSinhNoMap.get(resolvedKey) || 0;
    const phatSinhCo = phatSinhCoMap.get(resolvedKey) || 0;
    const chenhLech = (customer.duDauNo || 0) + phatSinhNo - (customer.duDauCo || 0) - phatSinhCo;
    const duCuoiNo = Math.max(0, chenhLech);
    const duCuoiCo = Math.max(0, -chenhLech);

    tongPhatSinhNo += phatSinhNo;
    tongPhatSinhCo += phatSinhCo;

    await query(
      `UPDATE CongNoKhachHang
       SET phatSinhNo = @phatSinhNo,
           phatSinhCo = @phatSinhCo,
           duCuoiNo = @duCuoiNo,
           duCuoiCo = @duCuoiCo,
           ngayCapNhat = ${vnNow()}
       WHERE id = @id`,
      {
        id: customer.id,
        phatSinhNo,
        phatSinhCo,
        duCuoiNo,
        duCuoiCo,
      },
    );
  }

  return {
    soKhachHang: customers.length,
    tongPhatSinhNo,
    tongPhatSinhCo,
  };
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
