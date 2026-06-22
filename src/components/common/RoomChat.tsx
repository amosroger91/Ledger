import { useEffect, useRef, useState } from "react";
import { Box, Stack, Typography, TextField, IconButton, Tooltip } from "@mui/material";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import ImageRoundedIcon from "@mui/icons-material/ImageRounded";
import MicRoundedIcon from "@mui/icons-material/MicRounded";
import VideocamRoundedIcon from "@mui/icons-material/VideocamRounded";
import GlassCard from "@/components/common/GlassCard";
import UserAvatar from "@/components/common/UserAvatar";
import { joinChatroom } from "@/services/chatroomService";
import * as chatMedia from "@/services/chatMedia";
import { readDataUrl } from "@/lib/image";
import { clockTime } from "@/lib/time";
import { useStore } from "@/store/useStore";
import { toast } from "@/lib/events";
import type { ChatMessage } from "@/types";

/** A compact, live room chat (text + image, optional mic/camera) keyed to a
 *  roomId — reused under watch parties, radio, and the mp3 jukebox so everyone
 *  in the same room can talk while they watch/listen together. */
export default function RoomChat({ roomId, title = "Room chat", media = true, height = 300 }: { roomId: string; title?: string; media?: boolean; height?: number }) {
  const me = useStore((s) => s.me);
  const ctrl = useRef<ReturnType<typeof joinChatroom> | null>(null);
  const seen = useRef<Set<string>>(new Set());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [mic, setMic] = useState(false);
  const [cam, setCam] = useState(false);
  const [streams, setStreams] = useState<Record<string, MediaStream>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!me) return;
    seen.current = new Set(); setMessages([]); setStreams({});
    const render = (m: ChatMessage) => setMessages((prev) => (seen.current.has(m.id) ? prev.map((x) => (x.id === m.id ? m : x)) : (seen.current.add(m.id), [...prev, m])));
    ctrl.current = joinChatroom({
      roomId,
      identity: { id: me.publicKey, name: me.username, avatar: me.avatar },
      handlers: {
        onStatus: () => {}, onRoster: () => {}, onHistory: (msgs) => msgs.forEach(render), onChat: render, onReact: () => {},
        onRemoteStream: (id, s) => setStreams((x) => ({ ...x, [id]: s })),
        onRemoteEnd: (id) => setStreams((x) => { const n = { ...x }; delete n[id]; return n; }),
        onError: () => {},
      },
    });
    return () => { ctrl.current?.leave(); ctrl.current = null; chatMedia.stopLocal(); };
  }, [roomId, me?.publicKey]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  function send() { const t = input.trim(); if (!t || !ctrl.current) return; ctrl.current.sendChat(t); setInput(""); }
  async function attach(file?: File) { if (!file || !ctrl.current) return; ctrl.current.sendImage(await readDataUrl(file), file.type); }
  async function applyMedia(nextMic: boolean, nextCam: boolean) {
    try { await chatMedia.setMedia({ audio: nextMic, video: nextCam }); }
    catch { toast("Couldn't access mic/camera", "warn"); setMic(false); setCam(false); return; }
    const local = chatMedia.getLocalStream();
    setStreams((s) => { const n = { ...s }; if (local && me) n[me.publicKey] = local; else if (me) delete n[me.publicKey]; return n; });
    ctrl.current?.refreshMedia();
  }

  const tiles = Object.entries(streams);
  return (
    <GlassCard sx={{ display: "flex", flexDirection: "column", height }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
        <Typography variant="overline" color="text.secondary" sx={{ flex: 1 }}>{title}</Typography>
        {media && <>
          <Tooltip title="Mic"><IconButton size="small" color={mic ? "primary" : "default"} onClick={() => { const v = !mic; setMic(v); applyMedia(v, cam); }}><MicRoundedIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Camera"><IconButton size="small" color={cam ? "primary" : "default"} onClick={() => { const v = !cam; setCam(v); applyMedia(mic, v); }}><VideocamRoundedIcon fontSize="small" /></IconButton></Tooltip>
        </>}
      </Stack>
      {tiles.length > 0 && (
        <Stack direction="row" spacing={0.5} sx={{ mb: 0.5, overflowX: "auto" }}>
          {tiles.map(([id, stream]) => (
            <Box key={id} sx={{ flex: "0 0 auto", width: 96, height: 72, borderRadius: 1, overflow: "hidden", bgcolor: "#05080f" }}>
              <video autoPlay playsInline muted={id === me?.publicKey} ref={(el) => { if (el && el.srcObject !== stream) el.srcObject = stream; }} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </Box>
          ))}
        </Stack>
      )}
      <Box sx={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 0.5 }}>
        {messages.length === 0 && <Typography variant="body2" color="text.secondary">No messages yet — say hi 👋</Typography>}
        {messages.map((m) => {
          if (m.author === "system") return <Typography key={m.id} variant="caption" color="text.secondary" sx={{ alignSelf: "center", fontStyle: "italic" }}>{m.text}</Typography>;
          const mine = m.author === me?.publicKey;
          return (
            <Stack key={m.id} direction="row" spacing={0.75} justifyContent={mine ? "flex-end" : "flex-start"}>
              {!mine && <UserAvatar pk={m.author} name={m.authorName} avatar={m.authorAvatar} size={22} />}
              <Box sx={{ maxWidth: { xs: "85%", sm: "78%" }, px: 1, py: 0.6, borderRadius: 2, background: mine ? "linear-gradient(135deg,#3f97ff,#1668e0)" : "#fff", color: mine ? "#fff" : "text.primary" }}>
                {!mine && <Typography variant="caption" sx={{ fontWeight: 700 }}>{m.authorName}</Typography>}
                {m.text && <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{m.text}</Typography>}
                {m.media?.map((md, i) => md.type === "image" ? <Box key={i} component="img" src={md.url} sx={{ mt: 0.5, maxWidth: "100%", borderRadius: 1 }} /> : null)}
                <Typography variant="caption" sx={{ opacity: 0.6, display: "block" }}>{clockTime(m.createdAt)}</Typography>
              </Box>
            </Stack>
          );
        })}
        <div ref={endRef} />
      </Box>
      <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
        {media && <>
          <Tooltip title="Share image"><IconButton size="small" onClick={() => fileRef.current?.click()}><ImageRoundedIcon fontSize="small" /></IconButton></Tooltip>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { attach(e.target.files?.[0]); e.currentTarget.value = ""; }} />
        </>}
        <TextField fullWidth size="small" value={input} placeholder="Message the room…" onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} />
        <IconButton color="primary" onClick={send}><SendRoundedIcon /></IconButton>
      </Stack>
    </GlassCard>
  );
}
