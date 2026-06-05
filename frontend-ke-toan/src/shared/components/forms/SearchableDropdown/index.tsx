import React, { useState, useRef, useEffect } from "react";
import { FiSearch, FiChevronDown, FiX } from "react-icons/fi";
import styles from "./SearchableDropdown.module.css";

interface Option {
  id: number | string;
  label: string;
  subLabel?: string;
}

interface SearchableDropdownProps {
  value: number | string | "";
  onChange: (id: number | string | "") => void;
  options: Option[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function SearchableDropdown({
  value,
  onChange,
  options,
  placeholder = "-- Chọn --",
  disabled = false,
  className,
}: SearchableDropdownProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => String(o.id) === String(value));

  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleSelect = (id: number | string) => {
    onChange(id);
    setOpen(false);
    setSearch("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
  };

  return (
    <div ref={wrapperRef} className={`${styles.wrapper} ${className || ""}`}>
      <button
        type="button"
        className={`${styles.trigger} ${open ? styles.triggerOpen : ""}`}
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
      >
        <span className={selected ? styles.selectedText : styles.placeholder}>
          {selected ? selected.label : placeholder}
        </span>
        <div className={styles.triggerRight}>
          {value !== "" && !disabled && (
            <span onClick={handleClear} className={styles.clearBtn}>
              <FiX size={12} />
            </span>
          )}
          <FiChevronDown
            size={14}
            className={`${styles.chevron} ${open ? styles.chevronUp : ""}`}
          />
        </div>
      </button>

      {open && (
        <div className={styles.dropdown}>
          <div className={styles.searchWrap}>
            <FiSearch size={14} className={styles.searchIcon} />
            <input
              autoFocus
              className={styles.searchInput}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm kiếm..."
            />
          </div>
          <div className={styles.options}>
            {filtered.length === 0 ? (
              <div className={styles.noResult}>Không có kết quả</div>
            ) : (
              filtered.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`${styles.option} ${String(opt.id) === String(value) ? styles.optionSelected : ""}`}
                  onClick={() => handleSelect(opt.id)}
                >
                  <span className={styles.optionLabel}>{opt.label}</span>
                  {opt.subLabel && (
                    <span className={styles.optionSub}>{opt.subLabel}</span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
