"use client";
import React, { useState } from "react";
import { dateLocale } from "@/lib/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toIsoDate } from "@/lib/firebase";
import { useTranslation } from "@nablis/i18n";

export type DayMark = "pending" | "confirmed" | "completed";

const MARK_STYLE: Record<DayMark, string> = {
  pending:   "bg-[#F5C518] text-[#1B2E6B] font-semibold",
  confirmed: "bg-[#1B2E6B] text-white font-semibold",
  completed: "bg-[#DCFCE7] text-[#15803D] font-semibold",
};

const DAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

// Month calendar with optional highlighted days and date selection.
export function MiniCalendar({
  marks = {},
  selected,
  onSelect,
  disablePast = false,
  isDisabled,
  initialMonth,
  legend,
  className = "",
}: {
  marks?: Record<string, DayMark>;
  selected?: string;
  onSelect?: (isoDate: string) => void;
  disablePast?: boolean;
  /** Extra days that can't be selected (e.g. the Father is unavailable). */
  isDisabled?: (isoDate: string) => boolean;
  initialMonth?: Date;
  legend?: React.ReactNode;
  className?: string;
}) {
  const { t } = useTranslation();
  const [month, setMonth] = useState(() => {
    const d = initialMonth ?? new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const today = toIsoDate(new Date());

  const first = month.getDay();
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const prevDays = new Date(month.getFullYear(), month.getMonth(), 0).getDate();
  const cells: { date: Date; inMonth: boolean }[] = [];
  for (let i = first - 1; i >= 0; i--) cells.push({ date: new Date(month.getFullYear(), month.getMonth() - 1, prevDays - i), inMonth: false });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ date: new Date(month.getFullYear(), month.getMonth(), d), inMonth: true });
  while (cells.length % 7) cells.push({ date: new Date(month.getFullYear(), month.getMonth() + 1, cells.length - first - daysInMonth + 1), inMonth: false });

  const shift = (n: number) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + n, 1));

  return (
    <div className={`bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-5 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <p className="text-[#111827] font-semibold text-sm">
          {month.toLocaleDateString(dateLocale(), { month: "long", year: "numeric" })}
        </p>
        <div className="flex gap-1">
          <button onClick={() => shift(-1)} className="p-1 rounded-md text-[#6B7280] hover:bg-[#EEF1F8]" aria-label={t("calendar.prevMonth")}><ChevronLeft size={16} /></button>
          <button onClick={() => shift(1)} className="p-1 rounded-md text-[#6B7280] hover:bg-[#EEF1F8]" aria-label={t("calendar.nextMonth")}><ChevronRight size={16} /></button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-y-1.5 text-center">
        {DAYS.map((d) => (
          <span key={d} className="text-[10px] font-semibold text-[#9CA3AF] pb-1">{d}</span>
        ))}
        {cells.map(({ date, inMonth }) => {
          const iso = toIsoDate(date);
          const mark = inMonth ? marks[iso] : undefined;
          const isSelected = selected === iso;
          const blocked = (disablePast && iso < today) || (inMonth && !!isDisabled?.(iso));
          const disabled = !inMonth || blocked || !onSelect;
          return (
            <button
              key={iso + inMonth}
              type="button"
              disabled={disabled && !mark}
              title={inMonth && blocked && iso >= today ? t("calendar.notAvailable") : undefined}
              onClick={() => onSelect && inMonth && !blocked && onSelect(iso)}
              className={[
                "mx-auto w-8 h-8 rounded-lg text-[13px] flex items-center justify-center relative",
                !inMonth ? "text-[#D1D5DB]" : blocked ? "text-[#D1D5DB] line-through decoration-[#E5E7EB]" : "text-[#374151]",
                isSelected ? "bg-[#1B2E6B] text-white font-semibold shadow-md" : mark ? MARK_STYLE[mark] : "",
                onSelect && inMonth && !isSelected ? "hover:bg-[#EEF1F8]" : "",
                iso === today && !isSelected && !mark ? "ring-1 ring-[#1B2E6B]/30" : "",
                !onSelect ? "cursor-default" : "",
              ].join(" ")}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
      {legend && <div className="mt-4 space-y-1.5">{legend}</div>}
    </div>
  );
}

export function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs text-[#4B5563]">
      <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />
      {label}
    </div>
  );
}
