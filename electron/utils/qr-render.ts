/**
 * Shared QR code PNG renderer for the main process.
 * Generates a QR code image as a base64-encoded PNG string from a URL/string.
 *
 * Uses qrcode-terminal (vendored in the openclaw package) for QR matrix generation,
 * then encodes to PNG using a minimal built-in encoder (no external PNG lib needed).
 */

import { dirname, join } from 'path';
import { createRequire } from 'module';
import { deflateSync } from 'zlib';
import { getOpenClawResolvedDir } from './paths';

const require = createRequire(import.meta.url);

function resolveQrCodeTerminalPath(): string {
  try {
    const openclawResolvedPath = getOpenClawResolvedDir();
    const openclawRequire = createRequire(join(openclawResolvedPath, 'package.json'));
    return dirname(openclawRequire.resolve('qrcode-terminal/package.json'));
  } catch {
    throw new Error('Could not resolve qrcode-terminal from OpenClaw context');
  }
}

let _QRCode: new (typeNumber: number, errorCorrectionLevel: number) => {
  addData(data: string): void;
  make(): void;
  getModuleCount(): number;
  isDark(row: number, col: number): boolean;
} | null = null;

let _QRErrorCorrectLevel: Record<string, number> | null = null;

function loadQrModules() {
  if (_QRCode && _QRErrorCorrectLevel) return;
  const qrcodeTerminalPath = resolveQrCodeTerminalPath();
  _QRCode = require(join(qrcodeTerminalPath, 'vendor', 'QRCode', 'index.js'));
  _QRErrorCorrectLevel = require(join(qrcodeTerminalPath, 'vendor', 'QRCode', 'QRErrorCorrectLevel.js'));
}

// --- Minimal PNG encoder ---

function fillPixel(buf: Buffer, x: number, y: number, width: number, r: number, g: number, b: number, a = 255) {
  const idx = (y * width + x) * 4;
  buf[idx] = r; buf[idx + 1] = g; buf[idx + 2] = b; buf[idx + 3] = a;
}

function crcTable() {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
}
const CRC_TABLE = crcTable();

function crc32(buf: Buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const crc = crc32(Buffer.concat([typeBuf, data]));
  const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(crc, 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePngRgba(buffer: Buffer, width: number, height: number): Buffer {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let row = 0; row < height; row++) {
    raw[row * (stride + 1)] = 0;
    buffer.copy(raw, row * (stride + 1) + 1, row * stride, row * stride + stride);
  }
  const compressed = deflateSync(raw);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

export async function renderQrPngBase64(input: string, opts: { scale?: number; marginModules?: number } = {}): Promise<string> {
  loadQrModules();
  const { scale = 6, marginModules = 4 } = opts;

  const qr = new _QRCode!(-1, _QRErrorCorrectLevel!['L']);
  qr.addData(input);
  qr.make();

  const modules = qr.getModuleCount();
  const size = (modules + marginModules * 2) * scale;
  const buf = Buffer.alloc(size * size * 4, 255);

  for (let row = 0; row < modules; row++) {
    for (let col = 0; col < modules; col++) {
      if (!qr.isDark(row, col)) continue;
      const startX = (col + marginModules) * scale;
      const startY = (row + marginModules) * scale;
      for (let y = 0; y < scale; y++) {
        for (let x = 0; x < scale; x++) {
          fillPixel(buf, startX + x, startY + y, size, 0, 0, 0, 255);
        }
      }
    }
  }

  return encodePngRgba(buf, size, size).toString('base64');
}
