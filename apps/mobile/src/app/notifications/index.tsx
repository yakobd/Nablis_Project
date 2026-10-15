import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../../lib/firebase';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { themedStyles, themedColors, tc } from "../../theme";
import { notificationToRoute } from '../../notifications';
import i18n from "@nablis/i18n";

const L = { navy: '#1B2E6B', light: '#E0E7FF', green: '#16A34A', greenBg: '#DCFCE7', red: '#DC2626', redBg: '#FEE2E2', amber: '#B45309', amberBg: '#FEF3C7' };
const C = themedColors(L);

type IconName = keyof typeof Ionicons.glyphMap;

// Icon and colours for each notification type (see notify() in @nablis/shared).
function iconFor(type: string = ''): { name: IconName; fg: string; bg: string } {
  if (type === 'appointment_rejected')                       return { name: 'close-circle-outline', fg: C.red, bg: C.redBg };
  if (type === 'appointment_confirmed' || type === 'member_approved') return { name: 'checkmark-circle-outline', fg: C.green, bg: C.greenBg };
  if (type.startsWith('appointment'))                        return { name: 'calendar-outline', fg: C.navy, bg: C.light };
  if (type === 'announcement')                               return { name: 'megaphone-outline', fg: C.amber, bg: C.amberBg };
  if (type === 'message')                                    return { name: 'chatbubble-outline', fg: C.navy, bg: C.light };
  if (type.includes('event'))                                return { name: 'calendar-number-outline', fg: C.navy, bg: C.light };
  if (type.includes('blog'))                                 return { name: 'newspaper-outline', fg: C.navy, bg: C.light };
  if (type.includes('bible'))                                return { name: 'book-outline', fg: C.navy, bg: C.light };
  if (type.includes('prayer'))                               return { name: 'heart-outline', fg: C.navy, bg: C.light };
  if (type === 'challenge')                                  return { name: 'trophy-outline', fg: C.amber, bg: C.amberBg };
  if (type.includes('testimony'))                            return { name: 'star-outline', fg: C.amber, bg: C.amberBg };
  if (type === 'new_member')                                 return { name: 'person-add-outline', fg: C.navy, bg: C.light };
  return { name: 'notifications-outline', fg: C.navy, bg: C.light };
}

export default function NotificationsScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timeoutId = setTimeout(() => setLoading(false), 5000);
    fetchNotifications().finally(() => clearTimeout(timeoutId));
  }, []);

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

  async function markAllRead() {
    const unread = notifications.filter(n => !n.read);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    await Promise.all(unread.map(n => updateDoc(doc(db, 'notifications', n.id), { read: true }).catch(() => {})));
  }

  // Opening a notification marks it read and goes to the screen it is about.
  function open(notif: any) {
    if (!notif.read) markRead(notif.id);
    const route = notificationToRoute({ type: notif.type, link: notif.link });
    if (route && route !== '/notifications') router.push(route as any);
  }

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} accessibilityLabel={i18n.t("common.back")}>
          <Ionicons name="arrow-back" size={22} color={C.navy} />
        </TouchableOpacity>
        <Text style={styles.title}>{i18n.t("nav.notifications")}</Text>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={markAllRead} style={styles.markAll}>
            <Ionicons name="checkmark-done" size={16} color={C.navy} />
            <Text style={styles.markAllText}>{i18n.t("notif.markAll")}</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={tc("#1B2E6B")} style={{ marginTop: 40 }} />
      ) : notifications.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="notifications-off-outline" size={40} color={tc("#9CA3AF")} />
          <Text style={styles.emptyText}>{i18n.t("notif.none")}</Text>
        </View>
      ) : (
        notifications.map(notif => {
          const icon = iconFor(notif.type);
          return (
            <TouchableOpacity
              key={notif.id}
              style={[styles.card, !notif.read && styles.unread]}
              onPress={() => open(notif)}
              activeOpacity={0.8}
            >
              <View style={[styles.iconWrap, { backgroundColor: icon.bg }]}>
                <Ionicons name={icon.name} size={20} color={icon.fg} />
              </View>
              <View style={styles.content}>
                <Text style={styles.notifTitle}>{notif.title || notif.type}</Text>
                <Text style={styles.notifBody}>{notif.description || notif.body || notif.message || ''}</Text>
                <Text style={styles.notifTime}>
                  {notif.createdAt?.toDate?.()?.toLocaleDateString(i18n.language === 'am' ? 'am-ET' : 'en-US') || ''}
                </Text>
              </View>
              {!notif.read && <View style={styles.dot} />}
            </TouchableOpacity>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = themedStyles({
  container:   { flex: 1, backgroundColor: '#EEF1F8' },
  header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 16, gap: 12 },
  backBtn:     { padding: 4 },
  title:       { flex: 1, fontSize: 24, fontWeight: 'bold', color: '#1B2E6B' },
  markAll:     { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: '#FFFFFF' },
  markAllText: { fontSize: 12, fontWeight: '600', color: '#1B2E6B' },
  empty:       { alignItems: 'center', marginTop: 60, gap: 10 },
  emptyText:   { color: '#6B7280', fontSize: 16 },
  card:        { flexDirection: 'row', marginHorizontal: 16, marginBottom: 10, backgroundColor: '#fff', borderRadius: 12, padding: 16, alignItems: 'flex-start' },
  unread:      { borderLeftWidth: 3, borderLeftColor: '#1B2E6B' },
  iconWrap:    { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  content:     { flex: 1 },
  notifTitle:  { fontSize: 15, fontWeight: '600', color: '#1B2E6B', marginBottom: 4 },
  notifBody:   { fontSize: 13, color: '#6B7280', marginBottom: 4 },
  notifTime:   { fontSize: 11, color: '#9CA3AF' },
  dot:         { width: 8, height: 8, borderRadius: 4, backgroundColor: '#1B2E6B', marginTop: 4 },
});
