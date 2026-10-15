"use client";
import React, { useState } from "react";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { X, Plus, CalendarOff, Copy, Clock } from "lucide-react";
import {
  db, formatTime12, toIsoDate, SLOT_TIMES, type Availability,
} from "@/lib/firebase";
import { useTranslation } from "@nablis/i18n";
import { dateLocale } from "@/lib/locale";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Weekday name for 0 = Sunday … 6 = Saturday. */
const dayName = (d: number) => new Date(2024, 0, 7 + d).toLocaleDateString(dateLocale(), { weekday: "long" });

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${checked ? "bg-[#1B2E6B]" : "bg-[#D1D5DB]"}`}>
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : ""}`} />
    </button>
  );
}

// Lets the Spiritual Father (optionally) set the times members can book.
export function AvailabilityModal({
  current, onClose, onSaved,
}: {
  current: Availability;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [enabled, setEnabled]   = useState(current.enabled);
  const [weekly, setWeekly]     = useState<Record<string, string[]>>(current.weekly);
  const [blocked, setBlocked]   = useState<string[]>(current.blockedDates);
  const [allowCustom, setAllowCustom] = useState(current.allowCustomTimes);
  const [adding, setAdding]     = useState<Record<string, string>>({});
  const [blockDate, setBlockDate] = useState("");
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const setDay = (d: number, times: string[]) =>
    setWeekly((w) => ({ ...w, [String(d)]: Array.from(new Set(times)).sort() }));

  function addTime(d: number) {
    const t = adding[d];
    if (!t) return;
    setDay(d, [...(weekly[String(d)] ?? []), t]);
    setAdding((a) => ({ ...a, [d]: "" }));
  }

  function copyToAll(d: number) {
    const times = weekly[String(d)] ?? [];
    setWeekly(Object.fromEntries(DAYS.map((_, i) => [String(i), weekly[String(i)]?.length || i === d ? [...times] : []])));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const today = toIsoDate(new Date());
      await setDoc(doc(db, "settings", "availability"), {
        enabled,
        weekly,
        blockedDates: blocked.filter((b) => b >= today).sort(),
        allowCustomTimes: allowCustom,
        updatedAt: serverTimestamp(),
      });
      onSaved();
    } catch {
      setError("Could not save your availability. Please try again.");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] flex items-start sm:items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-[680px] shadow-2xl my-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between px-7 py-5 border-b border-[#E5E7EB]">
          <div>
            <h3 className="text-2xl font-bold text-[#111827]">{t("avail.title")}</h3>
            <p className="text-sm text-[#6B7280] mt-0.5">{t("avail.subtitle")}</p>
          </div>
          <button onClick={onClose} className="text-[#6B7280] hover:text-[#111827]" aria-label={t("common.close")}><X size={20} /></button>
        </div>

        <div className="px-7 py-6 space-y-6 max-h-[68vh] overflow-y-auto">
          {/* Weekly schedule on/off */}
          <div className="flex items-start justify-between gap-4 bg-[#F8FAFC] rounded-xl p-4">
            <div>
              <p className="font-semibold text-[#111827]">{t("avail.weekly")}</p>
              <p className="text-sm text-[#6B7280]">
                {enabled
                  ? t("avail.weeklyOn")
                  : t("avail.weeklyOff", { times: SLOT_TIMES.map(formatTime12).join(", ") })}
              </p>
            </div>
            <Switch checked={enabled} onChange={setEnabled} label={t("avail.weekly")} />
          </div>

          {enabled && (
            <div className="space-y-3">
              {DAYS.map((name, d) => {
                const times = weekly[String(d)] ?? [];
                const open = times.length > 0;
                return (
                  <div key={name} className={`rounded-xl border p-4 transition-colors ${open ? "border-[#E5E7EB]" : "border-dashed border-[#E5E7EB] bg-[#FAFAFA]"}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Switch checked={open} onChange={(v) => setDay(d, v ? [...SLOT_TIMES] : [])} label={t("avail.availableOn", { day: dayName(d) })} />
                        <p className={`font-semibold ${open ? "text-[#111827]" : "text-[#9CA3AF]"}`}>{dayName(d)}</p>
                        {!open && <span className="text-xs text-[#9CA3AF]">{t("calendar.notAvailable")}</span>}
                      </div>
                      {open && (
                        <button type="button" onClick={() => copyToAll(d)} className="flex items-center gap-1 text-xs font-semibold text-[#1B2E6B] hover:underline">
                          <Copy size={12} /> {t("avail.copy")}
                        </button>
                      )}
                    </div>
                    {open && (
                      <div className="flex flex-wrap items-center gap-2 mt-3">
                        {times.map((t) => (
                          <span key={t} className="flex items-center gap-1 pl-3 pr-1.5 py-1.5 rounded-lg bg-[#EEF1F8] text-sm text-[#1B2E6B] font-medium">
                            {formatTime12(t)}
                            <button type="button" onClick={() => setDay(d, times.filter((x) => x !== t))} className="p-0.5 rounded hover:bg-white" aria-label={`Remove ${formatTime12(t)}`}><X size={12} /></button>
                          </span>
                        ))}
                        <div className="flex items-center gap-1">
                          <input type="time" value={adding[d] ?? ""} onChange={(e) => setAdding((a) => ({ ...a, [d]: e.target.value }))}
                            className="px-2 py-1.5 rounded-lg border border-[#E5E7EB] text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2E6B]/15" aria-label={`Add time on ${name}`} />
                          <button type="button" onClick={() => addTime(d)} disabled={!adding[d]}
                            className="p-1.5 rounded-lg bg-[#1B2E6B] text-white disabled:opacity-40" aria-label={t("avail.addTime")}><Plus size={14} /></button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Blocked dates */}
          <div>
            <p className="flex items-center gap-2 font-semibold text-[#111827]"><CalendarOff size={16} className="text-[#1B2E6B]" /> {t("avail.daysOff")}</p>
            <p className="text-sm text-[#6B7280] mb-3">{t("avail.daysOffHint")}</p>
            <div className="flex gap-2">
              <input type="date" value={blockDate} min={toIsoDate(new Date())} onChange={(e) => setBlockDate(e.target.value)}
                className="px-3 py-2 rounded-lg border border-[#E5E7EB] text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2E6B]/15" />
              <button type="button" disabled={!blockDate}
                onClick={() => { setBlocked((b) => Array.from(new Set([...b, blockDate])).sort()); setBlockDate(""); }}
                className="px-4 rounded-lg bg-[#EEF1F8] text-sm font-semibold text-[#1B2E6B] disabled:opacity-40">{t("avail.addDayOff")}</button>
            </div>
            {blocked.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {blocked.map((b) => (
                  <span key={b} className="flex items-center gap-1 pl-3 pr-1.5 py-1 rounded-full bg-[#FEE2E2] text-[#B91C1C] text-xs font-semibold">
                    {new Date(`${b}T00:00`).toLocaleDateString(dateLocale(), { weekday: "short", month: "short", day: "numeric" })}
                    <button type="button" onClick={() => setBlocked((x) => x.filter((y) => y !== b))} aria-label={t("avail.removeDayOff")}><X size={12} /></button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Custom times */}
          <div className="flex items-start justify-between gap-4 bg-[#F8FAFC] rounded-xl p-4">
            <div>
              <p className="flex items-center gap-2 font-semibold text-[#111827]"><Clock size={16} className="text-[#1B2E6B]" /> {t("avail.custom")}</p>
              <p className="text-sm text-[#6B7280]">{t("avail.customHint")}</p>
            </div>
            <Switch checked={allowCustom} onChange={setAllowCustom} label={t("avail.custom")} />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="flex justify-end gap-3 px-7 py-5 bg-[#F9FAFB] rounded-b-2xl">
          <button onClick={onClose} className="px-6 py-2.5 rounded-xl border border-[#E5E7EB] font-semibold text-[#374151] hover:bg-white">{t("common.cancel")}</button>
          <button onClick={save} disabled={saving}
            className="px-8 py-2.5 rounded-xl bg-[#1B2E6B] text-white font-semibold hover:bg-[#162554] disabled:opacity-60">
            {saving ? t("common.saving") : t("avail.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
