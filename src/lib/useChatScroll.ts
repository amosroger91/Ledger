import { useCallback, useEffect, useRef, useState } from "react";

// Smart chat autoscroll. Sticks to the bottom ONLY when you're already near it.
// If you've scrolled up to read older messages and new ones arrive, it does NOT
// yank you down — instead it surfaces `pending` (count of unseen messages) so the
// UI can show a "↓ N new" button; `jump()` scrolls to the latest and clears it.
//
//   const { scrollRef, endRef, pending, jump } = useChatScroll(messages.length);
//   <Box ref={scrollRef} sx={{ overflowY: "auto" }}> … <div ref={endRef} /> </Box>
export function useChatScroll(count: number) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const inited = useRef(false);
  const prev = useRef(count);
  const [pending, setPending] = useState(0);

  const nearBottom = () => {
    const el = scrollRef.current;
    return !el || el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };
  const jump = useCallback((behavior: ScrollBehavior = "smooth") => {
    endRef.current?.scrollIntoView({ behavior });
    atBottom.current = true;
    setPending(0);
  }, []);

  // Track whether the viewer is parked at the bottom.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => { atBottom.current = nearBottom(); if (atBottom.current) setPending(0); };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // React to new messages: first load jumps to the bottom; after that, stick only
  // if parked at the bottom, else bump the unseen counter.
  useEffect(() => {
    const added = count - prev.current;
    prev.current = count;
    if (count > 0 && !inited.current) { inited.current = true; jump("auto"); return; }
    if (added > 0) { if (atBottom.current) jump("smooth"); else setPending((p) => p + added); }
  }, [count, jump]);

  return { scrollRef, endRef, pending, jump };
}
