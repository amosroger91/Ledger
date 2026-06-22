import { useEffect, useRef, useState } from "react";
import { Box, Stack, Typography, Button, Slider, Chip, CircularProgress, Grid, ToggleButtonGroup, ToggleButton, IconButton, Tooltip, TextField, InputAdornment, Select, MenuItem, Link } from "@mui/material";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import PauseRoundedIcon from "@mui/icons-material/PauseRounded";
import StopRoundedIcon from "@mui/icons-material/StopRounded";
import MusicNoteRoundedIcon from "@mui/icons-material/MusicNoteRounded";
import SmartDisplayRoundedIcon from "@mui/icons-material/SmartDisplayRounded";
import QueueMusicRoundedIcon from "@mui/icons-material/QueueMusicRounded";
import AudiotrackRoundedIcon from "@mui/icons-material/AudiotrackRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import FavoriteRoundedIcon from "@mui/icons-material/FavoriteRounded";
import WhatshotRoundedIcon from "@mui/icons-material/WhatshotRounded";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import GraphicEqRoundedIcon from "@mui/icons-material/GraphicEqRounded";
import { audioPlayerService } from "@/services/audioPlayerService";
import { bus } from "@/lib/events";
import GlassCard from "@/components/common/GlassCard";
import RoomChat from "@/components/common/RoomChat";
import StationLogo from "@/components/common/StationLogo";
import { listenTogetherService, flagOf, GENRES, COUNTRIES, type Station } from "@/services/listenTogetherService";
import { presenceService } from "@/services/presenceService";
import { reputationService } from "@/services/reputationService";
import { peerService } from "@/services/peerService";
import { watchRoomService } from "@/services/watchRoomService";
import { toast } from "@/lib/events";
import WatchParty from "./WatchParty";

