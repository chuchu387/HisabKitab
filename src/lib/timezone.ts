export const NEPAL_OFFSET_MS = (5 * 60 + 45) * 60 * 1000;

export function nepalNow(): Date {
  return new Date(Date.now() + NEPAL_OFFSET_MS);
}

export function nepalDateString(): string {
  return nepalNow().toISOString().slice(0, 10);
}

export function nepalHour(): number {
  return nepalNow().getUTCHours();
}

export function isCheckInOpen(): boolean {
  const h = nepalHour();
  return h >= 8;
}
