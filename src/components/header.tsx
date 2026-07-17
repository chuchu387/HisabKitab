import { signOut } from "@/lib/auth";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { MobileNav } from "@/components/mobile-nav";
import type { Role } from "@/constants";

export function Header({ name, email, role }: { name: string; email: string; role: Role }) {
  return (
    <header className="flex h-16 items-center justify-between border-b bg-card px-4 lg:px-6">
      <div className="flex items-center gap-3">
        <MobileNav role={role} />
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
