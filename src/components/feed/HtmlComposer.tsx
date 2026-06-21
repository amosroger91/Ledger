import { useEffect, useRef, useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Stack, ToggleButtonGroup, ToggleButton,
  Tooltip, IconButton, Typography, TextField, Divider,
} from "@mui/material";
import FormatBoldRoundedIcon from "@mui/icons-material/FormatBoldRounded";
import FormatItalicRoundedIcon from "@mui/icons-material/FormatItalicRounded";
import FormatUnderlinedRoundedIcon from "@mui/icons-material/FormatUnderlinedRounded";
import TitleRoundedIcon from "@mui/icons-material/TitleRounded";
import FormatListBulletedRoundedIcon from "@mui/icons-material/FormatListBulletedRounded";
import FormatListNumberedRoundedIcon from "@mui/icons-material/FormatListNumberedRounded";
import FormatQuoteRoundedIcon from "@mui/icons-material/FormatQuoteRounded";
import LinkRoundedIcon from "@mui/icons-material/LinkRounded";
import CodeRoundedIcon from "@mui/icons-material/CodeRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import { htmlPostDoc } from "./htmlPost";

// A coherent dialog for composing a pure-HTML post: a Visual (WYSIWYG) mode for
// non-technical users and a Code mode for embeds (Google Maps, a JS game, an
// <iframe>) and custom markup. A live, sandboxed preview shows exactly how it
// will render in the feed.
export default function HtmlComposer({ open, onClose, onPost }: { open: boolean; onClose: () => void; onPost: (html: string) => void }) {
  const [mode, setMode] = useState<"visual" | "code">("visual");
  const [html, setHtml] = useState("");
  const editRef = useRef<HTMLDivElement>(null);

  // keep the contentEditable in sync when (re)entering Visual mode
  useEffect(() => { if (open && mode === "visual" && editRef.current && editRef.current.innerHTML !== html) editRef.current.innerHTML = html; }, [mode, open]);
  useEffect(() => { if (!open) { setHtml(""); setMode("visual"); } }, [open]);

  const exec = (cmd: string, val?: string) => { editRef.current?.focus(); document.execCommand(cmd, false, val); setHtml(editRef.current?.innerHTML ?? ""); };
  const tool = (icon: React.ReactNode, label: string, fn: () => void) => (
    <Tooltip title={label}><IconButton size="small" onMouseDown={(e) => { e.preventDefault(); fn(); }}>{icon}</IconButton></Tooltip>
  );

  function submit() { const h = html.trim(); if (!h) return; onPost(h); onClose(); }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { backgroundImage: "none" } }}>
      <DialogTitle sx={{ pb: 1 }}>Create an HTML post
        <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>Format text visually, or drop in raw HTML — embed a map, a game, an iframe, anything. It renders safely sandboxed.</Typography>
      </DialogTitle>
      <DialogContent>
        <ToggleButtonGroup exclusive size="small" value={mode} onChange={(_, v) => v && setMode(v)} sx={{ mb: 1.5 }}>
          <ToggleButton value="visual"><VisibilityRoundedIcon fontSize="small" sx={{ mr: 0.5 }} /> Visual</ToggleButton>
          <ToggleButton value="code"><CodeRoundedIcon fontSize="small" sx={{ mr: 0.5 }} /> Code / Embed</ToggleButton>
        </ToggleButtonGroup>

        {mode === "visual" ? (
          <Box>
            <Stack direction="row" sx={{ flexWrap: "wrap", border: "1px solid var(--bl-line)", borderRadius: "8px 8px 0 0", px: 0.5, py: 0.25, bgcolor: "rgba(0,0,0,0.02)" }}>
              {tool(<FormatBoldRoundedIcon fontSize="small" />, "Bold", () => exec("bold"))}
              {tool(<FormatItalicRoundedIcon fontSize="small" />, "Italic", () => exec("italic"))}
              {tool(<FormatUnderlinedRoundedIcon fontSize="small" />, "Underline", () => exec("underline"))}
              <Divider orientation="vertical" flexItem sx={{ mx: 0.5, my: 0.5 }} />
              {tool(<TitleRoundedIcon fontSize="small" />, "Heading", () => exec("formatBlock", "H2"))}
              {tool(<FormatQuoteRoundedIcon fontSize="small" />, "Quote", () => exec("formatBlock", "BLOCKQUOTE"))}
              {tool(<FormatListBulletedRoundedIcon fontSize="small" />, "Bulleted list", () => exec("insertUnorderedList"))}
              {tool(<FormatListNumberedRoundedIcon fontSize="small" />, "Numbered list", () => exec("insertOrderedList"))}
              <Divider orientation="vertical" flexItem sx={{ mx: 0.5, my: 0.5 }} />
              {tool(<LinkRoundedIcon fontSize="small" />, "Link", () => { const u = prompt("Link URL:"); if (u) exec("createLink", u); })}
            </Stack>
            <Box ref={editRef} contentEditable suppressContentEditableWarning onInput={() => setHtml(editRef.current?.innerHTML ?? "")}
              sx={{ minHeight: 180, maxHeight: 320, overflowY: "auto", p: 1.5, border: "1px solid var(--bl-line)", borderTop: 0, borderRadius: "0 0 8px 8px", outline: "none", fontSize: 15, lineHeight: 1.55, "& blockquote": { borderLeft: "3px solid var(--bl-line)", ml: 0, pl: 1.5, color: "text.secondary" }, "&:empty:before": { content: '"Write something — use the toolbar to format…"', color: "text.disabled" } }} />
          </Box>
        ) : (
          <TextField value={html} onChange={(e) => setHtml(e.target.value)} fullWidth multiline minRows={8} maxRows={16}
            placeholder={'<!-- Paste any HTML. Examples: -->\n<iframe src="https://www.google.com/maps/embed?..." width="100%" height="320" style="border:0"></iframe>\n\n<h2>Custom formatting</h2>\n<p style="color:#1668e0">Hello world</p>'}
            InputProps={{ sx: { fontFamily: "monospace", fontSize: 13 } }} />
        )}

        <Typography variant="overline" color="text.secondary" sx={{ display: "block", mt: 2 }}>Live preview</Typography>
        <Box sx={{ border: "1px solid var(--bl-line)", borderRadius: 1.5, overflow: "hidden", bgcolor: "#fff" }}>
          {html.trim()
            ? <Box component="iframe" title="preview" srcDoc={htmlPostDoc(html)} sandbox="allow-scripts allow-popups allow-forms allow-modals allow-presentation" sx={{ width: "100%", height: 240, border: 0, display: "block" }} />
            : <Box sx={{ p: 2 }}><Typography variant="body2" color="text.secondary">Your post will preview here.</Typography></Box>}
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>🔒 HTML posts run in a sandbox with no access to your account, keys, or data — yours or anyone else's.</Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={!html.trim()}>Post HTML</Button>
      </DialogActions>
    </Dialog>
  );
}
