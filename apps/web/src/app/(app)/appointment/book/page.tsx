"use client";
import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  collection, doc, documentId, getDoc, getDocs, query, where,
} from "firebase/firestore";
import { ChevronRight, FileText, CalendarDays, Clock, CheckCircle2, Lock, Printer, BadgeCheck } from "lucide-react";
import {
  db, useAuth, useAvailability, notify, bookAppointment, rescheduleAppointment, formatTime12, serviceLabel, serviceDescription,
  toIsoDate, slotId, slotsForDate, isDayClosed, SERVICE_TYPES, SESSION_MINUTES,
  type Appointment, type ServiceType,
} from "@/lib/firebase";
import { usePublicSettings } from "@/lib/publicSettings";
import { MiniCalendar } from "@/components/ui/MiniCalendar";
import { ServiceGlyph } from "../_components/shared";
import { useTranslation } from "@nablis/i18n";
import { dateLocale } from "@/lib/locale";

// The four main services first (as in the design), then the rest.
const SERVICES = SERVICE_TYPES.filter((s) => s.value !== "bible_study");

function Step({ n, title }: { n: number; title: string }) {
  return (
    <h2 className="flex items-center gap-3 text-xl font-semibold text-[#111827] mb-4">
      <span className="w-7 h-7 rounded-full bg-[#1B2E6B] text-white text-sm font-bold flex items-center justify-center">{n}</span>
      {title}
    </h2>
  );
}

function prettyDate(iso: string) {
  return new Date(`${iso}T00:00`).toLocaleDateString(dateLocale(), { weekday: "long", month: "short", day: "numeric", year: "numeric" });
}

