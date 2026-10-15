"use client";
import React, { useMemo, useRef, useState } from "react";
import { collection, doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { X, Wand2, FileUp, ClipboardPaste, AlertTriangle, CheckCircle2 } from "lucide-react";
import {
  db, useAuth, generatePlan, parsePlanText, parseIso, type PlanTemplate, type ReadingEntry, type ReadingPlan,
} from "@/lib/firebase";
import { useToast } from "@/components/ui/Toast";
import { useTranslation } from "@nablis/i18n";
import { dateLocale } from "@/lib/locale";

type Source = "generate" | "file" | "paste";
const INPUT = "w-full px-4 py-3 rounded-xl border border-[#E5E7EB] text-sm text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/15 focus:border-[#1E3A8A]";

export function PlanUploadModal({ plans, onClose }: { plans: ReadingPlan[]; onClose: () => void }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(new Date().getMonth() >= 10 ? thisYear + 1 : thisYear);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [source, setSource] = useState<Source>("generate");
  const [template, setTemplate] = useState<PlanTemplate>("whole_bible");
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("");
  const [activate, setActivate] = useState(true);
  const [saving, setSaving] = useState(false);

  const result = useMemo<{ entries: ReadingEntry[]; errors: string[] }>(() => {
    if (source === "generate") return { entries: generatePlan(template, year), errors: [] };
    return text.trim() ? parsePlanText(text, year) : { entries: [], errors: [] };
  }, [source, template, year, text]);

  const defaultTitle = source === "generate"
    ? `${template === "whole_bible" ? t("planUpload.bibleYear") : t("planUpload.ntYear")} ${year}`
    : t("planUpload.defaultTitle", { year });

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (/\.xlsx?$/i.test(f.name)) {
      toast({ message: t("planUpload.saveAsCsv"), type: "error" });
      return;
    }
    setFileName(f.name);
    setText(await f.text());
  }

  async function save() {
    if (!user || result.entries.length === 0) return;
    setSaving(true);
    try {
      const batch = writeBatch(db);
      const ref = doc(collection(db, "readingPlans"));
      batch.set(ref, {
        title: title.trim() || defaultTitle,
        description: description.trim(),
        year,
        entries: result.entries,
        active: activate,
        createdBy: user.id,
        createdAt: serverTimestamp(),
      });
      // Members follow one plan at a time.
      if (activate) plans.filter((p) => p.active).forEach((p) => batch.update(doc(db, "readingPlans", p.id), { active: false }));
      await batch.commit();
      toast({ message: activate ? t("planUpload.published") : t("planUpload.saved") });
      onClose();
    } catch {
      toast({ message: t("planUpload.saveError"), type: "error" });
    } finally {
      setSaving(false);
    }
  }

  const tabCls = (on: boolean) => `flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${on ? "bg-white text-[#1E3A8A] shadow-sm" : "text-[#6B7280] hover:text-[#111827]"}`;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => !saving && onClose()}>
      <div className="bg-white rounded-3xl w-full max-w-2xl shadow-xl max-h-[92vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-7 pt-6 pb-4">
          <div>
            <p className="text-lg font-semibold text-[#111827]">{t("planUpload.title")}</p>
            <p className="text-sm text-[#6B7280]">{t("planUpload.subtitle")}</p>
          </div>
          <button onClick={onClose} aria-label={t("common.close")} className="p-1.5 rounded-lg text-[#6B7280] hover:bg-[#F3F4F6]"><X size={18} /></button>
        </div>

        <div className="px-7 pb-4 space-y-5 overflow-y-auto">
          <div className="grid sm:grid-cols-[1fr_140px] gap-4">
            <div>
              <label className="block text-sm text-[#111827] mb-2">{t("planUpload.titleLabel")}</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={defaultTitle} className={INPUT} />
            </div>
            <div>
              <label className="block text-sm text-[#111827] mb-2">{t("planAdmin.year")}</label>
              <select value={year} onChange={(e) => setYear(Number(e.target.value))} className={INPUT + " cursor-pointer"}>
                {[thisYear - 1, thisYear, thisYear + 1].map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm text-[#111827] mb-2">{t("planUpload.description")} <span className="text-[#9CA3AF]">({t("share.optional")})</span></label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("planUpload.descPlaceholder")} className={INPUT} />
          </div>

          <div className="flex gap-1 p-1 rounded-2xl bg-[#F3F4F6]">
            <button onClick={() => setSource("generate")} className={tabCls(source === "generate")}><Wand2 size={15} /> {t("planUpload.readyMade")}</button>
            <button onClick={() => setSource("file")} className={tabCls(source === "file")}><FileUp size={15} /> {t("planUpload.uploadCsv")}</button>
            <button onClick={() => setSource("paste")} className={tabCls(source === "paste")}><ClipboardPaste size={15} /> {t("planUpload.paste")}</button>
          </div>

          {source === "generate" && (
            <div className="grid sm:grid-cols-2 gap-3">
              {([
                ["whole_bible", t("planUpload.whole"), t("planUpload.wholeHint")],
                ["new_testament", t("planUpload.nt"), t("planUpload.ntHint")],
              ] as [PlanTemplate, string, string][]).map(([k, label, hint]) => (
                <button key={k} onClick={() => setTemplate(k)}
                  className={`text-left rounded-2xl border-2 p-4 transition-colors ${template === k ? "border-[#1E3A8A] bg-[#F5F7FF]" : "border-[#E5E7EB] hover:border-[#1E3A8A]/40"}`}>
                  <p className="font-semibold text-[#111827]">{label}</p>
                  <p className="text-xs text-[#6B7280] mt-1">{hint}</p>
                </button>
              ))}
            </div>
          )}

          {source === "file" && (
            <div>
              <button onClick={() => fileInput.current?.click()}
                className="w-full rounded-2xl border-2 border-dashed border-[#D1D5DB] hover:border-[#1E3A8A] hover:bg-[#F9FAFB] p-6 text-center transition-colors">
                <FileUp size={26} className="mx-auto text-[#1E3A8A]" />
                <p className="text-sm font-medium text-[#111827] mt-2">{fileName || t("planUpload.chooseCsv")}</p>
                <p className="text-xs text-[#6B7280] mt-1">{t("planUpload.columns")}</p>
              </button>
              <input ref={fileInput} type="file" accept=".csv,.txt,text/csv,text/plain,.xls,.xlsx" className="hidden" onChange={onFile} />
            </div>
          )}

          {source === "paste" && (
            <div>
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={7}
                placeholder={t("planUpload.pastePlaceholder")}
                className={INPUT + " font-mono text-xs leading-relaxed resize-y"} />
            </div>
          )}

          {/* Preview */}
          {(result.entries.length > 0 || result.errors.length > 0) && (
            <div className="rounded-2xl border border-[#E5E7EB] overflow-hidden animate-fade-up">
              {result.entries.length > 0 && (
                <div className="flex items-center gap-2 px-4 py-3 bg-[#F0FDF4] text-sm text-[#15803D]">
                  <CheckCircle2 size={16} /> {t("planUpload.dailyReadings", { n: result.entries.length })}, {parseIso(result.entries[0].date).toLocaleDateString(dateLocale(), { month: "short", day: "numeric" })} – {parseIso(result.entries[result.entries.length - 1].date).toLocaleDateString(dateLocale(), { month: "short", day: "numeric", year: "numeric" })}
                </div>
              )}
              {result.errors.length > 0 && (
                <div className="px-4 py-3 bg-[#FFFBEB] text-xs text-[#92400E] space-y-1">
                  <p className="flex items-center gap-1.5 font-semibold"><AlertTriangle size={14} /> {t("planUpload.skipped", { count: result.errors.length })}</p>
                  {result.errors.slice(0, 4).map((e) => <p key={e}>{e}</p>)}
                </div>
              )}
              {result.entries.length > 0 && (
                <div className="divide-y divide-[#F3F4F6] text-sm">
                  {result.entries.slice(0, 4).map((e) => (
                    <div key={e.date} className="flex justify-between gap-4 px-4 py-2">
                      <span className="text-[#6B7280]">{parseIso(e.date).toLocaleDateString(dateLocale(), { weekday: "short", month: "short", day: "numeric" })}</span>
                      <span className="text-[#111827] text-right">{e.reading}</span>
                    </div>
                  ))}
                  {result.entries.length > 4 && <p className="px-4 py-2 text-xs text-[#9CA3AF]">{t("planUpload.more", { n: result.entries.length - 4 })}</p>}
                </div>
              )}
            </div>
          )}

          <label className="flex items-center gap-3 text-sm text-[#374151] cursor-pointer">
            <input type="checkbox" checked={activate} onChange={(e) => setActivate(e.target.checked)} className="w-4 h-4 accent-[#1E3A8A]" />
            {t("planUpload.makeActive")}{plans.some((p) => p.active) ? t("planUpload.replaces") : ""}
          </label>
        </div>

        <div className="flex justify-end gap-3 px-7 py-5 border-t border-[#F3F4F6]">
          <button onClick={onClose} disabled={saving} className="px-5 py-2.5 text-sm font-semibold text-[#374151]">{t("common.cancel")}</button>
          <button onClick={save} disabled={saving || result.entries.length === 0}
            className="flex items-center gap-2 px-7 py-2.5 rounded-xl bg-[#1E3A8A] text-white text-sm font-semibold hover:bg-[#1B2E6B] disabled:opacity-50">
            {saving && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
            {activate ? t("planUpload.publish") : t("planUpload.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
