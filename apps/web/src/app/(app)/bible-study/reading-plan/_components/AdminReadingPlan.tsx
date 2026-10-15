"use client";
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, deleteDoc, doc, getDocs, onSnapshot, query, where, writeBatch } from "firebase/firestore";
import { ArrowLeft, Upload, Users, Target, CalendarCheck2, TrendingUp, Search, Download, Trash2, CheckCircle2, Eye } from "lucide-react";
import {
  db, isoToday, monthlyPerformance, planProgress, readingStreak,
  type ReadingPlan, type ReadingProgress, type User,
} from "@/lib/firebase";
import { Pagination } from "@/components/ui/Pagination";
import { useToast } from "@/components/ui/Toast";
import { MonthlyChart } from "./MonthlyChart";
import { PlanUploadModal } from "./PlanUploadModal";
import { MemberReadingPlan } from "./MemberReadingPlan";
import { PageTitle } from "@/components/PageTitle";
import { useTranslation } from "@nablis/i18n";
import { dateLocale } from "@/lib/locale";

const PAGE = 10;

export function AdminReadingPlan({ plans }: { plans: ReadingPlan[] }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [progress, setProgress] = useState<ReadingProgress[]>([]);
  const [members, setMembers] = useState<User[]>([]);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"behind" | "best" | "name">("behind");
  const [page, setPage] = useState(1);
  const [preview, setPreview] = useState(false);
  const today = isoToday();

  const plan = plans.find((p) => p.id === selectedId) ?? plans.find((p) => p.active) ?? plans[0] ?? null;

  useEffect(() => {
    getDocs(query(collection(db, "users"), where("status", "==", "active")))
      .then((s) => setMembers(s.docs.map((d) => ({ id: d.id, ...d.data() } as User)).filter((u) => u.role === "member")))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!plan) return;
    return onSnapshot(query(collection(db, "readingProgress"), where("planId", "==", plan.id)), (snap) => {
      setProgress(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ReadingProgress)));
    }, () => {});
  }, [plan?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = useMemo(() => {
    if (!plan) return [];
    const byUser = new Map(progress.map((p) => [p.userId, p]));
    return members.map((m) => {
      const p = byUser.get(m.id);
      const completed = p?.completed ?? [];
      const pr = planProgress(plan, completed, today);
      return {
        member: m,
        started: !!p && completed.length > 0,
        readToday: completed.includes(today),
        streak: readingStreak(plan, completed, today),
        lastRead: completed.length ? [...completed].sort().pop()! : null,
        ...pr,
      };
    });
  }, [plan, progress, members, today]);

  const stats = useMemo(() => {
    const started = rows.filter((r) => r.started);
    const avg = started.length ? Math.round(started.reduce((s, r) => s + r.onTrackPct, 0) / started.length) : 0;
    return {
      readers: started.length,
      avg,
      onTrack: rows.filter((r) => r.started && r.onTrackPct >= 80).length,
      today: rows.filter((r) => r.readToday).length,
    };
  }, [rows]);

  // Community monthly performance: all readers' completions over all due readings.
  const community = useMemo(() => {
    if (!plan) return [];
    const started = progress.filter((p) => (p.completed ?? []).length > 0);
    const per = started.map((p) => monthlyPerformance(plan, p.completed ?? [], today));
    return Array.from({ length: 12 }, (_, month) => {
      const due = per.reduce((s, m) => s + m[month].due, 0);
      const done = per.reduce((s, m) => s + m[month].done, 0);
      return { month, due, done, pct: due ? Math.round((done / due) * 100) : null };
    });
  }, [plan, progress, today]);

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter((r) => !q || `${r.member.displayName} ${r.member.email}`.toLowerCase().includes(q))
      .sort((a, b) => sort === "name" ? (a.member.displayName || "").localeCompare(b.member.displayName || "")
        : sort === "best" ? b.onTrackPct - a.onTrackPct || b.done - a.done
        : Number(a.started) - Number(b.started) || a.onTrackPct - b.onTrackPct);
  }, [rows, search, sort]);

  async function activate(p: ReadingPlan) {
    const batch = writeBatch(db);
    plans.forEach((x) => batch.update(doc(db, "readingPlans", x.id), { active: x.id === p.id }));
    await batch.commit().then(() => toast({ message: t("planAdmin.activated", { title: p.title }) })).catch(() => toast({ message: t("planAdmin.changeError"), type: "error" }));
  }

  async function remove(p: ReadingPlan) {
    if (!confirm(t("planAdmin.deleteConfirm", { title: p.title }))) return;
    await deleteDoc(doc(db, "readingPlans", p.id)).then(() => { setSelectedId(null); toast({ message: t("planAdmin.deleted") }); })
      .catch(() => toast({ message: t("planAdmin.deleteError"), type: "error" }));
  }

  function exportCsv() {
    if (!plan) return;
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [
      ["Member", "Email", "On track %", "Year %", "Readings done", "Due so far", "Streak", "Last read"],
      ...list.map((r) => [r.member.displayName, r.member.email, r.onTrackPct, r.overallPct, r.done, r.due, r.streak, r.lastRead ?? ""]),
    ].map((row) => row.map(esc).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `reading-progress-${plan.year}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  if (preview) {
    return (
      <div className="space-y-4">
        <button onClick={() => setPreview(false)} className="flex items-center gap-1.5 text-sm font-semibold text-[#1E3A8A]"><ArrowLeft size={16} /> {t("planAdmin.back")}</button>
        <MemberReadingPlan plan={plan} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <Link href="/bible-study" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1E3A8A] mb-3"><ArrowLeft size={16} /> {t("nav.bibleStudy")}</Link>
          <PageTitle id="readingPlanAdmin" />
        </div>
        <div className="flex gap-3 self-start lg:self-auto">
          {plan && <button onClick={() => setPreview(true)} className="flex items-center gap-2 px-5 py-3 rounded-full bg-white text-[#1E3A8A] text-sm font-semibold shadow-sm hover:bg-[#EEF1F8]"><Eye size={15} /> {t("planAdmin.memberView")}</button>}
          <button onClick={() => setUploading(true)} className="flex items-center gap-2 px-6 py-3 rounded-full bg-[#1E3A8A] text-white text-sm font-semibold shadow-[0_10px_24px_-12px_rgba(30,58,138,0.9)] hover:bg-[#1B2E6B]">
            <Upload size={15} /> {t("planAdmin.upload")}
          </button>
        </div>
      </div>

      {plans.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center shadow-sm">
          <CalendarCheck2 size={36} className="mx-auto text-[#1E3A8A]/30" />
          <p className="text-[#111827] font-semibold mt-3">{t("mobile.noPlan")}</p>
          <p className="text-sm text-[#6B7280] mt-1">{t("planAdmin.emptyHint")}</p>
          <button onClick={() => setUploading(true)} className="mt-5 px-6 py-3 rounded-full bg-[#F5C518] text-[#1B2E6B] text-sm font-bold hover:bg-[#e6b800]">{t("planAdmin.createFirst")}</button>
        </div>
      ) : plan && (
        <>
          {/* Plans */}
          <div className="flex gap-3 overflow-x-auto pb-1">
            {plans.map((p) => (
              <button key={p.id} onClick={() => { setSelectedId(p.id); setPage(1); }}
                className={`flex-shrink-0 text-left rounded-2xl px-5 py-3.5 transition-all ${p.id === plan.id ? "bg-white shadow-md ring-2 ring-[#1E3A8A]" : "bg-white/60 hover:bg-white"}`}>
                <span className="flex items-center gap-2">
                  <span className="font-semibold text-[#111827]">{p.title}</span>
                  {p.active && <span className="px-2 py-0.5 rounded-full bg-[#DCFCE7] text-[#15803D] text-[10px] font-bold">{t("planAdmin.active")}</span>}
                </span>
                <span className="block text-xs text-[#6B7280] mt-0.5">{t("planAdmin.readingsYear", { n: p.entries.length, year: p.year })}</span>
              </button>
            ))}
          </div>

          {!plan.active && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#FFFBEB] rounded-2xl px-5 py-4 text-sm text-[#92400E]">
              <span>{t("planAdmin.inactiveHint")}</span>
              <div className="flex gap-2">
                <button onClick={() => activate(plan)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1E3A8A] text-white text-xs font-semibold"><CheckCircle2 size={14} /> {t("planAdmin.makeActive")}</button>
                <button onClick={() => remove(plan)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white text-[#DC2626] text-xs font-semibold"><Trash2 size={14} /> {t("common.delete")}</button>
              </div>
            </div>
          )}

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 stagger">
            {[
              { label: t("planAdmin.membersReading"), value: `${stats.readers}`, hint: t("planAdmin.ofMembers", { n: members.length }), Icon: Users, cls: "bg-[#EEF1F8] text-[#1E3A8A]" },
              { label: t("planAdmin.avg"), value: `${stats.avg}%`, hint: t("planAdmin.amongReaders"), Icon: Target, cls: "bg-[#DCFCE7] text-[#15803D]" },
              { label: t("planAdmin.onTrack80"), value: `${stats.onTrack}`, hint: t("planAdmin.members"), Icon: TrendingUp, cls: "bg-[#FEF3C7] text-[#B45309]" },
              { label: t("planAdmin.readToday"), value: `${stats.today}`, hint: new Date().toLocaleDateString(dateLocale(), { month: "short", day: "numeric" }), Icon: CalendarCheck2, cls: "bg-[#F3E8FF] text-[#7E22CE]" },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-2xl p-6 shadow-sm">
                <div className="flex items-start justify-between">
                  <p className="text-sm font-medium text-[#6B7280]">{s.label}</p>
                  <span className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.cls}`}><s.Icon size={18} /></span>
                </div>
                <p className="font-display text-4xl font-bold text-[#111827] mt-1">{s.value}</p>
                <p className="text-xs text-[#9CA3AF] mt-1">{s.hint}</p>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-3xl shadow-sm p-6 sm:p-8">
            <p className="text-lg font-semibold text-[#111827]">{t("planAdmin.community")}</p>
            <p className="text-sm text-[#6B7280] mb-6">{t("planAdmin.communityHint")}</p>
            <MonthlyChart data={community} title={t("planAdmin.community")} />
          </div>

          <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 px-6 py-5 border-b border-[#F3F4F6]">
              <p className="text-lg font-semibold text-[#111827]">{t("planAdmin.memberProgress")}</p>
              <div className="flex flex-wrap gap-2">
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                  <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder={t("msg.search")}
                    className="pl-9 pr-3 py-2 rounded-xl border border-[#E5E7EB] text-sm w-52 focus:outline-none focus:border-[#1E3A8A]" />
                </div>
                <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="px-3 py-2 rounded-xl border border-[#E5E7EB] text-sm cursor-pointer">
                  <option value="behind">{t("planAdmin.sortBehind")}</option>
                  <option value="best">{t("planAdmin.sortBest")}</option>
                  <option value="name">{t("planAdmin.sortName")}</option>
                </select>
                <button onClick={exportCsv} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#E5E7EB] text-sm text-[#374151] hover:bg-[#F9FAFB]"><Download size={14} /> CSV</button>
              </div>
            </div>
            {list.length === 0 ? (
              <p className="py-12 text-center text-sm text-[#9CA3AF]">{t("ann.noMember")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="bg-[#F9FAFB] text-left text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
                      <th className="px-6 py-3">{t("status.member")}</th>
                      <th className="px-4 py-3 w-[30%]">{t("memberDash.onTrack")}</th>
                      <th className="px-4 py-3">{t("planAdmin.year")}</th>
                      <th className="px-4 py-3">{t("plan.streak")}</th>
                      <th className="px-4 py-3">{t("planAdmin.lastRead")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F3F4F6]">
                    {list.slice((page - 1) * PAGE, page * PAGE).map((r) => (
                      <tr key={r.member.id} className="hover:bg-[#F9FAFB]">
                        <td className="px-6 py-3.5">
                          <Link href={`/settings/members/${r.member.id}`} className="font-medium text-[#111827] hover:text-[#1E3A8A]">{r.member.displayName || r.member.email}</Link>
                          {!r.started && <span className="ml-2 text-[10px] font-semibold text-[#9CA3AF] uppercase">{t("planAdmin.notStarted")}</span>}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-2 rounded-full bg-[#F3F4F6] overflow-hidden">
                              <div className="h-full rounded-full bg-[#1E3A8A] transition-all duration-700" style={{ width: `${r.started ? r.onTrackPct : 0}%` }} />
                            </div>
                            <span className="w-10 text-right font-semibold text-[#111827]">{r.started ? `${r.onTrackPct}%` : "—"}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-[#374151]">{r.overallPct}% <span className="text-[#9CA3AF] text-xs">({r.done}/{r.total})</span></td>
                        <td className="px-4 py-3.5 text-[#374151]">{r.streak ? `🔥 ${r.streak}` : "—"}</td>
                        <td className="px-4 py-3.5 text-[#6B7280]">{r.lastRead ? new Date(`${r.lastRead}T12:00:00`).toLocaleDateString(dateLocale(), { month: "short", day: "numeric" }) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="px-6 py-4 border-t border-[#F3F4F6]">
              <Pagination page={page} pageSize={PAGE} total={list.length} onPage={setPage} />
            </div>
          </div>
        </>
      )}

      {uploading && <PlanUploadModal plans={plans} onClose={() => setUploading(false)} />}
    </div>
  );
}
