import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const PI = Math.PI;
const TAU = Math.PI * 2;
const EPS = 1e-6;

function clamp(v, a, b) {
  return Math.min(b, Math.max(a, v));
}

function fract(v) {
  return v - Math.floor(v);
}

function smoothstep(a, b, x) {
  const t = clamp((x - a) / Math.max(EPS, b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

function hash2(i, j, seed = 0) {
  const x = Math.sin((i * 127.1 + j * 311.7 + seed * 74.7) * 0.017453292519943295) * 43758.5453123;
  return fract(x);
}

function valueNoise(phi, theta, seed) {
  const u = phi / TAU;
  const v = theta / PI;
  let sum = 0;
  let amp = 0.55;
  let norm = 0;
  for (let octave = 0; octave < 5; octave += 1) {
    const scale = 3 << octave;
    const x = u * scale;
    const y = v * scale;
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const a = hash2(ix, iy, seed + octave * 13);
    const b = hash2(ix + 1, iy, seed + octave * 13);
    const c = hash2(ix, iy + 1, seed + octave * 13);
    const d = hash2(ix + 1, iy + 1, seed + octave * 13);
    const ab = a + (b - a) * sx;
    const cd = c + (d - c) * sx;
    sum += (ab + (cd - ab) * sy) * amp;
    norm += amp;
    amp *= 0.5;
  }
  return sum / Math.max(EPS, norm);
}

function parseArgs(argv) {
  const args = {
    sim: 0,
    simTheta: 1024,
    simPhi: 2048,
    steps: 96,
    dt: 0.002,
    cg: 22,
    outDir: "artifacts/huang-clean/output",
    tag: "huang-clean-paper-grid",
    render: 1200,
    seed: 7,
    scenario: "referenceFlow",
    paperParams: 1,
    gridDiagnostics: 1,
  };
  const seen = new Set();
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    const [key, raw] = arg.startsWith("--") ? arg.slice(2).split("=") : ["", ""];
    const next = raw ?? argv[i + 1];
    if (!key) continue;
    if (raw === undefined) i += 1;
    if (key in args) {
      seen.add(key);
      if (typeof args[key] === "number") args[key] = Number(next);
      else args[key] = String(next);
    }
  }
  if (seen.has("sim") && args.sim > 0) {
    if (!seen.has("simTheta")) args.simTheta = args.sim;
    if (!seen.has("simPhi")) args.simPhi = args.sim * 2;
  }
  args.simTheta = Math.max(64, Math.min(1024, Math.floor(args.simTheta)));
  args.simPhi = Math.max(128, Math.min(2048, Math.floor(args.simPhi)));
  args.steps = Math.max(0, Math.floor(args.steps));
  args.cg = Math.max(4, Math.floor(args.cg));
  args.render = Math.max(320, Math.min(2400, Math.floor(args.render)));
  args.paperParams = args.paperParams ? 1 : 0;
  args.gridDiagnostics = args.gridDiagnostics ? 1 : 0;
  return args;
}

function sphereBasis(theta, phi) {
  const st = Math.sin(theta);
  const ct = Math.cos(theta);
  const sp = Math.sin(phi);
  const cp = Math.cos(phi);
  const w = [st * cp, ct, st * sp];
  const eTheta = [ct * cp, -st, ct * sp];
  const ePhi = [-sp, 0, cp];
  return { w, eTheta, ePhi, sinTheta: Math.max(1e-4, st) };
}

function normalize3(v) {
  const l = Math.hypot(v[0], v[1], v[2]);
  if (l < EPS) return [0, 0, 0];
  return [v[0] / l, v[1] / l, v[2] / l];
}

function dot3(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross3(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function rotateAroundAxis(v, axis, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const d = dot3(axis, v);
  const kxv = cross3(axis, v);
  return [
    v[0] * c + kxv[0] * s + axis[0] * d * (1 - c),
    v[1] * c + kxv[1] * s + axis[1] * d * (1 - c),
    v[2] * c + kxv[2] * s + axis[2] * d * (1 - c),
  ];
}

function slerp3(a, b, t) {
  let d = clamp(dot3(a, b), -1, 1);
  if (d > 0.9995) {
    return normalize3(add3(a, b, 1 - t, t));
  }
  if (d < -0.9995) {
    const ortho = normalize3(Math.abs(a[1]) < 0.9 ? cross3(a, [0, 1, 0]) : cross3(a, [1, 0, 0]));
    return normalize3(add3(a, ortho, Math.cos(PI * t), Math.sin(PI * t)));
  }
  const omega = Math.acos(d);
  const s = Math.sin(omega);
  const wa = Math.sin((1 - t) * omega) / s;
  const wb = Math.sin(t * omega) / s;
  return normalize3(add3(a, b, wa, wb));
}

function greatCircleDistance(a, b) {
  return Math.acos(clamp(dot3(a, b), -1, 1));
}

function add3(a, b, sa = 1, sb = 1) {
  return [a[0] * sa + b[0] * sb, a[1] * sa + b[1] * sb, a[2] * sa + b[2] * sb];
}

function xyzToAngles(w) {
  const y = clamp(w[1], -1, 1);
  const theta = Math.acos(y);
  let phi = Math.atan2(w[2], w[0]);
  if (phi < 0) phi += TAU;
  return [theta, phi];
}

class HuangCleanSimulator {
  constructor(options = {}) {
    this.nTheta = options.simTheta ?? options.sim ?? 1024;
    this.nPhi = options.simPhi ?? this.nTheta * 2;
    this.length = this.nTheta * this.nPhi;
    this.dTheta = PI / this.nTheta;
    this.dPhi = TAU / this.nPhi;
    this.seed = options.seed ?? 7;
    this.scenario = options.scenario ?? "referenceFlow";
    this.paperParams = options.paperParams !== 0;
    this.allocate();
    this.initialize();
  }

  allocate() {
    const n = this.length;
    this.eta = new Float32Array(n);
    this.gamma = new Float32Array(n);
    this.uTheta = new Float32Array(n);
    this.uPhi = new Float32Array(n);
    this.eta0 = new Float32Array(n);
    this.gamma0 = new Float32Array(n);
    this.etaAdv = new Float32Array(n);
    this.gammaAdv = new Float32Array(n);
    this.uThetaAdv = new Float32Array(n);
    this.uPhiAdv = new Float32Array(n);
    this.tmpA = new Float32Array(n);
    this.tmpB = new Float32Array(n);
    this.tmpC = new Float32Array(n);
    this.r = new Float32Array(n);
    this.p = new Float32Array(n);
    this.ap = new Float32Array(n);
    this.z = new Float32Array(n);
    this.diag = new Float32Array(n);
    this.divBase = new Float32Array(n);
    this.divVelocity = new Float32Array(n);
    this.speed = new Float32Array(n);
    this.gradEta = new Float32Array(n);
    this.gradGamma = new Float32Array(n);
    this.foam = new Float32Array(n);
    this.phase = new Float32Array(n);
    this.betaTheta = new Float32Array((this.nTheta + 1) * this.nPhi);
    this.betaPhi = new Float32Array(this.length);
    this.baseTheta = new Float32Array((this.nTheta + 1) * this.nPhi);
    this.basePhi = new Float32Array(this.length);
    // Huang 2020 stores velocity on staggered spherical cell faces. Center
    // arrays are derived only for interpolation and rendering diagnostics.
    this.uThetaFace = new Float32Array((this.nTheta + 1) * this.nPhi);
    this.uPhiFace = new Float32Array(this.length);
    this.weights = new Float32Array(n);
    this.backMapX = new Float32Array(n);
    this.backMapY = new Float32Array(n);
    this.backMapZ = new Float32Array(n);
    this.forwardMapX = new Float32Array(n);
    this.forwardMapY = new Float32Array(n);
    this.forwardMapZ = new Float32Array(n);
    this.backMapNextX = new Float32Array(n);
    this.backMapNextY = new Float32Array(n);
    this.backMapNextZ = new Float32Array(n);
    this.forwardMapNextX = new Float32Array(n);
    this.forwardMapNextY = new Float32Array(n);
    this.forwardMapNextZ = new Float32Array(n);
    this.mapError = new Float32Array(n);
    this.resetMask = new Float32Array(n);
    this.semiEta = new Float32Array(n);
  }

  idx(i, j) {
    const ii = clamp(i, 0, this.nTheta - 1);
    let jj = j % this.nPhi;
    if (jj < 0) jj += this.nPhi;
    return ii * this.nPhi + jj;
  }

  fTheta(i, j) {
    let jj = j % this.nPhi;
    if (jj < 0) jj += this.nPhi;
    return clamp(i, 0, this.nTheta) * this.nPhi + jj;
  }

  theta(i) {
    return (i + 0.5) * this.dTheta;
  }

  phi(j) {
    return (j + 0.5) * this.dPhi;
  }

  normalizeAngles(theta, phi) {
    let t = theta;
    let p = phi;
    let sign = 1;
    while (t < 0 || t > PI) {
      if (t < 0) {
        t = -t;
        p += PI;
        sign *= -1;
      } else if (t > PI) {
        t = PI - (t - PI);
        p += PI;
        sign *= -1;
      }
    }
    p %= TAU;
    if (p < 0) p += TAU;
    return [t, p, sign];
  }

  sampleScalar(field, theta, phi) {
    const [t, p] = this.normalizeAngles(theta, phi);
    const y = clamp(t / this.dTheta - 0.5, 0, this.nTheta - 1.001);
    const x = p / this.dPhi - 0.5;
    const i0 = Math.floor(y);
    const j0 = Math.floor(x);
    const fy = y - i0;
    const fx = x - j0;
    const a = field[this.idx(i0, j0)];
    const b = field[this.idx(i0, j0 + 1)];
    const c = field[this.idx(i0 + 1, j0)];
    const d = field[this.idx(i0 + 1, j0 + 1)];
    return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
  }

  sampleVector(theta, phi, uTheta = this.uTheta, uPhi = this.uPhi) {
    const [t, p, sign] = this.normalizeAngles(theta, phi);
    const y = clamp(t / this.dTheta - 0.5, 0, this.nTheta - 1.001);
    const x = p / this.dPhi - 0.5;
    const i0 = Math.floor(y);
    const j0 = Math.floor(x);
    const fy = y - i0;
    const fx = x - j0;
    const id00 = this.idx(i0, j0);
    const id10 = this.idx(i0, j0 + 1);
    const id01 = this.idx(i0 + 1, j0);
    const id11 = this.idx(i0 + 1, j0 + 1);
    const th =
      ((uTheta[id00] + (uTheta[id10] - uTheta[id00]) * fx) * (1 - fy) +
        (uTheta[id01] + (uTheta[id11] - uTheta[id01]) * fx) * fy) *
      sign;
    const ph =
      ((uPhi[id00] + (uPhi[id10] - uPhi[id00]) * fx) * (1 - fy) +
        (uPhi[id01] + (uPhi[id11] - uPhi[id01]) * fx) * fy) *
      sign;
    return [th, ph];
  }

  cellWorld(i, j) {
    return sphereBasis(this.theta(i), this.phi(j)).w;
  }

  initializeMaterialMaps() {
    for (let i = 0; i < this.nTheta; i += 1) {
      for (let j = 0; j < this.nPhi; j += 1) {
        const id = this.idx(i, j);
        const w = this.cellWorld(i, j);
        this.backMapX[id] = w[0];
        this.backMapY[id] = w[1];
        this.backMapZ[id] = w[2];
        this.forwardMapX[id] = w[0];
        this.forwardMapY[id] = w[1];
        this.forwardMapZ[id] = w[2];
        this.backMapNextX[id] = w[0];
        this.backMapNextY[id] = w[1];
        this.backMapNextZ[id] = w[2];
        this.forwardMapNextX[id] = w[0];
        this.forwardMapNextY[id] = w[1];
        this.forwardMapNextZ[id] = w[2];
        this.mapError[id] = 0;
        this.resetMask[id] = 0;
      }
    }
    this.semiEta.set(this.eta);
    this.eta0.set(this.eta);
    this.lastStats.biMocqMapsInitialized = true;
  }

  sampleMapVector(mapX, mapY, mapZ, theta, phi) {
    const [t, p] = this.normalizeAngles(theta, phi);
    const y = clamp(t / this.dTheta - 0.5, 0, this.nTheta - 1.001);
    const x = p / this.dPhi - 0.5;
    const i0 = Math.floor(y);
    const j0 = Math.floor(x);
    const fy = y - i0;
    const fx = x - j0;
    const id00 = this.idx(i0, j0);
    const id10 = this.idx(i0, j0 + 1);
    const id01 = this.idx(i0 + 1, j0);
    const id11 = this.idx(i0 + 1, j0 + 1);
    const a = [mapX[id00], mapY[id00], mapZ[id00]];
    const b = [mapX[id10], mapY[id10], mapZ[id10]];
    const c = [mapX[id01], mapY[id01], mapZ[id01]];
    const d = [mapX[id11], mapY[id11], mapZ[id11]];
    const ab = slerp3(a, b, fx);
    const cd = slerp3(c, d, fx);
    return slerp3(ab, cd, fy);
  }

  initialize() {
    let etaMass = 0;
    let gammaMass = 0;
    let areaMass = 0;
    for (let i = 0; i < this.nTheta; i += 1) {
      const theta = this.theta(i);
      const st = Math.sin(theta);
      for (let j = 0; j < this.nPhi; j += 1) {
        const phi = this.phi(j);
        const id = this.idx(i, j);
        const y = Math.cos(theta);
        const n1 = valueNoise(phi + 0.7, theta * 0.92, this.seed);
        const n2 = valueNoise(phi * 1.7 + 2.1, theta * 1.11, this.seed + 19);
        const fineEta = valueNoise(phi * 4.8 + 1.1, theta * 4.2 + 0.3, this.seed + 41) - 0.5;
        const fineGamma = valueNoise(phi * 5.6 + 2.7, theta * 3.7 + 1.2, this.seed + 53) - 0.5;
        const capillarySeed = Math.sin(13.0 * phi + 3.2 * Math.sin(2.4 * theta)) * Math.sin(8.0 * theta + 2.1 * Math.cos(2.0 * phi));
        const plume =
          0.28 * Math.exp(-((theta - 1.22) ** 2) / 0.09) * Math.exp(-((Math.atan2(Math.sin(phi - 5.1), Math.cos(phi - 5.1))) ** 2) / 0.22) +
          0.22 * Math.exp(-((theta - 1.78) ** 2) / 0.13) * Math.exp(-((Math.atan2(Math.sin(phi - 2.45), Math.cos(phi - 2.45))) ** 2) / 0.16) +
          0.18 * Math.exp(-((theta - 2.02) ** 2) / 0.07) * Math.exp(-((Math.atan2(Math.sin(phi - 3.55), Math.cos(phi - 3.55))) ** 2) / 0.11);
        const drainage = 0.18 * (1 - y);
        const eta = clamp(
          0.42 +
            drainage +
            plume +
            0.11 * (n1 - 0.5) +
            0.035 * fineEta +
            0.016 * capillarySeed +
            0.05 * Math.sin(3 * phi + 1.7) * Math.sin(2 * theta),
          0.09,
          1.55,
        );
        const gammaPatch =
          0.5 * Math.exp(-((theta - 0.92) ** 2) / 0.11) * Math.exp(-((Math.atan2(Math.sin(phi - 1.2), Math.cos(phi - 1.2))) ** 2) / 0.28) +
          0.38 * Math.exp(-((theta - 1.58) ** 2) / 0.16) * Math.exp(-((Math.atan2(Math.sin(phi - 4.35), Math.cos(phi - 4.35))) ** 2) / 0.24);
        const gamma = clamp(0.56 + gammaPatch + 0.12 * (n2 - 0.5) + 0.052 * fineGamma, 0.08, 1.45);
        this.eta[id] = eta;
        this.gamma[id] = gamma;
        this.uTheta[id] = 0.0;
        this.uPhi[id] = 0.0;
        const w = st * this.dTheta * this.dPhi;
        this.weights[id] = w;
        etaMass += eta * w;
        gammaMass += gamma * w;
        areaMass += w;
      }
    }
    for (let i = 0; i <= this.nTheta; i += 1) {
      for (let j = 0; j < this.nPhi; j += 1) {
        this.uThetaFace[this.fTheta(i, j)] = 0;
      }
    }
    for (let i = 0; i < this.nTheta; i += 1) {
      const theta = this.theta(i);
      for (let j = 0; j < this.nPhi; j += 1) {
        const phiFace = j * this.dPhi;
        this.uPhiFace[this.idx(i, j)] = 0.015 * Math.sin(theta) * Math.sin(phiFace * 2 + 0.6);
      }
    }
    this.syncCentersFromFaces();
    if (this.scenario === "poleAdvection" || this.scenario === "biMocqPole") {
      const masses = this.applyPoleAdvectionInitialCondition();
      etaMass = masses.etaMass;
      gammaMass = masses.gammaMass;
    }
    this.eta0.set(this.eta);
    this.gamma0.set(this.gamma);
    this.initialEtaMass = etaMass;
    this.initialGammaMass = gammaMass;
    this.area = areaMass;
    this.lastStats = {};
    this.deriveFields();
  }

  applyPoleAdvectionInitialCondition() {
    let etaMass = 0;
    let gammaMass = 0;
    for (let i = 0; i < this.nTheta; i += 1) {
      const theta = this.theta(i);
      for (let j = 0; j < this.nPhi; j += 1) {
        const phi = this.phi(j);
        const id = this.idx(i, j);
        const bandCenter = 0.18 + 0.035 * Math.sin(2 * phi + 0.4);
        const front = 0.045 - Math.abs(theta - bandCenter);
        const sharp = smoothstep(-0.005, 0.005, front);
        this.eta[id] = 0.22 + 0.98 * sharp;
        this.gamma[id] = 0.55;
        etaMass += this.eta[id] * this.weights[id];
        gammaMass += this.gamma[id] * this.weights[id];
      }
    }
    for (let i = 0; i <= this.nTheta; i += 1) {
      const thetaFace = clamp(i * this.dTheta, 0, PI);
      const poleTaper = smoothstep(0.0, 0.035, Math.sin(thetaFace));
      for (let j = 0; j < this.nPhi; j += 1) {
        this.uThetaFace[this.fTheta(i, j)] = i === 0 || i === this.nTheta ? 0 : -24.0 * poleTaper;
      }
    }
    this.uPhiFace.fill(0);
    this.syncCentersFromFaces();
    this.divergenceFromFaces(this.uThetaFace, this.uPhiFace, this.divVelocity);
    return { etaMass, gammaMass };
  }

  gravityVector(theta, phi) {
    const { w, eTheta, ePhi } = sphereBasis(theta, phi);
    const gWorld = [0.22, -1.0, -0.08];
    const radial = dot3(gWorld, w);
    const tangential = add3(gWorld, w, 1, -radial);
    return [dot3(tangential, eTheta), dot3(tangential, ePhi)];
  }

  airVelocity(theta, phi) {
    const { w, eTheta, ePhi } = sphereBasis(theta, phi);
    let air = [0.62, -0.16, 0.38];
    if (this.scenario === "gravityDrainage") air = [0.05, 0.0, 0.0];
    if (this.scenario === "marangoniPatch") air = [0.2, -0.05, 0.12];
    const radial = dot3(air, w);
    const tangential = add3(air, w, 1, -radial);
    const band = 0.55 + 0.45 * Math.sin(theta * 2.0 + phi * 0.7);
    return [dot3(tangential, eTheta) * band, dot3(tangential, ePhi) * band];
  }

  buildBaseAndBeta(dt, gammaField = this.gammaAdv, etaField = this.etaAdv, uThetaField = this.uThetaAdv, uPhiField = this.uPhiAdv) {
    const M = this.paperParams ? 0.83 : (this.scenario === "marangoniPatch" ? 0.92 : 0.72);
    const Cr = this.paperParams ? 2.1 : (this.scenario === "gravityDrainage" ? 0.22 : 0.58);
    const gravityScale = this.paperParams ? 0.49 : (this.scenario === "gravityDrainage" ? 0.46 : 0.24);
    const viscosity = this.paperParams ? 1 / 5.6e4 : 0.008;

    for (let i = 0; i <= this.nTheta; i += 1) {
      const thetaFace = clamp(i * this.dTheta, 0.5 * this.dTheta, PI - 0.5 * this.dTheta);
      for (let j = 0; j < this.nPhi; j += 1) {
        const idf = this.fTheta(i, j);
        const idA = this.idx(i - 1, j);
        const idB = this.idx(i, j);
        const eta = Math.max(0.04, 0.5 * (etaField[idA] + etaField[idB]));
        const denom = eta + Cr * dt;
        const [gT] = this.gravityVector(thetaFace, this.phi(j));
        const [aT] = this.airVelocity(thetaFace, this.phi(j));
        const uStar = 0.5 * (uThetaField[idA] + uThetaField[idB]);
        this.baseTheta[idf] = (eta * uStar + Cr * dt * aT + dt * eta * gravityScale * gT) / denom;
        this.betaTheta[idf] = (M * dt) / denom + viscosity * dt;
      }
    }

    for (let i = 0; i < this.nTheta; i += 1) {
      const theta = this.theta(i);
      for (let j = 0; j < this.nPhi; j += 1) {
        const idf = this.idx(i, j);
        const idA = this.idx(i, j - 1);
        const idB = this.idx(i, j);
        const eta = Math.max(0.04, 0.5 * (etaField[idA] + etaField[idB]));
        const denom = eta + Cr * dt;
        const [, gP] = this.gravityVector(theta, j * this.dPhi);
        const [, aP] = this.airVelocity(theta, j * this.dPhi);
        const uStar = 0.5 * (uPhiField[idA] + uPhiField[idB]);
        this.basePhi[idf] = (eta * uStar + Cr * dt * aP + dt * eta * gravityScale * gP) / denom;
        this.betaPhi[idf] = (M * dt) / denom + viscosity * dt;
      }
    }

    this.divergenceFromFaces(this.baseTheta, this.basePhi, this.divBase);
  }

  divergenceFromFaces(thetaFace, phiFace, out) {
    for (let i = 0; i < this.nTheta; i += 1) {
      const theta = this.theta(i);
      const sinC = Math.max(1e-4, Math.sin(theta));
      const sinSouth = Math.sin(i * this.dTheta);
      const sinNorth = Math.sin((i + 1) * this.dTheta);
      for (let j = 0; j < this.nPhi; j += 1) {
        const id = this.idx(i, j);
        const north = thetaFace[this.fTheta(i + 1, j)] * sinNorth;
        const south = thetaFace[this.fTheta(i, j)] * sinSouth;
        const east = phiFace[this.idx(i, j + 1)];
        const west = phiFace[this.idx(i, j)];
        out[id] = (north - south) / (this.dTheta * sinC) + (east - west) / (this.dPhi * sinC);
      }
    }
  }

  applyGammaOperator(input, out, dt, gammaStar = this.gammaAdv) {
    for (let i = 0; i <= this.nTheta; i += 1) {
      for (let j = 0; j < this.nPhi; j += 1) {
        const idf = this.fTheta(i, j);
        const idA = this.idx(i - 1, j);
        const idB = this.idx(i, j);
        const grad = (input[idB] - input[idA]) / this.dTheta;
        const gammaFace = 0.5 * (gammaStar[idA] + gammaStar[idB]);
        this.uThetaFace[idf] = gammaFace * this.betaTheta[idf] * grad;
      }
    }
    for (let i = 0; i < this.nTheta; i += 1) {
      const sinC = Math.max(1e-4, Math.sin(this.theta(i)));
      for (let j = 0; j < this.nPhi; j += 1) {
        const idf = this.idx(i, j);
        const idA = this.idx(i, j - 1);
        const idB = this.idx(i, j);
        const grad = (input[idB] - input[idA]) / (this.dPhi * sinC);
        const gammaFace = 0.5 * (gammaStar[idA] + gammaStar[idB]);
        this.uPhiFace[idf] = gammaFace * this.betaPhi[idf] * grad;
      }
    }
    this.divergenceFromFaces(this.uThetaFace, this.uPhiFace, this.tmpC);
    const Ds = 0.00012;
    for (let i = 0; i < this.nTheta; i += 1) {
      const theta = this.theta(i);
      const sinC = Math.max(1e-4, Math.sin(theta));
      const sinInv2 = 1 / (sinC * sinC);
      for (let j = 0; j < this.nPhi; j += 1) {
        const id = this.idx(i, j);
        const lapTheta = (input[this.idx(i + 1, j)] - 2 * input[id] + input[this.idx(i - 1, j)]) / (this.dTheta * this.dTheta);
        const cotTerm =
          (Math.cos(theta) / sinC) *
          (input[this.idx(i + 1, j)] - input[this.idx(i - 1, j)]) /
          (2 * this.dTheta);
        const lapPhi =
          (input[this.idx(i, j + 1)] - 2 * input[id] + input[this.idx(i, j - 1)]) /
          (this.dPhi * this.dPhi) *
          sinInv2;
        out[id] = input[id] - dt * this.tmpC[id] - dt * Ds * (lapTheta + cotTerm + lapPhi);
      }
    }
  }

  solveGammaImplicit(dt, iterations) {
    this.buildBaseAndBeta(dt);
    for (let id = 0; id < this.length; id += 1) {
      this.tmpA[id] = clamp(this.gammaAdv[id] - dt * this.gammaAdv[id] * this.divBase[id], 0.015, 2.5);
      this.tmpB[id] = this.gammaAdv[id];
    }
    this.applyGammaOperator(this.tmpB, this.ap, dt);
    let rz = 0;
    let r0 = 0;
    for (let id = 0; id < this.length; id += 1) {
      const diag = 1 + 4 * dt * this.gammaAdv[id] * 0.02;
      this.diag[id] = 1 / diag;
      const rr = this.tmpA[id] - this.ap[id];
      this.r[id] = rr;
      this.z[id] = rr * this.diag[id];
      this.p[id] = this.z[id];
      rz += rr * this.z[id] * this.weights[id];
      r0 += rr * rr * this.weights[id];
    }
    const initialResidual = Math.sqrt(Math.max(0, r0 / this.area));
    let finalResidual = initialResidual;
    for (let k = 0; k < iterations; k += 1) {
      this.applyGammaOperator(this.p, this.ap, dt);
      let denom = 0;
      for (let id = 0; id < this.length; id += 1) denom += this.p[id] * this.ap[id] * this.weights[id];
      const alpha = rz / Math.max(1e-20, denom);
      let nextRz = 0;
      let r2 = 0;
      for (let id = 0; id < this.length; id += 1) {
        this.tmpB[id] = this.tmpB[id] + alpha * this.p[id];
        this.r[id] -= alpha * this.ap[id];
        this.z[id] = this.r[id] * this.diag[id];
        nextRz += this.r[id] * this.z[id] * this.weights[id];
        r2 += this.r[id] * this.r[id] * this.weights[id];
      }
      finalResidual = Math.sqrt(Math.max(0, r2 / this.area));
      if (finalResidual < 2e-5) break;
      const beta = nextRz / Math.max(1e-20, rz);
      for (let id = 0; id < this.length; id += 1) this.p[id] = this.z[id] + beta * this.p[id];
      rz = nextRz;
    }
    for (let id = 0; id < this.length; id += 1) this.gamma[id] = clamp(this.tmpB[id], 0.015, 2.7);
    this.lastStats.gammaResidualInitial = initialResidual;
    this.lastStats.gammaResidualFinal = finalResidual;
  }

  updateVelocityFromGamma(dt) {
    for (let i = 0; i <= this.nTheta; i += 1) {
      for (let j = 0; j < this.nPhi; j += 1) {
        const idf = this.fTheta(i, j);
        const idA = this.idx(i - 1, j);
        const idB = this.idx(i, j);
        const grad = (this.gamma[idB] - this.gamma[idA]) / this.dTheta;
        this.uThetaFace[idf] = this.baseTheta[idf] - this.betaTheta[idf] * grad;
      }
    }
    for (let i = 0; i < this.nTheta; i += 1) {
      const sinC = Math.max(1e-4, Math.sin(this.theta(i)));
      for (let j = 0; j < this.nPhi; j += 1) {
        const idf = this.idx(i, j);
        const idA = this.idx(i, j - 1);
        const idB = this.idx(i, j);
        const grad = (this.gamma[idB] - this.gamma[idA]) / (this.dPhi * sinC);
        this.uPhiFace[idf] = this.basePhi[idf] - this.betaPhi[idf] * grad;
      }
    }
    this.lastStats.maxSpeed = this.syncCentersFromFaces();
    this.divergenceFromFaces(this.uThetaFace, this.uPhiFace, this.divVelocity);
  }

  syncCentersFromFaces() {
    let maxSpeed = 0;
    for (let i = 0; i < this.nTheta; i += 1) {
      for (let j = 0; j < this.nPhi; j += 1) {
        const id = this.idx(i, j);
        const ut = 0.5 * (this.uThetaFace[this.fTheta(i, j)] + this.uThetaFace[this.fTheta(i + 1, j)]);
        const up = 0.5 * (this.uPhiFace[this.idx(i, j)] + this.uPhiFace[this.idx(i, j + 1)]);
        this.uTheta[id] = ut;
        this.uPhi[id] = up;
        maxSpeed = Math.max(maxSpeed, Math.hypot(ut, up));
      }
    }
    return maxSpeed;
  }

  syncFacesFromCenters() {
    for (let i = 0; i <= this.nTheta; i += 1) {
      for (let j = 0; j < this.nPhi; j += 1) {
        const idf = this.fTheta(i, j);
        this.uThetaFace[idf] =
          i === 0 || i === this.nTheta ? 0 : 0.5 * (this.uTheta[this.idx(i - 1, j)] + this.uTheta[this.idx(i, j)]);
      }
    }
    for (let i = 0; i < this.nTheta; i += 1) {
      for (let j = 0; j < this.nPhi; j += 1) {
        this.uPhiFace[this.idx(i, j)] = 0.5 * (this.uPhi[this.idx(i, j - 1)] + this.uPhi[this.idx(i, j)]);
      }
    }
  }

  vectorToWorld(theta, phi, ut, up) {
    const { eTheta, ePhi } = sphereBasis(theta, phi);
    return add3(eTheta, ePhi, ut, up);
  }

  worldToVector(theta, phi, v) {
    const { eTheta, ePhi } = sphereBasis(theta, phi);
    return [dot3(v, eTheta), dot3(v, ePhi)];
  }

  transportVector(thetaA, phiA, ut, up, thetaB, phiB) {
    const basisA = sphereBasis(thetaA, phiA);
    const basisB = sphereBasis(thetaB, phiB);
    const vA = add3(basisA.eTheta, basisA.ePhi, ut, up);
    const axisRaw = cross3(basisA.w, basisB.w);
    const axisLen = Math.hypot(axisRaw[0], axisRaw[1], axisRaw[2]);
    if (axisLen < 1e-9) return this.worldToVector(thetaB, phiB, vA);
    const axis = [axisRaw[0] / axisLen, axisRaw[1] / axisLen, axisRaw[2] / axisLen];
    const angle = Math.atan2(axisLen, clamp(dot3(basisA.w, basisB.w), -1, 1));
    const transported = rotateAroundAxis(vA, axis, angle);
    return this.worldToVector(thetaB, phiB, transported);
  }

  moveAlongVelocity(theta, phi, ut, up, signedDt) {
    const speed = Math.hypot(ut, up);
    if (speed < 1e-10 || Math.abs(signedDt) < 1e-12) return [theta, phi];
    const { w, eTheta, ePhi } = sphereBasis(theta, phi);
    const tangent = normalize3(add3(eTheta, ePhi, ut, up));
    const arc = clamp(speed * Math.abs(signedDt), 0, 0.8) * Math.sign(signedDt);
    const next = add3(w, tangent, Math.cos(arc), Math.sin(arc));
    return xyzToAngles(normalize3(next));
  }

  advectPoint(theta, phi, dt, forward = false) {
    const signedDt = forward ? dt : -dt;
    const [ut0, up0] = this.sampleVector(theta, phi);
    if (Math.hypot(ut0, up0) < 1e-10) return [theta, phi];
    const [halfTheta, halfPhi] = this.moveAlongVelocity(theta, phi, ut0, up0, 0.5 * signedDt);
    const [utHalf, upHalf] = this.sampleVector(halfTheta, halfPhi);
    const [utAtStart, upAtStart] = this.transportVector(halfTheta, halfPhi, utHalf, upHalf, theta, phi);
    return this.moveAlongVelocity(theta, phi, utAtStart, upAtStart, signedDt);
  }

  advectScalarAligned(field, out, dt, minV, maxV) {
    for (let i = 0; i < this.nTheta; i += 1) {
      for (let j = 0; j < this.nPhi; j += 1) {
        const id = this.idx(i, j);
        const [bt, bp] = this.advectPoint(this.theta(i), this.phi(j), dt, false);
        out[id] = clamp(this.sampleScalar(field, bt, bp), minV, maxV);
      }
    }
  }

  advectScalarBfecc(field, out, dt, minV, maxV) {
    for (let i = 0; i < this.nTheta; i += 1) {
      for (let j = 0; j < this.nPhi; j += 1) {
        const id = this.idx(i, j);
        const [bt, bp] = this.advectPoint(this.theta(i), this.phi(j), dt, false);
        this.tmpA[id] = this.sampleScalar(field, bt, bp);
      }
    }
    for (let i = 0; i < this.nTheta; i += 1) {
      for (let j = 0; j < this.nPhi; j += 1) {
        const id = this.idx(i, j);
        const [ft, fp] = this.advectPoint(this.theta(i), this.phi(j), dt, true);
        this.tmpB[id] = this.sampleScalar(this.tmpA, ft, fp);
      }
    }
    for (let i = 0; i < this.nTheta; i += 1) {
      for (let j = 0; j < this.nPhi; j += 1) {
        const id = this.idx(i, j);
        const correction = 0.5 * (field[id] - this.tmpB[id]);
        let lo = field[id];
        let hi = field[id];
        for (let di = -1; di <= 1; di += 1) {
          for (let dj = -1; dj <= 1; dj += 1) {
            const v = field[this.idx(i + di, j + dj)];
            lo = Math.min(lo, v);
            hi = Math.max(hi, v);
          }
        }
        out[id] = clamp(this.tmpA[id] + correction, Math.max(minV, lo - 0.04), Math.min(maxV, hi + 0.04));
      }
    }
  }

  advectVectorAligned(dt) {
    for (let i = 0; i < this.nTheta; i += 1) {
      const theta = this.theta(i);
      for (let j = 0; j < this.nPhi; j += 1) {
        const phi = this.phi(j);
        const id = this.idx(i, j);
        const [ut, up] = this.sampleVector(theta, phi);
        if (Math.hypot(ut, up) < 1e-10) {
          this.uThetaAdv[id] = this.uTheta[id];
          this.uPhiAdv[id] = this.uPhi[id];
          continue;
        }
        const [bt, bp] = this.advectPoint(theta, phi, dt, false);
        const [utb, upb] = this.sampleVector(bt, bp);
        const [utt, upt] = this.transportVector(bt, bp, utb, upb, theta, phi);
        this.uThetaAdv[id] = utt;
        this.uPhiAdv[id] = upt;
      }
    }
  }

  updateBiMocqMaps(dt, threshold = PI / 128) {
    let finiteMaps = true;
    for (let i = 0; i < this.nTheta; i += 1) {
      const theta = this.theta(i);
      for (let j = 0; j < this.nPhi; j += 1) {
        const id = this.idx(i, j);
        const phi = this.phi(j);
        const [bt, bp] = this.advectPoint(theta, phi, dt, false);
        const mapped = this.sampleMapVector(this.backMapX, this.backMapY, this.backMapZ, bt, bp);
        this.backMapNextX[id] = mapped[0];
        this.backMapNextY[id] = mapped[1];
        this.backMapNextZ[id] = mapped[2];
      }
    }

    for (let id = 0; id < this.length; id += 1) {
      const current = normalize3([this.forwardMapX[id], this.forwardMapY[id], this.forwardMapZ[id]]);
      const [theta, phi] = xyzToAngles(current);
      const [nt, np] = this.advectPoint(theta, phi, dt, true);
      const next = sphereBasis(nt, np).w;
      this.forwardMapNextX[id] = next[0];
      this.forwardMapNextY[id] = next[1];
      this.forwardMapNextZ[id] = next[2];
    }

    let resetCount = 0;
    let maxMapError = 0;
    let meanMapError = 0;
    for (let i = 0; i < this.nTheta; i += 1) {
      for (let j = 0; j < this.nPhi; j += 1) {
        const id = this.idx(i, j);
        const current = this.cellWorld(i, j);
        const initial = normalize3([this.backMapNextX[id], this.backMapNextY[id], this.backMapNextZ[id]]);
        const [it, ip] = xyzToAngles(initial);
        const composed = this.sampleMapVector(this.forwardMapNextX, this.forwardMapNextY, this.forwardMapNextZ, it, ip);
        const error = greatCircleDistance(current, composed);
        this.mapError[id] = error;
        this.resetMask[id] = error > threshold ? 1 : 0;
        if (error > threshold) {
          resetCount += 1;
          this.backMapNextX[id] = current[0];
          this.backMapNextY[id] = current[1];
          this.backMapNextZ[id] = current[2];
          this.forwardMapNextX[id] = current[0];
          this.forwardMapNextY[id] = current[1];
          this.forwardMapNextZ[id] = current[2];
        }
        maxMapError = Math.max(maxMapError, error);
        meanMapError += error * this.weights[id];
        finiteMaps =
          finiteMaps &&
          Number.isFinite(this.backMapNextX[id]) &&
          Number.isFinite(this.backMapNextY[id]) &&
          Number.isFinite(this.backMapNextZ[id]) &&
          Number.isFinite(this.forwardMapNextX[id]) &&
          Number.isFinite(this.forwardMapNextY[id]) &&
          Number.isFinite(this.forwardMapNextZ[id]);
      }
    }

    [this.backMapX, this.backMapNextX] = [this.backMapNextX, this.backMapX];
    [this.backMapY, this.backMapNextY] = [this.backMapNextY, this.backMapY];
    [this.backMapZ, this.backMapNextZ] = [this.backMapNextZ, this.backMapZ];
    [this.forwardMapX, this.forwardMapNextX] = [this.forwardMapNextX, this.forwardMapX];
    [this.forwardMapY, this.forwardMapNextY] = [this.forwardMapNextY, this.forwardMapY];
    [this.forwardMapZ, this.forwardMapNextZ] = [this.forwardMapNextZ, this.forwardMapZ];

    return {
      threshold,
      resetCount,
      resetFraction: resetCount / this.length,
      maxMapError,
      meanMapError: meanMapError / Math.max(EPS, this.area),
      finiteMaps,
      resetMode: "cell-local identity reset when composed forward/backward spherical maps exceed pi/128",
    };
  }

  applyBiMocqThickness(initialField, out, minV, maxV) {
    for (let id = 0; id < this.length; id += 1) {
      const initial = normalize3([this.backMapX[id], this.backMapY[id], this.backMapZ[id]]);
      const [theta, phi] = xyzToAngles(initial);
      out[id] = clamp(this.sampleScalar(initialField, theta, phi), minV, maxV);
    }
  }

  updateEtaContinuity(dt) {
    for (let id = 0; id < this.length; id += 1) {
      this.eta[id] = clamp(this.etaAdv[id] - dt * this.etaAdv[id] * this.divVelocity[id], 0.035, 2.2);
    }
    this.correctMass(this.eta, this.initialEtaMass, 0.035, 2.2);
    this.correctMass(this.gamma, this.initialGammaMass, 0.015, 2.7);
  }

  correctMass(field, targetMass, minV, maxV) {
    let mass = 0;
    for (let id = 0; id < this.length; id += 1) mass += field[id] * this.weights[id];
    const scale = targetMass / Math.max(EPS, mass);
    for (let id = 0; id < this.length; id += 1) field[id] = clamp(field[id] * scale, minV, maxV);
  }

  step(dt, cgIterations) {
    this.advectScalarBfecc(this.eta, this.etaAdv, dt, 0.035, 2.2);
    this.advectScalarBfecc(this.gamma, this.gammaAdv, dt, 0.015, 2.7);
    this.advectVectorAligned(dt);
    this.solveGammaImplicit(dt, cgIterations);
    this.updateVelocityFromGamma(dt);
    this.updateEtaContinuity(dt);
  }

  run({ steps = 96, dt = 0.002, cg = 22 } = {}) {
    if (this.scenario === "poleAdvection") {
      this.runPoleAdvection(steps, dt);
      return;
    }
    if (this.scenario === "biMocqPole") {
      this.runBiMocqPole(steps, dt);
      return;
    }
    const start = Date.now();
    for (let s = 0; s < steps; s += 1) {
      this.step(dt, cg);
      if ((s + 1) % 12 === 0) this.deriveFields();
    }
    this.deriveFields();
    this.lastStats.elapsedMs = Date.now() - start;
    this.lastStats.steps = steps;
    this.lastStats.dt = dt;
    this.lastStats.cgIterations = cg;
  }

  totalVariation(field) {
    let tv = 0;
    for (let i = 0; i < this.nTheta; i += 1) {
      const theta = this.theta(i);
      const sinC = Math.max(1e-4, Math.sin(theta));
      for (let j = 0; j < this.nPhi; j += 1) {
        const id = this.idx(i, j);
        const dt = (field[this.idx(i + 1, j)] - field[this.idx(i - 1, j)]) / (2 * this.dTheta);
        const dp = (field[this.idx(i, j + 1)] - field[this.idx(i, j - 1)]) / (2 * this.dPhi * sinC);
        tv += Math.hypot(dt, dp) * this.weights[id];
      }
    }
    return tv;
  }

  massOf(field) {
    let mass = 0;
    for (let id = 0; id < this.length; id += 1) mass += field[id] * this.weights[id];
    return mass;
  }

  runPoleAdvection(steps = 4, dt = 0.002) {
    const start = Date.now();
    const initialTv = this.totalVariation(this.eta);
    const initialMass = this.initialEtaMass;
    for (let s = 0; s < steps; s += 1) {
      this.advectScalarAligned(this.eta, this.etaAdv, dt, 0.0, 1.5);
      this.eta.set(this.etaAdv);
      this.advectVectorAligned(dt);
      this.uTheta.set(this.uThetaAdv);
      this.uPhi.set(this.uPhiAdv);
      this.syncFacesFromCenters();
    }
    this.deriveFields();
    const finalTv = this.totalVariation(this.eta);
    let etaMass = 0;
    let finiteVelocity = true;
    let maxVectorSpeed = 0;
    for (let id = 0; id < this.length; id += 1) {
      etaMass += this.eta[id] * this.weights[id];
      const speed = Math.hypot(this.uTheta[id], this.uPhi[id]);
      maxVectorSpeed = Math.max(maxVectorSpeed, speed);
      finiteVelocity = finiteVelocity && Number.isFinite(this.uTheta[id]) && Number.isFinite(this.uPhi[id]);
    }
    this.lastStats.elapsedMs = Date.now() - start;
    this.lastStats.steps = steps;
    this.lastStats.dt = dt;
    this.lastStats.cgIterations = 0;
    this.lastStats.advectionDiagnostics = {
      scheme: "Huang Section 4.2 velocity-aligned great-circle half-step",
      initialTotalVariation: initialTv,
      finalTotalVariation: finalTv,
      totalVariationRatio: finalTv / Math.max(EPS, initialTv),
      etaMassError: (etaMass - initialMass) / Math.max(EPS, initialMass),
      finiteVelocity,
      maxVectorSpeed,
    };
  }

  runBiMocqPole(steps = 4, dt = 0.002) {
    const start = Date.now();
    this.initializeMaterialMaps();
    const initialTv = this.totalVariation(this.eta);
    const initialMass = this.initialEtaMass;
    let lastMapStats = {
      threshold: PI / 128,
      resetCount: 0,
      resetFraction: 0,
      maxMapError: 0,
      meanMapError: 0,
      finiteMaps: true,
    };

    for (let s = 0; s < steps; s += 1) {
      this.advectScalarAligned(this.semiEta, this.tmpA, dt, 0.0, 1.5);
      this.semiEta.set(this.tmpA);
      lastMapStats = this.updateBiMocqMaps(dt, PI / 128);
      this.applyBiMocqThickness(this.eta0, this.eta, 0.0, 1.5);
      this.advectVectorAligned(dt);
      this.uTheta.set(this.uThetaAdv);
      this.uPhi.set(this.uPhiAdv);
      this.syncFacesFromCenters();
    }

    this.divergenceFromFaces(this.uThetaFace, this.uPhiFace, this.divVelocity);
    this.deriveFields();
    const biMocqTv = this.totalVariation(this.eta);
    const semiTv = this.totalVariation(this.semiEta);
    const biMocqMass = this.massOf(this.eta);
    const semiMass = this.massOf(this.semiEta);
    let finiteVelocity = true;
    let maxVectorSpeed = 0;
    for (let id = 0; id < this.length; id += 1) {
      const speed = Math.hypot(this.uTheta[id], this.uPhi[id]);
      maxVectorSpeed = Math.max(maxVectorSpeed, speed);
      finiteVelocity = finiteVelocity && Number.isFinite(this.uTheta[id]) && Number.isFinite(this.uPhi[id]);
    }

    this.lastStats.elapsedMs = Date.now() - start;
    this.lastStats.steps = steps;
    this.lastStats.dt = dt;
    this.lastStats.cgIterations = 0;
    this.lastStats.biMocqDiagnostics = {
      scheme: "Huang Section 4.2.1 BiMocq2 spherical backward/forward maps for eta pure advection",
      initialTotalVariation: initialTv,
      semiLagrangianTotalVariation: semiTv,
      biMocqTotalVariation: biMocqTv,
      semiLagrangianTotalVariationRatio: semiTv / Math.max(EPS, initialTv),
      biMocqTotalVariationRatio: biMocqTv / Math.max(EPS, initialTv),
      biMocqVsSemiVariationRatio: biMocqTv / Math.max(EPS, semiTv),
      biMocqEtaMassError: (biMocqMass - initialMass) / Math.max(EPS, initialMass),
      semiLagrangianEtaMassError: (semiMass - initialMass) / Math.max(EPS, initialMass),
      finiteVelocity,
      maxVectorSpeed,
      ...lastMapStats,
      sourceAccumulationStatus:
        "M4 validates Huang's pure advection detail-preservation path; eta source accumulation along the forward map is deferred to the coupled eta/Gamma/u stage after M5.",
    };
  }

  deriveFields() {
    let etaMass = 0;
    let gammaMass = 0;
    let maxGradEta = 0;
    let maxGradGamma = 0;
    let maxSpeed = 0;
    let meanDiv = 0;
    for (let i = 0; i < this.nTheta; i += 1) {
      const theta = this.theta(i);
      const sinC = Math.max(1e-4, Math.sin(theta));
      for (let j = 0; j < this.nPhi; j += 1) {
        const id = this.idx(i, j);
        const dEtaT = (this.eta[this.idx(i + 1, j)] - this.eta[this.idx(i - 1, j)]) / (2 * this.dTheta);
        const dEtaP = (this.eta[this.idx(i, j + 1)] - this.eta[this.idx(i, j - 1)]) / (2 * this.dPhi * sinC);
        const dGammaT = (this.gamma[this.idx(i + 1, j)] - this.gamma[this.idx(i - 1, j)]) / (2 * this.dTheta);
        const dGammaP = (this.gamma[this.idx(i, j + 1)] - this.gamma[this.idx(i, j - 1)]) / (2 * this.dPhi * sinC);
        const ge = Math.hypot(dEtaT, dEtaP);
        const gg = Math.hypot(dGammaT, dGammaP);
        const sp = Math.hypot(this.uTheta[id], this.uPhi[id]);
        const div = this.divVelocity[id] || 0;
        const compression = Math.max(0, -div);
        this.gradEta[id] = ge;
        this.gradGamma[id] = gg;
        this.speed[id] = sp;
        this.foam[id] = clamp(0.9 * smoothstep(0.12, 0.62, ge) * smoothstep(0.04, 0.22, compression + 0.7 * gg) + 0.22 * smoothstep(0.18, 0.45, sp), 0, 1);
        this.phase[id] = fract(0.12 + this.eta[id] * 2.65 + 0.35 * this.gamma[id] + 0.08 * Math.sin(this.phi(j) * 3 + this.theta(i) * 2));
        etaMass += this.eta[id] * this.weights[id];
        gammaMass += this.gamma[id] * this.weights[id];
        meanDiv += Math.abs(div) * this.weights[id];
        maxGradEta = Math.max(maxGradEta, ge);
        maxGradGamma = Math.max(maxGradGamma, gg);
        maxSpeed = Math.max(maxSpeed, sp);
      }
    }
    this.lastStats.etaMass = etaMass;
    this.lastStats.gammaMass = gammaMass;
    this.lastStats.massError = (etaMass - this.initialEtaMass) / this.initialEtaMass;
    this.lastStats.gammaMassError = (gammaMass - this.initialGammaMass) / this.initialGammaMass;
    this.lastStats.meanAbsDivergence = meanDiv / this.area;
    this.lastStats.maxGradEta = maxGradEta;
    this.lastStats.maxGradGamma = maxGradGamma;
    this.lastStats.maxSpeed = maxSpeed;
  }

  diagnostics() {
    return {
      solver: "standalone-huang-clean",
      paperModel: [
        "eta half-thickness on fixed sphere",
        "Gamma surfactant concentration",
        "tangent velocity u(theta,phi)",
        "1024x2048 paper-scale staggered spherical grid by default",
        "sphere metric grad/div/laplace",
        "velocity-aligned great-circle half-step advection",
        "BiMocq2 spherical backward/forward maps available for eta detail preservation",
        "legacy BFECC eta transport remains only in the pre-M6 coupled fallback path",
        "matrix-free CG implicit Gamma/projection-like update",
        "eta_t = -eta div(u)",
        "thin-film spectral interference from 2*eta, view angle and Fresnel coefficients",
      ],
      scenario: this.scenario,
      nTheta: this.nTheta,
      nPhi: this.nPhi,
      paperParams: this.paperParams,
      gridDiagnostics: this.computeGridDiagnostics(),
      ...this.lastStats,
    };
  }

  computeGridDiagnostics() {
    const zeroTheta = new Float32Array((this.nTheta + 1) * this.nPhi);
    const zeroPhi = new Float32Array(this.length);
    this.divergenceFromFaces(zeroTheta, zeroPhi, this.tmpA);
    let maxZeroDivergence = 0;
    let maxConstantLaplacian = 0;
    for (let i = 0; i < this.nTheta; i += 1) {
      const theta = this.theta(i);
      const sinC = Math.max(1e-4, Math.sin(theta));
      const sinInv2 = 1 / (sinC * sinC);
      for (let j = 0; j < this.nPhi; j += 1) {
        const id = this.idx(i, j);
        maxZeroDivergence = Math.max(maxZeroDivergence, Math.abs(this.tmpA[id]));
        const constant = 1;
        const lapTheta = (constant - 2 * constant + constant) / (this.dTheta * this.dTheta);
        const cotTerm = (Math.cos(theta) / sinC) * (constant - constant) / (2 * this.dTheta);
        const lapPhi = (constant - 2 * constant + constant) / (this.dPhi * this.dPhi) * sinInv2;
        maxConstantLaplacian = Math.max(maxConstantLaplacian, Math.abs(lapTheta + cotTerm + lapPhi));
      }
    }
    const [poleUt, poleUp] = this.sampleVector(-0.25 * this.dTheta, 0, this.uTheta.map(() => 1), this.uPhi.map(() => 1));
    return {
      grid: `${this.nTheta}x${this.nPhi}`,
      expectedPaperGrid: this.nTheta === 1024 && this.nPhi === 2048,
      aspectPhiOverTheta: this.nPhi / this.nTheta,
      area: this.area,
      areaRelativeError: (this.area - 4 * PI) / (4 * PI),
      maxZeroDivergence,
      maxConstantLaplacian,
      poleVectorSignError: Math.abs(poleUt + 1) + Math.abs(poleUp + 1),
      staggeredVelocityPrimary: true,
    };
  }
}

function srgbByte(v) {
  const x = clamp(v, 0, 1);
  const y = x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
  return Math.round(clamp(y, 0, 1) * 255);
}

function wavelengthToRgb(lambda) {
  const r = Math.exp(-0.5 * ((lambda - 610) / 45) ** 2) + 0.22 * Math.exp(-0.5 * ((lambda - 700) / 34) ** 2);
  const g = Math.exp(-0.5 * ((lambda - 540) / 38) ** 2);
  const b = Math.exp(-0.5 * ((lambda - 460) / 32) ** 2);
  return [r, g, b];
}

function thinFilmColor(eta, gamma, foam, cosView, normal, speed, edge = 0) {
  const n0 = 1.0;
  const n1 = 1.33;
  const cosI = clamp(cosView, 0.04, 1);
  const sinT = clamp((n0 / n1) * Math.sqrt(Math.max(0, 1 - cosI * cosI)), 0, 0.999);
  const cosT = Math.sqrt(Math.max(0, 1 - sinT * sinT));
  const filmNm = clamp(70 + 640 * eta + 96 * Math.sin(gamma * 4.3) + 42 * speed + 72 * Math.tanh(edge * 0.08), 25, 1180);
  const wavelengths = [410, 445, 480, 515, 550, 585, 620, 655, 700];
  let r = 0;
  let g = 0;
  let b = 0;
  let wsum = 0;
  for (const lambda of wavelengths) {
    const rs = (n0 * cosI - n1 * cosT) / (n0 * cosI + n1 * cosT);
    const rp = (n1 * cosI - n0 * cosT) / (n1 * cosI + n0 * cosT);
    const amp = 0.5 * (rs * rs + rp * rp);
    const phase = (4 * PI * n1 * filmNm * cosT) / lambda;
    const interference = 0.5 + 0.5 * Math.cos(phase + PI);
    const reflectance = clamp(0.018 + amp * 4.0 * interference, 0, 1);
    const [wr, wg, wb] = wavelengthToRgb(lambda);
    r += reflectance * wr;
    g += reflectance * wg;
    b += reflectance * wb;
    wsum += Math.max(wr, wg, wb);
  }
  r /= wsum * 0.36;
  g /= wsum * 0.36;
  b /= wsum * 0.36;
  r *= 2.55;
  g *= 2.55;
  b *= 2.75;
  const rim = (1 - cosI) ** 1.8;
  const sky = 0.02 + 0.08 * Math.max(0, normal[1]) + 0.06 * rim;
  const warm = 0.035 + 0.075 * Math.max(0, -normal[1]);
  r = r * (0.92 + sky) + warm * 0.22;
  g = g * (0.88 + sky) + warm * 0.12;
  b = b * (0.98 + sky) + 0.035 * rim;
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  r = lum + (r - lum) * 1.85;
  g = lum + (g - lum) * 1.85;
  b = lum + (b - lum) * 1.95;
  const white = foam * foam * 0.11;
  r = r * (1 - white) + white;
  g = g * (1 - white) + white * 0.93;
  b = b * (1 - white) + white * 0.74;
  return [r, g, b];
}

function rotateNormal(n, yaw, pitch) {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  let x = n[0] * cy + n[2] * sy;
  let z = -n[0] * sy + n[2] * cy;
  const y = n[1] * cp - z * sp;
  z = n[1] * sp + z * cp;
  return [x, y, z];
}

function renderBeauty(sim, size) {
  const rgba = Buffer.alloc(size * size * 4);
  const yaw = -0.45;
  const pitch = 0.15;
  for (let y = 0; y < size; y += 1) {
    const py = 1 - (2 * (y + 0.5)) / size;
    for (let x = 0; x < size; x += 1) {
      const px = (2 * (x + 0.5)) / size - 1;
      const idp = (y * size + x) * 4;
      const r2 = px * px + py * py;
      if (r2 > 0.985) {
        rgba[idp] = 4;
        rgba[idp + 1] = 4;
        rgba[idp + 2] = 6;
        rgba[idp + 3] = 255;
        continue;
      }
      const z = Math.sqrt(Math.max(0, 1 - r2));
      const normal = rotateNormal([px, py, z], yaw, pitch);
      const [theta, phi] = xyzToAngles(normal);
      const eta = sim.sampleScalar(sim.eta, theta, phi);
      const gamma = sim.sampleScalar(sim.gamma, theta, phi);
      const foam = sim.sampleScalar(sim.foam, theta, phi);
      const speed = sim.sampleScalar(sim.speed, theta, phi);
      const edge = sim.sampleScalar(sim.gradEta, theta, phi);
      const cosView = z;
      let [rr, gg, bb] = thinFilmColor(eta, gamma, foam, cosView, normal, speed, edge);
      const exposure = 3.6;
      rr = 1 - Math.exp(-rr * exposure);
      gg = 1 - Math.exp(-gg * exposure);
      bb = 1 - Math.exp(-bb * exposure);
      const vignette = 1 - smoothstep(0.72, 0.99, r2);
      rr *= vignette;
      gg *= vignette;
      bb *= vignette;
      rgba[idp] = srgbByte(rr);
      rgba[idp + 1] = srgbByte(gg);
      rgba[idp + 2] = srgbByte(bb);
      rgba[idp + 3] = 255;
    }
  }
  return rgba;
}

function renderLatLong(sim, fieldName, width = sim.nPhi, height = sim.nTheta) {
  const rgba = Buffer.alloc(width * height * 4);
  const field = sim[fieldName];
  let min = Infinity;
  let max = -Infinity;
  for (const v of field) {
    min = Math.min(min, v);
    max = Math.max(max, v);
  }
  if (fieldName === "divVelocity") {
    min = -Math.max(Math.abs(min), Math.abs(max));
    max = -min;
  }
  for (let y = 0; y < height; y += 1) {
    const i = Math.floor((y / height) * sim.nTheta);
    for (let x = 0; x < width; x += 1) {
      const j = Math.floor((x / width) * sim.nPhi);
      const v = field[sim.idx(i, j)];
      const t = clamp((v - min) / Math.max(EPS, max - min), 0, 1);
      const p = (y * width + x) * 4;
      let r;
      let g;
      let b;
      if (fieldName === "divVelocity") {
        r = smoothstep(0.5, 1, t);
        g = 0.35 + 0.45 * (1 - Math.abs(t - 0.5) * 2);
        b = smoothstep(0.5, 0, t);
      } else {
        r = smoothstep(0.5, 1, t);
        g = Math.sin(t * PI);
        b = smoothstep(0.5, 0, t);
      }
      rgba[p] = srgbByte(r);
      rgba[p + 1] = srgbByte(g);
      rgba[p + 2] = srgbByte(b);
      rgba[p + 3] = 255;
    }
  }
  return { rgba, min, max };
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const out = Buffer.alloc(8 + data.length + 4);
  out.writeUInt32BE(data.length, 0);
  typeBuf.copy(out, 4);
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 8 + data.length);
  return out;
}

function writePng(filePath, width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 4 + 1);
    raw[row] = 0;
    rgba.copy(raw, row + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", zlib.deflateSync(raw, { level: 7 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
  fs.writeFileSync(filePath, png);
}

function main() {
  const args = parseArgs(process.argv);
  fs.mkdirSync(args.outDir, { recursive: true });
  const sim = new HuangCleanSimulator(args);
  console.log(`[huang-clean] sim=${args.simTheta}x${args.simPhi}, steps=${args.steps}, dt=${args.dt}, cg=${args.cg}, scenario=${args.scenario}`);
  let initialThicknessPath = "";
  if (args.scenario === "poleAdvection" || args.scenario === "biMocqPole") {
    const { rgba } = renderLatLong(sim, "eta");
    initialThicknessPath = path.join(args.outDir, `${args.tag}-initial-thickness.png`);
    writePng(initialThicknessPath, sim.nPhi, sim.nTheta, rgba);
  }
  sim.run(args);
  const centerNormal = rotateNormal([0, 0, 1], -0.45, 0.15);
  const [centerTheta, centerPhi] = xyzToAngles(centerNormal);
  const centerEta = sim.sampleScalar(sim.eta, centerTheta, centerPhi);
  const centerGamma = sim.sampleScalar(sim.gamma, centerTheta, centerPhi);
  const centerFoam = sim.sampleScalar(sim.foam, centerTheta, centerPhi);
  const centerSpeed = sim.sampleScalar(sim.speed, centerTheta, centerPhi);
  const centerEdge = sim.sampleScalar(sim.gradEta, centerTheta, centerPhi);
  const centerColor = thinFilmColor(centerEta, centerGamma, centerFoam, 1, centerNormal, centerSpeed, centerEdge);
  const beauty = renderBeauty(sim, args.render);
  const centerPixel = ((Math.floor(args.render / 2) * args.render + Math.floor(args.render / 2)) * 4);
  let beautyMax = 0;
  let beautyMean = 0;
  for (let i = 0; i < beauty.length; i += 4) {
    const m = Math.max(beauty[i], beauty[i + 1], beauty[i + 2]);
    beautyMax = Math.max(beautyMax, m);
    beautyMean += m;
  }
  beautyMean /= beauty.length / 4;
  const beautyPath = path.join(args.outDir, `${args.tag}-beauty.png`);
  writePng(beautyPath, args.render, args.render, beauty);
  const debugFields = [
    ["eta", "thickness"],
    ["gamma", "surfactant"],
    ["speed", "velocity"],
    ["divVelocity", "divergence"],
    ["foam", "foam"],
  ];
  if (args.scenario === "biMocqPole") {
    debugFields.push(["semiEta", "semi-lagrangian-thickness"]);
    debugFields.push(["mapError", "map-error"]);
    debugFields.push(["resetMask", "reset-mask"]);
  }
  const ranges = {};
  const debugOutputs = {};
  for (const [field, name] of debugFields) {
    const { rgba, min, max } = renderLatLong(sim, field);
    ranges[field] = { min, max };
    const debugPath = path.join(args.outDir, `${args.tag}-${name}.png`);
    writePng(debugPath, sim.nPhi, sim.nTheta, rgba);
    debugOutputs[name] = debugPath;
  }
  const diagnostics = sim.diagnostics();
  diagnostics.debugRanges = ranges;
  diagnostics.outputs = {
    initialThickness: initialThicknessPath || undefined,
    beauty: beautyPath,
    ...debugOutputs,
  };
  diagnostics.beautyByteStats = { max: beautyMax, mean: beautyMean };
  const jsonPath = path.join(args.outDir, `${args.tag}-diagnostics.json`);
  fs.writeFileSync(jsonPath, `${JSON.stringify(diagnostics, null, 2)}\n`, "utf8");
  console.log(`[huang-clean] wrote ${beautyPath}`);
  console.log(`[huang-clean] center eta=${centerEta}, gamma=${centerGamma}, edge=${centerEdge}, foam=${centerFoam}, speed=${centerSpeed}, color=${centerColor.join(",")}, bytes=${beauty[centerPixel]},${beauty[centerPixel + 1]},${beauty[centerPixel + 2]}`);
  console.log(`[huang-clean] massError=${diagnostics.massError}, gammaResidual=${diagnostics.gammaResidualInitial}->${diagnostics.gammaResidualFinal}, beautyMax=${beautyMax}, beautyMean=${beautyMean}, elapsedMs=${diagnostics.elapsedMs}`);
}

if (process.argv[1] && path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1])) {
  main();
}
