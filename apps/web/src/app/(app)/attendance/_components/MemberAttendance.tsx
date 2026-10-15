"use client";
import React, { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where, type Timestamp } from "firebase/firestore";
import { CalendarDays, CheckCircle2, MapPin, ScanLine, TrendingDown, TrendingUp, X, XCircle, Clock3 } from "lucide-react";
import {
  db, useAuth, attendanceSummary, checkIn, parseCheckInQR,
  type Announcement, type Attendance, type CheckIn,
} from "@/lib/firebase";
import { QrScanner } from "@/components/QrScanner";
import { Pagination } from "@/components/ui/Pagination";
import { useToast } from "@/components/ui/Toast";
import { useTranslation } from "@nablis/i18n";
import { dateLocale } from "@/lib/locale";

const GOAL = 90;
const PAGE = 10;

function when(ts?: Timestamp | null) {
  const d = ts?.toDate?.();
  if (!d) return "—";
  return `${d.toLocaleDateString(dateLocale(), { month: "short", day: "numeric", year: "numeric" })} · ${d.toLocaleTimeString(dateLocale(), { hour: "numeric", minute: "2-digit" })}`;
}

function Ring({ pct }: { pct: number | null }) {
  const r = 42;
  const circ = 2 * Math.PI * r;
  const value = pct ?? 0;
  return (
    <svg viewBox="0 0 100 100" className="w-32 h-32 flex-shrink-0" role="img" aria-label={pct === null ? "No attendance yet" : `${pct}% attendance`}>
      <circle cx="50" cy="50" r={r} fill="none" stroke="#F3F4F6" strokeWidth="9" />
      <circle cx="50" cy="50" r={r} fill="none" stroke="#F5C518" strokeWidth="9" strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={circ - (Math.min(value, 100) / 100) * circ}
        transform="rotate(-90 50 50)" style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.22,1,0.36,1)" }} />
      <text x="50" y="57" textAnchor="middle" fontSize="22" fontWeight="800" fill="#111827">{pct === null ? "—" : `${pct}%`}</text>
    </svg>
  );
}

