"use client";

import { useRef } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Mail } from "lucide-react";
import { addLeadActivity } from "@/actions/leads";
import { Button } from "@/components/ui/button";

export function LogEmail({ leadId, email }: { leadId: string; email: string }) {
  const ref = useRef<HTMLFormElement>(null);
  const router = useRouter();
  async function handleClick() {
    window.open(`mailto:${email}`, "_blank");
    const fd = new FormData();
    fd.set("leadId", leadId);
    fd.set("type", "email");
    fd.set("description", `Email sent to ${email}`);
    const result = await addLeadActivity({ ok: false, message: "" }, fd);
    if (!result.ok) toast.error(result.message);
    router.refresh();
  }
  return (
    <Button type="button" variant="ghost" size="sm" className="h-6 px-1.5 text-xs" onClick={handleClick} title="Send & log email">
      <Mail className="h-3 w-3" />
    </Button>
  );
}
