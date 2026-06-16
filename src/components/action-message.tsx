"use client";

import type { ActionState } from "@/types";

export function ActionMessage({ state }: { state: ActionState }) {
  if (!state.message) return null;
  return <p className={state.ok ? "text-sm text-primary" : "text-sm text-destructive"}>{state.message}</p>;
}
