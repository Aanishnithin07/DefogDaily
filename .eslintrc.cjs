/**
 * Deliberately narrow: this config exists to catch the two bug classes that
 * a Vite build happily ships and only blow up at runtime —
 *   1. referencing an identifier that was never imported (no-undef)
 *   2. calling a hook conditionally (react-hooks/rules-of-hooks)
 * Stylistic rules are left off on purpose so `npm run lint` stays a signal
 * rather than noise.
 */
module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  extends: ["eslint:recommended", "plugin:react/jsx-runtime"],
  parserOptions: { ecmaVersion: "latest", sourceType: "module", ecmaFeatures: { jsx: true } },
  settings: { react: { version: "detect" } },
  plugins: ["react", "react-hooks"],
  ignorePatterns: ["dist", "node_modules"],
  rules: {
    // Without this, every component and icon used only inside JSX reads as
    // unused and buries the real no-undef errors in noise.
    "react/jsx-uses-vars": "error",
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn",
    "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    "no-empty": ["error", { allowEmptyCatch: true }],
  },
};
