import { z } from "zod";
import { expenseApprovalStatuses, leadSources, leadStatuses, leadTaskStatuses, organizationStatuses, projectStatuses, projectTaskStatuses, projectTypes, proposalStatuses, roles, leadActivityTypes } from "@/constants";

export const objectIdSchema = z.string().min(12);

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8)
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email()
});

export const resetPasswordSchema = z.object({
  token: z.string().min(20),
  password: z.string().min(8),
  confirmPassword: z.string().min(8)
}).refine((value) => value.password === value.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"]
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(8),
  newPassword: z.string().min(8),
  confirmPassword: z.string().min(8)
}).refine((value) => value.newPassword === value.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"]
}).refine((value) => value.currentPassword !== value.newPassword, {
  message: "New password must be different from current password",
  path: ["newPassword"]
});

export const organizationSchema = z.object({
  name: z.string().min(2).max(120),
  code: z.string().min(2).max(20).regex(/^[a-zA-Z0-9_-]+$/),
  email: z.string().email(),
  phone: z.string().max(40).optional().default(""),
  address: z.string().max(300).optional().default(""),
  generalBudget: z.coerce.number().min(0).default(0),
  panNumber: z.string().max(40).optional().default(""),
  vatRegistered: z.coerce.boolean().default(false),
  defaultVatRate: z.preprocess((value) => value === "" ? 13 : value, z.coerce.number().min(0).default(13)),
  vatEffectiveDate: z.preprocess((value) => value === "" ? null : value, z.coerce.date().nullable().optional()),
  status: z.enum(organizationStatuses).default("active"),
  attendanceMode: z.enum(["selfie", "device"]).default("selfie"),
  deviceSn: z.string().max(60).optional().default(""),
  pushSecret: z.string().max(100).optional().default(""),
  deviceUrl: z.string().max(200).optional().default(""),
  pollEnabled: z.coerce.boolean().default(false)
});

export const createOrganizationSchema = organizationSchema.extend({
  adminName: z.string().min(2).max(120),
  adminPassword: z.string().min(8)
});

export const organizationSettingsSchema = organizationSchema.pick({
  name: true,
  email: true,
  phone: true,
  address: true,
  generalBudget: true,
  panNumber: true,
  vatRegistered: true,
  defaultVatRate: true,
  vatEffectiveDate: true
});

export const userSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(8).optional().or(z.literal("")),
  role: z.enum(roles).refine((role) => role !== "super_admin", "Organization users cannot be Super Admin"),
  active: z.coerce.boolean().default(true),
  canCreateTask: z.preprocess((value) => value === "on" || value === "true" || value === true, z.boolean().default(false)),
  canAssignTask: z.preprocess((value) => value === "on" || value === "true" || value === true, z.boolean().default(false)),
  canCreateFolder: z.preprocess((value) => value === "on" || value === "true" || value === true, z.boolean().default(false)),
  canManageFolderProjects: z.preprocess((value) => value === "on" || value === "true" || value === true, z.boolean().default(false)),
  devicePin: z.string().max(40).optional().default("")
});

export const projectSchema = z
  .object({
    clientId: z.string().optional().nullable(),
    name: z.string().min(2).max(120),
    code: z.string().min(2).max(30),
    description: z.string().max(1000).optional().default(""),
    projectType: z.enum(projectTypes).default("client"),
    totalBudget: z.preprocess((value) => value === "" ? 0 : value, z.coerce.number().min(0)),
    receivedAmount: z.preprocess((value) => value === "" ? 0 : value, z.coerce.number().min(0).default(0)),
    startDate: z.preprocess((value) => value === "" ? undefined : value, z.coerce.date({ required_error: "Start date is required", invalid_type_error: "Start date is required" })),
    endDate: z.preprocess((value) => value === "" ? undefined : value, z.coerce.date({ required_error: "End date is required", invalid_type_error: "End date is required" })),
    status: z.enum(projectStatuses).default("active")
  })
  .refine((value) => value.endDate >= value.startDate, {
    message: "End date must be after start date",
    path: ["endDate"]
  });

export const categorySchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(500).optional().default(""),
  active: z.coerce.boolean().default(true)
});

export const expenseSchema = z.object({
  bankAccountId: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  categoryId: objectIdSchema,
  amount: z.coerce.number().positive(),
  vendorName: z.string().max(160).optional().default(""),
  vendorPan: z.string().max(40).optional().default(""),
  billNumber: z.string().max(80).optional().default(""),
  vatAmount: z.preprocess((value) => value === "" ? 0 : value, z.coerce.number().min(0).default(0)),
  tdsAmount: z.preprocess((value) => value === "" ? 0 : value, z.coerce.number().min(0).default(0)),
  taxable: z.coerce.boolean().default(false),
  expenseDate: z.coerce.date(),
  description: z.string().min(2).max(1000)
});

