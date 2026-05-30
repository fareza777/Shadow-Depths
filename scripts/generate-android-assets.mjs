/**
 * Generate resources/icon.png and resources/splash.png for Capacitor Assets.
 * Pure Node (no npm deps) — simple brand colors matching the game shell.
 *
 * Usage: node scripts/generate-android-assets.mjs
 * Then:  npx @capacitor/assets generate --android
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'resources');

const BG = [8, 6, 12];
const BRASS = [212, 190, 122];
const BONE = [232, 224, 208];

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  const crc = crc32(Buffer.concat([typeBuf, data]));
  crcBuf.writeUInt32BE(crc, 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0;
    rgba.copy(raw, y * stride + 1, y * width * 4, (y + 1) * width * 4);
  }
  const compressed = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

function fill(rgba, w, h, fn) {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const [r, g, b, a] = fn(x, y, w, h);
      rgba[i] = r;
      rgba[i + 1] = g;
      rgba[i + 2] = b;
      rgba[i + 3] = a;
    }
  }
}

function drawDiamond(rgba, w, h, cx, cy, radius, color, alpha = 255) {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = Math.abs(x - cx) / radius;
      const dy = Math.abs(y - cy) / (radius * 1.15);
      if (dx + dy <= 1) {
        const i = (y * w + x) * 4;
        rgba[i] = color[0];
        rgba[i + 1] = color[1];
        rgba[i + 2] = color[2];
        rgba[i + 3] = alpha;
      }
    }
  }
}

function renderIcon(size) {
  const rgba = Buffer.alloc(size * size * 4);
  fill(rgba, size, size, () => [...BG, 255]);
  drawDiamond(rgba, size, size, size / 2, size / 2, size * 0.36, BRASS);
  drawDiamond(rgba, size, size, size / 2, size / 2, size * 0.22, BONE);
  return encodePng(size, size, rgba);
}

function renderSplash(w, h) {
  const rgba = Buffer.alloc(w * h * 4);
  fill(rgba, w, h, (x, y) => {
    const t = y / h;
    return [
      Math.round(BG[0] + t * 6),
      Math.round(BG[1] + t * 4),
      Math.round(BG[2] + t * 10),
      255
    ];
  });
  drawDiamond(rgba, w, h, w / 2, h * 0.42, w * 0.18, BRASS);
  drawDiamond(rgba, w, h, w / 2, h * 0.42, w * 0.1, BONE);
  return encodePng(w, h, rgba);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, 'icon.png'), renderIcon(1024));
fs.writeFileSync(path.join(OUT_DIR, 'splash.png'), renderSplash(2732, 2732));
console.log('Wrote resources/icon.png (1024) and resources/splash.png (2732)');
