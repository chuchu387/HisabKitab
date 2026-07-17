"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandLogo } from "@/components/brand";
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
    <aside className="hidden h-screen w-72 shrink-0 overflow-hidden border-r bg-card/95 shadow-sm backdrop-blur lg:flex lg:flex-col">
      <div className="flex h-20 shrink-0 items-center border-b px-5">
        <BrandLogo />
      </div>
      <nav className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-4">
        {navGroups.map((group) => {
          const items = visibleItems.filter((item) => group.hrefs.includes(item.href));
          if (!items.length) return null;
          return (
            <div key={group.title} className="space-y-1">
              <p className="px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{group.title}</p>
              {items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch={false}
                    className={cn(
                      "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground outline-none transition-all hover:bg-secondary/70 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
                      active && "bg-primary text-primary-foreground shadow-sm hover:bg-primary hover:text-primary-foreground"
                    )}
                  >
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
