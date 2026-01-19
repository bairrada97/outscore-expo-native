import tsParser from "@typescript-eslint/parser";
import { customRules } from "./custom-rules.js";

export default [
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    rules: {
      "max-lines": ["warn", { max: 200, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    files: ["components/**/*.{ts,tsx}"],
    plugins: {
      "custom-rules": customRules,
    },
    rules: {
      "custom-rules/max-file-lines": "warn",
    },
  },
];
