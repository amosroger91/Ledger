import { useEffect, useState } from "react";
import { Box, Stack, TextField, Button, Chip, Typography, Tooltip, FormControlLabel, Checkbox, IconButton } from "@mui/material";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import GlassCard from "@/components/common/GlassCard";
import RoomChat from "@/components/common/RoomChat";
import { peerService } from "@/services/peerService";
import { profileService } from "@/services/profileService";
import { watchRoomService, LOBBY, roomLabel, isPrivate } from "@/services/watchRoomService";
import { bus, toast } from "@/lib/events";
import { useStore } from "@/store/useStore";
import { fingerprint } from "@/lib/crypto";
import type { WatchPartyState } from "@/types";

const PRESETS = ["movies", "music-videos", "gaming", "chill", "late-night"];

function youtubeId(input: string): string | null {
  const s = input.trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  const m = s.match(/[?&]v=([\w-]{11})/) || s.match(/youtu\.be\/([\w-]{11})/) || s.match(/youtube\.com\/(?:embed|shorts|live)\/([\w-]{11})/);
  return m ? m[1] : null;
}

/** "Watch with friends" rooms — like chatrooms, but everyone in a room shares
 *  the same synced YouTube moment. One public Lobby, named public rooms, and
 *  private rooms. The actual player is the global GlobalWatchPlayer (docks into
 *  #watch-dock and keeps playing as you move around). */
