import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const PI = Math.PI;
const TAU = Math.PI * 2;
const EPS = 1e-6;

function parseArgs(argv) {
  const args = {
    mode: "benchmark",
    physics: "256x512",
    render: 2048,
    fpsTarget: 24,
    seconds: 20,
    cache: "artifacts/realtime-soap/cache/gravity_fig14_like",
    outDir: "artifacts/realtime-soap/runs/RT-latest",
    cacheBlend: 0.82,
    disturbanceStrength: 0.18,
    disturbanceRadius: 0.12,
    disturbanceU: 0.42,
    disturbanceV: 0.38,
    gravityAngle: 0,
    airSpeed: 0.38,
    airDirection: 24,
    marangoni: 0.65,
    viscosity: 0.22,
    diffusion: 0.018,
    evaporation: 0.00002,
    substeps: 1,
    pressureIterations: 6,
    renderBaseAlpha: 0.24,
    renderCacheBlend: 0.74,
    renderDetailBoost: 0.10,
    renderEdgeGlow: 0.025,
    renderEdgePower: 3.2,
    renderEtaScale: 2100,
    renderExposure: 0.92,
    renderFlipV: 1,
    renderFrontAlpha: 0.14,
    renderOptics: "spectral",
    renderReconstruction: "bicubic",
    renderRimAlpha: 0.24,
    renderRimPower: 3.4,
    renderSamples: 4,
    renderSharpen: 0.16,
    renderSource: "hybrid",
    renderSaturation: 1.12,
    renderTransparent: 1,
    recordFrames: 0,
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

function parsePhysics(value) {
  const [theta, phi] = String(value).split("x").map((n) => Number(n));
  return {
    nTheta: Math.max(64, Math.min(384, Math.floor(theta || 256))),
    nPhi: Math.max(128, Math.min(768, Math.floor(phi || 512))),
  };
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function numberArg(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function fract(v) {
  return v - Math.floor(v);
}

function bell(x, c, w) {
  const d = (x - c) / Math.max(EPS, w);
  return Math.exp(-d * d);
}

function mix(a, b, t) {
  return a * (1 - t) + b * t;
}

function filmPalette(thicknessNm) {
  const stops = [
    [120, [0.28, 0.48, 0.96]],
    [230, [0.62, 0.32, 0.92]],
    [350, [0.06, 0.74, 0.88]],
    [500, [0.82, 0.34, 0.72]],
    [670, [0.98, 0.48, 0.08]],
    [900, [0.98, 0.70, 0.10]],
    [1260, [0.92, 0.42, 0.10]],
    [1700, [0.60, 0.24, 0.82]],
  ];
  if (thicknessNm <= stops[0][0]) return stops[0][1];
  for (let i = 0; i < stops.length - 1; i += 1) {
    const [x0, c0] = stops[i];
    const [x1, c1] = stops[i + 1];
    if (thicknessNm <= x1) {
      const t = clamp((thicknessNm - x0) / Math.max(EPS, x1 - x0), 0, 1);
      const s = t * t * (3 - 2 * t);
      return [mix(c0[0], c1[0], s), mix(c0[1], c1[1], s), mix(c0[2], c1[2], s)];
    }
  }
  return stops[stops.length - 1][1];
}

function idx(width, i, j) {
  return i * width + ((j % width) + width) % width;
}

function normalizeUv(u, v) {
  let uu = u;
  let vv = v;
  if (vv < 0) {
    vv = -vv;
    uu += 0.5;
  }
  if (vv > 1) {
    vv = 2 - vv;
    uu += 0.5;
  }
  return [fract(uu), clamp(vv, 0.0001, 0.9999)];
}

function stats(field) {
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  let bad = 0;
  for (let i = 0; i < field.length; i += 1) {
    const v = field[i];
    if (!Number.isFinite(v)) {
      bad += 1;
      continue;
    }
    if (v < min) min = v;
    if (v > max) max = v;
    sum += v;
  }
  return { min, max, mean: sum / Math.max(1, field.length - bad), bad };
}

function readField(cacheDir, manifest, name) {
  const file = path.join(cacheDir, manifest.fields[name]);
  const bytes = zlib.gunzipSync(fs.readFileSync(file));
  return new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4).slice();
}

function readFrameField(cacheDir, frame, name) {
  const file = path.join(cacheDir, frame.fields[name]);
  const bytes = zlib.gunzipSync(fs.readFileSync(file));
  return new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4).slice();
}

function bilinear(field, width, height, u, v) {
  const uv = normalizeUv(u, v);
  const x = uv[0] * width - 0.5;
  const y = uv[1] * height - 0.5;
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

function cubicCatmullRom(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (
    (2 * p1) +
    (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t3
  );
}

function bicubic(field, width, height, u, v) {
  const uv = normalizeUv(u, v);
  const x = uv[0] * width - 0.5;
  const y = uv[1] * height - 0.5;
  const xBase = Math.floor(x);
  const yBase = Math.floor(y);
  const fx = x - xBase;
  const fy = y - yBase;
  const rows = new Array(4);
  let nMin = Infinity;
  let nMax = -Infinity;
  for (let yy = -1; yy <= 2; yy += 1) {
    const cy = clamp(yBase + yy, 0, height - 1);
    const p = new Array(4);
    for (let xx = -1; xx <= 2; xx += 1) {
      const cx = ((xBase + xx) % width + width) % width;
      const value = field[cy * width + cx];
      p[xx + 1] = value;
      if (value < nMin) nMin = value;
      if (value > nMax) nMax = value;
    }
    rows[yy + 1] = cubicCatmullRom(p[0], p[1], p[2], p[3], fx);
  }
  return clamp(cubicCatmullRom(rows[0], rows[1], rows[2], rows[3], fy), nMin, nMax);
}

function sampleField(field, width, height, u, v, reconstruction = "bilinear") {
  return reconstruction === "bicubic" ? bicubic(field, width, height, u, v) : bilinear(field, width, height, u, v);
}

function loadCache(cacheDir) {
  const manifest = JSON.parse(fs.readFileSync(path.join(cacheDir, "manifest.json"), "utf8"));
  const cache = {
    manifest,
    width: manifest.width,
    height: manifest.height,
    eta: readField(cacheDir, manifest, "eta"),
    gamma: readField(cacheDir, manifest, "gamma"),
    uTheta: readField(cacheDir, manifest, "uTheta"),
    uPhi: readField(cacheDir, manifest, "uPhi"),
    curl: manifest.fields.curl ? readField(cacheDir, manifest, "curl") : null,
    front: readField(cacheDir, manifest, "front"),
    frames: [],
  };
  if (Array.isArray(manifest.frames) && manifest.frames.length > 1) {
    cache.frames = manifest.frames.map((frame) => ({
      index: frame.index,
      time: frame.time,
      eta: readFrameField(cacheDir, frame, "eta"),
      gamma: readFrameField(cacheDir, frame, "gamma"),
      uTheta: readFrameField(cacheDir, frame, "uTheta"),
      uPhi: readFrameField(cacheDir, frame, "uPhi"),
      curl: frame.fields.curl ? readFrameField(cacheDir, frame, "curl") : null,
      front: readFrameField(cacheDir, frame, "front"),
    }));
  }
  return cache;
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
    pngChunk("IDAT", zlib.deflateSync(raw, { level: 5 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]));
}

function encodeByte(v) {
  return clamp(Math.round(v * 255), 0, 255);
}

function fieldPng(field, width, height, file, lo = null, hi = null) {
  const s = stats(field);
  const min = lo ?? s.min;
  const max = hi ?? s.max;
  const den = Math.max(EPS, max - min);
  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0; i < field.length; i += 1) {
    const v = clamp((field[i] - min) / den, 0, 1);
    const b = encodeByte(v);
    rgba[i * 4 + 0] = b;
    rgba[i * 4 + 1] = b;
    rgba[i * 4 + 2] = b;
    rgba[i * 4 + 3] = 255;
  }
  writePng(file, width, height, rgba);
}

function phaseColor(thicknessNm, cosI, front, foam) {
  const edge = Math.pow(clamp(1 - cosI, 0, 1), 1.45);
  const optical = thicknessNm * (0.016 + 0.010 * edge);
  const fringe = 0.84 + 0.16 * Math.sin(optical);
  const palette = filmPalette(thicknessNm * (0.92 + edge * 0.18));
  const ridge = Math.pow(clamp(front, 0, 1), 0.75);
  const mist = Math.pow(clamp(foam, 0, 1), 1.8);
  const violetEdge = bell(thicknessNm, 190, 150) * edge;
  const cyanRidge = bell(thicknessNm, 360, 210) * ridge;
  let rr = palette[0] * fringe + violetEdge * 0.15 + mist * 0.10;
  let gg = palette[1] * fringe + cyanRidge * 0.14 + mist * 0.10;
  let bb = palette[2] * fringe + violetEdge * 0.34 + cyanRidge * 0.10 + mist * 0.10;
  rr += edge * 0.035 + ridge * 0.035;
  gg += edge * 0.060 + ridge * 0.030;
  bb += edge * 0.140 + ridge * 0.045;
  const gray = (rr + gg + bb) / 3;
  const saturation = 1.88 - mist * 0.25;
  rr = gray + (rr - gray) * saturation;
  gg = gray + (gg - gray) * saturation;
  bb = gray + (bb - gray) * saturation;
  const exposure = 0.86;
  return [
    clamp(1 - Math.exp(-Math.max(0, rr) * exposure), 0, 1),
    clamp(1 - Math.exp(-Math.max(0, gg) * exposure), 0, 1),
    clamp(1 - Math.exp(-Math.max(0, bb) * exposure), 0, 1),
  ];
}

function wavelengthToRgbWeight(lambdaNm) {
  const r = Math.exp(-0.5 * ((lambdaNm - 610) / 48) ** 2) + 0.22 * Math.exp(-0.5 * ((lambdaNm - 700) / 42) ** 2);
  const g = Math.exp(-0.5 * ((lambdaNm - 545) / 42) ** 2);
  const b = Math.exp(-0.5 * ((lambdaNm - 455) / 34) ** 2);
  return [r, g, b];
}

function spectralThinFilmColor(thicknessNm, cosI, front, foam, args) {
  const nFilm = 1.335;
  const incidence = clamp(cosI, 0.04, 1);
  const opticalThickness = 2 * nFilm * thicknessNm * incidence;
  let rr = 0;
  let gg = 0;
  let bb = 0;
  let wr = 0;
  let wg = 0;
  let wb = 0;
  for (let lambda = 400; lambda <= 700; lambda += 5) {
    const phase = TAU * opticalThickness / lambda + PI;
    const reflectance = 0.18 + 0.82 * (0.5 + 0.5 * Math.cos(phase));
    const [rW, gW, bW] = wavelengthToRgbWeight(lambda);
    rr += reflectance * rW;
    gg += reflectance * gW;
    bb += reflectance * bW;
    wr += rW;
    wg += gW;
    wb += bW;
  }
  rr /= Math.max(EPS, wr);
  gg /= Math.max(EPS, wg);
  bb /= Math.max(EPS, wb);
  const edge = Math.pow(clamp(1 - incidence, 0, 1), clamp(numberArg(args.renderEdgePower, 3.2), 1.2, 8));
  const edgeGlow = edge * clamp(numberArg(args.renderEdgeGlow, 0.025), 0, 0.5);
  const ridge = Math.pow(clamp(front, 0, 1), 0.8);
  const mist = Math.pow(clamp(foam, 0, 1), 1.6);
  rr += edgeGlow * 0.70 + ridge * 0.10 + mist * 0.08;
  gg += edgeGlow * 0.85 + ridge * 0.11 + mist * 0.08;
  bb += edgeGlow * 1.15 + ridge * 0.14 + mist * 0.08;
  const gray = (rr + gg + bb) / 3;
  const sat = clamp(numberArg(args.renderSaturation, 1), 0.2, 3);
  rr = gray + (rr - gray) * sat;
  gg = gray + (gg - gray) * sat;
  bb = gray + (bb - gray) * sat;
  const exposure = clamp(numberArg(args.renderExposure, 1), 0.05, 4);
  return [
    clamp(1 - Math.exp(-Math.max(0, rr) * exposure), 0, 1),
    clamp(1 - Math.exp(-Math.max(0, gg) * exposure), 0, 1),
    clamp(1 - Math.exp(-Math.max(0, bb) * exposure), 0, 1),
  ];
}

function sharpenRgbaInPlace(rgba, width, height, amount) {
  const strength = clamp(Number(amount) || 0, 0, 1);
  if (strength <= 0) return;
  const src = new Uint8Array(rgba);
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const p = (y * width + x) * 4;
      const l = p - 4;
      const r = p + 4;
      const u = p - width * 4;
      const d = p + width * 4;
      for (let c = 0; c < 3; c += 1) {
        const center = src[p + c];
        const blur = (src[l + c] + src[r + c] + src[u + c] + src[d + c]) * 0.25;
        rgba[p + c] = encodeByte((center + (center - blur) * strength) / 255);
      }
    }
  }
}

class RealtimeSoap {
  constructor(args, cache) {
    const { nTheta, nPhi } = parsePhysics(args.physics);
    this.args = args;
    this.cache = cache;
    this.nTheta = nTheta;
    this.nPhi = nPhi;
    this.count = nTheta * nPhi;
    this.eta = new Float32Array(this.count);
    this.gamma = new Float32Array(this.count);
    this.uTheta = new Float32Array(this.count);
    this.uPhi = new Float32Array(this.count);
    this.tmpEta = new Float32Array(this.count);
    this.tmpGamma = new Float32Array(this.count);
    this.tmpTheta = new Float32Array(this.count);
    this.tmpPhi = new Float32Array(this.count);
    this.front = new Float32Array(this.count);
    this.foam = new Float32Array(this.count);
    this.div = new Float32Array(this.count);
    this.cacheEtaGrid = new Float32Array(this.count);
    this.cacheGammaGrid = new Float32Array(this.count);
    this.cacheThetaGrid = new Float32Array(this.count);
    this.cachePhiGrid = new Float32Array(this.count);
    this.cacheFrontGrid = new Float32Array(this.count);
    this.cacheCurlGrid = new Float32Array(this.count);
    this.cacheGridFrames = [];
    this.cacheFrameA = null;
    this.cacheFrameB = null;
    this.cacheFrameT = 0;
    this.precomputeCacheGrid();
    this.selectCacheFrame(0);
    this.initialize();
  }

  cacheSample(name, u, v) {
    return bilinear(this.cache[name], this.cache.width, this.cache.height, u, v);
  }

  precomputeCacheGrid() {
    const sourceFrames = this.cache.frames.length > 1 ? this.cache.frames : [this.cache];
    for (let i = 0; i < this.nTheta; i += 1) {
      const v = (i + 0.5) / this.nTheta;
      for (let j = 0; j < this.nPhi; j += 1) {
        const u = (j + 0.5) / this.nPhi;
        const k = idx(this.nPhi, i, j);
        this.cacheEtaGrid[k] = this.cacheSample("eta", u, v);
        this.cacheGammaGrid[k] = this.cacheSample("gamma", u, v);
        this.cacheThetaGrid[k] = this.cacheSample("uTheta", u, v);
        this.cachePhiGrid[k] = this.cacheSample("uPhi", u, v);
        this.cacheFrontGrid[k] = this.cacheSample("front", u, v);
        this.cacheCurlGrid[k] = this.cache.curl ? bilinear(this.cache.curl, this.cache.width, this.cache.height, u, v) : 0;
      }
    }
    this.cacheGridFrames = sourceFrames.map((frame) => {
      const grid = {
        eta: new Float32Array(this.count),
        gamma: new Float32Array(this.count),
        uTheta: new Float32Array(this.count),
        uPhi: new Float32Array(this.count),
        front: new Float32Array(this.count),
        curl: new Float32Array(this.count),
      };
      for (let i = 0; i < this.nTheta; i += 1) {
        const v = (i + 0.5) / this.nTheta;
        for (let j = 0; j < this.nPhi; j += 1) {
          const u = (j + 0.5) / this.nPhi;
          const k = idx(this.nPhi, i, j);
          grid.eta[k] = bilinear(frame.eta, this.cache.width, this.cache.height, u, v);
          grid.gamma[k] = bilinear(frame.gamma, this.cache.width, this.cache.height, u, v);
          grid.uTheta[k] = bilinear(frame.uTheta, this.cache.width, this.cache.height, u, v);
          grid.uPhi[k] = bilinear(frame.uPhi, this.cache.width, this.cache.height, u, v);
          grid.front[k] = bilinear(frame.front, this.cache.width, this.cache.height, u, v);
          grid.curl[k] = frame.curl ? bilinear(frame.curl, this.cache.width, this.cache.height, u, v) : 0;
        }
      }
      return grid;
    });
  }

  selectCacheFrame(frameIndex) {
    const frames = this.cacheGridFrames.length ? this.cacheGridFrames : [{
      eta: this.cacheEtaGrid,
      gamma: this.cacheGammaGrid,
      uTheta: this.cacheThetaGrid,
      uPhi: this.cachePhiGrid,
      front: this.cacheFrontGrid,
      curl: this.cacheCurlGrid,
    }];
    if (frames.length === 1) {
      this.cacheFrameA = frames[0];
      this.cacheFrameB = frames[0];
      this.cacheFrameT = 0;
      return;
    }
    const cursor = (frameIndex * 0.35) % frames.length;
    const a = Math.floor(cursor);
    this.cacheFrameA = frames[a];
    this.cacheFrameB = frames[(a + 1) % frames.length];
    this.cacheFrameT = cursor - a;
  }

  cacheValue(name, k) {
    return this.cacheFrameA[name][k] * (1 - this.cacheFrameT) + this.cacheFrameB[name][k] * this.cacheFrameT;
  }

  cacheRenderSample(name, u, v, reconstruction = "bilinear") {
    if (this.cache.frames.length <= 1) {
      return sampleField(this.cache[name], this.cache.width, this.cache.height, u, v, reconstruction);
    }
    const cursor = (this.lastFrameIndex * 0.35) % this.cache.frames.length;
    const a = Math.floor(cursor);
    const t = cursor - a;
    const frameA = this.cache.frames[a];
    const frameB = this.cache.frames[(a + 1) % this.cache.frames.length];
    return sampleField(frameA[name], this.cache.width, this.cache.height, u, v, reconstruction) * (1 - t) + sampleField(frameB[name], this.cache.width, this.cache.height, u, v, reconstruction) * t;
  }

  initialize() {
    for (let i = 0; i < this.nTheta; i += 1) {
      for (let j = 0; j < this.nPhi; j += 1) {
        const k = idx(this.nPhi, i, j);
        this.eta[k] = this.cacheValue("eta", k);
        this.gamma[k] = this.cacheValue("gamma", k);
        this.uTheta[k] = this.cacheValue("uTheta", k);
        this.uPhi[k] = this.cacheValue("uPhi", k);
      }
    }
    this.deriveFields();
  }

  step(frameIndex, dt) {
    this.lastFrameIndex = frameIndex;
    this.selectCacheFrame(frameIndex);
    const a = this.args;
    const airDir = (a.airDirection * PI) / 180;
    const gAng = (a.gravityAngle * PI) / 180;
    const du = Math.cos(airDir) * a.airSpeed * 0.035;
    const dv = Math.sin(airDir) * a.airSpeed * 0.035;
    const distPhase = Math.sin(frameIndex * 0.04) * 0.5 + 0.5;
    const disturbU = fract(Number(a.disturbanceU) + 0.08 * Math.sin(frameIndex * 0.011));
    const disturbV = clamp(Number(a.disturbanceV) + 0.045 * Math.cos(frameIndex * 0.013), 0.08, 0.92);
    const r2 = Math.max(EPS, a.disturbanceRadius * a.disturbanceRadius);

    for (let i = 0; i < this.nTheta; i += 1) {
      const v = (i + 0.5) / this.nTheta;
      const theta = v * PI;
      const sinTheta = Math.max(0.08, Math.sin(theta));
      const gravTheta = Math.cos(theta - gAng) * a.gravityAngle * 0.0 + Math.sin(theta + gAng) * 0.020;
      for (let j = 0; j < this.nPhi; j += 1) {
        const u = (j + 0.5) / this.nPhi;
        const k = idx(this.nPhi, i, j);
        const eta = this.eta[k];
        const gammaL = this.gamma[idx(this.nPhi, i, j - 1)];
        const gammaR = this.gamma[idx(this.nPhi, i, j + 1)];
        const gammaD = this.gamma[idx(this.nPhi, Math.max(0, i - 1), j)];
        const gammaU = this.gamma[idx(this.nPhi, Math.min(this.nTheta - 1, i + 1), j)];
        const gradPhi = (gammaR - gammaL) * this.nPhi / (2 * TAU * sinTheta);
        const gradTheta = (gammaU - gammaD) * this.nTheta / (2 * PI);
        const dU = Math.min(Math.abs(u - disturbU), 1 - Math.abs(u - disturbU));
        const dV = v - disturbV;
        const influence = Math.exp(-(dU * dU + dV * dV) / r2) * a.disturbanceStrength;
        const localBlend = clamp(a.cacheBlend * (1 - influence * 0.78), 0.08, 0.96);
        const damp = Math.exp(-a.viscosity * dt * 1.8);
        const cacheCurl = this.cacheValue("curl", k);

        let ut = this.uTheta[k] * damp;
        let up = this.uPhi[k] * damp;
        ut += dt * (gravTheta - a.marangoni * gradTheta / Math.max(0.08, eta) * 0.025 + dv);
        up += dt * (-a.marangoni * gradPhi / Math.max(0.08, eta) * 0.025 + du);
        ut += (this.cacheValue("uTheta", k) - ut) * localBlend * 0.055;
        up += (this.cacheValue("uPhi", k) - up) * localBlend * 0.055;
        ut += cacheCurl * 0.00045;
        up -= cacheCurl * 0.00030;
        ut += influence * Math.sin(frameIndex * 0.07 + u * TAU) * 0.018;
        up += influence * Math.cos(frameIndex * 0.06 + v * PI) * 0.018;
        this.tmpTheta[k] = clamp(ut, -0.45, 0.45);
        this.tmpPhi[k] = clamp(up, -0.45, 0.45);
      }
    }

    [this.uTheta, this.tmpTheta] = [this.tmpTheta, this.uTheta];
    [this.uPhi, this.tmpPhi] = [this.tmpPhi, this.uPhi];

    this.advectAndCouple(dt, disturbU, disturbV, distPhase);
    this.relaxVelocity();
    this.deriveFields();
  }

  advectAndCouple(dt, disturbU, disturbV, phase) {
    const a = this.args;
    const r2 = Math.max(EPS, a.disturbanceRadius * a.disturbanceRadius);
    for (let i = 0; i < this.nTheta; i += 1) {
      const v = (i + 0.5) / this.nTheta;
      for (let j = 0; j < this.nPhi; j += 1) {
        const u = (j + 0.5) / this.nPhi;
        const k = idx(this.nPhi, i, j);
        const backU = u - this.uPhi[k] * dt;
        const backV = v - this.uTheta[k] * dt;
        let eta = bilinear(this.eta, this.nPhi, this.nTheta, backU, backV);
        let gamma = bilinear(this.gamma, this.nPhi, this.nTheta, backU, backV);
        const dU = Math.min(Math.abs(u - disturbU), 1 - Math.abs(u - disturbU));
        const dV = v - disturbV;
        const influence = Math.exp(-(dU * dU + dV * dV) / r2) * a.disturbanceStrength;
        const localBlend = clamp(a.cacheBlend * (1 - influence * 0.78), 0.06, 0.96);
        eta += influence * 0.11 * Math.sin(phase * TAU + u * TAU * 2.0);
        gamma += influence * 0.09;
        eta = eta * (1 - localBlend * 0.16) + this.cacheValue("eta", k) * localBlend * 0.16;
        gamma = gamma * (1 - localBlend * 0.11) + this.cacheValue("gamma", k) * localBlend * 0.11;
        eta -= a.evaporation * dt;
        this.tmpEta[k] = clamp(eta, 0.035, 1.45);
        this.tmpGamma[k] = clamp(gamma, 0.035, 1.55);
      }
    }
    if (this.args.diffusion > 0) {
      const d = this.args.diffusion * dt * 0.08;
      for (let i = 0; i < this.nTheta; i += 1) {
        for (let j = 0; j < this.nPhi; j += 1) {
          const k = idx(this.nPhi, i, j);
          const e = this.tmpEta[k];
          const g = this.tmpGamma[k];
          this.eta[k] = e + d * (this.tmpEta[idx(this.nPhi, i, j - 1)] + this.tmpEta[idx(this.nPhi, i, j + 1)] + this.tmpEta[idx(this.nPhi, Math.max(0, i - 1), j)] + this.tmpEta[idx(this.nPhi, Math.min(this.nTheta - 1, i + 1), j)] - 4 * e);
          this.gamma[k] = g + d * (this.tmpGamma[idx(this.nPhi, i, j - 1)] + this.tmpGamma[idx(this.nPhi, i, j + 1)] + this.tmpGamma[idx(this.nPhi, Math.max(0, i - 1), j)] + this.tmpGamma[idx(this.nPhi, Math.min(this.nTheta - 1, i + 1), j)] - 4 * g);
        }
      }
    } else {
      [this.eta, this.tmpEta] = [this.tmpEta, this.eta];
      [this.gamma, this.tmpGamma] = [this.tmpGamma, this.gamma];
    }
  }

  relaxVelocity() {
    const iterations = Math.max(0, Math.min(16, Math.floor(this.args.pressureIterations)));
    if (!iterations) return;
    const scale = 0.000022 * iterations;
    for (let i = 1; i < this.nTheta - 1; i += 1) {
      for (let j = 0; j < this.nPhi; j += 1) {
        const k = idx(this.nPhi, i, j);
        const div = (this.uPhi[idx(this.nPhi, i, j + 1)] - this.uPhi[idx(this.nPhi, i, j - 1)]) * this.nPhi * 0.5 + (this.uTheta[idx(this.nPhi, i + 1, j)] - this.uTheta[idx(this.nPhi, i - 1, j)]) * this.nTheta * 0.5;
        this.uPhi[k] -= div * scale;
        this.uTheta[k] -= div * scale;
      }
    }
  }

  deriveFields() {
    for (let i = 0; i < this.nTheta; i += 1) {
      for (let j = 0; j < this.nPhi; j += 1) {
        const k = idx(this.nPhi, i, j);
        const eL = this.eta[idx(this.nPhi, i, j - 1)];
        const eR = this.eta[idx(this.nPhi, i, j + 1)];
        const eD = this.eta[idx(this.nPhi, Math.max(0, i - 1), j)];
        const eU = this.eta[idx(this.nPhi, Math.min(this.nTheta - 1, i + 1), j)];
        const gL = this.gamma[idx(this.nPhi, i, j - 1)];
        const gR = this.gamma[idx(this.nPhi, i, j + 1)];
        const gradEta = Math.abs(eR - eL) * this.nPhi + Math.abs(eU - eD) * this.nTheta;
        const gradGamma = Math.abs(gR - gL) * this.nPhi;
        const div = (this.uPhi[idx(this.nPhi, i, j + 1)] - this.uPhi[idx(this.nPhi, i, j - 1)]) * this.nPhi * 0.5 + (this.uTheta[idx(this.nPhi, Math.min(this.nTheta - 1, i + 1), j)] - this.uTheta[idx(this.nPhi, Math.max(0, i - 1), j)]) * this.nTheta * 0.5;
        const speed = Math.hypot(this.uTheta[k], this.uPhi[k]);
        this.div[k] = div;
        const liveFront = clamp(gradEta * 0.15 + gradGamma * 0.055 + Math.max(0, -div) * 0.018, 0, 1);
        const cacheFront = clamp(this.cacheValue("front", k) * 3.2, 0, 1);
        this.front[k] = clamp(Math.max(liveFront, cacheFront * 0.82) + Math.max(0, -div) * 0.006, 0, 1);
        this.foam[k] = clamp(this.front[k] * 0.10 + speed * 0.38 + Math.max(0, -div) * 0.012, 0, 1);
      }
    }
  }
}

function shadeSphereSample(sim, sx, z) {
  const r2 = sx * sx + z * z;
  if (r2 > 1) return [0.0018, 0.0024, 0.0032, Number(sim.args.renderTransparent) ? 0 : 1];
  const sy = Math.sqrt(Math.max(0, 1 - r2));
  const theta = Math.acos(clamp(z, -1, 1));
  const phi = Math.atan2(sy, sx);
  const u = (phi + PI) / TAU;
  const vRaw = theta / PI;
  const v = Number(sim.args.renderFlipV) ? 1 - vRaw : vRaw;
  const reconstruction = sim.args.renderReconstruction === "bicubic" ? "bicubic" : "bilinear";
  const eta = sampleField(sim.eta, sim.nPhi, sim.nTheta, u, v, reconstruction);
  const etaCache = sim.cacheRenderSample("eta", u, v, reconstruction);
  const frontLive = sampleField(sim.front, sim.nPhi, sim.nTheta, u, v, reconstruction);
  const foamLive = sampleField(sim.foam, sim.nPhi, sim.nTheta, u, v, reconstruction);
  const frontCache = sim.cacheRenderSample("front", u, v, reconstruction);
  const renderCacheBlend = clamp(sim.args.renderCacheBlend, 0, 1);
  const source = String(sim.args.renderSource || "hybrid");
  let etaRender = eta * (1 - renderCacheBlend) + etaCache * renderCacheBlend;
  let front = clamp(Math.max(frontLive * 0.82, frontCache * 3.4), 0, 1);
  let foam = clamp(foamLive * 0.62 + frontCache * 0.24, 0, 1);
  if (source === "cache") {
    etaRender = etaCache;
    front = clamp(frontCache * 2.25, 0, 1);
    foam = clamp(frontCache * 0.10, 0, 1);
  } else if (source === "live") {
    etaRender = eta;
    front = clamp(frontLive, 0, 1);
    foam = clamp(foamLive, 0, 1);
  }
  const thicknessNm = etaRender * clamp(numberArg(sim.args.renderEtaScale, 2100), 100, 8000);
  const color = sim.args.renderOptics === "palette"
    ? phaseColor(thicknessNm, clamp(sy, 0.03, 1), front, foam)
    : spectralThinFilmColor(thicknessNm, clamp(sy, 0.03, 1), front, foam, sim.args);
  const detail = Math.pow(clamp(front, 0, 1), 1.25) * clamp(numberArg(sim.args.renderDetailBoost, 0), 0, 0.5);
  const edge = Math.pow(clamp(1 - sy, 0, 1), clamp(numberArg(sim.args.renderRimPower, 3.4), 1.1, 10));
  const baseAlpha = clamp(numberArg(sim.args.renderBaseAlpha, 0.34), 0, 1);
  const rimAlpha = clamp(numberArg(sim.args.renderRimAlpha, 0.52), 0, 1);
  const frontAlpha = clamp(numberArg(sim.args.renderFrontAlpha, 0.22), 0, 1);
  const alpha = Number(sim.args.renderTransparent)
    ? clamp(baseAlpha + rimAlpha * edge + frontAlpha * Math.max(front, foam), 0, 1)
    : 1;
  return [
    clamp(color[0] + detail * 0.36, 0, 1),
    clamp(color[1] + detail * 0.50, 0, 1),
    clamp(color[2] + detail * 0.58, 0, 1),
    alpha,
  ];
}

function renderSphere(sim, size, file) {
  const rgba = new Uint8Array(size * size * 4);
  const requestedSamples = Math.max(1, Math.min(16, Math.floor(Number(sim.args.renderSamples) || 1)));
  const sampleGrid = Math.max(1, Math.ceil(Math.sqrt(requestedSamples)));
  const sampleCount = sampleGrid * sampleGrid;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const p = (y * size + x) * 4;
      let rr = 0;
      let gg = 0;
      let bb = 0;
      let aa = 0;
      for (let gy = 0; gy < sampleGrid; gy += 1) {
        for (let gx = 0; gx < sampleGrid; gx += 1) {
          const sx = ((x + (gx + 0.5) / sampleGrid) / size) * 2 - 1;
          const z = 1 - ((y + (gy + 0.5) / sampleGrid) / size) * 2;
          const color = shadeSphereSample(sim, sx, z);
          rr += color[0];
          gg += color[1];
          bb += color[2];
          aa += color[3];
        }
      }
      rgba[p + 0] = encodeByte(Math.pow(rr / sampleCount, 1 / 2.2));
      rgba[p + 1] = encodeByte(Math.pow(gg / sampleCount, 1 / 2.2));
      rgba[p + 2] = encodeByte(Math.pow(bb / sampleCount, 1 / 2.2));
      rgba[p + 3] = encodeByte(aa / sampleCount);
    }
  }
  sharpenRgbaInPlace(rgba, size, size, sim.args.renderSharpen);
  writePng(file, size, size, rgba);
}

