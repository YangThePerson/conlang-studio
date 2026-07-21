import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Server Action / useActionState signatures require positional params
      // (e.g. `prevState`, `formData`) that some adapters don't use — the
      // `_` prefix is this codebase's convention for "intentionally unused".
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_" },
      ],
    },
  },
  {
    // Playwright fixtures (e2e/fixtures.ts) take a `use` callback param per
    // Playwright's own API — react-hooks/rules-of-hooks misreads that as the
    // React 19 `use()` hook. This directory has no React in it.
    files: ["e2e/**"],
    rules: {
      "react-hooks/rules-of-hooks": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
