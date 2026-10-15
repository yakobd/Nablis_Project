"use client";
import React, { useState } from "react";
import { BookOpen, Pencil, Quote, RotateCcw, X } from "lucide-react";
import { useAuth, useVerseOfDay, saveVerseOfDay, clearVerseOfDay, type Verse } from "@/lib/firebase";
import { useToast } from "@/components/ui/Toast";
import { useTranslation } from "@nablis/i18n";
import { dateLocale } from "@/lib/locale";

const FIELD = "w-full px-4 py-3 rounded-xl border border-[#E5E7EB] text-[15px] text-[#111827] placeholder-[#9CA3AF] bg-white focus:outline-none focus:ring-2 focus:ring-[#1B2E6B]/15 focus:border-[#1B2E6B]";

// The verse card exactly as members see it on their dashboard.
function VersePreview({ verse }: { verse: Verse }) {
  const { t } = useTranslation();
  return (
    <div className="rounded-2xl bg-[#1B2E6B] text-white px-7 py-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-[#F5C518]">{t("memberDash.verseOfDay")}</p>
      <p className="font-display text-xl font-bold mt-2 leading-snug">&ldquo;{verse.text || "…"}&rdquo;</p>
      <p className="text-white/70 mt-1.5 text-sm">{verse.ref || "—"}</p>
    </div>
  );
}

// Daily Prayers (staff): shows today's Verse of the Day and lets admins change it.
export function VerseOfDayEditor() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const toast = useToast();
  const { verse, custom, loading } = useVerseOfDay();
  const [editing, setEditing] = useState<Verse | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!editing || !user) return;
    if (!editing.text.trim() || !editing.ref.trim()) {
      toast({ type: "error", message: t("verseAdmin.needFields") });
      return;
    }
    setSaving(true);
    try {
      await saveVerseOfDay(editing, user);
      toast({ message: t("verseAdmin.saved") });
      setEditing(null);
    } catch {
      toast({ type: "error", message: t("verseAdmin.saveError") });
    } finally {
      setSaving(false);
    }
  }

  async function useRotation() {
    if (!confirm(t("verseAdmin.rotationConfirm"))) return;
    try {
      await clearVerseOfDay();
      toast({ message: t("verseAdmin.rotationOn") });
    } catch {
      toast({ type: "error", message: t("verseAdmin.saveError") });
    }
  }

  const updated = custom?.updatedAt?.toDate?.();

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <h2 className="text-2xl font-semibold text-[#111827]">{t("verseAdmin.title")}</h2>
          <p className="text-sm text-[#6B7280] mt-1">{t("verseAdmin.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          {custom && (
            <button onClick={useRotation}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#E5E7EB] bg-white text-sm font-semibold text-[#374151] hover:bg-[#F9FAFB]">
              <RotateCcw size={15} /> {t("verseAdmin.useRotation")}
            </button>
          )}
          <button onClick={() => setEditing({ text: custom?.text ?? "", ref: custom?.ref ?? "" })} disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#1E40AF] text-white font-semibold tracking-wide shadow hover:bg-[#1B2E6B] disabled:opacity-60">
            <Pencil size={15} /> {t("verseAdmin.edit")}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-5 grid md:grid-cols-[minmax(0,1fr)_260px] gap-5 items-center">
        <VersePreview verse={verse} />
        <div className="text-sm space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#9CA3AF]">{t("verseAdmin.source")}</p>
          {custom ? (
            <>
              <p className="font-semibold text-[#111827]">{t("verseAdmin.setByAdmin")}</p>
              <p className="text-[#6B7280]">
                {t("verseAdmin.updatedBy", {
                  name: custom.updatedByName || "—",
                  date: updated ? updated.toLocaleDateString(dateLocale(), { month: "short", day: "numeric", year: "numeric" }) : "—",
                })}
              </p>
              <p className="text-[#6B7280]">{t("verseAdmin.staysHint")}</p>
            </>
          ) : (
            <>
              <p className="font-semibold text-[#111827]">{t("verseAdmin.automatic")}</p>
              <p className="text-[#6B7280]">{t("verseAdmin.automaticHint")}</p>
            </>
          )}
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-2xl w-full max-w-[620px] shadow-2xl px-8 py-7 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xl font-semibold text-[#111827]">{t("verseAdmin.editTitle")}</p>
                <p className="text-sm text-[#6B7280] mt-1">{t("verseAdmin.editHint")}</p>
              </div>
              <button onClick={() => setEditing(null)} aria-label={t("common.close")} className="p-1.5 rounded-lg text-[#6B7280] hover:bg-[#F3F4F6]"><X size={18} /></button>
            </div>

            <div className="space-y-5 mt-6">
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-[#111827] mb-2"><Quote size={15} className="text-[#1B2E6B]" /> {t("verseAdmin.text")}</label>
                <textarea value={editing.text} onChange={(e) => setEditing({ ...editing, text: e.target.value })} rows={4} maxLength={400}
                  placeholder={t("verseAdmin.textPlaceholder")} className={FIELD + " resize-none"} autoFocus />
                <p className="text-[11px] text-[#9CA3AF] mt-1 text-right">{editing.text.length}/400</p>
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-[#111827] mb-2"><BookOpen size={15} className="text-[#1B2E6B]" /> {t("verseAdmin.ref")}</label>
                <input value={editing.ref} onChange={(e) => setEditing({ ...editing, ref: e.target.value })} maxLength={60}
                  placeholder={t("verseAdmin.refPlaceholder")} className={FIELD} />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-2">{t("verseAdmin.preview")}</p>
                <VersePreview verse={editing} />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-7">
              <button onClick={() => setEditing(null)} disabled={saving} className="px-5 py-2.5 rounded-xl border border-[#E5E7EB] text-sm font-semibold text-[#374151] hover:bg-[#F9FAFB]">{t("common.cancel")}</button>
              <button onClick={save} disabled={saving}
                className="px-6 py-2.5 rounded-xl bg-[#1E40AF] text-white text-sm font-semibold hover:bg-[#1B2E6B] disabled:opacity-60">
                {saving ? t("common.saving") : t("verseAdmin.publish")}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
