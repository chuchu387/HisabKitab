"use client";

import { LogOut, Trash2 } from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";
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
  const [targetForm, setTargetForm] = useState<HTMLFormElement | null>(null);
  const Icon = icon === "logout" ? LogOut : Trash2;
  const confirmTitle = title ?? `Confirm ${label.toLowerCase()}`;
  const confirmDescription = description ?? `Are you sure you want to ${label.toLowerCase()}? This action cannot be undone.`;

  function confirmAction() {
    const form = targetForm ?? document.querySelector("form[data-confirm-active='true']");
    if (form instanceof HTMLFormElement) form.requestSubmit();
    setOpen(false);
  }

  const modal = open ? (
    <div className="fixed inset-0 z-[9999] grid place-items-center bg-foreground/45 p-4 backdrop-blur-sm">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Cancel confirmation" onClick={() => setOpen(false)} />
      <div role="dialog" aria-modal="true" aria-labelledby="confirm-title" className="relative w-full max-w-md overflow-hidden rounded-lg border bg-card shadow-2xl">
        <div className="border-b bg-muted/30 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <h2 id="confirm-title" className="text-base font-semibold">{confirmTitle}</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{confirmDescription}</p>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 p-4">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button type="button" variant="destructive" onClick={confirmAction}>{label}</Button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size="sm"
        className={className}
        onClick={(event) => {
          document.querySelectorAll("form[data-confirm-active='true']").forEach((form) => form.removeAttribute("data-confirm-active"));
          const form = event.currentTarget.closest("form");
          form?.setAttribute("data-confirm-active", "true");
          setTargetForm(form);
          setOpen(true);
        }}
      >
        <Icon className="h-4 w-4" />
        {label}
      </Button>
      {modal && createPortal(modal, document.body)}
    </>
  );
}
