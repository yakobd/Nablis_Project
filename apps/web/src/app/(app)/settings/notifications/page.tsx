"use client";
import React, { useEffect, useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db, useAuth } from "@/lib/firebase";
import { useToast } from "@/components/ui/Toast";
import { SettingsPanel, SettingsRow, ToggleLine } from "../_components/ui";
import { useTranslation } from "@nablis/i18n";

type Visibility = "everyone" | "none" | "inapp";

interface NotifPrefs {
  commentVisibility: Visibility;
  reminder: { phone: boolean; email: boolean; inApp: boolean };
  snoozed: boolean;
  features: { blogs: boolean; events: boolean; prayer: boolean; bible: boolean; appointments: boolean };
  enableComments: boolean;
}

function fromUser(user: unknown): NotifPrefs {
  const n = ((user as { notifications?: Record<string, any> } | null)?.notifications ?? {}); // eslint-disable-line @typescript-eslint/no-explicit-any
  const on = (v: unknown, d = true) => (typeof v === "boolean" ? v : d);
  return {
    commentVisibility: n.commentVisibility === "none" || n.commentVisibility === "inapp" ? n.commentVisibility : "everyone",
    reminder: { phone: on(n.reminder?.phone, false), email: on(n.reminder?.email), inApp: on(n.reminder?.inApp) },
    snoozed: on(n.snoozed, false),
    features: {
      blogs: on(n.features?.blogs), events: on(n.features?.events), prayer: on(n.features?.prayer),
      bible: on(n.features?.bible), appointments: on(n.features?.appointments),
    },
    enableComments: on(n.blog?.enableComments),
  };
}

export default function NotificationsPage() {
  const { t } = useTranslation();
  const { user, role } = useAuth();
  const toast = useToast();
  const isStaff = role === "admin" || role === "super_admin";
  const [saved, setSaved] = useState<NotifPrefs>(() => fromUser(user));
  const [p, setP] = useState<NotifPrefs>(saved);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    const v = fromUser(user);
    setSaved(v);
    setP(v);
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!user) return null;
  const dirty = JSON.stringify(p) !== JSON.stringify(saved);
  const setReminder = (k: keyof NotifPrefs["reminder"], v: boolean) => setP((x) => ({ ...x, reminder: { ...x.reminder, [k]: v } }));
  const setFeature = (k: keyof NotifPrefs["features"], v: boolean) => setP((x) => ({ ...x, features: { ...x.features, [k]: v } }));
  // The three comment options behave like radio buttons.
  const setVisibility = (v: Visibility) => setP((x) => ({ ...x, commentVisibility: v }));

  async function save() {
    setSaving(true);
    try {
      await updateDoc(doc(db, "users", user!.id), {
        "notifications.commentVisibility": p.commentVisibility,
        "notifications.reminder.phone": p.reminder.phone,
        "notifications.reminder.email": p.reminder.email,
        "notifications.reminder.inApp": p.reminder.inApp,
        "notifications.snoozed": p.snoozed,
        "notifications.features.blogs": p.features.blogs,
        "notifications.features.events": p.features.events,
        "notifications.features.prayer": p.features.prayer,
        "notifications.features.bible": p.features.bible,
        "notifications.features.appointments": p.features.appointments,
        "notifications.blog.enableComments": p.enableComments,
      });
      setSaved(p);
      toast({ message: t("nset.saved") });
    } catch {
      toast({ message: t("nset.error"), type: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <SettingsPanel title={t("settingsNav.notifications")} saveLabel={t("prefs.save")} onSave={save} onCancel={() => setP(saved)} saving={saving} dirty={dirty}>
      <SettingsRow title={t("nset.comments")} description={t("nset.commentsHint")}>
        <ToggleLine label={t("nset.everyone")} checked={p.commentVisibility === "everyone"} onChange={() => setVisibility("everyone")} />
        <ToggleLine label={t("nset.noOne")} checked={p.commentVisibility === "none"} onChange={() => setVisibility("none")} />
        <ToggleLine label={t("nset.inApp")} checked={p.commentVisibility === "inapp"} onChange={() => setVisibility("inapp")} />
      </SettingsRow>

      <SettingsRow title={t("nset.reminders")} description={t("nset.remindersHint")}>
        <ToggleLine label={t("prof.phone")} hint={t("nset.smsSoon")} checked={p.reminder.phone} onChange={(v) => setReminder("phone", v)} />
        <ToggleLine label={t("auth.email")} hint={t("nset.emailSoon")} checked={p.reminder.email} onChange={(v) => setReminder("email", v)} />
        <ToggleLine label={t("nset.inApp")} checked={p.reminder.inApp} onChange={(v) => setReminder("inApp", v)} />
      </SettingsRow>

      <SettingsRow title={t("nset.snoozing")} description={t("nset.snoozingHint")}>
        <ToggleLine label={t("nset.enableSnooze")} checked={p.snoozed} onChange={(v) => setP((x) => ({ ...x, snoozed: v }))} />
      </SettingsRow>

      <SettingsRow title={t("nset.show")} description={t("nset.showHint")}>
        <ToggleLine label={t("nav.blogs")} checked={p.features.blogs} onChange={(v) => setFeature("blogs", v)} />
        <ToggleLine label={t("nav.events")} checked={p.features.events} onChange={(v) => setFeature("events", v)} />
        <ToggleLine label={t("nset.prayer")} checked={p.features.prayer} onChange={(v) => setFeature("prayer", v)} />
        <ToggleLine label={t("nav.bibleStudy")} checked={p.features.bible} onChange={(v) => setFeature("bible", v)} />
        <ToggleLine label={t("nav.appointment")} checked={p.features.appointments} onChange={(v) => setFeature("appointments", v)} />
      </SettingsRow>

      {isStaff && (
        <SettingsRow title={t("nset.blogMgmt")} description={t("nset.blogMgmtHint")}>
          <ToggleLine label={t("nset.enableComments")} checked={p.enableComments} onChange={(v) => setP((x) => ({ ...x, enableComments: v }))} />
        </SettingsRow>
      )}
    </SettingsPanel>
  );
}
