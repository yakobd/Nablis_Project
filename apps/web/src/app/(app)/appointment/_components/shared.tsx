import React from "react";
import type { Timestamp } from "firebase/firestore";
import i18n from "@nablis/i18n";
import { dateLocale } from "@/lib/locale";
import { Church, HeartHandshake, Users, GraduationCap, Home, BookOpen, Flame, FileText } from "lucide-react";

export function fmtDate(ts: Timestamp | null | undefined, opts?: Intl.DateTimeFormatOptions) {
  if (!ts) return "—";
  try { return ts.toDate().toLocaleDateString(dateLocale(), opts ?? { month: "short", day: "numeric", year: "numeric" }); }
  catch { return "—"; }
}

export function timeAgo(ts: Timestamp | null | undefined) {
  if (!ts) return "";
  const days = Math.floor((Date.now() - ts.toDate().getTime()) / 86400000);
  if (days < 1) return i18n.t("time.today");
  if (days < 30) return i18n.t("time.daysAgo", { count: days });
  const months = Math.floor(days / 30);
  if (months < 12) return i18n.t("time.monthsAgo", { count: months });
  return i18n.t("time.yearsAgo", { count: Math.floor(months / 12) });
}

export function initials(name?: string | null) {
  return (name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");
}

// Icon per service (lucide equivalents of the design's glyphs).
const SERVICE_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  confession: Church,
  counseling: HeartHandshake,
  marriage: Users,
  youth: GraduationCap,
  family: Home,
  bible_study: BookOpen,
  prayer: Flame,
};
export function ServiceGlyph({ value, size = 18, className = "" }: { value?: string | null; size?: number; className?: string }) {
  const key = (value ?? "").toLowerCase();
  const Icon = SERVICE_ICONS[key] ?? Object.entries(SERVICE_ICONS).find(([k]) => key.includes(k.split("_")[0]))?.[1] ?? FileText;
  return <Icon size={size} className={className} />;
}

// Service pill colours in the admin table.
export function servicePillClass(value?: string | null) {
  const v = (value ?? "").toLowerCase();
  if (v.includes("confession")) return "bg-[#F3E8FF] text-[#7E22CE]";
  if (v.includes("counsel")) return "bg-[#E0EAFF] text-[#1D4ED8]";
  if (v.includes("marriage") || v.includes("family")) return "bg-[#FCE7F3] text-[#BE185D]";
  if (v.includes("youth")) return "bg-[#DCFCE7] text-[#15803D]";
  return "bg-[#F3F4F6] text-[#4B5563]";
}

export const STATUS_META: Record<string, { label: string; className: string; dot: string }> = {
  pending:   { label: "Pending",   className: "bg-[#FEF9C3] text-[#A16207] border border-[#FDE68A]", dot: "bg-[#EAB308]" },
  confirmed: { label: "Confirmed", className: "bg-[#DCFCE7] text-[#15803D] border border-[#BBF7D0]", dot: "bg-[#22C55E]" },
  rejected:  { label: "Rejected",  className: "bg-[#FEE2E2] text-[#B91C1C] border border-[#FECACA]", dot: "bg-[#EF4444]" },
  cancelled: { label: "Cancelled", className: "bg-[#F3F4F6] text-[#6B7280] border border-[#E5E7EB]", dot: "bg-[#9CA3AF]" },
};

export function StatusPill({ status }: { status: string }) {
  const m = STATUS_META[status] ?? STATUS_META.cancelled;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${m.className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
      {i18n.t(`apptStatus.${status in STATUS_META ? status : "cancelled"}`)}
    </span>
  );
}

export function Spinner() {
  return <div className="w-7 h-7 border-2 border-[#1B2E6B] border-t-transparent rounded-full animate-spin mx-auto" />;
}
