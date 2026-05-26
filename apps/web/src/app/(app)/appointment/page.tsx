"use client";
import React, { useEffect, useState, useCallback } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  updateDoc,
  addDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db, useAuth } from "@/lib/firebase";
import {
  Calendar,
  Search,
  X,
  CheckCircle,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Plus,
} from "lucide-react";
import type { Appointment, User } from "@nablis/shared/firebase";

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

// ── Review modal ──────────────────────────────────────────────────────────────
function ReviewModal({
  appt,
  member,
  onClose,
  onAction,
}: {
  appt: Appointment;
  member: User | null;
  onClose: () => void;
  onAction: (apptId: string, status: "confirmed" | "rejected") => Promise<void>;
}) {
  const [note, setNote] = useState(appt.privateNote ?? "");
  const [loading, setLoading] = useState(false);

  async function act(status: "confirmed" | "rejected") {
    setLoading(true);
    try {
      await updateDoc(doc(db, "appointments", appt.id), {
        status,
        privateNote: note.trim() || null,
      });
      await addDoc(collection(db, "notifications"), {
        userId: appt.memberId,
        type: status === "confirmed" ? "appointment_confirmed" : "appointment_rejected",
        title: status === "confirmed" ? "Appointment Confirmed" : "Appointment Rejected",
        description: status === "confirmed"
          ? `Your ${appt.serviceType} appointment on ${fmtDate(appt.date)} has been confirmed.`
          : `Your ${appt.serviceType} appointment on ${fmtDate(appt.date)} was not approved.`,
        link: "/appointment",
        read: false,
        createdAt: serverTimestamp(),
      });
      onAction(appt.id, status);
      onClose();
    } finally {
      setLoading(false);
    }
  }

  const initials = (member?.displayName || member?.email || "?")?.[0]?.toUpperCase() ?? "?";

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#F3F4F6]">
          <h3 className="text-[#1B2E6B] font-bold text-base">Review Appointment</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#EEF1F8] text-[#9CA3AF] transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Member info */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#1B2E6B] flex items-center justify-center flex-shrink-0">
              {member?.photoURL ? (
                <img src={member.photoURL} className="w-12 h-12 rounded-2xl object-cover" alt="" />
              ) : (
                <span className="text-[#F5C518] font-bold text-lg">{initials}</span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-[#1B2E6B] font-bold text-sm">{member?.displayName || appt.memberName}</p>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#EEF1F8] text-[#1B2E6B]">MEMBER</span>
              </div>
              <p className="text-[#9CA3AF] text-xs">Joined {fmtDate(member?.createdAt)}</p>
            </div>
          </div>

          {/* Details */}
          <div className="bg-[#F9FAFB] rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-[#9CA3AF]">Service Requested</span>
              <span className="text-[#374151] font-medium capitalize">{appt.serviceType}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#9CA3AF]">Date</span>
              <span className="text-[#374151] font-medium">{fmtDate(appt.date)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#9CA3AF]">Time</span>
              <span className="text-[#374151] font-medium">{appt.time || "—"}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#9CA3AF]">Current Status</span>
              <StatusBadge status={appt.status} />
            </div>
          </div>

          {/* Private note */}
          <div>
            <label className="block text-xs font-semibold text-[#374151] mb-1.5">Private Note (optional)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Add a private note visible only to admin…"
              className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] text-sm text-[#374151] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#1B2E6B]/20 focus:border-[#1B2E6B] resize-none transition-colors"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={() => act("confirmed")}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#1B2E6B] text-white text-sm font-semibold hover:bg-[#162554] transition-colors disabled:opacity-60"
            >
              <CheckCircle size={15} /> Approve &amp; Notify
            </button>
            <button
              onClick={() => act("rejected")}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-50 text-red-600 text-sm font-semibold hover:bg-red-100 transition-colors disabled:opacity-60"
            >
              <XCircle size={15} /> Reject &amp; Notify
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Admin view ────────────────────────────────────────────────────────────────
function AdminAppointments({ readOnly = false }: { readOnly?: boolean }) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [members, setMembers]           = useState<Record<string, User>>({});
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState("");
  const [dateFrom, setDateFrom]         = useState("");
  const [dateTo, setDateTo]             = useState("");
  const [reviewing, setReviewing]       = useState<Appointment | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const snap = await getDocs(
          query(collection(db, "appointments"), orderBy("date", "desc"))
        );
        const appts = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Appointment));
        setAppointments(appts);

        // Fetch unique members
        const ids = [...new Set(appts.map((a) => a.memberId))];
        const mMap: Record<string, User> = {};
        await Promise.all(
          ids.map(async (id) => {
            const mSnap = await getDocs(query(collection(db, "users"), where("__name__", "==", id)));
            if (!mSnap.empty) mMap[id] = { id, ...mSnap.docs[0].data() } as User;
          })
        );
        setMembers(mMap);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function handleAction(apptId: string, status: "confirmed" | "rejected") {
    setAppointments((p) => p.map((a) => (a.id === apptId ? { ...a, status } : a)));
    return Promise.resolve();
  }

  const filtered = appointments.filter((a) => {
    const matchesSearch = !search || (a.memberName ?? "").toLowerCase().includes(search.toLowerCase());
    const iso = fmtDateIso(a.date);
    const matchesFrom = !dateFrom || iso >= dateFrom;
    const matchesTo   = !dateTo   || iso <= dateTo;
    return matchesSearch && matchesFrom && matchesTo;
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[#1B2E6B]">Appointments</h1>
        <p className="text-[#9CA3AF] text-sm mt-0.5">Discover &amp; manage appointments</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by member name…"
            className="w-full pl-8 pr-3 py-2 rounded-xl border border-[#E5E7EB] text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2E6B]/20 focus:border-[#1B2E6B]"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#9CA3AF]">From</span>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="px-3 py-2 rounded-xl border border-[#E5E7EB] text-sm text-[#374151] focus:outline-none"
          />
          <span className="text-xs text-[#9CA3AF]">To</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="px-3 py-2 rounded-xl border border-[#E5E7EB] text-sm text-[#374151] focus:outline-none"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center"><div className="w-7 h-7 border-2 border-[#1B2E6B] border-t-transparent rounded-full animate-spin mx-auto" /></div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-[#9CA3AF] text-sm">No appointments found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F9FAFB] border-b border-[#F3F4F6]">
                  {["Member Name", "Service", "Date", "Time", "Status", ""].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-[#9CA3AF]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {filtered.map((a) => (
                  <tr key={a.id} className="hover:bg-[#F9FAFB] transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-[#EEF1F8] flex items-center justify-center text-[10px] font-bold text-[#1B2E6B] flex-shrink-0">
                          {a.memberName?.[0]?.toUpperCase() ?? "?"}
                        </div>
                        <span className="text-[#374151] font-medium text-xs">{a.memberName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#6B7280] capitalize text-xs">{a.serviceType}</td>
                    <td className="px-4 py-3 text-[#6B7280] text-xs">{fmtDate(a.date)}</td>
                    <td className="px-4 py-3 text-[#6B7280] text-xs">{a.time || "—"}</td>
                    <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
                    <td className="px-4 py-3">
                      {readOnly ? (
                        <span className="px-3 py-1.5 rounded-lg bg-[#F3F4F6] text-[#9CA3AF] text-xs font-semibold">
                          View Only
                        </span>
                      ) : (
                        <button
                          onClick={() => setReviewing(a)}
                          className="px-3 py-1.5 rounded-lg bg-[#EEF1F8] text-[#1B2E6B] text-xs font-semibold hover:bg-[#1B2E6B] hover:text-white transition-colors"
                        >
                          Review
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {reviewing && !readOnly && (
        <ReviewModal
          appt={reviewing}
          member={members[reviewing.memberId] ?? null}
          onClose={() => setReviewing(null)}
          onAction={handleAction}
        />
      )}
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
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

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
            <div key={day} className="relative flex flex-col items-center py-1">
              <span className={[
                "text-xs w-6 h-6 flex items-center justify-center rounded-full",
                isToday ? "bg-[#1B2E6B] text-white font-bold" : "text-[#374151]",
              ].join(" ")}>
                {day}
              </span>
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

// ── Booking modal ─────────────────────────────────────────────────────────────
function BookingModal({ userId, userName, onClose, onBooked }: { userId: string; userName: string; onClose: () => void; onBooked: (a: Appointment) => void }) {
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
        memberId: userId,
        memberName: userName,
        serviceType,
        date: Timestamp.fromDate(new Date(date + "T" + time)),
        time,
        status: "pending" as const,
        privateNote: note.trim() || null,
        createdAt: serverTimestamp(),
      };
      const ref = await addDoc(collection(db, "appointments"), newAppt);
      onBooked({ id: ref.id, ...newAppt } as unknown as Appointment);
      onClose();
    } finally {
      setLoading(false);
    }
  }

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
              className="w-full px-4 py-2.5 rounded-xl border border-[#E5E7EB] text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1B2E6B]/20 focus:border-[#1B2E6B]">
              <option value="confession">Confession</option>
              <option value="counseling">Spiritual Counseling</option>
              <option value="marriage">Marriage Guidance</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1.5">Date</label>
              <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} min={new Date().toISOString().split("T")[0]}
                className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2E6B]/20 focus:border-[#1B2E6B]" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1.5">Time</label>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2E6B]/20 focus:border-[#1B2E6B]" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#374151] mb-1.5">Note (optional)</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Any specific concerns or requests…"
              className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] text-sm placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#1B2E6B]/20 focus:border-[#1B2E6B] resize-none" />
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

// ── Countdown helper ─────────────────────────────────────────────────────────
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

// ── Member view ───────────────────────────────────────────────────────────────
function MemberAppointments() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading]           = useState(true);
  const [tab, setTab]                   = useState<"upcoming" | "past">("upcoming");
  const [booking, setBooking]           = useState(false);

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

  const now = Timestamp.now();
  const upcoming  = appointments.filter((a) => !a.date || a.date.seconds >= now.seconds);
  const past       = appointments.filter((a) => a.date && a.date.seconds < now.seconds);
  const confirmed  = upcoming.filter((a) => a.status === "confirmed");
  const pending    = upcoming.filter((a) => a.status === "pending");

  async function cancelAppt(apptId: string) {
    if (!confirm("Cancel this appointment?")) return;
    await updateDoc(doc(db, "appointments", apptId), { status: "rejected" });
    setAppointments((p) => p.map((a) => (a.id === apptId ? { ...a, status: "rejected" } : a)));
  }

  if (!user) return null;

  function ApptCard({ a, showActions }: { a: Appointment; showActions: boolean }) {
    const cd = countdown(a.date, a.time);
    return (
      <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-5">
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
            {a.privateNote && (
              <p className="text-[#9CA3AF] text-xs mt-1 truncate italic">&ldquo;{a.privateNote}&rdquo;</p>
            )}
          </div>
        </div>
        {showActions && (
          <div className="flex gap-2 mt-4 pt-3 border-t border-[#F3F4F6]">
            <button className="flex-1 py-1.5 rounded-lg border border-[#E5E7EB] text-xs font-semibold text-[#374151] hover:bg-[#EEF1F8] transition-colors">
              Reschedule
            </button>
            <button onClick={() => cancelAppt(a.id)}
              className="flex-1 py-1.5 rounded-lg border border-red-200 text-red-500 text-xs font-semibold hover:bg-red-50 transition-colors">
              Cancel
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="grid lg:grid-cols-3 gap-5">
      {/* Left: sessions */}
      <div className="lg:col-span-2 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-[#1B2E6B]">My Spiritual Appointments</h1>
            <p className="text-[#9CA3AF] text-sm mt-0.5">Manage your sessions with መጋቢ ሐዲስ ቀሲስ ሳሙኤል አያልነህ(ዶ/ር)</p>
          </div>
          <button onClick={() => setBooking(true)}
            className="flex items-center gap-1.5 bg-[#F5C518] text-[#1B2E6B] font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-[#e6b800] transition-colors">
            <Plus size={15} /> Book New Session
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white rounded-xl border border-[#E5E7EB] p-1 w-fit">
          {(["upcoming", "past"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={[
                "px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors",
                tab === t ? "bg-[#1B2E6B] text-white" : "text-[#6B7280] hover:text-[#1B2E6B]",
              ].join(" ")}>
              {t} ({t === "upcoming" ? upcoming.length : past.length})
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-16 text-center"><div className="w-7 h-7 border-2 border-[#1B2E6B] border-t-transparent rounded-full animate-spin mx-auto" /></div>
        ) : tab === "past" ? (
          past.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#E5E7EB] p-10 text-center text-[#9CA3AF]">
              <p className="text-3xl mb-2">📅</p>
              <p className="text-sm font-medium">No past sessions</p>
            </div>
          ) : (
            <div className="space-y-3">
              {past.map((a) => <ApptCard key={a.id} a={a} showActions={false} />)}
            </div>
          )
        ) : (
          <div className="space-y-5">
            {/* Confirmed appointments */}
            {confirmed.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-[#1B2E6B] mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Upcoming Appointments
                </h2>
                <div className="space-y-3">
                  {confirmed.map((a) => <ApptCard key={a.id} a={a} showActions={false} />)}
                </div>
              </div>
            )}

            {/* Pending requests */}
            {pending.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-[#1B2E6B] mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" /> Pending Requests
                </h2>
                <div className="space-y-3">
                  {pending.map((a) => <ApptCard key={a.id} a={a} showActions={true} />)}
                </div>
              </div>
            )}

            {confirmed.length === 0 && pending.length === 0 && (
              <div className="bg-white rounded-2xl border border-[#E5E7EB] p-10 text-center text-[#9CA3AF]">
                <p className="text-3xl mb-2">📅</p>
                <p className="text-sm font-medium">No upcoming sessions</p>
                <button onClick={() => setBooking(true)}
                  className="mt-3 flex items-center gap-1.5 mx-auto bg-[#F5C518] text-[#1B2E6B] font-semibold text-xs px-4 py-2 rounded-xl hover:bg-[#e6b800] transition-colors">
                  <Plus size={13} /> Book a Session
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right: calendar */}
      <div className="space-y-4">
        <MiniCalendar appointments={appointments} />
        <div className="bg-[#1B2E6B] rounded-2xl p-5 text-white">
          <p className="font-semibold text-sm mb-1">Need to reschedule?</p>
          <p className="text-white/60 text-xs leading-relaxed">Contact መጋቢ ሐዲስ ቀሲስ ሳሙኤል አያልነህ(ዶ/ር) directly or book a new session through the app.</p>
          <a href="tel:+251912872622" className="mt-3 block text-[#F5C518] text-xs font-semibold">+251912872622</a>
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
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function AppointmentPage() {
  const { user, role } = useAuth();
  if (!user) return null;
  if (role === "super_admin") return <AdminAppointments />;
  if (role === "admin") return <AdminAppointments readOnly />;
  return <MemberAppointments />;
}
