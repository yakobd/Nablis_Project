/** @type {import("eslint").Linter.Config} */
module.exports = {
  extends: ["turbo", "prettier"],
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint", "react", "react-native"],
  rules: {
    "no-console": "warn",
    "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    "react-native/no-unused-styles": "warn",
    "react-native/no-inline-styles": "warn",
  },
};
