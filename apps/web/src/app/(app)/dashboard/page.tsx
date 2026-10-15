"use client";
import React from "react";
import { useAuth } from "@/lib/firebase";
import { StaffDashboard } from "./_components/StaffDashboard";
import { MemberDashboard } from "./_components/MemberDashboard";

export default function DashboardPage() {
  const { user, role } = useAuth();
  if (!user) return null;
  return role === "super_admin" || role === "admin" ? <StaffDashboard /> : <MemberDashboard />;
}
