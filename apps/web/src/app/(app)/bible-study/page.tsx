"use client";
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { collection, getDocs, onSnapshot, query, where } from "firebase/firestore";
import {
  FileText, Bell, ClipboardList, Radio, CalendarClock, ChevronDown, BookOpen, X, FileVideo, FileAudio, Plus,
} from "lucide-react";
import {
  db, useAuth, isEnrolled, studyStatus, weeklyProgress, materialLink, toIsoDate,
  type BibleStudyDoc, type StudyProgress, type User,
} from "@/lib/firebase";
import { MiniCalendar, type DayMark } from "@/components/ui/MiniCalendar";
import { PageTitle } from "@/components/PageTitle";
import { useTranslation } from "@nablis/i18n";
import i18n from "@nablis/i18n";
import { dateLocale } from "@/lib/locale";

const STATUS_PILL: Record<string, string> = {
  started: "bg-[#DCFCE7] text-[#15803D]",
  pending: "bg-[#FEF9C3] text-[#A16207]",
  completed: "bg-[#F3F4F6] text-[#6B7280]",
};
const REMINDER_ICONS = [
  { Icon: ClipboardList, cls: "bg-[#FFEDD5] text-[#EA580C]" },
  { Icon: Radio,         cls: "bg-[#DBEAFE] text-[#1D4ED8]" },
  { Icon: CalendarClock, cls: "bg-[#F3E8FF] text-[#9333EA]" },
];

function MaterialIcon({ url }: { url: string }) {
  if (/\.(mp4|mov|webm)/i.test(url)) return <FileVideo size={20} />;
  if (/\.(mp3|wav|m4a)/i.test(url)) return <FileAudio size={20} />;
  return <FileText size={20} />;
}

function relDay(d: Date) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const that = new Date(d); that.setHours(0, 0, 0, 0);
  const diff = Math.round((that.getTime() - today.getTime()) / 86400000);
  const time = d.toLocaleTimeString(dateLocale(), { hour: "2-digit", minute: "2-digit" });
  if (diff === 0) return i18n.t("study.todayAt", { time });
  if (diff === 1) return i18n.t("study.tomorrowAt", { time });
  return `${d.toLocaleDateString(dateLocale(), { day: "numeric", month: "short" })}, ${time}`;
}

