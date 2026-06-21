// ============================================================
//  chatroomService — real-time peer-to-peer rooms (functionality
//  ported from OpenWhisper; no styling carried over). Star topology:
//  the first peer to claim "zb-room-<slug>" is the HUB and relays
//  chat / presence / reactions to everyone, hands new joiners the
//  recent history, and re-elects if it leaves. Voice/video is a full
//  WebRTC mesh on top, capped at MESH_CAP people.
// ============================================================
import { Peer, type DataConnection, type MediaConnection } from "peerjs";
import type { ChatMessage } from "@/types";
import { storage } from "./storage";
import { getLocalStream, hasMedia } from "./chatMedia";
import { newId } from "@/lib/id";

const MESH_CAP = 8;
const HISTORY_SHARE = 200;

export interface RoomMember { id: string; name: string; avatar?: string; peerId: string; av: boolean; }
export interface RoomIdentity { id: string; name: string; avatar?: string; }

export interface RoomHandlers {
  onStatus?: (s: string) => void;
  onSelf?: (i: { hub: boolean }) => void;
  onRoster?: (members: RoomMember[], info: { capped: boolean }) => void;
  onHistory?: (msgs: ChatMessage[]) => void;
  onChat?: (m: ChatMessage) => void;
  onReact?: (msgId: string, reactions: Record<string, string[]>) => void;
  onRemoteStream?: (memberId: string, stream: MediaStream) => void;
  onRemoteEnd?: (memberId: string) => void;
  onError?: (type: string) => void;
}

export function roomPeerId(roomId: string): string {
  const slug = roomId.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  return "zb-room-" + (slug || "x");
}

