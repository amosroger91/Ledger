import { useState } from "react";
import { Box, Stack, Typography, Select, MenuItem, Switch, FormControlLabel, Divider, Button } from "@mui/material";
import QrCode2RoundedIcon from "@mui/icons-material/QrCode2Rounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import InstallMobileRoundedIcon from "@mui/icons-material/InstallMobileRounded";
import GlassCard from "@/components/common/GlassCard";
import DeviceLoginDialog from "@/components/profile/DeviceLoginDialog";
import InstallHelpDialog from "@/components/layout/InstallHelpDialog";
import { useStore } from "@/store/useStore";
import { factCheckService } from "@/services/factCheckService";
import { identityService } from "@/services/identityService";
import type { FeedAlgorithm, ModerationProfile, CompanionPersona, PresenceStatus } from "@/types";
import { toast } from "@/lib/events";

const FEED: FeedAlgorithm[] = ["ai-curated", "chronological", "trending", "discovery", "friends", "community"];
const MOD: ModerationProfile[] = ["discovery", "family-friendly", "academic", "gaming", "unfiltered"];
const PERSONA: CompanionPersona[] = ["friend", "coach", "comedian", "critic", "researcher"];
const STATUS: PresenceStatus[] = ["online", "idle", "away", "dnd"];

export default function SettingsView() {
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const [deviceLogin, setDeviceLogin] = useState(false);
  const [install, setInstall] = useState(false);

  function row(label: string, hint: string, control: React.ReactNode) {
    return (
      <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ sm: "center" }} spacing={1} sx={{ py: 1.2 }}>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontWeight: 600 }}>{label}</Typography>
          <Typography variant="caption" color="text.secondary">{hint}</Typography>
        </Box>
        {control}
      </Stack>
    );
  }

  return (
    <Box sx={{ maxWidth: 760, mx: "auto" }}>
      <Typography variant="h5" sx={{ mb: 2 }}>Settings</Typography>

      <GlassCard sx={{ mb: 2 }}>
        <Typography variant="overline" color="text.secondary">Feed & moderation</Typography>
        {row("Default feed algorithm", "How your feed is ranked — all on-device.",
          <Select size="small" value={settings.feedAlgorithm} onChange={(e) => setSettings({ feedAlgorithm: e.target.value as FeedAlgorithm })}>{FEED.map((f) => <MenuItem key={f} value={f}>{f}</MenuItem>)}</Select>)}
        <Divider />
        {row("Moderation profile", "Layered local filtering. 'Unfiltered' disables Layer 1.",
          <Select size="small" value={settings.moderationProfile} onChange={(e) => setSettings({ moderationProfile: e.target.value as ModerationProfile })}>{MOD.map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}</Select>)}
        <Divider />
        {row("Filter adult content", "Blur explicit images (classified on-device with nsfwjs — the picture never leaves your device) and hide posts with explicit language behind a tap.",
          <Switch checked={settings.filterNsfw} onChange={(e) => { setSettings({ filterNsfw: e.target.checked }); toast(e.target.checked ? "Adult content will be filtered on this device" : "Adult-content filter off", "info"); }} />)}
        <Divider />
        {row("Censor cuss words", "Mask profanity inline (fuck → f**k) instead of hiding it. Works whether or not the filter above is on.",
          <Switch checked={settings.censorProfanity} onChange={(e) => setSettings({ censorProfanity: e.target.checked })} />)}
      </GlassCard>

      <GlassCard sx={{ mb: 2 }}>
        <Typography variant="overline" color="text.secondary">AI companion</Typography>
        {row("Persona", "Your companion's voice & style.",
          <Select size="small" value={settings.companionPersona} onChange={(e) => setSettings({ companionPersona: e.target.value as CompanionPersona })}>{PERSONA.map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}</Select>)}
        <Divider />
        {row("On-device LLM (WebGPU)", "On by default — a real local model (WebLLM) downloads automatically on WebGPU devices, fully private. Turn off to force the fast heuristic engine.",
          <Switch checked={settings.useWebLLM} onChange={(e) => { setSettings({ useWebLLM: e.target.checked, llmOptOut: !e.target.checked }); toast(e.target.checked ? "Local model will download now" : "Using the fast local engine", "info"); }} />)}
      </GlassCard>

      <GlassCard sx={{ mb: 2 }}>
        <Typography variant="overline" color="text.secondary">Presence & motion</Typography>
        {row("Status", "What others on the network see.",
          <Select size="small" value={settings.presenceStatus} onChange={(e) => setSettings({ presenceStatus: e.target.value as PresenceStatus })}>{STATUS.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}</Select>)}
        <Divider />
        <FormControlLabel control={<Switch checked={settings.reducedMotion} onChange={(e) => setSettings({ reducedMotion: e.target.checked })} />} label="Reduce motion (calms the animated background)" sx={{ mt: 1 }} />
        <Divider />
        {row("Pre-load PolitiFact index", "\"Fact-check this\" is always available from a post's ⋯ menu — it's a purely local keyword match against PolitiFact's recent ratings (no AI, nothing sent anywhere). Keep this on to pre-load that index at launch so the first check is instant; off still works, it just loads on first use.",
          <Switch checked={settings.showFactChecks} onChange={(e) => { setSettings({ showFactChecks: e.target.checked }); if (e.target.checked) factCheckService.refresh().catch(() => {}); }} />)}
      </GlassCard>

      <GlassCard sx={{ mb: 2 }}>
        <Typography variant="overline" color="text.secondary">Account & devices</Typography>
        {row("Install on your phone", "Add Ledger to your home screen — opens full-screen like a native app and works offline. Scan a QR to jump to it on your phone, with iOS & Android steps.",
          <Button variant="outlined" startIcon={<InstallMobileRoundedIcon />} onClick={() => setInstall(true)}>Download on phone</Button>)}
        <Divider />
        {row("Log in on another device", "Show a QR / link that copies your whole account to another device — peer-to-peer, nothing on a server.",
          <Button variant="outlined" startIcon={<QrCode2RoundedIcon />} onClick={() => setDeviceLogin(true)}>Log in on another device</Button>)}
        <Divider />
        {row("Download profile data", "Save your full account (keys, avatar, bio, custom page) as a file you can import on another device.",
          <Button variant="outlined" startIcon={<DownloadRoundedIcon />} onClick={() => { identityService.exportFile(); toast("Profile data downloaded", "success"); }}>Download profile data</Button>)}
        <DeviceLoginDialog open={deviceLogin} onClose={() => setDeviceLogin(false)} />
        <InstallHelpDialog open={install} onClose={() => setInstall(false)} />
      </GlassCard>

      <GlassCard>
        <Typography variant="overline" color="text.secondary">Data</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Everything lives in this browser (IndexedDB + localStorage). Clearing site data wipes your local copy — download your profile data first (above).
        </Typography>
        <Button color="error" variant="outlined" sx={{ mt: 1.5 }} onClick={() => { if (confirm("Reset Ledger on this device? This clears local data. Export your identity first!")) { indexedDB.deleteDatabase("nebula"); localStorage.clear(); location.reload(); } }}>
          Reset this device
        </Button>
      </GlassCard>
    </Box>
  );
}
