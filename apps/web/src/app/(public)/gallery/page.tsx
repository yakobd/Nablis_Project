"use client";
import React, { useState, useEffect } from "react";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { GalleryGrid, GalleryItemData } from "@/components/public/GalleryGrid";

const CATEGORIES = ["All", "Pilgrimage", "Bible Study", "Community Prayer", "Others"] as const;
type Category = (typeof CATEGORIES)[number];

const FALLBACK_ITEMS: GalleryItemData[] = [
  {
    id: "1",
    imageURL: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=600&q=80",
    title: "Community Prayer Gathering",
    category: "Community Prayer",
  },
  {
    id: "2",
    imageURL: "https://images.unsplash.com/photo-1504052434569-70ad5836ab65?w=600&q=80",
    title: "Bible Study Session",
    category: "Bible Study",
  },
  {
    id: "3",
    imageURL: "https://images.unsplash.com/photo-1499209974431-9dddcece7f88?w=600&q=80",
    title: "Annual Pilgrimage",
    category: "Pilgrimage",
  },
  {
    id: "4",
    imageURL: "https://images.unsplash.com/photo-1438232992991-995b671e4468?w=600&q=80",
    title: "Youth Gathering",
    category: "Community Prayer",
  },
  {
    id: "5",
    imageURL: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=600&q=80",
    title: "Morning Prayer",
    category: "Community Prayer",
  },
  {
    id: "6",
    imageURL: "https://images.unsplash.com/photo-1491895200222-0fc4a4c35e18?w=600&q=80",
    title: "Scripture Reading",
    category: "Bible Study",
  },
];

export default function GalleryPage() {
  const [activeCategory, setActiveCategory] = useState<Category>("All");
  const [items, setItems] = useState<GalleryItemData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchGallery() {
      setLoading(true);
      try {
        const q = query(
          collection(db, "gallery"),
          orderBy("createdAt", "desc")
        );
        const snap = await getDocs(q);
        if (snap.empty) {
          setItems(FALLBACK_ITEMS);
        } else {
          setItems(
            snap.docs.map((doc) => ({
              id: doc.id,
              imageURL: doc.data().imageURL ?? "",
              title: doc.data().title ?? "",
              category: doc.data().category ?? "Others",
            }))
          );
        }
      } catch {
        setItems(FALLBACK_ITEMS);
      } finally {
        setLoading(false);
      }
    }
    fetchGallery();
  }, []);

  const filtered =
    activeCategory === "All"
      ? items
      : items.filter((item) => item.category === activeCategory);

  return (
    <>
      {/* Hero */}
      <section className="bg-[#1B2E6B] py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-[#F5C518] font-semibold text-sm uppercase tracking-widest mb-3">
            Gallery
          </p>
          <h1 className="text-4xl lg:text-5xl font-bold text-white mb-5 leading-tight">
            Moments of Faith & Community
          </h1>
          <p className="text-white/60 max-w-2xl mx-auto text-lg leading-relaxed">
            A visual journey through our gatherings, pilgrimages, Bible studies, and community
            celebrations.
          </p>
        </div>
      </section>

      {/* Filter + Grid */}
      <section className="py-12 bg-[#EEF1F8] min-h-[50vh]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Category tabs */}
          <div className="flex flex-wrap gap-2 mb-8">
            {CATEGORIES.map((cat) => (
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
              <p className="text-sm">Loading gallery…</p>
            </div>
          ) : (
            <GalleryGrid items={filtered} />
          )}
        </div>
      </section>
    </>
  );
}
