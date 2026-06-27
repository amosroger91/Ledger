import { useRef, useState } from "react";
import { Stack, TextField, Button, IconButton, Box, Chip, Tooltip, Typography, Select, MenuItem, useMediaQuery, ButtonGroup } from "@mui/material";
import type { Theme } from "@mui/material";
import ImageRoundedIcon from "@mui/icons-material/ImageRounded";
import GifBoxRoundedIcon from "@mui/icons-material/GifBoxRounded";
import AudiotrackRoundedIcon from "@mui/icons-material/AudiotrackRounded";
import CodeRoundedIcon from "@mui/icons-material/CodeRounded";
import AutoFixHighRoundedIcon from "@mui/icons-material/AutoFixHighRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import ArrowDropDownRoundedIcon from "@mui/icons-material/ArrowDropDownRounded";
import GlassCard from "@/components/common/GlassCard";
import GifPicker from "@/components/common/GifPicker";
import HtmlComposer from "./HtmlComposer";
import { compressPostImage } from "@/lib/image";
import { feedService } from "@/services/feedService";
import { peerService } from "@/services/peerService";
import { companionService } from "@/services/companionService";
import { moderationService } from "@/services/moderationService";
import { useStore } from "@/store/useStore";
import UserAvatar from "@/components/common/UserAvatar";
import { toast } from "@/lib/events";
import type { MediaRef } from "@/types";

const TARGET_LABELS: Record<string, string> = {
  ledgr: "Ledgr only",
  both: "Ledgr + Nostr",
  nostr: "Nostr only",
};

