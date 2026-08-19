export const NEPAL_OFFSET_MS = (5 * 60 + 45) * 60 * 1000;

export function nepalNow(): Date {
  return new Date(Date.now() + NEPAL_OFFSET_MS);
}

export function nepalDateString(): string {
  return nepalNow().toISOString().slice(0, 10);
}

export function nepalDateEndMs(date: string): number {
  return new Date(`${date}T23:59:59+05:45`).getTime();
}

export function nepalHour(): number {
  return nepalNow().getUTCHours();
}

export function isCheckInOpen(): boolean {
  const h = nepalHour();
  return h >= 8;
}

export function isSaturday(): boolean {
  const d = new Date(Date.now() + NEPAL_OFFSET_MS);
  return d.getUTCDay() === 6;
}

export function formatNepalTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kathmandu" });
}

export function formatNepalDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", { timeZone: "Asia/Kathmandu" });
}

export function formatNepalRange(checkIn: Date | string, checkOut: Date | string | null): string {
  const start = formatNepalTime(checkIn);
  if (!checkOut) return start;
  return `${start} - ${formatNepalTime(checkOut)}`;
}
