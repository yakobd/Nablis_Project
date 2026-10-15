"use client";
import React, { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db, useAuth, type ReadingPlan } from "@/lib/firebase";
import { MemberReadingPlan } from "./_components/MemberReadingPlan";
import { AdminReadingPlan } from "./_components/AdminReadingPlan";

export default function ReadingPlanPage() {
  const { user, role } = useAuth();
  const isStaff = role === "admin" || role === "super_admin";
  const [plans, setPlans] = useState<ReadingPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    // Members only need the active plan; staff manage all of them.
    const q = isStaff ? collection(db, "readingPlans") : query(collection(db, "readingPlans"), where("active", "==", true));
    return onSnapshot(q, (snap) => {
      setPlans(snap.docs
        .map((d) => ({ id: d.id, entries: [], ...d.data() } as unknown as ReadingPlan))
        .sort((a, b) => Number(b.active) - Number(a.active) || b.year - a.year));
      setLoading(false);
    }, () => setLoading(false));
  }, [user, isStaff]);

  if (!user) return null;
  if (loading) return <div className="py-24"><div className="w-7 h-7 border-2 border-[#1B2E6B] border-t-transparent rounded-full animate-spin mx-auto" /></div>;
  return isStaff ? <AdminReadingPlan plans={plans} /> : <MemberReadingPlan plan={plans[0] ?? null} />;
}