export default function Composer({ community }: { community?: string }) {
  const me = useStore((s) => s.me);
  const moderation = useStore((s) => s.settings.moderationProfile);
  const nostrEnabled = useStore((s) => s.settings.nostrEnabled !== false);
  const [target, setTarget] = useState<"ledgr" | "both" | "nostr">("ledgr");
  const [text, setText] = useState("");
  const [media, setMedia] = useState<MediaRef[]>([]);
  const [gifOpen, setGifOpen] = useState(false);
  const [htmlOpen, setHtmlOpen] = useState(false);
  const [targetOpen, setTargetOpen] = useState(false);
  const [showPermanentWarning, setShowPermanentWarning] = useState<boolean>(() => {
    try { return localStorage.getItem("composer:permanentWarningDismissed") !== "1"; } catch { return true; }
  });
  const fileRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLInputElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);

  // Phone layout triggers below 480px (narrower than MUI's default sm=600px)
  const phone = useMediaQuery("@media (max-width:479px)");

  async function attach(file?: File) {
    if (!file) return;
    const url = await compressPostImage(file);
    setMedia((m) => [...m, { type: "image", url, mime: file.type === "image/gif" ? "image/gif" : "image/jpeg", bytes: url.length }]);
  }

  async function attachAudio(file?: File) {
    if (!file) return;
    if (file.size > 12 * 1024 * 1024) { toast("That mp3 is over 12 MB — pick a smaller file to share it on your timeline.", "warn"); return; }
    const url = await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.readAsDataURL(file); });
    setMedia((m) => [...m, { type: "audio", url, mime: file.type || "audio/mpeg", bytes: file.size, alt: file.name.replace(/\.[^.]+$/, "") }]);
  }

  async function postHtml(html: string) {
    const p = await feedService.createPost({ html, community });
    peerService.publishPost(p);
    toast(community ? "HTML posted to the group — it's permanent now ✦" : "HTML posted — it's out there forever ✦", "success");
  }

  async function post() {
    const body = text.trim();
    if (!body && !media.length) return;
    const verdict = moderationService.classify(body, moderation);
    if (verdict.action === "flag" || verdict.action === "hide") { toast(`This would be flagged: ${verdict.reasoning} — edit and retry`, "warn"); return; }
    const toNostr = nostrEnabled && target !== "ledgr";
    const toLedger = target !== "nostr";
    if (toLedger) {
      const p = await feedService.createPost({ text: body, media: media.length ? media : undefined, community });
      peerService.publishPost(p);
    }
    if (toNostr && body) {
      const tags = [...new Set((body.match(/#[a-z0-9_]+/gi) ?? []).map((t) => t.slice(1).toLowerCase()))];
      import("@/services/nostrService").then(({ nostrService }) => {
        nostrService.publishNote(body, tags).catch(() => {});
      }).catch(() => {});
    }
    setText(""); setMedia([]); setTarget("ledgr");
    const where = toLedger && toNostr ? "Ledgr + Nostr" : toNostr ? "Nostr" : community ? "the group" : "Ledgr";
    toast(`Posted to ${where} — it's out there forever ✦`, "success");
  }

  const canPost = (!!text.trim() || !!media.length) && !(target === "nostr" && !text.trim());

  // Toolbar icons row
  const toolbarIcons = (
    <>
      <Tooltip title="Attach image"><IconButton size="small" onClick={() => fileRef.current?.click()}><ImageRoundedIcon fontSize="small" /></IconButton></Tooltip>
      <Tooltip title="Add a GIF"><IconButton size="small" onClick={() => setGifOpen(true)}><GifBoxRoundedIcon fontSize="small" /></IconButton></Tooltip>
      <Tooltip title="Share an mp3"><IconButton size="small" onClick={() => audioRef.current?.click()}><AudiotrackRoundedIcon fontSize="small" /></IconButton></Tooltip>
      <Tooltip title="HTML post / embed (map, game, custom)"><IconButton size="small" onClick={() => setHtmlOpen(true)}><CodeRoundedIcon fontSize="small" /></IconButton></Tooltip>
      <Tooltip title="Companion: draft a fresh post"><IconButton size="small" onClick={async () => { const { posts } = await feedService.generate("trending", { moderation }); setText(companionService.draftPost(posts)); }}><AutoFixHighRoundedIcon fontSize="small" /></IconButton></Tooltip>
    </>
  );

  // ── Merged split-button (visibility picker | Post) ──────────────────────────
  // Two halves joined without gap, rounded as a pill, anchored bottom-right.
  // Used on every breakpoint except the smallest phone.
  const splitButton = nostrEnabled ? (
    <Box ref={anchorRef} sx={{ display: "flex", alignItems: "stretch", borderRadius: "8px", overflow: "hidden", border: "1px solid", borderColor: "primary.main", boxShadow: "0 2px 8px rgba(58,155,240,0.18)" }}>
      {/* Left half — visibility picker */}
      <Box
        onClick={() => setTargetOpen((o) => !o)}
        sx={{
          display: "flex", alignItems: "center", gap: 0.25, px: 1.25, cursor: "pointer",
          bgcolor: "rgba(58,155,240,0.07)", borderRight: "1px solid", borderColor: "rgba(58,155,240,0.3)",
          fontSize: 13, fontWeight: 600, color: "text.primary", whiteSpace: "nowrap",
          userSelect: "none",
          "&:hover": { bgcolor: "rgba(58,155,240,0.13)" },
          transition: "background .15s ease",
          minWidth: 0,
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {TARGET_LABELS[target]}
        </span>
        <ArrowDropDownRoundedIcon sx={{ fontSize: 18, flexShrink: 0, color: "primary.main" }} />
      </Box>
      {/* Right half — Post button */}
      <Button
        variant="contained" disableElevation onClick={post} disabled={!canPost}
        sx={{
          borderRadius: 0, px: { xs: 1.75, sm: 2.5 }, fontWeight: 700, fontSize: 14,
          boxShadow: "none", minWidth: 56,
        }}
      >
        Post
      </Button>
      {/* Dropdown for visibility */}
      {targetOpen && (
        <Box
          sx={{
            position: "absolute", bottom: "100%", right: 0, mb: 0.5, zIndex: 1400,
            bgcolor: "background.paper", border: "1px solid var(--bl-line)",
            borderRadius: 2, boxShadow: "0 8px 24px rgba(0,0,0,0.14)", minWidth: 160,
            overflow: "hidden",
          }}
          onMouseLeave={() => setTargetOpen(false)}
        >
          {(["ledgr", "both", "nostr"] as const).map((v) => (
            <Box
              key={v} onClick={() => { setTarget(v); setTargetOpen(false); }}
              sx={{
                px: 2, py: 1, fontSize: 14, cursor: "pointer", fontWeight: target === v ? 700 : 400,
                color: target === v ? "primary.main" : "text.primary",
                "&:hover": { bgcolor: "rgba(58,155,240,0.07)" },
              }}
            >
              {TARGET_LABELS[v]}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  ) : (
    // Nostr disabled — just a plain Post button
    <Button
      variant="contained" disableElevation onClick={post} disabled={!canPost}
      sx={{ borderRadius: "8px", px: 2.5, fontWeight: 700, fontSize: 14 }}
    >
      Post
    </Button>
  );

  return (
    <GlassCard sx={{ mb: 2, p: { xs: 1.5, sm: 2 }, overflow: "hidden" }}>
      <Stack direction="row" spacing={{ xs: 1, sm: 1.5 }}>
        <UserAvatar pk={me?.publicKey ?? ""} name={me?.username ?? "?"} avatar={me?.avatar} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <TextField
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Broadcast to the swarm…  (#tags work, every post is signed)"
            fullWidth multiline minRows={3} maxRows={10} variant="standard"
            InputProps={{ disableUnderline: true, sx: { fontSize: { xs: 16, sm: 18 }, pt: 0.6, pb: 0.6 } }}
          />

          {/* Attached media thumbnails */}
          {media.length > 0 && (
            <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap", alignItems: "center" }}>
              {media.map((m, i) => (
                m.type === "audio"
                  ? <Chip key={i} icon={<AudiotrackRoundedIcon />} label={m.alt || "audio"} onDelete={() => setMedia((x) => x.filter((_, j) => j !== i))} sx={{ bgcolor: "rgba(124,92,255,0.12)" }} />
                  : <Box key={i} component="img" src={m.url} sx={{ width: { xs: 64, sm: 80 }, height: { xs: 64, sm: 80 }, objectFit: "cover", borderRadius: 2, border: "1px solid rgba(58,155,240,0.2)", cursor: "pointer" }} onClick={() => setMedia((x) => x.filter((_, j) => j !== i))} />
              ))}
            </Stack>
          )}

          {/* Bottom toolbar: icons left, split-button right — all viewports ≥ 480px */}
          {!phone && (
            <Stack direction="row" alignItems="center" sx={{ mt: 1.5, gap: 0 }}>
              {/* Icon cluster — no wrapping, shrink if needed */}
              <Stack direction="row" alignItems="center" spacing={0.25} sx={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
                {toolbarIcons}
              </Stack>
              {/* Split button — positioned relative so the dropdown opens upward */}
              <Box sx={{ position: "relative", flexShrink: 0, ml: 1 }}>
                {splitButton}
              </Box>
            </Stack>
          )}
        </Box>
      </Stack>

      {/* Phone icon row (below avatar+text) */}
      {phone && (
        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 1.25, flexWrap: "wrap" }}>
          {toolbarIcons}
        </Stack>
      )}

      {/* Permanent posting warning banner */}
      {showPermanentWarning && (
        <Box
          role="status" aria-live="polite"
          sx={{
            display: "flex", alignItems: "center", gap: 1,
            mt: { xs: 1.25, sm: 1.5 },
            mx: { xs: -1.5, sm: -2 },
            mb: phone ? 0 : { xs: 0, sm: -2 },
            px: { xs: 1.5, sm: 2 }, py: 0.75,
            bgcolor: "rgba(255,243,205,0.98)",
            borderTop: "1px solid rgba(255,235,59,0.32)",
          }}
        >
          <Typography variant="caption" color="text.primary" sx={{ flex: 1, lineHeight: 1.25 }}>
            🔗 Posting is <b>permanent</b> — once it's out, it spreads across the network and can't be unsent or deleted. Post like it's forever, because it is.
          </Typography>
          <IconButton
            size="small" aria-label="Dismiss permanent posting warning"
            onClick={() => { try { localStorage.setItem("composer:permanentWarningDismissed", "1"); } catch {} setShowPermanentWarning(false); }}
            sx={{ mr: -0.5 }}
          >
            <CloseRoundedIcon fontSize="small" />
          </IconButton>
        </Box>
      )}

      {/* Phone action bar — full-bleed bottom bar, two equal halves */}
      {phone && (
        <Box sx={{
          display: "grid",
          gridTemplateColumns: nostrEnabled ? "1fr 1fr" : "1fr",
          mx: -1.5, mb: -1.5,
          mt: showPermanentWarning ? 0 : 1.5,
          borderTop: "1px solid var(--bl-line)",
        }}>
          {nostrEnabled && (
            <Select
              value={target} onChange={(e) => setTarget(e.target.value as "ledgr" | "both" | "nostr")}
              variant="standard" disableUnderline
              sx={{
                height: 52, px: 1.75, fontSize: 13, fontWeight: 600, color: "text.primary",
                bgcolor: "rgba(58,155,240,0.06)", borderRight: "1px solid var(--bl-line)",
                "& .MuiSelect-select": { display: "flex", alignItems: "center", height: "100%", py: 0, pr: 3.5, boxSizing: "border-box" },
                "& .MuiSelect-icon": { right: 8 },
              }}
            >
              <MenuItem value="ledgr">Ledgr only</MenuItem>
              <MenuItem value="both">Ledgr + Nostr</MenuItem>
              <MenuItem value="nostr">Nostr only</MenuItem>
            </Select>
          )}
          <Button
            variant="contained" onClick={post} disabled={!canPost}
            sx={{ height: 52, borderRadius: 0, boxShadow: "none", fontSize: 15, fontWeight: 700 }}
          >
            Post
          </Button>
        </Box>
      )}

      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => attach(e.target.files?.[0])} />
      <input ref={audioRef} type="file" accept="audio/*,.mp3" hidden onChange={(e) => attachAudio(e.target.files?.[0])} />
      <GifPicker open={gifOpen} onClose={() => setGifOpen(false)} onPick={(url) => setMedia((m) => [...m, { type: "image", url, mime: "image/gif" }])} />
      <HtmlComposer open={htmlOpen} onClose={() => setHtmlOpen(false)} onPost={postHtml} />
    </GlassCard>
  );
}
