import { DOMAINS } from "./domains";

/**
 * The Defog Coach, client side.
 *
 * Posts the report's numbers to our own /api/coach function, which holds the
 * API key and talks to Claude. If that endpoint is unconfigured, rate-limited,
 * or unreachable, we fall back to a briefing composed locally from the same
 * report — so the panel always says something useful and the free experience
 * never depends on a key existing.
 */

const REQUEST_TIMEOUT_MS = 20_000;

/**
 * Once we learn the coach endpoint isn't there, stop asking.
 *
 * The panel renders on both the results screen and the report screen, so
 * without this a visitor with no key configured — or anyone running `vite dev`,
 * where the serverless function simply does not exist — fires a doomed request
 * every time they navigate. One failed probe per page load is enough.
 */
let coachUnavailable = false;

/** Deterministic briefing composed from the report. No network required. */
const localBriefing = (report) => {
  if (!report?.index) return "Run a scan to get your briefing.";

  const strongest = report.topStrengths?.[0];
  const weakest = report.primaryTarget;
  const topFinding = report.findings?.[0];

  const shape =
    report.spread > 40
      ? "Your profile is unusually uneven — you have a genuine spike and a genuine gap rather than a flat average."
      : report.spread > 22
      ? "Your profile has a clear high point and a clear low point rather than sitting flat."
      : "Your profile is well balanced, with no single domain dragging or carrying the rest.";

  const parts = [];

  parts.push(
    `${shape}${
      strongest
        ? ` ${strongest.label} is your strongest system at the ${strongest.percentileLabel} percentile, which means ${
            DOMAINS[strongest.key]?.realWorld?.[0]?.toLowerCase() ?? "that kind of task"
          } tends to come easily to you.`
        : ""
    }`
  );

  if (weakest) {
    parts.push(
      `The thing to work on is ${weakest.label}, sitting at the ${weakest.percentileLabel} percentile. ${
        topFinding
          ? `${topFinding.whatItMeans.split(". ")[0]}.`
          : `In practice this is what makes ${
              DOMAINS[weakest.key]?.realWorld?.[0]?.toLowerCase() ?? "certain tasks"
            } cost you more effort than they should.`
      }`
    );
  }

  if (topFinding?.fix) {
    parts.push(`Today: ${topFinding.fix.steps[0]}`);
  } else if (weakest) {
    parts.push(
      `Today: run a short ${DOMAINS[weakest.key]?.short ?? "targeted"} drill and aim for accuracy over speed. Five focused minutes beats twenty distracted ones.`
    );
  }

  return parts.join("\n\n");
};

/** Only numbers and our own finding titles leave the browser. */
const toPayload = (report) => ({
  index: report.index?.index ?? null,
  scores: Object.fromEntries(report.domains.map((d) => [d.key, d.score])),
  percentiles: Object.fromEntries(report.domains.map((d) => [d.key, d.percentile])),
  findings: (report.findings ?? []).slice(0, 4).map((f) => ({
    title: f.title,
    severity: f.severity,
  })),
});

/**
 * @returns {Promise<{ text: string, source: "ai"|"local" }>}
 */
export const generateCoachInsight = async (report) => {
  if (!report?.index) {
    return { text: "Run a scan to get your briefing.", source: "local" };
  }

  if (coachUnavailable) {
    return { text: localBriefing(report), source: "local" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch("/api/coach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toPayload(report)),
      signal: controller.signal,
    });

    if (!response.ok) {
      // 501 = no key configured (the default for anyone who clones this repo).
      // 404 = running the Vite dev server, which does not serve /api.
      // Both are permanent for this page load, so stop probing. A 429 or 5xx
      // is transient, so leave the door open for the next scan.
      if (response.status === 501 || response.status === 404) {
        coachUnavailable = true;
      } else {
        console.warn(`Coach unavailable (${response.status}) — using local briefing.`);
      }
      return { text: localBriefing(report), source: "local" };
    }

    const data = await response.json();
    if (!data?.text) return { text: localBriefing(report), source: "local" };
    return { text: data.text, source: "ai" };
  } catch (error) {
    if (error.name !== "AbortError") {
      console.warn("Coach request failed — using local briefing.", error);
    }
    return { text: localBriefing(report), source: "local" };
  } finally {
    clearTimeout(timeout);
  }
};

export { localBriefing };