export default function BibleStudyPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, role } = useAuth();
  const isStaff = role === "admin" || role === "super_admin";
  const [studies, setStudies]   = useState<BibleStudyDoc[]>([]);
  const [loading, setLoading]   = useState(true);
  const [progress, setProgress] = useState<Record<string, StudyProgress>>({});
  const [photos, setPhotos]     = useState<Record<string, Pick<User, "displayName" | "photoURL">>>({});
  const [showAll, setShowAll]   = useState(false);
  const [progressOpen, setProgressOpen] = useState(false);

  useEffect(() => onSnapshot(collection(db, "bibleStudies"), (snap) => {
    setStudies(snap.docs.map((d) => ({ id: d.id, ...d.data() } as BibleStudyDoc))
      .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0)));
    setLoading(false);
  }, () => setLoading(false)), []);

  useEffect(() => {
    if (!user || isStaff) return;
    return onSnapshot(query(collection(db, "studyProgress"), where("userId", "==", user.id)), (snap) => {
      setProgress(Object.fromEntries(snap.docs.map((d) => [d.data().studyId as string, d.data() as StudyProgress])));
    });
  }, [user, isStaff]);

  // Staff can see members' photos for the avatar stacks.
  useEffect(() => {
    if (!isStaff) return;
    getDocs(query(collection(db, "users"), where("status", "==", "active"))).then((snap) => {
      setPhotos(Object.fromEntries(snap.docs.map((d) => [d.id, { displayName: d.data().displayName, photoURL: d.data().photoURL ?? null }])));
    });
  }, [isStaff]);

  const mine = useMemo(() => (user ? studies.filter((s) => isEnrolled(s, user)) : []), [studies, user]);
  const relevant = isStaff ? studies : mine;
  const weekly = weeklyProgress(mine, progress);
  const firstName = user?.displayName?.split(" ")[0] ?? "friend";

  const sessions = useMemo(() => relevant.flatMap((s) => [
    ...(s.sessions ?? []).map((x) => ({ study: s, title: x.title, date: x.date?.toDate?.() })),
    ...(s.startDate ? [{ study: s, title: `${s.title} begins`, date: s.startDate.toDate() }] : []),
  ]).filter((x): x is { study: BibleStudyDoc; title: string; date: Date } => !!x.date), [relevant]);
  const reminders = sessions.filter((x) => x.date.getTime() > Date.now() - 3600_000).sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, 4);
  const marks: Record<string, DayMark> = Object.fromEntries(sessions.map((x) => [toIsoDate(x.date), "confirmed" as DayMark]));

  const cards = (showAll ? studies : studies.slice(0, 3));
  const lessons = studies.filter((s) => studyStatus(s) !== "completed");

  if (!user) return null;

  return (
    <div className="space-y-7">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <PageTitle id="bibleStudy" />
        </div>
        <Link href="/bible-study/reading-plan"
          className="group self-start lg:self-auto flex items-center gap-3 pl-3 pr-5 py-2.5 rounded-full bg-white shadow-sm hover:shadow-md transition-shadow">
          <span className="w-9 h-9 rounded-full bg-[#F5C518] text-[#1B2E6B] flex items-center justify-center"><BookOpen size={17} /></span>
          <span>
            <span className="block text-sm font-semibold text-[#111827]">{t("study.readingPlan")}</span>
            <span className="block text-[11px] text-[#6B7280]">{isStaff ? t("study.readingPlanStaff") : t("study.readingPlanMember")}</span>
          </span>
        </Link>
      </div>

      <div className="grid xl:grid-cols-[1fr_290px] gap-7 items-start">
        <div className="space-y-8 min-w-0">
          {/* Welcome */}
          <div className="bg-[#F8FAFC] rounded-3xl shadow-sm px-8 py-7 flex items-center gap-6">
            <div className="flex-1">
              <p className="font-display text-3xl font-extrabold text-[#111827]">{t("study.welcome", { name: firstName })}</p>
              <p className="text-[#4B5563] mt-3 max-w-md leading-relaxed">
                {isStaff
                  ? t("study.staffSummary", { count: lessons.length, students: new Set(studies.flatMap((s) => s.members ?? [])).size })
                  : weekly.total
                    ? `${t("study.weeklyDone", { pct: weekly.pct })} ${weekly.pct >= 75 ? t("study.keepItUp") : t("study.youCan")}`
                    : mine.length ? t("study.noRoutine") : t("study.joinPrompt")}
              </p>
              <button onClick={() => setProgressOpen(true)}
                className="mt-5 px-6 py-3 rounded-xl bg-[#111827] text-white font-semibold shadow-[0_10px_24px_-12px_rgba(17,24,39,0.9)] hover:bg-[#1F2937]">
                {t("study.viewProgress")}
              </button>
            </div>
            <div className="hidden sm:flex flex-col items-center justify-center w-28 h-28 rounded-full relative flex-shrink-0">
              <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
                <circle cx="50" cy="50" r="42" fill="none" stroke="#E5E7EB" strokeWidth="9" />
                <circle cx="50" cy="50" r="42" fill="none" stroke="#1E3A8A" strokeWidth="9" strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 42} strokeDashoffset={2 * Math.PI * 42 * (1 - (isStaff ? 1 : weekly.pct / 100))} className="transition-all duration-1000" />
              </svg>
              {isStaff ? <BookOpen size={30} className="text-[#1E3A8A]" /> : <span className="text-2xl font-bold text-[#1E3A8A]">{weekly.pct}%</span>}
            </div>
          </div>

          {/* Study cards */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-semibold text-[#111827]">{t("study.studies")}</h2>
              {studies.length > 3 && <button onClick={() => setShowAll((v) => !v)} className="text-lg text-[#1E3A8A] font-medium hover:underline">{showAll ? t("blogsPage.showLess") : t("study.seeAll")}</button>}
            </div>
            {loading ? (
              <div className="py-12"><div className="w-7 h-7 border-2 border-[#1B2E6B] border-t-transparent rounded-full animate-spin mx-auto" /></div>
            ) : studies.length === 0 ? (
              <div className="bg-white rounded-2xl p-10 text-center text-[#9CA3AF]">{t("study.noStudies")}</div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 stagger">
                {cards.map((s) => {
                  const ids = s.members ?? [];
                  return (
                    <Link key={s.id} href={`/bible-study/${s.id}`}
                      className="relative h-48 rounded-3xl overflow-hidden shadow-md group hover:-translate-y-1 hover:shadow-xl transition-all duration-300">
                      {s.imageURL
                        ? <img src={s.imageURL} alt="" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                        : <div className="absolute inset-0 bg-gradient-to-br from-[#1B2E6B] to-[#7C3AED]" />}
                      <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/10 to-black/55" />
                      <p className="absolute top-5 left-5 right-5 text-white text-xl font-semibold leading-tight line-clamp-2">{s.title}</p>
                      {user && isEnrolled(s, user) && !isStaff && <span className="absolute top-5 right-5 w-2.5 h-2.5 rounded-full bg-[#22C55E] ring-2 ring-white" title={t("study.enrolled")} />}
                      <div className="absolute bottom-4 left-5 right-5 flex items-center justify-between">
                        <div className="flex -space-x-2">
                          {ids.slice(0, 3).map((sid) => (
                            photos[sid]?.photoURL
                              ? <img key={sid} src={photos[sid].photoURL!} alt="" className="w-8 h-8 rounded-full object-cover ring-2 ring-white" />
                              : <span key={sid} className="w-8 h-8 rounded-full bg-[#EEF1F8] ring-2 ring-white text-[11px] font-bold text-[#1B2E6B] flex items-center justify-center">{(photos[sid]?.displayName || "•")[0]}</span>
                          ))}
                          {ids.length > 3 && <span className="w-8 h-8 rounded-full bg-white ring-2 ring-white text-[10px] font-bold text-[#111827] flex items-center justify-center">+{ids.length - 3}</span>}
                        </div>
                        <span className="flex items-center gap-1 text-white text-sm"><FileText size={13} /> {(s.materials ?? []).length} Files</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Current lessons */}
          <div className="bg-white rounded-3xl shadow-sm px-7 py-6">
            <h2 className="text-xl font-semibold text-[#111827] mb-4">{t("study.currentLessons")}</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-[15px]">
                <thead>
                  <tr className="border-b border-[#F3F4F6] text-left text-sm text-[#6B7280]">
                    <th className="py-3 pl-8 font-medium">{t("study.class")}</th><th className="py-3 font-medium">{t("study.teacherName")}</th><th className="py-3 font-medium text-center">{t("nav.members")}</th>
                    <th className="py-3 font-medium">{t("study.startDate")}</th><th className="py-3 font-medium text-center">{t("study.material")}</th><th className="py-3 font-medium">{t("study.status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {lessons.map((s) => {
                    const st = studyStatus(s);
                    const first = s.materials?.[0] ? materialLink(s.materials[0]) : null;
                    return (
                      <tr key={s.id} onClick={() => router.push(`/bible-study/${s.id}`)} className="border-b border-[#F3F4F6] last:border-0 cursor-pointer hover:bg-[#F9FAFB]">
                        <td className="py-4 pl-8 pr-3 font-semibold text-[#111827] max-w-[180px]">{s.title}</td>
                        <td className="py-4 pr-3 text-[#374151]">{s.teacherName}</td>
                        <td className="py-4 text-center text-[#374151]">{(s.members ?? []).length}</td>
                        <td className="py-4 pr-3 text-[#374151] whitespace-nowrap">{s.startDate ? s.startDate.toDate().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"}</td>
                        <td className="py-4 text-center text-[#9CA3AF]">
                          {first ? <a href={first.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex hover:text-[#1B2E6B]" title={first.title}><MaterialIcon url={first.url} /></a> : "—"}
                        </td>
                        <td className="py-4"><span className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${STATUS_PILL[st]}`}>{t(`study.st.${st}`)}</span></td>
                      </tr>
                    );
                  })}
                  {lessons.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-sm text-[#9CA3AF]">{t("study.noLessons")}</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right panel */}
        <aside className="bg-white xl:rounded-none rounded-2xl shadow-sm p-5 space-y-6 xl:sticky xl:top-24">
          <div className="flex items-center gap-3 rounded-2xl bg-[#FEF3C7] px-4 py-3">
            {user.photoURL ? <img src={user.photoURL} alt="" className="w-9 h-9 rounded-full object-cover" /> : <span className="w-9 h-9 rounded-full bg-[#1B2E6B] text-white font-bold flex items-center justify-center">{(user.displayName || "U")[0]}</span>}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-[#111827] truncate">{user.displayName || user.email}</p>
              <p className="text-xs text-[#6B7280]">{isStaff ? t("study.teacher") : t("study.student")}</p>
            </div>
            <ChevronDown size={16} className="text-[#6B7280]" />
          </div>

          <MiniCalendar marks={marks} className="!shadow-none !border-[#EEF1F8]" />

          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="font-semibold text-[#111827]">{t("study.reminders")}</p>
              <Bell size={14} className="text-[#6B7280]" />
            </div>
            {reminders.length === 0 ? <p className="text-xs text-[#9CA3AF]">{t("study.nothingSoon")}</p> : (
              <div className="space-y-3">
                {reminders.map((r, i) => {
                  const { Icon, cls } = REMINDER_ICONS[i % REMINDER_ICONS.length];
                  return (
                    <Link key={`${r.study.id}-${i}`} href={`/bible-study/${r.study.id}`} className="flex items-center gap-3 rounded-xl bg-[#F8FAFC] px-3 py-3 hover:bg-[#EEF1F8]">
                      <span className={`w-10 h-10 rounded-xl flex items-center justify-center ${cls}`}><Icon size={18} /></span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#111827] truncate">{r.title}</p>
                        <p className="text-[11px] text-[#6B7280]">{relDay(r.date)}</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {isStaff && (
            <div className="rounded-3xl bg-gradient-to-br from-[#1E3A8A] to-[#1B2E6B] p-6 text-center text-white shadow-lg">
              <p className="font-semibold">{t("study.createTitle")}</p>
              <p className="text-xs text-white/70 mt-1.5">{t("study.createHint")}</p>
              <Link href="/bible-study/create" className="mt-4 flex items-center justify-center gap-1.5 py-2.5 rounded-full bg-white text-[#1E3A8A] text-xs font-bold tracking-wider hover:bg-[#F5C518]">
                <Plus size={13} /> {t("study.createButton")}
              </Link>
            </div>
          )}
        </aside>
      </div>

      {/* Progress dialog */}
      {progressOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setProgressOpen(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 relative" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setProgressOpen(false)} className="absolute top-4 right-4 text-[#9CA3AF]" aria-label={t("common.close")}><X size={18} /></button>
            <p className="text-xl font-bold text-[#111827]">{isStaff ? t("study.overview") : t("study.progressWeek")}</p>
            <div className="mt-5 space-y-4">
              {(isStaff ? lessons : mine).map((s) => {
                const r = s.routine?.length ?? 0;
                const done = isStaff ? 0 : weeklyProgress([s], progress).done;
                const pct = r ? Math.round((done / r) * 100) : 0;
                return (
                  <Link key={s.id} href={`/bible-study/${s.id}`} className="block">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-[#111827]">{s.title}</span>
                      <span className="text-[#6B7280]">{isStaff ? t("study.studentsCount", { count: (s.members ?? []).length }) : r ? `${done}/${r}` : t("study.noRoutineShort")}</span>
                    </div>
                    {!isStaff && r > 0 && <div className="h-2 rounded-full bg-[#EEF1F8] mt-1.5 overflow-hidden"><div className="h-full rounded-full bg-[#1E3A8A]" style={{ width: `${pct}%` }} /></div>}
                  </Link>
                );
              })}
              {(isStaff ? lessons : mine).length === 0 && <p className="text-sm text-[#9CA3AF]">{isStaff ? t("study.noActive") : t("study.notJoined")}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
