// Simple seeded PRNG (Mulberry32)
export function mulberry32(a) {
  return function() {
    var t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

// Generate a numeric seed from a string
export function xmur3(str) {
  for(var i = 0, h = 1779033703 ^ str.length; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = h << 13 | h >>> 19;
  }
  return function() {
    h = Math.imul(h ^ h >>> 16, 2246822507);
    h = Math.imul(h ^ h >>> 13, 3266489909);
    return (h ^= h >>> 16) >>> 0;
  }
}

let currentPRNG = null;
let currentMode = "practice";

export function initializeRandomizer(mode) {
  currentMode = mode;
  if (mode === "daily") {
    // Generate a seed based on the current local date (YYYY-MM-DD)
    const today = new Date();
    const dateString = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
    const seed = xmur3(dateString)();
    currentPRNG = mulberry32(seed);
  } else {
    currentPRNG = null; // Fallback to Math.random
  }
}

// Drop-in replacement for Math.random()
export function getRandom() {
  if (currentMode === "daily" && currentPRNG) {
    return currentPRNG();
  }
  return Math.random();
}

// Utility to shuffle an array using the current randomizer
export function shuffleArray(array) {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(getRandom() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}
