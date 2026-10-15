"use client";
import React, { useEffect, useMemo, useState } from "react";
import {
  addDoc, collection, onSnapshot, query, serverTimestamp, where,
} from "firebase/firestore";
import { Sun, Sunset, Moon, Sparkles, Zap, CheckCircle2, Flame, History, Quote, Share2 } from "lucide-react";
import {
  db, useAuth, activePrayers, currentStreak, prayedDays, prayerKey, prayerName, toIsoDate,
  formatTime12, DEFAULT_PRAYERS, type DailyPrayer, type PrayerLog,
} from "@/lib/firebase";
import { useToast } from "@/components/ui/Toast";
import { VERSES, dayOfYear } from "@/lib/verses";
import { useVerseOfDay } from "@/lib/firebase";
import { dateLocale } from "@/lib/locale";
import { PageTitle } from "@/components/PageTitle";
import { useTranslation } from "@nablis/i18n";

function iconFor(time: string) {
  const h = Number(time.split(":")[0]);
  if (h < 11) return Sun;
  if (h < 17) return Sunset;
  return Moon;
}

export function MemberPrayers() {
  const { verse } = useVerseOfDay();
  const { t } = useTranslation();
  const { user } = useAuth();
  const toast = useToast();
  const [prayers, setPrayers] = useState<DailyPrayer[] | null>(null);
  const [logs, setLogs]       = useState<PrayerLog[]>([]);
  const [marking, setMarking] = useState<string | null>(null);

  useEffect(() => onSnapshot(collection(db, "dailyPrayers"), (snap) => {
    setPrayers(snap.docs.map((d) => ({ id: d.id, ...d.data() } as DailyPrayer)));
  }, () => setPrayers([])), []);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(query(collection(db, "prayerLogs"), where("userId", "==", user.id)), (snap) => {
      setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() } as PrayerLog)));
    });
  }, [user]);

  // Fall back to the three standard reminders until the ministry adds its own.
  const list: DailyPrayer[] = useMemo(() => {
    const configured = activePrayers(prayers ?? []);
    if (prayers && configured.length) return configured;
    return DEFAULT_PRAYERS.map((p) => ({ ...p, id: p.type!, enabled: true } as DailyPrayer));
  }, [prayers]);

  const todayIso = toIsoDate(new Date());
  const doneToday = new Set(
    logs.filter((l) => l.prayedAt?.toDate && toIsoDate(l.prayedAt.toDate()) === todayIso).map((l) => l.prayerType)
  );
  const nowHm = new Date().toTimeString().slice(0, 5);
  // "Up next" is the earliest prayer whose time has come and isn't done yet,
  // otherwise the next one later today.
  const upNext = list.find((p) => !doneToday.has(prayerKey(p)) && p.time <= nowHm)
    ?? list.find((p) => !doneToday.has(prayerKey(p)));

  const streak = currentStreak(logs);
  const days = prayedDays(logs);
  const reflection = VERSES[(dayOfYear() + 3) % VERSES.length];
  const hour = new Date().getHours();
  const firstName = user?.displayName?.split(" ")[0] ?? "friend";

  // Two-week consistency calendar ending this Saturday.
  const calendar = useMemo(() => {
    const end = new Date(); end.setDate(end.getDate() + (6 - end.getDay()));
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date(end); d.setDate(end.getDate() - 13 + i);
      return d;
    });
  }, []);
  const joined = user?.createdAt?.toDate?.() ?? null;

  async function markPrayed(p: DailyPrayer) {
    if (!user || doneToday.has(prayerKey(p))) return;
    setMarking(p.id);
    try {
      await addDoc(collection(db, "prayerLogs"), {
        userId: user.id,
        prayerType: prayerKey(p),
        prayedAt: serverTimestamp(),
        streak: streak + (days.has(todayIso) ? 0 : 1),
      });
      toast({ message: t("prayersPage.marked", { name: prayerName(p) }) });
    } catch {
      toast({ type: "error", message: t("prayersPage.saveError") });
    } finally {
      setMarking(null);
    }
  }

  async function shareVerse() {
    const text = `"${verse.text}" — ${verse.ref}`;
    try {
      if (navigator.share) await navigator.share({ text });
      else { await navigator.clipboard.writeText(text); toast({ message: t("prayersPage.copied") }); }
    } catch { /* share cancelled */ }
  }

  return (
    <div className="space-y-7">
      <div>
        <PageTitle id="prayers" />
      </div>

      {/* Reflection banner */}
      <div className="relative overflow-hidden rounded-2xl bg-[#1E3A8A] px-8 py-7 text-white shadow-lg">
        <Sparkles className="absolute right-10 top-1/2 -translate-y-1/2 text-white/10" size={150} strokeWidth={1} />
        <p className="text-[#F5C518] text-sm font-semibold tracking-widest">
          {t(hour < 12 ? "prayersPage.morningReflection" : hour < 17 ? "prayersPage.middayReflection" : "prayersPage.eveningReflection")}
        </p>
        <p className="font-display text-[34px] font-bold leading-tight mt-1.5">&ldquo;{reflection.text}&rdquo;</p>
        <p className="text-white/85 mt-2 max-w-2xl">
          — {reflection.ref}. {t("prayersPage.welcome", { name: firstName })}
        </p>
      </div>

      <div className="grid lg:grid-cols-[1fr_300px] gap-7 items-start">
        {/* Commitments */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-[#111827]">{t("prayersPage.commitments")}</h2>
            <span className="text-sm text-[#4B5563]">{t("prayersPage.today")}, {new Date().toLocaleDateString(dateLocale(), { month: "short", day: "numeric" })}</span>
          </div>
          <div className="space-y-4 stagger">
            {list.map((p) => {
              const done = doneToday.has(prayerKey(p));
              const next = !done && upNext?.id === p.id;
              const scheduled = !done && !next;
              const Icon = iconFor(p.time);
              return (
                <div key={p.id}
                  className={[
                    "rounded-2xl border shadow-sm px-6 py-6 flex gap-5 transition-all",
                    scheduled ? "bg-[#F1F4F9] border-transparent" : "bg-white border-[#E5E7EB]",
                    next ? "border-l-4 border-l-[#F5C518] shadow-md" : "",
                  ].join(" ")}>
                  <span className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${done ? "bg-[#FEF9C3] text-[#B45309]" : scheduled ? "bg-[#E5E9F2] text-[#6B7280]" : "bg-[#EEF1F8] text-[#1B2E6B]"}`}>
                    <Icon size={22} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className={`text-lg font-semibold ${scheduled ? "text-[#4B5563]" : "text-[#111827]"}`}>{prayerName(p)}</p>
                        <p className={`text-[15px] ${scheduled ? "text-[#4B5563]" : "text-[#1E3A8A]"}`}>{formatTime12(p.time)}</p>
                      </div>
                      <span className={[
                        "px-2.5 py-1 rounded-md text-xs font-bold tracking-wide",
                        done ? "bg-[#DCFCE7] text-[#15803D]" : next ? "bg-[#FEF9C3] text-[#1E3A8A]" : "bg-[#E5E7EB] text-[#6B7280]",
                      ].join(" ")}>
                        {done ? t("prayersPage.completed") : next ? t("prayersPage.upNext") : t("prayersPage.scheduled")}
                      </span>
                    </div>
                    <p className={`mt-2 leading-relaxed ${scheduled ? "text-[#6B7280]" : "text-[#374151]"}`}>&ldquo;{p.message}&rdquo;</p>
                    {done ? (
                      <div className="mt-4 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[#F1F4F9] text-[#4B5563] font-semibold">
                        <CheckCircle2 size={16} /> {t("prayersPage.prayed")}
                      </div>
                    ) : (
                      <button onClick={() => markPrayed(p)} disabled={scheduled || marking === p.id}
                        className={[
                          "mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-semibold transition-all",
                          next ? "bg-[#1E3A8A] text-white hover:bg-[#1B2E6B] shadow-md" : "border border-[#E5E7EB] text-[#9CA3AF] cursor-not-allowed",
                        ].join(" ")}>
                        {next && <Zap size={15} />}
                        {marking === p.id ? t("common.saving") : t("prayersPage.markPrayed")}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Progress + verse */}
        <aside className="space-y-6 lg:pt-11">
          <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-6">
            <p className="text-sm font-semibold tracking-widest text-[#6B7280]">{t("prayersPage.yourProgress")}</p>
            <div className="flex items-center gap-4 mt-5">
              <span className="w-12 h-12 rounded-xl bg-[#FFEDD5] text-[#EA580C] flex items-center justify-center"><Flame size={22} /></span>
              <div className="flex-1">
                <p className="text-xs text-[#6B7280]">{t("prayersPage.currentStreak")}</p>
                <p className="text-xl font-bold text-[#111827]">{t("prayersPage.days", { count: streak })}</p>
              </div>
              {days.has(todayIso) && <span className="text-sm font-semibold text-[#16A34A]">{t("prayersPage.plusToday", { count: doneToday.size })}</span>}
            </div>
            <div className="flex items-center gap-4 mt-4">
              <span className="w-12 h-12 rounded-xl bg-[#DBEAFE] text-[#1D4ED8] flex items-center justify-center"><History size={22} /></span>
              <div>
                <p className="text-xs text-[#6B7280]">{t("prayersPage.totalPrayers")}</p>
                <p className="text-xl font-bold text-[#111827]">{logs.length}</p>
              </div>
            </div>
            <div className="border-t border-[#F3F4F6] mt-5 pt-4">
              <p className="text-sm font-semibold text-[#4B5563] mb-3">{t("prayersPage.consistency")}</p>
              <div className="grid grid-cols-7 gap-2">
                {calendar.map((d) => {
                  const iso = toIsoDate(d);
                  const prayed = days.has(iso);
                  const future = iso > todayIso;
                  const missed = !prayed && !future && iso !== todayIso && (!joined || d >= joined);
                  return (
                    <span key={iso} title={d.toDateString()}
                      className={[
                        "h-8 rounded-lg text-xs font-semibold flex items-center justify-center",
                        iso === todayIso && prayed ? "bg-[#22C55E] text-white shadow" :
                        prayed ? "bg-[#DCFCE7] text-[#15803D]" :
                        missed ? "bg-[#FEE2E2] text-[#DC2626]" :
                        iso === todayIso ? "ring-2 ring-[#22C55E] text-[#15803D]" :
                        "bg-[#F3F4F6] text-[#6B7280]",
                      ].join(" ")}>
                      {d.getDate()}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="bg-[#FFD60A] rounded-2xl p-6 shadow-md">
            <p className="flex items-center gap-2 text-[#1E3A8A] font-bold"><Quote size={18} fill="currentColor" /> {t("prayersPage.verseOfDay")}</p>
            <p className="text-[#1E3A8A] text-lg leading-relaxed mt-4">&ldquo;{verse.text}&rdquo;</p>
            <div className="flex items-center justify-between mt-4 text-sm">
              <span className="text-[#1E3A8A]/80 font-semibold">{verse.ref}</span>
              <button onClick={shareVerse} className="flex items-center gap-1.5 font-bold text-[#1E3A8A] hover:underline">
                <Share2 size={14} /> {t("prayersPage.shareVerse")}
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
