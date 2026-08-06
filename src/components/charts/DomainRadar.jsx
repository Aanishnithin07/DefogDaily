import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";

/**
 * The profile radar. Two series where history allows: your current scan in
 * cyan over your rolling average in violet, so improvement is visible as the
 * cyan shape pushing outside the violet one.
 */
export default function DomainRadar({ data, showBaseline = false, height = 300 }) {
  return (
    <div style={{ height }} className="w-full">
      <svg width="0" height="0" aria-hidden="true">
        <defs>
          <filter id="radar-glow">
            <feGaussianBlur stdDeviation="3.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      </svg>

      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="72%" data={data}>
          <PolarGrid stroke="rgba(245,248,255,0.09)" />
          <PolarAngleAxis
            dataKey="label"
            tick={{ fill: "#9AA7C2", fontSize: 11, fontFamily: "Inter" }}
          />
          <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
          {showBaseline && (
            <Radar
              name="Your average"
              dataKey="baseline"
              stroke="#8A7BFF"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              fill="#8A7BFF"
              fillOpacity={0.1}
            />
          )}
          <Radar
            name="This scan"
            dataKey="value"
            stroke="#3ED9D5"
            strokeWidth={2.5}
            fill="#3ED9D5"
            fillOpacity={0.18}
            style={{ filter: "url(#radar-glow)" }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
