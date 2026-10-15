"use client";
import React, { useState } from "react";

export interface BarDatum {
  label: string;
  /** 0–100, or null when there's no data for that bar. */
  value: number | null;
  /** Second line in the tooltip, e.g. "12 of 40 members". */
  detail?: string;
}

/**
 * One series of percentage bars (0–100) with recessive guides, a tooltip per
 * bar and a screen-reader table. The caller's heading names the series.
 */
export function BarChart({ data, height = 140, highlightLast = false, caption }: {
  data: BarDatum[];
  height?: number;
  highlightLast?: boolean;
  caption: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  return (
    <figure>
      <figcaption className="sr-only">{caption}</figcaption>
      <div className="relative">
        <div className="absolute inset-x-0 top-0 border-t border-dashed border-[#E5E7EB]" style={{ height }}>
          <span className="absolute -top-2 right-0 text-[10px] text-[#9CA3AF] bg-white pl-1">100%</span>
          <div className="absolute inset-x-0 border-t border-dashed border-[#F3F4F6]" style={{ top: height / 2 }}>
            <span className="absolute -top-2 right-0 text-[10px] text-[#9CA3AF] bg-white pl-1">50%</span>
          </div>
        </div>
        <div className="relative grid gap-2 sm:gap-3 items-end pr-8" style={{ height, gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}>
          {data.map((d, i) => {
            const active = hover === i || (hover === null && highlightLast && i === data.length - 1);
            return (
              <div key={i} className="relative h-full flex items-end justify-center" tabIndex={d.value === null ? -1 : 0}
                onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}
                aria-label={d.value === null ? `${d.label}: no data` : `${d.label}: ${d.value}%${d.detail ? `, ${d.detail}` : ""}`}>
                <div className={`w-full max-w-[28px] rounded-t-[4px] transition-all duration-700 ${d.value === null ? "bg-[#F3F4F6]" : active ? "bg-[#1B2E6B]" : "bg-[#1E3A8A]/80"}`}
                  style={{ height: d.value === null ? 4 : Math.max(4, (d.value / 100) * height) }} />
                {hover === i && d.value !== null && (
                  <div className="absolute z-10 bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-[#111827] text-white text-xs px-2.5 py-1.5 shadow-lg pointer-events-none">
                    <span className="font-semibold">{d.label}: {d.value}%</span>
                    {d.detail && <span className="block text-white/70">{d.detail}</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="grid gap-2 sm:gap-3 pr-8 mt-2 border-t border-[#E5E7EB] pt-2" style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}>
        {data.map((d, i) => (
          <span key={i} className={`text-center text-[11px] truncate ${hover === i ? "text-[#111827] font-semibold" : "text-[#6B7280]"}`}>{d.label}</span>
        ))}
      </div>
      <table className="sr-only">
        <thead><tr><th>Label</th><th>Percent</th><th>Detail</th></tr></thead>
        <tbody>{data.map((d, i) => <tr key={i}><td>{d.label}</td><td>{d.value === null ? "—" : `${d.value}%`}</td><td>{d.detail ?? ""}</td></tr>)}</tbody>
      </table>
    </figure>
  );
}
