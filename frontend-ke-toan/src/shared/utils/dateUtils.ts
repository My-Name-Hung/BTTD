/**
 * Format a date string or Date object from the DB (stored as VN time / UTC+7)
 * to Vietnamese locale string. Avoids browser timezone shifting by parsing
 * components manually and constructing the date in local (VN) context.
 */
export function formatDateVN(d: Date | string | null | undefined): string {
  if (!d) return '—';
  try {
    const str = typeof d === 'string' ? d : d.toISOString();
    const cleaned = str.replace('Z', '').replace(/\.\d+$/, '');
    const [datePart, timePart] = cleaned.split('T');
    if (!datePart) return '—';
    const [y, mo, day] = datePart.split('-').map(Number);
    const parts = (timePart || '').split(':');
    const h = parts[0] ? Number(parts[0]) : 0;
    const mi = parts[1] ? Number(parts[1]) : 0;
    const s = parts[2] ? Number(parts[2].replace(/\D/g, '')) : 0;
    const vn = new Date(y!, mo! - 1, day!, h || 0, mi || 0, s || 0, 0);
    if (isNaN(vn.getTime())) return '—';
    return vn.toLocaleString('vi-VN');
  } catch {
    return '—';
  }
}