export function joinChatroom(opts: { roomId: string; identity: RoomIdentity; handlers?: RoomHandlers }) {
  const { roomId, handlers: h = {} } = opts;
  let identity = opts.identity;
  const channel = "room:" + roomId;
  const HUB_ID = roomPeerId(roomId);

  let peer: Peer | null = null;
  let isHub = false;
  let hubConn: DataConnection | null = null;
  const clientConns = new Map<string, DataConnection>();
  let members: RoomMember[] = [];
  let leaving = false;
  let reelectTimer: any = null;
  const mediaConns = new Map<string, MediaConnection>();
  let reconcileTimer: any = null;

  const status = (s: string) => h.onStatus?.(s);
  const myPeerId = () => peer?.id ?? "";
  const capped = () => members.length > MESH_CAP;

  function selfMember(): RoomMember { return { id: identity.id, name: identity.name, avatar: identity.avatar, peerId: myPeerId(), av: hasMedia() }; }
  function upsert(m: RoomMember) { const i = members.findIndex((x) => x.id === m.id); if (i >= 0) members[i] = { ...members[i], ...m }; else members.push(m); }
  function emitRoster() { h.onRoster?.(members.slice(), { capped: capped() }); scheduleReconcile(); }

  function broadcast(env: any, except?: string) { for (const [pid, c] of clientConns) { if (pid === except) continue; try { if (c.open) c.send(env); } catch {} } }
  function toHub(env: any) { if (isHub) handleAtHub(env, null); else { try { if (hubConn?.open) hubConn.send(env); } catch {} } }

  function stamp(payload: any, m: RoomMember): ChatMessage {
    return {
      id: newId("rm"), channel, author: m.id, authorName: m.name, authorAvatar: m.avatar,
      text: payload.text != null ? String(payload.text).slice(0, 2000) : undefined,
      media: payload.media, reactions: {}, createdAt: Date.now(),
    };
  }
  function sysMsg(text: string): ChatMessage {
    return { id: newId("rm"), channel, author: "system", authorName: "system", text, reactions: {}, createdAt: Date.now() };
  }
  async function deliverChat(msg: ChatMessage) { await storage.putMessage(msg); h.onChat?.(msg); }
  function submit(payload: any) {
    if (isHub) { const msg = stamp(payload, selfMember()); deliverChat(msg); broadcast({ t: "chat", d: msg }); }
    else toHub({ t: "chat", d: payload });
  }

  async function applyReact(msgId: string, emoji: string, from: string) {
    const all = await storage.messages(channel);
    const m = all.find((x) => x.id === msgId);
    if (!m) return;
    m.reactions = m.reactions || {};
    const arr = m.reactions[emoji] || [];
    const i = arr.indexOf(from);
    if (i >= 0) arr.splice(i, 1); else arr.push(from);
    if (arr.length) m.reactions[emoji] = arr; else delete m.reactions[emoji];
    await storage.putMessage(m);
    h.onReact?.(msgId, m.reactions);
  }
  function hubReact(msgId: string, emoji: string, from: string) { broadcast({ t: "react", d: { msgId, emoji, from } }); applyReact(msgId, emoji, from); }

  async function handleAtHub(env: any, fromPeerId: string | null) {
    if (!env?.t) return;
    if (env.t === "hello") {
      const m = env.d || {};
      upsert({ id: m.id, name: m.name, avatar: m.avatar, peerId: fromPeerId!, av: false });
      const conn = fromPeerId ? clientConns.get(fromPeerId) : null;
      if (conn) { const hist = (await storage.messages(channel)).slice(-HISTORY_SHARE); try { conn.send({ t: "welcome", d: { roster: members.slice(), history: hist } }); } catch {} }
      const sm = sysMsg(`${m.name || "Someone"} joined`); deliverChat(sm); broadcast({ t: "chat", d: sm });
      emitRoster(); broadcast({ t: "roster", d: members.slice() });
    } else if (env.t === "chat") {
      const member = members.find((x) => x.peerId === fromPeerId) || { id: "?", name: "?", peerId: "", av: false };
      const msg = stamp(env.d || {}, member); deliverChat(msg); broadcast({ t: "chat", d: msg });
    } else if (env.t === "react") {
      const member = members.find((x) => x.peerId === fromPeerId);
      if (member && env.d) hubReact(env.d.msgId, env.d.emoji, member.id);
    } else if (env.t === "meta") {
      const i = members.findIndex((x) => x.peerId === fromPeerId);
      if (i >= 0) { const d = env.d || {}; members[i].av = !!d.av; if (d.name != null) members[i].name = d.name; if ("avatar" in d) members[i].avatar = d.avatar; }
      emitRoster(); broadcast({ t: "roster", d: members.slice() });
    }
  }

  async function handleFromHub(env: any) {
    if (!env?.t) return;
    if (env.t === "welcome") {
      members = (env.d.roster || []).slice();
      for (const m of (env.d.history || [])) await storage.putMessage(m);
      if (env.d.history?.length) h.onHistory?.(env.d.history);
      emitRoster();
    } else if (env.t === "roster") { members = (env.d || []).slice(); pruneStaleMedia(); emitRoster(); }
    else if (env.t === "chat") deliverChat(env.d);
    else if (env.t === "react") { if (env.d) applyReact(env.d.msgId, env.d.emoji, env.d.from); }
  }

  /* ---------------- A/V mesh ---------------- */
  function resolveMemberId(peerId: string) { return members.find((x) => x.peerId === peerId)?.id ?? peerId; }
  function trackCall(call: MediaConnection) {
    const pid = call.peer;
    mediaConns.set(pid, call);
    call.on("stream", (s) => h.onRemoteStream?.(resolveMemberId(pid), s));
    call.on("close", () => { mediaConns.delete(pid); h.onRemoteEnd?.(resolveMemberId(pid)); scheduleReconcile(); });
    (call as any).on("error", () => { mediaConns.delete(pid); h.onRemoteEnd?.(resolveMemberId(pid)); scheduleReconcile(); });
  }
  function scheduleReconcile() { clearTimeout(reconcileTimer); reconcileTimer = setTimeout(reconcileMesh, 350); }
  function reconcileMesh() {
    if (capped() || !hasMedia() || !peer) return;
    const stream = getLocalStream(); if (!stream) return;
    for (const m of members) {
      if (m.id === identity.id || !m.av || !m.peerId || mediaConns.has(m.peerId)) continue;
      if (myPeerId() < m.peerId) { try { trackCall(peer.call(m.peerId, stream)); } catch {} }
    }
  }
  function pruneStaleMedia() {
    const live = new Set(members.map((m) => m.peerId));
    for (const [pid, call] of mediaConns) if (!live.has(pid)) { try { call.close(); } catch {} mediaConns.delete(pid); h.onRemoteEnd?.(resolveMemberId(pid)); }
  }
  function closeAllMedia() { for (const [pid, call] of mediaConns) { try { call.close(); } catch {} h.onRemoteEnd?.(resolveMemberId(pid)); } mediaConns.clear(); }

  /* ---------------- lifecycle ---------------- */
  function wireClientConn(c: DataConnection) {
    hubConn = c;
    c.on("open", () => { status("Connected"); try { c.send({ t: "hello", d: { id: identity.id, name: identity.name, avatar: identity.avatar } }); } catch {} });
    c.on("data", (d) => handleFromHub(d));
    c.on("close", () => { if (!leaving) reelect(); });
    (c as any).on("error", () => { if (!leaving) reelect(); });
  }
  function startAsHub() {
    isHub = true; members = [selfMember()]; status("Hosting room");
    storage.messages(channel).then((hist) => { if (hist.length) h.onHistory?.(hist); });
    h.onSelf?.({ hub: true });
    emitRoster();
    peer!.on("connection", (c) => {
      c.on("open", () => { clientConns.set(c.peer, c); });
      c.on("data", (env) => handleAtHub(env, c.peer));
      c.on("close", () => {
        clientConns.delete(c.peer);
        const m = members.find((x) => x.peerId === c.peer);
        members = members.filter((x) => x.peerId !== c.peer);
        if (m) { const sm = sysMsg(`${m.name} left`); deliverChat(sm); broadcast({ t: "chat", d: sm }); }
        pruneStaleMedia(); emitRoster(); broadcast({ t: "roster", d: members.slice() });
      });
      (c as any).on("error", () => {});
    });
    peer!.on("call", (call) => { call.answer(getLocalStream() || undefined); trackCall(call); });
  }
  function startAsClient() {
    isHub = false; status("Joining…"); h.onSelf?.({ hub: false });
    wireClientConn(peer!.connect(HUB_ID, { reliable: true }));
    peer!.on("call", (call) => { call.answer(getLocalStream() || undefined); trackCall(call); });
  }
  function reelect() {
    if (leaving) return;
    closeAllMedia(); clearTimeout(reelectTimer);
    try { peer?.destroy(); } catch {}
    peer = null; hubConn = null; status("Reconnecting…");
    reelectTimer = setTimeout(connect, 300 + Math.random() * 900);
  }
  function connect() {
    if (leaving) return;
    if (!Peer) { h.onError?.("peerjs-unavailable"); return; }
    status("Connecting…");
    peer = new Peer(HUB_ID);
    peer.on("open", () => startAsHub());
    peer.on("error", (e: any) => {
      const type = e?.type || String(e);
      if (type === "unavailable-id") {
        try { peer?.destroy(); } catch {}
        peer = new Peer();
        peer.on("open", () => startAsClient());
        peer.on("error", (e2: any) => { const t2 = e2?.type || String(e2); if (t2 === "peer-unavailable" && !leaving) reelect(); else if (!leaving) h.onError?.(t2); });
      } else if (!leaving) h.onError?.(type);
    });
  }

  connect();

  return {
    get isHub() { return isHub; },
    get size() { return members.length; },
    get capped() { return capped(); },
    sendChat(text: string) { const t = String(text || "").trim(); if (t) submit({ text }); },
    sendImage(url: string, mime: string) { submit({ media: [{ type: "image", url, mime }] }); },
    sendReact(msgId: string, emoji: string) { if (!msgId || !emoji) return; if (isHub) hubReact(msgId, emoji, identity.id); else toHub({ t: "react", d: { msgId, emoji } }); },
    refreshMedia() {
      closeAllMedia();
      const i = members.findIndex((x) => x.id === identity.id);
      if (i >= 0) members[i].av = hasMedia();
      if (isHub) { emitRoster(); broadcast({ t: "roster", d: members.slice() }); }
      else { toHub({ t: "meta", d: { av: hasMedia() } }); scheduleReconcile(); }
    },
    updateIdentity(next: Partial<RoomIdentity>) {
      identity = { ...identity, ...next };
      const i = members.findIndex((x) => x.id === identity.id);
      if (i >= 0) { members[i].name = identity.name; members[i].avatar = identity.avatar; }
      if (isHub) { emitRoster(); broadcast({ t: "roster", d: members.slice() }); }
      else toHub({ t: "meta", d: { av: hasMedia(), name: identity.name, avatar: identity.avatar } });
    },
    leave() {
      leaving = true; clearTimeout(reelectTimer); clearTimeout(reconcileTimer);
      closeAllMedia();
      try { for (const c of clientConns.values()) c.close(); } catch {}
      clientConns.clear();
      try { hubConn?.close(); } catch {}
      try { peer?.destroy(); } catch {}
      peer = null;
    },
  };
}
