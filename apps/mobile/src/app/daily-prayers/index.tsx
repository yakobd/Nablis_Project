import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { auth, db } from '../../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

const PRAYERS = [
  { id: '1', type: 'morning',   time: '6:00 AM',  message: 'Lord, guide my steps this day. Let your light shine through me in all my actions, words, and thoughts as I walk in your name.' },
  { id: '2', type: 'afternoon', time: '12:00 PM', message: 'Heavenly Father, thank you for your grace thus far today. Renew my strength and focus as I continue this day in your service.' },
  { id: '3', type: 'evening',   time: '9:00 PM',  message: 'As the day ends, I release my worries to You. Grant me peaceful rest and gratitude for all You have done.' },
];

export default function DailyPrayersScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const [statuses, setStatuses] = useState<Record<string, string>>({
    '1': 'UP NEXT', '2': 'SCHEDULED', '3': 'SCHEDULED',
  });
  const [marking, setMarking] = useState<string | null>(null);

  async function markAsPrayed(prayerId: string, prayerType: string) {
    const user = auth.currentUser;
    if (!user) return;
    setMarking(prayerId);
    try {
      await addDoc(collection(db, 'prayerLogs'), {
        userId:     user.uid,
        prayerType,
        prayedAt:   serverTimestamp(),
      });
      setStatuses(prev => ({ ...prev, [prayerId]: 'COMPLETED' }));
      Alert.alert('🙏', 'Prayer marked as completed!');
    } catch (e) {
      console.error(e);
    } finally {
      setMarking(null);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Daily Prayers</Text>
      </View>

      <View style={styles.banner}>
        <Text style={styles.bannerLabel}>MORNING REFLECTION</Text>
        <Text style={styles.bannerQuote}>"Pray without ceasing."</Text>
        <Text style={styles.bannerVerse}>— 1 Thessalonians 5:17</Text>
      </View>

      {PRAYERS.map(prayer => {
        const status = statuses[prayer.id];
        return (
          <View key={prayer.id} style={styles.prayerCard}>
            <View style={styles.prayerHeader}>
              <View>
                <Text style={styles.prayerName}>
                  {prayer.type.charAt(0).toUpperCase() + prayer.type.slice(1)} Prayer
                </Text>
                <Text style={styles.prayerTime}>{prayer.time}</Text>
              </View>
              <View style={[
                styles.badge,
                status === 'COMPLETED' ? styles.badgeGreen :
                status === 'UP NEXT'   ? styles.badgeYellow : styles.badgeGrey,
              ]}>
                <Text style={styles.badgeText}>{status}</Text>
              </View>
            </View>
            <Text style={styles.prayerMessage}>{prayer.message}</Text>
            {status !== 'COMPLETED' && (
              <TouchableOpacity
                style={[styles.prayButton, marking === prayer.id && { opacity: 0.6 }]}
                onPress={() => markAsPrayed(prayer.id, prayer.type)}
                disabled={marking === prayer.id}
              >
                <Text style={styles.prayButtonText}>+ Mark as Prayed</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#EEF1F8' },
  header:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 16 },
  backBtn:        { marginRight: 16 },
  backText:       { color: '#1B2E6B', fontSize: 16 },
  title:          { fontSize: 24, fontWeight: 'bold', color: '#1B2E6B' },
  banner:         { margin: 16, backgroundColor: '#1B2E6B', borderRadius: 12, padding: 20 },
  bannerLabel:    { color: 'rgba(255,255,255,0.7)', fontSize: 11, marginBottom: 8, letterSpacing: 0.5 },
  bannerQuote:    { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  bannerVerse:    { color: 'rgba(255,255,255,0.8)', fontSize: 13 },
  prayerCard:     { marginHorizontal: 16, marginBottom: 12, backgroundColor: '#fff', borderRadius: 12, padding: 16 },
  prayerHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  prayerName:     { fontSize: 16, fontWeight: '600', color: '#1B2E6B' },
  prayerTime:     { fontSize: 12, color: '#6B7280', marginTop: 2 },
  badge:          { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  badgeGreen:     { backgroundColor: '#D1FAE5' },
  badgeYellow:    { backgroundColor: '#FEF3C7' },
  badgeGrey:      { backgroundColor: '#F3F4F6' },
  badgeText:      { fontSize: 11, fontWeight: '600', color: '#374151' },
  prayerMessage:  { fontSize: 14, color: '#6B7280', marginBottom: 12, lineHeight: 20 },
  prayButton:     { backgroundColor: '#1B2E6B', borderRadius: 8, padding: 12, alignItems: 'center' },
  prayButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
