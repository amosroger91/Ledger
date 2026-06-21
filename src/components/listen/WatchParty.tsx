import { useEffect, useState } from "react";
import { Box, Stack, TextField, Button, Chip, Typography } from "@mui/material";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import GlassCard from "@/components/common/GlassCard";
import { peerService } from "@/services/peerService";
import { profileService } from "@/services/profileService";
import { bus, toast } from "@/lib/events";
import { useStore } from "@/store/useStore";
import { fingerprint } from "@/lib/crypto";
import type { WatchPartyState } from "@/types";

function youtubeId(input: string): string | null {
  const s = input.trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  const m = s.match(/[?&]v=([\w-]{11})/) || s.match(/youtu\.be\/([\w-]{11})/) || s.match(/youtube\.com\/(?:embed|shorts|live)\/([\w-]{11})/);
  return m ? m[1] : null;
}

/** The Listen page's watch-party controls. The actual player is the global
 *  GlobalWatchPlayer, which docks into #watch-dock below and keeps playing when
 *  you navigate away. */
export default function WatchParty() {
  const me = useStore((s) => s.me);
  const [input, setInput] = useState("");
  const [stage, setStage] = useState<WatchPartyState | null>(peerService.currentStage());

  useEffect(() => {
    const off = bus.on("stage:in", setStage);
    const off2 = bus.on("watch:start", () => setTimeout(() => setStage(peerService.currentStage()), 50));
    return () => { off(); off2(); };
  }, []);

  function start() {
    const id = youtubeId(input);
    if (!id) { toast("Paste a valid YouTube link", "warn"); return; }
    setInput("");
    bus.emit("watch:start", { videoId: id });
  }

  const active = !!stage?.videoId;
  const startedBy = stage?.by === me?.publicKey ? "you" : (stage?.byName || profileService.get(stage?.by ?? "")?.username || fingerprint(stage?.by ?? ""));

  return (
    <>
      <GlassCard sx={{ mb: 2 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
          <TextField fullWidth size="small" value={input} placeholder="Paste a YouTube link to start (or change) the party…" onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && start()} />
          <Button variant="contained" startIcon={<PlayArrowRoundedIcon />} onClick={start}>Watch together</Button>
        </Stack>
        {active && (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1, flexWrap: "wrap" }}>
            <Chip size="small" label={stage?.playing ? "▶ playing" : "❚❚ paused"} sx={{ bgcolor: "rgba(84,201,90,0.16)", color: "#3ba33b" }} />
            <Typography variant="caption" color="text.secondary">synced party · started by {startedBy} · keeps playing as you browse</Typography>
          </Stack>
        )}
      </GlassCard>

      <GlassCard sx={{ p: active ? 0 : 2, overflow: "hidden" }}>
        {active
          ? <Box id="watch-dock" sx={{ position: "relative", pt: "56.25%", width: "100%" }} />
          : <Typography color="text.secondary">No watch party yet. Paste a YouTube link above and everyone in the room watches in sync — people who join mid-video jump to the current moment, and it keeps playing in a mini player as you move around the app.</Typography>}
      </GlassCard>
    </>
  );
}
