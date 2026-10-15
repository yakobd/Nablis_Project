"use client";
import React, { useState } from "react";
import type { MonthPerformance } from "@/lib/firebase";
import { useTranslation } from "@nablis/i18n";
import { dateLocale } from "@/lib/locale";

const monthName = (m: number) => new Date(2024, m, 1).toLocaleDateString(dateLocale(), { month: "short" });

/**
 * Monthly completion (0–100%) as one series of thin bars. Months that haven't
 * started show a faint placeholder; hovering a bar shows its numbers.
 */
export function MonthlyChart({ data, title = "Monthly performance" }: { data: MonthPerformance[]; title?: string }) {
  const { t } = useTranslation();
  const [hover, setHover] = useState<number | null>(null);
  const H = 140;
  return (
    <figure>
      <figcaption className="sr-only">{title}</figcaption>
      <div className="relative">
        {/* Recessive guides at 50% and 100% */}
        <div className="absolute inset-x-0 top-0 border-t border-dashed border-[#E5E7EB]" style={{ height: H }}>
          <span className="absolute -top-2 right-0 text-[10px] text-[#9CA3AF] bg-white pl-1">100%</span>
          <div className="absolute inset-x-0 border-t border-dashed border-[#F3F4F6]" style={{ top: H / 2 }}>
            <span className="absolute -top-2 right-0 text-[10px] text-[#9CA3AF] bg-white pl-1">50%</span>
          </div>
        </div>
        <div className="relative grid grid-cols-12 gap-1.5 sm:gap-3 items-end pr-8" style={{ height: H }}>
          {data.map((m) => {
            const h = m.pct === null ? 4 : Math.max(4, (m.pct / 100) * H);
            return (
              <div key={m.month} className="relative h-full flex items-end justify-center"
                onMouseEnter={() => setHover(m.month)} onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(m.month)} onBlur={() => setHover(null)} tabIndex={m.pct === null ? -1 : 0}
                aria-label={m.pct === null ? `${monthName(m.month)}: ${t("plan.notStarted")}` : `${monthName(m.month)}: ${m.pct}%, ${t("plan.readingsOf", { done: m.done, total: m.due })}`}>
                <div className={`w-full max-w-[22px] rounded-t-[4px] transition-all duration-700 ${m.pct === null ? "bg-[#F3F4F6]" : hover === m.month ? "bg-[#1B2E6B]" : "bg-[#1E3A8A]"}`}
                  style={{ height: h }} />
                {hover === m.month && m.pct !== null && (
                  <div className="absolute z-10 bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-[#111827] text-white text-xs px-2.5 py-1.5 shadow-lg pointer-events-none">
                    <span className="font-semibold">{monthName(m.month)}: {m.pct}%</span>
                    <span className="block text-white/70">{t("plan.readingsOf", { done: m.done, total: m.due })}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="grid grid-cols-12 gap-1.5 sm:gap-3 pr-8 mt-2 border-t border-[#E5E7EB] pt-2">
        {data.map((m) => (
          <span key={m.month} className={`text-center text-[10px] sm:text-[11px] ${hover === m.month ? "text-[#111827] font-semibold" : "text-[#6B7280]"}`}>{monthName(m.month)}</span>
        ))}
      </div>
      <table className="sr-only">
        <thead><tr><th>Month</th><th>Completed</th><th>Due</th><th>Percent</th></tr></thead>
        <tbody>
          {data.map((m) => <tr key={m.month}><td>{monthName(m.month)}</td><td>{m.done}</td><td>{m.due}</td><td>{m.pct === null ? "—" : `${m.pct}%`}</td></tr>)}
        </tbody>
      </table>
    </figure>
  );
}
