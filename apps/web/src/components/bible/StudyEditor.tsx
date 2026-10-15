"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  addDoc, collection, doc, getDoc, getDocs, query, serverTimestamp, Timestamp, updateDoc, where,
} from "firebase/firestore";
import {
  ChevronRight, Bold, Italic, Underline, Strikethrough, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Image as ImageIcon, Link2, List, Smile, Plus, X, Trash2, CalendarPlus, Paperclip, ImagePlus, Circle, CheckCircle2,
} from "lucide-react";
import {
  db, useAuth, notify, STUDY_THEMES, STUDY_FONTS, DEFAULT_STUDY_THEME,
  type BibleStudyDoc, type RoutineItem, type StudyTheme, type StudyThemeColor, type StudyMaterial, type User,
} from "@/lib/firebase";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { sanitizeHtml } from "@/lib/sanitize";
import { useToast } from "@/components/ui/Toast";
import { SelectionToolbar } from "./SelectionToolbar";
import { useTranslation } from "@nablis/i18n";
import { dateLocale } from "@/lib/locale";

const EMOJIS = ["🙏", "✝️", "📖", "🕊️", "❤️", "✨", "🕯️", "⛪", "🌿", "☀️", "🌙", "⭐", "👉", "✅", "💡", "🔥"];

interface SectionDraft { key: string; heading: string; html: string }
interface SessionDraft { key: string; title: string; when: string }
type Member = Pick<User, "id" | "displayName" | "email" | "photoURL">;

