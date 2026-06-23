import { useEffect, useMemo, useState } from "react";
import { Box, Stack, Typography } from "@mui/material";
import TranslateRoundedIcon from "@mui/icons-material/TranslateRounded";
import { useStore } from "@/store/useStore";
import { translateService, langName, probablyNotEnglish } from "@/services/translateService";
import { renderBody, SafeImage } from "@/components/feed/PostCard";
import type { MediaRef } from "@/types";

// Shared chat-message body: same rich rendering as feed posts — inline images
// (NSFW-gated via SafeImage, tap-to-reveal when the filter's on), clickable links,
// emoji, markdown/code, profanity censoring — plus auto-translate of foreign-
// language messages, and any imeta (NIP-92) image attachments.
export default function MessageBody({ text = "", media }: { text?: string; media?: MediaRef[] }) {
  const censor = useStore((s) => s.settings.censorProfanity);
  const autoTranslate = useStore((s) => s.settings.autoTranslate);
  const [trans, setTrans] = useState<{ text: string; src: string } | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [confirmedEnglish, setConfirmedEnglish] = useState(false);
  const translatable = useMemo(() => probablyNotEnglish(text), [text]);

  async function doTranslate() {
    if (trans || translating) return;
    setTranslating(true);
    try {
      const res = await translateService.toEnglish(text);
      const src = (res.src || "").toLowerCase();
      if (!src || src.startsWith("en") || res.text.trim() === text.trim()) setConfirmedEnglish(true);
      else setTrans(res);
    } catch { /* leave original on failure */ }
    finally { setTranslating(false); }
  }
  // Auto-translate foreign messages (ON by default; the Settings toggle opts out).
  useEffect(() => {
    if (autoTranslate !== false && translatable && !trans && !translating && !confirmedEnglish) doTranslate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoTranslate, translatable]);

  const showingTrans = !!trans && !showOriginal;
  const body = showingTrans ? trans!.text : text;

  return (
    <Box>
      {showingTrans && (
        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 0.25, opacity: 0.95 }}>
          <TranslateRoundedIcon sx={{ fontSize: 13, color: "#1668e0" }} />
          <Typography variant="caption" sx={{ color: "#1668e0", fontWeight: 700 }}>Translated from {langName(trans!.src)}</Typography>
          <Box component="button" onClick={() => setShowOriginal(true)}
            sx={{ background: "none", border: 0, p: 0, cursor: "pointer", font: "inherit", fontSize: 11, color: "text.secondary", fontWeight: 700, "&:hover": { textDecoration: "underline" } }}>
            · original
          </Box>
        </Stack>
      )}
      {body && (
        <Typography component="div" variant="body2" sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
          {renderBody(body, censor, true)}
        </Typography>
      )}
      {media?.map((m, i) => (m.type === "image"
        ? <SafeImage key={i} src={m.url} sx={{ display: "block", mt: 0.5, maxWidth: "100%", maxHeight: 280, borderRadius: 1.5, border: "1px solid var(--bl-line)" }} />
        : null))}
    </Box>
  );
}
