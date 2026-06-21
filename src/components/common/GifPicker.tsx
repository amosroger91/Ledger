import { useEffect, useState } from "react";
import { Dialog, DialogTitle, DialogContent, TextField, Box, CircularProgress, Typography, InputAdornment } from "@mui/material";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import { searchGifs, type Gif } from "@/services/gifService";

// A reusable Tenor GIF search/picker. Calls onPick with the chosen GIF's URL
// (which both posts and replies render inline as an animated image).
export default function GifPicker({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (url: string) => void }) {
  const [q, setQ] = useState("");
  const [gifs, setGifs] = useState<Gif[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(false);

  useEffect(() => {
    if (!open) return;
    let on = true;
    setLoading(true); setErr(false);
    const t = setTimeout(() => {
      searchGifs(q).then((g) => { if (on) { setGifs(g); setLoading(false); } })
        .catch(() => { if (on) { setErr(true); setLoading(false); } });
    }, q ? 350 : 0); // debounce typed queries; load trending immediately
    return () => { on = false; clearTimeout(t); };
  }, [q, open]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { backgroundImage: "none" } }}>
      <DialogTitle sx={{ pb: 1 }}>Search GIFs <Typography component="span" variant="caption" color="text.secondary">· powered by Tenor</Typography></DialogTitle>
      <DialogContent>
        <TextField
          autoFocus fullWidth size="small" placeholder="Search Tenor… (or browse trending)" value={q}
          onChange={(e) => setQ(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchRoundedIcon fontSize="small" /></InputAdornment> }}
          sx={{ mb: 1.5 }}
        />
        {loading && <Box sx={{ display: "grid", placeItems: "center", py: 4 }}><CircularProgress size={26} /></Box>}
        {err && !loading && <Typography color="text.secondary" sx={{ py: 3, textAlign: "center" }}>Couldn't reach Tenor right now — try again.</Typography>}
        {!loading && !err && (
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1, maxHeight: 360, overflowY: "auto" }}>
            {gifs.map((g, i) => (
              <Box key={i} component="img" src={g.preview} alt={g.title} loading="lazy"
                onClick={() => { onPick(g.full); onClose(); }}
                sx={{ width: "100%", height: 110, objectFit: "cover", borderRadius: 1.5, cursor: "pointer", border: "1px solid var(--bl-line)", "&:hover": { outline: "2px solid #3f97ff" } }} />
            ))}
            {!gifs.length && <Typography color="text.secondary" sx={{ gridColumn: "1 / -1", py: 3, textAlign: "center" }}>No GIFs found.</Typography>}
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}
