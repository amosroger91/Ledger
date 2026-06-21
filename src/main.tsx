import React from "react";
import ReactDOM from "react-dom/client";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { HashRouter } from "react-router-dom";
import { theme } from "@/theme/theme";
import "@/bliss.css";   // the Bliss / XP "Luna" design system (tokens + components)
import "@/bliss.js";    // Bliss behavior layer (window.Bliss); harmless for our MUI tree
import App from "@/App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <HashRouter>
        <App />
      </HashRouter>
    </ThemeProvider>
  </React.StrictMode>,
);

// dismiss the boot splash once React has painted
requestAnimationFrame(() => {
  const boot = document.getElementById("boot");
  if (boot) { boot.style.opacity = "0"; setTimeout(() => boot.remove(), 500); }
});
