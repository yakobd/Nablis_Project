"use client";
import React from "react";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db, isOnline, notify, type User } from "@/lib/firebase";
import { useTranslation } from "@nablis/i18n";
import i18n from "@nablis/i18n";
import { dateLocale } from "@/lib/locale";

export function MemberAvatar({ m, size = 40, dot = false }: { m: Pick<User, "displayName" | "email" | "photoURL" | "lastSeen">; size?: number; dot?: boolean }) {
  const online = dot && isOnline(m.lastSeen);
  return (
    <span className="relative inline-block flex-shrink-0" style={{ width: size, height: size }}>
      {m.photoURL
        ? <img src={m.photoURL} alt="" className="w-full h-full rounded-full object-cover" />
        : <span className="w-full h-full rounded-full bg-[#EEF1F8] text-[#1E3A8A] font-bold flex items-center justify-center" style={{ fontSize: size * 0.36 }}>
            {(m.displayName || m.email || "?").trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
          </span>}
      {online && <span className="absolute bottom-[4%] right-[4%] w-[22%] h-[22%] min-w-2.5 min-h-2.5 rounded-full bg-[#22C55E] ring-2 ring-white" />}
    </span>
  );
}

export function AccessPills({ role }: { role: User["role"] }) {
  const { t } = useTranslation();
  return (
    <span className="inline-flex flex-wrap gap-1.5">
      {role === "super_admin" && <span className="px-3 py-1 rounded-full text-xs font-medium bg-[#FEF9C3] text-[#CA8A04] border border-[#FDE68A]">{t("members.father")}</span>}
      {role === "admin" && <span className="px-3 py-1 rounded-full text-xs font-medium bg-[#FEF9C3] text-[#CA8A04] border border-[#FDE68A]">{t("members.admin")}</span>}
      <span className="px-3 py-1 rounded-full text-xs font-medium bg-[#EEF2FF] text-[#1E3A8A]">{t("status.member")}</span>
    </span>
  );
}

export function StatusPill({ status }: { status: User["status"] }) {
  const { t } = useTranslation();
  const cls: Record<User["status"], string> = {
    active: "bg-[#DCFCE7] text-[#15803D]",
    pending: "bg-[#FEF3C7] text-[#B45309]",
    rejected: "bg-[#FEE2E2] text-[#B91C1C]",
    suspended: "bg-[#F3F4F6] text-[#4B5563]",
  };
  return <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${cls[status] ?? cls.suspended}`}>{t(`memberStatus.${status}`, { defaultValue: status })}</span>;
}

export function fmtDay(ts?: { toDate?: () => Date } | null, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" }) {
  const d = ts?.toDate?.();
  return d ? d.toLocaleDateString(dateLocale(), opts) : "—";
}

export function requestedAgo(ts?: { toDate?: () => Date } | null) {
  const d = ts?.toDate?.();
  if (!d) return i18n.t("members.reqRecently");
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 60) return i18n.t("members.reqMins", { n: Math.max(mins, 1) });
  const h = Math.floor(mins / 60);
  if (h < 24) return i18n.t("members.reqHours", { count: h });
  const days = Math.floor(h / 24);
  if (days === 1) return i18n.t("members.reqYesterday");
  return i18n.t("members.reqDays", { n: days });
}

export const phoneOf = (m: User) => m.phoneNumber || m.phone || "";
export const cityOf = (m: User) => m.cityOfResidence || m.city || "";

/**
 * Approves or rejects a registration and tells the member. Only the super
 * admin may change status (see firestore.rules).
 */
export async function decideRegistration(m: User, status: "active" | "rejected" | "pending") {
  await updateDoc(doc(db, "users", m.id), { status, updatedAt: serverTimestamp() });
  if (status === "pending") return;
  await notify({
    userId: m.id,
    type: status === "active" ? "member_approved" : "member_rejected",
    link: status === "active" ? "/dashboard" : undefined,
    title: status === "active" ? "Welcome to Nablis Ministry!" : "Registration update",
    description: status === "active"
      ? "Your account has been approved. You now have full access to the app."
      : "Your registration was not approved. Please contact the ministry for details.",
  }).catch(() => {});
}

