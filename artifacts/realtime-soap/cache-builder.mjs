import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { spawnSync } from "node:child_process";

const PI = Math.PI;
const TAU = Math.PI * 2;
const EPS = 1e-6;

function parseArgs(argv) {
  const args = {
    source: "artifacts/realtime-soap/baseline/huang-official-highres512/frame0499.exr",
    outDir: "artifacts/realtime-soap/cache/gravity_fig14_like",
    h: 1e-6,
    authorRatio: 2e5,
    frames: 1,
    frameDt: 1 / 24,
    python: process.env.HUANG_SOAP_PYTHON || "C:\\Users\\Ifmanzhang\\miniconda3\\envs\\huang-soapbubble\\python.exe",
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const [key, raw] = arg.slice(2).split("=");
    const value = raw ?? argv[++i];
    if (key in args) {
      args[key] = typeof args[key] === "number" ? Number(value) : String(value);
    }
  }
  return args;
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function idx(width, i, j) {
  return i * width + ((j % width) + width) % width;
}

function stats(field) {
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  for (let i = 0; i < field.length; i += 1) {
    const v = field[i];
    if (v < min) min = v;
    if (v > max) max = v;
    sum += v;
  }
  return { min, max, mean: sum / Math.max(1, field.length) };
}

function makeCrcTable() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
}

const CRC_TABLE = makeCrcTable();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 0);
  return Buffer.concat([length, typeBytes, data, crc]);
}

