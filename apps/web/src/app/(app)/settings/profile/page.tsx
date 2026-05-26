"use client";
import React, { useState, useRef } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { db, auth, useAuth } from "@/lib/firebase";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { Camera, Upload, Eye, EyeOff, CheckCircle, AlertCircle, FileText, Trash2 } from "lucide-react";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-6">
      <h2 className="text-[#1B2E6B] font-semibold text-sm mb-5">{title}</h2>
      {children}
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-[#374151] mb-1.5">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {children}
    </div>
  );
}

const INPUT = "w-full px-4 py-2.5 rounded-xl border border-[#E5E7EB] text-sm text-[#374151] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#1B2E6B]/20 focus:border-[#1B2E6B] transition-colors";

export default function ProfilePage() {
  const { user, firebaseUser } = useAuth();

  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [address, setAddress] = useState(user?.address ?? "");
  const [city, setCity] = useState(user?.city ?? "");
  const [zip, setZip] = useState(user?.zipCode ?? "");

  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const docsRef = useRef<HTMLInputElement>(null);

  if (!user) return null;

  async function saveProfile() {
    setSaving(true);
    setSaveMsg(null);
    try {
      await updateDoc(doc(db, "users", user!.id), {
        displayName: displayName.trim(),
        phone: phone.trim(),
        address: address.trim(),
        city: city.trim(),
        zipCode: zip.trim(),
      });
      setSaveMsg({ type: "ok", text: "Profile saved successfully." });
    } catch {
      setSaveMsg({ type: "err", text: "Failed to save. Please try again." });
    } finally {
      setSaving(false);
    }
  }

  async function changePassword() {
    if (!firebaseUser || !currentPw || !newPw) return;
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
      const cred = EmailAuthProvider.credential(firebaseUser.email!, currentPw);
      await reauthenticateWithCredential(firebaseUser, cred);
      await updatePassword(firebaseUser, newPw);
      setPwMsg({ type: "ok", text: "Password updated successfully." });
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
      if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
        setPwMsg({ type: "err", text: "Current password is incorrect." });
      } else {
        setPwMsg({ type: "err", text: "Failed to change password. Please try again." });
      }
    } finally {
      setPwSaving(false);
    }
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    try {
      const url = await uploadToCloudinary(file, "nablis/avatars");
      await updateDoc(doc(db, "users", user!.id), { photoURL: url });
    } finally {
      setAvatarUploading(false);
    }
  }

  const initials = (user.displayName || user.email || "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[#1B2E6B]">Profile</h1>
        <p className="text-[#9CA3AF] text-sm mt-0.5">Manage your personal information</p>
      </div>

      {/* Avatar */}
      <Section title="Profile Picture">
        <div className="flex items-center gap-5">
          <div className="relative">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName}
                className="w-20 h-20 rounded-2xl object-cover"
              />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-[#1B2E6B] flex items-center justify-center">
                <span className="text-white font-bold text-xl">{initials}</span>
              </div>
            )}
            {avatarUploading && (
              <div className="absolute inset-0 rounded-2xl bg-black/40 flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
          <div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[#E5E7EB] text-sm font-medium text-[#374151] hover:bg-[#EEF1F8] transition-colors"
            >
              <Camera size={15} />
              Change photo
            </button>
            <p className="text-[#9CA3AF] text-xs mt-1.5">JPG, PNG up to 5MB</p>
          </div>
        </div>
      </Section>

      {/* Personal info */}
      <Section title="Personal Information">
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
          <Field label="Email Address">
            <input
              type="email"
              value={user.email}
              disabled
              className={`${INPUT} bg-[#F9FAFB] cursor-not-allowed text-[#9CA3AF]`}
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
          <Field label="City">
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Dubai"
              className={INPUT}
            />
          </Field>
          <Field label="Address">
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Street address"
              className={INPUT}
            />
          </Field>
          <Field label="ZIP / Postal Code">
            <input
              type="text"
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              placeholder="00000"
              className={INPUT}
            />
          </Field>
        </div>

        {saveMsg && (
          <div
            className={`flex items-center gap-2 text-sm mt-4 px-3 py-2.5 rounded-xl ${
              saveMsg.type === "ok" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
            }`}
          >
            {saveMsg.type === "ok" ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
            {saveMsg.text}
          </div>
        )}

        <button
          onClick={saveProfile}
          disabled={saving}
          className="mt-5 flex items-center gap-2 bg-[#1B2E6B] text-white font-semibold px-5 py-2.5 rounded-xl hover:bg-[#162554] transition-colors disabled:opacity-60 text-sm"
        >
          {saving ? (
            <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          ) : null}
          Save Changes
        </button>
      </Section>

      {/* Documents */}
      <Section title="Documents">
        <div className="space-y-2 mb-4">
          {(user.documents ?? []).length === 0 ? (
            <p className="text-[#9CA3AF] text-sm">No documents uploaded yet.</p>
          ) : (
            (user.documents ?? []).map((url, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-[#F9FAFB] border border-[#E5E7EB]">
                <FileText size={15} className="text-[#6B7280]" />
                <span className="text-[#374151] text-sm flex-1 truncate">Document {i + 1}</span>
                <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-[#1B2E6B] font-medium hover:text-[#F5C518]">
                  View
                </a>
                <button className="text-[#9CA3AF] hover:text-red-500 transition-colors">
                  <Trash2 size={13} />
                </button>
              </div>
            ))
          )}
        </div>
        <input ref={docsRef} type="file" className="hidden" multiple />
        <button
          onClick={() => docsRef.current?.click()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-dashed border-[#D1D5DB] text-sm font-medium text-[#6B7280] hover:border-[#1B2E6B] hover:text-[#1B2E6B] transition-colors"
        >
          <Upload size={15} />
          Upload Document
        </button>
      </Section>

      {/* Change password */}
      <Section title="Change Password">
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]"
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
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]"
              >
                {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </Field>
          <Field label="Confirm New Password" required>
            <input
              type="password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              placeholder="Repeat new password"
              className={INPUT}
            />
          </Field>
        </div>

        {pwMsg && (
          <div
            className={`flex items-center gap-2 text-sm mt-4 px-3 py-2.5 rounded-xl ${
              pwMsg.type === "ok" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
            }`}
          >
            {pwMsg.type === "ok" ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
            {pwMsg.text}
          </div>
        )}

        <button
          onClick={changePassword}
          disabled={pwSaving || !currentPw || !newPw || !confirmPw}
          className="mt-5 flex items-center gap-2 bg-[#1B2E6B] text-white font-semibold px-5 py-2.5 rounded-xl hover:bg-[#162554] transition-colors disabled:opacity-60 text-sm"
        >
          {pwSaving ? (
            <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          ) : null}
          Update Password
        </button>
      </Section>
    </div>
  );
}
