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

let currentMode = "practice";
let dailySeedString = null;
const streams = new Map();
let activeStream = null;

/**
 * Build the calendar-day seed.
 *
 * Zero-padded so 2026-1-2 and 2026-12-0... cannot collide, and taken from the
 * user's local calendar date deliberately: "today's puzzle" should match the
 * day you are actually living in, not UTC.
 */
const todaySeedString = (now = new Date()) =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;

export function initializeRandomizer(mode) {
  currentMode = mode;
  streams.clear();
  activeStream = null;
  dailySeedString = mode === "daily" ? todaySeedString() : null;
}

/**
 * Select the stream a game will draw from.
 *
 * Daily mode previously ran every game off ONE sequential stream, so how many
 * trials you answered in game 1 decided which words and patterns you got in
 * games 2-4. Two people doing the same "daily challenge" therefore faced
 * different puzzles, which is precisely what a shared daily seed is supposed to
 * prevent. Each game now draws from its own stream, seeded from the date plus
 * the game's name, so a game's sequence depends only on the calendar day.
 *
 * @param {string} name domain key, e.g. "speed"
 * @param {number} attempt bumped on a redo so a repeat is not identical
 */
export function selectStream(name, attempt = 0) {
  if (currentMode !== "daily" || !dailySeedString) {
    activeStream = null;
    return;
  }
  const key = `${name}#${attempt}`;
  if (!streams.has(key)) {
    streams.set(key, mulberry32(xmur3(`${dailySeedString}:${key}`)()));
  }
  activeStream = streams.get(key);
}

/** Drop-in replacement for Math.random(). */
export function getRandom() {
  if (currentMode === "daily" && activeStream) return activeStream();
  return Math.random();
}

/** Exposed for tests and for showing the user which day's puzzle they are on. */
export const currentDailySeed = () => dailySeedString;

// Utility to shuffle an array using the current randomizer
export function shuffleArray(array) {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(getRandom() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}
