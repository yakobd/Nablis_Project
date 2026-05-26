"use client";
import React, { useState } from "react";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, AlertCircle } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [form, setForm] = useState({
    displayName: "",
    email: "",
    password: "",
    phone: "",
    countryOfResidence: "",
    cityOfResidence: "",
    neighborhood: "",
    parishChurch: "",
    christianName: "",
  });

  function set(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((p) => ({ ...p, [key]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.displayName.trim() || !form.email.trim() || !form.password) return;
    setError("");
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(
        auth,
        form.email.trim().toLowerCase(),
        form.password
      );
      await updateProfile(cred.user, { displayName: form.displayName.trim() });
      await setDoc(doc(db, "users", cred.user.uid), {
        email:               form.email.trim().toLowerCase(),
        displayName:         form.displayName.trim(),
        photoURL:            null,
        role:                "member",
        status:              "pending",
        phone:               form.phone.trim(),
        countryOfResidence:  form.countryOfResidence.trim(),
        cityOfResidence:     form.cityOfResidence.trim(),
        neighborhood:        form.neighborhood.trim(),
        parishChurch:        form.parishChurch.trim(),
        christianName:       form.christianName.trim(),
        createdAt:           serverTimestamp(),
      });
      router.replace("/pending");
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
      if (code === "auth/email-already-in-use") {
        setError("An account with this email already exists.");
      } else if (code === "auth/weak-password") {
        setError("Password must be at least 6 characters.");
      } else {
        setError("Registration failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#EEF1F8] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-6">
          <img src="/Logo-Blue.png" alt="Nablis" className="h-20 w-auto mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-[#1B2E6B]">Create Account</h1>
          <p className="text-[#9CA3AF] text-sm mt-1">Join the Nablis Ministry community</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-[#E5E7EB] p-7">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Account info */}
            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1.5">Full Name *</label>
              <input type="text" value={form.displayName} onChange={set("displayName")} required
                placeholder="e.g. Mekdes Abebe"
                className="w-full px-4 py-2.5 rounded-xl border border-[#E5E7EB] text-sm text-[#374151] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#1B2E6B]/20 focus:border-[#1B2E6B] transition-colors" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1.5">Email Address *</label>
              <input type="email" value={form.email} onChange={set("email")} required autoComplete="email"
                placeholder="you@example.com"
                className="w-full px-4 py-2.5 rounded-xl border border-[#E5E7EB] text-sm text-[#374151] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#1B2E6B]/20 focus:border-[#1B2E6B] transition-colors" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1.5">Password *</label>
              <div className="relative">
                <input type={showPassword ? "text" : "password"} value={form.password} onChange={set("password")}
                  required minLength={6} autoComplete="new-password" placeholder="Min 6 characters"
                  className="w-full px-4 py-2.5 pr-10 rounded-xl border border-[#E5E7EB] text-sm text-[#374151] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#1B2E6B]/20 focus:border-[#1B2E6B] transition-colors" />
                <button type="button" onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#6B7280] transition-colors">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Contact & location */}
            <div className="border-t border-[#F3F4F6] pt-4">
              <p className="text-xs font-semibold text-[#9CA3AF] mb-3">CONTACT &amp; LOCATION</p>
              <div className="space-y-3">
                <input type="tel" value={form.phone} onChange={set("phone")} placeholder="Phone Number"
                  className="w-full px-4 py-2.5 rounded-xl border border-[#E5E7EB] text-sm text-[#374151] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#1B2E6B]/20 focus:border-[#1B2E6B] transition-colors" />
                <div className="grid grid-cols-2 gap-3">
                  <input type="text" value={form.countryOfResidence} onChange={set("countryOfResidence")} placeholder="Country"
                    className="w-full px-4 py-2.5 rounded-xl border border-[#E5E7EB] text-sm text-[#374151] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#1B2E6B]/20 focus:border-[#1B2E6B] transition-colors" />
                  <input type="text" value={form.cityOfResidence} onChange={set("cityOfResidence")} placeholder="City"
                    className="w-full px-4 py-2.5 rounded-xl border border-[#E5E7EB] text-sm text-[#374151] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#1B2E6B]/20 focus:border-[#1B2E6B] transition-colors" />
                </div>
                <input type="text" value={form.neighborhood} onChange={set("neighborhood")} placeholder="Neighborhood / Area"
                  className="w-full px-4 py-2.5 rounded-xl border border-[#E5E7EB] text-sm text-[#374151] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#1B2E6B]/20 focus:border-[#1B2E6B] transition-colors" />
              </div>
            </div>

            {/* Church information */}
            <div className="border-t border-[#F3F4F6] pt-4">
              <p className="text-xs font-semibold text-[#9CA3AF] mb-3">CHURCH INFORMATION</p>
              <div className="space-y-3">
                <input type="text" value={form.parishChurch} onChange={set("parishChurch")} placeholder="Parish / Home Church"
                  className="w-full px-4 py-2.5 rounded-xl border border-[#E5E7EB] text-sm text-[#374151] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#1B2E6B]/20 focus:border-[#1B2E6B] transition-colors" />
                <input type="text" value={form.christianName} onChange={set("christianName")} placeholder="Christian Name (e.g. Mariam)"
                  className="w-full px-4 py-2.5 rounded-xl border border-[#E5E7EB] text-sm text-[#374151] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#1B2E6B]/20 focus:border-[#1B2E6B] transition-colors" />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 text-red-500 text-sm bg-red-50 rounded-xl px-3 py-2.5">
                <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-[#1B2E6B] text-white font-semibold py-2.5 rounded-xl hover:bg-[#162554] active:bg-[#111d44] transition-colors disabled:opacity-60 disabled:cursor-not-allowed mt-2">
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Creating Account&hellip;
                </>
              ) : "Create Account"}
            </button>
          </form>
        </div>

        <div className="text-center mt-4 space-y-1">
          <p className="text-[#9CA3AF] text-xs">
            Already have an account?{" "}
            <Link href="/login" className="text-[#1B2E6B] font-semibold hover:underline">Sign In</Link>
          </p>
          <p className="text-[#9CA3AF] text-xs">
            New members require approval from the Spiritual Father
          </p>
        </div>
      </div>
    </div>
  );
}
