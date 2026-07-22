export function startTimer(label: string) {
  const started = Date.now();
  return {
    end(metadata?: Record<string, unknown>) {
      const durationMs = Date.now() - started;
      if (process.env.ENABLE_PERF_LOGS === "true" || durationMs > 1500) {
        console.info(JSON.stringify({ type: "performance", label, durationMs, ...(metadata ?? {}) }));
      }
    }
  };
}
