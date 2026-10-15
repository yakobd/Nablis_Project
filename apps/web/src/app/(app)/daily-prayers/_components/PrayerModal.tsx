"use client";
import React, { useState } from "react";
import { addDoc, collection, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { PencilLine, Clock, BookOpen, PlusCircle, Save } from "lucide-react";
import { db, prayerName, type DailyPrayer } from "@/lib/firebase";
import { useTranslation } from "@nablis/i18n";

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
const MINUTES = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];

const FIELD = "w-full px-4 py-3 rounded-xl border border-[#E5E7EB] text-[15px] text-[#111827] placeholder-[#9CA3AF] bg-white focus:outline-none focus:ring-2 focus:ring-[#1B2E6B]/15 focus:border-[#1B2E6B]";
const LABEL = "flex items-center gap-2 text-sm font-semibold text-[#111827] mb-2";

function to12(time: string) {
  const [h, m] = time.split(":").map(Number);
  return { hour: String(((h + 11) % 12) + 1).padStart(2, "0"), minute: String(m).padStart(2, "0"), ampm: h < 12 ? "AM" : "PM" };
}
function to24(hour: string, minute: string, ampm: string) {
  let h = Number(hour) % 12;
  if (ampm === "PM") h += 12;
  return `${String(h).padStart(2, "0")}:${minute}`;
}

// "Add New Prayer Reminder" dialog from the design; also used for editing.
export function PrayerModal({
  prayer, onClose, onSaved,
}: {
  prayer?: DailyPrayer | null;
  onClose: () => void;
  onSaved: (p: DailyPrayer) => void;
}) {
  const { t } = useTranslation();
  const isNew = !prayer;
  const start = to12(prayer?.time ?? "05:30");
  const [name, setName]     = useState(prayer ? prayerName(prayer) : "");
  const [hour, setHour]     = useState(start.hour);
  const [minute, setMinute] = useState(MINUTES.includes(start.minute) ? start.minute : "00");
  const [ampm, setAmpm]     = useState(start.ampm);
  const [message, setMessage] = useState(prayer?.message ?? "");
  const [verse, setVerse]   = useState(prayer?.bibleVerse ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  async function save() {
    if (!name.trim() || !message.trim()) {
      setError(t("prayModal.needFields"));
      return;
    }
    setSaving(true);
    try {
      const data = {
        name: name.trim(),
        time: to24(hour, minute, ampm),
        message: message.trim(),
        bibleVerse: verse.trim(),
      };
      if (isNew) {
        const ref = await addDoc(collection(db, "dailyPrayers"), { ...data, enabled: true, createdAt: serverTimestamp() });
        onSaved({ id: ref.id, ...data, enabled: true } as DailyPrayer);
      } else {
        await updateDoc(doc(db, "dailyPrayers", prayer!.id), data);
        onSaved({ ...prayer!, ...data });
      }
      onClose();
    } catch {
      setError(t("prayersPage.saveError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-[580px] shadow-2xl px-9 py-8" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-3xl font-bold text-[#111827] mb-7">{isNew ? t("prayModal.addTitle") : t("prayModal.editTitle")}</h3>

        <div className="space-y-6">
          <div>
            <label className={LABEL}><PencilLine size={15} className="text-[#1B2E6B]" /> {t("prayModal.name")}</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Midnight Vigil" className={FIELD} />
          </div>

          <div>
            <label className={LABEL}><Clock size={15} className="text-[#1B2E6B]" /> {t("prayModal.time")}</label>
            <div className="grid grid-cols-3 gap-3">
              <select value={hour} onChange={(e) => setHour(e.target.value)} className={FIELD} aria-label={t("prayModal.hour")}>
                {HOURS.map((h) => <option key={h}>{h}</option>)}
              </select>
              <select value={minute} onChange={(e) => setMinute(e.target.value)} className={FIELD} aria-label={t("prayModal.minute")}>
                {MINUTES.map((m) => <option key={m}>{m}</option>)}
              </select>
              <select value={ampm} onChange={(e) => setAmpm(e.target.value)} className={FIELD + " font-semibold"} aria-label={t("prayModal.ampm")}>
                <option>AM</option><option>PM</option>
              </select>
            </div>
            <p className="text-xs text-[#9CA3AF] mt-2">{t("prayModal.timeHint")}</p>
          </div>

          <div>
            <label className={LABEL}><BookOpen size={15} className="text-[#1B2E6B]" /> {t("prayModal.message")}</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4}
              placeholder={t("prayModal.messagePlaceholder")} className={FIELD + " resize-none"} />
            <input value={verse} onChange={(e) => setVerse(e.target.value)} placeholder={t("prayModal.refPlaceholder")}
              className={FIELD + " mt-3 text-sm py-2.5"} />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={onClose} className="px-7 py-3 rounded-xl border border-[#E5E7EB] font-semibold text-[#374151] hover:bg-[#F9FAFB]">{t("common.cancel")}</button>
            <button onClick={save} disabled={saving}
              className="flex items-center gap-2 px-8 py-3 rounded-xl bg-[#1B2E6B] text-white font-semibold hover:bg-[#162554] shadow-[0_10px_24px_-12px_rgba(27,46,107,0.8)] disabled:opacity-60">
              {isNew ? <PlusCircle size={18} /> : <Save size={18} />}
              {saving ? t("common.saving") : isNew ? t("prayModal.create") : t("prefs.save")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
