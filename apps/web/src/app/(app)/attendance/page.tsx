"use client";
import React, { useEffect, useState } from "react";
import {
  collection, query, orderBy, onSnapshot, addDoc, doc, getDoc, setDoc, updateDoc,
  serverTimestamp, Timestamp, where,
} from "firebase/firestore";
import { QRCodeSVG } from "qrcode.react";
import {
  db, useAuth, checkInQRValue, newAttendanceCode,
  type Attendance, type CheckIn,
} from "@/lib/firebase";
import { MemberAttendance } from "./_components/MemberAttendance";
import { Download, Printer, RefreshCw, Users, Plus, X, Play, Square } from "lucide-react";
import { useTranslation } from "@nablis/i18n";
import i18n from "@nablis/i18n";
import { dateLocale } from "@/lib/locale";

const INPUT = "w-full px-4 py-2.5 rounded-xl border border-[#E5E7EB] text-sm text-[#374151] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#1B2E6B]/20 focus:border-[#1B2E6B] transition-colors bg-white";

function fmtDate(ts: Timestamp | null | undefined) {
  if (!ts) return "—";
  try { return ts.toDate().toLocaleDateString(dateLocale(), { month: "short", day: "numeric", year: "numeric" }); }
  catch { return "—"; }
}
function fmtTime(ts: Timestamp | null | undefined) {
  if (!ts) return "";
  try { return ts.toDate().toLocaleTimeString(dateLocale(), { hour: "numeric", minute: "2-digit" }); }
  catch { return ""; }
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const map: Record<string, string> = {
    completed: "bg-gray-100 text-gray-600",
    active:    "bg-green-50 text-green-700",
    upcoming:  "bg-yellow-50 text-yellow-700",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize ${map[status] ?? "bg-gray-100 text-gray-600"}`}>
      {t(`sessionStatus.${status}`, { defaultValue: status })}
    </span>
  );
}

// ── SVG circular gauge ────────────────────────────────────────────────────────
function CircularGauge({ pct, current, total }: { pct: number; current: number; total: number }) {
  const r = 42;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(pct, 100) / 100) * circ;
  return (
    <svg viewBox="0 0 100 100" className="w-28 h-28">
      <circle cx="50" cy="50" r={r} fill="none" stroke="#EEF1F8" strokeWidth="10" />
      <circle cx="50" cy="50" r={r} fill="none" stroke="#1B2E6B" strokeWidth="10"
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        transform="rotate(-90 50 50)" className="transition-all duration-700" />
      <text x="50" y="46" textAnchor="middle" className="fill-[#1B2E6B] font-bold" fontSize="14">{current}</text>
      <text x="50" y="60" textAnchor="middle" className="fill-[#9CA3AF]" fontSize="8">{total ? i18n.t("attAdmin.of", { total }) : i18n.t("attAdmin.checkedIn")}</text>
    </svg>
  );
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── New session modal ─────────────────────────────────────────────────────────
function NewSessionModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const { t } = useTranslation();
  const [title, setTitle]       = useState("Monthly Meeting");
  const [date, setDate]         = useState(() => new Date().toISOString().slice(0, 16));
  const [capacity, setCapacity] = useState("");
  const [startNow, setStartNow] = useState(true);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string | null>(null);

  async function create() {
    if (!title.trim() || !date) return;
    setSaving(true);
    setError(null);
    try {
      const ref = await addDoc(collection(db, "attendance"), {
        meetingTitle:  title.trim(),
        date:          Timestamp.fromDate(new Date(date)),
        totalCapacity: capacity ? Number(capacity) : 0,
        status:        startNow ? "active" : "upcoming",
        createdAt:     serverTimestamp(),
      });
      await setDoc(doc(db, "attendanceCodes", ref.id), { code: newAttendanceCode() });
      onCreated(ref.id);
    } catch {
      setError(t("attAdmin.createError"));
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#F3F4F6]">
          <h3 className="text-[#1B2E6B] font-bold text-base">{t("attAdmin.newSession")}</h3>
          <button onClick={onClose} className="text-[#9CA3AF] hover:text-[#6B7280]"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#374151] mb-1.5">{t("attAdmin.meetingTitle")}</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={INPUT} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1.5">{t("book.step2")}</label>
              <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} className={INPUT} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1.5">{t("attAdmin.expected")}</label>
              <input type="number" min={0} value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder={t("share.optional")} className={INPUT} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-[#374151]">
            <input type="checkbox" checked={startNow} onChange={(e) => setStartNow(e.target.checked)} />
            Open check-in now
          </label>
          {error && <p className="text-red-500 text-xs">{error}</p>}
          <button onClick={create} disabled={saving || !title.trim()}
            className="w-full bg-[#1B2E6B] text-white font-semibold py-2.5 rounded-xl hover:bg-[#162554] disabled:opacity-60 transition-colors text-sm">
            {saving ? t("attAdmin.creating") : t("attAdmin.create")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Admin view ────────────────────────────────────────────────────────────────
function AdminAttendance() {
  const { t } = useTranslation();
  const [sessions, setSessions] = useState<Attendance[]>([]);
  const [loading, setLoading]   = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [code, setCode]         = useState<string | null>(null);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy]         = useState(false);

  useEffect(() => {
    return onSnapshot(query(collection(db, "attendance"), orderBy("date", "desc")), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Attendance));
      setSessions(list);
      setSelectedId((cur) => cur ?? (list.find((s) => s.status === "active") ?? list[0])?.id ?? null);
      setLoading(false);
    }, () => setLoading(false));
  }, []);

  const selected = sessions.find((s) => s.id === selectedId) ?? null;

  // Code + live check-ins for the selected session.
  useEffect(() => {
    if (!selectedId) return;
    setCode(null);
    getDoc(doc(db, "attendanceCodes", selectedId)).then((snap) => setCode(snap.data()?.code ?? null));
    return onSnapshot(query(collection(db, "checkIns"), where("sessionId", "==", selectedId)), (snap) => {
      setCheckIns(snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as CheckIn))
        .sort((a, b) => (b.checkedInAt?.toMillis?.() ?? 0) - (a.checkedInAt?.toMillis?.() ?? 0)));
    });
  }, [selectedId]);

  const count = selected?.attendees?.length && checkIns.length === 0 ? selected.attendees.length : checkIns.length;
  const capacity = selected?.totalCapacity ?? 0;
  const pct = capacity ? Math.round((count / capacity) * 100) : 0;
  const qrValue = selected && code ? checkInQRValue(selected.id, code) : "";

  async function setStatus(status: Attendance["status"]) {
    if (!selected) return;
    setBusy(true);
    try { await updateDoc(doc(db, "attendance", selected.id), { status }); }
    finally { setBusy(false); }
  }

  async function resetCode() {
    if (!selected || !confirm("Generate a new code? The old QR code will stop working.")) return;
    const next = newAttendanceCode();
    await setDoc(doc(db, "attendanceCodes", selected.id), { code: next });
    setCode(next);
  }

  function printCode() {
    const svg = document.getElementById("attendance-qr")?.outerHTML;
    if (!svg || !selected || !code) return;
    const w = window.open("", "_blank", "width=600,height=800");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>${selected.meetingTitle}</title>
      <style>body{font-family:system-ui,sans-serif;text-align:center;padding:48px;color:#1B2E6B}
      svg{width:360px;height:360px}h1{margin:0 0 8px}p{color:#6B7280}.code{font-size:32px;letter-spacing:6px;font-weight:700;color:#1B2E6B}</style>
      </head><body><h1>${selected.meetingTitle}</h1><p>${fmtDate(selected.date)}</p>${svg}
      <p>${t("attAdmin.printHint")}</p><div class="code">${code}</div></body></html>`);
    w.document.close();
    w.focus();
    w.print();
  }

  function exportSession() {
    if (!selected) return;
    downloadCsv(`attendance-${fmtDate(selected.date).replace(/[^a-z0-9]+/gi, "-")}.csv`, [
      ["Name", "Checked in at"],
      ...checkIns.map((c) => [c.userName ?? "", c.checkedInAt?.toDate?.().toLocaleString() ?? ""]),
    ]);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-[#1B2E6B]">{t("attAdmin.title")}</h1>
          <p className="text-[#9CA3AF] text-sm mt-0.5">{t("attAdmin.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportSession} disabled={!selected || checkIns.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#E5E7EB] text-sm font-semibold text-[#374151] hover:bg-[#EEF1F8] disabled:opacity-50 transition-colors">
            <Download size={14} /> {t("events.export")}
          </button>
          <button onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#F5C518] text-[#1B2E6B] text-sm font-semibold hover:bg-[#e6b800] transition-colors">
            <Plus size={14} /> {t("attAdmin.newSessionShort")}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center"><div className="w-7 h-7 border-2 border-[#1B2E6B] border-t-transparent rounded-full animate-spin mx-auto" /></div>
      ) : !selected ? (
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-10 text-center text-[#9CA3AF]">
          <Users size={32} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">{t("attAdmin.noSessions")}</p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-5">
          {/* QR code card */}
          <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-6">
            <div className="flex items-start justify-between gap-3 mb-5">
              <div>
                <h2 className="text-[#1B2E6B] font-semibold text-sm">{selected.meetingTitle}</h2>
                <p className="text-[#9CA3AF] text-xs mt-0.5">{fmtDate(selected.date)} · {fmtTime(selected.date)}</p>
              </div>
              <StatusBadge status={selected.status} />
            </div>
            <div className="flex flex-col items-center">
              {qrValue ? (
                <div className="bg-white p-3 rounded-xl border border-[#F3F4F6]">
                  <QRCodeSVG id="attendance-qr" value={qrValue} size={180} fgColor="#1B2E6B" level="M" />
                </div>
              ) : (
                <div className="w-[204px] h-[204px] rounded-xl bg-[#F9FAFB] animate-pulse" />
              )}
              <p className="font-mono text-2xl font-bold tracking-[0.3em] text-[#1B2E6B] mt-3">{code ?? "······"}</p>
              <p className="text-[#9CA3AF] text-xs mt-1 mb-4 text-center">
                {selected.status === "active"
                  ? t("attAdmin.scanHint")
                  : t("attAdmin.opensHint")}
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {selected.status !== "active" ? (
                  <button onClick={() => setStatus("active")} disabled={busy}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1B2E6B] text-white text-sm font-semibold hover:bg-[#162554] disabled:opacity-60 transition-colors">
                    <Play size={13} /> {selected.status === "completed" ? t("attAdmin.reopen") : t("attAdmin.start")}
                  </button>
                ) : (
                  <button onClick={() => setStatus("completed")} disabled={busy}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-50 text-red-600 text-sm font-semibold hover:bg-red-100 disabled:opacity-60 transition-colors">
                    <Square size={13} /> {t("attAdmin.end")}
                  </button>
                )}
                <button onClick={printCode} disabled={!qrValue}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#E5E7EB] text-sm font-semibold text-[#374151] hover:bg-[#EEF1F8] disabled:opacity-50 transition-colors">
                  <Printer size={13} /> {t("attAdmin.print")}
                </button>
                <button onClick={resetCode}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#EEF1F8] text-[#1B2E6B] text-sm font-semibold hover:bg-[#dde3f0] transition-colors">
                  <RefreshCw size={13} /> {t("attAdmin.reset")}
                </button>
              </div>
            </div>
          </div>

          {/* Live stats + list */}
          <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-6 flex flex-col">
            <div className="flex items-center gap-6 mb-5">
              <CircularGauge pct={pct} current={count} total={capacity} />
              <div className="space-y-2">
                <div>
                  <p className="text-3xl font-bold text-[#1B2E6B]">{capacity ? `${pct}%` : count}</p>
                  <p className="text-[#9CA3AF] text-xs">{capacity ? "of expected attendees" : "checked in"}</p>
                </div>
                {selected.status === "active" && (
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-green-600 text-xs font-medium">{t("attAdmin.live")}</span>
                  </div>
                )}
              </div>
            </div>
            <h3 className="text-[#1B2E6B] font-semibold text-xs uppercase tracking-wide mb-2">{t("attAdmin.checkedInTitle")}</h3>
            <div className="flex-1 overflow-y-auto max-h-64 divide-y divide-[#F3F4F6]">
              {checkIns.length === 0 ? (
                <p className="text-[#9CA3AF] text-xs py-6 text-center">{t("ann.noCheckins")}</p>
              ) : checkIns.map((c) => (
                <div key={c.id} className="flex items-center justify-between py-2">
                  <span className="text-sm text-[#374151]">{c.userName}</span>
                  <span className="text-xs text-[#9CA3AF]">{fmtTime(c.checkedInAt)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* History table */}
      {sessions.length > 0 && (
        <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-[#F3F4F6]">
            <h2 className="text-[#1B2E6B] font-semibold text-sm">{t("attAdmin.all")}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F9FAFB] border-b border-[#F3F4F6]">
                  {[t("events.date"), t("attAdmin.meetingTitle"), t("attAdmin.expectedShort"), t("study.status"), ""].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-[#9CA3AF]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {sessions.map((a) => (
                  <tr key={a.id} className={a.id === selectedId ? "bg-[#EEF1F8]" : "hover:bg-[#F9FAFB]"}>
                    <td className="px-4 py-3 text-[#6B7280] text-xs">{fmtDate(a.date)}</td>
                    <td className="px-4 py-3 text-[#374151] font-medium text-xs">{a.meetingTitle}</td>
                    <td className="px-4 py-3 text-xs text-[#6B7280]">{a.totalCapacity || "—"}</td>
                    <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
                    <td className="px-4 py-3">
                      <button onClick={() => setSelectedId(a.id)}
                        className="text-xs font-semibold text-[#1B2E6B] hover:text-[#F5C518] transition-colors">
                        {t("attAdmin.viewDetails")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {creating && (
        <NewSessionModal
          onClose={() => setCreating(false)}
          onCreated={(id) => { setCreating(false); setSelectedId(id); }}
        />
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function AttendancePage() {
  const { user, role } = useAuth();
  if (!user) return null;
  return (role === "admin" || role === "super_admin") ? <AdminAttendance /> : <MemberAttendance />;
}
