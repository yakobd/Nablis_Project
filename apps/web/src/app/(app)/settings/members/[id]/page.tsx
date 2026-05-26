"use client";
import React, { useEffect, useState } from "react";
import { doc, getDoc, collection, query, where, getDocs, orderBy, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Phone, Mail, MapPin, Pencil, Calendar, FileText, Check } from "lucide-react";
import type { User, Appointment } from "@nablis/shared/firebase";

function fmtDate(ts: Timestamp | null | undefined) {
  if (!ts) return "—";
  try { return ts.toDate().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
  catch { return "—"; }
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    confirmed: "bg-green-50 text-green-700",
    pending:   "bg-yellow-50 text-yellow-700",
    rejected:  "bg-red-50 text-red-600",
    active:    "bg-green-50 text-green-700",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize ${map[status] ?? "bg-gray-100 text-gray-600"}`}>
      {status}
    </span>
  );
}

type TabKey = "upcoming" | "past" | "events";

export default function MemberDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [member, setMember]           = useState<User | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading]         = useState(true);
  const [tab, setTab]                 = useState<TabKey>("upcoming");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const mSnap = await getDoc(doc(db, "users", id));
        if (mSnap.exists()) setMember({ id: mSnap.id, ...mSnap.data() } as User);

        const aSnap = await getDocs(
          query(
            collection(db, "appointments"),
            where("memberId", "==", id),
            orderBy("date", "desc")
          )
        );
        setAppointments(aSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Appointment)));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="py-16 text-center">
        <div className="w-7 h-7 border-2 border-[#1B2E6B] border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  if (!member) {
    return (
      <div className="py-16 text-center text-[#9CA3AF]">
        <p className="text-4xl mb-2">❓</p>
        <p className="text-sm font-medium">Member not found</p>
        <button onClick={() => router.back()} className="mt-3 text-xs text-[#1B2E6B] font-semibold hover:text-[#F5C518]">
          Go back
        </button>
      </div>
    );
  }

  const now = Timestamp.now();
  const upcomingAppts = appointments.filter((a) => a.date?.seconds > now.seconds);
  const pastAppts     = appointments.filter((a) => a.date?.seconds <= now.seconds);

  const initials = (member.displayName || member.email)[0].toUpperCase();

  const tabAppts = tab === "upcoming" ? upcomingAppts : tab === "past" ? pastAppts : [];

  return (
    <div className="space-y-5">
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-1.5 text-[#6B7280] hover:text-[#1B2E6B] text-sm transition-colors"
      >
        <ArrowLeft size={14} /> Back to Members
      </button>

      {/* Profile header */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-[#1B2E6B] flex items-center justify-center flex-shrink-0">
              {member.photoURL ? (
                <img src={member.photoURL} alt={member.displayName} className="w-16 h-16 rounded-2xl object-cover" />
              ) : (
                <span className="text-[#F5C518] font-bold text-2xl">{initials}</span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <h1 className="text-xl font-bold text-[#1B2E6B]">{member.displayName || "—"}</h1>
                <StatusBadge status={member.status} />
              </div>
              <p className="text-[#9CA3AF] text-sm capitalize">{member.role}</p>
            </div>
          </div>
          <Link
            href={`/settings/members/${id}/edit`}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#EEF1F8] text-[#1B2E6B] text-sm font-semibold hover:bg-[#dde3f0] transition-colors"
          >
            <Pencil size={14} /> Edit Member
          </Link>
        </div>

        {/* Contact row */}
        <div className="flex flex-wrap gap-4 mt-5 pt-5 border-t border-[#F3F4F6]">
          {member.email && (
            <a href={`mailto:${member.email}`} className="flex items-center gap-2 text-[#6B7280] hover:text-[#1B2E6B] text-sm transition-colors">
              <Mail size={14} className="text-[#F5C518]" /> {member.email}
            </a>
          )}
          {member.phone && (
            <a href={`tel:${member.phone}`} className="flex items-center gap-2 text-[#6B7280] hover:text-[#1B2E6B] text-sm transition-colors">
              <Phone size={14} className="text-[#F5C518]" /> {member.phone}
            </a>
          )}
          {(member.city || member.address) && (
            <span className="flex items-center gap-2 text-[#6B7280] text-sm">
              <MapPin size={14} className="text-[#F5C518]" />
              {[member.address, member.city].filter(Boolean).join(", ")}
            </span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Past Visits",    value: String(pastAppts.length) },
          { label: "Upcoming",       value: String(upcomingAppts.length) },
          { label: "Blog Posts",     value: "—" },
          { label: "Member Since",   value: fmtDate(member.createdAt) },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-2xl p-4 border border-[#E5E7EB] shadow-sm text-center">
            <p className="text-xl font-bold text-[#1B2E6B]">{value}</p>
            <p className="text-[#9CA3AF] text-xs mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* General info */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[#1B2E6B] font-semibold text-sm">General Information</h2>
          <Link href={`/settings/members/${id}/edit`} className="text-xs text-[#1B2E6B] font-medium hover:text-[#F5C518] flex items-center gap-1">
            <Pencil size={11} /> Edit
          </Link>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {[
            { label: "Full Name",   value: member.displayName },
            { label: "Email",       value: member.email },
            { label: "Phone",       value: member.phone },
            { label: "Role",        value: member.role },
            { label: "Status",      value: member.status },
            { label: "City",        value: member.city },
            { label: "Address",     value: member.address },
            { label: "Joined",      value: fmtDate(member.createdAt) },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-[#9CA3AF] text-xs mb-0.5">{label}</p>
              <p className="text-[#374151] text-sm font-medium capitalize">{value || "—"}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Documents */}
      {(member.documents ?? []).length > 0 && (
        <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-6">
          <h2 className="text-[#1B2E6B] font-semibold text-sm mb-4">Documents</h2>
          <div className="space-y-2">
            {(member.documents ?? []).map((url, i) => (
              <a
                key={i}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-xl bg-[#F9FAFB] border border-[#E5E7EB] hover:border-[#1B2E6B]/30 transition-colors"
              >
                <FileText size={15} className="text-[#6B7280]" />
                <span className="text-[#374151] text-sm flex-1">Document {i + 1}</span>
                <span className="text-xs text-[#1B2E6B] font-medium">View →</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Appointments tabs */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden">
        <div className="flex border-b border-[#F3F4F6]">
          {(["upcoming", "past", "events"] as TabKey[]).map((t) => (
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
              {t === "upcoming" ? `Upcoming Appointments (${upcomingAppts.length})` :
               t === "past"     ? `Past Appointments (${pastAppts.length})` :
               "Other Events"}
            </button>
          ))}
        </div>

        {tab === "events" ? (
          <div className="py-10 text-center text-[#9CA3AF] text-sm">No event records</div>
        ) : tabAppts.length === 0 ? (
          <div className="py-10 text-center text-[#9CA3AF] text-sm">
            No {tab} appointments
          </div>
        ) : (
          <div className="divide-y divide-[#F3F4F6]">
            {tabAppts.map((a) => (
              <div key={a.id} className="flex items-center justify-between px-5 py-3.5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#EEF1F8] flex items-center justify-center flex-shrink-0">
                    <Calendar size={15} className="text-[#1B2E6B]" />
                  </div>
                  <div>
                    <p className="text-[#374151] text-sm font-medium capitalize">{a.serviceType}</p>
                    <p className="text-[#9CA3AF] text-xs">{fmtDate(a.date)} · {a.time}</p>
                  </div>
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
