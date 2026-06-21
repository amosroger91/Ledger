import type { ReactNode } from "react";
import { Box, Stack, Typography, Tooltip, IconButton, Chip, Avatar, Divider, useMediaQuery } from "@mui/material";
import { useNavigate, useLocation } from "react-router-dom";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import ChatRoundedIcon from "@mui/icons-material/ChatRounded";
import ForumRoundedIcon from "@mui/icons-material/ForumRounded";
import HeadphonesRoundedIcon from "@mui/icons-material/HeadphonesRounded";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import RssFeedRoundedIcon from "@mui/icons-material/RssFeedRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import { useStore } from "@/store/useStore";
import UserAvatar from "@/components/common/UserAvatar";
import PresenceList from "@/components/layout/PresenceList";

const NAV = [
  { to: "/", label: "Feed", icon: <HomeRoundedIcon /> },
  { to: "/communities", label: "Communities", icon: <GroupsRoundedIcon /> },
  { to: "/messages", label: "Messages", icon: <ChatRoundedIcon /> },
  { to: "/chatroom", label: "Chatroom", icon: <ForumRoundedIcon /> },
  { to: "/listen", label: "Watch & Listen", icon: <HeadphonesRoundedIcon /> },
  { to: "/companion", label: "Companion", icon: <AutoAwesomeRoundedIcon /> },
  { to: "/topics", label: "Topics", icon: <RssFeedRoundedIcon /> },
  { to: "/profile", label: "Profile", icon: <PersonRoundedIcon /> },
  { to: "/settings", label: "Settings", icon: <SettingsRoundedIcon /> },
];

const STATUS_COLOR: Record<string, string> = { online: "#54c95a", idle: "#ffcc66", away: "#ff9a5d", dnd: "#ff5d7a", offline: "#7a85a8" };

export default function AppShell({ children }: { children: ReactNode }) {
  const nav = useNavigate();
  const { pathname } = useLocation();
  const me = useStore((s) => s.me);
  const onlineCount = useStore((s) => s.onlineCount);
  const status = useStore((s) => s.settings.presenceStatus);
  const compact = useMediaQuery("(max-width:900px)");

  return (
    <Box sx={{ position: "relative", zIndex: 1, minHeight: "100vh", p: { xs: 0, md: 2 } }}>
    <Box sx={{ display: "grid", gridTemplateColumns: compact ? "64px 1fr" : "230px 1fr", minHeight: { xs: "100vh", md: "calc(100vh - 32px)" }, bgcolor: "var(--bl-face)", border: "1px solid var(--bl-edge-frame)", borderRadius: { xs: 0, md: "8px" }, overflow: "hidden", boxShadow: "0 12px 44px rgba(0,0,0,0.4)" }}>
      {/* nav rail */}
      <Box sx={{ borderRight: "1px solid var(--bl-line)", p: 1, display: "flex", flexDirection: "column", gap: 0.25, position: "sticky", top: 0, height: { xs: "100vh", md: "calc(100vh - 34px)" }, background: "linear-gradient(180deg, var(--bl-tasks-1), var(--bl-tasks-2))" }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 1, py: 1.5 }}>
          <Box sx={{ width: 28, height: 28, borderRadius: "8px", background: "linear-gradient(135deg,#3f97ff,#1668e0,#0a55cf)", boxShadow: "0 0 18px rgba(58,155,240,.5)" }} />
          {!compact && <Typography variant="h6" sx={{ background: "linear-gradient(90deg,#3f97ff,#1668e0)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>ZuccBook</Typography>}
        </Stack>

        {NAV.map((item) => {
          const active = pathname === item.to;
          return (
            <Tooltip key={item.to} title={compact ? item.label : ""} placement="right">
              <Box
                onClick={() => nav(item.to)}
                sx={{
                  display: "flex", alignItems: "center", gap: 1.5, px: 1.5, py: 1.1, borderRadius: 2, cursor: "pointer",
                  color: active ? "#ffffff" : "text.secondary",
                  background: active ? "linear-gradient(135deg,#3f97ff,#1668e0)" : "transparent",
                  boxShadow: active ? "0 6px 18px rgba(58,155,240,.3)" : "none",
                  "&:hover": { background: active ? undefined : "rgba(58,155,240,0.08)", color: active ? undefined : "text.primary" },
                  justifyContent: compact ? "center" : "flex-start",
                }}
              >
                {item.icon}
                {!compact && <Typography sx={{ fontWeight: 700 }}>{item.label}</Typography>}
              </Box>
            </Tooltip>
          );
        })}

        <Box sx={{ flex: 1 }} />
        {!compact && <Divider sx={{ my: 1 }} />}
        {!compact && <PresenceList />}
      </Box>

      {/* main column */}
      <Box sx={{ display: "flex", flexDirection: "column", minWidth: 0, bgcolor: "var(--bl-face)" }}>
        {/* Luna title bar */}
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ px: 2, py: 1, position: "sticky", top: 0, zIndex: 5, color: "#fff", borderBottom: "1px solid var(--bl-title-edge)", background: "var(--bl-gloss-title), linear-gradient(180deg, var(--bl-title-hi), var(--bl-title-low))", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.5)" }}>
          <Typography variant="h6" sx={{ flex: 1, color: "#fff", textShadow: "0 1px 2px rgba(0,0,0,0.4)" }}>{NAV.find((n) => n.to === pathname)?.label ?? "ZuccBook"}</Typography>
          <Chip size="small" label={`${onlineCount} online`} sx={{ bgcolor: "rgba(255,255,255,0.92)", color: "var(--bl-green-600)", border: "none", "& .MuiChip-label": { fontWeight: 700 } }} icon={<Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "#4ca325", ml: 1 }} />} />
          <Tooltip title={me?.username ?? ""}>
            <Box sx={{ position: "relative", cursor: "pointer" }} onClick={() => nav("/profile")}>
              <UserAvatar pk={me?.publicKey ?? ""} name={me?.username ?? "?"} avatar={me?.avatar} size={32} />
              <Box sx={{ position: "absolute", right: -1, bottom: -1, width: 11, height: 11, borderRadius: "50%", bgcolor: STATUS_COLOR[status], border: "2px solid #fff" }} />
            </Box>
          </Tooltip>
        </Stack>

        <Box sx={{ flex: 1, overflowY: "auto", p: { xs: 1.5, md: 3 }, pb: 12 }}>{children}</Box>
      </Box>
    </Box>
    </Box>
  );
}
