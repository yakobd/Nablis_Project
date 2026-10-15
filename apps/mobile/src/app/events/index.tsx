import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { auth, db } from '../../lib/firebase';
import { collection, getDoc, getDocs, query, doc } from 'firebase/firestore';
import { setRsvp, clearRsvp, eventRange, type EventDoc } from '@nablis/shared/firebase';
import { scheduleEventReminder } from '../../notifications';
import { themedStyles, tc } from "../../theme";
import { Ionicons } from '@expo/vector-icons';
import i18n from "@nablis/i18n";

const locale = () => (i18n.language === 'am' ? 'am-ET' : 'en-US');

// "Sat, Oct 18 · 9:00 AM" or "Oct 18 – Oct 20" for multi-day events.
function whenLabel(e: EventDoc): string {
  const r = eventRange(e);
  if (!r) return i18n.t('events.dateTba');
  const day = (d: Date) => d.toLocaleDateString(locale(), { weekday: 'short', month: 'short', day: 'numeric' });
  if (r.start.toDateString() !== r.end.toDateString()) {
    return `${day(r.start)} – ${r.end.toLocaleDateString(locale(), { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }
  const time = e.time ? ` · ${r.start.toLocaleTimeString(locale(), { hour: 'numeric', minute: '2-digit' })}` : '';
  return `${day(r.start)}${time}`;
}

export default function EventsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [events, setEvents]   = useState<EventDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [rsvping, setRsvping] = useState<string | null>(null);
  const [going, setGoing]     = useState<Set<string>>(new Set());
  const currentUser = auth.currentUser;

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(query(collection(db, 'events')));
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as EventDoc));
        setEvents(data);
        // The member's own RSVPs (events/{id}/rsvps/{uid}).
        if (currentUser) {
          const mine = await Promise.all(data.map(async (e) => {
            const s = await getDoc(doc(db, 'events', e.id, 'rsvps', currentUser.uid)).catch(() => null);
            return s?.exists() && s.data().status === 'attending' ? e.id : null;
          }));
          setGoing(new Set(mine.filter(Boolean) as string[]));
        }
      } catch (e) {
        console.error('[Events] fetch error:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Upcoming events first (soonest on top), then past ones (most recent first).
  const { upcoming, past } = useMemo(() => {
    const now = Date.now();
    const withRange = events.map((e) => ({ e, r: eventRange(e) }));
    const upcoming = withRange.filter(({ r }) => !r || r.end.getTime() >= now)
      .sort((a, b) => (a.r?.start.getTime() ?? Infinity) - (b.r?.start.getTime() ?? Infinity)).map(({ e }) => e);
    const past = withRange.filter(({ r }) => r && r.end.getTime() < now)
      .sort((a, b) => b.r!.start.getTime() - a.r!.start.getTime()).map(({ e }) => e);
    return { upcoming, past };
  }, [events]);

  async function rsvp(event: EventDoc) {
    if (!currentUser) return;
    setRsvping(event.id);
    try {
      await setRsvp(event.id, { id: currentUser.uid, displayName: currentUser.displayName, email: currentUser.email }, 'attending');
      setGoing(prev => new Set(prev).add(event.id));
      await scheduleEventReminder(event).catch(() => {});
    } catch (e) {
      console.error('[Events] RSVP error:', e);
      Alert.alert(i18n.t('mobile.error'), i18n.t('events.rsvpError'));
    } finally {
      setRsvping(null);
    }
  }

  function cancelRsvp(event: EventDoc) {
    if (!currentUser) return;
    Alert.alert(event.title, i18n.t('events.cancelRsvpConfirm'), [
      { text: i18n.t('common.cancel'), style: 'cancel' },
      {
        text: i18n.t('events.cancelRsvp'), style: 'destructive',
        onPress: async () => {
          setRsvping(event.id);
          try {
            await clearRsvp(event.id, currentUser.uid);
            setGoing(prev => { const next = new Set(prev); next.delete(event.id); return next; });
          } catch {
            Alert.alert(i18n.t('mobile.error'), i18n.t('events.rsvpError'));
          } finally {
            setRsvping(null);
          }
        },
      },
    ]);
  }

  function card(event: EventDoc, isPast: boolean) {
    const registered = going.has(event.id);
    const isPending  = rsvping === event.id;
    return (
      <View key={event.id} style={[styles.card, isPast && styles.cardPast]}>
        <Text style={styles.cardTitle}>{event.title}</Text>
        <Text style={styles.cardMeta}><Ionicons name="calendar-outline" size={14} color="#6B7280" />  {whenLabel(event)}</Text>
        {!!event.location    && <Text style={styles.cardMeta}><Ionicons name="location-outline" size={14} color="#6B7280" />  {event.location}</Text>}
        {!!event.description && <Text style={styles.cardDesc} numberOfLines={2}>{event.description}</Text>}
        {!isPast && (
          <TouchableOpacity
            style={[styles.rsvpBtn, registered && styles.rsvpBtnDone, isPending && { opacity: 0.7 }]}
            onPress={() => (registered ? cancelRsvp(event) : rsvp(event))}
            disabled={isPending}
            activeOpacity={0.8}
          >
            {isPending ? (
              <ActivityIndicator size="small" color={tc("#1B2E6B")} />
            ) : (
              <Text style={[styles.rsvpText, registered && styles.rsvpTextDone]}>
                {registered
                  ? <><Ionicons name="checkmark-circle" size={14} color="#16A34A" /> {i18n.t('events.going')}</>
                  : i18n.t('events.yes')}
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} accessibilityLabel={i18n.t('common.back')}>
          <Ionicons name="arrow-back" size={22} color={tc('#1B2E6B')} />
        </TouchableOpacity>
        <Text style={styles.title}>{i18n.t("nav.events")}</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={tc("#1B2E6B")} style={{ marginTop: 40 }} />
      ) : (
        <>
          {upcoming.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="calendar-clear-outline" size={40} color={tc('#9CA3AF')} />
              <Text style={styles.emptyText}>{i18n.t('events.noUpcoming')}</Text>
            </View>
          ) : upcoming.map((e) => card(e, false))}
          {past.length > 0 && <Text style={styles.section}>{i18n.t('events.pastEvents')}</Text>}
          {past.map((e) => card(e, true))}
        </>
      )}
    </ScrollView>
  );
}

const styles = themedStyles({
  container:      { flex: 1, backgroundColor: '#EEF1F8' },
  header:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 16, gap: 12 },
  backBtn:        { padding: 4 },
  title:          { fontSize: 24, fontWeight: 'bold', color: '#1B2E6B' },
  empty:          { alignItems: 'center', marginTop: 40, marginBottom: 20, gap: 10 },
  emptyText:      { color: '#6B7280', fontSize: 16 },
  section:        { fontSize: 13, fontWeight: '700', color: '#6B7280', marginHorizontal: 20, marginTop: 12, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.8 },
  card:           { marginHorizontal: 16, marginBottom: 12, backgroundColor: '#fff', borderRadius: 12, padding: 16 },
  cardPast:       { opacity: 0.6 },
  cardTitle:      { fontSize: 18, fontWeight: 'bold', color: '#1B2E6B', marginBottom: 8 },
  cardMeta:       { fontSize: 14, color: '#6B7280', marginBottom: 4 },
  cardDesc:       { fontSize: 14, color: '#9CA3AF', marginBottom: 8, lineHeight: 20 },
  rsvpBtn:        { backgroundColor: '#F5C518', borderRadius: 8, padding: 12, alignItems: 'center', marginTop: 6 },
  rsvpBtnDone:    { backgroundColor: '#DCFCE7' },
  rsvpText:       { color: '#1B2E6B', fontSize: 14, fontWeight: '600' },
  rsvpTextDone:   { color: '#16A34A' },
});
