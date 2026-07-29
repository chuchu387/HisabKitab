"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandLogo } from "@/components/brand";
import { navItems } from "@/constants";
import type { Role } from "@/constants";
import { cn } from "@/lib/utils";

const navGroups = [
  { title: "Overview", hrefs: ["/dashboard", "/notifications", "/account"] },
  { title: "Accounting", hrefs: ["/expenses", "/project-payments", "/payment-reminders", "/general-funds", "/expense-contributors"] },
  { title: "Work", hrefs: ["/clients", "/projects", "/tasks", "/categories"] },
  { title: "Accounts", hrefs: ["/accounts", "/chart-of-accounts", "/ledger", "/bank-accounts", "/opening-balances", "/journal-entries", "/invoices", "/tax", "/fiscal-years"] },
  { title: "Reports", hrefs: ["/reports", "/email-logs", "/audit-logs"] },
  { title: "Admin", hrefs: ["/organizations", "/users", "/settings"] }
];

export function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  const visibleItems = navItems.filter((item) => (item.roles as readonly Role[]).includes(role));
  return (
    <aside className="hidden h-screen w-64 shrink-0 overflow-hidden border-r bg-card/95 shadow-sm backdrop-blur lg:flex lg:flex-col">
      <div className="flex h-14 shrink-0 items-center border-b px-4">
        <BrandLogo compact />
      </div>
      <nav className="min-h-0 flex-1 space-y-2 overflow-hidden p-2.5">
        {navGroups.map((group) => {
          const items = visibleItems.filter((item) => group.hrefs.includes(item.href));
          if (!items.length) return null;
          return (
            <div key={group.title} className="space-y-0.5">
              <p className="px-2 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">{group.title}</p>
              {items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch={false}
                    className={cn(
                      "group flex items-center gap-2 rounded-md px-2 py-1 text-[12px] font-medium text-muted-foreground outline-none transition-all hover:bg-secondary/70 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
                      active && "bg-primary text-primary-foreground shadow-sm hover:bg-primary hover:text-primary-foreground"
                    )}
                  >
                    <item.icon className="h-3.5 w-3.5 shrink-0" />
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
