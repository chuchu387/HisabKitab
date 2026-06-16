"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ConfirmButton({ label = "Delete" }: { label?: string }) {
  return (
    <Button
      type="submit"
      variant="destructive"
      size="sm"
      onClick={(event) => {
        if (!window.confirm(`Confirm ${label.toLowerCase()}?`)) event.preventDefault();
      }}
    >
      <Trash2 className="h-4 w-4" />
      {label}
    </Button>
  );
}
