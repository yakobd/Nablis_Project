"use client";
import React, { useEffect, useState } from "react";
import {
  collection, query, where, orderBy, getDocs,
  doc, updateDoc, addDoc, deleteDoc, serverTimestamp,
} from "firebase/firestore";
import { db, useAuth } from "@/lib/firebase";
import { X, CheckCircle, XCircle, MessageSquare, Plus, Trash2 } from "lucide-react";
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

// ── Add Testimony modal ───────────────────────────────────────────────────────
function AddTestimonyModal({
  authorName,
  onClose,
  onAdded,
}: {
  authorName: string;
  onClose: () => void;
  onAdded: (t: Testimony) => void;
}) {
  const [title, setTitle]       = useState("");
  const [content, setContent]   = useState("");
  const [category, setCategory] = useState<Testimony["category"]>("healing");
  const [loading, setLoading]   = useState(false);

  const INPUT = "w-full px-4 py-2.5 rounded-xl border border-[#E5E7EB] text-sm text-[#374151] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#1B2E6B]/20 focus:border-[#1B2E6B] transition-colors";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setLoading(true);
    try {
      const payload = {
        authorName,
        title:     title.trim(),
        content:   content.trim(),
        category,
        status:    "published" as const,
        likes:     0,
        createdAt: serverTimestamp(),
      };
      const ref = await addDoc(collection(db, "testimonies"), payload);
      onAdded({ id: ref.id, ...payload } as unknown as Testimony);
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#F3F4F6]">
          <h3 className="text-[#1B2E6B] font-bold">Add Testimony</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#EEF1F8] text-[#9CA3AF]"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#374151] mb-1.5">Title</label>
            <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="Give this testimony a title…" className={INPUT} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#374151] mb-1.5">Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value as Testimony["category"])}
              className={INPUT + " bg-white"}>
              <option value="healing">Healing</option>
              <option value="provision">Provision</option>
              <option value="restoration">Restoration</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#374151] mb-1.5">Testimony</label>
            <textarea required value={content} onChange={(e) => setContent(e.target.value)} rows={5}
              placeholder="Share how God has worked…" className={INPUT + " resize-none"} />
          </div>
          <button type="submit" disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-[#F5C518] text-[#1B2E6B] font-semibold py-2.5 rounded-xl hover:bg-[#e6b800] transition-colors disabled:opacity-60 text-sm">
            {loading && <div className="w-4 h-4 border-2 border-[#1B2E6B]/40 border-t-[#1B2E6B] rounded-full animate-spin" />}
            Publish Testimony
          </button>
        </form>
      </div>
    </div>
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
  onAction: (id: string, status: "published" | "rejected") => void;
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

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#F3F4F6]">
          <h3 className="text-[#1B2E6B] font-bold">Review Testimony</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#EEF1F8] text-[#9CA3AF]"><X size={16} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#1B2E6B] flex items-center justify-center flex-shrink-0">
              <span className="text-[#F5C518] font-bold">{(testimony.authorName || "?")[0].toUpperCase()}</span>
            </div>
            <div>
              <p className="text-[#1B2E6B] font-semibold text-sm">{testimony.authorName}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <CategoryBadge category={testimony.category} />
                <span className="text-[#9CA3AF] text-xs">{fmtDate(testimony.createdAt)}</span>
              </div>
            </div>
          </div>
          <div className="bg-[#F9FAFB] rounded-xl p-4">
            <p className="text-[#1B2E6B] font-semibold text-sm mb-2">{testimony.title}</p>
            <p className="text-[#6B7280] text-sm leading-relaxed">{testimony.content}</p>
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={() => act("published")} disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#1B2E6B] text-white text-sm font-semibold hover:bg-[#162554] transition-colors disabled:opacity-60">
              <CheckCircle size={15} /> Approve
            </button>
            <button onClick={() => act("rejected")} disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-50 text-red-600 text-sm font-semibold hover:bg-red-100 transition-colors disabled:opacity-60">
              <XCircle size={15} /> Reject
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Admin / Super Admin view ──────────────────────────────────────────────────
function AdminTestimonials() {
  const { user, role } = useAuth();
  const [pending,   setPending]   = useState<Testimony[]>([]);
  const [published, setPublished] = useState<Testimony[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [tab,       setTab]       = useState<"pending" | "published" | "all">("pending");
  const [reviewing, setReviewing] = useState<Testimony | null>(null);
  const [adding,    setAdding]    = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [pSnap, pubSnap] = await Promise.all([
          getDocs(query(collection(db, "testimonies"), where("status", "==", "pending"),   orderBy("createdAt", "desc"))),
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

  function handleAction(id: string, status: "published" | "rejected") {
    if (status === "published") {
      const item = pending.find((t) => t.id === id)!;
      setPending((p) => p.filter((t) => t.id !== id));
      setPublished((p) => [{ ...item, status: "published" }, ...p]);
    } else {
      setPending((p) => p.filter((t) => t.id !== id));
    }
  }

  async function handleDelete(t: Testimony) {
    if (!confirm(`Delete "${t.title}"?`)) return;
    await deleteDoc(doc(db, "testimonies", t.id));
    setPending((p)   => p.filter((x) => x.id !== t.id));
    setPublished((p) => p.filter((x) => x.id !== t.id));
  }

  function handleAdded(t: Testimony) {
    setPublished((p) => [t, ...p]);
    setTab("published");
  }

  const all = [...pending, ...published].sort(
    (a, b) => ((b.createdAt as any)?.seconds ?? 0) - ((a.createdAt as any)?.seconds ?? 0)
  );
  const displayed = tab === "pending" ? pending : tab === "published" ? published : all;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#1B2E6B]">Testimonials</h1>
        {role === 'super_admin' && (
          <button onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 bg-[#F5C518] text-[#1B2E6B] font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-[#e6b800] transition-colors">
            <Plus size={15} /> Add Testimony
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total",          value: pending.length + published.length, icon: "📜", color: "#1B2E6B" },
          { label: "Pending Review", value: pending.length,                    icon: "⏳", color: "#d97706" },
          { label: "Published",      value: published.length,                  icon: "✅", color: "#059669" },
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
          {([
            { key: "pending",   label: `Pending Approval (${pending.length})` },
            { key: "published", label: `Published (${published.length})` },
            { key: "all",       label: `All (${all.length})` },
          ] as const).map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={[
                "px-5 py-3.5 text-sm font-medium transition-colors border-b-2 whitespace-nowrap",
                tab === t.key
                  ? "text-[#1B2E6B] border-[#1B2E6B]"
                  : "text-[#6B7280] border-transparent hover:text-[#1B2E6B]",
              ].join(" ")}>
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-12 text-center">
            <div className="w-7 h-7 border-2 border-[#1B2E6B] border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : displayed.length === 0 ? (
          <div className="py-12 text-center text-[#9CA3AF] text-sm">No {tab} testimonies</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F9FAFB] border-b border-[#F3F4F6]">
                  {["Author", "Title", "Category", "Date", "Status", ""].map((h) => (
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
                    <td className="px-4 py-3 text-[#374151] text-xs max-w-[180px] truncate">{t.title}</td>
                    <td className="px-4 py-3"><CategoryBadge category={t.category} /></td>
                    <td className="px-4 py-3 text-[#6B7280] text-xs">{fmtDate(t.createdAt)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        t.status === "published" ? "bg-green-50 text-green-700" :
                        t.status === "pending"   ? "bg-yellow-50 text-yellow-700" :
                                                   "bg-red-50 text-red-600"
                      }`}>
                        {t.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {t.status === "pending" && (
                          <button onClick={() => setReviewing(t)}
                            className="px-3 py-1.5 rounded-lg bg-[#EEF1F8] text-[#1B2E6B] text-xs font-semibold hover:bg-[#1B2E6B] hover:text-white transition-colors">
                            Review
                          </button>
                        )}
                        <button onClick={() => handleDelete(t)}
                          className="p-1.5 rounded-lg text-[#9CA3AF] hover:bg-red-50 hover:text-red-500 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
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
      {adding && role === 'super_admin' && (
        <AddTestimonyModal
          authorName={user?.displayName || user?.email || "Admin"}
          onClose={() => setAdding(false)}
          onAdded={handleAdded}
        />
      )}
    </div>
  );
}

// ── Member view ───────────────────────────────────────────────────────────────
function MemberTestimonials() {
  const { user } = useAuth();
  const [published, setPublished] = useState<Testimony[]>([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    if (!user) return;
    getDocs(query(collection(db, "testimonies"), where("status", "==", "published"), orderBy("createdAt", "desc")))
      .then((snap) => setPublished(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Testimony))))
      .finally(() => setLoading(false));
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!user) return null;

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-[#1B2E6B]">Testimonials</h1>

      <div>
        <h2 className="text-sm font-semibold text-[#1B2E6B] mb-3">Community Testimonies</h2>
        {loading ? (
          <div className="py-10 text-center">
            <div className="w-7 h-7 border-2 border-[#1B2E6B] border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
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
                {(t.likes ?? 0) > 0 && (
                  <p className="text-[#9CA3AF] text-xs mt-2">❤️ {t.likes}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function TestimonialsPage() {
  const { user, role } = useAuth();
  if (!user) return null;
  const isAdminOrSuperAdmin = role === "admin" || role === "super_admin";
  return isAdminOrSuperAdmin ? <AdminTestimonials /> : <MemberTestimonials />;
}
