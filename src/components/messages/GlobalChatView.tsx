import { useEffect, useRef, useState } from "react";
import { Box, Stack, Typography, TextField, IconButton, Chip, Button } from "@mui/material";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import PublicRoundedIcon from "@mui/icons-material/PublicRounded";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import GlassCard from "@/components/common/GlassCard";
import UserAvatar from "@/components/common/UserAvatar";
import MessageBody from "@/components/common/MessageBody";
import { clockTime } from "@/lib/time";
import { useChatScroll } from "@/lib/useChatScroll";
import { playPing } from "@/lib/ping";
import { joinGlobalChat, myGlobalAuthor, type GlobalChatController } from "@/services/globalChatService";
import type { ChatMessage } from "@/types";

// Full-page "Global Chat": a public Nostr (NIP-28) channel. Same service as the
// floating dock — anyone on Nostr (any NIP-28 client) shares this room with us.
export default function GlobalChatView() {
  const ctrl = useRef<GlobalChatController | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [mine, setMine] = useState("");
  const mineRef = useRef("");
  const pinged = useRef<Set<string>>(new Set());
  const [input, setInput] = useState("");
  const [status, setStatus] = useState("connecting…");
  const { scrollRef, endRef, pending, jump } = useChatScroll(messages.length);

  useEffect(() => {
    let alive = true;
    myGlobalAuthor().then((a) => { if (alive) { setMine(a); mineRef.current = a; } });
    const render = (m: ChatMessage) => {
      // Chime for genuinely-new incoming messages: not mine, recently authored (so the
      // initial history burst stays silent however slowly it loads), once per id.
      if (m.author !== mineRef.current && Date.now() - m.createdAt < 25000 && !pinged.current.has(m.id)) { pinged.current.add(m.id); playPing(); }
      setMessages((prev) => {
        const i = prev.findIndex((x) => x.id === m.id);
        if (i >= 0) { const next = prev.slice(); next[i] = { ...next[i], ...m }; return next; }
        return [...prev, m].sort((a, b) => a.createdAt - b.createdAt).slice(-500);
      });
    };
    ctrl.current = joinGlobalChat({ onStatus: setStatus, onChat: render });
    return () => { alive = false; ctrl.current?.leave(); ctrl.current = null; };
  }, []);

  function send() { const t = input.trim(); if (!t || !ctrl.current) return; ctrl.current.sendChat(t); setInput(""); jump(); }

  return (
    <Box sx={{ maxWidth: 900, mx: "auto", display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb: 1.5 }}>
        <Box sx={{ width: 40, height: 40, borderRadius: "12px", display: "grid", placeItems: "center", background: "linear-gradient(135deg,#2bb673,#159e63)", color: "#fff" }}><PublicRoundedIcon /></Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h6" sx={{ lineHeight: 1.1 }}>Global Chat</Typography>
          <Typography variant="caption" color="text.secondary">Public Nostr channel (NIP-28) · anyone on Nostr can join · {status}</Typography>
        </Box>
        <Chip size="small" label="public · global" variant="outlined" sx={{ opacity: 0.7 }} />
      </Stack>
      <GlassCard sx={{ flex: 1, p: 0, position: "relative", display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
        <Box ref={scrollRef} sx={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 1, p: 2, minHeight: 0 }}>
          {messages.length === 0 && <Typography color="text.secondary">No messages yet — say hi to the world 🌍</Typography>}
          {messages.map((m) => {
            const isMine = m.author === mine;
            return (
              <Stack key={m.id} direction="row" spacing={1} justifyContent={isMine ? "flex-end" : "flex-start"}>
                {!isMine && <UserAvatar pk={m.author} name={m.authorName} avatar={m.authorAvatar} size={28} />}
                <Box sx={{ maxWidth: "72%", px: 1.5, py: 0.9, borderRadius: 2, background: isMine ? "linear-gradient(135deg,#3f97ff,#1668e0)" : "#ffffff", color: isMine ? "#fff" : "text.primary" }}>
                  {!isMine && <Typography variant="caption" sx={{ fontWeight: 700 }}>{m.authorName}</Typography>}
                  {(m.text || m.media?.length) ? <MessageBody text={m.text} media={m.media} /> : null}
                  <Typography variant="caption" sx={{ opacity: 0.6, display: "block" }}>{clockTime(m.createdAt)}</Typography>
                </Box>
              </Stack>
            );
          })}
          <div ref={endRef} />
        </Box>
        {pending > 0 && (
          <Button onClick={() => jump()} size="small" startIcon={<KeyboardArrowDownRoundedIcon />}
            sx={{ position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)", borderRadius: 999, textTransform: "none", fontWeight: 800, px: 2, boxShadow: 4, color: "#fff", background: "linear-gradient(135deg,#2bb673,#159e63)", "&:hover": { background: "linear-gradient(135deg,#2bb673,#0e8754)" } }}>
            {pending} new message{pending > 1 ? "s" : ""}
          </Button>
        )}
      </GlassCard>
      <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
        <TextField fullWidth size="small" value={input} placeholder="Message the world…" onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} />
        <IconButton color="primary" onClick={send}><SendRoundedIcon /></IconButton>
      </Stack>
    </Box>
  );
}
