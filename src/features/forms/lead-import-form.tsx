"use client";

import { useState } from "react";
import { toast } from "sonner";
import { importLeadsCsv } from "@/actions/leads";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export function LeadImportForm({ className }: { className?: string }) {
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const formData = new FormData(event.currentTarget);
    const result = await importLeadsCsv(formData);
    if (!result.ok) {
      toast.error(result.message);
      setPending(false);
      return;
    }
    toast.success(result.message);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className={cn("grid gap-3 rounded-lg border bg-card/95 p-4 shadow-sm sm:p-5", className)}>
      <div className="space-y-2">
        <Label htmlFor="file">Upload CSV</Label>
        <input
          id="file"
          name="file"
          type="file"
          accept=".csv"
          required
          className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-primary-foreground hover:file:bg-primary/90"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        CSV columns: <code>name</code>, <code>email</code>, <code>phone</code>, <code>company</code>, <code>source</code>, <code>estimatedValue</code>, <code>notes</code>.
        Duplicates are automatically skipped.
      </p>
      <Button type="submit" disabled={pending}><Upload className="h-4 w-4" />{pending ? "Importing..." : "Import Leads"}</Button>
    </form>
  );
}
