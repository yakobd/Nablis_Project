"use client";
import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  collection, getDocs, query, where, doc, updateDoc,
  deleteDoc, serverTimestamp, orderBy, Timestamp,
} from "firebase/firestore";
import { db, useAuth } from "@/lib/firebase";
import type { User, Appointment, PrayerLog } from "@nablis/shared/firebase";
import { useRouter } from "next/navigation";
import Link from "next/link";

// ─── helpers ─────────────────────────────────────────────────────────────────
function fmtDate(ts: Timestamp | null | undefined) {
  if (!ts) return "—";
  try { return ts.toDate().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
  catch { return "—"; }
}

function nameInitials(m: User) {
  return (m.displayName || m.email || "?")[0].toUpperCase();
}

function computeStreak(logs: PrayerLog[]): number {
  if (!logs.length) return 0;
  const days = [...new Set(
    logs.map((l) => l.prayedAt?.toDate?.()?.toISOString().split("T")[0])
      .filter((d): d is string => !!d),
  )].sort().reverse();
  let streak = 0;
  let prev = new Date(); prev.setHours(0, 0, 0, 0);
  for (const dayStr of days) {
    const d = new Date(dayStr + "T00:00:00");
    const diff = Math.round((prev.getTime() - d.getTime()) / 86400000);
    if (diff <= 1) { streak++; prev = d; } else break;
  }
  return streak;
}

function getPhone(m: User) { return m.phone || m.phoneNumber || ""; }
function getCity(m: User)  { return m.cityOfResidence || m.city || ""; }

// ─── micro components ─────────────────────────────────────────────────────────
function AvatarImg({ member, size = 40 }: { member: User; size?: number }) {
  return (
    <div
      className="rounded-full bg-[#1B2E6B] flex items-center justify-center flex-shrink-0 overflow-hidden"
      style={{ width: size, height: size }}
    >
      {member.photoURL
        ? <img src={member.photoURL} alt={member.displayName} className="w-full h-full object-cover" />
        : <span style={{ fontSize: size * 0.36 }} className="text-[#F5C518] font-bold leading-none select-none">{nameInitials(member)}</span>
      }
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  const cls: Record<string, string> = {
    super_admin: "bg-[#1B2E6B] text-[#F5C518]",
    admin:       "bg-[#EEF1F8] text-[#1B2E6B]",
    member:      "bg-[#F3F4F6] text-[#6B7280]",
  };
  const lbl: Record<string, string> = {
    super_admin: "Spiritual Father", admin: "Admin", member: "Member",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${cls[role] ?? "bg-gray-100 text-gray-600"}`}>
      {lbl[role] ?? role}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls: Record<string, string> = {
    active:   "bg-green-50 text-green-700 border border-green-100",
    pending:  "bg-yellow-50 text-yellow-700 border border-yellow-100",
    rejected: "bg-red-50 text-red-600 border border-red-100",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${cls[status] ?? "bg-gray-100 text-gray-600"}`}>
      {status}
    </span>
  );
}

// ─── MemberDetailModal ────────────────────────────────────────────────────────
interface ModalStats {
  appointments: Appointment[];
  prayerLogs: PrayerLog[];
  messageCount: number;
}

function MemberDetailModal({
  member: initMember,
  apptCountMap,
  prayerMap,
  onClose,
  onUpdate,
}: {
  member: User;
  apptCountMap: Record<string, number>;
  prayerMap: Record<string, { streak: number; total: number }>;
  onClose: () => void;
  onUpdate: (updated: User) => void;
}) {
  const [member, setMember] = useState<User>(initMember);
  const [tab, setTab] = useState<"info" | "appointments" | "activity">("info");
  const [stats, setStats] = useState<ModalStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [confirming, setConfirming] = useState<"delete" | "suspend" | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const prayerStats = prayerMap[member.id] ?? { streak: 0, total: 0 };
  const apptCount   = apptCountMap[member.id] ?? 0;

  useEffect(() => {
    setLoadingStats(true);
    Promise.all([
      getDocs(query(collection(db, "appointments"), where("memberId", "==", member.id), orderBy("date", "desc"))),
      getDocs(query(collection(db, "prayerLogs"), where("userId", "==", member.id))),
      getDocs(query(collection(db, "conversations"), where("memberId", "==", member.id))),
    ]).then(([aSnap, pSnap, cSnap]) => {
      setStats({
        appointments: aSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Appointment)),
        prayerLogs:   pSnap.docs.map((d) => ({ id: d.id, ...d.data() } as PrayerLog)),
        messageCount: cSnap.size,
      });
    }).catch(console.error).finally(() => setLoadingStats(false));
  }, [member.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("folder", "nablis/profiles");
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const { url } = await res.json() as { url: string };
      await updateDoc(doc(db, "users", member.id), { photoURL: url });
      const updated = { ...member, photoURL: url };
      setMember(updated);
      onUpdate(updated);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function runAction(action: "approve" | "reject" | "promote" | "demote" | "suspend" | "delete") {
    setSaving(true);
    try {
      if (action === "delete") {
        await deleteDoc(doc(db, "users", member.id));
        onClose();
        return;
      }
      const updates: Partial<User & { updatedAt: unknown }> = { updatedAt: serverTimestamp() };
      if (action === "approve")  { updates.status = "active"; }
      if (action === "reject")   { updates.status = "rejected"; }
      if (action === "promote")  { updates.role   = "admin"; }
      if (action === "demote")   { updates.role   = "member"; }
      if (action === "suspend")  { updates.status = "rejected"; }
      await updateDoc(doc(db, "users", member.id), updates);
      const updated = { ...member, ...updates } as User;
      setMember(updated);
      onUpdate(updated);
    } finally {
      setSaving(false);
      setConfirming(null);
    }
  }

  const now = new Date();
  const upcomingAppts = stats?.appointments.filter((a) => a.date?.toDate() >= now) ?? [];
  const pastAppts     = stats?.appointments.filter((a) => a.date?.toDate() < now)  ?? [];
  const streak        = stats ? computeStreak(stats.prayerLogs) : prayerStats.streak;
  const totalPrayers  = stats?.prayerLogs.length ?? prayerStats.total;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#F3F4F6] flex-shrink-0">
          <div className="flex items-center gap-3">
            <AvatarImg member={member} size={44} />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[#1B2E6B] font-bold text-base">{member.displayName || "—"}</h2>
                <RoleBadge role={member.role} />
                <StatusBadge status={member.status} />
              </div>
              {member.christianName && (
                <p className="text-[#9CA3AF] text-xs mt-0.5">✝ {member.christianName}</p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-[#F3F4F6] text-[#9CA3AF] transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left panel */}
          <div className="w-64 border-r border-[#F3F4F6] flex flex-col flex-shrink-0 overflow-y-auto">
            {/* Avatar with upload */}
            <div className="p-5 flex flex-col items-center gap-3 border-b border-[#F9FAFB]">
              <div className="relative group cursor-pointer" onClick={() => !uploading && fileRef.current?.click()}>
                <AvatarImg member={member} size={80} />
                <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  {uploading
                    ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  }
                </div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
              </div>
              <p className="text-[9px] text-[#9CA3AF] text-center">Click photo to change</p>
            </div>

            {/* Quick stats */}
            <div className="p-4 space-y-2 border-b border-[#F9FAFB]">
              {[
                { label: "Appointments", value: String(apptCount) },
                { label: "Prayer Streak", value: `${streak} days` },
                { label: "Total Prayers", value: String(totalPrayers) },
                { label: "Messages", value: String(stats?.messageCount ?? "—") },
                { label: "Member Since", value: fmtDate(member.createdAt) },
              ].map((s) => (
                <div key={s.label} className="flex items-center justify-between">
                  <span className="text-[#9CA3AF] text-xs">{s.label}</span>
                  <span className="text-[#374151] text-xs font-semibold">{s.value}</span>
                </div>
              ))}
            </div>

            {/* Action buttons */}
            <div className="p-4 space-y-2">
              {member.status === "pending" && (
                <>
                  <button
                    onClick={() => runAction("approve")}
                    disabled={saving}
                    className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[#1B2E6B] text-white text-xs font-semibold hover:bg-[#162554] transition-colors disabled:opacity-60"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    Approve Member
                  </button>
                  <button
                    onClick={() => runAction("reject")}
                    disabled={saving}
                    className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100 transition-colors disabled:opacity-60"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    Reject
                  </button>
                </>
              )}
              {member.role === "member" && member.status === "active" && (
                <button
                  onClick={() => runAction("promote")}
                  disabled={saving}
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[#EEF1F8] text-[#1B2E6B] text-xs font-semibold hover:bg-[#dde3f0] transition-colors disabled:opacity-60"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="18 15 12 9 6 15"/></svg>
                  Promote to Admin
                </button>
              )}
              {member.role === "admin" && (
                <button
                  onClick={() => runAction("demote")}
                  disabled={saving}
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[#EEF1F8] text-[#1B2E6B] text-xs font-semibold hover:bg-[#dde3f0] transition-colors disabled:opacity-60"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
                  Demote to Member
                </button>
              )}
              <button
                onClick={() => router.push(`/messaging?member=${member.id}`)}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[#F5C518] text-[#1B2E6B] text-xs font-semibold hover:bg-[#e6b800] transition-colors"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                Send Message
              </button>
              <Link
                href={`/members/${member.id}`}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-[#E5E7EB] text-[#374151] text-xs font-semibold hover:bg-[#F9FAFB] transition-colors"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                Full Profile Page
              </Link>

              <div className="pt-2 border-t border-[#F9FAFB] space-y-1.5">
                {member.status === "active" && (
                  <button
                    onClick={() => setConfirming("suspend")}
                    className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-orange-200 text-orange-600 text-xs font-semibold hover:bg-orange-50 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                    Suspend Account
                  </button>
                )}
                <button
                  onClick={() => setConfirming("delete")}
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-red-200 text-red-500 text-xs font-semibold hover:bg-red-50 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                  Delete Account
                </button>
              </div>
            </div>
          </div>

          {/* Right panel */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Tabs */}
            <div className="flex border-b border-[#F3F4F6] px-1 flex-shrink-0">
              {(["info", "appointments", "activity"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={[
                    "px-5 py-3.5 text-sm font-medium capitalize transition-colors border-b-2",
                    tab === t ? "text-[#1B2E6B] border-[#1B2E6B]" : "text-[#6B7280] border-transparent hover:text-[#1B2E6B]",
                  ].join(" ")}
                >
                  {t === "appointments"
                    ? `Appointments (${stats?.appointments.length ?? apptCount})`
                    : t === "activity"
                    ? "Activity"
                    : "Info"}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {/* Info tab */}
              {tab === "info" && (
                <div className="space-y-5">
                  <InfoSection title="Personal Information" rows={[
                    ["Full Name",       member.displayName],
                    ["Christian Name",  member.christianName],
                    ["Email",           member.email],
                    ["Phone",           getPhone(member)],
                    ["Role",            member.role],
                    ["Status",         member.status],
                  ]} />
                  <InfoSection title="Location" rows={[
                    ["Country",        member.countryOfResidence],
                    ["City",           getCity(member)],
                    ["Neighborhood",   member.neighborhood],
                  ]} />
                  <InfoSection title="Church Information" rows={[
                    ["Parish Church",  member.parishChurch],
                    ["Christian Name", member.christianName],
                  ]} />
                  <InfoSection title="Account" rows={[
                    ["Registered",     fmtDate(member.createdAt)],
                    ["Member ID",      member.id.slice(0, 12) + "…"],
                  ]} />

                  {/* Prayer stats */}
                  <div className="bg-[#F9FAFB] rounded-2xl border border-[#E5E7EB] p-4">
                    <p className="text-xs font-bold text-[#9CA3AF] mb-3">PRAYER STATISTICS</p>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: "Current Streak", value: `${streak}d` },
                        { label: "Total Prayers",  value: String(totalPrayers) },
                        { label: "Last Prayer",    value: stats?.prayerLogs[0] ? fmtDate(stats.prayerLogs[0].prayedAt) : "—" },
                      ].map((s) => (
                        <div key={s.label} className="bg-white rounded-xl p-3 text-center border border-[#F3F4F6]">
                          <p className="text-lg font-bold text-[#1B2E6B]">{s.value}</p>
                          <p className="text-[9px] text-[#9CA3AF] mt-0.5">{s.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Appointments tab */}
              {tab === "appointments" && (
                <div className="space-y-3">
                  {loadingStats ? (
                    <div className="py-10 text-center">
                      <div className="w-6 h-6 border-2 border-[#1B2E6B] border-t-transparent rounded-full animate-spin mx-auto" />
                    </div>
                  ) : !stats?.appointments.length ? (
                    <div className="py-10 text-center text-[#9CA3AF] text-sm">
                      <p className="text-3xl mb-2">📅</p>
                      <p>No appointments yet</p>
                    </div>
                  ) : (
                    <>
                      <div className="flex gap-4 text-sm mb-4">
                        <span className="text-[#9CA3AF]">Upcoming: <strong className="text-[#1B2E6B]">{upcomingAppts.length}</strong></span>
                        <span className="text-[#9CA3AF]">Past: <strong className="text-[#1B2E6B]">{pastAppts.length}</strong></span>
                      </div>
                      {stats.appointments.map((a) => (
                        <div key={a.id} className="flex items-center justify-between p-3.5 bg-[#F9FAFB] rounded-xl border border-[#F3F4F6]">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-[#EEF1F8] flex items-center justify-center text-lg flex-shrink-0">
                              {{confession:"🕊️",counseling:"🙏",marriage:"💍",other:"📋"}[a.serviceType] ?? "📋"}
                            </div>
                            <div>
                              <p className="text-[#374151] text-sm font-medium capitalize">{a.serviceType}</p>
                              <p className="text-[#9CA3AF] text-xs">{fmtDate(a.date)} · {a.time || "—"}</p>
                            </div>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            a.status === "confirmed" ? "bg-green-50 text-green-700" :
                            a.status === "pending"   ? "bg-yellow-50 text-yellow-700" :
                            "bg-red-50 text-red-600"
                          }`}>
                            {a.status.toUpperCase()}
                          </span>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}

              {/* Activity tab */}
              {tab === "activity" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { emoji: "📿", label: "Total Prayers", value: String(totalPrayers) },
                      { emoji: "🔥", label: "Prayer Streak", value: `${streak} days` },
                      { emoji: "📅", label: "Appointments",  value: String(stats?.appointments.length ?? apptCount) },
                      { emoji: "💬", label: "Messages",      value: String(stats?.messageCount ?? "—") },
                    ].map((s) => (
                      <div key={s.label} className="bg-[#F9FAFB] rounded-xl border border-[#F3F4F6] p-4 flex items-center gap-3">
                        <span className="text-2xl">{s.emoji}</span>
                        <div>
                          <p className="text-xl font-bold text-[#1B2E6B]">{s.value}</p>
                          <p className="text-xs text-[#9CA3AF]">{s.label}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="bg-[#F9FAFB] rounded-xl border border-[#F3F4F6] p-4">
                    <p className="text-xs font-bold text-[#9CA3AF] mb-3">MEMBER SINCE</p>
                    <p className="text-[#374151] font-semibold">{fmtDate(member.createdAt)}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Confirm dialog */}
        {confirming && (
          <div className="absolute inset-0 bg-black/50 rounded-2xl flex items-center justify-center z-10" onClick={() => setConfirming(null)}>
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-[#1B2E6B] font-bold text-base mb-2">
                {confirming === "delete" ? "Delete Account" : "Suspend Account"}
              </h3>
              <p className="text-[#6B7280] text-sm mb-5">
                {confirming === "delete"
                  ? `Permanently delete ${member.displayName || member.email}'s account? This cannot be undone.`
                  : `Suspend ${member.displayName || member.email}'s access? They won't be able to log in.`
                }
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => runAction(confirming)}
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-semibold text-sm hover:bg-red-600 transition-colors disabled:opacity-60"
                >
                  {saving ? "…" : confirming === "delete" ? "Delete" : "Suspend"}
                </button>
                <button
                  onClick={() => setConfirming(null)}
                  className="flex-1 py-2.5 rounded-xl border border-[#E5E7EB] text-[#374151] font-semibold text-sm hover:bg-[#F9FAFB] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── InfoSection helper ───────────────────────────────────────────────────────
function InfoSection({ title, rows }: { title: string; rows: [string, string | null | undefined][] }) {
  const visible = rows.filter(([, v]) => v);
  if (!visible.length) return null;
  return (
    <div>
      <p className="text-xs font-bold text-[#9CA3AF] mb-2">{title.toUpperCase()}</p>
      <div className="grid sm:grid-cols-2 gap-2">
        {visible.map(([label, value]) => (
          <div key={label} className="bg-[#F9FAFB] rounded-xl px-3.5 py-2.5 border border-[#F3F4F6]">
            <p className="text-[10px] text-[#9CA3AF] mb-0.5">{label}</p>
            <p className="text-sm text-[#374151] font-medium capitalize">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── MemberCard ───────────────────────────────────────────────────────────────
function MemberCard({
  member,
  apptCount,
  prayerStreak,
  onView,
  onAction,
}: {
  member: User;
  apptCount: number;
  prayerStreak: number;
  onView: () => void;
  onAction: (action: "approve" | "reject" | "promote" | "demote" | "delete") => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const phone = getPhone(member);
  const city  = getCity(member);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm hover:shadow-md hover:border-[#1B2E6B]/20 transition-all p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <AvatarImg member={member} size={48} />
        <div className="flex-1 min-w-0">
          <p className="text-[#1B2E6B] font-bold text-sm truncate">{member.displayName || "—"}</p>
          {member.christianName && (
            <p className="text-[#9CA3AF] text-xs truncate">✝ {member.christianName}</p>
          )}
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <RoleBadge role={member.role} />
            <StatusBadge status={member.status} />
          </div>
        </div>
        {/* Menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="p-1.5 rounded-lg hover:bg-[#F3F4F6] text-[#9CA3AF] transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl border border-[#E5E7EB] shadow-lg py-1 z-10">
              {member.status === "pending" && (
                <>
                  <button onClick={() => { onAction("approve"); setMenuOpen(false); }}
                    className="w-full text-left px-3 py-2 text-xs text-green-700 hover:bg-green-50 transition-colors flex items-center gap-2">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    Approve
                  </button>
                  <button onClick={() => { onAction("reject"); setMenuOpen(false); }}
                    className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    Reject
                  </button>
                </>
              )}
              {member.role === "member" && member.status === "active" && (
                <button onClick={() => { onAction("promote"); setMenuOpen(false); }}
                  className="w-full text-left px-3 py-2 text-xs text-[#374151] hover:bg-[#EEF1F8] transition-colors flex items-center gap-2">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="18 15 12 9 6 15"/></svg>
                  Promote to Admin
                </button>
              )}
              {member.role === "admin" && (
                <button onClick={() => { onAction("demote"); setMenuOpen(false); }}
                  className="w-full text-left px-3 py-2 text-xs text-[#374151] hover:bg-[#EEF1F8] transition-colors flex items-center gap-2">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
                  Demote to Member
                </button>
              )}
              <Link href={`/members/${member.id}/edit`}
                className="w-full text-left px-3 py-2 text-xs text-[#374151] hover:bg-[#EEF1F8] transition-colors flex items-center gap-2">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Edit Details
              </Link>
              <div className="border-t border-[#F3F4F6] my-1" />
              <button onClick={() => { onAction("delete"); setMenuOpen(false); }}
                className="w-full text-left px-3 py-2 text-xs text-red-500 hover:bg-red-50 transition-colors flex items-center gap-2">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                Delete Account
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Details */}
      <div className="space-y-1.5">
        {member.email && (
          <div className="flex items-center gap-2 text-xs text-[#6B7280] truncate">
            <svg className="w-3.5 h-3.5 text-[#9CA3AF] flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            <span className="truncate">{member.email}</span>
          </div>
        )}
        {phone && (
          <div className="flex items-center gap-2 text-xs text-[#6B7280]">
            <svg className="w-3.5 h-3.5 text-[#9CA3AF] flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 14.1a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.62 3.5h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 10.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
            {phone}
          </div>
        )}
        {(city || member.countryOfResidence) && (
          <div className="flex items-center gap-2 text-xs text-[#6B7280]">
            <svg className="w-3.5 h-3.5 text-[#9CA3AF] flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            {[city, member.countryOfResidence].filter(Boolean).join(", ")}
          </div>
        )}
        {member.parishChurch && (
          <div className="flex items-center gap-2 text-xs text-[#6B7280]">
            <svg className="w-3.5 h-3.5 text-[#9CA3AF] flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 22V8l10-6 10 6v14H2z"/><rect x="8" y="14" width="8" height="8"/><line x1="12" y1="2" x2="12" y2="8"/></svg>
            {member.parishChurch}
          </div>
        )}
        {member.neighborhood && (
          <div className="flex items-center gap-2 text-xs text-[#6B7280]">
            <svg className="w-3.5 h-3.5 text-[#9CA3AF] flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="9" width="18" height="13" rx="2"/><path d="M8 22V12h8v10"/><path d="M3 9l9-6 9 6"/></svg>
            {member.neighborhood}
          </div>
        )}
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-3 pt-3 border-t border-[#F9FAFB]">
        <div className="flex items-center gap-1 text-xs text-[#6B7280]">
          <svg className="w-3.5 h-3.5 text-orange-400" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c0 0-7 7-7 12a7 7 0 0 0 14 0c0-5-7-12-7-12z"/></svg>
          <span>{prayerStreak}d streak</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-[#6B7280]">
          <svg className="w-3.5 h-3.5 text-[#9CA3AF]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          <span>{apptCount} appts</span>
        </div>
        <div className="ml-auto text-[10px] text-[#9CA3AF]">
          {fmtDate(member.createdAt)}
        </div>
      </div>

      {/* View profile button */}
      <button
        onClick={onView}
        className="w-full py-2 rounded-xl bg-[#EEF1F8] text-[#1B2E6B] text-xs font-semibold hover:bg-[#1B2E6B] hover:text-white transition-colors"
      >
        View Full Profile
      </button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function MembersPage() {
  const { role } = useAuth();
  const [members, setMembers]           = useState<User[]>([]);
  const [apptCountMap, setApptCountMap] = useState<Record<string, number>>({});
  const [prayerMap, setPrayerMap]       = useState<Record<string, { streak: number; total: number }>>({});
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState("");
  const [roleFilter, setRoleFilter]     = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy]             = useState<"name" | "date" | "streak" | "appts">("date");
  const [view, setView]                 = useState<"grid" | "table">("grid");
  const [tab, setTab]                   = useState<"all" | "pending">("all");
  const [selected, setSelected]         = useState<User | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [usersSnap, apptsSnap, prayerSnap] = await Promise.all([
        getDocs(query(collection(db, "users"), orderBy("createdAt", "desc"))),
        getDocs(collection(db, "appointments")),
        getDocs(collection(db, "prayerLogs")),
      ]);

      const users = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() } as User));
      setMembers(users);

      const aMap: Record<string, number> = {};
      apptsSnap.docs.forEach((d) => {
        const mid = d.data().memberId as string;
        if (mid) aMap[mid] = (aMap[mid] ?? 0) + 1;
      });
      setApptCountMap(aMap);

      const logs = prayerSnap.docs.map((d) => ({ id: d.id, ...d.data() } as PrayerLog));
      const pMap: Record<string, PrayerLog[]> = {};
      logs.forEach((l) => { if (l.userId) { pMap[l.userId] = [...(pMap[l.userId] ?? []), l]; } });
      const pStatMap: Record<string, { streak: number; total: number }> = {};
      Object.entries(pMap).forEach(([uid, ls]) => {
        pStatMap[uid] = { streak: computeStreak(ls), total: ls.length };
      });
      setPrayerMap(pStatMap);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalMembers = members.filter((m) => m.role !== "super_admin").length;
  const activeCount  = members.filter((m) => m.status === "active").length;
  const pendingCount = members.filter((m) => m.status === "pending").length;
  const adminCount   = members.filter((m) => m.role === "admin").length;

  const filtered = members
    .filter((m) => {
      if (tab === "pending" && m.status !== "pending") return false;
      if (m.role === "super_admin") return false;
      if (roleFilter !== "all" && m.role !== roleFilter) return false;
      if (statusFilter !== "all" && m.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const phone = getPhone(m).toLowerCase();
        return (
          (m.displayName ?? "").toLowerCase().includes(q) ||
          (m.email ?? "").toLowerCase().includes(q) ||
          (m.christianName ?? "").toLowerCase().includes(q) ||
          phone.includes(q) ||
          (m.parishChurch ?? "").toLowerCase().includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "name")   return (a.displayName ?? "").localeCompare(b.displayName ?? "");
      if (sortBy === "streak") return (prayerMap[b.id]?.streak ?? 0) - (prayerMap[a.id]?.streak ?? 0);
      if (sortBy === "appts")  return (apptCountMap[b.id] ?? 0) - (apptCountMap[a.id] ?? 0);
      return (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0);
    });

  function handleUpdate(updated: User) {
    setMembers((p) => p.map((m) => (m.id === updated.id ? updated : m)));
    if (selected?.id === updated.id) setSelected(updated);
  }

  function handleCardAction(member: User, action: "approve" | "reject" | "promote" | "demote" | "delete") {
    if (action === "delete") {
      if (!confirm(`Delete ${member.displayName || member.email}? This cannot be undone.`)) return;
      deleteDoc(doc(db, "users", member.id)).then(() => {
        setMembers((p) => p.filter((m) => m.id !== member.id));
      });
      return;
    }
    const updates: Partial<User & { updatedAt: unknown }> = { updatedAt: serverTimestamp() };
    if (action === "approve") updates.status = "active";
    if (action === "reject")  updates.status = "rejected";
    if (action === "promote") updates.role   = "admin";
    if (action === "demote")  updates.role   = "member";
    updateDoc(doc(db, "users", member.id), updates).then(() => {
      handleUpdate({ ...member, ...updates } as User);
    });
  }

  // Guard: only super_admin and admin can access member management
  if (role !== "super_admin" && role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="text-5xl mb-4">🔒</div>
        <h2 className="text-xl font-bold text-[#1B2E6B] mb-2">Access Restricted</h2>
        <p className="text-[#9CA3AF] text-sm">Member management is only available to administrators.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-[#1B2E6B]">Member Management</h1>
        <p className="text-[#9CA3AF] text-sm mt-0.5">Manage and monitor all spiritual children</p>
      </div>

      {/* Stats */}
      {loading ? (
        <div className="py-8 text-center">
          <div className="w-6 h-6 border-2 border-[#1B2E6B] border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Total Members", value: totalMembers, emoji: "👥", color: "text-[#1B2E6B]" },
            { label: "Active",        value: activeCount,  emoji: "✅", color: "text-green-600" },
            { label: "Pending",       value: pendingCount, emoji: "⏳", color: "text-yellow-600" },
            { label: "Admins",        value: adminCount,   emoji: "🛡️",  color: "text-purple-600" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-4">
              <div className="text-2xl mb-2">{s.emoji}</div>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-[#9CA3AF] mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tab bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1 bg-white rounded-xl border border-[#E5E7EB] p-1">
          {(["all", "pending"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={[
                "px-4 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5",
                tab === t ? "bg-[#1B2E6B] text-white" : "text-[#6B7280] hover:text-[#1B2E6B]",
              ].join(" ")}
            >
              {t === "all" ? "All Members" : "Pending Approvals"}
              {t === "pending" && pendingCount > 0 && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${tab === "pending" ? "bg-white/20" : "bg-yellow-100 text-yellow-700"}`}>
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* View toggle */}
        <div className="flex gap-1 bg-white rounded-xl border border-[#E5E7EB] p-1">
          {(["grid", "table"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${view === v ? "bg-[#1B2E6B] text-white" : "text-[#9CA3AF] hover:text-[#1B2E6B]"}`}
              title={v === "grid" ? "Grid view" : "Table view"}
            >
              {v === "grid"
                ? <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
                : <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
              }
            </button>
          ))}
        </div>
      </div>

      {/* Search + filters */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <svg className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, christian name, phone…"
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#E5E7EB] text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2E6B]/20 focus:border-[#1B2E6B] transition-colors"
          />
        </div>
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}
          className="px-3 py-2 rounded-xl border border-[#E5E7EB] text-sm text-[#374151] bg-white focus:outline-none">
          <option value="all">All Roles</option>
          <option value="admin">Admin</option>
          <option value="member">Member</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-xl border border-[#E5E7EB] text-sm text-[#374151] bg-white focus:outline-none">
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="pending">Pending</option>
          <option value="rejected">Rejected</option>
        </select>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          className="px-3 py-2 rounded-xl border border-[#E5E7EB] text-sm text-[#374151] bg-white focus:outline-none">
          <option value="date">Newest First</option>
          <option value="name">Name A–Z</option>
          <option value="streak">Prayer Streak</option>
          <option value="appts">Most Appointments</option>
        </select>
        {(search || roleFilter !== "all" || statusFilter !== "all") && (
          <button
            onClick={() => { setSearch(""); setRoleFilter("all"); setStatusFilter("all"); }}
            className="px-3 py-2 rounded-xl text-xs text-[#9CA3AF] hover:text-red-500 hover:bg-red-50 transition-colors font-medium"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-[#9CA3AF]">
          Showing <strong className="text-[#374151]">{filtered.length}</strong> of {members.filter((m) => m.role !== "super_admin").length} members
        </p>
        <Link href="/members/new"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F5C518] text-[#1B2E6B] text-xs font-semibold hover:bg-[#e6b800] transition-colors">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Member
        </Link>
      </div>

      {/* Content */}
      {loading ? (
        <div className="py-16 text-center">
          <div className="w-7 h-7 border-2 border-[#1B2E6B] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-[#9CA3AF] text-sm">Loading members…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-[#9CA3AF]">
          <p className="text-4xl mb-3">👥</p>
          <p className="text-sm font-medium">{tab === "pending" ? "No pending registrations" : "No members found"}</p>
          {search && <button onClick={() => setSearch("")} className="mt-2 text-xs text-[#1B2E6B] font-semibold hover:underline">Clear search</button>}
        </div>
      ) : view === "grid" ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((m) => (
            <MemberCard
              key={m.id}
              member={m}
              apptCount={apptCountMap[m.id] ?? 0}
              prayerStreak={prayerMap[m.id]?.streak ?? 0}
              onView={() => setSelected(m)}
              onAction={(action) => handleCardAction(m, action)}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F9FAFB] border-b border-[#F3F4F6]">
                  {["Member", "Christian Name", "Contact", "Location", "Church", "Role", "Status", "Joined", ""].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-[#9CA3AF] whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {filtered.map((m) => (
                  <tr key={m.id} className="hover:bg-[#F9FAFB] transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <AvatarImg member={m} size={32} />
                        <div>
                          <p className="text-[#374151] font-medium text-xs">{m.displayName || "—"}</p>
                          <p className="text-[#9CA3AF] text-[10px] truncate max-w-[140px]">{m.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#6B7280] text-xs">{m.christianName || "—"}</td>
                    <td className="px-4 py-3 text-[#6B7280] text-xs">{getPhone(m) || "—"}</td>
                    <td className="px-4 py-3 text-[#6B7280] text-xs whitespace-nowrap">
                      {[getCity(m), m.countryOfResidence].filter(Boolean).join(", ") || "—"}
                    </td>
                    <td className="px-4 py-3 text-[#6B7280] text-xs max-w-[120px] truncate">{m.parishChurch || "—"}</td>
                    <td className="px-4 py-3"><RoleBadge role={m.role} /></td>
                    <td className="px-4 py-3"><StatusBadge status={m.status} /></td>
                    <td className="px-4 py-3 text-[#6B7280] text-xs whitespace-nowrap">{fmtDate(m.createdAt)}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setSelected(m)}
                        className="px-2.5 py-1.5 rounded-lg bg-[#EEF1F8] text-[#1B2E6B] text-xs font-semibold hover:bg-[#1B2E6B] hover:text-white transition-colors whitespace-nowrap"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-[#F3F4F6] text-xs text-[#9CA3AF]">
            {filtered.length} result{filtered.length !== 1 ? "s" : ""}
          </div>
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <MemberDetailModal
          member={selected}
          apptCountMap={apptCountMap}
          prayerMap={prayerMap}
          onClose={() => setSelected(null)}
          onUpdate={handleUpdate}
        />
      )}
    </div>
  );
}
