import { useEffect, useState } from "react";
import { Box, Typography, CircularProgress, Button, Alert, Stack } from "@mui/material";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import { deviceTransferService } from "@/services/deviceTransferService";
import { identityService } from "@/services/identityService";

// Full-screen flow shown when this device opens a "#/link?c=…" QR/link.
// It connects to the other device over P2P, receives the full account, saves
// it, and reloads straight into the feed — signed in with everything intact.
const MSG: Record<string, string> = {
  connecting: "Reaching your other device…",
  waiting: "Waiting for your other device — keep its QR screen open…",
  connected: "Connected — receiving your account…",
  importing: "Setting up this device…",
};

export default function DeviceLinkReceiver({ code, secret }: { code: string; secret: string }) {
  const existing = identityService.current;
  const [confirmNeeded, setConfirmNeeded] = useState(!!existing);
  const [status, setStatus] = useState<string>("connecting");
  const [error, setError] = useState("");
  const [run, setRun] = useState(!existing);

  useEffect(() => {
    if (!run) return;
    setError("");
    deviceTransferService.receive(code, secret, {
      onStatus: setStatus,
      onError: setError,
      onIdentity: async (id) => {
        setStatus("importing");
        try {
          await identityService.importIdentityObject(id);
          // Drop the link from the URL and boot fresh as the received account.
          location.replace(`${location.pathname}${location.search}#/`);
          location.reload();
        } catch {
          setError("Couldn't save the account on this device.");
        }
      },
    });
    return () => deviceTransferService.stopRx();
  }, [run, code, secret]);

  function leave() {
    deviceTransferService.stopRx();
    location.replace(`${location.pathname}${location.search}#/`);
    location.reload();
  }

  return (
    <Box sx={{ position: "fixed", inset: 0, display: "grid", placeItems: "center", p: 2, zIndex: 1400 }}>
      <Box sx={{ width: "100%", maxWidth: 420, bgcolor: "background.paper", borderRadius: 3, border: "1px solid var(--bl-line)", boxShadow: "0 16px 50px rgba(0,0,0,0.25)", p: 3, textAlign: "center" }}>
        <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.5 }}>Link this device</Typography>

        {confirmNeeded ? (
          <>
            <Alert severity="warning" sx={{ textAlign: "left", mt: 1.5 }}>
              This device is already signed in as <b>{existing?.username}</b>. Receiving an account will <b>replace it here</b>. Make sure you've saved its data file first if you need it.
            </Alert>
            <Stack direction="row" spacing={1} justifyContent="center" sx={{ mt: 2 }}>
              <Button variant="text" onClick={leave}>Cancel</Button>
              <Button variant="contained" color="warning" onClick={() => { setConfirmNeeded(false); setRun(true); }}>Replace &amp; receive</Button>
            </Stack>
          </>
        ) : error ? (
          <>
            <Alert severity="error" sx={{ textAlign: "left", mt: 1.5 }}>{error}</Alert>
            <Stack direction="row" spacing={1} justifyContent="center" sx={{ mt: 2 }}>
              <Button variant="text" onClick={leave}>Back</Button>
              <Button variant="contained" onClick={() => { setStatus("connecting"); setRun(false); setTimeout(() => setRun(true), 30); }}>Try again</Button>
            </Stack>
          </>
        ) : (
          <Box sx={{ display: "grid", placeItems: "center", gap: 1.5, py: 3 }}>
            {status === "importing" ? <CheckCircleRoundedIcon sx={{ fontSize: 44, color: "success.main" }} /> : <CircularProgress />}
            <Typography variant="body2" color="text.secondary">{MSG[status] ?? "Linking…"}</Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}
