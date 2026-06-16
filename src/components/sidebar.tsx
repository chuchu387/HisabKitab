import Link from "next/link";
import { navItems } from "@/constants";
import type { Role } from "@/constants";

export function Sidebar({ role }: { role: Role }) {
  return (
    <aside className="hidden w-64 shrink-0 border-r bg-card lg:block">
      <div className="flex h-16 items-center border-b px-5">
        <Link href="/dashboard" className="font-semibold">Organization Expense Manager</Link>
      </div>
      <nav className="space-y-1 p-3">
        {navItems.filter((item) => (item.roles as readonly Role[]).includes(role)).map((item) => (
          <Link key={item.href} href={item.href} className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
