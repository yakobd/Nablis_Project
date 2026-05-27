import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { db } from '../../lib/firebase';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';

export default function EventsScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const [events,  setEvents]  = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(query(collection(db, 'events'), orderBy('date', 'desc')));
        setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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
        events.map(event => (
          <View key={event.id} style={styles.card}>
            <Text style={styles.cardTitle}>{event.title}</Text>
            {event.date        && <Text style={styles.cardMeta}>📅  {event.date}</Text>}
            {event.location    && <Text style={styles.cardMeta}>📍  {event.location}</Text>}
            {event.description && <Text style={styles.cardDesc} numberOfLines={2}>{event.description}</Text>}
            <TouchableOpacity style={styles.rsvpBtn}>
              <Text style={styles.rsvpText}>Register / RSVP</Text>
            </TouchableOpacity>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#EEF1F8' },
  header:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 16 },
  backBtn:    { marginRight: 16 },
  backText:   { color: '#1B2E6B', fontSize: 16 },
  title:      { fontSize: 24, fontWeight: 'bold', color: '#1B2E6B' },
  empty:      { alignItems: 'center', marginTop: 60 },
  emptyText:  { color: '#6B7280', fontSize: 16 },
  card:       { marginHorizontal: 16, marginBottom: 12, backgroundColor: '#fff', borderRadius: 12, padding: 16 },
  cardTitle:  { fontSize: 18, fontWeight: 'bold', color: '#1B2E6B', marginBottom: 8 },
  cardMeta:   { fontSize: 14, color: '#6B7280', marginBottom: 4 },
  cardDesc:   { fontSize: 14, color: '#9CA3AF', marginBottom: 12, lineHeight: 20 },
  rsvpBtn:    { backgroundColor: '#F5C518', borderRadius: 8, padding: 12, alignItems: 'center' },
  rsvpText:   { color: '#1B2E6B', fontSize: 14, fontWeight: '600' },
});
