"use client";
import React, { useEffect, useState } from "react";
import {
  collection,
  query,
  getDocs,
  doc,
  updateDoc,
  addDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
  where,
  orderBy,
} from "firebase/firestore";
import { db, useAuth } from "@/lib/firebase";
import { Plus, Pencil, Trash2, X, Check, Sun, Cloud, Moon } from "lucide-react";
import type { DailyPrayer, PrayerLog } from "@nablis/shared/firebase";

// ── Toggle component ──────────────────────────────────────────────────────────
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${checked ? "bg-[#1B2E6B]" : "bg-[#D1D5DB]"}`}>
      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${checked ? "translate-x-5" : "translate-x-0.5"}`} />
    </button>
  );
}

// ── Prayer edit modal ─────────────────────────────────────────────────────────
function PrayerEditModal({
  prayer,
  onClose,
  onSaved,
}: {
  prayer?: Partial<DailyPrayer> | null;
  onClose: () => void;
  onSaved: (p: DailyPrayer) => void;
}) {
  const isNew = !prayer?.id;
  const [type, setType]       = useState<DailyPrayer["type"]>(prayer?.type ?? "morning");
  const [time, setTime]       = useState(prayer?.time ?? "06:00");
  const [message, setMessage] = useState(prayer?.message ?? "");
  const [verse, setVerse]     = useState(prayer?.bibleVerse ?? "");
  const [loading, setLoading] = useState(false);

  async function save() {
    setLoading(true);
    try {
      const data = { type, time, message, bibleVerse: verse, createdAt: prayer?.createdAt ?? serverTimestamp() };
      if (isNew) {
        const ref = await addDoc(collection(db, "dailyPrayers"), data);
        onSaved({ id: ref.id, ...data } as unknown as DailyPrayer);
      } else {
        await updateDoc(doc(db, "dailyPrayers", prayer!.id!), data);
        onSaved({ id: prayer!.id!, ...data } as unknown as DailyPrayer);
      }
      onClose();
    } finally {
      setLoading(false);
    }
  }

  const INPUT = "w-full px-4 py-2.5 rounded-xl border border-[#E5E7EB] text-sm text-[#374151] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#1B2E6B]/20 focus:border-[#1B2E6B] transition-colors";

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#F3F4F6]">
          <h3 className="text-[#1B2E6B] font-bold">{isNew ? "Add Prayer Reminder" : "Edit Prayer Reminder"}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#EEF1F8] text-[#9CA3AF]"><X size={16} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#374151] mb-1.5">Prayer Type</label>
            <select value={type} onChange={(e) => setType(e.target.value as DailyPrayer["type"])} className={INPUT + " bg-white"}>
              <option value="morning">Morning</option>
              <option value="afternoon">Afternoon</option>
              <option value="evening">Evening</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#374151] mb-1.5">Reminder Time</label>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={INPUT} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#374151] mb-1.5">Prayer Message</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} placeholder="Write the prayer reminder message…" className={INPUT + " resize-none"} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#374151] mb-1.5">Bible Verse</label>
            <input type="text" value={verse} onChange={(e) => setVerse(e.target.value)} placeholder="e.g. Psalm 5:3" className={INPUT} />
          </div>
          <button onClick={save} disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-[#F5C518] text-[#1B2E6B] font-semibold py-2.5 rounded-xl hover:bg-[#e6b800] transition-colors disabled:opacity-60 text-sm">
            {loading && <div className="w-4 h-4 border-2 border-[#1B2E6B]/40 border-t-[#1B2E6B] rounded-full animate-spin" />}
            {isNew ? "Add Reminder" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Admin view ────────────────────────────────────────────────────────────────
const PRAYER_ICONS: Record<string, React.ReactNode> = {
  morning:   <Sun size={20} className="text-[#F5C518]" />,
  afternoon: <Cloud size={20} className="text-[#1B2E6B]" />,
  evening:   <Moon size={20} className="text-[#1B2E6B]" />,
};

function AdminPrayers() {
  const [prayers, setPrayers]   = useState<DailyPrayer[]>([]);
  const [enabled, setEnabled]   = useState<Record<string, boolean>>({});
  const [editing, setEditing]   = useState<Partial<DailyPrayer> | null | undefined>(undefined);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    getDocs(collection(db, "dailyPrayers"))
      .then((snap) => {
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as DailyPrayer));
        setPrayers(items);
        setEnabled(Object.fromEntries(items.map((p) => [p.id, true])));
      })
      .finally(() => setLoading(false));
  }, []);

  async function togglePrayer(id: string, val: boolean) {
    setEnabled((p) => ({ ...p, [id]: val }));
  }

  async function deletePrayer(id: string) {
    if (!confirm("Delete this prayer reminder?")) return;
    await deleteDoc(doc(db, "dailyPrayers", id));
    setPrayers((p) => p.filter((pr) => pr.id !== id));
  }

  function onSaved(p: DailyPrayer) {
    setPrayers((prev) => {
      const idx = prev.findIndex((x) => x.id === p.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = p; return next; }
      return [...prev, p];
    });
    setEnabled((prev) => ({ ...prev, [p.id]: true }));
  }

  const stats = [
    { label: "Marked Today",  value: "128", icon: "✅" },
    { label: "Active Users",  value: "347", icon: "👥" },
    { label: "Avg Streak",    value: "12d", icon: "🔥" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#1B2E6B]">Daily Prayers</h1>
          <p className="text-[#9CA3AF] text-sm mt-0.5">Manage daily reminders for the community</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {stats.map(({ label, value, icon }) => (
          <div key={label} className="bg-white rounded-2xl p-5 border border-[#E5E7EB] shadow-sm text-center">
            <p className="text-2xl mb-1">{icon}</p>
            <p className="text-2xl font-bold text-[#1B2E6B]">{value}</p>
            <p className="text-[#9CA3AF] text-xs mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Reminder times */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[#1B2E6B] font-semibold text-sm">Reminder Times</h2>
          <button onClick={() => setEditing(null)}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#1B2E6B] bg-[#EEF1F8] px-3 py-1.5 rounded-lg hover:bg-[#dde3f0] transition-colors">
            <Plus size={13} /> ADD NEW
          </button>
        </div>

        {loading ? (
          <div className="py-10 text-center"><div className="w-7 h-7 border-2 border-[#1B2E6B] border-t-transparent rounded-full animate-spin mx-auto" /></div>
        ) : prayers.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-10 text-center text-[#9CA3AF] text-sm">
            No prayer reminders yet. Add one above.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {prayers.map((p) => (
              <div key={p.id} className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {PRAYER_ICONS[p.type]}
                    <span className="text-[#1B2E6B] font-semibold text-sm capitalize">{p.type} Prayer</span>
                  </div>
                  <Toggle checked={enabled[p.id] ?? true} onChange={(v) => togglePrayer(p.id, v)} />
                </div>
                <p className="text-3xl font-bold text-[#1B2E6B] mb-2">{p.time}</p>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[#9CA3AF] text-[10px] font-bold uppercase tracking-wide">TIME</span>
                  <button onClick={() => setEditing(p)}
                    className="text-[10px] font-bold text-[#1B2E6B] bg-[#EEF1F8] px-2 py-0.5 rounded-md hover:bg-[#dde3f0] transition-colors">
                    EDIT TIME
                  </button>
                </div>
                <div className="bg-[#F9FAFB] rounded-xl p-3 mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] font-bold text-[#9CA3AF] uppercase tracking-wide">Current Message</span>
                    <button onClick={() => setEditing(p)} className="text-[9px] font-bold text-[#1B2E6B]">EDIT</button>
                  </div>
                  <p className="text-[#374151] text-xs leading-relaxed line-clamp-2">{p.message || "No message set."}</p>
                  {p.bibleVerse && <p className="text-[#9CA3AF] text-[10px] mt-1 italic">{p.bibleVerse}</p>}
                </div>
                <button onClick={() => deletePrayer(p.id)}
                  className="flex items-center gap-1.5 text-red-400 hover:text-red-600 text-xs transition-colors">
                  <Trash2 size={12} /> Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {editing !== undefined && (
        <PrayerEditModal prayer={editing} onClose={() => setEditing(undefined)} onSaved={onSaved} />
      )}
    </div>
  );
}

// ── Member view ───────────────────────────────────────────────────────────────
const MEMBER_PRAYERS = [
  { type: "morning"   as const, label: "Morning Prayer",   time: "6:00 AM",  icon: <Sun size={18} />,   emoji: "🌅" },
  { type: "afternoon" as const, label: "Afternoon Prayer", time: "12:00 PM", icon: <Cloud size={18} />, emoji: "☀️" },
  { type: "evening"   as const, label: "Evening Prayer",   time: "9:00 PM",  icon: <Moon size={18} />,  emoji: "🌙" },
];

const VERSE = {
  text: "In the morning, LORD, you hear my voice; in the morning I lay my requests before you and wait expectantly.",
  ref: "Psalm 5:3",
};

function MemberPrayers() {
  const { user } = useAuth();
  const [prayers, setPrayers]     = useState<DailyPrayer[]>([]);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [logs, setLogs]           = useState<PrayerLog[]>([]);

  useEffect(() => {
    getDocs(collection(db, "dailyPrayers")).then((snap) =>
      setPrayers(snap.docs.map((d) => ({ id: d.id, ...d.data() } as DailyPrayer)))
    );
    if (user) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      getDocs(query(
        collection(db, "prayerLogs"),
        where("userId", "==", user.id),
        where("prayedAt", ">=", Timestamp.fromDate(today))
      )).then((snap) => {
        setCompleted(new Set(snap.docs.map((d) => d.data().prayerType as string)));
        setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() } as PrayerLog)));
      });
    }
  }, [user]);

  async function markPrayed(type: DailyPrayer["type"]) {
    if (!user || completed.has(type)) return;
    await addDoc(collection(db, "prayerLogs"), {
      userId: user.id,
      prayerType: type,
      prayedAt: serverTimestamp(),
      streak: 1,
    });
    setCompleted((p) => new Set([...p, type]));
  }

  function getPrayerForType(type: string) {
    return prayers.find((p) => p.type === type);
  }

  const hour = new Date().getHours();
  const currentType = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";

  const firstName = user?.displayName?.split(" ")[0] ?? "Friend";

  return (
    <div className="grid lg:grid-cols-3 gap-5">
      <div className="lg:col-span-2 space-y-4">
        {/* Morning reflection banner */}
        <div className="bg-[#1B2E6B] rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute right-0 top-0 text-white/5 text-[180px] leading-none select-none">🕊️</div>
          <p className="text-[#F5C518] font-semibold text-xs uppercase tracking-widest mb-2">
            {currentType === "morning" ? "Morning Reflection" : currentType === "afternoon" ? "Midday Reflection" : "Evening Reflection"}
          </p>
          <p className="text-white text-lg font-bold mb-2 leading-snug max-w-md">
            &ldquo;{VERSE.text}&rdquo;
          </p>
          <p className="text-white/50 text-sm">{VERSE.ref}</p>
        </div>

        {/* Prayer commitments */}
        <div>
          <h2 className="text-[#1B2E6B] font-semibold text-sm mb-3">Daily Prayer Commitments</h2>
          <div className="space-y-3">
            {MEMBER_PRAYERS.map(({ type, label, time, emoji }) => {
              const done   = completed.has(type);
              const prayer = getPrayerForType(type);
              const isNext = !done && type === currentType;
              return (
                <div key={type} className={[
                  "bg-white rounded-2xl border shadow-sm p-5 transition-all",
                  isNext ? "border-[#1B2E6B]/30 ring-1 ring-[#1B2E6B]/10" : "border-[#E5E7EB]",
                ].join(" ")}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3 flex-1">
                      <div className={[
                        "w-11 h-11 rounded-2xl flex items-center justify-center text-xl flex-shrink-0",
                        done ? "bg-green-50" : "bg-[#EEF1F8]",
                      ].join(" ")}>
                        {done ? "✅" : emoji}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-[#1B2E6B] font-semibold text-sm">{label}</p>
                          <span className={[
                            "text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide",
                            done     ? "bg-green-50 text-green-700" :
                            isNext   ? "bg-[#F5C518]/20 text-[#1B2E6B]" :
                            "bg-[#EEF1F8] text-[#9CA3AF]",
                          ].join(" ")}>
                            {done ? "COMPLETED" : isNext ? "UP NEXT" : "SCHEDULED"}
                          </span>
                        </div>
                        <p className="text-[#9CA3AF] text-xs">{time}</p>
                        {prayer?.message && (
                          <p className="text-[#6B7280] text-xs mt-1.5 leading-relaxed line-clamp-2">
                            {prayer.message}
                          </p>
                        )}
                      </div>
                    </div>
                    {!done && (
                      <button onClick={() => markPrayed(type)}
                        className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#1B2E6B] text-white text-xs font-semibold hover:bg-[#162554] transition-colors">
                        <Check size={12} /> Mark as Prayed
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right sidebar */}
      <div className="space-y-4">
        {/* Progress */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-5">
          <h3 className="text-[#1B2E6B] font-semibold text-sm mb-4">Your Progress</h3>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-[#EEF1F8] rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-[#1B2E6B]">🔥</p>
              <p className="text-[#1B2E6B] font-bold text-lg mt-1">{logs.length > 0 ? "3" : "0"}</p>
              <p className="text-[#9CA3AF] text-[10px]">Day Streak</p>
            </div>
            <div className="bg-[#EEF1F8] rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-[#1B2E6B]">🙏</p>
              <p className="text-[#1B2E6B] font-bold text-lg mt-1">{completed.size}/3</p>
              <p className="text-[#9CA3AF] text-[10px]">Today</p>
            </div>
          </div>
          {/* Simple weekly consistency */}
          <p className="text-[#9CA3AF] text-[10px] font-semibold uppercase tracking-wide mb-2">This Week</p>
          <div className="flex gap-1">
            {["M","T","W","T","F","S","S"].map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className={`w-full h-4 rounded-sm ${i < 4 ? "bg-[#1B2E6B]" : "bg-[#EEF1F8]"}`} />
                <span className="text-[9px] text-[#9CA3AF]">{d}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Verse of the day */}
        <div className="bg-[#F5C518] rounded-2xl p-5">
          <p className="text-[#1B2E6B] text-[10px] font-bold uppercase tracking-widest mb-2">✨ Verse of the Day</p>
          <p className="text-[#1B2E6B] text-sm font-medium leading-relaxed italic mb-2">&ldquo;{VERSE.text}&rdquo;</p>
          <p className="text-[#1B2E6B]/70 text-xs font-semibold">{VERSE.ref}</p>
        </div>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function DailyPrayersPage() {
  const { user, role } = useAuth();
  if (!user) return null;
  return role === "admin" ? <AdminPrayers /> : <MemberPrayers />;
}
