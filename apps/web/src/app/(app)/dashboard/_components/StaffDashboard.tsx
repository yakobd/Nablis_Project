"use client";
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { collection, getDocs, onSnapshot, query, Timestamp, where } from "firebase/firestore";
import {
  Users, HandHeart, BookOpen, ClipboardCheck, CalendarDays, ChevronRight, UserPlus, Check, X, TrendingUp, Clock3, Trophy,
} from "lucide-react";
import {
  db, useAuth, attendanceSummary, challengeStatus, challengeTotals, isoToday, planProgress, serviceLabel, formatTime12, toIsoDate,
  type Appointment, type Attendance, type ChallengeDoc, type ChallengeProgress, type EventDoc, type ReadingPlan, type ReadingProgress, type User,
} from "@/lib/firebase";
import { BarChart, type BarDatum } from "@/components/ui/BarChart";
import { useToast } from "@/components/ui/Toast";
import { decideRegistration, MemberAvatar } from "../../settings/members/_components/shared";
import { PageTitle } from "@/components/PageTitle";
import { useTranslation } from "@nablis/i18n";
import i18n from "@nablis/i18n";
import { dateLocale } from "@/lib/locale";

interface Overview {
  members: number;
  newThisMonth: number;
  prayerToday: number | null;
  prayedToday: number;
  prayerWeek: BarDatum[];
  readingAvg: number | null;
  readers: number;
  planTitle: string | null;
  attendanceAvg: number | null;
  gatherings: { id: string; title: string; date: Date | null; count: number; pct: number | null }[];
  events: { id: string; title: string; date: Date; going: number }[];
  eventRate: number | null;
  challenges: { c: ChallengeDoc; joined: number; completed: number }[];
}

const WEEKDAY = (d: Date) => d.toLocaleDateString(dateLocale(), { weekday: "short" });

