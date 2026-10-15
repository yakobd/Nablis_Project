"use client";
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, getDocs, onSnapshot, query, where } from "firebase/firestore";
import { BookOpenText, Clock3, CheckCircle2, TrendingUp, Heart, Filter, Quote, PenLine } from "lucide-react";
import {
  db, useAuth, TESTIMONY_CATEGORIES, testimonyAuthor, testimonyCategoryKey, encouragementCount,
  toggleEncouraged, type TestimonyDoc,
} from "@/lib/firebase";
import { Pagination } from "@/components/ui/Pagination";
import { useToast } from "@/components/ui/Toast";
import { Avatar, CategoryPill, ago, authorLabel, catLabel, excerpt, fmtDate, tsMillis } from "./_components/shared";
import { PageTitle } from "@/components/PageTitle";
import { useTranslation } from "@nablis/i18n";

const toDocs = (snap: { docs: { id: string; data: () => unknown }[] }) =>
  snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) } as TestimonyDoc));

// ── Admin / Super Admin ───────────────────────────────────────────────────────
function AdminTestimonials() {
  const { t: tr } = useTranslation();
  const [all, setAll] = useState<TestimonyDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"pending" | "published">("pending");
  const [page, setPage] = useState(1);
  const PAGE = 6;

  useEffect(() => onSnapshot(collection(db, "testimonies"), (snap) => {
    setAll(toDocs(snap).sort((a, b) => tsMillis(b) - tsMillis(a)));
    setLoading(false);
  }, () => setLoading(false)), []);

  const pending = all.filter((t) => t.status === "pending");
  const published = all.filter((t) => t.status === "published");
  const rows = tab === "pending" ? pending : published;

  // Growth: submissions this month vs last month.
  const growth = useMemo(() => {
    const now = new Date();
    const thisStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const lastStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
    const thisMonth = all.filter((t) => tsMillis(t) >= thisStart).length;
    const lastMonth = all.filter((t) => tsMillis(t) >= lastStart && tsMillis(t) < thisStart).length;
    if (!lastMonth) return thisMonth ? 100 : 0;
    return Math.round(((thisMonth - lastMonth) / lastMonth) * 100);
  }, [all]);

  const stats = [
    { label: tr("testimony.total"), value: all.length, note: tr("testimony.growth", { pct: `${growth >= 0 ? "+" : ""}${growth}` }), noteCls: growth >= 0 ? "text-[#15803D]" : "text-[#B91C1C]", Icon: BookOpenText, iconCls: "bg-[#EEF1F8] text-[#1E3A8A]", NoteIcon: TrendingUp },
    { label: tr("testimony.pendingReview"), value: pending.length, note: tr("testimony.attention"), noteCls: "text-[#B45309]", Icon: Clock3, iconCls: "bg-[#FEF3C7] text-[#B45309]" },
    { label: tr("testimony.published"), value: published.length, note: tr("testimony.allCategories"), noteCls: "text-[#6B7280]", Icon: CheckCircle2, iconCls: "bg-[#DCFCE7] text-[#15803D]" },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <PageTitle id="testimonialsAdmin" />
        </div>
        <Link href="/testimonials/share" className="inline-flex items-center gap-2 self-start px-6 py-3 rounded-full bg-[#F5C518] text-[#1B2E6B] text-sm font-bold hover:bg-[#e6b800]">
          <PenLine size={15} /> {tr("testimony.add")}
        </Link>
      </div>

      <div className="grid sm:grid-cols-3 gap-5 stagger">
        {stats.map(({ label, value, note, noteCls, Icon, iconCls, NoteIcon }) => (
          <div key={label} className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="flex items-start justify-between">
              <p className="text-sm font-medium text-[#6B7280]">{label}</p>
              <span className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconCls}`}><Icon size={19} /></span>
            </div>
            <p className="font-display text-4xl font-bold text-[#111827] mt-2">{loading ? "—" : value}</p>
            <p className={`flex items-center gap-1 text-xs font-medium mt-2 ${noteCls}`}>
              {NoteIcon && <NoteIcon size={13} />}{note}
            </p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="flex gap-2 px-5 pt-5 border-b border-[#F3F4F6]">
          {([
            { key: "pending", label: tr("testimony.pendingApproval"), count: pending.length },
            { key: "published", label: tr("testimony.published"), count: published.length },
          ] as const).map((t) => (
            <button key={t.key} onClick={() => { setTab(t.key); setPage(1); }}
              className={`px-4 pb-3.5 text-sm font-semibold border-b-2 transition-colors ${tab === t.key ? "text-[#1E3A8A] border-[#1E3A8A]" : "text-[#6B7280] border-transparent hover:text-[#1E3A8A]"}`}>
              {t.label}
              <span className={`ml-2 px-2 py-0.5 rounded-full text-[11px] ${tab === t.key ? "bg-[#1E3A8A] text-white" : "bg-[#F3F4F6] text-[#6B7280]"}`}>{t.count}</span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-14"><div className="w-7 h-7 border-2 border-[#1B2E6B] border-t-transparent rounded-full animate-spin mx-auto" /></div>
        ) : rows.length === 0 ? (
          <div className="py-14 text-center text-sm text-[#9CA3AF]">
            {tab === "pending" ? tr("testimony.noPending") : tr("testimony.noPublished")}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[760px]">
                <thead>
                  <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF]">
                    <th className="px-6 py-4">{tr("testimony.memberName")}</th>
                    <th className="px-4 py-4">{tr("testimony.titleCol")}</th>
                    <th className="px-4 py-4">{tr("events.category")}</th>
                    <th className="px-4 py-4">{tr("testimony.submitted")}</th>
                    <th className="px-6 py-4 text-right">{tr("testimony.action")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3F4F6] stagger">
                  {rows.slice((page - 1) * PAGE, page * PAGE).map((t) => (
                    <tr key={t.id} className="hover:bg-[#F9FAFB] transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar name={t.authorName} photo={t.authorPhotoURL} />
                          <div className="min-w-0">
                            <p className="font-semibold text-[#111827] truncate">{t.authorName || "Member"}</p>
                            {t.anonymous && <p className="text-[11px] text-[#9CA3AF]">{tr("testimony.postingAnon")}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 max-w-[320px]">
                        <p className="font-semibold text-[#1E3A8A] truncate">{t.title}</p>
                        <p className="text-xs text-[#6B7280] truncate mt-0.5">{excerpt(t.content, 80)}</p>
                      </td>
                      <td className="px-4 py-4"><CategoryPill category={t.category} /></td>
                      <td className="px-4 py-4 text-[#6B7280] whitespace-nowrap">{fmtDate(t)}</td>
                      <td className="px-6 py-4 text-right">
                        <Link href={`/testimonials/${t.id}`}
                          className="inline-flex px-5 py-2 rounded-full bg-[#1E3A8A] text-white text-xs font-semibold hover:bg-[#1B2E6B]">
                          {tab === "pending" ? tr("testimony.review") : tr("common.view")}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-4 border-t border-[#F3F4F6]">
              <Pagination page={page} pageSize={PAGE} total={rows.length} onPage={setPage} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Member feed ───────────────────────────────────────────────────────────────
type Feed = "latest" | "encouraging" | "healing" | "answered_prayer";
const FEEDS: { key: Feed; label: string }[] = [
  { key: "latest", label: "Latest Stories" },
  { key: "encouraging", label: "Most Encouraging" },
  { key: "healing", label: "Healing" },
  { key: "answered_prayer", label: "Answered Prayer" },
];

function StoryCard({ t, uid, onEncourage }: { t: TestimonyDoc; uid: string; onEncourage: (t: TestimonyDoc) => void }) {
  const { t: tr } = useTranslation();
  const image = t.attachments?.find((a) => a.kind === "image")?.url;
  const mine = t.encouragedBy?.includes(uid);
  const count = encouragementCount(t);
  return (
    <div className="group bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col">
      <Link href={`/testimonials/${t.id}`} className="block h-48 bg-gradient-to-br from-[#1E3A8A] to-[#3B5BB5] overflow-hidden relative">
        {image ? (
          <img src={image} alt="" className="w-full h-full object-cover group-hover-zoom" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/25"><Quote size={56} /></div>
        )}
      </Link>
      <div className="p-5 flex flex-col flex-1">
        <div className="flex items-center justify-between gap-2">
          <CategoryPill category={t.category} />
          <span className="text-[11px] text-[#9CA3AF]">{ago(t)}</span>
        </div>
        <Link href={`/testimonials/${t.id}`} className="text-lg font-semibold text-[#111827] mt-3 leading-snug line-clamp-2 hover:text-[#1E3A8A]">{t.title}</Link>
        <p className="text-sm text-[#6B7280] mt-2 line-clamp-3 flex-1">{excerpt(t.content, 150)}</p>
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-[#F3F4F6]">
          <div className="flex items-center gap-2.5 min-w-0">
            <Avatar name={authorLabel(t)} photo={t.anonymous ? null : t.authorPhotoURL} size={30} />
            <span className="text-sm font-medium text-[#374151] truncate">{authorLabel(t)}</span>
          </div>
          <button onClick={() => onEncourage(t)} aria-label={mine ? tr("testimony.unencourage") : tr("testimony.encouraged")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${mine ? "bg-[#FFE4E6] text-[#E11D48]" : "bg-[#F3F4F6] text-[#6B7280] hover:bg-[#FFE4E6] hover:text-[#E11D48]"}`}>
            <Heart size={13} className={mine ? "fill-current animate-pop" : ""} /> {count > 0 ? count : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

function MemberTestimonials() {
  const { t: tr } = useTranslation();
  const { user } = useAuth();
  const toast = useToast();
  const [stories, setStories] = useState<TestimonyDoc[]>([]);
  const [mine, setMine] = useState<TestimonyDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [feed, setFeed] = useState<Feed>("latest");
  const [category, setCategory] = useState("");
  const [shown, setShown] = useState(9);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(query(collection(db, "testimonies"), where("status", "==", "published")), (snap) => {
      setStories(toDocs(snap));
      setLoading(false);
    }, () => setLoading(false));
    getDocs(query(collection(db, "testimonies"), where("authorId", "==", user.id)))
      .then((snap) => setMine(toDocs(snap).filter((t) => t.status !== "published").sort((a, b) => tsMillis(b) - tsMillis(a))))
      .catch(() => {});
    return unsub;
  }, [user]);

  const visible = useMemo(() => {
    let list = [...stories];
    if (feed === "healing" || feed === "answered_prayer") list = list.filter((t) => testimonyCategoryKey(t.category) === feed);
    if (category) list = list.filter((t) => testimonyCategoryKey(t.category) === category);
    return feed === "encouraging"
      ? list.sort((a, b) => encouragementCount(b) - encouragementCount(a) || tsMillis(b) - tsMillis(a))
      : list.sort((a, b) => tsMillis(b) - tsMillis(a));
  }, [stories, feed, category]);

  async function encourage(t: TestimonyDoc) {
    if (!user) return;
    const on = !t.encouragedBy?.includes(user.id);
    // Optimistic; the listener confirms it.
    setStories((list) => list.map((x) => x.id === t.id
      ? { ...x, encouragedBy: on ? [...(x.encouragedBy ?? []), user.id] : (x.encouragedBy ?? []).filter((u) => u !== user.id) }
      : x));
    try {
      await toggleEncouraged(t.id, user.id, on);
    } catch {
      toast({ message: tr("testimony.saveError"), type: "error" });
    }
  }

  if (!user) return null;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <PageTitle id="testimonials" />
        </div>
        <Link href="/testimonials/share" className="inline-flex items-center gap-2 self-start px-7 py-3 rounded-full bg-[#F5C518] text-[#1B2E6B] text-sm font-bold shadow-[0_10px_24px_-12px_rgba(245,197,24,0.9)] hover:bg-[#e6b800]">
          <PenLine size={15} /> {tr("testimony.share")}
        </Link>
      </div>

      {mine.length > 0 && (
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-[#9CA3AF] mb-3">{tr("testimony.yourSubmissions")}</p>
          <div className="space-y-2">
            {mine.map((t) => (
              <Link key={t.id} href={`/testimonials/${t.id}`} className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-[#F9FAFB] hover:bg-[#EEF1F8]">
                <span className="text-sm font-medium text-[#111827] truncate">{t.title}</span>
                <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full flex-shrink-0 ${t.status === "pending" ? "bg-[#FEF3C7] text-[#B45309]" : "bg-[#FEE2E2] text-[#B91C1C]"}`}>
                  {t.status === "pending" ? tr("testimony.awaiting") : tr("testimony.notPublished")}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          {FEEDS.map((f) => (
            <button key={f.key} onClick={() => { setFeed(f.key); setShown(9); }}
              className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all ${feed === f.key ? "bg-[#1E3A8A] text-white shadow-[0_8px_18px_-8px_rgba(30,58,138,0.8)]" : "bg-white text-[#111827] hover:bg-[#EEF1F8]"}`}>
              {tr(`testimony.feed.${f.key}`)}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 bg-white rounded-full pl-4 pr-2 py-1.5 text-sm text-[#374151] self-start">
          <Filter size={14} className="text-[#6B7280]" />
          <select value={category} onChange={(e) => { setCategory(e.target.value); setShown(9); }}
            className="bg-transparent py-1 pr-2 focus:outline-none cursor-pointer">
            <option value="">{tr("testimony.filter")}</option>
            {TESTIMONY_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{catLabel(c.key)}</option>)}
          </select>
        </label>
      </div>

      {loading ? (
        <div className="py-16"><div className="w-7 h-7 border-2 border-[#1B2E6B] border-t-transparent rounded-full animate-spin mx-auto" /></div>
      ) : visible.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center">
          <Quote size={34} className="mx-auto text-[#1E3A8A]/25" />
          <p className="text-[#374151] font-medium mt-3">{tr("testimony.noStories")}</p>
          <p className="text-sm text-[#9CA3AF] mt-1">{tr("testimony.beFirst")}</p>
        </div>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 stagger">
            {visible.slice(0, shown).map((t) => <StoryCard key={t.id} t={t} uid={user.id} onEncourage={encourage} />)}
          </div>
          {visible.length > shown && (
            <div className="flex justify-center">
              <button onClick={() => setShown((n) => n + 9)}
                className="px-8 py-3 rounded-full border-2 border-[#1E3A8A] text-[#1E3A8A] text-sm font-semibold hover:bg-[#1E3A8A] hover:text-white transition-colors">
                Load More Testimonies
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function TestimonialsPage() {
  const { user, role } = useAuth();
  if (!user) return null;
  return role === "admin" || role === "super_admin" ? <AdminTestimonials /> : <MemberTestimonials />;
}
