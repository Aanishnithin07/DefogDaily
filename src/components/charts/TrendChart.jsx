import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DOMAINS } from "../../lib/domains";
import { ACCENT } from "../ui";

/** Session-over-session trend lines, one per selected domain. */
export default function TrendChart({ data, series, height = 300 }) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(245,248,255,0.06)" vertical={false} />
          <XAxis
            dataKey="label"
            stroke="#64708C"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            minTickGap={18}
          />
          <YAxis
            stroke="#64708C"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            domain={[0, 100]}
            width={44}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "rgba(18,24,39,0.96)",
              border: "1px solid rgba(245,248,255,0.1)",
              borderRadius: "14px",
              backdropFilter: "blur(12px)",
            }}
            itemStyle={{ fontFamily: "JetBrains Mono", fontSize: "12px" }}
            labelStyle={{ color: "#9AA7C2", marginBottom: "6px", fontSize: "12px" }}
          />
          <Legend
            wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
            iconType="circle"
            iconSize={7}
          />
          {series.map((key) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              name={DOMAINS[key]?.short ?? key}
              stroke={(ACCENT[DOMAINS[key]?.accent] ?? ACCENT.cyan).hex}
              strokeWidth={2.25}
              dot={{ r: 2.5, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
