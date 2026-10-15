"use client";
import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  collection, deleteDoc, doc, getDoc, onSnapshot, query, updateDoc, where, type Timestamp,
} from "firebase/firestore";
import {
  ArrowLeft, CalendarDays, MapPin, ClipboardCheck, ScanLine, ListChecks, CheckCircle2, AlertTriangle,
  XCircle, Search, Download, Lock, Unlock, QrCode, Trash2, UserCheck,
} from "lucide-react";
import {
  db, useAuth, parseMemberPass, staffCheckIn, enableAnnouncementAttendance,
  type Announcement, type CheckIn, type StaffCheckInResult, type User,
} from "@/lib/firebase";
import { useToast } from "@/components/ui/Toast";
import { QrScanner } from "@/components/QrScanner";
import { MemberPassModal } from "@/components/MemberPassModal";
import { useTranslation } from "@nablis/i18n";
import { dateLocale } from "@/lib/locale";

function fmtWhen(ts?: Timestamp | null) {
  const d = ts?.toDate?.();
  return d ? d.toLocaleString(dateLocale(), { weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";
}
function fmtTime(ts?: Timestamp | null) {
  const d = ts?.toDate?.();
  return d ? d.toLocaleTimeString(dateLocale(), { hour: "numeric", minute: "2-digit" }) : "";
}

// Short confirmation beep (success: higher, problem: lower).
function beep(ok: boolean) {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = ok ? 880 : 220;
    gain.gain.value = 0.15;
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + (ok ? 0.12 : 0.3));
    osc.onended = () => ctx.close();
  } catch { /* audio not available */ }
}

type Member = Pick<User, "id" | "displayName" | "email" | "photoURL" | "role">;
type ScanFeedback = StaffCheckInResult & { at: number };

const FEEDBACK: Record<StaffCheckInResult["status"], { title: string; cls: string; Icon: typeof CheckCircle2 }> = {
  ok:       { title: "Checked in",              cls: "bg-[#DCFCE7] border-[#86EFAC] text-[#14532D]", Icon: CheckCircle2 },
  already:  { title: "Already checked in",      cls: "bg-[#FEF9C3] border-[#FDE68A] text-[#713F12]", Icon: AlertTriangle },
  invalid:  { title: "Not a valid member pass", cls: "bg-[#FEE2E2] border-[#FCA5A5] text-[#7F1D1D]", Icon: XCircle },
  inactive: { title: "Membership not active",   cls: "bg-[#FEE2E2] border-[#FCA5A5] text-[#7F1D1D]", Icon: XCircle },
  closed:   { title: "Check-in is closed",      cls: "bg-[#F3F4F6] border-[#E5E7EB] text-[#374151]", Icon: Lock },
};

