// ============================================================
//  rss/feeds.js — the FULL topic catalog the relay refreshes for
//  everyone, every cycle. Ported from the frontend's TOPIC_FEEDS so the
//  always-on relay covers every topic the app offers — clients then
//  consume the results over Gun and never have to fetch RSS themselves.
//  Topic NAMES are kept identical to the frontend so the post tag-slugs
//  (lowercased, alnum-only) match its "For You" subscription filter.
//
//  Feed shape: { title, url, topic, kind? }  where kind ∈
//  rss(default) | youtube(@handle/url) | podcast(name) | cve(app).
// ============================================================
import { config } from "../config.js";
import { stableId } from "../lib/hash.js";

export function withId(f) {
  return { id: f.id || stableId("feed", (f.kind || "rss") + ":" + f.url), ...f };
}

const reddit = (sub, title) => ({ title, url: `https://www.reddit.com/r/${sub}/.rss` });
const github = (repo) => ({ title: repo, url: `https://github.com/${repo}/releases.atom` });
const yt = (handle, title) => ({ title, url: handle, kind: "youtube" });
const podc = (term, title) => ({ title, url: term, kind: "podcast" });
const cveF = (app, title) => ({ title, url: app, kind: "cve" });
const tk = (id, title) => ({ title, url: `https://rss.app/feeds/${id}.xml` });
const gnews = (q) => `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;

// topic name -> feeds. Mirrors src/services/rssService.ts TOPIC_FEEDS.
const CATALOG = {
  "World & Breaking News": [
    { title: "BBC News", url: "https://feeds.bbci.co.uk/news/rss.xml" },
    { title: "BBC World", url: "https://feeds.bbci.co.uk/news/world/rss.xml" },
    { title: "New York Times", url: "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml" },
    { title: "NPR News", url: "https://feeds.npr.org/1001/rss.xml" },
    { title: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml" },
  ],
  Technology: [
    { title: "The Verge", url: "https://www.theverge.com/rss/index.xml" },
    { title: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/index" },
    { title: "WIRED", url: "https://www.wired.com/feed/rss" },
    { title: "TechCrunch", url: "https://techcrunch.com/feed/" },
  ],
  "AI & Machine Learning": [
    { title: "Hugging Face Blog", url: "https://huggingface.co/blog/feed.xml" },
    { title: "arXiv cs.AI", url: "http://export.arxiv.org/rss/cs.AI" },
    { title: "MarkTechPost", url: "https://www.marktechpost.com/feed/" },
  ],
  "Business & Finance": [
    { title: "BBC Business", url: "https://feeds.bbci.co.uk/news/business/rss.xml" },
    { title: "Business Insider", url: "https://feeds.businessinsider.com/custom/all" },
    { title: "CNBC", url: "https://www.cnbc.com/id/100003114/device/rss/rss.html" },
  ],
  "Science & Space": [
    { title: "NASA", url: "https://www.nasa.gov/news-release/feed/" },
    { title: "ScienceDaily", url: "https://www.sciencedaily.com/rss/all.xml" },
    { title: "Space.com", url: "https://www.space.com/feeds/all" },
  ],
  Sports: [
    { title: "ESPN", url: "https://www.espn.com/espn/rss/news" },
    { title: "BBC Sport", url: "https://feeds.bbci.co.uk/sport/rss.xml" },
  ],
  Gaming: [
    { title: "Polygon", url: "https://www.polygon.com/rss/index.xml" },
    { title: "Kotaku", url: "https://kotaku.com/rss" },
  ],

  "YouTube · Finance": [yt("@CalebHammer", "Caleb Hammer")],
  "YouTube · News": [yt("@PhilipDeFranco", "Philip DeFranco")],
  "YouTube · History": [yt("@TheHistoryGuyChannel", "The History Guy"), yt("@DarkDocs", "Dark Docs"), yt("@TheArmchairHistorian", "The Armchair Historian")],
  "YouTube · Guns & Freedom": [yt("@TheAKGuy", "Brandon Herrera"), yt("@DonutOperator", "Donut Operator"), yt("@themodernrogue", "The Modern Rogue")],
  "YouTube · Comedy": [yt("@TheoVon", "Theo Von"), yt("@SamMorril", "Sam Morril"), yt("@jpsearsreacts", "JP Sears"), yt("@YMHStudios", "YMH Studios")],
  "YouTube · Gaming": [yt("@ZackRawrr", "Asmongold TV"), yt("@SomeOrdinaryGamers", "SomeOrdinaryGamers")],
  "YouTube · Tech": [yt("@TechnologyConnections", "Technology Connections"), yt("@NetworkChuck", "NetworkChuck"), yt("@ThePrimeTimeagen", "ThePrimeTime"), yt("https://www.youtube.com/coldfusion", "ColdFusion")],
  "YouTube · Faith & Kindness": [yt("@voiceofkindness-p7t", "Voice of Kindness"), yt("@jaramillocynthia906", "Cynthia Jaramillo")],
  "YouTube · AI": [yt("@HouseofEl-AI", "House of El (AI)")],
  "YouTube · More": [yt("@GEN", "GEN"), yt("@Moon-Real", "Moon-Real")],

  "TikTok · News & Politics": [tk("8ij5l1XVCISffJkW", "Candace (TikTok)"), tk("btLstflN27YpkwS2", "Tucker Carlson Network (TikTok)")],
  "TikTok · Guns & Coffee": [tk("FSMRlQoT7fMqNWDl", "UNDERDAWG (TikTok)"), tk("RcAehastMj38bbrg", "Black Rifle Coffee (TikTok)")],
  "TikTok · Faith": [tk("KpaeeqmPiB6EKPAa", "houstondprays (TikTok)")],
  "TikTok · Creators": [tk("WN7Xtyd0YymjU9RO", "ericplaytwomuch (TikTok)"), tk("ci7fY49yIDeqpdZq", "readchoi (TikTok)"), tk("FPgsr8i3PgZLs1wm", "Ci James (TikTok)"), tk("y8yCRjsEZMvuSSDO", "Joe Rauth (TikTok)")],

  Podcasts: [
    podc("Bad Friends", "Bad Friends"),
    podc("This Past Weekend Theo Von", "Theo Von — This Past Weekend"),
    podc("The Joe Rogan Experience", "Joe Rogan Experience"),
    podc("Two Bears One Cave", "Two Bears, One Cave"),
    podc("Matt and Shane's Secret Podcast", "Matt & Shane's Secret Podcast"),
    podc("Kill Tony", "Kill Tony"),
  ],

  "Reddit · Dude Bros": [reddit("JoeRogan", "r/JoeRogan"), reddit("Theovon", "r/Theovon"), reddit("barstoolsports", "r/barstoolsports")],
  "Reddit · Tech Bros": [reddit("programming", "r/programming"), reddit("homelab", "r/homelab"), reddit("selfhosted", "r/selfhosted")],
  "Reddit · Gun Bros": [reddit("guns", "r/guns"), reddit("Firearms", "r/Firearms"), reddit("CCW", "r/CCW")],
  "Reddit · Outdoor Bros": [reddit("overlanding", "r/overlanding"), reddit("camping", "r/camping"), reddit("EDC", "r/EDC")],

  "GitHub Releases": [github("ollama/ollama"), github("microsoft/vscode"), github("facebook/react"), github("vercel/next.js"), github("denoland/deno")],

  "Daily Verse": [
    { title: "Bible Gateway — Verse of the Day", url: "https://www.biblegateway.com/votd/get/?format=atom&version=9" },
  ],

  "3D Printing": [
    { title: "Cults3D — latest creations", url: "https://cults3d.com/en/creations/feed" },
    { title: "All3DP", url: "https://all3dp.com/feed/" },
  ],

  "Fort Smith, AR": [
    { title: "5NEWS (KFSM)", url: "https://www.5newsonline.com/feeds/syndication/rss/news" },
    { title: "5NEWS — Google News", url: gnews('"5NEWS" OR KFSM Fort Smith Arkansas') },
    { title: "Fort Smith — Google News", url: gnews("Fort Smith Arkansas") },
    { title: "Times Record (Fort Smith)", url: gnews('"Times Record" Fort Smith Arkansas') },
  ],

  "Security · CVEs": [cveF("google chrome", "CVEs · Chrome (example)")],
};

// Flatten to id'd feed records, each tagged with its topic.
export const DEFAULT_FEEDS = Object.entries(CATALOG).flatMap(([topic, feeds]) =>
  feeds.map((f) => withId({ ...f, topic })),
);

/** YouTube channel/playlist → official RSS (used by the /api ad-hoc add). */
export function youtubeFeed({ channelId, playlistId, title, topic = "youtube" }) {
  if (!channelId && !playlistId) throw new Error("channelId or playlistId required");
  const url = channelId
    ? `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`
    : `https://www.youtube.com/feeds/videos.xml?playlist_id=${encodeURIComponent(playlistId)}`;
  return withId({ title: title || `YouTube ${channelId || playlistId}`, url, topic });
}

/** Anything-with-no-native-RSS via RSSHub (e.g. Twitch: "/twitch/live/:user"). */
export function rsshubFeed(route, { title, topic = "live" } = {}) {
  if (!config.rsshubBase) return null;
  const path = route.startsWith("/") ? route : "/" + route;
  return withId({ title: title || `RSSHub ${route}`, url: config.rsshubBase + path, topic });
}
