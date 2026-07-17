"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BrandLogo } from "@/components/brand";
import { navItems, type Role } from "@/constants";
import { cn } from "@/lib/utils";

const navGroups = [
  { title: "Overview", hrefs: ["/dashboard"] },
  { title: "Accounting", hrefs: ["/expenses", "/project-payments", "/general-funds", "/expense-contributors"] },
  { title: "Work", hrefs: ["/projects", "/tasks", "/categories"] },
  { title: "Reports", hrefs: ["/reports", "/audit-logs"] },
  { title: "Admin", hrefs: ["/organizations", "/users", "/settings"] }
];

export function MobileNav({ role }: { role: Role }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const visibleItems = navItems.filter((item) => (item.roles as readonly Role[]).includes(role));
  return (
    <>
      <button type="button" className="rounded-lg border bg-card p-2 shadow-sm hover:bg-muted lg:hidden" onClick={() => setOpen(true)} aria-label="Open navigation">
        <Menu className="h-5 w-5" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" className="absolute inset-0 bg-foreground/30 backdrop-blur-sm" aria-label="Close navigation" onClick={() => setOpen(false)} />
          <div className="relative flex h-dvh w-80 max-w-[88vw] flex-col overflow-hidden border-r bg-card p-3 shadow-xl sm:p-4">
            <div className="flex h-14 shrink-0 items-center justify-between gap-3">
              <BrandLogo onClick={() => setOpen(false)} />
              <button type="button" className="rounded-lg border bg-background p-2 hover:bg-muted" onClick={() => setOpen(false)} aria-label="Close navigation">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="mt-4 min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain pb-4">
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
                          onClick={() => setOpen(false)}
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground outline-none transition-all hover:bg-secondary/70 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
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
          </div>
        </div>
      )}
    </>
  );
}