function main() {
  const args = parseArgs(process.argv);
  fs.mkdirSync(args.outDir, { recursive: true });
  const cache = loadCache(args.cache);
  const sim = new RealtimeSoap(args, cache);
  const dt = 1 / Number(args.fpsTarget);
  const frames = Math.max(1, Math.floor(args.seconds * args.fpsTarget));
  const frameTimes = [];
  const start = performance.now();
  for (let f = 0; f < frames; f += 1) {
    const t0 = performance.now();
    for (let s = 0; s < Math.max(1, Math.floor(args.substeps)); s += 1) sim.step(f, dt / Math.max(1, Math.floor(args.substeps)));
    frameTimes.push(performance.now() - t0);
  }
  const physicsElapsed = performance.now() - start;
  const sorted = [...frameTimes].sort((a, b) => a - b);
  const avg = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const p99 = sorted[Math.floor(sorted.length * 0.99)];

  fieldPng(sim.eta, sim.nPhi, sim.nTheta, path.join(args.outDir, "eta.png"));
  fieldPng(sim.gamma, sim.nPhi, sim.nTheta, path.join(args.outDir, "Gamma.png"));
  fieldPng(sim.front, sim.nPhi, sim.nTheta, path.join(args.outDir, "front.png"), 0, 1);
  fieldPng(sim.foam, sim.nPhi, sim.nTheta, path.join(args.outDir, "foam.png"), 0, 1);
  fieldPng(sim.div, sim.nPhi, sim.nTheta, path.join(args.outDir, "divergence.png"), -3, 3);
  const speed = new Float32Array(sim.count);
  for (let i = 0; i < sim.count; i += 1) speed[i] = Math.hypot(sim.uTheta[i], sim.uPhi[i]);
  fieldPng(speed, sim.nPhi, sim.nTheta, path.join(args.outDir, "velocity.png"), 0, 0.35);

  const renderStart = performance.now();
  renderSphere(sim, Math.floor(args.render), path.join(args.outDir, "beauty.png"));
  const renderMs = performance.now() - renderStart;

  const performanceReport = {
    solver: "realtime-hybrid-approximation",
    physicsResolution: [sim.nTheta, sim.nPhi],
    renderBaseAlpha: args.renderBaseAlpha,
    renderResolution: args.render,
    renderDetailBoost: args.renderDetailBoost,
    renderEdgeGlow: args.renderEdgeGlow,
    renderEdgePower: args.renderEdgePower,
    renderEtaScale: args.renderEtaScale,
    renderExposure: args.renderExposure,
    renderOptics: args.renderOptics,
    renderReconstruction: args.renderReconstruction,
    renderFrontAlpha: args.renderFrontAlpha,
    renderRimAlpha: args.renderRimAlpha,
    renderRimPower: args.renderRimPower,
    renderSamples: args.renderSamples,
    renderSharpen: args.renderSharpen,
    renderSource: args.renderSource,
    renderSaturation: args.renderSaturation,
    renderTransparent: args.renderTransparent,
    targetFps: args.fpsTarget,
    simulatedSeconds: args.seconds,
    frames,
    physicsElapsedMs: physicsElapsed,
    avgPhysicsFrameMs: avg,
    p95PhysicsFrameMs: p95,
    p99PhysicsFrameMs: p99,
    avgPhysicsFps: 1000 / Math.max(EPS, avg),
    renderMs,
    reached24Fps: 1000 / Math.max(EPS, avg) >= 24,
    cacheFrameCount: cache.frames.length || 1,
  };
  const diagnostics = {
    kind: "realtime-soap-hybrid-diagnostics",
    approximationBoundary: "Realtime optimized eta/Gamma/u residual solver coupled to physical cache; not strict Huang 2020 solve.",
    cache: args.cache,
    cacheFrameCount: cache.frames.length || 1,
    params: args,
    eta: stats(sim.eta),
    Gamma: stats(sim.gamma),
    velocity: stats(speed),
    front: stats(sim.front),
    foam: stats(sim.foam),
    divergence: stats(sim.div),
  };
  fs.writeFileSync(path.join(args.outDir, "performance.json"), `${JSON.stringify(performanceReport, null, 2)}\n`, "utf8");
  fs.writeFileSync(path.join(args.outDir, "diagnostics.json"), `${JSON.stringify(diagnostics, null, 2)}\n`, "utf8");
  console.log(`[realtime-soap] physics=${sim.nTheta}x${sim.nPhi} frames=${frames} avgMs=${avg.toFixed(3)} fps=${performanceReport.avgPhysicsFps.toFixed(2)} renderMs=${renderMs.toFixed(1)}`);
  console.log(`[realtime-soap] out=${args.outDir}`);
}

main();
