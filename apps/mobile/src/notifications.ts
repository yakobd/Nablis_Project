import type * as NotificationsModule from "expo-notifications";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { Platform } from "react-native";
import { collection, doc, getDocs, updateDoc } from "firebase/firestore";
import {
  activePrayers, prayerName, eventRange, DEFAULT_PRAYERS, EVENT_REMINDERS,
  type DailyPrayer, type EventDoc, type User,
} from "@nablis/shared/firebase";
import { db } from './lib/firebase';

// Expo Go (SDK 53+) no longer supports Android notifications, and in SDK 57
// merely importing expo-notifications there throws. Load it only in the real
// app (development or release build); in Expo Go every function below no-ops.
const IN_EXPO_GO = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Notifications: typeof NotificationsModule | null = IN_EXPO_GO ? null : require("expo-notifications");

// Configure how notifications appear when the app is in the foreground
Notifications?.setNotificationHandler({
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
  if (!Notifications || !Constants.isDevice) return null;

  // Check / request permission
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") return null;

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

    // Persist token so /api/push can reach this device
    await updateDoc(doc(db, "users", userId), {
      expoPushToken:     token,
      pushTokenUpdatedAt: new Date().toISOString(),
    });

    return token;
  } catch (err) {
    console.warn("Failed to get push token:", err);
    return null;
  }
}

export function setupNotificationListeners(
  onNotification: (notification: NotificationsModule.Notification) => void,
  onResponse: (response: NotificationsModule.NotificationResponse) => void
) {
  if (!Notifications) return () => {};
  const notifSub = Notifications.addNotificationReceivedListener(onNotification);
  const respSub  = Notifications.addNotificationResponseReceivedListener(onResponse);

  return () => {
    notifSub.remove();
    respSub.remove();
  };
}

// Map a notification's `type` (see notify() in @nablis/shared) to an app route.
export function notificationToRoute(data: Record<string, unknown>): string | null {
  const type = (data?.type as string | undefined) ?? "";
  if (type.startsWith("appointment")) return "/(tabs)/appointments";
  if (type === "message")             return "/(tabs)/messages";
  if (type.includes("prayer"))        return "/daily-prayers";
  if (type.includes("event"))         return "/events";
  if (type.includes("blog"))          return "/blogs";
  if (type.includes("bible"))         return "/bible-study";
  if (type === "new_member" || type === "member_approved") return "/(tabs)/home";
  if (type === "announcement")        return "/announcements";
  if (type === "challenge") {
    const link = data?.link as string | undefined;
    return link?.startsWith("/challenges/") ? link : "/challenges";
  }
  if (type.includes("testimony"))     return "/testimony";
  return "/notifications";
}

/**
 * Schedules daily local prayer reminders from the ministry's Daily Prayers
 * settings (enabled reminders only; defaults if none are configured), skipping
 * any the user switched off.
 */
export async function schedulePrayerReminders(user: User) {
  if (!Notifications) return;
  // Clear only our prayer reminders; event reminders stay scheduled.
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(scheduled
    .filter((n) => n.identifier.startsWith("prayer-") || n.content.data?.type === "prayer")
    .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));

  const prefs = (user as unknown as { notifications?: Record<string, any> }).notifications ?? {};
  if (prefs.features?.prayer === false) return;

  let prayers: DailyPrayer[] = [];
  try {
    const snap = await getDocs(collection(db, "dailyPrayers"));
    prayers = activePrayers(snap.docs.map((d) => ({ id: d.id, ...d.data() } as DailyPrayer)));
  } catch {
    // Use defaults
  }
  if (prayers.length === 0) {
    prayers = DEFAULT_PRAYERS.map((p) => ({ ...p, id: p.type! } as DailyPrayer));
  }

  for (const p of prayers) {
    if (p.type && prefs.prayer?.[p.type] === false) continue;
    if (!/^\d{1,2}:\d{2}$/.test(p.time)) continue;
    const [hour, minute] = p.time.split(":").map(Number);
    await Notifications.scheduleNotificationAsync({
      identifier: `prayer-${p.id}`,
      content: {
        title: prayerName(p),
        body: p.message || "It's time to pray.",
        data: { type: "prayer" },
        sound: true,
      },
      trigger: {
        type:      Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
        channelId: "prayers",
      },
    });
  }
}

/** Local reminder before an event the member RSVP'd to (uses the event's reminder setting). */
export async function scheduleEventReminder(event: EventDoc) {
  if (!Notifications) return;
  const range = eventRange(event);
  const minutes = EVENT_REMINDERS.find((r) => r.value === (event.reminder ?? "1d"))?.minutes ?? 0;
  if (!range || !minutes) return;
  const at = new Date(range.start.getTime() - minutes * 60_000);
  if (at <= new Date()) return;
  await Notifications.scheduleNotificationAsync({
    identifier: `event-${event.id}`,
    content: {
      title: `Upcoming: ${event.title}`,
      body: `${range.start.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}${event.location ? ` · ${event.location}` : ""}`,
      data: { type: "event" },
      sound: true,
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
  });
}
