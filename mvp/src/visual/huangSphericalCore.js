import * as THREE from "../../vendor/three.module.min.js";

const PI = Math.PI;
const TWO_PI = Math.PI * 2;
const FIXED_DT = 1 / 30;
const MAX_TICKS = 3;
const HUANG_SCENARIOS = new Set(["referenceFlow", "gravityDrainage", "marangoniPatch", "airflowShear"]);

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function fract(value) {
  return value - Math.floor(value);
}

function smoothstep(edge0, edge1, value) {
  const t = clamp((value - edge0) / Math.max(1e-6, edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function hash21(x, y, seed = 0) {
  return fract(Math.sin(x * 127.1 + y * 311.7 + seed * 19.19) * 43758.5453123);
}

function valueNoise(x, y, seed = 0) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash21(ix, iy, seed);
  const b = hash21(ix + 1, iy, seed);
  const c = hash21(ix, iy + 1, seed);
  const d = hash21(ix + 1, iy + 1, seed);
  return (a * (1 - ux) + b * ux) * (1 - uy) + (c * (1 - ux) + d * ux) * uy;
}

function fbm(x, y, seed = 0) {
  let value = 0;
  let amplitude = 0.5;
  let px = x;
  let py = y;
  for (let octave = 0; octave < 5; octave += 1) {
    value += valueNoise(px, py, seed + octave * 13.17) * amplitude;
    const nx = px * 1.57 + py * 1.18 + 0.17;
    const ny = -px * 1.18 + py * 1.57 + 0.23;
    px = nx;
    py = ny;
    amplitude *= 0.52;
  }
  return value;
}

function encode01(value) {
  return clamp(Math.round(value * 255), 0, 255);
}

function encodeSigned(value, scale = 1) {
  return encode01(0.5 + value * scale);
}

function normalizeUv(u, v) {
  let x = u;
  let y = v;
  if (y < 0) {
    y = -y;
    x += 0.5;
  }
  if (y > 1) {
    y = 2 - y;
    x += 0.5;
  }
  return [fract(x), clamp(y, 0.0001, 0.9999)];
}

function createByteTexture(bytes, size) {
  const texture = new THREE.DataTexture(bytes, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = false;
  if ("NoColorSpace" in THREE) texture.colorSpace = THREE.NoColorSpace;
  return texture;
}

function normalizeSize(size) {
  const rounded = Math.round(Number.isFinite(size) ? size : 192);
  return clamp(Math.round(rounded / 32) * 32, 64, 512);
}

function normalizeScenario(value) {
  return HUANG_SCENARIOS.has(value) ? value : "referenceFlow";
}

function periodicDelta(a, b) {
  const d = Math.abs(a - b);
  return Math.min(d, 1 - d);
}

function minmod(a, b) {
  if (a * b <= 0) return 0;
  return Math.sign(a) * Math.min(Math.abs(a), Math.abs(b));
}

function dot3(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function basisFromUv(u, v) {
  const uv = normalizeUv(u, v);
  const theta = uv[1] * PI;
  const phi = uv[0] * TWO_PI;
  const sinTheta = Math.sin(theta);
  const cosTheta = Math.cos(theta);
  const sinPhi = Math.sin(phi);
  const cosPhi = Math.cos(phi);
  return {
    ePhi: [-sinPhi, cosPhi, 0],
    eTheta: [cosTheta * cosPhi, cosTheta * sinPhi, -sinTheta],
  };
}

export function createHuangSphericalCore(options = {}) {
  let size = normalizeSize(options.size || 192);
  let seed = Number.isFinite(options.seed) ? options.seed : 417.29;
  let simTime = 0;
  let lastTime = 0;
  let accumulator = 0;
  let needsPrewarm = true;
  let stepCount = 0;
  let initialEtaMass = 1;
  let lastDiagnostics = null;
  let lastProjection = { initialResidual: 0, finalResidual: 0, iterations: 0 };
  let activeScenario = normalizeScenario(options.scenario || "referenceFlow");
  let lastScenarioSettings = null;

  const state = {};

  function scenarioSettings(config = {}, pressure = 0) {
    const base = {
      gravity: config.filmGravity ?? 0.72,
      viscosity: config.filmViscosity ?? 0.35,
      marangoni: config.filmMarangoniStrength ?? 0.72,
      diffusion: config.filmDiffusionAmount ?? 0.24,
      flowSpeed: config.filmFlowSpeed ?? 0.46,
      flowDirection: ((config.filmFlowDirection ?? 92) * PI) / 180,
      dragStrength: 0.28 + (config.windBase ?? 0.68) * 0.16 + pressure * 0.12,
      sourceAmount: config.filmSourceAmount ?? 0.36,
      evaporation: 1,
      foamGain: 0.016,
      phaseGain: 0.052,
      marangoniForceScale: 0.055,
    };

    if (activeScenario === "gravityDrainage") {
      return {
        ...base,
        gravity: Math.max(base.gravity, 0.95),
        marangoni: Math.min(base.marangoni, 0.16),
        diffusion: Math.max(base.diffusion, 0.16),
        flowSpeed: 0,
        dragStrength: 0.035,
        sourceAmount: 0.04,
        evaporation: 0.65,
        foamGain: 0.004,
        phaseGain: 0.026,
      };
    }

    if (activeScenario === "marangoniPatch") {
      return {
        ...base,
        gravity: 0,
        marangoni: Math.max(base.marangoni, 1.25),
        diffusion: 0.04,
        flowSpeed: 0,
        dragStrength: 0.018,
        sourceAmount: 0,
        evaporation: 0.18,
        foamGain: 0.008,
        phaseGain: 0.034,
        marangoniForceScale: 0.075,
      };
    }

    if (activeScenario === "airflowShear") {
      return {
        ...base,
        gravity: Math.min(base.gravity, 0.22),
        marangoni: Math.max(base.marangoni, 0.38),
        diffusion: Math.max(base.diffusion, 0.18),
        flowSpeed: Math.max(base.flowSpeed, 0.92),
        dragStrength: Math.max(base.dragStrength, 0.62),
        sourceAmount: 0.12,
        evaporation: 0.42,
        foamGain: 0.012,
        phaseGain: 0.044,
      };
    }

    return {
      ...base,
      gravity: Math.min(base.gravity, 0.24),
      marangoni: Math.max(base.marangoni, 1.25),
      diffusion: Math.min(base.diffusion, 0.16),
      flowSpeed: Math.max(base.flowSpeed, 0.82),
      flowDirection: Number.isFinite(config.filmFlowDirection) ? base.flowDirection : (28 * PI) / 180,
      dragStrength: Math.max(base.dragStrength, 0.58),
      sourceAmount: Math.min(base.sourceAmount, 0.22),
      evaporation: 0.42,
      foamGain: 0.014,
      phaseGain: 0.05,
      marangoniForceScale: 0.078,
    };
  }

  function allocate() {
    const count = size * size;
    state.eta = new Float32Array(count);
    state.gamma = new Float32Array(count);
    state.uPhi = new Float32Array(count);
    state.uTheta = new Float32Array(count);
    state.uPhiFace = new Float32Array(count);
    state.uThetaFace = new Float32Array((size + 1) * size);
    state.phase = new Float32Array(count);
    state.foam = new Float32Array(count);
    state.frontDistance = new Float32Array(count);
    state.frontOccupancy = new Float32Array(count);
    state.frontAge = new Float32Array(count);
    state.frontSideReject = new Float32Array(count);
    state.mapBackU = new Float32Array(count);
    state.mapBackV = new Float32Array(count);
    state.mapForwardU = new Float32Array(count);
    state.mapForwardV = new Float32Array(count);
    state.mapConfidence = new Float32Array(count);
    state.mapReject = new Float32Array(count);
    state.materialResidual = new Float32Array(count);
    state.alongContinuity = new Float32Array(count);
    state.divergence = new Float32Array(count);
    state.centeredDivergence = new Float32Array(count);
    state.staggeredDivergenceDelta = new Float32Array(count);
    state.gradGamma = new Float32Array(count);
    state.shear = new Float32Array(count);
    state.curvature = new Float32Array(count);
    state.gammaCandidate = new Float32Array(count);
    state.gammaResidual = new Float32Array(count);

    state.tmpEta = new Float32Array(count);
    state.tmpGamma = new Float32Array(count);
    state.tmpUPhi = new Float32Array(count);
    state.tmpUTheta = new Float32Array(count);
    state.tmpUPhiFace = new Float32Array(count);
    state.tmpUThetaFace = new Float32Array((size + 1) * size);
    state.tmpPhase = new Float32Array(count);
    state.tmpFoam = new Float32Array(count);
    state.gammaRhs = new Float32Array(count);
    state.solveA = new Float32Array(count);
    state.solveB = new Float32Array(count);

    state.fieldBytes = new Uint8Array(count * 4);
    state.velocityBytes = new Uint8Array(count * 4);
    state.etaGammaVelocityBytes = new Uint8Array(count * 4);
    state.gammaResidualBytes = new Uint8Array(count * 4);
    state.gammaCandidateBytes = new Uint8Array(count * 4);
    state.huangLocalBytes = new Uint8Array(count * 4);
    state.mapBytes = new Uint8Array(count * 4);
    state.forwardMapBytes = new Uint8Array(count * 4);
    state.residualBytes = new Uint8Array(count * 4);
    state.frontBytes = new Uint8Array(count * 4);
    state.phaseAreaBytes = new Uint8Array(count * 4);
    state.phaseAreaDiagnosticBytes = new Uint8Array(count * 4);
    state.phaseAreaSkeletonBytes = new Uint8Array(count * 4);
    state.filamentBytes = new Uint8Array(count * 4);
    state.supportBytes = new Uint8Array(count * 4);
    state.flowBytes = new Uint8Array(count * 4);

    state.fieldTexture = createByteTexture(state.fieldBytes, size);
    state.velocityTexture = createByteTexture(state.velocityBytes, size);
    state.etaGammaVelocityTexture = createByteTexture(state.etaGammaVelocityBytes, size);
    state.gammaResidualTexture = createByteTexture(state.gammaResidualBytes, size);
    state.gammaCandidateTexture = createByteTexture(state.gammaCandidateBytes, size);
    state.huangLocalTexture = createByteTexture(state.huangLocalBytes, size);
    state.mapTexture = createByteTexture(state.mapBytes, size);
    state.forwardMapTexture = createByteTexture(state.forwardMapBytes, size);
    state.residualTexture = createByteTexture(state.residualBytes, size);
    state.frontTexture = createByteTexture(state.frontBytes, size);
    state.phaseAreaTexture = createByteTexture(state.phaseAreaBytes, size);
    state.phaseAreaDiagnosticTexture = createByteTexture(state.phaseAreaDiagnosticBytes, size);
    state.phaseAreaSkeletonTexture = createByteTexture(state.phaseAreaSkeletonBytes, size);
    state.filamentTexture = createByteTexture(state.filamentBytes, size);
    state.supportTexture = createByteTexture(state.supportBytes, size);
    state.flowTexture = createByteTexture(state.flowBytes, size);
  }

  function disposeTextures() {
    [
      state.fieldTexture,
      state.velocityTexture,
      state.etaGammaVelocityTexture,
      state.gammaResidualTexture,
      state.gammaCandidateTexture,
      state.huangLocalTexture,
      state.mapTexture,
      state.forwardMapTexture,
      state.residualTexture,
      state.frontTexture,
      state.phaseAreaTexture,
      state.phaseAreaDiagnosticTexture,
      state.phaseAreaSkeletonTexture,
      state.filamentTexture,
      state.supportTexture,
      state.flowTexture,
    ].forEach((texture) => texture?.dispose?.());
  }

  function index(x, y) {
    let xx = x;
    let yy = y;
    if (yy < 0) {
      yy = -yy - 1;
      xx += Math.floor(size / 2);
    }
    if (yy >= size) {
      yy = size - (yy - size) - 1;
      xx += Math.floor(size / 2);
    }
    xx = ((xx % size) + size) % size;
    yy = clamp(yy, 0, size - 1);
    return yy * size + xx;
  }

  function indexPhiFace(xFace, y) {
    const xx = ((xFace % size) + size) % size;
    const yy = clamp(y, 0, size - 1);
    return yy * size + xx;
  }

  function indexThetaFace(x, yFace) {
    const xx = ((x % size) + size) % size;
    const yy = clamp(yFace, 0, size);
    return yy * size + xx;
  }

  function sample(array, u, v) {
    const normalized = normalizeUv(u, v);
    const x = normalized[0] * size - 0.5;
    const y = normalized[1] * size - 0.5;
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const tx = x - x0;
    const ty = y - y0;
    const a = array[index(x0, y0)];
    const b = array[index(x0 + 1, y0)];
    const c = array[index(x0, y0 + 1)];
    const d = array[index(x0 + 1, y0 + 1)];
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
  }

  function thetaAt(y) {
    return ((y + 0.5) / size) * PI;
  }

  function sinThetaAtY(y) {
    return Math.max(0.075, Math.sin(thetaAt(clamp(y, 0, size - 1))));
  }

  function sinThetaAtFace(yFace) {
    return Math.max(0.075, Math.sin(clamp(yFace / size, 0, 1) * PI));
  }

  function sphericalWeights(y) {
    const sinC = sinThetaAtY(y);
    const sinD = sinThetaAtY(y - 1);
    const sinU = sinThetaAtY(y + 1);
    const invDphi = size / TWO_PI;
    const invDtheta = size / PI;
    const wPhi = (invDphi * invDphi) / (sinC * sinC);
    const wDown = (sinD * invDtheta * invDtheta) / sinC;
    const wUp = (sinU * invDtheta * invDtheta) / sinC;
    return [wPhi, wDown, wUp];
  }

  function centeredGradient(array, x, y) {
    const left = array[index(x - 1, y)];
    const right = array[index(x + 1, y)];
    const down = array[index(x, y - 1)];
    const up = array[index(x, y + 1)];
    const sinC = sinThetaAtY(y);
    const dPhi = ((right - left) * 0.5 * size) / (TWO_PI * sinC);
    const dTheta = ((up - down) * 0.5 * size) / PI;
    return [dPhi, dTheta];
  }

  function gradient(array, x, y) {
    const center = array[index(x, y)];
    const left = array[index(x - 1, y)];
    const right = array[index(x + 1, y)];
    const down = array[index(x, y - 1)];
    const up = array[index(x, y + 1)];
    const sinC = sinThetaAtY(y);
    const invPhi = size / (TWO_PI * sinC);
    const invTheta = size / PI;
    const central = centeredGradient(array, x, y);
    const limitedPhi = minmod((center - left) * invPhi, (right - center) * invPhi);
    const limitedTheta = minmod((center - down) * invTheta, (up - center) * invTheta);
    return [
      central[0] * 0.68 + limitedPhi * 0.32,
      central[1] * 0.68 + limitedTheta * 0.32,
    ];
  }

  function laplacian(array, x, y) {
    const center = array[index(x, y)];
    const left = array[index(x - 1, y)];
    const right = array[index(x + 1, y)];
    const down = array[index(x, y - 1)];
    const up = array[index(x, y + 1)];
    const [wPhi, wDown, wUp] = sphericalWeights(y);
    return wPhi * (left + right - center * 2) + wDown * (down - center) + wUp * (up - center);
  }

  function centeredDivergence(uPhi, uTheta, x, y) {
    const sinC = sinThetaAtY(y);
    const sinD = sinThetaAtY(y - 1);
    const sinU = sinThetaAtY(y + 1);
    const dPhi = ((uPhi[index(x + 1, y)] - uPhi[index(x - 1, y)]) * 0.5 * size) / TWO_PI;
    const dTheta =
      ((sinU * uTheta[index(x, y + 1)] - sinD * uTheta[index(x, y - 1)]) * 0.5 * size) / PI;
    return (dPhi + dTheta) / sinC;
  }

  function divergence(uPhi, uTheta, x, y) {
    const sinC = sinThetaAtY(y);
    const phiRight = 0.5 * (uPhi[index(x, y)] + uPhi[index(x + 1, y)]);
    const phiLeft = 0.5 * (uPhi[index(x - 1, y)] + uPhi[index(x, y)]);
    const thetaUp = 0.5 * (uTheta[index(x, y)] + uTheta[index(x, y + 1)]);
    const thetaDown = 0.5 * (uTheta[index(x, y - 1)] + uTheta[index(x, y)]);
    const dPhi = ((phiRight - phiLeft) * size) / TWO_PI;
    const dTheta = ((sinThetaAtFace(y + 1) * thetaUp - sinThetaAtFace(y) * thetaDown) * size) / PI;
    return (dPhi + dTheta) / sinC;
  }

  function rebuildFaceVelocitiesFromCenters(sourcePhi, sourceTheta, targetPhiFace, targetThetaFace) {
    for (let y = 0; y < size; y += 1) {
      for (let xFace = 0; xFace < size; xFace += 1) {
        targetPhiFace[indexPhiFace(xFace, y)] =
          0.5 * (sourcePhi[index(xFace - 1, y)] + sourcePhi[index(xFace, y)]);
      }
    }
    for (let x = 0; x < size; x += 1) {
      targetThetaFace[indexThetaFace(x, 0)] = 0;
      targetThetaFace[indexThetaFace(x, size)] = 0;
    }
    for (let yFace = 1; yFace < size; yFace += 1) {
      for (let x = 0; x < size; x += 1) {
        targetThetaFace[indexThetaFace(x, yFace)] =
          0.5 * (sourceTheta[index(x, yFace - 1)] + sourceTheta[index(x, yFace)]);
      }
    }
  }

  function syncCenterVelocitiesFromFaces(phiFace, thetaFace, targetPhi, targetTheta) {
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const i = index(x, y);
        targetPhi[i] = 0.5 * (phiFace[indexPhiFace(x, y)] + phiFace[indexPhiFace(x + 1, y)]);
        targetTheta[i] = 0.5 * (thetaFace[indexThetaFace(x, y)] + thetaFace[indexThetaFace(x, y + 1)]);
      }
    }
  }

  function divergenceFromFaces(phiFace, thetaFace, x, y) {
    const sinC = sinThetaAtY(y);
    const dPhi = ((phiFace[indexPhiFace(x + 1, y)] - phiFace[indexPhiFace(x, y)]) * size) / TWO_PI;
    const dTheta =
      ((sinThetaAtFace(y + 1) * thetaFace[indexThetaFace(x, y + 1)] -
        sinThetaAtFace(y) * thetaFace[indexThetaFace(x, y)]) *
        size) /
      PI;
    return (dPhi + dTheta) / sinC;
  }

  function etaFluxDivergence(phiFace, thetaFace, etaField, x, y) {
    const sinC = sinThetaAtY(y);
    const center = etaField[index(x, y)];
    const etaRight = 0.5 * (center + etaField[index(x + 1, y)]);
    const etaLeft = 0.5 * (etaField[index(x - 1, y)] + center);
    const etaUp = y + 1 >= size ? 0 : 0.5 * (center + etaField[index(x, y + 1)]);
    const etaDown = y <= 0 ? 0 : 0.5 * (etaField[index(x, y - 1)] + center);
    const phiFluxRight = etaRight * phiFace[indexPhiFace(x + 1, y)];
    const phiFluxLeft = etaLeft * phiFace[indexPhiFace(x, y)];
    const thetaFluxUp = etaUp * thetaFace[indexThetaFace(x, y + 1)];
    const thetaFluxDown = etaDown * thetaFace[indexThetaFace(x, y)];
    const dPhi = ((phiFluxRight - phiFluxLeft) * size) / TWO_PI;
    const dTheta =
      ((sinThetaAtFace(y + 1) * thetaFluxUp - sinThetaAtFace(y) * thetaFluxDown) * size) / PI;
    return (dPhi + dTheta) / sinC;
  }

  function traceUv(u, v, uPhi, uTheta, dt, direction = -1) {
    const uv = normalizeUv(u, v);
    const y = clamp(Math.floor(uv[1] * size), 0, size - 1);
    const sinC = sinThetaAtY(y);
    const scale = 0.78;
    const du = (uPhi * dt * scale) / (TWO_PI * sinC);
    const dv = (uTheta * dt * scale) / PI;
    return normalizeUv(uv[0] + direction * du, uv[1] + direction * dv);
  }

  function backtraceUv(x, y, uPhi, uTheta, dt, direction = -1) {
    return traceUv((x + 0.5) / size, (y + 0.5) / size, uPhi, uTheta, dt, direction);
  }

  function uvDistance(aU, aV, bU, bV) {
    const a = normalizeUv(aU, aV);
    const b = normalizeUv(bU, bV);
    const meanSin = Math.max(0.075, Math.sin(((a[1] + b[1]) * 0.5) * PI));
    const du = periodicDelta(a[0], b[0]) * TWO_PI * meanSin;
    const dv = (a[1] - b[1]) * PI;
    return Math.hypot(du, dv);
  }

  function transportedVelocity(sourceU, sourceV, targetU, targetV, uPhi, uTheta) {
    const sourceBasis = basisFromUv(sourceU, sourceV);
    const targetBasis = basisFromUv(targetU, targetV);
    const vector = [
      sourceBasis.ePhi[0] * uPhi + sourceBasis.eTheta[0] * uTheta,
      sourceBasis.ePhi[1] * uPhi + sourceBasis.eTheta[1] * uTheta,
      sourceBasis.ePhi[2] * uPhi + sourceBasis.eTheta[2] * uTheta,
    ];
    return [
      clamp(dot3(vector, targetBasis.ePhi), -0.9, 0.9),
      clamp(dot3(vector, targetBasis.eTheta), -0.9, 0.9),
    ];
  }

  function bfeccSample(array, u, v, uvBack, uvRoundTrip, minValue, maxValue, maxCorrection) {
    const advected = sample(array, uvBack[0], uvBack[1]);
    const roundTripValue = sample(array, uvRoundTrip[0], uvRoundTrip[1]);
    const currentValue = sample(array, u, v);
    const error = currentValue - roundTripValue;
    const pairError = uvDistance(uvRoundTrip[0], uvRoundTrip[1], u, v);
    const correctionGate = 1 - smoothstep(0.015, 0.11, pairError);
    const correction = clamp(error * 0.5, -maxCorrection, maxCorrection) * correctionGate;
    return clamp(advected + correction, minValue, maxValue);
  }

  function initializeFields() {
    let etaMass = 0;
    for (let y = 0; y < size; y += 1) {
      const theta = thetaAt(y);
      const vertical = Math.cos(theta);
      const lower = smoothstep(-0.15, -0.95, vertical);
      const upperThin = smoothstep(0.1, 0.92, vertical);
      for (let x = 0; x < size; x += 1) {
        const i = index(x, y);
        const u = (x + 0.5) / size;
        const v = (y + 0.5) / size;
        const broad = fbm(u * 2.1, v * 2.8, seed);
        const medium = fbm(u * 6.3 + 3.1, v * 7.2 - 2.2, seed + 9.7);
        const fine = fbm(u * 22.0 - 4.4, v * 19.0 + 1.1, seed + 21.3);
        const patchA = Math.exp(
          -(
            (periodicDelta(u, 0.36) * periodicDelta(u, 0.36)) / 0.010 +
            ((v - 0.43) * (v - 0.43)) / 0.020
          ),
        );
        const patchB = Math.exp(
          -(
            (periodicDelta(u, 0.67) * periodicDelta(u, 0.67)) / 0.014 +
            ((v - 0.58) * (v - 0.58)) / 0.026
          ),
        );
        let eta;
        let gamma;
        let uPhi;
        let uTheta;
        let phase;

        if (activeScenario === "gravityDrainage") {
          eta = clamp(0.34 + lower * 0.3 - upperThin * 0.12 + (broad - 0.5) * 0.035 + (fine - 0.5) * 0.01, 0.08, 0.9);
          gamma = clamp(0.5 + (medium - 0.5) * 0.05, 0.24, 0.76);
          uPhi = (fbm(u * 2.6, v * 2.4, seed + 44.1) - 0.5) * 0.006;
          uTheta = 0.012 * Math.sin(theta) + (fbm(u * 3.1, v * 3.7, seed + 51.9) - 0.5) * 0.006;
          phase = clamp(0.045 + lower * 0.055 + (broad - 0.5) * 0.025, 0, 0.22);
        } else if (activeScenario === "marangoniPatch") {
          const gammaPatch = patchA * 0.58 + patchB * 0.34;
          eta = clamp(0.46 + (broad - 0.5) * 0.025 + (fine - 0.5) * 0.006, 0.28, 0.72);
          gamma = clamp(0.36 + gammaPatch + (medium - 0.5) * 0.035, 0.08, 0.95);
          uPhi = (fbm(u * 3.2, v * 3.1, seed + 44.1) - 0.5) * 0.004;
          uTheta = (fbm(u * 3.7, v * 3.4, seed + 51.9) - 0.5) * 0.004;
          phase = clamp(0.035 + gammaPatch * 0.09 + (broad - 0.5) * 0.018, 0, 0.24);
        } else if (activeScenario === "airflowShear") {
          const streamBand = Math.sin((u * 1.85 + v * 0.38) * TWO_PI);
          eta = clamp(0.43 + (medium - 0.5) * 0.055 + streamBand * 0.018 + lower * 0.04, 0.18, 0.78);
          gamma = clamp(0.47 + (broad - 0.5) * 0.12 - streamBand * 0.035, 0.16, 0.86);
          uPhi = 0.105 + (fbm(u * 3.1, v * 3.7, seed + 44.1) - 0.5) * 0.025;
          uTheta = 0.018 * Math.sin(theta) * Math.sin((u * 1.2 + 0.18) * TWO_PI);
          phase = clamp(0.055 + smoothstep(-0.4, 0.8, streamBand) * 0.07 + (broad - 0.5) * 0.02, 0, 0.28);
        } else {
          const obliqueA = Math.sin((u * 1.35 + v * 0.82 + 0.11) * TWO_PI);
          const obliqueB = Math.sin((u * -0.92 + v * 1.47 + 0.37) * TWO_PI);
          const patchC = Math.exp(
            -(
              (periodicDelta(u, 0.19) * periodicDelta(u, 0.19)) / 0.018 +
              ((v - 0.55) * (v - 0.55)) / 0.032
            ),
          );
          const patchD = Math.exp(
            -(
              (periodicDelta(u, 0.55) * periodicDelta(u, 0.55)) / 0.030 +
              ((v - 0.44) * (v - 0.44)) / 0.024
            ),
          );
          const patchE = Math.exp(
            -(
              (periodicDelta(u, 0.81) * periodicDelta(u, 0.81)) / 0.024 +
              ((v - 0.63) * (v - 0.63)) / 0.028
            ),
          );
          const materialDisturbance = patchA * 0.3 + patchB * 0.25 + patchC * 0.42 + patchD * 0.34 + patchE * 0.28;
          const anisotropicRidge = smoothstep(0.35, 0.98, obliqueA * 0.62 + obliqueB * 0.38);
          eta = clamp(
            0.43 +
              lower * 0.095 -
              upperThin * 0.045 +
              materialDisturbance * 0.18 +
              (broad - 0.5) * 0.07 +
              (medium - 0.5) * 0.04 +
              (fine - 0.5) * 0.012 -
              anisotropicRidge * 0.052,
            0.16,
            0.88,
          );
          gamma = clamp(
            0.5 +
              (medium - 0.5) * 0.13 -
              materialDisturbance * 0.16 +
              anisotropicRidge * 0.11 -
              lower * 0.035 +
              upperThin * 0.025,
            0.1,
            0.9,
          );
          uPhi =
            0.018 * Math.sin((v * 1.1 + 0.18) * PI) +
            (fbm(u * 3.8, v * 3.4, seed + 44.1) - 0.5) * 0.014;
          uTheta =
            0.018 * Math.sin(theta) * Math.sin((u * 1.55 + 0.23) * TWO_PI) +
            (fbm(u * 4.3, v * 4.7, seed + 51.9) - 0.5) * 0.014;
          phase = clamp(0.07 + materialDisturbance * 0.04 + (broad - 0.5) * 0.045 + upperThin * 0.035, 0, 0.3);
        }
        state.eta[i] = eta;
        state.gamma[i] = gamma;
        state.uPhi[i] = uPhi;
        state.uTheta[i] = uTheta;
        state.phase[i] = phase;
        state.foam[i] = 0;
        state.frontDistance[i] = 1;
        state.frontOccupancy[i] = 0;
        state.frontAge[i] = 0;
        state.frontSideReject[i] = 0;
        state.mapBackU[i] = u;
        state.mapBackV[i] = v;
        state.mapForwardU[i] = u;
        state.mapForwardV[i] = v;
        state.mapConfidence[i] = 1;
        state.mapReject[i] = 0;
        etaMass += eta * Math.sin(theta);
      }
    }
    rebuildFaceVelocitiesFromCenters(state.uPhi, state.uTheta, state.uPhiFace, state.uThetaFace);
    initialEtaMass = Math.max(1e-6, etaMass);
    simTime = 0;
    lastTime = 0;
    accumulator = 0;
    needsPrewarm = true;
    stepCount = 0;
    uploadTextures();
  }

  function advectScalars(dt) {
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const i = index(x, y);
        const u = (x + 0.5) / size;
        const v = (y + 0.5) / size;
        const uv = backtraceUv(x, y, state.uPhi[i], state.uTheta[i], dt, -1);
        const backUPhi = sample(state.uPhi, uv[0], uv[1]);
        const backUTheta = sample(state.uTheta, uv[0], uv[1]);
        const uvRoundTrip = traceUv(uv[0], uv[1], backUPhi, backUTheta, dt, 1);
        state.tmpEta[i] = bfeccSample(state.eta, u, v, uv, uvRoundTrip, 0.055, 0.95, 0.075);
        state.tmpGamma[i] = bfeccSample(state.gamma, u, v, uv, uvRoundTrip, 0.06, 0.94, 0.08);
        state.tmpPhase[i] = bfeccSample(state.phase, u, v, uv, uvRoundTrip, 0, 0.92, 0.12);
        state.tmpFoam[i] = bfeccSample(state.foam, u, v, uv, uvRoundTrip, 0, 0.95, 0.08);
        const transported = transportedVelocity(uv[0], uv[1], u, v, backUPhi, backUTheta);
        state.tmpUPhi[i] = transported[0];
        state.tmpUTheta[i] = transported[1];
      }
    }
    rebuildFaceVelocitiesFromCenters(state.tmpUPhi, state.tmpUTheta, state.tmpUPhiFace, state.tmpUThetaFace);
  }

  function solveGamma(dt, diffusion, marangoni) {
    const alpha = dt * (0.00002 + diffusion * 0.00012 + marangoni * 0.00008);
    let initialResidual = 0;
    let finalResidual = 0;
    const residualMean = (field) => {
      let sum = 0;
      for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
          const i = index(x, y);
          sum += Math.abs(field[i] - alpha * laplacian(field, x, y) - state.gammaRhs[i]);
        }
      }
      return sum / Math.max(1, field.length);
    };

    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const i = index(x, y);
        const divU = divergenceFromFaces(state.tmpUPhiFace, state.tmpUThetaFace, x, y);
        const divCentered = centeredDivergence(state.tmpUPhi, state.tmpUTheta, x, y);
        state.divergence[i] = divU;
        state.centeredDivergence[i] = divCentered;
        state.staggeredDivergenceDelta[i] = Math.abs(divU - divCentered);
        const safeDiv = clamp(divU * 0.28 + divCentered * 0.05, -2.6, 2.6);
        state.gammaRhs[i] = clamp(state.tmpGamma[i] * Math.exp(-dt * safeDiv), 0.06, 0.94);
        state.solveA[i] = state.gammaRhs[i];
        state.solveB[i] = state.gammaRhs[i];
      }
    }

    initialResidual = residualMean(state.solveB);
    const iterations = clamp(Math.round(18 + size / 20), 24, 48);
    for (let iter = 0; iter < iterations; iter += 1) {
      for (let y = 0; y < size; y += 1) {
        const [wPhi, wDown, wUp] = sphericalWeights(y);
        const denom = 1 + alpha * (wPhi * 2 + wDown + wUp);
        for (let x = 0; x < size; x += 1) {
          const i = index(x, y);
          const neighbor =
            wPhi * (state.solveB[index(x - 1, y)] + state.solveB[index(x + 1, y)]) +
            wDown * state.solveB[index(x, y - 1)] +
            wUp * state.solveB[index(x, y + 1)];
          const nextGamma = clamp((state.gammaRhs[i] + alpha * neighbor) / denom, 0.06, 0.94);
          state.solveA[i] = nextGamma;
        }
      }
      const swap = state.solveA;
      state.solveA = state.solveB;
      state.solveB = swap;
    }

    for (let i = 0; i < state.gamma.length; i += 1) {
      state.gammaCandidate[i] = state.solveB[i];
    }
    finalResidual = residualMean(state.solveB);
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const i = index(x, y);
        state.gammaResidual[i] = Math.abs(state.solveB[i] - alpha * laplacian(state.solveB, x, y) - state.gammaRhs[i]);
      }
    }
    lastProjection = { initialResidual, finalResidual, iterations };
  }

  function updateVelocityAndEta(dt, config, settings) {
    const gravity = settings.gravity;
    const viscosity = settings.viscosity;
    const marangoni = settings.marangoni;
    const flowSpeed = settings.flowSpeed;
    const flowDirection = settings.flowDirection;
    const dragStrength = settings.dragStrength;
    const marangoniScale = settings.marangoniForceScale ?? 0.055;
    const targetPhi = Math.cos(flowDirection) * flowSpeed * 0.24;
    const targetTheta = Math.sin(flowDirection) * flowSpeed * 0.18 + gravity * 0.02 * (flowSpeed > 0 ? 1 : 0);

    for (let y = 0; y < size; y += 1) {
      const sinC = sinThetaAtY(y);
      for (let xFace = 0; xFace < size; xFace += 1) {
        const face = indexPhiFace(xFace, y);
        const left = index(xFace - 1, y);
        const right = index(xFace, y);
        const eta = Math.max(0.08, 0.5 * (state.tmpEta[left] + state.tmpEta[right]));
        const gradPhi = ((state.gammaCandidate[right] - state.gammaCandidate[left]) * size) / (TWO_PI * sinC);
        const residual = 0.5 * (state.gammaResidual[left] + state.gammaResidual[right]);
        const compression = Math.max(0, -0.5 * (state.divergence[left] + state.divergence[right]));
        const projectionDamping = 1 / (1 + residual * 90 + compression * 0.055);
        const faceValue = state.tmpUPhiFace[face];
        const faceLap =
          state.tmpUPhiFace[indexPhiFace(xFace - 1, y)] +
          state.tmpUPhiFace[indexPhiFace(xFace + 1, y)] +
          state.tmpUPhiFace[indexPhiFace(xFace, y - 1)] +
          state.tmpUPhiFace[indexPhiFace(xFace, y + 1)] -
          faceValue * 4;
        const forcePhi =
          (-(marangoni / eta) * gradPhi * marangoniScale) * projectionDamping +
          (targetPhi - faceValue) * dragStrength / eta;
        const maxFaceSpeed = Math.min(0.9, (TWO_PI * sinC * 0.32) / (size * Math.max(1e-5, dt)));
        state.uPhiFace[face] = clamp(
          faceValue + dt * forcePhi + dt * viscosity * faceLap * 0.00005,
          -maxFaceSpeed,
          maxFaceSpeed,
        );
      }
    }

    for (let x = 0; x < size; x += 1) {
      state.uThetaFace[indexThetaFace(x, 0)] = 0;
      state.uThetaFace[indexThetaFace(x, size)] = 0;
    }
    for (let yFace = 1; yFace < size; yFace += 1) {
      const theta = (yFace / size) * PI;
      const gravityTheta = Math.sin(theta) * gravity * 0.12;
      for (let x = 0; x < size; x += 1) {
        const face = indexThetaFace(x, yFace);
        const down = index(x, yFace - 1);
        const up = index(x, yFace);
        const eta = Math.max(0.08, 0.5 * (state.tmpEta[down] + state.tmpEta[up]));
        const gradTheta = ((state.gammaCandidate[up] - state.gammaCandidate[down]) * size) / PI;
        const residual = 0.5 * (state.gammaResidual[down] + state.gammaResidual[up]);
        const compression = Math.max(0, -0.5 * (state.divergence[down] + state.divergence[up]));
        const projectionDamping = 1 / (1 + residual * 90 + compression * 0.055);
        const faceValue = state.tmpUThetaFace[face];
        const faceLap =
          state.tmpUThetaFace[indexThetaFace(x - 1, yFace)] +
          state.tmpUThetaFace[indexThetaFace(x + 1, yFace)] +
          state.tmpUThetaFace[indexThetaFace(x, yFace - 1)] +
          state.tmpUThetaFace[indexThetaFace(x, yFace + 1)] -
          faceValue * 4;
        const forceTheta =
          (-(marangoni / eta) * gradTheta * marangoniScale) * projectionDamping +
          gravityTheta +
          (targetTheta - faceValue) * dragStrength / eta;
        const maxFaceSpeed = Math.min(0.9, (PI * 0.32) / (size * Math.max(1e-5, dt)));
        state.uThetaFace[face] = clamp(
          faceValue + dt * forceTheta + dt * viscosity * faceLap * 0.00005,
          -maxFaceSpeed,
          maxFaceSpeed,
        );
      }
    }

    syncCenterVelocitiesFromFaces(state.uPhiFace, state.uThetaFace, state.uPhi, state.uTheta);

    for (let y = 0; y < size; y += 1) {
      const theta = thetaAt(y);
      for (let x = 0; x < size; x += 1) {
        const i = index(x, y);
        const divU = divergenceFromFaces(state.uPhiFace, state.uThetaFace, x, y);
        const divCentered = centeredDivergence(state.uPhi, state.uTheta, x, y);
        state.divergence[i] = divU;
        state.centeredDivergence[i] = divCentered;
        state.staggeredDivergenceDelta[i] = Math.abs(divU - divCentered);
      }
    }

    let etaMass = 0;
    for (let y = 0; y < size; y += 1) {
      const theta = thetaAt(y);
      for (let x = 0; x < size; x += 1) {
        const i = index(x, y);
        const fluxDiv = etaFluxDivergence(state.uPhiFace, state.uThetaFace, state.tmpEta, x, y);
        const stableDelta = clamp(-dt * fluxDiv, -state.tmpEta[i] * 0.1, state.tmpEta[i] * 0.1);
        const evaporation = settings.evaporation * 0.000018 * dt * (0.7 + smoothstep(0.0, 0.9, Math.cos(theta)));
        const source = settings.sourceAmount * 0.000018 * dt * smoothstep(-0.15, -0.95, Math.cos(theta));
        const etaNext = clamp(state.tmpEta[i] + stableDelta - evaporation + source, 0.055, 0.95);
        state.eta[i] = etaNext;
        etaMass += etaNext * Math.sin(theta);
      }
    }

    const massScale = clamp(initialEtaMass / Math.max(1e-6, etaMass), 0.985, 1.015);
    let correctedMass = 0;
    for (let y = 0; y < size; y += 1) {
      const theta = thetaAt(y);
      for (let x = 0; x < size; x += 1) {
        const i = index(x, y);
        state.eta[i] = clamp(state.eta[i] * massScale, 0.055, 0.95);
        correctedMass += state.eta[i] * Math.sin(theta);
      }
    }
    return (correctedMass - initialEtaMass) / initialEtaMass;
  }

  function updateDerivedFields(dt, massError, settings) {
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const i = index(x, y);
        const gradGamma = gradient(state.gamma, x, y);
        const gradEta = gradient(state.eta, x, y);
        const divU = state.divergence[i];
        const curvature = laplacian(state.eta, x, y);
        const duPhi = gradient(state.uPhi, x, y);
        const duTheta = gradient(state.uTheta, x, y);
        const shear = Math.hypot(duPhi[1], duTheta[0]) * 0.24;
        const compression = Math.max(0, -divU);
        const gradG = Math.hypot(gradGamma[0], gradGamma[1]);
        const gradH = Math.hypot(gradEta[0], gradEta[1]);
        const currentU = (x + 0.5) / size;
        const currentV = (y + 0.5) / size;
        const uvBack = backtraceUv(x, y, state.uPhi[i], state.uTheta[i], dt, -1);
        const backUPhi = sample(state.uPhi, uvBack[0], uvBack[1]);
        const backUTheta = sample(state.uTheta, uvBack[0], uvBack[1]);
        const uvRoundTrip = traceUv(uvBack[0], uvBack[1], backUPhi, backUTheta, dt, 1);
        const uvForward = traceUv(currentU, currentV, state.uPhi[i], state.uTheta[i], dt, 1);
        const pairError = uvDistance(uvRoundTrip[0], uvRoundTrip[1], currentU, currentV);
        const mapOk = 1 - smoothstep(0.018, 0.13, pairError);
        const physicalEvidence =
          smoothstep(0.004, 0.085, compression) * 0.34 +
          smoothstep(0.03, 0.42, gradG) * 0.32 +
          smoothstep(0.02, 0.35, Math.abs(curvature)) * 0.18 +
          smoothstep(0.02, 0.22, shear) * 0.16;
        const narrowEvidence = clamp(physicalEvidence * (1 - smoothstep(0.13, 0.44, gradH)) * mapOk, 0, 1);
        const previousAge = sample(state.frontAge, uvBack[0], uvBack[1]);
        const previousOcc = sample(state.frontOccupancy, uvBack[0], uvBack[1]);
        const frontOcc = clamp(narrowEvidence * 0.86 + previousOcc * 0.14, 0, 1);
        const frontAge = clamp(previousAge * 0.965 + frontOcc * 0.075, 0, 1);
        const sideReject = clamp(smoothstep(0.2, 0.7, gradH + pairError * 0.8) * (1 - frontOcc * 0.45), 0, 1);
        const lineDistance = clamp(1 - frontOcc * 0.82 - frontAge * 0.14, 0, 1);
        const phaseAdv = sample(state.phase, uvBack[0], uvBack[1]);
        const foamAdv = sample(state.foam, uvBack[0], uvBack[1]);
        const phaseSupport = clamp(frontOcc * 1.35 + smoothstep(0.16, 0.5, gradG) * 0.32 + compression * 0.018, 0, 1);
        const phase = clamp(
          phaseAdv * (0.888 + phaseSupport * 0.07) +
            frontOcc * settings.phaseGain +
            smoothstep(0.24, 0.55, gradG) * compression * 0.018,
          0,
          0.92,
        );
        const foamSource = clamp(
          (smoothstep(0.05, 0.32, shear) * 0.45 + smoothstep(0.08, 0.5, gradG) * 0.36 + frontOcc * 0.28) *
            (1 - sideReject) *
            (0.6 + (massError < 0 ? 0.2 : 0)),
          0,
          1,
        );
        const localizedFoam = foamSource * smoothstep(0.16, 0.58, frontOcc + gradG * 0.35 + shear * 0.55);
        const foam = clamp(foamAdv * (0.962 - dt * 0.32) + localizedFoam * settings.foamGain, 0, 0.95);

        state.gamma[i] = state.gammaCandidate[i];
        state.phase[i] = phase;
        state.foam[i] = foam;
        state.frontDistance[i] = lineDistance;
        state.frontOccupancy[i] = frontOcc;
        state.frontAge[i] = frontAge;
        state.frontSideReject[i] = sideReject;
        state.mapBackU[i] = uvBack[0];
        state.mapBackV[i] = uvBack[1];
        state.mapForwardU[i] = uvForward[0];
        state.mapForwardV[i] = uvForward[1];
        state.mapReject[i] = clamp(pairError * 6.5, 0, 1);
        state.mapConfidence[i] = 1 - state.mapReject[i];
        state.materialResidual[i] = clamp(narrowEvidence * state.mapConfidence[i], 0, 1);
        state.alongContinuity[i] = clamp(frontAge * (1 - sideReject) + frontOcc * 0.2, 0, 1);
        state.gradGamma[i] = gradG;
        state.shear[i] = shear;
        state.curvature[i] = curvature;
      }
    }
  }

  function simulationStep(dt, config, pressure) {
    simTime += dt;
    const settings = scenarioSettings(config, pressure);
    lastScenarioSettings = settings;
    advectScalars(dt);
    solveGamma(dt, settings.diffusion, settings.marangoni);
    const massError = updateVelocityAndEta(dt, config, settings);
    updateDerivedFields(dt, massError, settings);
    stepCount += 1;
    lastDiagnostics = null;
  }

  function markNeedsUpdate() {
    [
      state.fieldTexture,
      state.velocityTexture,
      state.etaGammaVelocityTexture,
      state.gammaResidualTexture,
      state.gammaCandidateTexture,
      state.huangLocalTexture,
      state.mapTexture,
      state.forwardMapTexture,
      state.residualTexture,
      state.frontTexture,
      state.phaseAreaTexture,
      state.phaseAreaDiagnosticTexture,
      state.phaseAreaSkeletonTexture,
      state.filamentTexture,
      state.supportTexture,
      state.flowTexture,
    ].forEach((texture) => {
      texture.needsUpdate = true;
    });
  }

  function uploadTextures() {
    for (let i = 0; i < state.eta.length; i += 1) {
      const p = i * 4;
      const eta = state.eta[i];
      const gamma = state.gamma[i];
      const foam = state.foam[i];
      const phase = state.phase[i];
      const uPhi = state.uPhi[i];
      const uTheta = state.uTheta[i];
      const speed = Math.hypot(uPhi, uTheta);
      const divU = state.divergence[i] || 0;
      const compression = Math.max(0, -divU);
      const gradG = state.gradGamma[i] || 0;
      const marangoniGate = smoothstep(0.04, 0.45, gradG) * smoothstep(0.003, 0.08, compression);
      const narrowGate = state.frontOccupancy[i] * (1 - state.frontSideReject[i]);
      const broadSheet = smoothstep(0.16, 0.56, phase) * smoothstep(0.18, 0.78, state.frontSideReject[i]);
      const dropletEdge = foam * smoothstep(0.12, 0.58, gradG + state.shear[i]);

      state.fieldBytes[p] = encode01(eta);
      state.fieldBytes[p + 1] = encode01(gamma);
      state.fieldBytes[p + 2] = encode01(foam);
      state.fieldBytes[p + 3] = encode01(phase);

      state.velocityBytes[p] = encodeSigned(uPhi, 1.7);
      state.velocityBytes[p + 1] = encodeSigned(uTheta, 1.7);
      state.velocityBytes[p + 2] = encodeSigned(divU, 3.0);
      state.velocityBytes[p + 3] = 255;

      state.etaGammaVelocityBytes[p] = encode01(eta);
      state.etaGammaVelocityBytes[p + 1] = encode01(gamma);
      state.etaGammaVelocityBytes[p + 2] = encode01(speed * 2.0);
      state.etaGammaVelocityBytes[p + 3] = encodeSigned(divU, 2.8);

      state.gammaResidualBytes[p] = encode01(compression * 8.0);
      state.gammaResidualBytes[p + 1] = encode01(gradG * 2.6);
      state.gammaResidualBytes[p + 2] = encode01((state.gammaResidual[i] || 0) * 12.0);
      state.gammaResidualBytes[p + 3] = encode01(Math.abs(divU * eta) * 7.0);

      state.gammaCandidateBytes[p] = encode01(state.gammaCandidate[i] || gamma);
      state.gammaCandidateBytes[p + 1] = encodeSigned(divU, 8.0);
      state.gammaCandidateBytes[p + 2] = encodeSigned((state.gammaResidual[i] || 0) - lastProjection.finalResidual, 18.0);
      state.gammaCandidateBytes[p + 3] = encode01(Math.abs((state.gammaCandidate[i] || gamma) - gamma) * 70.0);

      state.huangLocalBytes[p] = encode01(compression * 8.0);
      state.huangLocalBytes[p + 1] = encode01(gradG * 2.5);
      state.huangLocalBytes[p + 2] = encode01(marangoniGate);
      state.huangLocalBytes[p + 3] = encode01(narrowGate);

      state.mapBytes[p] = encode01(state.mapBackU[i]);
      state.mapBytes[p + 1] = encode01(state.mapBackV[i]);
      state.mapBytes[p + 2] = encode01(state.mapConfidence[i]);
      state.mapBytes[p + 3] = encode01(state.mapReject[i]);

      state.forwardMapBytes[p] = encode01(state.mapForwardU[i]);
      state.forwardMapBytes[p + 1] = encode01(state.mapForwardV[i]);
      state.forwardMapBytes[p + 2] = encode01(state.mapConfidence[i]);
      state.forwardMapBytes[p + 3] = encode01(state.mapReject[i]);

      state.residualBytes[p] = encode01(state.materialResidual[i]);
      state.residualBytes[p + 1] = encode01(state.alongContinuity[i]);
      state.residualBytes[p + 2] = encode01(state.frontAge[i]);
      state.residualBytes[p + 3] = encode01(state.frontSideReject[i] + state.mapReject[i] * 0.35);

      state.frontBytes[p] = encode01(state.frontDistance[i]);
      state.frontBytes[p + 1] = encode01(state.frontOccupancy[i]);
      state.frontBytes[p + 2] = encode01(state.frontAge[i]);
      state.frontBytes[p + 3] = encode01(state.frontSideReject[i]);

      state.phaseAreaBytes[p] = encode01(state.frontOccupancy[i]);
      state.phaseAreaBytes[p + 1] = encode01(phase);
      state.phaseAreaBytes[p + 2] = encode01(foam);
      state.phaseAreaBytes[p + 3] = encode01(broadSheet);

      state.phaseAreaDiagnosticBytes[p] = encode01(state.materialResidual[i]);
      state.phaseAreaDiagnosticBytes[p + 1] = encode01(narrowGate);
      state.phaseAreaDiagnosticBytes[p + 2] = encode01(broadSheet);
      state.phaseAreaDiagnosticBytes[p + 3] = encode01(Math.max(0, 0.16 - phase) + Math.max(0, foam - 0.18));

      state.phaseAreaSkeletonBytes[p] = encode01(narrowGate * 0.8 + state.materialResidual[i] * 0.2);
      state.phaseAreaSkeletonBytes[p + 1] = encode01(state.frontOccupancy[i] * (1 - state.frontSideReject[i]));
      state.phaseAreaSkeletonBytes[p + 2] = encode01(1 - broadSheet);
      state.phaseAreaSkeletonBytes[p + 3] = encode01(phase);

      state.filamentBytes[p] = encode01(narrowGate);
      state.filamentBytes[p + 1] = encode01(state.frontAge[i]);
      state.filamentBytes[p + 2] = encode01(dropletEdge);
      state.filamentBytes[p + 3] = encode01(state.frontSideReject[i]);

      state.supportBytes[p] = encode01(phase);
      state.supportBytes[p + 1] = encode01(narrowGate);
      state.supportBytes[p + 2] = encode01(state.materialResidual[i]);
      state.supportBytes[p + 3] = encode01(broadSheet);

      state.flowBytes[p] = encodeSigned(uPhi, 1.7);
      state.flowBytes[p + 1] = encodeSigned(uTheta, 1.7);
      state.flowBytes[p + 2] = encode01(speed * 2.0);
      state.flowBytes[p + 3] = encode01(compression * 8.0);
    }
    markNeedsUpdate();
  }

  function resize(nextSize) {
    const normalized = normalizeSize(nextSize);
    if (normalized === size) return;
    disposeTextures();
    size = normalized;
    allocate();
    initializeFields();
  }

  function update(timeSeconds, config = {}, pressure = 0) {
    const nextScenario = normalizeScenario(config.filmHuangScenario || "referenceFlow");
    if (nextScenario !== activeScenario) {
      activeScenario = nextScenario;
      initializeFields();
    }
    resize(config.filmSimResolution ?? size);
    if (needsPrewarm) {
      const warmupSteps = Math.max(0, Math.min(480, Math.round(config.filmPrewarmSteps ?? 96)));
      const warmupSubsteps = Math.max(1, Math.min(24, Math.round(config.filmSubsteps ?? 8)));
      const warmupDt = FIXED_DT / warmupSubsteps;
      for (let warmup = 0; warmup < warmupSteps; warmup += 1) {
        for (let substep = 0; substep < warmupSubsteps; substep += 1) {
          simulationStep(warmupDt, config, pressure);
        }
      }
      needsPrewarm = false;
      accumulator = 0;
    }

    const currentTime = Number.isFinite(timeSeconds) ? timeSeconds : 0;
    const frameDelta = lastTime ? clamp(currentTime - lastTime, 0, 0.25) : FIXED_DT;
    lastTime = currentTime;
    accumulator += frameDelta;
    const ticks = Math.min(MAX_TICKS, Math.floor(accumulator / FIXED_DT));
    if (ticks <= 0) {
      uploadTextures();
      return;
    }
    const substeps = Math.max(1, Math.min(24, Math.round(config.filmSubsteps ?? 8)));
    const dt = FIXED_DT / substeps;
    for (let tick = 0; tick < ticks; tick += 1) {
      for (let substep = 0; substep < substeps; substep += 1) {
        simulationStep(dt, config, pressure);
      }
    }
    accumulator = Math.max(0, accumulator - ticks * FIXED_DT);
    uploadTextures();
  }

  function stat(array, predicate = null) {
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    let sum = 0;
    let hits = 0;
    for (let i = 0; i < array.length; i += 1) {
      const value = array[i];
      min = Math.min(min, value);
      max = Math.max(max, value);
      sum += value;
      if (predicate?.(value)) hits += 1;
    }
    return {
      min: Math.round(min * 10000) / 10000,
      max: Math.round(max * 10000) / 10000,
      mean: Math.round((sum / Math.max(1, array.length)) * 10000) / 10000,
      aboveFraction: Math.round((hits / Math.max(1, array.length)) * 10000) / 10000,
    };
  }

  function diagnostics() {
    if (lastDiagnostics) return lastDiagnostics;
    let mass = 0;
    let speedSum = 0;
    let speedActive = 0;
    let northEta = 0;
    let southEta = 0;
    let northWeight = 0;
    let southWeight = 0;
    let marangoniDot = 0;
    let marangoniWeight = 0;
    let airflowDot = 0;
    let airflowWeight = 0;
    let compressionSum = 0;
    const settings = lastScenarioSettings || scenarioSettings({}, 0);
    const targetPhi = Math.cos(settings.flowDirection) * settings.flowSpeed * 0.24;
    const targetTheta = Math.sin(settings.flowDirection) * settings.flowSpeed * 0.18;
    const targetSpeed = Math.hypot(targetPhi, targetTheta);
    for (let y = 0; y < size; y += 1) {
      const theta = thetaAt(y);
      const vertical = Math.cos(theta);
      const weight = Math.sin(theta);
      for (let x = 0; x < size; x += 1) {
        const i = index(x, y);
        mass += state.eta[i] * weight;
        if (vertical > 0.12) {
          northEta += state.eta[i] * weight;
          northWeight += weight;
        } else if (vertical < -0.12) {
          southEta += state.eta[i] * weight;
          southWeight += weight;
        }
        const speed = Math.hypot(state.uPhi[i], state.uTheta[i]);
        speedSum += speed;
        if (speed > 0.05) speedActive += 1;
        const grad = gradient(state.gamma, x, y);
        const gradMagnitude = Math.hypot(grad[0], grad[1]);
        if (speed > 1e-5 && gradMagnitude > 1e-5) {
          marangoniDot += ((state.uPhi[i] * -grad[0] + state.uTheta[i] * -grad[1]) / (speed * gradMagnitude)) * gradMagnitude;
          marangoniWeight += gradMagnitude;
        }
        if (speed > 1e-5 && targetSpeed > 1e-5) {
          airflowDot += (state.uPhi[i] * targetPhi + state.uTheta[i] * targetTheta) / (speed * targetSpeed);
          airflowWeight += 1;
        }
        compressionSum += Math.max(0, -state.divergence[i]);
      }
    }
    const count = Math.max(1, size * size);
    const northEtaMean = northEta / Math.max(1e-6, northWeight);
    const southEtaMean = southEta / Math.max(1e-6, southWeight);
    lastDiagnostics = {
      solver: "huangCore",
      scenario: activeScenario,
      size,
      step: stepCount,
      dt: FIXED_DT,
      massError: Math.round(((mass - initialEtaMass) / initialEtaMass) * 100000) / 100000,
      projectionResidual: {
        initial: Math.round(lastProjection.initialResidual * 1000000) / 1000000,
        final: Math.round(lastProjection.finalResidual * 1000000) / 1000000,
        ratio:
          Math.round(
            (lastProjection.finalResidual / Math.max(1e-8, lastProjection.initialResidual)) * 10000,
          ) / 10000,
        iterations: lastProjection.iterations,
      },
      eta: {
        ...stat(state.eta, (v) => v > 0.62),
        thickFraction: stat(state.eta, (v) => v > 0.62).aboveFraction,
        thinFraction: stat(state.eta, (v) => v < 0.26).aboveFraction,
      },
      gamma: {
        ...stat(state.gamma, (v) => v > 0.62),
        highFraction: stat(state.gamma, (v) => v > 0.62).aboveFraction,
      },
      velocity: {
        mean: Math.round((speedSum / count) * 10000) / 10000,
        activeFraction: Math.round((speedActive / count) * 10000) / 10000,
      },
      scenarioChecks: {
        northEtaMean: Math.round(northEtaMean * 10000) / 10000,
        southEtaMean: Math.round(southEtaMean * 10000) / 10000,
        gravityDrainageBias: Math.round((southEtaMean - northEtaMean) * 10000) / 10000,
        marangoniAlignment: Math.round((marangoniDot / Math.max(1e-6, marangoniWeight)) * 10000) / 10000,
        airflowAlignment: Math.round((airflowDot / Math.max(1, airflowWeight)) * 10000) / 10000,
        meanCompression: Math.round((compressionSum / count) * 10000) / 10000,
        targetAirSpeed: Math.round(targetSpeed * 10000) / 10000,
      },
      forces: {
        gravity: Math.round(settings.gravity * 10000) / 10000,
        marangoni: Math.round(settings.marangoni * 10000) / 10000,
        diffusion: Math.round(settings.diffusion * 10000) / 10000,
        flowSpeed: Math.round(settings.flowSpeed * 10000) / 10000,
        dragStrength: Math.round(settings.dragStrength * 10000) / 10000,
        marangoniForceScale: Math.round((settings.marangoniForceScale ?? 0.055) * 10000) / 10000,
      },
      projectedDivergence: stat(state.divergence, (v) => Math.abs(v) > 0.002),
      staggeredDivergenceDelta: stat(state.staggeredDivergenceDelta, (v) => v > 0.01),
      gammaCandidate: {
        gamma: stat(state.gammaCandidate),
        gammaRhsResidual: stat(state.gammaResidual, (v) => v > 0.002),
      },
      foam: {
        ...stat(state.foam, (v) => v > 0.035),
        visibleFraction: stat(state.foam, (v) => v > 0.035).aboveFraction,
      },
      phase: {
        ...stat(state.phase, (v) => v > 0.18),
        visibleFraction: stat(state.phase, (v) => v > 0.18).aboveFraction,
      },
      huangFrontStateTarget: {
        lineDistance: stat(state.frontDistance),
        occupancy: stat(state.frontOccupancy, (v) => v > 0.35),
        lineAge: stat(state.frontAge),
        sideReject: stat(state.frontSideReject),
      },
      huangResidualTransportTarget: {
        materialResidual: stat(state.materialResidual),
        alongContinuity: stat(state.alongContinuity),
        lineAge: stat(state.frontAge),
        sideReject: stat(state.frontSideReject),
      },
      phaseAreaErrorTarget: {
        physicalLineEvidence: stat(state.materialResidual),
        narrowPhysicalGate: stat(state.frontOccupancy, (v) => v > 0.35),
        broadSheet: stat(state.phase, (v) => v > 0.56),
      },
      encoding: {
        etaGammaVelocity: "r=eta, g=Gamma, b=|u|*2, a=0.5+div_s(u)*2.8",
        gammaCandidate: "r=GammaCandidate, g=0.5+div_s(u)*8, b=Gamma implicit residual, a=|DeltaGamma|",
        huangFrontState: "r=lineDistance, g=physical occupancy, b=lineAge, a=sideReject",
      },
    };
    return lastDiagnostics;
  }

  function dispose() {
    disposeTextures();
  }

  allocate();
  initializeFields();

  return {
    resize,
    reset: initializeFields,
    update,
    dispose,
    get size() {
      return size;
    },
    get texture() {
      return state.fieldTexture;
    },
    get velocityTexture() {
      return state.velocityTexture;
    },
    get gammaResidualTexture() {
      return state.gammaResidualTexture;
    },
    get gammaCandidateDiagnosticTexture() {
      return state.gammaCandidateTexture;
    },
    get etaGammaVelocityTexture() {
      return state.etaGammaVelocityTexture;
    },
    get huangLocalDiagnosticTexture() {
      return state.huangLocalTexture;
    },
    get huangMapStateTexture() {
      return state.mapTexture;
    },
    get huangForwardMapStateTexture() {
      return state.forwardMapTexture;
    },
    get huangFrontStateTexture() {
      return state.frontTexture;
    },
    get huangResidualTransportTexture() {
      return state.residualTexture;
    },
    get phasePotentialTexture() {
      return state.supportTexture;
    },
    get phaseAreaTexture() {
      return state.phaseAreaTexture;
    },
    get phaseAreaDiagnosticTexture() {
      return state.phaseAreaDiagnosticTexture;
    },
    get phaseAreaSkeletonTexture() {
      return state.phaseAreaSkeletonTexture;
    },
    get filamentConnectivityTexture() {
      return state.filamentTexture;
    },
    get regionalRawSupportTexture() {
      return state.supportTexture;
    },
    get regionalSupportTexture() {
      return state.phaseAreaTexture;
    },
    get regionalRidgeTexture() {
      return state.frontTexture;
    },
    get regionalFlowTexture() {
      return state.flowTexture;
    },
    get riverCoreSupportTexture() {
      return state.phaseAreaSkeletonTexture;
    },
    get riverCoreRawMassTexture() {
      return state.phaseAreaTexture;
    },
    get riverPathRawEvidenceTexture() {
      return state.residualTexture;
    },
    get riverPathCostTexture() {
      return state.frontTexture;
    },
    get riverPathDiagnosticsTexture() {
      return state.phaseAreaDiagnosticTexture;
    },
    get riverPathSkeletonTexture() {
      return state.phaseAreaSkeletonTexture;
    },
    get riverPathEvidenceTexture() {
      return state.residualTexture;
    },
    get riverCoreGeodesicTexture() {
      return state.mapTexture;
    },
    get riverCoreMassTexture() {
      return state.phaseAreaTexture;
    },
    get riverPhaseTexture() {
      return state.supportTexture;
    },
    get riverHeightFluxTexture() {
      return state.flowTexture;
    },
    get diagnostics() {
      return diagnostics();
    },
  };
}
