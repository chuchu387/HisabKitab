"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItems } from "@/constants";
import type { Role } from "@/constants";
import { cn } from "@/lib/utils";

const navGroups = [
  { title: "Overview", hrefs: ["/dashboard"] },
  { title: "Accounting", hrefs: ["/expenses", "/project-payments", "/general-funds", "/expense-contributors"] },
  { title: "Work", hrefs: ["/projects", "/tasks", "/categories"] },
  { title: "Reports", hrefs: ["/reports", "/audit-logs"] },
  { title: "Admin", hrefs: ["/organizations", "/users", "/settings"] }
];

export function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  const visibleItems = navItems.filter((item) => (item.roles as readonly Role[]).includes(role));
  return (
    <aside className="hidden w-64 shrink-0 border-r bg-card lg:block">
      <div className="flex h-16 items-center border-b px-5">
        <Link href="/dashboard" className="font-semibold">HisabKitab</Link>
      </div>
      <nav className="space-y-5 p-3">
        {navGroups.map((group) => {
          const items = visibleItems.filter((item) => group.hrefs.includes(item.href));
          if (!items.length) return null;
          return (
            <div key={group.title} className="space-y-1">
              <p className="px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{group.title}</p>
              {items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link key={item.href} href={item.href} className={cn("flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground", active && "bg-primary/10 text-primary")}>
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
