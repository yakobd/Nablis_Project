"use client";
import React, { useEffect, useState } from "react";
import {
  collection, query, orderBy, getDocs, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp, Timestamp,
} from "firebase/firestore";
import { db, useAuth } from "@/lib/firebase";
import {
  Plus, X, Calendar, MapPin, Users, Clock, ChevronRight,
  Pencil, Trash2, Send, Search,
} from "lucide-react";
import type { Event } from "@nablis/shared/firebase";

const CATEGORIES = ["All", "Spiritual Retreats", "Community Prayers", "Bible Study", "Pilgrimage", "Festivals"] as const;
type Cat = (typeof CATEGORIES)[number];

const INPUT = "w-full px-4 py-2.5 rounded-xl border border-[#E5E7EB] text-sm text-[#374151] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#1B2E6B]/20 focus:border-[#1B2E6B] transition-colors";
const SELECT = INPUT + " bg-white";

function fmtDate(ts: Timestamp | null | undefined) {
  if (!ts) return "";
  try { return ts.toDate().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
  catch { return ""; }
}
function toDatetimeLocal(ts: Timestamp | undefined | null): string {
  if (!ts) return "";
  try {
    const d = ts.toDate();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch { return ""; }
}

type BadgeType = "FREE" | "VOLUNTEER" | "REGISTER";
function badge(ev: Event): BadgeType {
  if ((ev as any).free) return "FREE";
  if ((ev as any).volunteer) return "VOLUNTEER";
  return "REGISTER";
}
const BADGE_STYLE: Record<BadgeType, string> = {
  FREE:      "bg-green-50 text-green-700",
  VOLUNTEER: "bg-purple-50 text-purple-700",
  REGISTER:  "bg-[#F5C518]/20 text-[#1B2E6B]",
};

// ── Event Form Modal ──────────────────────────────────────────────────────────
interface EventFormProps {
  initial?: Event | null;
  onClose: () => void;
  onSaved: () => void;
}
function EventFormModal({ initial, onClose, onSaved }: EventFormProps) {
  const [title, setTitle]         = useState(initial?.title ?? "");
  const [description, setDesc]    = useState(initial?.description ?? "");
  const [location, setLocation]   = useState((initial as any)?.location ?? "");
  const [category, setCategory]   = useState((initial as any)?.category ?? "Community Prayers");
  const [capacity, setCapacity]   = useState(String((initial as any)?.totalCapacity ?? ""));
  const [startDate, setStartDate] = useState(toDatetimeLocal((initial as any)?.startDate));
  const [endDate, setEndDate]     = useState(toDatetimeLocal((initial as any)?.endDate));
  const [isFree, setIsFree]       = useState((initial as any)?.free ?? false);
  const [isVol, setIsVol]         = useState((initial as any)?.volunteer ?? false);
  const [saving, setSaving]       = useState(false);
  const [deleting, setDeleting]   = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const payload = {
        title:         title.trim(),
        description:   description.trim(),
        location:      location.trim(),
        category,
        totalCapacity: capacity ? Number(capacity) : null,
        startDate:     startDate ? Timestamp.fromDate(new Date(startDate)) : null,
        endDate:       endDate   ? Timestamp.fromDate(new Date(endDate))   : null,
        free:          isFree,
        volunteer:     isVol,
        updatedAt:     serverTimestamp(),
      };
      if (initial?.id) {
        await updateDoc(doc(db, "events", initial.id), payload);
      } else {
        await addDoc(collection(db, "events"), { ...payload, createdAt: serverTimestamp(), attendees: [] });
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirmDel) { setConfirmDel(true); return; }
    if (!initial?.id) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, "events", initial.id));
      onSaved();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-y-auto max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#F3F4F6]">
          <h2 className="text-[#1B2E6B] font-bold text-base">{initial ? "Update Event" : "Create Event"}</h2>
          <button onClick={onClose} className="text-[#9CA3AF] hover:text-[#6B7280]"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#374151] mb-1.5">Title *</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Event title…" className={INPUT} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#374151] mb-1.5">Description</label>
            <textarea value={description} onChange={(e) => setDesc(e.target.value)} rows={3}
              placeholder="Describe the event…"
              className={INPUT + " resize-none"} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1.5">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={SELECT}>
                {CATEGORIES.filter((c) => c !== "All").map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1.5">Capacity</label>
              <input type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)}
                placeholder="Max attendees" className={INPUT} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#374151] mb-1.5">Location</label>
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Venue or online link…" className={INPUT} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1.5">Start Date</label>
              <input type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={INPUT} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1.5">End Date</label>
              <input type="datetime-local" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={INPUT} />
            </div>
          </div>
          <div className="flex gap-4">
            {[
              { label: "Free Event",   value: isFree, set: setIsFree },
              { label: "Volunteer",    value: isVol,  set: setIsVol  },
            ].map(({ label, value, set }) => (
              <label key={label} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={value} onChange={(e) => set(e.target.checked)}
                  className="w-4 h-4 accent-[#1B2E6B]" />
                <span className="text-sm text-[#374151]">{label}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="px-6 pb-6 space-y-2">
          <button onClick={handleSave} disabled={saving || !title.trim()}
            className="w-full flex items-center justify-center gap-2 bg-[#F5C518] text-[#1B2E6B] font-semibold py-2.5 rounded-xl hover:bg-[#e6b800] disabled:opacity-60 transition-colors text-sm">
            {saving ? <div className="w-4 h-4 border-2 border-[#1B2E6B]/40 border-t-[#1B2E6B] rounded-full animate-spin" /> : <Send size={14} />}
            {initial ? "Save Changes" : "Create Event"}
          </button>
          {initial && (
            confirmDel ? (
              <div className="flex gap-2">
                <button onClick={() => setConfirmDel(false)}
                  className="flex-1 py-2 rounded-xl border border-[#E5E7EB] text-sm text-[#6B7280] font-medium hover:bg-[#F9FAFB]">
                  Cancel
                </button>
                <button onClick={handleDelete} disabled={deleting}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 disabled:opacity-60">
                  {deleting ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Trash2 size={13} />}
                  Confirm Delete
                </button>
              </div>
            ) : (
              <button onClick={handleDelete}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-red-200 text-red-500 font-semibold text-sm hover:bg-red-50 transition-colors">
                <Trash2 size={13} /> Delete Event
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}

// ── Event card ────────────────────────────────────────────────────────────────
function EventCard({ ev, onEdit, isAdmin }: { ev: Event; onEdit?: () => void; isAdmin: boolean }) {
  const b = badge(ev);
  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden group hover:shadow-md transition-shadow">
      <div className="aspect-[16/9] bg-gradient-to-br from-[#1B2E6B] to-[#2a4499] overflow-hidden relative">
        {(ev as any).imageURL ? (
          <img src={(ev as any).imageURL} alt={ev.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 opacity-70" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Calendar size={36} className="text-white/20" />
          </div>
        )}
        <span className={`absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-bold ${BADGE_STYLE[b]}`}>{b}</span>
        {isAdmin && onEdit && (
          <button onClick={onEdit}
            className="absolute top-3 right-3 p-1.5 rounded-lg bg-black/40 text-white hover:bg-black/60 transition-colors">
            <Pencil size={12} />
          </button>
        )}
      </div>
      <div className="p-4">
        <p className="text-[10px] font-bold text-[#1B2E6B] bg-[#EEF1F8] inline-block px-2 py-0.5 rounded-full mb-2">
          {(ev as any).category ?? "Event"}
        </p>
        <h3 className="text-[#1B2E6B] font-bold text-sm mb-2 line-clamp-2">{ev.title}</h3>
        <div className="space-y-1">
          {(ev as any).startDate && (
            <div className="flex items-center gap-1.5 text-[#9CA3AF] text-[10px]">
              <Clock size={10} /> {fmtDate((ev as any).startDate)}
            </div>
          )}
          {(ev as any).location && (
            <div className="flex items-center gap-1.5 text-[#9CA3AF] text-[10px]">
              <MapPin size={10} /> {(ev as any).location}
            </div>
          )}
          {(ev as any).totalCapacity && (
            <div className="flex items-center gap-1.5 text-[#9CA3AF] text-[10px]">
              <Users size={10} /> {((ev as any).attendees?.length ?? 0)} / {(ev as any).totalCapacity} attending
            </div>
          )}
        </div>
        <button className="mt-3 flex items-center gap-1 text-xs font-semibold text-[#1B2E6B] hover:text-[#F5C518] transition-colors">
          View Details <ChevronRight size={12} />
        </button>
      </div>
    </div>
  );
}

// ── Featured banner ───────────────────────────────────────────────────────────
function FeaturedBanner({ ev, onEdit, isAdmin }: { ev: Event; onEdit?: () => void; isAdmin: boolean }) {
  const b = badge(ev);
  return (
    <div className="bg-[#1B2E6B] rounded-2xl overflow-hidden relative h-52 flex items-end">
      {(ev as any).imageURL && (
        <img src={(ev as any).imageURL} alt={ev.title} className="absolute inset-0 w-full h-full object-cover opacity-30" />
      )}
      <div className="relative p-6 w-full bg-gradient-to-t from-black/70 to-transparent flex items-end justify-between">
        <div>
          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${BADGE_STYLE[b]}`}>{b}</span>
          <h2 className="text-white font-bold text-lg mt-2 line-clamp-2">{ev.title}</h2>
          <div className="flex items-center gap-3 mt-1">
            {(ev as any).startDate && (
              <span className="text-white/60 text-xs flex items-center gap-1"><Clock size={10} />{fmtDate((ev as any).startDate)}</span>
            )}
            {(ev as any).location && (
              <span className="text-white/60 text-xs flex items-center gap-1"><MapPin size={10} />{(ev as any).location}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isAdmin && onEdit && (
            <button onClick={onEdit}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/20 text-white text-xs font-semibold hover:bg-white/30 transition-colors">
              <Pencil size={12} /> Edit
            </button>
          )}
          <button className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#F5C518] text-[#1B2E6B] text-sm font-bold hover:bg-[#e6b800] transition-colors">
            Register Now <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function EventsPage() {
  const { user, role } = useAuth();
  const isAdmin = role === "admin";
  const [events, setEvents]       = useState<Event[]>([]);
  const [loading, setLoading]     = useState(true);
  const [activeCat, setActiveCat] = useState<Cat>("All");
  const [search, setSearch]       = useState("");
  const [showForm, setShowForm]   = useState(false);
  const [editEvent, setEditEvent] = useState<Event | null>(null);

  function load() {
    setLoading(true);
    getDocs(query(collection(db, "events"), orderBy("createdAt", "desc")))
      .then((snap) => setEvents(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Event))))
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  if (!user) return null;

  const filtered = events.filter((e) => {
    const matchCat = activeCat === "All" || (e as any).category === activeCat;
    const matchSearch = !search || e.title.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const featured = filtered.find((e) => (e as any).featured) ?? filtered[0];
  const rest = filtered.filter((e) => e !== featured);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#1B2E6B]">Events</h1>
          <p className="text-[#9CA3AF] text-sm mt-0.5">Upcoming spiritual gatherings and community programs</p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <button onClick={() => { setEditEvent(null); setShowForm(true); }}
              className="flex items-center gap-1.5 bg-[#F5C518] text-[#1B2E6B] font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-[#e6b800] transition-colors">
              <Plus size={15} /> Create Event
            </button>
          </div>
        )}
      </div>

      {/* Category tabs + search */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-1 bg-white rounded-xl border border-[#E5E7EB] p-1 overflow-x-auto">
          {CATEGORIES.map((c) => (
            <button key={c} onClick={() => setActiveCat(c)}
              className={[
                "px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors",
                activeCat === c ? "bg-[#1B2E6B] text-white" : "text-[#6B7280] hover:text-[#1B2E6B]",
              ].join(" ")}>
              {c}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-56">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search events…"
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-[#E5E7EB] text-sm text-[#374151] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#1B2E6B]/20 focus:border-[#1B2E6B]" />
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center">
          <div className="w-7 h-7 border-2 border-[#1B2E6B] border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-[#9CA3AF]">
          <Calendar size={36} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">No events found.</p>
          {isAdmin && (
            <button onClick={() => { setEditEvent(null); setShowForm(true); }}
              className="mt-3 flex items-center gap-1.5 mx-auto bg-[#F5C518] text-[#1B2E6B] font-semibold text-sm px-4 py-2 rounded-xl hover:bg-[#e6b800] transition-colors">
              <Plus size={14} /> Create First Event
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Featured banner */}
          {featured && (
            <FeaturedBanner ev={featured} isAdmin={isAdmin}
              onEdit={() => { setEditEvent(featured); setShowForm(true); }} />
          )}

          {/* Grid */}
          {rest.length > 0 && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {rest.map((ev) => (
                <EventCard key={ev.id} ev={ev} isAdmin={isAdmin}
                  onEdit={() => { setEditEvent(ev); setShowForm(true); }} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Admin sidebar CTA strip */}
      {isAdmin && (
        <div className="bg-[#1B2E6B] rounded-2xl p-5 flex items-center justify-between">
          <div>
            <p className="text-white font-bold text-sm">Manage all events</p>
            <p className="text-white/60 text-xs mt-0.5">{events.length} total event{events.length !== 1 ? "s" : ""} in your community</p>
          </div>
          <button onClick={() => { setEditEvent(null); setShowForm(true); }}
            className="flex items-center gap-1.5 bg-[#F5C518] text-[#1B2E6B] font-semibold text-sm px-4 py-2 rounded-xl hover:bg-[#e6b800] transition-colors">
            <Plus size={14} /> New Event
          </button>
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <EventFormModal
          initial={editEvent}
          onClose={() => { setShowForm(false); setEditEvent(null); }}
          onSaved={() => { setShowForm(false); setEditEvent(null); load(); }}
        />
      )}
    </div>
  );
}
