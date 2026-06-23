import { useEffect, useState } from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box } from "@mui/material";
import YouTubeIcon from "@mui/icons-material/YouTube";
import { activeVideo } from "@/lib/watchGuard";
import { bypassUnloadGuard } from "@/lib/unloadGuard";
import { openOnYouTube } from "@/lib/youtube";

const fmt = (s: number) => {
  s = Math.max(0, Math.floor(s || 0));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
};

/** The browser's native beforeunload prompt can't be customised (it's a fixed
 *  "Reload site?" string for anti-abuse reasons). So for the one lossy action we
 *  *can* intercept before it happens — a keyboard refresh (F5 / Ctrl/Cmd+R) — we
 *  swallow the keystroke and show this richer confirmation instead: what's
 *  playing, where you are in it, and a one-click jump to YouTube at that moment.
 *  The native prompt remains the backstop for the reload button / tab close. */
export default function ReloadGuardDialog() {
  const [info, setInfo] = useState<{ videoId: string | null; time: number; title: string } | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isReload = e.key === "F5" || ((e.ctrlKey || e.metaKey) && (e.key === "r" || e.key === "R"));
      if (!isReload || e.altKey) return;
      const v = activeVideo();
      if (!v) return; // nothing playing → let the browser reload normally
      e.preventDefault();
      e.stopPropagation();
      setInfo({ videoId: v.getVideoId(), time: v.getTime(), title: v.getTitle() });
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  if (!info) return null;
  const close = () => setInfo(null);
  const reloadAnyway = () => { bypassUnloadGuard(); window.location.reload(); };

  return (
    <Dialog open onClose={close} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>Reload the page?</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary">
          You're watching {info.title ? <b>“{info.title}”</b> : "a video"} at <b>{fmt(info.time)}</b>.
          Reloading will lose your place here — open it on YouTube first if you want to keep going.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ flexWrap: "wrap", gap: 1, px: 3, pb: 2 }}>
        <Button startIcon={<YouTubeIcon />} onClick={() => { openOnYouTube(info.videoId, info.time); close(); }}>
          Open on YouTube
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button color="inherit" onClick={reloadAnyway}>Reload anyway</Button>
        <Button variant="contained" onClick={close}>Keep watching</Button>
      </DialogActions>
    </Dialog>
  );
}
