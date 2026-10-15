"use client";
import React, { useState } from "react";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc, serverTimestamp, collection, getDocs, query, where } from "firebase/firestore";
import { auth, db, notify } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { AuthShell, FIELD, LABEL } from "@/components/auth/AuthShell";
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
      // Notify all super_admins about new member registration
      const adminsSnap = await getDocs(query(collection(db, "users"), where("role", "==", "super_admin")));
      await notify(adminsSnap.docs.map((a) => ({
        userId: a.id,
        type: "new_member",
        title: "New Member Registration",
        description: `${form.displayName.trim()} has registered and is awaiting approval.`,
        link: "/settings/members/new",
      })));
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
    <AuthShell
      mode="register"
      title="Start your spiritual journey today."
      footer={<p>New members require approval from the Spiritual Father.</p>}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className={LABEL}>Full Name *</label>
          <input type="text" value={form.displayName} onChange={set("displayName")} required
            placeholder="e.g. Mekdes Abebe" className={FIELD} />
        </div>
        <div>
          <label className={LABEL}>Email Address *</label>
          <input type="email" value={form.email} onChange={set("email")} required autoComplete="email"
            placeholder="you@example.com" className={FIELD} />
        </div>
        <div>
          <label className={LABEL}>Password *</label>
          <div className="relative">
            <input type={showPassword ? "text" : "password"} value={form.password} onChange={set("password")}
              required minLength={6} autoComplete="new-password" placeholder="Min 6 characters"
              className={FIELD + " pr-8"} />
            <button type="button" onClick={() => setShowPassword((v) => !v)}
              className="absolute right-0 top-1/2 -translate-y-1/2 text-white/60 hover:text-white"
              aria-label={showPassword ? "Hide password" : "Show password"}>
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {/* Contact & location */}
        <div className="pt-2">
          <p className="text-[11px] font-bold tracking-widest text-[#F5C518] mb-3">CONTACT &amp; LOCATION</p>
          <div className="space-y-4">
            <input type="tel" value={form.phone} onChange={set("phone")} placeholder="Phone Number" className={FIELD} />
            <div className="grid grid-cols-2 gap-4">
              <input type="text" value={form.countryOfResidence} onChange={set("countryOfResidence")} placeholder="Country" className={FIELD} />
              <input type="text" value={form.cityOfResidence} onChange={set("cityOfResidence")} placeholder="City" className={FIELD} />
            </div>
            <input type="text" value={form.neighborhood} onChange={set("neighborhood")} placeholder="Neighborhood / Area" className={FIELD} />
          </div>
        </div>

        {/* Church information */}
        <div className="pt-2">
          <p className="text-[11px] font-bold tracking-widest text-[#F5C518] mb-3">CHURCH INFORMATION</p>
          <div className="space-y-4">
            <input type="text" value={form.parishChurch} onChange={set("parishChurch")} placeholder="Parish / Home Church" className={FIELD} />
            <input type="text" value={form.christianName} onChange={set("christianName")} placeholder="Christian Name (e.g. Mariam)" className={FIELD} />
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 text-red-100 text-sm bg-red-500/25 border border-red-300/30 rounded-xl px-3 py-2.5 animate-scale-in">
            <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex justify-center pt-1">
          <button type="submit" disabled={loading}
            className="min-w-[220px] flex items-center justify-center gap-2 bg-white/85 text-[#111827] text-lg font-medium py-3 px-8 rounded-full hover:bg-white hover:shadow-[0_10px_30px_-10px_rgba(245,197,24,0.6)] disabled:opacity-60 disabled:cursor-not-allowed">
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-[#111827]/30 border-t-[#111827] rounded-full animate-spin" />
                Creating account&hellip;
              </>
            ) : "Create Account"}
          </button>
        </div>
      </form>
    </AuthShell>
  );
}
