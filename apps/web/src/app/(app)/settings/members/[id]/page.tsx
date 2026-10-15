"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  arrayRemove, arrayUnion, collection, doc, getDoc, getDocs, limit, onSnapshot, query, serverTimestamp, updateDoc, where,
  type Timestamp,
} from "firebase/firestore";
import { ArrowLeft, Pencil, Mail, FileText, Image as ImageIcon, FilePlus2, X, StickyNote, Loader2 } from "lucide-react";
import {
  db, useAuth, attendanceSummary, serviceLabel, formatTime12, presenceLabel,
  type Appointment, type User, type UserDocument, type EventDoc,
} from "@/lib/firebase";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { useToast } from "@/components/ui/Toast";
import { AccessPills, MemberAvatar, StatusPill, cityOf, decideRegistration, fmtDay, phoneOf } from "../_components/shared";
import { useTranslation } from "@nablis/i18n";
import { dateLocale } from "@/lib/locale";

type Tab = "upcoming" | "past" | "events";

interface TimelineItem {
  id: string;
  title: string;
  subtitle: string;
  when: Date;
  highlight: boolean;
  person?: { name: string; role: string; photoURL?: string | null };
  note?: string;
}

function fileSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function MemberDetailsPage() {
  const { t: tr } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { user, role } = useAuth();
  const isStaff = role === "admin" || role === "super_admin";
  const isSuperAdmin = role === "super_admin";
  const docInput = useRef<HTMLInputElement>(null);

  const [m, setM] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [appts, setAppts] = useState<Appointment[]>([]);
  const [attendance, setAttendance] = useState<{ attended: number; total: number; percent: number | null } | null>(null);
  const [events, setEvents] = useState<TimelineItem[]>([]);
  const [father, setFather] = useState<User | null>(null);
  const [tab, setTab] = useState<Tab>("upcoming");
  const [noteOpen, setNoteOpen] = useState<string | null>(null);
  const [docBusy, setDocBusy] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isStaff || !id) return;
    return onSnapshot(doc(db, "users", id), (snap) => {
      setM(snap.exists() ? ({ id: snap.id, ...snap.data() } as User) : null);
      setLoading(false);
    }, () => setLoading(false));
  }, [isStaff, id]);

  // Activity: appointments, attendance and events.
  useEffect(() => {
    if (!isStaff || !id) return;
    getDocs(query(collection(db, "appointments"), where("memberId", "==", id)))
      .then((s) => setAppts(s.docs.map((d) => ({ id: d.id, ...d.data() } as Appointment))))
      .catch(() => {});
    getDocs(query(collection(db, "users"), where("role", "==", "super_admin"), limit(1)))
      .then((s) => s.docs[0] && setFather({ id: s.docs[0].id, ...s.docs[0].data() } as User))
      .catch(() => {});

    (async () => {
      try {
        const [sessions, checkIns, userSnap, eventSnap] = await Promise.all([
          getDocs(collection(db, "attendance")),
          getDocs(query(collection(db, "checkIns"), where("userId", "==", id))),
          getDoc(doc(db, "users", id)),
          getDocs(collection(db, "events")),
        ]);
        const sessionDocs = sessions.docs.map((d) => ({ id: d.id, ...d.data() } as { id: string; meetingTitle?: string; status?: string; date?: Timestamp; createdAt?: Timestamp; attendees?: { userId: string }[] }));
        const attendedIds = new Set(checkIns.docs.map((d) => d.data().sessionId as string));
        setAttendance(attendanceSummary(sessionDocs, id, attendedIds, userSnap.data()?.createdAt ?? null));

        const items: TimelineItem[] = [];
        for (const s of sessionDocs) {
          const ci = checkIns.docs.find((d) => d.data().sessionId === s.id);
          if (!ci) continue;
          const at = ci.data().checkedInAt?.toDate?.();
          if (at) items.push({ id: `s-${s.id}`, title: s.meetingTitle || tr("memberInfo.gathering"), subtitle: tr("memberInfo.checkedIn"), when: at, highlight: false });
        }
        // RSVPs are one doc per member under each event; check the recent ones.
        const recent = eventSnap.docs
          .map((d) => ({ id: d.id, ...d.data() } as EventDoc))
          .sort((a, b) => (b.startDate?.toMillis?.() ?? 0) - (a.startDate?.toMillis?.() ?? 0))
          .slice(0, 40);
        const rsvps = await Promise.all(recent.map((e) => getDoc(doc(db, "events", e.id, "rsvps", id)).catch(() => null)));
        recent.forEach((e, i) => {
          const r = rsvps[i];
          const legacy = e.rsvps?.find((x) => x.userId === id);
          const going = r?.exists() ? r.data().status === "attending" : !!legacy;
          const start = e.startDate?.toDate?.();
          if (going && start) items.push({ id: `e-${e.id}`, title: e.title, subtitle: e.location || e.category || tr("searchPage.kind.Event"), when: start, highlight: start > new Date() });
        });
        setEvents(items.sort((a, b) => b.when.getTime() - a.when.getTime()));
      } catch {
        setAttendance({ attended: 0, total: 0, percent: null });
      }
    })();
  }, [isStaff, id]);

  const { upcoming, past } = useMemo(() => {
    const now = Date.now();
    const live = appts.filter((a) => a.status === "pending" || a.status === "confirmed");
    const toItem = (a: Appointment, highlight: boolean): TimelineItem => ({
      id: a.id,
      title: serviceLabel(a.serviceType),
      subtitle: `${a.status === "confirmed" ? tr("memberInfo.confirmed") : a.status === "pending" ? tr("memberInfo.awaiting") : a.status} · ${formatTime12(a.time)}${a.customTime ? tr("memberInfo.requestedTime") : ""}`,
      when: a.date.toDate(),
      highlight,
      person: father ? { name: father.displayName, role: tr("members.father"), photoURL: father.photoURL } : undefined,
      note: a.privateNote || undefined,
    });
    return {
      upcoming: live.filter((a) => a.date?.toMillis() >= now - 12 * 3600 * 1000)
        .sort((a, b) => a.date.toMillis() - b.date.toMillis())
        .map((a, i) => toItem(a, i === 0)),
      past: appts.filter((a) => a.date?.toMillis() < now - 12 * 3600 * 1000 && a.status === "confirmed")
        .sort((a, b) => b.date.toMillis() - a.date.toMillis())
        .map((a) => toItem(a, false)),
    };
  }, [appts, father]);

  if (!user) return null;
  if (!isStaff) return <div className="bg-white rounded-3xl p-12 text-center text-sm text-[#6B7280]">{tr("memberInfo.onlyStaff")}</div>;
  if (loading) return <div className="bg-white rounded-3xl py-20"><div className="w-7 h-7 border-2 border-[#1B2E6B] border-t-transparent rounded-full animate-spin mx-auto" /></div>;
  if (!m) {
    return (
      <div className="bg-white rounded-3xl p-12 text-center">
        <p className="text-[#374151] font-medium">{tr("memberInfo.gone")}</p>
        <Link href="/settings/members" className="inline-block mt-4 text-sm font-semibold text-[#1E3A8A]">{tr("memberInfo.back")}</Link>
      </div>
    );
  }

  const member = m;
  const canEdit = member.role === "member" || isSuperAdmin;
  const documents: UserDocument[] = Array.isArray(member.documents) ? member.documents.filter((x) => x && typeof x === "object") : [];
  const timeline = tab === "upcoming" ? upcoming : tab === "past" ? past : events;
  const statusCls = member.status === "active" ? "text-[#16A34A]" : member.status === "pending" ? "text-[#D97706]" : "text-[#DC2626]";

  async function decide(status: "active" | "rejected") {
    if (status === "rejected" && !confirm(`Reject ${member.displayName || member.email}'s registration?`)) return;
    setBusy(true);
    try {
      await decideRegistration(member, status);
      toast({
        message: status === "active" ? tr("members.approved") : tr("members.rejected"),
        type: status === "active" ? "success" : "error",
        actionLabel: tr("groups.undo"),
        onAction: () => decideRegistration(member, "pending").catch(() => {}),
      });
    } catch {
      toast({ message: tr("members.decideError"), type: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function addDocuments(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    setDocBusy(true);
    try {
      const added: UserDocument[] = [];
      for (const f of files) {
        if (f.size > 25 * 1024 * 1024) { toast({ message: `${f.name} is larger than 25 MB.`, type: "error" }); continue; }
        added.push({ url: await uploadToCloudinary(f, "nablis/member-documents"), name: f.name, size: f.size, uploadedAt: Date.now() });
      }
      if (added.length) {
        await updateDoc(doc(db, "users", member.id), { documents: arrayUnion(...added), updatedAt: serverTimestamp() });
        toast({ message: tr("memberInfo.docsAdded", { count: added.length }) });
      }
    } catch {
      toast({ message: tr("memberInfo.addDocError"), type: "error" });
    } finally {
      setDocBusy(false);
    }
  }

  async function removeDocument(f: UserDocument) {
    if (!confirm(`Remove ${f.name}?`)) return;
    await updateDoc(doc(db, "users", member.id), { documents: arrayRemove(f) }).catch(() => toast({ message: tr("memberInfo.removeDocError"), type: "error" }));
  }

  const info: [string, string][] = [
    [tr("memberInfo.gender"), member.gender ? tr(`memberInfo.gender_${member.gender}`, { defaultValue: member.gender }) : "—"],
    [tr("memberInfo.christianName"), member.christianName || "—"],
    [tr("memberInfo.phone"), phoneOf(member) || "—"],
    [tr("memberInfo.street"), [member.address, member.neighborhood].filter(Boolean).join(", ") || "—"],
    [tr("memberInfo.city"), cityOf(member) || "—"],
    [tr("memberInfo.country"), member.countryOfResidence || "—"],
    [tr("memberInfo.parish"), member.parishChurch || "—"],
    [tr("memberInfo.birthday"), fmtDay(member.birthday)],
    [tr("memberInfo.registered"), fmtDay(member.createdAt)],
    [tr("memberInfo.zip"), member.zipCode || "—"],
  ];

  return (
    <div className="bg-white rounded-3xl shadow-sm p-5 sm:p-8 lg:p-10 animate-fade-up space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} aria-label={tr("common.back")} className="p-2 -ml-2 rounded-xl text-[#6B7280] hover:bg-[#F3F4F6]"><ArrowLeft size={20} /></button>
        <h2 className="font-display text-3xl font-bold text-[#111827]">{tr("memberInfo.title")}</h2>
      </div>

      {/* Header card */}
      <div className="rounded-2xl border border-[#E5E7EB] p-5 sm:p-6 flex flex-col md:flex-row gap-6">
        <span className="self-start rounded-full ring-4 ring-[#F3F4F6]"><MemberAvatar m={member} size={136} dot /></span>
        <div className="flex-1 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-2xl font-semibold text-[#111827]">{member.displayName || "Unnamed"}</p>
              <p className="text-[#6B7280] truncate">{member.email}</p>
              {phoneOf(member) && <a href={`tel:${phoneOf(member)}`} className="text-[#1E3A8A] text-sm">{phoneOf(member)}</a>}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <AccessPills role={member.role} />
                {member.lastSeen && <span className="text-xs text-[#9CA3AF]">{presenceLabel(member.lastSeen)}</span>}
              </div>
            </div>
            <div className="flex gap-2.5 flex-shrink-0">
              {member.status === "pending" && isSuperAdmin ? (
                <>
                  <button onClick={() => decide("rejected")} disabled={busy} className="px-5 py-2.5 rounded-xl border border-[#E5E7EB] text-sm font-semibold text-[#374151] hover:text-[#DC2626] disabled:opacity-60">{tr("members.reject")}</button>
                  <button onClick={() => decide("active")} disabled={busy} className="px-6 py-2.5 rounded-xl bg-[#F5C518] text-[#1B2E6B] text-sm font-bold hover:bg-[#e6b800] disabled:opacity-60">{tr("members.approve")}</button>
                </>
              ) : (
                <>
                  {canEdit && <Link href={`/settings/members/${member.id}/edit`} className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[#E5E7EB] text-sm font-semibold text-[#111827] hover:bg-[#F9FAFB]"><Pencil size={14} /> {tr("members.menu.edit")}</Link>}
                  {member.role === "member" && member.status === "active" && (
                    <Link href={`/messaging?member=${member.id}`} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1E3A8A] text-white text-sm font-semibold hover:bg-[#1B2E6B]"><Mail size={15} /> {tr("members.menu.message")}</Link>
                  )}
                </>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6 stagger">
            {[
              { label: tr("memberInfo.pastVisits"), value: String(past.length), cls: "text-[#111827]" },
              { label: tr("memberInfo.upcoming"), value: String(upcoming.length), cls: "text-[#111827]" },
              { label: tr("nav.attendance"), value: attendance ? (attendance.percent === null ? "—" : `${attendance.percent}%`) : "…", cls: "text-[#1E3A8A]", hint: attendance && attendance.total ? tr("memberInfo.ofTotal", { a: attendance.attended, total: attendance.total }) : tr("memberInfo.noGatherings") },
              { label: tr("study.status"), value: tr(`memberStatus.${member.status}`, { defaultValue: member.status }), cls: statusCls },
            ].map((s) => (
              <div key={s.label} className="rounded-xl bg-[#F3F4F6] px-4 py-3">
                <p className="text-[11px] font-medium uppercase tracking-wider text-[#6B7280]">{s.label}</p>
                <p className={`text-xl font-semibold mt-0.5 ${s.cls}`}>{s.value}</p>
                {s.hint && <p className="text-[10px] text-[#9CA3AF]">{s.hint}</p>}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-6">
        {/* General information */}
        <div className="rounded-2xl border border-[#E5E7EB] p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <p className="text-lg font-semibold text-[#111827]">{tr("memberInfo.general")}</p>
            {canEdit && <Link href={`/settings/members/${member.id}/edit`} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E5E7EB] text-sm text-[#374151] hover:bg-[#F9FAFB]"><Pencil size={13} /> {tr("common.edit")}</Link>}
          </div>
          <dl className="mt-3">
            {info.map(([k, v]) => (
              <div key={k} className="flex items-start justify-between gap-6 py-3 border-b border-[#F3F4F6] last:border-0">
                <dt className="text-[#6B7280] flex-shrink-0">{k}</dt>
                <dd className="text-[#111827] text-right">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Documents */}
        <div className="rounded-2xl border border-[#E5E7EB] p-5 sm:p-6 self-start">
          <div className="flex items-center justify-between">
            <p className="text-lg font-semibold text-[#111827]">{tr("memberInfo.files")}</p>
            {canEdit && (
              <button onClick={() => docInput.current?.click()} disabled={docBusy} className="flex items-center gap-1.5 text-sm font-semibold text-[#1E3A8A] disabled:opacity-60">
                {docBusy ? <Loader2 size={15} className="animate-spin" /> : <FilePlus2 size={15} />} {tr("memberInfo.add")}
              </button>
            )}
            <input ref={docInput} type="file" multiple accept="application/pdf,image/*" className="hidden" onChange={addDocuments} />
          </div>
          {documents.length === 0 ? (
            <p className="text-sm text-[#9CA3AF] mt-4">{tr("memberInfo.noDocs")}</p>
          ) : (
            <div className="space-y-3 mt-4">
              {documents.map((f) => {
                const pdf = /\.pdf$/i.test(f.name);
                return (
                  <div key={f.url} className="group flex items-center gap-3 rounded-xl border border-[#F3F4F6] px-3 py-3 hover:border-[#E5E7EB]">
                    <span className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${pdf ? "bg-[#FEE2E2] text-[#DC2626]" : "bg-[#DBEAFE] text-[#2563EB]"}`}>
                      {pdf ? <FileText size={18} /> : <ImageIcon size={18} />}
                    </span>
                    <a href={f.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[#111827] truncate hover:text-[#1E3A8A]">{f.name}</p>
                      <p className="text-[11px] text-[#9CA3AF]">{fileSize(f.size)} · {new Date(f.uploadedAt).toLocaleDateString(dateLocale(), { month: "short", day: "2-digit", year: "numeric" })}</p>
                    </a>
                    {canEdit && (
                      <button onClick={() => removeDocument(f)} aria-label={`Remove ${f.name}`} className="p-1 text-[#9CA3AF] hover:text-[#DC2626] opacity-0 group-hover:opacity-100 focus:opacity-100"><X size={15} /></button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Activity */}
      <div className="rounded-2xl border border-[#E5E7EB] overflow-hidden">
        <div className="flex justify-center gap-2 sm:gap-8 border-b border-[#F3F4F6] bg-[#F9FAFB] px-4 overflow-x-auto">
          {([
            { key: "upcoming", label: tr("memberInfo.upcomingAppts") },
            { key: "past", label: tr("memberInfo.pastAppts") },
            { key: "events", label: tr("memberInfo.otherEvents") },
          ] as const).map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-4 text-sm whitespace-nowrap border-b-2 transition-colors ${tab === t.key ? "border-[#1E3A8A] text-[#1E3A8A] font-semibold" : "border-transparent text-[#4B5563] hover:text-[#1E3A8A]"}`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="p-5 sm:p-8">
          {timeline.length === 0 ? (
            <p className="text-center text-sm text-[#9CA3AF] py-8">
              {tab === "upcoming" ? tr("memberInfo.noUpcoming") : tab === "past" ? tr("memberInfo.noPast") : tr("memberInfo.noEvents")}
            </p>
          ) : (
            <ol className="relative max-w-3xl mx-auto stagger">
              <span className="absolute left-[7px] top-3 bottom-3 w-px bg-[#E5E7EB]" />
              {timeline.map((t) => (
                <li key={t.id} className="relative pl-10 pb-6 last:pb-0">
                  <span className={`absolute left-0 top-4 w-[15px] h-[15px] rounded-full ring-4 ring-white ${t.highlight ? "bg-[#F59E0B]" : "bg-[#CBD5E1]"}`} />
                  <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold text-[#111827]">{t.title}</p>
                        <p className="text-sm text-[#6B7280] mt-0.5">{t.subtitle}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${t.highlight ? "bg-[#FEF3C7] text-[#B45309]" : "bg-[#F3F4F6] text-[#4B5563]"}`}>
                        {t.when.toLocaleDateString(dateLocale(), { month: "short", day: "2-digit", year: "numeric" })}
                      </span>
                    </div>
                    {(t.person || (t.note && isSuperAdmin)) && (
                      <div className="flex items-center justify-between gap-4 mt-4 pt-4 border-t border-[#F3F4F6]">
                        {t.person ? (
                          <div className="flex items-center gap-2.5">
                            <MemberAvatar m={{ displayName: t.person.name, email: "", photoURL: t.person.photoURL ?? null }} size={34} />
                            <div>
                              <p className="text-sm text-[#111827]">{t.person.name}</p>
                              <p className="text-[11px] text-[#6B7280]">{t.person.role}</p>
                            </div>
                          </div>
                        ) : <span />}
                        {t.note && isSuperAdmin && (
                          <button onClick={() => setNoteOpen(noteOpen === t.id ? null : t.id)} className="flex items-center gap-1 text-sm font-semibold text-[#D97706]">
                            <StickyNote size={14} /> {tr("memberInfo.note")}
                          </button>
                        )}
                      </div>
                    )}
                    {noteOpen === t.id && t.note && (
                      <p className="mt-3 text-sm text-[#374151] bg-[#FFFBEB] border-l-4 border-[#F5C518] rounded-r-lg px-4 py-3 animate-fade-up">{t.note}</p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
      {member.status !== "active" && member.status !== "pending" && <div className="flex justify-end"><StatusPill status={member.status} /></div>}
    </div>
  );
}
