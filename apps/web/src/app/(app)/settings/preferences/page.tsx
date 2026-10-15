"use client";
import React, { useEffect, useRef, useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { Check } from "lucide-react";
import { db, useAuth } from "@/lib/firebase";
import { useToast } from "@/components/ui/Toast";
import {
  applyDisplayPrefs, readDisplayPrefs, TEXT_SCALE_MAX, TEXT_SCALE_MIN, type Appearance,
} from "@/lib/preferences";
import { INPUT, SettingsPanel, Toggle } from "../_components/ui";
import { useTranslation } from "@nablis/i18n";

const TIMEZONES: { value: string; label: string }[] = [
  { value: "Asia/Dubai",          label: "(GMT+04:00) Dubai, Abu Dhabi" },
  { value: "Africa/Addis_Ababa",  label: "(GMT+03:00) Addis Ababa" },
  { value: "Asia/Riyadh",         label: "(GMT+03:00) Riyadh" },
  { value: "Europe/London",       label: "(GMT+00:00) London" },
  { value: "America/New_York",    label: "(GMT-05:00) Eastern Time (US & Canada)" },
  { value: "America/Los_Angeles", label: "(GMT-08:00) Pacific Time (US & Canada)" },
];

interface Prefs {
  language: "en" | "am";
  timezone: string;
  appearance: Appearance;
  highContrast: boolean;
  textScale: number;
}

function fromUser(user: unknown): Prefs {
  const p = ((user as { preferences?: Record<string, unknown> } | null)?.preferences ?? {});
  return {
    language: p.language === "am" ? "am" : "en",
    timezone: typeof p.timezone === "string" ? p.timezone : Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Dubai",
    ...readDisplayPrefs(user),
  };
}

// Small window mock-ups for the appearance cards.
function ThemePreview({ kind }: { kind: Appearance }) {
  const light = (
    <div className="absolute inset-0 bg-[#F9FAFB]">
      <div className="h-3 border-b border-[#E5E7EB] flex items-center gap-1 px-1.5"><span className="w-1 h-1 rounded-full bg-[#D1D5DB]" /><span className="w-1 h-1 rounded-full bg-[#D1D5DB]" /></div>
      <div className="absolute left-0 top-3 bottom-0 w-5 border-r border-[#E5E7EB]" />
      <div className="absolute left-8 right-3 top-6 h-1 rounded bg-[#E5E7EB]" />
      <div className="absolute left-8 right-10 top-9 h-1 rounded bg-[#E5E7EB]" />
    </div>
  );
  const dark = (
    <div className="absolute inset-0 bg-[#111827]">
      <div className="h-3 border-b border-white/10 flex items-center gap-1 px-1.5"><span className="w-1 h-1 rounded-full bg-white/30" /><span className="w-1 h-1 rounded-full bg-white/30" /></div>
      <div className="absolute left-0 top-3 bottom-0 w-5 border-r border-white/10" />
      <div className="absolute left-8 right-3 top-6 h-1 rounded bg-white/20" />
      <div className="absolute left-8 right-10 top-9 h-1 rounded bg-white/20" />
    </div>
  );
  return (
    <div className="relative h-20 rounded-lg overflow-hidden border border-[#E5E7EB]" data-keep-colors>
      {kind === "dark" ? dark : light}
      {kind === "system" && <div className="absolute inset-y-0 right-0 w-1/2 overflow-hidden"><div className="absolute inset-y-0 right-0 w-[200%]">{dark}</div></div>}
    </div>
  );
}

export default function PreferencesPage() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const toast = useToast();
  const [saved, setSaved] = useState<Prefs>(() => fromUser(user));
  const [prefs, setPrefs] = useState<Prefs>(saved);
  const [saving, setSaving] = useState(false);
  const savedRef = useRef(saved);
  savedRef.current = saved;

  useEffect(() => {
    if (!user) return;
    const p = fromUser(user);
    setSaved(p);
    setPrefs(p);
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Preview changes live; put the saved look back if the user leaves without saving.
  useEffect(() => { applyDisplayPrefs(prefs); }, [prefs.appearance, prefs.highContrast, prefs.textScale]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => applyDisplayPrefs(savedRef.current), []);

  if (!user) return null;
  const dirty = JSON.stringify(prefs) !== JSON.stringify(saved);
  const set = <K extends keyof Prefs>(k: K, v: Prefs[K]) => setPrefs((p) => ({ ...p, [k]: v }));

  async function save() {
    setSaving(true);
    try {
      await updateDoc(doc(db, "users", user!.id), {
        "preferences.language": prefs.language,
        "preferences.timezone": prefs.timezone,
        "preferences.appearance": prefs.appearance,
        "preferences.highContrast": prefs.highContrast,
        "preferences.textScale": prefs.textScale,
      });
      setSaved(prefs);
      toast({ message: t("prefs.saved") });
    } catch {
      toast({ message: t("prefs.saveError"), type: "error" });
    } finally {
      setSaving(false);
    }
  }

  const fill = ((prefs.textScale - TEXT_SCALE_MIN) / (TEXT_SCALE_MAX - TEXT_SCALE_MIN)) * 100;

  return (
    <SettingsPanel title={t("prefs.title")} saveLabel={t("prefs.save")} onSave={save} onCancel={() => setPrefs(saved)} saving={saving} dirty={dirty}>
      <div className="pb-6 border-b border-[#F3F4F6]">
        <p className="text-lg font-semibold text-[#111827]">{t("prefs.general")}</p>
        <p className="text-sm text-[#6B7280] mt-1">{t("prefs.generalHint")}</p>
      </div>

      <div className="grid md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-6 py-7 border-b border-[#F3F4F6]">
        <div>
          <p className="font-semibold text-[#111827]">{t("prefs.languageRegion")}</p>
          <p className="text-sm text-[#6B7280] mt-1">{t("prefs.languageRegionHint")}</p>
        </div>
        <div className="space-y-5">
          <div>
            <label className="block text-sm text-[#111827] mb-2">{t("prefs.language")}</label>
            <select value={prefs.language} onChange={(e) => set("language", e.target.value as Prefs["language"])} className={INPUT + " cursor-pointer"}>
              <option value="en">English (US)</option>
              <option value="am">አማርኛ (Amharic)</option>
            </select>
            {prefs.language === "am" && <p className="text-xs text-[#6B7280] mt-1.5">{t("prefs.amharicNote")}</p>}
          </div>
          <div>
            <label className="block text-sm text-[#111827] mb-2">{t("prefs.timezone")}</label>
            <select value={prefs.timezone} onChange={(e) => set("timezone", e.target.value)} className={INPUT + " cursor-pointer"}>
              {!TIMEZONES.some((t) => t.value === prefs.timezone) && <option value={prefs.timezone}>{prefs.timezone.replace(/_/g, " ")}</option>}
              {TIMEZONES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-6 py-7 border-b border-[#F3F4F6]">
        <div>
          <p className="font-semibold text-[#111827]">{t("prefs.appearance")}</p>
          <p className="text-sm text-[#6B7280] mt-1">{t("prefs.appearanceHint")}</p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {(["light", "dark", "system"] as Appearance[]).map((a) => (
            <button key={a} type="button" onClick={() => set("appearance", a)}
              className={`relative rounded-2xl border-2 p-1.5 pb-2.5 text-sm font-medium transition-all ${prefs.appearance === a ? "border-[#1E3A8A] shadow-[0_8px_20px_-12px_rgba(30,58,138,0.8)]" : "border-[#E5E7EB] hover:border-[#1E3A8A]/40"}`}>
              <ThemePreview kind={a} />
              <span className="block mt-2 text-[#111827]">{t(`prefs.${a}`)}</span>
              {prefs.appearance === a && <span className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-[#1E3A8A] text-white flex items-center justify-center animate-pop"><Check size={12} /></span>}
            </button>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-6 py-7 border-b border-[#F3F4F6]">
        <div>
          <p className="font-semibold text-[#111827]">{t("prefs.accessibility")}</p>
          <p className="text-sm text-[#6B7280] mt-1">{t("prefs.accessibilityHint")}</p>
        </div>
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-[#E5E7EB] px-5 py-4">
          <div>
            <p className="text-sm font-medium text-[#111827]">{t("prefs.highContrast")}</p>
            <p className="text-xs text-[#6B7280] mt-0.5">{t("prefs.highContrastHint")}</p>
          </div>
          <Toggle checked={prefs.highContrast} onChange={(v) => set("highContrast", v)} label={t("prefs.highContrast")} />
        </div>
      </div>

      <div className="pt-7">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-semibold text-[#111827] uppercase tracking-wide">{t("prefs.fontSize")}</p>
            <p className="text-xs text-[#6B7280] mt-1">{t("prefs.fontSizeHint")}</p>
          </div>
          <span className="text-sm font-semibold text-[#111827]">{prefs.textScale}%</span>
        </div>
        <input type="range" min={TEXT_SCALE_MIN} max={TEXT_SCALE_MAX} step={5} value={prefs.textScale}
          onChange={(e) => set("textScale", Number(e.target.value))} aria-label={t("prefs.fontSize")}
          className="w-full mt-4 h-2 rounded-full appearance-none cursor-pointer accent-[#1E3A8A]"
          style={{ background: `linear-gradient(to right, #1E3A8A ${fill}%, #E5E7EB ${fill}%)` }} />
        <div className="flex justify-between text-[11px] text-[#9CA3AF] mt-2">
          <span>{t("prefs.smaller")}</span>
          <button type="button" onClick={() => set("textScale", 100)} className="hover:text-[#1E3A8A]">{t("prefs.default")}</button>
          <span>{t("prefs.larger")}</span>
        </div>
      </div>
    </SettingsPanel>
  );
}
