"use client";
import React, { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { collection, getDocs, query, where, type DocumentData } from "firebase/firestore";
import { db, useAuth } from "@/lib/firebase";
import { Search } from "lucide-react";
import { useTranslation } from "@nablis/i18n";

interface Result {
  id: string;
  kind: string;
  title: string;
  snippet: string;
  href: string;
}

type Source = {
  kind: string;
  staffOnly?: boolean;
  load: () => Promise<DocumentData[]>;
  map: (d: DocumentData) => Omit<Result, "kind">;
};

const all = async (path: string) =>
  (await getDocs(collection(db, path))).docs.map((d) => ({ id: d.id, ...d.data() }));

// Firestore has no full-text search; the ministry's data is small enough to
// fetch each collection once and match on the client.
const SOURCES: Source[] = [
  {
    kind: "Blog", load: () => all("blogPosts"),
    map: (d) => ({ id: d.id, title: d.title ?? "", snippet: d.content ?? "", href: `/blogs/${d.id}` }),
  },
  {
    kind: "Event", load: () => all("events"),
    map: (d) => ({ id: d.id, title: d.title ?? "", snippet: `${d.location ?? ""} ${d.description ?? ""}`, href: "/events" }),
  },
  {
    kind: "Bible Study", load: () => all("bibleStudies"),
    map: (d) => ({ id: d.id, title: d.title ?? "", snippet: `${d.teacherName ?? ""} ${d.description ?? ""}`, href: "/bible-study" }),
  },
  {
    kind: "Testimony",
    load: async () => (await getDocs(query(collection(db, "testimonies"), where("status", "==", "published"))))
      .docs.map((d) => ({ id: d.id, ...d.data() })),
    map: (d) => ({ id: d.id, title: d.title ?? "", snippet: `${d.authorName ?? ""} ${d.content ?? ""}`, href: "/testimonials" }),
  },
  {
    kind: "Gallery", load: () => all("gallery"),
    map: (d) => ({ id: d.id, title: d.title ?? "", snippet: `${d.category ?? ""} ${d.churchName ?? ""}`, href: "/gallery-app" }),
  },
  {
    kind: "Member", staffOnly: true, load: () => all("users"),
    map: (d) => ({
      id: d.id,
      title: d.displayName || d.email || "",
      snippet: [d.email, d.christianName, d.cityOfResidence ?? d.city, d.parishChurch].filter(Boolean).join(" · "),
      href: `/settings/members/${d.id}`,
    }),
  },
];

function excerpt(text: string, q: string) {
  const i = text.toLowerCase().indexOf(q);
  if (i < 0) return text.slice(0, 140);
  const start = Math.max(0, i - 50);
  return (start > 0 ? "…" : "") + text.slice(start, start + 160) + (start + 160 < text.length ? "…" : "");
}

function SearchResults() {
  const { t } = useTranslation();
  const params = useSearchParams();
  const q = (params.get("q") ?? "").trim();
  const { role } = useAuth();
  const isStaff = role === "admin" || role === "super_admin";
  const [index, setIndex]     = useState<Result[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!role) return;
    const sources = SOURCES.filter((s) => !s.staffOnly || isStaff);
    Promise.all(sources.map(async (s) => {
      try {
        return (await s.load()).map((d) => ({ ...s.map(d), kind: s.kind }));
      } catch {
        return [];
      }
    })).then((lists) => setIndex(lists.flat())).finally(() => setLoading(false));
  }, [role, isStaff]);

  const results = useMemo(() => {
    const needle = q.toLowerCase();
    if (!needle) return [];
    return index
      .filter((r) => r.title.toLowerCase().includes(needle) || r.snippet.toLowerCase().includes(needle))
      .sort((a, b) => Number(b.title.toLowerCase().includes(needle)) - Number(a.title.toLowerCase().includes(needle)));
  }, [index, q]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[#1B2E6B]">{t("common.search")}</h1>
        <p className="text-[#9CA3AF] text-sm mt-0.5">
          {q ? t("searchPage.resultsFor", { q }) : t("searchPage.hint")}
        </p>
      </div>

      {loading ? (
        <div className="py-16 text-center">
          <div className="w-7 h-7 border-2 border-[#1B2E6B] border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : q && results.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-10 text-center text-[#9CA3AF]">
          <Search size={28} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">{t("searchPage.none")}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm divide-y divide-[#F3F4F6]">
          {results.map((r) => (
            <Link key={`${r.kind}-${r.id}`} href={r.href} className="block px-5 py-4 hover:bg-[#F9FAFB] transition-colors">
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#EEF1F8] text-[#1B2E6B]">{t(`searchPage.kind.${r.kind}`, { defaultValue: r.kind })}</span>
                <span className="text-[#374151] font-semibold text-sm truncate">{r.title || t("searchPage.untitled")}</span>
              </div>
              {r.snippet && <p className="text-[#6B7280] text-xs line-clamp-2">{excerpt(r.snippet, q.toLowerCase())}</p>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={null}>
      <SearchResults />
    </Suspense>
  );
}
