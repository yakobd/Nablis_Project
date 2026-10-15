"use client";
import React, { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { Download } from "lucide-react";
import { db } from "@/lib/firebase";
import { usePublicSettings } from "@/lib/publicSettings";
import { BlogCard, type BlogCardData } from "@/components/public/BlogCard";

// Latest public posts; falls back to the sample posts until real ones exist.
export function LatestPosts({ fallback }: { fallback: BlogCardData[] }) {
  const [posts, setPosts] = useState<BlogCardData[]>(fallback);

  useEffect(() => {
    getDocs(query(
      collection(db, "blogPosts"),
      where("status", "==", "published"),
      where("internal", "==", false)
    )).then((snap) => {
      if (snap.empty) return;
      setPosts(
        snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<BlogCardData, "id">) }))
          // Hide posts scheduled for later.
          .filter((p) => !p.publishAt || p.publishAt.toDate().getTime() <= Date.now())
          .sort((a, b) => (b.createdAt?.toDate().getTime() ?? 0) - (a.createdAt?.toDate().getTime() ?? 0))
          .slice(0, 3)
      );
    }).catch(() => {});
  }, []);

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {posts.map((post) => (
        <BlogCard key={post.id} post={post} />
      ))}
    </div>
  );
}

// Store buttons appear once the links are set in Settings › General.
export function AppStoreButtons() {
  const { appStoreUrl, playStoreUrl } = usePublicSettings();
  if (!appStoreUrl && !playStoreUrl) {
    return <p className="text-white/50 text-sm">Coming soon · Stay tuned for the launch</p>;
  }
  return (
    <div className="flex flex-col sm:flex-row gap-3 justify-center">
      {appStoreUrl && (
        <a href={appStoreUrl} target="_blank" rel="noreferrer"
          className="inline-flex items-center gap-2.5 bg-white text-[#1B2E6B] font-semibold px-6 py-3.5 rounded-xl hover:bg-[#F5C518] transition-colors">
          <Download size={17} />
          App Store
        </a>
      )}
      {playStoreUrl && (
        <a href={playStoreUrl} target="_blank" rel="noreferrer"
          className="inline-flex items-center gap-2.5 bg-white/10 text-white font-semibold px-6 py-3.5 rounded-xl hover:bg-white/20 transition-colors border border-white/20">
          <Download size={17} />
          Google Play
        </a>
      )}
    </div>
  );
}
