"use client";
import React, { useEffect, useState } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db, useAuth } from "@/lib/firebase";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle, AlertCircle } from "lucide-react";
import type { User } from "@nablis/shared/firebase";

const INPUT = "w-full px-4 py-2.5 rounded-xl border border-[#E5E7EB] text-sm text-[#374151] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#1B2E6B]/20 focus:border-[#1B2E6B] transition-colors";
const SELECT = "w-full px-4 py-2.5 rounded-xl border border-[#E5E7EB] text-sm text-[#374151] bg-white focus:outline-none focus:ring-2 focus:ring-[#1B2E6B]/20 focus:border-[#1B2E6B] transition-colors";

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-[#374151] mb-1.5">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {children}
    </div>
  );
}

export default function EditMemberPage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();
  const { role: currentUserRole } = useAuth();

  const [member, setMember]         = useState<User | null>(null);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [msg, setMsg]               = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Form state
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail]             = useState("");
  const [phone, setPhone]             = useState("");
  const [address, setAddress]         = useState("");
  const [city, setCity]               = useState("");
  const [zip, setZip]                 = useState("");
  const [role, setRole]               = useState<"super_admin" | "admin" | "member">("member");
  const [status, setStatus]           = useState<"active" | "pending" | "rejected" | "suspended">("pending");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const snap = await getDoc(doc(db, "users", id));
        if (snap.exists()) {
          const m = { id: snap.id, ...snap.data() } as User;
          setMember(m);
          setDisplayName(m.displayName ?? "");
          setEmail(m.email ?? "");
          setPhone(m.phone ?? "");
          setAddress(m.address ?? "");
          setCity(m.city ?? "");
          setZip(m.zipCode ?? "");
          setRole(m.role ?? "member");
          setStatus(m.status ?? "pending");
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  async function handleSave() {
    if (!member) return;
    setSaving(true);
    setMsg(null);
    try {
      const updates: Partial<User> = {
        displayName: displayName.trim(),
        phone: phone.trim(),
        address: address.trim(),
        city: city.trim(),
        zipCode: zip.trim(),
      };
      if (currentUserRole === "admin") {
        updates.role = role;
        updates.status = status;
      }
      await updateDoc(doc(db, "users", id), updates);
      setMsg({ type: "ok", text: "Member updated successfully." });
    } catch {
      setMsg({ type: "err", text: "Failed to save changes. Please try again." });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="py-16 text-center">
        <div className="w-7 h-7 border-2 border-[#1B2E6B] border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  if (!member) {
    return (
      <div className="py-16 text-center text-[#9CA3AF]">
        <p className="text-sm font-medium">Member not found</p>
        <button onClick={() => router.back()} className="mt-3 text-xs text-[#1B2E6B] font-semibold hover:text-[#F5C518]">
          Go back
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-1.5 text-[#6B7280] hover:text-[#1B2E6B] text-sm transition-colors"
      >
        <ArrowLeft size={14} /> Back
      </button>

      <div>
        <h1 className="text-xl font-bold text-[#1B2E6B]">Edit Member</h1>
        <p className="text-[#9CA3AF] text-sm mt-0.5">
          Editing: <span className="font-medium text-[#374151]">{member.displayName || member.email}</span>
        </p>
      </div>

      {/* Personal info */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-6">
        <h2 className="text-[#1B2E6B] font-semibold text-sm mb-5">Personal Information</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Full Name" required>
            <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Full name" className={INPUT} />
          </Field>
          <Field label="Email Address">
            <input type="email" value={email} disabled className={`${INPUT} bg-[#F9FAFB] cursor-not-allowed text-[#9CA3AF]`} />
          </Field>
          <Field label="Phone Number">
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+971 5X XXX XXXX" className={INPUT} />
          </Field>
          <Field label="City">
            <input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Dubai" className={INPUT} />
          </Field>
          <Field label="Address">
            <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street address" className={INPUT} />
          </Field>
          <Field label="ZIP / Postal Code">
            <input type="text" value={zip} onChange={(e) => setZip(e.target.value)} placeholder="00000" className={INPUT} />
          </Field>
        </div>
      </div>

      {/* Access control — admin only */}
      {currentUserRole === "admin" && (
        <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-6">
          <h2 className="text-[#1B2E6B] font-semibold text-sm mb-5">Access & Status</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Role">
              <select value={role} onChange={(e) => setRole(e.target.value as "admin" | "member")} className={SELECT}>
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
            </Field>
            <Field label="Status">
              <select value={status} onChange={(e) => setStatus(e.target.value as "active" | "pending" | "rejected")} className={SELECT}>
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="rejected">Rejected</option>
              </select>
            </Field>
          </div>
        </div>
      )}

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

      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-[#1B2E6B] text-white font-semibold px-5 py-2.5 rounded-xl hover:bg-[#162554] transition-colors disabled:opacity-60 text-sm"
        >
          {saving && <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
          Save Changes
        </button>
        <button
          onClick={() => router.back()}
          className="px-5 py-2.5 rounded-xl border border-[#E5E7EB] text-sm font-semibold text-[#374151] hover:bg-[#EEF1F8] transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
