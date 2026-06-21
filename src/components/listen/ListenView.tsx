import { useEffect, useRef, useState } from "react";
import { Box, Stack, Typography, Button, Slider, Chip, CircularProgress, Grid, ToggleButtonGroup, ToggleButton, IconButton, Tooltip } from "@mui/material";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import StopRoundedIcon from "@mui/icons-material/StopRounded";
import MusicNoteRoundedIcon from "@mui/icons-material/MusicNoteRounded";
import SmartDisplayRoundedIcon from "@mui/icons-material/SmartDisplayRounded";
import QueueMusicRoundedIcon from "@mui/icons-material/QueueMusicRounded";
import AudiotrackRoundedIcon from "@mui/icons-material/AudiotrackRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { audioPlayerService } from "@/services/audioPlayerService";
import { bus } from "@/lib/events";
import GlassCard from "@/components/common/GlassCard";
import RoomChat from "@/components/common/RoomChat";
import { listenTogetherService, type Station } from "@/services/listenTogetherService";
import { presenceService } from "@/services/presenceService";
import { reputationService } from "@/services/reputationService";
import { peerService } from "@/services/peerService";
import { watchRoomService } from "@/services/watchRoomService";
import { toast } from "@/lib/events";
import WatchParty from "./WatchParty";

export default function ListenView() {
  // Arrive in "video" if a watch room is already playing (e.g. via the feed's
  // "Watch with friends" button); otherwise default to music.
  const [mode, setMode] = useState<"music" | "video" | "jukebox">(() => peerService.currentStage(watchRoomService.current)?.videoId ? "video" : "music");
  const [jukebox, setJukebox] = useState(audioPlayerService.queue);
  const jukeRef = useRef<HTMLInputElement>(null);
  useEffect(() => bus.on("audio:queue", ({ items }) => setJukebox(items)), []);
  async function addMp3(files: FileList | null) {
    if (!files) return;
    for (const f of Array.from(files)) {
      if (f.size > 12 * 1024 * 1024) { toast(`${f.name} is over 12 MB — skipped`, "warn"); continue; }
      const url = await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.readAsDataURL(f); });
      audioPlayerService.enqueue({ url, title: f.name.replace(/\.[^.]+$/, "") });
    }
  }

  // --- music (internet radio) ---
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState<Station | null>(null);
  const [vol, setVol] = useState(60);

  useEffect(() => {
    listenTogetherService.stations().then((s) => { setStations(s); setLoading(false); }).catch(() => setLoading(false));
    // NOTE: we intentionally do NOT stop playback on unmount — music keeps
    // playing as you navigate; the mini-player controls it from anywhere.
  }, []);

  async function playStation(s: Station) {
    const ok = await listenTogetherService.play(s);
    if (ok) {
      setCurrent(s);
      presenceService.setActivity("Listening", s.name);
      reputationService.award("participation", 1, "started a listen-together session");
    } else toast("Couldn't play this station — try another", "warn");
  }
  function stopStation() { listenTogetherService.stop(); setCurrent(null); presenceService.clearActivity(); }

  return (
    <Box sx={{ maxWidth: 1000, mx: "auto" }}>
      <Typography variant="h5">🍿 Watch with friends</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Synchronized rooms — like chatrooms, but for watching together. Join the public Lobby, a named room, or a private one, and everyone shares the same moment (synced over the peer relay). Or stream internet radio.
      </Typography>

      <ToggleButtonGroup
        exclusive size="small" value={mode} onChange={(_, v) => v && setMode(v)}
        sx={{ mb: 2, "& .MuiToggleButton-root": { border: "1px solid rgba(58,155,240,0.18)", color: "text.secondary", "&.Mui-selected": { background: "linear-gradient(135deg,#3f97ff,#1668e0)", color: "#ffffff" } } }}
      >
        <ToggleButton value="music"><MusicNoteRoundedIcon fontSize="small" sx={{ mr: 0.5 }} /> Radio</ToggleButton>
        <ToggleButton value="video"><SmartDisplayRoundedIcon fontSize="small" sx={{ mr: 0.5 }} /> Watch rooms</ToggleButton>
        <ToggleButton value="jukebox"><QueueMusicRoundedIcon fontSize="small" sx={{ mr: 0.5 }} /> Jukebox</ToggleButton>
      </ToggleButtonGroup>

      {mode === "music" && (
        <>
          <GlassCard sx={{ mb: 2, background: "linear-gradient(135deg, rgba(58,155,240,0.12), rgba(54,224,196,0.12))" }}>
            <Stack direction="row" alignItems="center" spacing={2}>
              <Box sx={{ width: 64, height: 64, borderRadius: 2, display: "grid", placeItems: "center", fontSize: 30, background: "rgba(0,0,0,0.3)" }}>{current ? "🎶" : "🎧"}</Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="h6" noWrap>{current ? current.name : "Nothing playing"}</Typography>
                <Typography variant="caption" color="text.secondary">{current ? `${current.genre} · live` : "Choose a station below"}</Typography>
              </Box>
              {current
                ? <Button variant="outlined" startIcon={<StopRoundedIcon />} onClick={stopStation}>Stop</Button>
                : <Chip label="idle" variant="outlined" />}
            </Stack>
            <Stack direction="row" alignItems="center" spacing={2} sx={{ mt: 2 }}>
              <Typography variant="caption">Volume</Typography>
              <Slider size="small" value={vol} onChange={(_, v) => { setVol(v as number); listenTogetherService.setVolume((v as number) / 100); }} sx={{ maxWidth: 240 }} />
            </Stack>
          </GlassCard>

          {/* tune into a station → join its chat and listen together */}
          {current && <Box sx={{ mb: 2 }}><RoomChat roomId={`radio-${current.url}`} title={`📻 ${current.name} — listeners' chat`} height={300} /></Box>}

          {loading ? (
            <Stack direction="row" alignItems="center" spacing={1}><CircularProgress size={16} /><Typography variant="caption" color="text.secondary">Finding stations…</Typography></Stack>
          ) : (
            <Grid container spacing={1.5}>
              {stations.map((s) => (
                <Grid item xs={12} sm={6} md={4} key={s.url}>
                  <GlassCard>
                    <Stack direction="row" alignItems="center" spacing={1.5}>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography noWrap sx={{ fontWeight: 700 }}>{s.name}</Typography>
                        <Chip size="small" label={s.genre} sx={{ mt: 0.5, bgcolor: "rgba(58,123,240,0.14)", color: "#1668e0" }} />
                      </Box>
                      <Button size="small" variant="contained" sx={{ minWidth: 0, px: 1.2 }} onClick={() => playStation(s)}><PlayArrowRoundedIcon /></Button>
                    </Stack>
                  </GlassCard>
                </Grid>
              ))}
              {stations.length === 0 && <Grid item xs={12}><GlassCard><Typography color="text.secondary">Station directory unreachable right now. (It's a free public API — try again later.)</Typography></GlassCard></Grid>}
            </Grid>
          )}
        </>
      )}

      {mode === "jukebox" && (
        <>
          <GlassCard sx={{ mb: 2 }}>
            <Typography variant="h6">🎵 Jukebox listening room</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 1.5 }}>
              Drop in mp3s to build a shared up-next queue — they play through the bottom audio bar (pause/seek/volume). Everyone in the room shares the chat below; your queue plays on your device.
            </Typography>
            <Button variant="contained" startIcon={<AudiotrackRoundedIcon />} onClick={() => jukeRef.current?.click()}>Add mp3s to the queue</Button>
            <input ref={jukeRef} type="file" accept="audio/*,.mp3" multiple hidden onChange={(e) => { addMp3(e.target.files); e.currentTarget.value = ""; }} />
            {jukebox.length > 0 && (
              <Stack spacing={0.5} sx={{ mt: 1.5 }}>
                <Typography variant="overline" color="text.secondary">Up next ({jukebox.length})</Typography>
                {jukebox.map((t, i) => (
                  <Stack key={i} direction="row" spacing={1} alignItems="center" sx={{ p: 0.5, borderRadius: 1, bgcolor: "rgba(124,92,255,0.06)" }}>
                    <AudiotrackRoundedIcon fontSize="small" sx={{ color: "#7c5cff" }} />
                    <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} noWrap>{t.title}</Typography>
                  </Stack>
                ))}
                <Button size="small" startIcon={<CloseRoundedIcon />} onClick={() => audioPlayerService.clearQueue()} sx={{ alignSelf: "flex-start" }}>Clear queue</Button>
              </Stack>
            )}
          </GlassCard>
          <RoomChat roomId="jukebox-lobby" title="🎶 Jukebox room — chat" height={320} />
        </>
      )}

      {mode === "video" && <WatchParty />}
    </Box>
  );
}