const fmtCount = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n));

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

  // --- music: the Radio Browser station browser ---
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [current, setCurrent] = useState<Station | null>(listenTogetherService.current);
  const [playing, setPlaying] = useState(listenTogetherService.playing);
  const [vol, setVol] = useState(Math.round(listenTogetherService.volume * 100));

  // query state
  const [q, setQ] = useState("");
  const [tag, setTag] = useState("");
  const [country, setCountry] = useState("US");   // open on American stations by default
  const [sort, setSort] = useState<"popular" | "trending">("popular");

  // Keep the hero in sync if playback is stopped/paused elsewhere (mini-player).
  // We intentionally never stop playback on unmount — music follows you around,
  // controllable from the persistent bottom bar.
  useEffect(() => bus.on("listen:now", (s) => { setPlaying(s.playing); if (!s.station) setCurrent(null); }), []);

  // Run the query whenever it changes; debounce only free-text search.
  useEffect(() => {
    let alive = true;
    setLoading(true); setError(false);
    const handle = setTimeout(() => {
      listenTogetherService.browse({ q, tag, country, sort })
        .then((list) => { if (alive) { setStations(list); setLoading(false); } })
        .catch(() => { if (alive) { setError(true); setLoading(false); } });
    }, q ? 350 : 0);
    return () => { alive = false; clearTimeout(handle); };
  }, [q, tag, country, sort]);

  async function playStation(s: Station) {
    const ok = await listenTogetherService.play(s);
    if (ok) {
      setCurrent(s); setPlaying(true);
      presenceService.setActivity("Listening", s.name);
      reputationService.award("participation", 1, "started a listen-together session");
    } else toast("Couldn't play this station — try another", "warn");
  }
  function stopStation() { listenTogetherService.stop(); setCurrent(null); setPlaying(false); presenceService.clearActivity(); }

  return (
    <Box sx={{ maxWidth: 1000, mx: "auto" }}>
      <Typography variant="h5">🍿 Watch and listen</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Synchronized rooms — like chatrooms, but for watching together. Join the public Lobby, a named room, or a private one, and everyone shares the same moment (synced over the peer relay). Or tune in to live internet radio — tens of thousands of stations worldwide, with a chat room for every one.
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
          {/* Now playing */}
          <GlassCard sx={{ mb: 2, background: "linear-gradient(135deg, rgba(58,155,240,0.14), rgba(54,224,196,0.12))" }}>
            <Stack direction="row" alignItems="center" spacing={2}>
              <StationLogo src={current?.favicon} size={64} fallback={current ? "🎶" : "🎧"} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="h6" noWrap>{current ? current.name : "Nothing playing"}</Typography>
                <Typography variant="caption" color="text.secondary" noWrap component="div">
                  {current
                    ? `${flagOf(current.countryCode)} ${current.country || "—"} · ${current.codec || "audio"}${current.bitrate ? ` ${current.bitrate}kbps` : ""} · ${playing ? "live" : "paused"}`
                    : "Pick a station below — search, or browse by genre and country"}
                </Typography>
                {current && (current.tags.length > 0 || current.homepage) && (
                  <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.5, flexWrap: "wrap", rowGap: 0.5 }}>
                    {current.tags.slice(0, 3).map((t) => (
                      <Chip key={t} size="small" label={t} sx={{ height: 18, fontSize: 10, bgcolor: "rgba(58,123,240,0.14)", color: "#1668e0" }} />
                    ))}
                    {current.homepage && (
                      <Link href={current.homepage} target="_blank" rel="noopener noreferrer" sx={{ display: "inline-flex", alignItems: "center", fontSize: 12, ml: 0.5 }}>
                        Website <OpenInNewRoundedIcon sx={{ fontSize: 13, ml: 0.2 }} />
                      </Link>
                    )}
                  </Stack>
                )}
              </Box>
              {current
                ? <Stack direction="row" spacing={1}>
                    <Tooltip title={playing ? "Pause" : "Play"}><IconButton color="primary" onClick={() => listenTogetherService.toggle()}>{playing ? <PauseRoundedIcon /> : <PlayArrowRoundedIcon />}</IconButton></Tooltip>
                    <Button variant="outlined" startIcon={<StopRoundedIcon />} onClick={stopStation}>Stop</Button>
                  </Stack>
                : <Chip label="idle" variant="outlined" />}
            </Stack>
            {current && (
              <Stack direction="row" alignItems="center" spacing={2} sx={{ mt: 2 }}>
                <Typography variant="caption">Volume</Typography>
                <Slider size="small" value={vol} onChange={(_, v) => { setVol(v as number); listenTogetherService.setVolume((v as number) / 100); }} sx={{ maxWidth: 240 }} />
              </Stack>
            )}
          </GlassCard>

          {/* Tune in → join this station's chat and listen together. Keyed by the
              station's stable uuid so the room is shareable and never collides. */}
          {current && <Box sx={{ mb: 2 }}><RoomChat roomId={`radio-${current.uuid}`} title={`📻 ${current.name} — listeners' chat`} height={300} /></Box>}

          {/* Browser toolbar: search · country · sort · genres */}
          <GlassCard sx={{ mb: 2 }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }}>
              <TextField
                fullWidth size="small" placeholder="Search stations by name…" value={q}
                onChange={(e) => setQ(e.target.value)}
                InputProps={{
                  startAdornment: <InputAdornment position="start"><SearchRoundedIcon fontSize="small" /></InputAdornment>,
                  endAdornment: q ? <InputAdornment position="end"><IconButton size="small" onClick={() => setQ("")}><CloseRoundedIcon fontSize="small" /></IconButton></InputAdornment> : undefined,
                }}
              />
              <Select size="small" displayEmpty value={country} onChange={(e) => { setQ(""); setCountry(e.target.value); }} sx={{ minWidth: 170 }}>
                {COUNTRIES.map((c) => <MenuItem key={c.code} value={c.code}>{flagOf(c.code)} {c.name}</MenuItem>)}
              </Select>
              <ToggleButtonGroup
                exclusive size="small" value={sort} onChange={(_, v) => v && setSort(v)} disabled={!!q.trim()}
                sx={{ "& .MuiToggleButton-root": { border: "1px solid rgba(58,155,240,0.18)", px: 1.2, whiteSpace: "nowrap", "&.Mui-selected": { background: "linear-gradient(135deg,#3f97ff,#1668e0)", color: "#fff" } } }}
              >
                <ToggleButton value="popular"><StarRoundedIcon fontSize="small" sx={{ mr: 0.5 }} /> Popular</ToggleButton>
                <ToggleButton value="trending"><WhatshotRoundedIcon fontSize="small" sx={{ mr: 0.5 }} /> Trending</ToggleButton>
              </ToggleButtonGroup>
            </Stack>
            <Stack direction="row" spacing={0.75} sx={{ mt: 1.5, overflowX: "auto", pb: 0.5 }}>
              <Chip label="All" clickable onClick={() => { setQ(""); setTag(""); }} variant={tag === "" ? "filled" : "outlined"} color={tag === "" ? "primary" : "default"} sx={{ flex: "0 0 auto" }} />
              {GENRES.map((g) => (
                <Chip key={g} label={g} clickable onClick={() => { setQ(""); setTag(tag === g ? "" : g); }} variant={tag === g ? "filled" : "outlined"} color={tag === g ? "primary" : "default"} sx={{ flex: "0 0 auto", textTransform: "capitalize" }} />
              ))}
            </Stack>
          </GlassCard>

          {/* Results */}
          {loading ? (
            <Stack direction="row" alignItems="center" spacing={1}><CircularProgress size={16} /><Typography variant="caption" color="text.secondary">Finding stations…</Typography></Stack>
          ) : error ? (
            <GlassCard><Typography color="text.secondary">Station directory unreachable right now. (It's a free, community-run API — try again in a moment.)</Typography></GlassCard>
          ) : stations.length === 0 ? (
            <GlassCard><Typography color="text.secondary">No stations match. Try a different search, genre, or country.</Typography></GlassCard>
          ) : (
            <Grid container spacing={1.5}>
              {stations.map((s) => {
                const on = current?.uuid === s.uuid;
                return (
                  <Grid item xs={12} sm={6} md={4} key={s.uuid}>
                    <GlassCard sx={{ outline: on ? "2px solid #3f97ff" : "none", outlineOffset: "-2px" }}>
                      <Stack direction="row" alignItems="center" spacing={1.5}>
                        <StationLogo src={s.favicon} size={44} />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography noWrap sx={{ fontWeight: 700 }}>{s.name}</Typography>
                          <Typography variant="caption" color="text.secondary" noWrap component="div">
                            {flagOf(s.countryCode)} {s.country || "—"}{s.bitrate ? ` · ${s.bitrate}kbps` : ""}
                          </Typography>
                          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.5 }}>
                            <Chip size="small" label={s.genre} sx={{ height: 18, fontSize: 10, maxWidth: 130, bgcolor: "rgba(58,123,240,0.14)", color: "#1668e0", textTransform: "capitalize" }} />
                            <Stack direction="row" spacing={0.25} alignItems="center" sx={{ color: "text.secondary" }}>
                              <FavoriteRoundedIcon sx={{ fontSize: 12 }} />
                              <Typography variant="caption">{fmtCount(s.votes)}</Typography>
                            </Stack>
                          </Stack>
                        </Box>
                        <Tooltip title={on && playing ? "On air" : "Play"}>
                          <Button size="small" variant={on ? "outlined" : "contained"} sx={{ minWidth: 0, px: 1.2 }} onClick={() => playStation(s)}>
                            {on && playing ? <GraphicEqRoundedIcon /> : <PlayArrowRoundedIcon />}
                          </Button>
                        </Tooltip>
                      </Stack>
                    </GlassCard>
                  </Grid>
                );
              })}
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
