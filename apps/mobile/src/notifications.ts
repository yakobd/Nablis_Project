import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { doc, updateDoc } from "firebase/firestore";
import { db } from './lib/firebase';

// Configure how notifications appear when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert:  true,
    shouldPlaySound:  true,
    shouldSetBadge:   true,
    shouldShowBanner: true,
    shouldShowList:   true,
  }),
});

export async function registerForPushNotifications(userId: string): Promise<string | null> {
  // expo-notifications requires a physical device for push tokens (not simulator)
  if (!Constants.isDevice) {
    console.warn("Push notifications require a physical device.");
    return null;
  }

  // Check / request permission
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.warn("Push notification permission not granted.");
    return null;
  }

  // Android channel setup
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name:       "Nablis",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#F5C518",
    });
    await Notifications.setNotificationChannelAsync("prayers", {
      name:       "Prayer Reminders",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 150],
      lightColor: "#1B2E6B",
    });
  }

  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    const token = tokenData.data;

    // Persist token to Firestore user document
    await updateDoc(doc(db, "users", userId), {
      expoPushToken:     token,
      pushTokenUpdatedAt: new Date().toISOString(),
    });

    return token;
  } catch (err) {
    console.error("Failed to get push token:", err);
    return null;
  }
}

export function setupNotificationListeners(
  onNotification: (notification: Notifications.Notification) => void,
  onResponse: (response: Notifications.NotificationResponse) => void
) {
  const notifSub = Notifications.addNotificationReceivedListener(onNotification);
  const respSub  = Notifications.addNotificationResponseReceivedListener(onResponse);

  return () => {
    notifSub.remove();
    respSub.remove();
  };
}

// Map notification data to a route string for navigation
export function notificationToRoute(data: Record<string, unknown>): string | null {
  const type = data?.type as string | undefined;
  switch (type) {
    case "appointment": return "/(tabs)/appointments";
    case "message":     return "/(tabs)/messages";
    case "prayer":      return "/(tabs)/home";
    case "event":       return "/events";
    case "blog":        return "/blogs";
    default:            return null;
  }
}

// Schedule a local prayer reminder (called after login)
export async function schedulePrayerReminders() {
  // Cancel existing to avoid duplicates
  await Notifications.cancelAllScheduledNotificationsAsync();

  const reminders = [
    { hour: 6,  minute: 0,  title: "Morning Prayer 🌅", body: "Begin your day with the Lord. Take a moment for Morning Prayer." },
    { hour: 12, minute: 0,  title: "Afternoon Prayer ☀️", body: "Pause and connect with God. Your afternoon prayer awaits." },
    { hour: 20, minute: 0,  title: "Evening Prayer 🌙",   body: "End your day in gratitude. Evening Prayer time is here." },
  ];

  for (const r of reminders) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: r.title,
        body:  r.body,
        data:  { type: "prayer" },
        sound: true,
      },
      trigger: {
        type:    Notifications.SchedulableTriggerInputTypes.CALENDAR,
        hour:    r.hour,
        minute:  r.minute,
        repeats: true,
      },
    });
  }
}
