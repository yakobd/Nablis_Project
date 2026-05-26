import React from "react";
import Link from "next/link";
import { Calendar, User } from "lucide-react";

export interface BlogCardData {
  id: string;
  title: string;
  content: string;
  category: string;
  authorName: string;
  imageURL?: string;
  pinned?: boolean;
  publishAt?: { toDate: () => Date } | null;
  createdAt?: { toDate: () => Date } | null;
}

interface BlogCardProps {
  post: BlogCardData;
  featured?: boolean;
}

function formatDate(ts: { toDate: () => Date } | null | undefined): string {
  if (!ts) return "";
  try {
    return ts.toDate().toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

function excerpt(content: string, length = 130): string {
  if (content.length <= length) return content;
  return content.slice(0, length).trimEnd() + "…";
}

export function BlogCard({ post, featured = false }: BlogCardProps) {
  const date = formatDate(post.publishAt ?? post.createdAt);

  if (featured) {
    return (
      <article className="bg-white rounded-2xl overflow-hidden border border-[#E5E7EB] shadow-sm md:flex group">
        {/* Image */}
        <div className="md:w-2/5 aspect-video md:aspect-auto overflow-hidden bg-[#EEF1F8] flex items-center justify-center">
          {post.imageURL ? (
            <img
              src={post.imageURL}
              alt={post.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-[#1B2E6B] to-[#2a4499]">
              <span className="text-white/30 text-6xl">📖</span>
            </div>
          )}
        </div>
        {/* Content */}
        <div className="p-6 md:p-8 flex flex-col justify-center md:w-3/5">
          <div className="flex items-center gap-2 mb-3">
            <span className="px-2.5 py-1 bg-[#F5C518]/20 text-[#1B2E6B] text-xs font-semibold rounded-full">
              {post.category}
            </span>
            {post.pinned && (
              <span className="px-2.5 py-1 bg-[#1B2E6B] text-white text-xs font-semibold rounded-full">
                Featured
              </span>
            )}
          </div>
          <h2 className="text-2xl font-bold text-[#1B2E6B] mb-3 line-clamp-2">{post.title}</h2>
          <p className="text-[#6B7280] text-sm leading-relaxed mb-5 line-clamp-3">
            {excerpt(post.content, 200)}
          </p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-xs text-[#9CA3AF]">
              <span className="flex items-center gap-1">
                <User size={12} />
                {post.authorName}
              </span>
              {date && (
                <span className="flex items-center gap-1">
                  <Calendar size={12} />
                  {date}
                </span>
              )}
            </div>
            <Link
              href={`/blog/${post.id}`}
              className="text-sm font-semibold text-[#1B2E6B] hover:text-[#F5C518] transition-colors"
            >
              Read more →
            </Link>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="bg-white rounded-2xl overflow-hidden border border-[#E5E7EB] shadow-sm hover:shadow-md transition-shadow group flex flex-col">
      <div className="aspect-[16/9] overflow-hidden bg-[#EEF1F8]">
        {post.imageURL ? (
          <img
            src={post.imageURL}
            alt={post.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#EEF1F8] to-[#dde3f0]">
            <span className="text-[#9CA3AF] text-4xl">📖</span>
          </div>
        )}
      </div>
      <div className="p-5 flex flex-col flex-1">
        <div className="flex items-center gap-2 mb-2.5">
          <span className="px-2.5 py-0.5 bg-[#EEF1F8] text-[#1B2E6B] text-[11px] font-semibold rounded-full">
            {post.category}
          </span>
          {date && <span className="text-[#9CA3AF] text-xs">{date}</span>}
        </div>
        <h3 className="text-[#1B2E6B] font-semibold text-base mb-2 line-clamp-2 flex-shrink-0">
          {post.title}
        </h3>
        <p className="text-[#6B7280] text-sm leading-relaxed line-clamp-3 flex-1 mb-4">
          {excerpt(post.content)}
        </p>
        <div className="flex items-center justify-between pt-3 border-t border-[#F3F4F6]">
          <span className="flex items-center gap-1.5 text-xs text-[#9CA3AF]">
            <User size={11} />
            {post.authorName}
          </span>
          <Link
            href={`/blog/${post.id}`}
            className="text-xs font-semibold text-[#1B2E6B] hover:text-[#F5C518] transition-colors"
          >
            Read more →
          </Link>
        </div>
      </div>
    </article>
  );
}
