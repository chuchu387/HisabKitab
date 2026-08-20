# Hikvision DS-K1A8503EF-B → HisabKitab — Full Setup Guide

Setup for the Hikvision **DS-K1A8503EF-B** fingerprint attendance terminal (BLI, Rs. 8,999) with HisabKitab's device integration.

> Device specs you'll rely on: 1,000 users, 1,000 fingerprints, 100,000 event records, TCP/IP 10/100 ethernet, 5V DC/1A adapter with built-in 2,000 mAh lithium battery (~2h on power loss), USB 2.0 port, EM card reader (EF model).

---

## What you need

- [ ] DS-K1A8503EF-B + power adapter (in box)
- [ ] Ethernet cable (cat5e+, long enough to reach router/switch)
- [ ] A computer on the same office LAN (for setup)
- [ ] Office router admin login (usually on the router's bottom sticker)
- [ ] Super admin login to HisabKitab
- [ ] Hikvision SADP tool (free, Windows) — only if you can't find the IP easily: hikvision.com → Support → Download Center → SADP

---

## Phase 1 — Unbox & physical wiring (5 min)

1. Unbox: device, power adapter (5V DC/1A), wall-mount bracket + screws.
2. Mount it near the office entrance on a wall (or leave on a desk for now).
3. Plug the **ethernet cable** into the device's RJ45 port (on the back/bottom) and the other end into the office router or switch.
4. Plug in the power adapter. The 2.4" LCD lights up, shows time/date.
5. Write down the device **serial number** (printed on a sticker on the device) — you'll need it later.

> The built-in battery only keeps it alive ~2h after power loss — it's a backup, not a UPS. Keep it plugged in.

---

## Phase 2 — Find the device's IP address

The device uses DHCP by default. Pick one method:

**Method A — SADP tool (recommended, fastest)**
1. Install SADP on a PC on the same LAN.
2. Open it → it auto-scans the LAN and lists the device (model, IP, serial, firmware).
3. Note the IP.

**Method B — Router DHCP list**
1. Open the router admin page (usually `http://192.168.1.1` or `http://192.168.0.1`).
2. Look for "DHCP clients" / "Device list" / "Attached devices".
3. Find an entry with a Hikvision-looking name or the device's MAC (from the sticker) → note the IP.

**Method C — On the device**
1. Device keypad → Menu (press `Menu`) → look for **Network / Network info / System info**.
2. The IP may be shown there. (Menu names vary slightly by firmware.)

Write the IP down: e.g. `192.168.1.100`.

---

## Phase 3 — First login, activate, set admin password

1. On a PC on the same LAN, open a browser → `http://<device-ip>/` (e.g. `http://192.168.1.100/`).
2. Login as **admin**:
   - **First activation** (newer firmware): you'll be forced to create an admin password — 8+ chars with letters + numbers. **Use a strong one; you'll put it in HisabKitab.**
   - Already active: `admin` / the password you set. Very old firmware defaults to `admin` / `12345`.
3. Logged in? Good.

### Immediately do these 3 things:

**A. Change the admin password** (if not set by you just now)
- Web UI → **User Management** (or System → User) → edit admin → new password → save.

**B. Set time zone + NTP — CRITICAL** (attendance stamps use the device clock)
- Web UI → **System → Time** (or System Settings → Time):
  - Time Zone: `GMT+05:45` (Kathmandu)
  - Enable **NTP**, server e.g. `pool.ntp.org` or `ntp.nist.gov`
  - Sync now → confirm the time matches your watch.
- If NTP can't reach the internet from the office LAN, set the time **manually** (correct date/time in Nepal time) and re-check it every month.

**C. Verify the serial + firmware**
- Web UI → **System → Device Info** (or login page). Note the **serial number** and **firmware version** (e.g. V1.4.1). Firmware version matters if we ever need to debug.

---

## Phase 4 — Give the device a static IP (recommended)

A fixed IP makes port-forwarding stable (DHCP could change the IP and silently break polling).

1. Web UI → **Network → Network parameters** (or System → Network).
2. Set: **DHCP = off / Manual**, and enter:
   - IP: a free address, e.g. `192.168.1.100`
   - Subnet mask: `255.255.255.0`
   - Gateway: your router's IP (e.g. `192.168.1.1`)
   - DNS: `8.8.8.8` or your router IP
3. Save → the device reboots with the new IP → reconnect using the new IP.
4. **Bonus (optional but smart)**: in the router, reserve this IP via DHCP reservation (bind the device MAC to `192.168.1.100`) so nothing else grabs it.

---

## Phase 5 — Change the device web port (security)

Our cloud server polls the device over HTTP. If you forward port 80 to the internet, scanners will hammer it. Use a non-default port:

1. Web UI → **Network → Ports** (or System → Network → Port):
   - **HTTP port → `8087`** (or any free port like `8089`). Save.
2. The web UI will now be at `http://<device-ip>:8087`.

---

## Phase 6 — Port forwarding on the office router

This is how HisabKitab's server (on AWS) reaches the device inside your office.

1. Log into the router admin (e.g. `192.168.1.1`).
2. Find **Port Forwarding / Virtual Server / NAT / NAT Forwarding**.
3. Add a rule:
   - Name: `hik-attendance`
   - Protocol: **TCP**
   - External port: **8087**
   - Internal IP: `192.168.1.100` (the device's static IP)
   - Internal port: **8087**
4. **Security (if your router supports a "Source/Remote IP" field)**: restrict to `13.203.67.143` (our server's IP). Then ONLY HisabKitab can reach the device from the internet.
5. Save/Apply.

### Find your public IP (and check for CGNAT — important!)

1. On any device in the office, open `whatismyip.com` → note the public IP.
2. **Test from outside**: disconnect your phone from the office WiFi (use mobile data) → browser → `http://<public-ip>:8087`.
   - You should see the Hikvision login page. ✅
   - If it doesn't load: **CGNAT or no public IP** (common with Nepal ISP home/office plans) → port-forwarding will never work. You have two options:
     - **Ask the ISP for a static public IP** (best, permanent).
     - **VPN**: install Tailscale (free) on a small always-on PC in the office + on a machine that can also be reached... simpler: give the device's IP to HisabKitab via a Tailscale sidecar — this needs the office PC running. See Troubleshooting for details.
3. **DDNS (recommended)**: office public IPs change. If your router supports DDNS (No-IP, DynDNS, DuckDNS), enable it and get a hostname like `codastra.ddns.net`. Use that hostname in HisabKitab instead of the raw IP.

---

## Phase 7 — Enroll staff (with employee numbers!)

**Decide a numbering scheme first** — e.g. Ashim = `1001`, Meghraj = `1002`, Shesh = `1003`, Anupa = `1004`. These numbers are the ONLY link between the device and HisabKitab. Write them down.

### On the device keypad (recommended — reliable)
1. `Menu` → **Person / User Management** (menu names vary slightly) → **Add / New person**.
2. **Employee No / User ID**: enter the number, e.g. `1001`.
3. **Name**: enter the person's name.
4. Enroll fingerprint: when prompted, place the finger on the scanner — repeat 3–4 times until it says "success". You can enroll more than one finger per person.
5. Save. Repeat for each staff member.

### Via the web UI (faster for the list, enrollment still on device)
1. Web UI → **Person Management** → Add person → set **Employee No** + **Name** → save.
2. Fingerprint enrollment is then done on the device keypad (enroll the fingerprint under that person's menu).

> **EM cards (EF model):** the device also reads EM proximity cards (0–3.5 cm). You can give staff a card instead of/in addition to fingerprints — card swipes come through to HisabKitab exactly like fingerprints. No extra setup needed.

---

## Phase 8 — HisabKitab: set the Device PIN for each user

1. Login to HisabKitab as **super admin**.
2. **Users** → open each staff member → find **Device PIN (fingerprint)**.
3. Enter the exact employee number from the device (e.g. `1001`). **Must match character-for-character** (no spaces).
4. Make sure the user is **Active**. Save.
5. Repeat for every staff member. A mismatch shows up as `unmatched` in the poll summary.

---

## Phase 9 — HisabKitab: configure the organization

1. **Organizations** → your org → **Edit**.
2. **Attendance Method**: `Fingerprint device`.
3. **Device Vendor**: `Hikvision (ISAPI)`.
4. **Device Serial (SN)**: the device serial from Phase 3 (optional but useful).
5. **Device Username**: `admin`.
6. **Device Password**: the admin password from Phase 3.
7. **Device URL**: `http://<public-ip-or-ddns>:8087` — e.g. `http://103.237.255.40:8087` or `http://codastra.ddns.net:8087`.
8. Tick **Enable scheduled polling**.
9. **Save Organization**.

---

## Phase 10 — Test the connection (1 click)

1. Still on the org form, click **Test device connection**.
2. Success looks like:
   `DS-K1A8503EF-B (serial 8G04xxxxx, firmware V1.4.1). Events in last 2h: 6 | check-ins: 3 | check-outs: 3 | unmatched: 0`
   - This also **imports the last 2 hours of punches into attendance** right away.
3. Failure looks like: `Could not reach the device. Check the URL, port forward, username, and password.` → go to Troubleshooting.

---

## Phase 11 — Verify it end-to-end

1. Ask staff to scan a finger on the device.
2. Within ~15 minutes (the poll cron runs every 15 min) the check-in should appear in:
   - **Attendance → Team Today** (member shows checked-in with time)
   - **Attendance → Reports** (the day's row shows the check-in time; late/half-day/absent rules apply exactly as configured: grace, half-day-after, absent-if-late, OT, working days, holidays)
3. If you ever need to force a refresh: click **Test device connection** again — it syncs immediately.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Phone test (`http://public-ip:8087` on mobile data) fails | Port forward wrong, or CGNAT/no public IP | Re-check the forward rule; if CGNAT → static IP from ISP, or VPN (Tailscale on an office PC, then use that PC's Tailscale IP:port) |
| Test button: "Could not reach the device" | URL/port wrong, forward broken, device offline, wrong password | Re-run Phase 6 test; try `http://<device-ip>:8087` from office browser; check password; check device powered |
| Test button succeeds but `events: 0` | Nobody scanned recently, device clock wrong, or firmware uses a different event code | Confirm staff scanned; fix time zone/NTP (Phase 3B); if still 0 → tell us the firmware version (Phase 3C), we'll adjust the event filter |
| `unmatched: N` in test result | Device PIN doesn't match any active user | Fix Device PINs in Users (Phase 8) |
| Attendance times look wrong (e.g. off by 5:45) | Device time zone not set to GMT+05:45 | Phase 3B |
| Can't log into device web UI | Wrong IP/port after Phase 4/5 | Check IP in SADP; try port 8087 |
| Forgot device admin password | — | Factory reset (small reset hole/pinhole on the device — see manual). **WARNING: wipes all enrolled users/fingerprints** — redo Phase 7 |
| NTP fails | Office firewall blocks outbound 123 | Allow outbound NTP, or set device time manually monthly |
| Poll not importing at all | Polling not enabled / wrong org | Phase 9 step 8; confirm org attendanceMode is `device` |

---

## Notes & limits

- **Capacity**: 1,000 users / 1,000 fingerprints / 100,000 events. At ~4 scans/person/day for 10 staff that's ~1,460 events/month → years of headroom. Even when full, we poll by time window + dedupe, so the serial-number wrap is safe.
- **Latency**: the poll runs every 15 min, so a scan shows up in reports within ~15 min. Real-time isn't possible on this model without HikCentral; 15 min is fine for attendance reporting.
- **Reports**: check-in and check-out times come from the device clock (Nepal time). Our report logic (grace, half-day, absent-if-late, OT, payroll) treats these exactly like selfie check-ins.
- **Mixed mode**: while the device is being set up, the org stays on "Selfie check-in" — both work independently; switch over when ready. Old selfie records remain in reports.
- **Security**: restrict the port-forward source to `13.203.67.143` if possible, use a strong device password, and consider a non-default web port (Phase 5).
