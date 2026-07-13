import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { fetchUserHistory } from "../lib/firestore";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { motion } from "framer-motion";
import { defogReveal, useReducedMotionVariant } from "../lib/motion";

export default function HistoryDashboard({ onBack }) {
  const { currentUser, logout, isConfigured } = useAuth();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const containerVariant = useReducedMotionVariant(defogReveal);

  useEffect(() => {
    if (currentUser) {
      fetchUserHistory(currentUser.uid).then((data) => {
        // Format data for chart
        const formatted = data.map((d, i) => {
          return {
            name: `Scan ${i + 1}`,
            Speed: d.normalizedScores?.speed || 0,
            Memory: d.normalizedScores?.memory || 0,
            Spatial: d.normalizedScores?.spatial || 0,
            date: d.timestamp ? new Date(d.timestamp.toMillis()).toLocaleDateString() : "Recent"
          };
        });
        setHistory(formatted);
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, [currentUser]);

  if (!currentUser) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-center">
        <h2 className="text-2xl font-display font-bold text-text-primary mb-4">No Data Available</h2>
        <p className="text-text-secondary mb-8">You need to sign in to view your history.</p>
        <button
          onClick={onBack}
          className="px-6 py-3 rounded-2xl-soft bg-bg-elevated text-text-primary border border-white/10 hover:border-accent-cyan/50 transition-colors"
        >
          Return to Home
        </button>
      </div>
    );
  }

  return (
    <motion.div
      variants={containerVariant}
      initial="hidden"
      animate="visible"
      className="flex h-full w-full max-w-4xl flex-col p-6 mx-auto"
    >
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-text-primary">Your History</h1>
          <p className="text-text-secondary">Tracking your cognitive baseline over time.</p>
        </div>
        <div className="flex gap-4">
          <button
            onClick={onBack}
            className="px-4 py-2 rounded-xl-soft bg-bg-elevated text-text-primary border border-white/10 hover:border-white/30 transition-colors text-sm"
          >
            Back
          </button>
          <button
            onClick={logout}
            className="px-4 py-2 rounded-xl-soft bg-bg-elevated text-danger border border-white/10 hover:border-danger/30 transition-colors text-sm"
          >
            Sign Out
          </button>
        </div>
      </header>

      {!isConfigured && (
        <div className="bg-bg-elevated border border-danger/50 rounded-2xl-soft p-4 mb-6 text-sm text-text-primary">
          Backend is not configured. Add Firebase keys to your environment to save true history.
        </div>
      )}

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-accent-cyan animate-spin" />
        </div>
      ) : history.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center bg-bg-elevated rounded-3xl-soft border border-white/5">
          <p className="text-text-secondary">No scans recorded yet. Take your first test!</p>
        </div>
      ) : (
        <div className="flex-1 bg-bg-elevated rounded-3xl-soft border border-white/5 p-6 shadow-2xl relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-accent-cyan/5 to-accent-violet/5 pointer-events-none" />
          
          <h3 className="text-xl font-display font-bold text-text-primary mb-6">Performance Trends</h3>
          
          <div className="w-full h-64 md:h-96">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                <XAxis dataKey="name" stroke="#9AA7C2" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#9AA7C2" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
                <Tooltip 
                  contentStyle={{ backgroundColor: "#121827", borderColor: "#ffffff10", borderRadius: "12px" }}
                  itemStyle={{ fontFamily: "JetBrains Mono", fontSize: "14px" }}
                  labelStyle={{ color: "#9AA7C2", marginBottom: "8px" }}
                />
                <Line type="monotone" dataKey="Speed" stroke="#3ED9D5" strokeWidth={3} dot={{ r: 4, fill: "#0B0E14", strokeWidth: 2 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="Memory" stroke="#8A7BFF" strokeWidth={3} dot={{ r: 4, fill: "#0B0E14", strokeWidth: 2 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="Spatial" stroke="#F5F8FF" strokeWidth={3} dot={{ r: 4, fill: "#0B0E14", strokeWidth: 2 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </motion.div>
  );
}
