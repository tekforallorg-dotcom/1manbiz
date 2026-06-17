/**
 * @1manbiz/design
 *
 * Design tokens consumed by Tailwind (apps/web) and NativeWind (apps/mobile).
 * Source of truth for colours, typography, spacing, radii.
 */

export const colors = {
  brand: {
    primary: "#15803D",
    soft: "#F0FCF7",
    dark: "#00B85F",
  },
  foreground: "#0A0A0A",
  background: "#FFFFFF",
  surfaceMuted: "#F4F7F5",
  textMuted: "#6B6B6B",
  textSecondary: "#3A3A3A",
  // Flat aliases for mobile NativeWind classNames (added by MOB-DESIGN-1).
  // Web continues to use brand.* and foreground via Tailwind v4 CSS config.
  primary: "#15803D",
  primarySoft: "#F0FCF7",
  text: "#0A0A0A",
  border: "#E5E7EB",
  borderStrong: "#D1D5DB",
  danger: "#DC2626",
  dangerSoft: "#FEE2E2",
  warn: "#D97706",
  warnSoft: "#FEF3C7",
  success: "#16A34A",
  successSoft: "#F0FCF7",
} as const;

export const typography = {
  fontSans: "Geist, system-ui, sans-serif",
  fontMono: "Geist Mono, ui-monospace, monospace",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  "2xl": 48,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;
