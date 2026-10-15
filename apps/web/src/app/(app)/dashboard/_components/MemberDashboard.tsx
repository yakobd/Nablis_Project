"use client";
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import {
  CalendarDays, CheckCircle2, ChevronRight, Clock3, BookOpen, Check, Trophy, Megaphone, Sun, Sunset, Moon, Flame, ClipboardCheck,
} from "lucide-react";
import {
  db, useAuth, activePrayers, attendanceSummary, challengeStatus, challengeTotals, currentStreak, formatTime12, isoToday,
  planProgress, prayerKey, prayerName, readingProgressId, serviceIcon, serviceLabel, setReadingDone, toIsoDate, DEFAULT_PRAYERS,
  type Announcement, type Appointment, type Attendance, type ChallengeDoc, type ChallengeProgress, type DailyPrayer, type PrayerLog, type ReadingPlan,
} from "@/lib/firebase";
import { useToast } from "@/components/ui/Toast";
import { useVerseOfDay } from "@/lib/firebase";
import { useTranslation } from "@nablis/i18n";
import { dateLocale } from "@/lib/locale";

function prayerIcon(time: string) {
  const h = Number(time.split(":")[0]);
  return h < 11 ? Sun : h < 17 ? Sunset : Moon;
}

function Card({ title, href, link, children, className = "" }: { title: string; href?: string; link: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-3xl shadow-sm p-6 ${className}`}>
      <div className="flex items-center justify-between gap-3 mb-4">
        <p className="text-lg font-semibold text-[#111827]">{title}</p>
        {href && <Link href={href} className="flex items-center gap-1 text-sm font-semibold text-[#1E3A8A] whitespace-nowrap">{link} <ChevronRight size={15} /></Link>}
      </div>
      {children}
    </div>
  );
}

export function MemberDashboard() {
  const { verse } = useVerseOfDay();
  const { user } = useAuth();
  const { t } = useTranslation();
  const toast = useToast();
  const [appts, setAppts] = useState<Appointment[]>([]);
  const [prayers, setPrayers] = useState<DailyPrayer[] | null>(null);
  const [logs, setLogs] = useState<PrayerLog[]>([]);
  const [plan, setPlan] = useState<ReadingPlan | null>(null);
  const [completed, setCompleted] = useState<string[]>([]);
  const [sessions, setSessions] = useState<Attendance[]>([]);
  const [checkedIn, setCheckedIn] = useState<Set<string>>(new Set());
  const [challenges, setChallenges] = useState<ChallengeDoc[]>([]);
  const [cProgress, setCProgress] = useState<ChallengeProgress[]>([]);
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const today = isoToday();

  useEffect(() => {
    if (!user) return;
    const subs = [
      onSnapshot(query(collection(db, "appointments"), where("memberId", "==", user.id)), (s) => setAppts(s.docs.map((d) => ({ id: d.id, ...d.data() } as Appointment))), () => {}),
      onSnapshot(collection(db, "dailyPrayers"), (s) => setPrayers(s.docs.map((d) => ({ id: d.id, ...d.data() } as DailyPrayer))), () => setPrayers([])),
      onSnapshot(query(collection(db, "prayerLogs"), where("userId", "==", user.id)), (s) => setLogs(s.docs.map((d) => ({ id: d.id, ...d.data() } as PrayerLog))), () => {}),
      onSnapshot(query(collection(db, "readingPlans"), where("active", "==", true)), (s) => {
        const d = s.docs[0];
        setPlan(d ? ({ id: d.id, entries: [], ...d.data() } as unknown as ReadingPlan) : null);
      }, () => {}),
      onSnapshot(collection(db, "attendance"), (s) => setSessions(s.docs.map((d) => ({ id: d.id, ...d.data() } as Attendance))), () => {}),
      onSnapshot(query(collection(db, "checkIns"), where("userId", "==", user.id)), (s) => setCheckedIn(new Set(s.docs.map((d) => d.data().sessionId as string))), () => {}),
      onSnapshot(collection(db, "challenges"), (s) => setChallenges(s.docs.map((d) => ({ id: d.id, ...d.data() } as ChallengeDoc))), () => {}),
      onSnapshot(query(collection(db, "challengeProgress"), where("userId", "==", user.id)), (s) => setCProgress(s.docs.map((d) => ({ id: d.id, ...d.data() } as ChallengeProgress))), () => {}),
      onSnapshot(collection(db, "announcements"), (s) => {
        const latest = s.docs.map((d) => ({ id: d.id, ...d.data() } as Announcement))
          .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0))[0];
        setAnnouncement(latest ?? null);
      }, () => {}),
    ];
    return () => subs.forEach((u) => u());
  }, [user]);

  useEffect(() => {
    if (!user || !plan) return;
    return onSnapshot(doc(db, "readingProgress", readingProgressId(plan.id, user.id)), (s) => setCompleted((s.data()?.completed as string[]) ?? []), () => {});
  }, [user, plan?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const prayerList: DailyPrayer[] = useMemo(() => {
    const configured = activePrayers(prayers ?? []);
    if (prayers && configured.length) return configured;
    return DEFAULT_PRAYERS.map((p) => ({ ...p, id: p.type!, enabled: true } as DailyPrayer));
  }, [prayers]);
  const doneToday = new Set(logs.filter((l) => l.prayedAt?.toDate && toIsoDate(l.prayedAt.toDate()) === today).map((l) => l.prayerType));
  const nowHm = new Date().toTimeString().slice(0, 5);
  const upNext = prayerList.find((p) => !doneToday.has(prayerKey(p)) && p.time <= nowHm) ?? prayerList.find((p) => !doneToday.has(prayerKey(p)));
  const streak = currentStreak(logs);

  const nextAppt = appts.filter((a) => (a.status === "confirmed" || a.status === "pending") && (a.date?.toMillis?.() ?? 0) >= Date.now() - 3600000)
    .sort((a, b) => a.date.toMillis() - b.date.toMillis())[0];

  const attendance = user ? attendanceSummary(sessions, user.id, checkedIn, user.createdAt) : null;
  const reading = plan ? planProgress(plan, completed, today) : null;
  const todayReading = plan?.entries.find((e) => e.date === today)?.reading;
  const myChallenges = challenges.filter((c) => challengeStatus(c) === "active" && cProgress.some((p) => p.challengeId === c.id));
  const openChallenges = challenges.filter((c) => challengeStatus(c) !== "ended" && !cProgress.some((p) => p.challengeId === c.id));

  async function markRead() {
    if (!user || !plan) return;
    const on = !completed.includes(today);
    setCompleted((c) => (on ? [...c, today] : c.filter((d) => d !== today)));
    try {
      await setReadingDone(plan, user, today, on);
      if (on) toast({ message: t("memberDash.readingDone") });
    } catch {
      setCompleted((c) => (on ? c.filter((d) => d !== today) : [...c, today]));
      toast({ message: "Couldn't save that.", type: "error" });
    }
  }

  if (!user) return null;
  const firstName = user.displayName?.split(" ")[0] ?? "friend";
  const hour = new Date().getHours();

  return (
    <div className="space-y-8">
      <div>
        <h1>{t("greeting.hello", { name: firstName })}</h1>
        <p>{t(hour < 12 ? "greeting.morning" : hour < 18 ? "greeting.afternoon" : "greeting.evening")}. {t("greeting.blessing")}</p>
      </div>

      {/* Verse */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1E3A8A] to-[#1B2E6B] text-white px-7 py-7 sm:px-9 shadow-[0_20px_40px_-24px_rgba(30,58,138,0.9)] animate-fade-up">
        <span className="absolute -right-14 -top-14 w-52 h-52 rounded-full bg-white/5 animate-drift" />
        <p className="text-xs font-semibold uppercase tracking-widest text-[#F5C518]">{t("memberDash.verseOfDay")}</p>
        <p className="font-display text-2xl sm:text-3xl font-bold mt-3 leading-snug max-w-3xl">&ldquo;{verse.text}&rdquo;</p>
        <p className="text-white/70 mt-2">{verse.ref}</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Prayers */}
        <Card title={t("memberDash.todaysPrayers")} href="/daily-prayers" link={t("memberDash.prayers")}>
          <div className="space-y-2">
            {prayerList.map((p) => {
              const done = doneToday.has(prayerKey(p));
              const isNext = upNext && prayerKey(upNext) === prayerKey(p);
              const Icon = prayerIcon(p.time);
              return (
                <div key={p.id} className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 border ${isNext ? "border-[#F5C518] bg-[#FFFBEB]" : "border-[#F3F4F6]"}`}>
                  <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${done ? "bg-[#DCFCE7] text-[#15803D]" : "bg-[#EEF1F8] text-[#1E3A8A]"}`}>{done ? <CheckCircle2 size={17} /> : <Icon size={17} />}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold text-[#111827] truncate">{prayerName(p)}</span>
                    <span className="block text-[11px] text-[#6B7280]">{formatTime12(p.time)}</span>
                  </span>
                  <span className={`text-[10px] font-bold uppercase ${done ? "text-[#15803D]" : isNext ? "text-[#B45309]" : "text-[#9CA3AF]"}`}>{done ? t("memberDash.prayed") : isNext ? t("memberDash.upNext") : t("memberDash.later")}</span>
                </div>
              );
            })}
          </div>
          <p className="flex items-center gap-1.5 text-xs text-[#6B7280] mt-4"><Flame size={13} className="text-[#EA580C]" /> {streak ? t("memberDash.streak", { count: streak }) : t("memberDash.startStreak")}</p>
        </Card>

        {/* Reading */}
        <Card title={t("memberDash.dailyReading")} href="/bible-study/reading-plan" link={t("memberDash.plan")}>
          {!plan ? (
            <p className="text-sm text-[#6B7280]">{t("memberDash.noPlan")}</p>
          ) : (
            <>
              {todayReading ? (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#9CA3AF]">{t("memberDash.today")}</p>
                  <p className="font-display text-2xl font-bold text-[#111827] mt-1">{todayReading}</p>
                  <button onClick={markRead}
                    className={`flex items-center gap-2 mt-4 px-5 py-2.5 rounded-full text-sm font-bold ${completed.includes(today) ? "bg-[#22C55E] text-white" : "bg-[#F5C518] text-[#1B2E6B] hover:bg-[#e6b800]"}`}>
                    <Check size={15} className={completed.includes(today) ? "animate-pop" : ""} /> {completed.includes(today) ? t("memberDash.completed") : t("memberDash.markAsRead")}
                  </button>
                </>
              ) : <p className="text-sm text-[#6B7280]">{t("memberDash.noReadingToday")}</p>}
              {reading && (
                <div className="mt-5">
                  <div className="flex justify-between text-xs mb-1.5"><span className="text-[#6B7280]">{t("memberDash.onTrack")}</span><span className="font-semibold text-[#111827]">{reading.onTrackPct}%</span></div>
                  <div className="h-2 rounded-full bg-[#F3F4F6] overflow-hidden"><div className="h-full rounded-full bg-[#1E3A8A] transition-all duration-700" style={{ width: `${reading.onTrackPct}%` }} /></div>
                  {reading.behind > 0 && <p className="text-[11px] text-[#DC2626] mt-1.5">{t("memberDash.toCatchUp", { count: reading.behind })}</p>}
                </div>
              )}
            </>
          )}
        </Card>

        {/* Appointment */}
        <Card title={t("memberDash.nextAppointment")} href="/appointment" link={t("memberDash.appointments")}>
          {nextAppt ? (
            <div className="flex items-start gap-4">
              <span className="w-12 h-12 rounded-2xl bg-[#EEF1F8] flex items-center justify-center text-2xl flex-shrink-0">{serviceIcon(nextAppt.serviceType)}</span>
              <div>
                <p className="font-semibold text-[#111827]">{serviceLabel(nextAppt.serviceType)}</p>
                <p className="flex items-center gap-1.5 text-sm text-[#374151] mt-1"><CalendarDays size={14} /> {nextAppt.date.toDate().toLocaleDateString(dateLocale(), { weekday: "short", month: "short", day: "numeric" })}</p>
                <p className="flex items-center gap-1.5 text-sm text-[#374151]"><Clock3 size={14} /> {formatTime12(nextAppt.time)}</p>
                <span className={`inline-block mt-2 px-2.5 py-1 rounded-full text-[10px] font-bold ${nextAppt.status === "confirmed" ? "bg-[#DCFCE7] text-[#15803D]" : "bg-[#FEF3C7] text-[#B45309]"}`}>
                  {nextAppt.status === "confirmed" ? t("memberDash.confirmed") : t("memberDash.awaiting")}
                </span>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-sm text-[#6B7280]">{t("memberDash.noUpcoming")}</p>
              <Link href="/appointment/book" className="inline-flex mt-4 px-5 py-2.5 rounded-full bg-[#1E3A8A] text-white text-sm font-semibold hover:bg-[#1B2E6B]">{t("memberDash.bookSession")}</Link>
            </div>
          )}
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Attendance */}
        <Card title={t("memberDash.attendance")} href="/attendance" link={t("memberDash.history")}>
          <div className="flex items-center gap-4">
            <span className="w-14 h-14 rounded-2xl bg-[#F3E8FF] text-[#7E22CE] flex items-center justify-center"><ClipboardCheck size={24} /></span>
            <div>
              <p className="font-display text-3xl font-bold text-[#111827]">{attendance?.percent === null || !attendance ? "—" : `${attendance.percent}%`}</p>
              <p className="text-xs text-[#6B7280]">{attendance?.total ? t("memberDash.gatheringsOf", { attended: attendance.attended, total: attendance.total }) : t("memberDash.noGatherings")}</p>
            </div>
          </div>
        </Card>

        {/* Challenges */}
        <Card title={t("memberDash.challenges")} href="/challenges" link={t("memberDash.all")}>
          {myChallenges.length === 0 ? (
            <div>
              <p className="text-sm text-[#6B7280]">{openChallenges.length ? t("memberDash.openToJoin", { count: openChallenges.length }) : t("memberDash.noActiveChallenges")}</p>
              {openChallenges[0] && <Link href={`/challenges/${openChallenges[0].id}`} className="inline-flex items-center gap-2 mt-4 px-5 py-2.5 rounded-full bg-[#F5C518] text-[#1B2E6B] text-sm font-bold"><Trophy size={15} /> {openChallenges[0].title}</Link>}
            </div>
          ) : (
            <div className="space-y-3">
              {myChallenges.slice(0, 3).map((c) => {
                const t = challengeTotals(c, cProgress.find((p) => p.challengeId === c.id));
                return (
                  <Link key={c.id} href={`/challenges/${c.id}`} className="block group">
                    <div className="flex justify-between text-sm"><span className="font-medium text-[#111827] truncate group-hover:text-[#1E3A8A]">{c.title}</span><span className="font-semibold text-[#111827]">{t.pct}%</span></div>
                    <div className="h-2 rounded-full bg-[#F3F4F6] mt-1.5 overflow-hidden"><div className={`h-full rounded-full ${t.complete ? "bg-[#F5C518]" : "bg-[#1E3A8A]"}`} style={{ width: `${t.pct}%` }} /></div>
                  </Link>
                );
              })}
            </div>
          )}
        </Card>

        {/* Announcement */}
        <Card title={t("memberDash.latestAnnouncement")} href="/announcements" link={t("memberDash.all")}>
          {announcement ? (
            <Link href={`/announcements/${announcement.id}`} className="block group">
              <p className="flex items-start gap-2 font-semibold text-[#111827] group-hover:text-[#1E3A8A]"><Megaphone size={16} className="text-[#B45309] mt-0.5 flex-shrink-0" /> {announcement.title}</p>
              <p className="text-sm text-[#6B7280] mt-1.5 line-clamp-3">{announcement.body}</p>
              {announcement.eventDate && <p className="text-xs text-[#374151] mt-2">{announcement.eventDate.toDate().toLocaleString(dateLocale(), { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>}
            </Link>
          ) : <p className="text-sm text-[#6B7280]">{t("memberDash.noAnnouncements")}</p>}
        </Card>
      </div>

      <div className="flex justify-center">
        <Link href="/bible-study" className="flex items-center gap-2 text-sm font-semibold text-[#1E3A8A]"><BookOpen size={15} /> {t("memberDash.continueStudy")}</Link>
      </div>
    </div>
  );
}
