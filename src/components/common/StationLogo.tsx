import { useEffect, useState } from "react";
import { Box } from "@mui/material";

/** A station's favicon with a graceful fallback. Radio Browser logos 404
 *  often, so on error (or when absent) we show an emoji on the brand
 *  gradient instead of a broken image. Reused by the browser cards, the
 *  now-playing hero, and the persistent mini-player. */
export default function StationLogo({
  src, size = 44, radius = 1.5, fallback = "📻",
}: { src?: string; size?: number; radius?: number; fallback?: string }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [src]);
  const showImg = !!src && !broken;
  return (
    <Box sx={{
      width: size, height: size, flex: "0 0 auto", borderRadius: radius, overflow: "hidden",
      display: "grid", placeItems: "center", color: "#fff", fontSize: size * 0.42,
      background: "linear-gradient(135deg,#3f97ff,#1668e0)",
    }}>
      {showImg
        ? <Box component="img" src={src} alt="" loading="lazy" onError={() => setBroken(true)}
            sx={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        : <span>{fallback}</span>}
    </Box>
  );
}
