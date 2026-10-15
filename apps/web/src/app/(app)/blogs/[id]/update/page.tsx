"use client";
import { useParams } from "next/navigation";
import { useAuth } from "@/lib/firebase";
import { BlogForm } from "@/components/blog/BlogForm";

export default function UpdateBlogPage() {
  const { id } = useParams<{ id: string }>();
  const { role } = useAuth();
  if (role !== "admin" && role !== "super_admin") {
    return <div className="py-16 text-center text-[#6B7280]">Only ministry staff can edit blogs.</div>;
  }
  return <BlogForm blogId={id} />;
}
