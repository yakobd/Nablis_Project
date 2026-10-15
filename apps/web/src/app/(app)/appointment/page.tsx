"use client";
import { useAuth } from "@/lib/firebase";
import { AdminAppointments } from "./_components/AdminAppointments";
import { MemberAppointments } from "./_components/MemberAppointments";

export default function AppointmentPage() {
  const { user, role } = useAuth();
  if (!user) return null;
  return role === "admin" || role === "super_admin" ? <AdminAppointments /> : <MemberAppointments />;
}
