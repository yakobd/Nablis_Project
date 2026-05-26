"use client";
import React, { useEffect, useState } from "react";
import { doc, getDoc, updateDoc, Timestamp } from "firebase/firestore";
import { db, useAuth } from "@/lib/firebase";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MessageSquare, Download, Pencil, Eye, EyeOff, Reply, Send, X } from "lucide-react";
import type { BlogPost, Comment } from "@nablis/shared/firebase";

function fmtAgo(ts: Timestamp | null | undefined) {
  if (!ts) return "";
  try {
    const d = Date.now() - ts.toDate().getTime();
    const mins  = Math.floor(d / 60000);
    const hours = Math.floor(mins / 60);
    const days  = Math.floor(hours / 24);
    if (days  > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    return `${mins || 1}m ago`;
  } catch { return ""; }
}
function fmtDate(ts: Timestamp | null | undefined) {
  if (!ts) return "";
  try { return ts.toDate().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }); }
  catch { return ""; }
}

interface ExtComment extends Comment {
  hidden?: boolean;
  replies?: { authorName: string; content: string; createdAt: Timestamp }[];
}

// ── Comment item ──────────────────────────────────────────────────────────────
function CommentItem({
  comment,
  onHide,
  onUnhide,
  onReply,
}: {
  comment: ExtComment;
  onHide: (id: string) => void;
  onUnhide: (id: string) => void;
  onReply: (id: string) => void;
}) {
  const initials = (comment.authorName || "?")[0].toUpperCase();
  return (
    <div className={[
      "p-4 rounded-xl transition-colors",
      comment.hidden ? "bg-[#F9FAFB] border border-dashed border-[#E5E7EB] opacity-60" : "bg-white border border-[#E5E7EB]",
    ].join(" ")}>
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-[#EEF1F8] flex items-center justify-center text-xs font-bold text-[#1B2E6B] flex-shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[#374151] font-semibold text-xs">{comment.authorName}</span>
            <span className="text-[#9CA3AF] text-[10px]">{fmtAgo(comment.createdAt)}</span>
            {comment.hidden && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-gray-100 text-gray-500 uppercase">HIDDEN</span>
            )}
          </div>
          <p className="text-[#6B7280] text-sm leading-relaxed">{comment.content}</p>

          {/* Replies */}
          {(comment.replies ?? []).map((r, i) => (
            <div key={i} className="mt-3 pl-3 border-l-2 border-[#F5C518]">
              <p className="text-[#1B2E6B] font-semibold text-[10px] mb-0.5">Admin Reply</p>
              <p className="text-[#374151] text-xs">{r.content}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button onClick={() => onReply(comment.id)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-[#EEF1F8] text-[#6B7280] text-[10px] font-medium transition-colors">
            <Reply size={11} /> Reply
          </button>
          {comment.hidden ? (
            <button onClick={() => onUnhide(comment.id)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-[#EEF1F8] text-[#1B2E6B] text-[10px] font-medium transition-colors">
              <Eye size={11} /> Unhide
            </button>
          ) : (
            <button onClick={() => onHide(comment.id)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-red-50 text-red-400 text-[10px] font-medium transition-colors">
              <EyeOff size={11} /> Hide
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function BlogDetailPage() {
  const { id }   = useParams<{ id: string }>();
  const router   = useRouter();
  const { user } = useAuth();
  const [post, setPost]               = useState<BlogPost | null>(null);
  const [comments, setComments]       = useState<ExtComment[]>([]);
  const [loading, setLoading]         = useState(true);
  const [disableComments, setDisableComments] = useState(false);
  const [replyingTo, setReplyingTo]   = useState<string | null>(null);
  const [replyText, setReplyText]     = useState("");
  const [postingReply, setPostingReply] = useState(false);
  const [saving, setSaving]           = useState(false);

  useEffect(() => {
    if (!id) return;
    getDoc(doc(db, "blogPosts", id))
      .then((snap) => {
        if (snap.exists()) {
          const data = { id: snap.id, ...snap.data() } as BlogPost;
          setPost(data);
          setComments(data.comments ?? []);
          setDisableComments(!((data as BlogPost & { enableComments?: boolean }).enableComments ?? true));
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  async function toggleComments(val: boolean) {
    setDisableComments(val);
    setSaving(true);
    try {
      await updateDoc(doc(db, "blogPosts", id), { enableComments: !val });
    } finally {
      setSaving(false);
    }
  }

  function hideComment(commentId: string) {
    setComments((prev) => prev.map((c) => c.id === commentId ? { ...c, hidden: true } : c));
  }
  function unhideComment(commentId: string) {
    setComments((prev) => prev.map((c) => c.id === commentId ? { ...c, hidden: false } : c));
  }

  async function postReply() {
    if (!replyText.trim() || !replyingTo || !user) return;
    setPostingReply(true);
    try {
      const reply = {
        authorName: user.displayName || user.email,
        content: replyText.trim(),
        createdAt: Timestamp.now(),
      };
      setComments((prev) => prev.map((c) =>
        c.id === replyingTo
          ? { ...c, replies: [...(c.replies ?? []), reply] }
          : c
      ));
      setReplyText("");
      setReplyingTo(null);
    } finally {
      setPostingReply(false);
    }
  }

  if (!user) return null;

  if (loading) {
    return <div className="py-16 text-center"><div className="w-7 h-7 border-2 border-[#1B2E6B] border-t-transparent rounded-full animate-spin mx-auto" /></div>;
  }
  if (!post) {
    return <div className="py-16 text-center text-[#9CA3AF]"><p className="text-sm">Post not found.</p></div>;
  }

  const visibleComments = comments.filter((c) => !c.hidden);
  const hiddenCount = comments.filter((c) => c.hidden).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-[#EEF1F8] text-[#6B7280] transition-colors">
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-[#1B2E6B] line-clamp-1">{post.title}</h1>
          <p className="text-[#9CA3AF] text-sm mt-0.5">{fmtDate(post.publishAt ?? post.createdAt)}</p>
        </div>
        <Link href={`/blogs/${id}/update`}
          className="flex items-center gap-1.5 bg-[#EEF1F8] text-[#1B2E6B] font-semibold text-sm px-4 py-2 rounded-xl hover:bg-[#dde3f0] transition-colors">
          <Pencil size={13} /> Edit
        </Link>
      </div>

      {/* Post content */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden">
        {post.imageURL && (
          <div className="aspect-[16/6] overflow-hidden">
            <img src={post.imageURL} alt={post.title} className="w-full h-full object-cover" />
          </div>
        )}
        <div className="p-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#F5C518]/20 text-[#1B2E6B]">{post.category}</span>
            {post.pinned && <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#1B2E6B] text-white">FEATURED</span>}
          </div>
          <h2 className="text-xl font-bold text-[#1B2E6B] mb-2">{post.title}</h2>
          <p className="text-[#9CA3AF] text-xs mb-4">By {post.authorName} · {fmtDate(post.publishAt ?? post.createdAt)}</p>
          <div className="prose prose-sm max-w-none text-[#374151]">
            {post.content.split(/\n\n+/).map((para, i) => (
              <p key={i} className="mb-4 leading-7">{para}</p>
            ))}
          </div>
        </div>
      </div>

      {/* Comments section */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#F3F4F6]">
          <div className="flex items-center gap-3">
            <h2 className="text-[#1B2E6B] font-semibold text-sm">Comments</h2>
            <span className="text-xs text-[#9CA3AF]">
              {comments.length} total · {hiddenCount} hidden
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#374151] font-medium">Disable Comments</span>
              <button role="switch" aria-checked={disableComments}
                onClick={() => toggleComments(!disableComments)}
                disabled={saving}
                className={`relative w-8 h-4 rounded-full transition-colors flex-shrink-0 disabled:opacity-50 ${disableComments ? "bg-red-400" : "bg-[#D1D5DB]"}`}>
                <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow-sm transition-transform ${disableComments ? "translate-x-4" : "translate-x-0.5"}`} />
              </button>
            </div>
            <button className="flex items-center gap-1.5 text-xs font-medium text-[#6B7280] hover:text-[#1B2E6B] transition-colors">
              <Download size={13} /> Export
            </button>
          </div>
        </div>

        <div className="p-5 space-y-3">
          {comments.length === 0 ? (
            <div className="py-8 text-center text-[#9CA3AF]">
              <MessageSquare size={28} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No comments yet.</p>
            </div>
          ) : (
            comments.map((c) => (
              <CommentItem
                key={c.id}
                comment={c}
                onHide={hideComment}
                onUnhide={unhideComment}
                onReply={(cid) => { setReplyingTo(cid); setReplyText(""); }}
              />
            ))
          )}

          {/* Reply input */}
          {replyingTo && (
            <div className="flex items-start gap-3 pt-2 border-t border-[#F3F4F6]">
              <div className="w-8 h-8 rounded-full bg-[#1B2E6B] flex items-center justify-center text-[#F5C518] font-bold text-xs flex-shrink-0">
                {(user.displayName || user.email)[0].toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] text-[#9CA3AF]">
                    Replying to comment by {comments.find((c) => c.id === replyingTo)?.authorName}
                  </span>
                  <button onClick={() => setReplyingTo(null)} className="text-[#9CA3AF] hover:text-[#6B7280]"><X size={12} /></button>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); postReply(); } }}
                    placeholder="Type your response…"
                    className="flex-1 px-3 py-2 rounded-xl border border-[#E5E7EB] text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2E6B]/20 focus:border-[#1B2E6B]"
                  />
                  <button onClick={postReply} disabled={postingReply || !replyText.trim()}
                    className="flex items-center gap-1.5 bg-[#F5C518] text-[#1B2E6B] font-semibold text-sm px-4 py-2 rounded-xl hover:bg-[#e6b800] disabled:opacity-60 transition-colors">
                    <Send size={13} /> Post Response
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
