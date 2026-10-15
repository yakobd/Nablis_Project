"use client";
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { doc, onSnapshot } from "firebase/firestore";
import { ArrowLeft, BookOpen, Check, ChevronLeft, ChevronRight, ExternalLink, Flame, Target, TrendingUp, AlertCircle } from "lucide-react";
import {
  db, useAuth, isoToday, monthlyPerformance, parseIso, planProgress, readingProgressId, readingStreak, setReadingDone,
  type ReadingPlan,
} from "@/lib/firebase";
import { useToast } from "@/components/ui/Toast";
import { MonthlyChart } from "./MonthlyChart";
import { PageTitle } from "@/components/PageTitle";
import { useTranslation } from "@nablis/i18n";
import { dateLocale } from "@/lib/locale";

const passageLink = (reading: string) => `https://www.biblegateway.com/passage/?search=${encodeURIComponent(reading)}&version=NKJV`;
const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) => parseIso(iso).toLocaleDateString(dateLocale(), opts);

export function MemberReadingPlan({ plan }: { plan: ReadingPlan | null }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const toast = useToast();
  const [completed, setCompleted] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const today = isoToday();
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });

  useEffect(() => {
    if (!user || !plan) return;
    return onSnapshot(doc(db, "readingProgress", readingProgressId(plan.id, user.id)), (snap) => {
      setCompleted((snap.data()?.completed as string[] | undefined) ?? []);
    }, () => {});
  }, [user, plan]);

  // A plan for another year opens on its first (or last) month.
  useEffect(() => {
    if (!plan) return;
    const now = new Date();
    if (plan.year > now.getFullYear()) setMonth(new Date(plan.year, 0, 1));
    else if (plan.year < now.getFullYear()) setMonth(new Date(plan.year, 11, 1));
  }, [plan?.year]); // eslint-disable-line react-hooks/exhaustive-deps

  const byDate = useMemo(() => new Map((plan?.entries ?? []).map((e) => [e.date, e.reading])), [plan]);
  const done = useMemo(() => new Set(completed), [completed]);
  const progress = plan ? planProgress(plan, completed, today) : null;
  const streak = plan ? readingStreak(plan, completed, today) : 0;
  const monthly = plan ? monthlyPerformance(plan, completed, today) : [];
  const missed = (plan?.entries ?? []).filter((e) => e.date < today && !done.has(e.date)).reverse();
  const todayReading = byDate.get(today);
  const nextEntry = !todayReading ? plan?.entries.find((e) => e.date > today) : undefined;

  async function toggle(date: string) {
    if (!user || !plan || date > today) return;
    const on = !done.has(date);
    setBusy(date);
    // Optimistic; the listener confirms.
    setCompleted((c) => (on ? [...c, date] : c.filter((d) => d !== date)));
    try {
      await setReadingDone(plan, user, date, on);
      if (on && date === today) toast({ message: streak + 1 > 1 ? t("plan.streakToast", { count: streak + 1 }) : t("memberDash.readingDone") });
    } catch {
      setCompleted((c) => (on ? c.filter((d) => d !== date) : [...c, date]));
      toast({ message: t("testimony.saveError"), type: "error" });
    } finally {
      setBusy(null);
    }
  }

  if (!user) return null;

  if (!plan) {
    return (
      <div className="space-y-8">
        <Header />
        <div className="bg-white rounded-3xl p-12 text-center shadow-sm">
          <BookOpen size={36} className="mx-auto text-[#1E3A8A]/30" />
          <p className="text-[#111827] font-semibold mt-3">{t("mobile.noPlan")}</p>
          <p className="text-sm text-[#6B7280] mt-1">{t("plan.soon")}</p>
        </div>
      </div>
    );
  }

  // Calendar for the selected month.
  const first = month;
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7; // Monday first
  const cells = Array.from({ length: lead + daysInMonth }, (_, i) => {
    if (i < lead) return null;
    const d = new Date(first.getFullYear(), first.getMonth(), i - lead + 1);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return { iso, day: d.getDate(), reading: byDate.get(iso) };
  });
  const canPrev = first.getFullYear() > plan.year || first.getMonth() > 0;
  const canNext = first.getFullYear() < plan.year || first.getMonth() < 11;

  return (
    <div className="space-y-8">
      <Header title={plan.title} />

      <div className="grid lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-6">
        {/* Today */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1E3A8A] to-[#1B2E6B] text-white p-7 sm:p-8 shadow-[0_20px_40px_-24px_rgba(30,58,138,0.9)] animate-fade-up">
          <span className="absolute -right-12 -top-12 w-48 h-48 rounded-full bg-white/5 animate-drift" />
          <p className="text-xs font-semibold uppercase tracking-widest text-[#F5C518]">{t("plan.todays")} · {fmt(today, { weekday: "long", month: "long", day: "numeric" })}</p>
          {todayReading ? (
            <>
              <p className="font-display text-3xl sm:text-4xl font-bold mt-3 leading-tight">{todayReading}</p>
              <div className="flex flex-wrap gap-3 mt-7">
                <button onClick={() => toggle(today)} disabled={busy === today}
                  className={`flex items-center gap-2 px-6 py-3 rounded-full text-sm font-bold transition-all ${done.has(today) ? "bg-[#22C55E] text-white" : "bg-[#F5C518] text-[#1B2E6B] hover:bg-[#e6b800]"}`}>
                  <Check size={17} className={done.has(today) ? "animate-pop" : ""} /> {done.has(today) ? t("memberDash.completed") : t("memberDash.markAsRead")}
                </button>
                <a href={passageLink(todayReading)} target="_blank" rel="noreferrer"
                  className="flex items-center gap-2 px-5 py-3 rounded-full bg-white/10 text-sm font-semibold hover:bg-white/20">
                  {t("plan.openPassage")} <ExternalLink size={14} />
                </a>
              </div>
            </>
          ) : (
            <p className="text-white/80 mt-4">
              {t("memberDash.noReadingToday")}{nextEntry && <> {t("plan.next")} <span className="font-semibold text-white">{nextEntry.reading}</span> · {fmt(nextEntry.date, { month: "short", day: "numeric" })}</>}
            </p>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 stagger">
          {[
            { label: t("memberDash.onTrack"), value: `${progress!.onTrackPct}%`, hint: t("plan.soFar", { done: progress!.due - progress!.behind, due: progress!.due }), Icon: Target, cls: "bg-[#EEF1F8] text-[#1E3A8A]" },
            { label: t("plan.year"), value: `${progress!.overallPct}%`, hint: t("plan.readingsOf", { done: progress!.done, total: progress!.total }), Icon: TrendingUp, cls: "bg-[#DCFCE7] text-[#15803D]" },
            { label: t("plan.streak"), value: t("plan.days", { count: streak }), hint: streak ? t("plan.keepGoing") : t("plan.startToday"), Icon: Flame, cls: "bg-[#FFEDD5] text-[#EA580C]" },
            { label: t("plan.toCatchUp"), value: String(progress!.behind), hint: progress!.behind ? t("plan.missedReadings") : t("plan.allCaughtUp"), Icon: AlertCircle, cls: progress!.behind ? "bg-[#FEE2E2] text-[#DC2626]" : "bg-[#F3F4F6] text-[#6B7280]" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-2xl p-5 shadow-sm">
              <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${s.cls}`}><s.Icon size={17} /></span>
              <p className="font-display text-2xl font-bold text-[#111827] mt-3">{s.value}</p>
              <p className="text-xs font-medium text-[#374151]">{s.label}</p>
              <p className="text-[11px] text-[#9CA3AF] mt-0.5">{s.hint}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-6">
        {/* Calendar */}
        <div className="bg-white rounded-3xl shadow-sm p-6">
          <div className="flex items-center justify-between">
            <p className="text-lg font-semibold text-[#111827]">{first.toLocaleDateString(dateLocale(), { month: "long", year: "numeric" })}</p>
            <div className="flex gap-1">
              <button onClick={() => setMonth(new Date(first.getFullYear(), first.getMonth() - 1, 1))} disabled={!canPrev} aria-label={t("calendar.prevMonth")} className="p-2 rounded-lg hover:bg-[#F3F4F6] disabled:opacity-30"><ChevronLeft size={17} /></button>
              <button onClick={() => setMonth(new Date(first.getFullYear(), first.getMonth() + 1, 1))} disabled={!canNext} aria-label={t("calendar.nextMonth")} className="p-2 rounded-lg hover:bg-[#F3F4F6] disabled:opacity-30"><ChevronRight size={17} /></button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1.5 mt-4 text-center text-[11px] font-semibold text-[#9CA3AF]">
            {Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(dateLocale(), { weekday: "short" })).map((d) => <span key={d}>{d}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-1.5 mt-2">
            {cells.map((c, i) => {
              if (!c) return <span key={`x${i}`} />;
              const isDone = done.has(c.iso);
              const past = c.iso < today;
              const isToday = c.iso === today;
              const cls = !c.reading ? "bg-transparent text-[#D1D5DB] cursor-default"
                : isDone ? "bg-[#1E3A8A] text-white"
                : isToday ? "bg-[#FEF9C3] text-[#111827] ring-2 ring-[#F5C518]"
                : past ? "bg-[#FEF2F2] text-[#B91C1C]"
                : "bg-[#F9FAFB] text-[#6B7280] cursor-default";
              return (
                <button key={c.iso} onClick={() => c.reading && toggle(c.iso)} disabled={!c.reading || c.iso > today || busy === c.iso}
                  title={c.reading ? `${fmt(c.iso, { month: "short", day: "numeric" })}: ${c.reading}${isDone ? " ✓" : ""}` : undefined}
                  className={`relative aspect-square rounded-xl text-sm font-medium flex items-center justify-center transition-all ${cls} ${c.reading && c.iso <= today ? "hover:scale-105" : ""}`}>
                  {c.day}
                  {isDone && <Check size={10} className="absolute bottom-1 right-1 opacity-80" />}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-4 mt-4 text-[11px] text-[#6B7280]">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#1E3A8A]" /> {t("plan.read")}</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#FEF2F2] border border-[#FCA5A5]" /> {t("plan.missed")}</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#FEF9C3] border border-[#F5C518]" /> {t("memberDash.today")}</span>
            <span className="text-[#9CA3AF]">{t("plan.tapPast")}</span>
          </div>
        </div>

        {/* Catch up */}
        <div className="bg-white rounded-3xl shadow-sm p-6 self-start">
          <p className="text-lg font-semibold text-[#111827]">{t("plan.catchUp")}</p>
          {missed.length === 0 ? (
            <p className="text-sm text-[#6B7280] mt-3">{t("plan.caughtUp")}</p>
          ) : (
            <>
              <p className="text-sm text-[#6B7280] mt-0.5">{t("plan.missedCount", { count: missed.length })}</p>
              <div className="space-y-2 mt-4 max-h-80 overflow-y-auto pr-1">
                {missed.slice(0, 30).map((e) => (
                  <div key={e.date} className="flex items-center gap-3 rounded-xl border border-[#F3F4F6] px-3 py-2.5">
                    <button onClick={() => toggle(e.date)} disabled={busy === e.date} aria-label={t("plan.markRead", { reading: e.reading })}
                      className="w-6 h-6 rounded-md border-2 border-[#D1D5DB] hover:border-[#1E3A8A] flex-shrink-0" />
                    <a href={passageLink(e.reading)} target="_blank" rel="noreferrer" className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[#111827] truncate hover:text-[#1E3A8A]">{e.reading}</p>
                      <p className="text-[11px] text-[#9CA3AF]">{fmt(e.date, { weekday: "short", month: "short", day: "numeric" })}</p>
                    </a>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <p className="text-lg font-semibold text-[#111827]">{t("plan.monthly")}</p>
            <p className="text-sm text-[#6B7280]">{t("plan.monthlyHint", { year: plan.year })}</p>
          </div>
        </div>
        <MonthlyChart data={monthly} title={t("plan.monthly")} />
      </div>
    </div>
  );
}

function Header({ title }: { title?: string }) {
  const { t } = useTranslation();
  return (
    <div>
      <Link href="/bible-study" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1E3A8A] mb-3"><ArrowLeft size={16} /> {t("nav.bibleStudy")}</Link>
      <PageTitle id={title ? "readingPlanTitled" : "readingPlan"} values={title ? { title } : undefined} />
    </div>
  );
}
