"use client";
import React, { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { Plus, Trophy, Flame, Target } from "lucide-react";
import {
  db, useAuth, challengeStatus, challengeTotals, type ChallengeDoc, type ChallengeProgress,
} from "@/lib/firebase";
import { ChallengeCard } from "./_components/ChallengeCard";
import { ChallengeFormModal } from "./_components/ChallengeFormModal";
import { PageTitle } from "@/components/PageTitle";
import { useTranslation } from "@nablis/i18n";

function Section({ title, children, count }: { title: string; children: React.ReactNode; count?: number }) {
  return (
    <section>
      <h2 className="font-display text-2xl font-bold text-[#111827] mb-4">
        {title}{count !== undefined && <span className="ml-2 text-base font-medium text-[#6B7280]">{count}</span>}
      </h2>
      {children}
    </section>
  );
}

export default function ChallengesPage() {
  const { t } = useTranslation();
  const { user, role } = useAuth();
  const isStaff = role === "admin" || role === "super_admin";
  const [challenges, setChallenges] = useState<ChallengeDoc[]>([]);
  const [progress, setProgress] = useState<ChallengeProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showPast, setShowPast] = useState(false);

  useEffect(() => {
    if (!user) return;
    const u1 = onSnapshot(collection(db, "challenges"), (snap) => {
      setChallenges(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ChallengeDoc)).sort((a, b) => b.startDate.localeCompare(a.startDate)));
      setLoading(false);
    }, () => setLoading(false));
    // Staff see everyone's progress; members only their own.
    const q = isStaff ? collection(db, "challengeProgress") : query(collection(db, "challengeProgress"), where("userId", "==", user.id));
    const u2 = onSnapshot(q, (snap) => setProgress(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ChallengeProgress))), () => {});
    return () => { u1(); u2(); };
  }, [user, isStaff]);

  const mineById = useMemo(() => new Map(progress.filter((p) => p.userId === user?.id).map((p) => [p.challengeId, p])), [progress, user]);
  const statsById = useMemo(() => {
    const m = new Map<string, { joined: number; completed: number }>();
    for (const c of challenges) {
      const ps = progress.filter((p) => p.challengeId === c.id);
      m.set(c.id, { joined: ps.length, completed: ps.filter((p) => challengeTotals(c, p).complete).length });
    }
    return m;
  }, [challenges, progress]);

  if (!user) return null;

  const live = challenges.filter((c) => challengeStatus(c) !== "ended");
  const past = challenges.filter((c) => challengeStatus(c) === "ended");
  const mine = live.filter((c) => mineById.has(c.id));
  const open = live.filter((c) => !mineById.has(c.id));
  const completedCount = challenges.filter((c) => mineById.has(c.id) && challengeTotals(c, mineById.get(c.id)).complete).length;
  const grid = "grid sm:grid-cols-2 xl:grid-cols-3 gap-6 stagger";

  return (
    <div className="space-y-10">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <PageTitle id={isStaff ? "challengesAdmin" : "challenges"} />
        </div>
        {isStaff && (
          <button onClick={() => setCreating(true)} className="flex items-center gap-2 self-start px-6 py-3 rounded-full bg-[#1E3A8A] text-white text-sm font-semibold shadow-[0_10px_24px_-12px_rgba(30,58,138,0.9)] hover:bg-[#1B2E6B]">
            <Plus size={16} /> {t("challenge.new")}
          </button>
        )}
      </div>

      {!isStaff && (
        <div className="grid grid-cols-3 gap-4 stagger">
          {[
            { label: t("challenge.statActive"), value: mine.length, Icon: Flame, cls: "bg-[#FFEDD5] text-[#EA580C]" },
            { label: t("challenge.statCompleted"), value: completedCount, Icon: Trophy, cls: "bg-[#FEF9C3] text-[#CA8A04]" },
            { label: t("challenge.statOpen"), value: open.length, Icon: Target, cls: "bg-[#EEF1F8] text-[#1E3A8A]" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-2xl p-5 shadow-sm flex items-center gap-4">
              <span className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${s.cls}`}><s.Icon size={20} /></span>
              <div>
                <p className="font-display text-2xl font-bold text-[#111827]">{s.value}</p>
                <p className="text-xs text-[#6B7280]">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="py-16"><div className="w-7 h-7 border-2 border-[#1B2E6B] border-t-transparent rounded-full animate-spin mx-auto" /></div>
      ) : challenges.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center shadow-sm">
          <Trophy size={36} className="mx-auto text-[#1E3A8A]/30" />
          <p className="text-[#111827] font-semibold mt-3">{t("challenge.none")}</p>
          <p className="text-sm text-[#6B7280] mt-1">{isStaff ? t("challenge.noneStaff") : t("challenge.noneMember")}</p>
        </div>
      ) : isStaff ? (
        <>
          <Section title={t("challenge.current")} count={live.length}>
            {live.length ? <div className={grid}>{live.map((c) => <ChallengeCard key={c.id} c={c} stats={statsById.get(c.id)} />)}</div>
              : <p className="text-sm text-[#6B7280]">{t("challenge.noCurrent")}</p>}
          </Section>
          {past.length > 0 && (
            <Section title={t("challenge.past")} count={past.length}>
              <div className={grid}>{past.map((c) => <ChallengeCard key={c.id} c={c} stats={statsById.get(c.id)} />)}</div>
            </Section>
          )}
        </>
      ) : (
        <>
          {mine.length > 0 && (
            <Section title={t("challenge.mine")}>
              <div className={grid}>{mine.map((c) => <ChallengeCard key={c.id} c={c} progress={mineById.get(c.id)} />)}</div>
            </Section>
          )}
          <Section title={t("challenge.joinSection")}>
            {open.length ? <div className={grid}>{open.map((c) => <ChallengeCard key={c.id} c={c} />)}</div>
              : <p className="text-sm text-[#6B7280]">{t("challenge.joinedAll")}</p>}
          </Section>
          {past.length > 0 && (
            <section>
              <button onClick={() => setShowPast((s) => !s)} className="text-sm font-semibold text-[#1E3A8A]">
                {showPast ? t("challenge.hidePast", { n: past.length }) : t("challenge.showPast", { n: past.length })}
              </button>
              {showPast && <div className={grid + " mt-4"}>{past.map((c) => <ChallengeCard key={c.id} c={c} progress={mineById.get(c.id) ?? null} />)}</div>}
            </section>
          )}
        </>
      )}

      {creating && <ChallengeFormModal onClose={() => setCreating(false)} />}
    </div>
  );
}
