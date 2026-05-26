import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { auth } from '@nablis/shared/firebase';
import { useRouter, useSegments } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { SafeAreaProvider } from 'react-native-safe-area-context';

function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      const inAuth = segments[0] === '(auth)';
      if (!user && !inAuth) {
        router.replace('/(auth)/login');
      } else if (user && inAuth) {
        router.replace('/(tabs)/home');
      }
      setChecked(true);
    });
    return unsub;
  }, [segments]);

  if (!checked) return null;
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
