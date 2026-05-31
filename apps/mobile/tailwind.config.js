const { colors, spacing, radii } = require("@1manbiz/design");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        brand: colors.brand,
        foreground: colors.foreground,
        background: colors.background,
        "surface-muted": colors.surfaceMuted,
        "text-muted": colors.textMuted,
        "text-secondary": colors.textSecondary,
      },
      spacing,
      borderRadius: radii,
    },
  },
  plugins: [],
};