export const invoiceSchema = z.object({
  clientId: objectIdSchema,
  projectId: z.string().optional().nullable(),
  invoiceNumber: z.string().min(2).max(60),
  invoiceDate: z.coerce.date(),
  dueDate: z.coerce.date(),
  status: z.enum(["draft", "sent", "partial", "paid", "void"]).default("draft"),
  vatApplicable: z.preprocess((value) => value === "on" || value === "true" || value === true, z.boolean().default(false)),
  description: z.string().min(2).max(500),
  quantity: z.preprocess((value) => value === "" ? 1 : value, z.coerce.number().positive().default(1)),
  rate: z.coerce.number().min(0),
  vatRate: z.preprocess((value) => value === "" ? 0 : value, z.coerce.number().min(0).default(0)),
  paidAmount: z.preprocess((value) => value === "" ? 0 : value, z.coerce.number().min(0).default(0)),
  notes: z.string().max(1000).optional().default("")
}).refine((value) => value.dueDate >= value.invoiceDate, {
  message: "Due date must be after invoice date",
  path: ["dueDate"]
});

export const salesOrderSchema = z.object({
  clientId: objectIdSchema,
  projectId: z.string().optional().nullable(),
  orderNumber: z.string().min(2).max(60),
  orderDate: z.coerce.date(),
  expectedInvoiceDate: z.preprocess((value) => value === "" ? null : value, z.coerce.date().nullable().optional()).default(null),
  status: z.enum(["draft", "sent", "accepted", "converted", "cancelled"]).default("draft"),
  description: z.string().min(2).max(500),
  quantity: z.coerce.number().positive(),
  rate: z.coerce.number().min(0),
  vatApplicable: z.preprocess((value) => value === "on" || value === "true" || value === true, z.boolean().default(false)),
  vatRate: z.coerce.number().min(0).max(100).default(13),
  notes: z.string().max(1000).optional().default("")
});

export const purchaseOrderSchema = z.object({
  vendorName: z.string().min(2).max(160),
  vendorPan: z.string().max(60).optional().default(""),
  projectId: z.string().optional().nullable(),
  orderNumber: z.string().min(2).max(60),
  orderDate: z.coerce.date(),
  expectedBillDate: z.preprocess((value) => value === "" ? null : value, z.coerce.date().nullable().optional()).default(null),
  status: z.enum(["draft", "sent", "approved", "received", "converted", "cancelled"]).default("draft"),
  description: z.string().min(2).max(500),
  quantity: z.coerce.number().positive(),
  rate: z.coerce.number().min(0),
  taxable: z.preprocess((value) => value === "on" || value === "true" || value === true, z.boolean().default(false)),
  vatRate: z.coerce.number().min(0).max(100).default(13),
  notes: z.string().max(1000).optional().default("")
});

export const apInvoiceSchema = z.object({
  purchaseOrderId: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  vendorName: z.string().min(2).max(160),
  vendorPan: z.string().max(60).optional().default(""),
  billNumber: z.string().min(2).max(80),
  invoiceDate: z.coerce.date(),
  dueDate: z.coerce.date(),
  status: z.enum(["draft", "posted", "partial", "paid", "void"]).default("posted"),
  description: z.string().min(2).max(500),
  quantity: z.coerce.number().positive(),
  rate: z.coerce.number().min(0),
  taxable: z.preprocess((value) => value === "on" || value === "true" || value === true, z.boolean().default(false)),
  vatRate: z.coerce.number().min(0).max(100).default(13),
  paidAmount: z.coerce.number().min(0).default(0),
  notes: z.string().max(1000).optional().default("")
}).refine((value) => value.dueDate >= value.invoiceDate, {
  message: "Due date must be after invoice date",
  path: ["dueDate"]
});

export const fiscalYearSchema = z.object({
  name: z.string().min(4).max(30),
  startDate: z.coerce.date(),
  endDate: z.coerce.date()
}).refine((value) => value.endDate >= value.startDate, {
  message: "End date must be after start date",
  path: ["endDate"]
});

export const bankAccountSchema = z.object({
  name: z.string().min(2).max(120),
  code: z.string().min(2).max(30),
  accountNumber: z.string().max(80).optional().default(""),
  type: z.enum(["cash", "bank", "wallet"]).default("bank"),
  openingBalance: z.preprocess((value) => value === "" ? 0 : value, z.coerce.number().default(0)),
  active: z.coerce.boolean().default(true)
});

