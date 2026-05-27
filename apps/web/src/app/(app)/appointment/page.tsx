"use client";
import React, { useEffect, useState, useCallback } from "react";
import {
  collection, query, where, orderBy, getDocs, doc,
  updateDoc, addDoc, serverTimestamp, Timestamp,
} from "firebase/firestore";
import { db, useAuth } from "@/lib/firebase";
import {
  Calendar, X, CheckCircle, XCircle,
  ChevronLeft, ChevronRight, Plus,
} from "lucide-react";
import type { Appointment } from "@nablis/shared/firebase";

// ── helpers ───────────────────────────────────────────────────────────────────
function fmtDate(ts: Timestamp | null | undefined) {
  if (!ts) return "—";
  try { return ts.toDate().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
  catch { return "—"; }
}
function fmtDateIso(ts: Timestamp | null | undefined) {
  if (!ts) return "";
  try { return ts.toDate().toISOString().split("T")[0]; }
  catch { return ""; }
}
function countdown(ts: Timestamp | null | undefined, time?: string): string {
  if (!ts) return "";
  try {
    const d = ts.toDate();
    const now = new Date();
    const diffMs = d.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / 86400000);
    if (diffDays < 0) return "";
    if (diffDays === 0) return `Today at ${time || d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
    if (diffDays === 1) return "Tomorrow";
    return `In ${diffDays} days`;
  } catch { return ""; }
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    confirmed: "bg-green-50 text-green-700",
    pending:   "bg-yellow-50 text-yellow-700",
    rejected:  "bg-red-50 text-red-600",
  };
  const labels: Record<string, string> = {
    confirmed: "CONFIRMED",
    pending:   "AWAITING APPROVAL",
    rejected:  "REJECTED",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${map[status] ?? "bg-gray-100 text-gray-600"}`}>
      {labels[status] ?? status.toUpperCase()}
    </span>
  );
}

const SERVICE_ICONS: Record<string, string> = {
  confession: "🕊️",
  counseling: "🙏",
  marriage:   "💍",
  other:      "📋",
};

