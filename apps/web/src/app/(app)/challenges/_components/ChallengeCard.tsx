"use client";
import React from "react";
import Link from "next/link";
import { CalendarDays, Users, Trophy, CheckCircle2 } from "lucide-react";
import { challengeCategory, challengeStatus, challengeTotals, type ChallengeDoc, type ChallengeProgress } from "@/lib/firebase";
import { useTranslation } from "@nablis/i18n";
import { dateLocale } from "@/lib/locale";
import { challengeIcon } from "@/lib/challengeIcons";

export function fmtRange(c: Pick<ChallengeDoc, "startDate" | "endDate">) {
  const f = (s: string) => new Date(`${s}T12:00:00`).toLocaleDateString(dateLocale(), { month: "short", day: "numeric" });
  return `${f(c.startDate)} – ${f(c.endDate)}`;
}

export function daysLeft(c: Pick<ChallengeDoc, "endDate">) {
  const end = new Date(`${c.endDate}T23:59:59`).getTime();
  return Math.max(0, Math.ceil((end - Date.now()) / 86400000));
}

export const STATUS_PILL = {
  upcoming: "bg-[#DBEAFE] text-[#1D4ED8]",
  active: "bg-[#DCFCE7] text-[#15803D]",
  ended: "bg-[#F3F4F6] text-[#6B7280]",
} as const;

/** Challenge card. With `progress` it shows the member's bar; with `stats` the staff summary. */
export function ChallengeCard({ c, progress, stats }: {
  c: ChallengeDoc;
  progress?: ChallengeProgress | null;
  stats?: { joined: number; completed: number };
}) {
  const { t } = useTranslation();
  const cat = challengeCategory(c.category);
  const status = challengeStatus(c);
  const totals = progress ? challengeTotals(c, progress) : null;
  return (
    <Link href={`/challenges/${c.id}`} className="group bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col">
      <div className="relative h-36 bg-gradient-to-br from-[#1E3A8A] to-[#3B5BB5] overflow-hidden">
        {c.imageURL
          ? <img src={c.imageURL} alt="" className="w-full h-full object-cover group-hover-zoom" />
          : <span className="absolute inset-0 flex items-center justify-center text-white/90 group-hover:scale-110 transition-transform duration-500">{React.createElement(challengeIcon(cat.key), { size: 52, strokeWidth: 1.5 })}</span>}
        <span className={`absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${STATUS_PILL[status]}`}>
          {status === "active" ? t("challenge.daysLeft", { count: daysLeft(c) }) : t(`challengeStatus.${status}`)}
        </span>
        {totals?.complete && (
          <span className="absolute top-3 right-3 flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#F5C518] text-[#1B2E6B] text-[10px] font-bold"><Trophy size={11} /> {t("challenge.completedBadge")}</span>
        )}
      </div>
      <div className="p-5 flex flex-col flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">{t(`challengeCat.${cat.key}`)}</p>
        <p className="text-lg font-semibold text-[#111827] mt-1 leading-snug line-clamp-2 group-hover:text-[#1E3A8A]">{c.title}</p>
        <p className="flex items-center gap-1.5 text-xs text-[#6B7280] mt-2"><CalendarDays size={13} /> {fmtRange(c)}</p>
        <div className="mt-auto pt-4">
          {totals ? (
            <>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-[#6B7280]">{totals.done} / {totals.total} {c.kind === "goal" ? c.unit ?? "" : c.kind === "daily" ? t("challenge.days") : t("challenge.steps")}</span>
                <span className="font-semibold text-[#111827]">{totals.pct}%</span>
              </div>
              <div className="h-2 rounded-full bg-[#F3F4F6] overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-700 ${totals.complete ? "bg-[#F5C518]" : "bg-[#1E3A8A]"}`} style={{ width: `${totals.pct}%` }} />
              </div>
            </>
          ) : stats ? (
            <div className="flex items-center gap-4 text-xs text-[#6B7280]">
              <span className="flex items-center gap-1.5"><Users size={13} /> {t("challenge.joinedCount", { count: stats.joined })}</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 size={13} /> {t("challenge.completedCount", { count: stats.completed })}</span>
            </div>
          ) : (
            <span className="inline-flex px-4 py-2 rounded-full bg-[#F5C518] text-[#1B2E6B] text-xs font-bold">{status === "ended" ? t("common.view") : t("challenge.join")}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
