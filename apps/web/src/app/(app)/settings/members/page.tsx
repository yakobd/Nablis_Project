"use client";
import React, { useEffect, useState, useRef } from "react";
import {
  collection,
  query,
  orderBy,
  getDocs,
  limit,
  startAfter,
  where,
  type QueryDocumentSnapshot,
  type DocumentData,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";
import {
  Search,
  MoreVertical,
  Eye,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { User } from "@nablis/shared/firebase";

const PAGE_SIZE = 10;

function AccessBadge({ role, status }: { role: string; status: string }) {
  if (status === "pending")  return <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-yellow-50 text-yellow-700">Pending</span>;
  if (status === "rejected") return <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-50 text-red-600">Rejected</span>;
  if (role === "admin")      return <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#EEF1F8] text-[#1B2E6B]">Admin</span>;
  return <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-green-50 text-green-700">Member</span>;
}

function fmtDate(ts: { toDate: () => Date } | null | undefined) {
  if (!ts) return "—";
  try { return ts.toDate().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
  catch { return "—"; }
}

export default function MembersPage() {
  const [members, setMembers]           = useState<User[]>([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState("");
  const [roleFilter, setRoleFilter]     = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [cursor, setCursor]             = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasPrev, setHasPrev]           = useState(false);
  const [hasNext, setHasNext]           = useState(false);
  const [openMenu, setOpenMenu]         = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpenMenu(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function fetchPage(after?: QueryDocumentSnapshot<DocumentData>) {
    setLoading(true);
    try {
      const constraints: Parameters<typeof query>[1][] = [orderBy("createdAt", "desc"), limit(PAGE_SIZE + 1)];
      if (roleFilter !== "all")   constraints.push(where("role", "==", roleFilter));
      if (statusFilter !== "all") constraints.push(where("status", "==", statusFilter));
      if (after) constraints.push(startAfter(after));

      const snap = await getDocs(query(collection(db, "users"), ...constraints));
      const docs = snap.docs;
      const page = docs.slice(0, PAGE_SIZE).map((d) => ({ id: d.id, ...d.data() } as User));

      setMembers(page);
      setHasNext(docs.length > PAGE_SIZE);
      setCursor(docs[PAGE_SIZE - 1] ?? null);
      setHasPrev(!!after);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchPage(); }, [roleFilter, statusFilter]); // eslint-disable-line

  async function handleDelete(userId: string) {
    if (!confirm("Remove this member? This cannot be undone.")) return;
    await deleteDoc(doc(db, "users", userId));
    setMembers((p) => p.filter((m) => m.id !== userId));
    setOpenMenu(null);
  }

  const filtered = search
    ? members.filter(
        (m) =>
          m.displayName?.toLowerCase().includes(search.toLowerCase()) ||
          m.email.toLowerCase().includes(search.toLowerCase())
      )
    : members;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#1B2E6B]">Members</h1>
          <p className="text-[#9CA3AF] text-sm mt-0.5">Manage all ministry members</p>
        </div>
        <Link
          href="/settings/members/new"
          className="flex items-center gap-1.5 bg-[#F5C518] text-[#1B2E6B] font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-[#e6b800] transition-colors"
        >
          + New Members
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full pl-8 pr-3 py-2 rounded-xl border border-[#E5E7EB] text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#1B2E6B]/20 focus:border-[#1B2E6B] transition-colors"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-3 py-2 rounded-xl border border-[#E5E7EB] text-sm text-[#374151] bg-white focus:outline-none"
        >
          <option value="all">All Roles</option>
          <option value="admin">Admin</option>
          <option value="member">Member</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-xl border border-[#E5E7EB] text-sm text-[#374151] bg-white focus:outline-none"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="pending">Pending</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center">
            <div className="w-7 h-7 border-2 border-[#1B2E6B] border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-[#9CA3AF]">
            <p className="text-4xl mb-2">👥</p>
            <p className="text-sm font-medium">No members found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F9FAFB] border-b border-[#F3F4F6]">
                  {["Member", "Email", "Access", "Date Added", ""].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-[#9CA3AF] text-xs font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {filtered.map((m) => (
                  <tr key={m.id} className="hover:bg-[#F9FAFB] transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-[#EEF1F8] flex items-center justify-center flex-shrink-0">
                          {m.photoURL ? (
                            <img src={m.photoURL} alt={m.displayName} className="w-8 h-8 rounded-full object-cover" />
                          ) : (
                            <span className="text-[#1B2E6B] font-semibold text-xs">
                              {(m.displayName || m.email)[0].toUpperCase()}
                            </span>
                          )}
                        </div>
                        <span className="text-[#374151] font-medium text-xs">{m.displayName || "—"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#6B7280] text-xs">{m.email}</td>
                    <td className="px-4 py-3"><AccessBadge role={m.role} status={m.status} /></td>
                    <td className="px-4 py-3 text-[#6B7280] text-xs">{fmtDate(m.createdAt)}</td>
                    <td className="px-4 py-3 relative">
                      <div ref={openMenu === m.id ? menuRef : undefined}>
                        <button
                          onClick={() => setOpenMenu((prev) => (prev === m.id ? null : m.id))}
                          className="p-1.5 rounded-lg hover:bg-[#EEF1F8] text-[#9CA3AF] transition-colors"
                        >
                          <MoreVertical size={15} />
                        </button>
                        {openMenu === m.id && (
                          <div className="absolute right-4 top-full mt-1 w-36 bg-white rounded-xl border border-[#E5E7EB] shadow-lg py-1 z-10">
                            <Link
                              href={`/settings/members/${m.id}`}
                              className="flex items-center gap-2 px-3 py-2 text-xs text-[#374151] hover:bg-[#EEF1F8] transition-colors"
                              onClick={() => setOpenMenu(null)}
                            >
                              <Eye size={13} /> View
                            </Link>
                            <Link
                              href={`/settings/members/${m.id}/edit`}
                              className="flex items-center gap-2 px-3 py-2 text-xs text-[#374151] hover:bg-[#EEF1F8] transition-colors"
                              onClick={() => setOpenMenu(null)}
                            >
                              <Pencil size={13} /> Edit
                            </Link>
                            <button
                              onClick={() => handleDelete(m.id)}
                              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-500 hover:bg-red-50 transition-colors"
                            >
                              <Trash2 size={13} /> Remove
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[#F3F4F6]">
            <p className="text-xs text-[#9CA3AF]">
              Showing {filtered.length} result{filtered.length !== 1 ? "s" : ""}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => fetchPage()}
                disabled={!hasPrev}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#E5E7EB] text-xs text-[#374151] hover:bg-[#EEF1F8] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={13} /> Previous
              </button>
              <button
                onClick={() => cursor && fetchPage(cursor)}
                disabled={!hasNext}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#E5E7EB] text-xs text-[#374151] hover:bg-[#EEF1F8] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next <ChevronRight size={13} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
