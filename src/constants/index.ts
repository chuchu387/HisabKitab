import { Banknote, Bell, Building2, CheckSquare, FolderKanban, Gauge, Handshake, Landmark, ListChecks, MailCheck, ReceiptText, ScrollText, Send, Settings, Tags, UserCircle, UserRoundCheck, Users } from "lucide-react";

export const roles = ["super_admin", "owner", "admin", "staff"] as const;
export type Role = (typeof roles)[number];

export const roleLabels: Record<Role, string> = {
  super_admin: "Super Admin",
  owner: "Organization Owner",
  admin: "Admin",
  staff: "Staff"
};

export const projectStatuses = ["active", "completed", "on_hold"] as const;
export const projectTypes = ["client", "internal"] as const;
export const projectTaskStatuses = ["to_do", "in_progress", "in_review", "complete"] as const;
export const expenseApprovalStatuses = ["pending", "approved", "rejected"] as const;
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
  { href: "/notifications", label: "Notifications", icon: Bell, roles },
  { href: "/account", label: "Account", icon: UserCircle, roles },
  { href: "/organizations", label: "Organizations", icon: Building2, roles: ["super_admin"] },
  { href: "/users", label: "Users", icon: Users, roles: ["owner"] },
  { href: "/clients", label: "Clients", icon: Handshake, roles: ["owner", "admin"] },
  { href: "/projects", label: "Projects", icon: FolderKanban, roles: ["owner", "admin", "staff"] },
  { href: "/project-payments", label: "Payments", icon: Banknote, roles: ["owner", "admin"] },
  { href: "/payment-reminders", label: "Reminders", icon: Send, roles: ["owner", "admin"] },
  { href: "/general-funds", label: "Funds", icon: Landmark, roles: ["owner", "admin"] },
  { href: "/tasks", label: "Tasks", icon: CheckSquare, roles: ["owner", "admin", "staff"] },
  { href: "/categories", label: "Categories", icon: Tags, roles: ["owner", "admin"] },
  { href: "/expenses", label: "Expenses", icon: ReceiptText, roles: ["owner", "admin", "staff"] },
  { href: "/expense-contributors", label: "Contributors", icon: UserRoundCheck, roles: ["owner", "admin", "staff"] },
  { href: "/reports", label: "Reports", icon: ListChecks, roles: ["owner", "admin", "staff"] },
  { href: "/email-logs", label: "Email Audit", icon: MailCheck, roles: ["super_admin", "owner", "admin"] },
  { href: "/audit-logs", label: "Audit Logs", icon: ScrollText, roles: ["owner", "admin"] },
  { href: "/settings", label: "Settings", icon: Settings, roles: ["owner", "admin"] }
] as const;
