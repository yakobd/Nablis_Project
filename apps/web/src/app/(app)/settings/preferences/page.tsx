"use client";
import React, { useEffect, useState } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db, useAuth } from "@/lib/firebase";
import { Sun, Moon, Monitor, CheckCircle, AlertCircle } from "lucide-react";

const TIMEZONES = [
  "Asia/Dubai",
  "Africa/Addis_Ababa",
  "Europe/London",
  "America/New_York",
  "America/Los_Angeles",
  "Asia/Riyadh",
];

type Appearance = "light" | "dark" | "system";

const APPEARANCE_OPTIONS: { value: Appearance; label: string; icon: React.ReactNode }[] = [
  { value: "light",  label: "Light",  icon: <Sun size={20} /> },
  { value: "dark",   label: "Dark",   icon: <Moon size={20} /> },
  { value: "system", label: "System", icon: <Monitor size={20} /> },
];

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-6">
      <div className="mb-5">
        <h2 className="text-[#1B2E6B] font-semibold text-sm">{title}</h2>
        {description && <p className="text-[#9CA3AF] text-xs mt-0.5">{description}</p>}
      </div>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={[
        "relative w-10 h-5 rounded-full transition-colors flex-shrink-0",
        checked ? "bg-[#1B2E6B]" : "bg-[#D1D5DB]",
      ].join(" ")}
    >
      <span
        className={[
          "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform",
          checked ? "translate-x-5" : "translate-x-0.5",
        ].join(" ")}
      />
    </button>
  );
}

const SELECT = "w-full px-4 py-2.5 rounded-xl border border-[#E5E7EB] text-sm text-[#374151] bg-white focus:outline-none focus:ring-2 focus:ring-[#1B2E6B]/20 focus:border-[#1B2E6B] transition-colors";

function applyAppearance(val: string) {
  if (typeof document === 'undefined') return;
  if (val === 'dark') document.documentElement.classList.add('dark');
  else if (val === 'light') document.documentElement.classList.remove('dark');
  else {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches)
      document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }
}
function applyFontSize(val: number) {
  if (typeof document === 'undefined') return;
  document.documentElement.style.fontSize = val + '%';
}
function applyHighContrast(val: boolean) {
  if (typeof document === 'undefined') return;
  if (val) document.documentElement.style.filter = 'contrast(1.2)';
  else document.documentElement.style.filter = '';
}

export default function PreferencesPage() {
  const { user } = useAuth();
  const [language, setLanguage]     = useState<"en" | "am">("en");
  const [timezone, setTimezone]     = useState("Asia/Dubai");
  const [appearance, setAppearance] = useState<Appearance>("system");
  const [highContrast, setHighContrast] = useState(false);
  const [fontSize, setFontSize]     = useState(80);
  const [saving, setSaving]         = useState(false);
  const [msg, setMsg]               = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, "users", user.id)).then((snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      const prefs = data?.preferences ?? {};
      if (prefs.language) setLanguage(prefs.language as "en" | "am");
      if (prefs.timezone) setTimezone(prefs.timezone as string);
      if (prefs.appearance) setAppearance(prefs.appearance as Appearance);
      if (typeof prefs.highContrast === 'boolean') setHighContrast(prefs.highContrast as boolean);
      if (typeof prefs.fontSize === 'number') setFontSize(prefs.fontSize as number);
      applyAppearance(prefs.appearance ?? 'system');
      applyFontSize(prefs.fontSize ?? 80);
      applyHighContrast(prefs.highContrast ?? false);
    });
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!user) return null;

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      await updateDoc(doc(db, "users", user!.id), {
        "preferences.language":    language,
        "preferences.timezone":    timezone,
        "preferences.appearance":  appearance,
        "preferences.highContrast": highContrast,
        "preferences.fontSize":    fontSize,
      });
      applyAppearance(appearance);
      applyFontSize(fontSize);
      applyHighContrast(highContrast);
      setMsg({ type: "ok", text: "Preferences saved successfully." });
    } catch {
      setMsg({ type: "err", text: "Failed to save. Please try again." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[#1B2E6B]">Preferences</h1>
        <p className="text-[#9CA3AF] text-sm mt-0.5">Customize your app experience</p>
      </div>

      {/* Language & Timezone */}
      <Section title="Language & Region">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#374151] mb-1.5">Language</label>
            <select value={language} onChange={(e) => setLanguage(e.target.value as "en" | "am")} className={SELECT}>
              <option value="en">English</option>
              <option value="am">አማርኛ (Amharic)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#374151] mb-1.5">Timezone</label>
            <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className={SELECT}>
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>{tz.replace("_", " ")}</option>
              ))}
            </select>
          </div>
        </div>
      </Section>

      {/* Appearance */}
      <Section title="Appearance" description="Choose how the app looks">
        <div className="grid grid-cols-3 gap-3">
          {APPEARANCE_OPTIONS.map(({ value, label, icon }) => (
            <button
              key={value}
              onClick={() => { setAppearance(value); applyAppearance(value); }}
              className={[
                "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                appearance === value
                  ? "border-[#1B2E6B] bg-[#EEF1F8]"
                  : "border-[#E5E7EB] hover:border-[#1B2E6B]/40",
              ].join(" ")}
            >
              <span className={appearance === value ? "text-[#1B2E6B]" : "text-[#9CA3AF]"}>{icon}</span>
              <span className={`text-xs font-semibold ${appearance === value ? "text-[#1B2E6B]" : "text-[#6B7280]"}`}>
                {label}
              </span>
            </button>
          ))}
        </div>
      </Section>

      {/* Accessibility */}
      <Section title="Accessibility">
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[#374151]">High Contrast Mode</p>
              <p className="text-xs text-[#9CA3AF] mt-0.5">Increase contrast for better readability</p>
            </div>
            <Toggle checked={highContrast} onChange={(v) => { setHighContrast(v); applyHighContrast(v); }} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-medium text-[#374151]">Font Size</p>
                <p className="text-xs text-[#9CA3AF] mt-0.5">Adjust text size across the app</p>
              </div>
              <span className="text-sm font-bold text-[#1B2E6B]">{fontSize}%</span>
            </div>
            <input
              type="range"
              min={70}
              max={120}
              step={5}
              value={fontSize}
              onChange={(e) => { setFontSize(Number(e.target.value)); applyFontSize(Number(e.target.value)); }}
              className="w-full accent-[#1B2E6B] cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-[#9CA3AF] mt-1">
              <span>Small (70%)</span>
              <span>Default (80%)</span>
              <span>Large (120%)</span>
            </div>
          </div>
        </div>
      </Section>

      {msg && (
        <div
          className={`flex items-center gap-2 text-sm px-4 py-3 rounded-xl ${
            msg.type === "ok" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
          }`}
        >
          {msg.type === "ok" ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
          {msg.text}
        </div>
      )}

      <button
        onClick={save}
        disabled={saving}
        className="flex items-center gap-2 bg-[#1B2E6B] text-white font-semibold px-5 py-2.5 rounded-xl hover:bg-[#162554] transition-colors disabled:opacity-60 text-sm"
      >
        {saving && <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
        Save Changes
      </button>
    </div>
  );
}
