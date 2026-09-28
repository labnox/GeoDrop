import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function crc32(buf) {
  let table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  const payload = Buffer.concat([typeBuf, data]);
  crcBuf.writeUInt32BE(crc32(payload), 0);
  return Buffer.concat([len, payload, crcBuf]);
}

function createPng(width, height, isMaskable = false) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // 8-bit depth
  ihdr.writeUInt8(6, 9); // RGBA
  ihdr.writeUInt8(0, 10);
  ihdr.writeUInt8(0, 11);
  ihdr.writeUInt8(0, 12);
  const ihdrChunk = makeChunk('IHDR', ihdr);

  const rawRows = [];
  const cx = width / 2;
  const cy = height / 2;
  const maxR = width / 2;

  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 4);
    row[0] = 0; // Filter none
    for (let x = 0; x < width; x++) {
      const idx = 1 + x * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Base background: #0f172a (15, 23, 42)
      let r = 15, g = 23, b = 42, a = 255;

      // Dark blue gradient
      const grad = (y / height);
      r = Math.round(15 + grad * 15);
      g = Math.round(23 + grad * 25);
      b = Math.round(42 + grad * 40);

      // Safe zone / radar circles
      const safeRadius = isMaskable ? maxR * 0.75 : maxR * 0.85;

      // Concentric beacon rings
      if (Math.abs(dist - safeRadius * 0.75) < 3) {
        // Outer cyan ring
        r = 6; g = 182; b = 212; a = 180;
      } else if (Math.abs(dist - safeRadius * 0.5) < 4) {
        // Emerald middle ring
        r = 16; g = 185; b = 129; a = 220;
      } else if (dist < safeRadius * 0.28) {
        // Inner glowing beacon
        r = 6; g = 182; b = 212; a = 255;
      } else if (dist < safeRadius * 0.16) {
        // Core pin center
        r = 255; g = 255; b = 255; a = 255;
      }

      row[idx] = r;
      row[idx + 1] = g;
      row[idx + 2] = b;
      row[idx + 3] = a;
    }
    rawRows.push(row);
  }

  const rawData = Buffer.concat(rawRows);
  const compressed = zlib.deflateSync(rawData);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk]);
}

const pubDir = path.resolve('public');
if (!fs.existsSync(pubDir)) {
  fs.mkdirSync(pubDir, { recursive: true });
}

fs.writeFileSync(path.join(pubDir, 'pwa-192x192.png'), createPng(192, 192, false));
fs.writeFileSync(path.join(pubDir, 'pwa-512x512.png'), createPng(512, 512, false));
fs.writeFileSync(path.join(pubDir, 'pwa-maskable-512x512.png'), createPng(512, 512, true));
fs.writeFileSync(path.join(pubDir, 'apple-touch-icon.png'), createPng(180, 180, false));
fs.writeFileSync(path.join(pubDir, 'favicon.ico'), createPng(64, 64, false));

console.log('PWA icons created successfully.');
