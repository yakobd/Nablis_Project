"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { arrayRemove, arrayUnion, collection, doc, onSnapshot, updateDoc } from "firebase/firestore";
import {
  ArrowRight, ChevronRight, Heart, Play, X, GraduationCap, Users, BookOpen, Flower2, Tag, Pencil, CalendarClock, Eye,
} from "lucide-react";
import {
  db, useAuth, blogExcerpt, isScheduled, youTubeEmbed, youTubeThumb, countBlogView, type BlogDoc,
} from "@/lib/firebase";
import { useToast } from "@/components/ui/Toast";
import i18n from "@nablis/i18n";
import { dateLocale } from "@/lib/locale";
import { PageTitle } from "@/components/PageTitle";
import { useTranslation } from "@nablis/i18n";

type Filter = "all" | "latest" | "most" | "favorites";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" }, { key: "latest", label: "Latest Articles" },
  { key: "most", label: "Most Read" }, { key: "favorites", label: "Favorites" },
];

const CATEGORY_STYLE: Record<string, { Icon: typeof Tag; cls: string }> = {
  "Spiritual Education": { Icon: GraduationCap, cls: "bg-[#DBEAFE] text-[#1D4ED8]" },
  "Family Support":      { Icon: Users,         cls: "bg-[#FCE7F3] text-[#DB2777]" },
  "Bible Study":         { Icon: BookOpen,      cls: "bg-[#FEF3C7] text-[#D97706]" },
  "Wellness & Prayer":   { Icon: Flower2,       cls: "bg-[#F3E8FF] text-[#9333EA]" },
};
const DEFAULT_CATEGORIES = Object.keys(CATEGORY_STYLE);

function ago(b: BlogDoc) {
  const d = (b.publishAt ?? b.createdAt)?.toDate?.();
  if (!d) return "";
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 60) return i18n.t("time.minsAgo", { count: Math.max(mins, 1) });
  const h = Math.floor(mins / 60);
  if (h < 24) return i18n.t("time.hoursAgo", { count: h });
  const days = Math.floor(h / 24);
  if (days < 7) return i18n.t("time.daysAgo", { count: days });
  const w = Math.floor(days / 7);
  return w < 5 ? i18n.t("time.weeksAgo", { count: w }) : d.toLocaleDateString(dateLocale(), { month: "short", day: "numeric" });
}
function thumb(b: BlogDoc) {
  return b.imageURL || youTubeThumb(b.videoURL) || null;
}
function CategoryPill({ c, small = false }: { c: string; small?: boolean }) {
  return <span className={`inline-block rounded-full bg-[#F1F4F9] border border-[#E5E7EB] font-semibold tracking-wider uppercase text-[#4B5563] ${small ? "px-2 py-0.5 text-[9px]" : "px-3 py-1 text-[10px]"}`}>{i18n.t(`blogCat.${c}`, { defaultValue: c })}</span>;
}

