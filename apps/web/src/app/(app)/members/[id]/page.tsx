"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  orderBy,
  Timestamp,
  serverTimestamp,
  deleteDoc,
} from "firebase/firestore";
import { db, useAuth } from "@/lib/firebase";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  Pencil,
  Calendar,
  Check,
  X,
  Upload,
  Flame,
  BookOpen,
  MessageSquare,
  Clock,
  ChevronDown,
  Trash2,
  ShieldCheck,
  ShieldOff,
  AlertTriangle,
} from "lucide-react";
import type { User, Appointment } from "@nablis/shared/firebase";

/* ─── helpers ──────────────────────────────────────────────────────────── */

function fmtDate(ts: Timestamp | null | undefined) {
  if (!ts) return "—";
  try {
    return ts.toDate().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function fmtRelative(ts: Timestamp | null | undefined) {
  if (!ts) return "—";
  try {
    const diff = Date.now() - ts.toDate().getTime();
    const d = Math.floor(diff / 86400000);
    if (d === 0) return "Today";
    if (d === 1) return "Yesterday";
    if (d < 7) return `${d} days ago`;
    if (d < 30) return `${Math.floor(d / 7)} weeks ago`;
    return fmtDate(ts);
  } catch {
    return "—";
  }
}

function computeStreak(logs: { prayedAt?: Timestamp; createdAt?: Timestamp }[]): number {
  const dates = Array.from(
    new Set(
      logs.map((l) => {
        const ts = l.prayedAt || l.createdAt;
        if (!ts) return null;
        try { return ts.toDate().toDateString(); }
        catch { return null; }
      }).filter(Boolean) as string[]
    )
  ).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  let streak = 0;
  const today = new Date();
  for (let i = 0; i < dates.length; i++) {
    const expected = new Date(today);
    expected.setDate(today.getDate() - i);
    if (dates[i] === expected.toDateString()) streak++;
    else break;
  }
  return streak;
}

function getPhone(m: User) { return (m as any).phone || (m as any).phoneNumber || ""; }
function getCity(m: User)  { return (m as any).cityOfResidence || (m as any).city || ""; }
function getCountry(m: User) { return (m as any).countryOfResidence || (m as any).country || ""; }

/* ─── sub-components ───────────────────────────────────────────────────── */

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    confirmed: "bg-green-50 text-green-700",
    pending:   "bg-yellow-50 text-yellow-700",
    rejected:  "bg-red-50 text-red-600",
    active:    "bg-green-50 text-green-700",
    suspended: "bg-orange-50 text-orange-600",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize ${map[status] ?? "bg-gray-100 text-gray-600"}`}>
      {status}
    </span>
  );
}

function RoleBadge({ role }: { role: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    super_admin: { label: "Spiritual Father", cls: "bg-[#1B2E6B] text-white" },
    admin:       { label: "Admin",            cls: "bg-[#EEF1F8] text-[#1B2E6B]" },
    member:      { label: "Member",           cls: "bg-[#F3F4F6] text-[#6B7280]" },
  };
  const { label, cls } = map[role] ?? { label: role, cls: "bg-gray-100 text-gray-600" };
  return <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${cls}`}>{label}</span>;
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-[#9CA3AF] text-xs mb-0.5">{label}</p>
      <p className="text-[#374151] text-sm font-medium">{value || "—"}</p>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-2xl p-4 border border-[#E5E7EB] shadow-sm flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-[#EEF1F8] flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-xl font-bold text-[#1B2E6B]">{value}</p>
        <p className="text-[#9CA3AF] text-xs">{label}</p>
      </div>
    </div>
  );
}

type EditFields = {
  displayName: string;
  christianName: string;
  phone: string;
  countryOfResidence: string;
  cityOfResidence: string;
  neighborhood: string;
  parishChurch: string;
};

type PrayerLog = { prayedAt?: Timestamp; createdAt?: Timestamp };

/* ─── main page ────────────────────────────────────────────────────────── */

export default function MemberDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();
  const { role: authRole } = useAuth();

  const [member,       setMember]       = useState<User | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [prayerLogs,   setPrayerLogs]   = useState<PrayerLog[]>([]);
  const [msgCount,     setMsgCount]     = useState(0);
  const [loading,      setLoading]      = useState(true);

  const [tab, setTab] = useState<"info" | "appointments" | "activity">("info");

  // edit mode
  const [editing,   setEditing]   = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [editFields, setEditFields] = useState<EditFields>({
    displayName: "", christianName: "", phone: "",
    countryOfResidence: "", cityOfResidence: "", neighborhood: "", parishChurch: "",
  });

  // photo upload
  const fileRef  = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // action menu
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [confirmAction,  setConfirmAction]  = useState<"delete" | "suspend" | null>(null);
  const [actionLoading,  setActionLoading]  = useState(false);

  /* load */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [mSnap, aSnap, pSnap] = await Promise.all([
        getDoc(doc(db, "users", id)),
        getDocs(query(collection(db, "appointments"), where("memberId", "==", id), orderBy("date", "desc"))),
        getDocs(query(collection(db, "prayerLogs"), where("userId", "==", id))),
      ]);

      if (mSnap.exists()) {
        const m = { id: mSnap.id, ...mSnap.data() } as User;
        setMember(m);
        setEditFields({
          displayName:        (m as any).displayName        || "",
          christianName:      (m as any).christianName      || "",
          phone:              getPhone(m),
          countryOfResidence: getCountry(m),
          cityOfResidence:    getCity(m),
          neighborhood:       (m as any).neighborhood       || "",
          parishChurch:       (m as any).parishChurch       || "",
        });
      }
      setAppointments(aSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Appointment)));
      setPrayerLogs(pSnap.docs.map((d) => d.data() as PrayerLog));

      // count conversations this member is in
      try {
        const cSnap = await getDocs(
          query(collection(db, "conversations"), where("participantIds", "array-contains", id))
        );
        setMsgCount(cSnap.size);
      } catch { /* conversations may not exist */ }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  /* photo upload */
  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !member) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("folder", "members");
      const res  = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (data.url) {
        await updateDoc(doc(db, "users", id), { photoURL: data.url });
        setMember((prev) => prev ? { ...prev, photoURL: data.url } : prev);
      }
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  /* save edit */
  async function handleSave() {
    if (!member) return;
    setSaving(true);
    try {
      const updates = {
        displayName:        editFields.displayName.trim(),
        christianName:      editFields.christianName.trim(),
        phone:              editFields.phone.trim(),
        phoneNumber:        editFields.phone.trim(),
        countryOfResidence: editFields.countryOfResidence.trim(),
        cityOfResidence:    editFields.cityOfResidence.trim(),
        neighborhood:       editFields.neighborhood.trim(),
        parishChurch:       editFields.parishChurch.trim(),
        updatedAt:          serverTimestamp(),
      };
      await updateDoc(doc(db, "users", id), updates);
      setMember((prev) => prev ? { ...prev, ...updates } : prev);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  /* member actions */
  async function handleAction(action: string) {
    if (!member) return;
    setActionLoading(true);
    setShowActionMenu(false);
    try {
      const ref = doc(db, "users", id);
      switch (action) {
        case "approve":
          await updateDoc(ref, { status: "active",   updatedAt: serverTimestamp() });
          setMember((p) => p ? { ...p, status: "active" } : p);
          break;
        case "reject":
          await updateDoc(ref, { status: "rejected", updatedAt: serverTimestamp() });
          setMember((p) => p ? { ...p, status: "rejected" } : p);
          break;
        case "promote":
          await updateDoc(ref, { role: "admin",   updatedAt: serverTimestamp() });
          setMember((p) => p ? { ...p, role: "admin" } : p);
          break;
        case "demote":
          await updateDoc(ref, { role: "member",  updatedAt: serverTimestamp() });
          setMember((p) => p ? { ...p, role: "member" } : p);
          break;
        case "suspend":
          await updateDoc(ref, { status: "suspended", updatedAt: serverTimestamp() });
          setMember((p) => p ? { ...p, status: "suspended" } : p);
          setConfirmAction(null);
          break;
        case "delete":
          await deleteDoc(ref);
          router.replace("/members");
          return;
      }
    } finally {
      setActionLoading(false);
      setConfirmAction(null);
    }
  }

  /* ── loading / not found ── */

  if (loading) {
    return (
      <div className="py-20 text-center">
        <div className="w-7 h-7 border-2 border-[#1B2E6B] border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  if (!member) {
    return (
      <div className="py-20 text-center text-[#9CA3AF]">
        <p className="text-4xl mb-2">❓</p>
        <p className="text-sm font-medium">Member not found</p>
        <button onClick={() => router.back()} className="mt-3 text-xs text-[#1B2E6B] font-semibold hover:text-[#F5C518]">
          Go back
        </button>
      </div>
    );
  }

  /* ── derived data ── */

  const now            = Timestamp.now();
  const upcomingAppts  = appointments.filter((a) => (a.date as any)?.seconds > now.seconds);
  const pastAppts      = appointments.filter((a) => (a.date as any)?.seconds <= now.seconds);
  const streak         = computeStreak(prayerLogs);
  const initials       = ((member.displayName || member.email || "?")[0] ?? "?").toUpperCase();
  const christianName  = (member as any).christianName  || "";
  const neighborhood   = (member as any).neighborhood   || "";
  const parishChurch   = (member as any).parishChurch   || "";

  const isSuperAdmin = authRole === "super_admin";

  /* ─── render ─────────────────────────────────────────────────────────── */

  return (
    <div className="space-y-5 pb-10">

      {/* breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link href="/members" className="flex items-center gap-1 text-[#6B7280] hover:text-[#1B2E6B] transition-colors">
          <ArrowLeft size={14} /> Members
        </Link>
        <span className="text-[#D1D5DB]">/</span>
        <span className="text-[#1B2E6B] font-medium">{member.displayName || member.email}</span>
      </div>

      {/* ── hero card ── */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-5">

          {/* avatar + identity */}
          <div className="flex items-start gap-5">
            {/* avatar with upload */}
            <div className="relative flex-shrink-0">
              <div
                onClick={() => isSuperAdmin && fileRef.current?.click()}
                className={`w-20 h-20 rounded-2xl bg-[#1B2E6B] flex items-center justify-center overflow-hidden ${isSuperAdmin ? "cursor-pointer" : ""}`}
              >
                {uploading ? (
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : member.photoURL ? (
                  <img src={member.photoURL} alt={member.displayName} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[#F5C518] font-bold text-3xl">{initials}</span>
                )}
              </div>
              {isSuperAdmin && (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#F5C518] flex items-center justify-center shadow hover:bg-[#e0b015] transition-colors"
                >
                  <Upload size={11} className="text-[#1B2E6B]" />
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
            </div>

            {/* name + badges */}
            <div>
              <h1 className="text-xl font-bold text-[#1B2E6B] mb-1">
                {member.displayName || member.email || "—"}
              </h1>
              {christianName && (
                <p className="text-[#6B7280] text-sm mb-1.5">Christian name: {christianName}</p>
              )}
              <div className="flex items-center gap-2 flex-wrap">
                <RoleBadge  role={member.role as string} />
                <StatusBadge status={member.status as string} />
              </div>
            </div>
          </div>

          {/* action buttons */}
          {isSuperAdmin && (
            <div className="flex items-center gap-2 flex-shrink-0">
              {!editing ? (
                <button
                  onClick={() => setEditing(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#EEF1F8] text-[#1B2E6B] text-sm font-semibold hover:bg-[#dde3f0] transition-colors"
                >
                  <Pencil size={14} /> Edit
                </button>
              ) : (
                <>
                  <button
                    onClick={() => { setEditing(false); }}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[#F3F4F6] text-[#6B7280] text-sm font-semibold hover:bg-[#E5E7EB] transition-colors"
                  >
                    <X size={14} /> Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1B2E6B] text-white text-sm font-semibold hover:bg-[#152554] transition-colors disabled:opacity-60"
                  >
                    {saving ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Check size={14} />
                    )}
                    Save
                  </button>
                </>
              )}

              {/* actions dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowActionMenu((p) => !p)}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-[#E5E7EB] text-[#374151] text-sm font-semibold hover:bg-[#F9FAFB] transition-colors"
                >
                  Actions <ChevronDown size={13} />
                </button>
                {showActionMenu && (
                  <div className="absolute right-0 top-full mt-1.5 w-52 bg-white rounded-xl shadow-lg border border-[#E5E7EB] py-1 z-30">
                    {member.status === "pending" && (
                      <>
                        <ActionItem icon={<Check size={14} />} label="Approve Member" color="text-green-600" onClick={() => handleAction("approve")} />
                        <ActionItem icon={<X size={14} />}     label="Reject Member"  color="text-red-500"   onClick={() => handleAction("reject")} />
                        <div className="my-1 border-t border-[#F3F4F6]" />
                      </>
                    )}
                    {member.role === "member" && member.status === "active" && (
                      <ActionItem icon={<ShieldCheck size={14} />} label="Promote to Admin"  color="text-[#1B2E6B]" onClick={() => handleAction("promote")} />
                    )}
                    {member.role === "admin" && (
                      <ActionItem icon={<ShieldOff size={14} />} label="Demote to Member" color="text-[#6B7280]" onClick={() => handleAction("demote")} />
                    )}
                    <ActionItem
                      icon={<MessageSquare size={14} />}
                      label="Send Message"
                      color="text-[#374151]"
                      onClick={() => { setShowActionMenu(false); router.push("/messaging"); }}
                    />
                    <div className="my-1 border-t border-[#F3F4F6]" />
                    <ActionItem
                      icon={<AlertTriangle size={14} />}
                      label="Suspend Account"
                      color="text-orange-500"
                      onClick={() => { setShowActionMenu(false); setConfirmAction("suspend"); }}
                    />
                    <ActionItem
                      icon={<Trash2 size={14} />}
                      label="Delete Member"
                      color="text-red-500"
                      onClick={() => { setShowActionMenu(false); setConfirmAction("delete"); }}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* contact row */}
        <div className="flex flex-wrap gap-5 mt-5 pt-5 border-t border-[#F3F4F6]">
          {member.email && (
            <a href={`mailto:${member.email}`} className="flex items-center gap-2 text-[#6B7280] hover:text-[#1B2E6B] text-sm transition-colors">
              <Mail size={13} className="text-[#F5C518]" /> {member.email}
            </a>
          )}
          {getPhone(member) && (
            <a href={`tel:${getPhone(member)}`} className="flex items-center gap-2 text-[#6B7280] hover:text-[#1B2E6B] text-sm transition-colors">
              <Phone size={13} className="text-[#F5C518]" /> {getPhone(member)}
            </a>
          )}
          {(getCity(member) || getCountry(member)) && (
            <span className="flex items-center gap-2 text-[#6B7280] text-sm">
              <MapPin size={13} className="text-[#F5C518]" />
              {[getCity(member), getCountry(member)].filter(Boolean).join(", ")}
            </span>
          )}
        </div>
      </div>

      {/* ── stats row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard icon={<Calendar size={18} className="text-[#1B2E6B]" />} label="Past Appointments" value={pastAppts.length} />
        <StatCard icon={<Clock size={18} className="text-[#1B2E6B]" />}    label="Upcoming" value={upcomingAppts.length} />
        <StatCard icon={<Flame size={18} className="text-[#F5C518]" />}    label="Prayer Streak" value={`${streak}d`} />
        <StatCard icon={<MessageSquare size={18} className="text-[#1B2E6B]" />} label="Conversations" value={msgCount} />
      </div>

      {/* ── tabs ── */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden">
        <div className="flex border-b border-[#F3F4F6]">
          {(["info", "appointments", "activity"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={[
                "px-5 py-3.5 text-sm font-medium capitalize transition-colors border-b-2",
                tab === t
                  ? "text-[#1B2E6B] border-[#1B2E6B]"
                  : "text-[#6B7280] border-transparent hover:text-[#1B2E6B]",
              ].join(" ")}
            >
              {t === "info" ? "Information" : t === "appointments" ? "Appointments" : "Activity"}
            </button>
          ))}
        </div>

        {/* ── Information tab ── */}
        {tab === "info" && (
          <div className="p-6 space-y-6">
            {editing ? (
              /* edit form */
              <div className="space-y-5">
                <h3 className="text-[#1B2E6B] font-semibold text-sm">Edit Member Information</h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  {(
                    [
                      { key: "displayName",        label: "Full Name" },
                      { key: "christianName",       label: "Christian Name" },
                      { key: "phone",               label: "Phone Number" },
                      { key: "parishChurch",        label: "Parish Church" },
                      { key: "countryOfResidence",  label: "Country" },
                      { key: "cityOfResidence",     label: "City" },
                      { key: "neighborhood",        label: "Neighborhood / Sub-city" },
                    ] as { key: keyof EditFields; label: string }[]
                  ).map(({ key, label }) => (
                    <div key={key}>
                      <label className="block text-[#9CA3AF] text-xs mb-1">{label}</label>
                      <input
                        value={editFields[key]}
                        onChange={(e) => setEditFields((p) => ({ ...p, [key]: e.target.value }))}
                        className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] text-[#374151] text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2E6B]/20 focus:border-[#1B2E6B] bg-[#F9FAFB]"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* read view */
              <>
                <InfoBlock title="Personal">
                  <InfoRow label="Full Name"       value={member.displayName} />
                  <InfoRow label="Christian Name"  value={christianName} />
                  <InfoRow label="Email"           value={member.email} />
                  <InfoRow label="Phone"           value={getPhone(member)} />
                </InfoBlock>
                <InfoBlock title="Location">
                  <InfoRow label="Country"         value={getCountry(member)} />
                  <InfoRow label="City"            value={getCity(member)} />
                  <InfoRow label="Neighborhood"    value={neighborhood} />
                </InfoBlock>
                <InfoBlock title="Church">
                  <InfoRow label="Parish Church"   value={parishChurch} />
                </InfoBlock>
                <InfoBlock title="Account">
                  <InfoRow label="Role"            value={member.role} />
                  <InfoRow label="Status"          value={member.status} />
                  <InfoRow label="Member Since"    value={fmtDate((member as any).createdAt)} />
                </InfoBlock>
                {/* prayer stats */}
                <div>
                  <h3 className="text-[#1B2E6B] font-semibold text-sm mb-3">Prayer Statistics</h3>
                  <div className="grid sm:grid-cols-3 gap-4">
                    {[
                      { label: "Current Streak",    value: `${streak} days` },
                      { label: "Total Prayer Logs", value: prayerLogs.length },
                      { label: "This Month",        value: prayerLogs.filter((l) => {
                          const ts = l.prayedAt || l.createdAt;
                          if (!ts) return false;
                          try {
                            const d = ts.toDate();
                            const now2 = new Date();
                            return d.getMonth() === now2.getMonth() && d.getFullYear() === now2.getFullYear();
                          } catch { return false; }
                        }).length },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-[#F9FAFB] rounded-xl p-4 border border-[#F3F4F6] text-center">
                        <p className="text-xl font-bold text-[#1B2E6B]">{value}</p>
                        <p className="text-[#9CA3AF] text-xs mt-0.5">{label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Appointments tab ── */}
        {tab === "appointments" && (
          <div className="divide-y divide-[#F3F4F6]">
            {appointments.length === 0 ? (
              <div className="py-12 text-center text-[#9CA3AF] text-sm">No appointments found</div>
            ) : (
              appointments.map((a) => {
                const isUpcoming = (a.date as any)?.seconds > now.seconds;
                return (
                  <div key={a.id} className="flex items-center justify-between px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isUpcoming ? "bg-[#EEF1F8]" : "bg-[#F9FAFB]"}`}>
                        <Calendar size={16} className={isUpcoming ? "text-[#1B2E6B]" : "text-[#9CA3AF]"} />
                      </div>
                      <div>
                        <p className="text-[#374151] text-sm font-medium capitalize">{(a as any).serviceType || "Appointment"}</p>
                        <p className="text-[#9CA3AF] text-xs">{fmtDate(a.date as any)} · {(a as any).time || ""}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isUpcoming && <span className="text-[10px] text-[#1B2E6B] bg-[#EEF1F8] px-2 py-0.5 rounded-full font-medium">Upcoming</span>}
                      <StatusBadge status={(a as any).status || "pending"} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ── Activity tab ── */}
        {tab === "activity" && (
          <div className="p-6 space-y-5">
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { icon: <Calendar size={16} className="text-[#1B2E6B]" />, label: "Total Appointments", value: appointments.length },
                { icon: <BookOpen size={16} className="text-[#1B2E6B]" />, label: "Prayer Logs", value: prayerLogs.length },
                { icon: <MessageSquare size={16} className="text-[#1B2E6B]" />, label: "Conversations", value: msgCount },
                { icon: <Flame size={16} className="text-[#F5C518]" />, label: "Best Streak", value: `${streak}d` },
              ].map(({ icon, label, value }) => (
                <div key={label} className="bg-[#F9FAFB] rounded-xl p-4 border border-[#F3F4F6] flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white border border-[#E5E7EB] flex items-center justify-center flex-shrink-0">{icon}</div>
                  <div>
                    <p className="text-lg font-bold text-[#1B2E6B]">{value}</p>
                    <p className="text-[#9CA3AF] text-xs">{label}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* timeline: recent appointments */}
            {appointments.length > 0 && (
              <div>
                <h3 className="text-[#1B2E6B] font-semibold text-sm mb-3">Recent Appointments</h3>
                <div className="space-y-2">
                  {appointments.slice(0, 8).map((a) => (
                    <div key={a.id} className="flex items-center gap-3 p-3 rounded-xl bg-[#F9FAFB] border border-[#F3F4F6]">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#1B2E6B] flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[#374151] font-medium capitalize truncate">{(a as any).serviceType || "Appointment"}</p>
                        <p className="text-xs text-[#9CA3AF]">{fmtRelative(a.date as any)}</p>
                      </div>
                      <StatusBadge status={(a as any).status || "pending"} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* prayer log timeline */}
            {prayerLogs.length > 0 && (
              <div>
                <h3 className="text-[#1B2E6B] font-semibold text-sm mb-3">Recent Prayer Logs</h3>
                <div className="space-y-2">
                  {prayerLogs
                    .sort((a, b) => {
                      const aTs = a.prayedAt || a.createdAt;
                      const bTs = b.prayedAt || b.createdAt;
                      return ((bTs?.seconds ?? 0) - (aTs?.seconds ?? 0));
                    })
                    .slice(0, 6)
                    .map((l, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-[#F9FAFB] border border-[#F3F4F6]">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#F5C518] flex-shrink-0" />
                        <p className="text-sm text-[#374151]">Prayed</p>
                        <p className="text-xs text-[#9CA3AF] ml-auto">{fmtRelative(l.prayedAt || l.createdAt)}</p>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── confirm dialog overlay ── */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${confirmAction === "delete" ? "bg-red-50" : "bg-orange-50"}`}>
                {confirmAction === "delete" ? <Trash2 size={18} className="text-red-500" /> : <AlertTriangle size={18} className="text-orange-500" />}
              </div>
              <div>
                <h3 className="text-[#1B2E6B] font-bold text-sm">
                  {confirmAction === "delete" ? "Delete Member" : "Suspend Account"}
                </h3>
                <p className="text-[#9CA3AF] text-xs">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-[#6B7280] text-sm mb-5">
              {confirmAction === "delete"
                ? `Permanently delete ${member.displayName || member.email}? All their data will be removed.`
                : `Suspend ${member.displayName || member.email}'s account? They will be unable to log in.`}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmAction(null)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-[#F3F4F6] text-[#6B7280] text-sm font-semibold hover:bg-[#E5E7EB] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAction(confirmAction)}
                disabled={actionLoading}
                className={`flex-1 px-4 py-2.5 rounded-xl text-white text-sm font-semibold transition-colors disabled:opacity-60 ${confirmAction === "delete" ? "bg-red-500 hover:bg-red-600" : "bg-orange-500 hover:bg-orange-600"}`}
              >
                {actionLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
                ) : confirmAction === "delete" ? "Delete" : "Suspend"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* close action menu on outside click */}
      {showActionMenu && (
        <div className="fixed inset-0 z-20" onClick={() => setShowActionMenu(false)} />
      )}
    </div>
  );
}

/* ── tiny helpers ─────────────────────────────────────────────────────── */

function ActionItem({ icon, label, color, onClick }: { icon: React.ReactNode; label: string; color: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-medium hover:bg-[#F9FAFB] transition-colors ${color}`}
    >
      {icon} {label}
    </button>
  );
}

function InfoBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[#1B2E6B] font-semibold text-sm mb-3">{title}</h3>
      <div className="grid sm:grid-cols-2 gap-4 bg-[#F9FAFB] rounded-xl p-4 border border-[#F3F4F6]">
        {children}
      </div>
    </div>
  );
}
