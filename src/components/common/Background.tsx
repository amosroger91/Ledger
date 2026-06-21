import { Box } from "@mui/material";
import { keyframes } from "@mui/system";
import { useStore } from "@/store/useStore";

// Slow, flowing aurora — the Aurora design language's signature backdrop:
// ribbons of light-bending color drifting behind frosted glass.
const flow = keyframes`
  0%   { transform: translate3d(-8%, -5%, 0) rotate(0deg) scale(1.2); }
  50%  { transform: translate3d(8%, 5%, 0) rotate(8deg) scale(1.35); }
  100% { transform: translate3d(-8%, -5%, 0) rotate(0deg) scale(1.2); }
`;

export default function Background() {
  const reduced = useStore((s) => s.settings.reducedMotion);
  return (
    <Box aria-hidden sx={{ position: "fixed", inset: 0, zIndex: 0, overflow: "hidden", bgcolor: "#05080f" }}>
      <Box sx={{
        position: "absolute", inset: "-25%",
        background:
          "radial-gradient(38% 38% at 22% 24%, rgba(57,198,245,0.22), transparent 60%)," +
          "radial-gradient(42% 42% at 78% 20%, rgba(58,123,240,0.24), transparent 62%)," +
          "radial-gradient(46% 46% at 62% 84%, rgba(54,224,196,0.18), transparent 62%)," +
          "radial-gradient(40% 40% at 30% 78%, rgba(90,155,255,0.16), transparent 60%)",
        filter: "blur(46px)",
        animation: reduced ? "none" : `${flow} 30s cubic-bezier(0.25,0.1,0.25,1) infinite`,
      }} />
      {/* faint frost grain + vignette so glass reads as lit-from-within */}
      <Box sx={{
        position: "absolute", inset: 0,
        background: "radial-gradient(120% 90% at 50% 0%, rgba(255,255,255,0.04), transparent 55%)",
        maskImage: "radial-gradient(90% 90% at 50% 30%, #000, transparent)",
      }} />
    </Box>
  );
}
