import { useEffect, useRef, useState } from "react";
import { Box, Typography, Tooltip, IconButton } from "@mui/material";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import GlassCard from "@/components/common/GlassCard";
import { companionService } from "@/services/companionService";
import { useStore } from "@/store/useStore";
import { bus } from "@/lib/events";

// Replaces the old static "how this feed works" blurb with a LIVE intro the
// on-device Companion writes itself, streamed token-by-token (with a blinking
// cursor) so it's obviously coming from the model. If the model isn't loaded yet
// it types a fallback, then regenerates for real once the model is ready.
export default function CompanionIntro() {
  const me = useStore((s) => s.me);
  const name = me?.username ? me.username.trim().split(/\s+/)[0] : "there";
  const [text, setText] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [live, setLive] = useState(false);   // text came from the LLM (vs typed fallback)
  const ranLive = useRef(false);
  const typer = useRef<ReturnType<typeof setInterval> | null>(null);

  const fallback =
    `Hey ${name}! 👋 I'm your Companion — a private AI that runs right here in your browser, so nothing you say ever leaves your device. ` +
    `I can make sense of your feed, help you draft or sharpen posts, look things up on the web, and explain how Ledgr works. ` +
    `Tap the ✨ button in the bottom-right (or "Ask AI") to chat with me, and tap the insights icon on any post to see why it surfaced. 🙂`;

  function typeOut(full: string) {
    if (typer.current) clearInterval(typer.current);
    setStreaming(true);
    setText("");
    let i = 0;
    typer.current = setInterval(() => {
      i += 2;
      setText(full.slice(0, i));
      if (i >= full.length) { if (typer.current) clearInterval(typer.current); setStreaming(false); }
    }, 16);
  }

  async function generate() {
    if (typer.current) clearInterval(typer.current);
    if (companionService.modelReady()) {
      ranLive.current = true;
      setLive(true);
      setStreaming(true);
      setText("");
      const out = await companionService.streamIntro((t) => setText(t));
      setStreaming(false);
      if (!out) { setLive(false); typeOut(fallback); }   // model bailed mid-stream → typed fallback
    } else {
      setLive(false);
      typeOut(fallback);
    }
  }

  useEffect(() => {
    generate();
    // If the model is still downloading, upgrade the typed fallback to a real
    // live LLM intro the moment it's ready.
    const off = bus.on("companion:model", (m) => { if (m.state === "ready" && !ranLive.current) generate(); });
    return () => { off(); if (typer.current) clearInterval(typer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <GlassCard sx={{ mt: "20px" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 0.75 }}>
        <AutoAwesomeRoundedIcon sx={{ fontSize: 16, color: "var(--bl-accent)" }} />
        <Typography variant="overline" color="text.secondary" sx={{ flex: 1, lineHeight: 1 }}>Your Companion</Typography>
        <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.4, fontSize: 10, fontWeight: 700, color: live ? "#54c95a" : "text.disabled" }}>
          <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: live ? "#54c95a" : "currentColor" }} />
          {live ? "live · on-device" : "on-device"}
        </Box>
        <Tooltip title="Regenerate">
          <span>
            <IconButton size="small" disabled={streaming} onClick={generate} sx={{ ml: 0.25 }} aria-label="Regenerate intro">
              <RefreshRoundedIcon sx={{ fontSize: 15 }} />
            </IconButton>
          </span>
        </Tooltip>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "pre-wrap", minHeight: 96 }}>
        {text}
        {streaming && (
          <Box component="span" sx={{ display: "inline-block", width: "7px", height: "1.05em", ml: "1px", bgcolor: "var(--bl-accent)", verticalAlign: "text-bottom", animation: "introblink 1s step-end infinite", "@keyframes introblink": { "50%": { opacity: 0 } } }} />
        )}
      </Typography>
    </GlassCard>
  );
}
