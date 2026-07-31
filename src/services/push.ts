import webpush from "web-push";
import { connectToDatabase } from "@/lib/db";
import { PushSubscription } from "@/models/PushSubscription";

type PushPayload = {
  title: string;
  message: string;
  href?: string;
  type?: string;
};

export function getVapidConfig() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:admin@hisabkitab.local";
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject };
}

export async function sendPushToUser(organizationId: string, userId: string | unknown, payload: PushPayload) {
  const config = getVapidConfig();
  if (!config) return;
  try {
    await connectToDatabase();
    webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
    const subscriptions = await PushSubscription.find({ organizationId, userId }).lean() as any[];
    if (!subscriptions.length) return;
    const body = JSON.stringify({
      title: payload.title,
      message: payload.message,
      href: payload.href ?? "/dashboard",
      type: payload.type ?? "info"
    });
    await Promise.all(subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification({
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth }
        }, body);
      } catch (error: any) {
        if (error?.statusCode === 404 || error?.statusCode === 410) {
          await PushSubscription.deleteOne({ _id: subscription._id }).catch(() => undefined);
        }
      }
    }));
  } catch {}
}

export async function sendPushToUsers(recipients: Array<{ organizationId?: string; _id?: unknown }>, payload: PushPayload) {
  await Promise.all(
    recipients
      .filter((recipient) => recipient.organizationId && recipient._id)
      .map((recipient) => sendPushToUser(String(recipient.organizationId), recipient._id, payload))
  );
}
