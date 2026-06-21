// ============================================================
//  chatMedia — mic/camera capture for the Chatroom voice/video mesh.
//  Owns only the local capture stream; chatroomService wires the P2P
//  calls. (Functionality ported from OpenWhisper, restyled-free.)
// ============================================================
let localStream: MediaStream | null = null;
let state = { audio: false, video: false };

export function getState() { return { ...state }; }
export function getLocalStream() { return localStream; }
export function hasMedia() { return !!localStream && (state.audio || state.video); }

export async function setMedia(want: { audio: boolean; video: boolean }): Promise<MediaStream | null> {
  if (!want.audio && !want.video) { stopLocal(); state = want; return null; }
  const fresh = await navigator.mediaDevices.getUserMedia({
    audio: want.audio,
    video: want.video ? { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" } : false,
  });
  stopLocal();
  localStream = fresh; state = want;
  return localStream;
}

export function stopLocal() {
  if (localStream) for (const t of localStream.getTracks()) { try { t.stop(); } catch {} }
  localStream = null;
}
