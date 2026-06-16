import { AuditLog } from "@/models/AuditLog";

type AuditInput = {
  organizationId: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
};

export async function writeAuditLog(input: AuditInput) {
  await AuditLog.create(input);
}
