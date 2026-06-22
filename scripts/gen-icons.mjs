// Generates the PWA icon set as real PNGs — no image libraries, just Node's
// zlib. Run with `node scripts/gen-icons.mjs`; output lands in public/.
// The mark is Ledger's blue rounded tile with a white "L", matching the nav
// logo gradient (#3f97ff → #1668e0 → #0a55cf).
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
mkdirSync(OUT, { recursive: true });

// ---- tiny PNG encoder (RGBA, 8-bit) ----------------------------------------
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}
function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // color type RGBA
  // raw scanlines, each prefixed with filter byte 0
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---- drawing ---------------------------------------------------------------
const lerp = (a, b, t) => a + (b - a) * t;
function gradientAt(t) {
  // 3-stop vertical gradient matching the brand logo
  const stops = [
    [0.0, [0x3f, 0x97, 0xff]],
    [0.5, [0x16, 0x68, 0xe0]],
    [1.0, [0x0a, 0x55, 0xcf]],
  ];
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const f = (t - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]);
      const a = stops[i - 1][1], b = stops[i][1];
      return [lerp(a[0], b[0], f), lerp(a[1], b[1], f), lerp(a[2], b[2], f)];
    }
  }
  return stops[stops.length - 1][1];
}

function drawIcon(size, { maskable }) {
  const rgba = Buffer.alloc(size * size * 4);
  // maskable icons must fill the whole canvas (safe zone is the inner 80%);
  // regular icons get a rounded-square tile with transparent corners.
  const radius = maskable ? 0 : size * 0.22;
  // glyph box — give maskable extra padding so nothing is clipped by the OS mask
  const pad = maskable ? size * 0.3 : size * 0.26;
  const gx0 = pad, gx1 = size - pad;
  const gy0 = pad, gy1 = size - pad;
  const gw = gx1 - gx0, gh = gy1 - gy0;
  const bar = gh * 0.2;          // thickness of the L's strokes

  const insideRoundedRect = (x, y) => {
    if (radius <= 0) return true;
    const rx = Math.min(Math.max(x, radius), size - radius);
    const ry = Math.min(Math.max(y, radius), size - radius);
    const dx = x - rx, dy = y - ry;
    return dx * dx + dy * dy <= radius * radius;
  };

  const inL = (x, y) => {
    if (x < gx0 || x > gx1 || y < gy0 || y > gy1) return false;
    if (x <= gx0 + bar) return true;            // vertical (left) stroke
    if (y >= gy1 - bar) return true;            // bottom (foot) stroke
    return false;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      if (!insideRoundedRect(x + 0.5, y + 0.5)) {
        rgba[i + 3] = 0; // transparent corner
        continue;
      }
      if (inL(x + 0.5, y + 0.5)) {
        rgba[i] = 255; rgba[i + 1] = 255; rgba[i + 2] = 255; rgba[i + 3] = 255;
      } else {
        const [r, g, b] = gradientAt(y / size);
        rgba[i] = Math.round(r); rgba[i + 1] = Math.round(g); rgba[i + 2] = Math.round(b); rgba[i + 3] = 255;
      }
    }
  }
  return encodePNG(size, size, rgba);
}

const targets = [
  ["icon-192.png", 192, { maskable: false }],
  ["icon-512.png", 512, { maskable: false }],
  ["icon-maskable-512.png", 512, { maskable: true }],
  ["apple-touch-icon.png", 180, { maskable: true }], // iOS crops to a rounded square itself
];
for (const [name, size, opts] of targets) {
  writeFileSync(join(OUT, name), drawIcon(size, opts));
  console.log("wrote", name, `(${size}x${size})`);
}
