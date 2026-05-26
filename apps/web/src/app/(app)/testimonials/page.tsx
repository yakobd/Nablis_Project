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
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db, useAuth } from "@/lib/firebase";
import { Plus, X, CheckCircle, XCircle, MessageSquare } from "lucide-react";
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

// ── Submit modal (member) ─────────────────────────────────────────────────────
function SubmitModal({ userId, userName, onClose, onSubmitted }: { userId: string; userName: string; onClose: () => void; onSubmitted: () => void }) {
  const [title, setTitle]       = useState("");
  const [content, setContent]   = useState("");
  const [category, setCategory] = useState<Testimony["category"]>("healing");
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setLoading(true);
    try {
      await addDoc(collection(db, "testimonies"), {
        authorId: userId,
        authorName: userName,
        title: title.trim(),
        content: content.trim(),
        category,
        status: "pending",
        likes: 0,
        createdAt: serverTimestamp(),
      });
      onSubmitted();
      onClose();
    } finally {
      setLoading(false);
    }
  }

  const INPUT = "w-full px-4 py-2.5 rounded-xl border border-[#E5E7EB] text-sm text-[#374151] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#1B2E6B]/20 focus:border-[#1B2E6B] transition-colors";

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#F3F4F6]">
          <h3 className="text-[#1B2E6B] font-bold">Share Your Testimony</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#EEF1F8] text-[#9CA3AF]"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#374151] mb-1.5">Title</label>
            <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Give your testimony a title…" className={INPUT} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#374151] mb-1.5">Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value as Testimony["category"])} className={INPUT + " bg-white"}>
              <option value="healing">Healing</option>
              <option value="provision">Provision</option>
              <option value="restoration">Restoration</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#374151] mb-1.5">Your Testimony</label>
            <textarea required value={content} onChange={(e) => setContent(e.target.value)} rows={5} placeholder="Share how God has worked in your life…" className={INPUT + " resize-none"} />
          </div>
          <button type="submit" disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-[#F5C518] text-[#1B2E6B] font-semibold py-2.5 rounded-xl hover:bg-[#e6b800] transition-colors disabled:opacity-60 text-sm">
            {loading && <div className="w-4 h-4 border-2 border-[#1B2E6B]/40 border-t-[#1B2E6B] rounded-full animate-spin" />}
            Submit Testimony
          </button>
        </form>
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
  const [myTestimonies, setMyTestimonies] = useState<Testimony[]>([]);
  const [published, setPublished]         = useState<Testimony[]>([]);
  const [loading, setLoading]             = useState(true);
  const [submitting, setSubmitting]       = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [mySnap, pubSnap] = await Promise.all([
        getDocs(query(collection(db, "testimonies"), where("authorId", "==", user.id), orderBy("createdAt", "desc"))),
        getDocs(query(collection(db, "testimonies"), where("status", "==", "published"), orderBy("createdAt", "desc"))),
      ]);
      setMyTestimonies(mySnap.docs.map((d) => ({ id: d.id, ...d.data() } as Testimony)));
      setPublished(pubSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Testimony)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [user]); // eslint-disable-line

  if (!user) return null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#1B2E6B]">Testimonials</h1>
        <button onClick={() => setSubmitting(true)}
          className="flex items-center gap-1.5 bg-[#F5C518] text-[#1B2E6B] font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-[#e6b800] transition-colors">
          <Plus size={15} /> Share Testimony
        </button>
      </div>

      {myTestimonies.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-[#1B2E6B] mb-3">My Testimonies</h2>
          <div className="space-y-3">
            {myTestimonies.map((t) => (
              <div key={t.id} className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-5">
                <div className="flex items-center justify-between mb-2">
                  <CategoryBadge category={t.category} />
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${t.status === "published" ? "bg-green-50 text-green-700" : "bg-yellow-50 text-yellow-700"}`}>
                    {t.status === "published" ? "PUBLISHED" : "PENDING REVIEW"}
                  </span>
                </div>
                <p className="text-[#1B2E6B] font-semibold text-sm mb-1">{t.title}</p>
                <p className="text-[#6B7280] text-xs leading-relaxed line-clamp-2">{t.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}

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

      {submitting && (
        <SubmitModal userId={user.id} userName={user.displayName || user.email} onClose={() => setSubmitting(false)} onSubmitted={load} />
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function TestimonialsPage() {
  const { user, role } = useAuth();
  if (!user) return null;
  return role === "admin" ? <AdminTestimonials /> : <MemberTestimonials />;
}
