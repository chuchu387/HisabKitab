"use client";

import { LogOut, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ConfirmButton({
  label = "Delete",
  title,
  description,
  icon = "trash",
  variant = "destructive",
  className
}: {
  label?: string;
  title?: string;
  description?: string;
  icon?: "trash" | "logout";
  variant?: "default" | "secondary" | "ghost" | "destructive" | "outline";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const Icon = icon === "logout" ? LogOut : Trash2;
  const confirmTitle = title ?? `Confirm ${label.toLowerCase()}`;
  const confirmDescription = description ?? `Are you sure you want to ${label.toLowerCase()}? This action cannot be undone.`;

  function confirmAction() {
    const form = document.activeElement?.closest("form") ?? document.querySelector("form[data-confirm-active='true']");
    if (form instanceof HTMLFormElement) form.requestSubmit();
    setOpen(false);
  }

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size="sm"
        className={className}
        onClick={(event) => {
          document.querySelectorAll("form[data-confirm-active='true']").forEach((form) => form.removeAttribute("data-confirm-active"));
          event.currentTarget.closest("form")?.setAttribute("data-confirm-active", "true");
          setOpen(true);
        }}
      >
        <Icon className="h-4 w-4" />
        {label}
      </Button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-lg border bg-card p-5 shadow-xl">
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold">{confirmTitle}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{confirmDescription}</p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="button" variant="destructive" onClick={confirmAction}>{label}</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