export const openingBalanceSchema = z.object({
  fiscalYearId: z.string().optional().nullable(),
  accountCode: z.string().min(2).max(30),
  accountName: z.string().min(2).max(120),
  debit: z.preprocess((value) => value === "" ? 0 : value, z.coerce.number().min(0).default(0)),
  credit: z.preprocess((value) => value === "" ? 0 : value, z.coerce.number().min(0).default(0)),
  note: z.string().max(500).optional().default("")
}).refine((value) => Number(value.debit) !== Number(value.credit), {
  message: "Debit and credit cannot be the same",
  path: ["debit"]
});

export const manualJournalSchema = z.object({
  entryDate: z.coerce.date(),
  memo: z.string().min(2).max(500),
  debitAccountCode: z.string().min(2).max(30),
  debitAccountName: z.string().min(2).max(120),
  creditAccountCode: z.string().min(2).max(30),
  creditAccountName: z.string().min(2).max(120),
  amount: z.coerce.number().positive()
});

export const expenseApprovalSchema = z.object({
  approvalStatus: z.enum(expenseApprovalStatuses),
  approvalNote: z.string().max(500).optional().default("")
});

export const projectPaymentSchema = z.object({
  projectId: objectIdSchema,
  invoiceId: z.string().optional().nullable(),
  autoCreateInvoice: z.preprocess((value) => value === "on" || value === "true" || value === true, z.boolean().default(false)),
  bankAccountId: z.string().optional().nullable(),
  paymentDate: z.coerce.date(),
  amount: z.coerce.number().positive(),
  note: z.string().max(1000).optional().default("")
});

export const generalFundSchema = z.object({
  bankAccountId: z.string().optional().nullable(),
  fundDate: z.coerce.date(),
  amount: z.coerce.number().positive(),
  note: z.string().max(1000).optional().default("")
});

export const projectTaskSchema = z.object({
  folderId: z.string().optional().nullable(),
  title: z.string().min(2).max(160),
  description: z.string().max(1000).optional().default(""),
  status: z.enum(projectTaskStatuses).default("to_do"),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  severity: z.enum(["minor", "normal", "major", "critical"]).default("normal"),
  dueDate: z.preprocess((value) => value === "" ? null : value, z.coerce.date().nullable().optional()).default(null),
  milestone: z.string().max(120).optional().default(""),
  assigneeId: z.string().optional().nullable(),
  estimatedHours: z.coerce.number().min(0).default(0),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().or(z.literal("")).default("")
});

export const taskFolderSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(500).optional().default(""),
  projectIds: z.array(z.string()).default([]),
  active: z.coerce.boolean().default(true)
});

export const reportFilterSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  projectId: z.string().optional(),
  categoryId: z.string().optional()
});

export const clientSchema = z.object({
  name: z.string().min(2).max(120),
  code: z.string().min(2).max(30).regex(/^[a-zA-Z0-9_-]+$/),
  email: z.string().email().optional().or(z.literal("")).default(""),
  phone: z.string().max(40).optional().default(""),
  contactPerson: z.string().max(120).optional().default(""),
  address: z.string().max(300).optional().default(""),
  notes: z.string().max(1000).optional().default(""),
  active: z.coerce.boolean().default(true)
});

export const leadSchema = z.object({
  name: z.string().min(2).max(120),
  company: z.string().max(120).optional().default(""),
  email: z.string().email().optional().or(z.literal("")).default(""),
  phone: z.string().max(40).optional().default(""),
  source: z.enum(leadSources).default("referral"),
  status: z.enum(leadStatuses).default("new"),
  campaignId: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  productId: z.string().optional().nullable(),
  dealValue: z.coerce.number().min(0).default(0),
  estimatedValue: z.preprocess((value) => value === "" ? 0 : value, z.coerce.number().min(0).default(0)),
  assignedTo: z.string().optional().nullable(),
  notes: z.string().max(2000).optional().default(""),
  followUpDate: z.preprocess((value) => value === "" ? null : value, z.coerce.date().nullable().optional()).default(null)
});

export const leadStatusUpdateSchema = z.object({
  status: z.enum(leadStatuses)
});

export const leadActivitySchema = z.object({
  leadId: z.string().min(12),
  type: z.enum(leadActivityTypes),
  description: z.string().max(500).optional().default("")
});

export const proposalSchema = z.object({
  leadId: z.string().optional().nullable(),
  title: z.string().min(2).max(160),
  description: z.string().max(2000).optional().default(""),
  amount: z.preprocess((value) => value === "" ? 0 : value, z.coerce.number().min(0)),
  status: z.enum(proposalStatuses).default("draft")
});

export const leadTaskSchema = z.object({
  leadId: z.string().optional().nullable(),
  title: z.string().min(2).max(160),
  description: z.string().max(1000).optional().default(""),
  status: z.enum(leadTaskStatuses).default("to_contact"),
  dueDate: z.preprocess((value) => value === "" ? null : value, z.coerce.date().nullable().optional()).default(null),
  assigneeId: z.string().optional().nullable()
});
