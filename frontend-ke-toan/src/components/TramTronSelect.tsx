import { useEffect, useState } from "react";
import { layDanhSachTramTron } from "../services/api";

interface Props {
  value?: number;
  onChange: (id: number | undefined) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function TramTronSelect({ value, onChange, disabled, placeholder }: Props) {
  const [tramList, setTramList] = useState<{ id: number; tenTram: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    layDanhSachTramTron()
      .then((data: any[]) => setTramList(data.filter((t: any) => t.trangThai === "hoat_dong")))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <select disabled className="form-select"><option>Đang tải...</option></select>;

  return (
    <select
      className="form-select"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value ? parseInt(e.target.value, 10) : undefined)}
      disabled={disabled}
    >
      <option value="">{placeholder || "-- Chọn trạm trộn --"}</option>
      {tramList.map((t) => (
        <option key={t.id} value={t.id}>
          {t.tenTram}
        </option>
      ))}
    </select>
  );
}
