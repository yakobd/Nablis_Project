"use client";
import React, { useRef, useState } from "react";
import {
  addDoc, collection, deleteDoc, doc, getDocs, query, serverTimestamp, Timestamp, updateDoc, where,
} from "firebase/firestore";
import { X, CalendarDays, Clock, Paperclip } from "lucide-react";
import {
  db, notify, eventRange, EVENT_CATEGORIES, EVENT_REMINDERS, PAYMENT_MODES,
  type EventDoc, type EventReminder, type PaymentMode,
} from "@/lib/firebase";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { useTranslation } from "@nablis/i18n";
import { dateLocale } from "@/lib/locale";

const FIELD = "w-full px-4 py-3 rounded-lg bg-[#F8FAFC] border border-[#E5E7EB] text-sm text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#1B2E6B]/15 focus:border-[#1B2E6B]";
const LABEL = "block text-[13px] font-semibold tracking-wider text-[#111827] uppercase mb-2";
const DURATIONS = [1, 2, 3, 4, 5, 7, 10, 14];

function isoDay(ts?: Timestamp | null) {
  const d = ts?.toDate?.();
  if (!d) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function EventFormModal({
  initial, onClose, onSaved,
}: {
  initial: EventDoc | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const { t } = useTranslation();
  const isNew = !initial;
  const [title, setTitle]       = useState(initial?.title ?? "");
  const [description, setDesc]  = useState(initial?.description ?? "");
  const [category, setCategory] = useState(initial?.category ?? EVENT_CATEGORIES[1]);
  const [date, setDate]         = useState(isoDay(initial?.startDate));
  const [fullDay, setFullDay]   = useState(!initial?.time);
  const [time, setTime]         = useState(initial?.time || "18:00");
  const [duration, setDuration] = useState(initial?.durationDays ?? 1);
  const [location, setLocation] = useState(initial?.location ?? "");
  const [room, setRoom]         = useState(initial?.meetingRoom ?? "");
  const [showRoom, setShowRoom] = useState(!!initial?.meetingRoom);
  const [guest, setGuest]       = useState("");
  const [guests, setGuests]     = useState<string[]>(initial?.guestEmails ?? []);
  const [mode, setMode]         = useState<PaymentMode>(initial?.paymentMode ?? (initial?.volunteer ? "volunteer" : initial?.price ? "cash" : "free"));
  const [price, setPrice]       = useState(initial?.price ? String(initial.price) : "");
  const [reminder, setReminder] = useState<EventReminder>(initial?.reminder ?? "1d");
  const [featured, setFeatured] = useState(!!initial?.featured);
  const [poster, setPoster]     = useState<string>(initial?.imageURL ?? "");
  const [attachments, setAttachments] = useState(initial?.attachments ?? []);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const preview = date ? eventRange({
    id: "", title, startDate: Timestamp.fromDate(new Date(`${date}T00:00`)), time: fullDay ? "" : time, durationDays: duration,
  }) : null;
  const fmt = (d: Date) => d.toLocaleDateString(dateLocale(), { month: "long", day: "numeric", year: "numeric" });
  const fmtT = (d: Date) => d.toLocaleTimeString(dateLocale(), { hour: "numeric", minute: "2-digit" });

  function addGuest() {
    const email = guest.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError(t("evForm.badEmail")); return; }
    if (!guests.includes(email)) setGuests((g) => [...g, email]);
    setGuest("");
    setError(null);
  }

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const f of Array.from(files)) {
        const url = await uploadToCloudinary(f, "nablis/events");
        if (f.type.startsWith("image/") && !poster) setPoster(url);
        else setAttachments((a) => [...a, { name: f.name, url }]);
      }
    } catch {
      setError(t("gal.uploadError"));
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!title.trim() || !date) { setError(t("evForm.required")); return; }
    setSaving(true);
    setError(null);
    try {
      const start = Timestamp.fromDate(new Date(`${date}T00:00`));
      const range = preview!;
      const payload = {
        title: title.trim(),
        description: description.trim(),
        category,
        startDate: start,
        endDate: Timestamp.fromDate(range.end),
        time: fullDay ? "" : time,
        durationDays: duration,
        location: location.trim(),
        meetingRoom: showRoom ? room.trim() : "",
        guestEmails: guests,
        paymentMode: mode,
        price: mode === "cash" || mode === "donation" ? Number(price) || 0 : 0,
        free: mode === "free",
        volunteer: mode === "volunteer",
        reminder,
        featured,
        imageURL: poster,
        attachments,
        updatedAt: serverTimestamp(),
      };
      if (isNew) {
        await addDoc(collection(db, "events"), { ...payload, createdAt: serverTimestamp() });
        const members = await getDocs(query(collection(db, "users"), where("status", "==", "active"), where("role", "==", "member")));
        await notify(members.docs.map((m) => ({
          userId: m.id, type: "new_event", link: "/events",
          title: `New Event: ${payload.title}`,
          description: `${fmt(range.start)}${payload.location ? ` · ${payload.location}` : ""}`,
        })));
        onSaved(t("evForm.created"));
      } else {
        await updateDoc(doc(db, "events", initial!.id), payload);
        onSaved(t("evForm.updated"));
      }
    } catch {
      setError(t("evForm.saveError"));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!initial) return;
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setSaving(true);
    try {
      await deleteDoc(doc(db, "events", initial.id));
      onSaved(t("evForm.deleted"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] flex items-start sm:items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-[600px] shadow-2xl my-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-7 py-5 border-b border-[#E5E7EB]">
          <h3 className="text-2xl font-bold text-[#111827]">{isNew ? t("events.create") : t("evForm.update")}</h3>
          <button onClick={onClose} className="text-[#6B7280] hover:text-[#111827]" aria-label={t("common.close")}><X size={20} /></button>
        </div>

        <div className="px-7 py-6 space-y-5 max-h-[70vh] overflow-y-auto">
          <div>
            <label className={LABEL}>{t("evForm.name")}</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("evForm.namePlaceholder")} className={FIELD} />
          </div>
          <div>
            <label className={LABEL}>{t("evForm.description")}</label>
            <textarea value={description} onChange={(e) => setDesc(e.target.value)} rows={2} placeholder={t("evForm.description")} className={FIELD + " resize-none"} />
          </div>
          <div>
            <label className={LABEL}>{t("events.category")}</label>
            <div className="flex flex-wrap gap-2">
              {EVENT_CATEGORIES.map((c) => (
                <button key={c} type="button" onClick={() => setCategory(c)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${category === c ? "bg-[#1B2E6B] text-white border-[#1B2E6B]" : "bg-white text-[#374151] border-[#E5E7EB] hover:border-[#1B2E6B]/40"}`}>
                  {t(`eventCat.${c}`, { defaultValue: c })}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={LABEL}>{t("events.date")}</label>
              <div className="relative">
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={FIELD + " pr-9"} />
                <CalendarDays size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] pointer-events-none" />
              </div>
            </div>
            <div>
              <label className={LABEL}>{t("apptAdmin.time")}</label>
              <div className="relative">
                {fullDay ? (
                  <button type="button" onClick={() => setFullDay(false)} className={FIELD + " text-left"}>{t("events.fullDay")}</button>
                ) : (
                  <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={FIELD} />
                )}
                <Clock size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] pointer-events-none" />
              </div>
              <button type="button" onClick={() => setFullDay((v) => !v)} className="text-[11px] text-[#1B2E6B] font-semibold mt-1 hover:underline">
                {fullDay ? t("evForm.setStart") : t("evForm.makeFullDay")}
              </button>
            </div>
            <div>
              <label className={LABEL}>{t("evForm.duration")}</label>
              <select value={duration} onChange={(e) => setDuration(Number(e.target.value))} className={FIELD}>
                {DURATIONS.map((d) => <option key={d} value={d}>{t("events.days", { count: d })}</option>)}
              </select>
            </div>
          </div>
          <p className="text-xs text-[#374151] -mt-2">
            {preview
              ? <>{t("evForm.previewStart")} {fmt(preview.start)}{duration > 1 ? ` – ${fmt(preview.end)}` : ""} {t("evForm.previewFrom", { from: fmtT(preview.start), to: fmtT(preview.end) })}</>
              : t("evForm.pickDate")}
          </p>

          <div>
            <label className={LABEL}>{t("evForm.location")}</label>
            <div className="relative">
              <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder={t("evForm.locationPlaceholder")} className={FIELD + " pr-36"} />
              <button type="button" onClick={() => setShowRoom((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-md bg-white border border-[#E5E7EB] text-[11px] font-semibold text-[#1B2E6B] hover:bg-[#EEF1F8]">
                {showRoom ? t("evForm.removeRoom") : t("evForm.setRoom")}
              </button>
            </div>
            {showRoom && (
              <input value={room} onChange={(e) => setRoom(e.target.value)} placeholder={t("evForm.roomPlaceholder")} className={FIELD + " mt-2"} />
            )}
          </div>

          <div>
            <label className={LABEL}>{t("evForm.guests")}</label>
            <div className="flex gap-2">
              <input value={guest} onChange={(e) => setGuest(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addGuest(); } }}
                placeholder="contact@example.com" className={FIELD} />
              <button type="button" onClick={addGuest} className="px-6 rounded-lg bg-[#EEF1F8] text-[#1B2E6B] font-semibold hover:bg-[#dde3f0]">{t("challenge.add")}</button>
            </div>
            {guests.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {guests.map((g) => (
                  <span key={g} className="flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-full bg-[#EEF1F8] text-xs text-[#1B2E6B]">
                    {g}
                    <button type="button" onClick={() => setGuests((x) => x.filter((y) => y !== g))} aria-label={`Remove ${g}`}><X size={12} /></button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>{t("evForm.price")}</label>
              <div className="flex rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] overflow-hidden">
                <select value={mode} onChange={(e) => setMode(e.target.value as PaymentMode)}
                  className="bg-white border-r border-[#E5E7EB] px-3 text-sm text-[#1B2E6B] font-semibold focus:outline-none">
                  {PAYMENT_MODES.map((m) => <option key={m.value} value={m.value}>{t(`payMode.${m.value}`)}</option>)}
                </select>
                <input value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ""))}
                  disabled={mode === "free" || mode === "volunteer"} placeholder={t("challenge.amount")}
                  className="flex-1 min-w-0 bg-transparent px-3 py-3 text-sm focus:outline-none disabled:text-[#9CA3AF]" />
              </div>
            </div>
            <div>
              <label className={LABEL}>{t("evForm.reminder")}</label>
              <select value={reminder} onChange={(e) => setReminder(e.target.value as EventReminder)} className={FIELD}>
                {EVENT_REMINDERS.map((r) => <option key={r.value} value={r.value}>{t(`evReminder.${r.value}`)}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className={LABEL}>{t("evForm.attachments")}</label>
            <input ref={fileRef} type="file" multiple accept="image/*,.pdf" className="hidden" onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} />
            <div className="border-2 border-dashed border-[#E5E7EB] rounded-xl p-5 text-center">
              {(poster || attachments.length > 0) && (
                <div className="flex flex-wrap justify-center gap-3 mb-4">
                  {poster && (
                    <div className="relative">
                      <img src={poster} alt={t("evForm.poster")} className="h-24 rounded-lg object-cover shadow" />
                      <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-[#F5C518] text-[9px] font-bold text-[#1B2E6B]">{t("evForm.posterBadge")}</span>
                      <button type="button" onClick={() => setPoster("")} className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-[#111827] text-white flex items-center justify-center" aria-label={t("share.remove")}><X size={11} /></button>
                    </div>
                  )}
                  {attachments.map((a) => (
                    <span key={a.url} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#EEF1F8] text-xs text-[#1B2E6B] self-center">
                      <Paperclip size={12} /> {a.name}
                      <button type="button" onClick={() => setAttachments((x) => x.filter((y) => y.url !== a.url))} aria-label={`Remove ${a.name}`}><X size={12} /></button>
                    </span>
                  ))}
                </div>
              )}
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                className="px-5 py-2 rounded-lg bg-[#E5E7EB] text-sm font-semibold text-[#1B2E6B] hover:bg-[#D1D5DB] disabled:opacity-60">
                {uploading ? t("ann.uploading") : t("evForm.selectFiles")}
              </button>
              <p className="text-[11px] text-[#9CA3AF] mt-2">{t("evForm.posterHint")}</p>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-[#374151]">
            <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} className="accent-[#1B2E6B]" />
            Feature this event at the top of the Events page
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-4 px-7 py-5 bg-[#F9FAFB] rounded-b-2xl">
          {isNew ? (
            <button onClick={onClose} className="font-semibold text-[#1B2E6B] px-4">{t("common.cancel")}</button>
          ) : (
            <button onClick={remove} disabled={saving} className="font-semibold text-[#DC2626] px-4 hover:underline">
              {confirmDelete ? t("ann.confirmDelete") : t("evForm.delete")}
            </button>
          )}
          <button onClick={save} disabled={saving || uploading}
            className="px-9 py-3 rounded-xl bg-[#F5C518] text-[#111827] font-semibold shadow-[0_10px_24px_-12px_rgba(245,197,24,0.9)] hover:bg-[#e6b800] disabled:opacity-60">
            {saving ? t("common.saving") : isNew ? t("events.create") : t("evForm.update")}
          </button>
        </div>
      </div>
    </div>
  );
}
