import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { collection, addDoc, onSnapshot, query, serverTimestamp, where } from 'firebase/firestore';
import {
  useAuth, useVerseOfDay, activePrayers, prayerKey, prayerName, formatTime12, currentStreak, toIsoDate,
  DEFAULT_PRAYERS, type DailyPrayer, type PrayerLog,
} from '@nablis/shared/firebase';
import { db } from '../../lib/firebase';
import { PrayerCard } from '../../components/PrayerCard';
import { themedStyles, themedColors } from "../../theme";
import i18n from "@nablis/i18n";

const L = { navy: '#1B2E6B', yellow: '#F5C518', white: '#FFFFFF', grey: '#6B7280' };
const C = themedColors(L);

// The ministry's daily prayers (set by admins on the web), with today's
// progress. Marking one as prayed logs it for the admin progress reports.
export default function DailyPrayersScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const { user } = useAuth();
  const { verse } = useVerseOfDay();
  const [prayerDocs, setPrayerDocs] = useState<DailyPrayer[] | null>(null);
  const [logs, setLogs] = useState<PrayerLog[] | null>(null);
  const [marking, setMarking] = useState<string | null>(null);

  useEffect(() => onSnapshot(collection(db, 'dailyPrayers'),
    (s) => setPrayerDocs(s.docs.map((d) => ({ id: d.id, ...d.data() } as DailyPrayer))),
    () => setPrayerDocs([])), []);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(query(collection(db, 'prayerLogs'), where('userId', '==', user.id)),
      (s) => setLogs(s.docs.map((d) => ({ id: d.id, ...d.data() } as PrayerLog))),
      () => setLogs([]));
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Configured prayers; the three standard ones until the ministry adds its own.
  const prayers: DailyPrayer[] = useMemo(() => {
    const configured = activePrayers(prayerDocs ?? []);
    if (prayerDocs && configured.length) return configured;
    return DEFAULT_PRAYERS.map((p) => ({ ...p, id: p.type!, enabled: true } as DailyPrayer));
  }, [prayerDocs]);

  const today = toIsoDate(new Date());
  const doneToday = useMemo(() => new Set((logs ?? [])
    .filter((l) => l.prayedAt?.toDate && toIsoDate(l.prayedAt.toDate()) === today)
    .map((l) => l.prayerType)), [logs, today]);
  const streak = useMemo(() => currentStreak(logs ?? []), [logs]);

  const nowHm = new Date().toTimeString().slice(0, 5);
  const upNext = prayers.find((p) => !doneToday.has(prayerKey(p)) && p.time <= nowHm)
    ?? prayers.find((p) => !doneToday.has(prayerKey(p)));

  async function markPrayed(p: DailyPrayer) {
    const key = prayerKey(p);
    if (!user || doneToday.has(key)) return;
    setMarking(key);
    try {
      await addDoc(collection(db, 'prayerLogs'), {
        userId: user.id, prayerType: key, prayedAt: serverTimestamp(), createdAt: serverTimestamp(),
      });
    } finally {
      setMarking(null);
    }
  }

  const done = prayers.filter((p) => doneToday.has(prayerKey(p))).length;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} accessibilityLabel={i18n.t('common.back')}>
          <Ionicons name="arrow-back" size={22} color={C.navy} />
        </TouchableOpacity>
        <Text style={styles.title}>{i18n.t("nav.dailyPrayers")}</Text>
      </View>

      <View style={styles.banner}>
        <Text style={styles.bannerLabel}>{i18n.t('mobile.verseOfDay')}</Text>
        <Text style={styles.bannerQuote}>“{verse.text}”</Text>
        <Text style={styles.bannerVerse}>— {verse.ref}</Text>
      </View>

      <View style={styles.stats}>
        <View style={styles.stat}>
          <Ionicons name="flame" size={18} color={C.yellow} />
          <Text style={styles.statNum}>{streak}</Text>
          <Text style={styles.statLabel}>{i18n.t('plan.streak')}</Text>
        </View>
        <View style={styles.stat}>
          <Ionicons name="checkmark-done" size={18} color={C.navy} />
          <Text style={styles.statNum}>{done}/{prayers.length}</Text>
          <Text style={styles.statLabel}>{i18n.t('mobile.todayGlance')}</Text>
        </View>
      </View>

      {logs === null || prayerDocs === null ? (
        <ActivityIndicator color={C.navy} style={{ marginTop: 24 }} />
      ) : (
        <View style={styles.list}>
          {prayers.map((p) => {
            const key = prayerKey(p);
            const status = doneToday.has(key) ? 'completed' : upNext && prayerKey(upNext) === key ? 'upcoming' : 'scheduled';
            return (
              <PrayerCard
                key={p.id}
                title={prayerName(p)}
                time={formatTime12(p.time)}
                prayerText={p.message}
                status={status}
                onPress={() => markPrayed(p)}
                loading={marking === key}
              />
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = themedStyles({
  container:   { flex: 1, backgroundColor: '#EEF1F8' },
  header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 16, gap: 12 },
  backBtn:     { padding: 4 },
  title:       { fontSize: 24, fontWeight: 'bold', color: '#1B2E6B' },
  banner:      { marginHorizontal: 16, marginBottom: 14, backgroundColor: '#1B2E6B', borderRadius: 16, padding: 20 },
  bannerLabel: { color: '#F5C518', fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 8 },
  bannerQuote: { color: '#FFFFFF', fontSize: 17, fontStyle: 'italic', lineHeight: 24, marginBottom: 8 },
  bannerVerse: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  stats:       { flexDirection: 'row', gap: 12, marginHorizontal: 16, marginBottom: 14 },
  stat:        { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, alignItems: 'center', gap: 2 },
  statNum:     { fontSize: 20, fontWeight: '800', color: '#1B2E6B' },
  statLabel:   { fontSize: 11, color: '#6B7280', textAlign: 'center' },
  list:        { marginHorizontal: 16 },
});
