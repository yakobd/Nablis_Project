"use client";
import React, { useEffect, useMemo, useState } from "react";
import {
  collection, doc, getDoc, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc,
} from "firebase/firestore";
import { Calendar, CalendarCog, Search, ChevronsUpDown, CheckCircle2, XCircle, X, Lock } from "lucide-react";
import {
  db, useAuth, useAvailability, notify, closeAppointment, formatTime12, serviceLabel,
  type Appointment, type User,
} from "@/lib/firebase";
import { Pagination } from "@/components/ui/Pagination";
import { AvailabilityModal } from "./AvailabilityModal";
import { useToast } from "@/components/ui/Toast";
import {
  fmtDate, timeAgo, initials, ServiceGlyph, servicePillClass, StatusPill, Spinner,
} from "./shared";
import { PageTitle } from "@/components/PageTitle";
import { useTranslation } from "@nablis/i18n";

const PAGE_SIZE = 10;
type SortKey = "memberName" | "serviceType" | "date" | "time" | "status";
type StatusFilter = "pending" | "confirmed" | "closed" | "all";

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "confirmed", label: "Confirmed" },
  { key: "closed", label: "Rejected / Cancelled" },
  { key: "all", label: "All" },
];

// ── Review modal ──────────────────────────────────────────────────────────────
function ReviewModal({
  appt, canDecide, onClose, onDecide, busy,
}: {
  appt: Appointment;
  canDecide: boolean;
  onClose: () => void;
  onDecide: (status: "confirmed" | "rejected") => void;
  busy: boolean;
}) {
  const { t: tr } = useTranslation();
  const [member, setMember] = useState<User | null>(null);
  useEffect(() => {
    getDoc(doc(db, "users", appt.memberId)).then((s) => s.exists() && setMember({ id: s.id, ...s.data() } as User)).catch(() => {});
  }, [appt.memberId]);

  const name = member?.displayName || appt.memberName || "Member";
  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-[600px] shadow-2xl overflow-hidden relative" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-[#9CA3AF] hover:text-[#374151]" aria-label={tr("common.close")}><X size={18} /></button>

        <div className="flex items-center gap-5 px-8 py-7">
          {member?.photoURL ? (
            <img src={member.photoURL} alt="" className="w-20 h-20 rounded-full object-cover ring-4 ring-[#EEF1F8]" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-[#EEF1F8] ring-4 ring-white shadow flex items-center justify-center text-2xl font-bold text-[#1B2E6B]">
              {initials(name)}
            </div>
          )}
          <div>
            <p className="text-2xl font-semibold text-[#111827]">{name}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="px-2 py-0.5 rounded bg-[#E0EAFF] text-[#1D4ED8] text-[11px] font-bold uppercase">{member?.role === "admin" ? tr("status.admin") : tr("status.member")}</span>
              {member?.createdAt && <span className="text-sm text-[#6B7280]">{tr("apptAdmin.joined", { when: timeAgo(member.createdAt) })}</span>}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 border-y border-[#F3F4F6]">
          <div className="px-6 py-5 border-r border-[#F3F4F6]">
            <p className="text-[11px] font-bold tracking-widest text-[#6B7280] mb-1.5">{tr("apptAdmin.serviceRequested")}</p>
            <p className="flex items-center gap-2 text-[#111827] font-semibold"><ServiceGlyph value={appt.serviceType} className="text-[#1B2E6B]" /> {serviceLabel(appt.serviceType)}</p>
          </div>
          <div className="px-6 py-5">
            <p className="text-[11px] font-bold tracking-widest text-[#6B7280] mb-1.5">{tr("apptAdmin.dateTime")}</p>
            <p className="flex items-center gap-2 text-[#111827] font-semibold">
              <Calendar size={18} className="text-[#1B2E6B]" /> {fmtDate(appt.date, { month: "short", day: "numeric" })}, {formatTime12(appt.time) || "—"}
            </p>
          </div>
        </div>

        <div className="bg-[#F8FAFC] px-7 py-6">
          <p className="flex items-center gap-1.5 text-[12px] font-bold tracking-widest text-[#4B5563] mb-3"><Lock size={12} /> {tr("apptAdmin.privateNote")}</p>
          <div className="bg-white rounded-xl border border-[#EEF1F8] px-5 py-4 text-[15px] text-[#374151] leading-relaxed min-h-[64px]">
            {canDecide
              ? (appt.privateNote ? `“${appt.privateNote}”` : <span className="text-[#9CA3AF]">{tr("apptAdmin.noNote")}</span>)
              : <span className="text-[#9CA3AF]">{tr("apptAdmin.noteHidden")}</span>}
          </div>
        </div>

        <div className="px-7 py-6 flex flex-col sm:flex-row gap-3">
          {canDecide && appt.status === "pending" ? (
            <>
              <button onClick={() => onDecide("confirmed")} disabled={busy}
                className="flex-1 flex items-center justify-center gap-2 bg-[#1B2E6B] text-white font-semibold py-3.5 rounded-xl hover:bg-[#162554] shadow-[0_10px_24px_-12px_rgba(27,46,107,0.8)] disabled:opacity-60">
                <CheckCircle2 size={18} /> {tr("apptAdmin.approve")}
              </button>
              <button onClick={() => onDecide("rejected")} disabled={busy}
                className="flex-1 flex items-center justify-center gap-2 border-2 border-[#1B2E6B] text-[#1B2E6B] font-semibold py-3 rounded-xl hover:bg-[#EEF1F8] disabled:opacity-60">
                <XCircle size={18} /> {tr("apptAdmin.reject")}
              </button>
            </>
          ) : (
            <div className="flex items-center justify-between w-full">
              <StatusPill status={appt.status} />
              <button onClick={onClose} className="px-5 py-2.5 rounded-xl border border-[#E5E7EB] text-sm font-semibold text-[#374151] hover:bg-[#EEF1F8]">{tr("common.close")}</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Admin / Spiritual Father view ─────────────────────────────────────────────
export function AdminAppointments() {
  const { t: tr } = useTranslation();
  const { role } = useAuth();
  const canDecide = role === "super_admin";
  const toast = useToast();
  const [appts, setAppts]     = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus]   = useState<StatusFilter>("pending");
  const [from, setFrom]       = useState("");
  const [to, setTo]           = useState("");
  const [search, setSearch]   = useState("");
  const [sort, setSort]       = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "date", dir: 1 });
  const [page, setPage]       = useState(1);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [busy, setBusy]       = useState(false);
  const [editingAvailability, setEditingAvailability] = useState(false);
  const { availability } = useAvailability();

  useEffect(() => onSnapshot(
    query(collection(db, "appointments"), orderBy("date", "asc")),
    (snap) => { setAppts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Appointment))); setLoading(false); },
    () => setLoading(false)
  ), []);

  useEffect(() => { setPage(1); }, [status, from, to, search, sort]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const fromT = from ? new Date(`${from}T00:00`).getTime() : -Infinity;
    const toT = to ? new Date(`${to}T23:59`).getTime() : Infinity;
    const list = appts.filter((a) => {
      if (status === "pending" && a.status !== "pending") return false;
      if (status === "confirmed" && a.status !== "confirmed") return false;
      if (status === "closed" && !["rejected", "cancelled"].includes(a.status)) return false;
      const t = a.date?.toDate?.().getTime() ?? 0;
      if (t < fromT || t > toT) return false;
      return !q || (a.memberName ?? "").toLowerCase().includes(q);
    });
    const val = (a: Appointment): string | number => {
      switch (sort.key) {
        case "date": return a.date?.toMillis?.() ?? 0;
        case "time": return a.time ?? "";
        case "serviceType": return serviceLabel(a.serviceType);
        default: return String(a[sort.key] ?? "").toLowerCase();
      }
    };
    return [...list].sort((x, y) => (val(x) > val(y) ? 1 : val(x) < val(y) ? -1 : 0) * sort.dir);
  }, [appts, status, from, to, search, sort]);

  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const reviewing = appts.find((a) => a.id === reviewId) ?? null;
  const counts = {
    pending: appts.filter((a) => a.status === "pending").length,
    confirmed: appts.filter((a) => a.status === "confirmed").length,
  };

  async function decide(appt: Appointment, next: "confirmed" | "rejected") {
    setBusy(true);
    try {
      if (next === "rejected") await closeAppointment(appt, "rejected");
      else await updateDoc(doc(db, "appointments", appt.id), { status: "confirmed", updatedAt: serverTimestamp() });
      await notify({
        userId: appt.memberId,
        type: next === "confirmed" ? "appointment_confirmed" : "appointment_rejected",
        title: next === "confirmed" ? "Appointment Confirmed" : "Appointment Not Approved",
        description: next === "confirmed"
          ? `Your ${serviceLabel(appt.serviceType)} appointment on ${fmtDate(appt.date)} at ${formatTime12(appt.time)} has been confirmed.`
          : `Your ${serviceLabel(appt.serviceType)} appointment on ${fmtDate(appt.date)} was not approved. Please choose another time.`,
        link: "/appointment",
      });
      setReviewId(null);
      toast({
        message: next === "confirmed" ? tr("apptAdmin.approvedToast") : tr("apptAdmin.rejectedToast"),
        actionLabel: tr("prof.undo"),
        onAction: () => undo(appt),
        linkLabel: tr("apptAdmin.viewAppt"),
        onLink: () => setReviewId(appt.id),
      });
    } catch {
      toast({ type: "error", message: tr("apptAdmin.updateError") });
    } finally {
      setBusy(false);
    }
  }

  // Puts the booking back to pending (re-claiming its slot if it was released).
  async function undo(appt: Appointment) {
    try {
      await updateDoc(doc(db, "appointments", appt.id), { status: "pending", updatedAt: serverTimestamp() });
      if (appt.slotId) {
        await setDoc(doc(db, "appointmentSlots", appt.slotId), {
          memberId: appt.memberId, appointmentId: appt.id, createdAt: serverTimestamp(),
        }).catch(() => {});
      }
      await notify({
        userId: appt.memberId, type: "appointment_pending", link: "/appointment",
        title: "Appointment back under review",
        description: `Your ${serviceLabel(appt.serviceType)} request is being reviewed again.`,
      });
    } catch {
      toast({ type: "error", message: tr("apptAdmin.undoFailed") });
    }
  }

  function SortHeader({ k, label }: { k: SortKey; label: string }) {
    return (
      <button onClick={() => setSort((s) => ({ key: k, dir: s.key === k ? (s.dir === 1 ? -1 : 1) : 1 }))}
        className={`flex items-center gap-1.5 text-[12px] font-bold tracking-wider uppercase ${sort.key === k ? "text-[#1B2E6B]" : "text-[#6B7280]"} hover:text-[#1B2E6B]`}>
        {label} <ChevronsUpDown size={13} />
      </button>
    );
  }

  return (
    <div className="space-y-7">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <PageTitle id={canDecide ? "appointmentsAdmin" : "appointmentsView"} />
        </div>
        {canDecide && (
          <button onClick={() => setEditingAvailability(true)}
            className="flex items-center gap-2 self-start sm:self-auto bg-white text-[#1B2E6B] font-semibold px-5 py-3 rounded-xl shadow-sm hover:shadow-md">
            <CalendarCog size={18} />
            {tr("avail.title")}
            <span className={`text-[11px] px-2 py-0.5 rounded-full ${availability.enabled ? "bg-[#DCFCE7] text-[#15803D]" : "bg-[#F3F4F6] text-[#6B7280]"}`}>
              {availability.enabled ? tr("apptAdmin.custom") : tr("apptAdmin.default")}
            </span>
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-4 lg:items-center">
        <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-3 flex flex-col sm:flex-row gap-3 sm:items-center lg:w-[700px]">
          <div className="flex items-center gap-3 border border-[#E5E7EB] rounded-xl px-3 py-1.5">
            <Calendar size={16} className="text-[#1B2E6B]" />
            <div>
              <p className="text-[9px] font-bold tracking-widest text-[#6B7280]">{tr("apptAdmin.dateRange")}</p>
              <div className="flex items-center gap-1 text-[13px] font-semibold text-[#1B2E6B]">
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="bg-transparent w-[118px] focus:outline-none" aria-label={tr("apptAdmin.from")} />
                <span>—</span>
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="bg-transparent w-[118px] focus:outline-none" aria-label={tr("apptAdmin.to")} />
              </div>
            </div>
          </div>
          <div className="hidden sm:block w-px h-10 bg-[#E5E7EB]" />
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tr("apptAdmin.search")}
              className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-[#E5E7EB] text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2E6B]/15" />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {STATUS_TABS.map((t) => (
            <button key={t.key} onClick={() => setStatus(t.key)}
              className={`px-4 py-2 rounded-full text-sm font-medium ${status === t.key ? "bg-[#1B2E6B] text-white shadow" : "bg-white text-[#374151] hover:bg-[#EEF1F8]"}`}>
              {tr(`apptAdmin.tab.${t.key}`)}
              {t.key === "pending" && counts.pending > 0 && <span className="ml-1.5 px-1.5 rounded-full bg-[#F5C518] text-[#1B2E6B] text-[11px] font-bold">{counts.pending}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16"><Spinner /></div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-[#9CA3AF]">
            <Calendar size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">{tr("apptAdmin.noMatch")}</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#F3F4F6]">
                    <th className="text-left px-6 py-4"><SortHeader k="memberName" label={tr("testimony.memberName")} /></th>
                    <th className="text-left px-4 py-4"><SortHeader k="serviceType" label={tr("apptAdmin.requestedService")} /></th>
                    <th className="text-left px-4 py-4"><SortHeader k="date" label={tr("events.date")} /></th>
                    <th className="text-left px-4 py-4"><SortHeader k="time" label={tr("apptAdmin.time")} /></th>
                    <th className="text-left px-4 py-4"><SortHeader k="status" label={tr("study.status")} /></th>
                    <th className="text-left px-4 py-4 text-[12px] font-bold tracking-wider uppercase text-[#6B7280]">{tr("apptAdmin.actions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3F4F6]">
                  {pageRows.map((a) => (
                    <tr key={a.id} className="hover:bg-[#F9FAFB]">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <span className="w-9 h-9 rounded-full bg-[#EEF1F8] flex items-center justify-center text-xs font-bold text-[#4B5563]">{initials(a.memberName)}</span>
                          <span className="text-[#111827] text-[15px] font-medium">{a.memberName ?? "—"}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`px-3 py-1 rounded-md text-xs font-semibold ${servicePillClass(a.serviceType)}`}>{serviceLabel(a.serviceType)}</span>
                      </td>
                      <td className="px-4 py-4 text-sm text-[#4B5563] whitespace-nowrap">{fmtDate(a.date)}</td>
                      <td className="px-4 py-4 text-sm text-[#4B5563] whitespace-nowrap">
                        {formatTime12(a.time) || "—"}
                        {a.customTime && (
                          <span className="ml-2 px-1.5 py-0.5 rounded bg-[#FFF8DB] text-[#A16207] text-[10px] font-bold" title={tr("apptAdmin.customHint")}>{tr("apptAdmin.customBadge")}</span>
                        )}
                      </td>
                      <td className="px-4 py-4"><StatusPill status={a.status} /></td>
                      <td className="px-4 py-4">
                        <button onClick={() => setReviewId(a.id)}
                          className="px-5 py-2 rounded-lg bg-[#1B2E6B] text-white text-xs font-semibold hover:bg-[#162554]">
                          {canDecide && a.status === "pending" ? tr("testimony.review") : tr("common.view")}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPage={setPage} />
          </>
        )}
      </div>

      {editingAvailability && (
        <AvailabilityModal
          current={availability}
          onClose={() => setEditingAvailability(false)}
          onSaved={() => { setEditingAvailability(false); toast({ message: tr("avail.saved") }); }}
        />
      )}

      {reviewing && (
        <ReviewModal
          appt={reviewing}
          canDecide={canDecide}
          busy={busy}
          onClose={() => setReviewId(null)}
          onDecide={(s) => decide(reviewing, s)}
        />
      )}
    </div>
  );
}

