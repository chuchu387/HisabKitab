import { ActivitySquare, Banknote, Bell, BookOpenCheck, Building2, CalendarRange, Camera, CheckSquare, FileArchive, FileText, FolderKanban, Gauge, HandCoins, Handshake, Landmark, ListChecks, MailCheck, ReceiptText, ScrollText, Send, Settings, Tags, Target, TrendingUp, UserCircle, UserRoundCheck, Users } from "lucide-react";

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

export const leadStatuses = ["new", "contacted", "meeting_scheduled", "proposal_sent", "negotiation", "won", "lost"] as const;
export type LeadStatus = (typeof leadStatuses)[number];

export const leadStatusLabels: Record<LeadStatus, string> = {
  new: "New Lead",
  contacted: "Contacted",
  meeting_scheduled: "Meeting Scheduled",
  proposal_sent: "Proposal Sent",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost"
};

export const leadStatusColors: Record<LeadStatus, string> = {
  new: "info",
  contacted: "warning",
  meeting_scheduled: "info",
  proposal_sent: "warning",
  negotiation: "warning",
  won: "success",
  lost: "muted"
} as const;

export const leadSources = ["website", "referral", "facebook", "instagram", "linkedin", "cold_call", "existing_client", "walk_in", "other"] as const;
export type LeadSource = (typeof leadSources)[number];

export const leadSourceLabels: Record<LeadSource, string> = {
  website: "Website",
  referral: "Referral",
  facebook: "Facebook",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  cold_call: "Cold Call",
  existing_client: "Existing Client",
  walk_in: "Walk-in",
  other: "Other"
};

export const leadActivityTypes = ["call", "email", "meeting", "note", "proposal_sent", "status_changed", "follow_up", "converted"] as const;
export type LeadActivityType = (typeof leadActivityTypes)[number];

export const proposalStatuses = ["draft", "sent", "accepted", "rejected", "withdrawn"] as const;
export type ProposalStatus = (typeof proposalStatuses)[number];

export const proposalStatusLabels: Record<ProposalStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  accepted: "Accepted",
  rejected: "Rejected",
  withdrawn: "Withdrawn"
};

export const leadTaskStatuses = ["to_contact", "contacted", "follow_up", "proposal", "converted", "closed"] as const;
export type LeadTaskStatus = (typeof leadTaskStatuses)[number];

export const leadTaskStatusLabels: Record<LeadTaskStatus, string> = {
  to_contact: "To Contact",
  contacted: "Contacted",
  follow_up: "Follow Up",
  proposal: "Proposal",
  converted: "Converted",
  closed: "Closed"
};

export const leadTaskStatusColors: Record<LeadTaskStatus, string> = {
  to_contact: "muted",
  contacted: "info",
  follow_up: "warning",
  proposal: "info",
  converted: "success",
  closed: "muted"
};

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
  { href: "/attendance", label: "Attendance", icon: UserRoundCheck, roles: ["owner", "admin", "staff"] },
  { href: "/attendance/selfies", label: "Selfies", icon: Camera, roles: ["owner", "admin"] },
  { href: "/attendance/reports", label: "Attendance Reports", icon: ListChecks, roles: ["owner", "admin"] },
  { href: "/attendance/leaves", label: "Leaves", icon: CalendarRange, roles: ["owner", "admin", "staff"] },
  { href: "/leads", label: "Leads", icon: Target, roles: ["owner", "admin", "staff"] },
  { href: "/sales/pipeline", label: "Pipeline", icon: TrendingUp, roles: ["owner", "admin"] },
  { href: "/sales/proposals", label: "Proposals", icon: FileText, roles: ["owner", "admin"] },
  { href: "/sales/activities", label: "Activities", icon: ActivitySquare, roles: ["owner", "admin", "staff"] },
  { href: "/sales/tasks", label: "Sales Tasks", icon: CheckSquare, roles: ["owner", "admin", "staff"] },
  { href: "/sales/products", label: "Products", icon: Tags, roles: ["owner", "admin"] },
  { href: "/sales/campaigns", label: "Campaigns", icon: TrendingUp, roles: ["owner", "admin"] },
  { href: "/sales/targets", label: "Targets", icon: Target, roles: ["owner", "admin"] },
  { href: "/sales/commissions", label: "Commissions", icon: HandCoins, roles: ["owner", "admin"] },
  { href: "/sales/reports", label: "Sales Reports", icon: ListChecks, roles: ["owner", "admin"] },
  { href: "/clients", label: "Clients", icon: Handshake, roles: ["owner", "admin"] },
  { href: "/projects", label: "Projects", icon: FolderKanban, roles: ["owner", "admin", "staff"] },
  { href: "/project-payments", label: "Payments", icon: Banknote, roles: ["owner", "admin"] },
  { href: "/payment-reminders", label: "Reminders", icon: Send, roles: ["owner", "admin"] },
  { href: "/general-funds", label: "Funds", icon: Landmark, roles: ["owner", "admin"] },
  { href: "/vendors", label: "Vendors", icon: FileArchive, roles: ["owner", "admin"] },
  { href: "/tasks", label: "Tasks", icon: CheckSquare, roles: ["owner", "admin", "staff"] },
  { href: "/categories", label: "Categories", icon: Tags, roles: ["owner", "admin"] },
  { href: "/expenses", label: "Expenses", icon: ReceiptText, roles: ["owner", "admin", "staff"] },
  { href: "/expense-contributors", label: "Contributors", icon: UserRoundCheck, roles: ["owner", "admin", "staff"] },
  { href: "/accounts", label: "Accounts", icon: BookOpenCheck, roles: ["owner", "admin"] },
  { href: "/data-health", label: "Data Health", icon: ActivitySquare, roles: ["owner", "admin"] },
  { href: "/chart-of-accounts", label: "Chart", icon: ListChecks, roles: ["owner", "admin"] },
  { href: "/ledger", label: "Ledger", icon: ScrollText, roles: ["owner", "admin"] },
  { href: "/bank-accounts", label: "Bank Accounts", icon: Banknote, roles: ["owner", "admin"] },
  { href: "/reconciliation", label: "Reconciliation", icon: Landmark, roles: ["owner", "admin"] },
  { href: "/opening-balances", label: "Opening", icon: HandCoins, roles: ["owner"] },
  { href: "/journal-entries", label: "Journals", icon: BookOpenCheck, roles: ["owner"] },
  { href: "/invoices", label: "Invoices", icon: FileText, roles: ["owner", "admin"] },
  { href: "/tax", label: "Tax", icon: Landmark, roles: ["owner", "admin"] },
  { href: "/fiscal-years", label: "Fiscal Years", icon: CalendarRange, roles: ["owner"] },
  { href: "/reports", label: "Reports", icon: ListChecks, roles: ["owner", "admin", "staff"] },
  { href: "/email-logs", label: "Email Audit", icon: MailCheck, roles: ["super_admin", "owner", "admin"] },
  { href: "/audit-logs", label: "Audit Logs", icon: ScrollText, roles: ["owner", "admin"] },
  { href: "/settings", label: "Settings", icon: Settings, roles: ["owner", "admin"] }
] as const;
