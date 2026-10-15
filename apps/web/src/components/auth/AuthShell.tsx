import React from "react";
import Link from "next/link";

// Underlined "glass" inputs used on the dark auth screens.
export const FIELD =
  "w-full bg-transparent border-0 border-b border-white/40 px-0 py-2 text-[15px] text-white placeholder-white/50 focus:outline-none focus:ring-0 focus:border-[#F5C518] transition-colors";
export const LABEL = "block text-[13px] font-semibold tracking-wide text-white/90 uppercase mb-1";

// Full-screen church wallpaper with a frosted-glass card (per the design).
export function AuthShell({
  mode,
  title,
  children,
  footer,
}: {
  mode: "login" | "register";
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden bg-[#1a120c]">
      <div
        className="absolute inset-0 bg-cover bg-center scale-105 animate-drift"
        style={{ backgroundImage: "url(/auth-bg.jpg)" }}
        aria-hidden="true"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/40 to-black/70" aria-hidden="true" />

      <div className="relative w-full max-w-[440px] stagger">
        <Link href="/" className="flex justify-center mb-6">
          <img src="/Logo-White.png" alt="Nablis" className="h-16 w-auto drop-shadow-lg" />
        </Link>

        <div className="rounded-[28px] bg-white/10 backdrop-blur-xl border border-white/20 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8)] p-6 sm:p-8">
          {/* Login / Sign up switch */}
          <div className="relative grid grid-cols-2 p-1 rounded-full bg-white/15 border border-white/20 mb-7">
            <span
              className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-full bg-white shadow transition-transform duration-300 ease-out ${mode === "register" ? "translate-x-full" : "translate-x-0"}`}
              style={{ left: 4 }}
              aria-hidden="true"
            />
            <Link href="/login"
              className={`relative z-10 text-center py-2 text-lg font-medium transition-colors ${mode === "login" ? "text-[#111827]" : "text-white/70 hover:text-white"}`}>
              Login
            </Link>
            <Link href="/register"
              className={`relative z-10 text-center py-2 text-lg font-medium transition-colors ${mode === "register" ? "text-[#111827]" : "text-white/70 hover:text-white"}`}>
              Sign up
            </Link>
          </div>

          <h1 className="text-white font-display font-bold text-xl mb-6">{title}</h1>
          {children}
        </div>

        {footer && <div className="text-center mt-5 text-white/70 text-xs space-y-1">{footer}</div>}
      </div>
    </div>
  );
}
