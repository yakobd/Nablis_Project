import { useEffect, useState } from 'react';
import { Alert, Platform, View, useColorScheme } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import i18n, { changeLanguage } from '@nablis/i18n';
import { setThemeMode, DARK, type ThemeMode } from '../theme';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useAuth, setPushEndpoint, usePresenceHeartbeat, setServiceLocalizer, setSharedTranslator } from '@nablis/shared/firebase';
import { API_URL } from '../lib/upload';
import {
  notificationToRoute,
  registerForPushNotifications,
  schedulePrayerReminders,
  setupNotificationListeners,
} from '../notifications';

if (API_URL) setPushEndpoint(`${API_URL}/api/push`);

// Strings from @nablis/shared (presence labels…) use the app translations.
setSharedTranslator((key, vars) => (i18n.exists(key) ? i18n.t(key, vars) : undefined));

// Service names (Confession, Counseling…) follow the interface language.
setServiceLocalizer((value, field) => (i18n.language === 'am' ? i18n.t(`services.${value}.${field}`, { defaultValue: '' }) || undefined : undefined));

// Registers this device for push, schedules prayer reminders, and opens the
// relevant screen when a notification is tapped.
function usePushNotifications() {
  const { user } = useAuth();
  const router   = useRouter();
  const activeId = user?.status === 'active' ? user.id : null;
  usePresenceHeartbeat(activeId);

  useEffect(() => {
    if (!activeId || Platform.OS === 'web') return;
    registerForPushNotifications(activeId).catch(() => {});
    return setupNotificationListeners(
      () => {},
      (response) => {
        const route = notificationToRoute(response.notification.request.content.data ?? {});
        if (route) router.push(route as any);
      }
    );
  }, [activeId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-schedule when the user's prayer preferences change.
  const prayerPrefs = JSON.stringify((user as any)?.notifications?.prayer ?? null)
    + String((user as any)?.notifications?.features?.prayer);
  useEffect(() => {
    if (!user || !activeId || Platform.OS === 'web') return;
    schedulePrayerReminders(user).catch(() => {});
  }, [activeId, prayerPrefs]); // eslint-disable-line react-hooks/exhaustive-deps
}

// Sends each user to the right place based on their auth state and approval
// status. Login, register and pending screens rely on this to navigate.
function useAuthGate() {
  const { firebaseUser, user, loading, signOut } = useAuth();
  const segments = useSegments();
  const router   = useRouter();

  useEffect(() => {
    if (loading) return;

    const group  = segments[0];
    const screen = segments[1];
    const inAuth = group === '(auth)';

    if (!firebaseUser) {
      if (!inAuth || screen === 'pending') router.replace('/(auth)/login' as any);
      return;
    }

    // Signed in but the profile doc is still being written (registration).
    if (!user) return;

    if (user.status === 'rejected' || user.status === 'suspended') {
      signOut().then(() => {
        Alert.alert(
          user.status === 'rejected' ? 'Account Not Approved' : 'Account Suspended',
          'Please contact the Spiritual Father for more information.'
        );
      });
      return;
    }

    if (user.status === 'pending') {
      if (screen !== 'pending') router.replace('/(auth)/pending' as any);
      return;
    }

    if (inAuth || !group) router.replace('/(tabs)/home' as any);
  }, [loading, firebaseUser, user?.status, segments]); // eslint-disable-line react-hooks/exhaustive-deps
}

// Appearance and language from Profile › Display & Language (same fields
// as the web portal's Preferences).
function useDisplayPrefs(): { mode: ThemeMode; lang: string } {
  const { user } = useAuth();
  const system = useColorScheme();
  const prefs = (user as { preferences?: { appearance?: string; language?: string } } | null)?.preferences ?? {};
  const mode: ThemeMode = prefs.appearance === 'dark' || (prefs.appearance === 'system' && system === 'dark') ? 'dark' : 'light';
  // Set before children render so their styles pick the right variant.
  setThemeMode(mode);
  const language = prefs.language === 'am' ? 'am' : 'en';
  // Applied language; screens remount once the switch has happened.
  const [lang, setLang] = useState(i18n.language);
  useEffect(() => { changeLanguage(language).then(() => setLang(language)); }, [language]);
  return { mode, lang };
}

export default function RootLayout() {
  useAuthGate();
  usePushNotifications();
  const { mode, lang } = useDisplayPrefs();

  return (
    // Remount on a mode change so every screen re-reads its styles.
    <View key={`${mode}-${lang}`} style={{ flex: 1, backgroundColor: mode === 'dark' ? DARK.page : '#F9FAFB' }}>
    <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right', contentStyle: { backgroundColor: mode === 'dark' ? DARK.page : '#F9FAFB' } }}>
      <Stack.Screen name="index" options={{ animation: 'fade' }} />
      <Stack.Screen name="(auth)/login" options={{ animation: 'fade' }} />
      <Stack.Screen name="(auth)/register" options={{ animation: 'fade' }} />
      <Stack.Screen name="(auth)/pending" options={{ animation: 'fade' }} />
      <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
      <Stack.Screen name="daily-prayers/index" />
      <Stack.Screen name="blogs/index" />
      <Stack.Screen name="events/index" />
      <Stack.Screen name="notifications/index" />
      <Stack.Screen name="attendance/index" />
      <Stack.Screen name="bible-study/index" />
      <Stack.Screen name="gallery/index" />
      <Stack.Screen name="testimony/index" />
      <Stack.Screen name="announcements/index" />
      <Stack.Screen name="reading-plan/index" />
      <Stack.Screen name="challenges/index" />
      <Stack.Screen name="challenges/[id]" />
      <Stack.Screen name="announcements/pass" options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
      <Stack.Screen name="announcements/checkin" options={{ animation: 'slide_from_bottom' }} />
    </Stack>
    </View>
  );
}
