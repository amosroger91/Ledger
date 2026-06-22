import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box, Stack, Typography, TextField, Button, Chip, MenuItem, Grid, InputAdornment,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from "@mui/material";
import StorefrontRoundedIcon from "@mui/icons-material/StorefrontRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import AccountBalanceWalletRoundedIcon from "@mui/icons-material/AccountBalanceWalletRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import ShoppingCartRoundedIcon from "@mui/icons-material/ShoppingCartRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import AddPhotoAlternateRoundedIcon from "@mui/icons-material/AddPhotoAlternateRounded";
import GlassCard from "@/components/common/GlassCard";
import UserAvatar from "@/components/common/UserAvatar";
import { marketplaceService } from "@/services/marketplaceService";
import { compressBanner } from "@/lib/image";
import { useStore } from "@/store/useStore";
import { bus, toast } from "@/lib/events";
import { relativeTime } from "@/lib/time";
import type { Listing } from "@/types";

const BRAND = "linear-gradient(135deg,#3f97ff,#1668e0,#0a55cf)";
type Cur = "all" | "USDC" | "MATIC";
type Sort = "new" | "lo" | "hi";

const selChip = { bgcolor: "rgba(58,123,240,0.16)", color: "#1668e0", fontWeight: 700, border: "1px solid rgba(58,123,240,0.45)" };

