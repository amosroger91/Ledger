import { useState, useEffect, useRef } from "react";
import { Stack, Box, Typography, IconButton, Chip, Popover, Tooltip, TextField, Button } from "@mui/material";
import AddReactionRoundedIcon from "@mui/icons-material/AddReactionRounded";
import VerifiedRoundedIcon from "@mui/icons-material/VerifiedRounded";
import ReplyRoundedIcon from "@mui/icons-material/ReplyRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import GavelRoundedIcon from "@mui/icons-material/GavelRounded";
import { Menu, MenuItem, LinearProgress } from "@mui/material";
import { linkPreviewService, type Preview } from "@/services/linkPreviewService";
import { trustService } from "@/services/trustService";
import { emojify } from "@/lib/emoticons";
import { bus, toast } from "@/lib/events";
import { newId } from "@/lib/id";
import type { ModerationVerdict } from "@/types";
import GlassCard from "@/components/common/GlassCard";
import WhyRecommended from "./WhyRecommended";
import UserAvatar from "@/components/common/UserAvatar";
import { relativeTime } from "@/lib/time";
import { feedService } from "@/services/feedService";
import { peerService } from "@/services/peerService";
import { useNavigate } from "react-router-dom";
import { useStore } from "@/store/useStore";
import type { Post, RecommendationReason } from "@/types";

const REACTIONS = ["⭐", "🔥", "🚀", "💜", "😂", "👀"];

const YT_RE = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/i;
const IMG_RE = /\.(png|jpe?g|gif|webp|avif|bmp|svg)(\?[^\s]*)?$/i;
// Spotify share links: track / album / playlist / episode / show.
const SPOTIFY_RE = /open\.spotify\.com\/(?:intl-[a-z]+\/)?(track|album|playlist|episode|show|artist)\/([A-Za-z0-9]+)/i;
function firstYouTube(text: string): string | null { return text.match(YT_RE)?.[1] ?? null; }
function firstSpotify(text: string): { kind: string; id: string } | null {
  const m = text.match(SPOTIFY_RE);
  return m ? { kind: m[1].toLowerCase(), id: m[2] } : null;
}
function firstLink(text: string): string | null {
  const urls = text.match(/https?:\/\/[^\s]+/g) ?? [];
  return urls.find((u) => !IMG_RE.test(u) && !YT_RE.test(u) && !SPOTIFY_RE.test(u)) ?? null;
}

// Spotify embed — an official inline player. The compact 80px height is used
// for a single track; collections get the taller 380px playlist player.
function SpotifyCard({ kind, id }: { kind: string; id: string }) {
  const tall = kind === "playlist" || kind === "album" || kind === "show";
  return (
    <Box sx={{ mt: 1, borderRadius: 1.5, overflow: "hidden", border: "1px solid var(--bl-line)" }}>
      <Box component="iframe" title="Spotify" loading="lazy"
        src={`https://open.spotify.com/embed/${kind}/${id}?utm_source=zuccbook`}
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        sx={{ width: "100%", height: tall ? 380 : 80, border: 0, display: "block" }} />
    </Box>
  );
}

