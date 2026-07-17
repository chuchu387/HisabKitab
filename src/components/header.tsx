import { Menu } from "lucide-react";
import { signOut } from "@/lib/auth";
import { ConfirmButton } from "@/components/ui/confirm-button";

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
        <ConfirmButton
          label="Logout"
          title="Logout from HisabKitab?"
          description="You will be returned to the login screen. Any unsaved form changes will be lost."
          icon="logout"
          variant="ghost"
        />
      </form>
    </header>
  );
}
