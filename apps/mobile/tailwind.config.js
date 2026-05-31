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
        // camelCase + flat aliases for mobile usage (MOB-DESIGN-1)
        text: colors.text,
        textMuted: colors.textMuted,
        primary: colors.primary,
        primarySoft: colors.primarySoft,
        border: colors.border,
        borderStrong: colors.borderStrong,
        danger: colors.danger,
        dangerSoft: colors.dangerSoft,
        warn: colors.warn,
        warnSoft: colors.warnSoft,
        success: colors.success,
        successSoft: colors.successSoft,
      },
      spacing,
      borderRadius: radii,
    },
  },
  plugins: [],
};
