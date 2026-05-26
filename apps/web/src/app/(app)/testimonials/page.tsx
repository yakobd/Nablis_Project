"use client";
import React, { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  updateDoc,
} from "firebase/firestore";
import { db, useAuth } from "@/lib/firebase";
import { X, CheckCircle, XCircle, MessageSquare } from "lucide-react";
import type { Testimony } from "@nablis/shared/firebase";

function fmtDate(ts: { toDate: () => Date } | null | undefined) {
  if (!ts) return "—";
  try { return ts.toDate().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
  catch { return "—"; }
}

function CategoryBadge({ category }: { category: string }) {
  const map: Record<string, string> = {
    healing:     "bg-green-50 text-green-700",
    provision:   "bg-blue-50 text-blue-700",
    restoration: "bg-purple-50 text-purple-700",
    other:       "bg-gray-100 text-gray-600",
  };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold capitalize ${map[category] ?? "bg-gray-100 text-gray-600"}`}>
      {category}
    </span>
  );
}

// ── Review modal ──────────────────────────────────────────────────────────────
function ReviewModal({
  testimony,
  onClose,
  onAction,
}: {
  testimony: Testimony;
  onClose: () => void;
  onAction: (id: string, status: "published" | "rejected") => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);

  async function act(status: "published" | "rejected") {
    setLoading(true);
    try {
      await updateDoc(doc(db, "testimonies", testimony.id), { status });
      onAction(testimony.id, status);
      onClose();
    } finally {
      setLoading(false);
    }
  }

  const initials = (testimony.authorName || "?")[0].toUpperCase();

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#F3F4F6]">
          <h3 className="text-[#1B2E6B] font-bold">Review Testimony</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#EEF1F8] text-[#9CA3AF]"><X size={16} /></button>
        </div>
        <div className="p-6 space-y-4">
          {/* Author */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#1B2E6B] flex items-center justify-center flex-shrink-0">
              <span className="text-[#F5C518] font-bold">{initials}</span>
            </div>
            <div>
              <p className="text-[#1B2E6B] font-semibold text-sm">{testimony.authorName}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <CategoryBadge category={testimony.category} />
                <span className="text-[#9CA3AF] text-xs">{fmtDate(testimony.createdAt)}</span>
              </div>
            </div>
          </div>

          {/* Title + content */}
          <div className="bg-[#F9FAFB] rounded-xl p-4">
            <p className="text-[#1B2E6B] font-semibold text-sm mb-2">{testimony.title}</p>
            <p className="text-[#6B7280] text-sm leading-relaxed">{testimony.content}</p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={() => act("published")}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#1B2E6B] text-white text-sm font-semibold hover:bg-[#162554] transition-colors disabled:opacity-60"
            >
              <CheckCircle size={15} /> Approve
            </button>
            <button
              onClick={() => act("rejected" as unknown as "published")}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-50 text-red-600 text-sm font-semibold hover:bg-red-100 transition-colors disabled:opacity-60"
            >
              <XCircle size={15} /> Reject
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Admin view ────────────────────────────────────────────────────────────────
function AdminTestimonials() {
  const [pending, setPending]     = useState<Testimony[]>([]);
  const [published, setPublished] = useState<Testimony[]>([]);
  const [loading, setLoading]     = useState(true);
  const [tab, setTab]             = useState<"pending" | "published">("pending");
  const [reviewing, setReviewing] = useState<Testimony | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [pSnap, pubSnap] = await Promise.all([
          getDocs(query(collection(db, "testimonies"), where("status", "==", "pending"), orderBy("createdAt", "desc"))),
          getDocs(query(collection(db, "testimonies"), where("status", "==", "published"), orderBy("createdAt", "desc"))),
        ]);
        setPending(pSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Testimony)));
        setPublished(pubSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Testimony)));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleAction(id: string, status: "published" | "rejected") {
    if (status === "published") {
      const item = pending.find((t) => t.id === id)!;
      setPending((p) => p.filter((t) => t.id !== id));
      setPublished((p) => [{ ...item, status: "published" }, ...p]);
    } else {
      setPending((p) => p.filter((t) => t.id !== id));
    }
    return Promise.resolve();
  }

  const displayed = tab === "pending" ? pending : published;

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-[#1B2E6B]">Testimonials</h1>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Testimonies", value: (pending.length + published.length).toString(), icon: "📜", color: "#1B2E6B" },
          { label: "Pending Review",    value: pending.length.toString(),                      icon: "⏳", color: "#d97706" },
          { label: "Published",         value: published.length.toString(),                    icon: "✅", color: "#059669" },
        ].map(({ label, value, icon, color }) => (
          <div key={label} className="bg-white rounded-2xl p-5 border border-[#E5E7EB] shadow-sm">
            <p className="text-2xl mb-2">{icon}</p>
            <p className="text-2xl font-bold" style={{ color }}>{value}</p>
            <p className="text-[#9CA3AF] text-xs mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Tabs + table */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden">
        <div className="flex border-b border-[#F3F4F6]">
          {(["pending", "published"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={[
                "px-5 py-3.5 text-sm font-medium capitalize transition-colors border-b-2",
                tab === t ? "text-[#1B2E6B] border-[#1B2E6B]" : "text-[#6B7280] border-transparent hover:text-[#1B2E6B]",
              ].join(" ")}>
              {t === "pending" ? `Pending Approval (${pending.length})` : `Published (${published.length})`}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-12 text-center"><div className="w-7 h-7 border-2 border-[#1B2E6B] border-t-transparent rounded-full animate-spin mx-auto" /></div>
        ) : displayed.length === 0 ? (
          <div className="py-12 text-center text-[#9CA3AF] text-sm">No {tab} testimonies</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F9FAFB] border-b border-[#F3F4F6]">
                  {["Member", "Title", "Category", "Date Submitted", ""].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-[#9CA3AF]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {displayed.map((t) => (
                  <tr key={t.id} className="hover:bg-[#F9FAFB] transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-[#1B2E6B] flex items-center justify-center text-[10px] font-bold text-[#F5C518] flex-shrink-0">
                          {t.authorName[0]?.toUpperCase()}
                        </div>
                        <span className="text-[#374151] font-medium text-xs">{t.authorName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#374151] text-xs max-w-[200px] truncate">{t.title}</td>
                    <td className="px-4 py-3"><CategoryBadge category={t.category} /></td>
                    <td className="px-4 py-3 text-[#6B7280] text-xs">{fmtDate(t.createdAt)}</td>
                    <td className="px-4 py-3">
                      {tab === "pending" && (
                        <button onClick={() => setReviewing(t)}
                          className="px-3 py-1.5 rounded-lg bg-[#EEF1F8] text-[#1B2E6B] text-xs font-semibold hover:bg-[#1B2E6B] hover:text-white transition-colors">
                          Review
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {reviewing && (
        <ReviewModal testimony={reviewing} onClose={() => setReviewing(null)} onAction={handleAction} />
      )}
    </div>
  );
}

// ── Member view ───────────────────────────────────────────────────────────────
function MemberTestimonials() {
  const { user } = useAuth();
  const [published, setPublished] = useState<Testimony[]>([]);
  const [loading, setLoading]    = useState(true);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const pubSnap = await getDocs(query(collection(db, "testimonies"), where("status", "==", "published"), orderBy("createdAt", "desc")));
      setPublished(pubSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Testimony)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [user]); // eslint-disable-line

  if (!user) return null;

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-[#1B2E6B]">Testimonials</h1>

      {/* Published testimonies */}
      <div>
        <h2 className="text-sm font-semibold text-[#1B2E6B] mb-3">Community Testimonies</h2>
        {loading ? (
          <div className="py-10 text-center"><div className="w-7 h-7 border-2 border-[#1B2E6B] border-t-transparent rounded-full animate-spin mx-auto" /></div>
        ) : published.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-10 text-center text-[#9CA3AF] text-sm">
            <MessageSquare size={32} className="mx-auto mb-2 opacity-30" />
            No published testimonies yet.
          </div>
        ) : (
          <div className="space-y-3">
            {published.map((t) => (
              <div key={t.id} className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-full bg-[#1B2E6B] flex items-center justify-center flex-shrink-0">
                    <span className="text-[#F5C518] font-bold text-sm">{t.authorName[0]?.toUpperCase()}</span>
                  </div>
                  <div>
                    <p className="text-[#374151] font-semibold text-sm">{t.authorName}</p>
                    <div className="flex items-center gap-2">
                      <CategoryBadge category={t.category} />
                      <span className="text-[#9CA3AF] text-xs">{fmtDate(t.createdAt)}</span>
                    </div>
                  </div>
                </div>
                <p className="text-[#1B2E6B] font-semibold text-sm mb-1">{t.title}</p>
                <p className="text-[#6B7280] text-sm leading-relaxed line-clamp-3">{t.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function TestimonialsPage() {
  const { user, role } = useAuth();
  if (!user) return null;
  return (role === "admin" || role === "super_admin") ? <AdminTestimonials /> : <MemberTestimonials />;
}
