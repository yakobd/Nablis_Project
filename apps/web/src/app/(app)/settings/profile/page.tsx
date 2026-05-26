"use client";
import React, { useEffect, useRef, useState } from "react";
import {
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import {
  deleteUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from "firebase/auth";
import { useRouter } from "next/navigation";
import { db, auth, useAuth } from "@/lib/firebase";
import { uploadToCloudinary } from "@/lib/cloudinary";
import {
  Camera,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
  Bell,
  Shield,
  Trash2,
  Loader2,
} from "lucide-react";

/* ─── primitives ─────────────────────────────────────────────────────── */

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-6">
      <div className="mb-5">
        <h2 className="text-[#1B2E6B] font-semibold text-sm">{title}</h2>
        {description && (
          <p className="text-[#9CA3AF] text-xs mt-0.5">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}

function Field({
  label,
  sublabel,
  required,
  children,
}: {
  label: string;
  sublabel?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-[#374151] mb-1.5">
        {label}
        {sublabel && <span className="text-[#9CA3AF] font-normal ml-1">{sublabel}</span>}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const INPUT =
  "w-full px-4 py-2.5 rounded-xl border border-[#E5E7EB] text-sm text-[#374151] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#1B2E6B]/20 focus:border-[#1B2E6B] transition-colors bg-white";

function Toast({
  msg,
}: {
  msg: { type: "ok" | "err"; text: string } | null;
}) {
  if (!msg) return null;
  return (
    <div
      className={`flex items-center gap-2 text-sm px-3 py-2.5 rounded-xl ${
        msg.type === "ok"
          ? "bg-green-50 text-green-700"
          : "bg-red-50 text-red-600"
      }`}
    >
      {msg.type === "ok" ? (
        <CheckCircle size={14} />
      ) : (
        <AlertCircle size={14} />
      )}
      {msg.text}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
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
        {description && (
          <p className="text-xs text-[#9CA3AF] mt-0.5">{description}</p>
        )}
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

/* ─── helpers ─────────────────────────────────────────────────────────── */

function getField(user: ReturnType<typeof useAuth>["user"], ...keys: string[]) {
  if (!user) return "";
  for (const k of keys) {
    const v = (user as Record<string, unknown>)[k];
    if (v && typeof v === "string") return v;
  }
  return "";
}

function initials(name: string, email: string) {
  const src = name || email || "?";
  return src
    .split(" ")
    .map((w) => w[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/* ─── main page ───────────────────────────────────────────────────────── */

export default function ProfilePage() {
  const { user, firebaseUser } = useAuth();
  const router = useRouter();

  /* personal info */
  const [displayName, setDisplayName] = useState("");
  const [christianName, setChristianName] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [parishChurch, setParishChurch] = useState("");

  /* photo */
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadProgress, setUploadProgress] = useState<
    "idle" | "uploading" | "done" | "error"
  >("idle");

  /* save */
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);

  /* password */
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);

  /* notifications */
  const [notifPrayerMorning, setNotifPrayerMorning] = useState(true);
  const [notifPrayerAfternoon, setNotifPrayerAfternoon] = useState(true);
  const [notifPrayerEvening, setNotifPrayerEvening] = useState(true);
  const [notifAppointments, setNotifAppointments] = useState(true);
  const [notifBlogs, setNotifBlogs] = useState(true);
  const [notifEvents, setNotifEvents] = useState(true);
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifMsg, setNotifMsg] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);

  /* danger zone */
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);

  /* init form from Firestore user */
  useEffect(() => {
    if (!user) return;
    const u = user as Record<string, unknown>;
    setDisplayName((u.displayName as string) ?? "");
    setChristianName((u.christianName as string) ?? "");
    setPhone(
      ((u.phone ?? u.phoneNumber) as string) ?? ""
    );
    setCountry((u.countryOfResidence as string) ?? "");
    setCity((u.cityOfResidence as string) ?? "");
    setNeighborhood((u.neighborhood as string) ?? "");
    setParishChurch((u.parishChurch as string) ?? "");

    const n = (u.notifications as Record<string, unknown>) ?? {};
    const f = (n.features as Record<string, unknown>) ?? {};
    const p = (n.prayer as Record<string, unknown>) ?? {};
    setNotifPrayerMorning((p.morning as boolean) ?? true);
    setNotifPrayerAfternoon((p.afternoon as boolean) ?? true);
    setNotifPrayerEvening((p.evening as boolean) ?? true);
    setNotifAppointments((f.appointments as boolean) ?? true);
    setNotifBlogs((f.blogs as boolean) ?? true);
    setNotifEvents((f.events as boolean) ?? true);
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!user) return null;

  const avatarInitials = initials(user.displayName ?? "", user.email ?? "");

  /* ── photo upload ── */
  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadProgress("uploading");
    try {
      const url = await uploadToCloudinary(file, "nablis/avatars");
      await updateDoc(doc(db, "users", user!.id), {
        photoURL: url,
        updatedAt: serverTimestamp(),
      });
      setUploadProgress("done");
      setTimeout(() => setUploadProgress("idle"), 3000);
    } catch {
      setUploadProgress("error");
      setTimeout(() => setUploadProgress("idle"), 4000);
    } finally {
      e.target.value = "";
    }
  }

  /* ── save personal info ── */
  async function saveProfile() {
    setSaving(true);
    setSaveMsg(null);
    try {
      await updateDoc(doc(db, "users", user!.id), {
        displayName: displayName.trim(),
        christianName: christianName.trim(),
        phone: phone.trim(),
        phoneNumber: phone.trim(),
        countryOfResidence: country.trim(),
        cityOfResidence: city.trim(),
        neighborhood: neighborhood.trim(),
        parishChurch: parishChurch.trim(),
        updatedAt: serverTimestamp(),
      });
      setSaveMsg({ type: "ok", text: "Profile saved successfully." });
    } catch {
      setSaveMsg({ type: "err", text: "Failed to save. Please try again." });
    } finally {
      setSaving(false);
    }
  }

  /* ── change password ── */
  async function changePassword() {
    if (!firebaseUser?.email || !currentPw || !newPw) return;
    if (newPw !== confirmPw) {
      setPwMsg({ type: "err", text: "New passwords do not match." });
      return;
    }
    if (newPw.length < 8) {
      setPwMsg({ type: "err", text: "Password must be at least 8 characters." });
      return;
    }
    setPwSaving(true);
    setPwMsg(null);
    try {
      const cred = EmailAuthProvider.credential(firebaseUser.email, currentPw);
      await reauthenticateWithCredential(firebaseUser, cred);
      await updatePassword(firebaseUser, newPw);
      setPwMsg({ type: "ok", text: "Password updated successfully." });
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
      if (
        code === "auth/wrong-password" ||
        code === "auth/invalid-credential"
      ) {
        setPwMsg({ type: "err", text: "Current password is incorrect." });
      } else {
        setPwMsg({ type: "err", text: "Failed to update password. Try again." });
      }
    } finally {
      setPwSaving(false);
    }
  }

  /* ── save notifications ── */
  async function saveNotifications() {
    setNotifSaving(true);
    setNotifMsg(null);
    try {
      await updateDoc(doc(db, "users", user!.id), {
        "notifications.prayer.morning": notifPrayerMorning,
        "notifications.prayer.afternoon": notifPrayerAfternoon,
        "notifications.prayer.evening": notifPrayerEvening,
        "notifications.features.appointments": notifAppointments,
        "notifications.features.blogs": notifBlogs,
        "notifications.features.events": notifEvents,
        updatedAt: serverTimestamp(),
      });
      setNotifMsg({ type: "ok", text: "Notification preferences saved." });
    } catch {
      setNotifMsg({ type: "err", text: "Failed to save. Please try again." });
    } finally {
      setNotifSaving(false);
    }
  }

  /* ── delete account ── */
  async function handleDeleteAccount() {
    if (!firebaseUser?.email || !deletePassword) return;
    setDeleteLoading(true);
    setDeleteMsg(null);
    try {
      const cred = EmailAuthProvider.credential(
        firebaseUser.email,
        deletePassword
      );
      await reauthenticateWithCredential(firebaseUser, cred);
      await deleteDoc(doc(db, "users", user!.id));
      await deleteUser(firebaseUser);
      router.replace("/login");
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
      if (
        code === "auth/wrong-password" ||
        code === "auth/invalid-credential"
      ) {
        setDeleteMsg({ type: "err", text: "Incorrect password." });
      } else {
        setDeleteMsg({
          type: "err",
          text: "Failed to delete account. Please try again.",
        });
      }
    } finally {
      setDeleteLoading(false);
    }
  }

  /* ─── render ─────────────────────────────────────────────────────────── */

  return (
    <div className="space-y-5 pb-10">
      <div>
        <h1 className="text-xl font-bold text-[#1B2E6B]">Profile</h1>
        <p className="text-[#9CA3AF] text-sm mt-0.5">
          Manage your personal information and account settings
        </p>
      </div>

      {/* ── PROFILE PHOTO ── */}
      <Section title="Profile Photo">
        <div className="flex items-center gap-6">
          {/* avatar */}
          <div className="relative flex-shrink-0">
            <div className="w-20 h-20 rounded-2xl overflow-hidden bg-[#1B2E6B] flex items-center justify-center">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName ?? ""}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-[#F5C518] font-bold text-xl">
                  {avatarInitials}
                </span>
              )}
              {uploadProgress === "uploading" && (
                <div className="absolute inset-0 bg-black/50 rounded-2xl flex items-center justify-center">
                  <Loader2 size={20} className="text-white animate-spin" />
                </div>
              )}
            </div>
          </div>

          {/* upload controls */}
          <div className="space-y-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handlePhotoChange}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploadProgress === "uploading"}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#EEF1F8] text-[#1B2E6B] text-sm font-semibold hover:bg-[#dde3f0] transition-colors disabled:opacity-60"
            >
              <Camera size={14} />
              Change Photo
            </button>
            <p className="text-[#9CA3AF] text-xs">JPG, PNG or WebP · max 5 MB</p>
            {uploadProgress === "uploading" && (
              <p className="text-xs text-[#1B2E6B] font-medium">Uploading…</p>
            )}
            {uploadProgress === "done" && (
              <p className="flex items-center gap-1 text-xs text-green-600 font-medium">
                <CheckCircle size={12} /> Photo updated
              </p>
            )}
            {uploadProgress === "error" && (
              <p className="flex items-center gap-1 text-xs text-red-500 font-medium">
                <AlertCircle size={12} /> Upload failed — try again
              </p>
            )}
          </div>
        </div>
      </Section>

      {/* ── PERSONAL INFORMATION ── */}
      <Section
        title="Personal Information"
        description="Update your profile details"
      >
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Full Name" required>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your full name"
              className={INPUT}
            />
          </Field>

          <Field label="Christian Name" sublabel="/ የክርስትና ስም">
            <input
              type="text"
              value={christianName}
              onChange={(e) => setChristianName(e.target.value)}
              placeholder="e.g. Tewodros, Mariam…"
              className={INPUT}
            />
          </Field>

          <Field label="Phone Number">
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+971 5X XXX XXXX"
              className={INPUT}
            />
          </Field>

          <Field label="Email Address">
            <input
              type="email"
              value={user.email ?? ""}
              disabled
              className={`${INPUT} bg-[#F9FAFB] cursor-not-allowed text-[#9CA3AF]`}
            />
          </Field>

          <Field label="Country of Residence">
            <input
              type="text"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="e.g. United Arab Emirates"
              className={INPUT}
            />
          </Field>

          <Field label="City of Residence">
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g. Dubai"
              className={INPUT}
            />
          </Field>

          <Field label="Neighborhood / Subcity">
            <input
              type="text"
              value={neighborhood}
              onChange={(e) => setNeighborhood(e.target.value)}
              placeholder="e.g. Deira, Bur Dubai…"
              className={INPUT}
            />
          </Field>

          <Field label="Parish Church">
            <input
              type="text"
              value={parishChurch}
              onChange={(e) => setParishChurch(e.target.value)}
              placeholder="Your local parish"
              className={INPUT}
            />
          </Field>
        </div>

        <div className="mt-5 flex flex-col gap-3">
          <Toast msg={saveMsg} />
          <button
            onClick={saveProfile}
            disabled={saving}
            className="self-start flex items-center gap-2 bg-[#1B2E6B] text-white font-semibold px-5 py-2.5 rounded-xl hover:bg-[#162554] transition-colors disabled:opacity-60 text-sm"
          >
            {saving && (
              <Loader2 size={14} className="animate-spin" />
            )}
            Save Changes
          </button>
        </div>
      </Section>

      {/* ── ACCOUNT SECURITY ── */}
      <Section title="Account Security" description="Change your login password">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Field label="Current Password" required>
              <div className="relative">
                <input
                  type={showCurrent ? "text" : "password"}
                  value={currentPw}
                  onChange={(e) => setCurrentPw(e.target.value)}
                  placeholder="••••••••"
                  className={`${INPUT} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#374151] transition-colors"
                >
                  {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </Field>
          </div>

          <Field label="New Password" required>
            <div className="relative">
              <input
                type={showNew ? "text" : "password"}
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                placeholder="Min. 8 characters"
                className={`${INPUT} pr-10`}
              />
              <button
                type="button"
                onClick={() => setShowNew((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#374151] transition-colors"
              >
                {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </Field>

          <Field label="Confirm New Password" required>
            <div className="relative">
              <input
                type={showConfirm ? "text" : "password"}
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                placeholder="Repeat new password"
                className={`${INPUT} pr-10`}
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#374151] transition-colors"
              >
                {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </Field>
        </div>

        {/* password strength hint */}
        {newPw.length > 0 && (
          <div className="mt-3 flex gap-1">
            {[1, 2, 3, 4].map((level) => {
              const strength =
                (newPw.length >= 8 ? 1 : 0) +
                (/[A-Z]/.test(newPw) ? 1 : 0) +
                (/[0-9]/.test(newPw) ? 1 : 0) +
                (/[^A-Za-z0-9]/.test(newPw) ? 1 : 0);
              const active = level <= strength;
              const color =
                strength <= 1
                  ? "bg-red-400"
                  : strength === 2
                  ? "bg-yellow-400"
                  : strength === 3
                  ? "bg-blue-400"
                  : "bg-green-500";
              return (
                <div
                  key={level}
                  className={`h-1 flex-1 rounded-full transition-colors ${
                    active ? color : "bg-[#E5E7EB]"
                  }`}
                />
              );
            })}
            <span className="text-xs text-[#9CA3AF] ml-2 whitespace-nowrap">
              {newPw.length < 8
                ? "Too short"
                : /[^A-Za-z0-9]/.test(newPw) && /[A-Z]/.test(newPw) && /[0-9]/.test(newPw)
                ? "Strong"
                : /[A-Z]/.test(newPw) && /[0-9]/.test(newPw)
                ? "Good"
                : "Fair"}
            </span>
          </div>
        )}

        <div className="mt-5 flex flex-col gap-3">
          <Toast msg={pwMsg} />
          <button
            onClick={changePassword}
            disabled={pwSaving || !currentPw || !newPw || !confirmPw}
            className="self-start flex items-center gap-2 bg-[#1B2E6B] text-white font-semibold px-5 py-2.5 rounded-xl hover:bg-[#162554] transition-colors disabled:opacity-60 text-sm"
          >
            {pwSaving ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Shield size={14} />
            )}
            Update Password
          </button>
        </div>
      </Section>

      {/* ── NOTIFICATION PREFERENCES ── */}
      <Section
        title="Notification Preferences"
        description="Control which reminders you receive"
      >
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-3">
            <Bell size={14} className="text-[#9CA3AF]" />
            <span className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
              Prayer Reminders
            </span>
          </div>
          <ToggleRow
            label="Morning Prayer"
            description="Daily reminder at the morning prayer hour"
            checked={notifPrayerMorning}
            onChange={setNotifPrayerMorning}
          />
          <ToggleRow
            label="Midday Prayer"
            description="Daily reminder at the afternoon prayer hour"
            checked={notifPrayerAfternoon}
            onChange={setNotifPrayerAfternoon}
          />
          <ToggleRow
            label="Evening Prayer"
            description="Daily reminder at the evening prayer hour"
            checked={notifPrayerEvening}
            onChange={setNotifPrayerEvening}
          />
        </div>

        <div className="pt-2">
          <div className="flex items-center gap-2 mb-3">
            <Bell size={14} className="text-[#9CA3AF]" />
            <span className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
              App Notifications
            </span>
          </div>
          <ToggleRow
            label="Appointment Reminders"
            description="Reminders before your upcoming sessions"
            checked={notifAppointments}
            onChange={setNotifAppointments}
          />
          <ToggleRow
            label="New Blog Posts"
            description="When the ministry publishes new content"
            checked={notifBlogs}
            onChange={setNotifBlogs}
          />
          <ToggleRow
            label="Event Reminders"
            description="Upcoming church events and gatherings"
            checked={notifEvents}
            onChange={setNotifEvents}
          />
        </div>

        <div className="mt-5 flex flex-col gap-3">
          <Toast msg={notifMsg} />
          <button
            onClick={saveNotifications}
            disabled={notifSaving}
            className="self-start flex items-center gap-2 bg-[#1B2E6B] text-white font-semibold px-5 py-2.5 rounded-xl hover:bg-[#162554] transition-colors disabled:opacity-60 text-sm"
          >
            {notifSaving && <Loader2 size={14} className="animate-spin" />}
            Save Preferences
          </button>
        </div>
      </Section>

      {/* ── DANGER ZONE ── */}
      <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-red-600 font-semibold text-sm mb-0.5">
              Danger Zone
            </h2>
            <p className="text-[#9CA3AF] text-xs">
              Permanently delete your account and all your data. This cannot be
              undone.
            </p>
          </div>
          <button
            onClick={() => setShowDeleteDialog(true)}
            className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50 transition-colors"
          >
            <Trash2 size={14} />
            Delete Account
          </button>
        </div>
      </div>

      {/* ── DELETE ACCOUNT DIALOG ── */}
      {showDeleteDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                <Trash2 size={18} className="text-red-500" />
              </div>
              <div>
                <h3 className="text-[#1B2E6B] font-bold text-sm">
                  Delete Your Account
                </h3>
                <p className="text-[#9CA3AF] text-xs">
                  This action is permanent and irreversible.
                </p>
              </div>
            </div>

            <p className="text-[#6B7280] text-sm mb-4">
              All your data — appointments, prayer logs, and messages — will be
              permanently deleted. Enter your password to confirm.
            </p>

            <Field label="Your Password" required>
              <input
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder="••••••••"
                className={INPUT}
                autoFocus
              />
            </Field>

            {deleteMsg && (
              <div className="mt-3">
                <Toast msg={deleteMsg} />
              </div>
            )}

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => {
                  setShowDeleteDialog(false);
                  setDeletePassword("");
                  setDeleteMsg(null);
                }}
                className="flex-1 px-4 py-2.5 rounded-xl bg-[#F3F4F6] text-[#6B7280] text-sm font-semibold hover:bg-[#E5E7EB] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteLoading || !deletePassword}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {deleteLoading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Trash2 size={14} />
                )}
                Delete Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
