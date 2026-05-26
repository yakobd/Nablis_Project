import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuth } from '@nablis/shared/firebase';

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { firebaseUser, user, loading } = useAuth();
  const router   = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (loading) return;

    const inAuth    = segments[0] === '(auth)';
    const inPending = inAuth && segments[1] === 'pending';
    const inTabs    = segments[0] === '(tabs)';

    // Not logged in → login screen (but stay if already in auth, except pending)
    if (!firebaseUser) {
      if (!inAuth || inPending) router.replace('/(auth)/login');
      return;
    }

    // Logged in but Firestore profile not yet loaded — wait
    if (!user) return;

    if (user.status === 'pending') {
      if (!inPending) router.replace('/(auth)/pending');
      return;
    }

    if (user.status === 'rejected') {
      // Rejected users land back on login where a message can be shown
      if (!inAuth) router.replace('/(auth)/login');
      return;
    }

    // Active user sitting in any auth screen → send to app
    if (inAuth) router.replace('/(tabs)/home');
  }, [loading, firebaseUser?.uid, user?.status, segments]);

  // Render nothing while resolving — no flash, no spinner
  if (loading) return null;
  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthGuard>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="testimony/index" />
          <Stack.Screen name="attendance/index" />
          <Stack.Screen name="bible-study/index" />
          <Stack.Screen name="gallery/index" />
        </Stack>
      </AuthGuard>
    </SafeAreaProvider>
  );
}
