import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { auth, db } from '../../lib/firebase';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';

function getIcon(type: string) {
  switch (type) {
    case 'appointment_confirmed': return '✅';
    case 'appointment_rejected':  return '❌';
    case 'new_event':             return '🎉';
    case 'new_blog':              return '📖';
    case 'prayer_reminder':       return '🙏';
    case 'member_approved':       return '✅';
    case 'new_member':            return '👤';
    default:                      return '🔔';
  }
}

export default function NotificationsScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchNotifications(); }, []);

  async function fetchNotifications() {
    const user = auth.currentUser;
    if (!user) { setLoading(false); return; }
    try {
      const q    = query(collection(db, 'notifications'), where('userId', '==', user.uid));
      const snap = await getDocs(q);
      const data = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setNotifications(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function markRead(id: string) {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Notifications</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#1B2E6B" style={{ marginTop: 40 }} />
      ) : notifications.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No notifications yet</Text>
        </View>
      ) : (
        notifications.map(notif => (
          <TouchableOpacity
            key={notif.id}
            style={[styles.card, !notif.read && styles.unread]}
            onPress={() => !notif.read && markRead(notif.id)}
            activeOpacity={0.8}
          >
            <Text style={styles.icon}>{getIcon(notif.type)}</Text>
            <View style={styles.content}>
              <Text style={styles.notifTitle}>{notif.title || notif.type}</Text>
              <Text style={styles.notifBody}>{notif.description || notif.body || notif.message || ''}</Text>
              <Text style={styles.notifTime}>
                {notif.createdAt?.toDate?.()?.toLocaleDateString() || ''}
              </Text>
            </View>
            {!notif.read && <View style={styles.dot} />}
          </TouchableOpacity>
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
  card:       { flexDirection: 'row', marginHorizontal: 16, marginBottom: 10, backgroundColor: '#fff', borderRadius: 12, padding: 16, alignItems: 'flex-start' },
  unread:     { borderLeftWidth: 3, borderLeftColor: '#1B2E6B' },
  icon:       { fontSize: 24, marginRight: 12 },
  content:    { flex: 1 },
  notifTitle: { fontSize: 15, fontWeight: '600', color: '#1B2E6B', marginBottom: 4 },
  notifBody:  { fontSize: 13, color: '#6B7280', marginBottom: 4 },
  notifTime:  { fontSize: 11, color: '#9CA3AF' },
  dot:        { width: 8, height: 8, borderRadius: 4, backgroundColor: '#1B2E6B', marginTop: 4 },
});