export function MemberAttendance() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const toast = useToast();
  const [sessions, setSessions] = useState<Attendance[]>([]);
  const [mine, setMine] = useState<CheckIn[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!user) return;
    const u1 = onSnapshot(collection(db, "attendance"), (snap) => {
      setSessions(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Attendance)));
      setLoading(false);
    }, () => setLoading(false));
    const u2 = onSnapshot(query(collection(db, "checkIns"), where("userId", "==", user.id)), (snap) => {
      setMine(snap.docs.map((d) => ({ id: d.id, ...d.data() } as CheckIn)));
    }, () => {});
    const u3 = onSnapshot(collection(db, "announcements"), (snap) => {
      setAnnouncements(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Announcement)));
    }, () => {});
    return () => { u1(); u2(); u3(); };
  }, [user]);

  const checkedIn = useMemo(() => new Set(mine.map((c) => c.sessionId)), [mine]);
  const checkInAt = useMemo(() => new Map(mine.map((c) => [c.sessionId, c.checkedInAt])), [mine]);

  const { summary, change } = useMemo(() => {
    if (!user) return { summary: null, change: null };
    const now = attendanceSummary(sessions, user.id, checkedIn, user.createdAt);
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
    const before = attendanceSummary(sessions, user.id, checkedIn, user.createdAt, monthStart);
    return {
      summary: now,
      change: now.percent !== null && before.percent !== null ? now.percent - before.percent : null,
    };
  }, [sessions, checkedIn, user]);

  // History: every gathering since joining that has happened (or that they attended).
  const history = useMemo(() => {
    if (!user) return [];
    const since = (user.createdAt?.toMillis?.() ?? 0) - 24 * 3600 * 1000;
    return sessions
      .filter((s) => {
        const at = (s.date ?? s.createdAt)?.toMillis?.() ?? 0;
        const went = checkedIn.has(s.id) || s.attendees?.some((a) => a.userId === user.id);
        if (went) return true;
        return s.status !== "upcoming" && at <= Date.now() && at >= since;
      })
      .sort((a, b) => ((b.date ?? b.createdAt)?.toMillis?.() ?? 0) - ((a.date ?? a.createdAt)?.toMillis?.() ?? 0));
  }, [sessions, checkedIn, user]);

  // Next gathering: the soonest future announcement date or session.
  const next = useMemo(() => {
    const now = Date.now();
    const fromAnnouncements = announcements
      .filter((a) => (a.eventDate?.toMillis?.() ?? 0) > now)
      .map((a) => ({ title: a.title, at: a.eventDate!.toDate(), location: a.location || "" }));
    const fromSessions = sessions
      .filter((s) => (s.date?.toMillis?.() ?? 0) > now && !announcements.some((a) => a.id === s.id))
      .map((s) => ({ title: s.meetingTitle, at: s.date.toDate(), location: "" }));
    return [...fromAnnouncements, ...fromSessions].sort((a, b) => a.at.getTime() - b.at.getTime())[0] ?? null;
  }, [announcements, sessions]);

  const openNow = sessions.filter((s) => s.status === "active" && !checkedIn.has(s.id));

  async function handleScan(value: string) {
    if (!user || busy) return;
    const parsed = parseCheckInQR(value);
    if (!parsed) {
      toast({ message: value.startsWith("nablis-member") ? t("att.isPass") : t("att.notCode"), type: "error" });
      return;
    }
    await submit(parsed.sessionId, parsed.code);
  }

  async function submit(sessionId: string, value: string) {
    if (!user) return;
    setBusy(true);
    const session = sessions.find((s) => s.id === sessionId);
    const result = await checkIn(sessionId, value, user);
    setBusy(false);
    if (result === "invalid") {
      toast({ message: t("att.invalid"), type: "error" });
      return;
    }
    setScanning(false);
    setCode("");
    toast({ message: result === "already" ? t("att.already", { title: session?.meetingTitle ?? "" }) : t("att.welcome", { title: session?.meetingTitle ?? "" }) });
  }

  // Typed code: try each open session (codes are unique per session).
  async function submitCode() {
    const c = code.trim().toUpperCase();
    if (!c || !openNow.length) return;
    setBusy(true);
    for (const s of openNow) {
      const r = await checkIn(s.id, c, user!);
      if (r !== "invalid") {
        setBusy(false);
        setCode("");
        setScanning(false);
        toast({ message: t("att.welcome", { title: s.meetingTitle }) });
        return;
      }
    }
    setBusy(false);
    toast({ message: t("att.noMatch"), type: "error" });
  }

  if (!user) return null;
  const pct = summary?.percent ?? null;
  const headline = pct === null ? t("att.hWelcome") : pct >= GOAL ? t("study.keepItUp") : pct >= 70 ? t("att.hWell") : t("att.hEvery");
  const firstName = (user.displayName || "").split(" ")[0] || "there";

  return (
    <div className="space-y-8">
      <div>
        <h1>{t("greeting.hello", { name: firstName })}</h1>
        <p>{t("att.record")}</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 stagger">
        <div className="bg-white rounded-3xl p-7 shadow-sm">
          <p className="text-lg font-semibold text-[#111827]">{t("att.percentage")}</p>
          <div className="flex items-center gap-6 mt-5">
            <Ring pct={pct} />
            <div>
              <p className="font-semibold text-[#111827]">{headline}</p>
              <p className="text-sm text-[#6B7280] mt-1">{t("att.goal", { goal: GOAL })}</p>
              {summary && summary.total > 0 && <p className="text-xs text-[#6B7280] mt-1">{t("memberDash.gatheringsOf", { attended: summary.attended, total: summary.total })}</p>}
              {change !== null && change !== 0 && (
                <p className={`flex items-center gap-1 text-xs font-semibold mt-2 ${change > 0 ? "text-[#059669]" : "text-[#DC2626]"}`}>
                  {change > 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />} {t("att.fromLastMonth", { change: `${change > 0 ? "+" : ""}${change}` })}
                </p>
              )}
              {pct === null && <p className="text-xs text-[#6B7280] mt-2">{t("att.rateLater")}</p>}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-7 shadow-sm">
          <p className="text-lg font-semibold text-[#111827]">{t("att.nextMeeting")}</p>
          {next ? (
            <div className="flex items-start gap-4 mt-5">
              <span className="w-14 h-14 rounded-2xl bg-[#FEF9C3] text-[#EAB308] flex items-center justify-center flex-shrink-0"><CalendarDays size={26} /></span>
              <div>
                <p className="font-semibold text-[#111827]">{next.title}</p>
                <p className="text-sm text-[#374151] mt-0.5">{next.at.toLocaleDateString(dateLocale(), { weekday: "long", month: "short", day: "numeric" })}</p>
                <p className="flex items-center gap-1 text-sm text-[#6B7280] mt-0.5"><Clock3 size={13} /> {next.at.toLocaleTimeString(dateLocale(), { hour: "numeric", minute: "2-digit" })}</p>
                {next.location && <p className="flex items-center gap-1 text-sm text-[#6B7280] mt-0.5"><MapPin size={13} /> {next.location}</p>}
              </div>
            </div>
          ) : (
            <p className="text-sm text-[#6B7280] mt-5">{t("att.noMeetings")}</p>
          )}
        </div>
      </div>

      <div>
        <button onClick={() => setScanning(true)}
          className="w-full flex items-center justify-center gap-3 py-5 rounded-2xl bg-[#1E3A8A] text-white text-lg font-bold shadow-[0_14px_30px_-16px_rgba(30,58,138,0.9)] hover:bg-[#1B2E6B]">
          <ScanLine size={22} /> {t("att.scan")}
          {openNow.length > 0 && <span className="w-2.5 h-2.5 rounded-full bg-[#4ADE80] animate-pulse" />}
        </button>
      </div>

      <div>
        <h2 className="font-display text-2xl font-bold text-[#111827] mb-4">{t("att.history")}</h2>
        <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="py-14"><div className="w-7 h-7 border-2 border-[#1B2E6B] border-t-transparent rounded-full animate-spin mx-auto" /></div>
          ) : history.length === 0 ? (
            <p className="py-14 text-center text-sm text-[#6B7280]">{t("att.noHistory")}</p>
          ) : (
            <>
              <div className="divide-y divide-[#F3F4F6] stagger">
                {history.slice((page - 1) * PAGE, page * PAGE).map((s) => {
                  const went = checkedIn.has(s.id) || s.attendees?.some((a) => a.userId === user.id);
                  const at = checkInAt.get(s.id);
                  return (
                    <div key={s.id} className="flex items-center justify-between gap-4 px-6 py-4 hover:bg-[#F9FAFB] transition-colors">
                      <div className="min-w-0">
                        <p className="font-semibold text-[#111827] truncate">{s.meetingTitle}</p>
                        <p className="text-sm text-[#6B7280]">{when(s.date ?? s.createdAt)}</p>
                      </div>
                      {went ? (
                        <span title={at ? t("att.checkedInWhen", { when: when(at) }) : undefined} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#DCFCE7] text-[#16A34A] text-sm font-semibold flex-shrink-0">
                          <CheckCircle2 size={15} /> {t("att.attended")}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FEE2E2] text-[#DC2626] text-sm font-semibold flex-shrink-0">
                          <XCircle size={15} /> {t("att.absent")}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="px-6 py-4 bg-[#F9FAFB] border-t border-[#F3F4F6]">
                <Pagination page={page} pageSize={PAGE} total={history.length} onPage={setPage} />
              </div>
            </>
          )}
        </div>
      </div>

      {scanning && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => !busy && setScanning(false)}>
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="text-lg font-semibold text-[#111827]">{t("att.scanTitle")}</p>
              <button onClick={() => setScanning(false)} aria-label={t("common.close")} className="p-1.5 rounded-lg text-[#6B7280] hover:bg-[#F3F4F6]"><X size={18} /></button>
            </div>
            <p className="text-sm text-[#6B7280] mt-1">{t("att.scanHint")}</p>
            <div className="mt-4 rounded-2xl overflow-hidden bg-black aspect-square">
              <QrScanner onScan={handleScan} paused={busy} />
            </div>
            <div className="mt-5">
              <p className="text-xs font-semibold text-[#6B7280] mb-2">{t("att.typeCode")}</p>
              <div className="flex gap-2">
                <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === "Enter" && submitCode()}
                  maxLength={8} placeholder={t("att.code")} disabled={!openNow.length}
                  className="flex-1 px-4 py-3 rounded-xl border border-[#E5E7EB] font-mono tracking-[0.3em] uppercase text-sm focus:outline-none focus:border-[#1E3A8A] disabled:bg-[#F9FAFB]" />
                <button onClick={submitCode} disabled={busy || !code.trim() || !openNow.length}
                  className="px-5 py-3 rounded-xl bg-[#1E3A8A] text-white text-sm font-semibold disabled:opacity-50">{busy ? t("att.checking") : t("ann.tabCheckin")}</button>
              </div>
              {!openNow.length && <p className="text-xs text-[#9CA3AF] mt-2">{t("att.noneOpen")}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
