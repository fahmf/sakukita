"use client";

/**
 * Client-side (local) notification helpers. These fire notifications from the
 * device itself via the service worker registration — no server / VAPID keys
 * required — which is enough for budget and large-transaction alerts. A future
 * server-initiated web push can reuse the same service worker handlers.
 */

export type NotificationPermissionState = "default" | "granted" | "denied" | "unsupported";

export function notificationSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator
  );
}

export function currentPermission(): NotificationPermissionState {
  if (!notificationSupported()) return "unsupported";
  return Notification.permission as NotificationPermissionState;
}

export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (!notificationSupported()) return "unsupported";
  try {
    const result = await Notification.requestPermission();
    return result as NotificationPermissionState;
  } catch {
    return currentPermission();
  }
}

/**
 * Show a local notification. Prefers the service worker registration (proper
 * PWA notification that survives the page being backgrounded); falls back to a
 * page-level Notification. Returns false if not permitted/supported.
 */
export async function showLocalNotification(
  title: string,
  options: { body?: string; tag?: string; url?: string } = {}
): Promise<boolean> {
  if (!notificationSupported() || Notification.permission !== "granted") return false;
  const { body, tag, url } = options;
  const payload: NotificationOptions = {
    body,
    tag,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { url: url || "/dashboard" },
  };
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg) {
      await reg.showNotification(title, payload);
    } else {
      new Notification(title, payload);
    }
    return true;
  } catch {
    return false;
  }
}
