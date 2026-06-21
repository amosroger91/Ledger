// ============================================================
//  emoticons — translate classic ASCII emoticons (":)", "<3", "XD")
//  into real Unicode emoji for display. Purely cosmetic and applied
//  at render time; the stored post text is never modified, so the
//  original signed content is preserved.
// ============================================================

// Longest keys first so ":-)" wins over ":-" etc. Order matters because
// the alternation is greedy left-to-right.
const MAP: Record<string, string> = {
  ":')": "🥲", ":'(": "😢", ":'-(": "😢",
  ">:(": "😠", ">:)": "😈", "}:)": "😈",
  ":-)": "🙂", ":)": "🙂", "(:": "🙂", "=)": "🙂",
  ":-D": "😄", ":D": "😄", "=D": "😄", "xD": "😆", "XD": "😆",
  ":-(": "🙁", ":(": "🙁", "):": "🙁", "=(": "🙁",
  ";-)": "😉", ";)": "😉", ";-D": "😜", ";D": "😜",
  ":-P": "😛", ":P": "😛", ":p": "😛", ":-p": "😛", "=P": "😛",
  ":-O": "😮", ":O": "😮", ":o": "😮", ":-o": "😮",
  ":-|": "😐", ":|": "😐",
  ":-/": "😕", ":/": "😕", ":-\\": "😕", ":\\": "😕",
  ":-*": "😘", ":*": "😘",
  "B-)": "😎", "B)": "😎", "8-)": "😎", "8)": "😎",
  ":'D": "😂", "T_T": "😭", "T-T": "😭", "TT": "😭", ";_;": "😭",
  "^^": "😊", "^_^": "😊", "^-^": "😊", "-_-": "😑",
  "o_O": "😳", "O_o": "😳", "o_o": "😳", "O_O": "😳",
  "<3": "❤️", "</3": "💔", "<\\3": "💔",
  ":3": "😺", ">_<": "😣", ">.<": "😣",
};

// Build one regex: a leading boundary (start or whitespace), then any
// emoticon, then a trailing boundary (end, whitespace, or sentence
// punctuation). Requiring boundaries keeps us from rewriting fragments
// inside words or URLs (those are already split out before we run).
const KEYS = Object.keys(MAP).sort((a, b) => b.length - a.length);
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const RE = new RegExp(`(^|\\s)(${KEYS.map(esc).join("|")})(?=$|\\s|[.,!?;])`, "g");

/** Replace classic ASCII emoticons in `text` with real emoji. */
export function emojify(text: string): string {
  if (!text || (!text.includes(":") && !text.includes("<") && !text.includes("=") &&
      !text.includes(";") && !text.includes("^") && !text.includes("_") &&
      !text.includes("8") && !text.includes("B") && !text.includes("D") &&
      !text.includes(">") && !text.includes("("))) return text;
  return text.replace(RE, (_m, lead, emo) => lead + (MAP[emo] ?? emo));
}