// ── Shared table for admin views ──────────────────────────────────────────────
function ApptTable({
  appts,
  showActions = false,
  actioning,
  onApprove,
  onReject,
}: {
  appts: Appointment[];
  showActions?: boolean;
  actioning?: string | null;
  onApprove?: (a: Appointment) => void;
  onReject?: (a: Appointment) => void;
}) {
  if (appts.length === 0) {
    return (
      <div className="py-12 text-center text-[#9CA3AF]">
        <Calendar size={32} className="mx-auto mb-2 opacity-20" />
        <p className="text-sm">No appointments found</p>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[#F9FAFB] border-b border-[#F3F4F6]">
            {["Member Name", "Service", "Date", "Time", "Status", showActions ? "Actions" : "Note"].map((h) => (
              <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-[#9CA3AF]">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#F3F4F6]">
          {appts.map((a) => (
            <tr key={a.id} className="hover:bg-[#F9FAFB] transition-colors">
              <td className="px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-[#EEF1F8] flex items-center justify-center text-[10px] font-bold text-[#1B2E6B] flex-shrink-0">
                    {a.memberName?.[0]?.toUpperCase() ?? "?"}
                  </div>
                  <span className="text-[#374151] font-medium text-xs">{a.memberName ?? "—"}</span>
                </div>
              </td>
              <td className="px-4 py-3 text-[#6B7280] capitalize text-xs">{a.serviceType}</td>
              <td className="px-4 py-3 text-[#6B7280] text-xs">{fmtDate(a.date)}</td>
              <td className="px-4 py-3 text-[#6B7280] text-xs">{a.time || "—"}</td>
              <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
              <td className="px-4 py-3">
                {showActions && onApprove && onReject ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => onApprove(a)}
                      disabled={actioning === a.id}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#1B2E6B] text-white text-xs font-semibold hover:bg-[#162554] transition-colors disabled:opacity-50"
                    >
                      <CheckCircle size={11} /> Approve
                    </button>
                    <button
                      onClick={() => onReject(a)}
                      disabled={actioning === a.id}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100 transition-colors disabled:opacity-50"
                    >
                      <XCircle size={11} /> Reject
                    </button>
                  </div>
                ) : (
                  <span className="text-[#9CA3AF] text-xs truncate max-w-[140px] block">
                    {(a as any).privateNote || "—"}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Super Admin view ──────────────────────────────────────────────────────────
function SuperAdminAppointments() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"pending" | "upcoming" | "past">("pending");
  const [actioning, setActioning] = useState<string | null>(null);

  useEffect(() => {
    getDocs(query(collection(db, "appointments"), orderBy("date", "asc")))
      .then((snap) => setAppointments(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Appointment))))
      .finally(() => setLoading(false));
  }, []);

  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const weekEnd  = new Date(now.getTime() + 7 * 86400000);

  const pendingAppts  = appointments.filter((a) => a.status === "pending");
  const upcomingAppts = appointments
    .filter((a) => a.status === "confirmed" && a.date && a.date.toDate() >= now)
    .sort((a, b) => (a.date?.seconds ?? 0) - (b.date?.seconds ?? 0));
  const pastAppts     = appointments
    .filter((a) => a.date && a.date.toDate() < now)
    .sort((a, b) => (b.date?.seconds ?? 0) - (a.date?.seconds ?? 0));

  const todayCount = appointments.filter(
    (a) => a.status === "confirmed" && fmtDateIso(a.date) === todayStr
  ).length;
  const weekCount = appointments.filter(
    (a) => a.status === "confirmed" && a.date && a.date.toDate() >= now && a.date.toDate() <= weekEnd
  ).length;

  async function handleApprove(a: Appointment) {
    if (actioning) return;
    setActioning(a.id);
    try {
      await updateDoc(doc(db, "appointments", a.id), { status: "confirmed" });
      await addDoc(collection(db, "notifications"), {
        userId: a.memberId,
        type: "appointment_confirmed",
        title: "Appointment Confirmed",
        description: `Your ${a.serviceType} appointment on ${fmtDate(a.date)} has been confirmed.`,
        link: "/appointment",
        read: false,
        createdAt: serverTimestamp(),
      });
      setAppointments((p) => p.map((x) => x.id === a.id ? { ...x, status: "confirmed" } : x));
    } finally {
      setActioning(null);
    }
  }

  async function handleReject(a: Appointment) {
    if (actioning) return;
    setActioning(a.id);
    try {
      await updateDoc(doc(db, "appointments", a.id), { status: "rejected" });
      await addDoc(collection(db, "notifications"), {
        userId: a.memberId,
        type: "appointment_rejected",
        title: "Appointment Not Approved",
        description: `Your ${a.serviceType} appointment on ${fmtDate(a.date)} was not approved.`,
        link: "/appointment",
        read: false,
        createdAt: serverTimestamp(),
      });
      setAppointments((p) => p.map((x) => x.id === a.id ? { ...x, status: "rejected" } : x));
    } finally {
      setActioning(null);
    }
  }

  const displayed = tab === "pending" ? pendingAppts : tab === "upcoming" ? upcomingAppts : pastAppts;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[#1B2E6B]">Appointments</h1>
        <p className="text-[#9CA3AF] text-sm mt-0.5">Manage all member appointments</p>
      </div>

      {/* Stats */}
      {!loading && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Pending Approvals", value: pendingAppts.length,  icon: "⏳", color: "text-yellow-600" },
            { label: "Upcoming Today",    value: todayCount,           icon: "📅", color: "text-[#1B2E6B]" },
            { label: "This Week",         value: weekCount,            icon: "📆", color: "text-green-600" },
            { label: "Total All Time",    value: appointments.length,  icon: "📋", color: "text-purple-600" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-5">
              <p className="text-2xl mb-2">{s.icon}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[#9CA3AF] text-xs mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-white rounded-xl border border-[#E5E7EB] p-1 w-fit overflow-x-auto">
        {([
          { key: "pending",  label: `Pending Requests (${pendingAppts.length})` },
          { key: "upcoming", label: `Upcoming (${upcomingAppts.length})` },
          { key: "past",     label: `Past (${pastAppts.length})` },
        ] as const).map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={[
              "px-4 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
              tab === t.key ? "bg-[#1B2E6B] text-white" : "text-[#6B7280] hover:text-[#1B2E6B]",
            ].join(" ")}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center">
            <div className="w-7 h-7 border-2 border-[#1B2E6B] border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : (
          <ApptTable
            appts={displayed}
            showActions={tab === "pending"}
            actioning={actioning}
            onApprove={handleApprove}
            onReject={handleReject}
          />
        )}
      </div>
    </div>
  );
}

// ── Admin view ─────────────────────────────────────────────────────────────────
function AdminAppointments() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"upcoming" | "past" | "all">("upcoming");

  useEffect(() => {
    getDocs(query(collection(db, "appointments"), orderBy("date", "asc")))
      .then((snap) => setAppointments(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Appointment))))
      .finally(() => setLoading(false));
  }, []);

  const now = new Date();
  const upcomingAppts = appointments
    .filter((a) => a.status === "confirmed" && a.date && a.date.toDate() >= now)
    .sort((a, b) => (a.date?.seconds ?? 0) - (b.date?.seconds ?? 0));
  const pastAppts     = appointments
    .filter((a) => a.date && a.date.toDate() < now)
    .sort((a, b) => (b.date?.seconds ?? 0) - (a.date?.seconds ?? 0));
  const allAppts      = [...appointments].sort((a, b) => (b.date?.seconds ?? 0) - (a.date?.seconds ?? 0));

  const displayed = tab === "upcoming" ? upcomingAppts : tab === "past" ? pastAppts : allAppts;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[#1B2E6B]">Appointments</h1>
        <p className="text-[#9CA3AF] text-sm mt-0.5">View all member appointments</p>
      </div>

      <div className="flex gap-1 bg-white rounded-xl border border-[#E5E7EB] p-1 w-fit overflow-x-auto">
        {([
          { key: "upcoming", label: `Upcoming (${upcomingAppts.length})` },
          { key: "past",     label: `Past (${pastAppts.length})` },
          { key: "all",      label: `All Requests (${allAppts.length})` },
        ] as const).map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={[
              "px-4 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
              tab === t.key ? "bg-[#1B2E6B] text-white" : "text-[#6B7280] hover:text-[#1B2E6B]",
            ].join(" ")}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center">
            <div className="w-7 h-7 border-2 border-[#1B2E6B] border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : (
          <ApptTable appts={displayed} showActions={false} />
        )}
      </div>
    </div>
  );
}

// ── Booking modal ─────────────────────────────────────────────────────────────
function BookingModal({
  userId, userName, onClose, onBooked,
}: {
  userId: string; userName: string;
  onClose: () => void;
  onBooked: (a: Appointment) => void;
}) {
  const [serviceType, setServiceType] = useState<Appointment["serviceType"]>("confession");
  const [date, setDate]   = useState("");
  const [time, setTime]   = useState("09:00");
  const [note, setNote]   = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!date) return;
    setLoading(true);
    try {
      const newAppt = {
        memberId:    userId,
        memberName:  userName,
        serviceType,
        date:        Timestamp.fromDate(new Date(date + "T" + time)),
        time,
        status:      "pending" as const,
        privateNote: note.trim() || null,
        createdAt:   serverTimestamp(),
      };
      const ref = await addDoc(collection(db, "appointments"), newAppt);
      onBooked({ id: ref.id, ...newAppt } as unknown as Appointment);
      onClose();
    } finally {
      setLoading(false);
    }
  }

  const INPUT = "w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2E6B]/20 focus:border-[#1B2E6B]";

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#F3F4F6]">
          <h3 className="text-[#1B2E6B] font-bold text-base">Book New Session</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#EEF1F8] text-[#9CA3AF]"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#374151] mb-1.5">Service Type</label>
            <select value={serviceType} onChange={(e) => setServiceType(e.target.value as Appointment["serviceType"])}
              className={INPUT + " bg-white"}>
              <option value="confession">Confession</option>
              <option value="counseling">Spiritual Counseling</option>
              <option value="marriage">Marriage Guidance</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1.5">Date</label>
              <input type="date" required value={date} onChange={(e) => setDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]} className={INPUT} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1.5">Time</label>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={INPUT} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#374151] mb-1.5">Note (optional)</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3}
              placeholder="Any specific concerns or requests…"
              className={INPUT + " resize-none placeholder-[#9CA3AF]"} />
          </div>
          <button type="submit" disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-[#F5C518] text-[#1B2E6B] font-semibold py-2.5 rounded-xl hover:bg-[#e6b800] transition-colors disabled:opacity-60 text-sm">
            {loading && <div className="w-4 h-4 border-2 border-[#1B2E6B]/40 border-t-[#1B2E6B] rounded-full animate-spin" />}
            Request Appointment
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Reschedule modal ──────────────────────────────────────────────────────────
function RescheduleModal({
  appt, onClose, onRescheduled,
}: {
  appt: Appointment;
  onClose: () => void;
  onRescheduled: (id: string, date: Timestamp, time: string) => void;
}) {
  const [date, setDate] = useState(fmtDateIso(appt.date));
  const [time, setTime] = useState(appt.time ?? "09:00");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!date) return;
    setLoading(true);
    try {
      const newTs = Timestamp.fromDate(new Date(date + "T" + time));
      await updateDoc(doc(db, "appointments", appt.id), { date: newTs, time, status: "pending" });
      onRescheduled(appt.id, newTs, time);
      onClose();
    } finally {
      setLoading(false);
    }
  }

  const INPUT = "w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2E6B]/20 focus:border-[#1B2E6B]";

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#F3F4F6]">
          <h3 className="text-[#1B2E6B] font-bold text-base">Reschedule Appointment</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#EEF1F8] text-[#9CA3AF]"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1.5">New Date</label>
              <input type="date" required value={date} onChange={(e) => setDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]} className={INPUT} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1.5">New Time</label>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={INPUT} />
            </div>
          </div>
          <button type="submit" disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-[#F5C518] text-[#1B2E6B] font-semibold py-2.5 rounded-xl hover:bg-[#e6b800] transition-colors disabled:opacity-60 text-sm">
            {loading && <div className="w-4 h-4 border-2 border-[#1B2E6B]/40 border-t-[#1B2E6B] rounded-full animate-spin" />}
            Reschedule
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Mini calendar ─────────────────────────────────────────────────────────────
function MiniCalendar({ appointments }: { appointments: Appointment[] }) {
  const [view, setView] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const { year, month } = view;
  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today       = new Date();

  function apptDot(day: number): "pending" | "confirmed" | null {
    const d = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const match = appointments.find((a) => fmtDateIso(a.date) === d);
    if (!match) return null;
    return match.status === "confirmed" ? "confirmed" : "pending";
  }

  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const cells: (number | null)[] = [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setView({ year: month === 0 ? year - 1 : year, month: (month + 11) % 12 })}
          className="p-1 rounded-lg hover:bg-[#EEF1F8] text-[#9CA3AF]"><ChevronLeft size={14} /></button>
        <p className="text-[#1B2E6B] font-semibold text-sm">{MONTHS[month]} {year}</p>
        <button onClick={() => setView({ year: month === 11 ? year + 1 : year, month: (month + 1) % 12 })}
          className="p-1 rounded-lg hover:bg-[#EEF1F8] text-[#9CA3AF]"><ChevronRight size={14} /></button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {["Su","Mo","Tu","We","Th","Fr","Sa"].map((d) => (
          <div key={d} className="text-center text-[9px] font-bold text-[#9CA3AF] py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, i) => {
          if (!day) return <div key={`e${i}`} />;
          const dot = apptDot(day);
          const isToday = today.getDate() === day && today.getMonth() === month && today.getFullYear() === year;
          return (
            <div key={day} className="flex flex-col items-center py-1">
              <span className={[
                "text-xs w-6 h-6 flex items-center justify-center rounded-full",
                isToday ? "bg-[#1B2E6B] text-white font-bold" : "text-[#374151]",
              ].join(" ")}>{day}</span>
              {dot && (
                <span className={`w-1 h-1 rounded-full mt-0.5 ${dot === "confirmed" ? "bg-[#1B2E6B]" : "bg-[#F5C518]"}`} />
              )}
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-3 mt-2 pt-2 border-t border-[#F3F4F6]">
        <div className="flex items-center gap-1 text-[10px] text-[#6B7280]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#F5C518] flex-shrink-0" /> Pending
        </div>
        <div className="flex items-center gap-1 text-[10px] text-[#6B7280]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#1B2E6B] flex-shrink-0" /> Confirmed
        </div>
      </div>
    </div>
  );
}

// ── Member view ───────────────────────────────────────────────────────────────
function MemberAppointments() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading]           = useState(true);
  const [tab, setTab]                   = useState<"upcoming" | "pending" | "past">("upcoming");
  const [booking, setBooking]           = useState(false);
  const [rescheduling, setRescheduling] = useState<Appointment | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const snap = await getDocs(
        query(collection(db, "appointments"), where("memberId", "==", user.id), orderBy("date", "asc"))
      );
      setAppointments(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Appointment)));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const now = new Date();
  const upcomingAppts = appointments.filter((a) => a.status === "confirmed" && a.date && a.date.toDate() >= now);
  const pendingAppts  = appointments.filter((a) => a.status === "pending");
  const pastAppts     = appointments
    .filter((a) => a.date && a.date.toDate() < now)
    .sort((a, b) => (b.date?.seconds ?? 0) - (a.date?.seconds ?? 0));

  async function cancelAppt(apptId: string) {
    if (!confirm("Cancel this appointment?")) return;
    await updateDoc(doc(db, "appointments", apptId), { status: "rejected" });
    setAppointments((p) => p.map((a) => a.id === apptId ? { ...a, status: "rejected" } : a));
  }

  function handleRescheduled(id: string, date: Timestamp, time: string) {
    setAppointments((p) => p.map((a) => a.id === id ? { ...a, date, time, status: "pending" } : a));
  }

  if (!user) return null;

  const displayed = tab === "upcoming" ? upcomingAppts : tab === "pending" ? pendingAppts : pastAppts;

  return (
    <div className="grid lg:grid-cols-3 gap-5">
      {/* Left: sessions */}
      <div className="lg:col-span-2 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-[#1B2E6B]">My Spiritual Appointments</h1>
            <p className="text-[#9CA3AF] text-sm mt-0.5">Sessions with መጋቢ ሐዲስ ቀሲስ ሳሙኤል አያልነህ(ዶ/ር)</p>
          </div>
          <button onClick={() => setBooking(true)}
            className="flex items-center gap-1.5 bg-[#F5C518] text-[#1B2E6B] font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-[#e6b800] transition-colors flex-shrink-0">
            <Plus size={15} /> Book New Session
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white rounded-xl border border-[#E5E7EB] p-1 w-fit overflow-x-auto">
          {([
            { key: "upcoming", label: `Upcoming (${upcomingAppts.length})` },
            { key: "pending",  label: `Pending (${pendingAppts.length})` },
            { key: "past",     label: `Past (${pastAppts.length})` },
          ] as const).map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={[
                "px-4 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
                tab === t.key ? "bg-[#1B2E6B] text-white" : "text-[#6B7280] hover:text-[#1B2E6B]",
              ].join(" ")}>
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-16 text-center">
            <div className="w-7 h-7 border-2 border-[#1B2E6B] border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : displayed.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-10 text-center text-[#9CA3AF]">
            <p className="text-3xl mb-2">📅</p>
            <p className="text-sm font-medium">
              {tab === "upcoming" ? "No upcoming appointments"
               : tab === "pending" ? "No pending requests"
               : "No past appointments"}
            </p>
            {tab !== "past" && (
              <button onClick={() => setBooking(true)}
                className="mt-3 flex items-center gap-1.5 mx-auto bg-[#F5C518] text-[#1B2E6B] font-semibold text-xs px-4 py-2 rounded-xl hover:bg-[#e6b800] transition-colors">
                <Plus size={13} /> Book a Session
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {displayed.map((a) => {
              const cd = countdown(a.date, a.time);
              return (
                <div key={a.id} className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-5">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-[#EEF1F8] flex items-center justify-center text-2xl flex-shrink-0">
                      {SERVICE_ICONS[a.serviceType] ?? "📋"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="text-[#1B2E6B] font-semibold text-sm capitalize">{a.serviceType}</p>
                        <StatusBadge status={a.status} />
                      </div>
                      <p className="text-[#6B7280] text-xs">{fmtDate(a.date)} · {a.time || "—"}</p>
                      {cd && <p className="text-[#1B2E6B] text-xs font-semibold mt-0.5">{cd}</p>}
                      {(a as any).privateNote && (
                        <p className="text-[#9CA3AF] text-xs mt-1 italic truncate">&ldquo;{(a as any).privateNote}&rdquo;</p>
                      )}
                    </div>
                  </div>
                  {tab !== "past" && (
                    <div className="flex gap-2 mt-4 pt-3 border-t border-[#F3F4F6]">
                      {tab === "upcoming" && (
                        <button onClick={() => setRescheduling(a)}
                          className="flex-1 py-1.5 rounded-lg border border-[#E5E7EB] text-xs font-semibold text-[#374151] hover:bg-[#EEF1F8] transition-colors">
                          Reschedule
                        </button>
                      )}
                      <button onClick={() => cancelAppt(a.id)}
                        className="flex-1 py-1.5 rounded-lg border border-red-200 text-red-500 text-xs font-semibold hover:bg-red-50 transition-colors">
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Right: calendar + info */}
      <div className="space-y-4">
        <MiniCalendar appointments={appointments} />
        <div className="bg-[#1B2E6B] rounded-2xl p-5 text-white">
          <p className="font-semibold text-sm mb-1">Need to reschedule?</p>
          <p className="text-white/60 text-xs leading-relaxed">
            Contact the spiritual father directly or request a new session through the app.
          </p>
          <a href="tel:+251912872622" className="mt-3 block text-[#F5C518] text-xs font-semibold">
            +251912872622
          </a>
        </div>
      </div>

      {booking && (
        <BookingModal
          userId={user.id}
          userName={user.displayName || user.email}
          onClose={() => setBooking(false)}
          onBooked={(a) => setAppointments((p) => [a, ...p])}
        />
      )}
      {rescheduling && (
        <RescheduleModal
          appt={rescheduling}
          onClose={() => setRescheduling(null)}
          onRescheduled={handleRescheduled}
        />
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function AppointmentPage() {
  const { user, role } = useAuth();
  if (!user) return null;
  if (role === "super_admin") return <SuperAdminAppointments />;
  if (role === "admin")       return <AdminAppointments />;
  return <MemberAppointments />;
}
