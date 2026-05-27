import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const C = {
  navy: '#1B2E6B', yellow: '#F5C518', light: '#EEF1F8',
  grey: '#9CA3AF', dark: '#374151', border: '#E5E7EB',
  white: '#FFFFFF', bg: '#F9FAFB',
};

export default function PendingScreen() {
  const insets = useSafeAreaInsets();

  async function handleSignOut() {
    const { signOut }  = await import('firebase/auth');
    const { auth }     = await import('../../lib/firebase');
    await signOut(auth);
    // Auth guard in _layout will redirect to login
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      {/* Icon */}
      <View style={styles.iconWrap}>
        <Ionicons name="hourglass-outline" size={52} color={C.yellow} />
      </View>

      {/* Title */}
      <Text style={styles.title}>Registration Pending</Text>
      <Text style={styles.subtitle}>
        Your membership request has been received.{'\n'}
        The Spiritual Father will review your{'\n'}registration shortly.
      </Text>

      {/* Info card */}
      <View style={styles.infoCard}>
        <Ionicons name="information-circle-outline" size={20} color={C.navy} style={{ marginTop: 1 }} />
        <Text style={styles.infoText}>
          You will receive access once your account is approved. This usually takes 1–2 business days.
        </Text>
      </View>

      {/* Steps */}
      <View style={styles.stepsCard}>
        {[
          { icon: 'checkmark-circle',     color: '#16A34A', label: 'Registration submitted' },
          { icon: 'time-outline',          color: C.yellow,  label: 'Awaiting review by Spiritual Father' },
          { icon: 'lock-closed-outline',   color: C.grey,    label: 'Account activation' },
        ].map((step, i) => (
          <View key={i} style={styles.stepRow}>
            <Ionicons name={step.icon as any} size={20} color={step.color} />
            <Text style={[styles.stepLabel, i === 2 && { color: C.grey }]}>{step.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.spacer} />

      <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.7}>
        <Ionicons name="log-out-outline" size={18} color={C.grey} />
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root:         { flex: 1, backgroundColor: C.bg, alignItems: 'center', paddingHorizontal: 32 },
  iconWrap:     { width: 96, height: 96, borderRadius: 48, backgroundColor: C.light, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  title:        { fontSize: 22, fontWeight: '800', color: C.navy, marginBottom: 12, textAlign: 'center' },
  subtitle:     { fontSize: 14, color: C.dark, lineHeight: 22, textAlign: 'center', marginBottom: 24 },
  infoCard:     { flexDirection: 'row', backgroundColor: '#EFF6FF', borderRadius: 12, padding: 14, gap: 10, marginBottom: 20, alignItems: 'flex-start', width: '100%' },
  infoText:     { flex: 1, fontSize: 13, color: C.navy, lineHeight: 20 },
  stepsCard:    { backgroundColor: C.white, borderRadius: 16, padding: 16, width: '100%', borderWidth: 1, borderColor: C.border, gap: 14 },
  stepRow:      { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepLabel:    { fontSize: 13, fontWeight: '600', color: C.dark },
  spacer:       { flex: 1 },
  signOutBtn:   { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 12 },
  signOutText:  { fontSize: 14, color: C.grey },
});
