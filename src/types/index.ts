import type { Role } from "@/constants";

export type SessionUser = {
  userId: string;
  organizationId?: string;
  role: Role;
  name: string;
  email: string;
};

export type ActionState = {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

export type Option = {
  label: string;
  value: string;
};
