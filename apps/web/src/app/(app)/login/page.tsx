"use client";
import React, { useState } from "react";
import { useAuth } from "@/lib/firebase";
import { Eye, EyeOff, AlertCircle } from "lucide-react";
import Link from "next/link";

const ERROR_MESSAGES: Record<string, string> = {
  "auth/invalid-credential": "Incorrect email or password. Please try again.",
  "auth/user-not-found": "No account found with this email.",
  "auth/wrong-password": "Incorrect password. Please try again.",
  "auth/too-many-requests": "Too many failed attempts. Please try again later.",
  "auth/network-request-failed": "Network error. Check your connection.",
};

export default function LoginPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setError("");
    setLoading(true);
    try {
      await signIn(email.trim(), password);
      // session cookie is set in layout.tsx via useEffect after auth state resolves
      // router.replace('/dashboard') is also handled in layout.tsx
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
      setError(ERROR_MESSAGES[code] ?? "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#EEF1F8] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src="/Logo-Blue.png" alt="Nablis" className="h-20 w-auto mx-auto mb-4" />
          <p className="text-[#9CA3AF] text-sm mt-1">Sign in to your account</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#E5E7EB] p-7">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="you@example.com"
                className="w-full px-4 py-2.5 rounded-xl border border-[#E5E7EB] text-sm text-[#374151] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#1B2E6B]/20 focus:border-[#1B2E6B] transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 pr-10 rounded-xl border border-[#E5E7EB] text-sm text-[#374151] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#1B2E6B]/20 focus:border-[#1B2E6B] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#6B7280] transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 text-red-500 text-sm bg-red-50 rounded-xl px-3 py-2.5">
                <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-[#1B2E6B] text-white font-semibold py-2.5 rounded-xl hover:bg-[#162554] active:bg-[#111d44] transition-colors disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Signing in…
                </>
              ) : (
                "Sign In"
              )}
            </button>
          </form>
        </div>

        <div className="text-center mt-5 space-y-2">
          <p className="text-[#9CA3AF] text-xs">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="text-[#1B2E6B] font-semibold hover:underline">
              Create Account
            </Link>
          </p>
          <p className="text-center text-[#9CA3AF] text-xs">
            Nablis Ministry · Dubai, UAE
          </p>
        </div>
      </div>
    </div>
  );
}
