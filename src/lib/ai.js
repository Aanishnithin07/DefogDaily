import { getGenerativeModel, GoogleAIBackend, getAI } from "firebase/ai";
import { app, isConfigured } from "./firebase";

let ai;
let model;

if (isConfigured && app) {
  try {
    ai = getAI(app, { backend: new GoogleAIBackend() });
    model = getGenerativeModel(ai, {
      model: "gemini-2.5-flash-lite",
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 256,
      },
    });
  } catch (error) {
    console.error("Firebase AI Logic initialization error:", error);
  }
}

export const generateCoachInsight = async (scores) => {
  if (!isConfigured || !model) {
    return "Firebase AI is not configured. Add your keys to enable the Defog Coach.";
  }

  const prompt = `You are the DefogDaily AI Coach. Your personality is clinical but highly encouraging and insightful.
The user just completed a 4-minute cognitive baseline scan with these scores (0-100 scale, higher is better):
- Processing Speed: ${scores.speed}
- Working Memory: ${scores.memory}
- Interference Control (Stroop): ${scores.stroop}
- Spatial Memory: ${scores.spatial}
- Overall Aggregate: ${scores.aggregate}

Write exactly TWO short sentences:
1. Validate their strongest area with an encouraging observation.
2. Identify their weakest area and suggest a quick mental focus or training tip to improve it.
Do NOT use markdown. Do NOT use emojis. Keep it extremely concise and direct.`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text().trim();
  } catch (err) {
    console.error("AI Coach generation failed:", err);
    return "Your baseline looks solid, but we couldn't generate a personalized insight right now. Keep training to clear your fog!";
  }
};
