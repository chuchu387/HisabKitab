import { Building2, FolderKanban, Gauge, ListChecks, ReceiptText, ScrollText, Settings, Tags, Users } from "lucide-react";

export const roles = ["super_admin", "owner", "admin", "staff"] as const;
export type Role = (typeof roles)[number];

export const roleLabels: Record<Role, string> = {
  super_admin: "Super Admin",
  owner: "Organization Owner",
  admin: "Admin",
  staff: "Staff"
};

export const projectStatuses = ["active", "completed", "on_hold"] as const;
export const projectTaskStatuses = ["to_do", "in_progress", "in_review", "complete"] as const;
export const organizationStatuses = ["active", "inactive"] as const;

export const defaultCategories = [
  "Salary",
  "Travel",
  "Food",
  "Equipment",
  "Office Supplies",
  "Utilities",
  "Marketing",
  "Maintenance",
  "Miscellaneous"
];

export const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: Gauge, roles },
  { href: "/organizations", label: "Organizations", icon: Building2, roles: ["super_admin"] },
  { href: "/users", label: "Users", icon: Users, roles: ["owner"] },
  { href: "/projects", label: "Projects", icon: FolderKanban, roles: ["owner", "admin", "staff"] },
  { href: "/categories", label: "Categories", icon: Tags, roles: ["owner", "admin"] },
  { href: "/expenses", label: "Expenses", icon: ReceiptText, roles: ["owner", "admin", "staff"] },
  { href: "/reports", label: "Reports", icon: ListChecks, roles: ["owner", "admin", "staff"] },
  { href: "/audit-logs", label: "Audit Logs", icon: ScrollText, roles: ["owner", "admin"] },
  { href: "/settings", label: "Settings", icon: Settings, roles: ["owner"] }
] as const;
