"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  arrayUnion, collection, doc, getDocs, onSnapshot, query, updateDoc, where,
} from "firebase/firestore";
import { ArrowLeft, Pencil, CheckCircle2, Circle, Paperclip, CalendarDays, Users, UserPlus } from "lucide-react";
import {
  db, useAuth, isEnrolled, studyStatus, materialLink, setRoutineCheck, currentWeek, toIsoDate,
  STUDY_THEMES, DEFAULT_STUDY_THEME, type BibleStudyDoc, type StudyProgress, type User,
} from "@/lib/firebase";
import { sanitizeHtml } from "@/lib/sanitize";
import { useToast } from "@/components/ui/Toast";
import { SelectionToolbar } from "@/components/bible/SelectionToolbar";
import { useTranslation } from "@nablis/i18n";
import { dateLocale } from "@/lib/locale";

const STATUS_PILL: Record<string, string> = {
  started: "bg-[#DCFCE7] text-[#15803D]",
  pending: "bg-[#FEF9C3] text-[#A16207]",
  completed: "bg-[#F3F4F6] text-[#6B7280]",
};

export default function StudyPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { user, role } = useAuth();
  const isStaff = role === "admin" || role === "super_admin";
  const toast = useToast();
  const [study, setStudy] = useState<BibleStudyDoc | null>(null);
  const [missing, setMissing] = useState(false);
  const [mine, setMine] = useState<StudyProgress | null>(null);
  const [allProgress, setAllProgress] = useState<StudyProgress[]>([]);
  const [people, setPeople] = useState<Record<string, Pick<User, "id" | "displayName" | "photoURL">>>({});
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => onSnapshot(doc(db, "bibleStudies", id), (s) => {
    if (s.exists()) setStudy({ id: s.id, ...s.data() } as BibleStudyDoc); else setMissing(true);
  }), [id]);

  useEffect(() => {
    if (!user) return;
    if (isStaff) {
      const unsub = onSnapshot(query(collection(db, "studyProgress"), where("studyId", "==", id)), (snap) => {
        setAllProgress(snap.docs.map((d) => d.data() as StudyProgress));
      });
      getDocs(query(collection(db, "users"), where("status", "==", "active"))).then((snap) => {
        setPeople(Object.fromEntries(snap.docs.map((d) => [d.id, { id: d.id, ...d.data() } as Pick<User, "id" | "displayName" | "photoURL">])));
      });
      return unsub;
    }
    return onSnapshot(doc(db, "studyProgress", `${id}_${user.id}`), (s) => setMine(s.exists() ? (s.data() as StudyProgress) : null));
  }, [id, user, isStaff]);

  const sections = useMemo(() => (study?.sections ?? []).map((s) => ({ ...s, html: sanitizeHtml(s.html) })), [study]);

  if (missing) return <div className="py-16 text-center text-[#6B7280]">{t("study.missing")}</div>;
  if (!study || !user) return <div className="py-16"><div className="w-7 h-7 border-2 border-[#1B2E6B] border-t-transparent rounded-full animate-spin mx-auto" /></div>;

  const theme = { ...DEFAULT_STUDY_THEME, ...(study.theme ?? {}) };
  const enrolled = isEnrolled(study, user);
  const status = studyStatus(study);
  const today = toIsoDate(new Date());
  const todayChecks = new Set(mine?.checks?.[today] ?? []);
  const week = new Set(currentWeek());
  const routine = study.routine ?? [];
  const contentStyle: React.CSSProperties = {
    fontFamily: `"${theme.font}", var(--font-inter), system-ui, sans-serif`,
    fontSize: theme.fontSize,
    lineHeight: theme.lineHeight,
  };

  function weekDone(p?: StudyProgress | null) {
    const ticked = new Set<number>();
    Object.entries(p?.checks ?? {}).forEach(([d, idx]) => { if (week.has(d)) idx.forEach((i) => ticked.add(i)); });
    return ticked.size;
  }

  async function join() {
    if (!user) return;
    await updateDoc(doc(db, "bibleStudies", id), { members: arrayUnion(user.id) });
    toast({ message: t("study.joined", { title: study!.title }) });
  }

  async function toggle(i: number) {
    if (!user) return;
    try { await setRoutineCheck(id, user.id, i, !todayChecks.has(i)); }
    catch { toast({ type: "error", message: t("prayersPage.saveError") }); }
  }

  const upcoming = (study.sessions ?? [])
    .filter((s) => s.date?.toDate?.() && s.date.toDate().getTime() > Date.now() - 3600_000)
    .sort((a, b) => a.date.toMillis() - b.date.toMillis());

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Link href="/bible-study" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1B2E6B] hover:underline"><ArrowLeft size={15} /> {t("nav.bibleStudy")}</Link>
        {isStaff && (
          <Link href={`/bible-study/${id}/edit`} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1B2E6B] text-white text-sm font-semibold hover:bg-[#162554]"><Pencil size={14} /> {t("study.edit")}</Link>
        )}
      </div>

      <div className="grid xl:grid-cols-[1fr_300px] gap-5 items-start">
        <article className="rounded-2xl shadow-sm overflow-hidden" style={{ background: STUDY_THEMES[theme.color]?.bg ?? "#fff" }}>
          {study.imageURL && <img src={study.imageURL} alt="" className="w-full h-56 object-cover" />}
          <div ref={contentRef} className="relative px-7 sm:px-11 py-9">
            <SelectionToolbar containerRef={contentRef} />
            <div className="flex flex-wrap items-center gap-3">
              {study.book && <span className="px-2.5 py-1 rounded-md bg-[#E5E7EB]/80 text-[11px] font-bold tracking-wider text-[#374151]">{study.book}</span>}
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold capitalize ${STATUS_PILL[status]}`}>{status}</span>
              <span className="text-xs text-[#6B7280]">with {study.teacherName}</span>
            </div>
            <h1 className="!text-[#111827] !text-4xl sm:!text-5xl mt-4">{study.title}</h1>
            <div className="w-20 h-1 rounded-full bg-[#1E3A8A] mt-4" />

            {sections.length === 0 && study.description && (
              <p className="mt-6 text-[#374151]" style={contentStyle}>{study.description}</p>
            )}
            {sections.map((s, i) => (
              <section key={i} className="mt-8">
                {s.heading && <h2 className="flex items-center gap-2 text-2xl font-semibold text-[#111827] mb-3"><span className="text-[#9CA3AF] font-light">#</span>{s.heading}</h2>}
                <div className="study-content text-[#374151]" style={contentStyle} dangerouslySetInnerHTML={{ __html: s.html }} />
              </section>
            ))}

            {routine.length > 0 && (
              <section className="mt-10">
                <h2 className="flex items-center gap-2 text-2xl font-semibold text-[#111827] mb-3"><span className="text-[#9CA3AF] font-light">#</span>{t("study.dailyRoutine")}</h2>
                <div className="rounded-xl border border-[#E5E7EB] bg-white/80 p-5 space-y-4">
                  {routine.map((r, i) => {
                    const done = todayChecks.has(i);
                    const interactive = enrolled && !isStaff;
                    return (
                      <button key={i} disabled={!interactive} onClick={() => toggle(i)}
                        className={`w-full flex items-start gap-3 text-left ${interactive ? "cursor-pointer" : "cursor-default"}`}>
                        {done
                          ? <CheckCircle2 size={22} className="text-[#16A34A] flex-shrink-0 animate-pop" />
                          : <Circle size={22} className="text-[#1E3A8A] flex-shrink-0" />}
                        <span>
                          <span className={`block font-semibold ${done ? "text-[#15803D] line-through decoration-[#86EFAC]" : "text-[#111827]"}`}>{r.title}</span>
                          {r.details && <span className="block text-sm text-[#6B7280]">{r.details}</span>}
                        </span>
                      </button>
                    );
                  })}
                  {enrolled && !isStaff && <p className="text-xs text-[#6B7280] pt-1">{t("study.tickHint", { done: weekDone(mine), total: routine.length })}</p>}
                </div>
              </section>
            )}
          </div>
        </article>

        <aside className="space-y-5 xl:sticky xl:top-24">
          {!isStaff && !enrolled && status !== "completed" && (
            <button onClick={join} className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-[#F5C518] text-[#111827] font-semibold shadow-[0_10px_24px_-12px_rgba(245,197,24,0.9)] hover:bg-[#e6b800]">
              <UserPlus size={18} /> {t("study.join")}
            </button>
          )}

          <div className="bg-white rounded-2xl shadow-sm p-5">
            <p className="flex items-center gap-2 font-semibold text-[#111827] mb-3"><CalendarDays size={16} className="text-[#1B2E6B]" /> {t("study.schedule")}</p>
            {study.startDate && <p className="text-sm text-[#4B5563] mb-2">{t("study.starts", { date: study.startDate.toDate().toLocaleDateString(dateLocale(), { weekday: "short", month: "short", day: "numeric", year: "numeric" }) })}</p>}
            {upcoming.length === 0 ? <p className="text-xs text-[#9CA3AF]">{t("study.noSessions")}</p> : (
              <div className="space-y-2">
                {upcoming.map((s, i) => (
                  <div key={i} className="rounded-lg bg-[#F8FAFC] px-3 py-2">
                    <p className="text-sm font-semibold text-[#111827]">{s.title}</p>
                    <p className="text-xs text-[#6B7280]">{s.date.toDate().toLocaleString(dateLocale(), { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-5">
            <p className="flex items-center gap-2 font-semibold text-[#111827] mb-3"><Paperclip size={16} className="text-[#1B2E6B]" /> {t("study.materials")}</p>
            {(study.materials ?? []).length === 0 ? <p className="text-xs text-[#9CA3AF]">{t("study.noMaterials")}</p> : (
              <div className="space-y-1.5">
                {(study.materials ?? []).map((m, i) => {
                  const { title, url } = materialLink(m);
                  return <a key={i} href={url} target="_blank" rel="noreferrer" className="block text-sm text-[#1B2E6B] font-medium hover:underline truncate">{title}</a>;
                })}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-5">
            <p className="flex items-center gap-2 font-semibold text-[#111827] mb-3"><Users size={16} className="text-[#1B2E6B]" /> {t("study.students", { n: (study.members ?? []).length })}</p>
            {isStaff ? (
              <div className="space-y-2.5">
                {(study.members ?? []).map((sid) => {
                  const p = people[sid];
                  const prog = allProgress.find((x) => x.userId === sid);
                  const pct = routine.length ? Math.round((weekDone(prog) / routine.length) * 100) : 0;
                  return (
                    <div key={sid}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-[#111827] truncate">{p?.displayName || sid}</span>
                        {routine.length > 0 && <span className="text-xs text-[#6B7280]">{t("study.pctWeek", { pct })}</span>}
                      </div>
                      {routine.length > 0 && <div className="h-1.5 rounded-full bg-[#EEF1F8] mt-1 overflow-hidden"><div className="h-full bg-[#1E3A8A] rounded-full transition-all duration-700" style={{ width: `${pct}%` }} /></div>}
                    </div>
                  );
                })}
                {(study.members ?? []).length === 0 && <p className="text-xs text-[#9CA3AF]">{t("study.noStudents")}</p>}
              </div>
            ) : (
              <p className="text-sm text-[#4B5563]">{enrolled ? t("study.youreEnrolled") : t("study.joinToTrack")}</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
