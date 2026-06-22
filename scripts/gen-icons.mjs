// Generates the favicon + PWA icon set from the brand logo (branding/logo.png).
// Run with `node scripts/gen-icons.mjs`; output lands in public/.
//
// Outputs:
//   public/logo.png             512² web logo (transparent) — nav + README
//   public/icon-192.png         192² PWA icon (transparent)
//   public/icon-512.png         512² PWA icon (transparent)
//   public/icon-maskable-512.png 512² maskable (flattened on white, fills canvas)
//   public/apple-touch-icon.png 180² iOS icon (flattened on white — iOS hates alpha)
//   public/favicon.ico          16/32/48 multi-size ICO (PNG-compressed entries)
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { PNG } from "pngjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public");
mkdirSync(OUT, { recursive: true });

const src = PNG.sync.read(readFileSync(join(ROOT, "branding", "logo.png")));

// ---- bilinear resize (RGBA) -------------------------------------------------
function resize(srcData, sw, sh, dw, dh, flattenWhite = false) {
  const out = Buffer.alloc(dw * dh * 4);
  for (let y = 0; y < dh; y++) {
    const sy = (y + 0.5) * (sh / dh) - 0.5;
    const y0 = Math.max(0, Math.floor(sy)), y1 = Math.min(sh - 1, y0 + 1), fy = Math.min(1, Math.max(0, sy - y0));
    for (let x = 0; x < dw; x++) {
      const sx = (x + 0.5) * (sw / dw) - 0.5;
      const x0 = Math.max(0, Math.floor(sx)), x1 = Math.min(sw - 1, x0 + 1), fx = Math.min(1, Math.max(0, sx - x0));
      const o = (y * dw + x) * 4;
      for (let c = 0; c < 4; c++) {
        const p00 = srcData[(y0 * sw + x0) * 4 + c], p10 = srcData[(y0 * sw + x1) * 4 + c];
        const p01 = srcData[(y1 * sw + x0) * 4 + c], p11 = srcData[(y1 * sw + x1) * 4 + c];
        const top = p00 + (p10 - p00) * fx, bot = p01 + (p11 - p01) * fx;
        out[o + c] = Math.round(top + (bot - top) * fy);
      }
    }
  }
  if (flattenWhite) {
    for (let i = 0; i < dw * dh; i++) {
      const a = out[i * 4 + 3] / 255;
      for (let c = 0; c < 3; c++) out[i * 4 + c] = Math.round(out[i * 4 + c] * a + 255 * (1 - a));
      out[i * 4 + 3] = 255;
    }
  }
  return out;
}

function pngBuffer(size, flattenWhite = false) {
  const png = new PNG({ width: size, height: size });
  resize(src.data, src.width, src.height, size, size, flattenWhite).copy(png.data);
  return PNG.sync.write(png);
}

// ---- ICO writer (PNG-compressed entries) -----------------------------------
function buildIco(sizes) {
  const imgs = sizes.map((s) => ({ size: s, data: pngBuffer(s) }));
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);            // reserved
  header.writeUInt16LE(1, 2);            // type 1 = icon
  header.writeUInt16LE(imgs.length, 4);  // count
  const dir = Buffer.alloc(16 * imgs.length);
  let offset = 6 + dir.length;
  imgs.forEach((img, i) => {
    const e = i * 16;
    dir[e] = img.size >= 256 ? 0 : img.size;     // width  (0 = 256)
    dir[e + 1] = img.size >= 256 ? 0 : img.size; // height
    dir[e + 2] = 0;                              // palette
    dir[e + 3] = 0;                              // reserved
    dir.writeUInt16LE(1, e + 4);                 // color planes
    dir.writeUInt16LE(32, e + 6);                // bits per pixel
    dir.writeUInt32LE(img.data.length, e + 8);   // size of image data
    dir.writeUInt32LE(offset, e + 12);           // offset
    offset += img.data.length;
  });
  return Buffer.concat([header, dir, ...imgs.map((i) => i.data)]);
}

// ---- write everything ------------------------------------------------------
const png = (name, size, flat = false) => { writeFileSync(join(OUT, name), pngBuffer(size, flat)); console.log("wrote", name, `(${size}x${size}${flat ? ", flattened" : ""})`); };

png("logo.png", 512);
png("icon-192.png", 192);
png("icon-512.png", 512);
png("icon-maskable-512.png", 512, true);
png("apple-touch-icon.png", 180, true);

writeFileSync(join(OUT, "favicon.ico"), buildIco([16, 32, 48]));
console.log("wrote favicon.ico (16,32,48)");
