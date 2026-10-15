"use client";
import React, { useEffect, useMemo, useState } from "react";
import {
  arrayRemove, arrayUnion, collection, doc, getDoc, getDocs, onSnapshot, orderBy, query, updateDoc,
} from "firebase/firestore";
import {
  Sparkles, Users, BookOpen, Bus, Church, Star, CalendarDays, MapPin, Clock, Pencil, Bookmark,
  BookmarkCheck, QrCode, X, Download, Bell, Check, Paperclip, ChevronRight, Plus,
} from "lucide-react";
import {
  db, useAuth, notify, setRsvp, clearRsvp, eventRange, eventToIcs, eventPaymentMode,
  EVENT_CATEGORIES, type EventDoc, type RsvpDoc,
} from "@/lib/firebase";
import { useToast } from "@/components/ui/Toast";
import { EventFormModal } from "./_components/EventFormModal";
import { PageTitle } from "@/components/PageTitle";
import i18n from "@nablis/i18n";
import { dateLocale } from "@/lib/locale";
import { useTranslation } from "@nablis/i18n";

const CATEGORY_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  "Spiritual Retreats": Sparkles,
  "Community Prayers": Users,
  "Bible Study": BookOpen,
  "Pilgrimage": Bus,
  "Festivals": Church,
};

function fmtDay(d: Date, withYear = true) {
  return d.toLocaleDateString(dateLocale(), { month: "short", day: "numeric", ...(withYear ? { year: "numeric" } : {}) });
}
function rangeLabel(e: EventDoc) {
  const r = eventRange(e);
  if (!r) return i18n.t("events.dateTba");
  const sameDay = r.start.toDateString() === r.end.toDateString();
  return sameDay ? fmtDay(r.start) : `${fmtDay(r.start, false)} - ${fmtDay(r.end)}`;
}
function timeLabel(e: EventDoc) {
  const r = eventRange(e);
  if (!r) return "";
  return e.time ? r.start.toLocaleTimeString(dateLocale(), { hour: "numeric", minute: "2-digit" }) : i18n.t("events.fullDay");
}
function partOfDay(e: EventDoc) {
  if ((e.durationDays ?? 1) > 1) return i18n.t("events.days", { count: e.durationDays });
  if (!e.time) return i18n.t("events.fullDay");
  const h = Number(e.time.split(":")[0]);
  return i18n.t(h < 12 ? "events.morning" : h < 17 ? "events.afternoon" : "events.evening");
}
function priceBadge(e: EventDoc) {
  const mode = eventPaymentMode(e);
  if (mode === "free") return { label: i18n.t("events.free"), cls: "bg-white text-[#111827]" };
  if (mode === "volunteer") return { label: i18n.t("events.volunteer"), cls: "bg-[#F5C518] text-[#111827]" };
  if (mode === "donation") return { label: e.price ? `${i18n.t("events.donation")} ${e.price}` : i18n.t("events.donation"), cls: "bg-white text-[#111827]" };
  return { label: `${e.price ?? ""} AED`.trim(), cls: "bg-white text-[#111827]" };
}
function downloadIcs(e: EventDoc) {
  const url = URL.createObjectURL(new Blob([eventToIcs(e)], { type: "text/calendar" }));
  const a = document.createElement("a");
  a.href = url; a.download = `${e.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.ics`; a.click();
  URL.revokeObjectURL(url);
}

