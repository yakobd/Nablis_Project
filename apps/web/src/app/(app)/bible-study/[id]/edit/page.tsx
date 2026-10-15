"use client";
import { useParams } from "next/navigation";
import { useAuth } from "@/lib/firebase";
import { StudyEditor } from "@/components/bible/StudyEditor";

export default function EditBibleStudyPage() {
  const { id } = useParams<{ id: string }>();
  const { role } = useAuth();
  if (role !== "admin" && role !== "super_admin") {
    return <div className="py-16 text-center text-[#6B7280]">Only ministry staff can edit Bible studies.</div>;
  }
  return <StudyEditor studyId={id} />;
}
