"use client";
import React, { useState } from "react";
import {
  browserLocalPersistence, browserSessionPersistence, sendPasswordResetEmail, setPersistence,
} from "firebase/auth";
import { auth, useAuth } from "@/lib/firebase";
import { Eye, EyeOff, AlertCircle, CheckCircle } from "lucide-react";
import { AuthShell, FIELD, LABEL } from "@/components/auth/AuthShell";

const ERROR_MESSAGES: Record<string, string> = {
  "auth/invalid-credential": "Incorrect email or password. Please try again.",
  "auth/user-not-found": "No account found with this email.",
  "auth/wrong-password": "Incorrect password. Please try again.",
  "auth/too-many-requests": "Too many failed attempts. Please try again later.",
  "auth/network-request-failed": "Network error. Check your connection.",
  "auth/invalid-email": "Please enter a valid email address.",
};

export default function LoginPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setError("");
    setNotice("");
    setLoading(true);
    try {
      // "Remember me" keeps the session after the browser closes.
      await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
      await signIn(email.trim(), password);
      // session cookie and redirect are handled in (app)/layout.tsx
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
      setError(ERROR_MESSAGES[code] ?? "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleForgot() {
    setError("");
    setNotice("");
    if (!email.trim()) {
      setError("Enter your email above, then tap “Forgot password?” again.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setNotice("Password reset link sent. Please check your email.");
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
      setError(ERROR_MESSAGES[code] ?? "Could not send the reset email. Please try again.");
    }
  }

  return (
    <AuthShell
      mode="login"
      title="Welcome, fill in your details to sign in!"
      footer={<p>New members require approval from the Spiritual Father.</p>}
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className={LABEL}>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder="Your registered email"
            className={FIELD}
          />
        </div>

        <div>
          <label className={LABEL}>Password</label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
              className={FIELD + " pr-8"}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-0 top-1/2 -translate-y-1/2 text-white/60 hover:text-white"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm text-white/85">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)}
              className="w-4 h-4 rounded-full accent-[#F5C518]" />
            Remember me
          </label>
          <button type="button" onClick={handleForgot}
            className="underline decoration-dotted underline-offset-4 hover:text-[#F5C518]">
            Forgot password?
          </button>
        </div>

        {error && (
          <div className="flex items-start gap-2 text-red-100 text-sm bg-red-500/25 border border-red-300/30 rounded-xl px-3 py-2.5 animate-scale-in">
            <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        {notice && (
          <div className="flex items-start gap-2 text-green-50 text-sm bg-green-500/25 border border-green-300/30 rounded-xl px-3 py-2.5 animate-scale-in">
            <CheckCircle size={15} className="flex-shrink-0 mt-0.5" />
            <span>{notice}</span>
          </div>
        )}

        <div className="flex justify-center pt-1">
          <button
            type="submit"
            disabled={loading}
            className="min-w-[220px] flex items-center justify-center gap-2 bg-white/85 text-[#111827] text-lg font-medium py-3 px-8 rounded-full hover:bg-white hover:shadow-[0_10px_30px_-10px_rgba(245,197,24,0.6)] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-[#111827]/30 border-t-[#111827] rounded-full animate-spin" />
                Signing in…
              </>
            ) : (
              "Sign in"
            )}
          </button>
        </div>
      </form>
    </AuthShell>
  );
}
