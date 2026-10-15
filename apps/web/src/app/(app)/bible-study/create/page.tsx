"use client";
import { useAuth } from "@/lib/firebase";
import { StudyEditor } from "@/components/bible/StudyEditor";

export default function CreateBibleStudyPage() {
  const { role } = useAuth();
  if (role !== "admin" && role !== "super_admin") {
    return <div className="py-16 text-center text-[#6B7280]">Only ministry staff can create Bible studies.</div>;
  }
  return <StudyEditor />;
}
