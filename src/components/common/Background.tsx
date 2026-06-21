import { Box } from "@mui/material";

/** The Bliss / Windows XP "Luna" wallpaper — the classic blue sky + green
 *  hill field, painted by bliss.css's .bl-bliss helper. */
export default function Background() {
  return <Box className="bl-bliss" aria-hidden sx={{ position: "fixed", inset: 0, zIndex: 0 }} />;
}
