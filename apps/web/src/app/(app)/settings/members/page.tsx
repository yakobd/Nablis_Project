"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, updateDoc } from "firebase/firestore";
import { Search, SlidersHorizontal, MoreVertical, Eye, Pencil, MessageSquare, ShieldCheck, ShieldOff, Ban, RotateCcw, Trash2, Download, X } from "lucide-react";
import { db, useAuth, presenceLabel, type User } from "@/lib/firebase";
import { Pagination } from "@/components/ui/Pagination";
import { useToast } from "@/components/ui/Toast";
import { AccessPills, MemberAvatar, StatusPill, fmtDay, phoneOf, cityOf } from "./_components/shared";
import { useTranslation } from "@nablis/i18n";

const PAGE = 8;
type RoleFilter = "all" | "member" | "admin";
type StatusFilter = "all" | "active" | "suspended" | "rejected";

function lastActive(m: User) {
  if (!m.lastSeen) return "—";
  const label = presenceLabel(m.lastSeen);
  return label.startsWith("Last seen") ? fmtDay(m.lastSeen) : label;
}

function RowMenu({ m, isSuperAdmin, onAction }: { m: User; isSuperAdmin: boolean; onAction: (a: string, m: User) => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const items: { key: string; label: string; Icon: typeof Eye; danger?: boolean; show: boolean }[] = [
    { key: "view", label: "View details", Icon: Eye, show: true },
    { key: "edit", label: "Edit profile", Icon: Pencil, show: m.role === "member" || isSuperAdmin },
    { key: "message", label: "Message", Icon: MessageSquare, show: m.role === "member" },
    { key: "promote", label: "Make admin", Icon: ShieldCheck, show: isSuperAdmin && m.role === "member" },
    { key: "demote", label: "Remove admin", Icon: ShieldOff, show: isSuperAdmin && m.role === "admin" },
    { key: "suspend", label: "Suspend", Icon: Ban, show: isSuperAdmin && m.status === "active" && m.role !== "super_admin" },
    { key: "reactivate", label: "Reactivate", Icon: RotateCcw, show: isSuperAdmin && (m.status === "suspended" || m.status === "rejected") },
    { key: "delete", label: "Delete", Icon: Trash2, danger: true, show: isSuperAdmin && m.role !== "super_admin" },
  ];

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-label={t("members.actions")} className="p-2 rounded-lg text-[#6B7280] hover:bg-[#F3F4F6]">
        <MoreVertical size={17} />
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-20 w-48 bg-white rounded-2xl shadow-xl border border-[#F3F4F6] py-2 animate-scale-in origin-top-right">
          {items.filter((i) => i.show).map(({ key, label, Icon, danger }) => (
            <button key={key} onClick={() => { setOpen(false); onAction(key, m); }}
              className={`w-full flex items-center gap-2.5 px-4 py-2 text-sm text-left ${danger ? "text-[#DC2626] hover:bg-[#FEF2F2]" : "text-[#374151] hover:bg-[#F9FAFB]"}`}>
              <Icon size={15} /> {t(`members.menu.${key}`, { defaultValue: label })}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MemberManagementPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const { user, role } = useAuth();
  const isStaff = role === "admin" || role === "super_admin";
  const isSuperAdmin = role === "super_admin";
  const [all, setAll] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isStaff) return;
    return onSnapshot(collection(db, "users"), (snap) => {
      setAll(snap.docs.map((d) => ({ id: d.id, ...d.data() } as User)));
      setLoading(false);
    }, () => setLoading(false));
  }, [isStaff]);

  // Pending registrations live under New Members.
  const users = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all
      .filter((m) => m.status !== "pending")
      .filter((m) => roleFilter === "all" || (roleFilter === "admin" ? m.role !== "member" : m.role === "member"))
      .filter((m) => statusFilter === "all" || m.status === statusFilter)
      .filter((m) => !q || `${m.displayName} ${m.email} ${phoneOf(m)} ${cityOf(m)} ${m.christianName ?? ""}`.toLowerCase().includes(q))
      .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
  }, [all, search, roleFilter, statusFilter]);

  const pageRows = users.slice((page - 1) * PAGE, page * PAGE);
  const allOnPage = pageRows.length > 0 && pageRows.every((m) => selected.has(m.id));
  const filtersOn = roleFilter !== "all" || statusFilter !== "all";

  useEffect(() => { setPage(1); }, [search, roleFilter, statusFilter]);

  function toggle(id: string) {
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function togglePage() {
    setSelected((s) => {
      const n = new Set(s);
      pageRows.forEach((m) => (allOnPage ? n.delete(m.id) : n.add(m.id)));
      return n;
    });
  }

  function exportCsv() {
    const rows = all.filter((m) => selected.has(m.id));
    const esc = (v: string) => `"${(v ?? "").replace(/"/g, '""')}"`;
    const csv = [
      ["Name", "Christian name", "Email", "Phone", "City", "Country", "Parish", "Role", "Status", "Date added"].join(","),
      ...rows.map((m) => [m.displayName, m.christianName ?? "", m.email, phoneOf(m), cityOf(m), m.countryOfResidence ?? "", m.parishChurch ?? "", m.role, m.status, fmtDay(m.createdAt)].map(esc).join(",")),
    ].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `nablis-members-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function onAction(action: string, m: User) {
    if (action === "view") return router.push(`/settings/members/${m.id}`);
    if (action === "edit") return router.push(`/settings/members/${m.id}/edit`);
    if (action === "message") return router.push(`/messaging?member=${m.id}`);
    const name = m.displayName || m.email;
    try {
      const ref = doc(db, "users", m.id);
      if (action === "promote") {
        await updateDoc(ref, { role: "admin", updatedAt: serverTimestamp() });
        toast({ message: t("members.promoted", { name }), actionLabel: t("groups.undo"), onAction: () => updateDoc(ref, { role: "member" }) });
      } else if (action === "demote") {
        await updateDoc(ref, { role: "member", updatedAt: serverTimestamp() });
        toast({ message: t("members.demoted", { name }), actionLabel: t("groups.undo"), onAction: () => updateDoc(ref, { role: "admin" }) });
      } else if (action === "suspend") {
        if (!confirm(t("members.suspendConfirm", { name }))) return;
        await updateDoc(ref, { status: "suspended", updatedAt: serverTimestamp() });
        toast({ message: t("members.suspended", { name }), actionLabel: t("groups.undo"), onAction: () => updateDoc(ref, { status: "active" }) });
      } else if (action === "reactivate") {
        await updateDoc(ref, { status: "active", updatedAt: serverTimestamp() });
        toast({ message: t("members.reactivated", { name }) });
      } else if (action === "delete") {
        if (!confirm(t("members.deleteConfirm", { name }))) return;
        await deleteDoc(ref);
        toast({ message: t("members.deleted", { name }) });
      }
    } catch {
      toast({ message: t("members.actionError"), type: "error" });
    }
  }

  if (!user) return null;
  if (!isStaff) {
    return <div className="bg-white rounded-3xl p-12 text-center text-sm text-[#6B7280]">{t("members.onlyStaff")}</div>;
  }

  return (
    <div className="bg-white rounded-3xl shadow-sm overflow-hidden animate-fade-up">
      <div className="px-6 sm:px-10 pt-8 sm:pt-10">
        <h2 className="font-display text-3xl font-bold text-[#111827]">{t("members.title")}</h2>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mt-6 pb-6">
          <p className="flex items-center gap-3 text-lg font-semibold text-[#111827]">
            All users <span className="px-2.5 py-0.5 rounded-full bg-[#F3F4F6] text-xs font-medium text-[#374151]">{users.length} users</span>
          </p>
          <div className="flex items-center gap-3 relative">
            <div className="relative flex-1 md:w-72">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("common.search")}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#E5E7EB] text-sm focus:outline-none focus:border-[#1E3A8A] focus:ring-2 focus:ring-[#1E3A8A]/15" />
            </div>
            <button onClick={() => setFiltersOpen((o) => !o)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium ${filtersOn ? "border-[#1E3A8A] text-[#1E3A8A] bg-[#EEF1F8]" : "border-[#E5E7EB] text-[#374151] hover:bg-[#F9FAFB]"}`}>
              <SlidersHorizontal size={15} /> {t("members.filters")}
            </button>
            {filtersOpen && (
              <div className="absolute right-0 top-12 z-20 w-64 bg-white rounded-2xl shadow-xl border border-[#F3F4F6] p-4 space-y-4 animate-scale-in origin-top-right">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF] mb-2">{t("members.access")}</p>
                  <div className="flex flex-wrap gap-2">
                    {(["all", "member", "admin"] as RoleFilter[]).map((r) => (
                      <button key={r} onClick={() => setRoleFilter(r)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize ${roleFilter === r ? "bg-[#1E3A8A] text-white" : "bg-[#F3F4F6] text-[#374151]"}`}>{r === "admin" ? t("members.admins") : r === "member" ? t("members.membersOnly") : t("groups.filter.all")}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF] mb-2">{t("study.status")}</p>
                  <div className="flex flex-wrap gap-2">
                    {(["all", "active", "suspended", "rejected"] as StatusFilter[]).map((s) => (
                      <button key={s} onClick={() => setStatusFilter(s)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize ${statusFilter === s ? "bg-[#1E3A8A] text-white" : "bg-[#F3F4F6] text-[#374151]"}`}>{s === "all" ? t("groups.filter.all") : t(`memberStatus.${s}`)}</button>
                    ))}
                  </div>
                </div>
                {filtersOn && (
                  <button onClick={() => { setRoleFilter("all"); setStatusFilter("all"); }} className="text-xs font-semibold text-[#1E3A8A]">{t("members.clearFilters")}</button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="mx-6 sm:mx-10 mb-3 flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-[#1E3A8A] text-white text-sm animate-fade-up">
          <span>{t("members.selected", { n: selected.size })}</span>
          <div className="flex items-center gap-2">
            <button onClick={exportCsv} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-xs font-semibold"><Download size={13} /> {t("members.exportCsv")}</button>
            <button onClick={() => setSelected(new Set())} aria-label={t("members.clearSelection")} className="p-1.5 rounded-lg hover:bg-white/15"><X size={14} /></button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-16"><div className="w-7 h-7 border-2 border-[#1B2E6B] border-t-transparent rounded-full animate-spin mx-auto" /></div>
      ) : users.length === 0 ? (
        <p className="py-16 text-center text-sm text-[#6B7280]">{t("members.noMatch")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="bg-[#F9FAFB] text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
                <th className="pl-6 sm:pl-10 pr-2 py-4 w-10">
                  <input type="checkbox" checked={allOnPage} onChange={togglePage} aria-label={t("members.selectPage")} className="w-4 h-4 rounded-full accent-[#1E3A8A] cursor-pointer" />
                </th>
                <th className="px-4 py-4 text-left">{t("members.userName")}</th>
                <th className="px-4 py-4 text-center">{t("members.access")}</th>
                <th className="px-4 py-4 text-center">{t("members.lastActive")}</th>
                <th className="px-4 py-4 text-center">{t("members.dateAdded")}</th>
                <th className="pr-6 sm:pr-8 py-4 w-12" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F4F6] stagger">
              {pageRows.map((m) => (
                <tr key={m.id} className={`transition-colors ${selected.has(m.id) ? "bg-[#F5F7FF]" : "hover:bg-[#F9FAFB]"}`}>
                  <td className="pl-6 sm:pl-10 pr-2 py-4">
                    <input type="checkbox" checked={selected.has(m.id)} onChange={() => toggle(m.id)} aria-label={`Select ${m.displayName}`} className="w-4 h-4 accent-[#1E3A8A] cursor-pointer" />
                  </td>
                  <td className="px-4 py-4">
                    <Link href={`/settings/members/${m.id}`} className="flex items-center gap-3 group">
                      <MemberAvatar m={m} size={42} dot />
                      <span className="min-w-0">
                        <span className="flex items-center gap-2">
                          <span className="font-semibold text-[#111827] group-hover:text-[#1E3A8A] truncate">{m.displayName || "—"}</span>
                          {m.status !== "active" && <StatusPill status={m.status} />}
                        </span>
                        <span className="block text-[#6B7280] truncate">{m.email}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-4 text-center"><AccessPills role={m.role} /></td>
                  <td className="px-4 py-4 text-center text-[#374151] whitespace-nowrap">{lastActive(m)}</td>
                  <td className="px-4 py-4 text-center text-[#374151] whitespace-nowrap">{fmtDay(m.createdAt)}</td>
                  <td className="pr-6 sm:pr-8 py-4 text-right">
                    {m.id !== user.id && <RowMenu m={m} isSuperAdmin={isSuperAdmin} onAction={onAction} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="px-6 sm:px-10 py-5 border-t border-[#F3F4F6]">
        <Pagination page={page} pageSize={PAGE} total={users.length} onPage={setPage} />
      </div>
    </div>
  );
}
