"use client";
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { Search, Mail, CalendarDays, ChevronDown, UserCheck, MapPin } from "lucide-react";
import { db, useAuth, type User } from "@/lib/firebase";
import { useToast } from "@/components/ui/Toast";
import { MemberAvatar, cityOf, decideRegistration, requestedAgo } from "../_components/shared";
import { useTranslation } from "@nablis/i18n";

const PAGE = 6;

// Requests waiting more than three days are flagged.
function isPriority(m: User) {
  const t = m.createdAt?.toMillis?.();
  return !!t && Date.now() - t > 3 * 24 * 60 * 60 * 1000;
}

export default function NewMembersPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const { role } = useAuth();
  const isStaff = role === "admin" || role === "super_admin";
  const canDecide = role === "super_admin";
  const [pending, setPending] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [shown, setShown] = useState(PAGE);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!isStaff) return;
    return onSnapshot(query(collection(db, "users"), where("status", "==", "pending")), (snap) => {
      setPending(snap.docs.map((d) => ({ id: d.id, ...d.data() } as User)));
      setLoading(false);
    }, () => setLoading(false));
  }, [isStaff]);

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return pending
      .filter((m) => !q || `${m.displayName} ${m.email} ${cityOf(m)}`.toLowerCase().includes(q))
      // Oldest first, so nobody waits too long.
      .sort((a, b) => (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0));
  }, [pending, search]);

  async function decide(m: User, status: "active" | "rejected") {
    if (status === "rejected" && !confirm(`Reject ${m.displayName || m.email}'s registration?`)) return;
    setBusy(m.id);
    try {
      await decideRegistration(m, status);
      toast({
        message: status === "active" ? t("members.approved") : t("members.rejected"),
        type: status === "active" ? "success" : "error",
        actionLabel: t("groups.undo"),
        onAction: () => decideRegistration(m, "pending").catch(() => {}),
        linkLabel: t("members.viewProfile"),
        onLink: () => router.push(`/settings/members/${m.id}`),
      });
    } catch {
      toast({ message: t("members.decideError"), type: "error" });
    } finally {
      setBusy(null);
    }
  }

  if (!isStaff) {
    return <div className="bg-white rounded-3xl p-12 text-center text-sm text-[#6B7280]">{t("members.onlyStaffReview")}</div>;
  }

  return (
    <div className="bg-white rounded-3xl shadow-sm p-6 sm:p-10 animate-fade-up">
      <h2 className="font-display text-3xl font-bold text-[#111827]">{t("members.newTitle")}</h2>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mt-6">
        <p className="flex items-center gap-3 text-lg font-semibold text-[#111827]">
          Pending requests <span className="px-2.5 py-0.5 rounded-full bg-[#F3F4F6] text-xs font-medium text-[#374151]">{pending.length} users</span>
        </p>
        <div className="relative md:w-72">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setShown(PAGE); }} placeholder={t("common.search")}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#E5E7EB] text-sm focus:outline-none focus:border-[#1E3A8A] focus:ring-2 focus:ring-[#1E3A8A]/15" />
        </div>
      </div>
      {!canDecide && pending.length > 0 && (
        <p className="mt-4 text-xs text-[#B45309] bg-[#FFFBEB] rounded-xl px-4 py-2.5">{t("members.onlyFatherDecides")}</p>
      )}

      {loading ? (
        <div className="py-16"><div className="w-7 h-7 border-2 border-[#1B2E6B] border-t-transparent rounded-full animate-spin mx-auto" /></div>
      ) : list.length === 0 ? (
        <div className="mt-8 py-14 rounded-2xl border-2 border-dashed border-[#E5E7EB] text-center">
          <UserCheck size={34} className="mx-auto text-[#1E3A8A]/30" />
          <p className="text-[#374151] font-medium mt-3">{search ? t("members.noRequestsMatch") : t("members.caughtUp")}</p>
          {!search && <p className="text-sm text-[#9CA3AF] mt-1">{t("members.caughtUpHint")}</p>}
        </div>
      ) : (
        <>
          <div className="grid md:grid-cols-2 gap-6 mt-8 stagger">
            {list.slice(0, shown).map((m) => {
              const priority = isPriority(m);
              return (
                <div key={m.id} className={`rounded-2xl border overflow-hidden flex flex-col hover:shadow-lg transition-shadow ${priority ? "border-[#FED7AA]" : "border-[#E5E7EB]"}`}>
                  <div className="p-6 flex-1">
                    <div className="flex items-start justify-between">
                      <span className="rounded-2xl overflow-hidden"><MemberAvatar m={m} size={72} /></span>
                      <div className="flex flex-col items-end gap-1.5">
                        <span className="px-3 py-1 rounded-full bg-[#FEF3C7] text-[#B45309] text-xs font-bold tracking-wider">{t("members.pendingBadge")}</span>
                        {priority && <span className="px-2 py-0.5 rounded-md bg-[#FFEDD5] text-[#C2410C] text-[10px] font-bold tracking-wider">{t("members.priority")}</span>}
                      </div>
                    </div>
                    <p className="text-lg font-semibold text-[#111827] mt-4">{m.displayName || "Unnamed"}</p>
                    <p className="text-sm text-[#1E3A8A]">{t("members.newMember")}{m.christianName ? ` · ${m.christianName}` : ""}</p>
                    <div className="mt-4 space-y-2 text-sm text-[#4B5563]">
                      <p className="flex items-center gap-2 truncate"><Mail size={15} className="text-[#9CA3AF] flex-shrink-0" /> {m.email}</p>
                      {cityOf(m) && <p className="flex items-center gap-2"><MapPin size={15} className="text-[#9CA3AF] flex-shrink-0" /> {[cityOf(m), m.countryOfResidence].filter(Boolean).join(", ")}</p>}
                      <p className="flex items-center gap-2"><CalendarDays size={15} className="text-[#9CA3AF] flex-shrink-0" /> {requestedAgo(m.createdAt)}</p>
                    </div>
                  </div>
                  <div className="flex gap-2.5 px-6 py-4 bg-[#F9FAFB] border-t border-[#F3F4F6]">
                    {canDecide && (
                      <button onClick={() => decide(m, "active")} disabled={busy === m.id}
                        className="flex-1 py-2.5 rounded-lg bg-[#1E3A8A] text-white text-sm font-semibold hover:bg-[#1B2E6B] shadow-[0_8px_18px_-10px_rgba(30,58,138,0.9)] disabled:opacity-60">
                        {t("members.approve")}
                      </button>
                    )}
                    <Link href={`/settings/members/${m.id}`} className="flex-1 py-2.5 rounded-lg bg-[#E5E9F2] text-[#1F2937] text-sm font-semibold text-center hover:bg-[#D8DFEE]">{t("common.view")}</Link>
                    {canDecide && (
                      <button onClick={() => decide(m, "rejected")} disabled={busy === m.id}
                        className="flex-1 py-2.5 rounded-lg border border-[#E5E7EB] bg-white text-[#6B7280] text-sm font-semibold hover:text-[#DC2626] hover:border-[#FCA5A5] disabled:opacity-60">
                        {t("members.reject")}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {list.length > shown && (
            <div className="flex justify-center mt-8">
              <button onClick={() => setShown((n) => n + PAGE)}
                className="flex items-center gap-2 px-7 py-3 rounded-xl border border-[#E5E7EB] text-[#1F2937] font-semibold hover:bg-[#F9FAFB]">
                {t("members.loadMore")} <ChevronDown size={17} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
