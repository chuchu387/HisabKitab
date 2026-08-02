export const featureKeys = [
  "attendanceView",
  "attendanceManage",
  "payrollView",
  "payrollManage",
  "leadsView",
  "leadsManage",
  "salesPipeline",
  "salesTasks",
  "salesProposals",
  "salesReports",
  "productsManage",
  "campaignsView",
  "targetsView",
  "commissionsView",
  "chatAccess",
  "chatManage",
  "clientsView",
  "clientsManage",
  "projectsView",
  "projectsManage",
  "expensesView",
  "expensesManage",
  "paymentsView",
  "paymentsManage",
  "fiscalYears",
  "generalFunds",
  "vendorsManage",
  "accountingView",
  "reportsView",
  "emailLogsView",
  "usersManage",
  "settingsView"
] as const;
export type FeatureKey = (typeof featureKeys)[number];

export type Permissions = Record<FeatureKey, boolean>;
export type PermissionOverrides = Partial<Permissions>;

export const featureLabels: Record<FeatureKey, string> = {
  attendanceView: "Attendance",
  attendanceManage: "Attendance Admin (overrides, reports, selfies)",
  payrollView: "Payroll",
  payrollManage: "Payroll Admin (generate, approve, payslips)",
  leadsView: "Leads",
  leadsManage: "Leads Admin (create/edit/delete)",
  salesPipeline: "Sales Pipeline",
  salesTasks: "Sales Tasks",
  salesProposals: "Sales Proposals",
  salesReports: "Sales Reports",
  productsManage: "Product Catalog",
  campaignsView: "Campaigns",
  targetsView: "Sales Targets",
  commissionsView: "Commissions",
  chatAccess: "Chat",
  chatManage: "Chat Admin (create groups)",
  clientsView: "Clients",
  clientsManage: "Clients Admin (create/edit/delete)",
  projectsView: "Projects",
  projectsManage: "Projects Admin (create/edit)",
  expensesView: "Expenses",
  expensesManage: "Expenses Admin (create/edit/delete)",
  fiscalYears: "Fiscal Year Closing",
  paymentsView: "Payments",
  paymentsManage: "Payments Admin",
  generalFunds: "General Funds",
  vendorsManage: "Vendors",
  accountingView: "Accounting (Chart, Ledger, Accounts, Bank)",
  reportsView: "Reports",
  emailLogsView: "Email Audit Logs",
  usersManage: "User Management",
  settingsView: "Settings"
};

export const defaultPermissions: Record<string, Partial<Permissions>> = {
  owner: featureKeys.reduce((acc, k) => ({ ...acc, [k]: true }), {} as Permissions),
  admin: {
    attendanceView: true,
    attendanceManage: true,
    payrollView: true,
    payrollManage: true,
    leadsView: true,
    leadsManage: true,
    salesPipeline: true,
    salesTasks: true,
    salesProposals: true,
    salesReports: true,
    productsManage: true,
    campaignsView: true,
    targetsView: true,
    commissionsView: true,
    chatAccess: true,
    chatManage: true,
    clientsView: true,
    clientsManage: true,
    projectsView: true,
    projectsManage: true,
    expensesView: true,
    expensesManage: true,
    fiscalYears: true,
    paymentsView: true,
    paymentsManage: true,
    generalFunds: true,
    vendorsManage: true,
    accountingView: true,
    reportsView: true,
    emailLogsView: true,
    usersManage: false,
    settingsView: true
  },
  staff: {
    attendanceView: true,
    attendanceManage: false,
    payrollView: true,
    payrollManage: false,
    leadsView: true,
    leadsManage: true,
    salesPipeline: false,
    salesTasks: true,
    salesProposals: false,
    salesReports: false,
    productsManage: false,
    campaignsView: false,
    targetsView: false,
    commissionsView: false,
    chatAccess: true,
    chatManage: false,
    clientsView: true,
    clientsManage: false,
    projectsView: true,
    projectsManage: false,
    expensesView: true,
    expensesManage: true,
    paymentsView: false,
    paymentsManage: false,
    generalFunds: false,
    vendorsManage: false,
    accountingView: false,
    reportsView: true,
    emailLogsView: false,
    usersManage: false,
    settingsView: false
  }
};

export function resolvePermissions(role: string, overrides: PermissionOverrides = {}): Permissions {
  const defaults = defaultPermissions[role] || defaultPermissions.staff;
  return featureKeys.reduce((acc, key) => {
    acc[key] = overrides[key] !== undefined ? overrides[key] : (defaults[key] ?? false);
    return acc;
  }, {} as Permissions);
}

export function hasAccess(item: { href: string; roles: readonly string[] }, role: string, permissions: Permissions | null): boolean {
  if (role === "owner" || role === "super_admin") return (item.roles as readonly string[]).includes(role);
  if (permissions) {
    const feature = navFeatureMap[item.href];
    if (feature) return permissions[feature];
    return (item.roles as readonly string[]).includes(role);
  }
  if (role === "admin") return true;
  return (item.roles as readonly string[]).includes(role);
}

export const navFeatureMap: Record<string, FeatureKey> = {
  "/leads": "leadsView",
  "/sales/pipeline": "salesPipeline",
  "/sales/tasks": "salesTasks",
  "/sales/proposals": "salesProposals",
  "/sales/reports": "salesReports",
  "/sales/products": "productsManage",
  "/sales/campaigns": "campaignsView",
  "/sales/targets": "targetsView",
  "/sales/commissions": "commissionsView",
  "/sales/activities": "salesTasks",
  "/chat": "chatAccess",
  "/clients": "clientsView",
  "/projects": "projectsView",
  "/expenses": "expensesView",
  "/project-payments": "paymentsView",
  "/payment-reminders": "paymentsView",
  "/general-funds": "generalFunds",
  "/vendors": "vendorsManage",
  "/accounts": "accountingView",
  "/chart-of-accounts": "accountingView",
  "/ledger": "accountingView",
  "/bank-accounts": "accountingView",
  "/reconciliation": "accountingView",
  "/opening-balances": "accountingView",
  "/journal-entries": "accountingView",
  "/invoices": "accountingView",
  "/tax": "accountingView",
  "/fiscal-years": "accountingView",
  "/data-health": "accountingView",
  "/reports": "reportsView",
  "/reports/profitability": "reportsView",
  "/email-logs": "emailLogsView",
  "/audit-logs": "reportsView",
  "/users": "usersManage",
  "/permissions": "usersManage",
  "/settings": "settingsView",
  "/attendance": "attendanceView",
  "/attendance/selfies": "attendanceManage",
  "/attendance/reports": "attendanceManage",
  "/attendance/settings": "attendanceManage",
  "/attendance/leaves": "attendanceView",
  "/payroll": "payrollView",
  "/payroll/settings": "payrollManage"
};
