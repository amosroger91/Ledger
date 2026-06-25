import { useEffect, useMemo, useState, lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Box, Snackbar, Alert, LinearProgress } from "@mui/material";
import { boot } from "@/services";
import { useStore } from "@/store/useStore";
import { bus } from "@/lib/events";
import { isOff } from "@/lib/flags";
import { presenceService } from "@/services/presenceService";
import { identityService } from "@/services/identityService";
import { DEFAULT_SETTINGS } from "@/services/storage";
import Background from "@/components/common/Background";
import Onboarding from "@/components/onboarding/Onboarding";
import DeviceLinkReceiver from "@/components/profile/DeviceLinkReceiver";
import { parseLink } from "@/services/deviceTransferService";
import AppShell from "@/components/layout/AppShell";
import FeedView from "@/components/feed/FeedView";
const CommunitiesView = lazy(() => import("@/components/communities/CommunitiesView"));
const TownSquareView = lazy(() => import("@/components/messages/TownSquareView"));
const GlobalChatView = lazy(() => import("@/components/messages/GlobalChatView"));
const ListenView = lazy(() => import("@/components/listen/ListenView"));
const CompanionView = lazy(() => import("@/components/companion/CompanionView"));
const ProfileView = lazy(() => import("@/components/profile/ProfileView"));
const SettingsView = lazy(() => import("@/components/settings/SettingsView"));
const AboutView = lazy(() => import("@/components/about/AboutView"));
const TopicsView = lazy(() => import("@/components/topics/TopicsView"));
const MarketView = lazy(() => import("@/components/market/MarketView"));
const WalletView = lazy(() => import("@/components/wallet/WalletView"));
const NetworkView = lazy(() => import("@/components/network/NetworkView"));
const PostView = lazy(() => import("@/components/feed/PostView"));
import MiniPlayer from "@/components/layout/MiniPlayer";
import AudioMiniPlayer from "@/components/layout/AudioMiniPlayer";
import GlobalWatchPlayer from "@/components/layout/GlobalWatchPlayer";
import GlobalFeedVideo from "@/components/layout/GlobalFeedVideo";
import ReloadGuardDialog from "@/components/layout/ReloadGuardDialog";
import ImageLightbox from "@/components/layout/ImageLightbox";
import GlobalSpotify from "@/components/layout/GlobalSpotify";
import FloatingDocks from "@/components/layout/FloatingDocks";
import GeoConsent from "@/components/layout/GeoConsent";

export default function App() {
  const { ready, onboarded, setReady, setPresence, setOnlineCount } = useStore();
  const [toast, setToast] = useState<{ kind: any; message: string } | null>(null);
  const [notify, setNotify] = useState<string | null>(null);
  // "#/link?c=…" — another device is sharing its account with this one.
  const deviceLink = useMemo(() => parseLink(window.location.hash), []);

  useEffect(() => {
    let done = false;
    boot()
      .then((r) => { done = true; setReady(r.onboarded, r.settings); })
      .catch((e) => { done = true; console.error("[boot] failed, showing app anyway", e); setReady(!!identityService.current, DEFAULT_SETTINGS); });
    // Safety net: never let a slow/stalled service keep the UI on the splash.
    const fallback = setTimeout(() => { if (!done) setReady(!!identityService.current, DEFAULT_SETTINGS); }, 2500);
    const offToast = bus.on("toast", (t) => setToast(t));
    const offNotify = bus.on("notify", (n) => setNotify(n.text));
    const refresh = () => { setPresence(presenceService.list()); setOnlineCount(presenceService.list().length + 1); };
    const offPres = bus.on("presence:update", refresh);
    const offConn = bus.on("peer:connected", refresh);
    const offDis = bus.on("peer:disconnected", refresh);
    const timer = setInterval(refresh, 20000);
    return () => { offToast(); offNotify(); offPres(); offConn(); offDis(); clearInterval(timer); clearTimeout(fallback); };
  }, [setReady, setPresence, setOnlineCount]);

  return (
    <Box sx={{ minHeight: "100vh", position: "relative" }}>
      {!isOff("background") && <Background />}
      {/* AiSplash removed: WebLLM now loads on demand (not on boot), so a launch-time
          download overlay would just cover the app for its 30s safety timeout. */}
      {ready && deviceLink && <DeviceLinkReceiver code={deviceLink.code} secret={deviceLink.secret} />}
      {ready && !deviceLink && !onboarded && <Onboarding />}
      {ready && !deviceLink && onboarded && (
        <AppShell>
          <Suspense fallback={<LinearProgress sx={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 9999 }} />}>
            <Routes>
              <Route path="/" element={<FeedView />} />
              <Route path="/post/:id" element={<PostView />} />
              <Route path="/communities" element={<CommunitiesView />} />
              <Route path="/messages" element={<TownSquareView />} />
              <Route path="/chatroom" element={<TownSquareView />} />
              <Route path="/global-chat" element={<GlobalChatView />} />
              <Route path="/listen" element={<ListenView />} />
              <Route path="/companion" element={<CompanionView />} />
              <Route path="/topics" element={<TopicsView />} />
              <Route path="/market" element={<MarketView />} />
              <Route path="/wallet" element={<WalletView />} />
              <Route path="/network" element={<NetworkView />} />
              <Route path="/profile" element={<ProfileView />} />
              <Route path="/u/:pk" element={<ProfileView />} />
              <Route path="/settings" element={<SettingsView />} />
              <Route path="/about" element={<AboutView />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </AppShell>
      )}
      {ready && onboarded && <ImageLightbox />}
      {ready && onboarded && !isOff("players") && (
        <>
          <GlobalWatchPlayer />
          <GlobalFeedVideo />
          <ReloadGuardDialog />
          <GlobalSpotify />
          <MiniPlayer />
          <AudioMiniPlayer />
          <FloatingDocks />
          <GeoConsent />
        </>
      )}
      <Snackbar
        open={!!notify}
        autoHideDuration={4000}
        onClose={() => setNotify(null)}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        {notify ? (
          <Alert severity="info" variant="filled" icon={<span>✨</span>} onClose={() => setNotify(null)}
            sx={{ background: "linear-gradient(135deg,#3f97ff,#1668e0)", color: "#ffffff", fontWeight: 600 }}>
            {notify}
          </Alert>
        ) : undefined}
      </Snackbar>
      <Snackbar
        open={!!toast}
        autoHideDuration={3200}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        {toast ? (
          <Alert severity={toast.kind === "warn" ? "warning" : toast.kind} variant="filled" onClose={() => setToast(null)}>
            {toast.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Box>
  );
}
