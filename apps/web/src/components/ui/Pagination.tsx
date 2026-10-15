"use client";
import React from "react";
import { useTranslation } from "@nablis/i18n";

// "Showing 1 to 10 of 184 entries   Previous 1 2 3 Next" footer from the design.
export function Pagination({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (p: number) => void;
}) {
  const { t } = useTranslation();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  // At most 5 page buttons around the current page.
  const start = Math.max(1, Math.min(page - 2, pages - 4));
  const nums = Array.from({ length: Math.min(5, pages) }, (_, i) => start + i);

  const btn = "min-w-[32px] h-8 px-3 rounded-md border text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed";

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 bg-[#F9FAFB] border-t border-[#F3F4F6]">
      <p className="text-xs text-[#4B5563]">
        {t("pagination.showing", { from, to, total })}
      </p>
      <div className="flex items-center gap-1.5">
        <button className={`${btn} border-[#E5E7EB] bg-white text-[#374151] hover:bg-[#EEF1F8]`}
          disabled={page <= 1} onClick={() => onPage(page - 1)}>
          {t("pagination.previous")}
        </button>
        {nums.map((n) => (
          <button key={n} onClick={() => onPage(n)}
            className={`${btn} ${n === page ? "bg-[#1B2E6B] border-[#1B2E6B] text-white" : "border-[#E5E7EB] bg-white text-[#374151] hover:bg-[#EEF1F8]"}`}>
            {n}
          </button>
        ))}
        <button className={`${btn} border-[#E5E7EB] bg-white text-[#374151] hover:bg-[#EEF1F8]`}
          disabled={page >= pages} onClick={() => onPage(page + 1)}>
          {t("pagination.next")}
        </button>
      </div>
    </div>
  );
}
