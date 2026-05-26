"use client";
import React, { useEffect, useState, useCallback } from "react";
import {
  collection, query, getDocs, orderBy, where,
  doc, updateDoc, serverTimestamp, Timestamp,
} from "firebase/firestore";
import { db, useAuth } from "@/lib/firebase";
import type { User, Appointment } from "@nablis/shared/firebase";
import { Users, Clock, Calendar, CheckCircle, XCircle, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";

function fmtDate(ts: Timestamp | null | undefined) {
  if (!ts) return "—";
  try { return ts.toDate().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
  catch { return "—"; }
}

// ── Super Admin Dashboard ─────────────────────────────────────────────────────
function SuperAdminDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState({ total: 0, pending: 0, active: 0, appointments: 0 });
  const [pendingMembers, setPendingMembers] = useState<User[]>([]);
  const [recentAppts, setRecentAppts] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [promoting, setPromoting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [usersSnap, apptsSnap] = await Promise.all([
        getDocs(collection(db, "users")),
        getDocs(query(collection(db, "appointments"), orderBy("date", "desc"))),
      ]);
      const users = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() } as User));
      const appts = apptsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Appointment));

      setStats({
        total:        users.filter((u) => u.role === "member" || u.role === "admin").length,
        pending:      users.filter((u) => u.status === "pending").length,
        active:       users.filter((u) => u.status === "active").length,
        appointments: appts.filter((a) => a.status === "pending").length,
      });
      setPendingMembers(users.filter((u) => u.status === "pending"));
      setRecentAppts(appts.slice(0, 5));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function approveMember(userId: string, role: "member" | "admin" = "member") {
    await updateDoc(doc(db, "users", userId), { status: "active", role, updatedAt: serverTimestamp() });
    setPendingMembers((p) => p.filter((m) => m.id !== userId));
    setStats((s) => ({ ...s, pending: s.pending - 1, active: s.active + 1 }));
    setPromoting(null);
  }

  async function rejectMember(userId: string) {
    await updateDoc(doc(db, "users", userId), { status: "rejected", updatedAt: serverTimestamp() });
    setPendingMembers((p) => p.filter((m) => m.id !== userId));
    setStats((s) => ({ ...s, pending: s.pending - 1 }));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[#1B2E6B]">Dashboard</h1>
        <p className="text-[#9CA3AF] text-sm mt-0.5">Welcome, {user?.displayName || "Spiritual Father"}</p>
      </div>

      {/* Stats */}
      {loading ? (
        <div className="py-8 text-center">
          <div className="w-7 h-7 border-2 border-[#1B2E6B] border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total Members", value: stats.total, icon: Users, color: "bg-blue-50 text-blue-600" },
            { label: "Pending Approval", value: stats.pending, icon: Clock, color: "bg-yellow-50 text-yellow-600" },
            { label: "Active Members", value: stats.active, icon: CheckCircle, color: "bg-green-50 text-green-600" },
            { label: "Pending Appointments", value: stats.appointments, icon: Calendar, color: "bg-purple-50 text-purple-600" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-5">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${s.color}`}>
                <s.icon size={18} />
              </div>
              <p className="text-2xl font-bold text-[#1B2E6B]">{s.value}</p>
              <p className="text-xs text-[#9CA3AF] mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Pending registrations */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#F3F4F6]">
          <h2 className="text-[#1B2E6B] font-bold text-sm">Pending Registrations</h2>
          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-yellow-50 text-yellow-700">
            {pendingMembers.length}
          </span>
        </div>
        {pendingMembers.length === 0 ? (
          <div className="py-10 text-center text-[#9CA3AF] text-sm">No pending registrations</div>
        ) : (
          <div className="divide-y divide-[#F9FAFB]">
            {pendingMembers.map((m) => (
              <div key={m.id} className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-[#EEF1F8] flex items-center justify-center text-xs font-bold text-[#1B2E6B] flex-shrink-0">
                      {(m.displayName || m.email || "?")[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[#1B2E6B] font-semibold text-sm">{m.displayName || "—"}</p>
                      <p className="text-[#9CA3AF] text-xs mb-1">{m.email}</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-[#6B7280]">
                        {m.christianName && <span>✝ {m.christianName}</span>}
                        {m.phone && <span>📞 {m.phone}</span>}
                        {m.countryOfResidence && <span>🌍 {m.countryOfResidence}</span>}
                        {m.cityOfResidence && <span>📍 {m.cityOfResidence}</span>}
                        {m.neighborhood && <span>🏘 {m.neighborhood}</span>}
                        {m.parishChurch && <span>⛪ {m.parishChurch}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    {promoting === m.id ? (
                      <div className="flex gap-1">
                        <button
                          onClick={() => approveMember(m.id, "member")}
                          className="px-2.5 py-1.5 rounded-lg bg-[#1B2E6B] text-white text-xs font-semibold hover:bg-[#162554] transition-colors"
                        >
                          As Member
                        </button>
                        <button
                          onClick={() => approveMember(m.id, "admin")}
                          className="px-2.5 py-1.5 rounded-lg bg-[#F5C518] text-[#1B2E6B] text-xs font-semibold hover:bg-[#e6b800] transition-colors"
                        >
                          As Admin
                        </button>
                        <button
                          onClick={() => setPromoting(null)}
                          className="px-2.5 py-1.5 rounded-lg border border-[#E5E7EB] text-xs text-[#9CA3AF] hover:bg-[#F9FAFB] transition-colors"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => setPromoting(m.id)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#1B2E6B] text-white text-xs font-semibold hover:bg-[#162554] transition-colors"
                        >
                          <CheckCircle size={12} /> Approve
                        </button>
                        <button
                          onClick={() => rejectMember(m.id)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100 transition-colors"
                        >
                          <XCircle size={12} /> Reject
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent appointments */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#F3F4F6]">
          <h2 className="text-[#1B2E6B] font-bold text-sm">Recent Appointments</h2>
          <button
            onClick={() => router.push("/appointment")}
            className="text-xs text-[#1B2E6B] font-semibold flex items-center gap-1 hover:underline"
          >
            View all <ChevronRight size={12} />
          </button>
        </div>
        {recentAppts.length === 0 ? (
          <div className="py-10 text-center text-[#9CA3AF] text-sm">No appointments</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F9FAFB] border-b border-[#F3F4F6]">
                  {["Member", "Service", "Date", "Status"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-[#9CA3AF]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {recentAppts.map((a) => (
                  <tr key={a.id} className="hover:bg-[#F9FAFB]">
                    <td className="px-4 py-3 text-[#374151] text-xs font-medium">{a.memberName ?? "—"}</td>
                    <td className="px-4 py-3 text-[#6B7280] text-xs capitalize">{a.serviceType}</td>
                    <td className="px-4 py-3 text-[#6B7280] text-xs">{fmtDate(a.date)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        a.status === "confirmed" ? "bg-green-50 text-green-700" :
                        a.status === "pending"   ? "bg-yellow-50 text-yellow-700" :
                        "bg-red-50 text-red-600"
                      }`}>
                        {a.status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Admin Dashboard ───────────────────────────────────────────────────────────
function AdminDashboard() {
  const { user } = useAuth();
  const router = useRouter();

  const shortcuts = [
    { icon: "📋", label: "Appointments", path: "/appointment", desc: "Manage member sessions" },
    { icon: "💬", label: "Messages", path: "/messaging", desc: "Chat with members" },
    { icon: "📖", label: "Bible Study", path: "/bible-study", desc: "Manage study content" },
    { icon: "🎉", label: "Events", path: "/events", desc: "Upcoming events" },
    { icon: "🖼️", label: "Gallery", path: "/gallery-app", desc: "Photo gallery" },
    { icon: "✍️", label: "Testimonials", path: "/testimonials", desc: "Member testimonials" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[#1B2E6B]">Dashboard</h1>
        <p className="text-[#9CA3AF] text-sm mt-0.5">Welcome back, {user?.displayName || "Admin"}</p>
      </div>

      <div className="bg-[#1B2E6B] rounded-2xl p-6 text-white">
        <p className="text-xs font-semibold opacity-60 mb-1">MORNING REFLECTION</p>
        <p className="text-lg font-bold mb-1">&ldquo;Pray without ceasing.&rdquo;</p>
        <p className="text-sm opacity-70">— 1 Thessalonians 5:17</p>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-[#374151] mb-3">Quick Access</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {shortcuts.map((s) => (
            <button
              key={s.label}
              onClick={() => router.push(s.path)}
              className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-4 text-left hover:bg-[#F9FAFB] hover:border-[#1B2E6B]/20 transition-colors"
            >
              <div className="text-2xl mb-2">{s.icon}</div>
              <p className="text-[#1B2E6B] font-semibold text-sm">{s.label}</p>
              <p className="text-[#9CA3AF] text-xs mt-0.5">{s.desc}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Member Dashboard ──────────────────────────────────────────────────────────
function MemberDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getDocs(
      query(
        collection(db, "appointments"),
        where("memberId", "==", user.id),
        orderBy("date", "asc")
      )
    )
      .then((snap) => {
        const now = new Date();
        const upcoming = snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as Appointment))
          .filter((a) => a.date && a.date.toDate() >= now && a.status !== "rejected")
          .slice(0, 3);
        setAppointments(upcoming);
      })
      .finally(() => setLoading(false));
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[#1B2E6B]">Dashboard</h1>
        <p className="text-[#9CA3AF] text-sm mt-0.5">Welcome back, {user?.displayName || "Member"}</p>
      </div>

      {/* Verse */}
      <div className="bg-[#1B2E6B] rounded-2xl p-5 text-white">
        <p className="text-xs font-semibold opacity-60 mb-1">VERSE OF THE DAY</p>
        <p className="text-base font-bold mb-1">&ldquo;Pray without ceasing.&rdquo;</p>
        <p className="text-sm opacity-70">— 1 Thessalonians 5:17</p>
      </div>

      {/* Daily prayers */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-5">
        <h2 className="text-[#1B2E6B] font-bold text-sm mb-4">Daily Prayer Commitments</h2>
        <div className="space-y-3">
          {[
            { name: "Morning Prayer",   time: "6:00 AM",   status: "COMPLETED", done: true,  active: false },
            { name: "Afternoon Prayer", time: "12:30 PM",  status: "UP NEXT",   done: false, active: true  },
            { name: "Evening Prayer",   time: "9:00 PM",   status: "SCHEDULED", done: false, active: false },
          ].map((p) => (
            <div key={p.name} className="flex items-center justify-between p-3 rounded-xl border border-[#F3F4F6]">
              <div>
                <p className="text-[#374151] font-semibold text-sm">{p.name}</p>
                <p className="text-[#9CA3AF] text-xs">{p.time}</p>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                p.done   ? "bg-green-50 text-green-700" :
                p.active ? "bg-yellow-50 text-yellow-700" :
                "bg-[#F3F4F6] text-[#9CA3AF]"
              }`}>
                {p.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Upcoming appointments */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#F3F4F6]">
          <h2 className="text-[#1B2E6B] font-bold text-sm">Upcoming Appointments</h2>
          <button
            onClick={() => router.push("/appointment")}
            className="text-xs text-[#1B2E6B] font-semibold flex items-center gap-1 hover:underline"
          >
            View all <ChevronRight size={12} />
          </button>
        </div>
        {loading ? (
          <div className="py-8 text-center">
            <div className="w-5 h-5 border-2 border-[#1B2E6B] border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : appointments.length === 0 ? (
          <div className="py-8 text-center text-[#9CA3AF] text-sm">
            <p className="text-2xl mb-1">📅</p>
            <p>No upcoming appointments</p>
            <button
              onClick={() => router.push("/appointment")}
              className="mt-2 text-xs text-[#1B2E6B] font-semibold hover:underline"
            >
              Book a session →
            </button>
          </div>
        ) : (
          <div className="divide-y divide-[#F9FAFB]">
            {appointments.map((a) => (
              <div key={a.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-[#374151] font-medium text-sm capitalize">{a.serviceType}</p>
                  <p className="text-[#9CA3AF] text-xs">{fmtDate(a.date)} · {a.time ?? "—"}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  a.status === "confirmed" ? "bg-green-50 text-green-700" : "bg-yellow-50 text-yellow-700"
                }`}>
                  {a.status === "confirmed" ? "CONFIRMED" : "AWAITING"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Root export ───────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user, role } = useAuth();
  if (!user) return null;
  if (role === "super_admin") return <SuperAdminDashboard />;
  if (role === "admin") return <AdminDashboard />;
  return <MemberDashboard />;
}
