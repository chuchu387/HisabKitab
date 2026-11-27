"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
    void fetch("/api/client-errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: error.message,
        stack: error.stack,
        digest: error.digest,
        path: window.location.pathname + window.location.search,
        userAgent: navigator.userAgent
      }),
      keepalive: true
    }).catch(() => undefined);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f8fafc", color: "#0f172a" }}>
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
          <section style={{ width: "100%", maxWidth: 440, border: "1px solid #dbe3ec", borderRadius: 8, background: "white", padding: 28, textAlign: "center", boxSizing: "border-box" }}>
            <h1 style={{ margin: 0, fontSize: 20 }}>HisabKitab needs to reload this screen</h1>
            <p style={{ margin: "10px 0 20px", color: "#64748b", fontSize: 14 }}>The error was recorded. Your session and saved data are unaffected.</p>
            <button type="button" onClick={reset} style={{ border: 0, borderRadius: 6, background: "#0f8b7f", color: "white", cursor: "pointer", fontWeight: 600, padding: "10px 18px" }}>
              Reload screen
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
