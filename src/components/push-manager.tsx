"use client";

import { BellRing, BellOff, Loader2, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { usePushRegistration } from "@/hooks/use-push-registration";

export function PushManager() {
  const { state, subscribed, register, unregister } = usePushRegistration();
  const [dismissed, setDismissed] = useState(false);
  const [working, setWorking] = useState(false);

  if (state === "unsupported" || state === "denied") return null;
  if (subscribed || state === "enabled") {
    if (!subscribed) return null;
    return (
      <div className="fixed bottom-3 right-3 z-50 flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs shadow-lg">
        <BellRing className="h-3.5 w-3.5 text-primary" />
        <span className="text-muted-foreground">Push on</span>
        <button
          type="button"
          className="text-muted-foreground underline hover:text-foreground"
          onClick={async () => {
            setWorking(true);
            await unregister();
            setWorking(false);
          }}
        >
          {working ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Off"}
        </button>
      </div>
    );
  }
  if (dismissed || state === "pending" || state === "error") return null;
  if (state !== "idle") return null;

  return (
    <div className="fixed bottom-3 right-3 z-50 flex max-w-xs items-start gap-2 rounded-lg border bg-card p-3 shadow-xl sm:bottom-4 sm:right-4">
      <BellOff className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Enable notifications?</p>
        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">Get alerts for approvals, tasks and payments — even when HisabKitab is closed.</p>
        <div className="mt-2 flex items-center gap-2">
          <Button
            size="sm"
            className="h-7"
            onClick={async () => {
              setWorking(true);
              await register();
              setWorking(false);
            }}
          >
            {working ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BellRing className="h-3.5 w-3.5" />}Enable
          </Button>
          <Button size="sm" variant="ghost" className="h-7" onClick={() => setDismissed(true)}>Later</Button>
        </div>
      </div>
      <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => setDismissed(true)} aria-label="Dismiss">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
