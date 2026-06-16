import { LogOut, Menu } from "lucide-react";
import { signOut } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export function Header({ name, email }: { name: string; email: string }) {
  return (
    <header className="flex h-16 items-center justify-between border-b bg-card px-4 lg:px-6">
      <div className="flex items-center gap-3">
        <Menu className="h-5 w-5 lg:hidden" />
        <div>
          <p className="text-sm font-medium">{name}</p>
          <p className="text-xs text-muted-foreground">{email}</p>
        </div>
      </div>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/login" });
        }}
      >
        <Button variant="ghost" size="sm" type="submit">
          <LogOut className="h-4 w-4" />
          Logout
        </Button>
      </form>
    </header>
  );
}