export function StaffDashboard() {
  const router = useRouter();
  const toast = useToast();
  const { user, role } = useAuth();
  const isSuperAdmin = role === "super_admin";
  const { t } = useTranslation();
  const [o, setO] = useState<Overview | null>(null);
  const [pending, setPending] = useState<User[]>([]);
  const [appts, setAppts] = useState<Appointment[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  // Pending registrations and appointments stay live.
  useEffect(() => onSnapshot(query(collection(db, "users"), where("status", "==", "pending")), (snap) => {
    setPending(snap.docs.map((d) => ({ id: d.id, ...d.data() } as User)).sort((a, b) => (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0)));
  }, () => {}), []);
  useEffect(() => onSnapshot(collection(db, "appointments"), (snap) => {
    setAppts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Appointment)));
  }, () => {}), []);

  useEffect(() => {
    (async () => {
      const weekAgo = new Date(); weekAgo.setHours(0, 0, 0, 0); weekAgo.setDate(weekAgo.getDate() - 6);
      const [usersS, logsS, plansS, sessionsS, checkInsS, eventsS, challengesS, cProgS] = await Promise.all([
        getDocs(query(collection(db, "users"), where("status", "==", "active"))),
        getDocs(query(collection(db, "prayerLogs"), where("prayedAt", ">=", Timestamp.fromDate(weekAgo)))),
        getDocs(query(collection(db, "readingPlans"), where("active", "==", true))),
        getDocs(collection(db, "attendance")),
        getDocs(collection(db, "checkIns")),
        getDocs(collection(db, "events")),
        getDocs(collection(db, "challenges")),
        getDocs(collection(db, "challengeProgress")),
      ].map((p) => p.catch(() => null)));

      const members = (usersS?.docs ?? []).map((d) => ({ id: d.id, ...d.data() } as User)).filter((u) => u.role === "member");
      const memberIds = new Set(members.map((m) => m.id));
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();

      // Prayer: share of members who logged a prayer each day this week.
      const byDay = new Map<string, Set<string>>();
      for (const d of logsS?.docs ?? []) {
        const { userId, prayedAt } = d.data() as { userId: string; prayedAt?: Timestamp };
        if (!memberIds.has(userId) || !prayedAt?.toDate) continue;
        const k = toIsoDate(prayedAt.toDate());
        if (!byDay.has(k)) byDay.set(k, new Set());
        byDay.get(k)!.add(userId);
      }
      const prayerWeek: BarDatum[] = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekAgo); d.setDate(weekAgo.getDate() + i);
        const n = byDay.get(toIsoDate(d))?.size ?? 0;
        return {
          label: i === 6 ? i18n.t("memberDash.today") : WEEKDAY(d),
          value: members.length ? Math.round((n / members.length) * 100) : null,
          detail: i18n.t("staff.ofMembers", { n, total: members.length }),
        };
      });
      const prayedToday = byDay.get(toIsoDate(new Date()))?.size ?? 0;

      // Bible reading: average on-track among members following the active plan.
      let readingAvg: number | null = null;
      let readers = 0;
      let planTitle: string | null = null;
      const planDoc = plansS?.docs[0];
      if (planDoc) {
        const plan = { id: planDoc.id, entries: [], ...planDoc.data() } as unknown as ReadingPlan;
        planTitle = plan.title;
        const progS = await getDocs(query(collection(db, "readingProgress"), where("planId", "==", plan.id))).catch(() => null);
        const rows = (progS?.docs ?? []).map((d) => d.data() as ReadingProgress).filter((p) => memberIds.has(p.userId) && (p.completed ?? []).length);
        readers = rows.length;
        const today = isoToday();
        readingAvg = rows.length ? Math.round(rows.reduce((s, p) => s + planProgress(plan, p.completed ?? [], today).onTrackPct, 0) / rows.length) : null;
      }

      // Attendance: average member rate, and the latest gatherings.
      const sessions = (sessionsS?.docs ?? []).map((d) => ({ id: d.id, ...d.data() } as Attendance));
      const checkIns = (checkInsS?.docs ?? []).map((d) => d.data() as { userId: string; sessionId: string });
      const byUser = new Map<string, Set<string>>();
      const bySession = new Map<string, number>();
      for (const c of checkIns) {
        if (!byUser.has(c.userId)) byUser.set(c.userId, new Set());
        byUser.get(c.userId)!.add(c.sessionId);
        if (memberIds.has(c.userId)) bySession.set(c.sessionId, (bySession.get(c.sessionId) ?? 0) + 1);
      }
      const rates = members.map((m) => attendanceSummary(sessions, m.id, byUser.get(m.id) ?? new Set(), m.createdAt).percent).filter((p): p is number => p !== null);
      const attendanceAvg = rates.length ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length) : null;
      const gatherings = sessions
        .filter((s) => s.status !== "upcoming" && ((s.date ?? s.createdAt)?.toMillis?.() ?? 0) <= Date.now())
        .sort((a, b) => ((b.date ?? b.createdAt)?.toMillis?.() ?? 0) - ((a.date ?? a.createdAt)?.toMillis?.() ?? 0))
        .slice(0, 5)
        .map((s) => {
          const count = bySession.get(s.id) ?? (s.attendees?.length ?? 0);
          return { id: s.id, title: s.meetingTitle, date: (s.date ?? s.createdAt)?.toDate?.() ?? null, count, pct: members.length ? Math.round((count / members.length) * 100) : null };
        });

      // Events: RSVPs for upcoming events, and the share of members going to recent ones.
      const allEvents = (eventsS?.docs ?? []).map((d) => ({ id: d.id, ...d.data() } as EventDoc));
      const upcoming = allEvents.filter((e) => (e.startDate?.toMillis?.() ?? 0) >= Date.now() - 86400000)
        .sort((a, b) => (a.startDate?.toMillis?.() ?? 0) - (b.startDate?.toMillis?.() ?? 0)).slice(0, 4);
      const recent = allEvents.filter((e) => { const t = e.startDate?.toMillis?.() ?? 0; return t < Date.now() && t > Date.now() - 90 * 86400000; });
      const going = async (e: EventDoc) => {
        const s = await getDocs(query(collection(db, "events", e.id, "rsvps"), where("status", "==", "attending"))).catch(() => null);
        return (s?.size ?? 0) || (e.rsvps?.length ?? 0);
      };
      const [upCounts, recentCounts] = await Promise.all([Promise.all(upcoming.map(going)), Promise.all(recent.map(going))]);
      const events = upcoming.map((e, i) => ({ id: e.id, title: e.title, date: e.startDate!.toDate(), going: upCounts[i] }));
      const eventRate = recent.length && members.length
        ? Math.round((recentCounts.reduce((a, b) => a + b, 0) / (recent.length * members.length)) * 100) : null;

      // Challenges currently running.
      const prog = (cProgS?.docs ?? []).map((d) => d.data() as ChallengeProgress);
      const challenges = (challengesS?.docs ?? []).map((d) => ({ id: d.id, ...d.data() } as ChallengeDoc))
        .filter((c) => challengeStatus(c) === "active")
        .map((c) => {
          const ps = prog.filter((p) => p.challengeId === c.id);
          return { c, joined: ps.length, completed: ps.filter((p) => challengeTotals(c, p).complete).length };
        });

      setO({
        members: members.length,
        newThisMonth: members.filter((m) => (m.createdAt?.toMillis?.() ?? 0) >= monthStart).length,
        prayerToday: members.length ? Math.round((prayedToday / members.length) * 100) : null,
        prayedToday, prayerWeek, readingAvg, readers, planTitle, attendanceAvg, gatherings, events, eventRate, challenges,
      });
    })();
  }, []);

  const apptInfo = useMemo(() => {
    const now = Date.now();
    const today = toIsoDate(new Date());
    const live = appts.filter((a) => a.date?.toMillis);
    return {
      pending: live.filter((a) => a.status === "pending").length,
      today: live.filter((a) => a.status === "confirmed" && toIsoDate(a.date.toDate()) === today).length,
      next: live.filter((a) => (a.status === "confirmed" || a.status === "pending") && a.date.toMillis() >= now - 3600000)
        .sort((a, b) => a.date.toMillis() - b.date.toMillis()).slice(0, 4),
    };
  }, [appts]);

  async function decide(m: User, status: "active" | "rejected") {
    if (status === "rejected" && !confirm(`Reject ${m.displayName || m.email}'s registration?`)) return;
    setBusy(m.id);
    try {
      await decideRegistration(m, status);
      toast({
        message: status === "active" ? t("staff.approved") : t("staff.rejected"),
        type: status === "active" ? "success" : "error",
        actionLabel: t("prof.undo"), onAction: () => decideRegistration(m, "pending").catch(() => {}),
      });
    } catch {
      toast({ message: t("staff.decideError"), type: "error" });
    } finally {
      setBusy(null);
    }
  }

  if (!user) return null;
  const firstName = user.displayName?.split(" ")[0] ?? "";
  const hour = new Date().getHours();
  const greeting = t(hour < 12 ? "greeting.morning" : hour < 18 ? "greeting.afternoon" : "greeting.evening");
  const fmtPct = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${v}%`);

  const tiles = [
    { label: t("nav.members"), value: o ? String(o.members) : "…", hint: o ? (o.newThisMonth ? t("staff.joinedMonth", { n: o.newThisMonth }) : t("staff.activeMembers")) : "", Icon: Users, cls: "bg-[#EEF1F8] text-[#1E3A8A]", href: "/settings/members" },
    { label: t("staff.prayer"), value: fmtPct(o?.prayerToday), hint: o ? t("staff.prayedToday", { n: o.prayedToday }) : "", Icon: HandHeart, cls: "bg-[#FEF3C7] text-[#B45309]", href: "/daily-prayers" },
    { label: t("staff.reading"), value: fmtPct(o?.readingAvg), hint: o ? (o.planTitle ? t("staff.readers", { n: o.readers }) : t("staff.noPlan")) : "", Icon: BookOpen, cls: "bg-[#DCFCE7] text-[#15803D]", href: "/bible-study/reading-plan" },
    { label: t("nav.attendance"), value: fmtPct(o?.attendanceAvg), hint: t("staff.avgRate"), Icon: ClipboardCheck, cls: "bg-[#F3E8FF] text-[#7E22CE]", href: "/attendance" },
    { label: t("staff.events"), value: fmtPct(o?.eventRate), hint: t("staff.eventsHint"), Icon: CalendarDays, cls: "bg-[#FFE4E6] text-[#BE123C]", href: "/events" },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <PageTitle id="staffDashboard" values={{ greeting: firstName ? `${greeting}, ${firstName}` : greeting }} />
        </div>
        <p className="text-sm text-[#4B5563]">{new Date().toLocaleDateString(dateLocale(), { weekday: "long", month: "long", day: "numeric" })}</p>
      </div>

      {/* KPI tiles */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 stagger">
        {tiles.map((t) => (
          <Link key={t.label} href={t.href} className="group bg-white rounded-2xl p-5 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all">
            <div className="flex items-start justify-between">
              <p className="text-sm font-medium text-[#6B7280]">{t.label}</p>
              <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${t.cls}`}><t.Icon size={17} /></span>
            </div>
            <p className="font-display text-4xl font-bold text-[#111827] mt-2">{t.value}</p>
            <p className="text-xs text-[#6B7280] mt-1 truncate">{t.hint}</p>
          </Link>
        ))}
      </div>

      <div className="grid xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-6">
        {/* Prayer trend */}
        <div className="bg-white rounded-3xl shadow-sm p-6 sm:p-7">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <p className="text-lg font-semibold text-[#111827]">{t("staff.prayer")}</p>
              <p className="text-sm text-[#6B7280]">{t("staff.prayerHint")}</p>
            </div>
            <Link href="/daily-prayers" className="flex items-center gap-1 text-sm font-semibold text-[#1E3A8A]">{t("memberDash.prayers")} <ChevronRight size={15} /></Link>
          </div>
          {o ? <BarChart data={o.prayerWeek} highlightLast caption={t("staff.prayerHint")} />
            : <div className="h-[170px] rounded-xl bg-[#F9FAFB] animate-pulse" />}
        </div>

        {/* Pending registrations */}
        <div className="bg-white rounded-3xl shadow-sm p-6 sm:p-7">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 text-lg font-semibold text-[#111827]"><UserPlus size={18} /> {t("staff.newMembers")}</p>
            <Link href="/settings/members/new" className="flex items-center gap-1 text-sm font-semibold text-[#1E3A8A]">{t("memberDash.all")} <ChevronRight size={15} /></Link>
          </div>
          {pending.length === 0 ? (
            <p className="text-sm text-[#6B7280] mt-6">{t("staff.noPending")}</p>
          ) : (
            <div className="space-y-2 mt-4">
              {pending.slice(0, 4).map((m) => (
                <div key={m.id} className="flex items-center gap-3 rounded-2xl border border-[#F3F4F6] px-3 py-2.5">
                  <MemberAvatar m={m} size={38} />
                  <Link href={`/settings/members/${m.id}`} className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#111827] truncate hover:text-[#1E3A8A]">{m.displayName || m.email}</p>
                    <p className="text-[11px] text-[#9CA3AF] truncate">{[m.cityOfResidence, m.parishChurch].filter(Boolean).join(" · ") || m.email}</p>
                  </Link>
                  {isSuperAdmin && (
                    <div className="flex gap-1.5 flex-shrink-0">
                      <button onClick={() => decide(m, "active")} disabled={busy === m.id} aria-label={t("staff.approve")} className="w-8 h-8 rounded-lg bg-[#1E3A8A] text-white flex items-center justify-center hover:bg-[#1B2E6B] disabled:opacity-50"><Check size={15} /></button>
                      <button onClick={() => decide(m, "rejected")} disabled={busy === m.id} aria-label={t("testimony.reject")} className="w-8 h-8 rounded-lg border border-[#E5E7EB] text-[#6B7280] flex items-center justify-center hover:text-[#DC2626] disabled:opacity-50"><X size={15} /></button>
                    </div>
                  )}
                </div>
              ))}
              {pending.length > 4 && <p className="text-xs text-[#6B7280] pt-1">{t("staff.moreWaiting", { n: pending.length - 4 })}</p>}
            </div>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Appointments */}
        <div className="bg-white rounded-3xl shadow-sm p-6">
          <div className="flex items-center justify-between">
            <p className="text-lg font-semibold text-[#111827]">{t("nav.appointment")}</p>
            <Link href="/appointment" className="flex items-center gap-1 text-sm font-semibold text-[#1E3A8A]">{t("staff.manage")} <ChevronRight size={15} /></Link>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="rounded-xl bg-[#F9FAFB] px-4 py-3"><p className="font-display text-2xl font-bold text-[#111827]">{apptInfo.today}</p><p className="text-xs text-[#6B7280]">{t("time.today")}</p></div>
            <div className="rounded-xl bg-[#FFFBEB] px-4 py-3"><p className="font-display text-2xl font-bold text-[#B45309]">{apptInfo.pending}</p><p className="text-xs text-[#6B7280]">{t("staff.awaiting")}</p></div>
          </div>
          <div className="mt-4 space-y-2">
            {apptInfo.next.length === 0 ? <p className="text-sm text-[#9CA3AF]">{t("staff.nothing")}</p> : apptInfo.next.map((a) => (
              <button key={a.id} onClick={() => router.push("/appointment")} className="w-full flex items-center gap-3 text-left rounded-xl px-2 py-2 hover:bg-[#F9FAFB]">
                <span className={`w-1.5 self-stretch rounded-full ${a.status === "confirmed" ? "bg-[#22C55E]" : "bg-[#F59E0B]"}`} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-[#111827] truncate">{a.memberName || "Member"}</span>
                  <span className="block text-[11px] text-[#6B7280] truncate">{serviceLabel(a.serviceType)}</span>
                </span>
                <span className="text-right text-[11px] text-[#374151] whitespace-nowrap">
                  {a.date.toDate().toLocaleDateString(dateLocale(), { month: "short", day: "numeric" })}<br /><span className="text-[#9CA3AF]">{formatTime12(a.time)}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Attendance */}
        <div className="bg-white rounded-3xl shadow-sm p-6">
          <div className="flex items-center justify-between">
            <p className="text-lg font-semibold text-[#111827]">{t("staff.recent")}</p>
            <Link href="/attendance" className="flex items-center gap-1 text-sm font-semibold text-[#1E3A8A]">{t("nav.attendance")} <ChevronRight size={15} /></Link>
          </div>
          <div className="space-y-3.5 mt-5">
            {!o ? <div className="h-32 rounded-xl bg-[#F9FAFB] animate-pulse" /> : o.gatherings.length === 0 ? (
              <p className="text-sm text-[#9CA3AF]">{t("staff.noGatherings")}</p>
            ) : o.gatherings.map((g) => (
              <div key={g.id}>
                <div className="flex justify-between gap-3 text-sm">
                  <span className="font-medium text-[#111827] truncate">{g.title}</span>
                  <span className="text-[#374151] whitespace-nowrap">{g.count} <span className="text-[#9CA3AF]">· {g.pct ?? 0}%</span></span>
                </div>
                <div className="h-2 rounded-full bg-[#F3F4F6] mt-1.5 overflow-hidden">
                  <div className="h-full rounded-full bg-[#7E22CE]/80 transition-all duration-700" style={{ width: `${Math.min(100, g.pct ?? 0)}%` }} />
                </div>
                {g.date && <p className="text-[10px] text-[#9CA3AF] mt-1">{g.date.toLocaleDateString(dateLocale(), { weekday: "short", month: "short", day: "numeric" })}</p>}
              </div>
            ))}
          </div>
        </div>

        {/* Events & challenges */}
        <div className="bg-white rounded-3xl shadow-sm p-6">
          <div className="flex items-center justify-between">
            <p className="text-lg font-semibold text-[#111827]">{t("staff.comingUp")}</p>
            <Link href="/events" className="flex items-center gap-1 text-sm font-semibold text-[#1E3A8A]">{t("nav.events")} <ChevronRight size={15} /></Link>
          </div>
          <div className="space-y-2 mt-4">
            {!o ? <div className="h-24 rounded-xl bg-[#F9FAFB] animate-pulse" /> : o.events.length === 0 ? (
              <p className="text-sm text-[#9CA3AF]">{t("events.noUpcoming")}</p>
            ) : o.events.map((e) => (
              <div key={e.id} className="flex items-center gap-3 rounded-xl px-2 py-2">
                <span className="w-11 h-11 rounded-xl bg-[#FFE4E6] text-[#BE123C] flex flex-col items-center justify-center leading-none flex-shrink-0">
                  <span className="text-[9px] font-bold uppercase">{e.date.toLocaleDateString(dateLocale(), { month: "short" })}</span>
                  <span className="text-base font-bold">{e.date.getDate()}</span>
                </span>
                <span className="min-w-0 flex-1 text-sm font-medium text-[#111827] truncate">{e.title}</span>
                <span className="flex items-center gap-1 text-xs text-[#374151] whitespace-nowrap"><TrendingUp size={12} /> {t("staff.going", { n: e.going })}</span>
              </div>
            ))}
          </div>
          {o && o.challenges.length > 0 && (
            <div className="border-t border-[#F3F4F6] mt-4 pt-4 space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF]">{t("staff.activeChallenges")}</p>
              {o.challenges.slice(0, 3).map(({ c, joined, completed }) => (
                <Link key={c.id} href={`/challenges/${c.id}`} className="flex items-center justify-between gap-3 text-sm hover:text-[#1E3A8A]">
                  <span className="flex items-center gap-2 truncate"><Trophy size={14} className="text-[#CA8A04] flex-shrink-0" /> {c.title}</span>
                  <span className="text-xs text-[#6B7280] whitespace-nowrap">{t("staff.challengeStats", { joined, completed })}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {!o && <p className="flex items-center gap-2 text-xs text-[#6B7280]"><Clock3 size={13} /> {t("staff.loading")}</p>}
    </div>
  );
}
