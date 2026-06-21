import { useEffect, useRef, useState } from "react";
import { Box, Stack, Typography, TextField, Button, Avatar, Chip, LinearProgress, Grid, Tooltip } from "@mui/material";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import GlassCard from "@/components/common/GlassCard";
import { identityService } from "@/services/identityService";
import { reputationService, BADGES } from "@/services/reputationService";
import { useStore } from "@/store/useStore";
import UserAvatar from "@/components/common/UserAvatar";
import { compressAvatar } from "@/lib/image";
import { presenceService } from "@/services/presenceService";
import { fingerprint } from "@/lib/crypto";
import { toast } from "@/lib/events";

export default function ProfileView() {
  const me = useStore((s) => s.me);
  const refreshMe = useStore((s) => s.refreshMe);
  const [username, setUsername] = useState(me?.username ?? "");
  const [bio, setBio] = useState(me?.bio ?? "");
  const [rep, setRep] = useState(0);
  const [breakdown, setBreakdown] = useState<Record<string, number>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const avatarRef = useRef<HTMLInputElement>(null);

  useEffect(() => { reputationService.total().then(setRep); reputationService.breakdown().then(setBreakdown); }, []);

  async function setPhoto(file?: File) {
    if (!file) return;
    try {
      const dataUrl = await compressAvatar(file);
      await identityService.update({ avatar: dataUrl });
      refreshMe(); presenceService.announceSelf(); toast("Photo updated", "success");
    } catch { toast("Couldn't load that image", "error"); }
  }
  async function removePhoto() { await identityService.update({ avatar: "" }); refreshMe(); presenceService.announceSelf(); }

  async function save() { await identityService.update({ username: username.trim() || me!.username, bio }); refreshMe(); toast("Profile saved", "success"); }
  async function importId(file?: File) {
    if (!file) return;
    try { await identityService.importFile(file); refreshMe(); toast("Identity replaced on this device", "success"); }
    catch { toast("Invalid identity file", "error"); }
  }

  const rank = reputationService.rank(rep);
  const next = reputationService.nextRank(rep);
  const badges = me?.badges ?? [];

  return (
    <Box sx={{ maxWidth: 880, mx: "auto" }}>
      <GlassCard sx={{ mb: 2 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <Box sx={{ position: "relative", cursor: "pointer", width: 80, height: 80 }} onClick={() => avatarRef.current?.click()} title="Change photo">
            <UserAvatar pk={me?.publicKey ?? ""} name={me?.username ?? "?"} avatar={me?.avatar} size={80} />
            <Box sx={{ position: "absolute", inset: 0, borderRadius: "50%", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700, color: "#fff", background: "rgba(0,0,0,0.5)", opacity: 0, transition: "opacity .2s", "&:hover": { opacity: 1 } }}>Change</Box>
          </Box>
          <input ref={avatarRef} type="file" accept="image/*" hidden onChange={(e) => setPhoto(e.target.files?.[0])} />
          <Box sx={{ flex: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="h5">{me?.username}</Typography>
              <Chip size="small" label={rank} sx={{ background: "linear-gradient(135deg,#3f97ff,#1668e0)", color: "#ffffff", fontWeight: 700 }} />
            </Stack>
            <Tooltip title={me?.publicKey ?? ""}>
              <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace" }}>id {fingerprint(me?.publicKey ?? "")}</Typography>
            </Tooltip>
            <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
              <Box><Typography variant="h6">{rep}</Typography><Typography variant="caption" color="text.secondary">reputation</Typography></Box>
              <Box><Typography variant="h6">{badges.length}</Typography><Typography variant="caption" color="text.secondary">badges</Typography></Box>
            </Stack>
            {next && (
              <Box sx={{ mt: 1, maxWidth: 320 }}>
                <Typography variant="caption" color="text.secondary">{next.remaining} to {next.name}</Typography>
                <LinearProgress variant="determinate" value={Math.min(100, (rep / (rep + next.remaining)) * 100)} sx={{ height: 6, borderRadius: 3, mt: 0.5 }} />
              </Box>
            )}
          </Box>
        </Stack>
      </GlassCard>

      <Grid container spacing={2}>
        <Grid item xs={12} md={7}>
          <GlassCard>
            <Typography variant="overline" color="text.secondary">Edit profile</Typography>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField label="Display name" value={username} onChange={(e) => setUsername(e.target.value)} fullWidth />
              <TextField label="Bio" value={bio} onChange={(e) => setBio(e.target.value)} fullWidth multiline minRows={2} />
              <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
                <Button variant="contained" onClick={save}>Save</Button>
                <Button variant="outlined" onClick={() => avatarRef.current?.click()}>Upload photo</Button>
                {me?.avatar && <Button variant="text" color="inherit" onClick={removePhoto}>Remove photo</Button>}
                <Button variant="outlined" startIcon={<DownloadRoundedIcon />} onClick={() => identityService.exportFile()}>Export identity</Button>
                <Button variant="text" onClick={() => fileRef.current?.click()}>Import</Button>
                <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => importId(e.target.files?.[0])} />
              </Stack>
              <Typography variant="caption" color="text.secondary">🔐 Export saves your private key as a file. Keep it safe — it IS your account. Import it on any device to be you there.</Typography>
            </Stack>
          </GlassCard>
        </Grid>
        <Grid item xs={12} md={5}>
          <GlassCard sx={{ mb: 2 }}>
            <Typography variant="overline" color="text.secondary">Reputation breakdown</Typography>
            <Stack spacing={1} sx={{ mt: 1 }}>
              {["helpful", "expertise", "participation", "trust"].map((k) => (
                <Box key={k}>
                  <Stack direction="row" justifyContent="space-between"><Typography variant="body2" sx={{ textTransform: "capitalize" }}>{k}</Typography><Typography variant="caption">{breakdown[k] ?? 0}</Typography></Stack>
                  <LinearProgress variant="determinate" value={Math.min(100, ((breakdown[k] ?? 0) / Math.max(1, rep)) * 100)} sx={{ height: 5, borderRadius: 3 }} />
                </Box>
              ))}
            </Stack>
          </GlassCard>
          <GlassCard>
            <Typography variant="overline" color="text.secondary">Badges</Typography>
            <Stack direction="row" sx={{ mt: 1, flexWrap: "wrap", gap: 1 }}>
              {badges.map((b) => { const def = BADGES[b]; return <Tooltip key={b} title={def?.description ?? b}><Chip label={`${def?.icon ?? "🏅"} ${def?.label ?? b}`} /></Tooltip>; })}
              {badges.length === 0 && <Typography variant="caption" color="text.secondary">Earn badges by participating.</Typography>}
            </Stack>
          </GlassCard>
        </Grid>
      </Grid>
    </Box>
  );
}
