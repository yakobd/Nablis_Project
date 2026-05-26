import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { doc, getDoc, collection, query, where, limit, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { BlogCard, BlogCardData } from "@/components/public/BlogCard";
import { Calendar, User, ArrowLeft, Tag } from "lucide-react";

interface BlogDetailPageProps {
  params: { id: string };
}

async function getPost(id: string): Promise<BlogCardData | null> {
  try {
    const snap = await getDoc(doc(db, "blogPosts", id));
    if (!snap.exists()) return null;
    return { id: snap.id, ...(snap.data() as Omit<BlogCardData, "id">) };
  } catch {
    return null;
  }
}

async function getRelatedPosts(category: string, excludeId: string): Promise<BlogCardData[]> {
  try {
    const q = query(
      collection(db, "blogPosts"),
      where("published", "==", true),
      where("category", "==", category),
      limit(4)
    );
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<BlogCardData, "id">) }))
      .filter((p) => p.id !== excludeId)
      .slice(0, 3);
  } catch {
    return [];
  }
}

function formatDate(ts: { toDate: () => Date } | null | undefined): string {
  if (!ts) return "";
  try {
    return ts.toDate().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

const FALLBACK_POST: BlogCardData = {
  id: "1",
  title: "The Importance of Fasting in the Orthodox Faith",
  content: `Fasting is one of the most ancient practices of the Christian church. In the Ethiopian Orthodox tradition, fasting is seen not merely as abstinence from food, but as a spiritual discipline that draws us closer to God through prayer and repentance.

When we fast, we acknowledge our dependence on God rather than on the physical sustenance of this world. The act of voluntarily setting aside our bodily desires creates space for the spirit to breathe, to hear God's voice more clearly, and to align our will with His.

The Ethiopian Orthodox Church observes more fasting days than perhaps any other Christian tradition — over 250 days of fasting throughout the year. These include the Great Lent (Abiy Tsom), the Apostles' Fast, the Fast of the Prophets, and many others. Each of these fasting periods has its own spiritual significance and associated liturgical observances.

During fasting periods, the faithful abstain from all animal products until at least 3:00 PM, often breaking the fast only after attending the liturgy. This is not merely dietary restriction but a holistic spiritual practice that includes increased prayer, attendance at church, reading of scripture, and works of charity.

Fasting without prayer is merely a diet. Prayer without fasting lacks the intensity of bodily involvement. Together, they form a powerful spiritual discipline that has sustained the Ethiopian Orthodox Church through centuries of challenge and persecution.

As we engage in fasting, let us remember its purpose: to humble ourselves before God, to sharpen our spiritual senses, to express solidarity with those who go hungry involuntarily, and to cultivate gratitude for the abundance we receive from God's hand.

May our fasting always be accompanied by genuine repentance, sincere prayer, and acts of love toward our neighbors. For it is in the combination of these practices that we truly draw near to the living God.`,
  category: "Teachings",
  authorName: "Aba Gorgorios",
  pinned: true,
  publishAt: null,
  createdAt: null,
};

const FALLBACK_RELATED: BlogCardData[] = [
  {
    id: "2",
    title: "Understanding the Holy Trinity in Orthodox Christianity",
    content:
      "The doctrine of the Holy Trinity is central to Orthodox Christianity. Understanding the relationship between the Father, the Son, and the Holy Spirit is foundational to our faith and worship...",
    category: "Theology",
    authorName: "Aba Gorgorios",
    publishAt: null,
    createdAt: null,
  },
  {
    id: "3",
    title: "Community Prayer: Strengthening Our Bond in Faith",
    content:
      "There is profound power in gathering together in prayer. When our community comes together to lift our voices and hearts to God, we experience a spiritual unity that transcends individual worship...",
    category: "Community",
    authorName: "Aba Gorgorios",
    publishAt: null,
    createdAt: null,
  },
  {
    id: "5",
    title: "Raising Orthodox Children in the Diaspora",
    content:
      "One of the greatest challenges facing Ethiopian Orthodox families living abroad is raising their children in the faith. Far from the cultural environment of Ethiopia, parents often struggle to pass on traditions...",
    category: "Family",
    authorName: "Aba Gorgorios",
    publishAt: null,
    createdAt: null,
  },
];

export default async function BlogDetailPage({ params }: BlogDetailPageProps) {
  let post = await getPost(params.id);
  let related: BlogCardData[] = [];

  if (!post) {
    // Use fallback for demo
    post = FALLBACK_POST;
    related = FALLBACK_RELATED;
  } else {
    related = await getRelatedPosts(post.category, post.id);
    if (related.length === 0) related = FALLBACK_RELATED.slice(0, 3);
  }

  const date = formatDate(post.publishAt ?? post.createdAt);
  const paragraphs = post.content.split(/\n\n+/).filter(Boolean);

  return (
    <>
      {/* Hero */}
      <section className="bg-[#1B2E6B] py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link
            href="/blog"
            className="inline-flex items-center gap-1.5 text-white/60 hover:text-white text-sm mb-6 transition-colors"
          >
            <ArrowLeft size={14} />
            Back to Blog
          </Link>
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2.5 py-1 bg-[#F5C518]/20 text-[#F5C518] text-xs font-semibold rounded-full flex items-center gap-1">
              <Tag size={10} />
              {post.category}
            </span>
            {post.pinned && (
              <span className="px-2.5 py-1 bg-white/10 text-white text-xs font-semibold rounded-full">
                Featured
              </span>
            )}
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-5 leading-tight">
            {post.title}
          </h1>
          <div className="flex items-center gap-4 text-white/50 text-sm">
            <span className="flex items-center gap-1.5">
              <User size={13} />
              {post.authorName}
            </span>
            {date && (
              <span className="flex items-center gap-1.5">
                <Calendar size={13} />
                {date}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Cover image */}
      {post.imageURL && (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8">
          <div className="aspect-[16/7] rounded-2xl overflow-hidden shadow-lg">
            <img
              src={post.imageURL}
              alt={post.title}
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      )}

      {/* Article body */}
      <article className="py-12 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="prose prose-lg max-w-none text-[#374151] leading-relaxed">
            {paragraphs.map((para, i) => (
              <p key={i} className="mb-5 leading-8 text-[#374151]">
                {para}
              </p>
            ))}
          </div>

          {/* Author card */}
          <div className="mt-12 pt-8 border-t border-[#F3F4F6]">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#1B2E6B] to-[#2a4499] flex items-center justify-center flex-shrink-0">
                <span className="text-[#F5C518] font-bold text-xl leading-none">ን</span>
              </div>
              <div>
                <p className="text-[#1B2E6B] font-semibold">{post.authorName}</p>
                <p className="text-[#9CA3AF] text-sm">Spiritual Father · Nablis Ministry</p>
              </div>
            </div>
          </div>
        </div>
      </article>

      {/* Related posts */}
      {related.length > 0 && (
        <section className="py-16 bg-[#EEF1F8]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-[#1B2E6B] mb-8">More Teachings</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {related.map((p) => (
                <BlogCard key={p.id} post={p} />
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
