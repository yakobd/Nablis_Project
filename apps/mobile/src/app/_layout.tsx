import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="daily-prayers/index" />
      <Stack.Screen name="blogs/index" />
      <Stack.Screen name="events/index" />
      <Stack.Screen name="notifications/index" />
      <Stack.Screen name="attendance/index" />
      <Stack.Screen name="bible-study/index" />
      <Stack.Screen name="gallery/index" />
      <Stack.Screen name="testimony/index" />
    </Stack>
  );
}
