"use client";
import React from "react";
import { useTranslation } from "@nablis/i18n";

export const INPUT =
  "w-full px-4 py-3 rounded-xl border border-[#E5E7EB] text-sm text-[#111827] placeholder-[#9CA3AF] bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/15 focus:border-[#1E3A8A] transition-colors disabled:bg-[#F9FAFB] disabled:text-[#6B7280]";

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
      className={`relative w-[52px] h-7 rounded-full flex-shrink-0 transition-colors duration-200 ${checked ? "bg-[#1E3A8A]" : "bg-[#E5E7EB]"}`}>
      <span className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${checked ? "translate-x-6" : ""}`} />
    </button>
  );
}

/** The big white settings card: title, content, and a Cancel / Save footer. */
export function SettingsPanel({
  title, children, onSave, onCancel, saving, dirty = true, saveLabel,
}: {
  title: string;
  children: React.ReactNode;
  onSave?: () => void;
  onCancel?: () => void;
  saving?: boolean;
  dirty?: boolean;
  saveLabel?: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="bg-white rounded-3xl shadow-sm p-6 sm:p-10 animate-fade-up">
      <h2 className="font-display text-3xl font-bold text-[#111827]">{title}</h2>
      <div className="mt-8">{children}</div>
      {onSave && (
        <div className="flex items-center justify-end gap-4 border-t border-[#F3F4F6] mt-8 pt-6">
          {onCancel && (
            <button type="button" onClick={onCancel} disabled={saving || !dirty}
              className="px-5 py-3 text-sm font-semibold text-[#374151] hover:text-[#111827] disabled:opacity-40">
              {t("common.cancel")}
            </button>
          )}
          <button type="button" onClick={onSave} disabled={saving || !dirty}
            className="flex items-center gap-2 px-10 py-3.5 rounded-2xl bg-[#1E3A8A] text-white text-sm font-semibold shadow-[0_10px_24px_-12px_rgba(30,58,138,0.9)] hover:bg-[#1B2E6B] disabled:opacity-50">
            {saving && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
            {saveLabel ?? t("prefs.save")}
          </button>
        </div>
      )}
    </div>
  );
}

/** Two-column settings row: heading + description on the left, controls on the right. */
export function SettingsRow({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4 md:gap-10 py-6 border-b border-[#F3F4F6] last:border-0 first:pt-0">
      <div>
        <p className="font-semibold text-[#111827]">{title}</p>
        {description && <p className="text-sm text-[#6B7280] mt-1 leading-relaxed">{description}</p>}
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

export function ToggleLine({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 max-w-sm">
      <div>
        <p className="text-sm text-[#111827]">{label}</p>
        {hint && <p className="text-[11px] text-[#9CA3AF]">{hint}</p>}
      </div>
      <Toggle checked={checked} onChange={onChange} label={label} />
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-[#111827]">{label}</label>
      {hint && <p className="text-xs text-[#6B7280] mt-0.5">{hint}</p>}
      <div className="mt-2">{children}</div>
    </div>
  );
}