export default function BlogsPage() {
  const { t } = useTranslation();
  const { user, role } = useAuth();
  const isStaff = role === "admin" || role === "super_admin";
  const toast = useToast();
  const [posts, setPosts]     = useState<BlogDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState<Filter>("all");
  const [category, setCategory] = useState<string | null>(null);
  const [shown, setShown]     = useState(6);
  const [allVideos, setAllVideos] = useState(false);
  const [playing, setPlaying] = useState<BlogDoc | null>(null);
  const [picking, setPicking] = useState(false);
  const teachingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => onSnapshot(collection(db, "blogPosts"), (snap) => {
    setPosts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as BlogDoc))
      .filter((b) => b.status !== "draft")
      .sort((a, b) => ((b.publishAt ?? b.createdAt)?.toMillis?.() ?? 0) - ((a.publishAt ?? a.createdAt)?.toMillis?.() ?? 0)));
    setLoading(false);
  }, () => setLoading(false)), []);

  const favorites = new Set<string>(((user as unknown as { favoriteBlogs?: string[] })?.favoriteBlogs) ?? []);
  const visible = useMemo(() => posts.filter((b) => isStaff || !isScheduled(b)), [posts, isStaff]);
  const featured = useMemo(() => {
    const pinned = visible.filter((b) => b.pinned);
    return (pinned.length ? pinned : visible).slice(0, 2);
  }, [visible]);

  const teachings = useMemo(() => {
    let list = visible.filter((b) => !b.videoURL || b.imageURL);
    if (category) list = list.filter((b) => b.category === category);
    if (filter === "most") list = [...list].sort((a, b) => (b.views ?? 0) - (a.views ?? 0));
    if (filter === "favorites") list = list.filter((b) => favorites.has(b.id));
    if (filter === "latest") list = list.filter((b) => ((b.publishAt ?? b.createdAt)?.toMillis?.() ?? 0) > Date.now() - 30 * 86400000);
    return list;
  }, [visible, filter, category, favorites]);

  const videos = visible.filter((b) => !!b.videoURL);
  const heroVideo = videos[0];
  const moreVideos = allVideos ? videos.slice(1) : videos.slice(1, 5);
  const categories = Array.from(new Set([...DEFAULT_CATEGORIES, ...visible.map((b) => b.category).filter(Boolean)]));

  async function toggleFavorite(b: BlogDoc) {
    if (!user) return;
    const has = favorites.has(b.id);
    await updateDoc(doc(db, "users", user.id), { favoriteBlogs: has ? arrayRemove(b.id) : arrayUnion(b.id) });
    toast({ message: has ? t("blogsPage.unfavorited") : t("blogsPage.favorited") });
  }

  function watch(b: BlogDoc) {
    setPlaying(b);
    countBlogView(b.id);
  }

  function chooseCategory(c: string) {
    setCategory((cur) => (cur === c ? null : c));
    teachingsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (!user) return null;

  return (
    <div className="space-y-12">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <PageTitle id="blogs" />
        </div>
        {isStaff && (
          <div className="flex gap-3">
            <Link href="/blogs/create" className="px-6 py-3 rounded-full bg-[#1E3A8A] text-white text-sm font-semibold shadow-[0_10px_24px_-12px_rgba(30,58,138,0.9)] hover:bg-[#1B2E6B]">{t("blogsPage.create")}</Link>
            <button onClick={() => setPicking(true)} className="px-6 py-3 rounded-full bg-[#1E3A8A] text-white text-sm font-semibold shadow-[0_10px_24px_-12px_rgba(30,58,138,0.9)] hover:bg-[#1B2E6B]">{t("blogsPage.update")}</button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="py-16"><div className="w-7 h-7 border-2 border-[#1B2E6B] border-t-transparent rounded-full animate-spin mx-auto" /></div>
      ) : visible.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center text-[#9CA3AF]">{t("blogsPage.noPosts")}</div>
      ) : (
        <>
          {/* Featured */}
          <div className="grid md:grid-cols-2 gap-6">
            {featured.map((b) => (
              <Link key={b.id} href={`/blogs/${b.id}`} className="group bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex min-h-[250px]">
                <div className="w-[45%] flex-shrink-0 bg-[#EEF1F8] overflow-hidden">
                  {thumb(b) ? <img src={thumb(b)!} alt={b.imageAlt ?? ""} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" /> : <div className="w-full h-full flex items-center justify-center text-[#1B2E6B]/30"><BookOpen size={40} /></div>}
                </div>
                <div className="p-6 flex flex-col">
                  <CategoryPill c={b.category} />
                  <p className="text-xl font-semibold text-[#111827] mt-3 leading-snug line-clamp-2">{b.title}</p>
                  <p className="text-sm text-[#6B7280] mt-3 line-clamp-4 flex-1">{blogExcerpt(b, 140)}</p>
                  <span className="flex items-center gap-1 text-sm font-semibold text-[#1E3A8A] mt-3">{t("blogsPage.readMore")} <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" /></span>
                </div>
              </Link>
            ))}
          </div>

          {/* Teachings */}
          <section ref={teachingsRef} className="scroll-mt-24">
            <div className="text-center">
              <h2 className="font-display text-3xl font-bold text-[#111827]">{t("blogsPage.teachingsFor")} <span className="text-[#1E3A8A]">{t("blogsPage.you")}</span></h2>
              <p className="text-[#374151] mt-2">{t("blogsPage.teachingsHint")}</p>
            </div>
            <div className="flex flex-wrap justify-center gap-3 mt-7">
              {FILTERS.map((f) => (
                <button key={f.key} onClick={() => { setFilter(f.key); setShown(6); }}
                  className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all ${filter === f.key ? "bg-[#1E3A8A] text-white shadow-[0_8px_18px_-8px_rgba(30,58,138,0.8)]" : "bg-white text-[#111827] hover:bg-[#EEF1F8]"}`}>
                  {t(`blogsPage.filter.${f.key}`)}
                </button>
              ))}
            </div>
            {category && (
              <div className="flex justify-center mt-4">
                <button onClick={() => setCategory(null)} className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1E3A8A]/10 text-xs font-semibold text-[#1E3A8A]">
                  {category} <X size={12} />
                </button>
              </div>
            )}
            {teachings.length === 0 ? (
              <p className="text-center text-sm text-[#4B5563] mt-10">{filter === "favorites" ? t("blogsPage.favEmpty") : t("blogsPage.nothing")}</p>
            ) : (
              <div className="grid md:grid-cols-2 gap-6 mt-8 stagger">
                {teachings.slice(0, shown).map((b) => (
                  <div key={b.id} className="group bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-lg transition-shadow duration-300 flex min-h-[140px] relative">
                    <Link href={`/blogs/${b.id}`} className="w-40 sm:w-44 flex-shrink-0 bg-[#EEF1F8] overflow-hidden">
                      {thumb(b) ? <img src={thumb(b)!} alt={b.imageAlt ?? ""} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" /> : <div className="w-full h-full flex items-center justify-center text-[#1B2E6B]/30"><BookOpen size={30} /></div>}
                    </Link>
                    <div className="p-5 flex flex-col min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <CategoryPill c={b.category} small />
                        {isScheduled(b) && <span className="flex items-center gap-1 text-[10px] font-bold text-[#A16207]"><CalendarClock size={11} /> {t("blogsPage.scheduled")}</span>}
                      </div>
                      <Link href={`/blogs/${b.id}`} className="text-[17px] font-semibold text-[#111827] mt-2 line-clamp-1 hover:text-[#1E3A8A]">{b.title}</Link>
                      <p className="text-xs text-[#6B7280] mt-1 line-clamp-2">{blogExcerpt(b, 110)}</p>
                      <div className="flex items-center gap-4 mt-auto pt-2">
                        <Link href={`/blogs/${b.id}`} className="flex items-center text-xs font-semibold text-[#1E3A8A]">{t("blogsPage.readMore")} <ChevronRight size={13} /></Link>
                        {(b.views ?? 0) > 0 && <span className="flex items-center gap-1 text-[11px] text-[#9CA3AF]"><Eye size={11} /> {b.views}</span>}
                      </div>
                    </div>
                    <button onClick={() => toggleFavorite(b)} aria-label={favorites.has(b.id) ? t("blogsPage.removeFav") : t("blogsPage.addFav")}
                      className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 flex items-center justify-center shadow-sm hover:scale-110 transition-transform">
                      <Heart size={15} className={favorites.has(b.id) ? "fill-[#E11D48] text-[#E11D48]" : "text-[#9CA3AF]"} />
                    </button>
                    {isStaff && (
                      <Link href={`/blogs/${b.id}/update`} className="absolute top-3 right-12 w-8 h-8 rounded-full bg-white/90 flex items-center justify-center shadow-sm text-[#6B7280] hover:text-[#1E3A8A]" aria-label={t("common.edit")}>
                        <Pencil size={13} />
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            )}
            {teachings.length > shown && (
              <div className="flex justify-center mt-8">
                <button onClick={() => setShown((n) => n + 6)} className="px-6 py-2.5 rounded-full bg-white text-sm font-semibold text-[#1E3A8A] shadow-sm hover:shadow-md">{t("blogsPage.showMore")}</button>
              </div>
            )}
          </section>

          {/* Videos */}
          <section>
            <div className="text-center">
              <h2 className="font-display text-3xl font-bold text-[#111827]">{t("blogsPage.videos")}</h2>
              <p className="text-[#374151] mt-2">{t("blogsPage.videosHint")}</p>
            </div>
            <div className="grid xl:grid-cols-[1fr_220px] gap-8 mt-8 items-start">
              <div className="space-y-8 min-w-0">
                {heroVideo ? (
                  <div className="relative rounded-3xl overflow-hidden min-h-[340px] flex items-end shadow-xl">
                    {thumb(heroVideo) ? <img src={thumb(heroVideo)!} alt="" className="absolute inset-0 w-full h-full object-cover" /> : <div className="absolute inset-0 bg-gradient-to-br from-[#1B2E6B] to-[#0B1430]" />}
                    <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-black/10" />
                    <div className="relative p-8 sm:p-10 text-white max-w-xl">
                      <span className="px-2.5 py-1 rounded-full bg-[#F5C518] text-[#111827] text-[10px] font-bold">{t("blogsPage.newTeaching")}</span>
                      <p className="font-display text-3xl sm:text-4xl font-bold leading-tight mt-4">{heroVideo.title}</p>
                      <p className="text-white/85 mt-3 line-clamp-2">{blogExcerpt(heroVideo, 150)}</p>
                      <div className="flex gap-3 mt-6">
                        <button onClick={() => watch(heroVideo)} className="flex items-center gap-2 px-6 py-3 rounded-full bg-[#F5C518] text-[#111827] font-semibold hover:bg-[#e6b800]"><Play size={16} fill="currentColor" /> {t("blogsPage.watchNow")}</button>
                        <Link href={`/blogs/${heroVideo.id}`} className="px-6 py-3 rounded-full bg-white/10 border border-white/30 font-semibold hover:bg-white/20">{t("blogsPage.details")}</Link>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-3xl p-10 text-center text-[#9CA3AF]">{t("blogsPage.noVideos")}</div>
                )}

                {moreVideos.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-lg font-semibold text-[#111827]">{t("blogsPage.featured")}</p>
                      {videos.length > 5 && <button onClick={() => setAllVideos((v) => !v)} className="text-sm font-semibold text-[#1E3A8A] hover:underline">{allVideos ? t("blogsPage.showLess") : t("events.viewAll")}</button>}
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
                      {moreVideos.map((v) => (
                        <button key={v.id} onClick={() => watch(v)} className="group text-left">
                          <div className="relative aspect-video rounded-xl overflow-hidden bg-[#1B2E6B]">
                            {thumb(v) && <img src={thumb(v)!} alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />}
                            <span className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors">
                              <span className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Play size={16} className="text-[#111827] ml-0.5" fill="currentColor" /></span>
                            </span>
                          </div>
                          <div className="flex gap-2.5 mt-3">
                            {v.authorPhotoURL ? <img src={v.authorPhotoURL} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" /> : <span className="w-8 h-8 rounded-full bg-[#EEF1F8] text-[#1B2E6B] text-xs font-bold flex items-center justify-center flex-shrink-0">{(v.authorName || "?")[0]}</span>}
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-[#111827] line-clamp-2 leading-snug">{v.title}</p>
                              <p className="text-[11px] text-[#6B7280] mt-0.5">{v.authorName} • {v.views ?? 0} views • {ago(v)}</p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Categories */}
              <div>
                <p className="text-sm font-bold tracking-widest text-[#111827] mb-4">{t("blogsPage.categories")}</p>
                <div className="space-y-3">
                  {categories.map((c) => {
                    const st = CATEGORY_STYLE[c] ?? { Icon: Tag, cls: "bg-[#F1F4F9] text-[#4B5563]" };
                    return (
                      <button key={c} onClick={() => chooseCategory(c)}
                        className={`w-full flex items-center gap-3 rounded-xl px-2 py-1.5 text-left transition-colors ${category === c ? "bg-white shadow-sm" : "hover:bg-white/60"}`}>
                        <span className={`w-9 h-9 rounded-full flex items-center justify-center ${st.cls}`}><st.Icon size={16} /></span>
                        <span className="text-sm font-medium text-[#111827]">{t(`blogCat.${c}`, { defaultValue: c })}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>
        </>
      )}

      {/* Video player */}
      {playing && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setPlaying(null)}>
          <div className="w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between text-white mb-3">
              <p className="font-semibold truncate">{playing.title}</p>
              <button onClick={() => setPlaying(null)} aria-label={t("common.close")}><X size={22} /></button>
            </div>
            {youTubeEmbed(playing.videoURL)
              ? <iframe src={`${youTubeEmbed(playing.videoURL)}?autoplay=1`} title={playing.title} className="w-full aspect-video rounded-xl" allow="autoplay; encrypted-media" allowFullScreen />
              : <video src={playing.videoURL ?? undefined} controls autoPlay className="w-full rounded-xl bg-black max-h-[75vh]" />}
            <Link href={`/blogs/${playing.id}`} className="inline-block mt-3 text-sm font-semibold text-[#F5C518] hover:underline">{t("blogsPage.readFull")}</Link>
          </div>
        </div>
      )}

      {/* Pick a blog to update */}
      {picking && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setPicking(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB]">
              <p className="text-lg font-bold text-[#111827]">{t("blogsPage.choose")}</p>
              <button onClick={() => setPicking(false)} className="text-[#6B7280]" aria-label={t("common.close")}><X size={18} /></button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto divide-y divide-[#F3F4F6]">
              {posts.map((b) => (
                <Link key={b.id} href={`/blogs/${b.id}/update`} className="flex items-center gap-3 px-6 py-3 hover:bg-[#F9FAFB]">
                  {thumb(b) ? <img src={thumb(b)!} alt="" className="w-12 h-12 rounded-lg object-cover" /> : <span className="w-12 h-12 rounded-lg bg-[#EEF1F8]" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#111827] truncate">{b.title}</p>
                    <p className="text-xs text-[#6B7280]">{b.category} · {ago(b)}{isScheduled(b) ? " · scheduled" : ""}</p>
                  </div>
                  <Pencil size={14} className="text-[#9CA3AF]" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
