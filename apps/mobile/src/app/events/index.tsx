import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { auth, db } from '../../lib/firebase';
import { collection, getDocs, query, Timestamp, updateDoc, doc, arrayUnion } from 'firebase/firestore';

export default function EventsScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const [events,  setEvents]  = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [rsvping, setRsvping] = useState<string | null>(null);

  const currentUser = auth.currentUser;

  function fmtDate(val: any): string {
    if (!val) return '';
    if (val instanceof Timestamp) return val.toDate().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    if (typeof val === 'string') return val;
    if (val?.toDate) return val.toDate().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    return String(val);
  }

  function isRegistered(event: any): boolean {
    if (!currentUser) return false;
    return (event.rsvps ?? []).some((r: any) => r.userId === currentUser.uid);
  }

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(query(collection(db, 'events')));
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        data.sort((a: any, b: any) => {
          const aT = a.date instanceof Timestamp ? a.date.seconds : (a.date?.seconds ?? 0);
          const bT = b.date instanceof Timestamp ? b.date.seconds : (b.date?.seconds ?? 0);
          return bT - aT;
        });
        setEvents(data);
      } catch (e) {
        console.error('[Events] fetch error:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleRsvp(event: any) {
    if (!currentUser) {
      Alert.alert('Sign In Required', 'Please sign in to register for events.');
      return;
    }
    if (isRegistered(event)) return;
    setRsvping(event.id);
    try {
      const rsvpEntry = {
        userId:       currentUser.uid,
        userName:     currentUser.displayName || currentUser.email || 'Member',
        registeredAt: new Date().toISOString(),
      };
      await updateDoc(doc(db, 'events', event.id), {
        rsvps: arrayUnion(rsvpEntry),
      });
      setEvents(prev => prev.map(e =>
        e.id === event.id ? { ...e, rsvps: [...(e.rsvps ?? []), rsvpEntry] } : e
      ));
    } catch (e) {
      console.error('[Events] RSVP error:', e);
      Alert.alert('Error', 'Failed to register. Please try again.');
    } finally {
      setRsvping(null);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Events</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#1B2E6B" style={{ marginTop: 40 }} />
      ) : events.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No upcoming events</Text>
        </View>
      ) : (
        events.map(event => {
          const registered = isRegistered(event);
          const isPending  = rsvping === event.id;
          return (
            <View key={event.id} style={styles.card}>
              <Text style={styles.cardTitle}>{event.title}</Text>
              {event.date        && <Text style={styles.cardMeta}>📅  {fmtDate(event.date)}</Text>}
              {event.location    && <Text style={styles.cardMeta}>📍  {event.location}</Text>}
              {event.description && <Text style={styles.cardDesc} numberOfLines={2}>{event.description}</Text>}
              {(event.rsvps?.length ?? 0) > 0 && (
                <Text style={styles.rsvpCount}>
                  {event.rsvps.length} registered
                </Text>
              )}
              <TouchableOpacity
                style={[styles.rsvpBtn, registered && styles.rsvpBtnDone, isPending && { opacity: 0.7 }]}
                onPress={() => handleRsvp(event)}
                disabled={registered || isPending}
                activeOpacity={0.8}
              >
                {isPending ? (
                  <ActivityIndicator size="small" color="#1B2E6B" />
                ) : (
                  <Text style={[styles.rsvpText, registered && styles.rsvpTextDone]}>
                    {registered ? '✓ Registered' : 'Register / RSVP'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#EEF1F8' },
  header:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 16 },
  backBtn:        { marginRight: 16 },
  backText:       { color: '#1B2E6B', fontSize: 16 },
  title:          { fontSize: 24, fontWeight: 'bold', color: '#1B2E6B' },
  empty:          { alignItems: 'center', marginTop: 60 },
  emptyText:      { color: '#6B7280', fontSize: 16 },
  card:           { marginHorizontal: 16, marginBottom: 12, backgroundColor: '#fff', borderRadius: 12, padding: 16 },
  cardTitle:      { fontSize: 18, fontWeight: 'bold', color: '#1B2E6B', marginBottom: 8 },
  cardMeta:       { fontSize: 14, color: '#6B7280', marginBottom: 4 },
  cardDesc:       { fontSize: 14, color: '#9CA3AF', marginBottom: 8, lineHeight: 20 },
  rsvpCount:      { fontSize: 12, color: '#9CA3AF', marginBottom: 8 },
  rsvpBtn:        { backgroundColor: '#F5C518', borderRadius: 8, padding: 12, alignItems: 'center' },
  rsvpBtnDone:    { backgroundColor: '#DCFCE7' },
  rsvpText:       { color: '#1B2E6B', fontSize: 14, fontWeight: '600' },
  rsvpTextDone:   { color: '#16A34A' },
});