function BookSession() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useSearchParams();
  const rescheduleId = params.get("reschedule");
  const { user } = useAuth();
  const { address } = usePublicSettings();

  const [original, setOriginal] = useState<Appointment | null>(null);
  const [service, setService]   = useState<ServiceType>("confession");
  const [date, setDate]         = useState<string>("");
  const [time, setTime]         = useState<string>("");
  const [note, setNote]         = useState("");
  const [taken, setTaken]       = useState<Set<string>>(new Set());
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [done, setDone]         = useState(false);
  const [customMode, setCustomMode] = useState(false);
  const [customTime, setCustomTime] = useState("");
  const { availability } = useAvailability();

  // Rescheduling: start from the existing booking.
  useEffect(() => {
    if (!rescheduleId) return;
    getDoc(doc(db, "appointments", rescheduleId)).then((s) => {
      if (!s.exists()) return;
      const a = { id: s.id, ...s.data() } as Appointment;
      setOriginal(a);
      setService(a.serviceType);
      setNote(a.privateNote ?? "");
    });
  }, [rescheduleId]);

  // Which slots are already booked on the chosen date.
  async function loadSlots(iso: string) {
    setLoadingSlots(true);
    try {
      const snap = await getDocs(query(
        collection(db, "appointmentSlots"),
        where(documentId(), ">=", `${iso}_`),
        where(documentId(), "<=", `${iso}_~`)
      ));
      setTaken(new Set(snap.docs.map((d) => d.id)));
    } finally {
      setLoadingSlots(false);
    }
  }

  useEffect(() => {
    if (!date) return;
    setTime("");
    setCustomMode(false);
    setCustomTime("");
    loadSlots(date);
  }, [date]);

  const now = new Date();
  const slots = date ? slotsForDate(availability, date) : [];
  const customAllowed = !!date && availability.allowCustomTimes && !isDayClosed(availability, date);
  const isPastSlot = (t: string) => date === toIsoDate(now) && new Date(`${date}T${t}`) <= now;
  const isTaken = (t: string) => taken.has(slotId(date, t)) && original?.slotId !== slotId(date, t);
  const customProblem = customMode && customTime
    ? isPastSlot(customTime) ? t("book.timePassed") : isTaken(customTime) ? t("book.timeTaken") : null
    : null;
  const canConfirm = !!date && !!time && !(customMode && (!customTime || customProblem));

  async function confirm() {
    if (!user || !canConfirm) return;
    setSubmitting(true);
    setError(null);
    try {
      if (original) {
        await rescheduleAppointment(original, date, time);
      } else {
        await bookAppointment({
          memberId: user.id,
          memberName: user.displayName || user.email,
          serviceType: service,
          isoDate: date,
          time,
          privateNote: note,
          customTime: customMode,
        });
      }
      const fathers = await getDocs(query(collection(db, "users"), where("role", "==", "super_admin")));
      await notify(fathers.docs.map((d) => ({
        userId: d.id,
        type: original ? "appointment_rescheduled" : "appointment_request",
        link: "/appointment",
        title: original ? "Appointment rescheduled" : "New appointment request",
        description: `${user.displayName || "A member"} ${original ? "moved" : "requested"} a ${serviceLabel(service)} session on ${prettyDate(date)} at ${formatTime12(time)}${customMode ? " (custom time request)" : ""}.`,
      })));
      setDone(true);
    } catch {
      setError(t("book.justTaken"));
      loadSlots(date);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1.5 text-sm">
        <Link href="/appointment" className="text-[#6B7280] hover:text-[#1B2E6B]">{t("nav.appointment")}</Link>
        <ChevronRight size={14} className="text-[#9CA3AF]" />
        <span className="text-[#1B2E6B] font-medium">{original ? t("book.reschedule") : t("appt.bookNew")}</span>
      </nav>
      <div>
        <h1 className="page-title-sm">{original ? t("book.rescheduleTitle") : t("book.title")}</h1>
        <p className="!text-[#6B7280]">{t("book.subtitle")}</p>
      </div>

      <div className="grid lg:grid-cols-[1fr_340px] gap-7 items-start">
        <div className="space-y-9">
          {/* 1. Service */}
          <section>
            <Step n={1} title={t("book.step1")} />
            <div className="grid sm:grid-cols-2 gap-4">
              {SERVICES.map((s) => {
                const active = service === s.value;
                return (
                  <button key={s.value} type="button" disabled={!!original}
                    onClick={() => setService(s.value)}
                    className={[
                      "text-left rounded-xl border p-5 transition-all",
                      active ? "bg-[#C3CBE3] border-[#1B2E6B] border-2 shadow-md" : "bg-white border-[#E5E7EB] hover:border-[#1B2E6B]/40 hover:-translate-y-0.5 hover:shadow-md",
                      original && !active ? "opacity-40 cursor-not-allowed hover:translate-y-0 hover:shadow-none" : "",
                    ].join(" ")}>
                    <span className={`w-11 h-11 rounded-lg flex items-center justify-center mb-4 ${active ? "bg-[#1B2E6B] text-white" : "bg-[#EEF1F8] text-[#1B2E6B]"}`}>
                      <ServiceGlyph value={s.value} size={20} />
                    </span>
                    <p className="text-[17px] font-semibold text-[#111827]">{serviceLabel(s.value)}</p>
                    <p className="text-sm text-[#6B7280] mt-1">{serviceDescription(s.value)}</p>
                  </button>
                );
              })}
            </div>
          </section>

          {/* 2. Date & time */}
          <section>
            <Step n={2} title={t("book.step2")} />
            <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm grid sm:grid-cols-[1fr_230px] gap-6 p-5">
              <MiniCalendar selected={date} onSelect={setDate} disablePast
                isDisabled={(iso) => isDayClosed(availability, iso)}
                className="!border-0 !shadow-none !p-0" />
              <div>
                <p className="text-sm font-medium text-[#4B5563] mb-3">
                  {date ? t("book.slotsFor", { date: new Date(`${date}T00:00`).toLocaleDateString(dateLocale(), { month: "short", day: "numeric" }) }) : t("book.pickDate")}
                </p>
                {date && slots.length === 0 && !customAllowed && (
                  <p className="text-xs text-[#B45309]">{t("book.closedDay")}</p>
                )}
                <div className="grid grid-cols-2 gap-2.5">
                  {slots.map((t) => {
                    const unavailable = isPastSlot(t) || isTaken(t);
                    const active = !customMode && time === t;
                    return (
                      <button key={t} type="button" disabled={unavailable || loadingSlots}
                        onClick={() => { setCustomMode(false); setTime(t); }}
                        className={[
                          "py-2.5 rounded-lg border text-sm transition-all",
                          active ? "bg-[#C3CBE3] border-[#1B2E6B] border-2 font-semibold text-[#1B2E6B]" : "bg-white border-[#E5E7EB] text-[#111827] hover:border-[#1B2E6B]/40",
                          unavailable ? "!bg-[#F3F4F6] !text-[#C0C4CC] line-through cursor-not-allowed hover:!border-[#E5E7EB]" : "",
                        ].join(" ")}>
                        {formatTime12(t)}
                      </button>
                    );
                  })}
                </div>
                {date && !loadingSlots && slots.length > 0 && slots.every((t) => isPastSlot(t) || isTaken(t)) && (
                  <p className="text-xs text-[#B45309] mt-3">{t("book.allTaken")} {customAllowed ? t("book.requestBelow") : t("book.chooseAnother")}</p>
                )}

                {/* Custom time request */}
                {customAllowed && (
                  <div className={`mt-4 rounded-lg border p-3 transition-colors ${customMode ? "border-[#1B2E6B] bg-[#F5F7FC]" : "border-dashed border-[#D1D5DB]"}`}>
                    <label className="flex items-center gap-2 text-sm font-medium text-[#1B2E6B] cursor-pointer">
                      <input type="checkbox" checked={customMode} className="accent-[#1B2E6B]"
                        onChange={(e) => { setCustomMode(e.target.checked); setTime(e.target.checked ? customTime : ""); }} />
                      {t("book.differentTime")}
                    </label>
                    {customMode && (
                      <div className="mt-2.5 space-y-1.5">
                        <input type="time" value={customTime}
                          onChange={(e) => { setCustomTime(e.target.value); setTime(e.target.value); }}
                          className="w-full px-3 py-2 rounded-lg border border-[#E5E7EB] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2E6B]/15" />
                        {customProblem
                          ? <p className="text-[11px] text-[#B45309]">{customProblem}</p>
                          : <p className="text-[11px] text-[#6B7280]">{t("book.customNote")}</p>}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* 3. Notes */}
          <section>
            <Step n={3} title={t("book.step3")} />
            <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm p-5">
              <label className="block text-sm font-medium text-[#374151] mb-2">{t("book.noteLabel")}</label>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} disabled={!!original}
                placeholder={t("book.notePlaceholder")}
                className="w-full rounded-lg border border-[#E5E7EB] px-4 py-3 text-[15px] text-[#374151] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#1B2E6B]/15 resize-none disabled:bg-[#F9FAFB]" />
              <p className="flex items-center gap-1 text-[11px] text-[#9CA3AF] mt-2"><Lock size={11} /> {t("book.noteHint")}</p>
            </div>
          </section>
        </div>

        {/* Summary */}
        <aside className="bg-white rounded-2xl shadow-lg overflow-hidden lg:sticky lg:top-24" id="booking-summary">
          <div className="bg-[#1B2E6B] text-white px-6 py-5">
            <p className="text-lg font-semibold">{t("book.summary")}</p>
            <p className="text-sm text-white/70">{t("book.summaryHint")}</p>
          </div>
          <div className="px-6 py-5 space-y-4">
            {[
              { icon: FileText,     label: t("book.service"), value: serviceLabel(service), empty: false },
              { icon: CalendarDays, label: t("book.date"),    value: date ? prettyDate(date) : t("book.selectDate"), empty: !date },
              { icon: Clock,        label: customMode ? t("book.timeCustom") : t("book.time"), value: time ? t("book.timeValue", { time: formatTime12(time), mins: SESSION_MINUTES }) : t("book.selectTime"), empty: !time },
            ].map(({ icon: Icon, label, value, empty }) => (
              <div key={label} className="flex items-start gap-3">
                <span className="w-9 h-9 rounded-lg bg-[#EEF1F8] flex items-center justify-center text-[#1B2E6B]"><Icon size={17} /></span>
                <div>
                  <p className="text-[10px] font-bold tracking-widest text-[#6B7280]">{label}</p>
                  <p className={`text-[15px] font-semibold ${empty ? "text-[#9CA3AF]" : "text-[#111827]"}`}>{value}</p>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between border-t border-[#F3F4F6] pt-4 text-sm">
              <span className="text-[#6B7280]">{t("book.location")}</span>
              <span className="text-[#111827] font-medium text-right">{address}</span>
            </div>
            {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            <button onClick={confirm} disabled={!canConfirm || submitting}
              className="w-full flex items-center justify-center gap-2 bg-[#F5C518] text-[#1B2E6B] text-lg font-semibold py-3.5 rounded-xl shadow-[0_10px_24px_-12px_rgba(245,197,24,0.9)] hover:bg-[#e6b800] disabled:opacity-50 disabled:cursor-not-allowed">
              {submitting ? t("book.sending") : original ? t("book.confirmNew") : t("book.confirm")} <CheckCircle2 size={19} />
            </button>
            <p className="text-[11px] text-[#9CA3AF] text-center">{t("book.notified")}</p>
          </div>
        </aside>
      </div>

      {/* Success dialog */}
      {done && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-[600px] shadow-2xl text-center px-8 pt-9 pb-10">
            <span className="mx-auto w-20 h-20 rounded-full bg-[#F5C518] flex items-center justify-center shadow-[0_0_0_14px_rgba(245,197,24,0.18)] animate-pop">
              <BadgeCheck size={40} className="text-[#1B2E6B]" />
            </span>
            <p className="text-3xl font-bold text-[#111827] mt-8">{original ? t("book.sentReschedule") : t("book.sent")}</p>
            <p className="text-[#4B5563] mt-3 max-w-md mx-auto leading-relaxed">
              {t("book.sentBody")}
            </p>
            <div className="flex justify-center gap-3 mt-7">
              <button onClick={() => router.push("/appointment")}
                className="px-12 py-3 rounded-lg bg-[#1B2E6B] text-white font-semibold hover:bg-[#162554] shadow-md">{t("common.done")}</button>
              <button onClick={() => window.print()}
                className="flex items-center gap-2 px-6 py-3 rounded-lg border border-[#E5E7EB] font-semibold text-[#111827] hover:bg-[#EEF1F8]">
                <Printer size={16} /> {t("book.print")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BookSessionPage() {
  return (
    <Suspense fallback={null}>
      <BookSession />
    </Suspense>
  );
}
