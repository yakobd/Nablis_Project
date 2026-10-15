"use client";
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, getDocs, onSnapshot, query, where } from "firebase/firestore";
import { PlusCircle, CalendarDays, CalendarClock, XCircle, History, Clock, X } from "lucide-react";
import {
  db, useAuth, notify, closeAppointment, formatTime12, serviceLabel, toIsoDate, SESSION_MINUTES,
  type Appointment,
} from "@/lib/firebase";
import { Pagination } from "@/components/ui/Pagination";
import { MiniCalendar, LegendDot, type DayMark } from "@/components/ui/MiniCalendar";
import { useToast } from "@/components/ui/Toast";
import { fmtDate, ServiceGlyph, Spinner } from "./shared";
import { useTranslation } from "@nablis/i18n";

const PAGE_SIZE = 5;

const BADGE: Record<string, { label: string; className: string }> = {
  pending:   { label: "AWAITING APPROVAL", className: "bg-[#FEF9C3] text-[#A16207] border-[#FDE68A]" },
  confirmed: { label: "CONFIRMED",         className: "bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]" },
  completed: { label: "COMPLETED",         className: "bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]" },
  rejected:  { label: "NOT APPROVED",      className: "bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]" },
  cancelled: { label: "CANCELLED",         className: "bg-[#F3F4F6] text-[#6B7280] border-[#E5E7EB]" },
};

function isPast(a: Appointment) {
  return (a.date?.toDate?.().getTime() ?? 0) < Date.now();
}
function displayStatus(a: Appointment) {
  return a.status === "confirmed" && isPast(a) ? "completed" : a.status;
}

