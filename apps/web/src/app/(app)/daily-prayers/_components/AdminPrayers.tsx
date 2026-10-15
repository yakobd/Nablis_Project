"use client";
import React, { useEffect, useMemo, useState } from "react";
import {
  collection, deleteDoc, doc, getDocs, onSnapshot, query, Timestamp, updateDoc, where,
} from "firebase/firestore";
import { Plus, Pencil, Trash2, TrendingUp, TrendingDown, Download, Search, X } from "lucide-react";
import {
  db, useAuth, prayerName, prayerKey, currentStreak, toIsoDate, formatTime12,
  type DailyPrayer, type PrayerLog,
} from "@/lib/firebase";
import { useToast } from "@/components/ui/Toast";
import { PrayerModal } from "./PrayerModal";
import { VerseOfDayEditor } from "./VerseOfDayEditor";
import { PageTitle } from "@/components/PageTitle";
import { useTranslation } from "@nablis/i18n";
import i18n from "@nablis/i18n";
import { dateLocale } from "@/lib/locale";

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
      className={`relative w-12 h-7 rounded-full transition-colors flex-shrink-0 ${checked ? "bg-[#1E40AF]" : "bg-[#D1D5DB]"}`}>
      <span className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${checked ? "translate-x-5" : ""}`} />
    </button>
  );
}

function Stat({ label, value, delta }: { label: string; value: string; delta: number | null }) {
  const up = (delta ?? 0) >= 0;
  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm px-6 py-5">
      <p className="text-sm text-[#6B7280]">{label}</p>
      <div className="flex items-end justify-between mt-1">
        <p className="text-3xl font-bold text-[#111827]">{value}</p>
        {delta !== null && (
          <span className={`flex items-center gap-1 text-sm font-semibold ${up ? "text-[#10B981]" : "text-[#EF4444]"}`}>
            {up ? <TrendingUp size={14} /> : <TrendingDown size={14} />}{up ? "+" : ""}{delta}%
          </span>
        )}
      </div>
    </div>
  );
}

function pct(now: number, before: number): number | null {
  if (!before) return now ? 100 : null;
  return Math.round(((now - before) / before) * 100);
}

// Card with toggle, inline time edit, message and delete (per the design).
function ReminderCard({
  p, onToggle, onEdit, onDelete, onTime,
}: {
  p: DailyPrayer;
  onToggle: (v: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  onTime: (t: string) => void;
}) {
  const { t } = useTranslation();
  const [editingTime, setEditingTime] = useState(false);
  const [time, setTime] = useState(p.time);
  const enabled = p.enabled !== false;

  return (
    <div className={`bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-6 flex flex-col transition-opacity ${enabled ? "" : "opacity-60"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xl font-semibold text-[#111827]">{prayerName(p)}</p>
          <p className="text-sm text-[#6B7280]">{enabled ? t("prayAdmin.scheduled") : t("prayAdmin.paused")}</p>
        </div>
        <Toggle checked={enabled} onChange={onToggle} label={t("prayAdmin.enable", { name: prayerName(p) })} />
      </div>

      <div className="mt-5 bg-[#F8FAFC] rounded-xl px-5 py-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold tracking-widest text-[#9CA3AF]">{t("book.time")}</p>
          {editingTime ? (
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} autoFocus
              className="text-2xl font-bold text-[#1E3A8A] bg-transparent focus:outline-none w-36" />
          ) : (
            <p className="text-[28px] font-bold text-[#1E3A8A] leading-tight">{formatTime12(p.time)}</p>
          )}
        </div>
        {editingTime ? (
          <div className="flex gap-1.5">
            <button onClick={() => { onTime(time); setEditingTime(false); }}
              className="px-3 py-1.5 rounded-lg bg-[#1B2E6B] text-white text-xs font-bold">{t("events.save")}</button>
            <button onClick={() => { setTime(p.time); setEditingTime(false); }}
              className="p-1.5 rounded-lg border border-[#E5E7EB] text-[#6B7280]" aria-label={t("common.cancel")}><X size={14} /></button>
          </div>
        ) : (
          <button onClick={() => setEditingTime(true)}
            className="px-3.5 py-2 rounded-lg border border-[#E5E7EB] bg-white text-[13px] font-bold text-[#1E3A8A] hover:bg-[#EEF1F8] whitespace-nowrap">
            EDIT TIME
          </button>
        )}
      </div>

      <div className="flex items-center justify-between mt-6 mb-2">
        <p className="text-[13px] font-semibold tracking-wide text-[#4B5563]">{t("prayAdmin.currentMessage")}</p>
        <button onClick={onEdit} className="flex items-center gap-1 text-[13px] font-bold text-[#1E3A8A] hover:underline"><Pencil size={12} /> {t("common.edit")}</button>
      </div>
      <div className="bg-[#F8FAFC] border border-[#EEF1F8] rounded-xl px-5 py-4 flex-1">
        <p className="italic text-[#374151] leading-relaxed">&ldquo;{p.message}&rdquo;</p>
        {p.bibleVerse && <p className="text-sm font-bold text-[#1E3A8A] mt-3">— {p.bibleVerse}</p>}
      </div>

      <div className="flex justify-end mt-4">
        <button onClick={onDelete} className="p-1.5 rounded-lg text-[#B91C1C] hover:bg-red-50" aria-label={t("prayAdmin.deleteName", { name: prayerName(p) })}>
          <Trash2 size={20} />
        </button>
      </div>
    </div>
  );
}

