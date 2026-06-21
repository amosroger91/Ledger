import { createTheme, alpha } from "@mui/material/styles";

// ============================================================
//  Aurora design system — a Vista/Aero glass language: frosted
//  translucent chrome over flowing aurora gradients, lit from
//  within. Tokens mirror design-langauge-files/aurora.
// ============================================================
export const AURORA = {
  night0: "#05080f",
  night1: "#0a0f1a",
  night2: "#111a2b",
  ink: "#eef4ff",
  inkDim: "#b6c6dc",
  accent: "#3a9bf0",
  accentBright: "#9fd0ff",
  accentDeep: "#0b3a66",
  ok: "#54c95a",
  warn: "#f0a93a",
  danger: "#ef5f63",
  // aurora gradient ribbon
  aur1: "#39c6f5", aur2: "#3a7bf0", aur3: "#36e0c4", aur4: "#5a9bff",
};

const glassBg = "rgba(255,255,255,0.08)";
// the signature Aero glass: specular top lip + soft inner shade + deep shadow
const glassInner = "inset 0 1px 0 rgba(255,255,255,0.55), inset 0 -34px 54px rgba(0,0,0,0.28)";
const glassShadow = "0 24px 60px rgba(0,0,0,0.50), 0 4px 14px rgba(0,0,0,0.34)";

const UI = '"Open Sans", "Segoe UI", system-ui, -apple-system, sans-serif';
const DISPLAY = '"Segoe UI", "Open Sans", system-ui, sans-serif';

export const theme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: AURORA.accent, light: AURORA.accentBright, dark: AURORA.accentDeep },
    secondary: { main: AURORA.aur3 },
    error: { main: AURORA.danger },
    warning: { main: AURORA.warn },
    success: { main: AURORA.ok },
    info: { main: AURORA.accent },
    background: { default: AURORA.night0, paper: glassBg },
    text: { primary: AURORA.ink, secondary: AURORA.inkDim },
    divider: "rgba(255,255,255,0.12)",
  },
  shape: { borderRadius: 14 },
  typography: {
    fontFamily: UI,
    h1: { fontFamily: DISPLAY, fontWeight: 700, letterSpacing: "-0.01em" },
    h2: { fontFamily: DISPLAY, fontWeight: 700 },
    h3: { fontFamily: DISPLAY, fontWeight: 700 },
    h4: { fontFamily: DISPLAY, fontWeight: 600 },
    h5: { fontFamily: DISPLAY, fontWeight: 600 },
    h6: { fontFamily: DISPLAY, fontWeight: 600, letterSpacing: "0.01em" },
    button: { fontWeight: 600, letterSpacing: "0.01em", textTransform: "none" },
    overline: { letterSpacing: "0.14em" },
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          backgroundColor: glassBg,
          backdropFilter: "blur(18px) saturate(1.35)",
          WebkitBackdropFilter: "blur(18px) saturate(1.35)",
          border: "1px solid rgba(255,255,255,0.14)",
          boxShadow: glassInner,
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 999, paddingInline: 18 },
        containedPrimary: {
          color: "#031426",
          backgroundImage: `linear-gradient(180deg, ${AURORA.accentBright}, ${AURORA.accent})`,
          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.6), 0 6px 18px ${alpha(AURORA.accent, 0.45)}`,
          "&:hover": { backgroundImage: `linear-gradient(180deg, #c2e4ff, ${AURORA.accent})` },
        },
        outlined: { borderColor: "rgba(255,255,255,0.25)", backdropFilter: "blur(8px)" },
      },
    },
    MuiChip: { styleOverrides: { root: { borderRadius: 999, fontWeight: 600, backdropFilter: "blur(6px)" } } },
    MuiTooltip: { styleOverrides: { tooltip: { background: alpha(AURORA.night2, 0.96), border: "1px solid rgba(255,255,255,0.18)", backdropFilter: "blur(8px)" } } },
    MuiCssBaseline: {
      styleOverrides: {
        "*::-webkit-scrollbar": { width: 10, height: 10 },
        "*::-webkit-scrollbar-thumb": { background: alpha(AURORA.accent, 0.3), borderRadius: 8 },
        "*::-webkit-scrollbar-track": { background: "transparent" },
      },
    },
  },
});

// Back-compat export (older components referenced NEON.*)
export const NEON = { cyan: AURORA.aur1, violet: AURORA.aur2, magenta: AURORA.aur3 };
// The brand gradient ribbon used for wordmarks / accents.
export const AURORA_RIBBON = `linear-gradient(90deg, ${AURORA.aur1}, ${AURORA.aur2}, ${AURORA.aur3})`;
