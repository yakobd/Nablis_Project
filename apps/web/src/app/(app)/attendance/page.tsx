"use client";
import React, { useEffect, useState } from "react";
import { collection, query, orderBy, getDocs, addDoc, serverTimestamp, Timestamp, where } from "firebase/firestore";
import { db, useAuth } from "@/lib/firebase";
import { Download, Printer, RefreshCw, Users, Clock, UserPlus } from "lucide-react";
import type { Attendance } from "@nablis/shared/firebase";

function fmtDate(ts: Timestamp | null | undefined) {
  if (!ts) return "—";
  try { return ts.toDate().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
  catch { return "—"; }
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    completed: "bg-green-50 text-green-700",
    active:    "bg-blue-50 text-blue-700",
    upcoming:  "bg-yellow-50 text-yellow-700",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize ${map[status] ?? "bg-gray-100 text-gray-600"}`}>
      {status}
    </span>
  );
}

// ── SVG circular gauge ────────────────────────────────────────────────────────
function CircularGauge({ pct, current, total }: { pct: number; current: number; total: number }) {
  const r = 42;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <svg viewBox="0 0 100 100" className="w-28 h-28">
      <circle cx="50" cy="50" r={r} fill="none" stroke="#EEF1F8" strokeWidth="10" />
      <circle cx="50" cy="50" r={r} fill="none" stroke="#1B2E6B" strokeWidth="10"
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        transform="rotate(-90 50 50)" className="transition-all duration-700" />
      <text x="50" y="46" textAnchor="middle" className="fill-[#1B2E6B] font-bold" fontSize="14">{current}</text>
      <text x="50" y="60" textAnchor="middle" className="fill-[#9CA3AF]" fontSize="8">of {total}</text>
    </svg>
  );
}

// ── QR placeholder ────────────────────────────────────────────────────────────
function QRPlaceholder({ code }: { code: string }) {
  return (
    <div className="bg-white p-3 rounded-xl inline-block">
      <div className="w-32 h-32 grid grid-cols-8 gap-0.5">
        {Array.from({ length: 64 }).map((_, i) => {
          const on = Math.random() > 0.45 || (i < 8) || (i > 55) || (i % 8 === 0) || (i % 8 === 7);
          return <div key={i} className={`rounded-sm ${on ? "bg-[#1B2E6B]" : "bg-white"}`} />;
        })}
      </div>
      <p className="text-[#9CA3AF] text-[9px] text-center mt-1 font-mono">{code.slice(0, 8)}</p>
    </div>
  );
}

// ── Admin view ────────────────────────────────────────────────────────────────
function AdminAttendance() {
  const [history, setHistory]   = useState<Attendance[]>([]);
  const [loading, setLoading]   = useState(true);
  const [qrCode]                = useState(() => Math.random().toString(36).slice(2, 10).toUpperCase());
  const [live]                  = useState({ current: 156, total: 200, newGuests: 14, avgTime: "1h 23m" });

  useEffect(() => {
    getDocs(query(collection(db, "attendance"), orderBy("date", "desc")))
      .then((snap) => setHistory(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Attendance))))
      .finally(() => setLoading(false));
  }, []);

  const pct = Math.round((live.current / live.total) * 100);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#1B2E6B]">Monthly Meeting Attendance</h1>
          <p className="text-[#9CA3AF] text-sm mt-0.5">Track and manage community attendance</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#E5E7EB] text-sm font-semibold text-[#374151] hover:bg-[#EEF1F8] transition-colors">
            <Download size={14} /> Export Report
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* QR code card */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-6">
          <h2 className="text-[#1B2E6B] font-semibold text-sm mb-5">Scan for Today&apos;s Attendance</h2>
          <div className="flex flex-col items-center">
            <QRPlaceholder code={qrCode} />
            <p className="text-[#9CA3AF] text-xs mt-3 mb-4">Members scan this code to mark attendance</p>
            <div className="flex gap-3">
              <button className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#E5E7EB] text-sm font-semibold text-[#374151] hover:bg-[#EEF1F8] transition-colors">
                <Printer size={13} /> Print Code
              </button>
              <button className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#EEF1F8] text-[#1B2E6B] text-sm font-semibold hover:bg-[#dde3f0] transition-colors">
                <RefreshCw size={13} /> Reset Code
              </button>
            </div>
          </div>
        </div>

        {/* Live stats */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-6">
            <h2 className="text-[#1B2E6B] font-semibold text-sm mb-4">Live Attendance</h2>
            <div className="flex items-center gap-6">
              <CircularGauge pct={pct} current={live.current} total={live.total} />
              <div className="space-y-2">
                <div>
                  <p className="text-3xl font-bold text-[#1B2E6B]">{pct}%</p>
                  <p className="text-[#9CA3AF] text-xs">Attendance Rate</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-green-600 text-xs font-medium">Live</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#EEF1F8] flex items-center justify-center">
                <UserPlus size={16} className="text-[#1B2E6B]" />
              </div>
              <div>
                <p className="text-xl font-bold text-[#1B2E6B]">{live.newGuests}</p>
                <p className="text-[#9CA3AF] text-[10px]">New Guests</p>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#EEF1F8] flex items-center justify-center">
                <Clock size={16} className="text-[#1B2E6B]" />
              </div>
              <div>
                <p className="text-xl font-bold text-[#1B2E6B]">{live.avgTime}</p>
                <p className="text-[#9CA3AF] text-[10px]">Avg Time</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* History table */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-[#F3F4F6]">
          <h2 className="text-[#1B2E6B] font-semibold text-sm">Attendance History</h2>
        </div>
        {loading ? (
          <div className="py-12 text-center"><div className="w-7 h-7 border-2 border-[#1B2E6B] border-t-transparent rounded-full animate-spin mx-auto" /></div>
        ) : history.length === 0 ? (
          <div className="py-12 text-center text-[#9CA3AF] text-sm">No attendance records yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F9FAFB] border-b border-[#F3F4F6]">
                  {["Date", "Meeting Title", "Attendees", "Status", ""].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-[#9CA3AF]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {history.map((a) => (
                  <tr key={a.id} className="hover:bg-[#F9FAFB]">
                    <td className="px-4 py-3 text-[#6B7280] text-xs">{fmtDate(a.date)}</td>
                    <td className="px-4 py-3 text-[#374151] font-medium text-xs">{a.meetingTitle}</td>
                    <td className="px-4 py-3 text-xs">
                      <div className="flex items-center gap-1.5">
                        <Users size={12} className="text-[#9CA3AF]" />
                        <span className="text-[#374151] font-medium">{a.attendees?.length ?? 0}</span>
                        <span className="text-[#9CA3AF]">/ {a.totalCapacity}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
                    <td className="px-4 py-3">
                      <button className="text-xs font-semibold text-[#1B2E6B] hover:text-[#F5C518] transition-colors">
                        View Details
                      </button>
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

// ── Member view ───────────────────────────────────────────────────────────────
function MemberAttendance() {
  const { user } = useAuth();
  const [history, setHistory] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getDocs(query(collection(db, "attendance"), orderBy("date", "desc")))
      .then((snap) => {
        const all = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Attendance));
        setHistory(all.filter((a) => a.attendees?.some((at) => at.userId === user.id)));
      })
      .finally(() => setLoading(false));
  }, [user]);

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-[#1B2E6B]">My Attendance</h1>
      <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-12 text-center"><div className="w-7 h-7 border-2 border-[#1B2E6B] border-t-transparent rounded-full animate-spin mx-auto" /></div>
        ) : history.length === 0 ? (
          <div className="py-12 text-center text-[#9CA3AF]">
            <Users size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No attendance records found.</p>
          </div>
        ) : (
          <div className="divide-y divide-[#F3F4F6]">
            {history.map((a) => (
              <div key={a.id} className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="text-[#374151] font-medium text-sm">{a.meetingTitle}</p>
                  <p className="text-[#9CA3AF] text-xs mt-0.5">{fmtDate(a.date)}</p>
                </div>
                <StatusBadge status={a.status} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function AttendancePage() {
  const { user, role } = useAuth();
  if (!user) return null;
  return (role === "admin" || role === "super_admin") ? <AdminAttendance /> : <MemberAttendance />;
}
