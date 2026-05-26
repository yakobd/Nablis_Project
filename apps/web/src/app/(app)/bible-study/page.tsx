"use client";
import React, { useEffect, useState } from "react";
import {
  collection, query, orderBy, getDocs, Timestamp,
} from "firebase/firestore";
import { db, useAuth } from "@/lib/firebase";
import Link from "next/link";
import {
  Plus, BookOpen, Users, FileText, Clock, ChevronRight,
  Bell, Calendar, CheckCircle2,
} from "lucide-react";

interface BibleStudy {
  id: string;
  title: string;
  teacherName: string;
  memberCount: number;
  fileCount: number;
  startDate?: Timestamp | null;
  status: "active" | "upcoming" | "completed";
  imageURL?: string;
  description?: string;
  members?: string[];
  materials?: string[];
  createdAt?: Timestamp;
}

function fmtDate(ts: Timestamp | null | undefined) {
  if (!ts) return "—";
  try { return ts.toDate().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
  catch { return "—"; }
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active:    "bg-green-50 text-green-700",
    upcoming:  "bg-yellow-50 text-yellow-700",
    completed: "bg-gray-100 text-gray-500",
  };
  return (
    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold capitalize ${map[status] ?? "bg-gray-100 text-gray-600"}`}>
      {status}
    </span>
  );
}

// ── Mini Calendar ─────────────────────────────────────────────────────────────
function MiniCalendar() {
  const today = new Date();
  const year  = today.getFullYear();
  const month = today.getMonth();
  const monthName = today.toLocaleString("default", { month: "long" });
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = Array.from({ length: firstDay + daysInMonth }, (_, i) =>
    i < firstDay ? null : i - firstDay + 1
  );
  const highlightDays = [3, 10, 17, 24];

  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[#1B2E6B] font-bold text-sm">{monthName} {year}</p>
        <Calendar size={14} className="text-[#9CA3AF]" />
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center">
        {["S","M","T","W","T","F","S"].map((d) => (
          <div key={d} className="text-[9px] font-bold text-[#9CA3AF] py-1">{d}</div>
        ))}
        {cells.map((day, i) => (
          <div key={i} className={[
            "py-1.5 text-[10px] rounded-lg font-medium",
            !day ? "" : day === today.getDate()
              ? "bg-[#1B2E6B] text-white"
              : highlightDays.includes(day)
                ? "bg-[#F5C518]/20 text-[#1B2E6B]"
                : "text-[#374151] hover:bg-[#F3F4F6] cursor-pointer",
          ].join(" ")}>
            {day ?? ""}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Study card (book-style) ───────────────────────────────────────────────────
function StudyCard({ study }: { study: BibleStudy }) {
  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden hover:shadow-md transition-shadow group flex-shrink-0 w-48">
      <div className="h-28 bg-gradient-to-br from-[#1B2E6B] to-[#2a4499] relative">
        {study.imageURL ? (
          <img src={study.imageURL} alt={study.title}
            className="w-full h-full object-cover opacity-60 group-hover:opacity-70 transition-opacity" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <BookOpen size={32} className="text-white/30" />
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent">
          <StatusBadge status={study.status} />
        </div>
      </div>
      <div className="p-3">
        <p className="text-[#1B2E6B] font-bold text-xs line-clamp-2 mb-2">{study.title}</p>
        <div className="flex items-center justify-between text-[9px] text-[#9CA3AF]">
          <span className="flex items-center gap-1"><Users size={9} /> {study.memberCount}</span>
          <span className="flex items-center gap-1"><FileText size={9} /> {study.fileCount} files</span>
        </div>
      </div>
    </div>
  );
}

// ── Admin view ────────────────────────────────────────────────────────────────
function AdminBibleStudy({ studies, loading }: { studies: BibleStudy[]; loading: boolean }) {
  const reminders = [
    { label: "Tuesday Bible Class",  time: "7:00 PM",  participants: 24 },
    { label: "Friday Youth Study",   time: "5:00 PM",  participants: 12 },
    { label: "Sunday Morning Study", time: "8:00 AM",  participants: 36 },
  ];

  return (
    <div className="grid lg:grid-cols-3 gap-5">
      <div className="lg:col-span-2 space-y-5">
        {/* Bible Studies row */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[#1B2E6B] font-semibold text-sm">Bible Studies</h2>
            <Link href="/bible-study/create"
              className="flex items-center gap-1.5 bg-[#EEF1F8] text-[#1B2E6B] font-semibold text-xs px-3 py-1.5 rounded-lg hover:bg-[#dde3f0] transition-colors">
              <Plus size={12} /> New Study
            </Link>
          </div>
          {loading ? (
            <div className="py-10 text-center">
              <div className="w-6 h-6 border-2 border-[#1B2E6B] border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : studies.length === 0 ? (
            <div className="py-10 text-center text-[#9CA3AF]">
              <BookOpen size={28} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No bible studies yet.</p>
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-1">
              {studies.map((s) => <StudyCard key={s.id} study={s} />)}
            </div>
          )}
        </div>

        {/* Current Lessons table */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-[#F3F4F6] flex items-center justify-between">
            <h2 className="text-[#1B2E6B] font-semibold text-sm">Current Lessons</h2>
            <span className="text-[#9CA3AF] text-xs">{studies.filter((s) => s.status === "active").length} active</span>
          </div>
          {loading ? (
            <div className="py-10 text-center">
              <div className="w-6 h-6 border-2 border-[#1B2E6B] border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#F9FAFB] border-b border-[#F3F4F6]">
                    {["Class", "Teacher", "Members", "Starting Date", "Materials", "Status"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-[#9CA3AF]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3F4F6]">
                  {studies.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-[#9CA3AF] text-sm">
                        No lessons yet.
                      </td>
                    </tr>
                  ) : (
                    studies.map((s) => (
                      <tr key={s.id} className="hover:bg-[#F9FAFB]">
                        <td className="px-4 py-3">
                          <p className="text-[#374151] font-medium text-xs line-clamp-1">{s.title}</p>
                        </td>
                        <td className="px-4 py-3 text-[#6B7280] text-xs">{s.teacherName}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <Users size={11} className="text-[#9CA3AF]" />
                            <span className="text-[#374151] text-xs font-medium">{s.memberCount}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[#6B7280] text-xs">
                          <div className="flex items-center gap-1">
                            <Clock size={10} className="text-[#9CA3AF]" />
                            {fmtDate(s.startDate)}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 text-[#9CA3AF]">
                            <FileText size={11} />
                            <span className="text-xs">{s.fileCount}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Right sidebar */}
      <div className="space-y-4">
        <MiniCalendar />

        {/* Reminders */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <Bell size={14} className="text-[#1B2E6B]" />
            <h3 className="text-[#1B2E6B] font-semibold text-sm">This Week</h3>
          </div>
          <div className="space-y-2">
            {reminders.map((r) => (
              <div key={r.label} className="flex items-center justify-between py-2 border-b border-[#F3F4F6] last:border-0">
                <div>
                  <p className="text-[#374151] font-medium text-xs">{r.label}</p>
                  <p className="text-[#9CA3AF] text-[10px] flex items-center gap-1 mt-0.5">
                    <Clock size={9} /> {r.time} · {r.participants} members
                  </p>
                </div>
                <ChevronRight size={14} className="text-[#9CA3AF]" />
              </div>
            ))}
          </div>
        </div>

        {/* Create CTA */}
        <div className="bg-[#1B2E6B] rounded-2xl p-5 text-center">
          <BookOpen size={28} className="text-[#F5C518] mx-auto mb-2" />
          <p className="text-white font-bold text-sm mb-1">Create New Study</p>
          <p className="text-white/60 text-xs mb-4">Start a new bible study session for your community</p>
          <Link href="/bible-study/create"
            className="block w-full bg-[#F5C518] text-[#1B2E6B] font-semibold text-sm py-2 rounded-xl hover:bg-[#e6b800] transition-colors">
            Get Started
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Member view ───────────────────────────────────────────────────────────────
function MemberBibleStudy({ studies, loading }: { studies: BibleStudy[]; loading: boolean }) {
  const { user } = useAuth();

  const myStudies = studies.filter((s) =>
    s.members?.includes(user?.id ?? "") || s.status === "active"
  );
  const progress = Math.min(100, Math.round((myStudies.filter((s) => s.status === "completed").length / Math.max(myStudies.length, 1)) * 100));

  return (
    <div className="space-y-5">
      {/* Welcome + progress */}
      <div className="bg-[#1B2E6B] rounded-2xl p-6 flex items-center justify-between">
        <div>
          <p className="text-white/70 text-xs mb-1">Welcome back,</p>
          <p className="text-white font-bold text-lg">{user?.displayName || user?.email}</p>
          <p className="text-white/60 text-xs mt-2">{myStudies.length} studies enrolled</p>
        </div>
        <div className="text-right">
          <p className="text-[#F5C518] text-3xl font-bold">{progress}%</p>
          <p className="text-white/60 text-xs">Completion</p>
          <div className="w-32 h-2 bg-white/20 rounded-full mt-2 overflow-hidden">
            <div className="h-full bg-[#F5C518] rounded-full transition-all duration-700" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      {/* My studies */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-5">
        <h2 className="text-[#1B2E6B] font-semibold text-sm mb-4">My Bible Studies</h2>
        {loading ? (
          <div className="py-10 text-center">
            <div className="w-6 h-6 border-2 border-[#1B2E6B] border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : myStudies.length === 0 ? (
          <div className="py-10 text-center text-[#9CA3AF]">
            <BookOpen size={28} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">You&apos;re not enrolled in any bible studies yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {myStudies.map((s) => (
              <div key={s.id} className="flex items-center gap-4 p-3 rounded-xl border border-[#F3F4F6] hover:bg-[#F9FAFB] transition-colors">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#1B2E6B] to-[#2a4499] flex items-center justify-center flex-shrink-0">
                  <BookOpen size={18} className="text-white/60" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[#374151] font-semibold text-sm line-clamp-1">{s.title}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[#9CA3AF] text-[10px]">Teacher: {s.teacherName}</span>
                    <span className="text-[#9CA3AF] text-[10px] flex items-center gap-1"><Clock size={9} /> {fmtDate(s.startDate)}</span>
                  </div>
                </div>
                <StatusBadge status={s.status} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upcoming schedule sidebar */}
      <div className="grid sm:grid-cols-2 gap-4">
        <MiniCalendar />
        <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-4">
          <h3 className="text-[#1B2E6B] font-semibold text-sm mb-3 flex items-center gap-2">
            <CheckCircle2 size={14} /> Quick Actions
          </h3>
          <div className="space-y-2">
            {[
              { label: "View Materials",    icon: FileText },
              { label: "Join Next Session", icon: Users },
              { label: "Contact Teacher",   icon: Bell },
            ].map(({ label, icon: Icon }) => (
              <button key={label}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-[#E5E7EB] text-sm text-[#374151] font-medium hover:bg-[#EEF1F8] transition-colors">
                <Icon size={14} className="text-[#1B2E6B]" /> {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function BibleStudyPage() {
  const { user, role } = useAuth();
  const isAdminOrSuperAdmin = role === "admin" || role === "super_admin";
  const [studies, setStudies] = useState<BibleStudy[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDocs(query(collection(db, "bibleStudies"), orderBy("createdAt", "desc")))
      .then((snap) => setStudies(snap.docs.map((d) => {
        const data = d.data();
        return {
          id:          d.id,
          title:       data.title ?? "",
          teacherName: data.teacherName ?? "",
          memberCount: data.members?.length ?? 0,
          fileCount:   data.materials?.length ?? 0,
          startDate:   data.startDate ?? null,
          status:      data.status ?? "upcoming",
          imageURL:    data.imageURL ?? "",
          description: data.description ?? "",
          members:     data.members ?? [],
          materials:   data.materials ?? [],
          createdAt:   data.createdAt,
        } as BibleStudy;
      })))
      .finally(() => setLoading(false));
  }, []);

  if (!user) return null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#1B2E6B]">Bible Study</h1>
          <p className="text-[#9CA3AF] text-sm mt-0.5">Deepen your understanding of scripture</p>
        </div>
        {isAdminOrSuperAdmin && (
          <Link href="/bible-study/create"
            className="flex items-center gap-1.5 bg-[#F5C518] text-[#1B2E6B] font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-[#e6b800] transition-colors">
            <Plus size={15} /> Create Study
          </Link>
        )}
      </div>

      {isAdminOrSuperAdmin
        ? <AdminBibleStudy studies={studies} loading={loading} />
        : <MemberBibleStudy studies={studies} loading={loading} />}
    </div>
  );
}