// Click-to-play YouTube card. The thumbnail is derived from the video id
// (always valid) with an <img> + onError fallback, rather than trusting the
// RSS feed's media URL which is sometimes not an image.
function YouTubeCard({ id }: { id: string }) {
  const [play, setPlay] = useState(false);
  const cid = useRef(newId());
  // play exclusivity: stop if some other media starts
  useEffect(() => bus.on("media:play", ({ id }) => { if (id !== cid.current) setPlay(false); }), []);
  const start = () => { setPlay(true); bus.emit("media:play", { id: cid.current }); };
  return (
    <Box sx={{ position: "relative", pt: "56.25%", mt: 1, borderRadius: 1, overflow: "hidden", border: "1px solid var(--bl-line)", bgcolor: "#000" }}>
      {play ? (
        <Box component="iframe" src={`https://www.youtube.com/embed/${id}?autoplay=1&rel=0`} title="YouTube" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen sx={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }} />
      ) : (
        <Box onClick={start} sx={{ position: "absolute", inset: 0, cursor: "pointer" }}>
          <Box component="img" src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" loading="lazy"
            onError={(e) => { const t = e.currentTarget as HTMLImageElement; if (!t.dataset.fb) { t.dataset.fb = "1"; t.src = `https://i.ytimg.com/vi/${id}/mqdefault.jpg`; } }}
            sx={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
          <Box sx={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
            <Box sx={{ width: 64, height: 46, borderRadius: 2, bgcolor: "rgba(0,0,0,0.72)", display: "grid", placeItems: "center" }}><PlayArrowRoundedIcon sx={{ color: "#fff", fontSize: 36 }} /></Box>
          </Box>
        </Box>
      )}
    </Box>
  );
}

// Open-Graph link preview card for any shared link.
function LinkCard({ url }: { url: string }) {
  const [d, setD] = useState<Preview | null>(null);
  useEffect(() => { let on = true; linkPreviewService.preview(url).then((p) => on && setD(p)).catch(() => {}); return () => { on = false; }; }, [url]);
  let host = url; try { host = new URL(url).hostname.replace(/^www\./, ""); } catch {}
  return (
    <Box component="a" href={url} target="_blank" rel="noopener noreferrer" sx={{ display: "block", mt: 1, border: "1px solid var(--bl-line)", borderRadius: 1, overflow: "hidden", textDecoration: "none", color: "inherit", bgcolor: "var(--bl-white)" }}>
      {d?.image && <Box component="img" src={d.image} loading="lazy" sx={{ width: "100%", maxHeight: 240, objectFit: "cover", display: "block" }} />}
      <Box sx={{ p: 1 }}>
        <Typography variant="caption" color="text.secondary">{d?.site || host}</Typography>
        <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>{d?.title || host}</Typography>
        {d?.description && <Typography variant="caption" color="text.secondary" sx={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{d.description}</Typography>}
      </Box>
    </Box>
  );
}

// Render text with clickable links (used for RSS Bot story links, etc.).
// Non-link spans get ASCII emoticons translated to real emoji.
function renderText(text: string) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return parts.map((p, i) =>
    /^https?:\/\//.test(p)
      ? <a key={i} href={p} target="_blank" rel="noopener noreferrer" style={{ color: "#0a55cf", wordBreak: "break-all" }}>{p}</a>
      : <span key={i}>{emojify(p)}</span>,
  );
}

function ReactRow({ post, me, onAdd }: { post: Post; me: string; onAdd: (el: HTMLElement, id: string) => void }) {
  return (
    <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 1, flexWrap: "wrap", gap: 0.5 }}>
      {Object.entries(post.reactions).filter(([, v]) => v.length).map(([emoji, voters]) => (
        <Chip key={emoji} size="small" label={`${emoji} ${voters.length}`} onClick={() => feedService.react(post.id, emoji)}
          sx={{ bgcolor: voters.includes(me) ? "rgba(58,155,240,0.2)" : "rgba(0,0,0,0.04)", cursor: "pointer" }} />
      ))}
      <IconButton size="small" onClick={(e) => onAdd(e.currentTarget, post.id)}><AddReactionRoundedIcon fontSize="small" /></IconButton>
    </Stack>
  );
}

// Transparency popover — the moderation verdict, its signals and confidence.
function ModInfo({ verdict }: { verdict: ModerationVerdict }) {
  const [a, setA] = useState<HTMLElement | null>(null);
  const color = verdict.action === "flag" ? "#d23b2f" : verdict.action === "reduce" || verdict.action === "review" ? "#e8920c" : "#51606e";
  return (
    <>
      <Chip size="small" variant="outlined" icon={<GavelRoundedIcon />} label={verdict.action} onClick={(e) => setA(e.currentTarget)} sx={{ height: 20, fontSize: 10, color, borderColor: color, cursor: "pointer" }} />
      <Popover open={!!a} anchorEl={a} onClose={() => setA(null)} anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}>
        <Box sx={{ p: 1.5, width: 300 }}>
          <Typography variant="subtitle2">Moderation · {verdict.action}</Typography>
          <Typography variant="caption" color="text.secondary">{verdict.reasoning} — {Math.round(verdict.confidence * 100)}% confidence · advisory, you decide.</Typography>
          <Stack spacing={0.75} sx={{ mt: 1 }}>
            {verdict.signals.slice(0, 6).map((s, i) => (
              <Box key={i}>
                <Stack direction="row" justifyContent="space-between"><Typography variant="caption">{s.label}{s.detail ? ` — ${s.detail}` : ""}</Typography><Typography variant="caption" sx={{ color: s.weight < 0 ? "success.main" : "text.secondary" }}>{s.weight >= 0 ? "+" : ""}{s.weight.toFixed(2)}</Typography></Stack>
                <LinearProgress variant="determinate" value={Math.min(100, Math.abs(s.weight) * 80)} sx={{ height: 4, borderRadius: 2, opacity: s.weight < 0 ? 0.5 : 1 }} />
              </Box>
            ))}
          </Stack>
        </Box>
      </Popover>
    </>
  );
}

