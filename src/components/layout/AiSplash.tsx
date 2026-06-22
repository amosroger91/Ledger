// ============================================================
//  AiSplash — a full-screen launch overlay shown while the on-device
//  AI model downloads, dismissed once it crosses 30%. It self-gates:
//  it only ever appears when a download is actually going to happen
//  (WebGPU present, the user hasn't opted out, model not already
//  loaded), and it has hard safety valves (grace delay, max timeout,
//  Skip button) so it can never permanently block the app — which is
//  fully usable without the AI.
// ============================================================
import { useEffect, useRef, useState } from "react";
import { Box, Typography, LinearProgress, Button } from "@mui/material";
import { bus } from "@/lib/events";
import { companionService, isWebGPU } from "@/services/companionService";
import { readSettingsSync } from "@/services/storage";

const GATE = 0.3;            // dismiss once the model is 30% downloaded
const SHOW_DELAY = 500;      // grace window — skip the flash on instant cache loads
const SAFETY_MS = 30_000;    // never trap the user if the download stalls / never reports

export default function AiSplash() {
  // Decide synchronously whether a download will even happen. If not, this
  // component renders nothing and never blocks anything.
  const gate = useRef<boolean>(
    isWebGPU() && !(readSettingsSync()?.llmOptOut ?? false) && !companionService.modelReady(),
  );
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [canSkip, setCanSkip] = useState(false);
  const done = useRef(false);

  useEffect(() => {
    if (!gate.current) return;

    const finish = () => {
      if (done.current) return;
      done.current = true;
      setLeaving(true);                                  // fade out, then unmount
      window.setTimeout(() => setVisible(false), 450);
    };

    // Already loaded in the gap between render and effect → never show.
    if (companionService.modelReady()) { finish(); return; }

    const showTimer = window.setTimeout(() => { if (!done.current) setVisible(true); }, SHOW_DELAY);
    const skipTimer = window.setTimeout(() => setCanSkip(true), SHOW_DELAY + 2500);
    const safety = window.setTimeout(finish, SAFETY_MS);

    const off = bus.on("companion:model", (m: any) => {
      if (typeof m.progress === "number") setProgress(m.progress);
      if (m.state === "ready" || m.state === "error") return finish();
      if ((m.progress ?? 0) >= GATE) finish();           // hit the 30% gate → reveal the app
    });

    return () => { off(); clearTimeout(showTimer); clearTimeout(skipTimer); clearTimeout(safety); };
  }, []);

  if (!gate.current || !visible) return null;

  const pct = Math.round(progress * 100);

  return (
    <Box
      sx={{
        position: "fixed", inset: 0, zIndex: 2000,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
        color: "#fff", textAlign: "center", px: 3,
        background: "linear-gradient(135deg,#0a55cf,#1668e0,#3f97ff)",
        opacity: leaving ? 0 : 1, transition: "opacity .45s ease", pointerEvents: leaving ? "none" : "auto",
      }}
    >
      <Box
        component="img" src={`${import.meta.env.BASE_URL}logo.png`} alt="Ledger"
        sx={{
          width: 88, height: 88, borderRadius: "22px", boxShadow: "0 0 40px rgba(255,255,255,.45)",
          animation: "aiPulse 1.6s ease-in-out infinite",
          "@keyframes aiPulse": {
            "0%,100%": { transform: "scale(1)", opacity: 0.92 },
            "50%": { transform: "scale(1.08)", opacity: 1 },
          },
        }}
      />
      <Box>
        <Typography sx={{ fontWeight: 800, fontSize: 22, lineHeight: 1.2 }}>Waking up your AI…</Typography>
        <Typography variant="caption" sx={{ opacity: 0.85 }}>
          A private language model is downloading to your device — it's cached after the first time.
        </Typography>
      </Box>
      <Box sx={{ width: "min(86vw, 340px)" }}>
        <LinearProgress
          variant={progress > 0 ? "determinate" : "indeterminate"}
          value={pct}
          sx={{
            height: 8, borderRadius: 4, bgcolor: "rgba(255,255,255,0.25)",
            "& .MuiLinearProgress-bar": { bgcolor: "#fff" },
          }}
        />
        <Typography variant="caption" sx={{ display: "block", mt: 0.75, fontWeight: 700, opacity: 0.95 }}>
          {progress > 0 ? `${pct}%` : "starting…"}
        </Typography>
      </Box>
      <Button
        size="small" onClick={() => { done.current = true; setLeaving(true); window.setTimeout(() => setVisible(false), 450); }}
        sx={{ mt: 1, color: "#fff", opacity: canSkip ? 0.8 : 0, transition: "opacity .3s ease", pointerEvents: canSkip ? "auto" : "none", textTransform: "none", "&:hover": { opacity: 1, bgcolor: "rgba(255,255,255,0.12)" } }}
      >
        Skip — use the app now
      </Button>
    </Box>
  );
}
