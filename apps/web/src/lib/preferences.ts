"use client";
import { useEffect, useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db, useAuth } from "@/lib/firebase";
import i18n, { changeLanguage, type SupportedLanguage } from "@nablis/i18n";
import { setServiceLocalizer, setSharedTranslator } from "@/lib/firebase";

// Strings from @nablis/shared (presence labels…) use the app translations.
setSharedTranslator((key, vars) => (i18n.exists(key) ? i18n.t(key, vars) : undefined));

// Service names (Confession, Counseling…) follow the interface language.
setServiceLocalizer((value, field) => (i18n.language === "am" ? i18n.t(`services.${value}.${field}`, { defaultValue: "" }) || undefined : undefined));

export type Appearance = "light" | "dark" | "system";

export interface DisplayPrefs {
  appearance: Appearance;
  highContrast: boolean;
  /** Text size in percent of the default (100). */
  textScale: number;
}

export const DEFAULT_DISPLAY: DisplayPrefs = { appearance: "light", highContrast: false, textScale: 100 };
export const TEXT_SCALE_MIN = 80;
export const TEXT_SCALE_MAX = 130;

export function readDisplayPrefs(user: unknown): DisplayPrefs {
  const p = ((user as { preferences?: Record<string, unknown> } | null)?.preferences ?? {});
  const scale = typeof p.textScale === "number" ? p.textScale : 100;
  return {
    appearance: p.appearance === "dark" || p.appearance === "system" ? p.appearance : "light",
    highContrast: p.highContrast === true,
    textScale: Math.min(TEXT_SCALE_MAX, Math.max(TEXT_SCALE_MIN, scale)),
  };
}

function prefersDark() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** Applies display preferences to the page (dark colours live in app/dark-theme.css). */
export function applyDisplayPrefs(p: DisplayPrefs) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const dark = p.appearance === "dark" || (p.appearance === "system" && prefersDark());
  root.classList.toggle("theme-dark", dark);
  root.style.filter = p.highContrast ? "contrast(1.18)" : "";
  root.style.fontSize = p.textScale === 100 ? "" : `${p.textScale}%`;
}

/** Header shortcuts: switch language and light/dark without opening Settings. */
export function useQuickPrefs() {
  const { user } = useAuth();
  const prefs = readDisplayPrefs(user);
  const language: SupportedLanguage = (user as { preferences?: { language?: string } } | null)?.preferences?.language === "am" ? "am" : "en";
  const [systemDark, setSystemDark] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemDark(mq.matches);
    const onChange = () => setSystemDark(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const isDark = prefs.appearance === "dark" || (prefs.appearance === "system" && systemDark);

  const save = (data: Record<string, unknown>) => {
    if (user) updateDoc(doc(db, "users", user.id), data).catch(() => {});
  };

  return {
    language,
    isDark,
    setLanguage(l: SupportedLanguage) {
      if (l === language) return;
      changeLanguage(l); // switch right away; the saved value follows
      save({ "preferences.language": l });
    },
    toggleTheme() {
      const appearance: Appearance = isDark ? "light" : "dark";
      applyDisplayPrefs({ ...prefs, appearance });
      save({ "preferences.appearance": appearance });
    },
  };
}

/** Keeps the signed-in user's saved display preferences applied. */
export function useDisplayPrefs() {
  const { user } = useAuth();
  const prefs = readDisplayPrefs(user);
  const key = JSON.stringify(prefs);

  useEffect(() => {
    applyDisplayPrefs(prefs);
    if (prefs.appearance !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyDisplayPrefs(prefs);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  // Interface language (Settings › Preferences).
  const language: SupportedLanguage = (user as { preferences?: { language?: string } } | null)?.preferences?.language === "am" ? "am" : "en";
  useEffect(() => {
    changeLanguage(language);
    document.documentElement.lang = language;
  }, [language]);

  // Reset when leaving the app (e.g. signing out to the public site).
  useEffect(() => () => {
    applyDisplayPrefs(DEFAULT_DISPLAY);
    changeLanguage("en");
    document.documentElement.lang = "en";
  }, []);
}
