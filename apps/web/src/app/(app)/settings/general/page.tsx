"use client";
import React, { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db, useAuth } from "@/lib/firebase";
import { useToast } from "@/components/ui/Toast";
import { INPUT, SettingsPanel, SettingsRow } from "../_components/ui";
import { useTranslation } from "@nablis/i18n";

const LINK_FIELDS = [
  { key: "facebookUrl",  label: "Facebook",          placeholder: "https://facebook.com/…" },
  { key: "youtubeUrl",   label: "YouTube",           placeholder: "https://youtube.com/@…" },
  { key: "instagramUrl", label: "Instagram",         placeholder: "https://instagram.com/…" },
  { key: "telegramUrl",  label: "Telegram",          placeholder: "https://t.me/…" },
  { key: "playStoreUrl", label: "Google Play (app)", placeholder: "https://play.google.com/store/apps/details?id=com.nablis.app" },
  { key: "appStoreUrl",  label: "App Store (app)",   placeholder: "https://apps.apple.com/…" },
] as const;
type LinkKey = (typeof LINK_FIELDS)[number]["key"];

type General = {
  ministryName: string;
  description: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
} & Record<LinkKey, string>;

const EMPTY: General = {
  ministryName: "", description: "", contactEmail: "", contactPhone: "", address: "",
  ...(Object.fromEntries(LINK_FIELDS.map((f) => [f.key, ""])) as Record<LinkKey, string>),
};

export default function GeneralSettingsPage() {
  const { t } = useTranslation();
  const { role } = useAuth();
  const toast = useToast();
  const [saved, setSaved] = useState<General>(EMPTY);
  const [g, setG] = useState<General>(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getDoc(doc(db, "settings", "general")).then((snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      const v = Object.fromEntries(Object.keys(EMPTY).map((k) => [k, typeof data[k] === "string" ? data[k] : ""])) as General;
      setSaved(v);
      setG(v);
    }).catch(() => {});
  }, []);

  if (role !== "super_admin") {
    return <div className="bg-white rounded-3xl p-12 text-center text-sm text-[#6B7280]">{t("genSet.onlyAdmin")}</div>;
  }

  const dirty = JSON.stringify(g) !== JSON.stringify(saved);
  const set = (k: keyof General) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setG((x) => ({ ...x, [k]: e.target.value }));

  async function save() {
    const bad = LINK_FIELDS.find((f) => g[f.key].trim() && !/^https?:\/\//.test(g[f.key].trim()));
    if (bad) { toast({ message: `${bad.label} must start with https://`, type: "error" }); return; }
    setSaving(true);
    try {
      const clean = Object.fromEntries(Object.entries(g).map(([k, v]) => [k, v.trim()])) as General;
      await setDoc(doc(db, "settings", "general"), clean, { merge: true });
      setSaved(clean);
      setG(clean);
      toast({ message: t("genSet.saved") });
    } catch {
      toast({ message: t("genSet.saveError"), type: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <SettingsPanel title={t("settingsNav.general")} onSave={save} onCancel={() => setG(saved)} saving={saving} dirty={dirty}>
      <SettingsRow title={t("genSet.ministryInfo")} description={t("genSet.ministryInfoHint")}>
        <div>
          <label className="block text-sm text-[#111827] mb-2">{t("genSet.name")}</label>
          <input value={g.ministryName} onChange={set("ministryName")} placeholder="e.g. Nablis Ministry" className={INPUT} />
        </div>
        <div>
          <label className="block text-sm text-[#111827] mb-2">{t("planUpload.description")}</label>
          <textarea value={g.description} onChange={set("description")} rows={3} placeholder={t("genSet.descPlaceholder")} className={INPUT + " resize-none"} />
        </div>
      </SettingsRow>

      <SettingsRow title={t("genSet.contact")} description={t("genSet.contactHint")}>
        <div>
          <label className="block text-sm text-[#111827] mb-2">{t("genSet.email")}</label>
          <input type="email" value={g.contactEmail} onChange={set("contactEmail")} placeholder="info@nablis.com" className={INPUT} />
        </div>
        <div>
          <label className="block text-sm text-[#111827] mb-2">{t("genSet.phone")}</label>
          <input type="tel" value={g.contactPhone} onChange={set("contactPhone")} placeholder="+971 56 498 3456" className={INPUT} />
        </div>
        <div>
          <label className="block text-sm text-[#111827] mb-2">{t("genSet.address")}</label>
          <input value={g.address} onChange={set("address")} placeholder={t("genSet.addressPlaceholder")} className={INPUT} />
        </div>
      </SettingsRow>

      <SettingsRow title={t("genSet.links")} description={t("genSet.linksHint")}>
        {LINK_FIELDS.map((f) => (
          <div key={f.key}>
            <label className="block text-sm text-[#111827] mb-2">{f.label}</label>
            <input type="url" value={g[f.key]} onChange={set(f.key)} placeholder={f.placeholder} className={INPUT} />
          </div>
        ))}
      </SettingsRow>
    </SettingsPanel>
  );
}
