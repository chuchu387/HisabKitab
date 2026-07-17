"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { ActionState } from "@/types";

export function ActionMessage({ state }: { state: ActionState }) {
  const lastMessage = useRef("");
  useEffect(() => {
    if (!state.message || lastMessage.current === state.message) return;
    lastMessage.current = state.message;
    if (state.ok) {
      toast.success(state.message);
    } else {
      toast.error(state.message);
    }
  }, [state.message, state.ok]);

  if (!state.message) return null;
  return <p className={state.ok ? "text-sm text-primary" : "text-sm text-destructive"}>{state.message}</p>;
}
