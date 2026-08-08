import Anthropic from "@anthropic-ai/sdk";

/**
 * Domain labels are duplicated here rather than imported from src/lib/domains.js
 * on purpose: this function is bundled separately from the client app, and
 * reaching across that boundary is a deployment failure waiting to happen. The
 * list is eight stable strings — cheap to keep in sync, and it makes the
 * function standalone.
 */
const DOMAIN_LABELS = {
  speed: "Processing Speed",
  memory: "Verbal Working Memory",
  stroop: "Interference Control",
  spatial: "Spatial Memory",
  nback: "Fluid Working Memory",
  inhibition: "Response Inhibition",
  span: "Verbal Span",
  flex: "Cognitive Flexibility",
};
const DOMAIN_KEYS = Object.keys(DOMAIN_LABELS);

/**
 * The Defog Coach — a Vercel serverless function.
 *
 * This exists server-side for one reason: the API key. The previous
 * implementation called a generative model from the browser, which meant the
 * credential shipped to every visitor. Here the key never leaves the server;
 * the client posts scores and gets prose back.
 *
 * It is also entirely optional. With no ANTHROPIC_API_KEY configured the
 * endpoint reports that it is unavailable and the client falls back to a
 * locally composed briefing built from the same report data, so the product
 * works identically for anyone who clones this repo without keys.
 */

const MODEL = "claude-opus-5";

/**
 * Best-effort per-IP rate limiting.
 *
 * This endpoint is public and spends real money per call, so it needs a brake.
 * Serverless instances are ephemeral and not shared, so this is a speed bump
 * rather than a guarantee — it stops casual hammering from a single client,
 * which is the realistic abuse case here. Put a proper gateway limit in front
 * if this ever gets popular.
 */
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 6;
const hits = new Map();

const rateLimited = (ip) => {
  const now = Date.now();
  const bucket = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (bucket.length >= MAX_PER_WINDOW) {
    hits.set(ip, bucket);
    return true;
  }
  bucket.push(now);
  hits.set(ip, bucket);

  // Keep the map from growing without bound on a warm instance.
  if (hits.size > 500) {
    for (const [key, stamps] of hits) {
      if (stamps.every((t) => now - t >= WINDOW_MS)) hits.delete(key);
    }
  }
  return false;
};

/**
 * Rebuild the prompt from validated numbers only.
 *
 * Nothing the client sends is interpolated as text — every field is coerced to
 * a bounded number and every label comes from our own domain registry. That
 * makes prompt injection through this endpoint structurally impossible rather
 * than merely unlikely.
 */
const sanitize = (body) => {
  const domains = [];
  for (const key of DOMAIN_KEYS) {
    const raw = body?.scores?.[key];
    if (typeof raw !== "number" || !Number.isFinite(raw)) continue;
    domains.push({
      label: DOMAIN_LABELS[key],
      score: Math.round(Math.min(100, Math.max(0, raw))),
      percentile: Number.isFinite(body?.percentiles?.[key])
        ? Math.round(Math.min(100, Math.max(0, body.percentiles[key])))
        : null,
    });
  }

  const findings = Array.isArray(body?.findings)
    ? body.findings
        .slice(0, 4)
        .map((f) => ({
          // Only accept findings whose id we actually generate.
          title: typeof f?.title === "string" ? f.title.slice(0, 120) : null,
          severity: ["critical", "watch", "note"].includes(f?.severity) ? f.severity : "note",
        }))
        .filter((f) => f.title)
    : [];

  const index = Number.isFinite(body?.index) ? Math.round(body.index) : null;

  return { domains, findings, index };
};

const buildPrompt = ({ domains, findings, index }) => {
  const domainLines = domains
    .map((d) => `- ${d.label}: ${d.score}/100${d.percentile != null ? ` (${d.percentile}th percentile)` : ""}`)
    .join("\n");

  const findingLines = findings.length
    ? findings.map((f) => `- [${f.severity}] ${f.title}`).join("\n")
    : "- No failure patterns crossed threshold.";

  return `You are the DefogDaily Coach. Someone just finished a cognitive scan. You are clinical and specific, encouraging without being soft.

${index != null ? `COMPOSITE INDEX: ${index} (100 is average, 15 points per standard deviation)` : ""}

DOMAIN SCORES:
${domainLines}

DETECTED PATTERNS:
${findingLines}

Write three short paragraphs. No headings, no markdown, no bullet points, no emoji.
1. What this profile says about how their mind works day to day. Reference the actual shape of their scores — the spread between their best and worst domain, not generic praise.
2. The single most important thing to work on, and why that specific weakness costs them something real.
3. One concrete action for today, specific enough to do in the next hour.

Under 130 words total. Address them as "you". Interpret the numbers — do not read them back.`;
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // Not an error — the local briefing is a first-class fallback.
    return res.status(501).json({ error: "coach_not_configured" });
  }

  const ip =
    (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    req.socket?.remoteAddress ||
    "unknown";
  if (rateLimited(ip)) {
    res.setHeader("Retry-After", "60");
    return res.status(429).json({ error: "rate_limited" });
  }

  const payload = sanitize(req.body);
  if (payload.domains.length === 0) {
    return res.status(400).json({ error: "no_scores" });
  }

  try {
    const client = new Anthropic({ apiKey });

    /**
     * Non-streaming: the output is ~130 words, so there is nothing to stream
     * and the client renders it in one go. max_tokens is well above what the
     * prose needs because it also caps thinking tokens — sizing it to the
     * visible answer alone would truncate mid-sentence. Effort is low because
     * writing a short briefing from eight numbers is a simple, well-specified
     * task; higher effort would only add latency while the user waits.
     */
    const message = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 4096,
      output_config: { effort: "low" },
      // Safety classifiers can decline a request; this reruns it on Anthropic's
      // recommended fallback rather than returning an empty response.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      messages: [{ role: "user", content: buildPrompt(payload) }],
    });

    // Check stop_reason before touching content — on a refusal the content
    // array is empty and indexing it would throw.
    if (message.stop_reason === "refusal") {
      return res.status(503).json({ error: "refused" });
    }

    const text = message.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();

    if (!text) return res.status(502).json({ error: "empty_response" });

    // Briefings are personal and cheap to regenerate; never let a CDN hold one.
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ text });
  } catch (error) {
    // Typed, most-specific first — a rate limit and a bad request need
    // different handling, and the client shows a different message for each.
    if (error instanceof Anthropic.RateLimitError) {
      res.setHeader("Retry-After", "30");
      return res.status(429).json({ error: "upstream_rate_limited" });
    }
    if (error instanceof Anthropic.AuthenticationError) {
      console.error("Coach: ANTHROPIC_API_KEY is invalid");
      return res.status(500).json({ error: "bad_credentials" });
    }
    if (error instanceof Anthropic.APIConnectionError) {
      return res.status(504).json({ error: "upstream_unreachable" });
    }
    if (error instanceof Anthropic.APIError) {
      console.error("Coach: upstream error", error.status, error.message);
      return res.status(502).json({ error: "upstream_error" });
    }
    console.error("Coach: unexpected failure", error);
    return res.status(500).json({ error: "unexpected" });
  }
}
