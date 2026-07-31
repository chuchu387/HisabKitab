"use client";

import { useCallback, useEffect, useState } from "react";

type PushState = "unsupported" | "denied" | "enabled" | "idle" | "pending" | "error";

export function usePushRegistration() {
  const [state, setState] = useState<PushState>("idle");
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        if (cancelled) return;
        const existing = await registration.pushManager.getSubscription();
        if (existing) {
          setSubscribed(true);
          setState("enabled");
        } else if (Notification.permission === "denied") {
          setState("denied");
        } else {
          setState("idle");
        }
      } catch {
        setState("unsupported");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const register = useCallback(async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported");
      return;
    }
    setState("pending");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "idle");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!publicKey) {
          setState("error");
          return;
        }
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: publicKey
        });
      }
      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription)
      });
      if (!response.ok) throw new Error("Failed to save subscription");
      setSubscribed(true);
      setState("enabled");
    } catch {
      setState("error");
    }
  }, []);

  const unregister = useCallback(async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint })
        });
        await subscription.unsubscribe();
      }
      setSubscribed(false);
      setState("idle");
    } catch {
      setState("error");
    }
  }, []);

  return { state, subscribed, register, unregister };
}
