import { getFirebaseApp, isConfigured } from "./firebase";
import { DOMAINS } from "./domains";

/**
 * The Defog Coach.
 *
 * When Firebase AI Logic is configured it writes a personalised briefing from
 * the full report. When it is not — which is the default for anyone who just
 * clones this repo — it falls back to a locally composed briefing built from
 * the same report data. The panel is never a dead end, and the free experience
 * never depends on a key.
 */

let modelPromise = null;

/** Loads the Firebase AI SDK on first use so it stays out of the initial bundle. */
const loadModel = () => {
  if (!isConfigured) return Promise.resolve(null);
  if (!modelPromise) {
    modelPromise = Promise.all([getFirebaseApp(), import("firebase/ai")])
      .then(([app, mod]) => {
        if (!app) return null;
        const ai = mod.getAI(app, { backend: new mod.GoogleAIBackend() });
        return mod.getGenerativeModel(ai, {
          model: "gemini-2.5-flash-lite",
          generationConfig: { temperature: 0.65, maxOutputTokens: 420 },
        });
      })
      .catch((error) => {
        console.error("Firebase AI Logic initialization error:", error);
        modelPromise = null;
        return null;
      });
  }
  return modelPromise;
};

const buildPrompt = (report) => {
  const domainLines = report.domains
    .map(
      (d) =>
        `- ${d.label}: ${d.score}/100 (${d.percentileLabel} percentile, ${d.tier.label})`
    )
    .join("\n");

  const findingLines = report.findings.length
    ? report.findings
        .slice(0, 4)
        .map((f) => `- [${f.severity}] ${f.title} — ${f.evidence}`)
        .join("\n")
    : "- No failure patterns crossed threshold.";

  return `You are the DefogDaily Coach. Clinical, specific, and encouraging without being soft. You are talking to someone who just finished a cognitive scan.

COMPOSITE INDEX: ${report.index.index} (${report.index.percentile.toFixed(0)}th percentile)
${report.cognitiveAge ? `ESTIMATED COGNITIVE AGE: ${report.cognitiveAge.years}` : ""}

DOMAIN SCORES:
${domainLines}

DETECTED PATTERNS:
${findingLines}

Write three short paragraphs, no headings, no markdown, no emojis, no bullet points:
1. What their profile actually says about how their mind works day to day. Reference the specific shape of their scores, not generic praise.
2. The single most important thing to work on and why that specific weakness matters in real life.
3. One concrete action they can take today. Be specific enough that they could do it in the next hour.

Under 130 words total. Address them as "you". Do not restate the numbers back to them — interpret them.`;
};

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
          ? topFinding.whatItMeans.split(". ")[0] + "."
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

export const generateCoachInsight = async (report) => {
  if (!report?.index) return "Run a scan to get your briefing.";

  const model = await loadModel();
  if (!model) return localBriefing(report);

  try {
    const result = await model.generateContent(buildPrompt(report));
    const response = await result.response;
    const text = response.text().trim();
    return text || localBriefing(report);
  } catch (err) {
    console.error("AI Coach generation failed, using local briefing:", err);
    return localBriefing(report);
  }
};

export const isAiConfigured = () => isConfigured;
export { localBriefing };
