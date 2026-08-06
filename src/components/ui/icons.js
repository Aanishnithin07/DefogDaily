/**
 * Domain and achievement icons resolve from string names stored in the data
 * layer, so the registries stay plain data with no React imports.
 */
import {
  Award,
  Brain,
  CalendarCheck,
  Dumbbell,
  Flame,
  Focus,
  Grid3X3,
  Hand,
  Layers,
  ListOrdered,
  Moon,
  Scale,
  Shuffle,
  Sparkles,
  Sun,
  Sunrise,
  Target,
  TrendingUp,
  Trophy,
  Zap,
} from "lucide-react";

const ICONS = {
  Award,
  Brain,
  CalendarCheck,
  Dumbbell,
  Flame,
  Focus,
  Grid3X3,
  Hand,
  Layers,
  ListOrdered,
  Moon,
  Scale,
  Shuffle,
  Sparkles,
  Sun,
  Sunrise,
  Target,
  TrendingUp,
  Trophy,
  Zap,
};

export const iconFor = (name) => ICONS[name] ?? Brain;
export default ICONS;
