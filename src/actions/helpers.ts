import { ZodError, type ZodSchema } from "zod";
import type { ActionState } from "@/types";

export function formToObject(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

export function actionError(error: unknown): ActionState {
  if (error instanceof ZodError) {
    return { ok: false, message: "Validation failed", fieldErrors: error.flatten().fieldErrors };
  }
  if (error instanceof Error) return { ok: false, message: error.message };
  return { ok: false, message: "Unexpected error" };
}

export function parseForm<T>(schema: ZodSchema<T>, formData: FormData) {
  return schema.parse(formToObject(formData));
}
