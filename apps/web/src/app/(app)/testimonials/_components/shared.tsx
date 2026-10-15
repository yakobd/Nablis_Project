"use client";
import React from "react";
import { testimonyCategoryKey, testimonyCategoryLabel, type TestimonyDoc } from "@/lib/firebase";
import i18n from "@nablis/i18n";
import { dateLocale } from "@/lib/locale";

const CATEGORY_CLS: Record<string, string> = {
  healing:         "bg-[#DCFCE7] text-[#15803D]",
  answered_prayer: "bg-[#DBEAFE] text-[#1D4ED8]",
  provision:       "bg-[#FEF3C7] text-[#B45309]",
  restoration:     "bg-[#F3E8FF] text-[#7E22CE]",
  deliverance:     "bg-[#FFE4E6] text-[#BE123C]",
  guidance:        "bg-[#E0F2FE] text-[#0369A1]",
  faith:           "bg-[#EEF1F8] text-[#1E3A8A]",
  other:           "bg-[#F3F4F6] text-[#4B5563]",
};

/** Translated category name. */
export function catLabel(category?: string | null) {
  return i18n.t(`testimonyCat.${testimonyCategoryKey(category)}`, { defaultValue: testimonyCategoryLabel(category) });
}

/** Name shown to other members ("Anonymous" when the author chose so). */
export function authorLabel(t: Pick<TestimonyDoc, "anonymous" | "authorName">) {
  return t.anonymous ? i18n.t("testimony.anonymous") : t.authorName || i18n.t("status.member");
}

export function CategoryPill({ category, className = "" }: { category?: string | null; className?: string }) {
  return (
    <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${CATEGORY_CLS[testimonyCategoryKey(category)]} ${className}`}>
      {catLabel(category)}
    </span>
  );
}

export function initials(name?: string | null) {
  const parts = (name || "?").trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

export function Avatar({ name, photo, size = 36 }: { name?: string | null; photo?: string | null; size?: number }) {
  if (photo) {
    return <img src={photo} alt="" className="rounded-full object-cover flex-shrink-0" style={{ width: size, height: size }} />;
  }
  return (
    <div className="rounded-full bg-[#EEF1F8] text-[#1E3A8A] font-bold flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {initials(name)}
    </div>
  );
}

export function tsMillis(t: Pick<TestimonyDoc, "createdAt">) {
  return t.createdAt?.toMillis?.() ?? 0;
}

export function fmtDate(t: Pick<TestimonyDoc, "createdAt">) {
  const d = t.createdAt?.toDate?.();
  return d ? d.toLocaleDateString(dateLocale(), { month: "short", day: "numeric", year: "numeric" }) : "—";
}

export function ago(t: Pick<TestimonyDoc, "createdAt">) {
  const d = t.createdAt?.toDate?.();
  if (!d) return i18n.t("time.justNow");
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 60) return i18n.t("time.minsAgo", { count: Math.max(mins, 1) });
  const h = Math.floor(mins / 60);
  if (h < 24) return i18n.t("time.hoursAgo", { count: h });
  const days = Math.floor(h / 24);
  if (days < 7) return i18n.t("time.daysAgo", { count: days });
  const w = Math.floor(days / 7);
  return w < 5 ? i18n.t("time.weeksAgo", { count: w }) : fmtDate(t);
}

export function excerpt(text: string, length = 140) {
  const s = (text ?? "").replace(/\s+/g, " ").trim();
  return s.length > length ? `${s.slice(0, length).trimEnd()}…` : s;
}

/**
 * Story body: blank-line separated paragraphs. A paragraph starting with ">"
 * or wrapped in quotes is shown as a highlighted quote.
 */
export function StoryBody({ content }: { content: string }) {
  const paras = (content ?? "").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  return (
    <div className="space-y-4 text-[15px] leading-relaxed text-[#374151]">
      {paras.map((p, i) => {
        const quote = p.startsWith(">") ? p.replace(/^>\s?/gm, "") : /^["“][\s\S]*["”]$/.test(p) ? p : null;
        return quote ? (
          <blockquote key={i} className="border-l-4 border-[#F5C518] bg-[#FFFBEB] rounded-r-xl px-5 py-4 italic text-[#1F2937]">
            {quote}
          </blockquote>
        ) : (
          <p key={i} className="whitespace-pre-line">{p}</p>
        );
      })}
    </div>
  );
}
