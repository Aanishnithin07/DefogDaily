/**
 * Normalizes raw game metrics into a 0-100 scale for each domain.
 * PROVISIONAL FORMULAS: These formulas are reasonable starting points but
 * should be recalibrated once real user-population data is collected.
 */

export function normalizeScores(rawScores) {
  // 1. Processing Speed
  // Weight accuracy * 0.7 + inverse-scaled reaction time * 0.3
  // Provisional mapping: 300ms -> 100 bonus, 1500ms+ -> 0 bonus
  let speedScore = 0;
  if (rawScores.speed) {
    const { accuracy, avgReactionMs } = rawScores.speed;
    const clampedReactionMs = Math.max(300, Math.min(1500, avgReactionMs));
    // Linear interpolation from 300 (100 pts) to 1500 (0 pts)
    const reactionBonus = 100 - ((clampedReactionMs - 300) / 1200) * 100;
    
    speedScore = (accuracy * 0.7) + (reactionBonus * 0.3);
  }

  // 2. Working Memory
  // The WorkingMemoryGame already outputs accuracy on a 0-100 scale based on 
  // +1 per correct, -0.5 per decoy.
  let memoryScore = 0;
  if (rawScores.memory) {
    memoryScore = rawScores.memory.accuracy;
  }

  // 3. Spatial Memory
  // levelReached divided by the round cap (12), multiplied by 100.
  let spatialScore = 0;
  if (rawScores.spatial) {
    const levelReached = rawScores.spatial.levelReached || 1;
    spatialScore = Math.min(100, (levelReached / 12) * 100);
  }

  // The Big Score
  const aggregateScore = Math.round((speedScore + memoryScore + spatialScore) / 3);

  return {
    speed: Math.round(speedScore),
    memory: Math.round(memoryScore),
    spatial: Math.round(spatialScore),
    aggregate: aggregateScore,
  };
}