interface MemberRow { uid: string; name: string; today: Set<string>; streak: number; total: number; last: Date | null }

export function AdminPrayers() {
  const { t } = useTranslation();
  const { role } = useAuth();
  const isSuperAdmin = role === "super_admin";
  const toast = useToast();
  const [prayers, setPrayers] = useState<DailyPrayer[]>([]);
  const [logs, setLogs]       = useState<PrayerLog[]>([]);
  const [members, setMembers] = useState<{ id: string; name: string }[]>([]);
  const [editing, setEditing] = useState<DailyPrayer | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<DailyPrayer | null>(null);
  const [search, setSearch]   = useState("");

  useEffect(() => onSnapshot(collection(db, "dailyPrayers"), (snap) => {
    setPrayers(snap.docs.map((d) => ({ id: d.id, ...d.data() } as DailyPrayer)).sort((a, b) => a.time.localeCompare(b.time)));
  }), []);

  // Last 60 days of logs power the stats and the monitoring table.
  useEffect(() => {
    const since = new Date(); since.setDate(since.getDate() - 60); since.setHours(0, 0, 0, 0);
    return onSnapshot(query(collection(db, "prayerLogs"), where("prayedAt", ">=", Timestamp.fromDate(since))), (snap) => {
      setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() } as PrayerLog)));
    });
  }, []);

  useEffect(() => {
    getDocs(query(collection(db, "users"), where("role", "==", "member"), where("status", "==", "active")))
      .then((snap) => setMembers(snap.docs.map((d) => ({ id: d.id, name: d.data().displayName || d.data().email || d.id }))));
  }, []);

  const stats = useMemo(() => {
    const day = (offset: number) => { const d = new Date(); d.setDate(d.getDate() - offset); return toIsoDate(d); };
    const iso = (l: PrayerLog) => (l.prayedAt?.toDate ? toIsoDate(l.prayedAt.toDate()) : "");
    const today = logs.filter((l) => iso(l) === day(0)).length;
    const yesterday = logs.filter((l) => iso(l) === day(1)).length;
    const inRange = (from: number, to: number) => new Set(logs.filter((l) => { const s = iso(l); return s <= day(from) && s > day(to); }).map((l) => l.userId));
    const activeNow = inRange(0, 7).size;
    const activeBefore = inRange(7, 14).size;
    const byUser: Record<string, PrayerLog[]> = {};
    logs.forEach((l) => { (byUser[l.userId] ??= []).push(l); });
    const streaks = Object.values(byUser).map(currentStreak).filter((s) => s > 0);
    const avg = streaks.length ? Math.round(streaks.reduce((a, b) => a + b, 0) / streaks.length) : 0;
    return { today, todayDelta: pct(today, yesterday), activeNow, activeDelta: pct(activeNow, activeBefore), avg, byUser };
  }, [logs]);

  const rows: MemberRow[] = useMemo(() => members.map((m) => {
    const mine = (stats.byUser[m.id] ?? []).sort((a, b) => (b.prayedAt?.toMillis?.() ?? 0) - (a.prayedAt?.toMillis?.() ?? 0));
    const todayIso = toIsoDate(new Date());
    return {
      uid: m.id,
      name: m.name,
      today: new Set(mine.filter((l) => l.prayedAt?.toDate && toIsoDate(l.prayedAt.toDate()) === todayIso).map((l) => l.prayerType)),
      streak: currentStreak(mine),
      total: mine.length,
      last: mine[0]?.prayedAt?.toDate?.() ?? null,
    };
  }), [members, stats]);

  const shown = rows.filter((r) => !search || r.name.toLowerCase().includes(search.toLowerCase()));
  const enabledPrayers = prayers.filter((p) => p.enabled !== false);

  function upsert(p: DailyPrayer) {
    setPrayers((prev) => prev.some((x) => x.id === p.id) ? prev.map((x) => x.id === p.id ? p : x) : [...prev, p]);
  }

  async function patch(p: DailyPrayer, data: Partial<DailyPrayer>, msg: string) {
    try {
      await updateDoc(doc(db, "dailyPrayers", p.id), data);
      toast({ message: msg });
    } catch {
      toast({ type: "error", message: t("prayAdmin.saveError") });
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await deleteDoc(doc(db, "dailyPrayers", deleting.id));
      toast({ message: t("prayAdmin.deleted", { name: prayerName(deleting) }) });
    } finally {
      setDeleting(null);
    }
  }

  function exportCsv() {
    const header = ["Member", ...enabledPrayers.map(prayerName), "Streak (days)", "Prayers (60 days)", "Last prayed"];
    const lines = shown.map((r) => [
      r.name,
      ...enabledPrayers.map((p) => (r.today.has(prayerKey(p)) ? "yes" : "no")),
      String(r.streak), String(r.total), r.last ? r.last.toLocaleDateString() : "",
    ]);
    const csv = [header, ...lines].map((row) => row.map((v) => `"${v.replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `prayer-report-${toIsoDate(new Date())}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-10">
      <div>
        <PageTitle id="prayersAdmin" />
      </div>

      <div className="grid sm:grid-cols-3 gap-6">
        <Stat label={t("prayAdmin.markedToday")} value={stats.today.toLocaleString()} delta={stats.todayDelta} />
        <Stat label={t("prayAdmin.activeUsers")} value={stats.activeNow.toLocaleString()} delta={stats.activeDelta} />
        <Stat label={t("prayAdmin.avgStreak")} value={t("prayAdmin.daysShort", { n: stats.avg })} delta={null} />
      </div>

      <VerseOfDayEditor />

      <section>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-2xl font-semibold text-[#111827]">{t("prayAdmin.reminderTimes")}</h2>
          <button onClick={() => setEditing(null)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#1E40AF] text-white font-semibold tracking-wide shadow hover:bg-[#1B2E6B]">
            <Plus size={16} /> {t("prayAdmin.addNew")}
          </button>
        </div>
        {prayers.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-10 text-center text-[#9CA3AF]">
            {t("prayAdmin.noReminders")}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-6 stagger">
            {prayers.map((p) => (
              <ReminderCard
                key={p.id}
                p={p}
                onToggle={(v) => { upsert({ ...p, enabled: v }); patch(p, { enabled: v }, v ? t("prayAdmin.turnedOn", { name: prayerName(p) }) : t("prayAdmin.pausedToast", { name: prayerName(p) })); }}
                onTime={(t) => { upsert({ ...p, time: t }); patch(p, { time: t }, i18n.t("prayAdmin.moved", { name: prayerName(p), time: formatTime12(t) })); }}
                onEdit={() => setEditing(p)}
                onDelete={() => setDeleting(p)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Monitoring (Spiritual Father) */}
      {isSuperAdmin && (
        <section className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-[#F3F4F6] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-[#111827]">{t("prayAdmin.progress")}</h2>
              <p className="text-xs text-[#6B7280]">{t("prayAdmin.progressHint")}</p>
            </div>
            <div className="flex gap-2">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("ann.searchMember")}
                  className="pl-8 pr-3 py-2 rounded-lg border border-[#E5E7EB] text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2E6B]/15" />
              </div>
              <button onClick={exportCsv} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#E5E7EB] text-sm font-semibold text-[#374151] hover:bg-[#EEF1F8]">
                <Download size={14} /> {t("events.export")}
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#F3F4F6] text-left text-[12px] font-bold tracking-wider uppercase text-[#6B7280]">
                  <th className="px-6 py-3">{t("status.member")}</th>
                  {enabledPrayers.map((p) => <th key={p.id} className="px-3 py-3 text-center whitespace-nowrap">{prayerName(p).replace(" Prayer", "")}</th>)}
                  <th className="px-3 py-3">{t("plan.streak")}</th>
                  <th className="px-3 py-3">{t("memberDash.prayers")}</th>
                  <th className="px-3 py-3">{t("prayAdmin.lastPrayed")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {shown.length === 0 ? (
                  <tr><td colSpan={enabledPrayers.length + 4} className="px-6 py-10 text-center text-[#9CA3AF]">{t("ann.noMember")}</td></tr>
                ) : shown.map((r) => (
                  <tr key={r.uid} className="hover:bg-[#F9FAFB]">
                    <td className="px-6 py-3 font-medium text-[#111827]">{r.name}</td>
                    {enabledPrayers.map((p) => (
                      <td key={p.id} className="px-3 py-3 text-center">
                        {r.today.has(prayerKey(p))
                          ? <span className="inline-block w-5 h-5 rounded-full bg-[#DCFCE7] text-[#15803D] text-xs leading-5">✓</span>
                          : <span className="inline-block w-5 h-5 rounded-full bg-[#F3F4F6]" />}
                      </td>
                    ))}
                    <td className="px-3 py-3 text-[#1B2E6B] font-semibold">🔥 {r.streak}d</td>
                    <td className="px-3 py-3 text-[#4B5563]">{r.total}</td>
                    <td className="px-3 py-3 text-[#4B5563]">{r.last ? r.last.toLocaleDateString(dateLocale(), { month: "short", day: "numeric" }) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {editing !== undefined && (
        <PrayerModal prayer={editing} onClose={() => setEditing(undefined)} onSaved={upsert} />
      )}

      {deleting && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setDeleting(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <p className="text-lg font-semibold text-[#111827]">{t("prayAdmin.deleteTitle", { name: prayerName(deleting) })}</p>
            <p className="text-sm text-[#6B7280] mt-1.5">{t("prayAdmin.deleteHint")}</p>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setDeleting(null)} className="flex-1 py-2.5 rounded-xl border border-[#E5E7EB] text-sm font-semibold text-[#374151] hover:bg-[#EEF1F8]">{t("common.cancel")}</button>
              <button onClick={confirmDelete} className="flex-1 py-2.5 rounded-xl bg-[#DC2626] text-white text-sm font-semibold hover:bg-[#B91C1C]">{t("common.delete")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
