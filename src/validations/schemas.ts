import { z } from "zod";
import { organizationStatuses, projectStatuses, roles } from "@/constants";

export const objectIdSchema = z.string().min(12);

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

export const organizationSchema = z.object({
  name: z.string().min(2).max(120),
  code: z.string().min(2).max(20).regex(/^[a-zA-Z0-9_-]+$/),
  email: z.string().email(),
  phone: z.string().max(40).optional().default(""),
  address: z.string().max(300).optional().default(""),
  status: z.enum(organizationStatuses).default("active")
});

export const createOrganizationSchema = organizationSchema.extend({
  adminName: z.string().min(2).max(120),
  adminPassword: z.string().min(8)
});

export const organizationSettingsSchema = organizationSchema.pick({
  name: true,
  email: true,
  phone: true,
  address: true
});

export const userSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(8).optional().or(z.literal("")),
  role: z.enum(roles).refine((role) => role !== "super_admin", "Organization users cannot be Super Admin"),
  active: z.coerce.boolean().default(true)
});

export const projectSchema = z
  .object({
    name: z.string().min(2).max(120),
    code: z.string().min(2).max(30),
    description: z.string().max(1000).optional().default(""),
    totalBudget: z.coerce.number().min(0),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
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
  projectId: z.string().optional().nullable(),
  categoryId: objectIdSchema,
  amount: z.coerce.number().positive(),
  expenseDate: z.coerce.date(),
  description: z.string().min(2).max(1000)
});

export const reportFilterSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  projectId: z.string().optional(),
  categoryId: z.string().optional()
});
