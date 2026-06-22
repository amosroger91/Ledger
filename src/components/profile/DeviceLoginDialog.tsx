import { useEffect, useRef, useState } from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography, TextField, IconButton, Tooltip, Alert, CircularProgress, Divider, Chip } from "@mui/material";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import QRCode from "qrcode";
import { identityService } from "@/services/identityService";
import { deviceTransferService, type HostHandle, type HostStatus } from "@/services/deviceTransferService";
import { toast } from "@/lib/events";

// "Log in on another device." The logged-in device hosts a one-time P2P link;
// the QR carries only a short code + secret (tiny, easy to scan). When the new
// device connects, the FULL profile — keys, avatar, bio, custom HTML — streams
// straight over WebRTC, so your whole account moves, not just your name.
const HOST_MSG: Record<HostStatus, string> = {
  starting: "Setting up a secure link…",
  ready: "Scan this on your other device — keep this open.",
  linking: "Your other device connected — sending your account…",
  sent: "Sent! Your other device is signing in.",
  error: "Couldn't set up the link. Use the data file below instead.",
};

export default function DeviceLoginDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [url, setUrl] = useState("");
  const [qr, setQr] = useState("");
  const [status, setStatus] = useState<HostStatus>("starting");
  const handleRef = useRef<HostHandle | null>(null);

  useEffect(() => {
    if (!open) return;
    setQr(""); setUrl(""); setStatus("starting");
    const handle = deviceTransferService.host((s) => {
      setStatus(s);
      if (s === "ready") {
        const link = handle.link();
        setUrl(link);
        QRCode.toDataURL(link, { errorCorrectionLevel: "M", margin: 1, width: 360 }).then(setQr).catch(() => {});
      }
    });
    handleRef.current = handle;
    return () => { handle.stop(); handleRef.current = null; };
  }, [open]);

  function copy() { navigator.clipboard?.writeText(url).then(() => toast("Link copied", "success")).catch(() => {}); }
  function download() { identityService.exportFile(); toast("Profile data downloaded", "success"); }

  const sent = status === "sent";

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { backgroundImage: "none" } }}>
      <DialogTitle sx={{ pb: 0.5 }}>Log in on another device</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          On your other device, scan this code (phone camera) or open the link. Your <b>whole profile</b> — avatar, bio and custom page — transfers directly, peer-to-peer.
        </Typography>

        <Box sx={{ display: "grid", placeItems: "center", minHeight: 240, gap: 1 }}>
          {sent ? (
            <Box sx={{ textAlign: "center" }}>
              <CheckCircleRoundedIcon sx={{ fontSize: 56, color: "success.main" }} />
              <Typography sx={{ fontWeight: 700, mt: 1 }}>{HOST_MSG.sent}</Typography>
            </Box>
          ) : qr ? (
            <>
              <Box component="img" src={qr} alt="Device link QR" sx={{ width: 230, height: 230, borderRadius: 2, border: "1px solid var(--bl-line)" }} />
              <Chip size="small" color={status === "linking" ? "primary" : "default"} label={HOST_MSG[status]} sx={{ maxWidth: "100%", height: "auto", "& .MuiChip-label": { whiteSpace: "normal", py: 0.5, textAlign: "center" } }} />
            </>
          ) : (
            <Box sx={{ textAlign: "center" }}>
              <CircularProgress />
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>{HOST_MSG[status]}</Typography>
            </Box>
          )}
        </Box>

        {!sent && qr && (
          <>
            <Typography variant="overline" color="text.secondary" sx={{ display: "block", mt: 1 }}>Or open this link on the other device</Typography>
            <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
              <TextField fullWidth size="small" value={url} InputProps={{ readOnly: true, sx: { fontSize: 12, fontFamily: "monospace" } }} onFocus={(e) => e.target.select()} />
              <Tooltip title="Copy"><IconButton onClick={copy}><ContentCopyRoundedIcon fontSize="small" /></IconButton></Tooltip>
            </Box>
          </>
        )}

        <Divider sx={{ my: 2 }}>or</Divider>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          <b>No second screen handy?</b> Download your profile data file and import it on the other device from the welcome screen ("Import an identity file"). The file holds your entire account.
        </Typography>
        <Button fullWidth variant="outlined" startIcon={<DownloadRoundedIcon />} onClick={download}>Download my profile data</Button>

        <Alert severity="warning" sx={{ mt: 2 }}>
          <b>Treat the link and the data file like your password.</b> Anyone who has either gets full control of your account — it carries your private key. Only use them on devices you own.
        </Alert>
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Done</Button></DialogActions>
    </Dialog>
  );
}
