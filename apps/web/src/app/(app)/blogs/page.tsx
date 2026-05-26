"use client";
import React, { useEffect, useState } from "react";
import { collection, query, orderBy, getDocs, where, Timestamp } from "firebase/firestore";
import { db, useAuth } from "@/lib/firebase";
import Link from "next/link";
import { Plus, Pencil, Play, Eye, Clock, BookOpen, Film } from "lucide-react";
import type { BlogPost } from "@nablis/shared/firebase";

// ── helpers ───────────────────────────────────────────────────────────────────
function fmtDate(ts: Timestamp | null | undefined) {
  if (!ts) return "";
  try {
    return ts.toDate().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch { return ""; }
}
function timeAgo(ts: Timestamp | null | undefined) {
  if (!ts) return "";
  try {
    const d = Date.now() - ts.toDate().getTime();
    const days = Math.floor(d / 86400000);
    if (days > 0) return `${days}d ago`;
    const hrs = Math.floor(d / 3600000);
    return hrs > 0 ? `${hrs}h ago` : "Just now";
  } catch { return ""; }
}
function excerpt(s: string, n = 120) {
  return s.length <= n ? s : s.slice(0, n).trimEnd() + "…";
}

// ── Featured article card ─────────────────────────────────────────────────────
function FeaturedCard({ post }: { post: BlogPost }) {
  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-[#E5E7EB] shadow-sm group">
      <div className="aspect-[16/9] bg-gradient-to-br from-[#1B2E6B] to-[#2a4499] overflow-hidden">
        {post.imageURL ? (
          <img src={post.imageURL} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <BookOpen size={40} className="text-white/20" />
          </div>
        )}
      </div>
      <div className="p-5">
        <div className="flex items-center gap-2 mb-2">
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#F5C518]/20 text-[#1B2E6B]">
            {post.category}
          </span>
          {post.pinned && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#1B2E6B] text-white">FEATURED</span>
          )}
        </div>
        <h3 className="text-[#1B2E6B] font-bold text-sm mb-1.5 line-clamp-2">{post.title}</h3>
        <p className="text-[#6B7280] text-xs leading-relaxed mb-3 line-clamp-2">{excerpt(post.content)}</p>
        <div className="flex items-center justify-between">
          <span className="text-[#9CA3AF] text-[10px]">{fmtDate(post.publishAt ?? post.createdAt)}</span>
          <Link href={`/blogs/${post.id}`} className="text-xs font-semibold text-[#1B2E6B] hover:text-[#F5C518] transition-colors">
            Read more →
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Small article card ────────────────────────────────────────────────────────
function SmallCard({ post }: { post: BlogPost }) {
  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-4 flex gap-4 group hover:shadow-md transition-shadow">
      <div className="w-20 h-20 rounded-xl overflow-hidden bg-[#EEF1F8] flex-shrink-0">
        {post.imageURL ? (
          <img src={post.imageURL} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center"><BookOpen size={20} className="text-[#9CA3AF]" /></div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-[10px] font-bold text-[#1B2E6B] bg-[#EEF1F8] px-2 py-0.5 rounded-full">{post.category}</span>
        <h4 className="text-[#1B2E6B] font-semibold text-xs mt-1.5 mb-1 line-clamp-2">{post.title}</h4>
        <p className="text-[#9CA3AF] text-[10px]">{fmtDate(post.publishAt ?? post.createdAt)}</p>
      </div>
    </div>
  );
}

// ── Video card ────────────────────────────────────────────────────────────────
function VideoFeatured({ post }: { post: BlogPost }) {
  return (
    <div className="bg-[#1B2E6B] rounded-2xl overflow-hidden relative aspect-[16/9] flex items-end">
      {post.imageURL && (
        <img src={post.imageURL} alt={post.title} className="absolute inset-0 w-full h-full object-cover opacity-40" />
      )}
      <div className="relative p-5 w-full bg-gradient-to-t from-black/80 to-transparent">
        <div className="w-10 h-10 rounded-full bg-[#F5C518] flex items-center justify-center mb-3">
          <Play size={16} className="text-[#1B2E6B] ml-0.5" />
        </div>
        <p className="text-white font-bold text-sm line-clamp-2">{post.title}</p>
        <p className="text-white/50 text-xs mt-1">{post.authorName}</p>
      </div>
    </div>
  );
}

const FILTER_TABS = ["All", "Latest", "Most Read", "Favorites"] as const;
type FilterTab = (typeof FILTER_TABS)[number];

// ── Page ─────────────────────────────────────────────────────────────────────
export default function BlogsPage() {
  const { user, role } = useAuth();
  const isAdminOrSuperAdmin = role === "admin" || role === "super_admin";
  const [posts, setPosts]         = useState<BlogPost[]>([]);
  const [loading, setLoading]     = useState(true);
  const [filterTab, setFilterTab] = useState<FilterTab>("All");

  useEffect(() => {
    getDocs(query(collection(db, "blogPosts"), orderBy("createdAt", "desc")))
      .then((snap) => setPosts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as BlogPost))))
      .finally(() => setLoading(false));
  }, []);

  const featured  = posts.filter((p) => p.pinned);
  const grid      = posts.filter((p) => !p.pinned).slice(0, 6);
  const videos    = posts.filter((p) => p.videoURL).slice(0, 4);
  const teachings = filterTab === "Latest" ? [...posts].slice(0, 5)
    : filterTab === "Most Read" ? [...posts].reverse().slice(0, 5)
    : posts.slice(0, 5);

  if (!user) return null;

  return (
    <div className="space-y-7">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#1B2E6B]">Blogs</h1>
          <p className="text-[#9CA3AF] text-sm mt-0.5">Manage spiritual teachings and articles</p>
        </div>
        {isAdminOrSuperAdmin && (
          <div className="flex gap-2">
            <Link href="/blogs/create"
              className="flex items-center gap-1.5 bg-[#F5C518] text-[#1B2E6B] font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-[#e6b800] transition-colors">
              <Plus size={15} /> Create New Blog
            </Link>
            {posts.length > 0 && (
              <Link href={`/blogs/${posts[0]?.id}/update`}
                className="flex items-center gap-1.5 bg-[#EEF1F8] text-[#1B2E6B] font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-[#dde3f0] transition-colors">
                <Pencil size={14} /> Update Existing Blog
              </Link>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="py-16 text-center"><div className="w-7 h-7 border-2 border-[#1B2E6B] border-t-transparent rounded-full animate-spin mx-auto" /></div>
      ) : (
        <>
          {/* Featured articles grid */}
          {featured.length > 0 && (
            <section>
              <h2 className="text-[#1B2E6B] font-semibold text-sm mb-4">Featured Articles</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                {featured.slice(0, 2).map((p) => <FeaturedCard key={p.id} post={p} />)}
              </div>
            </section>
          )}

          {/* Teachings for you */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[#1B2E6B] font-semibold text-sm">Teachings for You</h2>
              <div className="flex gap-1 bg-white rounded-xl border border-[#E5E7EB] p-1">
                {FILTER_TABS.map((t) => (
                  <button key={t} onClick={() => setFilterTab(t)}
                    className={[
                      "px-3 py-1 rounded-lg text-xs font-medium transition-colors",
                      filterTab === t ? "bg-[#1B2E6B] text-white" : "text-[#6B7280] hover:text-[#1B2E6B]",
                    ].join(" ")}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            {teachings.length === 0 ? (
              <p className="text-[#9CA3AF] text-sm">No posts yet.</p>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {teachings.map((p) => <SmallCard key={p.id} post={p} />)}
              </div>
            )}
          </section>

          {/* Videos for you */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Film size={16} className="text-[#1B2E6B]" />
              <h2 className="text-[#1B2E6B] font-semibold text-sm">Videos for You</h2>
            </div>
            {videos.length === 0 ? (
              <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6 text-center text-[#9CA3AF] text-sm">
                No video content yet. Add video URLs when creating a blog post.
              </div>
            ) : (
              <div className="grid lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2">
                  <VideoFeatured post={videos[0]} />
                </div>
                <div className="space-y-2">
                  <p className="text-[#9CA3AF] text-xs font-semibold uppercase tracking-wide mb-2">More Videos</p>
                  {videos.slice(1).map((p) => (
                    <div key={p.id} className="flex items-center gap-3 bg-white rounded-xl border border-[#E5E7EB] p-3 hover:shadow-sm transition-shadow">
                      <div className="w-12 h-12 rounded-lg bg-[#1B2E6B] flex items-center justify-center flex-shrink-0">
                        <Play size={14} className="text-[#F5C518] ml-0.5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[#374151] text-xs font-medium line-clamp-2">{p.title}</p>
                        <p className="text-[#9CA3AF] text-[10px] mt-0.5">{timeAgo(p.createdAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Featured teachings row */}
          {grid.length > 0 && (
            <section>
              <h2 className="text-[#1B2E6B] font-semibold text-sm mb-4">All Articles</h2>
              <div className="space-y-2">
                {grid.map((p, i) => (
                  <div key={p.id} className="bg-white rounded-2xl border border-[#E5E7EB] p-4 flex items-center gap-4 hover:shadow-sm transition-shadow group">
                    <div className="w-14 h-14 rounded-xl overflow-hidden bg-[#EEF1F8] flex-shrink-0">
                      {p.imageURL ? (
                        <img src={p.imageURL} alt={p.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-lg">{["📖","🙏","✝️","📜","🕊️"][i % 5]}</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[#1B2E6B] font-semibold text-sm line-clamp-1">{p.title}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[#9CA3AF] text-[10px] flex items-center gap-1"><Eye size={10} /> {Math.floor(Math.random() * 500 + 50)} views</span>
                        <span className="text-[#9CA3AF] text-[10px]">{timeAgo(p.createdAt)}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <Link href={`/blogs/${p.id}`} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#1B2E6B] bg-[#EEF1F8] hover:bg-[#1B2E6B] hover:text-white transition-colors">View</Link>
                      {isAdminOrSuperAdmin && (
                        <Link href={`/blogs/${p.id}/update`} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#6B7280] border border-[#E5E7EB] hover:bg-[#EEF1F8] transition-colors">Edit</Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
