import { signOut } from "@/lib/auth";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { MobileNav } from "@/components/mobile-nav";
import { BrandMark } from "@/components/brand";
import type { Role } from "@/constants";

export function Header({ name, email, role }: { name: string; email: string; role: Role }) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/85 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/75 lg:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <MobileNav role={role} />
        <div className="hidden items-center gap-3 rounded-full border bg-card px-3 py-1.5 shadow-sm sm:flex">
          <BrandMark className="h-8 w-8 text-xs" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight">{name}</p>
            <p className="truncate text-xs text-muted-foreground">{email}</p>
          </div>
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
          className="border bg-card shadow-sm hover:bg-muted"
        />
      </form>
    </header>
  );
}