const uid = () => Math.random().toString(36).slice(2);
function toLocalInput(ts?: Timestamp | null) {
  const d = ts?.toDate?.();
  if (!d) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// contentEditable block whose HTML is only set once (so typing never jumps the cursor).
function Editable({ initial, onFocus, register, placeholder, style }: {
  initial: string;
  onFocus: (el: HTMLDivElement) => void;
  register: (el: HTMLDivElement | null) => void;
  placeholder: string;
  style: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => { if (ref.current) ref.current.innerHTML = initial; }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div
      ref={(el) => { ref.current = el; register(el); }}
      contentEditable
      suppressContentEditableWarning
      data-placeholder={placeholder}
      onFocus={(e) => onFocus(e.currentTarget)}
      className="study-content min-h-[110px] rounded-lg border border-[#E5E7EB] bg-white/70 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#1B2E6B]/15 empty:before:content-[attr(data-placeholder)] empty:before:text-[#9CA3AF]"
      style={style}
    />
  );
}

export function StudyEditor({ studyId }: { studyId?: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const toast = useToast();
  const [loaded, setLoaded]     = useState(!studyId);
  const [original, setOriginal] = useState<BibleStudyDoc | null>(null);
  const [book, setBook]         = useState("");
  const [title, setTitle]       = useState("");
  const [summary, setSummary]   = useState("");
  const [sections, setSections] = useState<SectionDraft[]>([{ key: uid(), heading: "Introduction", html: "" }]);
  const [routine, setRoutine]   = useState<(RoutineItem & { key: string })[]>([]);
  const [sessions, setSessions] = useState<SessionDraft[]>([]);
  const [startDate, setStartDate] = useState("");
  const [completed, setCompleted] = useState(false);
  const [cover, setCover]       = useState<string | null>(null);
  const [materials, setMaterials] = useState<StudyMaterial[]>([]);
  const [students, setStudents] = useState<string[]>([]);
  const [theme, setTheme]       = useState<StudyTheme>(DEFAULT_STUDY_THEME);
  const [members, setMembers]   = useState<Member[]>([]);
  const [studentQuery, setStudentQuery] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl]   = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const editors   = useRef<Record<string, HTMLDivElement | null>>({});
  const activeEl  = useRef<HTMLDivElement | null>(null);
  const savedRange = useRef<Range | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);
  const fileInput  = useRef<HTMLInputElement>(null);

  // Load the study when editing.
  useEffect(() => {
    if (!studyId) return;
    getDoc(doc(db, "bibleStudies", studyId)).then((s) => {
      if (!s.exists()) { setLoaded(true); return; }
      const d = { id: s.id, ...s.data() } as BibleStudyDoc;
      setOriginal(d);
      setBook(d.book ?? "");
      setTitle(d.title ?? "");
      setSummary(d.description ?? "");
      setSections(d.sections?.length ? d.sections.map((x) => ({ ...x, key: uid() })) : [{ key: uid(), heading: "Introduction", html: d.description ?? "" }]);
      setRoutine((d.routine ?? []).map((r) => ({ ...r, key: uid() })));
      setSessions((d.sessions ?? []).map((x) => ({ key: uid(), title: x.title, when: toLocalInput(x.date) })));
      setStartDate(toLocalInput(d.startDate));
      setCompleted(d.status === "completed");
      setCover(d.imageURL ?? null);
      setMaterials((d.materials ?? []).map((m) => (typeof m === "string" ? { url: m } : m)));
      setStudents(d.members ?? []);
      setTheme({ ...DEFAULT_STUDY_THEME, ...(d.theme ?? {}) });
      setLoaded(true);
    });
  }, [studyId]);

  useEffect(() => {
    getDocs(query(collection(db, "users"), where("status", "==", "active")))
      .then((snap) => setMembers(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Member))));
  }, []);

  const contentStyle: React.CSSProperties = {
    fontFamily: `"${theme.font}", var(--font-inter), system-ui, sans-serif`,
    fontSize: theme.fontSize,
    lineHeight: theme.lineHeight,
  };

  // ── Rich-text helpers (act on the last focused section) ─────────────────────
  function rememberSelection() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount && activeEl.current?.contains(sel.anchorNode)) savedRange.current = sel.getRangeAt(0).cloneRange();
  }
  function restoreSelection() {
    const el = activeEl.current ?? editors.current[sections[0]?.key];
    if (!el) return false;
    el.focus();
    const sel = window.getSelection();
    if (savedRange.current && sel) { sel.removeAllRanges(); sel.addRange(savedRange.current); }
    return true;
  }
  function exec(cmd: string, value?: string) {
    if (!restoreSelection()) return;
    document.execCommand("styleWithCSS", false, "true");
    document.execCommand(cmd, false, value);
    rememberSelection();
  }

  async function insertImage(file?: File) {
    if (!file) return;
    setUploading("image");
    try {
      const url = await uploadToCloudinary(file, "nablis/bible-studies");
      exec("insertImage", url);
    } catch { setError("Image upload failed."); }
    finally { setUploading(null); }
  }

  async function uploadCover(file?: File) {
    if (!file) return;
    setUploading("cover");
    try { setCover(await uploadToCloudinary(file, "nablis/bible-studies")); }
    catch { setError("Cover upload failed."); }
    finally { setUploading(null); }
  }

  async function uploadMaterials(files: FileList | null) {
    if (!files?.length) return;
    setUploading("files");
    try {
      for (const f of Array.from(files)) {
        const url = await uploadToCloudinary(f, "nablis/bible-studies/materials");
        setMaterials((m) => [...m, { title: f.name, url, type: f.type.includes("pdf") ? "pdf" : f.type.split("/")[0] }]);
      }
    } catch { setError("File upload failed."); }
    finally { setUploading(null); }
  }

  const candidates = useMemo(() => {
    const q = studentQuery.trim().toLowerCase();
    return members
      .filter((m) => !students.includes(m.id))
      .filter((m) => !q || (m.displayName || "").toLowerCase().includes(q) || (m.email || "").toLowerCase().includes(q))
      .slice(0, 8);
  }, [members, students, studentQuery]);

  async function publish() {
    if (!user) return;
    if (!title.trim()) { setError(t("editor.needTopic")); return; }
    setSaving(true);
    setError(null);
    try {
      const sectionData = sections.map((s) => {
        const el = editors.current[s.key];
        el?.querySelectorAll("a").forEach((a) => { a.setAttribute("target", "_blank"); a.setAttribute("rel", "noopener noreferrer"); });
        return { heading: s.heading.trim(), html: sanitizeHtml(el?.innerHTML ?? s.html) };
      }).filter((s) => s.heading || s.html.replace(/<[^>]+>/g, "").trim());
      const plain = (sectionData[0]?.html ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      const start = startDate ? new Date(startDate) : null;
      const payload = {
        book: book.trim().toUpperCase(),
        title: title.trim(),
        description: summary.trim() || plain.slice(0, 200),
        teacherId: original?.teacherId ?? user.id,
        teacherName: original?.teacherName ?? (user.displayName || user.email),
        imageURL: cover,
        startDate: start ? Timestamp.fromDate(start) : null,
        status: completed ? "completed" : start && start > new Date() ? "pending" : "started",
        sections: sectionData,
        routine: routine.filter((r) => r.title.trim()).map(({ title: t, details }) => ({ title: t.trim(), details: (details ?? "").trim() })),
        sessions: sessions.filter((s) => s.title.trim() && s.when).map((s) => ({ title: s.title.trim(), date: Timestamp.fromDate(new Date(s.when)) })),
        materials,
        members: students,
        theme,
        updatedAt: serverTimestamp(),
      };
      let id = studyId;
      if (studyId) await updateDoc(doc(db, "bibleStudies", studyId), payload);
      else id = (await addDoc(collection(db, "bibleStudies"), { ...payload, createdAt: serverTimestamp() })).id;

      const newStudents = students.filter((s) => !(original?.members ?? []).includes(s) && !s.includes("@"));
      if (newStudents.length) {
        await notify(newStudents.map((s) => ({
          userId: s, type: "bible_study", link: `/bible-study/${id}`,
          title: `You've been added to "${payload.title}"`,
          description: `${payload.teacherName} enrolled you in a Bible study.`,
        })));
      }
      toast({ message: studyId ? t("editor.updated") : t("editor.published"), linkLabel: t("editor.view"), onLink: () => router.push(`/bible-study/${id}`) });
      router.push(`/bible-study/${id}`);
    } catch {
      setError(t("editor.saveError"));
      setSaving(false);
    }
  }

  if (!loaded) return <div className="py-16"><div className="w-7 h-7 border-2 border-[#1B2E6B] border-t-transparent rounded-full animate-spin mx-auto" /></div>;

  const tool = "flex items-center justify-center h-10 rounded-lg border border-[#E5E7EB] bg-white text-[#111827] hover:bg-[#EEF1F8]";
  const sectionLabel = "text-[13px] font-bold tracking-[0.15em] text-[#6B7280] mb-3";
  const lastEdited = original?.updatedAt?.toDate?.();

  return (
    <div className="space-y-6">
      <h1>{studyId ? t("study.edit") : t("study.createTitle")}</h1>

      <div className="grid xl:grid-cols-[1fr_290px] gap-4 items-start">
        {/* ── Editor ───────────────────────────────────────────────────────── */}
        <div className="rounded-2xl shadow-sm overflow-hidden" style={{ background: STUDY_THEMES[theme.color].bg }}>
          <div className="flex items-center justify-between gap-3 px-7 py-4 bg-white/90 border-b border-[#E5E7EB]">
            <nav className="flex items-center gap-1.5 text-sm text-[#6B7280] min-w-0">
              <Link href="/bible-study" className="hover:text-[#1B2E6B]">{t("editor.courses")}</Link>
              <ChevronRight size={14} />
              <span className="text-[#111827] truncate">{title || t("editor.newStudy")}</span>
            </nav>
            {user?.photoURL && <img src={user.photoURL} alt="" className="w-8 h-8 rounded-full object-cover" />}
          </div>

          <div ref={contentRef} className="relative px-7 sm:px-11 py-8 space-y-7">
            <SelectionToolbar containerRef={contentRef} onHighlight={() => exec("hiliteColor", "#FDE68A")} />

            <div className="flex items-center gap-3">
              <input value={book} onChange={(e) => setBook(e.target.value)} placeholder={t("editor.book")}
                className="w-44 px-2.5 py-1 rounded-md bg-[#E5E7EB]/80 text-[11px] font-bold tracking-wider text-[#374151] uppercase placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#1B2E6B]/20" />
              <span className="text-xs text-[#6B7280]">{lastEdited ? t("editor.lastEdited", { when: lastEdited.toLocaleString(dateLocale(), { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) }) : t("editor.draft")}</span>
            </div>

            <div>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("editor.topic")}
                className="w-full bg-transparent font-display text-4xl sm:text-5xl font-extrabold text-[#111827] placeholder-[#9CA3AF] focus:outline-none" />
              <div className="w-20 h-1 rounded-full bg-[#1E3A8A] mt-3" />
              <input value={summary} onChange={(e) => setSummary(e.target.value)} placeholder={t("editor.summary")}
                className="w-full bg-transparent mt-4 text-sm text-[#4B5563] placeholder-[#9CA3AF] focus:outline-none" />
            </div>

            {/* Sections */}
            {sections.map((s, i) => (
              <div key={s.key} className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-[#9CA3AF] text-2xl font-light">#</span>
                  <input value={s.heading} onChange={(e) => setSections((xs) => xs.map((x) => x.key === s.key ? { ...x, heading: e.target.value } : x))}
                    placeholder={t("editor.subtopic")} className="flex-1 bg-transparent text-2xl font-semibold text-[#111827] placeholder-[#9CA3AF] focus:outline-none" />
                  {sections.length > 1 && (
                    <button onClick={() => setSections((xs) => xs.filter((x) => x.key !== s.key))} className="p-1.5 text-[#9CA3AF] hover:text-[#DC2626]" aria-label={t("editor.removeSection")}><Trash2 size={15} /></button>
                  )}
                </div>
                <Editable
                  initial={s.html}
                  placeholder={i === 0 ? t("editor.enterStudy") : t("editor.continue")}
                  style={contentStyle}
                  register={(el) => { editors.current[s.key] = el; }}
                  onFocus={(el) => { activeEl.current = el; }}
                />
              </div>
            ))}
            <button onClick={() => setSections((xs) => [...xs, { key: uid(), heading: "", html: "" }])}
              className="flex items-center gap-1.5 text-sm font-semibold text-[#1B2E6B] hover:underline"><Plus size={15} /> {t("editor.addSection")}</button>

            {/* Daily routine */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-[#9CA3AF] text-2xl font-light">#</span>
                <p className="text-2xl font-semibold text-[#111827]">{t("study.dailyRoutine")}</p>
              </div>
              <div className="rounded-xl border border-[#E5E7EB] bg-white/80 p-5 space-y-4">
                {routine.length === 0 && <p className="text-sm text-[#9CA3AF]">{t("editor.routineHint")}</p>}
                {routine.map((r) => (
                  <div key={r.key} className="flex items-start gap-3">
                    <Circle size={20} className="text-[#1E3A8A] mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <input value={r.title} onChange={(e) => setRoutine((xs) => xs.map((x) => x.key === r.key ? { ...x, title: e.target.value } : x))}
                        placeholder={t("editor.routineItem")} className="w-full bg-transparent font-semibold text-[#111827] placeholder-[#9CA3AF] focus:outline-none" />
                      <input value={r.details ?? ""} onChange={(e) => setRoutine((xs) => xs.map((x) => x.key === r.key ? { ...x, details: e.target.value } : x))}
                        placeholder={t("editor.details")} className="w-full bg-transparent text-sm text-[#6B7280] placeholder-[#9CA3AF] focus:outline-none" />
                    </div>
                    <button onClick={() => setRoutine((xs) => xs.filter((x) => x.key !== r.key))} className="p-1 text-[#9CA3AF] hover:text-[#DC2626]" aria-label={t("share.remove")}><X size={15} /></button>
                  </div>
                ))}
                <button onClick={() => setRoutine((xs) => [...xs, { key: uid(), title: "", details: "" }])}
                  className="flex items-center gap-1.5 text-sm font-semibold text-[#1B2E6B] hover:underline"><Plus size={15} /> {t("editor.addRoutine")}</button>
              </div>
            </div>

            {/* Sessions */}
            <div>
              <p className={sectionLabel}>{t("editor.schedule")}</p>
              <div className="space-y-2">
                {sessions.map((s) => (
                  <div key={s.key} className="flex flex-col sm:flex-row gap-2">
                    <input value={s.title} onChange={(e) => setSessions((xs) => xs.map((x) => x.key === s.key ? { ...x, title: e.target.value } : x))}
                      placeholder="e.g. Live lesson, Essay due" className="flex-1 px-3 py-2.5 rounded-lg border border-[#E5E7EB] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2E6B]/15" />
                    <input type="datetime-local" value={s.when} onChange={(e) => setSessions((xs) => xs.map((x) => x.key === s.key ? { ...x, when: e.target.value } : x))}
                      className="px-3 py-2.5 rounded-lg border border-[#E5E7EB] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2E6B]/15" />
                    <button onClick={() => setSessions((xs) => xs.filter((x) => x.key !== s.key))} className="p-2 text-[#9CA3AF] hover:text-[#DC2626]" aria-label={t("share.remove")}><X size={15} /></button>
                  </div>
                ))}
                <button onClick={() => setSessions((xs) => [...xs, { key: uid(), title: "", when: "" }])}
                  className="flex items-center gap-1.5 text-sm font-semibold text-[#1B2E6B] hover:underline"><CalendarPlus size={15} /> {t("editor.addSession")}</button>
              </div>
            </div>

            {/* Materials */}
            <div>
              <p className={sectionLabel}>{t("editor.materials")}</p>
              <input ref={fileInput} type="file" multiple className="hidden" onChange={(e) => { uploadMaterials(e.target.files); e.target.value = ""; }} />
              <div className="flex flex-wrap gap-2">
                {materials.map((m) => (
                  <span key={m.url} className="flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-lg bg-white border border-[#E5E7EB] text-xs text-[#1B2E6B]">
                    <Paperclip size={12} /> {m.title ?? t("editor.file")}
                    <button onClick={() => setMaterials((xs) => xs.filter((x) => x.url !== m.url))} aria-label={t("share.remove")}><X size={12} /></button>
                  </span>
                ))}
                <button onClick={() => fileInput.current?.click()} disabled={uploading === "files"}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 border-dashed border-[#D1D5DB] text-xs font-semibold text-[#1B2E6B] hover:bg-white disabled:opacity-60">
                  <Plus size={12} /> {uploading === "files" ? t("ann.uploading") : t("editor.uploadFiles")}
                </button>
              </div>
            </div>

            {/* Students */}
            <div>
              <p className="text-[13px] font-bold tracking-[0.15em] text-[#1E3A8A] mb-3">{t("editor.addStudents")}</p>
              <div className="relative max-w-lg">
                <input value={studentQuery} onChange={(e) => { setStudentQuery(e.target.value); setPickerOpen(true); }} onFocus={() => setPickerOpen(true)}
                  placeholder={t("editor.searchMembers")} className="w-full px-4 py-3 rounded-lg border border-[#E5E7EB] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2E6B]/15" />
                {pickerOpen && candidates.length > 0 && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setPickerOpen(false)} />
                    <div className="absolute z-20 mt-1 w-full bg-white rounded-xl shadow-xl border border-[#E5E7EB] py-1 max-h-64 overflow-y-auto">
                      {candidates.map((m) => (
                        <button key={m.id} onClick={() => { setStudents((s) => [...s, m.id]); setStudentQuery(""); }}
                          className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-[#EEF1F8]">
                          {m.photoURL ? <img src={m.photoURL} alt="" className="w-7 h-7 rounded-full object-cover" /> : <span className="w-7 h-7 rounded-full bg-[#EEF1F8] text-[#1B2E6B] text-xs font-bold flex items-center justify-center">{(m.displayName || "?")[0]}</span>}
                          <span className="text-sm text-[#111827]">{m.displayName || m.email}</span>
                          <span className="text-xs text-[#9CA3AF] ml-auto">{t("challenge.add")}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
              {students.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  {students.map((sid) => {
                    const m = members.find((x) => x.id === sid);
                    const label = m?.displayName || m?.email || sid;
                    return (
                      <span key={sid} className="flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-full bg-white border border-[#E5E7EB] text-xs text-[#111827]">
                        {m?.photoURL ? <img src={m.photoURL} alt="" className="w-6 h-6 rounded-full object-cover" /> : <span className="w-6 h-6 rounded-full bg-[#EEF1F8] text-[#1B2E6B] font-bold flex items-center justify-center">{label[0]?.toUpperCase()}</span>}
                        {label}
                        <button onClick={() => setStudents((s) => s.filter((x) => x !== sid))} aria-label={`Remove ${label}`}><X size={11} /></button>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Style & publish panel ────────────────────────────────────────── */}
        <aside className="bg-white rounded-2xl shadow-sm p-5 space-y-6 xl:sticky xl:top-24" onMouseDown={rememberSelection}>
          <div>
            <p className={sectionLabel}>{t("editor.theme")}</p>
            <div className="flex justify-between">
              {(Object.keys(STUDY_THEMES) as StudyThemeColor[]).map((k) => (
                <button key={k} onClick={() => setTheme((t) => ({ ...t, color: k }))} className="flex flex-col items-center gap-1.5">
                  <span className={`w-9 h-9 rounded-full border ${theme.color === k ? "ring-2 ring-[#F5C518] ring-offset-2" : "border-[#E5E7EB]"}`} style={{ background: STUDY_THEMES[k].swatch }} />
                  <span className="text-[9px] font-semibold tracking-wider text-[#6B7280] uppercase">{t(`editor.color.${k}`, { defaultValue: STUDY_THEMES[k].label })}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <p className={sectionLabel}>{t("editor.textEditor")}</p>
            <select value={theme.font} onChange={(e) => setTheme((t) => ({ ...t, font: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-lg bg-[#F8FAFC] border border-[#E5E7EB] text-sm">
              {STUDY_FONTS.map((f) => <option key={f}>{f}</option>)}
            </select>
            <div className="grid grid-cols-4 gap-2" onMouseDown={(e) => e.preventDefault()}>
              <button className={tool} onClick={() => exec("bold")} aria-label={t("editor.bold")}><Bold size={16} /></button>
              <button className={tool} onClick={() => exec("italic")} aria-label={t("editor.italic")}><Italic size={16} /></button>
              <button className={tool} onClick={() => exec("underline")} aria-label={t("editor.underline")}><Underline size={16} /></button>
              <button className={tool} onClick={() => exec("strikeThrough")} aria-label={t("editor.strike")}><Strikethrough size={16} /></button>
            </div>
            <div className="grid grid-cols-4 gap-1 p-1 rounded-lg bg-[#F1F4F9]" onMouseDown={(e) => e.preventDefault()}>
              {([["justifyLeft", AlignLeft], ["justifyCenter", AlignCenter], ["justifyRight", AlignRight], ["justifyFull", AlignJustify]] as const).map(([cmd, Icon]) => (
                <button key={cmd} onClick={() => exec(cmd)} className="h-8 rounded-md flex items-center justify-center text-[#374151] hover:bg-white" aria-label={cmd}><Icon size={15} /></button>
              ))}
            </div>
            <label className="block">
              <span className="flex justify-between text-[11px] font-semibold tracking-wider text-[#6B7280]"><span>{t("editor.fontSize")}</span><span className="text-[#111827]">{theme.fontSize}px</span></span>
              <input type="range" min={13} max={22} value={theme.fontSize} onChange={(e) => setTheme((t) => ({ ...t, fontSize: Number(e.target.value) }))} className="w-full accent-[#1E3A8A]" />
            </label>
            <label className="block">
              <span className="flex justify-between text-[11px] font-semibold tracking-wider text-[#6B7280]"><span>{t("editor.lineSpacing")}</span><span className="text-[#111827]">{theme.lineHeight.toFixed(1)}</span></span>
              <input type="range" min={1.2} max={2.2} step={0.1} value={theme.lineHeight} onChange={(e) => setTheme((t) => ({ ...t, lineHeight: Number(e.target.value) }))} className="w-full accent-[#1E3A8A]" />
            </label>
          </div>

          <div>
            <p className={sectionLabel}>{t("editor.others")}</p>
            <input ref={imageInput} type="file" accept="image/*" className="hidden" onChange={(e) => { insertImage(e.target.files?.[0]); e.target.value = ""; }} />
            <div className="grid grid-cols-4 gap-2 relative" onMouseDown={(e) => e.preventDefault()}>
              {([
                ["Image", ImageIcon, () => imageInput.current?.click()],
                ["Link", Link2, () => { setLinkOpen((v) => !v); setEmojiOpen(false); }],
                ["Bullets", List, () => exec("insertUnorderedList")],
                ["Emoji", Smile, () => { setEmojiOpen((v) => !v); setLinkOpen(false); }],
              ] as const).map(([label, Icon, fn]) => (
                <button key={label} onClick={fn} className="flex flex-col items-center gap-1 text-[10px] text-[#6B7280]">
                  <span className="w-10 h-10 rounded-lg bg-[#F1F4F9] flex items-center justify-center text-[#111827] hover:bg-[#E5E9F2]">
                    {label === "Image" && uploading === "image" ? <span className="w-4 h-4 border-2 border-[#1B2E6B] border-t-transparent rounded-full animate-spin" /> : <Icon size={17} />}
                  </span>
                  {t(`editor.tool.${label}`)}
                </button>
              ))}
            </div>
            {linkOpen && (
              <div className="mt-3 flex gap-2 animate-scale-in">
                <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://…" className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-[#E5E7EB] text-sm" />
                <button onMouseDown={(e) => e.preventDefault()} onClick={() => { if (/^https?:\/\//.test(linkUrl)) { exec("createLink", linkUrl); setLinkUrl(""); setLinkOpen(false); } }}
                  className="px-3 rounded-lg bg-[#1B2E6B] text-white text-xs font-semibold">{t("editor.insert")}</button>
              </div>
            )}
            {emojiOpen && (
              <div className="mt-3 grid grid-cols-8 gap-1 animate-scale-in" onMouseDown={(e) => e.preventDefault()}>
                {EMOJIS.map((em) => <button key={em} onClick={() => exec("insertText", em)} className="h-8 rounded-md hover:bg-[#EEF1F8] text-lg">{em}</button>)}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <p className={sectionLabel}>{t("editor.cover")}</p>
            <input ref={coverInput} type="file" accept="image/*" className="hidden" onChange={(e) => { uploadCover(e.target.files?.[0]); e.target.value = ""; }} />
            {cover ? (
              <div className="relative">
                <img src={cover} alt={t("editor.coverAlt")} className="w-full h-28 rounded-xl object-cover" />
                <button onClick={() => setCover(null)} className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center" aria-label={t("share.remove")}><X size={12} /></button>
              </div>
            ) : (
              <button onClick={() => coverInput.current?.click()} disabled={uploading === "cover"}
                className="w-full flex items-center justify-center gap-2 h-24 rounded-xl border-2 border-dashed border-[#D1D5DB] text-sm font-semibold text-[#1B2E6B] hover:bg-[#F8FAFC] disabled:opacity-60">
                <ImagePlus size={16} /> {uploading === "cover" ? t("ann.uploading") : t("editor.addCover")}
              </button>
            )}
            <input type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-[#F8FAFC] border border-[#E5E7EB] text-sm" aria-label={t("study.startDate")} />
            {studyId && (
              <label className="flex items-center gap-2 text-sm text-[#374151]">
                <input type="checkbox" checked={completed} onChange={(e) => setCompleted(e.target.checked)} className="accent-[#1B2E6B]" />
                Mark study as completed
              </label>
            )}
          </div>

          <div className="rounded-xl bg-[#FEF9C3] border border-[#FDE68A] p-4">
            <p className="text-sm font-semibold text-[#1E3A8A]">{studyId ? t("editor.saveStudy") : t("editor.publishStudy")}</p>
            <p className="text-sm text-[#111827] mt-1">{studyId ? t("editor.saveHint") : t("editor.publishHint")}</p>
            {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
            <button onClick={publish} disabled={saving || !!uploading}
              className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[#1E3A8A] text-white text-sm font-semibold hover:bg-[#1B2E6B] disabled:opacity-60">
              <CheckCircle2 size={15} /> {saving ? t("common.saving") : studyId ? t("prefs.save") : t("editor.publishStudy")}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
