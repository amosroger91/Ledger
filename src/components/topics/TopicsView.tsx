import { useEffect, useState } from "react";
import { Box, Stack, Typography, Switch, Button, TextField, Chip, FormControlLabel, Checkbox, IconButton, Select, MenuItem, Divider } from "@mui/material";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import GlassCard from "@/components/common/GlassCard";
import { rssService, TOPIC_FEEDS, type RssConfig } from "@/services/rssService";
import { toast } from "@/lib/events";

export default function TopicsView() {
  const [cfg, setCfg] = useState<RssConfig | null>(null);
  const [busy, setBusy] = useState(false);
  const [custom, setCustom] = useState({ topic: Object.keys(TOPIC_FEEDS)[0], url: "", name: "" });

  const load = () => rssService.config().then(setCfg);
  useEffect(() => { load(); }, []);
  if (!cfg) return null;

  const topics = [...new Set([...Object.keys(TOPIC_FEEDS), ...cfg.custom.map((c) => c.topic)])];

  async function sub(topic: string, on: boolean) { await rssService.subscribe(topic, on); load(); }
  async function toggleFeed(url: string, on: boolean) { await rssService.toggleFeed(url, on); load(); }
  async function addCustom() {
    if (!custom.url.trim()) return;
    await rssService.addCustomFeed(custom.topic, custom.url.trim(), custom.name.trim());
    setCustom({ ...custom, url: "", name: "" }); load();
  }
  async function refresh() {
    setBusy(true);
    const n = await rssService.refresh(true);
    setBusy(false); load();
    toast(n ? `Posted ${n} story update${n === 1 ? "" : "s"} from RSS Bot` : "No new stories right now", n ? "success" : "info");
  }

  return (
    <Box sx={{ maxWidth: 900, mx: "auto" }}>
      <Stack direction="row" alignItems="center" sx={{ mb: 2 }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5">Topics</Typography>
          <Typography variant="body2" color="text.secondary">Subscribe to topics and RSS Bot keeps your feed alive — it pulls the top stories and your on-device LLM writes the post.</Typography>
        </Box>
        <Button variant="contained" startIcon={<RefreshRoundedIcon />} disabled={busy} onClick={refresh}>{busy ? "Fetching…" : "Refresh now"}</Button>
      </Stack>

      <Stack spacing={2}>
        {topics.map((topic) => {
          const subscribed = cfg.topics.includes(topic);
          const curated = TOPIC_FEEDS[topic] ?? [];
          const customFeeds = cfg.custom.filter((c) => c.topic === topic);
          return (
            <GlassCard key={topic}>
              <Stack direction="row" alignItems="center">
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontWeight: 700 }}>{topic}</Typography>
                  <Typography variant="caption" color="text.secondary">{curated.length + customFeeds.length} feeds · top 2 are used</Typography>
                </Box>
                <FormControlLabel control={<Switch checked={subscribed} onChange={(e) => sub(topic, e.target.checked)} />} label={subscribed ? "Subscribed" : "Off"} />
              </Stack>
              {subscribed && (
                <Stack sx={{ mt: 1, pl: 1 }}>
                  {[...curated, ...customFeeds].map((f, i) => (
                    <Stack key={f.url} direction="row" alignItems="center" spacing={1}>
                      <Checkbox size="small" checked={!cfg.disabled.includes(f.url)} onChange={(e) => toggleFeed(f.url, e.target.checked)} />
                      <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} noWrap>{f.name} {i < 2 && <Chip size="small" label="relevant" sx={{ height: 16, fontSize: 9, ml: 0.5 }} />}</Typography>
                      {customFeeds.includes(f as any) && <IconButton size="small" onClick={() => rssService.removeCustomFeed(f.url).then(load)}><DeleteOutlineRoundedIcon fontSize="small" /></IconButton>}
                    </Stack>
                  ))}
                </Stack>
              )}
            </GlassCard>
          );
        })}
      </Stack>

      <GlassCard sx={{ mt: 2 }}>
        <Typography variant="overline" color="text.secondary">Add a custom RSS feed</Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 1 }}>
          <Select size="small" value={custom.topic} onChange={(e) => setCustom({ ...custom, topic: e.target.value })} sx={{ minWidth: 140 }}>
            {topics.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
          </Select>
          <TextField size="small" placeholder="Feed name" value={custom.name} onChange={(e) => setCustom({ ...custom, name: e.target.value })} />
          <TextField size="small" fullWidth placeholder="https://example.com/rss.xml" value={custom.url} onChange={(e) => setCustom({ ...custom, url: e.target.value })} />
          <Button variant="outlined" onClick={addCustom}>Add</Button>
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
          Feeds are fetched through public CORS proxies. RSS Bot posts appear in your Feed tagged with the topic.
        </Typography>
      </GlassCard>
    </Box>
  );
}
