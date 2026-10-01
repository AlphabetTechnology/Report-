"use client";

import { MONTH_NAMES, pad2 } from "@/lib/format";
import type { EnglishVariant } from "@/lib/types";

/**
 * Date picker laid out in the client's convention:
 * UK "1 September 2026" (day, month, year), US "September 1, 2026" (month, day, year).
 * Browser date inputs follow the computer's locale instead, so we avoid them.
 */
export default function DateField({
  label,
  value,
  english,
  onChange,
}: {
  label: string;
  value: string;
  english: EnglishVariant;
  onChange: (iso: string) => void;
}) {
  const [y, m, d] = (value || "2026-01-01").split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: 7 }, (_, i) => thisYear - 4 + i);
  if (!years.includes(y)) years.unshift(y);

  const emit = (ny: number, nm: number, nd: number) => {
    const max = new Date(ny, nm, 0).getDate();
    onChange(`${ny}-${pad2(nm)}-${pad2(Math.min(nd, max))}`);
  };

  const day = (
    <select key="d" className="select" value={d} onChange={(e) => emit(y, m, +e.target.value)} aria-label="Day">
      {Array.from({ length: daysInMonth }, (_, i) => (
        <option key={i + 1} value={i + 1}>
          {i + 1}
        </option>
      ))}
    </select>
  );
  const month = (
    <select key="m" className="select" value={m} onChange={(e) => emit(y, +e.target.value, d)} aria-label="Month">
      {MONTH_NAMES.map((name, i) => (
        <option key={name} value={i + 1}>
          {name}
        </option>
      ))}
    </select>
  );
  const year = (
    <select key="y" className="select" value={y} onChange={(e) => emit(+e.target.value, m, d)} aria-label="Year">
      {years.map((yy) => (
        <option key={yy} value={yy}>
          {yy}
        </option>
      ))}
    </select>
  );

  return (
    <div className="field">
      <span>{label}</span>
      <div className={`date-field ${english === "en-US" ? "us" : "uk"}`}>
        {english === "en-US" ? [month, day, year] : [day, month, year]}
      </div>
    </div>
  );
}