function Detail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const params = useSearchParams();
  const { user, role } = useAuth();
  const isStaff = role === "admin" || role === "super_admin";
  const toast = useToast();

  const [a, setA]                 = useState<Announcement | null>(null);
  const [missing, setMissing]     = useState(false);
  const [sessionStatus, setSessionStatus] = useState<string | null>(null);
  const [checkIns, setCheckIns]   = useState<CheckIn[]>([]);
  const [members, setMembers]     = useState<Member[]>([]);
  const [tab, setTab]             = useState<"checkin" | "results">(params.get("tab") === "results" ? "results" : "checkin");
  const [feedback, setFeedback]   = useState<ScanFeedback | null>(null);
  const [processing, setProcessing] = useState(false);
  const [search, setSearch]       = useState("");
  const [showPass, setShowPass]   = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const busy = useRef(false);

  useEffect(() => onSnapshot(doc(db, "announcements", id), (s) => {
    if (s.exists()) setA({ id: s.id, ...s.data() } as Announcement); else setMissing(true);
  }), [id]);

  useEffect(() => onSnapshot(doc(db, "attendance", id), (s) => setSessionStatus(s.exists() ? (s.data().status as string) : null)), [id]);

  // Staff: live check-ins + the member list. Members: only their own check-in.
  useEffect(() => {
    if (!user) return;
    if (isStaff) {
      return onSnapshot(query(collection(db, "checkIns"), where("sessionId", "==", id)), (snap) => {
        setCheckIns(snap.docs.map((d) => ({ id: d.id, ...d.data() } as CheckIn))
          .sort((x, y) => (y.checkedInAt?.toMillis?.() ?? 0) - (x.checkedInAt?.toMillis?.() ?? 0)));
      });
    }
    getDoc(doc(db, "checkIns", `${id}_${user.id}`)).then((s) => {
      if (s.exists()) setCheckIns([{ id: s.id, ...s.data() } as CheckIn]);
    }).catch(() => {});
  }, [id, user, isStaff]);

  useEffect(() => {
    if (!isStaff) return;
    return onSnapshot(query(collection(db, "users"), where("status", "==", "active")), (snap) => {
      setMembers(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Member)).filter((m) => m.role !== "super_admin")
        .sort((x, y) => (x.displayName || "").localeCompare(y.displayName || "")));
    });
  }, [isStaff]);

  const checkedIds = useMemo(() => new Set(checkIns.map((c) => c.userId)), [checkIns]);
  const absent = members.filter((m) => !checkedIds.has(m.id));
  const rate = members.length ? Math.round((members.filter((m) => checkedIds.has(m.id)).length / members.length) * 100) : 0;
  const open = sessionStatus === "active";

  async function process(memberId: string, passCode: string | null) {
    if (!user || busy.current) return;
    busy.current = true;
    setProcessing(true);
    try {
      const res = await staffCheckIn(id, memberId, passCode, user);
      setFeedback({ ...res, at: Date.now() });
      beep(res.status === "ok");
    } catch {
      setFeedback({ status: "invalid", at: Date.now() });
      beep(false);
    } finally {
      busy.current = false;
      setProcessing(false);
    }
  }

  function onScan(value: string) {
    const pass = parseMemberPass(value);
    if (!pass) { setFeedback({ status: "invalid", at: Date.now() }); beep(false); return; }
    process(pass.uid, pass.passCode);
  }

  async function setOpen(next: boolean) {
    await updateDoc(doc(db, "attendance", id), { status: next ? "active" : "completed" });
    toast({ message: next ? t("ann.reopened") : t("ann.closedToast") });
  }

  function exportCsv() {
    if (!a) return;
    const byId = new Map(checkIns.map((c) => [c.userId, c]));
    const rows = [
      ["Name", "Email", "Status", "Checked in at", "Method"],
      ...members.map((m) => {
        const c = byId.get(m.id) as (CheckIn & { method?: string }) | undefined;
        return [m.displayName || "", m.email || "", c ? "Present" : "Absent", c?.checkedInAt?.toDate?.().toLocaleString() ?? "", c?.method ?? ""];
      }),
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url; link.download = `attendance-${a.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.csv`; link.click();
    URL.revokeObjectURL(url);
  }

  async function remove() {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    await deleteDoc(doc(db, "announcements", id));
    toast({ message: t("ann.deleted") });
    router.replace("/announcements");
  }

  if (missing) return <div className="py-16 text-center text-[#6B7280]">{t("ann.missing")}</div>;
  if (!a || !user) return <div className="py-16"><div className="w-7 h-7 border-2 border-[#1B2E6B] border-t-transparent rounded-full animate-spin mx-auto" /></div>;

  const fb = feedback ? FEEDBACK[feedback.status] : null;
  const manualList = (search.trim() ? members.filter((m) => (m.displayName || m.email || "").toLowerCase().includes(search.toLowerCase())) : absent).slice(0, 8);

  return (
    <div className="space-y-7">
      <Link href="/announcements" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1B2E6B] hover:underline"><ArrowLeft size={15} /> {t("ann.all")}</Link>

      {/* Announcement */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden max-w-[980px]">
        {a.imageURL && <img src={a.imageURL} alt="" className="w-full max-h-72 object-cover" />}
        <div className="p-7">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            {a.attendanceRequired && (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#FFF8DB] text-[#A16207] text-[11px] font-bold"><ClipboardCheck size={12} /> {t("ann.required")}</span>
            )}
            {a.attendanceRequired && sessionStatus && (
              <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${open ? "bg-[#DCFCE7] text-[#15803D]" : "bg-[#F3F4F6] text-[#6B7280]"}`}>{open ? t("ann.open") : t("ann.closedBadge")}</span>
            )}
          </div>
          <h1 className="page-title-sm">{a.title}</h1>
          <p className="!text-[#6B7280] !text-sm">{t("ann.postedBy", { name: a.createdByName })}</p>
          <p className="text-[#374151] mt-4 whitespace-pre-wrap leading-relaxed">{a.body}</p>
          <div className="flex flex-wrap gap-x-6 gap-y-2 mt-4 text-sm text-[#374151]">
            {a.eventDate && <span className="flex items-center gap-1.5"><CalendarDays size={15} className="text-[#1B2E6B]" />{fmtWhen(a.eventDate)}</span>}
            {a.location && <span className="flex items-center gap-1.5"><MapPin size={15} className="text-[#1B2E6B]" />{a.location}</span>}
          </div>

          {/* Member status */}
          {!isStaff && a.attendanceRequired && (
            checkIns[0] ? (
              <div className="mt-6 flex items-center gap-3 bg-[#DCFCE7] text-[#14532D] rounded-xl px-5 py-4">
                <CheckCircle2 size={22} /> <span className="font-semibold">{t("ann.checkedInAt", { time: fmtTime(checkIns[0].checkedInAt) })}</span>
              </div>
            ) : (
              <div className="mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#FFF8DB] rounded-xl px-5 py-4">
                <p className="text-[#713F12] text-sm"><strong>{t("ann.requiredSentence")}</strong> {t("ann.showPassHint")}</p>
                <button onClick={() => setShowPass(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1B2E6B] text-white text-sm font-semibold"><QrCode size={16} /> {t("ann.showPass")}</button>
              </div>
            )
          )}

          {isStaff && (
            <div className="mt-6 flex flex-wrap gap-2">
              {!a.attendanceRequired && (
                <button onClick={async () => { await enableAnnouncementAttendance(a); toast({ message: t("ann.turnedOn") }); }}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1B2E6B] text-white text-sm font-semibold"><ClipboardCheck size={16} /> {t("ann.makeMandatory")}</button>
              )}
              <button onClick={remove} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-[#DC2626] hover:bg-red-50">
                <Trash2 size={15} /> {confirmDelete ? t("ann.confirmDelete") : t("ann.delete")}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Staff attendance tools */}
      {isStaff && a.attendanceRequired && (
        <div className="space-y-5 max-w-[980px]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-2 bg-white rounded-full p-1 shadow-sm">
              {([["checkin", t("ann.tabCheckin"), ScanLine], ["results", t("ann.tabResults"), ListChecks]] as const).map(([k, label, Icon]) => (
                <button key={k} onClick={() => setTab(k)}
                  className={`flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold ${tab === k ? "bg-[#1B2E6B] text-white shadow" : "text-[#374151] hover:bg-[#EEF1F8]"}`}>
                  <Icon size={15} /> {label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-[#111827]"><strong className="text-2xl font-bold text-[#1B2E6B]">{checkedIds.size}</strong> / {t("ann.checkedInOf", { total: members.length })}</span>
              <button onClick={() => setOpen(!open)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white text-sm font-semibold text-[#374151] shadow-sm hover:shadow-md">
                {open ? <><Lock size={14} /> {t("ann.close")}</> : <><Unlock size={14} /> {t("ann.reopen")}</>}
              </button>
            </div>
          </div>

          {tab === "checkin" ? (
            <div className="grid lg:grid-cols-[1fr_360px] gap-5">
              <div className="bg-white rounded-2xl shadow-sm p-5">
                {open ? (
                  <QrScanner onScan={onScan} paused={processing} />
                ) : (
                  <div className="aspect-square max-w-[420px] mx-auto rounded-2xl bg-[#F3F4F6] flex flex-col items-center justify-center gap-3 text-[#6B7280]">
                    <Lock size={32} /> <p className="text-sm">{t("ann.closedText")}</p>
                    <button onClick={() => setOpen(true)} className="px-4 py-2 rounded-xl bg-[#1B2E6B] text-white text-sm font-semibold">{t("ann.reopen")}</button>
                  </div>
                )}
                {fb && feedback && (
                  <div key={feedback.at} className={`mt-4 flex items-center gap-4 rounded-xl border-2 px-5 py-4 animate-scale-in ${fb.cls}`}>
                    {"photoURL" in feedback && feedback.photoURL
                      ? <img src={feedback.photoURL} alt="" className="w-12 h-12 rounded-full object-cover" />
                      : <fb.Icon size={30} />}
                    <div>
                      <p className="font-bold">{t(`ann.scan.${feedback.status}`, { defaultValue: fb.title })}</p>
                      {feedback.name && <p className="text-sm">{feedback.name}</p>}
                    </div>
                  </div>
                )}
                <p className="text-xs text-[#6B7280] text-center mt-3">{t("ann.scanHint")}</p>
              </div>

              <div className="space-y-5">
                <div className="bg-white rounded-2xl shadow-sm p-5">
                  <p className="font-semibold text-[#111827] mb-1">{t("ann.manual")}</p>
                  <p className="text-xs text-[#6B7280] mb-3">{t("ann.manualHint")}</p>
                  <div className="relative mb-3">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                    <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("ann.searchMember")}
                      className="w-full pl-9 pr-3 py-2 rounded-lg border border-[#E5E7EB] text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2E6B]/15" />
                  </div>
                  <div className="space-y-1.5 max-h-64 overflow-y-auto">
                    {manualList.map((m) => {
                      const done = checkedIds.has(m.id);
                      return (
                        <div key={m.id} className="flex items-center justify-between gap-2 py-1.5">
                          <span className="text-sm text-[#111827] truncate">{m.displayName || m.email}</span>
                          <button disabled={done || !open || processing} onClick={() => process(m.id, null)}
                            className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold ${done ? "bg-[#DCFCE7] text-[#15803D]" : "bg-[#1B2E6B] text-white disabled:opacity-40"}`}>
                            {done ? <><CheckCircle2 size={12} /> {t("ann.in")}</> : <><UserCheck size={12} /> {t("ann.tabCheckin")}</>}
                          </button>
                        </div>
                      );
                    })}
                    {manualList.length === 0 && <p className="text-xs text-[#9CA3AF]">{search ? t("ann.noMember") : t("ann.everyoneIn")}</p>}
                  </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm p-5">
                  <p className="font-semibold text-[#111827] mb-3">{t("ann.recent")}</p>
                  <div className="space-y-2 max-h-56 overflow-y-auto">
                    {checkIns.slice(0, 12).map((c) => (
                      <div key={c.id} className="flex items-center justify-between text-sm animate-fade-up">
                        <span className="text-[#111827] truncate">{c.userName}</span>
                        <span className="text-xs text-[#9CA3AF]">{fmtTime(c.checkedInAt)}</span>
                      </div>
                    ))}
                    {checkIns.length === 0 && <p className="text-xs text-[#9CA3AF]">{t("ann.noOne")}</p>}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid sm:grid-cols-3 gap-4">
                {[
                  [t("ann.attended"), checkedIds.size, "text-[#15803D]"],
                  [t("ann.missingLabel"), absent.length, "text-[#B91C1C]"],
                  [t("ann.rate"), `${rate}%`, "text-[#1B2E6B]"],
                ].map(([label, value, cls]) => (
                  <div key={label as string} className="bg-white rounded-2xl shadow-sm px-6 py-5">
                    <p className="text-sm text-[#6B7280]">{label}</p>
                    <p className={`text-3xl font-bold mt-1 ${cls}`}>{value}</p>
                  </div>
                ))}
              </div>
              <div className="flex justify-end">
                <button onClick={exportCsv} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white text-sm font-semibold text-[#374151] shadow-sm hover:shadow-md"><Download size={14} /> {t("ann.exportCsv")}</button>
              </div>
              <div className="grid md:grid-cols-2 gap-5">
                <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  <p className="px-5 py-4 border-b border-[#F3F4F6] font-semibold text-[#111827]">{t("ann.attended")} ({checkIns.length})</p>
                  <div className="divide-y divide-[#F3F4F6] max-h-[420px] overflow-y-auto">
                    {checkIns.map((c) => (
                      <div key={c.id} className="flex items-center justify-between px-5 py-3 text-sm">
                        <span className="flex items-center gap-2 text-[#111827]"><CheckCircle2 size={15} className="text-[#16A34A]" />{c.userName}</span>
                        <span className="text-xs text-[#9CA3AF]">{fmtTime(c.checkedInAt)}{(c as CheckIn & { method?: string }).method === "manual" ? " · manual" : ""}</span>
                      </div>
                    ))}
                    {checkIns.length === 0 && <p className="px-5 py-6 text-sm text-[#9CA3AF]">{t("ann.noCheckins")}</p>}
                  </div>
                </div>
                <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  <p className="px-5 py-4 border-b border-[#F3F4F6] font-semibold text-[#111827]">{t("ann.missingLabel")} ({absent.length})</p>
                  <div className="divide-y divide-[#F3F4F6] max-h-[420px] overflow-y-auto">
                    {absent.map((m) => (
                      <div key={m.id} className="flex items-center justify-between px-5 py-3 text-sm">
                        <span className="text-[#111827]">{m.displayName || m.email}</span>
                        <Link href={`/messaging?member=${m.id}`} className="text-xs font-semibold text-[#1B2E6B] hover:underline">{t("ann.message")}</Link>
                      </div>
                    ))}
                    {absent.length === 0 && <p className="px-5 py-6 text-sm text-[#9CA3AF]">{t("ann.everyoneAttended")}</p>}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {showPass && <MemberPassModal onClose={() => setShowPass(false)} />}
    </div>
  );
}

export default function AnnouncementDetailPage() {
  return (
    <Suspense fallback={null}>
      <Detail />
    </Suspense>
  );
}
