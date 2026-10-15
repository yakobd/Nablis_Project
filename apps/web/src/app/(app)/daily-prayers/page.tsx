"use client";
import { useAuth } from "@/lib/firebase";
import { AdminPrayers } from "./_components/AdminPrayers";
import { MemberPrayers } from "./_components/MemberPrayers";

export default function DailyPrayersPage() {
  const { user, role } = useAuth();
  if (!user) return null;
  return role === "admin" || role === "super_admin" ? <AdminPrayers /> : <MemberPrayers />;
}
