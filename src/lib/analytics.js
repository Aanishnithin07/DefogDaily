export function trackEvent(name, payload = {}) {
  // no-op stub for analytics.
  // Wiring real analytics later becomes a one-file change.
  if (process.env.NODE_ENV === "development") {
    console.log(`[Analytics] ${name}`, payload);
  }
}
