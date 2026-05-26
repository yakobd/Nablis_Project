"use client";
import React, { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  limit,
  startAfter,
  updateDoc,
  doc,
  type QueryDocumentSnapshot,
  type DocumentData,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";
import { Clock, CheckCircle, XCircle, Eye } from "lucide-react";
import type { User } from "@nablis/shared/firebase";

const PAGE_SIZE = 12;

function timeAgo(ts: Timestamp | null | undefined): string {
  if (!ts) return "—";
  try {
    const diff = Date.now() - ts.toDate().getTime();
    const mins  = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    const days  = Math.floor(hours / 24);
    if (days > 0)  return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (mins > 0)  return `${mins}m ago`;
    return "Just now";
  } catch { return "—"; }
}

function isPriority(ts: Timestamp | null | undefined): boolean {
  if (!ts) return false;
  try {
    const diff = Date.now() - ts.toDate().getTime();
    return diff > 3 * 24 * 60 * 60 * 1000; // > 3 days
  } catch { return false; }
}

export default function NewMembersPage() {
  const [members, setMembers]     = useState<User[]>([]);
  const [loading, setLoading]     = useState(true);
  const [cursor, setCursor]       = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore]     = useState(false);
  const [acting, setActing]       = useState<Record<string, boolean>>({});

  async function fetchPage(after?: QueryDocumentSnapshot<DocumentData>) {
    setLoading(true);
    try {
      const constraints: Parameters<typeof query>[1][] = [
        where("status", "==", "pending"),
        orderBy("createdAt", "asc"),
        limit(PAGE_SIZE + 1),
      ];
      if (after) constraints.push(startAfter(after));

      const snap = await getDocs(query(collection(db, "users"), ...constraints));
      const docs = snap.docs;
      const page = docs.slice(0, PAGE_SIZE).map((d) => ({ id: d.id, ...d.data() } as User));

      if (after) {
        setMembers((prev) => [...prev, ...page]);
      } else {
        setMembers(page);
      }
      setHasMore(docs.length > PAGE_SIZE);
      setCursor(docs[PAGE_SIZE - 1] ?? null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchPage(); }, []); // eslint-disable-line

  async function handleAction(userId: string, approve: boolean) {
    setActing((p) => ({ ...p, [userId]: true }));
    try {
      await updateDoc(doc(db, "users", userId), {
        status: approve ? "active" : "rejected",
      });
      setMembers((p) => p.filter((m) => m.id !== userId));
    } finally {
      setActing((p) => ({ ...p, [userId]: false }));
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#1B2E6B]">New Members</h1>
          <p className="text-[#9CA3AF] text-sm mt-0.5">Review and approve pending member requests</p>
        </div>
        {members.length > 0 && (
          <span className="bg-red-100 text-red-600 text-xs font-bold px-2.5 py-1 rounded-full">
            {members.length} pending
          </span>
        )}
      </div>

      {loading && members.length === 0 ? (
        <div className="py-16 text-center">
          <div className="w-7 h-7 border-2 border-[#1B2E6B] border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : members.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm py-16 text-center text-[#9CA3AF]">
          <p className="text-4xl mb-2">✅</p>
          <p className="text-sm font-medium">All caught up!</p>
          <p className="text-xs mt-1">No pending member requests.</p>
        </div>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {members.map((m) => {
              const priority = isPriority(m.createdAt);
              const initials = (m.displayName || m.email)[0].toUpperCase();
              return (
                <div
                  key={m.id}
                  className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-5 flex flex-col"
                >
                  {/* Header badges */}
                  <div className="flex items-center justify-between mb-4">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-50 text-yellow-700 uppercase tracking-wide">
                      Pending
                    </span>
                    {priority && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-600 uppercase tracking-wide">
                        Priority
                      </span>
                    )}
                  </div>

                  {/* Avatar + info */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-[#EEF1F8] flex items-center justify-center flex-shrink-0">
                      {m.photoURL ? (
                        <img src={m.photoURL} alt={m.displayName} className="w-12 h-12 rounded-2xl object-cover" />
                      ) : (
                        <span className="text-[#1B2E6B] font-bold text-lg">{initials}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[#1B2E6B] font-semibold text-sm truncate">{m.displayName || "Unknown"}</p>
                      <p className="text-[#9CA3AF] text-xs capitalize">{m.role}</p>
                      <p className="text-[#9CA3AF] text-xs truncate">{m.email}</p>
                    </div>
                  </div>

                  {/* Requested time */}
                  <div className="flex items-center gap-1.5 text-[#9CA3AF] text-xs mb-4">
                    <Clock size={12} />
                    <span>Requested {timeAgo(m.createdAt)}</span>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 mt-auto">
                    <button
                      onClick={() => handleAction(m.id, true)}
                      disabled={acting[m.id]}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-green-50 text-green-700 text-xs font-semibold hover:bg-green-100 transition-colors disabled:opacity-50"
                    >
                      <CheckCircle size={13} /> Approve
                    </button>
                    <Link
                      href={`/settings/members/${m.id}`}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#EEF1F8] text-[#1B2E6B] text-xs font-semibold hover:bg-[#dde3f0] transition-colors"
                    >
                      <Eye size={13} /> View
                    </Link>
                    <button
                      onClick={() => handleAction(m.id, false)}
                      disabled={acting[m.id]}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100 transition-colors disabled:opacity-50"
                    >
                      <XCircle size={13} /> Reject
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {hasMore && (
            <div className="text-center">
              <button
                onClick={() => cursor && fetchPage(cursor)}
                disabled={loading}
                className="px-6 py-2.5 rounded-xl border border-[#E5E7EB] text-sm font-semibold text-[#374151] hover:bg-[#EEF1F8] transition-colors disabled:opacity-50"
              >
                {loading ? "Loading…" : "Load More"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
