import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Split the heavyweight vendors so the first paint only pays for React and
    // the motion layer. Charts and Firebase are behind dynamic imports and land
    // in their own chunks, fetched only when a user actually reaches them.
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
          motion: ["framer-motion"],
        },
      },
    },
    chunkSizeWarningLimit: 700,
  },
});
