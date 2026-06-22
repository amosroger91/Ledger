import { createTheme, alpha } from "@mui/material/styles";

// ============================================================
//  Bliss / Windows XP "Luna" — fully adopted. Light, warm, glossy
//  chrome on the #ece9d8 control face, Luna-blue accents, the
//  raised 3D button, Tahoma/Trebuchet faces. Mirrors bliss.css
//  tokens (see src/bliss.css).
// ============================================================
export const BL = {
  blue400: "#3f97ff", blue500: "#1668e0", blue600: "#0a55cf", blue700: "#0a4ec4", blue800: "#003db5",
  green500: "#4ca325",
  white: "#ffffff", panel: "#fbfaf4", raised: "#f6f4ec", face: "#ece9d8", faceDark: "#dcd8c4",
  edge: "#919b9c", line: "#d6d2bf", sunk: "#7f9db9",
  ink: "#1b2733", inkDim: "#51606e", inkFaint: "#8a96a2",
  ok: "#3ba33b", info: "#2a72e0", warn: "#e8920c", danger: "#d23b2f", tip: "#ffffe1",
};

const UI = '"Tahoma", "Segoe UI", Verdana, Geneva, system-ui, sans-serif';
const TITLE = '"Trebuchet MS", "Segoe UI", Tahoma, system-ui, sans-serif';

// The signature Luna button gloss.
const sheen = "linear-gradient(180deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.04) 46%, rgba(0,0,0,0.06) 54%, rgba(0,0,0,0.18) 100%)";

export const theme = createTheme({
  breakpoints: {
    values: {
      xs: 0,
      sm: 640,   // mobile portrait / tablet boundary
      md: 1024,  // tablet / desktop boundary
      lg: 1280,
      xl: 1920,
    },
  },
  palette: {
    mode: "light",
    primary: { main: BL.blue500, light: BL.blue400, dark: BL.blue700, contrastText: "#fff" },
    secondary: { main: BL.green500 },
    error: { main: BL.danger }, warning: { main: BL.warn }, success: { main: BL.ok }, info: { main: BL.info },
    background: { default: "#d8e7fb", paper: BL.panel },  // valid color; the .bl-bliss wallpaper covers it
    text: { primary: BL.ink, secondary: BL.inkDim },
    divider: BL.line,
  },
  shape: { borderRadius: 4 },
  typography: {
    fontFamily: UI,
    fontSize: 13,
    h1: { fontFamily: TITLE, fontWeight: 700, fontSize: "clamp(1.5rem, 5vw, 2.5rem)" },
    h2: { fontFamily: TITLE, fontWeight: 700, fontSize: "clamp(1.2rem, 4vw, 2rem)" },
    h3: { fontFamily: TITLE, fontWeight: 700, fontSize: "clamp(1rem, 3vw, 1.5rem)" },
    h4: { fontFamily: TITLE, fontWeight: 700 },
    h5: { fontFamily: TITLE, fontWeight: 700 },
    h6: { fontFamily: TITLE, fontWeight: 700, fontSize: "clamp(0.875rem, 2.5vw, 1.1rem)" },
    body1: { fontSize: "clamp(0.8rem, 1vw, 1rem)" },
    body2: { fontSize: "clamp(0.75rem, 0.9vw, 0.9375rem)" },
    button: { textTransform: "none", fontWeight: 700 },
    overline: { letterSpacing: "0.08em", fontWeight: 700, color: BL.inkDim },
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          backgroundColor: BL.panel,
          border: `1px solid ${BL.line}`,
          boxShadow: "inset 0 1px 0 #fff, 0 1px 2px rgba(0,0,0,0.12)",
          backdropFilter: "none",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 3,
          border: `1px solid ${BL.edge}`,
          backgroundColor: BL.raised,
          backgroundImage: sheen,
          color: BL.ink,
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.7)",
          "&:hover": { backgroundColor: "#fdfdfb", borderColor: BL.blue500 },
        },
        containedPrimary: {
          color: "#fff",
          border: `1px solid ${BL.blue800}`,
          backgroundColor: BL.blue500,
          backgroundImage: `${sheen}, linear-gradient(180deg, ${BL.blue400}, ${BL.blue600})`,
          textShadow: "0 1px 1px rgba(0,0,0,0.35)",
          "&:hover": { backgroundImage: `${sheen}, linear-gradient(180deg, #5aa8ff, ${BL.blue600})`, borderColor: BL.blue800 },
        },
        outlined: { backgroundImage: "none", backgroundColor: BL.raised },
        text: { backgroundImage: "none", backgroundColor: "transparent", border: "1px solid transparent", boxShadow: "none", "&:hover": { backgroundColor: alpha(BL.blue500, 0.08), borderColor: "transparent" } },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 3, fontWeight: 600, backgroundColor: BL.raised, border: `1px solid ${BL.line}` },
        outlined: { backgroundColor: BL.white },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 2, backgroundColor: BL.white,
          "& fieldset": { borderColor: BL.sunk },
          "&:hover fieldset": { borderColor: BL.blue500 },
          "&.Mui-focused fieldset": { borderColor: BL.blue500, borderWidth: 1 },
        },
        input: { boxShadow: "inset 0 1px 1px rgba(0,0,0,0.12)" },
      },
    },
    MuiToggleButton: {
      styleOverrides: { root: { borderRadius: 3, textTransform: "none", color: BL.inkDim } },
    },
    MuiTooltip: {
      styleOverrides: { tooltip: { backgroundColor: BL.tip, color: BL.ink, border: `1px solid ${BL.edge}`, fontSize: 12, boxShadow: "0 2px 6px rgba(0,0,0,0.3)" }, arrow: { color: BL.tip } },
    },
    MuiAvatar: { styleOverrides: { root: { border: "1px solid rgba(0,0,0,0.18)" } } },
    MuiDivider: { styleOverrides: { root: { borderColor: BL.line } } },
  },
});

// Luna-blue title gloss for window/title bars.
export const TITLE_GLOSS = `linear-gradient(180deg, ${BL.blue400} 0%, ${BL.blue500} 48%, ${BL.blue600} 100%)`;
export const NEON = { cyan: BL.blue400, violet: BL.blue500, magenta: BL.blue600 }; // back-compat
