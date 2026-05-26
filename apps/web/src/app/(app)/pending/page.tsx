"use client";
import React, { useEffect } from "react";
import { useAuth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { Clock, CheckCircle, Mail, Phone, MapPin, Church } from "lucide-react";

export default function PendingPage() {
  const { user, signOut, loading } = useAuth();
  const router = useRouter();

  // useAuth uses onSnapshot — status updates in real-time.
  // Redirect to dashboard the moment it becomes active.
  useEffect(() => {
    if (!loading && user && user.status === "active") {
      router.replace("/dashboard");
    }
  }, [user?.status, loading, router]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#EEF1F8] flex items-center justify-center">
        <div className="w-7 h-7 border-2 border-[#1B2E6B] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#EEF1F8] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-[#1B2E6B] flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-[#F5C518] font-bold text-2xl leading-none">ን</span>
          </div>
          <h1 className="text-2xl font-bold text-[#1B2E6B]">ናቡስ Ministry</h1>
        </div>

        {/* Pending card */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#E5E7EB] p-7 text-center">
          <div className="w-16 h-16 rounded-full bg-yellow-50 flex items-center justify-center mx-auto mb-4">
            <Clock size={28} className="text-yellow-500" />
          </div>
          <h2 className="text-xl font-bold text-[#1B2E6B] mb-2">Awaiting Approval</h2>
          <p className="text-[#6B7280] text-sm leading-relaxed mb-6">
            Your registration has been submitted and is awaiting review by the Spiritual Father.
            You will be notified once your account is approved.
          </p>

          {/* Steps */}
          <div className="space-y-3 text-left mb-6">
            {[
              { label: "Registration submitted", done: true, active: false },
              { label: "Under review by Spiritual Father", done: false, active: true },
              { label: "Account activated", done: false, active: false },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-3">
                <div className={[
                  "w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0",
                  s.done ? "bg-green-100" : s.active ? "bg-yellow-100" : "bg-[#F3F4F6]",
                ].join(" ")}>
                  {s.done ? (
                    <CheckCircle size={14} className="text-green-600" />
                  ) : (
                    <div className={`w-2 h-2 rounded-full ${s.active ? "bg-yellow-500" : "bg-[#D1D5DB]"}`} />
                  )}
                </div>
                <span className={`text-sm ${s.done ? "text-green-700 font-medium" : s.active ? "text-yellow-700 font-medium" : "text-[#9CA3AF]"}`}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>

          {/* Registration details */}
          {user && (
            <div className="bg-[#F9FAFB] rounded-xl p-4 text-left space-y-2 mb-6">
              <p className="text-xs font-semibold text-[#9CA3AF] mb-2">YOUR REGISTRATION DETAILS</p>
              <div className="flex items-center gap-2 text-sm text-[#374151]">
                <Mail size={13} className="text-[#9CA3AF] flex-shrink-0" />
                <span className="truncate">{user.email}</span>
              </div>
              {user.displayName && (
                <div className="flex items-center gap-2 text-sm text-[#374151]">
                  <span className="text-[#9CA3AF] flex-shrink-0 text-xs">👤</span>
                  <span>{user.displayName}</span>
                </div>
              )}
              {user.phone && (
                <div className="flex items-center gap-2 text-sm text-[#374151]">
                  <Phone size={13} className="text-[#9CA3AF] flex-shrink-0" />
                  <span>{user.phone}</span>
                </div>
              )}
              {(user.cityOfResidence || user.countryOfResidence) && (
                <div className="flex items-center gap-2 text-sm text-[#374151]">
                  <MapPin size={13} className="text-[#9CA3AF] flex-shrink-0" />
                  <span>{[user.cityOfResidence, user.countryOfResidence].filter(Boolean).join(", ")}</span>
                </div>
              )}
              {user.parishChurch && (
                <div className="flex items-center gap-2 text-sm text-[#374151]">
                  <Church size={13} className="text-[#9CA3AF] flex-shrink-0" />
                  <span>{user.parishChurch}</span>
                </div>
              )}
            </div>
          )}

          <button
            onClick={handleSignOut}
            className="w-full py-2.5 rounded-xl border border-[#E5E7EB] text-sm font-semibold text-[#374151] hover:bg-[#EEF1F8] transition-colors"
          >
            Sign Out
          </button>
        </div>

        <p className="text-center text-[#9CA3AF] text-xs mt-4">
          This page updates automatically when your status changes
        </p>
      </div>
    </div>
  );
}
