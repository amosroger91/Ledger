import { useEffect, useState } from "react";
import { Box, Stack, Typography, IconButton, Slider, Chip, Tooltip } from "@mui/material";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import PauseRoundedIcon from "@mui/icons-material/PauseRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import QueueMusicRoundedIcon from "@mui/icons-material/QueueMusicRounded";
import VolumeUpRoundedIcon from "@mui/icons-material/VolumeUpRounded";
import { useNavigate } from "react-router-dom";
import { listenTogetherService, flagOf } from "@/services/listenTogetherService";
import StationLogo from "@/components/common/StationLogo";
import { bus } from "@/lib/events";

/** Persistent music bar — visible on every screen so playback is always
 *  controllable. Audio itself is a singleton in listenTogetherService, so it
 *  keeps playing across route changes. */
export default function MiniPlayer() {
  const nav = useNavigate();
  const cur = listenTogetherService.current;
  const [state, setState] = useState<{ station: { name: string; genre: string; url: string; favicon?: string; flag?: string } | null; playing: boolean }>({
    station: cur ? { name: cur.name, genre: cur.genre, url: cur.url, favicon: cur.favicon, flag: flagOf(cur.countryCode) } : null,
    playing: listenTogetherService.playing,
  });
  const [vol, setVol] = useState(Math.round(listenTogetherService.volume * 100));

  useEffect(() => bus.on("listen:now", setState), []);

  if (!state.station) return null;

  return (
    <Box sx={{
      position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 1200,
      px: { xs: 1.5, md: 2 }, py: 1,
      display: "flex", alignItems: "center", gap: 1.5,
      background: "rgba(236,233,216,0.94)", backdropFilter: "blur(18px) saturate(1.3)",
      borderTop: "1px solid rgba(0,0,0,0.14)", boxShadow: "0 -8px 30px rgba(0,0,0,0.4)",
    }}>
      <StationLogo src={state.station.favicon} size={40} fallback={state.playing ? "🎶" : "🎧"} />
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography noWrap sx={{ fontWeight: 700, fontSize: 14 }}>{state.station.name}</Typography>
        <Stack direction="row" spacing={0.5} alignItems="center">
          {state.station.flag && <Typography component="span" sx={{ fontSize: 13, lineHeight: 1 }}>{state.station.flag}</Typography>}
          <Chip size="small" label={state.station.genre} sx={{ height: 16, fontSize: 10, bgcolor: "rgba(58,123,240,0.18)", color: "#0a55cf" }} />
          <Typography variant="caption" color="text.secondary">{state.playing ? "live" : "paused"}</Typography>
        </Stack>
      </Box>

      <Tooltip title={state.playing ? "Pause" : "Play"}>
        <IconButton color="primary" onClick={() => listenTogetherService.toggle()}>
          {state.playing ? <PauseRoundedIcon /> : <PlayArrowRoundedIcon />}
        </IconButton>
      </Tooltip>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ width: 130, display: { xs: "none", sm: "flex" } }}>
        <VolumeUpRoundedIcon fontSize="small" sx={{ opacity: 0.7 }} />
        <Slider size="small" value={vol} onChange={(_, v) => { setVol(v as number); listenTogetherService.setVolume((v as number) / 100); }} />
      </Stack>

      <Tooltip title="Browse stations & video"><IconButton onClick={() => nav("/listen")}><QueueMusicRoundedIcon /></IconButton></Tooltip>
      <Tooltip title="Close player (stops music)"><IconButton onClick={() => listenTogetherService.stop()}><CloseRoundedIcon /></IconButton></Tooltip>
    </Box>
  );
}
