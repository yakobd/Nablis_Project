import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getAdmin } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const MAX_AGE_MS    = 10 * 60 * 1000;

// Delivered even when the user has snoozed notifications.
const CRITICAL = new Set(['message', 'appointment_confirmed', 'appointment_rejected', 'new_member', 'member_approved']);

// Maps a notification type to the per-feature switch in users.notifications.features.
function featureKey(type: string): string | null {
  if (type.includes('blog'))        return 'blogs';
  if (type.includes('event'))       return 'events';
  if (type.includes('appointment')) return 'appointments';
  if (type.includes('bible'))       return 'bible';
  if (type.includes('prayer'))      return 'prayer';
  return null;
}

interface PushMessage {
  to: string;
  title: string;
  body: string;
  sound: 'default';
  channelId: string;
  data: { type: string; link: string | null };
}

/**
 * POST { ids: string[] } — sends push notifications for notification docs the
 * caller just created (see notify() in @nablis/shared). Each doc is pushed at
 * most once and only by its creator, so this endpoint cannot be used to spam.
 */
export async function POST(req: NextRequest) {
  const admin = getAdmin();
  if (!admin) return NextResponse.json({ error: 'Push not configured' }, { status: 503 });

  const idToken = req.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
  if (!idToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let uid: string;
  try {
    uid = (await admin.auth.verifyIdToken(idToken)).uid;
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { ids } = (await req.json().catch(() => ({}))) as { ids?: unknown };
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 500 || !ids.every((i) => typeof i === 'string')) {
    return NextResponse.json({ error: 'Invalid ids' }, { status: 400 });
  }

  const { db } = admin;
  const snaps = await db.getAll(...ids.map((id) => db.collection('notifications').doc(id)));
  const now = Date.now();
  const fresh = snaps.filter((s) => {
    const d = s.data();
    if (!d || d.createdBy !== uid || d.pushedAt) return false;
    const created = d.createdAt instanceof Timestamp ? d.createdAt.toMillis() : 0;
    return now - created < MAX_AGE_MS;
  });
  if (fresh.length === 0) return NextResponse.json({ sent: 0 });

  const userIds = Array.from(new Set(fresh.map((s) => s.data()!.userId as string)));
  const users = await db.getAll(...userIds.map((id) => db.collection('users').doc(id)));
  const userById = new Map(users.map((u) => [u.id, u.data()]));

  const messages: PushMessage[] = [];
  for (const snap of fresh) {
    const n = snap.data()!;
    const user = userById.get(n.userId);
    const to = user?.expoPushToken as string | undefined;
    if (!to) continue;

    const prefs = user?.notifications ?? {};
    if (prefs.snoozed && !CRITICAL.has(n.type)) continue;
    const key = featureKey(n.type);
    if (key && prefs.features?.[key] === false) continue;

    messages.push({
      to,
      title: n.title,
      body: n.description,
      sound: 'default',
      channelId: 'default',
      data: { type: n.type, link: n.link ?? null },
    });
  }

  // Expo accepts up to 100 messages per request.
  for (let i = 0; i < messages.length; i += 100) {
    await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages.slice(i, i + 100)),
    }).catch(() => {});
  }

  const batch = db.batch();
  fresh.forEach((s) => batch.update(s.ref, { pushedAt: FieldValue.serverTimestamp() }));
  await batch.commit();

  return NextResponse.json({ sent: messages.length });
}