function writePng(file, width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 4 + 1);
    raw[row] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * width * 4, width * 4).copy(raw, row + 1);
  }
  fs.writeFileSync(file, Buffer.concat([
    signature,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", zlib.deflateSync(raw, { level: 6 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]));
}

function fieldToPng(field, width, height, file, lo = null, hi = null) {
  const s = stats(field);
  const min = lo ?? s.min;
  const max = hi ?? s.max;
  const rgba = new Uint8Array(width * height * 4);
  const den = Math.max(EPS, max - min);
  for (let k = 0; k < field.length; k += 1) {
    const v = clamp((field[k] - min) / den, 0, 1);
    const b = Math.round(v * 255);
    rgba[k * 4 + 0] = b;
    rgba[k * 4 + 1] = b;
    rgba[k * 4 + 2] = b;
    rgba[k * 4 + 3] = 255;
  }
  writePng(file, width, height, rgba);
}

function readEtaFromExr(args, outDir) {
  const rawPath = path.join(outDir, "eta-source.f32");
  const jsonPath = path.join(outDir, "eta-source.json");
  const code = String.raw`
import json, sys
import numpy as np
import OpenEXR, Imath
src, raw_path, json_path, h, ratio = sys.argv[1], sys.argv[2], sys.argv[3], float(sys.argv[4]), float(sys.argv[5])
exr = OpenEXR.InputFile(src)
header = exr.header()
dw = header["dataWindow"]
w = dw.max.x - dw.min.x + 1
hh = dw.max.y - dw.min.y + 1
pt = Imath.PixelType(Imath.PixelType.FLOAT)
gray = np.frombuffer(exr.channel("R", pt), dtype=np.float32).reshape(hh, w)
eta = gray / (h * ratio)
eta.astype("<f4").tofile(raw_path)
stats = {
  "width": int(w),
  "height": int(hh),
  "etaMin": float(np.min(eta)),
  "etaMax": float(np.max(eta)),
  "etaMean": float(np.mean(eta)),
}
open(json_path, "w", encoding="utf8").write(json.dumps(stats, indent=2))
`;
  const result = spawnSync(args.python, ["-c", code, args.source, rawPath, jsonPath, String(args.h), String(args.authorRatio)], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(`EXR read failed with ${args.python}\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
  }
  const meta = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  const bytes = fs.readFileSync(rawPath);
  const eta = new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4).slice();
  fs.rmSync(rawPath, { force: true });
  fs.rmSync(jsonPath, { force: true });
  return { width: meta.width, height: meta.height, eta, sourceStats: meta };
}

function deriveFields(eta, width, height) {
  const count = width * height;
  const gamma = new Float32Array(count);
  const uTheta = new Float32Array(count);
  const uPhi = new Float32Array(count);
  const div = new Float32Array(count);
  const curl = new Float32Array(count);
  const front = new Float32Array(count);
  const etaStats = stats(eta);
  const range = Math.max(EPS, etaStats.max - etaStats.min);

  for (let i = 0; i < height; i += 1) {
    const theta = (i + 0.5) / height * PI;
    const sinTheta = Math.max(0.08, Math.sin(theta));
    for (let j = 0; j < width; j += 1) {
      const k = idx(width, i, j);
      const e = eta[k];
      const eL = eta[idx(width, i, j - 1)];
      const eR = eta[idx(width, i, j + 1)];
      const eD = eta[idx(width, Math.max(0, i - 1), j)];
      const eU = eta[idx(width, Math.min(height - 1, i + 1), j)];
      const gradPhi = (eR - eL) * width / (2 * TAU * sinTheta);
      const gradTheta = (eU - eD) * height / (2 * PI);
      const ridge = Math.sqrt(gradPhi * gradPhi + gradTheta * gradTheta);
      gamma[k] = clamp(0.55 + (e - etaStats.mean) / range * 0.16 - ridge * 0.012, 0.05, 1.5);
      uTheta[k] = clamp(0.032 - gradTheta * 0.035, -0.35, 0.35);
      uPhi[k] = clamp(-gradPhi * 0.035, -0.35, 0.35);
      front[k] = clamp(ridge * 0.085, 0, 1);
    }
  }

  for (let i = 0; i < height; i += 1) {
    for (let j = 0; j < width; j += 1) {
      const k = idx(width, i, j);
      const upR = uPhi[idx(width, i, j + 1)];
      const upL = uPhi[idx(width, i, j - 1)];
      const utU = uTheta[idx(width, Math.min(height - 1, i + 1), j)];
      const utD = uTheta[idx(width, Math.max(0, i - 1), j)];
      div[k] = clamp((upR - upL) * width * 0.5 + (utU - utD) * height * 0.5, -8, 8);
      curl[k] = clamp((upR - upL) * width * 0.5 - (utU - utD) * height * 0.5, -8, 8);
    }
  }

  return { eta, gamma, uTheta, uPhi, div, curl, front };
}

function bilinear(field, width, height, u, v) {
  let uu = u - Math.floor(u);
  let vv = v;
  if (vv < 0) {
    vv = -vv;
    uu += 0.5;
  }
  if (vv > 1) {
    vv = 2 - vv;
    uu += 0.5;
  }
  uu -= Math.floor(uu);
  vv = clamp(vv, 0.0001, 0.9999);
  const x = uu * width - 0.5;
  const y = vv * height - 0.5;
  const x0f = Math.floor(x);
  const y0 = clamp(Math.floor(y), 0, height - 1);
  const x1f = x0f + 1;
  const y1 = clamp(y0 + 1, 0, height - 1);
  const fx = x - x0f;
  const fy = y - y0;
  const x0 = ((x0f % width) + width) % width;
  const x1 = ((x1f % width) + width) % width;
  const a = field[y0 * width + x0] * (1 - fx) + field[y0 * width + x1] * fx;
  const b = field[y1 * width + x0] * (1 - fx) + field[y1 * width + x1] * fx;
  return a * (1 - fy) + b * fy;
}

function advectScalar(field, uTheta, uPhi, width, height, dt) {
  const next = new Float32Array(field.length);
  for (let i = 0; i < height; i += 1) {
    const v = (i + 0.5) / height;
    for (let j = 0; j < width; j += 1) {
      const u = (j + 0.5) / width;
      const k = idx(width, i, j);
      next[k] = bilinear(field, width, height, u - uPhi[k] * dt, v - uTheta[k] * dt);
    }
  }
  return next;
}

function writeField(outDir, name, field) {
  fs.writeFileSync(path.join(outDir, `${name}.f32.gz`), zlib.gzipSync(Buffer.from(field.buffer)));
}

function main() {
  const args = parseArgs(process.argv);
  fs.mkdirSync(args.outDir, { recursive: true });
  const { width, height, eta, sourceStats } = readEtaFromExr(args, args.outDir);
  const fields = deriveFields(eta, width, height);
  for (const [name, field] of Object.entries(fields)) writeField(args.outDir, name, field);

  fieldToPng(fields.eta, width, height, path.join(args.outDir, "eta.png"));
  fieldToPng(fields.gamma, width, height, path.join(args.outDir, "Gamma.png"));
  fieldToPng(fields.front, width, height, path.join(args.outDir, "front.png"), 0, 1);
  fieldToPng(fields.curl, width, height, path.join(args.outDir, "curl.png"), -1, 1);

  const frameCount = Math.max(1, Math.floor(args.frames));
  const frames = [];
  if (frameCount > 1) {
    let frameEta = fields.eta;
    let frameGamma = fields.gamma;
    for (let frame = 0; frame < frameCount; frame += 1) {
      const frameDir = path.join(args.outDir, "frames", `frame${String(frame).padStart(4, "0")}`);
      fs.mkdirSync(frameDir, { recursive: true });
      const frameFields = deriveFields(frameEta, width, height);
      frameFields.gamma.set(frameGamma);
      for (const [name, field] of Object.entries(frameFields)) {
        fs.writeFileSync(path.join(frameDir, `${name}.f32.gz`), zlib.gzipSync(Buffer.from(field.buffer)));
      }
      frames.push({
        index: frame,
        time: frame * args.frameDt,
        fields: Object.fromEntries(Object.keys(frameFields).map((name) => [name, path.join("frames", `frame${String(frame).padStart(4, "0")}`, `${name}.f32.gz`).replace(/\\/g, "/")])),
      });
      frameEta = advectScalar(frameFields.eta, frameFields.uTheta, frameFields.uPhi, width, height, args.frameDt);
      frameGamma = advectScalar(frameFields.gamma, frameFields.uTheta, frameFields.uPhi, width, height, args.frameDt);
    }
  }

  const manifest = {
    kind: "soap-film-physical-cache",
    version: frameCount > 1 ? 2 : 1,
    source: path.normalize(args.source),
    sourceReadMode: "OpenEXR R channel via Python OpenEXR",
    width,
    height,
    layout: "row-major theta-major equirectangular sphere",
    fields: Object.fromEntries(Object.keys(fields).map((name) => [name, `${name}.f32.gz`])),
    frames,
    frameCount,
    frameDt: args.frameDt,
    sourceStats,
    fieldStats: Object.fromEntries(Object.entries(fields).map(([name, field]) => [name, stats(field)])),
    constraints: {
      notTexture: true,
      physicalCacheFieldsOnly: true,
      generatedFromHuangOutput: true,
      temporalFramesGeneratedByPhysicalFieldAdvection: frameCount > 1,
    },
  };
  fs.writeFileSync(path.join(args.outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`[cache-builder] wrote ${args.outDir}`);
  console.log(`[cache-builder] grid=${height}x${width} eta=${sourceStats.etaMin}..${sourceStats.etaMax} frames=${frameCount}`);
}

main();
