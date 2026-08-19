import { createHash } from "crypto";
import { connectToDatabase } from "@/lib/db";
import { processPunches } from "@/services/device-attendance";

function md5(value: string): string {
  return createHash("md5").update(value).digest("hex");
}

function parseDigestChallenge(header: string): Record<string, string> {
  const parts: Record<string, string> = {};
  const re = /(\w+)=(?:"([^"]*)"|([^,\s]+))/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(header)) !== null) {
    parts[match[1].toLowerCase()] = match[2] ?? match[3] ?? "";
  }
  return parts;
}

async function digestFetch(url: string, options: { method?: string; body?: string; username: string; password: string; timeoutMs?: number }): Promise<Response> {
  const { method = "GET", body, username, password, timeoutMs = 15000 } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const send = (authorization?: string) =>
    fetch(url, {
      method,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(authorization ? { Authorization: authorization } : {})
      },
      body,
      signal: controller.signal
    });
  try {
    const first = await send();
    if (first.status !== 401) return first;
    const challenge = first.headers.get("www-authenticate") ?? "";
    if (!challenge.toLowerCase().startsWith("digest")) return first;
    const params = parseDigestChallenge(challenge.replace(/^Digest\s+/i, ""));
    const realm = params.realm ?? "";
    const nonce = params.nonce ?? "";
    const qop = params.qop ?? "auth";
    const nc = "00000001";
    const cnonce = md5(String(Date.now())).slice(0, 16);
    const ha1 = md5(`${username}:${realm}:${password}`);
    const ha2 = md5(`${method}:${url.replace(/^https?:\/\/[^/]+/, "")}`);
    const response = md5(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`);
    let authorization = `Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="${url.replace(/^https?:\/\/[^/]+/, "")}", qop=${qop}, nc=${nc}, cnonce="${cnonce}", response="${response}"`;
    if (params.opaque) authorization += `, opaque="${params.opaque}"`;
    return await send(authorization);
  } finally {
    clearTimeout(timer);
  }
}

function hikTimeString(ms: number): string {
  const d = new Date(ms + (5 * 60 + 45) * 60 * 1000);
  return d.toISOString().replace(/\.\d{3}Z$/, "+05:45");
}

const SUCCESS_MINORS = new Set([38, 75, 113, 151, 152, 153, 154, 155]);

export async function fetchHikAccessEvents(org: any, fromMs: number, toMs: number): Promise<any[]> {
  const base = org.device.deviceUrl.replace(/\/+$/, "");
  const url = `${base}/ISAPI/AccessControl/AcsEvent?format=json`;
  const username = org.device.deviceUsername;
  const password = org.device.devicePassword;
  if (!username || !password) throw new Error("Device username/password not configured");
  const events: any[] = [];
  const searchId = `hk-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
  let position = 0;
  for (let attempt = 0; attempt < 10; attempt++) {
    const body = JSON.stringify({
      AcsEventCond: {
        searchID: searchId,
        searchResultPosition: position,
        maxResults: 30,
        major: 5,
        minor: 0,
        startTime: hikTimeString(fromMs),
        endTime: hikTimeString(toMs)
      }
    });
    const res = await digestFetch(url, { method: "POST", body, username, password });
    if (!res.ok) throw new Error(`ISAPI ${res.status} ${res.statusText}`);
    const data = await res.json();
    const acsEvent = data?.AcsEvent;
    if (!acsEvent) throw new Error("Unexpected ISAPI response");
    const list = acsEvent.InfoList ?? [];
    for (const item of list) {
      if (Number(item.major) === 5 && SUCCESS_MINORS.has(Number(item.minor)) && item.employeeNoString) {
        events.push(item);
      }
    }
    const returned = Number(acsEvent.numOfMatches ?? 0);
    const total = Number(acsEvent.totalMatches ?? 0);
    position += returned;
    if (String(acsEvent.responseStatusStrg).toUpperCase() === "OK" || !returned || position >= total) break;
  }
  return events;
}

export async function getHikDeviceInfo(org: any): Promise<{ model: string; serial: string; firmware: string } | null> {
  const base = org.device.deviceUrl.replace(/\/+$/, "");
  try {
    const res = await digestFetch(`${base}/ISAPI/System/deviceInfo`, {
      username: org.device.deviceUsername,
      password: org.device.devicePassword
    });
    if (!res.ok) return null;
    const xml = await res.text();
    const pick = (tag: string) => {
      const match = xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
      return match ? match[1].trim() : "";
    };
    return { model: pick("model"), serial: pick("serialNumber"), firmware: pick("firmwareVersion") };
  } catch {
    return null;
  }
}

export async function syncHikvisionOrg(org: any, minutesBack = 30): Promise<any> {
  await connectToDatabase();
  if (!org.device?.deviceUrl) return { error: "Device URL not configured" };
  if (!/^https?:\/\//i.test(org.device.deviceUrl)) return { error: "Device URL must start with http:// or https://" };
  const toMs = Date.now();
  const fromMs = toMs - minutesBack * 60 * 1000;
  let events: any[] = [];
  try {
    events = await fetchHikAccessEvents(org, fromMs, toMs);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "ISAPI fetch failed" };
  }
  const punches = events.map((event) => ({ pin: String(event.employeeNoString).trim(), stamp: new Date(event.time) }));
  const result = punches.length ? await processPunches(org, punches, org.device.deviceSn || "hikvision") : { checkedIn: 0, checkedOut: 0, ignored: 0, unmatched: 0 };
  return { events: events.length, ...result };
}