function SessionCard({ a, onCancel }: { a: Appointment; onCancel?: () => void }) {
  const { t } = useTranslation();
  const badge = BADGE[displayStatus(a)] ?? BADGE.cancelled;
  const canChange = !isPast(a) && (a.status === "pending" || a.status === "confirmed");
  return (
    <div className="flex gap-4 px-6 py-6 border-b border-[#F3F4F6] last:border-b-0">
      <div className="w-12 h-12 rounded-full bg-[#EEF1F8] flex items-center justify-center text-[#1B2E6B] flex-shrink-0">
        <ServiceGlyph value={a.serviceType} size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[17px] font-semibold text-[#111827]">{serviceLabel(a.serviceType)}</p>
          <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-bold tracking-wide whitespace-nowrap ${badge.className}`}>{t(`apptBadge.${displayStatus(a) in BADGE ? displayStatus(a) : "cancelled"}`)}</span>
        </div>
        <p className="flex items-center gap-1.5 text-sm text-[#6B7280] mt-0.5">
          <CalendarDays size={13} />
          {fmtDate(a.date, { weekday: "long", month: "short", day: "numeric", year: "numeric" })} • {formatTime12(a.time) || "—"}
        </p>
        {a.privateNote && (
          <p className="mt-3 bg-[#F9FAFB] border border-[#F3F4F6] rounded-lg px-3 py-2.5 text-[13px] text-[#4B5563] italic line-clamp-2">
            &ldquo;{a.privateNote}&rdquo;
          </p>
        )}
        {canChange && onCancel && (
          <div className="flex gap-5 mt-3 text-[13px] font-semibold">
            <Link href={`/appointment/book?reschedule=${a.id}`} className="flex items-center gap-1 text-[#1B2E6B] hover:underline">
              <CalendarClock size={14} /> {t("appt.reschedule")}
            </Link>
            <button onClick={onCancel} className="flex items-center gap-1 text-[#DC2626] hover:underline">
              <XCircle size={14} /> {t("appt.cancelSession")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function MemberAppointments() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const toast = useToast();
  const [appts, setAppts]     = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState<"upcoming" | "past">("upcoming");
  const [page, setPage]       = useState(1);
  const [cancelling, setCancelling] = useState<Appointment | null>(null);
  const [busy, setBusy]       = useState(false);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(query(collection(db, "appointments"), where("memberId", "==", user.id)), (snap) => {
      setAppts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Appointment)));
      setLoading(false);
    }, () => setLoading(false));
  }, [user]);

  useEffect(() => { setPage(1); }, [tab]);

  const time = (a: Appointment) => a.date?.toMillis?.() ?? 0;
  const upcoming = appts
    .filter((a) => !isPast(a) && (a.status === "pending" || a.status === "confirmed"))
    .sort((a, b) => time(a) - time(b));
  const past = appts
    .filter((a) => isPast(a) || a.status === "cancelled" || a.status === "rejected")
    .sort((a, b) => time(b) - time(a));
  const list = tab === "upcoming" ? upcoming : past;
  const rows = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const completed = appts.filter((a) => a.status === "confirmed" && isPast(a));
  const last30 = completed.filter((a) => time(a) > Date.now() - 30 * 86400000).length;
  const hours = Math.round((completed.length * SESSION_MINUTES) / 60);

  const marks = useMemo(() => {
    const m: Record<string, DayMark> = {};
    for (const a of tab === "upcoming" ? upcoming : completed) {
      if (!a.date) continue;
      const iso = toIsoDate(a.date.toDate());
      m[iso] = tab === "past" ? "completed" : a.status === "confirmed" ? "confirmed" : (m[iso] ?? "pending");
    }
    return m;
  }, [appts, tab]); // eslint-disable-line react-hooks/exhaustive-deps

  async function confirmCancel() {
    if (!cancelling || !user) return;
    setBusy(true);
    try {
      await closeAppointment(cancelling, "cancelled");
      toast({ message: t("appt.cancelled") });
      // Let the Spiritual Father know the time is free again.
      const fathers = await getDocs(query(collection(db, "users"), where("role", "==", "super_admin")));
      await notify(fathers.docs.map((d) => ({
        userId: d.id, type: "appointment_cancelled", link: "/appointment",
        title: "Appointment cancelled",
        description: `${user.displayName || "A member"} cancelled their ${serviceLabel(cancelling.serviceType)} session on ${fmtDate(cancelling.date)}.`,
      })));
      setCancelling(null);
    } catch {
      toast({ type: "error", message: t("appt.cancelError") });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Header card */}
      <div className="bg-white rounded-sm shadow-sm px-7 pt-7">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <h1 className="page-title-sm">{t("appt.myTitle")}</h1>
            <p className="!text-[#6B7280]">{t("appt.mySubtitle")}</p>
          </div>
          <Link href="/appointment/book"
            className="inline-flex items-center gap-2 bg-[#F5C518] text-[#1B2E6B] font-semibold px-5 py-3 rounded-xl shadow-[0_8px_20px_-10px_rgba(245,197,24,0.9)] hover:bg-[#e6b800] whitespace-nowrap">
            <PlusCircle size={18} /> {t("appt.bookNew")}
          </Link>
        </div>
        <div className="flex gap-2 mt-6 border-b border-[#E5E7EB]">
          {(["upcoming", "past"] as const).map((tb) => (
            <button key={tb} onClick={() => setTab(tb)}
              className={`px-6 py-3 text-sm font-semibold border-b-2 -mb-px transition-colors ${tab === tb ? "border-[#1B2E6B] text-[#1B2E6B]" : "border-transparent text-[#6B7280] hover:text-[#1B2E6B]"}`}>
              {tb === "upcoming" ? t("appt.upcomingTab", { count: upcoming.length }) : t("appt.pastTab")}
            </button>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_290px] gap-6 items-start">
        {/* Sessions */}
        <div>
          <h2 className="text-[17px] font-semibold text-[#111827] mb-2">{tab === "upcoming" ? t("appt.scheduled") : t("appt.previous")}</h2>
          <div className="bg-white shadow-sm border border-[#E5E7EB] overflow-hidden">
            {loading ? (
              <div className="py-16"><Spinner /></div>
            ) : rows.length === 0 ? (
              <div className="py-14 text-center text-[#9CA3AF]">
                <CalendarDays size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">{tab === "upcoming" ? t("appt.noUpcoming") : t("appt.noPrevious")}</p>
                {tab === "upcoming" && (
                  <Link href="/appointment/book" className="inline-flex mt-4 items-center gap-1.5 bg-[#F5C518] text-[#1B2E6B] font-semibold text-sm px-4 py-2 rounded-xl hover:bg-[#e6b800]">
                    <PlusCircle size={15} /> {t("appt.bookSession")}
                  </Link>
                )}
              </div>
            ) : (
              rows.map((a) => <SessionCard key={a.id} a={a} onCancel={() => setCancelling(a)} />)
            )}
            <Pagination page={page} pageSize={PAGE_SIZE} total={list.length} onPage={setPage} />
          </div>
        </div>

        {/* Calendar + journey */}
        <div className="space-y-6 lg:pt-9">
          <MiniCalendar
            marks={marks}
            legend={tab === "upcoming"
              ? <><LegendDot color="#F5C518" label={t("appt.legendPending")} /><LegendDot color="#1B2E6B" label={t("appt.legendConfirmed")} /></>
              : <p className="text-[11px] text-[#6B7280] text-center">{t("appt.legendPast")}</p>}
          />
          {tab === "past" && (
            <div className="bg-[#1B2E6B] rounded-2xl p-5 text-white shadow-lg animate-scale-in">
              <p className="text-sm text-white/80">{t("appt.journey", { year: new Date().getFullYear() })}</p>
              <p className="mt-1"><span className="text-4xl font-bold">{completed.length}</span> <span className="text-white/80">{t("appt.sessionsCompleted")}</span></p>
              <div className="mt-4 space-y-2.5">
                <div className="flex items-center justify-between bg-white/10 rounded-xl px-4 py-3 text-sm">
                  <span className="flex items-center gap-2"><History size={16} className="text-[#F5C518]" /> {t("appt.last30")}</span>
                  <span className="text-[#F5C518] font-semibold">+{last30}</span>
                </div>
                <div className="flex items-center justify-between bg-white/10 rounded-xl px-4 py-3 text-sm">
                  <span className="flex items-center gap-2"><Clock size={16} className="text-[#F5C518]" /> {t("appt.totalHours")}</span>
                  <span className="text-[#F5C518] font-semibold">{hours}h</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Cancel confirmation */}
      {cancelling && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => !busy && setCancelling(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 relative" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setCancelling(null)} className="absolute top-4 right-4 text-[#9CA3AF]" aria-label={t("common.close")}><X size={16} /></button>
            <p className="text-lg font-semibold text-[#111827]">{t("appt.cancelTitle")}</p>
            <p className="text-sm text-[#6B7280] mt-1.5">
              {t("appt.cancelBody", { service: serviceLabel(cancelling.serviceType), date: fmtDate(cancelling.date, { weekday: "long", month: "short", day: "numeric" }), time: formatTime12(cancelling.time) })}
            </p>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setCancelling(null)} className="flex-1 py-2.5 rounded-xl border border-[#E5E7EB] text-sm font-semibold text-[#374151] hover:bg-[#EEF1F8]">{t("appt.keep")}</button>
              <button onClick={confirmCancel} disabled={busy} className="flex-1 py-2.5 rounded-xl bg-[#DC2626] text-white text-sm font-semibold hover:bg-[#B91C1C] disabled:opacity-60">
                {busy ? t("appt.cancelling") : t("appt.cancelConfirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