export default function PostCard({ post, reason, replies = [], verdict }: { post: Post; reason?: RecommendationReason; replies?: Post[]; verdict?: ModerationVerdict }) {
  const me = useStore((s) => s.me);
  const mePk = me?.publicKey ?? "";
  const nav = useNavigate();
  const canVisit = !!post.author && post.author !== "rss-bot" && post.author !== "system" && !post.author.startsWith("demo_");
  const visit = () => canVisit && nav(`/u/${post.author}`);
  const [react, setReact] = useState<{ el: HTMLElement; id: string } | null>(null);
  const [showReplies, setShowReplies] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [authMenu, setAuthMenu] = useState<HTMLElement | null>(null);
  const restricted = !!verdict && (verdict.action === "reduce" || verdict.action === "review" || verdict.action === "flag");

  async function trust(kind: "vouch" | "report" | "mute") {
    setAuthMenu(null);
    await trustService[kind](post.author);
    toast(kind === "vouch" ? `Vouched for ${post.authorName}` : kind === "mute" ? `Muted ${post.authorName}` : `Reported ${post.authorName}`, kind === "vouch" ? "success" : "info");
    bus.emit("feed:updated", undefined); // re-evaluate the feed with the new trust signal
  }

  const sourceColor = post.source === "self" ? "#54c95a" : post.source === "relay" || post.source === "peer" ? "#3f97ff" : "#7a85a8";

  async function sendReply() {
    const t = replyText.trim();
    if (!t) return;
    const p = await feedService.createPost({ text: t, replyTo: post.id });
    peerService.publishPost(p);
    setReplyText(""); setShowReplies(true);
  }

  return (
    <GlassCard sx={{ mb: 1.5 }}>
      <Stack direction="row" spacing={1.5}>
        <Box onClick={visit} sx={{ cursor: canVisit ? "pointer" : "default" }}>
          <UserAvatar pk={post.author} name={post.authorName} avatar={post.authorAvatar} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography onClick={visit} sx={{ fontWeight: 700, cursor: canVisit ? "pointer" : "default", "&:hover": canVisit ? { textDecoration: "underline" } : {} }} noWrap>{post.authorName}</Typography>
            {post.author === "rss-bot"
              ? <Chip size="small" label="BOT" sx={{ height: 16, fontSize: 9, bgcolor: "rgba(58,123,240,0.2)", color: "#0a55cf" }} />
              : <Tooltip title="Cryptographically signed by author"><VerifiedRoundedIcon sx={{ fontSize: 15, color: "#3f97ff" }} /></Tooltip>}
            <Typography variant="caption" color="text.secondary">· {relativeTime(post.createdAt)}</Typography>
            <Box sx={{ flex: 1 }} />
            <Chip size="small" label={post.source} sx={{ height: 18, fontSize: 10, color: sourceColor, borderColor: sourceColor }} variant="outlined" />
            {verdict && verdict.action !== "allow" && <ModInfo verdict={verdict} />}
            <WhyRecommended reason={reason} />
            {canVisit && <IconButton size="small" onClick={(e) => setAuthMenu(e.currentTarget)}><MoreVertRoundedIcon fontSize="small" /></IconButton>}
          </Stack>

          {restricted && !revealed && (
            <Box sx={{ mt: 1, p: 1.5, borderRadius: 1, bgcolor: "rgba(232,146,12,0.08)", border: "1px solid rgba(232,146,12,0.45)" }}>
              <Typography variant="body2"><b>{verdict!.action === "flag" ? "Flagged" : verdict!.action === "review" ? "Pending community review" : "Reduced"}</b> — {verdict!.reasoning}</Typography>
              <Typography variant="caption" color="text.secondary">Advisory · {Math.round(verdict!.confidence * 100)}% confidence · the network didn't delete it — you decide.</Typography>
              <Box><Button size="small" sx={{ mt: 0.5 }} onClick={() => setRevealed(true)}>Show anyway</Button></Box>
            </Box>
          )}

          {(!restricted || revealed) && (<>
          {post.text && <Typography component="div" sx={{ mt: 0.5, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{renderText(post.text)}</Typography>}

          {(() => {
            const ytId = firstYouTube(post.text ?? "");
            const spotify = ytId ? null : firstSpotify(post.text ?? "");
            const linkUrl = ytId || spotify ? null : firstLink(post.text ?? "");
            if (ytId) return <YouTubeCard id={ytId} />;
            if (spotify) return <SpotifyCard kind={spotify.kind} id={spotify.id} />;
            if (linkUrl) return <LinkCard url={linkUrl} />;
            // uploaded images (no link in text)
            return post.media?.map((m, i) => (m.type === "image" ? <Box key={i} component="img" src={m.url} sx={{ mt: 1, maxWidth: "100%", maxHeight: 360, borderRadius: 2, border: "1px solid var(--bl-line)" }} /> : null));
          })()}

          {post.poll && (
            <Stack spacing={0.5} sx={{ mt: 1 }}>
              <Typography variant="subtitle2">{post.poll.question}</Typography>
              {post.poll.options.map((o) => (
                <Box key={o.id} sx={{ px: 1.5, py: 0.75, borderRadius: 1.5, border: "1px solid rgba(58,155,240,0.2)" }}>
                  <Typography variant="body2">{o.label} · {o.votes.length}</Typography>
                </Box>
              ))}
            </Stack>
          )}

          {post.tags.length > 0 && (
            <Stack direction="row" spacing={0.5} sx={{ mt: 1, flexWrap: "wrap", gap: 0.5 }}>
              {post.tags.map((t) => <Chip key={t} size="small" label={"#" + t} sx={{ bgcolor: "rgba(58,123,240,0.12)", color: "#1668e0" }} />)}
            </Stack>
          )}

          <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 0.5 }}>
            <Box sx={{ flex: 1 }}><ReactRow post={post} me={mePk} onAdd={(el, id) => setReact({ el, id })} /></Box>
            <Button size="small" startIcon={<ReplyRoundedIcon fontSize="small" />} onClick={() => setShowReplies((v) => !v)} sx={{ color: "text.secondary", flex: "0 0 auto" }}>
              {replies.length ? `${replies.length} ` : ""}Reply
            </Button>
          </Stack>

          {showReplies && (
            <Box sx={{ mt: 1, pl: 2, borderLeft: "2px solid rgba(58,155,240,0.25)" }}>
              {replies.map((r) => (
                <Stack key={r.id} direction="row" spacing={1} sx={{ mb: 1 }}>
                  <UserAvatar pk={r.author} name={r.authorName} avatar={r.authorAvatar} size={26} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>{r.authorName}</Typography>
                      <Typography variant="caption" color="text.secondary">· {relativeTime(r.createdAt)}</Typography>
                    </Stack>
                    {r.text && <Typography component="div" variant="body2" sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{renderText(r.text)}</Typography>}
                    {r.media?.map((m, i) => m.type === "image" ? <Box key={i} component="img" src={m.url} sx={{ mt: 0.5, maxWidth: "100%", maxHeight: 240, borderRadius: 1.5 }} /> : null)}
                    <ReactRow post={r} me={mePk} onAdd={(el, id) => setReact({ el, id })} />
                  </Box>
                </Stack>
              ))}
              <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                <TextField fullWidth size="small" placeholder={`Reply to ${post.authorName}…`} value={replyText} onChange={(e) => setReplyText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendReply()} />
                <Button variant="contained" onClick={sendReply} disabled={!replyText.trim()}>Reply</Button>
              </Stack>
            </Box>
          )}
          </>)}
        </Box>
      </Stack>

      <Menu open={!!authMenu} anchorEl={authMenu} onClose={() => setAuthMenu(null)}>
        <MenuItem onClick={() => trust("vouch")}>🤝 Vouch for {post.authorName}</MenuItem>
        <MenuItem onClick={() => trust("report")}>🚩 Report</MenuItem>
        <MenuItem onClick={() => trust("mute")}>🔇 Mute — hide from your feed</MenuItem>
        <MenuItem onClick={() => { setAuthMenu(null); visit(); }}>👤 View profile</MenuItem>
      </Menu>

      <Popover open={!!react} anchorEl={react?.el} onClose={() => setReact(null)}>
        <Stack direction="row" sx={{ p: 1 }}>
          {REACTIONS.map((e) => (
            <IconButton key={e} onClick={() => { if (react) feedService.react(react.id, e); setReact(null); }}>
              <span style={{ fontSize: 20 }}>{e}</span>
            </IconButton>
          ))}
        </Stack>
      </Popover>
    </GlassCard>
  );
}
