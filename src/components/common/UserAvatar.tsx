import { Avatar, type SxProps, type Theme } from "@mui/material";
import { avatarGradient, initials } from "./avatar";

/** Renders a user's profile photo if they have one, else a deterministic
 *  gradient with initials. The single avatar component used everywhere. */
export default function UserAvatar({
  pk, name, avatar, size = 40, sx,
}: { pk: string; name: string; avatar?: string; size?: number; sx?: SxProps<Theme> }) {
  return (
    <Avatar
      src={avatar || undefined}
      sx={{ width: size, height: size, fontSize: Math.round(size * 0.4), fontWeight: 800, color: "#031426", background: avatar ? undefined : avatarGradient(pk), ...sx }}
    >
      {!avatar && initials(name)}
    </Avatar>
  );
}