export default function WatchParty() {
  const me = useStore((s) => s.me);
  const [input, setInput] = useState("");
  const [room, setRoom] = useState(watchRoomService.current);
  const [stage, setStage] = useState<WatchPartyState | null>(peerService.currentStage(watchRoomService.current));
  const [active, setActive] = useState<WatchPartyState[]>(peerService.activeRooms());
  const [joinName, setJoinName] = useState("");
  const [priv, setPriv] = useState(false);
  const [queue, setQueue] = useState(peerService.queueFor(watchRoomService.current));
  const [qInput, setQInput] = useState("");

  useEffect(() => {
    const sync = () => { setStage(peerService.currentStage(watchRoomService.current)); setActive(peerService.activeRooms()); setQueue(peerService.queueFor(watchRoomService.current)); };
    const off1 = bus.on("stage:in", sync);
    const off2 = bus.on("watchroom:change", (r) => { setRoom(r); sync(); });
    // Your own start broadcasts via stage:out; re-read after it's stored.
    const off3 = bus.on("watch:start", () => setTimeout(sync, 60));
    const off4 = bus.on("watch:queue", ({ room: r }) => { if (r === watchRoomService.current) setQueue(peerService.queueFor(r)); });
    const t = setInterval(() => setActive(peerService.activeRooms()), 4000);
    return () => { off1(); off2(); off3(); off4(); clearInterval(t); };
  }, []);

  function pushQueue(items: typeof queue) { setQueue(items); bus.emit("watch:queue-out", { room: watchRoomService.current, items }); }
  function addToQueue() {
    const id = youtubeId(qInput); if (!id) { toast("Paste a valid YouTube link to queue", "warn"); return; }
    setQInput(""); pushQueue([...queue, { videoId: id, by: me?.publicKey ?? "" }]);
    toast("Added to the up-next queue 🍿", "success");
  }
  function playNext() {
    if (!queue.length) return;
    const [next, ...rest] = queue; pushQueue(rest); bus.emit("watch:start", { videoId: next.videoId });
  }

  function switchRoom(r: string) { watchRoomService.set(r); setRoom(r); setStage(peerService.currentStage(r)); }
  function joinByName() {
    const n = joinName.trim(); if (!n) return;
    switchRoom(priv ? watchRoomService.makePrivate(n) : watchRoomService.makePublic(n));
    setJoinName("");
  }
  function start() {
    const id = youtubeId(input);
    if (!id) { toast("Paste a valid YouTube link", "warn"); return; }
    setInput("");
    bus.emit("watch:start", { videoId: id });
  }

  const isActive = !!stage?.videoId;
  const startedBy = stage?.by === me?.publicKey ? "you" : (stage?.byName || profileService.get(stage?.by ?? "")?.username || fingerprint(stage?.by ?? ""));
  const otherRooms = active.filter((s) => (s.room ?? LOBBY) !== room);

  return (
    <>
      {/* room switcher */}
      <GlassCard sx={{ mb: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
          <Typography sx={{ fontWeight: 800 }}>🍿 {roomLabel(room)}</Typography>
          {isPrivate(room) && <Tooltip title="Private room"><LockRoundedIcon sx={{ fontSize: 16, color: "text.secondary" }} /></Tooltip>}
          <Box sx={{ flex: 1 }} />
          <Typography variant="caption" color="text.secondary">you're in this room</Typography>
        </Stack>
        <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap", gap: 0.5 }}>
          <Chip label="🍿 Public Lobby" size="small" onClick={() => switchRoom(LOBBY)} variant={room === LOBBY ? "filled" : "outlined"}
            sx={room === LOBBY ? { background: "linear-gradient(135deg,#3f97ff,#1668e0)", color: "#fff", fontWeight: 700 } : {}} />
          {PRESETS.map((p) => (
            <Chip key={p} label={"#" + p} size="small" onClick={() => switchRoom(p)} variant={room === p ? "filled" : "outlined"}
              sx={room === p ? { background: "linear-gradient(135deg,#3f97ff,#1668e0)", color: "#fff", fontWeight: 700 } : {}} />
          ))}
        </Stack>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 1.5 }} alignItems={{ xs: "stretch", sm: "center" }}>
          <TextField size="small" placeholder="Join or make a room by name…" value={joinName} onChange={(e) => setJoinName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && joinByName()} sx={{ flex: 1 }} />
          <Stack direction="row" spacing={1} alignItems="center" justifyContent={{ xs: "space-between", sm: "flex-start" }}>
            <FormControlLabel control={<Checkbox size="small" checked={priv} onChange={(e) => setPriv(e.target.checked)} />} label="Private" sx={{ mr: 0 }} />
            <Button variant="outlined" disabled={!joinName.trim()} onClick={joinByName} sx={{ minWidth: { xs: 80, sm: "auto" } }}>Join</Button>
          </Stack>
        </Stack>
        {otherRooms.length > 0 && (
          <Box sx={{ mt: 1.5 }}>
            <Typography variant="caption" color="text.secondary">Active public rooms</Typography>
            <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap", gap: 0.5, mt: 0.5 }}>
              {otherRooms.map((s) => (
                <Chip key={s.room} size="small" label={`${roomLabel(s.room ?? LOBBY)} · ▶`} onClick={() => switchRoom(s.room ?? LOBBY)} sx={{ bgcolor: "rgba(84,201,90,0.16)", color: "#3ba33b" }} />
              ))}
            </Stack>
          </Box>
        )}
      </GlassCard>

      {/* in-room controls + player */}
      <GlassCard sx={{ mb: 2 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
          <TextField fullWidth size="small" value={input} placeholder={`Paste a YouTube link to play in ${roomLabel(room)}…`} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && start()} />
          <Button variant="contained" startIcon={<PlayArrowRoundedIcon />} onClick={start}>Watch together</Button>
        </Stack>
        {isActive && (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1, flexWrap: "wrap" }}>
            <Chip size="small" label={stage?.playing ? "▶ playing" : "❚❚ paused"} sx={{ bgcolor: "rgba(84,201,90,0.16)", color: "#3ba33b" }} />
            <Typography variant="caption" color="text.secondary">synced room · started by {startedBy} · keeps playing as you browse</Typography>
          </Stack>
        )}
      </GlassCard>

      <GlassCard sx={{ p: isActive ? 0 : 2, overflow: "hidden" }}>
        {isActive
          ? <Box id="watch-dock" sx={{ position: "relative", pt: "56.25%", width: "100%" }} />
          : <Typography color="text.secondary">Nothing playing in <b>{roomLabel(room)}</b> yet. Paste a YouTube link above and everyone in this room watches in sync — people who join mid-video jump to the current moment, and it keeps playing in a mini player as you move around the app.</Typography>}
      </GlassCard>

      {/* shared up-next queue — anyone in the room can add; auto-advances on end */}
      <GlassCard sx={{ mt: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
          <Typography variant="overline" color="text.secondary" sx={{ flex: 1 }}>Up next ({queue.length})</Typography>
          {queue.length > 0 && <Button size="small" startIcon={<PlayArrowRoundedIcon />} onClick={playNext}>Play next</Button>}
        </Stack>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
          <TextField fullWidth size="small" value={qInput} placeholder="Paste a YouTube link to queue for everyone…" onChange={(e) => setQInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addToQueue()} />
          <Button variant="outlined" onClick={addToQueue}>Queue</Button>
        </Stack>
        {queue.length > 0 && (
          <Stack spacing={0.5} sx={{ mt: 1 }}>
            {queue.map((q, i) => (
              <Stack key={i} direction="row" spacing={1} alignItems="center" sx={{ p: 0.5, borderRadius: 1, "&:hover": { bgcolor: "rgba(58,155,240,0.06)" } }}>
                <Box component="img" src={`https://i.ytimg.com/vi/${q.videoId}/default.jpg`} sx={{ width: 56, height: 32, objectFit: "cover", borderRadius: 0.5 }} />
                <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} noWrap>{q.videoId}</Typography>
                <Tooltip title="Remove"><IconButton size="small" onClick={() => pushQueue(queue.filter((_, j) => j !== i))}><CloseRoundedIcon fontSize="small" /></IconButton></Tooltip>
              </Stack>
            ))}
          </Stack>
        )}
      </GlassCard>

      {/* live chat (+ optional voice/cam) for everyone in this watch room */}
      <Box sx={{ mt: 2 }}>
        <RoomChat roomId={`watch-${room}`} title={`💬 ${roomLabel(room)} — room chat`} height={320} />
      </Box>
    </>
  );
}
