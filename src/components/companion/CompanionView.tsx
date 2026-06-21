import { useEffect, useRef, useState } from "react";
import {
  Box, Stack, Typography, TextField, IconButton, Chip, Avatar, Select, MenuItem,
  CircularProgress, LinearProgress, Dialog, DialogTitle, DialogContent, DialogActions, Button,
} from "@mui/material";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import GlassCard from "@/components/common/GlassCard";
import { companionService, MODELS } from "@/services/companionService";
import { feedService } from "@/services/feedService";
import { communityService } from "@/services/communityService";
import { storage } from "@/services/storage";
import { useStore } from "@/store/useStore";
import { bus } from "@/lib/events";
import { newId } from "@/lib/id";
import type { CompanionMessage } from "@/types";

const QUICK: { label: string; tool: "summary" | "trends" | "communities" }[] = [
  { label: "Summarize my feed", tool: "summary" },
  { label: "What's trending?", tool: "trends" },
  { label: "Suggest communities", tool: "communities" },
];

export default function CompanionView() {
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const [history, setHistory] = useState<CompanionMessage[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [model, setModelStatus] = useState<{ state?: string; progress?: number; text?: string }>({});
  const [pending, setPending] = useState<string | null>(null); // prompt awaiting download consent
  const acked = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);

  const supported = companionService.isSupported();
  const modelInfo = MODELS.find((m) => m.id === settings.llmModel) ?? MODELS[0];
  const loading = model.state === "loading";

  useEffect(() => {
    companionService.history().then(setHistory);
    const a = bus.on("companion:thinking", setThinking);
    const b = bus.on("companion:model", (m) => setModelStatus(m));
    return () => { a(); b(); };
  }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [history, thinking, model]);

  async function context() {
    const { posts } = await feedService.generate(settings.feedAlgorithm, { moderation: settings.moderationProfile });
    const communities = await communityService.list();
    return { posts, communities };
  }

  async function doSend(text: string) {
    const ctx = await context();
    await companionService.ask(text, ctx);
    setHistory(await companionService.history());
  }

  function trySend(text: string) {
    const t = text.trim();
    if (!t) return;
    setInput("");
    // Gate the first LLM call behind a clear privacy/download explainer.
    if (settings.useWebLLM && supported && !companionService.modelReady() && !acked.current) {
      setPending(t);
      return;
    }
    doSend(t);
  }

  function confirmDownload() {
    acked.current = true;
    const t = pending; setPending(null);
    if (t) doSend(t);
  }
  function useFastEngine() {
    acked.current = true;
    companionService.configure(false, settings.llmModel);
    setSettings({ useWebLLM: false, llmOptOut: true });
    const t = pending; setPending(null);
    if (t) doSend(t);
  }

  // Quick tools are instant + offline (no model download).
  async function runTool(label: string, tool: "summary" | "trends" | "communities") {
    const { posts, communities } = await context();
    let text = "";
    if (tool === "summary") text = companionService.summarizeFeed(posts);
    else if (tool === "trends") text = companionService.explainTrends(posts);
    else { const s = companionService.suggestCommunities(posts, communities); text = s.length ? "You might like: " + s.map((c) => c.name).join(", ") : "No matching communities yet — create one!"; }
    await storage.addCompanionMsg({ id: newId("cm"), role: "user", text: label, at: Date.now() });
    await storage.addCompanionMsg({ id: newId("cm"), role: "companion", text, at: Date.now() });
    setHistory(await companionService.history());
  }

  return (
    <Box sx={{ maxWidth: 820, mx: "auto", height: "100%", display: "flex", flexDirection: "column" }}>
      <GlassCard sx={{ mb: 2 }}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Avatar sx={{ background: "linear-gradient(135deg,#3f97ff,#1668e0,#0a55cf)", color: "#ffffff" }}><AutoAwesomeRoundedIcon /></Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h6">Your Companion</Typography>
            <Typography variant="caption" color="text.secondary">
              {supported ? "Real on-device LLM (WebGPU) · private & offline" : "WebGPU unavailable — fast offline engine"}
              {companionService.modelReady() ? " · model in memory" : ""}
            </Typography>
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="caption" color="text.secondary">Model</Typography>
            <Select
              size="small" fullWidth value={settings.llmModel}
              onChange={(e) => setSettings({ llmModel: e.target.value, useWebLLM: true, llmOptOut: false })}
              sx={{ minWidth: 200 }}
            >
              {MODELS.map((m) => <MenuItem key={m.id} value={m.id}>{m.label} · {m.size}</MenuItem>)}
            </Select>
          </Box>
        </Stack>
        {loading && (
          <Box sx={{ mt: 1.5 }}>
            <Typography variant="caption" color="text.secondary">Downloading / loading {modelInfo.label}… {Math.round((model.progress ?? 0) * 100)}%</Typography>
            <LinearProgress variant={model.progress ? "determinate" : "indeterminate"} value={(model.progress ?? 0) * 100} sx={{ height: 6, borderRadius: 3, mt: 0.5 }} />
          </Box>
        )}
      </GlassCard>

      <GlassCard sx={{ flex: 1, overflowY: "auto", mb: 2, display: "flex", flexDirection: "column", gap: 1.5 }}>
        {history.length === 0 && <Typography color="text.secondary">Ask me anything — I run as a real LLM on your own device. Or use a quick tool below (those are instant and need no download).</Typography>}
        {history.map((m) => (
          <Stack key={m.id} direction="row" justifyContent={m.role === "user" ? "flex-end" : "flex-start"}>
            <Box sx={{ maxWidth: "78%", px: 1.5, py: 1, borderRadius: 2, background: m.role === "user" ? "linear-gradient(135deg,#3f97ff,#1668e0)" : "#ffffff", color: m.role === "user" ? "#ffffff" : "text.primary" }}>
              <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>{m.text}</Typography>
            </Box>
          </Stack>
        ))}
        {thinking && <Stack direction="row" alignItems="center" spacing={1}><CircularProgress size={14} /><Typography variant="caption" color="text.secondary">thinking on-device…</Typography></Stack>}
        <div ref={endRef} />
      </GlassCard>

      <Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: "wrap", gap: 1 }}>
        {QUICK.map((q) => <Chip key={q.tool} label={q.label} onClick={() => runTool(q.label, q.tool)} sx={{ bgcolor: "rgba(58,123,240,0.12)" }} />)}
      </Stack>
      <Stack direction="row" spacing={1}>
        <TextField fullWidth size="small" value={input} placeholder="Message your on-device AI…" onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") trySend(input); }} />
        <IconButton color="primary" onClick={() => trySend(input)}><SendRoundedIcon /></IconButton>
      </Stack>

      {/* Privacy + download explainer, shown before the first model load */}
      <Dialog open={!!pending} onClose={() => setPending(null)} maxWidth="xs" PaperProps={{ sx: { backgroundImage: "none" } }}>
        <DialogTitle><Stack direction="row" alignItems="center" spacing={1}><LockRoundedIcon color="primary" /> On-device AI — private &amp; offline</Stack></DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1.5 }}>
            Your companion is a real language model that runs <b>entirely in your browser</b> (WebGPU/WASM). Your messages never leave this device — there's no server.
          </Typography>
          <Typography variant="body2" sx={{ mb: 1.5 }}>
            The first time, <b>{modelInfo.label}</b> downloads (<b>{modelInfo.size}</b>). After that it's <b>cached in your browser</b> and just loads into memory on later visits — it won't re-download unless you clear site data.
          </Typography>
          <Typography variant="caption" color="text.secondary">Tip: pick a smaller model above for a faster first download.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={useFastEngine} color="inherit">Use fast engine</Button>
          <Button onClick={confirmDownload} variant="contained">Download &amp; run</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
