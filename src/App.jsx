import { Component, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Landing from "./Landing";
import GameEngine from "./GameEngine";
import HistoryDashboard from "./components/HistoryDashboard";
import { AuthProvider } from "./context/AuthContext";

class RootErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Root error caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-bg-base p-6 text-center font-body text-text-primary">
          <div className="rounded-3xl-soft border border-white/10 bg-bg-elevated p-8 max-w-md">
            <h1 className="mb-4 font-display text-2xl text-text-primary">Something went wrong.</h1>
            <p className="text-text-secondary mb-6 text-sm">
              We encountered an unexpected error. Please refresh the page to try again.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="min-h-11 rounded-2xl-soft bg-accent-cyan px-6 py-2 font-medium text-bg-base transition hover:opacity-90"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  const [currentView, setCurrentView] = useState("landing");

  return (
    <AuthProvider>
      <RootErrorBoundary>
        <AnimatePresence mode="wait">
          {currentView === "landing" && (
            <motion.div
              key="landing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
            >
              <Landing onStartScan={() => setCurrentView("game")} />
            </motion.div>
          )}
          {currentView === "game" && (
            <motion.div
              key="game-engine"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4, ease: "easeInOut" }}
              className="min-h-screen"
            >
              <GameEngine 
                onResetToLanding={() => setCurrentView("landing")} 
                onViewHistory={() => setCurrentView("history")}
              />
            </motion.div>
          )}
          {currentView === "history" && (
            <motion.div
              key="history"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4, ease: "easeInOut" }}
              className="min-h-screen"
            >
              <HistoryDashboard onBack={() => setCurrentView("landing")} />
            </motion.div>
          )}
        </AnimatePresence>
      </RootErrorBoundary>
    </AuthProvider>
  );
}

export default App;