export default function MarketView() {
  const me = useStore((s) => s.me);
  const nav = useNavigate();
  const [items, setItems] = useState<Listing[]>(marketplaceService.list());
  const [query, setQuery] = useState("");
  const [cur, setCur] = useState<Cur>("all");
  const [sort, setSort] = useState<Sort>("new");
  const [showSold, setShowSold] = useState(false);

  const [sellOpen, setSellOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", price: "", currency: "USDC" as "MATIC" | "USDC", image: "" });
  const [selling, setSelling] = useState(false);
  const [buying, setBuying] = useState<Listing | null>(null);
  const [buyBusy, setBuyBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => bus.on("market:update", () => setItems(marketplaceService.list())), []);

  async function pickImage(file?: File) {
    if (!file) return;
    try { setForm((f) => ({ ...f, image: "" })); const img = await compressBanner(file, 900); setForm((f) => ({ ...f, image: img })); }
    catch { toast("Couldn't load image", "warn"); }
  }
  async function create() {
    if (!form.title.trim() || !(Number(form.price) > 0)) { toast("Add a title and a price", "warn"); return; }
    setSelling(true);
    try {
      await marketplaceService.create({ title: form.title.trim(), description: form.description.trim(), image: form.image || undefined, price: form.price.trim(), currency: form.currency });
      setForm({ title: "", description: "", price: "", currency: form.currency, image: "" });
      setSellOpen(false);
      toast("Listed for sale ✦", "success");
    } finally { setSelling(false); }
  }
  async function confirmBuy() {
    if (!buying) return;
    setBuyBusy(true);
    try { const hash = await marketplaceService.buy(buying); toast(`Paid! tx ${hash.slice(0, 10)}…`, "success"); setBuying(null); }
    catch (e: any) { toast(e?.shortMessage || e?.message || "Payment failed (need MATIC for gas?)", "error"); }
    finally { setBuyBusy(false); }
  }
  function delist(l: Listing) { if (confirm(`Delist "${l.title}"?`)) { marketplaceService.remove(l.id); toast("Delisted", "info"); } }

  const filtered = useMemo(() => {
    let xs = items.filter((l) => (showSold ? true : !l.sold));
    if (cur !== "all") xs = xs.filter((l) => l.currency === cur);
    const q = query.trim().toLowerCase();
    if (q) xs = xs.filter((l) => `${l.title} ${l.description ?? ""} ${l.sellerName}`.toLowerCase().includes(q));
    if (sort === "lo") xs = [...xs].sort((a, b) => Number(a.price) - Number(b.price));
    else if (sort === "hi") xs = [...xs].sort((a, b) => Number(b.price) - Number(a.price));
    else xs = [...xs].sort((a, b) => b.createdAt - a.createdAt);
    return xs;
  }, [items, showSold, cur, query, sort]);

  const filtering = !!query.trim() || cur !== "all";

  return (
    <Box sx={{ maxWidth: 1040, mx: "auto" }}>
      {/* hero header */}
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
        <Box sx={{ width: 46, height: 46, flex: "0 0 auto", borderRadius: 2.5, display: "grid", placeItems: "center", color: "#fff", background: BRAND, boxShadow: "0 6px 16px rgba(22,104,224,0.4)" }}>
          <StorefrontRoundedIcon />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h5" sx={{ fontWeight: 800, lineHeight: 1.1 }}>Market</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ display: { xs: "none", sm: "block" } }}>
            Buy &amp; sell, paid peer-to-peer on Polygon — the price goes straight to the seller, no middleman.
          </Typography>
        </Box>
        <Button variant="outlined" startIcon={<AccountBalanceWalletRoundedIcon />} onClick={() => nav("/wallet")} sx={{ display: { xs: "none", sm: "inline-flex" } }}>Wallet</Button>
        <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setSellOpen(true)}>Sell</Button>
      </Stack>

      {/* compact risk strip */}
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, p: 1, mb: 2, borderRadius: 2, bgcolor: "rgba(232,146,12,0.10)", border: "1px solid rgba(232,146,12,0.4)" }}>
        <WarningAmberRoundedIcon sx={{ color: "var(--bl-warn)", fontSize: 18, mt: "1px", flex: "0 0 auto" }} />
        <Typography variant="caption" sx={{ color: "text.secondary", lineHeight: 1.45 }}>
          <b>Peer-to-peer &amp; final</b> — no escrow, no refunds. Buying pays a stranger's wallet directly and nothing guarantees delivery; only buy from people you trust. Ledger isn't responsible for any loss or fraud.
        </Typography>
      </Box>

      {/* toolbar: search · currency · sort · sold */}
      <Stack direction={{ xs: "column", md: "row" }} spacing={1.25} alignItems={{ md: "center" }} sx={{ mb: 2 }}>
        <TextField
          size="small" placeholder="Search items or sellers…" value={query} onChange={(e) => setQuery(e.target.value)}
          sx={{ flex: 1 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchRoundedIcon fontSize="small" sx={{ color: "text.disabled" }} /></InputAdornment> }}
        />
        <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap", gap: 0.75 }} alignItems="center">
          {(["all", "USDC", "MATIC"] as Cur[]).map((c) => (
            <Chip key={c} label={c === "all" ? "All" : c} size="small" onClick={() => setCur(c)} variant={cur === c ? "filled" : "outlined"} sx={cur === c ? selChip : undefined} />
          ))}
          <Chip label="Show sold" size="small" onClick={() => setShowSold((v) => !v)} variant={showSold ? "filled" : "outlined"} sx={showSold ? selChip : undefined} />
          <TextField select size="small" value={sort} onChange={(e) => setSort(e.target.value as Sort)} sx={{ width: 150 }}>
            <MenuItem value="new">Newest</MenuItem>
            <MenuItem value="lo">Price: low → high</MenuItem>
            <MenuItem value="hi">Price: high → low</MenuItem>
          </TextField>
        </Stack>
      </Stack>

      {filtered.length > 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
          {filtered.length} {filtered.length === 1 ? "item" : "items"}
        </Typography>
      )}

      {/* grid */}
      {filtered.length === 0 ? (
        <GlassCard sx={{ textAlign: "center", py: 7 }}>
          <StorefrontRoundedIcon sx={{ fontSize: 50, color: "var(--bl-silver-400)" }} />
          <Typography sx={{ fontWeight: 700, mt: 1 }}>{filtering ? "No items match your filters" : "Nothing for sale yet"}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {filtering ? "Try clearing the search or filters." : "Be the first — list something and it syncs to everyone."}
          </Typography>
          {filtering
            ? <Button sx={{ mt: 2 }} onClick={() => { setQuery(""); setCur("all"); setShowSold(false); }}>Clear filters</Button>
            : <Button variant="contained" startIcon={<AddRoundedIcon />} sx={{ mt: 2 }} onClick={() => setSellOpen(true)}>Sell an item</Button>}
        </GlassCard>
      ) : (
        <Grid container spacing={2}>
          {filtered.map((l) => {
            const mine = l.seller === me?.publicKey;
            return (
              <Grid item xs={12} sm={6} md={4} key={l.id}>
                <GlassCard
                  sx={{
                    height: "100%", p: 0, overflow: "hidden", display: "flex", flexDirection: "column",
                    transition: "transform .2s ease, box-shadow .2s ease",
                    "&:hover": { transform: "translateY(-4px)", boxShadow: "0 16px 36px rgba(20,40,80,0.16)" },
                    "&:hover .mkt-img": { transform: "scale(1.06)" },
                  }}
                >
                  {/* image / placeholder */}
                  <Box sx={{ position: "relative", height: 172, overflow: "hidden", bgcolor: "var(--bl-face)" }}>
                    {l.image ? (
                      <Box className="mkt-img" component="img" src={l.image} alt={l.title} loading="lazy" sx={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform .35s ease", display: "block" }} />
                    ) : (
                      <Box className="mkt-img" sx={{ width: "100%", height: "100%", display: "grid", placeItems: "center", background: "linear-gradient(135deg,#cfe0fb,#9fc0f4)", transition: "transform .35s ease" }}>
                        <Typography sx={{ fontSize: 46, fontWeight: 800, color: "rgba(255,255,255,0.9)" }}>{(l.title.trim()[0] ?? "?").toUpperCase()}</Typography>
                      </Box>
                    )}
                    <Box sx={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.28), transparent 42%)", pointerEvents: "none" }} />
                    {/* price pill */}
                    <Box sx={{ position: "absolute", top: 10, right: 10, px: 1.1, py: 0.4, borderRadius: 999, bgcolor: "rgba(8,28,56,0.8)", color: "#fff", fontWeight: 800, fontSize: 13, display: "flex", alignItems: "center", gap: 0.5, backdropFilter: "blur(4px)" }}>
                      {l.price}<Box component="span" sx={{ fontSize: 10.5, fontWeight: 700, opacity: 0.8 }}>{l.currency}</Box>
                    </Box>
                    {l.sold && (
                      <Box sx={{ position: "absolute", top: 14, left: -34, transform: "rotate(-45deg)", bgcolor: "var(--bl-danger)", color: "#fff", px: 4.5, py: 0.3, fontSize: 11, fontWeight: 800, letterSpacing: 1, boxShadow: "0 2px 6px rgba(0,0,0,0.3)" }}>SOLD</Box>
                    )}
                  </Box>

                  {/* body */}
                  <Box sx={{ p: 1.5, flex: 1, display: "flex", flexDirection: "column" }}>
                    <Typography sx={{ fontWeight: 700 }} noWrap>{l.title}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, flex: 1, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", minHeight: 40 }}>
                      {l.description || "No description provided."}
                    </Typography>
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 1.25 }}>
                      <Box onClick={() => nav(`/u/${l.seller}`)} sx={{ cursor: "pointer", flex: "0 0 auto" }}>
                        <UserAvatar pk={l.seller} name={l.sellerName} size={26} />
                      </Box>
                      <Box sx={{ minWidth: 0, flex: 1, cursor: "pointer" }} onClick={() => nav(`/u/${l.seller}`)}>
                        <Typography variant="caption" sx={{ fontWeight: 700, display: "block", lineHeight: 1.2 }} noWrap>{l.sellerName}{mine ? " (you)" : ""}</Typography>
                        <Typography variant="caption" color="text.secondary">{relativeTime(l.createdAt)}</Typography>
                      </Box>
                    </Stack>
                    {mine ? (
                      <Stack direction="row" spacing={1} sx={{ mt: 1.25 }}>
                        <Button fullWidth size="small" variant="outlined" disabled>Your listing</Button>
                        {!l.sold && <Button size="small" color="error" onClick={() => delist(l)}>Delist</Button>}
                      </Stack>
                    ) : (
                      <Button fullWidth size="small" variant="contained" startIcon={<ShoppingCartRoundedIcon />} sx={{ mt: 1.25 }} disabled={l.sold} onClick={() => setBuying(l)}>
                        {l.sold ? "Sold" : "Buy now"}
                      </Button>
                    )}
                  </Box>
                </GlassCard>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* sell dialog */}
      <Dialog open={sellOpen} onClose={() => !selling && setSellOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { backgroundImage: "none", borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>List an item for sale</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ mt: 0.5 }}>
            <TextField label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} size="small" fullWidth autoFocus />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <TextField label="Price" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} size="small" sx={{ flex: 1 }} inputMode="decimal" />
              <TextField select label="Token" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value as "MATIC" | "USDC" })} size="small" sx={{ width: { xs: "100%", sm: 130 } }}>
                <MenuItem value="USDC">USDC</MenuItem>
                <MenuItem value="MATIC">MATIC</MenuItem>
              </TextField>
            </Stack>
            <TextField label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} size="small" fullWidth multiline minRows={3} />
            <Box
              onClick={() => fileRef.current?.click()}
              sx={{ border: "1.5px dashed var(--bl-edge-frame)", borderRadius: 2, overflow: "hidden", cursor: "pointer", textAlign: "center", color: "text.secondary", transition: "border-color .15s, background .15s", "&:hover": { borderColor: "#3f97ff", bgcolor: "rgba(58,155,240,0.05)" } }}
            >
              {form.image
                ? <Box component="img" src={form.image} sx={{ width: "100%", maxHeight: 220, objectFit: "cover", display: "block" }} />
                : <Stack alignItems="center" spacing={0.5} sx={{ py: 2.5 }}><AddPhotoAlternateRoundedIcon /><Typography variant="caption">Add a photo (optional)</Typography></Stack>}
            </Box>
            {form.image && <Button size="small" color="inherit" onClick={() => setForm({ ...form, image: "" })} sx={{ alignSelf: "flex-start", color: "text.secondary" }}>Remove photo</Button>}
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => pickImage(e.target.files?.[0])} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setSellOpen(false)} disabled={selling}>Cancel</Button>
          <Button variant="contained" onClick={create} disabled={selling}>{selling ? "Listing…" : "List for sale"}</Button>
        </DialogActions>
      </Dialog>

      {/* buy dialog */}
      <Dialog open={!!buying} onClose={() => !buyBusy && setBuying(null)} maxWidth="xs" fullWidth PaperProps={{ sx: { backgroundImage: "none", borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>Confirm purchase</DialogTitle>
        <DialogContent>
          {buying && (
            <Stack direction="row" spacing={1.5} sx={{ mb: 1.5 }}>
              <Box sx={{ width: 64, height: 64, borderRadius: 2, overflow: "hidden", flex: "0 0 auto", bgcolor: "var(--bl-face)", display: "grid", placeItems: "center", background: buying.image ? undefined : "linear-gradient(135deg,#cfe0fb,#9fc0f4)" }}>
                {buying.image
                  ? <Box component="img" src={buying.image} sx={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <Typography sx={{ fontSize: 26, fontWeight: 800, color: "rgba(255,255,255,0.9)" }}>{(buying.title.trim()[0] ?? "?").toUpperCase()}</Typography>}
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontWeight: 700 }} noWrap>{buying.title}</Typography>
                <Typography variant="caption" color="text.secondary">to {buying.sellerName}</Typography>
                <Typography sx={{ fontWeight: 800, color: "#1668e0", mt: 0.25 }}>{buying.price} {buying.currency}</Typography>
              </Box>
            </Stack>
          )}
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", fontFamily: "monospace", wordBreak: "break-all" }}>→ {buying?.sellerAddress}</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>This sends real funds from your wallet on Polygon and can't be undone. You need MATIC for gas.</Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setBuying(null)} disabled={buyBusy}>Cancel</Button>
          <Button variant="contained" startIcon={<ShoppingCartRoundedIcon />} onClick={confirmBuy} disabled={buyBusy}>{buyBusy ? "Paying…" : `Pay ${buying?.price} ${buying?.currency}`}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
