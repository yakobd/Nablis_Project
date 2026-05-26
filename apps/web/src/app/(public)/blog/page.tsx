"use client";
import React, { useState, useEffect } from "react";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { BlogCard, BlogCardData } from "@/components/public/BlogCard";

const ALL = "All";

const FALLBACK: BlogCardData[] = [
  {
    id: "1",
    title: "The Importance of Fasting in the Orthodox Faith",
    content:
      "Fasting is one of the most ancient practices of the Christian church. In the Ethiopian Orthodox tradition, fasting is seen not merely as abstinence from food, but as a spiritual discipline that draws us closer to God through prayer and repentance. When we fast, we acknowledge our dependence on God rather than on the physical sustenance of this world.",
    category: "Teachings",
    authorName: "Aba Gorgorios",
    pinned: true,
    publishAt: null,
    createdAt: null,
  },
  {
    id: "2",
    title: "Understanding the Holy Trinity in Orthodox Christianity",
    content:
      "The doctrine of the Holy Trinity is central to Orthodox Christianity. Understanding the relationship between the Father, the Son, and the Holy Spirit is foundational to our faith and worship. The Ethiopian Orthodox Church holds a distinctive Christological position that reflects centuries of theological reflection.",
    category: "Theology",
    authorName: "Aba Gorgorios",
    pinned: false,
    publishAt: null,
    createdAt: null,
  },
  {
    id: "3",
    title: "Community Prayer: Strengthening Our Bond in Faith",
    content:
      "There is profound power in gathering together in prayer. When our community comes together to lift our voices and hearts to God, we experience a spiritual unity that transcends individual worship. Community prayer has been a cornerstone of Ethiopian Orthodox life for centuries.",
    category: "Community",
    authorName: "Aba Gorgorios",
    pinned: false,
    publishAt: null,
    createdAt: null,
  },
  {
    id: "4",
    title: "The Role of the Saints in Orthodox Intercession",
    content:
      "In the Ethiopian Orthodox Tewahedo Church, the veneration of saints is a deeply held tradition. We believe that the saints who have gone before us continue to intercede on our behalf before God, forming a great cloud of witnesses that surrounds us in our earthly journey.",
    category: "Theology",
    authorName: "Aba Gorgorios",
    pinned: false,
    publishAt: null,
    createdAt: null,
  },
  {
    id: "5",
    title: "Raising Orthodox Children in the Diaspora",
    content:
      "One of the greatest challenges facing Ethiopian Orthodox families living abroad is raising their children in the faith. Far from the cultural and religious environment of Ethiopia, parents often struggle to pass on the traditions, language, and deep spiritual roots of our church.",
    category: "Family",
    authorName: "Aba Gorgorios",
    pinned: false,
    publishAt: null,
    createdAt: null,
  },
  {
    id: "6",
    title: "The Meaning of the Ethiopian Meskel Celebration",
    content:
      "Meskel, the feast of the True Cross, is one of the most significant celebrations in the Ethiopian Orthodox calendar. This joyful commemoration marks the discovery of the True Cross by Queen Helena and is observed with great fanfare, bonfires, and communal celebration.",
    category: "Traditions",
    authorName: "Aba Gorgorios",
    pinned: false,
    publishAt: null,
    createdAt: null,
  },
];

export default function BlogPage() {
  const [posts, setPosts] = useState<BlogCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState(ALL);

  useEffect(() => {
    async function fetchPosts() {
      setLoading(true);
      try {
        const q = query(
          collection(db, "blogPosts"),
          where("published", "==", true),
          orderBy("createdAt", "desc")
        );
        const snap = await getDocs(q);
        if (snap.empty) {
          setPosts(FALLBACK);
        } else {
          setPosts(
            snap.docs.map((doc) => ({
              id: doc.id,
              ...(doc.data() as Omit<BlogCardData, "id">),
            }))
          );
        }
      } catch {
        setPosts(FALLBACK);
      } finally {
        setLoading(false);
      }
    }
    fetchPosts();
  }, []);

  const categories = [ALL, ...Array.from(new Set(posts.map((p) => p.category)))];
  const filtered = activeCategory === ALL ? posts : posts.filter((p) => p.category === activeCategory);
  const pinned = filtered.find((p) => p.pinned);
  const rest = filtered.filter((p) => !p.pinned || filtered.indexOf(p) > 0);

  return (
    <>
      {/* Hero */}
      <section className="bg-[#1B2E6B] py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-[#F5C518] font-semibold text-sm uppercase tracking-widest mb-3">
            Blog
          </p>
          <h1 className="text-4xl lg:text-5xl font-bold text-white mb-5 leading-tight">
            Teachings & Reflections
          </h1>
          <p className="text-white/60 max-w-2xl mx-auto text-lg leading-relaxed">
            Spiritual insights, theological reflections, and community stories from
            Aba Gorgorios and the Nablis Ministry.
          </p>
        </div>
      </section>

      <section className="py-12 bg-[#EEF1F8] min-h-[60vh]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Category filter */}
          <div className="flex flex-wrap gap-2 mb-8">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={[
                  "px-4 py-2 rounded-full text-sm font-medium transition-colors",
                  activeCategory === cat
                    ? "bg-[#1B2E6B] text-white"
                    : "bg-white text-[#6B7280] hover:bg-[#1B2E6B] hover:text-white border border-[#E5E7EB]",
                ].join(" ")}
              >
                {cat}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="py-20 text-center text-[#9CA3AF]">
              <div className="w-8 h-8 border-2 border-[#1B2E6B] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm">Loading posts…</p>
            </div>
          ) : (
            <>
              {/* Featured post */}
              {pinned && (
                <div className="mb-8">
                  <BlogCard post={pinned} featured />
                </div>
              )}

              {/* Grid */}
              {rest.length > 0 ? (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {rest.map((post) => (
                    <BlogCard key={post.id} post={post} />
                  ))}
                </div>
              ) : !pinned ? (
                <div className="py-20 text-center text-[#9CA3AF]">
                  <p className="text-5xl mb-3">📖</p>
                  <p className="text-lg font-medium">No posts yet</p>
                  <p className="text-sm mt-1">Check back soon for teachings from our community.</p>
                </div>
              ) : null}
            </>
          )}
        </div>
      </section>
    </>
  );
}
