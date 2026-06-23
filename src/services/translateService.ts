// ============================================================
//  translateService — on-demand "translate to English" for feed
//  posts. Uses the free, keyless Google "gtx" endpoint (auto source
//  detection), reached directly or via the same public CORS proxies
//  the RSS layer uses. Results are cached in memory so a post is only
//  translated once. Nothing is stored on a server we run.
// ============================================================

const PROXIES = [
  (u: string) => u, // direct first — gtx usually allows CORS for client=gtx
  (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  (u: string) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
];

const LANG_NAMES: Record<string, string> = {
  af: "Afrikaans", ar: "Arabic", bn: "Bengali", bg: "Bulgarian", ca: "Catalan", cs: "Czech",
  da: "Danish", de: "German", el: "Greek", en: "English", es: "Spanish", et: "Estonian",
  fa: "Persian", fi: "Finnish", fr: "French", gu: "Gujarati", he: "Hebrew", hi: "Hindi",
  hr: "Croatian", hu: "Hungarian", id: "Indonesian", it: "Italian", ja: "Japanese", ko: "Korean",
  lt: "Lithuanian", lv: "Latvian", ms: "Malay", nl: "Dutch", no: "Norwegian", pl: "Polish",
  pt: "Portuguese", ro: "Romanian", ru: "Russian", sk: "Slovak", sl: "Slovenian", sr: "Serbian",
  sv: "Swedish", sw: "Swahili", ta: "Tamil", te: "Telugu", th: "Thai", tl: "Filipino",
  tr: "Turkish", uk: "Ukrainian", ur: "Urdu", vi: "Vietnamese", zh: "Chinese", "zh-CN": "Chinese", "zh-TW": "Chinese",
};

export function langName(code: string): string {
  if (!code) return "another language";
  return LANG_NAMES[code] || LANG_NAMES[code.split("-")[0]] || code.toUpperCase();
}

// Cheap, dependency-free guess at whether text is NOT English — used to decide
// when to offer (or auto-run) translation, so we don't translate English posts.
const EN_STOPWORDS = new Set(
  ("the of and a to in is you that it he was for on are as with his they at be this have from or one had by " +
   "not but what all were we when your can said there use an each which she do how their if will up out about " +
   "who get me my just so im its our has would could been more not what's i'm").split(" "),
);
export function probablyNotEnglish(text: string): boolean {
  // Sample the head only. Language is detectable from a snippet, and this runs once per
  // VISIBLE card on the FULL text — over a long Nostr note (10–80KB) that was a per-card
  // killer. A few thousand chars is plenty to classify.
  const t = (text || "").slice(0, 2000).replace(/https?:\/\/\S+/g, " ").replace(/[#@][\w-]+/g, " ");
  const letters = t.replace(/[^\p{L}]/gu, "");
  if (letters.length < 8) return false;
  // Count Latin letters in ONE pass. The old code regex-tested EVERY character
  // (`/\p{Script=Latin}/u.test(c)` per letter) — millions of regex runs across the
  // visible cards — which is what froze the feed on an account full of long notes.
  const latin = (letters.match(/\p{Script=Latin}/gu) || []).length;
  if ((letters.length - latin) / letters.length > 0.2) return true;   // mostly non-Latin (CJK, Cyrillic, Arabic…) → not English
  // Latin script: very low English function-word density → likely another language.
  const words = (t.toLowerCase().match(/[a-z']{2,}/g) || []);
  if (words.length < 5) return false;
  const hits = words.filter((w) => EN_STOPWORDS.has(w)).length;
  return hits / words.length < 0.08;
}

const cache = new Map<string, { text: string; src: string }>();

async function fetchTranslation(text: string): Promise<{ text: string; src: string }> {
  const q = text.slice(0, 5000); // endpoint caps query length
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(q)}`;
  for (const proxy of PROXIES) {
    try {
      const r = await fetch(proxy(url), { cache: "no-store" });
      if (!r.ok) continue;
      const j = await r.json();
      const segs: any[] = j?.[0] ?? [];
      const out = segs.map((s) => s?.[0] ?? "").join("");
      const src: string = j?.[2] ?? "";
      if (out) return { text: out, src };
    } catch { /* try next proxy */ }
  }
  throw new Error("translation unavailable");
}

export const translateService = {
  /** Translate text to English. Cached per source string. Throws if every
   *  transport fails (offline / all proxies down). */
  async toEnglish(text: string): Promise<{ text: string; src: string }> {
    const key = text.slice(0, 5000);
    const hit = cache.get(key);
    if (hit) return hit;
    const res = await fetchTranslation(text);
    cache.set(key, res);
    return res;
  },
  langName,
  probablyNotEnglish,
};
