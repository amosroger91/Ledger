import { useState } from "react";
import { Box, Tooltip, Typography, Dialog, DialogTitle, DialogContent, DialogActions, Button, Stack } from "@mui/material";
import InstallMobileRoundedIcon from "@mui/icons-material/InstallMobileRounded";
import IosShareRoundedIcon from "@mui/icons-material/IosShareRounded";
import AddBoxRoundedIcon from "@mui/icons-material/AddBoxRounded";
import { useInstall } from "@/lib/pwa";
import { toast } from "@/lib/events";

// "Install app" entry for the nav rail. On Android / desktop Chromium it fires
// the native install prompt; on iOS (no such API) it shows the Share → Add to
// Home Screen steps. Hidden entirely once the app is already installed, or when
// the browser offers no install path at all.
export default function InstallButton({ compact }: { compact: boolean }) {
  const { canPrompt, standalone, ios, promptInstall } = useInstall();
  const [iosOpen, setIosOpen] = useState(false);

  if (standalone) return null;          // already installed — nothing to do
  if (!canPrompt && !ios) return null;  // browser can't install (e.g. desktop Firefox)

  async function onClick() {
    if (canPrompt) {
      const outcome = await promptInstall();
      if (outcome === "accepted") toast("Installing Ledger…", "success");
      return;
    }
    setIosOpen(true); // iOS: guide the user through Add to Home Screen
  }

  return (
    <>
      <Tooltip title={compact ? "Install app" : ""} placement="right">
        <Box
          onClick={onClick}
          sx={{
            display: "flex", alignItems: "center", gap: 1.5, px: 1.5, py: 1.1, borderRadius: 2, cursor: "pointer",
            color: "#0a3a7a",
            background: "linear-gradient(135deg,#dcecff,#bcd8ff)", border: "1px solid #8fbdf6",
            boxShadow: "0 4px 12px rgba(58,155,240,.25)", mb: 0.5,
            "&:hover": { background: "linear-gradient(135deg,#eaf3ff,#cfe2ff)" },
            justifyContent: compact ? "center" : "flex-start",
          }}
        >
          <InstallMobileRoundedIcon />
          {!compact && <Typography sx={{ fontWeight: 800 }}>Install app</Typography>}
        </Box>
      </Tooltip>

      <Dialog open={iosOpen} onClose={() => setIosOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Install Ledger on your iPhone</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }} color="text.secondary">
            iOS installs web apps from the Safari share menu. It takes two taps:
          </Typography>
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <IosShareRoundedIcon sx={{ color: "#1668e0" }} />
              <Typography>1. Tap the <b>Share</b> button in Safari's toolbar.</Typography>
            </Stack>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <AddBoxRoundedIcon sx={{ color: "#1668e0" }} />
              <Typography>2. Choose <b>Add to Home Screen</b>, then tap <b>Add</b>.</Typography>
            </Stack>
          </Stack>
          <Typography sx={{ mt: 2 }} variant="caption" color="text.secondary">
            Ledger then opens full-screen, like a native app. Make sure you're in Safari — other iOS browsers can't add to the home screen.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIosOpen(false)}>Got it</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
