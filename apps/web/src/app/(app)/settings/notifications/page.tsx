"use client";
import React, { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db, useAuth } from "@/lib/firebase";
import { CheckCircle, AlertCircle } from "lucide-react";

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

function RadioGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <p className="text-sm font-medium text-[#374151] mb-2">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={[
              "px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-colors",
              value === opt.value
                ? "bg-[#1B2E6B] text-white border-[#1B2E6B]"
                : "bg-white text-[#6B7280] border-[#E5E7EB] hover:border-[#1B2E6B]/40",
            ].join(" ")}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-[#F3F4F6] last:border-0">
      <div>
        <p className="text-sm font-medium text-[#374151]">{label}</p>
        {description && <p className="text-xs text-[#9CA3AF] mt-0.5">{description}</p>}
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-6">
      <h2 className="text-[#1B2E6B] font-semibold text-sm mb-4">{title}</h2>
      {children}
    </div>
  );
}

export default function NotificationsPage() {
  const { user } = useAuth();
  const [commentVisibility, setCommentVisibility] = useState("everyone");
  const [reminderPhone, setReminderPhone]         = useState(false);
  const [reminderEmail, setReminderEmail]         = useState(true);
  const [reminderInApp, setReminderInApp]         = useState(true);
  const [snoozed, setSnoozed]                     = useState(false);
  const [blogNotifs, setBlogNotifs]               = useState(true);
  const [eventNotifs, setEventNotifs]             = useState(true);
  const [prayerNotifs, setPrayerNotifs]           = useState(true);
  const [bibleNotifs, setBibleNotifs]             = useState(true);
  const [enableComments, setEnableComments]       = useState(true);
  const [enableTagging, setEnableTagging]         = useState(true);
  const [saving, setSaving]                       = useState(false);
  const [msg, setMsg]                             = useState<{ type: "ok" | "err"; text: string } | null>(null);

  if (!user) return null;

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      await updateDoc(doc(db, "users", user!.id), {
        "notifications.commentVisibility": commentVisibility,
        "notifications.reminder.phone":    reminderPhone,
        "notifications.reminder.email":    reminderEmail,
        "notifications.reminder.inApp":    reminderInApp,
        "notifications.snoozed":           snoozed,
        "notifications.features.blogs":    blogNotifs,
        "notifications.features.events":   eventNotifs,
        "notifications.features.prayer":   prayerNotifs,
        "notifications.features.bible":    bibleNotifs,
        "notifications.blog.enableComments": enableComments,
        "notifications.gallery.enableTagging": enableTagging,
      });
      setMsg({ type: "ok", text: "Notification settings saved." });
    } catch {
      setMsg({ type: "err", text: "Failed to save. Please try again." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[#1B2E6B]">Notifications</h1>
        <p className="text-[#9CA3AF] text-sm mt-0.5">Control how and when you receive notifications</p>
      </div>

      {/* Comments & reminders */}
      <Section title="Comments & Reminders">
        <div className="space-y-5">
          <RadioGroup
            label="Comment Visibility"
            options={[
              { value: "everyone", label: "Everyone" },
              { value: "none",     label: "No one" },
              { value: "inapp",    label: "In-app only" },
            ]}
            value={commentVisibility}
            onChange={setCommentVisibility}
          />

          <div>
            <p className="text-sm font-medium text-[#374151] mb-3">Reminder Channels</p>
            <div className="space-y-0">
              <ToggleRow label="Phone / SMS" description="Get SMS reminders for appointments" checked={reminderPhone} onChange={setReminderPhone} />
              <ToggleRow label="Email" description="Get email reminders and updates" checked={reminderEmail} onChange={setReminderEmail} />
              <ToggleRow label="In-App" description="Show notifications inside the app" checked={reminderInApp} onChange={setReminderInApp} />
            </div>
          </div>

          <ToggleRow
            label="Snooze Notifications"
            description="Temporarily pause all non-critical notifications"
            checked={snoozed}
            onChange={setSnoozed}
          />
        </div>
      </Section>

      {/* Per-feature */}
      <Section title="Notifications by Feature">
        <ToggleRow label="Blogs & Posts"    description="New posts and updates from the ministry" checked={blogNotifs}   onChange={setBlogNotifs} />
        <ToggleRow label="Events"           description="Upcoming events and RSVP reminders"      checked={eventNotifs}  onChange={setEventNotifs} />
        <ToggleRow label="Daily Prayers"    description="Morning, afternoon, and evening prayer reminders" checked={prayerNotifs} onChange={setPrayerNotifs} />
        <ToggleRow label="Bible Study"      description="Study schedule and session reminders"     checked={bibleNotifs}  onChange={setBibleNotifs} />
      </Section>

      {/* Content management */}
      <Section title="Content Management">
        <ToggleRow
          label="Enable Blog Comments"
          description="Allow members to comment on blog posts you publish"
          checked={enableComments}
          onChange={setEnableComments}
        />
        <ToggleRow
          label="Enable Gallery Tagging"
          description="Allow members to tag people in gallery photos"
          checked={enableTagging}
          onChange={setEnableTagging}
        />
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
