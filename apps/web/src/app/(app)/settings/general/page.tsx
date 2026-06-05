"use client";
import React, { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db, useAuth } from "@/lib/firebase";
import { CheckCircle, AlertCircle } from "lucide-react";

const INPUT = "w-full px-4 py-2.5 rounded-xl border border-[#E5E7EB] text-sm text-[#374151] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#1B2E6B]/20 focus:border-[#1B2E6B] transition-colors bg-white";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-6">
      <h2 className="text-[#1B2E6B] font-semibold text-sm mb-5">{title}</h2>
      {children}
    </div>
  );
}

export default function GeneralSettingsPage() {
  const { role } = useAuth();
  const [ministryName, setMinistryName] = useState("");
  const [description, setDescription] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    getDoc(doc(db, "settings", "general")).then((snap) => {
      if (!snap.exists()) return;
      const d = snap.data();
      setMinistryName(d.ministryName ?? "");
      setDescription(d.description ?? "");
      setContactEmail(d.contactEmail ?? "");
      setContactPhone(d.contactPhone ?? "");
      setAddress(d.address ?? "");
    });
  }, []);

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      await setDoc(doc(db, "settings", "general"), {
        ministryName: ministryName.trim(),
        description: description.trim(),
        contactEmail: contactEmail.trim(),
        contactPhone: contactPhone.trim(),
        address: address.trim(),
      }, { merge: true });
      setMsg({ type: "ok", text: "Settings saved successfully." });
    } catch {
      setMsg({ type: "err", text: "Failed to save. Please try again." });
    } finally {
      setSaving(false);
    }
  }

  if (role !== "super_admin") {
    return <div className="py-16 text-center text-[#9CA3AF] text-sm">Only super admins can manage general settings.</div>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[#1B2E6B]">General Settings</h1>
        <p className="text-[#9CA3AF] text-sm mt-0.5">Configure your ministry&apos;s basic information</p>
      </div>

      <Section title="Ministry Information">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#374151] mb-1.5">Ministry Name</label>
            <input value={ministryName} onChange={(e) => setMinistryName(e.target.value)} placeholder="e.g. Nablis Ministry" className={INPUT} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#374151] mb-1.5">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
              placeholder="Brief description of your ministry…"
              className={INPUT + " resize-none"} />
          </div>
        </div>
      </Section>

      <Section title="Contact Information">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#374151] mb-1.5">Contact Email</label>
            <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="contact@example.com" className={INPUT} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#374151] mb-1.5">Contact Phone</label>
            <input type="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="+1 234 567 8900" className={INPUT} />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-[#374151] mb-1.5">Location / Address</label>
            <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Church address…" className={INPUT} />
          </div>
        </div>
      </Section>

      {msg && (
        <div className={`flex items-center gap-2 text-sm px-4 py-3 rounded-xl ${msg.type === "ok" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
          {msg.type === "ok" ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
          {msg.text}
        </div>
      )}

      <button onClick={save} disabled={saving}
        className="flex items-center gap-2 bg-[#1B2E6B] text-white font-semibold px-5 py-2.5 rounded-xl hover:bg-[#162554] transition-colors disabled:opacity-60 text-sm">
        {saving && <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
        Save Changes
      </button>
    </div>
  );
}
