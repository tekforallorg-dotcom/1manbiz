import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // React renders bare apostrophes/quotes in JSX text just fine at runtime.
      // The HTML-style escapes the rule wants make our source noisier without
      // any user-visible benefit. Off-by-policy.
      "react/no-unescaped-entities": "off",
    },
  },
];

export default eslintConfig;