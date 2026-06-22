import { Box, Divider, Typography } from "@mui/material";
import MessagesView from "./MessagesView";
import ChatroomView from "@/components/chatroom/ChatroomView";

// Combined page: the live peer-to-peer rooms (ChatroomView) on top, with the
// durable Swarm Lounge + DMs (MessagesView) stacked shorter beneath it — both
// visible at once. Both /messages and /chatroom render this, so existing
// deep-links keep working (groups opening /chatroom?room=… auto-join up top,
// a DM alert routing to /messages lands on the Town Square section below).
export default function TownSquareView() {
  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
      {/* Live Rooms — top, takes the larger share of the page */}
      <Box sx={{ flex: 1, minHeight: 240, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <ChatroomView />
      </Box>

      <Divider sx={{ my: 1.5 }}>
        <Typography variant="overline" color="text.secondary">Town Square</Typography>
      </Divider>

      {/* Town Square — Swarm Lounge + DMs, kept shorter, beneath the rooms */}
      <Box sx={{ flex: "0 0 auto", height: { xs: 320, md: 360 }, display: "flex", flexDirection: "column", minHeight: 0, minWidth: 0 }}>
        <MessagesView />
      </Box>
    </Box>
  );
}
