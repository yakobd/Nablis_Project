import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#EEF1F8' }}>
        <ActivityIndicator size="large" color="#1B2E6B" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="testimony/index" />
      <Stack.Screen name="attendance/index" />
      <Stack.Screen name="bible-study/index" />
      <Stack.Screen name="gallery/index" />
    </Stack>
  );
}
