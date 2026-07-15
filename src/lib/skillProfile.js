import { useState, useEffect } from "react";

const STORAGE_KEY = "defogdaily_skill_v1";

export const getSkillProfile = () => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("Failed to read skill profile from localStorage", error);
  }
  return {
    speed: { sessions: 0, bestScore: 0, rollingAverage: null },
    memory: { sessions: 0, bestScore: 0, rollingAverage: null },
    stroop: { sessions: 0, bestScore: 0, rollingAverage: null },
    spatial: { sessions: 0, bestScore: 0, rollingAverage: null },
  };
};

export const updateSkillProfile = (normalizedScores) => {
  const profile = getSkillProfile();
  
  const domains = ["speed", "memory", "stroop", "spatial"];
  
  domains.forEach(domain => {
    const currentScore = normalizedScores[domain];
    if (currentScore === undefined || currentScore === null) return;
    
    const stats = profile[domain];
    stats.sessions += 1;
    stats.bestScore = Math.max(stats.bestScore, currentScore);
    
    // Exponential moving average (70% old, 30% new)
    if (stats.rollingAverage === null) {
      stats.rollingAverage = currentScore;
    } else {
      stats.rollingAverage = (stats.rollingAverage * 0.7) + (currentScore * 0.3);
    }
  });

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch (error) {
    console.error("Failed to write skill profile to localStorage", error);
  }
  
  return profile;
};

export const getRelativeWeakness = (profile) => {
  const domains = [
    { name: "speed", label: "Processing Speed", average: profile.speed.rollingAverage },
    { name: "memory", label: "Working Memory", average: profile.memory.rollingAverage },
    { name: "stroop", label: "Interference Control", average: profile.stroop.rollingAverage },
    { name: "spatial", label: "Spatial Memory", average: profile.spatial.rollingAverage },
  ];

  // Filter out domains with no sessions yet
  const validDomains = domains.filter(d => d.average !== null);
  
  if (validDomains.length < 4) return null; // Wait until they have done a full scan at least once

  validDomains.sort((a, b) => a.average - b.average);
  
  // Return the lowest scoring domain.
  // Note: This is relative to self, not a percentile claim.
  return validDomains[0];
};

export function useSkillProfile() {
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    setProfile(getSkillProfile());
  }, []);

  return profile;
}