// ── Event details ─────────────────────────────────────────────────────────────
function EventDetails({
  ev, isStaff, myRsvp, saved, onClose, onRsvp, onSave, onEdit, onRemind,
}: {
  ev: EventDoc;
  isStaff: boolean;
  myRsvp: RsvpDoc["status"] | null;
  saved: boolean;
  onClose: () => void;
  onRsvp: (s: RsvpDoc["status"] | null) => void;
  onSave: () => void;
  onEdit: () => void;
  onRemind: () => void;
}) {
  const { t } = useTranslation();
  const [attendees, setAttendees] = useState<RsvpDoc[] | null>(null);
  useEffect(() => {
    if (!isStaff) return;
    getDocs(collection(db, "events", ev.id, "rsvps")).then((s) => setAttendees(s.docs.map((d) => d.data() as RsvpDoc)));
  }, [ev.id, isStaff]);
  const going = (attendees ?? []).filter((a) => a.status === "attending");
  const legacy = (ev.rsvps ?? []).filter((r) => !going.some((g) => g.userId === r.userId));
  const badge = priceBadge(ev);

  function exportAttendees() {
    const rows = [["Name", "RSVP"], ...going.map((a) => [a.userName, "Attending"]), ...legacy.map((r) => [r.userName ?? r.userId, "Attending"])];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = `${ev.title}-attendees.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] flex items-start sm:items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-[640px] shadow-2xl overflow-hidden my-8" onClick={(e) => e.stopPropagation()}>
        <div className="relative h-56 bg-[#1B2E6B]">
          {ev.imageURL && <img src={ev.imageURL} alt="" className="absolute inset-0 w-full h-full object-cover" />}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          <button onClick={onClose} className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60" aria-label={t("common.close")}><X size={18} /></button>
          <div className="absolute bottom-5 left-6 right-6 text-white">
            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${badge.cls}`}>{badge.label}</span>
            <p className="font-display text-3xl font-bold mt-2 leading-tight">{ev.title}</p>
          </div>
        </div>
        <div className="p-6 space-y-5">
          <div className="grid sm:grid-cols-3 gap-3 text-sm">
            <p className="flex items-center gap-2 text-[#374151]"><CalendarDays size={16} className="text-[#1B2E6B]" />{rangeLabel(ev)}</p>
            <p className="flex items-center gap-2 text-[#374151]"><Clock size={16} className="text-[#1B2E6B]" />{timeLabel(ev)}</p>
            <p className="flex items-center gap-2 text-[#374151]"><MapPin size={16} className="text-[#1B2E6B]" />{[ev.location, ev.meetingRoom].filter(Boolean).join(" — ") || t("events.tba")}</p>
          </div>
          {ev.description && <p className="text-[#4B5563] leading-relaxed whitespace-pre-wrap">{ev.description}</p>}
          {!!ev.attachments?.length && (
            <div className="flex flex-wrap gap-2">
              {ev.attachments.map((a) => (
                <a key={a.url} href={a.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#EEF1F8] text-xs font-semibold text-[#1B2E6B] hover:bg-[#dde3f0]">
                  <Paperclip size={12} /> {a.name}
                </a>
              ))}
            </div>
          )}

          {/* RSVP Yes / No */}
          <div className="bg-[#F8FAFC] rounded-xl p-4">
            <p className="text-sm font-semibold text-[#111827] mb-3">{t("events.willAttend")}</p>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => onRsvp(myRsvp === "attending" ? null : "attending")}
                className={`flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold ${myRsvp === "attending" ? "bg-[#16A34A] text-white" : "bg-white border border-[#E5E7EB] text-[#111827] hover:border-[#16A34A]"}`}>
                <Check size={15} /> {t("events.yes")}
              </button>
              <button onClick={() => onRsvp(myRsvp === "not_attending" ? null : "not_attending")}
                className={`flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold ${myRsvp === "not_attending" ? "bg-[#6B7280] text-white" : "bg-white border border-[#E5E7EB] text-[#111827] hover:border-[#6B7280]"}`}>
                <X size={15} /> {t("common.no")}
              </button>
              <button onClick={() => downloadIcs(ev)} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-[#1B2E6B] hover:bg-[#EEF1F8]">
                <CalendarDays size={15} /> {t("events.addToCalendar")}
              </button>
              <button onClick={onSave} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-[#1B2E6B] hover:bg-[#EEF1F8]">
                {saved ? <BookmarkCheck size={15} /> : <Bookmark size={15} />} {saved ? t("events.saved") : t("events.save")}
              </button>
            </div>
          </div>

          {isStaff && (
            <div className="border-t border-[#F3F4F6] pt-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-[#111827]">{t("events.attending", { n: attendees === null ? "…" : going.length + legacy.length })}</p>
                <div className="flex gap-2">
                  <button onClick={onRemind} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#EEF1F8] text-xs font-semibold text-[#1B2E6B] hover:bg-[#dde3f0]"><Bell size={12} /> {t("events.sendReminder")}</button>
                  <button onClick={exportAttendees} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#EEF1F8] text-xs font-semibold text-[#1B2E6B] hover:bg-[#dde3f0]"><Download size={12} /> {t("events.export")}</button>
                  <button onClick={onEdit} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#1B2E6B] text-xs font-semibold text-white hover:bg-[#162554]"><Pencil size={12} /> {t("common.edit")}</button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                {[...going.map((a) => a.userName), ...legacy.map((r) => r.userName ?? t("status.member"))].map((n, i) => (
                  <span key={i} className="px-2.5 py-1 rounded-full bg-[#DCFCE7] text-[#15803D] text-xs">{n}</span>
                ))}
                {attendees !== null && going.length + legacy.length === 0 && <span className="text-xs text-[#9CA3AF]">{t("events.noRsvps")}</span>}
              </div>
              {!!ev.guestEmails?.length && <p className="text-xs text-[#6B7280] mt-3">{t("events.guests")}: {ev.guestEmails.join(", ")}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Manage events table ───────────────────────────────────────────────────────
function ManageEvents({ events, onClose, onEdit }: { events: EventDoc[]; onClose: () => void; onEdit: (e: EventDoc) => void }) {
  const { t } = useTranslation();
  const [counts, setCounts] = useState<Record<string, number>>({});
  useEffect(() => {
    Promise.all(events.map(async (e) => {
      const s = await getDocs(collection(db, "events", e.id, "rsvps"));
      const going = s.docs.filter((d) => d.data().status === "attending").length;
      return [e.id, going + (e.rsvps?.length ?? 0)] as const;
    })).then((pairs) => setCounts(Object.fromEntries(pairs)));
  }, [events]);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB]">
          <h3 className="text-xl font-bold text-[#111827]">{t("events.manage")}</h3>
          <button onClick={onClose} className="text-[#6B7280]" aria-label={t("common.close")}><X size={20} /></button>
        </div>
        <div className="max-h-[65vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-[#F9FAFB]">
              <tr className="text-left text-[11px] font-bold tracking-wider uppercase text-[#6B7280]">
                <th className="px-6 py-3">{t("events.event")}</th><th className="px-3 py-3">{t("events.date")}</th><th className="px-3 py-3">{t("events.category")}</th><th className="px-3 py-3">{t("events.going")}</th><th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F4F6]">
              {events.map((e) => (
                <tr key={e.id} className="hover:bg-[#F9FAFB]">
                  <td className="px-6 py-3 font-medium text-[#111827]">{e.title}{e.featured && <Star size={12} className="inline ml-1.5 text-[#F5C518] fill-[#F5C518]" />}</td>
                  <td className="px-3 py-3 text-[#4B5563] whitespace-nowrap">{rangeLabel(e)}</td>
                  <td className="px-3 py-3 text-[#4B5563]">{e.category ? t(`eventCat.${e.category}`, { defaultValue: e.category }) : "—"}</td>
                  <td className="px-3 py-3 text-[#111827] font-semibold">{counts[e.id] ?? "…"}</td>
                  <td className="px-3 py-3"><button onClick={() => onEdit(e)} className="px-3 py-1.5 rounded-lg bg-[#1B2E6B] text-white text-xs font-semibold">{t("common.edit")}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function EventsPage() {
  const { t } = useTranslation();
  const { user, role } = useAuth();
  const isStaff = role === "admin" || role === "super_admin";
  const toast = useToast();
  const [events, setEvents]   = useState<EventDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<string | null>(null);
  const [showPast, setShowPast] = useState(false);
  const [myRsvps, setMyRsvps] = useState<Record<string, RsvpDoc["status"]>>({});
  const [openId, setOpenId]   = useState<string | null>(null);
  const [form, setForm]       = useState<EventDoc | null | undefined>(undefined);
  const [managing, setManaging] = useState(false);

  useEffect(() => onSnapshot(query(collection(db, "events"), orderBy("startDate", "asc")), (snap) => {
    setEvents(snap.docs.map((d) => ({ id: d.id, ...d.data() } as EventDoc)));
    setLoading(false);
  }, () => setLoading(false)), []);

  // The member's own RSVP for each event (one small read per event).
  useEffect(() => {
    if (!user || events.length === 0) return;
    Promise.all(events.map(async (e) => {
      const s = await getDoc(doc(db, "events", e.id, "rsvps", user.id)).catch(() => null);
      const status = s?.exists() ? (s.data().status as RsvpDoc["status"])
        : e.rsvps?.some((r) => r.userId === user.id) ? "attending" : null;
      return [e.id, status] as const;
    })).then((pairs) => setMyRsvps(Object.fromEntries(pairs.filter(([, s]) => s)) as Record<string, RsvpDoc["status"]>));
  }, [user, events]);

  const saved = new Set<string>(((user as unknown as { savedEvents?: string[] })?.savedEvents) ?? []);
  const now = Date.now();
  const upcoming = events.filter((e) => (eventRange(e)?.end.getTime() ?? now) >= now);
  const visible = (showPast ? events : upcoming).filter((e) => !category || e.category === category);
  const featured = visible.find((e) => e.featured) ?? visible[0];
  const rest = visible.filter((e) => e.id !== featured?.id);
  const tickets = upcoming.filter((e) => myRsvps[e.id] === "attending");
  const savedList = events.filter((e) => saved.has(e.id));
  const opened = events.find((e) => e.id === openId) ?? null;

  async function rsvp(e: EventDoc, status: RsvpDoc["status"] | null) {
    if (!user) return;
    try {
      if (status) await setRsvp(e.id, user, status);
      else await clearRsvp(e.id, user.id);
      setMyRsvps((m) => {
        const next = { ...m };
        if (status) next[e.id] = status; else delete next[e.id];
        return next;
      });
      toast({ message: status === "attending" ? t("events.going_to", { title: e.title }) : status === "not_attending" ? t("events.rsvpUpdated") : t("events.rsvpRemoved") });
    } catch {
      toast({ type: "error", message: t("events.rsvpError") });
    }
  }

  async function toggleSave(e: EventDoc) {
    if (!user) return;
    const has = saved.has(e.id);
    await updateDoc(doc(db, "users", user.id), { savedEvents: has ? arrayRemove(e.id) : arrayUnion(e.id) });
    toast({ message: has ? t("events.unsaved") : t("events.savedToast") });
  }

  async function remind(e: EventDoc) {
    const s = await getDocs(collection(db, "events", e.id, "rsvps"));
    const ids = new Set([
      ...s.docs.filter((d) => d.data().status === "attending").map((d) => d.id),
      ...(e.rsvps ?? []).map((r) => r.userId),
    ]);
    if (ids.size === 0) { toast({ type: "error", message: t("events.noOneRsvp") }); return; }
    await notify(Array.from(ids).map((uid) => ({
      userId: uid, type: "event_reminder", link: "/events",
      title: `Reminder: ${e.title}`,
      description: `${rangeLabel(e)} · ${timeLabel(e)}${e.location ? ` · ${e.location}` : ""}`,
    })));
    toast({ message: t("events.reminderSent", { count: ids.size }) });
  }

  if (!user) return null;

  return (
    <div className="grid xl:grid-cols-[1fr_340px] gap-7 items-start">
      <div className="space-y-8 min-w-0">
        <div>
          <PageTitle id="events" />
        </div>

        {/* Category tiles */}
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
          {EVENT_CATEGORIES.map((c) => {
            const Icon = CATEGORY_ICONS[c] ?? CalendarDays;
            const active = category === c;
            return (
              <button key={c} onClick={() => setCategory(active ? null : c)}
                className={`bg-white rounded-2xl p-3 pb-4 flex flex-col items-center gap-2.5 transition-all hover:-translate-y-0.5 hover:shadow-md ${active ? "ring-2 ring-[#F5C518] shadow-md" : "shadow-sm"}`}>
                <span className={`w-full h-10 rounded-lg flex items-center justify-center ${active ? "bg-[#FFF8DB] text-[#1B2E6B]" : "bg-[#EEF1F8] text-[#4B5563]"}`}><Icon size={18} /></span>
                <span className="text-xs sm:text-[13px] text-[#111827] text-center leading-tight">{t(`eventCat.${c}`, { defaultValue: c })}</span>
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="py-16"><div className="w-7 h-7 border-2 border-[#1B2E6B] border-t-transparent rounded-full animate-spin mx-auto" /></div>
        ) : !featured ? (
          <div className="bg-white rounded-2xl p-12 text-center text-[#9CA3AF]">
            <CalendarDays size={36} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">{category ? t("events.noneInCategory", { category: t(`eventCat.${category}`, { defaultValue: category }) }) : t("events.noUpcoming")}</p>
            {isStaff && (
              <button onClick={() => setForm(null)} className="mt-4 inline-flex items-center gap-1.5 bg-[#F5C518] text-[#1B2E6B] font-semibold text-sm px-4 py-2 rounded-xl">
                <Plus size={14} /> {t("events.create")}
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Featured */}
            <div className="relative h-[340px] rounded-3xl overflow-hidden shadow-xl group cursor-pointer max-w-[600px]" onClick={() => setOpenId(featured.id)}>
              {featured.imageURL
                ? <img src={featured.imageURL} alt="" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                : <div className="absolute inset-0 bg-gradient-to-br from-[#1B2E6B] to-[#2a4499]" />}
              <div className="absolute inset-0 bg-gradient-to-t from-[#0B1430]/90 via-[#0B1430]/30 to-transparent" />
              <div className="absolute bottom-6 left-7 right-7 flex items-end justify-between gap-4">
                <div className="text-white">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#F5C518] text-[#111827] text-[11px] font-bold"><Star size={11} fill="currentColor" /> {t("events.featured")}</span>
                  <p className="font-display text-3xl font-bold mt-2 leading-tight">{featured.title}</p>
                  <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2 text-sm text-white/90">
                    <span className="flex items-center gap-1.5"><CalendarDays size={14} className="text-[#F5C518]" />{rangeLabel(featured)}</span>
                    {featured.location && <span className="flex items-center gap-1.5"><MapPin size={14} className="text-[#F5C518]" />{featured.location}</span>}
                  </div>
                </div>
                {isStaff ? (
                  <button onClick={(e) => { e.stopPropagation(); setForm(featured); }} className="flex-shrink-0 px-6 py-4 rounded-2xl bg-[#F5C518] text-[#111827] font-semibold shadow-lg hover:bg-[#e6b800]">{t("events.edit")}</button>
                ) : (
                  <button onClick={(e) => { e.stopPropagation(); rsvp(featured, myRsvps[featured.id] === "attending" ? null : "attending"); }}
                    className={`flex-shrink-0 px-6 py-4 rounded-2xl font-semibold shadow-lg ${myRsvps[featured.id] === "attending" ? "bg-[#16A34A] text-white" : "bg-[#F5C518] text-[#111827] hover:bg-[#e6b800]"}`}>
                    {myRsvps[featured.id] === "attending" ? t("events.booked") : t("events.bookNow")}
                  </button>
                )}
              </div>
            </div>

            {/* Cards */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-semibold text-[#111827]">{showPast ? t("events.all") : t("events.recommended")}</h2>
                <button onClick={() => setShowPast((v) => !v)} className="flex items-center gap-1 text-sm font-semibold text-[#111827] hover:text-[#1B2E6B]">
                  {showPast ? t("events.upcomingOnly") : t("events.viewAll")} <ChevronRight size={15} />
                </button>
              </div>
              {rest.length === 0 ? (
                <p className="text-sm text-[#4B5563]">{t("events.noOthers")}</p>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 stagger">
                  {rest.map((e) => {
                    const b = priceBadge(e);
                    const going = myRsvps[e.id] === "attending";
                    return (
                      <div key={e.id} className="bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col group">
                        <button onClick={() => setOpenId(e.id)} className="relative h-44 bg-[#EEF1F8] overflow-hidden text-left">
                          {e.imageURL
                            ? <img src={e.imageURL} alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                            : <div className="w-full h-full flex items-center justify-center text-[#1B2E6B]/30"><CalendarDays size={40} /></div>}
                          <span className={`absolute top-3 right-3 px-2.5 py-1 rounded-full text-[10px] font-bold shadow ${b.cls}`}>{b.label}</span>
                        </button>
                        <div className="p-5 flex-1 flex flex-col">
                          <button onClick={() => setOpenId(e.id)} className="text-left">
                            <p className="text-[15px] font-bold tracking-wide uppercase text-[#111827] line-clamp-2">{e.title}</p>
                            <p className="text-[#1B2E6B] text-sm font-medium mt-1">{partOfDay(e)}</p>
                          </button>
                          <div className="mt-4 space-y-2.5 text-[13px] text-[#4B5563]">
                            <p className="flex items-center gap-2"><Clock size={13} /> {rangeLabel(e)} • {timeLabel(e)}</p>
                            {e.location && <p className="flex items-center gap-2"><MapPin size={13} /> <span className="truncate">{e.location}</span></p>}
                          </div>
                          <div className="mt-auto pt-5">
                            {isStaff ? (
                              <button onClick={() => remind(e)} className="w-full py-2.5 rounded-xl bg-[#E2E7F0] text-[#111827] font-medium hover:bg-[#D3DAE8]">{t("events.sendReminder")}</button>
                            ) : (
                              <button onClick={() => rsvp(e, going ? null : "attending")}
                                className={`w-full py-2.5 rounded-xl font-medium ${going ? "bg-[#DCFCE7] text-[#15803D]" : "bg-[#E2E7F0] text-[#111827] hover:bg-[#D3DAE8]"}`}>
                                {going ? t("events.registered") : t("events.register")}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Right panel */}
      <aside className="bg-white rounded-2xl shadow-sm p-6 space-y-7 xl:sticky xl:top-24">
        <div className="text-center">
          {user.photoURL
            ? <img src={user.photoURL} alt="" className="w-24 h-24 rounded-full object-cover mx-auto ring-4 ring-[#F5C518]" />
            : <div className="w-24 h-24 rounded-full mx-auto ring-4 ring-[#F5C518] bg-[#1B2E6B] text-white text-3xl font-bold flex items-center justify-center">{(user.displayName || user.email)[0].toUpperCase()}</div>}
          <p className="text-xl font-bold text-[#1B2E6B] mt-3">{user.displayName || t("status.member")}</p>
          <p className="text-sm text-[#9CA3AF]">{user.email}</p>
          {isStaff && (
            <div className="mt-6 space-y-3">
              <button onClick={() => setForm(null)} className="w-full py-3 rounded-xl bg-[#F5C518] text-[#111827] font-semibold shadow-[0_10px_24px_-12px_rgba(245,197,24,0.9)] hover:bg-[#e6b800]">{t("events.createNew")}</button>
              <button onClick={() => setManaging(true)} className="w-full py-3 rounded-xl bg-[#F5C518] text-[#111827] font-semibold shadow-[0_10px_24px_-12px_rgba(245,197,24,0.9)] hover:bg-[#e6b800]">{t("events.manage")}</button>
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-lg font-semibold text-[#111827]">{t("events.activeRsvps")}</p>
            <span className="text-sm text-[#111827]">{t("events.tickets", { count: tickets.length })}</span>
          </div>
          {tickets.length === 0 ? (
            <p className="text-sm text-[#9CA3AF]">{t("events.ticketsEmpty")}</p>
          ) : (
            <div className="space-y-3">
              {tickets.map((e) => {
                const r = eventRange(e);
                const live = r && r.start.getTime() - now < 7 * 86400000;
                return (
                  <button key={e.id} onClick={() => setOpenId(e.id)} className="w-full text-left bg-white rounded-2xl border border-[#EEF1F8] shadow-md p-5 hover:shadow-lg transition-shadow">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-[#1B2E6B]">{e.title}</p>
                        <p className="text-xs text-[#9CA3AF]">{rangeLabel(e)}</p>
                      </div>
                      <QrCode size={20} className="text-[#F5C518] flex-shrink-0" />
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-4">
                      {[[t("events.venue"), e.location || t("events.tba")], [t("events.group"), e.category ? t(`eventCat.${e.category}`, { defaultValue: e.category }) : t("events.event")], ["ID", `#${e.id.slice(0, 4).toUpperCase()}`]].map(([k, v]) => (
                        <div key={k}>
                          <p className="text-[9px] font-bold tracking-widest text-[#9CA3AF]">{k}</p>
                          <p className="text-xs font-bold text-[#1B2E6B] uppercase truncate">{v}</p>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-dashed border-[#E5E7EB]">
                      <span className="flex items-center gap-1.5 text-[10px] font-bold tracking-widest text-[#9CA3AF]">
                        <span className={`w-1.5 h-1.5 rounded-full ${live ? "bg-[#22C55E]" : "bg-[#D1D5DB]"}`} /> {live ? t("events.activeRsvp") : t("events.upcoming")}
                      </span>
                      <span className="text-[11px] font-semibold text-[#111827]">{timeLabel(e)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <p className="text-lg font-semibold text-[#111827] mb-3">{t("events.savedEvents")}</p>
          {savedList.length === 0 ? (
            <p className="text-sm text-[#9CA3AF]">{t("events.savedEmpty")}</p>
          ) : (
            <div className="space-y-3">
              {savedList.map((e) => (
                <div key={e.id} className="flex items-center gap-3 bg-[#F8FAFC] rounded-xl p-2.5 pr-3">
                  <button onClick={() => setOpenId(e.id)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                    {e.imageURL
                      ? <img src={e.imageURL} alt="" className="w-14 h-14 rounded-lg object-cover" />
                      : <span className="w-14 h-14 rounded-lg bg-[#EEF1F8] flex items-center justify-center text-[#1B2E6B]"><CalendarDays size={18} /></span>}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#1B2E6B] truncate">{e.title}</p>
                      <p className="text-xs text-[#9CA3AF]">{rangeLabel(e)} • {priceBadge(e).label}</p>
                    </div>
                  </button>
                  <button onClick={() => toggleSave(e)} className="w-7 h-7 rounded-lg bg-[#FFF8DB] text-[#1B2E6B] flex items-center justify-center" aria-label={t("events.unsave")}><BookmarkCheck size={14} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>

      {opened && (
        <EventDetails
          ev={opened}
          isStaff={isStaff}
          myRsvp={myRsvps[opened.id] ?? null}
          saved={saved.has(opened.id)}
          onClose={() => setOpenId(null)}
          onRsvp={(s) => rsvp(opened, s)}
          onSave={() => toggleSave(opened)}
          onEdit={() => { setOpenId(null); setForm(opened); }}
          onRemind={() => remind(opened)}
        />
      )}
      {managing && <ManageEvents events={events} onClose={() => setManaging(false)} onEdit={(e) => { setManaging(false); setForm(e); }} />}
      {form !== undefined && (
        <EventFormModal
          initial={form}
          onClose={() => setForm(undefined)}
          onSaved={(msg) => { setForm(undefined); toast({ message: msg }); }}
        />
      )}
    </div>
  );
}
