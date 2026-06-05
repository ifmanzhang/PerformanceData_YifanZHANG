import * as THREE from "../../vendor/three.module.min.js";
import { createHuangSphericalCore } from "./huangSphericalCore.js";

const FIXED_SIM_DT = 1 / 30;
const MAX_TICKS_PER_UPDATE = 3;
const DEFAULT_SIM_SEED = 417.29;

const SIM_VERTEX_SHADER = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const INIT_FIELD_FRAGMENT_SHADER = `
  precision highp float;
  varying vec2 vUv;
  uniform float uSeed;

  float hash21(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise21(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
      mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 5; i += 1) {
      value += noise21(p) * amplitude;
      p = mat2(1.58, 1.19, -1.19, 1.58) * p + vec2(0.17, 0.31);
      amplitude *= 0.52;
    }
    return value;
  }

  void main() {
    vec2 uv = vUv;
    vec2 centered = uv - 0.5;
    float dome = smoothstep(0.78, 0.08, length(centered));
    float broad = fbm(uv * vec2(1.6, 2.1) + uSeed * 0.07);
    float medium = fbm(uv * vec2(5.2, 7.1) + vec2(uSeed * 0.13, -uSeed * 0.09));
    float fine = fbm(uv * 36.0 + vec2(uSeed * 0.37, -uSeed * 0.21));
    float pinhole = smoothstep(0.68, 0.96, fbm(uv * 18.0 + vec2(uSeed * 0.17, uSeed * 0.23)));
    float dropletSeed = smoothstep(0.62, 0.94, medium) * smoothstep(0.46, 0.94, broad);
    float microDroplets = smoothstep(0.72, 0.985, fbm(uv * 64.0 + vec2(-uSeed * 0.31, uSeed * 0.27)));
    vec2 flowDir = normalize(vec2(-0.035, 0.999));
    vec2 sideDir = vec2(-flowDir.y, flowDir.x);
    float along = dot(centered, flowDir);
    float cross = dot(centered, sideDir);
    float meander = fbm(vec2(cross * 6.4 + broad * 1.35, along * 2.3) + vec2(uSeed * 0.071, -uSeed * 0.039));
    float branch = fbm(vec2(cross * 11.5 - medium * 0.9, along * 3.8 + broad * 0.55) + vec2(-uSeed * 0.052, uSeed * 0.087));
    float riverMeander = fbm(vec2(cross * 3.1 + broad * 0.8, along * 1.25 - medium * 0.36) + vec2(uSeed * 0.041, uSeed * 0.033));
    float riverBranch = fbm(vec2(cross * 5.2 - medium * 0.62, along * 2.0 + broad * 0.42) + vec2(-uSeed * 0.067, uSeed * 0.049));
    float riverInstability = smoothstep(0.59, 0.87, riverMeander * 0.66 + riverBranch * 0.28 + broad * 0.06);
    riverInstability *= smoothstep(0.08, 0.72, dome) * (1.0 - smoothstep(0.82, 1.0, dropletSeed));
    float streamInstability = smoothstep(0.58, 0.87, meander * 0.58 + branch * 0.34 + fine * 0.08);
    streamInstability *= smoothstep(0.06, 0.74, dome) * (1.0 - smoothstep(0.9, 1.0, dropletSeed));

    float height = 0.5 + (broad - 0.5) * 0.2 + (medium - 0.5) * 0.11 + (fine - 0.5) * 0.03;
    height += dropletSeed * 0.24 + microDroplets * 0.1 - pinhole * 0.16 - streamInstability * 0.055 - riverInstability * 0.12;
    height = mix(0.24, height, dome);

    float surfactant = 0.5 + (fbm(uv * 4.4 + vec2(4.2 + uSeed, 1.3)) - 0.5) * 0.18;
    surfactant += pinhole * 0.16 - dropletSeed * 0.08 + microDroplets * 0.04 + streamInstability * 0.055 + riverInstability * 0.09;

    float foam = smoothstep(0.88, 0.995, fine) * (0.04 + pinhole * 0.16 + dropletSeed * 0.1 + microDroplets * 0.22);
    foam += (streamInstability * 0.05 + riverInstability * 0.035) * microDroplets;
    float phaseNoise = (broad - 0.5) * 0.26 + (medium - 0.5) * 0.18 + (fine - 0.5) * 0.05;
    float channelSeed = smoothstep(0.64, 0.91, broad * 0.45 + medium * 0.42 + fine * 0.13 + pinhole * 0.18 - dropletSeed * 0.12);
    channelSeed = max(channelSeed, max(streamInstability * 0.62, riverInstability * 0.86));
    float dye = 0.18 + phaseNoise * 0.34 + channelSeed * 0.4 + pinhole * 0.055 - dropletSeed * 0.16;
    dye += (surfactant - 0.5) * 0.09 - height * 0.085;

    gl_FragColor = vec4(
      clamp(height, 0.035, 0.97),
      clamp(surfactant, 0.035, 0.97),
      clamp(foam, 0.0, 0.95),
      clamp(dye, 0.01, 0.88)
    );
  }
`;

const INIT_VELOCITY_FRAGMENT_SHADER = `
  precision highp float;
  varying vec2 vUv;
  uniform float uSeed;

  float hash21(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise21(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
      mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 4; i += 1) {
      value += noise21(p) * amplitude;
      p = mat2(1.61, 1.12, -1.12, 1.61) * p + vec2(0.23, 0.19);
      amplitude *= 0.52;
    }
    return value;
  }

  vec2 encodeVelocity(vec2 v) {
    return clamp(0.5 + v * 2.0, vec2(0.0), vec2(1.0));
  }

  void main() {
    vec2 uv = vUv;
    float n = fbm(uv * 4.8 + uSeed * 0.09);
    float nx = fbm((uv + vec2(0.006, 0.0)) * 4.8 + uSeed * 0.09);
    float ny = fbm((uv + vec2(0.0, 0.006)) * 4.8 + uSeed * 0.09);
    vec2 curl = vec2(n - ny, nx - n);
    vec2 velocity = vec2(0.026, -0.012) + curl * 0.12;
    gl_FragColor = vec4(encodeVelocity(velocity), 0.5, 1.0);
  }
`;

const VELOCITY_STEP_FRAGMENT_SHADER = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uField;
  uniform sampler2D uVelocity;
  uniform vec2 uTexel;
  uniform float uTime;
  uniform float uDelta;
  uniform float uPressure;
  uniform float uFlowSpeed;
  uniform float uFlowDirection;
  uniform float uFlowCoherence;
  uniform float uViscosity;
  uniform float uMarangoni;
  uniform float uCapillary;
  uniform float uDrainage;
  uniform float uGravity;

  const float VELOCITY_PI = 3.141592653589793;

  float hash21(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise21(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
      mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 4; i += 1) {
      value += noise21(p) * amplitude;
      p = mat2(1.63, 1.12, -1.12, 1.63) * p + vec2(0.23, 0.19);
      amplitude *= 0.53;
    }
    return value;
  }

  vec3 sphericalSampleUv(vec2 uv) {
    float x = uv.x;
    float y = uv.y;
    float poleCross = 0.0;
    if (y < 0.0) {
      y = -y;
      x += 0.5;
      poleCross = 1.0;
    }
    if (y > 1.0) {
      y = 2.0 - y;
      x += 0.5;
      poleCross = 1.0;
    }
    return vec3(fract(x), clamp(y, 0.002, 0.998), poleCross);
  }

  vec2 sampleUv(vec2 uv) {
    return sphericalSampleUv(uv).xy;
  }

  vec4 fieldAt(vec2 uv) {
    return texture2D(uField, sampleUv(uv));
  }

  vec2 decodeVelocity(vec4 encoded) {
    return (encoded.rg - 0.5) * 0.5;
  }

  vec4 encodeVelocity(vec2 velocity, float divergence) {
    vec2 encoded = clamp(0.5 + velocity * 2.0, vec2(0.0), vec2(1.0));
    return vec4(encoded, clamp(0.5 + divergence * 2.0, 0.0, 1.0), 1.0);
  }

  vec2 velocityAt(vec2 uv) {
    vec3 sphereUv = sphericalSampleUv(uv);
    vec2 velocity = decodeVelocity(texture2D(uVelocity, sphereUv.xy));
    return mix(velocity, -velocity, sphereUv.z);
  }

  float sphereSinAt(vec2 uv) {
    return max(0.22, sin(sampleUv(uv).y * VELOCITY_PI));
  }

  float phiDerivativeScale() {
    return min(4.5, 1.0 / max(0.0001, 4.0 * VELOCITY_PI * uTexel.x));
  }

  float thetaDerivativeScale() {
    return min(4.5, 1.0 / max(0.0001, 2.0 * VELOCITY_PI * uTexel.y));
  }

  vec2 sphericalBacktrace(vec2 uv, vec2 velocity, float scale) {
    float sinTheta = sphereSinAt(uv);
    vec2 metricVelocity = vec2(velocity.x / sinTheta, velocity.y);
    return sampleUv(uv - metricVelocity * uDelta * scale);
  }

  vec2 sphericalGradient(float leftValue, float rightValue, float downValue, float upValue, vec2 uv) {
    float sinTheta = sphereSinAt(uv);
    return vec2(
      (rightValue - leftValue) * 0.5 * phiDerivativeScale() / sinTheta,
      (upValue - downValue) * 0.5 * thetaDerivativeScale()
    );
  }

  float sphericalLaplacian(float centerValue, float leftValue, float rightValue, float downValue, float upValue, vec2 uv) {
    float sinC = sphereSinAt(uv);
    float sinD = sphereSinAt(uv - vec2(0.0, uTexel.y));
    float sinU = sphereSinAt(uv + vec2(0.0, uTexel.y));
    float phiScale = phiDerivativeScale();
    float thetaScale = thetaDerivativeScale();
    float phiCurvature = (leftValue + rightValue - centerValue * 2.0) * phiScale * phiScale / (sinC * sinC);
    float thetaCurvature = (sinU * (upValue - centerValue) - sinD * (centerValue - downValue)) * thetaScale * thetaScale / sinC;
    return phiCurvature + thetaCurvature;
  }

  vec4 sphericalLaplaceWeights(vec2 uv) {
    float sinC = sphereSinAt(uv);
    float sinD = sphereSinAt(uv - vec2(0.0, uTexel.y));
    float sinU = sphereSinAt(uv + vec2(0.0, uTexel.y));
    float phiScale = phiDerivativeScale();
    float thetaScale = thetaDerivativeScale();
    float phiWeight = phiScale * phiScale / (sinC * sinC);
    return vec4(phiWeight, phiWeight, thetaScale * thetaScale * sinD / sinC, thetaScale * thetaScale * sinU / sinC);
  }

  float weightedLaplacian(float centerValue, vec4 neighbors, vec4 weights) {
    return dot(neighbors, weights) - centerValue * dot(weights, vec4(1.0));
  }

  vec4 marangoniProjectionWeights(vec2 uv, vec4 center, vec4 left, vec4 right, vec4 down, vec4 up) {
    float sinC = sphereSinAt(uv);
    float sinD = sphereSinAt(uv - vec2(0.0, uTexel.y));
    float sinU = sphereSinAt(uv + vec2(0.0, uTexel.y));
    float baseMobility = 0.11 + uMarangoni * 0.31;
    float kC = baseMobility / max(0.045, center.r);
    float kL = baseMobility / max(0.045, left.r);
    float kR = baseMobility / max(0.045, right.r);
    float kD = baseMobility / max(0.045, down.r);
    float kU = baseMobility / max(0.045, up.r);
    float phiScale = phiDerivativeScale();
    float thetaScale = thetaDerivativeScale();
    float phiMetric = phiScale * phiScale / (sinC * sinC);
    float thetaMetric = thetaScale * thetaScale;
    return vec4(
      0.5 * (kC + kL) * phiMetric,
      0.5 * (kC + kR) * phiMetric,
      0.5 * (kC + kD) * thetaMetric * sinD / sinC,
      0.5 * (kC + kU) * thetaMetric * sinU / sinC
    );
  }

  float sphericalVelocityDivergence(vec2 uv, vec2 leftV, vec2 rightV, vec2 downV, vec2 upV) {
    float sinC = sphereSinAt(uv);
    float sinD = sphereSinAt(uv - vec2(0.0, uTexel.y));
    float sinU = sphereSinAt(uv + vec2(0.0, uTexel.y));
    float phiDiv = (rightV.x - leftV.x) * phiDerivativeScale() / sinC;
    float thetaDiv = (sinU * upV.y - sinD * downV.y) * thetaDerivativeScale() / sinC;
    return phiDiv + thetaDiv;
  }

  float lapHeight(vec2 uv) {
    float c = fieldAt(uv).r;
    float l = fieldAt(uv - vec2(uTexel.x, 0.0)).r;
    float r = fieldAt(uv + vec2(uTexel.x, 0.0)).r;
    float d = fieldAt(uv - vec2(0.0, uTexel.y)).r;
    float u = fieldAt(uv + vec2(0.0, uTexel.y)).r;
    return sphericalLaplacian(c, l, r, d, u, uv);
  }

  void main() {
    vec2 uv = vUv;
    vec2 previousVelocity = velocityAt(uv);
    vec2 backUv = sphericalBacktrace(uv, previousVelocity, 1.55);
    vec4 center = fieldAt(backUv);
    vec4 left = fieldAt(backUv - vec2(uTexel.x, 0.0));
    vec4 right = fieldAt(backUv + vec2(uTexel.x, 0.0));
    vec4 down = fieldAt(backUv - vec2(0.0, uTexel.y));
    vec4 up = fieldAt(backUv + vec2(0.0, uTexel.y));

    float height = center.r;
    vec2 gradH = sphericalGradient(left.r, right.r, down.r, up.r, backUv);
    vec2 gradG = sphericalGradient(left.g, right.g, down.g, up.g, backUv);
    vec2 gradPhi = sphericalGradient(left.a, right.a, down.a, up.a, backUv);
    float phi = center.a * 2.0 - 1.0;
    float lapPhi = (left.a + right.a + down.a + up.a - center.a * 4.0) * 2.0;
    float lapL = lapHeight(backUv - vec2(uTexel.x, 0.0));
    float lapR = lapHeight(backUv + vec2(uTexel.x, 0.0));
    float lapD = lapHeight(backUv - vec2(0.0, uTexel.y));
    float lapU = lapHeight(backUv + vec2(0.0, uTexel.y));
    float gammaC = clamp(1.0 - center.g * 0.34 + (center.a - 0.5) * 0.08, 0.58, 1.18);
    float gammaL = clamp(1.0 - left.g * 0.34 + (left.a - 0.5) * 0.08, 0.58, 1.18);
    float gammaR = clamp(1.0 - right.g * 0.34 + (right.a - 0.5) * 0.08, 0.58, 1.18);
    float gammaD = clamp(1.0 - down.g * 0.34 + (down.a - 0.5) * 0.08, 0.58, 1.18);
    float gammaU = clamp(1.0 - up.g * 0.34 + (up.a - 0.5) * 0.08, 0.58, 1.18);
    float disjoiningC = 0.018 / max(0.003, height * height + 0.02) - 0.006 * height;
    float disjoiningL = 0.018 / max(0.003, left.r * left.r + 0.02) - 0.006 * left.r;
    float disjoiningR = 0.018 / max(0.003, right.r * right.r + 0.02) - 0.006 * right.r;
    float disjoiningD = 0.018 / max(0.003, down.r * down.r + 0.02) - 0.006 * down.r;
    float disjoiningU = 0.018 / max(0.003, up.r * up.r + 0.02) - 0.006 * up.r;
    float pressureL = -gammaL * lapL + disjoiningL + left.r * uGravity * 0.02;
    float pressureR = -gammaR * lapR + disjoiningR + right.r * uGravity * 0.02;
    float pressureD = -gammaD * lapD + disjoiningD + down.r * uGravity * 0.02;
    float pressureU = -gammaU * lapU + disjoiningU + up.r * uGravity * 0.02;
    vec2 gradPressure = sphericalGradient(pressureL, pressureR, pressureD, pressureU, backUv);
    vec2 gradGamma = sphericalGradient(gammaL, gammaR, gammaD, gammaU, backUv);
    vec2 gradSurfactant = sphericalGradient(left.g, right.g, down.g, up.g, backUv);

    vec2 leftV = velocityAt(backUv - vec2(uTexel.x, 0.0));
    vec2 rightV = velocityAt(backUv + vec2(uTexel.x, 0.0));
    vec2 downV = velocityAt(backUv - vec2(0.0, uTexel.y));
    vec2 upV = velocityAt(backUv + vec2(0.0, uTexel.y));
    vec2 advectedVelocity = velocityAt(backUv);
    vec2 viscous = (leftV + rightV + downV + upV) * 0.25 - advectedVelocity;

    vec2 mainDir = normalize(vec2(cos(uFlowDirection), sin(uFlowDirection)));
    vec2 gravityDir = normalize(mix(vec2(0.0, -1.0), mainDir, 0.42));
    float mobility = smoothstep(0.08, 0.86, height);
    float filmMobility = height * height * (0.28 + height * 0.72);

    vec2 externalFlow = mainDir * (0.008 + uFlowSpeed * 0.03) * (0.4 + height * 1.35) * (0.8 + uPressure * 0.28);
    externalFlow += gravityDir * uGravity * uDrainage * (0.012 + height * height * 0.026);
    float eta = max(0.035, height);
    float etaMobility = (0.26 + uMarangoni * 0.72) / eta;
    vec2 huangMarangoni = -gradSurfactant * etaMobility;
    vec2 marangoni = huangMarangoni + gradGamma * filmMobility * (0.08 + uMarangoni * 0.12);
    vec2 capillary = -gradPressure * filmMobility * (0.38 + uCapillary * 0.86);
    vec2 drainageSlope = -gradH * uDrainage * (0.08 + height * 0.2);
    vec2 phaseBoundaryForce = -gradPhi * (phi * phi - 1.0 - lapPhi * 0.9) * (0.035 + uCapillary * 0.065);

    float divergence = sphericalVelocityDivergence(backUv, leftV, rightV, downV, upV);
    vec2 velocity = advectedVelocity;
    velocity += (externalFlow + marangoni + capillary + drainageSlope + phaseBoundaryForce) * uDelta * (1.85 + mobility * 1.45);
    velocity += viscous * clamp(uViscosity, 0.0, 1.5) * 0.58;
    velocity -= gradH * divergence * 0.36;
    velocity *= 0.996 - clamp(uViscosity, 0.0, 1.5) * 0.01;
    velocity = clamp(velocity, vec2(-0.23), vec2(0.23));

    gl_FragColor = encodeVelocity(velocity, divergence);
  }
`;

const DIVERGENCE_FRAGMENT_SHADER = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uVelocity;
  uniform vec2 uTexel;

  const float DIVERGENCE_PI = 3.141592653589793;

  vec3 sphericalSampleUv(vec2 uv) {
    float x = uv.x;
    float y = uv.y;
    float poleCross = 0.0;
    if (y < 0.0) {
      y = -y;
      x += 0.5;
      poleCross = 1.0;
    }
    if (y > 1.0) {
      y = 2.0 - y;
      x += 0.5;
      poleCross = 1.0;
    }
    return vec3(fract(x), clamp(y, 0.002, 0.998), poleCross);
  }

  vec2 sampleUv(vec2 uv) {
    return sphericalSampleUv(uv).xy;
  }

  vec2 decodeVelocity(vec4 encoded) {
    return (encoded.rg - 0.5) * 0.5;
  }

  vec2 velocityAt(vec2 uv) {
    vec3 sphereUv = sphericalSampleUv(uv);
    vec2 velocity = decodeVelocity(texture2D(uVelocity, sphereUv.xy));
    return mix(velocity, -velocity, sphereUv.z);
  }

  float sphereSinAt(vec2 uv) {
    return max(0.22, sin(sampleUv(uv).y * DIVERGENCE_PI));
  }

  void main() {
    vec2 left = velocityAt(vUv - vec2(uTexel.x, 0.0));
    vec2 right = velocityAt(vUv + vec2(uTexel.x, 0.0));
    vec2 down = velocityAt(vUv - vec2(0.0, uTexel.y));
    vec2 up = velocityAt(vUv + vec2(0.0, uTexel.y));
    float sinC = sphereSinAt(vUv);
    float sinD = sphereSinAt(vUv - vec2(0.0, uTexel.y));
    float sinU = sphereSinAt(vUv + vec2(0.0, uTexel.y));
    float phiDiv = (right.x - left.x) / sinC;
    float thetaDiv = (sinU * up.y - sinD * down.y) / sinC;
    float divergence = (phiDiv + thetaDiv) * 0.5;
    gl_FragColor = vec4(divergence, 0.0, 0.0, 1.0);
  }
`;

const CLEAR_PRESSURE_FRAGMENT_SHADER = `
  precision highp float;
  varying vec2 vUv;

  void main() {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
  }
`;

const PRESSURE_JACOBI_FRAGMENT_SHADER = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uPressure;
  uniform sampler2D uDivergence;
  uniform vec2 uTexel;

  float pressureAt(vec2 uv) {
    return texture2D(uPressure, clamp(uv, vec2(0.002), vec2(0.998))).r;
  }

  void main() {
    float left = pressureAt(vUv - vec2(uTexel.x, 0.0));
    float right = pressureAt(vUv + vec2(uTexel.x, 0.0));
    float down = pressureAt(vUv - vec2(0.0, uTexel.y));
    float up = pressureAt(vUv + vec2(0.0, uTexel.y));
    float divergence = texture2D(uDivergence, clamp(vUv, vec2(0.002), vec2(0.998))).r;
    float pressure = (left + right + down + up - divergence * 1.2) * 0.25;
    gl_FragColor = vec4(clamp(pressure, -1.0, 1.0), 0.0, 0.0, 1.0);
  }
`;

const PROJECT_VELOCITY_FRAGMENT_SHADER = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uVelocity;
  uniform sampler2D uPressure;
  uniform vec2 uTexel;

  const float PROJECT_PI = 3.141592653589793;

  vec3 sphericalSampleUv(vec2 uv) {
    float x = uv.x;
    float y = uv.y;
    float poleCross = 0.0;
    if (y < 0.0) {
      y = -y;
      x += 0.5;
      poleCross = 1.0;
    }
    if (y > 1.0) {
      y = 2.0 - y;
      x += 0.5;
      poleCross = 1.0;
    }
    return vec3(fract(x), clamp(y, 0.002, 0.998), poleCross);
  }

  vec2 sampleUv(vec2 uv) {
    return sphericalSampleUv(uv).xy;
  }

  vec2 decodeVelocity(vec4 encoded) {
    return (encoded.rg - 0.5) * 0.5;
  }

  vec4 encodeVelocity(vec2 velocity) {
    return vec4(clamp(0.5 + velocity * 2.0, vec2(0.0), vec2(1.0)), 0.5, 1.0);
  }

  float pressureAt(vec2 uv) {
    return texture2D(uPressure, sampleUv(uv)).r;
  }

  float sphereSinAt(vec2 uv) {
    return max(0.22, sin(sampleUv(uv).y * PROJECT_PI));
  }

  float phiDerivativeScale() {
    return min(4.5, 1.0 / max(0.0001, 4.0 * PROJECT_PI * uTexel.x));
  }

  float thetaDerivativeScale() {
    return min(4.5, 1.0 / max(0.0001, 2.0 * PROJECT_PI * uTexel.y));
  }

  vec2 sphericalGradient(float leftValue, float rightValue, float downValue, float upValue, vec2 uv) {
    float sinTheta = sphereSinAt(uv);
    return vec2(
      (rightValue - leftValue) * 0.5 * phiDerivativeScale() / sinTheta,
      (upValue - downValue) * 0.5 * thetaDerivativeScale()
    );
  }

  void main() {
    vec3 sphereUv = sphericalSampleUv(vUv);
    vec2 velocity = decodeVelocity(texture2D(uVelocity, sphereUv.xy));
    velocity = mix(velocity, -velocity, sphereUv.z);
    float left = pressureAt(vUv - vec2(uTexel.x, 0.0));
    float right = pressureAt(vUv + vec2(uTexel.x, 0.0));
    float down = pressureAt(vUv - vec2(0.0, uTexel.y));
    float up = pressureAt(vUv + vec2(0.0, uTexel.y));
    vec2 gradPressure = sphericalGradient(left, right, down, up, vUv);
    velocity -= gradPressure * 0.16;
    velocity = clamp(velocity, vec2(-0.24), vec2(0.24));
    gl_FragColor = encodeVelocity(velocity);
  }
`;

const GAMMA_IMPLICIT_FRAGMENT_SHADER = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uField;
  uniform sampler2D uVelocity;
  uniform vec2 uTexel;
  uniform float uDelta;
  uniform float uMarangoni;
  uniform float uDiffusion;

  const float GAMMA_PI = 3.141592653589793;

  vec3 sphericalSampleUv(vec2 uv) {
    float x = uv.x;
    float y = uv.y;
    float poleCross = 0.0;
    if (y < 0.0) {
      y = -y;
      x += 0.5;
      poleCross = 1.0;
    }
    if (y > 1.0) {
      y = 2.0 - y;
      x += 0.5;
      poleCross = 1.0;
    }
    return vec3(fract(x), clamp(y, 0.002, 0.998), poleCross);
  }

  vec2 sampleUv(vec2 uv) {
    return sphericalSampleUv(uv).xy;
  }

  vec4 fieldAt(vec2 uv) {
    return texture2D(uField, sampleUv(uv));
  }

  vec2 decodeVelocity(vec4 encoded) {
    return (encoded.rg - 0.5) * 0.5;
  }

  vec2 velocityAt(vec2 uv) {
    vec3 sphereUv = sphericalSampleUv(uv);
    vec2 velocity = decodeVelocity(texture2D(uVelocity, sphereUv.xy));
    return mix(velocity, -velocity, sphereUv.z);
  }

  float sphereSinAt(vec2 uv) {
    return max(0.22, sin(sampleUv(uv).y * GAMMA_PI));
  }

  float phiDerivativeScale() {
    return min(4.5, 1.0 / max(0.0001, 4.0 * GAMMA_PI * uTexel.x));
  }

  float thetaDerivativeScale() {
    return min(4.5, 1.0 / max(0.0001, 2.0 * GAMMA_PI * uTexel.y));
  }

  float sphericalLaplacian(float centerValue, float leftValue, float rightValue, float downValue, float upValue, vec2 uv) {
    float sinC = sphereSinAt(uv);
    float sinD = sphereSinAt(uv - vec2(0.0, uTexel.y));
    float sinU = sphereSinAt(uv + vec2(0.0, uTexel.y));
    float phiScale = phiDerivativeScale();
    float thetaScale = thetaDerivativeScale();
    float phiCurvature = (leftValue + rightValue - centerValue * 2.0) * phiScale * phiScale / (sinC * sinC);
    float thetaCurvature = (sinU * (upValue - centerValue) - sinD * (centerValue - downValue)) * thetaScale * thetaScale / sinC;
    return phiCurvature + thetaCurvature;
  }

  float sphericalVelocityDivergence(vec2 uv, vec2 leftV, vec2 rightV, vec2 downV, vec2 upV) {
    float sinC = sphereSinAt(uv);
    float sinD = sphereSinAt(uv - vec2(0.0, uTexel.y));
    float sinU = sphereSinAt(uv + vec2(0.0, uTexel.y));
    float phiDiv = (rightV.x - leftV.x) * phiDerivativeScale() / sinC;
    float thetaDiv = (sinU * upV.y - sinD * downV.y) * thetaDerivativeScale() / sinC;
    return phiDiv + thetaDiv;
  }

  vec4 sphericalLaplaceWeights(vec2 uv) {
    float sinC = sphereSinAt(uv);
    float sinD = sphereSinAt(uv - vec2(0.0, uTexel.y));
    float sinU = sphereSinAt(uv + vec2(0.0, uTexel.y));
    float phiScale = phiDerivativeScale();
    float thetaScale = thetaDerivativeScale();
    float phiWeight = phiScale * phiScale / (sinC * sinC);
    return vec4(phiWeight, phiWeight, thetaScale * thetaScale * sinD / sinC, thetaScale * thetaScale * sinU / sinC);
  }

  float weightedLaplacian(float centerValue, vec4 neighbors, vec4 weights) {
    return dot(neighbors, weights) - centerValue * dot(weights, vec4(1.0));
  }

  vec4 marangoniProjectionWeights(vec2 uv, vec4 center, vec4 left, vec4 right, vec4 down, vec4 up) {
    float sinC = sphereSinAt(uv);
    float sinD = sphereSinAt(uv - vec2(0.0, uTexel.y));
    float sinU = sphereSinAt(uv + vec2(0.0, uTexel.y));
    float baseMobility = 0.11 + uMarangoni * 0.31;
    float kC = baseMobility / max(0.045, center.r);
    float kL = baseMobility / max(0.045, left.r);
    float kR = baseMobility / max(0.045, right.r);
    float kD = baseMobility / max(0.045, down.r);
    float kU = baseMobility / max(0.045, up.r);
    float phiScale = phiDerivativeScale();
    float thetaScale = thetaDerivativeScale();
    float phiMetric = phiScale * phiScale / (sinC * sinC);
    float thetaMetric = thetaScale * thetaScale;
    return vec4(
      0.5 * (kC + kL) * phiMetric,
      0.5 * (kC + kR) * phiMetric,
      0.5 * (kC + kD) * thetaMetric * sinD / sinC,
      0.5 * (kC + kU) * thetaMetric * sinU / sinC
    );
  }

  void main() {
    vec2 uv = vUv;
    vec4 center = fieldAt(uv);
    vec4 left = fieldAt(uv - vec2(uTexel.x, 0.0));
    vec4 right = fieldAt(uv + vec2(uTexel.x, 0.0));
    vec4 down = fieldAt(uv - vec2(0.0, uTexel.y));
    vec4 up = fieldAt(uv + vec2(0.0, uTexel.y));
    vec2 leftV = velocityAt(uv - vec2(uTexel.x, 0.0));
    vec2 rightV = velocityAt(uv + vec2(uTexel.x, 0.0));
    vec2 downV = velocityAt(uv - vec2(0.0, uTexel.y));
    vec2 upV = velocityAt(uv + vec2(0.0, uTexel.y));

    float divergence = sphericalVelocityDivergence(uv, leftV, rightV, downV, upV);
    vec4 neighborGamma = vec4(left.g, right.g, down.g, up.g);
    vec4 laplaceWeights = sphericalLaplaceWeights(uv);
    vec4 marangoniWeights = marangoniProjectionWeights(uv, center, left, right, down, up);
    float lapGamma = weightedLaplacian(center.g, neighborGamma, laplaceWeights);
    float divMobilityGradGamma = weightedLaplacian(center.g, neighborGamma, marangoniWeights);

    float eta = max(0.045, center.r);
    float diffusionRate = 0.010 + uDiffusion * 0.038;
    float projectedDivergence = divergence - uDelta * divMobilityGradGamma;
    float gammaResidual = -center.g * projectedDivergence + diffusionRate * lapGamma;
    float residualSignal = abs(gammaResidual) + abs(projectedDivergence) * 0.22 + abs(divMobilityGradGamma) * 0.14;
    float residualLimiter = smoothstep(0.00045, 0.035, residualSignal);
    float implicitRelaxation = (2.1 + uMarangoni * 2.2) * (0.55 + residualLimiter * 0.78);
    float residualFeedback = clamp(gammaResidual, -0.32, 0.32) * residualLimiter * (1.35 + uMarangoni * 0.85);
    float gammaRhs = center.g + uDelta * (
      gammaResidual * (1.12 + uMarangoni * 0.54) * implicitRelaxation +
      residualFeedback
    );
    vec4 solverWeights = laplaceWeights * diffusionRate +
      marangoniWeights * max(0.0, center.g) * uDelta *
      (0.36 + uMarangoni * 0.22) * (0.75 + residualLimiter * 0.38);
    float solverDiagonal = max(0.0001, dot(solverWeights, vec4(1.0)));
    float gammaProjected = (gammaRhs + uDelta * dot(neighborGamma, solverWeights)) /
      (1.0 + uDelta * solverDiagonal);

    gammaProjected += uDelta * residualFeedback * (0.46 + uMarangoni * 0.18);
    float neighborMeanGamma = (center.g + left.g + right.g + down.g + up.g) * 0.2;
    gammaProjected = mix(gammaProjected, neighborMeanGamma, 0.006 + diffusionRate * 0.018);
    gammaProjected += uDelta * (neighborMeanGamma - gammaProjected) * (0.018 + uDiffusion * 0.010);
    gammaProjected = mix(
      center.g,
      gammaProjected,
      clamp(0.68 + residualLimiter * 0.14 + uMarangoni * 0.06, 0.0, 0.90)
    );

    gl_FragColor = vec4(
      clamp(center.r, 0.035, 0.975),
      clamp(gammaProjected, 0.025, 0.975),
      center.b,
      center.a
    );
  }
`;

const GAMMA_PROJECTION_JACOBI_FRAGMENT_SHADER = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uBaseField;
  uniform sampler2D uSolveField;
  uniform sampler2D uVelocity;
  uniform vec2 uTexel;
  uniform float uDelta;
  uniform float uDiffusion;
  uniform float uMarangoni;

  const float GAMMA_PROJECTION_PI = 3.141592653589793;

  vec3 sphericalSampleUv(vec2 uv) {
    float x = uv.x;
    float y = uv.y;
    float poleCross = 0.0;
    if (y < 0.0) {
      y = -y;
      x += 0.5;
      poleCross = 1.0;
    }
    if (y > 1.0) {
      y = 2.0 - y;
      x += 0.5;
      poleCross = 1.0;
    }
    return vec3(fract(x), clamp(y, 0.002, 0.998), poleCross);
  }

  vec2 sampleUv(vec2 uv) {
    return sphericalSampleUv(uv).xy;
  }

  vec4 baseAt(vec2 uv) {
    return texture2D(uBaseField, sampleUv(uv));
  }

  vec4 solveAt(vec2 uv) {
    return texture2D(uSolveField, sampleUv(uv));
  }

  vec2 decodeVelocity(vec4 encoded) {
    return (encoded.rg - 0.5) * 0.5;
  }

  vec2 velocityAt(vec2 uv) {
    vec3 sphereUv = sphericalSampleUv(uv);
    vec2 velocity = decodeVelocity(texture2D(uVelocity, sphereUv.xy));
    return mix(velocity, -velocity, sphereUv.z);
  }

  float sphereSinAt(vec2 uv) {
    return max(0.22, sin(sampleUv(uv).y * GAMMA_PROJECTION_PI));
  }

  float phiDerivativeScale() {
    return min(4.5, 1.0 / max(0.0001, 4.0 * GAMMA_PROJECTION_PI * uTexel.x));
  }

  float thetaDerivativeScale() {
    return min(4.5, 1.0 / max(0.0001, 2.0 * GAMMA_PROJECTION_PI * uTexel.y));
  }

  vec2 sphericalGradient(float leftValue, float rightValue, float downValue, float upValue, vec2 uv) {
    float sinTheta = sphereSinAt(uv);
    return vec2(
      (rightValue - leftValue) * 0.5 * phiDerivativeScale() / sinTheta,
      (upValue - downValue) * 0.5 * thetaDerivativeScale()
    );
  }

  float sphericalVelocityDivergence(vec2 uv, vec2 leftV, vec2 rightV, vec2 downV, vec2 upV) {
    float sinC = sphereSinAt(uv);
    float sinD = sphereSinAt(uv - vec2(0.0, uTexel.y));
    float sinU = sphereSinAt(uv + vec2(0.0, uTexel.y));
    float phiDiv = (rightV.x - leftV.x) * phiDerivativeScale() / sinC;
    float thetaDiv = (sinU * upV.y - sinD * downV.y) * thetaDerivativeScale() / sinC;
    return phiDiv + thetaDiv;
  }

  vec4 sphericalLaplaceWeights(vec2 uv) {
    float sinC = sphereSinAt(uv);
    float sinD = sphereSinAt(uv - vec2(0.0, uTexel.y));
    float sinU = sphereSinAt(uv + vec2(0.0, uTexel.y));
    float phiScale = phiDerivativeScale();
    float thetaScale = thetaDerivativeScale();
    float phiWeight = phiScale * phiScale / (sinC * sinC);
    return vec4(phiWeight, phiWeight, thetaScale * thetaScale * sinD / sinC, thetaScale * thetaScale * sinU / sinC);
  }

  vec4 marangoniProjectionWeights(vec2 uv, vec4 center, vec4 left, vec4 right, vec4 down, vec4 up) {
    float sinC = sphereSinAt(uv);
    float sinD = sphereSinAt(uv - vec2(0.0, uTexel.y));
    float sinU = sphereSinAt(uv + vec2(0.0, uTexel.y));
    float baseMobility = 0.11 + uMarangoni * 0.31;
    float kC = baseMobility / max(0.045, center.r);
    float kL = baseMobility / max(0.045, left.r);
    float kR = baseMobility / max(0.045, right.r);
    float kD = baseMobility / max(0.045, down.r);
    float kU = baseMobility / max(0.045, up.r);
    float phiScale = phiDerivativeScale();
    float thetaScale = thetaDerivativeScale();
    float phiMetric = phiScale * phiScale / (sinC * sinC);
    float thetaMetric = thetaScale * thetaScale;
    return vec4(
      0.5 * (kC + kL) * phiMetric,
      0.5 * (kC + kR) * phiMetric,
      0.5 * (kC + kD) * thetaMetric * sinD / sinC,
      0.5 * (kC + kU) * thetaMetric * sinU / sinC
    );
  }

  float weightedLaplacian(float centerValue, vec4 neighbors, vec4 weights) {
    return dot(neighbors, weights) - centerValue * dot(weights, vec4(1.0));
  }

  void main() {
    vec2 uv = vUv;
    vec4 centerBase = baseAt(uv);
    vec4 leftBase = baseAt(uv - vec2(uTexel.x, 0.0));
    vec4 rightBase = baseAt(uv + vec2(uTexel.x, 0.0));
    vec4 downBase = baseAt(uv - vec2(0.0, uTexel.y));
    vec4 upBase = baseAt(uv + vec2(0.0, uTexel.y));

    vec4 centerSolve = solveAt(uv);
    vec4 leftSolve = solveAt(uv - vec2(uTexel.x, 0.0));
    vec4 rightSolve = solveAt(uv + vec2(uTexel.x, 0.0));
    vec4 downSolve = solveAt(uv - vec2(0.0, uTexel.y));
    vec4 upSolve = solveAt(uv + vec2(0.0, uTexel.y));

    vec2 leftV = velocityAt(uv - vec2(uTexel.x, 0.0));
    vec2 rightV = velocityAt(uv + vec2(uTexel.x, 0.0));
    vec2 downV = velocityAt(uv - vec2(0.0, uTexel.y));
    vec2 upV = velocityAt(uv + vec2(0.0, uTexel.y));

    vec4 laplaceWeights = sphericalLaplaceWeights(uv);
    vec4 baseNeighborGamma = vec4(leftBase.g, rightBase.g, downBase.g, upBase.g);
    vec4 solveNeighborGamma = vec4(leftSolve.g, rightSolve.g, downSolve.g, upSolve.g);
    vec4 marangoniWeights = marangoniProjectionWeights(uv, centerBase, leftBase, rightBase, downBase, upBase);
    float divergenceStar = sphericalVelocityDivergence(uv, leftV, rightV, downV, upV);
    float lapBaseGamma = weightedLaplacian(centerBase.g, baseNeighborGamma, laplaceWeights);
    vec2 gradSolveGamma = sphericalGradient(leftSolve.g, rightSolve.g, downSolve.g, upSolve.g, uv);
    float divMobilitySolveGamma = weightedLaplacian(centerSolve.g, solveNeighborGamma, marangoniWeights);
    float projectedDivergenceStar = divergenceStar -
      uDelta * divMobilitySolveGamma * (0.86 + uMarangoni * 0.26);
    float gammaCompression = -centerBase.g * projectedDivergenceStar;
    float neighborMeanSolveGamma = (centerSolve.g + leftSolve.g + rightSolve.g + downSolve.g + upSolve.g) * 0.2;
    float localGammaStructure = abs(centerSolve.g - neighborMeanSolveGamma) + length(gradSolveGamma) * 0.68;
    float implicitLineGate = smoothstep(0.004, 0.052, localGammaStructure + max(0.0, -projectedDivergenceStar) * 0.28);
    float etaMobilityGate = clamp(0.44 / max(0.055, centerBase.r), 0.52, 1.55);

    float diffusionRate = 0.006 + uDiffusion * 0.026;
    float projectionSignal =
      abs(projectedDivergenceStar) * 1.12 +
      abs(divergenceStar) * 0.24 +
      abs(lapBaseGamma) * 0.016 +
      length(gradSolveGamma) * 0.72 +
      abs(divMobilitySolveGamma) * 0.075;
    float projectionGate = smoothstep(0.00055, 0.038, projectionSignal);
    float rhs = centerBase.g +
      uDelta * clamp(gammaCompression, -0.34, 0.34) *
      (0.84 + projectionGate * 0.42) *
      (0.62 + implicitLineGate * 0.52);
    rhs += uDelta * diffusionRate * clamp(lapBaseGamma, -0.24, 0.24) *
      (0.10 + projectionGate * 0.05);

    vec4 ellipticWeights =
      laplaceWeights * diffusionRate * uDelta * (0.22 + uDiffusion * 0.08) +
      marangoniWeights * max(0.03, centerBase.g) * uDelta *
      (0.28 + uMarangoni * 0.28) *
      (0.76 + projectionGate * 0.48) *
      etaMobilityGate *
      (0.58 + implicitLineGate * 0.62);
    float diagonal = 1.0 + dot(ellipticWeights, vec4(1.0));
    float gammaSolved = (rhs + dot(solveNeighborGamma, ellipticWeights)) / max(0.0001, diagonal);
    float relaxed = centerSolve.g + clamp(gammaSolved - centerSolve.g, -0.060, 0.060) *
      (0.76 + projectionGate * 0.16 + implicitLineGate * 0.12);
    float gammaNext = mix(relaxed, gammaSolved, 0.14 + projectionGate * 0.12 + implicitLineGate * 0.08);

    gl_FragColor = vec4(
      clamp(centerBase.r, 0.035, 0.975),
      clamp(gammaNext, 0.025, 0.975),
      centerBase.b,
      centerBase.a
    );
  }
`;

const GAMMA_TILE_MASS_FRAGMENT_SHADER = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uField;
  uniform vec2 uTileTexel;
  uniform vec2 uFieldTexel;

  const float GAMMA_TILE_PI = 3.141592653589793;

  vec3 sphericalSampleUv(vec2 uv) {
    float x = uv.x;
    float y = uv.y;
    float poleCross = 0.0;
    if (y < 0.0) {
      y = -y;
      x += 0.5;
      poleCross = 1.0;
    }
    if (y > 1.0) {
      y = 2.0 - y;
      x += 0.5;
      poleCross = 1.0;
    }
    return vec3(fract(x), clamp(y, 0.002, 0.998), poleCross);
  }

  vec2 sampleUv(vec2 uv) {
    return sphericalSampleUv(uv).xy;
  }

  float sphereAreaWeight(vec2 uv) {
    return max(0.20, sin(sampleUv(uv).y * GAMMA_TILE_PI));
  }

  void main() {
    vec2 tileSpan = max(uTileTexel * 0.48, uFieldTexel * 1.5);
    float gammaSum = 0.0;
    float gammaSqSum = 0.0;
    float etaSum = 0.0;
    float weightSum = 0.0;

    for (int iy = 0; iy < 4; iy += 1) {
      for (int ix = 0; ix < 4; ix += 1) {
        vec2 p = (vec2(float(ix), float(iy)) + 0.5) / 4.0 - 0.5;
        vec2 uv = sampleUv(vUv + p * tileSpan);
        vec4 field = texture2D(uField, uv);
        float weight = sphereAreaWeight(uv);
        gammaSum += field.g * weight;
        gammaSqSum += field.g * field.g * weight;
        etaSum += field.r * weight;
        weightSum += weight;
      }
    }

    float invWeight = 1.0 / max(0.0001, weightSum);
    float gammaMean = gammaSum * invWeight;
    float gammaVariance = max(0.0, gammaSqSum * invWeight - gammaMean * gammaMean);
    gl_FragColor = vec4(
      clamp(gammaMean, 0.0, 1.0),
      clamp(etaSum * invWeight, 0.0, 1.0),
      clamp(sqrt(gammaVariance) * 3.0, 0.0, 1.0),
      1.0
    );
  }
`;

const GAMMA_TILE_MASS_CORRECTION_FRAGMENT_SHADER = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uField;
  uniform sampler2D uTileBefore;
  uniform sampler2D uTileAfter;
  uniform vec2 uTexel;
  uniform float uCorrectionStrength;

  const float GAMMA_TILE_CORRECT_PI = 3.141592653589793;

  vec3 sphericalSampleUv(vec2 uv) {
    float x = uv.x;
    float y = uv.y;
    float poleCross = 0.0;
    if (y < 0.0) {
      y = -y;
      x += 0.5;
      poleCross = 1.0;
    }
    if (y > 1.0) {
      y = 2.0 - y;
      x += 0.5;
      poleCross = 1.0;
    }
    return vec3(fract(x), clamp(y, 0.002, 0.998), poleCross);
  }

  vec2 sampleUv(vec2 uv) {
    return sphericalSampleUv(uv).xy;
  }

  vec4 fieldAt(vec2 uv) {
    return texture2D(uField, sampleUv(uv));
  }

  float sphereSinAt(vec2 uv) {
    return max(0.22, sin(sampleUv(uv).y * GAMMA_TILE_CORRECT_PI));
  }

  void main() {
    vec2 uv = vUv;
    vec4 center = fieldAt(uv);
    vec4 left = fieldAt(uv - vec2(uTexel.x, 0.0));
    vec4 right = fieldAt(uv + vec2(uTexel.x, 0.0));
    vec4 down = fieldAt(uv - vec2(0.0, uTexel.y));
    vec4 up = fieldAt(uv + vec2(0.0, uTexel.y));

    vec4 before = texture2D(uTileBefore, uv);
    vec4 after = texture2D(uTileAfter, uv);
    float beforeMass = max(0.018, before.r);
    float afterMass = max(0.018, after.r);
    float massError = before.r - after.r;
    float ratio = clamp(beforeMass / afterMass, 0.42, 2.80);

    float neighborMean = (center.g + left.g + right.g + down.g + up.g) * 0.2;
    float sinTheta = sphereSinAt(uv);
    vec2 gradGamma = vec2((right.g - left.g) / (2.0 * sinTheta), (up.g - down.g) * 0.5);
    float localStructure = abs(center.g - neighborMean) + length(gradGamma) * 0.85 + before.b * 0.22 + after.b * 0.22;
    float massGate = smoothstep(0.00002, 0.0025, abs(massError));
    float structureGate = 0.92 + 0.08 * smoothstep(0.002, 0.08, localStructure);
    float correctionGate = clamp((0.88 + massGate * 0.12) * structureGate, 0.0, 1.0);

    float additiveGamma = center.g + massError * 1.08;
    float ratioGamma = center.g * ratio;
    float gammaConserved = mix(additiveGamma, ratioGamma, 0.12);
    float gammaNext = mix(center.g, gammaConserved, clamp(uCorrectionStrength * correctionGate, 0.0, 1.0));

    gl_FragColor = vec4(
      clamp(center.r, 0.035, 0.975),
      clamp(gammaNext, 0.025, 0.975),
      center.b,
      center.a
    );
  }
`;

const GAMMA_RESIDUAL_FRAGMENT_SHADER = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uField;
  uniform sampler2D uVelocity;
  uniform vec2 uTexel;
  uniform float uDelta;
  uniform float uDiffusion;
  uniform float uMarangoni;

  const float GAMMA_RESIDUAL_PI = 3.141592653589793;

  vec3 sphericalSampleUv(vec2 uv) {
    float x = uv.x;
    float y = uv.y;
    float poleCross = 0.0;
    if (y < 0.0) {
      y = -y;
      x += 0.5;
      poleCross = 1.0;
    }
    if (y > 1.0) {
      y = 2.0 - y;
      x += 0.5;
      poleCross = 1.0;
    }
    return vec3(fract(x), clamp(y, 0.002, 0.998), poleCross);
  }

  vec2 sampleUv(vec2 uv) {
    return sphericalSampleUv(uv).xy;
  }

  vec4 fieldAt(vec2 uv) {
    return texture2D(uField, sampleUv(uv));
  }

  vec2 decodeVelocity(vec4 encoded) {
    return (encoded.rg - 0.5) * 0.5;
  }

  vec2 velocityAt(vec2 uv) {
    vec3 sphereUv = sphericalSampleUv(uv);
    vec2 velocity = decodeVelocity(texture2D(uVelocity, sphereUv.xy));
    return mix(velocity, -velocity, sphereUv.z);
  }

  float sphereSinAt(vec2 uv) {
    return max(0.22, sin(sampleUv(uv).y * GAMMA_RESIDUAL_PI));
  }

  float phiDerivativeScale() {
    return min(4.5, 1.0 / max(0.0001, 4.0 * GAMMA_RESIDUAL_PI * uTexel.x));
  }

  float thetaDerivativeScale() {
    return min(4.5, 1.0 / max(0.0001, 2.0 * GAMMA_RESIDUAL_PI * uTexel.y));
  }

  vec2 sphericalGradient(float leftValue, float rightValue, float downValue, float upValue, vec2 uv) {
    float sinTheta = sphereSinAt(uv);
    return vec2(
      (rightValue - leftValue) * 0.5 * phiDerivativeScale() / sinTheta,
      (upValue - downValue) * 0.5 * thetaDerivativeScale()
    );
  }

  float sphericalLaplacian(float centerValue, float leftValue, float rightValue, float downValue, float upValue, vec2 uv) {
    float sinC = sphereSinAt(uv);
    float sinD = sphereSinAt(uv - vec2(0.0, uTexel.y));
    float sinU = sphereSinAt(uv + vec2(0.0, uTexel.y));
    float phiScale = phiDerivativeScale();
    float thetaScale = thetaDerivativeScale();
    float phiCurvature = (leftValue + rightValue - centerValue * 2.0) * phiScale * phiScale / (sinC * sinC);
    float thetaCurvature = (sinU * (upValue - centerValue) - sinD * (centerValue - downValue)) * thetaScale * thetaScale / sinC;
    return phiCurvature + thetaCurvature;
  }

  float sphericalVelocityDivergence(vec2 uv, vec2 leftV, vec2 rightV, vec2 downV, vec2 upV) {
    float sinC = sphereSinAt(uv);
    float sinD = sphereSinAt(uv - vec2(0.0, uTexel.y));
    float sinU = sphereSinAt(uv + vec2(0.0, uTexel.y));
    float phiDiv = (rightV.x - leftV.x) * phiDerivativeScale() / sinC;
    float thetaDiv = (sinU * upV.y - sinD * downV.y) * thetaDerivativeScale() / sinC;
    return phiDiv + thetaDiv;
  }

  vec4 sphericalLaplaceWeights(vec2 uv) {
    float sinC = sphereSinAt(uv);
    float sinD = sphereSinAt(uv - vec2(0.0, uTexel.y));
    float sinU = sphereSinAt(uv + vec2(0.0, uTexel.y));
    float phiScale = phiDerivativeScale();
    float thetaScale = thetaDerivativeScale();
    float phiWeight = phiScale * phiScale / (sinC * sinC);
    return vec4(phiWeight, phiWeight, thetaScale * thetaScale * sinD / sinC, thetaScale * thetaScale * sinU / sinC);
  }

  float weightedLaplacian(float centerValue, vec4 neighbors, vec4 weights) {
    return dot(neighbors, weights) - centerValue * dot(weights, vec4(1.0));
  }

  vec4 marangoniProjectionWeights(vec2 uv, vec4 center, vec4 left, vec4 right, vec4 down, vec4 up) {
    float sinC = sphereSinAt(uv);
    float sinD = sphereSinAt(uv - vec2(0.0, uTexel.y));
    float sinU = sphereSinAt(uv + vec2(0.0, uTexel.y));
    float baseMobility = 0.11 + uMarangoni * 0.31;
    float kC = baseMobility / max(0.045, center.r);
    float kL = baseMobility / max(0.045, left.r);
    float kR = baseMobility / max(0.045, right.r);
    float kD = baseMobility / max(0.045, down.r);
    float kU = baseMobility / max(0.045, up.r);
    float phiScale = phiDerivativeScale();
    float thetaScale = thetaDerivativeScale();
    float phiMetric = phiScale * phiScale / (sinC * sinC);
    float thetaMetric = thetaScale * thetaScale;
    return vec4(
      0.5 * (kC + kL) * phiMetric,
      0.5 * (kC + kR) * phiMetric,
      0.5 * (kC + kD) * thetaMetric * sinD / sinC,
      0.5 * (kC + kU) * thetaMetric * sinU / sinC
    );
  }

  void main() {
    vec4 center = fieldAt(vUv);
    vec4 left = fieldAt(vUv - vec2(uTexel.x, 0.0));
    vec4 right = fieldAt(vUv + vec2(uTexel.x, 0.0));
    vec4 down = fieldAt(vUv - vec2(0.0, uTexel.y));
    vec4 up = fieldAt(vUv + vec2(0.0, uTexel.y));
    vec2 leftV = velocityAt(vUv - vec2(uTexel.x, 0.0));
    vec2 rightV = velocityAt(vUv + vec2(uTexel.x, 0.0));
    vec2 downV = velocityAt(vUv - vec2(0.0, uTexel.y));
    vec2 upV = velocityAt(vUv + vec2(0.0, uTexel.y));

    float divergence = sphericalVelocityDivergence(vUv, leftV, rightV, downV, upV);
    vec4 neighborGamma = vec4(left.g, right.g, down.g, up.g);
    vec4 laplaceWeights = sphericalLaplaceWeights(vUv);
    vec4 marangoniWeights = marangoniProjectionWeights(vUv, center, left, right, down, up);
    float lapGamma = weightedLaplacian(center.g, neighborGamma, laplaceWeights);
    float divMobilityGradGamma = weightedLaplacian(center.g, neighborGamma, marangoniWeights);
    vec2 gradGamma = sphericalGradient(left.g, right.g, down.g, up.g, vUv);
    float diffusionRate = 0.010 + uDiffusion * 0.038;
    float projectedDivergence = divergence - uDelta * divMobilityGradGamma;
    float projectedCompression = max(0.0, -projectedDivergence);
    float mobilityDivergence = abs(divMobilityGradGamma);
    float gammaResidual = abs(-center.g * projectedDivergence + diffusionRate * lapGamma);
    float etaContinuityResidual = abs(center.r * projectedDivergence);
    float etaWeight = smoothstep(0.04, 0.52, center.r);

    gl_FragColor = vec4(
      clamp(projectedCompression * (2.6 + uDelta * 18.0) * etaWeight, 0.0, 1.0),
      clamp(mobilityDivergence * (0.75 + uDelta * 5.5) * etaWeight, 0.0, 1.0),
      clamp(gammaResidual * (5.0 + uDelta * 30.0) * etaWeight, 0.0, 1.0),
      clamp(etaContinuityResidual * (4.0 + uDelta * 22.0) * etaWeight, 0.0, 1.0)
    );
  }
`;

const GAMMA_CANDIDATE_DIAGNOSTIC_FRAGMENT_SHADER = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uField;
  uniform sampler2D uVelocity;
  uniform vec2 uTexel;
  uniform float uDelta;
  uniform float uDiffusion;
  uniform float uMarangoni;

  const float GAMMA_CANDIDATE_PI = 3.141592653589793;

  vec3 sphericalSampleUv(vec2 uv) {
    float x = uv.x;
    float y = uv.y;
    float poleCross = 0.0;
    if (y < 0.0) {
      y = -y;
      x += 0.5;
      poleCross = 1.0;
    }
    if (y > 1.0) {
      y = 2.0 - y;
      x += 0.5;
      poleCross = 1.0;
    }
    return vec3(fract(x), clamp(y, 0.002, 0.998), poleCross);
  }

  vec2 sampleUv(vec2 uv) {
    return sphericalSampleUv(uv).xy;
  }

  vec4 fieldAt(vec2 uv) {
    return texture2D(uField, sampleUv(uv));
  }

  vec2 decodeVelocity(vec4 encoded) {
    return (encoded.rg - 0.5) * 0.5;
  }

  vec2 velocityAt(vec2 uv) {
    vec3 sphereUv = sphericalSampleUv(uv);
    vec2 velocity = decodeVelocity(texture2D(uVelocity, sphereUv.xy));
    return mix(velocity, -velocity, sphereUv.z);
  }

  float sphereSinAt(vec2 uv) {
    return max(0.22, sin(sampleUv(uv).y * GAMMA_CANDIDATE_PI));
  }

  float phiDerivativeScale() {
    return min(4.5, 1.0 / max(0.0001, 4.0 * GAMMA_CANDIDATE_PI * uTexel.x));
  }

  float thetaDerivativeScale() {
    return min(4.5, 1.0 / max(0.0001, 2.0 * GAMMA_CANDIDATE_PI * uTexel.y));
  }

  float sphericalVelocityDivergence(vec2 uv, vec2 leftV, vec2 rightV, vec2 downV, vec2 upV) {
    float sinC = sphereSinAt(uv);
    float sinD = sphereSinAt(uv - vec2(0.0, uTexel.y));
    float sinU = sphereSinAt(uv + vec2(0.0, uTexel.y));
    float phiDiv = (rightV.x - leftV.x) * phiDerivativeScale() / sinC;
    float thetaDiv = (sinU * upV.y - sinD * downV.y) * thetaDerivativeScale() / sinC;
    return phiDiv + thetaDiv;
  }

  vec4 sphericalLaplaceWeights(vec2 uv) {
    float sinC = sphereSinAt(uv);
    float sinD = sphereSinAt(uv - vec2(0.0, uTexel.y));
    float sinU = sphereSinAt(uv + vec2(0.0, uTexel.y));
    float phiScale = phiDerivativeScale();
    float thetaScale = thetaDerivativeScale();
    float phiWeight = phiScale * phiScale / (sinC * sinC);
    return vec4(phiWeight, phiWeight, thetaScale * thetaScale * sinD / sinC, thetaScale * thetaScale * sinU / sinC);
  }

  vec4 marangoniProjectionWeights(vec2 uv, vec4 center, vec4 left, vec4 right, vec4 down, vec4 up) {
    float sinC = sphereSinAt(uv);
    float sinD = sphereSinAt(uv - vec2(0.0, uTexel.y));
    float sinU = sphereSinAt(uv + vec2(0.0, uTexel.y));
    float baseMobility = 0.11 + uMarangoni * 0.31;
    float kC = baseMobility / max(0.045, center.r);
    float kL = baseMobility / max(0.045, left.r);
    float kR = baseMobility / max(0.045, right.r);
    float kD = baseMobility / max(0.045, down.r);
    float kU = baseMobility / max(0.045, up.r);
    float phiScale = phiDerivativeScale();
    float thetaScale = thetaDerivativeScale();
    float phiMetric = phiScale * phiScale / (sinC * sinC);
    float thetaMetric = thetaScale * thetaScale;
    return vec4(
      0.5 * (kC + kL) * phiMetric,
      0.5 * (kC + kR) * phiMetric,
      0.5 * (kC + kD) * thetaMetric * sinD / sinC,
      0.5 * (kC + kU) * thetaMetric * sinU / sinC
    );
  }

  float weightedLaplacian(float centerValue, vec4 neighbors, vec4 weights) {
    return dot(neighbors, weights) - centerValue * dot(weights, vec4(1.0));
  }

  void main() {
    vec4 center = fieldAt(vUv);
    vec4 left = fieldAt(vUv - vec2(uTexel.x, 0.0));
    vec4 right = fieldAt(vUv + vec2(uTexel.x, 0.0));
    vec4 down = fieldAt(vUv - vec2(0.0, uTexel.y));
    vec4 up = fieldAt(vUv + vec2(0.0, uTexel.y));
    vec2 leftV = velocityAt(vUv - vec2(uTexel.x, 0.0));
    vec2 rightV = velocityAt(vUv + vec2(uTexel.x, 0.0));
    vec2 downV = velocityAt(vUv - vec2(0.0, uTexel.y));
    vec2 upV = velocityAt(vUv + vec2(0.0, uTexel.y));

    float divergence = sphericalVelocityDivergence(vUv, leftV, rightV, downV, upV);
    vec4 neighborGamma = vec4(left.g, right.g, down.g, up.g);
    vec4 laplaceWeights = sphericalLaplaceWeights(vUv);
    vec4 marangoniWeights = marangoniProjectionWeights(vUv, center, left, right, down, up);
    float lapGamma = weightedLaplacian(center.g, neighborGamma, laplaceWeights);
    float divMobilityGradGamma = weightedLaplacian(center.g, neighborGamma, marangoniWeights);
    float diffusionRate = 0.010 + uDiffusion * 0.038;
    float projectedDivergence = divergence - uDelta * divMobilityGradGamma;
    float gammaRhsResidual = -center.g * projectedDivergence + diffusionRate * lapGamma;
    float gammaCandidate = center.g + uDelta * gammaRhsResidual * (0.58 + uMarangoni * 0.22);
    float gammaDelta = gammaCandidate - center.g;

    gl_FragColor = vec4(
      clamp(gammaCandidate, 0.0, 1.0),
      clamp(0.5 + projectedDivergence * 8.0, 0.0, 1.0),
      clamp(0.5 + gammaRhsResidual * 18.0, 0.0, 1.0),
      clamp(abs(gammaDelta) * (82.0 + uDelta * 120.0), 0.0, 1.0)
    );
  }
`;

const ETA_GAMMA_VELOCITY_DIAGNOSTIC_FRAGMENT_SHADER = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uField;
  uniform sampler2D uVelocity;
  uniform vec2 uTexel;
  uniform float uDelta;
  uniform float uMarangoni;

  const float ETA_GAMMA_PI = 3.141592653589793;

  vec3 sphericalSampleUv(vec2 uv) {
    float x = uv.x;
    float y = uv.y;
    float poleCross = 0.0;
    if (y < 0.0) {
      y = -y;
      x += 0.5;
      poleCross = 1.0;
    }
    if (y > 1.0) {
      y = 2.0 - y;
      x += 0.5;
      poleCross = 1.0;
    }
    return vec3(fract(x), clamp(y, 0.002, 0.998), poleCross);
  }

  vec2 sampleUv(vec2 uv) {
    return sphericalSampleUv(uv).xy;
  }

  vec4 fieldAt(vec2 uv) {
    return texture2D(uField, sampleUv(uv));
  }

  vec2 decodeVelocity(vec4 encoded) {
    return (encoded.rg - 0.5) * 0.5;
  }

  vec2 velocityAt(vec2 uv) {
    vec3 sphereUv = sphericalSampleUv(uv);
    vec2 velocity = decodeVelocity(texture2D(uVelocity, sphereUv.xy));
    return mix(velocity, -velocity, sphereUv.z);
  }

  float sphereSinAt(vec2 uv) {
    return max(0.22, sin(sampleUv(uv).y * ETA_GAMMA_PI));
  }

  float phiDerivativeScale() {
    return min(4.5, 1.0 / max(0.0001, 4.0 * ETA_GAMMA_PI * uTexel.x));
  }

  float thetaDerivativeScale() {
    return min(4.5, 1.0 / max(0.0001, 2.0 * ETA_GAMMA_PI * uTexel.y));
  }

  float sphericalVelocityDivergence(vec2 uv, vec2 leftV, vec2 rightV, vec2 downV, vec2 upV) {
    float sinC = sphereSinAt(uv);
    float sinD = sphereSinAt(uv - vec2(0.0, uTexel.y));
    float sinU = sphereSinAt(uv + vec2(0.0, uTexel.y));
    float phiDiv = (rightV.x - leftV.x) * phiDerivativeScale() / sinC;
    float thetaDiv = (sinU * upV.y - sinD * downV.y) * thetaDerivativeScale() / sinC;
    return phiDiv + thetaDiv;
  }

  vec4 marangoniProjectionWeights(vec2 uv, vec4 center, vec4 left, vec4 right, vec4 down, vec4 up) {
    float sinC = sphereSinAt(uv);
    float sinD = sphereSinAt(uv - vec2(0.0, uTexel.y));
    float sinU = sphereSinAt(uv + vec2(0.0, uTexel.y));
    float baseMobility = 0.11 + uMarangoni * 0.31;
    float kC = baseMobility / max(0.045, center.r);
    float kL = baseMobility / max(0.045, left.r);
    float kR = baseMobility / max(0.045, right.r);
    float kD = baseMobility / max(0.045, down.r);
    float kU = baseMobility / max(0.045, up.r);
    float phiScale = phiDerivativeScale();
    float thetaScale = thetaDerivativeScale();
    float phiMetric = phiScale * phiScale / (sinC * sinC);
    float thetaMetric = thetaScale * thetaScale;
    return vec4(
      0.5 * (kC + kL) * phiMetric,
      0.5 * (kC + kR) * phiMetric,
      0.5 * (kC + kD) * thetaMetric * sinD / sinC,
      0.5 * (kC + kU) * thetaMetric * sinU / sinC
    );
  }

  float weightedLaplacian(float centerValue, vec4 neighbors, vec4 weights) {
    return dot(neighbors, weights) - centerValue * dot(weights, vec4(1.0));
  }

  void main() {
    vec4 center = fieldAt(vUv);
    vec4 left = fieldAt(vUv - vec2(uTexel.x, 0.0));
    vec4 right = fieldAt(vUv + vec2(uTexel.x, 0.0));
    vec4 down = fieldAt(vUv - vec2(0.0, uTexel.y));
    vec4 up = fieldAt(vUv + vec2(0.0, uTexel.y));
    vec2 velocity = velocityAt(vUv);
    vec2 leftV = velocityAt(vUv - vec2(uTexel.x, 0.0));
    vec2 rightV = velocityAt(vUv + vec2(uTexel.x, 0.0));
    vec2 downV = velocityAt(vUv - vec2(0.0, uTexel.y));
    vec2 upV = velocityAt(vUv + vec2(0.0, uTexel.y));
    float divergence = sphericalVelocityDivergence(vUv, leftV, rightV, downV, upV);
    vec4 neighborGamma = vec4(left.g, right.g, down.g, up.g);
    vec4 marangoniWeights = marangoniProjectionWeights(vUv, center, left, right, down, up);
    float divMobilityGradGamma = weightedLaplacian(center.g, neighborGamma, marangoniWeights);
    float projectedDivergence = divergence - uDelta * divMobilityGradGamma;

    gl_FragColor = vec4(
      clamp(center.r, 0.0, 1.0),
      clamp(center.g, 0.0, 1.0),
      clamp(length(velocity) * 2.0, 0.0, 1.0),
      clamp(0.5 + projectedDivergence * 2.8, 0.0, 1.0)
    );
  }
`;

const FIELD_DIAGNOSTIC_FRAGMENT_SHADER = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uField;

  void main() {
    vec4 field = texture2D(uField, vUv);
    gl_FragColor = vec4(
      clamp(field.r, 0.0, 1.0),
      clamp(field.g, 0.0, 1.0),
      clamp(field.b, 0.0, 1.0),
      clamp(field.a, 0.0, 1.0)
    );
  }
`;

const HUANG_LOCAL_DIAGNOSTIC_FRAGMENT_SHADER = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uField;
  uniform sampler2D uVelocity;
  uniform vec2 uTexel;
  uniform float uDelta;
  uniform float uMarangoni;

  const float HUANG_LOCAL_PI = 3.141592653589793;

  vec3 sphericalSampleUv(vec2 uv) {
    float x = uv.x;
    float y = uv.y;
    float poleCross = 0.0;
    if (y < 0.0) {
      y = -y;
      x += 0.5;
      poleCross = 1.0;
    }
    if (y > 1.0) {
      y = 2.0 - y;
      x += 0.5;
      poleCross = 1.0;
    }
    return vec3(fract(x), clamp(y, 0.002, 0.998), poleCross);
  }

  vec2 sampleUv(vec2 uv) {
    return sphericalSampleUv(uv).xy;
  }

  vec4 fieldAt(vec2 uv) {
    return texture2D(uField, sampleUv(uv));
  }

  vec2 decodeVelocity(vec4 encoded) {
    return (encoded.rg - 0.5) * 0.5;
  }

  vec2 velocityAt(vec2 uv) {
    vec3 sphereUv = sphericalSampleUv(uv);
    vec2 velocity = decodeVelocity(texture2D(uVelocity, sphereUv.xy));
    return mix(velocity, -velocity, sphereUv.z);
  }

  float sphereSinAt(vec2 uv) {
    return max(0.22, sin(sampleUv(uv).y * HUANG_LOCAL_PI));
  }

  float phiDerivativeScale() {
    return min(4.5, 1.0 / max(0.0001, 4.0 * HUANG_LOCAL_PI * uTexel.x));
  }

  float thetaDerivativeScale() {
    return min(4.5, 1.0 / max(0.0001, 2.0 * HUANG_LOCAL_PI * uTexel.y));
  }

  vec2 sphericalGradient(float leftValue, float rightValue, float downValue, float upValue, vec2 uv) {
    float sinTheta = sphereSinAt(uv);
    return vec2(
      (rightValue - leftValue) * 0.5 * phiDerivativeScale() / sinTheta,
      (upValue - downValue) * 0.5 * thetaDerivativeScale()
    );
  }

  float sphericalVelocityDivergence(vec2 uv, vec2 leftV, vec2 rightV, vec2 downV, vec2 upV) {
    float sinC = sphereSinAt(uv);
    float sinD = sphereSinAt(uv - vec2(0.0, uTexel.y));
    float sinU = sphereSinAt(uv + vec2(0.0, uTexel.y));
    float phiDiv = (rightV.x - leftV.x) * phiDerivativeScale() / sinC;
    float thetaDiv = (sinU * upV.y - sinD * downV.y) * thetaDerivativeScale() / sinC;
    return phiDiv + thetaDiv;
  }

  vec4 marangoniProjectionWeights(vec2 uv, vec4 center, vec4 left, vec4 right, vec4 down, vec4 up) {
    float sinC = sphereSinAt(uv);
    float sinD = sphereSinAt(uv - vec2(0.0, uTexel.y));
    float sinU = sphereSinAt(uv + vec2(0.0, uTexel.y));
    float baseMobility = 0.11 + uMarangoni * 0.31;
    float kC = baseMobility / max(0.045, center.r);
    float kL = baseMobility / max(0.045, left.r);
    float kR = baseMobility / max(0.045, right.r);
    float kD = baseMobility / max(0.045, down.r);
    float kU = baseMobility / max(0.045, up.r);
    float phiScale = phiDerivativeScale();
    float thetaScale = thetaDerivativeScale();
    float phiMetric = phiScale * phiScale / (sinC * sinC);
    float thetaMetric = thetaScale * thetaScale;
    return vec4(
      0.5 * (kC + kL) * phiMetric,
      0.5 * (kC + kR) * phiMetric,
      0.5 * (kC + kD) * thetaMetric * sinD / sinC,
      0.5 * (kC + kU) * thetaMetric * sinU / sinC
    );
  }

  float weightedLaplacian(float centerValue, vec4 neighbors, vec4 weights) {
    return dot(neighbors, weights) - centerValue * dot(weights, vec4(1.0));
  }

  vec4 huangEvidenceAt(vec2 uv) {
    vec4 center = fieldAt(uv);
    vec4 left = fieldAt(uv - vec2(uTexel.x, 0.0));
    vec4 right = fieldAt(uv + vec2(uTexel.x, 0.0));
    vec4 down = fieldAt(uv - vec2(0.0, uTexel.y));
    vec4 up = fieldAt(uv + vec2(0.0, uTexel.y));
    vec2 leftV = velocityAt(uv - vec2(uTexel.x, 0.0));
    vec2 rightV = velocityAt(uv + vec2(uTexel.x, 0.0));
    vec2 downV = velocityAt(uv - vec2(0.0, uTexel.y));
    vec2 upV = velocityAt(uv + vec2(0.0, uTexel.y));

    vec2 gradEta = sphericalGradient(left.r, right.r, down.r, up.r, uv);
    vec2 gradGamma = sphericalGradient(left.g, right.g, down.g, up.g, uv);
    vec4 neighborGamma = vec4(left.g, right.g, down.g, up.g);
    vec4 marangoniWeights = marangoniProjectionWeights(uv, center, left, right, down, up);
    float divMobilityGradGamma = weightedLaplacian(center.g, neighborGamma, marangoniWeights);
    float projectedDivergence = sphericalVelocityDivergence(uv, leftV, rightV, downV, upV) - uDelta * divMobilityGradGamma;

    float compression = clamp(max(0.0, -projectedDivergence) * 22.0, 0.0, 1.0);
    float gradGammaView = clamp(length(gradGamma) * 26.0, 0.0, 1.0);
    float etaGradientView = smoothstep(0.0015, 0.045, length(gradEta));
    vec2 etaDir = normalize(gradEta + vec2(0.0007, -0.0004));
    vec2 gammaDir = normalize(gradGamma + vec2(-0.0003, 0.0006));
    float crossMarangoni = abs(etaDir.x * gammaDir.y - etaDir.y * gammaDir.x);
    float alongMarangoni = abs(dot(etaDir, gammaDir));
    float marangoniGate = smoothstep(0.035, 0.42, crossMarangoni) * (1.0 - smoothstep(0.82, 0.995, alongMarangoni));
    marangoniGate *= smoothstep(0.0015, 0.035, length(gradGamma));
    float polarReject = smoothstep(0.74, 0.93, abs(uv.y * 2.0 - 1.0));
    float narrowPhysicalGate = marangoniGate * etaGradientView * (0.35 + compression * 0.65) * (1.0 - polarReject);

    return vec4(
      compression,
      gradGammaView,
      clamp(marangoniGate, 0.0, 1.0),
      clamp(narrowPhysicalGate, 0.0, 1.0)
    );
  }

  float huangLineScalar(vec4 evidence) {
    return clamp(
      evidence.a * 0.62 +
      evidence.b * evidence.r * 0.24 +
      evidence.g * evidence.b * 0.14,
      0.0,
      1.0
    );
  }

  void main() {
    vec4 centerEvidence = huangEvidenceAt(vUv);
    vec4 center = fieldAt(vUv);
    vec4 left = fieldAt(vUv - vec2(uTexel.x, 0.0));
    vec4 right = fieldAt(vUv + vec2(uTexel.x, 0.0));
    vec4 down = fieldAt(vUv - vec2(0.0, uTexel.y));
    vec4 up = fieldAt(vUv + vec2(0.0, uTexel.y));
    vec2 gradGamma = sphericalGradient(left.g, right.g, down.g, up.g, vUv);
    vec2 velocity = velocityAt(vUv);
    vec2 gammaTangent = normalize(vec2(-gradGamma.y, gradGamma.x) + vec2(0.0007, -0.0003));
    vec2 tangent = normalize(velocity * 3.4 + gammaTangent * (0.42 + centerEvidence.g * 0.42) + vec2(0.001, -0.001));
    vec2 normalDir = vec2(-tangent.y, tangent.x);
    vec2 alongStep = tangent * uTexel * 2.0;
    vec2 alongWideStep = tangent * uTexel * 5.0;
    vec2 sideStep = normalDir * uTexel * 2.0;
    vec2 sideWideStep = normalDir * uTexel * 5.0;
    float cLine = huangLineScalar(centerEvidence);
    float a1 = huangLineScalar(huangEvidenceAt(vUv + alongStep));
    float a2 = huangLineScalar(huangEvidenceAt(vUv - alongStep));
    float a3 = huangLineScalar(huangEvidenceAt(vUv + alongWideStep));
    float a4 = huangLineScalar(huangEvidenceAt(vUv - alongWideStep));
    float s1 = huangLineScalar(huangEvidenceAt(vUv + sideStep));
    float s2 = huangLineScalar(huangEvidenceAt(vUv - sideStep));
    float s3 = huangLineScalar(huangEvidenceAt(vUv + sideWideStep));
    float s4 = huangLineScalar(huangEvidenceAt(vUv - sideWideStep));
    float alongContinuity = smoothstep(0.012, 0.32, min(a1, a2) * 0.74 + min(a3, a4) * 0.26 + cLine * 0.18);
    float sideReject = smoothstep(
      0.05,
      0.48,
      max(max(s1, s2), max(s3, s4) * 0.72) -
      max(cLine, min(a1, a2) * 0.86) * 0.54
    );
    float velocityAlignedNms = smoothstep(
      0.006,
      0.26,
      cLine +
      min(a1, a2) * 0.42 +
      min(a3, a4) * 0.18 -
      max(max(s1, s2), max(s3, s4) * 0.72) * 0.82
    );
    float upwindContinuity = smoothstep(
      0.014,
      0.36,
      max(a1, a2) * 0.42 +
      max(a3, a4) * 0.18 +
      centerEvidence.r * centerEvidence.b * 0.26 +
      length(velocity) * 0.72 -
      max(s1, s2) * 0.32
    );
    float narrowPhysicalGate = clamp(
      centerEvidence.a * (0.42 + velocityAlignedNms * 0.34) +
      velocityAlignedNms * alongContinuity * 0.46 +
      upwindContinuity * centerEvidence.b * 0.22,
      0.0,
      1.0
    ) * (1.0 - sideReject * 0.58);

    gl_FragColor = vec4(
      centerEvidence.r,
      centerEvidence.g,
      centerEvidence.b,
      clamp(narrowPhysicalGate, 0.0, 1.0)
    );
  }
`;

const HUANG_MAP_STATE_FRAGMENT_SHADER = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uField;
  uniform sampler2D uVelocity;
  uniform sampler2D uHuangLocalDiagnostic;
  uniform sampler2D uGammaCandidate;
  uniform sampler2D uEtaGammaVelocity;
  uniform sampler2D uPreviousMap;
  uniform sampler2D uPairMap;
  uniform vec2 uFieldTexel;
  uniform float uDelta;
  uniform float uFlowDirection;
  uniform float uMapDirection;

  const float HUANG_MAP_PI = 3.141592653589793;

  vec3 sphericalSampleUv(vec2 uv) {
    float x = uv.x;
    float y = uv.y;
    float poleCross = 0.0;
    if (y < 0.0) {
      y = -y;
      x += 0.5;
      poleCross = 1.0;
    }
    if (y > 1.0) {
      y = 2.0 - y;
      x += 0.5;
      poleCross = 1.0;
    }
    return vec3(fract(x), clamp(y, 0.002, 0.998), poleCross);
  }

  vec2 sampleUv(vec2 uv) {
    return sphericalSampleUv(uv).xy;
  }

  vec4 fieldAt(vec2 uv) {
    return texture2D(uField, sampleUv(uv));
  }

  vec2 velocityAt(vec2 uv) {
    vec3 sphereUv = sphericalSampleUv(uv);
    vec2 velocity = (texture2D(uVelocity, sphereUv.xy).rg - 0.5) * 0.5;
    return mix(velocity, -velocity, sphereUv.z);
  }

  vec4 huangAt(vec2 uv) {
    return texture2D(uHuangLocalDiagnostic, sampleUv(uv));
  }

  vec4 gammaCandidateAt(vec2 uv) {
    return texture2D(uGammaCandidate, sampleUv(uv));
  }

  vec4 etaGammaVelocityAt(vec2 uv) {
    return texture2D(uEtaGammaVelocity, sampleUv(uv));
  }

  vec4 previousMapAt(vec2 uv) {
    return texture2D(uPreviousMap, sampleUv(uv));
  }

  vec4 pairMapAt(vec2 uv) {
    return texture2D(uPairMap, sampleUv(uv));
  }

  float sphereSinAt(vec2 uv) {
    return max(0.22, sin(sampleUv(uv).y * HUANG_MAP_PI));
  }

  float phiDerivativeScale() {
    return min(4.5, 1.0 / max(0.0001, 4.0 * HUANG_MAP_PI * uFieldTexel.x));
  }

  float thetaDerivativeScale() {
    return min(4.5, 1.0 / max(0.0001, 2.0 * HUANG_MAP_PI * uFieldTexel.y));
  }

  vec2 sphericalGradient(float leftValue, float rightValue, float downValue, float upValue, vec2 uv) {
    float sinTheta = sphereSinAt(uv);
    return vec2(
      (rightValue - leftValue) * 0.5 * phiDerivativeScale() / sinTheta,
      (upValue - downValue) * 0.5 * thetaDerivativeScale()
    );
  }

  float lineScalar(vec4 evidence) {
    return clamp(
      evidence.a * 0.66 +
      evidence.r * evidence.b * 0.22 +
      evidence.g * evidence.b * 0.12,
      0.0,
      1.0
    );
  }

  float gammaResidualScalar(vec4 candidate) {
    float candidateDivergence = (candidate.g - 0.5) / 8.0;
    float gammaRhsResidual = (candidate.b - 0.5) / 18.0;
    float residualLine = smoothstep(0.0013, 0.028, abs(gammaRhsResidual) + candidate.a * 0.016);
    float residualCompression = smoothstep(0.0009, 0.044, max(0.0, -candidateDivergence) + abs(gammaRhsResidual) * 0.32);
    return residualLine * residualCompression;
  }

  float etaGammaLineScalar(vec4 etaGammaVelocity) {
    float projectedDivergence = (etaGammaVelocity.a - 0.5) / 2.8;
    float compression = max(0.0, -projectedDivergence);
    float speedGate = smoothstep(0.038, 0.24, etaGammaVelocity.b);
    float continuityLine = smoothstep(0.0009, 0.038, compression + abs(projectedDivergence) * 0.2);
    return continuityLine * (0.32 + speedGate * 0.68);
  }

  float texelDistance(vec2 a, vec2 b) {
    vec2 d = sampleUv(a) - sampleUv(b);
    d.x = min(abs(d.x), 1.0 - abs(d.x));
    d.y = abs(d.y);
    return length(d / uFieldTexel);
  }

  vec2 materialTangentAt(vec2 uv) {
    vec4 l = fieldAt(uv - vec2(uFieldTexel.x, 0.0));
    vec4 r = fieldAt(uv + vec2(uFieldTexel.x, 0.0));
    vec4 d = fieldAt(uv - vec2(0.0, uFieldTexel.y));
    vec4 u = fieldAt(uv + vec2(0.0, uFieldTexel.y));
    vec2 gradGamma = sphericalGradient(l.g, r.g, d.g, u.g, uv);
    vec2 velocity = velocityAt(uv);
    float speed = length(velocity);
    vec2 velocityDir = velocity / max(0.0005, speed);
    vec2 globalFlowDir = normalize(vec2(cos(uFlowDirection), sin(uFlowDirection)));
    vec2 gammaTangent = normalize(vec2(-gradGamma.y, gradGamma.x) + vec2(0.001, -0.001));
    float velocityWeight = smoothstep(0.004, 0.055, speed);
    vec2 tangent = normalize(
      velocityDir * velocityWeight * 5.8 +
      gammaTangent * (0.18 + (1.0 - velocityWeight) * 0.28) +
      globalFlowDir * 0.06 +
      vec2(0.001, -0.001)
    );
    if (dot(tangent, globalFlowDir) < -0.42) tangent *= -1.0;
    return tangent;
  }

  float transportSpeedAt(vec2 uv) {
    vec2 velocity = velocityAt(uv);
    float etaGammaSpeed = etaGammaVelocityAt(uv).b;
    return 0.35 + clamp(length(velocity) * 14.0 + etaGammaSpeed * 1.7 + uDelta * 36.0, 0.0, 4.5);
  }

  void main() {
    vec2 uv = vUv;
    vec2 tangent = materialTangentAt(uv);
    float speedStep = transportSpeedAt(uv);
    vec2 transportStep = tangent * uFieldTexel * speedStep;
    float direction = mix(-1.0, 1.0, step(0.0, uMapDirection));
    vec2 primaryUv = uv + transportStep * direction;
    vec2 oppositeUv = uv - transportStep * direction * 0.92;
    vec2 primaryTangent = materialTangentAt(primaryUv);
    vec2 oppositeTangent = materialTangentAt(oppositeUv);
    float primarySpeedStep = transportSpeedAt(primaryUv);
    float oppositeSpeedStep = transportSpeedAt(oppositeUv);
    vec2 primaryReprojectUv = primaryUv - primaryTangent * uFieldTexel * primarySpeedStep * direction;
    vec2 oppositeReprojectUv = oppositeUv + oppositeTangent * uFieldTexel * oppositeSpeedStep * direction;
    float primaryMapError = texelDistance(primaryReprojectUv, uv) / max(1.0, speedStep + 1.0);
    float oppositeMapError = texelDistance(oppositeReprojectUv, uv) / max(1.0, speedStep + 1.0);
    float mapRoundTripError = max(primaryMapError, oppositeMapError * 0.84);

    vec4 prevPrimaryMap = previousMapAt(primaryUv);
    float prevConfidence = prevPrimaryMap.b * (1.0 - smoothstep(0.22, 0.82, prevPrimaryMap.a));
    vec2 storedMapUv = mix(sampleUv(primaryUv), prevPrimaryMap.rg, prevConfidence * 0.72);
    vec4 pairAtStored = pairMapAt(storedMapUv);
    float pairConfidence = pairAtStored.b * (1.0 - smoothstep(0.22, 0.82, pairAtStored.a));
    float pairConsistencyError = texelDistance(pairAtStored.rg, uv) / max(1.0, speedStep + 1.0);
    float pairConsistency = 1.0 - smoothstep(0.32, 1.25, pairConsistencyError);

    float hLine = lineScalar(huangAt(uv));
    float instantResidual = max(gammaResidualScalar(gammaCandidateAt(uv)), etaGammaLineScalar(etaGammaVelocityAt(uv)));
    float alongResidual = max(
      max(gammaResidualScalar(gammaCandidateAt(uv + transportStep)), gammaResidualScalar(gammaCandidateAt(uv - transportStep))),
      max(etaGammaLineScalar(etaGammaVelocityAt(uv + transportStep)), etaGammaLineScalar(etaGammaVelocityAt(uv - transportStep)))
    );
    float speedGate = smoothstep(0.04, 0.28, etaGammaVelocityAt(uv).b + length(velocityAt(uv)) * 1.5);
    float sourceEvidence = smoothstep(
      0.03,
      0.36,
      instantResidual * 0.56 + alongResidual * 0.2 + hLine * 0.28 + speedGate * 0.1
    );
    float mapReject = clamp(
      smoothstep(0.42, 1.65, mapRoundTripError) * 0.78 +
      prevPrimaryMap.a * 0.1 +
      (1.0 - pairConsistency) * smoothstep(0.04, 0.52, pairConfidence) * 0.22,
      0.0,
      1.0
    );
    float transportReliability = (1.0 - mapReject) *
      (0.5 + prevConfidence * 0.18 + speedGate * 0.14 + pairConsistency * 0.16);
    float confidence = clamp(max(transportReliability, sourceEvidence * (1.0 - mapReject) * 0.48), 0.0, 1.0);

    gl_FragColor = vec4(storedMapUv, confidence, mapReject);
  }
`;

const HUANG_RESIDUAL_TRANSPORT_FRAGMENT_SHADER = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uField;
  uniform sampler2D uVelocity;
  uniform sampler2D uHuangLocalDiagnostic;
  uniform sampler2D uGammaCandidate;
  uniform sampler2D uEtaGammaVelocity;
  uniform sampler2D uPreviousTransport;
  uniform sampler2D uHuangMapState;
  uniform sampler2D uHuangForwardMapState;
  uniform vec2 uFieldTexel;
  uniform float uDelta;
  uniform float uFlowDirection;

  const float HUANG_RESIDUAL_PI = 3.141592653589793;

  vec3 sphericalSampleUv(vec2 uv) {
    float x = uv.x;
    float y = uv.y;
    float poleCross = 0.0;
    if (y < 0.0) {
      y = -y;
      x += 0.5;
      poleCross = 1.0;
    }
    if (y > 1.0) {
      y = 2.0 - y;
      x += 0.5;
      poleCross = 1.0;
    }
    return vec3(fract(x), clamp(y, 0.002, 0.998), poleCross);
  }

  vec2 sampleUv(vec2 uv) {
    return sphericalSampleUv(uv).xy;
  }

  vec4 fieldAt(vec2 uv) {
    return texture2D(uField, sampleUv(uv));
  }

  vec2 velocityAt(vec2 uv) {
    vec3 sphereUv = sphericalSampleUv(uv);
    vec2 velocity = (texture2D(uVelocity, sphereUv.xy).rg - 0.5) * 0.5;
    return mix(velocity, -velocity, sphereUv.z);
  }

  vec4 huangAt(vec2 uv) {
    return texture2D(uHuangLocalDiagnostic, sampleUv(uv));
  }

  vec4 gammaCandidateAt(vec2 uv) {
    return texture2D(uGammaCandidate, sampleUv(uv));
  }

  vec4 etaGammaVelocityAt(vec2 uv) {
    return texture2D(uEtaGammaVelocity, sampleUv(uv));
  }

  vec4 previousTransportAt(vec2 uv) {
    return texture2D(uPreviousTransport, sampleUv(uv));
  }

  vec4 huangMapStateAt(vec2 uv) {
    return texture2D(uHuangMapState, sampleUv(uv));
  }

  vec4 huangForwardMapStateAt(vec2 uv) {
    return texture2D(uHuangForwardMapState, sampleUv(uv));
  }

  float sphereSinAt(vec2 uv) {
    return max(0.22, sin(sampleUv(uv).y * HUANG_RESIDUAL_PI));
  }

  float phiDerivativeScale() {
    return min(4.5, 1.0 / max(0.0001, 4.0 * HUANG_RESIDUAL_PI * uFieldTexel.x));
  }

  float thetaDerivativeScale() {
    return min(4.5, 1.0 / max(0.0001, 2.0 * HUANG_RESIDUAL_PI * uFieldTexel.y));
  }

  vec2 sphericalGradient(float leftValue, float rightValue, float downValue, float upValue, vec2 uv) {
    float sinTheta = sphereSinAt(uv);
    return vec2(
      (rightValue - leftValue) * 0.5 * phiDerivativeScale() / sinTheta,
      (upValue - downValue) * 0.5 * thetaDerivativeScale()
    );
  }

  float sphericalLaplacian(float centerValue, float leftValue, float rightValue, float downValue, float upValue, vec2 uv) {
    float sinC = sphereSinAt(uv);
    float sinD = sphereSinAt(uv - vec2(0.0, uFieldTexel.y));
    float sinU = sphereSinAt(uv + vec2(0.0, uFieldTexel.y));
    float phiScale = phiDerivativeScale();
    float thetaScale = thetaDerivativeScale();
    float phiCurvature = (leftValue + rightValue - centerValue * 2.0) * phiScale * phiScale / (sinC * sinC);
    float thetaCurvature = (sinU * (upValue - centerValue) - sinD * (centerValue - downValue)) * thetaScale * thetaScale / sinC;
    return phiCurvature + thetaCurvature;
  }

  float lineScalar(vec4 evidence) {
    return clamp(
      evidence.a * 0.66 +
      evidence.r * evidence.b * 0.22 +
      evidence.g * evidence.b * 0.12,
      0.0,
      1.0
    );
  }

  float gammaResidualScalar(vec4 candidate) {
    float candidateDivergence = (candidate.g - 0.5) / 8.0;
    float gammaRhsResidual = (candidate.b - 0.5) / 18.0;
    float residualLine = smoothstep(0.0015, 0.03, abs(gammaRhsResidual) + candidate.a * 0.014);
    float residualCompression = smoothstep(0.001, 0.048, max(0.0, -candidateDivergence) + abs(gammaRhsResidual) * 0.28);
    return residualLine * residualCompression;
  }

  float etaGammaLineScalar(vec4 etaGammaVelocity) {
    float projectedDivergence = (etaGammaVelocity.a - 0.5) / 2.8;
    float compression = max(0.0, -projectedDivergence);
    float speedGate = smoothstep(0.04, 0.24, etaGammaVelocity.b);
    float continuityLine = smoothstep(0.001, 0.04, compression + abs(projectedDivergence) * 0.18);
    return continuityLine * (0.28 + speedGate * 0.72);
  }

  float texelDistance(vec2 a, vec2 b) {
    vec2 d = sampleUv(a) - sampleUv(b);
    d.x = min(abs(d.x), 1.0 - abs(d.x));
    d.y = abs(d.y);
    return length(d / uFieldTexel);
  }

  vec2 materialTangentAt(vec2 uv) {
    vec4 l = fieldAt(uv - vec2(uFieldTexel.x, 0.0));
    vec4 r = fieldAt(uv + vec2(uFieldTexel.x, 0.0));
    vec4 d = fieldAt(uv - vec2(0.0, uFieldTexel.y));
    vec4 u = fieldAt(uv + vec2(0.0, uFieldTexel.y));
    vec2 gradGamma = sphericalGradient(l.g, r.g, d.g, u.g, uv);
    vec2 velocity = velocityAt(uv);
    float speed = length(velocity);
    vec2 velocityDir = velocity / max(0.0005, speed);
    vec2 globalFlowDir = normalize(vec2(cos(uFlowDirection), sin(uFlowDirection)));
    vec2 gammaTangent = normalize(vec2(-gradGamma.y, gradGamma.x) + vec2(0.001, -0.001));
    float velocityWeight = smoothstep(0.004, 0.055, speed);
    vec2 tangent = normalize(
      velocityDir * velocityWeight * 5.8 +
      gammaTangent * (0.18 + (1.0 - velocityWeight) * 0.28) +
      globalFlowDir * 0.06 +
      vec2(0.001, -0.001)
    );
    if (dot(tangent, globalFlowDir) < -0.42) tangent *= -1.0;
    return tangent;
  }

  float transportSpeedAt(vec2 uv) {
    vec2 velocity = velocityAt(uv);
    float etaGammaSpeed = etaGammaVelocityAt(uv).b;
    return 0.35 + clamp(length(velocity) * 14.0 + etaGammaSpeed * 1.7 + uDelta * 36.0, 0.0, 4.5);
  }

  float sourceCandidate(vec2 uv, vec2 tangent, vec2 sideDir) {
    vec4 c = fieldAt(uv);
    vec4 l = fieldAt(uv - vec2(uFieldTexel.x, 0.0));
    vec4 r = fieldAt(uv + vec2(uFieldTexel.x, 0.0));
    vec4 d = fieldAt(uv - vec2(0.0, uFieldTexel.y));
    vec4 u = fieldAt(uv + vec2(0.0, uFieldTexel.y));
    vec2 gradEta = sphericalGradient(l.r, r.r, d.r, u.r, uv);
    vec2 gradGamma = sphericalGradient(l.g, r.g, d.g, u.g, uv);
    float lapEta = sphericalLaplacian(c.r, l.r, r.r, d.r, u.r, uv);
    float lapGamma = sphericalLaplacian(c.g, l.g, r.g, d.g, u.g, uv);
    float eta = max(c.r, 0.035);
    float gammaAcrossPeak = abs(dot(gradGamma, sideDir)) / eta;
    float gammaAlongLeak = abs(dot(gradGamma, tangent)) / eta;
    float etaAcrossPeak = abs(dot(gradEta, sideDir));
    float etaAlongLeak = abs(dot(gradEta, tangent));
    float gammaPeakGate = smoothstep(0.006, 0.11, gammaAcrossPeak - gammaAlongLeak * 0.5 + abs(lapGamma) * 0.045);
    float etaCurveGate = smoothstep(0.012, 0.17, etaAcrossPeak * 1.05 - etaAlongLeak * 0.46 + abs(lapEta) * 0.055) *
      (1.0 - smoothstep(0.84, 0.98, c.r));
    float hLine = lineScalar(huangAt(uv));
    float residual = max(gammaResidualScalar(gammaCandidateAt(uv)), etaGammaLineScalar(etaGammaVelocityAt(uv)));
    float speedGate = smoothstep(0.035, 0.24, etaGammaVelocityAt(uv).b);
    float physicsGate = smoothstep(
      0.045,
      0.52,
      hLine * 0.45 + max(gammaPeakGate, etaCurveGate) * 0.72 + speedGate * 0.16
    );
    return residual * physicsGate;
  }

  void main() {
    vec2 uv = vUv;
    vec4 c = fieldAt(uv);
    vec4 l = fieldAt(uv - vec2(uFieldTexel.x, 0.0));
    vec4 r = fieldAt(uv + vec2(uFieldTexel.x, 0.0));
    vec4 d = fieldAt(uv - vec2(0.0, uFieldTexel.y));
    vec4 u = fieldAt(uv + vec2(0.0, uFieldTexel.y));
    vec2 gradGamma = sphericalGradient(l.g, r.g, d.g, u.g, uv);
    vec2 velocity = velocityAt(uv);
    vec2 globalFlowDir = normalize(vec2(cos(uFlowDirection), sin(uFlowDirection)));
    vec2 gammaTangent = normalize(vec2(-gradGamma.y, gradGamma.x) + vec2(0.001, -0.001));
    float velocitySpeed = length(velocity);
    vec2 velocityDir = velocity / max(0.0005, velocitySpeed);
    float velocityWeight = smoothstep(0.004, 0.055, velocitySpeed);
    vec2 tangent = normalize(
      velocityDir * velocityWeight * 5.8 +
      gammaTangent * (0.18 + (1.0 - velocityWeight) * 0.28) +
      globalFlowDir * 0.06 +
      vec2(0.001, -0.001)
    );
    if (dot(tangent, globalFlowDir) < -0.42) tangent *= -1.0;
    vec2 sideDir = vec2(-tangent.y, tangent.x);
    vec2 alongStep = tangent * uFieldTexel * 2.0;
    vec2 alongWideStep = tangent * uFieldTexel * 5.0;
    vec2 sideStep = sideDir * uFieldTexel * 2.0;
    vec2 sideWideStep = sideDir * uFieldTexel * 5.0;
    vec2 branchDirA = normalize(tangent * 0.86 + sideDir * 0.5);
    vec2 branchDirB = normalize(tangent * 0.86 - sideDir * 0.5);
    vec2 branchStepA = branchDirA * uFieldTexel * 4.0;
    vec2 branchStepB = branchDirB * uFieldTexel * 4.0;

    float sourceC = sourceCandidate(uv, tangent, sideDir);
    float sourceA = sourceCandidate(uv + alongStep, tangent, sideDir);
    float sourceB = sourceCandidate(uv - alongStep, tangent, sideDir);
    float sourceA2 = sourceCandidate(uv + alongWideStep, tangent, sideDir);
    float sourceB2 = sourceCandidate(uv - alongWideStep, tangent, sideDir);
    float sourceS1 = sourceCandidate(uv + sideStep, tangent, sideDir);
    float sourceS2 = sourceCandidate(uv - sideStep, tangent, sideDir);
    float sourceS3 = sourceCandidate(uv + sideWideStep, tangent, sideDir);
    float sourceS4 = sourceCandidate(uv - sideWideStep, tangent, sideDir);
    float sourceBA = sourceCandidate(uv + branchStepA, tangent, sideDir);
    float sourceBB = sourceCandidate(uv - branchStepA, tangent, sideDir);
    float sourceBC = sourceCandidate(uv + branchStepB, tangent, sideDir);
    float sourceBD = sourceCandidate(uv - branchStepB, tangent, sideDir);
    float branchOneSided = max(max(sourceBA, sourceBB), max(sourceBC, sourceBD));
    float branchTwoSided = max(min(sourceBA, sourceBB), min(sourceBC, sourceBD));
    float branchSupport = branchTwoSided * 0.58 + branchOneSided * 0.24;
    float alongMax = max(max(sourceA, sourceB), max(max(sourceA2, sourceB2) * 0.72, branchOneSided * 0.62));
    float sideNear = max(sourceS1, sourceS2);
    float sideWide = max(sourceS3, sourceS4);
    float sideMean = (sourceS1 + sourceS2) * 0.5 + (sourceS3 + sourceS4) * 0.18;
    float sideMax = max(sideNear, sideWide * 0.68);
    float transversePeak = sourceC + alongMax * 0.16 + branchSupport * 0.08 - sideMax * 0.94;
    float centerDominance = smoothstep(0.018, 0.22, sourceC - sideNear * 0.72 - sideWide * 0.18);
    float oneSidedSupport = max(sourceA, sourceB);
    float twoSidedSupport = min(sourceA, sourceB) + min(sourceA2, sourceB2) * 0.34;
    float longitudinalSupport = smoothstep(
      0.09,
      0.46,
      sourceC * 0.42 + oneSidedSupport * 0.34 + twoSidedSupport * 0.26 + branchSupport * 0.18
    );
    float physicalCenterPeak = smoothstep(
      0.018,
      0.24,
      sourceC * 1.08 +
      min(sourceA, sourceB) * 0.18 +
      branchSupport * 0.18 -
      sideNear * 0.78 -
      sideWide * 0.3
    );
    float velocityLineSource = smoothstep(
      0.025,
      0.3,
      sourceC +
      oneSidedSupport * 0.18 +
      twoSidedSupport * 0.12 -
      sideMax * 0.7
    );
    float lineNms = smoothstep(0.015, 0.16, transversePeak) * centerDominance * (0.28 + longitudinalSupport * 0.5 + physicalCenterPeak * 0.22);
    float sideReject = smoothstep(
      0.09,
      0.56,
      sideMean + abs(sourceS1 - sourceS2) * 0.12 - max(sourceC, alongMax) * 0.42 - physicalCenterPeak * 0.04
    );
    float centerlineSource = sourceC *
      max(lineNms, physicalCenterPeak * velocityLineSource * (0.52 + longitudinalSupport * 0.34 + branchSupport * 0.14)) *
      (1.0 - sideReject * 0.52);
    float directSource = max(
      sourceC * lineNms * (0.56 + longitudinalSupport * 0.44) * (1.0 - sideReject * 0.34),
      centerlineSource * (0.22 + longitudinalSupport * 0.16)
    );

    float speedStep = transportSpeedAt(uv);
    vec2 transportStep = tangent * uFieldTexel * speedStep;
    vec2 backUv = uv - transportStep;
    vec2 forwardUv = uv + transportStep * 0.92;
    vec4 mapState = huangMapStateAt(uv);
    vec4 forwardMapState = huangForwardMapStateAt(uv);
    vec4 forwardAtBackMap = huangForwardMapStateAt(mapState.rg);
    vec4 backwardAtForwardMap = huangMapStateAt(forwardMapState.rg);
    float backPairError = texelDistance(forwardAtBackMap.rg, uv) / max(1.0, speedStep + 1.0);
    float forwardPairError = texelDistance(backwardAtForwardMap.rg, uv) / max(1.0, speedStep + 1.0);
    float pairMapReject = smoothstep(0.34, 1.32, max(backPairError, forwardPairError * 0.86));
    float backMapConfidence = mapState.b * (1.0 - smoothstep(0.22, 0.82, mapState.a));
    float forwardMapConfidence = forwardMapState.b * (1.0 - smoothstep(0.22, 0.82, forwardMapState.a));
    float pairMapConfidence = min(backMapConfidence, forwardMapConfidence) * (1.0 - pairMapReject);
    float externalMapConfidence = max(backMapConfidence * 0.46, pairMapConfidence);
    vec2 semiBackUv = backUv;
    float mapTransportWeight = clamp(externalMapConfidence * 0.45 + pairMapConfidence * 0.55, 0.0, 1.0);
    vec2 mapBackUv = mix(semiBackUv, mapState.rg, mapTransportWeight);
    float mapReturnError = texelDistance(forwardAtBackMap.rg, uv) / max(1.0, speedStep + 1.0);
    float mapTransportConfidence = mapTransportWeight *
      (1.0 - smoothstep(0.34, 1.24, mapReturnError)) *
      (1.0 - smoothstep(0.22, 0.78, mapState.a));
    backUv = mix(semiBackUv, mapBackUv, 0.72 + mapTransportConfidence * 0.28);
    vec2 backTangent = materialTangentAt(backUv);
    vec2 forwardTangent = materialTangentAt(forwardUv);
    float backSpeedStep = transportSpeedAt(backUv);
    float forwardSpeedStep = transportSpeedAt(forwardUv);
    vec2 backReprojectUv = backUv + backTangent * uFieldTexel * backSpeedStep;
    vec2 forwardBackUv = forwardUv - forwardTangent * uFieldTexel * forwardSpeedStep;
    float backwardMapError = texelDistance(backReprojectUv, uv) / max(1.0, speedStep + 1.0);
    float forwardMapError = texelDistance(forwardBackUv, uv) / max(1.0, speedStep + 1.0);

    vec4 prevC = previousTransportAt(uv);
    vec4 prevBack = previousTransportAt(backUv);
    vec4 prevBack2 = previousTransportAt(uv - tangent * uFieldTexel * (speedStep + 2.0));
    vec4 prevForward = previousTransportAt(forwardUv);
    vec4 prevMapBack = previousTransportAt(mapBackUv);
    vec4 prevPairForward = previousTransportAt(forwardMapState.rg);
    vec4 prevMapBack2 = previousTransportAt(mix(mapBackUv, uv - tangent * uFieldTexel * (speedStep + 2.0), 0.38));
    vec4 prevA = previousTransportAt(uv + alongStep);
    vec4 prevB = previousTransportAt(uv - alongStep);
    vec4 prevS1 = previousTransportAt(uv + sideStep);
    vec4 prevS2 = previousTransportAt(uv - sideStep);
    vec4 prevS3 = previousTransportAt(uv + sideWideStep);
    vec4 prevS4 = previousTransportAt(uv - sideWideStep);
    vec4 prevBranchA = previousTransportAt(uv - branchStepA);
    vec4 prevBranchB = previousTransportAt(uv - branchStepB);
    vec4 prevBranchAheadA = previousTransportAt(uv + branchStepA * 0.82);
    vec4 prevBranchAheadB = previousTransportAt(uv + branchStepB * 0.82);
    float correctedBack = clamp(prevBack.r + (prevC.r - prevForward.r) * 0.32, 0.0, 1.0);
    float correctedAge = clamp(prevBack.b + (prevC.b - prevForward.b) * 0.22, 0.0, 1.0);
    float correctedContinuity = clamp(prevBack.g + (prevC.g - prevForward.g) * 0.22, 0.0, 1.0);
    float mappedBfeccResidual = clamp(prevMapBack.r + (prevC.r - prevPairForward.r) * 0.28, 0.0, 1.0);
    float mappedBfeccAge = clamp(prevMapBack.b + (prevC.b - prevPairForward.b) * 0.18, 0.0, 1.0);
    float mappedBfeccContinuity = clamp(prevMapBack.g + (prevC.g - prevPairForward.g) * 0.16, 0.0, 1.0);
    vec4 mapStateAtBack = huangMapStateAt(mapBackUv);
    vec4 forwardStateAtBack = huangForwardMapStateAt(mapBackUv);
    vec4 prevMaterialParent = previousTransportAt(mapStateAtBack.rg);
    float composedReturnError = texelDistance(forwardStateAtBack.rg, uv) / max(1.0, speedStep + 1.0);
    float mappedSideLeak = max(max(prevS1.r, prevS2.r), max(prevS3.r, prevS4.r) * 0.72);
    float compositionResetReject = smoothstep(
      0.34,
      1.18,
      max(max(composedReturnError, mapReturnError), max(backPairError, forwardPairError) * 0.72)
    );
    float compositionCarryGate =
      pairMapConfidence *
      (1.0 - compositionResetReject) *
      (0.3 + prevMapBack.g * 0.36 + prevMapBack.b * 0.2 + prevMaterialParent.g * 0.14) *
      (1.0 - smoothstep(0.08, 0.46, mappedSideLeak - max(prevMapBack.r, prevMaterialParent.r) * 0.58)) *
      (1.0 - sideReject * 0.18);
    float composedAdvected = max(
      prevMapBack.r * (0.72 + prevMapBack.g * 0.14),
      prevMaterialParent.r * (0.46 + prevMaterialParent.g * 0.18)
    ) * clamp(compositionCarryGate, 0.0, 1.0);
    float mappedNarrowGate = (1.0 - smoothstep(0.08, 0.42, mappedSideLeak - max(prevMapBack.r, mappedBfeccResidual) * 0.55)) *
      (1.0 - smoothstep(0.42, 1.1, mapReturnError)) *
      (0.34 + mappedBfeccContinuity * 0.5 + prevMapBack.b * 0.16) *
      (1.0 - sideReject * 0.24);
    float mapAdvected = max(max(mappedBfeccResidual, prevMapBack2.r * 0.58), composedAdvected) *
      max(mapTransportConfidence * clamp(mappedNarrowGate, 0.0, 1.0), compositionCarryGate * 0.72);
    correctedBack = max(correctedBack, mappedBfeccResidual * (0.44 + mapTransportConfidence * 0.2) * clamp(mappedNarrowGate + 0.18, 0.0, 1.0));
    correctedAge = max(correctedAge, mappedBfeccAge * (0.46 + mapTransportConfidence * 0.18) * clamp(mappedNarrowGate + 0.18, 0.0, 1.0));
    correctedContinuity = max(correctedContinuity, mappedBfeccContinuity * (0.44 + mapTransportConfidence * 0.2));
    float prevBranch = max(max(prevBranchA.r, prevBranchB.r), max(prevBranchAheadA.r, prevBranchAheadB.r) * 0.54);
    float prevBranchContinuity = max(max(prevBranchA.g, prevBranchB.g), max(prevBranchAheadA.g, prevBranchAheadB.g) * 0.5);
    float prevBranchAge = max(max(prevBranchA.b, prevBranchB.b), max(prevBranchAheadA.b, prevBranchAheadB.b) * 0.58);
    float prevAlong = max(max(correctedBack, prevBack2.r * 0.74), max(min(prevA.r, prevB.r) * 0.52, prevBranch * 0.56));
    prevAlong = max(prevAlong, mapAdvected * (0.58 + mappedBfeccContinuity * 0.14));
    float prevSide = max(prevS1.r, prevS2.r);
    float mapRoundTripError = max(max(backwardMapError, forwardMapError * 0.82), max(mapState.a * 1.0, forwardMapState.a * 0.88));
    mapRoundTripError = max(mapRoundTripError, max(max(backPairError, forwardPairError) * 0.72, max(mapReturnError, composedReturnError) * 0.86));
    float externalMapReject = max(smoothstep(0.24, 0.78, max(mapState.a, forwardMapState.a * 0.9)), pairMapReject * 0.72);
    float bfeccError = abs(prevC.r - prevForward.r) * 0.72 +
      abs(prevBack.r - prevBack2.r) * 0.28 +
      mapRoundTripError * 0.34 +
      prevSide * 0.26;
    float bfeccConsistency = (1.0 - smoothstep(0.1, 0.52, bfeccError)) *
      (0.18 + physicalCenterPeak * 0.3 + longitudinalSupport * 0.26 + centerDominance * 0.18) *
      (0.54 + externalMapConfidence * 0.16 + pairMapConfidence * 0.18 + mapTransportConfidence * 0.22);
    float transportedCenterline = max(
      correctedBack * (0.52 + bfeccConsistency * 0.24),
      max(prevBack2.r * 0.44, max(prevBranch * 0.38, max(mapAdvected, composedAdvected) * (0.54 + mappedBfeccContinuity * 0.16 + compositionCarryGate * 0.12)))
    );
    float downstreamSource = max(max(sourceA, sourceB), max(max(sourceA2, sourceB2) * 0.62, branchOneSided * 0.52));
    float bridgePeak = smoothstep(
      0.018,
      0.24,
      sourceC +
      downstreamSource * 0.22 +
      branchSupport * 0.18 -
      sideMax * 0.66
    );
    float bridgeNeighborhood = smoothstep(
      0.024,
      0.26,
      sourceC * 0.62 +
      downstreamSource * 0.24 +
      branchSupport * 0.2 -
      sideMax * 0.58
    );
    float bridgeCoherenceRaw = smoothstep(
      0.035,
      0.34,
      transportedCenterline +
      correctedContinuity * 0.18 +
      prevBranchContinuity * 0.16 +
      mapAdvected * 0.1 +
      composedAdvected * 0.16 +
      downstreamSource * 0.28 +
      branchSupport * 0.22 -
      prevSide * 0.62 -
      sideReject * 0.16 -
      mapRoundTripError * 0.12
    );
    float bridgeCoherence = bridgeCoherenceRaw * bridgeNeighborhood * (0.22 + bridgePeak * 0.36 + longitudinalSupport * 0.24 + bfeccConsistency * 0.18);
    float bridgeSource = sourceC * bridgePeak * bridgeCoherence * (1.0 - sideReject * 0.36);
    float resetGate = smoothstep(
      0.045,
      0.32,
      directSource * 0.86 +
      bridgeSource * 0.48 +
      sourceC * centerDominance * 0.22 +
      centerlineSource * 0.14 +
      branchSupport * 0.12 -
      sideMax * 0.52 -
      sideReject * 0.18
    );
    float source = max(directSource, bridgeSource * 0.72);
    float continuityLineGate = max(lineNms, max(centerDominance * 0.48, bridgeCoherence * (0.28 + longitudinalSupport * 0.48)));
    float historyLineNms = smoothstep(0.025, 0.24, prevAlong + min(prevA.r, prevB.r) * 0.12 + prevBranch * 0.18 - prevSide * 0.82 - mapRoundTripError * 0.08) *
      continuityLineGate * (0.36 + bfeccConsistency * 0.64);
    float historyReject = smoothstep(0.22, 0.74, prevSide - max(prevAlong, source) * 0.6 - bridgeCoherence * 0.08 + sideReject * 0.1 + mapRoundTripError * 0.16);
    float etaGammaSpeed = etaGammaVelocityAt(uv).b;
    float transportSpeedGate = smoothstep(0.045, 0.34, etaGammaSpeed + length(velocity) * 1.7 + sourceC * 0.16);
    float prevSideWide = max(prevS3.r, prevS4.r);
    float incomingFlux = max(
      correctedBack * (0.72 + correctedContinuity * 0.2 + bfeccConsistency * 0.16),
      max(prevBack2.r * (0.46 + prevBack2.g * 0.24), max(prevBranch * 0.38, min(prevA.r, prevB.r) * 0.32))
    );
    incomingFlux = max(incomingFlux, max(mapAdvected, composedAdvected * 1.12) * (0.56 + mappedBfeccContinuity * 0.12 + compositionCarryGate * 0.1));
    float outgoingFlux = max(
      prevC.r * (0.28 + smoothstep(0.035, 0.34, prevForward.r) * 0.34 + transportSpeedGate * 0.12),
      max(prevSide, prevSideWide * 0.72) * 0.16
    );
    float lateralLeak = smoothstep(
      0.055,
      0.46,
      max(prevSide, prevSideWide * 0.78) - max(max(incomingFlux, source), prevAlong * 0.72) * 0.58 + sideReject * 0.12
    );
    float conservativeFluxGate = smoothstep(
      0.028,
      0.34,
      incomingFlux +
      mapAdvected * 0.14 +
      composedAdvected * 0.12 +
      source * 0.34 +
      bridgeCoherence * 0.18 +
      bfeccConsistency * 0.16 -
      max(prevSide, prevSideWide * 0.74) * 0.66 -
      sideReject * 0.2 -
      bfeccError * 0.09 -
      mapRoundTripError * 0.12
    ) * (0.2 + transportSpeedGate * 0.2 + bfeccConsistency * 0.32 + longitudinalSupport * 0.22 + bridgeCoherence * 0.14);
    float conservativeFluxBalance = clamp(
      prevC.r +
      (incomingFlux - outgoingFlux) * (0.28 + transportSpeedGate * 0.18) +
      bridgeSource * 0.1 +
      directSource * lineNms * 0.1 -
      lateralLeak * 0.46 -
      historyReject * 0.16 -
      mapRoundTripError * 0.08,
      0.0,
      1.0
    );
    float transportConfidence = clamp(
      directSource * 0.95 +
      bridgeSource * 0.62 +
      prevAlong * historyLineNms * 0.26 +
      conservativeFluxGate * conservativeFluxBalance * 0.34 +
      bridgeCoherence * sourceC * 0.34 +
      bfeccConsistency * transportedCenterline * 0.36 +
      mapTransportConfidence * mapAdvected * 0.2 +
      compositionCarryGate * composedAdvected * 0.32 +
      mappedBfeccContinuity * mapTransportConfidence * 0.08 +
      externalMapConfidence * transportedCenterline * 0.12 +
      pairMapConfidence * transportedCenterline * 0.22 +
      centerlineSource * 0.12 +
      resetGate * 0.28 -
      sideReject * 0.44 -
      historyReject * 0.28 -
      prevSide * 0.22 -
      mapRoundTripError * 0.22 -
      mapReturnError * 0.08 -
      compositionResetReject * 0.08 -
      externalMapReject * 0.14,
      0.0,
      1.0
    );
    float decay = 1.0 - clamp(uDelta * (0.42 + sideReject * 0.54 + historyReject * 0.58), 0.0, 0.13);
    float advectiveBridge = max(prevAlong * historyLineNms, transportedCenterline * max(bridgeCoherence * 0.38, bfeccConsistency * 0.48));
    advectiveBridge = max(advectiveBridge, max(mapAdvected, composedAdvected) * (0.48 + mapTransportConfidence * 0.12 + compositionCarryGate * 0.16));
    float advected = max(advectiveBridge, correctedBack * 0.32 * continuityLineGate) * decay *
      (1.0 - sideReject * 0.24) *
      (1.0 - historyReject * 0.32) *
      (1.0 - smoothstep(0.55, 1.7, mapRoundTripError) * 0.72) *
      (0.32 + transportConfidence * 0.68);
    float conservativeAdvected = conservativeFluxBalance * conservativeFluxGate * decay *
      (1.0 - lateralLeak * 0.52) *
      (1.0 - historyReject * 0.36) *
      (1.0 - smoothstep(0.42, 1.6, mapRoundTripError) * 0.68) *
      (0.45 + transportConfidence * 0.55);
    float sourceForMaterial = source * (0.46 + lineNms * 0.18 + conservativeFluxGate * 0.18 + resetGate * 0.08 + bfeccConsistency * 0.1) +
      bridgeSource * conservativeFluxGate * 0.1;
    float materialResidual = clamp(max(sourceForMaterial, max(conservativeAdvected, advected * (0.22 + resetGate * 0.34 + bfeccConsistency * 0.08))), 0.0, 1.0);
    materialResidual = max(materialResidual, mapAdvected * (0.34 + bfeccConsistency * 0.22 + historyLineNms * 0.16));
    materialResidual = max(materialResidual, composedAdvected * (0.48 + compositionCarryGate * 0.26 + bfeccConsistency * 0.12));
    float continuityEvidence = (
      alongMax * 0.34 +
      branchSupport * 0.2 +
      prevAlong * 0.26 +
      incomingFlux * conservativeFluxGate * 0.26 +
      prevBranch * 0.2 +
      correctedContinuity * 0.18 +
      sourceForMaterial * 0.42 +
      centerlineSource * 0.08 +
      bfeccConsistency * transportedCenterline * 0.22 +
      mappedBfeccContinuity * mapTransportConfidence * 0.18 +
      mapAdvected * 0.12 +
      composedAdvected * 0.2 +
      compositionCarryGate * 0.12 +
      bridgeCoherence * resetGate * 0.14 -
      mapRoundTripError * 0.12
    );
    float alongContinuity = smoothstep(
      0.01,
      0.42,
      continuityEvidence *
      (0.16 + continuityLineGate * 0.62 + transportConfidence * 0.22)
    );
    float ageCarrier = max(max(correctedAge, prevBack2.b * 0.82), max(prevBranchAge * 0.68, max(mappedBfeccAge * mapTransportConfidence, prevMapBack.b * compositionCarryGate)));
    float age = clamp(
      max(
        source * 0.72,
        ageCarrier * decay * max(historyLineNms * transportConfidence, bridgeCoherence * resetGate)
      ) +
      materialResidual * 0.05 -
      sideReject * 0.08 -
      historyReject * 0.03,
      0.0,
      1.0
    );
    float mappingConfidence = clamp(
      bfeccConsistency * 0.44 +
      transportConfidence * 0.28 +
      alongContinuity * 0.2 +
      mapTransportConfidence * 0.12 +
      compositionCarryGate * 0.18 +
      resetGate * 0.08 - 
      smoothstep(0.38, 1.4, mapRoundTripError) * 0.34,
      0.0,
      1.0
    );
    mappingConfidence = clamp(mappingConfidence + externalMapConfidence * 0.12 + pairMapConfidence * 0.18 + compositionCarryGate * 0.12 - externalMapReject * 0.14, 0.0, 1.0);
    float combinedReject = clamp(max(sideReject * 0.78, historyReject * 0.56) + (1.0 - transportConfidence) * 0.08 + smoothstep(0.42, 1.55, mapRoundTripError) * 0.28 + externalMapReject * 0.14 + compositionResetReject * 0.08 - bridgeCoherence * resetGate * 0.05 - mapTransportConfidence * mapAdvected * 0.04 - compositionCarryGate * composedAdvected * 0.08, 0.0, 1.0);
    gl_FragColor = vec4(materialResidual, mappingConfidence, age, combinedReject);
  }
`;

const HUANG_FRONT_STATE_FRAGMENT_SHADER = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uField;
  uniform sampler2D uVelocity;
  uniform sampler2D uHuangLocalDiagnostic;
  uniform sampler2D uPreviousFront;
  uniform sampler2D uGammaCandidate;
  uniform sampler2D uEtaGammaVelocity;
  uniform sampler2D uTransportResidual;
  uniform sampler2D uHuangMapState;
  uniform sampler2D uHuangForwardMapState;
  uniform vec2 uFieldTexel;
  uniform vec2 uTileTexel;
  uniform float uDelta;
  uniform float uFlowDirection;

  const float HUANG_FRONT_PI = 3.141592653589793;

  vec3 sphericalSampleUv(vec2 uv) {
    float x = uv.x;
    float y = uv.y;
    float poleCross = 0.0;
    if (y < 0.0) {
      y = -y;
      x += 0.5;
      poleCross = 1.0;
    }
    if (y > 1.0) {
      y = 2.0 - y;
      x += 0.5;
      poleCross = 1.0;
    }
    return vec3(fract(x), clamp(y, 0.002, 0.998), poleCross);
  }

  vec2 sampleUv(vec2 uv) {
    return sphericalSampleUv(uv).xy;
  }

  vec4 fieldAt(vec2 uv) {
    return texture2D(uField, sampleUv(uv));
  }

  vec2 velocityAt(vec2 uv) {
    vec3 sphereUv = sphericalSampleUv(uv);
    vec2 velocity = (texture2D(uVelocity, sphereUv.xy).rg - 0.5) * 0.5;
    return mix(velocity, -velocity, sphereUv.z);
  }

  vec4 huangAt(vec2 uv) {
    return texture2D(uHuangLocalDiagnostic, sampleUv(uv));
  }

  vec4 gammaCandidateAt(vec2 uv) {
    return texture2D(uGammaCandidate, sampleUv(uv));
  }

  vec4 etaGammaVelocityAt(vec2 uv) {
    return texture2D(uEtaGammaVelocity, sampleUv(uv));
  }

  vec4 transportResidualAt(vec2 uv) {
    return texture2D(uTransportResidual, sampleUv(uv));
  }

  vec4 huangMapStateAt(vec2 uv) {
    return texture2D(uHuangMapState, sampleUv(uv));
  }

  vec4 huangForwardMapStateAt(vec2 uv) {
    return texture2D(uHuangForwardMapState, sampleUv(uv));
  }

  vec4 previousFrontAt(vec2 uv) {
    return texture2D(uPreviousFront, sampleUv(uv));
  }

  float storedDistance(vec4 state) {
    float initialized = step(0.001, state.r + state.g + state.b + state.a);
    return mix(1.0, state.r, initialized);
  }

  float sphereSinAt(vec2 uv) {
    return max(0.22, sin(sampleUv(uv).y * HUANG_FRONT_PI));
  }

  float phiDerivativeScale() {
    return min(4.5, 1.0 / max(0.0001, 4.0 * HUANG_FRONT_PI * uFieldTexel.x));
  }

  float thetaDerivativeScale() {
    return min(4.5, 1.0 / max(0.0001, 2.0 * HUANG_FRONT_PI * uFieldTexel.y));
  }

  vec2 sphericalGradient(float leftValue, float rightValue, float downValue, float upValue, vec2 uv) {
    float sinTheta = sphereSinAt(uv);
    return vec2(
      (rightValue - leftValue) * 0.5 * phiDerivativeScale() / sinTheta,
      (upValue - downValue) * 0.5 * thetaDerivativeScale()
    );
  }

  float sphericalLaplacian(float centerValue, float leftValue, float rightValue, float downValue, float upValue, vec2 uv) {
    float sinC = sphereSinAt(uv);
    float sinD = sphereSinAt(uv - vec2(0.0, uFieldTexel.y));
    float sinU = sphereSinAt(uv + vec2(0.0, uFieldTexel.y));
    float phiScale = phiDerivativeScale();
    float thetaScale = thetaDerivativeScale();
    float phiCurvature = (leftValue + rightValue - centerValue * 2.0) * phiScale * phiScale / (sinC * sinC);
    float thetaCurvature = (sinU * (upValue - centerValue) - sinD * (centerValue - downValue)) * thetaScale * thetaScale / sinC;
    return phiCurvature + thetaCurvature;
  }

  float sphericalVelocityDivergence(vec2 uv, vec2 leftV, vec2 rightV, vec2 downV, vec2 upV) {
    float sinC = sphereSinAt(uv);
    float sinD = sphereSinAt(uv - vec2(0.0, uFieldTexel.y));
    float sinU = sphereSinAt(uv + vec2(0.0, uFieldTexel.y));
    float phiDiv = (rightV.x - leftV.x) * phiDerivativeScale() / sinC;
    float thetaDiv = (sinU * upV.y - sinD * downV.y) * thetaDerivativeScale() / sinC;
    return phiDiv + thetaDiv;
  }

  float lineScalar(vec4 evidence) {
    return clamp(
      evidence.a * 0.66 +
      evidence.r * evidence.b * 0.22 +
      evidence.g * evidence.b * 0.12,
      0.0,
      1.0
    );
  }

  float gammaResidualScalar(vec4 candidate) {
    float candidateDivergence = (candidate.g - 0.5) / 8.0;
    float gammaRhsResidual = (candidate.b - 0.5) / 18.0;
    float residualLine = smoothstep(0.0012, 0.026, abs(gammaRhsResidual) + candidate.a * 0.018);
    float residualCompression = smoothstep(0.0008, 0.042, max(0.0, -candidateDivergence) + abs(gammaRhsResidual) * 0.35);
    return residualLine * residualCompression;
  }

  float etaGammaLineScalar(vec4 etaGammaVelocity) {
    float projectedDivergence = (etaGammaVelocity.a - 0.5) / 2.8;
    float compression = max(0.0, -projectedDivergence);
    float speedGate = smoothstep(0.035, 0.22, etaGammaVelocity.b);
    float continuityLine = smoothstep(0.0008, 0.034, compression + abs(projectedDivergence) * 0.22);
    return continuityLine * (0.34 + speedGate * 0.66);
  }

  float materialMapStepScale(vec2 uv) {
    vec2 velocity = velocityAt(uv);
    float etaGammaSpeed = etaGammaVelocityAt(uv).b;
    return max(1.0, 0.35 + clamp(length(velocity) * 14.0 + etaGammaSpeed * 1.7 + uDelta * 36.0, 0.0, 4.5) + 1.0);
  }

  float mapStateConfidence(vec4 mapState) {
    return clamp(mapState.b * (1.0 - smoothstep(0.22, 0.82, mapState.a)), 0.0, 1.0);
  }

  float mapPairConfidence(vec4 backState, vec4 forwardState, vec2 uv) {
    vec4 forwardAtBack = huangForwardMapStateAt(backState.rg);
    vec4 backAtForward = huangMapStateAt(forwardState.rg);
    vec2 backPairDelta = sampleUv(forwardAtBack.rg) - sampleUv(uv);
    vec2 forwardPairDelta = sampleUv(backAtForward.rg) - sampleUv(uv);
    backPairDelta.x = min(abs(backPairDelta.x), 1.0 - abs(backPairDelta.x));
    forwardPairDelta.x = min(abs(forwardPairDelta.x), 1.0 - abs(forwardPairDelta.x));
    float pairError = max(length(backPairDelta / uFieldTexel), length(forwardPairDelta / uFieldTexel) * 0.86) / materialMapStepScale(uv);
    return min(mapStateConfidence(backState), mapStateConfidence(forwardState)) * (1.0 - smoothstep(0.34, 1.32, pairError));
  }

  float transportedResidualScalar(vec4 residualState, vec4 mapState, vec4 forwardMapState, vec2 uv) {
    float mapTransportConfidence = mapStateConfidence(mapState);
    float forwardMapTransportConfidence = mapStateConfidence(forwardMapState);
    float pairConfidence = mapPairConfidence(mapState, forwardMapState, uv);
    float mapReject = smoothstep(0.24, 0.78, max(mapState.a, forwardMapState.a * 0.9));
    float mapConfidence = residualState.g * (1.0 - smoothstep(0.34, 0.82, residualState.a));
    float confidence = clamp(
      mapConfidence * 0.58 +
      mapTransportConfidence * 0.16 +
      forwardMapTransportConfidence * 0.1 +
      pairConfidence * 0.24 +
      residualState.b * 0.2 +
      residualState.r * 0.1 -
      residualState.a * 0.42 -
      mapReject * 0.22,
      0.0,
      1.0
    );
    return clamp(
      residualState.r *
      (0.12 + confidence * 0.88) *
      (1.0 - smoothstep(0.28, 0.84, residualState.a + mapReject * 0.18) * 0.72),
      0.0,
      1.0
    );
  }

  void main() {
    vec2 uv = vUv;
    vec4 c = fieldAt(uv);
    vec4 l = fieldAt(uv - vec2(uFieldTexel.x, 0.0));
    vec4 r = fieldAt(uv + vec2(uFieldTexel.x, 0.0));
    vec4 d = fieldAt(uv - vec2(0.0, uFieldTexel.y));
    vec4 u = fieldAt(uv + vec2(0.0, uFieldTexel.y));
    vec2 gradEta = sphericalGradient(l.r, r.r, d.r, u.r, uv);
    vec2 gradGamma = sphericalGradient(l.g, r.g, d.g, u.g, uv);
    float lapEta = sphericalLaplacian(c.r, l.r, r.r, d.r, u.r, uv);
    float lapGamma = sphericalLaplacian(c.g, l.g, r.g, d.g, u.g, uv);
    vec2 velocity = velocityAt(uv);
    vec2 vL = velocityAt(uv - vec2(uFieldTexel.x, 0.0));
    vec2 vR = velocityAt(uv + vec2(uFieldTexel.x, 0.0));
    vec2 vD = velocityAt(uv - vec2(0.0, uFieldTexel.y));
    vec2 vU = velocityAt(uv + vec2(0.0, uFieldTexel.y));
    float divergence = sphericalVelocityDivergence(uv, vL, vR, vD, vU);
    float compression = max(0.0, -divergence);
    float shear = length(vR - vL) + length(vU - vD);
    vec2 globalFlowDir = normalize(vec2(cos(uFlowDirection), sin(uFlowDirection)));
    vec2 gammaTangent = normalize(vec2(-gradGamma.y, gradGamma.x) + vec2(0.001, -0.001));
    vec2 tangent = normalize(
      globalFlowDir * 0.18 +
      velocity * 3.4 +
      gammaTangent * (0.42 + smoothstep(0.003, 0.08, length(gradGamma)) * 0.7) +
      vec2(0.001, -0.001)
    );
    if (dot(tangent, globalFlowDir) < -0.42) tangent *= -1.0;
    vec2 sideDir = vec2(-tangent.y, tangent.x);

    vec2 alongStep = tangent * uTileTexel * 2.0;
    vec2 alongWideStep = tangent * uTileTexel * 5.0;
    vec2 sideStep = sideDir * uTileTexel * 2.0;
    vec2 sideWideStep = sideDir * uTileTexel * 5.0;

    vec4 hC = huangAt(uv);
    vec4 hA = huangAt(uv + alongStep);
    vec4 hB = huangAt(uv - alongStep);
    vec4 hA2 = huangAt(uv + alongWideStep);
    vec4 hB2 = huangAt(uv - alongWideStep);
    vec4 hS1 = huangAt(uv + sideStep);
    vec4 hS2 = huangAt(uv - sideStep);
    vec4 hS3 = huangAt(uv + sideWideStep);
    vec4 hS4 = huangAt(uv - sideWideStep);
    vec4 gammaCandidate = gammaCandidateAt(uv);
    vec4 gammaA = gammaCandidateAt(uv + alongStep);
    vec4 gammaB = gammaCandidateAt(uv - alongStep);
    vec4 gammaA2 = gammaCandidateAt(uv + alongWideStep);
    vec4 gammaB2 = gammaCandidateAt(uv - alongWideStep);
    vec4 gammaS1 = gammaCandidateAt(uv + sideStep);
    vec4 gammaS2 = gammaCandidateAt(uv - sideStep);
    vec4 gammaS3 = gammaCandidateAt(uv + sideWideStep);
    vec4 gammaS4 = gammaCandidateAt(uv - sideWideStep);
    vec4 etaGammaVelocity = etaGammaVelocityAt(uv);
    vec4 etaGammaA = etaGammaVelocityAt(uv + alongStep);
    vec4 etaGammaB = etaGammaVelocityAt(uv - alongStep);
    vec4 etaGammaA2 = etaGammaVelocityAt(uv + alongWideStep);
    vec4 etaGammaB2 = etaGammaVelocityAt(uv - alongWideStep);
    vec4 etaGammaS1 = etaGammaVelocityAt(uv + sideStep);
    vec4 etaGammaS2 = etaGammaVelocityAt(uv - sideStep);
    vec4 etaGammaS3 = etaGammaVelocityAt(uv + sideWideStep);
    vec4 etaGammaS4 = etaGammaVelocityAt(uv - sideWideStep);
    vec4 transported = transportResidualAt(uv);
    vec4 transportedA = transportResidualAt(uv + alongStep);
    vec4 transportedB = transportResidualAt(uv - alongStep);
    vec4 transportedA2 = transportResidualAt(uv + alongWideStep);
    vec4 transportedB2 = transportResidualAt(uv - alongWideStep);
    vec4 transportedS1 = transportResidualAt(uv + sideStep);
    vec4 transportedS2 = transportResidualAt(uv - sideStep);
    vec4 transportedS3 = transportResidualAt(uv + sideWideStep);
    vec4 transportedS4 = transportResidualAt(uv - sideWideStep);
    vec4 mapState = huangMapStateAt(uv);
    vec4 forwardMapState = huangForwardMapStateAt(uv);
    vec4 mapA = huangMapStateAt(uv + alongStep);
    vec4 mapB = huangMapStateAt(uv - alongStep);
    vec4 mapA2 = huangMapStateAt(uv + alongWideStep);
    vec4 mapB2 = huangMapStateAt(uv - alongWideStep);
    vec4 mapS1 = huangMapStateAt(uv + sideStep);
    vec4 mapS2 = huangMapStateAt(uv - sideStep);
    vec4 mapS3 = huangMapStateAt(uv + sideWideStep);
    vec4 mapS4 = huangMapStateAt(uv - sideWideStep);
    vec4 forwardMapA = huangForwardMapStateAt(uv + alongStep);
    vec4 forwardMapB = huangForwardMapStateAt(uv - alongStep);
    vec4 forwardMapA2 = huangForwardMapStateAt(uv + alongWideStep);
    vec4 forwardMapB2 = huangForwardMapStateAt(uv - alongWideStep);
    vec4 forwardMapS1 = huangForwardMapStateAt(uv + sideStep);
    vec4 forwardMapS2 = huangForwardMapStateAt(uv - sideStep);
    vec4 forwardMapS3 = huangForwardMapStateAt(uv + sideWideStep);
    vec4 forwardMapS4 = huangForwardMapStateAt(uv - sideWideStep);
    float hLine = lineScalar(hC);
    float hAlong = (
      hLine * 1.25 +
      lineScalar(hA) +
      lineScalar(hB) +
      lineScalar(hA2) * 0.54 +
      lineScalar(hB2) * 0.54
    ) / 4.33;
    float hAcross = (
      lineScalar(hS1) +
      lineScalar(hS2) +
      lineScalar(hS3) * 0.58 +
      lineScalar(hS4) * 0.58
    ) / 3.16;
    float eta = max(c.r, 0.035);
    float gammaAcrossPeak = abs(dot(gradGamma, sideDir)) / eta;
    float gammaAlongLeak = abs(dot(gradGamma, tangent)) / eta;
    float etaAcrossPeak = abs(dot(gradEta, sideDir));
    float etaAlongLeak = abs(dot(gradEta, tangent));
    float gammaPeakGate = smoothstep(0.005, 0.095, gammaAcrossPeak - gammaAlongLeak * 0.45 + abs(lapGamma) * 0.05);
    float etaCurveGate = smoothstep(0.01, 0.15, etaAcrossPeak * 1.1 - etaAlongLeak * 0.42 + abs(lapEta) * 0.065) *
      (1.0 - smoothstep(0.84, 0.98, c.r));
    float compressionGate = smoothstep(0.0045, 0.08, compression + shear * 0.085);
    float candidateDivergence = (gammaCandidate.g - 0.5) / 8.0;
    float gammaRhsResidual = (gammaCandidate.b - 0.5) / 18.0;
    float gammaDeltaEncoded = gammaCandidate.a;
    float etaGammaProjectedDivergence = (etaGammaVelocity.a - 0.5) / 2.8;
    float etaGammaCompressionGate = smoothstep(0.0008, 0.035, max(0.0, -etaGammaProjectedDivergence));
    float etaGammaVelocityGate = smoothstep(0.035, 0.22, etaGammaVelocity.b);
    float residualLineGate = smoothstep(0.0012, 0.026, abs(gammaRhsResidual) + gammaDeltaEncoded * 0.018);
    float residualCompressionGate = smoothstep(0.0008, 0.042, max(0.0, -candidateDivergence) + abs(gammaRhsResidual) * 0.35);
    float residualCenter = residualLineGate * residualCompressionGate;
    float residualAlong = max(
      max(gammaResidualScalar(gammaA), gammaResidualScalar(gammaB)),
      max(gammaResidualScalar(gammaA2), gammaResidualScalar(gammaB2)) * 0.72
    );
    float residualSide = max(
      max(gammaResidualScalar(gammaS1), gammaResidualScalar(gammaS2)),
      max(gammaResidualScalar(gammaS3), gammaResidualScalar(gammaS4)) * 0.72
    );
    float etaGammaCenter = etaGammaLineScalar(etaGammaVelocity);
    float etaGammaAlong = max(
      max(etaGammaLineScalar(etaGammaA), etaGammaLineScalar(etaGammaB)),
      max(etaGammaLineScalar(etaGammaA2), etaGammaLineScalar(etaGammaB2)) * 0.72
    );
    float etaGammaSide = max(
      max(etaGammaLineScalar(etaGammaS1), etaGammaLineScalar(etaGammaS2)),
      max(etaGammaLineScalar(etaGammaS3), etaGammaLineScalar(etaGammaS4)) * 0.72
    );
    float instantResidualCenter = max(residualCenter, etaGammaCenter);
    float instantResidualAlong = max(residualAlong, etaGammaAlong);
    float instantResidualSide = max(residualSide, etaGammaSide);
    float materialResidualCenter = transportedResidualScalar(transported, mapState, forwardMapState, uv);
    float materialResidualAlong = max(
      max(
        transportedResidualScalar(transportedA, mapA, forwardMapA, uv + alongStep),
        transportedResidualScalar(transportedB, mapB, forwardMapB, uv - alongStep)
      ),
      max(
        transportedResidualScalar(transportedA2, mapA2, forwardMapA2, uv + alongWideStep),
        transportedResidualScalar(transportedB2, mapB2, forwardMapB2, uv - alongWideStep)
      ) * 0.74
    );
    float materialResidualSide = max(
      max(
        transportedResidualScalar(transportedS1, mapS1, forwardMapS1, uv + sideStep),
        transportedResidualScalar(transportedS2, mapS2, forwardMapS2, uv - sideStep)
      ),
      max(
        transportedResidualScalar(transportedS3, mapS3, forwardMapS3, uv + sideWideStep),
        transportedResidualScalar(transportedS4, mapS4, forwardMapS4, uv - sideWideStep)
      ) * 0.74
    );
    float mapTransportConfidence = mapStateConfidence(mapState);
    float mapAlongConfidence = max(
      max(mapStateConfidence(mapA), mapStateConfidence(mapB)),
      max(mapStateConfidence(mapA2), mapStateConfidence(mapB2)) * 0.72
    );
    float mapSideReject = max(
      max(smoothstep(0.24, 0.78, mapS1.a), smoothstep(0.24, 0.78, mapS2.a)),
      max(smoothstep(0.24, 0.78, mapS3.a), smoothstep(0.24, 0.78, mapS4.a)) * 0.72
    );
    float transportMapConfidence = clamp(
      transported.g * (1.0 - smoothstep(0.32, 0.82, transported.a)) +
      mapTransportConfidence * 0.36 +
      mapAlongConfidence * 0.16 +
      transported.b * 0.14 +
      materialResidualCenter * 0.08,
      0.0,
      1.0
    );
    float transportErrorReject = smoothstep(
      0.24,
      0.78,
      transported.a + materialResidualSide * 0.22 + max(transportedS1.a, transportedS2.a) * 0.08 + mapSideReject * 0.18
    );
    float transportLineContinuity = clamp(
      transportMapConfidence * 0.5 +
      transported.b * 0.26 +
      materialResidualAlong * 0.22 +
      max(transportedA.g, transportedB.g) * 0.16 -
      materialResidualSide * 0.32 -
      transportErrorReject * 0.34 -
      mapSideReject * 0.12,
      0.0,
      1.0
    );
    float transportBridgeGate = smoothstep(
      0.045,
      0.42,
      materialResidualCenter * 0.5 +
      materialResidualAlong * 0.34 +
      transportLineContinuity * 0.32 +
      transportMapConfidence * 0.18 +
      mapAlongConfidence * 0.12 +
      max(transportedA.b, transportedB.b) * 0.16 -
      materialResidualSide * 0.46 -
      transportErrorReject * 0.3
    );
    float materialLineGate = clamp(
      transportLineContinuity * 0.5 +
      transportBridgeGate * 0.36 +
      transportMapConfidence * 0.22 +
      mapTransportConfidence * 0.12 +
      materialResidualCenter * 0.24 +
      max(transportedA.b, transportedB.b) * 0.12 -
      materialResidualSide * 0.38 -
      transportErrorReject * 0.28,
      0.0,
      1.0
    );
    float materialFluxGate = smoothstep(
      0.035,
      0.38,
      materialResidualCenter +
      transportLineContinuity * 0.34 +
      transportMapConfidence * 0.24 +
      mapTransportConfidence * 0.14 +
      transported.b * 0.22 +
      materialResidualAlong * 0.18 -
      materialResidualSide * 0.62 -
      transportErrorReject * 0.38
    ) * (0.42 + materialLineGate * 0.36 + transportBridgeGate * 0.22);
    float pairCenterConfidence = mapPairConfidence(mapState, forwardMapState, uv);
    float materialCenterScore = clamp(
      materialResidualCenter * 0.58 +
      instantResidualCenter * 0.32 +
      hLine * 0.22 +
      max(gammaPeakGate, etaCurveGate) * 0.18 +
      etaGammaCenter * 0.18,
      0.0,
      1.0
    );
    float materialAlongScore = clamp(
      materialResidualAlong * 0.52 +
      instantResidualAlong * 0.26 +
      hAlong * 0.2 +
      transportLineContinuity * 0.16,
      0.0,
      1.0
    );
    float materialSideScore = clamp(
      materialResidualSide * 0.64 +
      instantResidualSide * 0.3 +
      hAcross * 0.34 +
      mapSideReject * 0.18 +
      transportErrorReject * 0.16,
      0.0,
      1.0
    );
    float huangNmsCenter = smoothstep(
      0.014,
      0.22,
      materialCenterScore + materialAlongScore * 0.2 - materialSideScore * 0.78
    );
    float huangCenterRank = smoothstep(0.008, 0.18, materialCenterScore - materialSideScore * 0.42);
    float huangLineNmsGate = clamp(
      huangNmsCenter *
      huangCenterRank *
      (0.22 + transportLineContinuity * 0.28 + materialFluxGate * 0.24 + pairCenterConfidence * 0.24 + mapTransportConfidence * 0.12),
      0.0,
      1.0
    );
    float huangWideReject = smoothstep(
      0.12,
      0.52,
      materialSideScore +
      hAcross * 0.28 +
      instantResidualSide * 0.16 -
      materialCenterScore * 0.58 -
      materialAlongScore * 0.12
    );
    float huangLineSelector = clamp(
      max(
        huangLineNmsGate,
        huangNmsCenter * 0.22 +
        huangCenterRank * 0.18 +
        materialFluxGate * transportLineContinuity * 0.12
      ) *
      (1.0 - huangWideReject * 0.28),
      0.0,
      1.0
    );
    float transportResidualCenter = max(materialResidualCenter * (0.78 + transportBridgeGate * 0.28), instantResidualCenter * 0.28);
    float transportResidualAlong = max(materialResidualAlong * (0.82 + transportBridgeGate * 0.2), instantResidualAlong * 0.24);
    float transportResidualSide = max(materialResidualSide * 0.78, instantResidualSide * 0.42);
    float residualLocalMax = smoothstep(
      0.002,
      0.065,
      transportResidualCenter + transportResidualAlong * 0.16 + transportBridgeGate * 0.04 - transportResidualSide * 0.68
    );
    float residualSourceBudget = clamp(
      1.0 - smoothstep(0.24, 0.68, hAcross + transportResidualSide * 0.14 + max(0.0, hAcross - hAlong * 0.5)),
      0.0,
      1.0
    );
    float residualFrontGate = transportResidualCenter * residualLocalMax * residualSourceBudget *
      (0.14 + max(max(gammaPeakGate, etaCurveGate), etaGammaVelocityGate) * 0.34 + transportResidualAlong * 0.06 + transportBridgeGate * 0.07 + materialFluxGate * 0.14 + hLine * 0.07) *
      (0.84 + materialFluxGate * 0.12 + transportLineContinuity * 0.04) *
      (1.0 - huangWideReject * 0.06);
    compressionGate = max(
      compressionGate,
      max(residualCompressionGate * (0.42 + residualLineGate * 0.36), etaGammaCompressionGate * (0.38 + etaGammaVelocityGate * 0.36))
    );
    float twoOfThreeGate = max(
      min(gammaPeakGate, etaCurveGate),
      max(min(gammaPeakGate, compressionGate), min(etaCurveGate, compressionGate))
    );
    twoOfThreeGate = max(twoOfThreeGate, residualFrontGate * 0.28);
    twoOfThreeGate = max(twoOfThreeGate, transportBridgeGate * materialResidualCenter * materialFluxGate * 0.24);
    float lineWidthReject = smoothstep(0.05, 0.36, hAcross - hAlong * 0.42);
    float bidirectionalAlong = min(hA.a, hB.a) * 0.72 + min(hA2.a, hB2.a) * 0.24 + hLine * 0.22;
    float oneSidedAlong = max(hA.a, hB.a) * 0.36 + max(hA2.a, hB2.a) * 0.14 + hLine * 0.18 + length(velocity) * 0.22;
    float alongContinuity = smoothstep(0.01, 0.32, max(bidirectionalAlong, oneSidedAlong));
    float sideReject = smoothstep(0.065, 0.45, hAcross - hAlong * 0.58);
    float localSeedRaw = smoothstep(
      0.008,
      0.3,
      hLine +
      max(min(hA.a, hB.a) * 0.42, max(hA.a, hB.a) * 0.24) +
      max(min(hA2.a, hB2.a) * 0.18, max(hA2.a, hB2.a) * 0.1) -
      hAcross * 0.78
    ) * (0.38 + alongContinuity * 0.62);
    float physicsCoherence = smoothstep(0.12, 0.5, twoOfThreeGate + hLine * 0.2 + min(hA.a, hB.a) * 0.14);
    float localSeed = localSeedRaw *
      (0.28 + twoOfThreeGate * 0.72) *
      physicsCoherence *
      (1.0 - sideReject * 0.56) *
      (1.0 - lineWidthReject * 0.52);
    float residualSeed = residualFrontGate *
      (0.2 + alongContinuity * 0.28 + transportBridgeGate * 0.12 + materialFluxGate * 0.18 + etaGammaVelocityGate * 0.12 + hLine * 0.1) *
      (1.0 - sideReject * 0.52) *
      (1.0 - lineWidthReject * 0.44);
    localSeed *= (0.92 + huangLineSelector * 0.08) * (1.0 - huangWideReject * 0.05);
    residualSeed *= (0.9 + materialFluxGate * 0.08 + huangLineSelector * 0.02) * (1.0 - huangWideReject * 0.06);
    localSeed = max(localSeed, residualSeed * (0.36 + materialFluxGate * 0.28));

    float speedStep = 1.0 + clamp(length(velocity) * 18.0 + uDelta * 90.0, 0.0, 5.5);
    vec4 prevC = previousFrontAt(uv);
    vec4 prevBack = previousFrontAt(uv - tangent * uTileTexel * speedStep);
    vec4 prevBack2 = previousFrontAt(uv - tangent * uTileTexel * (speedStep + 2.0));
    vec4 prevFront = previousFrontAt(uv + tangent * uTileTexel * 1.5);
    vec4 prevA = previousFrontAt(uv + alongStep);
    vec4 prevB = previousFrontAt(uv - alongStep);
    vec4 prevA2 = previousFrontAt(uv + alongWideStep);
    vec4 prevB2 = previousFrontAt(uv - alongWideStep);
    vec4 prevS1 = previousFrontAt(uv + sideStep);
    vec4 prevS2 = previousFrontAt(uv - sideStep);
    vec4 prevS3 = previousFrontAt(uv + sideWideStep);
    vec4 prevS4 = previousFrontAt(uv - sideWideStep);

    float prevAlongOcc = max(
      max(max(prevBack.g, prevFront.g * 0.88), max(prevA.g, prevB.g)),
      max(prevA2.g, prevB2.g) * 0.78
    );
    float prevSideOcc = max(max(prevS1.g, prevS2.g), max(prevS3.g, prevS4.g) * 0.76);
    float prevAlongAge = max(
      max(max(prevBack.b, prevFront.b * 0.88), max(prevA.b, prevB.b)),
      max(prevA2.b, prevB2.b) * 0.78
    );
    float historyWideReject = smoothstep(0.08, 0.46, hAcross - hAlong * 0.42 + prevSideOcc * 0.16 + sideReject * 0.1);
    historyWideReject = clamp(max(historyWideReject, huangWideReject * (0.06 + prevSideOcc * 0.03)), 0.0, 1.0);
    localSeed *= (1.0 - historyWideReject * 0.52);
    float sourceBudget = clamp(
      1.0 - smoothstep(0.28, 0.72, hAcross + prevSideOcc * 0.32 + transportResidualSide * 0.14 + sideReject * 0.1),
      0.0,
      1.0
    );
    float fluxTransportGate = clamp(
      (0.26 + twoOfThreeGate * 0.3 + alongContinuity * 0.18 + transportResidualAlong * 0.08 + transportBridgeGate * 0.08 + etaGammaVelocityGate * 0.1 + materialFluxGate * 0.18) *
      (1.0 - sideReject * 0.54) *
      (1.0 - historyWideReject * 0.56) *
      (1.0 - prevSideOcc * 0.34) *
      (1.0 - transportResidualSide * 0.26),
      0.0,
      1.0
    );
    fluxTransportGate *= (0.94 + materialFluxGate * 0.05 + huangLineSelector * 0.01) * (1.0 - huangWideReject * 0.05);
    float upwindOccupancy = max(
      prevBack.g * 1.06,
      max(prevBack2.g * 0.86, min(prevA.g, prevB.g) * 0.48)
    );
    float advectedOccupancy = upwindOccupancy * (0.24 + fluxTransportGate * 0.92) * (1.0 - historyWideReject * 0.2);
    float advectedLineGate = clamp(
      huangLineSelector * 0.06 +
      materialFluxGate * transportLineContinuity * 0.32 +
      residualFrontGate * 0.18 +
      localSeed * 0.18 -
      huangWideReject * 0.04,
      0.0,
      1.0
    );
    advectedOccupancy *= (0.54 + advectedLineGate * 0.46);
    float residualTransportMemory = max(prevBack.g * 0.92, max(prevBack.b * 0.68, prevBack2.g * 0.72)) *
      (0.18 + transportResidualAlong * 0.14 + transportBridgeGate * 0.1 + etaGammaVelocityGate * 0.2 + twoOfThreeGate * 0.1 + materialFluxGate * 0.18) *
      (1.0 - transportResidualSide * 0.34) *
      (1.0 - historyWideReject * 0.34);
    residualTransportMemory *= (0.5 + advectedLineGate * 0.5);
    advectedOccupancy = max(advectedOccupancy, residualTransportMemory);
    float continuityGate = smoothstep(
      0.035,
      0.48,
      localSeed * 0.62 +
      prevAlongOcc * 0.7 +
      prevAlongAge * 0.22 - 
      prevSideOcc * 0.5 - 
      sideReject * 0.26 - 
      historyWideReject * 0.18 +
      transportBridgeGate * 0.18 +
      materialFluxGate * 0.14
    );
    float travelCost = 0.028 + sideReject * 0.22 + max(0.0, hAcross - hAlong * 0.52) * 0.24 + (1.0 - alongContinuity) * 0.02;
    float advectedDistance = min(
      min(storedDistance(prevBack), storedDistance(prevC) + 0.018),
      min(storedDistance(prevA), storedDistance(prevB)) + 0.012
    ) + travelCost;
    advectedDistance = min(advectedDistance, min(storedDistance(prevA2), storedDistance(prevB2)) + travelCost + 0.02);
    float seedDistance = mix(1.0, 0.035, localSeed);
    float distance = clamp(min(seedDistance, advectedDistance), 0.0, 1.0);
    float alongSmoothDistance = min(
      distance,
      min(
        (storedDistance(prevA) + storedDistance(prevB)) * 0.5 + 0.016,
        (storedDistance(prevA2) + storedDistance(prevB2)) * 0.5 + 0.028
      )
    );
    distance = mix(distance, alongSmoothDistance, clamp(continuityGate * (0.22 + twoOfThreeGate * 0.78) * (1.0 - historyWideReject * 0.7) * 0.35, 0.0, 0.35));
    float distanceOccupancy = smoothstep(0.54, 0.1, distance);
    float narrowStateGate = clamp((0.28 + twoOfThreeGate * 0.72) * (1.0 - sideReject * 0.32) * (1.0 - historyWideReject * 0.42), 0.0, 1.0);
    narrowStateGate = max(
      narrowStateGate,
      clamp((residualFrontGate + transportBridgeGate * materialResidualCenter * materialFluxGate * 0.22) * (1.0 - sideReject * 0.4) * (1.0 - historyWideReject * 0.3), 0.0, 0.72)
    );
    narrowStateGate *= (0.9 + materialFluxGate * 0.08 + huangLineSelector * 0.02) * (1.0 - huangWideReject * 0.04);
    float occupancy = clamp(
      max(
        localSeed * sourceBudget,
        max(distanceOccupancy * continuityGate * narrowStateGate, advectedOccupancy)
      ) +
      prevAlongOcc * 0.045 * continuityGate * narrowStateGate -
      prevSideOcc * 0.26 -
      sideReject * 0.2 -
      historyWideReject * 0.14,
      0.0,
      1.0
    );
    float occupancyCeiling = mix(
      0.82,
      0.48,
      smoothstep(0.22, 0.64, hAcross + prevSideOcc * 0.32 + sideReject * 0.16 + transportResidualSide * 0.12 + materialSideScore * 0.08 + huangWideReject * 0.02)
    );
    occupancy = min(occupancy, occupancyCeiling);
    float lineAge = clamp(
      max(max(localSeed * 0.62, residualSeed * 0.78), max(prevAlongAge * 0.82, prevBack.b * 0.92) * (0.82 + occupancy * 0.08) * continuityGate * narrowStateGate) +
      residualTransportMemory * 0.16 +
      transportBridgeGate * materialResidualCenter * materialFluxGate * 0.1 +
      occupancy * 0.055 -
      sideReject * 0.12 -
      prevSideOcc * 0.1 -
      historyWideReject * 0.1,
      0.0,
      1.0
    );
    float missingPhysicsReject = 1.0 - smoothstep(0.18, 0.64, twoOfThreeGate + localSeed * 0.34 + prevAlongOcc * 0.18 + residualFrontGate * 0.14 + materialFluxGate * 0.18 + etaGammaCenter * 0.12);
    float combinedSideReject = clamp(
      max(
        max(sideReject * 0.78, historyWideReject * 0.7),
        max(max(prevSideOcc - max(occupancy, prevAlongOcc) * 0.62, missingPhysicsReject * 0.32), huangWideReject * 0.06)
      ),
      0.0,
      1.0
    );

    gl_FragColor = vec4(distance, occupancy, lineAge, combinedSideReject);
  }
`;

const GAMMA_VELOCITY_CORRECTION_FRAGMENT_SHADER = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uField;
  uniform sampler2D uVelocity;
  uniform sampler2D uGammaResidual;
  uniform vec2 uTexel;
  uniform float uDelta;
  uniform float uMarangoni;
  uniform float uViscosity;

  const float GAMMA_VELOCITY_PI = 3.141592653589793;

  vec3 sphericalSampleUv(vec2 uv) {
    float x = uv.x;
    float y = uv.y;
    float poleCross = 0.0;
    if (y < 0.0) {
      y = -y;
      x += 0.5;
      poleCross = 1.0;
    }
    if (y > 1.0) {
      y = 2.0 - y;
      x += 0.5;
      poleCross = 1.0;
    }
    return vec3(fract(x), clamp(y, 0.002, 0.998), poleCross);
  }

  vec2 sampleUv(vec2 uv) {
    return sphericalSampleUv(uv).xy;
  }

  vec4 fieldAt(vec2 uv) {
    return texture2D(uField, sampleUv(uv));
  }

  vec4 gammaResidualAt(vec2 uv) {
    return texture2D(uGammaResidual, sampleUv(uv));
  }

  vec2 decodeVelocity(vec4 encoded) {
    return (encoded.rg - 0.5) * 0.5;
  }

  vec4 encodeVelocity(vec2 velocity) {
    return vec4(clamp(0.5 + velocity * 2.0, vec2(0.0), vec2(1.0)), 0.5, 1.0);
  }

  vec2 velocityAt(vec2 uv) {
    vec3 sphereUv = sphericalSampleUv(uv);
    vec2 velocity = decodeVelocity(texture2D(uVelocity, sphereUv.xy));
    return mix(velocity, -velocity, sphereUv.z);
  }

  float sphereSinAt(vec2 uv) {
    return max(0.22, sin(sampleUv(uv).y * GAMMA_VELOCITY_PI));
  }

  float phiDerivativeScale() {
    return min(8.0, 1.0 / max(0.0001, 4.0 * GAMMA_VELOCITY_PI * uTexel.x));
  }

  float thetaDerivativeScale() {
    return min(8.0, 1.0 / max(0.0001, 2.0 * GAMMA_VELOCITY_PI * uTexel.y));
  }

  vec2 sphericalGradient(float leftValue, float rightValue, float downValue, float upValue, vec2 uv) {
    float sinTheta = sphereSinAt(uv);
    return vec2(
      (rightValue - leftValue) * phiDerivativeScale() / sinTheta,
      (upValue - downValue) * thetaDerivativeScale()
    );
  }

  float sphericalVelocityDivergence(vec2 uv, vec2 leftV, vec2 rightV, vec2 downV, vec2 upV) {
    float sinC = sphereSinAt(uv);
    float sinD = sphereSinAt(uv - vec2(0.0, uTexel.y));
    float sinU = sphereSinAt(uv + vec2(0.0, uTexel.y));
    float phiDiv = (rightV.x - leftV.x) * phiDerivativeScale() / sinC;
    float thetaDiv = (sinU * upV.y - sinD * downV.y) * thetaDerivativeScale() / sinC;
    return phiDiv + thetaDiv;
  }

  vec4 marangoniProjectionWeights(vec2 uv, vec4 center, vec4 left, vec4 right, vec4 down, vec4 up) {
    float sinC = sphereSinAt(uv);
    float sinD = sphereSinAt(uv - vec2(0.0, uTexel.y));
    float sinU = sphereSinAt(uv + vec2(0.0, uTexel.y));
    float baseMobility = 0.11 + uMarangoni * 0.31;
    float kC = baseMobility / max(0.045, center.r);
    float kL = baseMobility / max(0.045, left.r);
    float kR = baseMobility / max(0.045, right.r);
    float kD = baseMobility / max(0.045, down.r);
    float kU = baseMobility / max(0.045, up.r);
    float phiScale = phiDerivativeScale();
    float thetaScale = thetaDerivativeScale();
    float phiMetric = phiScale * phiScale / (sinC * sinC);
    float thetaMetric = thetaScale * thetaScale;
    return vec4(
      0.5 * (kC + kL) * phiMetric,
      0.5 * (kC + kR) * phiMetric,
      0.5 * (kC + kD) * thetaMetric * sinD / sinC,
      0.5 * (kC + kU) * thetaMetric * sinU / sinC
    );
  }

  float weightedLaplacian(float centerValue, vec4 neighbors, vec4 weights) {
    return dot(neighbors, weights) - centerValue * dot(weights, vec4(1.0));
  }

  void main() {
    vec4 center = fieldAt(vUv);
    vec4 left = fieldAt(vUv - vec2(uTexel.x, 0.0));
    vec4 right = fieldAt(vUv + vec2(uTexel.x, 0.0));
    vec4 down = fieldAt(vUv - vec2(0.0, uTexel.y));
    vec4 up = fieldAt(vUv + vec2(0.0, uTexel.y));
    vec2 leftV = velocityAt(vUv - vec2(uTexel.x, 0.0));
    vec2 rightV = velocityAt(vUv + vec2(uTexel.x, 0.0));
    vec2 downV = velocityAt(vUv - vec2(0.0, uTexel.y));
    vec2 upV = velocityAt(vUv + vec2(0.0, uTexel.y));

    float eta = max(0.035, center.r);
    vec2 gradGamma = sphericalGradient(left.g, right.g, down.g, up.g, vUv);
    vec2 velocity = velocityAt(vUv);
    float gammaGradient = length(gradGamma);
    vec4 neighborGamma = vec4(left.g, right.g, down.g, up.g);
    vec4 marangoniWeights = marangoniProjectionWeights(vUv, center, left, right, down, up);
    float divMobilityGradGamma = weightedLaplacian(center.g, neighborGamma, marangoniWeights);
    float projectedDivergence = sphericalVelocityDivergence(vUv, leftV, rightV, downV, upV) -
      uDelta * divMobilityGradGamma;
    vec4 gammaResidual = gammaResidualAt(vUv);
    float candidateProjectedDivergence = (gammaResidual.g - 0.5) / 8.0;
    float gammaRhsResidual = (gammaResidual.b - 0.5) / 18.0;
    float gammaDeltaEncoded = gammaResidual.a;
    float residualCompression = max(0.0, -candidateProjectedDivergence);
    float residualMagnitude = abs(gammaRhsResidual) + gammaDeltaEncoded * 0.026;
    float residualClosure = smoothstep(0.0008, 0.032, residualMagnitude + residualCompression * 0.34);
    float closureSignal = gammaGradient * 0.55 + abs(projectedDivergence) * 0.70 +
      abs(divMobilityGradGamma) * 0.25 + residualMagnitude * 1.10 + residualCompression * 0.48;
    float closureGate = smoothstep(0.0008, 0.045, closureSignal);
    vec2 gammaDirection = gradGamma / max(gammaGradient, 0.0001);
    vec2 marangoniAcceleration = -gradGamma * ((0.66 + uMarangoni * 1.62) / eta) *
      (1.0 + closureGate * 1.65);
    float thinGate = clamp((0.62 - eta) * 1.8, 0.0, 1.0);
    vec2 convergenceSteer = -gammaDirection * max(0.0, -projectedDivergence) *
      (0.035 + uMarangoni * 0.085) * (0.65 + thinGate);
    vec2 residualConvergenceSteer = -gammaDirection * residualCompression * residualClosure *
      (0.055 + uMarangoni * 0.115) * (0.55 + thinGate * 0.45);
    vec2 residualProjectionSteer = -gammaDirection * clamp(gammaRhsResidual * 32.0, -1.0, 1.0) *
      residualClosure * gammaDeltaEncoded * ((0.020 + uMarangoni * 0.055) / eta);
    velocity += uDelta * (marangoniAcceleration + convergenceSteer + residualConvergenceSteer + residualProjectionSteer);
    velocity *= 1.0 - clamp((0.020 + uViscosity * 0.018) * uDelta / max(0.12, eta), 0.0, 0.12);
    velocity *= 0.9985 - clamp(uViscosity, 0.0, 1.5) * 0.0025;
    velocity = clamp(velocity, vec2(-0.24), vec2(0.24));

    gl_FragColor = encodeVelocity(velocity);
  }
`;

const GAMMA_DIVERGENCE_FIELD_FRAGMENT_SHADER = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uField;
  uniform sampler2D uVelocity;
  uniform vec2 uTexel;
  uniform float uDelta;
  uniform float uDiffusion;
  uniform float uMarangoni;

  const float GAMMA_DIVERGENCE_PI = 3.141592653589793;

  vec3 sphericalSampleUv(vec2 uv) {
    float x = uv.x;
    float y = uv.y;
    float poleCross = 0.0;
    if (y < 0.0) {
      y = -y;
      x += 0.5;
      poleCross = 1.0;
    }
    if (y > 1.0) {
      y = 2.0 - y;
      x += 0.5;
      poleCross = 1.0;
    }
    return vec3(fract(x), clamp(y, 0.002, 0.998), poleCross);
  }

  vec2 sampleUv(vec2 uv) {
    return sphericalSampleUv(uv).xy;
  }

  vec4 fieldAt(vec2 uv) {
    return texture2D(uField, sampleUv(uv));
  }

  vec2 decodeVelocity(vec4 encoded) {
    return (encoded.rg - 0.5) * 0.5;
  }

  vec2 velocityAt(vec2 uv) {
    vec3 sphereUv = sphericalSampleUv(uv);
    vec2 velocity = decodeVelocity(texture2D(uVelocity, sphereUv.xy));
    return mix(velocity, -velocity, sphereUv.z);
  }

  float sphereSinAt(vec2 uv) {
    return max(0.22, sin(sampleUv(uv).y * GAMMA_DIVERGENCE_PI));
  }

  float phiDerivativeScale() {
    return min(6.0, 1.0 / max(0.0001, 4.0 * GAMMA_DIVERGENCE_PI * uTexel.x));
  }

  float thetaDerivativeScale() {
    return min(6.0, 1.0 / max(0.0001, 2.0 * GAMMA_DIVERGENCE_PI * uTexel.y));
  }

  float sphericalVelocityDivergence(vec2 uv, vec2 leftV, vec2 rightV, vec2 downV, vec2 upV) {
    float sinC = sphereSinAt(uv);
    float sinD = sphereSinAt(uv - vec2(0.0, uTexel.y));
    float sinU = sphereSinAt(uv + vec2(0.0, uTexel.y));
    float phiDiv = (rightV.x - leftV.x) * phiDerivativeScale() / sinC;
    float thetaDiv = (sinU * upV.y - sinD * downV.y) * thetaDerivativeScale() / sinC;
    return phiDiv + thetaDiv;
  }

  vec4 sphericalLaplaceWeights(vec2 uv) {
    float sinC = sphereSinAt(uv);
    float sinD = sphereSinAt(uv - vec2(0.0, uTexel.y));
    float sinU = sphereSinAt(uv + vec2(0.0, uTexel.y));
    float phiScale = phiDerivativeScale();
    float thetaScale = thetaDerivativeScale();
    float phiWeight = phiScale * phiScale / (sinC * sinC);
    return vec4(phiWeight, phiWeight, thetaScale * thetaScale * sinD / sinC, thetaScale * thetaScale * sinU / sinC);
  }

  vec4 marangoniProjectionWeights(vec2 uv, vec4 center, vec4 left, vec4 right, vec4 down, vec4 up) {
    float sinC = sphereSinAt(uv);
    float sinD = sphereSinAt(uv - vec2(0.0, uTexel.y));
    float sinU = sphereSinAt(uv + vec2(0.0, uTexel.y));
    float baseMobility = 0.11 + uMarangoni * 0.31;
    float kC = baseMobility / max(0.045, center.r);
    float kL = baseMobility / max(0.045, left.r);
    float kR = baseMobility / max(0.045, right.r);
    float kD = baseMobility / max(0.045, down.r);
    float kU = baseMobility / max(0.045, up.r);
    float phiScale = phiDerivativeScale();
    float thetaScale = thetaDerivativeScale();
    float phiMetric = phiScale * phiScale / (sinC * sinC);
    float thetaMetric = thetaScale * thetaScale;
    return vec4(
      0.5 * (kC + kL) * phiMetric,
      0.5 * (kC + kR) * phiMetric,
      0.5 * (kC + kD) * thetaMetric * sinD / sinC,
      0.5 * (kC + kU) * thetaMetric * sinU / sinC
    );
  }

  float weightedLaplacian(float centerValue, vec4 neighbors, vec4 weights) {
    return dot(neighbors, weights) - centerValue * dot(weights, vec4(1.0));
  }

  void main() {
    vec4 center = fieldAt(vUv);
    vec4 left = fieldAt(vUv - vec2(uTexel.x, 0.0));
    vec4 right = fieldAt(vUv + vec2(uTexel.x, 0.0));
    vec4 down = fieldAt(vUv - vec2(0.0, uTexel.y));
    vec4 up = fieldAt(vUv + vec2(0.0, uTexel.y));
    vec2 leftV = velocityAt(vUv - vec2(uTexel.x, 0.0));
    vec2 rightV = velocityAt(vUv + vec2(uTexel.x, 0.0));
    vec2 downV = velocityAt(vUv - vec2(0.0, uTexel.y));
    vec2 upV = velocityAt(vUv + vec2(0.0, uTexel.y));

    float divergence = sphericalVelocityDivergence(vUv, leftV, rightV, downV, upV);
    vec4 neighborGamma = vec4(left.g, right.g, down.g, up.g);
    vec4 laplaceWeights = sphericalLaplaceWeights(vUv);
    vec4 marangoniWeights = marangoniProjectionWeights(vUv, center, left, right, down, up);
    float lapGamma = weightedLaplacian(center.g, neighborGamma, laplaceWeights);
    float divMobilityGradGamma = weightedLaplacian(center.g, neighborGamma, marangoniWeights);
    float diffusionRate = 0.006 + uDiffusion * 0.026;
    float projectedDivergence = divergence -
      uDelta * divMobilityGradGamma * (0.90 + uMarangoni * 0.24);
    float closureGate = smoothstep(
      0.0006,
      0.045,
      abs(projectedDivergence) * 0.70 +
      abs(divMobilityGradGamma) * 0.10 +
      abs(lapGamma) * 0.010
    );
    float feedbackDivergence = mix(divergence, projectedDivergence, 0.48 + closureGate * 0.28);
    float gammaResidual = -center.g * feedbackDivergence + diffusionRate * lapGamma;

    gl_FragColor = vec4(
      clamp(0.5 + feedbackDivergence * 5.0, 0.0, 1.0),
      clamp(0.5 + gammaResidual * 20.0, 0.0, 1.0),
      clamp(abs(feedbackDivergence) * 12.0, 0.0, 1.0),
      clamp(abs(gammaResidual) * (36.0 + uDelta * 80.0), 0.0, 1.0)
    );
  }
`;

const GAMMA_DIVERGENCE_FEEDBACK_FRAGMENT_SHADER = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uField;
  uniform sampler2D uVelocity;
  uniform sampler2D uGammaProjection;
  uniform vec2 uTexel;
  uniform float uDelta;
  uniform float uDiffusion;
  uniform float uMarangoni;

  const float GAMMA_FEEDBACK_PI = 3.141592653589793;

  vec3 sphericalSampleUv(vec2 uv) {
    float x = uv.x;
    float y = uv.y;
    float poleCross = 0.0;
    if (y < 0.0) {
      y = -y;
      x += 0.5;
      poleCross = 1.0;
    }
    if (y > 1.0) {
      y = 2.0 - y;
      x += 0.5;
      poleCross = 1.0;
    }
    return vec3(fract(x), clamp(y, 0.002, 0.998), poleCross);
  }

  vec2 sampleUv(vec2 uv) {
    return sphericalSampleUv(uv).xy;
  }

  vec4 fieldAt(vec2 uv) {
    return texture2D(uField, sampleUv(uv));
  }

  vec4 projectionAt(vec2 uv) {
    return texture2D(uGammaProjection, sampleUv(uv));
  }

  vec2 decodeVelocity(vec4 encoded) {
    return (encoded.rg - 0.5) * 0.5;
  }

  vec2 velocityAt(vec2 uv) {
    vec3 sphereUv = sphericalSampleUv(uv);
    vec2 velocity = decodeVelocity(texture2D(uVelocity, sphereUv.xy));
    return mix(velocity, -velocity, sphereUv.z);
  }

  float sphereSinAt(vec2 uv) {
    return max(0.22, sin(sampleUv(uv).y * GAMMA_FEEDBACK_PI));
  }

  float phiDerivativeScale() {
    return min(6.0, 1.0 / max(0.0001, 4.0 * GAMMA_FEEDBACK_PI * uTexel.x));
  }

  float thetaDerivativeScale() {
    return min(6.0, 1.0 / max(0.0001, 2.0 * GAMMA_FEEDBACK_PI * uTexel.y));
  }

  vec2 sphericalGradient(float leftValue, float rightValue, float downValue, float upValue, vec2 uv) {
    float sinTheta = sphereSinAt(uv);
    return vec2(
      (rightValue - leftValue) * phiDerivativeScale() / sinTheta,
      (upValue - downValue) * thetaDerivativeScale()
    );
  }

  float sphericalVelocityDivergence(vec2 uv, vec2 leftV, vec2 rightV, vec2 downV, vec2 upV) {
    float sinC = sphereSinAt(uv);
    float sinD = sphereSinAt(uv - vec2(0.0, uTexel.y));
    float sinU = sphereSinAt(uv + vec2(0.0, uTexel.y));
    float phiDiv = (rightV.x - leftV.x) * phiDerivativeScale() / sinC;
    float thetaDiv = (sinU * upV.y - sinD * downV.y) * thetaDerivativeScale() / sinC;
    return phiDiv + thetaDiv;
  }

  vec4 sphericalLaplaceWeights(vec2 uv) {
    float sinC = sphereSinAt(uv);
    float sinD = sphereSinAt(uv - vec2(0.0, uTexel.y));
    float sinU = sphereSinAt(uv + vec2(0.0, uTexel.y));
    float phiScale = phiDerivativeScale();
    float thetaScale = thetaDerivativeScale();
    float phiWeight = phiScale * phiScale / (sinC * sinC);
    return vec4(phiWeight, phiWeight, thetaScale * thetaScale * sinD / sinC, thetaScale * thetaScale * sinU / sinC);
  }

  float weightedLaplacian(float centerValue, vec4 neighbors, vec4 weights) {
    return dot(neighbors, weights) - centerValue * dot(weights, vec4(1.0));
  }

  void main() {
    vec4 center = fieldAt(vUv);
    vec4 left = fieldAt(vUv - vec2(uTexel.x, 0.0));
    vec4 right = fieldAt(vUv + vec2(uTexel.x, 0.0));
    vec4 down = fieldAt(vUv - vec2(0.0, uTexel.y));
    vec4 up = fieldAt(vUv + vec2(0.0, uTexel.y));
    vec2 leftV = velocityAt(vUv - vec2(uTexel.x, 0.0));
    vec2 rightV = velocityAt(vUv + vec2(uTexel.x, 0.0));
    vec2 downV = velocityAt(vUv - vec2(0.0, uTexel.y));
    vec2 upV = velocityAt(vUv + vec2(0.0, uTexel.y));

    vec4 storedProjection = projectionAt(vUv);
    float directDivergence = sphericalVelocityDivergence(vUv, leftV, rightV, downV, upV);
    float storedDivergence = (storedProjection.r - 0.5) / 5.0;
    float divergence = mix(directDivergence, storedDivergence, 0.78);
    vec4 neighborGamma = vec4(left.g, right.g, down.g, up.g);
    vec4 laplaceWeights = sphericalLaplaceWeights(vUv);
    float lapGamma = weightedLaplacian(center.g, neighborGamma, laplaceWeights);
    vec2 gradGamma = sphericalGradient(left.g, right.g, down.g, up.g, vUv);
    float gradSignal = length(gradGamma);
    float diffusionRate = 0.006 + uDiffusion * 0.026;
    float compression = max(0.0, -divergence);
    float storedResidual = (storedProjection.g - 0.5) / 20.0;
    float gammaResidual = mix(-center.g * divergence + diffusionRate * lapGamma, storedResidual, 0.58);
    float residualSignal = abs(gammaResidual) + abs(divergence) * 0.32 +
      gradSignal * 0.58 + abs(lapGamma) * 0.025;
    float residualGate = smoothstep(0.0006, 0.042, residualSignal);
    float localStability = 1.0 / (1.0 + abs(lapGamma) * 0.035 + abs(divergence) * 0.9);

    vec4 neighborEta = vec4(left.r, right.r, down.r, up.r);
    float lapEta = weightedLaplacian(center.r, neighborEta, laplaceWeights);
    float neighborMeanEta = (center.r + left.r + right.r + down.r + up.r) * 0.2;
    float expansion = max(0.0, divergence);
    float etaContinuity = -center.r * divergence;
    float etaGate = smoothstep(0.0007, 0.040, abs(divergence) + gradSignal * 0.28 + abs(lapEta) * 0.018);
    float etaNext = center.r +
      uDelta * clamp(etaContinuity, -0.22, 0.22) *
      (0.34 + etaGate * (0.48 + uMarangoni * 0.16)) * localStability;
    etaNext += uDelta * compression * (0.018 + uMarangoni * 0.034) *
      smoothstep(0.22, 0.64, center.r) * (0.35 + residualGate * 0.65);
    etaNext -= uDelta * expansion * (0.010 + uDiffusion * 0.010) * (0.45 + etaGate * 0.55);
    etaNext += uDelta * lapEta * (0.0015 + uDiffusion * 0.0045) * (1.0 - etaGate * 0.38);
    etaNext += (center.r - neighborMeanEta) * 0.006 * residualGate * smoothstep(0.004, 0.048, abs(lapEta));
    etaNext = mix(
      center.r,
      etaNext,
      clamp(0.32 + etaGate * 0.34 + residualGate * 0.12 + uMarangoni * 0.04, 0.0, 0.76)
    );

    float gammaNext = center.g +
      uDelta * clamp(gammaResidual, -0.28, 0.28) *
      (1.05 + uMarangoni * 0.70) * (0.35 + residualGate * 0.85) * localStability;

    float neighborMeanGamma = (center.g + left.g + right.g + down.g + up.g) * 0.2;
    float gradientPreservation = smoothstep(0.004, 0.052, gradSignal + compression * 0.32);
    gammaNext += (center.g - neighborMeanGamma) *
      (0.012 + uMarangoni * 0.010) * gradientPreservation * residualGate;

    float lowFrequencyAnchor = mix(center.g, neighborMeanGamma, 0.35);
    gammaNext += uDelta * (lowFrequencyAnchor - gammaNext) * (0.025 + uDiffusion * 0.012);
    gammaNext += uDelta * (center.g - gammaNext) * 0.004;
    gammaNext = mix(
      center.g,
      gammaNext,
      clamp(0.42 + residualGate * 0.34 + uMarangoni * 0.06, 0.0, 0.88)
    );

    gl_FragColor = vec4(
      clamp(etaNext, 0.035, 0.975),
      clamp(gammaNext, 0.025, 0.975),
      center.b,
      center.a
    );
  }
`;

const GAMMA_CONTINUITY_FRAGMENT_SHADER = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uField;
  uniform sampler2D uVelocity;
  uniform vec2 uTexel;
  uniform float uDelta;
  uniform float uDiffusion;
  uniform float uMarangoni;
  uniform float uDrainage;

  const float GAMMA_CONTINUITY_PI = 3.141592653589793;

  vec3 sphericalSampleUv(vec2 uv) {
    float x = uv.x;
    float y = uv.y;
    float poleCross = 0.0;
    if (y < 0.0) {
      y = -y;
      x += 0.5;
      poleCross = 1.0;
    }
    if (y > 1.0) {
      y = 2.0 - y;
      x += 0.5;
      poleCross = 1.0;
    }
    return vec3(fract(x), clamp(y, 0.002, 0.998), poleCross);
  }

  vec2 sampleUv(vec2 uv) {
    return sphericalSampleUv(uv).xy;
  }

  vec4 fieldAt(vec2 uv) {
    return texture2D(uField, sampleUv(uv));
  }

  vec2 decodeVelocity(vec4 encoded) {
    return (encoded.rg - 0.5) * 0.5;
  }

  vec2 velocityAt(vec2 uv) {
    vec3 sphereUv = sphericalSampleUv(uv);
    vec2 velocity = decodeVelocity(texture2D(uVelocity, sphereUv.xy));
    return mix(velocity, -velocity, sphereUv.z);
  }

  float sphereSinAt(vec2 uv) {
    return max(0.22, sin(sampleUv(uv).y * GAMMA_CONTINUITY_PI));
  }

  float phiDerivativeScale() {
    return min(5.0, 1.0 / max(0.0001, 4.0 * GAMMA_CONTINUITY_PI * uTexel.x));
  }

  float thetaDerivativeScale() {
    return min(5.0, 1.0 / max(0.0001, 2.0 * GAMMA_CONTINUITY_PI * uTexel.y));
  }

  vec2 sphericalBacktrace(vec2 uv, vec2 velocity, float scale) {
    float sinTheta = sphereSinAt(uv);
    vec2 metricVelocity = vec2(velocity.x / sinTheta, velocity.y);
    return sampleUv(uv - metricVelocity * uDelta * scale);
  }

  float sphericalVelocityDivergence(vec2 uv, vec2 leftV, vec2 rightV, vec2 downV, vec2 upV) {
    float sinC = sphereSinAt(uv);
    float sinD = sphereSinAt(uv - vec2(0.0, uTexel.y));
    float sinU = sphereSinAt(uv + vec2(0.0, uTexel.y));
    float phiDiv = (rightV.x - leftV.x) * phiDerivativeScale() / sinC;
    float thetaDiv = (sinU * upV.y - sinD * downV.y) * thetaDerivativeScale() / sinC;
    return phiDiv + thetaDiv;
  }

  vec4 sphericalLaplaceWeights(vec2 uv) {
    float sinC = sphereSinAt(uv);
    float sinD = sphereSinAt(uv - vec2(0.0, uTexel.y));
    float sinU = sphereSinAt(uv + vec2(0.0, uTexel.y));
    float phiScale = phiDerivativeScale();
    float thetaScale = thetaDerivativeScale();
    float phiWeight = phiScale * phiScale / (sinC * sinC);
    return vec4(phiWeight, phiWeight, thetaScale * thetaScale * sinD / sinC, thetaScale * thetaScale * sinU / sinC);
  }

  float weightedLaplacian(float centerValue, vec4 neighbors, vec4 weights) {
    return dot(neighbors, weights) - centerValue * dot(weights, vec4(1.0));
  }

  void main() {
    vec4 center = fieldAt(vUv);
    vec4 left = fieldAt(vUv - vec2(uTexel.x, 0.0));
    vec4 right = fieldAt(vUv + vec2(uTexel.x, 0.0));
    vec4 down = fieldAt(vUv - vec2(0.0, uTexel.y));
    vec4 up = fieldAt(vUv + vec2(0.0, uTexel.y));
    vec2 leftV = velocityAt(vUv - vec2(uTexel.x, 0.0));
    vec2 rightV = velocityAt(vUv + vec2(uTexel.x, 0.0));
    vec2 downV = velocityAt(vUv - vec2(0.0, uTexel.y));
    vec2 upV = velocityAt(vUv + vec2(0.0, uTexel.y));

    float divergence = sphericalVelocityDivergence(vUv, leftV, rightV, downV, upV);
    vec4 laplaceWeights = sphericalLaplaceWeights(vUv);
    vec4 neighborEta = vec4(left.r, right.r, down.r, up.r);
    vec4 neighborGamma = vec4(left.g, right.g, down.g, up.g);
    float lapEta = weightedLaplacian(center.r, neighborEta, laplaceWeights);
    float lapGamma = weightedLaplacian(center.g, neighborGamma, laplaceWeights);
    vec2 centerVelocity = velocityAt(vUv);
    float speed = length(centerVelocity);
    vec4 advected = fieldAt(sphericalBacktrace(vUv, centerVelocity, 0.82 + uMarangoni * 0.22));
    float continuitySignal = abs(divergence) + speed * 0.16 + abs(lapGamma) * 0.035;
    float continuityGate = smoothstep(0.0008, 0.042, continuitySignal);
    float advectiveGate = smoothstep(0.0015, 0.048, speed + abs(divergence) * 0.55);
    float compression = max(0.0, -divergence);
    float expansion = max(0.0, divergence);

    float etaContinuity = -center.r * divergence;
    float etaNext = center.r + uDelta * etaContinuity * (0.32 + continuityGate * (0.58 + uMarangoni * 0.18));
    etaNext += uDelta * lapEta * (0.0025 + uDiffusion * 0.0075);
    etaNext += uDelta * compression * (0.030 + uMarangoni * 0.050) * smoothstep(0.26, 0.78, center.r);
    etaNext -= uDelta * expansion * (0.018 + uDrainage * 0.018);
    etaNext = mix(etaNext, advected.r, 0.035 + advectiveGate * 0.12);
    etaNext += uDelta * (0.53 - etaNext) * 0.012;
    etaNext -= uDelta * max(0.0, etaNext - 0.74) * (0.035 + uDrainage * 0.020);

    float diffusionRate = 0.008 + uDiffusion * 0.030;
    float gammaContinuity = -center.g * divergence + diffusionRate * lapGamma;
    float gammaNext = center.g + uDelta * gammaContinuity * (0.38 + continuityGate * (0.62 + uMarangoni * 0.18));
    float neighborMeanGamma = (center.g + left.g + right.g + down.g + up.g) * 0.2;
    gammaNext = mix(gammaNext, advected.g, 0.12 + advectiveGate * 0.25);
    gammaNext += uDelta * (neighborMeanGamma - gammaNext) * (0.055 + uDiffusion * 0.030);
    gammaNext = mix(center.g, gammaNext, clamp(0.58 + continuityGate * 0.20, 0.0, 0.84));

    gl_FragColor = vec4(
      clamp(etaNext, 0.035, 0.96),
      clamp(gammaNext, 0.025, 0.975),
      center.b,
      center.a
    );
  }
`;

const FIELD_STEP_FRAGMENT_SHADER = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uField;
  uniform sampler2D uVelocity;
  uniform sampler2D uRiverPhase;
  uniform sampler2D uRiverHeightFlux;
  uniform vec2 uTexel;
  uniform float uTime;
  uniform float uDelta;
  uniform float uPressure;
  uniform float uFlowDirection;
  uniform float uFlowSpeed;
  uniform float uDiffusion;
  uniform float uDripAmount;
  uniform float uDrainage;
  uniform float uMarangoni;
  uniform float uCapillary;
  uniform float uGravity;
  uniform float uViscosity;
  uniform float uSourceAmount;
  uniform float uFoamSource;
  uniform float uFoamDecay;

  const float SOAP_PI = 3.141592653589793;

  vec3 sphericalSampleUv(vec2 uv) {
    float x = uv.x;
    float y = uv.y;
    float poleCross = 0.0;
    if (y < 0.0) {
      y = -y;
      x += 0.5;
      poleCross = 1.0;
    }
    if (y > 1.0) {
      y = 2.0 - y;
      x += 0.5;
      poleCross = 1.0;
    }
    return vec3(fract(x), clamp(y, 0.002, 0.998), poleCross);
  }

  vec2 sampleUv(vec2 uv) {
    return sphericalSampleUv(uv).xy;
  }

  float hash21(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise21(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
      mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 4; i += 1) {
      value += noise21(p) * amplitude;
      p = mat2(1.61, 1.14, -1.14, 1.61) * p + vec2(0.21, 0.13);
      amplitude *= 0.52;
    }
    return value;
  }

  vec4 fieldAt(vec2 uv) {
    return texture2D(uField, sampleUv(uv));
  }

  vec2 decodeVelocity(vec4 encoded) {
    return (encoded.rg - 0.5) * 0.5;
  }

  vec2 velocityAt(vec2 uv) {
    vec3 sphereUv = sphericalSampleUv(uv);
    vec2 velocity = decodeVelocity(texture2D(uVelocity, sphereUv.xy));
    return mix(velocity, -velocity, sphereUv.z);
  }

  vec4 riverAt(vec2 uv) {
    return texture2D(uRiverPhase, sampleUv(uv));
  }

  vec4 riverFluxAt(vec2 uv) {
    return texture2D(uRiverHeightFlux, sampleUv(uv));
  }

  float surfaceTension(vec4 state) {
    return clamp(1.0 - state.g * 0.34 + (state.a - 0.5) * 0.08, 0.58, 1.18);
  }

  float sphereSinAt(vec2 uv) {
    return max(0.22, sin(sampleUv(uv).y * SOAP_PI));
  }

  float fieldPhiDerivativeScale() {
    return min(2.1, 1.0 / max(uTexel.x, 0.001));
  }

  float fieldThetaDerivativeScale() {
    return min(2.1, 1.0 / max(uTexel.y, 0.001));
  }

  vec2 sphericalBacktrace(vec2 uv, vec2 velocity, float scale) {
    float sinTheta = sphereSinAt(uv);
    vec2 metricVelocity = vec2(velocity.x / sinTheta, velocity.y);
    return sampleUv(uv - metricVelocity * uDelta * scale);
  }

  vec2 sphericalGradient(float leftValue, float rightValue, float downValue, float upValue, vec2 uv) {
    float sinTheta = sphereSinAt(uv);
    return vec2(
      (rightValue - leftValue) * 0.5 * fieldPhiDerivativeScale() / sinTheta,
      (upValue - downValue) * 0.5 * fieldThetaDerivativeScale()
    );
  }

  float sphericalLaplacian(float centerValue, float leftValue, float rightValue, float downValue, float upValue, vec2 uv) {
    float sinC = sphereSinAt(uv);
    float sinD = sphereSinAt(uv - vec2(0.0, uTexel.y));
    float sinU = sphereSinAt(uv + vec2(0.0, uTexel.y));
    float phiCurvature = (leftValue + rightValue - centerValue * 2.0) / (sinC * sinC);
    float thetaCurvature = (sinU * (upValue - centerValue) - sinD * (centerValue - downValue)) / sinC;
    return phiCurvature + thetaCurvature;
  }

  float lapHeightAt(vec2 uv) {
    float c = fieldAt(uv).r;
    float l = fieldAt(uv - vec2(uTexel.x, 0.0)).r;
    float r = fieldAt(uv + vec2(uTexel.x, 0.0)).r;
    float d = fieldAt(uv - vec2(0.0, uTexel.y)).r;
    float u = fieldAt(uv + vec2(0.0, uTexel.y)).r;
    return sphericalLaplacian(c, l, r, d, u, uv);
  }

  float disjoiningPressure(float height) {
    float safeHeight = max(0.035, height);
    return 0.012 / (safeHeight * safeHeight + 0.018) - safeHeight * 0.006;
  }

  float filmPressureAt(vec2 uv) {
    vec4 state = fieldAt(uv);
    float gamma = surfaceTension(state);
    float capillaryPressure = -gamma * lapHeightAt(uv) * (0.35 + uCapillary * 0.9);
    float disjoining = disjoiningPressure(state.r);
    float hydrostatic = state.r * uGravity * 0.018;
    return capillaryPressure - disjoining + hydrostatic;
  }

  vec2 gammaGradientAt(vec2 uv) {
    float gammaL = surfaceTension(fieldAt(uv - vec2(uTexel.x, 0.0)));
    float gammaR = surfaceTension(fieldAt(uv + vec2(uTexel.x, 0.0)));
    float gammaD = surfaceTension(fieldAt(uv - vec2(0.0, uTexel.y)));
    float gammaU = surfaceTension(fieldAt(uv + vec2(0.0, uTexel.y)));
    return sphericalGradient(gammaL, gammaR, gammaD, gammaU, uv);
  }

  vec2 thinFilmFluxAt(vec2 uv) {
    vec4 state = fieldAt(uv);
    float height = max(0.035, state.r);
    float pressureL = filmPressureAt(uv - vec2(uTexel.x, 0.0));
    float pressureR = filmPressureAt(uv + vec2(uTexel.x, 0.0));
    float pressureD = filmPressureAt(uv - vec2(0.0, uTexel.y));
    float pressureU = filmPressureAt(uv + vec2(0.0, uTexel.y));
    vec2 gradPressure = sphericalGradient(pressureL, pressureR, pressureD, pressureU, uv);
    vec2 gradGamma = gammaGradientAt(uv);
    vec2 mainDir = normalize(vec2(cos(uFlowDirection), sin(uFlowDirection)));
    float polarPull = -cos(clamp(uv.y, 0.002, 0.998) * SOAP_PI);
    vec2 gravityDir = normalize(mix(vec2(0.0, polarPull), mainDir, 0.34));
    float viscosity = max(0.18, uViscosity + 0.18);
    float h2 = height * height;
    float h3 = h2 * height;
    vec2 pressureFlux = -(h3 / (3.0 * viscosity)) * gradPressure * (0.68 + uCapillary * 0.82);
    vec2 marangoniFlux = (h2 / (2.0 * viscosity)) * gradGamma * (0.36 + uMarangoni * 0.95);
    vec2 tangentGravity = gravityDir * uDrainage * uGravity * h3 * 0.035;
    vec2 airShear = mainDir * uFlowSpeed * h2 * 0.0065 * (0.35 + uPressure * 0.35);
    return pressureFlux + marangoniFlux + tangentGravity + airShear;
  }

  float sphericalFluxDivergence(vec2 uv, vec2 fluxL, vec2 fluxR, vec2 fluxD, vec2 fluxU) {
    float sinC = sphereSinAt(uv);
    float sinD = sphereSinAt(uv - vec2(0.0, uTexel.y));
    float sinU = sphereSinAt(uv + vec2(0.0, uTexel.y));
    float phiDiv = (fluxR.x - fluxL.x) * 0.5 * fieldPhiDerivativeScale() / sinC;
    float thetaDiv = (sinU * fluxU.y - sinD * fluxD.y) * 0.5 * fieldThetaDerivativeScale() / sinC;
    return phiDiv + thetaDiv;
  }

  float thinFilmFluxDivergenceAt(vec2 uv) {
    vec2 fluxL = thinFilmFluxAt(uv - vec2(uTexel.x, 0.0));
    vec2 fluxR = thinFilmFluxAt(uv + vec2(uTexel.x, 0.0));
    vec2 fluxD = thinFilmFluxAt(uv - vec2(0.0, uTexel.y));
    vec2 fluxU = thinFilmFluxAt(uv + vec2(0.0, uTexel.y));
    return sphericalFluxDivergence(uv, fluxL, fluxR, fluxD, fluxU);
  }

  vec2 surfactantFluxAt(vec2 uv) {
    vec4 state = fieldAt(uv);
    float height = max(0.045, state.r);
    vec2 surfaceVelocity = thinFilmFluxAt(uv) / height;
    vec2 gammaDiffusion = -gammaGradientAt(uv) * (0.012 + uDiffusion * 0.018 + uMarangoni * 0.006);
    return state.g * surfaceVelocity + gammaDiffusion;
  }

  float surfactantFluxDivergenceAt(vec2 uv) {
    vec2 fluxL = surfactantFluxAt(uv - vec2(uTexel.x, 0.0));
    vec2 fluxR = surfactantFluxAt(uv + vec2(uTexel.x, 0.0));
    vec2 fluxD = surfactantFluxAt(uv - vec2(0.0, uTexel.y));
    vec2 fluxU = surfactantFluxAt(uv + vec2(0.0, uTexel.y));
    return sphericalFluxDivergence(uv, fluxL, fluxR, fluxD, fluxU);
  }

  void main() {
    vec2 uv = vUv;
    vec2 velocity = velocityAt(uv);
    vec2 backUv = sphericalBacktrace(uv, velocity, 1.45 + uFlowSpeed * 0.22);
    vec4 center = fieldAt(backUv);
    vec4 left = fieldAt(backUv - vec2(uTexel.x, 0.0));
    vec4 right = fieldAt(backUv + vec2(uTexel.x, 0.0));
    vec4 down = fieldAt(backUv - vec2(0.0, uTexel.y));
    vec4 up = fieldAt(backUv + vec2(0.0, uTexel.y));
    vec4 left2 = fieldAt(backUv - vec2(uTexel.x * 2.0, 0.0));
    vec4 right2 = fieldAt(backUv + vec2(uTexel.x * 2.0, 0.0));
    vec4 down2 = fieldAt(backUv - vec2(0.0, uTexel.y * 2.0));
    vec4 up2 = fieldAt(backUv + vec2(0.0, uTexel.y * 2.0));
    vec4 upLeft = fieldAt(backUv + vec2(-uTexel.x, uTexel.y));
    vec4 upRight = fieldAt(backUv + vec2(uTexel.x, uTexel.y));
    vec4 downLeft = fieldAt(backUv + vec2(-uTexel.x, -uTexel.y));
    vec4 downRight = fieldAt(backUv + vec2(uTexel.x, -uTexel.y));
    vec4 riverCenter = riverAt(backUv);
    vec4 riverLeft = riverAt(backUv - vec2(uTexel.x, 0.0));
    vec4 riverRight = riverAt(backUv + vec2(uTexel.x, 0.0));
    vec4 riverDown = riverAt(backUv - vec2(0.0, uTexel.y));
    vec4 riverUp = riverAt(backUv + vec2(0.0, uTexel.y));
    vec4 riverFluxCenter = riverFluxAt(backUv);
    vec4 riverFluxLeft = riverFluxAt(backUv - vec2(uTexel.x, 0.0));
    vec4 riverFluxRight = riverFluxAt(backUv + vec2(uTexel.x, 0.0));
    vec4 riverFluxDown = riverFluxAt(backUv - vec2(0.0, uTexel.y));
    vec4 riverFluxUp = riverFluxAt(backUv + vec2(0.0, uTexel.y));

    vec2 leftV = velocityAt(backUv - vec2(uTexel.x, 0.0));
    vec2 rightV = velocityAt(backUv + vec2(uTexel.x, 0.0));
    vec2 downV = velocityAt(backUv - vec2(0.0, uTexel.y));
    vec2 upV = velocityAt(backUv + vec2(0.0, uTexel.y));

    float height = center.r;
    float surfactant = center.g;
    float foam = center.b;
    float dye = center.a;
    vec2 gradH = sphericalGradient(left.r, right.r, down.r, up.r, backUv);
    vec2 gradG = sphericalGradient(left.g, right.g, down.g, up.g, backUv);
    float lapH = sphericalLaplacian(height, left.r, right.r, down.r, up.r, backUv);
    float lapG = sphericalLaplacian(surfactant, left.g, right.g, down.g, up.g, backUv);
    float lapFoam = sphericalLaplacian(foam, left.b, right.b, down.b, up.b, backUv);
    float lapDye = sphericalLaplacian(dye, left.a, right.a, down.a, up.a, backUv);
    vec2 gradDye = sphericalGradient(left.a, right.a, down.a, up.a, backUv);
    float phi = dye * 2.0 - 1.0;
    float phiL = left.a * 2.0 - 1.0;
    float phiR = right.a * 2.0 - 1.0;
    float phiD = down.a * 2.0 - 1.0;
    float phiU = up.a * 2.0 - 1.0;
    float phiL2 = left2.a * 2.0 - 1.0;
    float phiR2 = right2.a * 2.0 - 1.0;
    float phiD2 = down2.a * 2.0 - 1.0;
    float phiU2 = up2.a * 2.0 - 1.0;
    float phiUL = upLeft.a * 2.0 - 1.0;
    float phiUR = upRight.a * 2.0 - 1.0;
    float phiDL = downLeft.a * 2.0 - 1.0;
    float phiDR = downRight.a * 2.0 - 1.0;
    float bulk = phi * phi * phi - phi;
    float bulkL = phiL * phiL * phiL - phiL;
    float bulkR = phiR * phiR * phiR - phiR;
    float bulkD = phiD * phiD * phiD - phiD;
    float bulkU = phiU * phiU * phiU - phiU;
    float lapBulk = bulkL + bulkR + bulkD + bulkU - bulk * 4.0;
    float biLapPhi =
      20.0 * phi -
      8.0 * (phiL + phiR + phiD + phiU) +
      2.0 * (phiUL + phiUR + phiDL + phiDR) +
      (phiL2 + phiR2 + phiD2 + phiU2);
    float cahnHilliard = lapBulk - biLapPhi * 0.32;
    float divergence = sphericalFluxDivergence(backUv, leftV, rightV, downV, upV);
    float fluxDiv = sphericalFluxDivergence(
      backUv,
      left.r * leftV,
      right.r * rightV,
      down.r * downV,
      up.r * upV
    );
    float thinFluxDiv = thinFilmFluxDivergenceAt(backUv);
    float surfactantFluxDiv = surfactantFluxDivergenceAt(backUv);
    float huangThicknessContinuity = clamp(
      -height * divergence,
      -height * 0.16,
      height * 0.28
    );
    float huangSurfactantContinuity = clamp(
      -surfactant * divergence + lapG * (0.014 + uDiffusion * 0.055),
      -0.18,
      0.24
    );
    float shear = length(rightV - leftV) + length(upV - downV);
    float localMeanHeight = (
      height + left.r + right.r + up.r + down.r +
      upLeft.r + upRight.r + downLeft.r + downRight.r +
      left2.r + right2.r + up2.r + down2.r
    ) / 13.0;
    float localMeanFoam = (
      foam + left.b + right.b + up.b + down.b +
      upLeft.b + upRight.b + downLeft.b + downRight.b +
      left2.b + right2.b + up2.b + down2.b
    ) / 13.0;

    vec2 baseDir = normalize(vec2(cos(uFlowDirection), sin(uFlowDirection)));
    vec2 localVelocity = velocityAt(uv);
    vec2 mainDir = normalize(baseDir * 0.44 + localVelocity * 4.2 + vec2(0.001, -0.002));
    if (dot(mainDir, baseDir) < 0.0) mainDir *= -1.0;
    vec2 sideDir = vec2(-mainDir.y, mainDir.x);
    float alongCoord = dot(backUv - vec2(0.5), mainDir);
    float crossCoord = dot(backUv - vec2(0.5), sideDir);
    float upstream = dot(uv - vec2(0.5), -mainDir);
    float drainageBand = smoothstep(-0.58, 0.14, upstream) * (1.0 - smoothstep(-0.08, 0.72, upstream));
    float inlet = clamp(0.18 + drainageBand * 0.82, 0.0, 1.0);
    float edgeLoss = smoothstep(0.5, 0.78, length(uv - vec2(0.5)));
    float thinFilm = smoothstep(0.4, 0.88, 1.0 - height);
    float meniscus = smoothstep(0.012, 0.085, length(gradH)) * smoothstep(0.24, 0.9, height);
    float beadBreakup = smoothstep(0.82, 0.98, height) * smoothstep(0.04, 0.18, length(gradH));
    float dyeEdge = length(gradDye);
    float curvatureSupport = smoothstep(0.006, 0.1, abs(lapH) * 4.8 + dyeEdge * 1.1 + shear * 0.5);
    float surfactantRidge = smoothstep(0.006, 0.055, length(gradG));
    float heightValley = smoothstep(0.72, 0.32, height);
    float thickQuench = smoothstep(0.58, 0.92, height);
    vec2 gradRiver = vec2(riverRight.r - riverLeft.r, riverUp.r - riverDown.r);
    float lapRiver = riverLeft.r + riverRight.r + riverUp.r + riverDown.r - riverCenter.r * 4.0;
    float riverCore = smoothstep(0.12, 0.68, riverCenter.r);
    float riverBoundary = smoothstep(0.018, 0.14, length(gradRiver) * 1.8 + abs(lapRiver) * 0.75 + riverCenter.b * 0.34);
    float geometricMeniscus = riverBoundary * smoothstep(0.1, 0.82, riverCenter.r + riverCenter.b * 0.5);
    float riverMeniscusMass = smoothstep(0.04, 0.78, riverCenter.g);
    float neighborRiverCore = smoothstep(0.12, 0.68, max(max(riverLeft.r, riverRight.r), max(riverUp.r, riverDown.r)));
    float displacedRidge = smoothstep(0.04, 0.46, neighborRiverCore - riverCenter.r) * riverBoundary;
    float edgeBoundedMeniscus = riverMeniscusMass *
      smoothstep(0.035, 0.58, riverBoundary + riverCenter.b * 0.5 + displacedRidge * 0.38) *
      (1.0 - smoothstep(0.58, 0.92, riverCore));
    float riverMeniscus = clamp(max(geometricMeniscus, edgeBoundedMeniscus * 0.96 + riverBoundary * 0.14 + riverCenter.b * 0.16), 0.0, 1.0);
    float riverFilamentSupply = clamp(
      (
        riverBoundary * 0.58 +
        riverCenter.b * 0.42 +
        displacedRidge * 0.28 +
        geometricMeniscus * 0.18
      ) *
      smoothstep(0.08, 0.72, riverCenter.r) *
      (1.0 - smoothstep(0.4, 0.82, riverCenter.a)),
      0.0,
      1.0
    );
    float riverDrain = riverCore * (1.0 - edgeBoundedMeniscus * 0.62 - geometricMeniscus * 0.22) * uDrainage * (0.0048 + height * 0.0095 + uDripAmount * 0.0022);
    float riverRidgeDeposit = (edgeBoundedMeniscus * (1.08 + riverCenter.b * 0.48) + geometricMeniscus * 0.28 + displacedRidge * 0.42) *
      (0.0085 + uDripAmount * 0.009 + abs(lapRiver) * 0.0032) *
      (0.62 + height * 0.38);
    float meniscusRecovery = edgeBoundedMeniscus *
      max(0.0, 0.68 - height) *
      (0.0058 + uDripAmount * 0.0065 + abs(lapRiver) * 0.0015) *
      (0.48 + riverCenter.b * 0.34 + riverBoundary * 0.3);
    float fluxDrain = smoothstep(0.04, 0.84, riverFluxCenter.r) *
      (1.0 - smoothstep(0.3, 0.82, edgeBoundedMeniscus + riverCenter.b * 0.32)) *
      (0.008 + height * 0.011 + uDripAmount * 0.0025) *
      uDrainage;
    float fluxDepositRaw = clamp(
      riverFluxCenter.g * 0.74 +
      riverFluxCenter.b * 0.52 +
      max(max(riverFluxLeft.g, riverFluxRight.g), max(riverFluxDown.g, riverFluxUp.g)) * 0.18,
      0.0,
      1.0
    );
    float fluxDeposit = fluxDepositRaw *
      (0.012 + uDripAmount * 0.010 + uCapillary * 0.0025) *
      (0.54 + height * 0.28 + curvatureSupport * 0.18);
    float fluxWideSheet = smoothstep(0.22, 0.72, riverFluxCenter.a);
    float huangConvergence = max(0.0, -divergence * height);
    float flowConvergence = smoothstep(
      0.002,
      0.052,
      huangConvergence * 0.72 +
      max(0.0, -thinFluxDiv) * 0.16 +
      abs(lapH) * 0.18 +
      shear * 0.08
    );
    float sourceNoise = fbm(uv * vec2(5.2, 13.0) + mainDir * uTime * 0.05 + vec2(dye * 2.0, -dye));
    float sourceEddy = fbm(backUv * vec2(9.0, 4.8) - mainDir * uTime * 0.08 + vec2(surfactant, height));
    float streamInstability = smoothstep(
      0.52,
      0.82,
      fbm(vec2(crossCoord * 7.2 + surfactant * 1.1, alongCoord * 2.4 - height * 0.7) + vec2(uTime * 0.035, -uTime * 0.02)) * 0.56 +
      fbm(vec2(crossCoord * 12.5 - dye * 0.8, alongCoord * 4.1 + surfactant * 0.6) - vec2(uTime * 0.026, uTime * 0.041)) * 0.34 +
      flowConvergence * 0.18 +
      surfactantRidge * 0.16 -
      thickQuench * 0.16
    ) * inlet;
    float wideStreamInstability = smoothstep(
      0.55,
      0.8,
      fbm(vec2(crossCoord * 3.4 + surfactant * 0.72, alongCoord * 1.34 - height * 0.42) + vec2(uTime * 0.022, -uTime * 0.015)) * 0.64 +
      fbm(vec2(crossCoord * 5.7 - dye * 0.48, alongCoord * 2.25 + surfactant * 0.38) - vec2(uTime * 0.017, uTime * 0.026)) * 0.28 +
      flowConvergence * 0.14 +
      heightValley * 0.08 -
      thickQuench * 0.18
    ) * inlet;
    float sourceLane = smoothstep(
      0.44,
      0.76,
      sourceNoise * 0.36 +
      sourceEddy * 0.2 +
      streamInstability * 0.3 +
      wideStreamInstability * 0.14 +
      flowConvergence * 0.34 +
      surfactantRidge * 0.24 +
      heightValley * 0.18 -
      thickQuench * 0.18
    ) * inlet;
    float etaValleyLine = smoothstep(
      0.02,
      0.22,
      max(0.0, localMeanHeight - height) * 0.62 +
      length(gradH) * 0.42 +
      heightValley * 0.08
    );
    float gammaFront = smoothstep(
      0.012,
      0.18,
      length(gradG) +
      abs(dot(gradG, sideDir)) * 0.52 +
      surfactantRidge * 0.04
    );
    float crossPhysicalFront =
      abs(dot(gradG, sideDir)) * 0.62 +
      abs(dot(gradH, sideDir)) * 0.38 +
      abs(dot(gradDye, sideDir)) * 0.22;
    float alongPhysicalFront =
      abs(dot(gradG, mainDir)) * 0.48 +
      abs(dot(gradH, mainDir)) * 0.28 +
      abs(dot(gradDye, mainDir)) * 0.16;
    float narrowPhysicalGate = smoothstep(0.016, 0.18, crossPhysicalFront - alongPhysicalFront * 0.5);
    float physicalRiverPotential = clamp(
      (
        flowConvergence * 0.34 +
        etaValleyLine * 0.28 +
        gammaFront * 0.26 +
        curvatureSupport * 0.14 +
        shear * 0.06 -
        thickQuench * 0.24
      ) * inlet * (0.18 + narrowPhysicalGate * 0.82),
      0.0,
      1.0
    );
    float channelSupport = clamp(
      heightValley * 0.48 +
      curvatureSupport * 0.36 +
      surfactantRidge * 0.34 +
      flowConvergence * 0.28 +
      physicalRiverPotential * 0.18 +
      streamInstability * 0.08 +
      wideStreamInstability * 0.035 +
      sourceLane * 0.018 -
      thickQuench * 0.28,
      0.0,
      1.0
    ) * (0.12 + narrowPhysicalGate * 0.88);
    float localMeanDye = (
      dye + left.a + right.a + up.a + down.a +
      upLeft.a + upRight.a + downLeft.a + downRight.a +
      left2.a + right2.a + up2.a + down2.a
    ) / 13.0;
    float filamentGate = smoothstep(
      0.018,
      0.18,
      abs(dye - localMeanDye) * 0.9 +
      abs(foam - localMeanFoam) * 0.34 +
      max(0.0, localMeanHeight - height) * 0.42 +
      abs(lapDye) * 0.32 +
      abs(lapH) * 1.8 +
      shear * 0.1 +
      surfactantRidge * 0.12
    );
    float broadPhaseSheet = smoothstep(
      0.34,
      0.74,
      localMeanDye * 0.82 +
      localMeanFoam * 0.24 +
      wideStreamInstability * 0.18 +
      riverMeniscusMass * 0.16
    ) *
      (1.0 - filamentGate * 0.58) *
      (1.0 - physicalRiverPotential * 0.42) *
      (1.0 - narrowPhysicalGate * 0.18);
    float filamentPhaseSource = clamp(
      (
        riverFilamentSupply * 0.55 +
        filamentGate * riverBoundary * 0.36 +
        curvatureSupport * surfactantRidge * 0.22 +
        max(0.0, filamentGate - broadPhaseSheet * 0.58) * 0.18
      ) *
      smoothstep(0.02, 0.28, abs(lapDye) * 0.35 + length(gradH) * 1.4 + riverBoundary * 0.5) *
      (1.0 - broadPhaseSheet * 0.82) *
      (1.0 - wideStreamInstability * 0.35) *
      (1.0 - thickQuench * 0.22),
      0.0,
      1.0
    );
    float localMassBias = clamp(0.18 - localMeanDye, -0.42, 0.08);
    float thickIsland = smoothstep(0.58, 0.94, height + beadBreakup * 0.52 + foam * 0.14);
    float channelCore = smoothstep(
      0.42,
      0.78,
      channelSupport * 0.36 +
      physicalRiverPotential * 0.22 +
      flowConvergence * 0.11 +
      filamentGate * 0.13 +
      filamentPhaseSource * 0.24 -
      thickQuench * 0.22 -
      broadPhaseSheet * 0.28
    );
    channelCore *= 0.28 + physicalRiverPotential * 0.44 + narrowPhysicalGate * 0.28;
    float targetDye = clamp(
      max(
        mix(0.02, 0.62, channelCore),
        max(
          filamentPhaseSource * 0.62,
          max(
            physicalRiverPotential * 0.1,
            riverFilamentSupply * 0.66 + geometricMeniscus * 0.08 + riverMeniscusMass * riverBoundary * 0.04
          )
        )
      ) +
      localMassBias * 0.24 -
      thickIsland * 0.22 -
      broadPhaseSheet * 0.42,
      0.01,
      0.82
    );
    float phaseSharpen = (channelCore - 0.52) * dye * (1.0 - dye) *
      (0.16 + channelCore * 0.1 + filamentPhaseSource * 0.28 + physicalRiverPotential * 0.08) *
      (1.0 - broadPhaseSheet * 0.56);
    float boundaryNucleation = smoothstep(0.018, 0.16, dyeEdge * 2.8 + abs(lapH) * 2.2 + shear * 0.14 + meniscus * 0.08);
    float microAgitation = fbm(backUv * 112.0 + velocity * 10.0 + vec2(uTime * 0.13, -uTime * 0.09));
    float riverEdgeDroplet = smoothstep(0.05, 0.5, edgeBoundedMeniscus + riverCenter.b * 0.18) *
      smoothstep(0.035, 0.52, riverBoundary + geometricMeniscus + riverCenter.b * 0.32 + dyeEdge * 1.8 + shear * 0.12) *
      (1.0 - smoothstep(0.64, 0.92, riverCore));
    float microDropletSupport = clamp(
      boundaryNucleation * 0.52 +
      riverEdgeDroplet * 0.48 +
      smoothstep(0.012, 0.12, length(gradH) * 1.8 + dyeEdge * 0.92 + abs(lapH) * 1.6) * 0.34 +
      smoothstep(0.05, 0.42, shear) * 0.18 +
      filamentPhaseSource * 0.12,
      0.0,
      1.0
    );
    float wideFoamQuench = smoothstep(0.36, 0.78, riverMeniscusMass) *
      (1.0 - smoothstep(0.055, 0.42, riverBoundary + geometricMeniscus + dyeEdge * 1.4 + shear * 0.12 + abs(lapH) * 0.8));
    wideFoamQuench = max(wideFoamQuench, fluxWideSheet * (1.0 - smoothstep(0.04, 0.34, riverFluxCenter.b + riverBoundary)));
    float dropletGate = smoothstep(
      0.62,
      0.96,
      microAgitation * 0.72 +
      boundaryNucleation * 0.24 +
      dyeEdge * 4.6 +
      abs(lapH) * 4.8 +
      shear * 0.26 -
      height * 0.16
    );
    float capillaryDropletRidge = smoothstep(
      0.04,
      0.34,
      boundaryNucleation * 0.42 +
      dyeEdge * 2.1 +
      abs(lapH) * 2.6 +
      surfactantRidge * 0.36 +
      riverEdgeDroplet * 0.34 +
      shear * 0.1
    ) * (1.0 - smoothstep(0.34, 0.78, localMeanFoam + broadPhaseSheet * 0.35 + fluxWideSheet * 0.28));
    float foamPeakContrast = clamp(
      max(0.0, foam - localMeanFoam * 1.12) * 2.8 +
      max(0.0, -lapFoam) * 0.34 +
      abs(foam - localMeanFoam) * 0.18,
      0.0,
      1.0
    );
    float broadFoamBlob = smoothstep(0.22, 0.58, localMeanFoam + foam * 0.28) *
      (1.0 - capillaryDropletRidge * 0.72) *
      (1.0 - smoothstep(0.06, 0.38, dyeEdge * 2.0 + abs(lapH) * 1.4 + riverBoundary * 0.7 + surfactantRidge * 0.25));
    float foamBirth = (
      shear * 1.18 +
      abs(lapH) * 7.0 +
      dyeEdge * 10.0 +
      meniscus * 0.68 +
      beadBreakup * 0.34 +
      sourceLane * 0.035 +
      physicalRiverPotential * 0.12 +
      filamentPhaseSource * 0.18
    ) * thinFilm * (0.022 + dropletGate * (0.17 + microDropletSupport * 0.78)) *
      (0.22 + capillaryDropletRidge * 0.78) *
      (1.0 - wideFoamQuench * 0.82) *
      (1.0 - broadPhaseSheet * 0.56) *
      (1.0 - broadFoamBlob * 0.72);
    float edgeMicroFoamSupport = clamp(
      capillaryDropletRidge * 0.42 +
      riverEdgeDroplet * 0.36 +
      boundaryNucleation * 0.18 +
      filamentPhaseSource * dyeEdge * 0.18 +
      smoothstep(0.045, 0.42, shear) * dyeEdge * 0.14 +
      smoothstep(0.018, 0.16, abs(lapH) * 1.8 + length(gradH) * 0.75) * riverBoundary * 0.12,
      0.0,
      1.0
    );
    float microFoamPeak = smoothstep(
      0.58,
      0.94,
      microAgitation * 0.62 +
      capillaryDropletRidge * 0.34 +
      riverEdgeDroplet * 0.32 +
      foamPeakContrast * 0.22 +
      dyeEdge * 2.8 +
      abs(lapH) * 2.4 +
      shear * 0.16
    ) * edgeMicroFoamSupport;
    float fieldBroadFoamSheet = smoothstep(0.16, 0.48, localMeanFoam + foam * 0.28 + broadPhaseSheet * 0.32 + riverMeniscusMass * 0.18) *
      (1.0 - edgeMicroFoamSupport * 0.76) *
      (1.0 - microFoamPeak * 0.5) *
      (1.0 - foamPeakContrast * 0.48);
    float drainageLoss = uDrainage * uDripAmount * (0.002 + height * height * 0.014 + edgeLoss * 0.01);
    float heightQuench = smoothstep(0.6, 0.9, height) * smoothstep(0.1, 0.52, foam + abs(lapH) * 3.0);
    float phaseMobility = 0.055 + uDripAmount * 0.018 + shear * 0.028;
    float convergenceReservoir = smoothstep(
      0.001,
      0.03,
      huangConvergence * 0.94 +
      max(0.0, -divergence) * height * 0.28 +
      max(0.0, -thinFluxDiv) * 0.045 +
      edgeBoundedMeniscus * 0.026
    );
    float huangCompressionGate = smoothstep(
      0.0007,
      0.038,
      huangConvergence + max(0.0, -divergence) * height * 0.34
    );
    float huangNarrowReservoirGate = clamp(
      narrowPhysicalGate * 0.56 +
      physicalRiverPotential * 0.34 +
      flowConvergence * 0.24 +
      surfactantRidge * 0.16 -
      broadPhaseSheet * 0.34 -
      wideStreamInstability * 0.16,
      0.0,
      1.0
    );
    float huangReservoirGate = clamp(
      (0.10 + huangCompressionGate * 0.90) *
      (0.22 + huangNarrowReservoirGate * 0.78) *
      (1.0 - broadPhaseSheet * 0.42 - thickQuench * 0.08),
      0.16,
      1.0
    );
    float legacyThinFluxGate = clamp(
      0.10 + huangCompressionGate * 0.18 + huangNarrowReservoirGate * 0.22,
      0.08,
      0.44
    );
    float localCompression = clamp(
      flowConvergence * 0.62 +
      convergenceReservoir * 0.48 +
      surfactantRidge * 0.36 +
      riverBoundary * 0.34 +
      meniscus * 0.24 +
      max(0.0, -thinFluxDiv) * 0.035,
      0.0,
      1.0
    );
    float chemIslandShoulder = smoothstep(
      0.16,
      0.56,
      flowConvergence * 0.42 +
      convergenceReservoir * 0.34 +
      surfactantRidge * 0.52 +
      curvatureSupport * 0.28 +
      max(0.0, -thinFluxDiv) * 0.045 +
      heightValley * 0.12 +
      physicalRiverPotential * 0.08 +
      sourceLane * 0.008 -
      edgeLoss * 0.1 -
      broadPhaseSheet * 0.1
    );
    float chemIslandSeed = smoothstep(
      0.28,
      0.7,
      flowConvergence * 0.5 +
      convergenceReservoir * 0.42 +
      surfactantRidge * 0.58 +
      curvatureSupport * 0.34 +
      max(0.0, -thinFluxDiv) * 0.055 +
      physicalRiverPotential * 0.10 +
      sourceLane * 0.010 +
      inlet * 0.06 -
      channelCore * 0.06 -
      edgeLoss * 0.12
    );
    float thickIslandSeed = smoothstep(
      0.28,
      0.72,
      localCompression +
      chemIslandSeed * 0.34 +
      physicalRiverPotential * 0.07 +
      sourceLane * 0.05 +
      edgeBoundedMeniscus * 0.24 +
      inlet * 0.08 -
      channelCore * 0.12 -
      edgeLoss * 0.12
    );
    float thickIslandShoulder = smoothstep(
      0.18,
      0.58,
      localCompression * 0.74 +
      chemIslandShoulder * 0.36 +
      edgeBoundedMeniscus * 0.42 +
      riverBoundary * 0.22 +
      physicalRiverPotential * 0.06 +
      sourceLane * 0.010 -
      channelCore * 0.1 -
      edgeLoss * 0.08
    );
    float plateauTargetEta = clamp(
      0.33 +
      inlet * 0.035 +
      localCompression * 0.3 +
      chemIslandShoulder * 0.12 +
      chemIslandSeed * 0.32 +
      thickIslandShoulder * 0.18 +
      thickIslandSeed * 0.42 +
      edgeBoundedMeniscus * 0.18 -
      channelCore * 0.1 -
      edgeLoss * 0.035,
      0.24,
      0.86
    );
    float channelDrainBias = 1.0 - channelCore * (0.28 + thickIslandSeed * 0.12);
    float baselineReservoirFeed =
      max(0.0, 0.31 - height) *
      (0.035 + uSourceAmount * 0.03) *
      (0.28 + inlet * 0.42) *
      (1.0 - channelCore * 0.22) *
      (1.0 - edgeLoss * 0.2) *
      (0.58 + huangCompressionGate * 0.24);
    float plateauReservoirFeed =
      max(0.0, plateauTargetEta - height) *
      (0.19 + uSourceAmount * 0.12) *
      (
        0.12 +
        localCompression * 0.54 +
        chemIslandShoulder * 0.34 +
        chemIslandSeed * 0.62 +
        thickIslandShoulder * 0.42 +
        thickIslandSeed * 0.84 +
        edgeBoundedMeniscus * 0.36
      ) *
      channelDrainBias *
      (1.0 - edgeLoss * 0.18) *
      (0.42 + huangReservoirGate * 0.58);
    float islandDrainShield = clamp(
      1.0 - chemIslandShoulder * 0.2 - chemIslandSeed * 0.22 - thickIslandShoulder * 0.38 - thickIslandSeed * 0.22 - edgeBoundedMeniscus * 0.12,
      0.38,
      1.0
    );
    float highPrewarmIslandHold =
      max(0.0, 0.68 - height) *
      (0.036 + uSourceAmount * 0.032 + uDripAmount * 0.006) *
      (
        chemIslandShoulder * 0.34 +
        chemIslandSeed * 0.58 +
        thickIslandShoulder * 0.58 +
        thickIslandSeed * 0.78 +
        edgeBoundedMeniscus * 0.22 +
        localCompression * 0.18
      ) *
      (1.0 - channelCore * 0.42) *
      (1.0 - edgeLoss * 0.16) *
      (0.36 + huangReservoirGate * 0.64);
    float plateauEvaporation = max(0.0, height - 0.86) * (0.006 + uDrainage * 0.004);
    float surfactantReservoir =
      (0.49 + surfactantRidge * 0.06 - surfactant) *
      (0.012 + uDiffusion * 0.012) *
      (0.22 + inlet * 0.18 + localCompression * 0.32 + riverBoundary * 0.1) *
      (1.0 - channelCore * 0.28) *
      (1.0 - edgeLoss * 0.18);
    float etaMassRelaxation =
      (0.53 + localCompression * 0.04 + thickIslandSeed * 0.05 - height) *
      (0.010 + uDrainage * 0.012) *
      (1.0 - channelCore * 0.42) *
      (1.0 - edgeLoss * 0.18) *
      (0.70 + huangReservoirGate * 0.30);
    float highEtaDrain =
      max(0.0, height - 0.72) *
      (0.060 + uDrainage * 0.050) *
      (1.0 - thickIslandSeed * 0.34) *
      (1.0 - edgeBoundedMeniscus * 0.18);

    height += uDelta * (
      -thinFluxDiv * (0.05 + uDripAmount * 0.010 + uCapillary * 0.010) * legacyThinFluxGate +
      huangThicknessContinuity * (0.96 + uDrainage * 0.12 + huangCompressionGate * 0.20) +
      lapH * (0.002 + uDiffusion * 0.008) -
      fluxDiv * 0.025 -
      divergence * height * 0.008 -
      drainageLoss * islandDrainShield +
      sourceLane * uSourceAmount * (0.00045 + uPressure * 0.00018) * (0.24 + huangReservoirGate * 0.40) -
      riverDrain +
      riverRidgeDeposit * (0.42 + huangReservoirGate * 0.58) +
      meniscusRecovery * (0.36 + huangReservoirGate * 0.64) -
      fluxDrain +
      fluxDeposit * (0.36 + huangReservoirGate * 0.58) -
      streamInstability * uDrainage * 0.0016 -
      wideStreamInstability * uDrainage * 0.0022 -
      beadBreakup * 0.003 +
      baselineReservoirFeed +
      plateauReservoirFeed +
      highPrewarmIslandHold -
      plateauEvaporation +
      etaMassRelaxation -
      highEtaDrain
    );
    surfactant += uDelta * (
      -surfactantFluxDiv * (0.030 + uMarangoni * 0.014 + uDiffusion * 0.008) * legacyThinFluxGate +
      huangSurfactantContinuity * (1.04 + uMarangoni * 0.18 + huangCompressionGate * 0.18) +
      lapG * (0.006 + uDiffusion * 0.026) -
      dot(gradH, gradG) * 0.18 +
      (0.52 - surfactant) * 0.006 -
      sourceLane * uSourceAmount * 0.0015 +
      riverCore * 0.0012 -
      riverMeniscusMass * 0.0008 -
      geometricMeniscus * 0.00035 +
      surfactantReservoir
    );
    foam += uDelta * (
      lapFoam * (0.0006 + uDiffusion * 0.0022) +
      foamBirth * uFoamSource * (0.038 + microFoamPeak * 0.045) +
      riverEdgeDroplet * edgeMicroFoamSupport * uFoamSource * 0.007 +
      boundaryNucleation * sourceLane * uFoamSource * 0.008 -
      foam * (0.13 + uFoamDecay * 0.24 + height * 0.036 + (1.0 - dropletGate) * 0.08 + wideFoamQuench * 0.62 + broadPhaseSheet * 0.48 + broadFoamBlob * 0.72 + fieldBroadFoamSheet * 0.86 + riverMeniscusMass * (1.0 - riverEdgeDroplet) * 0.16)
    );
    float fieldFoamCeiling = clamp(
      0.012 +
      edgeMicroFoamSupport * 0.12 +
      microFoamPeak * 0.24 +
      foamPeakContrast * 0.08 +
      capillaryDropletRidge * 0.08 -
      fieldBroadFoamSheet * 0.12 -
      broadPhaseSheet * 0.05,
      0.006,
      0.34
    );
    float fieldFoamRelax = clamp(
      uDelta * (
        3.5 +
        fieldBroadFoamSheet * 13.0 +
        broadPhaseSheet * 7.0 +
        wideFoamQuench * 6.0 +
        broadFoamBlob * 7.0 +
        (1.0 - edgeMicroFoamSupport) * 2.5 +
        (1.0 - foamPeakContrast) * 2.2
      ),
      0.0,
      0.72
    );
    foam = mix(foam, min(foam, fieldFoamCeiling), fieldFoamRelax);
    dye += uDelta * (
      cahnHilliard * phaseMobility * 0.074 +
      phaseSharpen * (0.28 + riverMeniscus * 0.1) +
      lapDye * (0.00025 + uDiffusion * 0.001) +
      (targetDye - dye) * (0.018 + shear * 0.004 + channelCore * 0.02) * (0.34 + channelCore * 0.66 + filamentPhaseSource * 0.24) +
      sourceLane * filamentGate * uSourceAmount * 0.00006 +
      physicalRiverPotential * filamentGate * uSourceAmount * 0.00022 +
      filamentPhaseSource * (0.0025 + boundaryNucleation * 0.0035 + shear * 0.0012) +
      foamBirth * uFoamSource * 0.00042 +
      (0.16 - dye) * thickIsland * 0.012 +
      (0.08 - dye) * broadPhaseSheet * 0.13 +
      (0.14 - dye) * smoothstep(0.5, 0.82, dye) * (1.0 - channelCore) * 0.025 +
      (0.16 - dye) * heightQuench * 0.006 +
      (0.14 - dye) * (0.002 + edgeLoss * 0.004)
    );
    float fieldPhaseCeiling = clamp(
      0.105 +
      channelCore * 0.54 +
      physicalRiverPotential * 0.28 +
      filamentPhaseSource * 0.34 +
      riverFilamentSupply * 0.22 +
      filamentGate * 0.08 -
      broadPhaseSheet * 0.1 -
      thickIsland * 0.08,
      0.06,
      0.86
    );
    float fieldCeilingRelax = clamp(
      (1.0 - channelCore) * 0.08 +
      broadPhaseSheet * 0.22 +
      thickIsland * 0.08,
      0.0,
      0.42
    );
    dye = mix(
      dye,
      min(dye, fieldPhaseCeiling),
      clamp(uDelta * fieldCeilingRelax * 14.0, 0.0, 0.42)
    );

    gl_FragColor = vec4(
      clamp(height, 0.035, 0.975),
      clamp(surfactant, 0.025, 0.975),
      clamp(foam, 0.0, 0.98),
      clamp(dye, 0.0, 0.98)
    );
  }
`;

const INIT_RIVER_PHASE_FRAGMENT_SHADER = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uField;
  uniform vec2 uTexel;
  uniform float uFlowDirection;

  vec3 sphericalSampleUv(vec2 uv) {
    float x = uv.x;
    float y = uv.y;
    if (y < 0.0) {
      y = -y;
      x += 0.5;
    }
    if (y > 1.0) {
      y = 2.0 - y;
      x += 0.5;
    }
    return vec3(fract(x), clamp(y, 0.002, 0.998), 0.0);
  }

  vec2 sampleUv(vec2 uv) {
    return sphericalSampleUv(uv).xy;
  }

  vec4 fieldAt(vec2 uv) {
    return texture2D(uField, sampleUv(uv));
  }

  float highPhase(float dye) {
    return smoothstep(0.44, 0.7, dye);
  }

  void main() {
    vec2 uv = vUv;
    vec4 c = fieldAt(uv);
    vec4 l = fieldAt(uv - vec2(uTexel.x, 0.0));
    vec4 r = fieldAt(uv + vec2(uTexel.x, 0.0));
    vec4 d = fieldAt(uv - vec2(0.0, uTexel.y));
    vec4 u = fieldAt(uv + vec2(0.0, uTexel.y));
    vec2 mainDir = normalize(vec2(cos(uFlowDirection), sin(uFlowDirection)));
    float upstream = dot(uv - vec2(0.5), -mainDir);
    float inlet = clamp(0.18 + smoothstep(-0.58, 0.16, upstream) * (1.0 - smoothstep(-0.08, 0.72, upstream)) * 0.82, 0.0, 1.0);
    vec2 gradH = vec2(r.r - l.r, u.r - d.r);
    vec2 gradG = vec2(r.g - l.g, u.g - d.g);
    vec2 gradDye = vec2(r.a - l.a, u.a - d.a);
    float lapH = l.r + r.r + u.r + d.r - c.r * 4.0;
    float heightValley = smoothstep(0.72, 0.3, c.r);
    float thickIsland = smoothstep(0.62, 0.98, c.r + length(gradH) * 1.38 + c.b * 0.12);
    float surfactantRidge = smoothstep(0.006, 0.054, length(gradG));
    float curvature = smoothstep(0.006, 0.095, abs(lapH) * 4.6 + length(gradDye) * 0.72);
    float river = clamp(
      (
        highPhase(c.a) * 0.52 +
        heightValley * 0.36 +
        surfactantRidge * 0.28 +
        curvature * 0.22 -
        thickIsland * 0.16
      ) * inlet,
      0.0,
      1.0
    );
    river = smoothstep(0.24, 0.7, river);
    float ridge = smoothstep(0.018, 0.12, length(gradDye) + abs(lapH) * 0.32 + length(gradG) * 0.18) * smoothstep(0.1, 0.82, river);
    float meniscusMass = clamp(ridge * (0.34 + river * 0.46) + thickIsland * ridge * 0.12 + c.b * 0.04, 0.0, 1.0);
    float sheetReject = smoothstep(0.68, 0.94, river + highPhase(c.a) * 0.34) * (1.0 - ridge * 0.62);
    gl_FragColor = vec4(river, meniscusMass, ridge, sheetReject);
  }
`;

const REGIONAL_SUPPORT_FRAGMENT_SHADER = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uField;
  uniform sampler2D uVelocity;
  uniform vec2 uTexel;
  uniform float uFlowDirection;
  uniform float uCapillary;

  vec3 sphericalSampleUv(vec2 uv) {
    float x = uv.x;
    float y = uv.y;
    float poleCross = 0.0;
    if (y < 0.0) {
      y = -y;
      x += 0.5;
      poleCross = 1.0;
    }
    if (y > 1.0) {
      y = 2.0 - y;
      x += 0.5;
      poleCross = 1.0;
    }
    return vec3(fract(x), clamp(y, 0.002, 0.998), poleCross);
  }

  vec2 sampleUv(vec2 uv) {
    return sphericalSampleUv(uv).xy;
  }

  vec4 fieldAt(vec2 uv) {
    return texture2D(uField, sampleUv(uv));
  }

  vec2 velocityAt(vec2 uv) {
    vec3 sphereUv = sphericalSampleUv(uv);
    vec2 velocity = (texture2D(uVelocity, sphereUv.xy).rg - 0.5) * 0.5;
    return mix(velocity, -velocity, sphereUv.z);
  }

  float highPhase(float dye) {
    return smoothstep(0.44, 0.66, dye);
  }

  float physicalSupportAt(vec2 sampleUv, vec2 mainDir) {
    vec4 c = fieldAt(sampleUv);
    vec4 l = fieldAt(sampleUv - vec2(uTexel.x, 0.0));
    vec4 r = fieldAt(sampleUv + vec2(uTexel.x, 0.0));
    vec4 d = fieldAt(sampleUv - vec2(0.0, uTexel.y));
    vec4 u = fieldAt(sampleUv + vec2(0.0, uTexel.y));
    vec2 gradH = vec2(r.r - l.r, u.r - d.r);
    vec2 gradG = vec2(r.g - l.g, u.g - d.g);
    vec2 gradDye = vec2(r.a - l.a, u.a - d.a);
    float lapH = l.r + r.r + u.r + d.r - c.r * 4.0;
    vec2 lV = velocityAt(sampleUv - vec2(uTexel.x, 0.0));
    vec2 rV = velocityAt(sampleUv + vec2(uTexel.x, 0.0));
    vec2 dV = velocityAt(sampleUv - vec2(0.0, uTexel.y));
    vec2 uV = velocityAt(sampleUv + vec2(0.0, uTexel.y));
    float shear = length(rV - lV) + length(uV - dV);
    float convergence = max(0.0, -((rV.x - lV.x) + (uV.y - dV.y)) * 0.5);
    float upstream = dot(sampleUv - vec2(0.5), -mainDir);
    float drainageBand = smoothstep(-0.58, 0.14, upstream) * (1.0 - smoothstep(-0.08, 0.72, upstream));
    float inlet = clamp(0.18 + drainageBand * 0.82, 0.0, 1.0);
    float heightValley = smoothstep(0.74, 0.28, c.r);
    float thickIsland = smoothstep(0.6, 0.94, c.r + smoothstep(0.04, 0.18, length(gradH)) * 0.34 + c.b * 0.12);
    float surfactantRidge = smoothstep(0.006, 0.052, length(gradG));
    float curvature = smoothstep(0.006, 0.095, abs(lapH) * (4.2 + uCapillary * 0.8) + length(gradDye) * 0.82 + shear * 0.42);
    return clamp(
      (
        heightValley * 0.34 +
        surfactantRidge * 0.32 +
        curvature * 0.22 +
        convergence * 0.36 -
        thickIsland * 0.28
      ) * inlet,
      0.0,
      1.0
    );
  }

  float regionalHighAt(vec2 sampleUv) {
    vec4 c = fieldAt(sampleUv);
    return highPhase(c.a);
  }

  void main() {
    vec2 uv = vUv;
    vec2 mainDir = normalize(vec2(cos(uFlowDirection), sin(uFlowDirection)));
    vec2 sideDir = vec2(-mainDir.y, mainDir.x);
    vec2 alongStep = mainDir * uTexel * 5.5;
    vec2 wideAlongStep = mainDir * uTexel * 12.5;
    vec2 sideStep = sideDir * uTexel * 4.25;
    vec2 wideSideStep = sideDir * uTexel * 9.5;

    float centerSupport = physicalSupportAt(uv, mainDir);
    float alongSupport = (
      centerSupport * 1.35 +
      physicalSupportAt(uv + alongStep, mainDir) +
      physicalSupportAt(uv - alongStep, mainDir) +
      physicalSupportAt(uv + wideAlongStep, mainDir) * 0.7 +
      physicalSupportAt(uv - wideAlongStep, mainDir) * 0.7
    ) / 4.75;
    float nearAcrossSupport = (
      physicalSupportAt(uv + sideStep, mainDir) +
      physicalSupportAt(uv - sideStep, mainDir)
    ) * 0.5;
    float farAcrossSupport = (
      physicalSupportAt(uv + wideSideStep, mainDir) +
      physicalSupportAt(uv - wideSideStep, mainDir)
    ) * 0.5;
    float acrossSupport = mix(nearAcrossSupport, farAcrossSupport, 0.58);
    float diagonalSupport = (
      physicalSupportAt(uv + alongStep + sideStep, mainDir) +
      physicalSupportAt(uv + alongStep - sideStep, mainDir) +
      physicalSupportAt(uv - alongStep + sideStep, mainDir) +
      physicalSupportAt(uv - alongStep - sideStep, mainDir)
    ) * 0.25;

    float sheetSupport = clamp(
      centerSupport * 0.28 +
      alongSupport * 0.56 +
      diagonalSupport * 0.16 -
      acrossSupport * 0.18,
      0.0,
      1.0
    );
    float transverseRidge = clamp(centerSupport * 1.85 - nearAcrossSupport * 0.88 - farAcrossSupport * 0.42, -0.45, 1.0);
    float lineContinuity = smoothstep(0.08, 0.5, alongSupport + diagonalSupport * 0.22);
    float sheetPenalty = smoothstep(0.38, 0.78, sheetSupport + nearAcrossSupport * 0.35) *
      (1.0 - smoothstep(0.08, 0.42, transverseRidge));
    float sharpRidge = smoothstep(0.02, 0.42, transverseRidge + (alongSupport - acrossSupport * 0.52) * 0.38) *
      lineContinuity *
      smoothstep(0.04, 0.48, sheetSupport);
    float lineBridge = smoothstep(0.18, 0.54, alongSupport + diagonalSupport * 0.18) *
      smoothstep(-0.035, 0.24, alongSupport - nearAcrossSupport * 0.42) *
      (1.0 - smoothstep(0.58, 0.88, nearAcrossSupport + farAcrossSupport * 0.55));
    float ridge = max(sharpRidge, lineBridge * 0.18);
    float lateralPeak = max(0.0, centerSupport - acrossSupport * 0.78);
    float flowPeak = max(0.0, alongSupport - nearAcrossSupport * 0.72);
    float regionalSupport = clamp(
      sheetSupport * 0.24 +
      sharpRidge * 0.32 +
      lineBridge * 0.035 +
      lateralPeak * 0.28 +
      flowPeak * 0.26 +
      alongSupport * 0.055 -
      sheetPenalty * 0.28,
      0.0,
      1.0
    );

    float highCenter = regionalHighAt(uv);
    float highAlong = (
      highCenter * 1.25 +
      regionalHighAt(uv + alongStep) +
      regionalHighAt(uv - alongStep) +
      regionalHighAt(uv + wideAlongStep) * 0.7 +
      regionalHighAt(uv - wideAlongStep) * 0.7
    ) / 4.65;
    float nearHighAcross = (
      regionalHighAt(uv + sideStep) +
      regionalHighAt(uv - sideStep)
    ) * 0.5;
    float farHighAcross = (
      regionalHighAt(uv + wideSideStep) +
      regionalHighAt(uv - wideSideStep)
    ) * 0.5;
    float highAcross = mix(nearHighAcross, farHighAcross, 0.58);
    float highDiagonal = (
      regionalHighAt(uv + alongStep + sideStep) +
      regionalHighAt(uv + alongStep - sideStep) +
      regionalHighAt(uv - alongStep + sideStep) +
      regionalHighAt(uv - alongStep - sideStep)
    ) * 0.25;
    float regionalHigh = clamp(highCenter * 0.26 + highAlong * 0.48 + highAcross * 0.14 + highDiagonal * 0.12, 0.0, 1.0);

    float targetHigh = clamp(0.17 + regionalSupport * 0.038 + ridge * 0.044 + flowPeak * 0.014 - sheetPenalty * 0.062, 0.105, 0.245);
    float highDeficit = clamp(targetHigh - regionalHigh, 0.0, 0.22);
    float highExcess = clamp(regionalHigh - targetHigh, 0.0, 0.58);
    float ridgeSupply = highDeficit * (0.34 + ridge * 0.36 + flowPeak * 0.12);
    float sheetDrain = highExcess * (0.54 + sheetPenalty * 0.34 + smoothstep(0.36, 0.72, highAcross) * 0.22);
    float massBalancedSupport = clamp(
      regionalSupport * 0.78 +
      ridge * 0.18 +
      flowPeak * 0.12 +
      ridgeSupply -
      sheetDrain -
      sheetPenalty * 0.12,
      0.0,
      1.0
    );

    gl_FragColor = vec4(massBalancedSupport, regionalHigh, ridge, clamp(sheetPenalty, 0.0, 1.0));
  }
`;

const REGIONAL_EVOLVE_FRAGMENT_SHADER = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uRegionalSource;
  uniform sampler2D uRegionalPrevious;
  uniform sampler2D uVelocity;
  uniform vec2 uTexel;
  uniform float uDelta;
  uniform float uFlowDirection;
  uniform float uDripAmount;

  vec3 sphericalSampleUv(vec2 uv) {
    float x = uv.x;
    float y = uv.y;
    float poleCross = 0.0;
    if (y < 0.0) {
      y = -y;
      x += 0.5;
      poleCross = 1.0;
    }
    if (y > 1.0) {
      y = 2.0 - y;
      x += 0.5;
      poleCross = 1.0;
    }
    return vec3(fract(x), clamp(y, 0.002, 0.998), poleCross);
  }

  vec2 sampleUv(vec2 uv) {
    return sphericalSampleUv(uv).xy;
  }

  vec4 sourceAt(vec2 uv) {
    return texture2D(uRegionalSource, sampleUv(uv));
  }

  vec4 previousAt(vec2 uv) {
    return texture2D(uRegionalPrevious, sampleUv(uv));
  }

  vec2 velocityAt(vec2 uv) {
    vec3 sphereUv = sphericalSampleUv(uv);
    vec2 velocity = (texture2D(uVelocity, sphereUv.xy).rg - 0.5) * 0.5;
    return mix(velocity, -velocity, sphereUv.z);
  }

  float upwind(float faceVelocity, float upstreamValue, float downstreamValue) {
    return faceVelocity >= 0.0 ? upstreamValue : downstreamValue;
  }

  float chemicalPotentialAt(vec2 uv) {
    vec4 c = previousAt(uv);
    vec4 s = sourceAt(uv);
    float center = clamp(c.r, 0.001, 0.999);
    float left = previousAt(uv - vec2(uTexel.x, 0.0)).r;
    float right = previousAt(uv + vec2(uTexel.x, 0.0)).r;
    float down = previousAt(uv - vec2(0.0, uTexel.y)).r;
    float up = previousAt(uv + vec2(0.0, uTexel.y)).r;
    float lapPhi = left + right + down + up - center * 4.0;

    float srcLeft = sourceAt(uv - vec2(uTexel.x, 0.0)).r;
    float srcRight = sourceAt(uv + vec2(uTexel.x, 0.0)).r;
    float srcDown = sourceAt(uv - vec2(0.0, uTexel.y)).r;
    float srcUp = sourceAt(uv + vec2(0.0, uTexel.y)).r;
    float sourceMean = (srcLeft + srcRight + srcDown + srcUp) * 0.25;
    float sourcePeak = max(0.0, s.r - sourceMean * 0.94);
    float target = clamp(s.r * 0.26 + sourcePeak * 0.56 + s.b * 0.38 - s.a * 0.34, 0.01, 0.72);
    float localMass = (center * 1.6 + left + right + down + up) / 5.6;
    float phi = center * 2.0 - 1.0;
    float targetPhi = target * 2.0 - 1.0;
    float doubleWell = phi * phi * phi - phi;
    float supportBias = (phi - targetPhi) * (0.5 + sourcePeak * 0.42 + s.b * 0.28);
    float massPenalty = (localMass - target) * (0.64 + s.a * 0.34);
    float sheetPenalty = smoothstep(0.28, 0.68, s.a + sourceMean * 0.32) * 0.46;
    return doubleWell - lapPhi * (0.5 + s.b * 0.18) + supportBias + massPenalty + sheetPenalty;
  }

  void main() {
    vec2 uv = vUv;
    vec2 mainDir = normalize(vec2(cos(uFlowDirection), sin(uFlowDirection)));
    vec2 alongStep = mainDir * uTexel;

    vec4 s = sourceAt(uv);
    vec4 c = previousAt(uv);
    float previousMass = c.r;
    float sourceMass = s.r;
    float sourceRidge = s.b;
    float sourceSheet = s.a;

    vec2 v = velocityAt(uv);
    float speed = length(v);
    vec2 flowDir = normalize(v + mainDir * (0.012 + sourceRidge * 0.018) + vec2(0.001, -0.001));
    float advectCells = clamp(speed * 4.6 + sourceRidge * 0.38 + sourceMass * 0.12, 0.05, 0.9);
    float advected = previousAt(uv - flowDir * uTexel * advectCells).r;
    float alongA = previousAt(uv + alongStep).r;
    float alongB = previousAt(uv - alongStep).r;
    float alongLaplacian = alongA + alongB - previousMass * 2.0;
    float srcL = sourceAt(uv - vec2(uTexel.x, 0.0)).r;
    float srcR = sourceAt(uv + vec2(uTexel.x, 0.0)).r;
    float srcD = sourceAt(uv - vec2(0.0, uTexel.y)).r;
    float srcU = sourceAt(uv + vec2(0.0, uTexel.y)).r;
    float sourceMean = (srcL + srcR + srcD + srcU) * 0.25;
    float sourcePeak = max(0.0, sourceMass - sourceMean * 0.94);
    float targetSupport = clamp(sourceMass * 0.2 + sourcePeak * 0.58 + sourceRidge * 0.38 - sourceSheet * 0.32, 0.0, 1.0);
    float muC = chemicalPotentialAt(uv);
    float muL = chemicalPotentialAt(uv - vec2(uTexel.x, 0.0));
    float muR = chemicalPotentialAt(uv + vec2(uTexel.x, 0.0));
    float muD = chemicalPotentialAt(uv - vec2(0.0, uTexel.y));
    float muU = chemicalPotentialAt(uv + vec2(0.0, uTexel.y));
    float lapMu = muL + muR + muD + muU - muC * 4.0;
    float mobility = 0.052 + sourceRidge * 0.085 + sourcePeak * 0.095 + smoothstep(0.04, 0.36, previousMass) * 0.024;
    float evolveStep = clamp(uDelta * 60.0, 0.035, 0.2);
    float support = previousMass;
    support += evolveStep * (
      lapMu * mobility +
      (targetSupport - support) * (0.026 + sourcePeak * 0.082 + sourceRidge * 0.052) +
      (advected - support) * (0.052 + speed * 0.1) +
      alongLaplacian * (0.014 + sourceRidge * 0.024) -
      smoothstep(0.34, 0.72, sourceSheet + sourceMean * 0.3) * support * 0.052
    );
    support = clamp(support, 0.0, 1.0);

    float localMean = (previousAt(uv - vec2(uTexel.x, 0.0)).r + previousAt(uv + vec2(uTexel.x, 0.0)).r + previousAt(uv - vec2(0.0, uTexel.y)).r + previousAt(uv + vec2(0.0, uTexel.y)).r) * 0.25;
    float ridgeSeed = clamp(sourceRidge * 0.5 + sourcePeak * 0.85 + max(0.0, support - localMean * 0.92) * 0.72, 0.0, 1.0);
    float high = clamp(mix(c.g, s.g, 0.12) + (support - previousMass) * 0.04, 0.0, 1.0);
    float ridge = clamp(mix(c.b, ridgeSeed, 0.18) + max(0.0, support - localMean * 0.9) * 0.16, 0.0, 1.0);
    float reject = clamp(sourceSheet * 0.68 + smoothstep(0.55, 0.86, sourceMean) * 0.2, 0.0, 1.0);

    gl_FragColor = vec4(support, high, ridge, reject);
  }
`;

const REGIONAL_FLOW_FRAGMENT_SHADER = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uRegionalSupport;
  uniform sampler2D uVelocity;
  uniform vec2 uTexel;
  uniform float uFlowDirection;

  vec3 sphericalSampleUv(vec2 uv) {
    float x = uv.x;
    float y = uv.y;
    float poleCross = 0.0;
    if (y < 0.0) {
      y = -y;
      x += 0.5;
      poleCross = 1.0;
    }
    if (y > 1.0) {
      y = 2.0 - y;
      x += 0.5;
      poleCross = 1.0;
    }
    return vec3(fract(x), clamp(y, 0.002, 0.998), poleCross);
  }

  vec2 sampleUv(vec2 uv) {
    return sphericalSampleUv(uv).xy;
  }

  vec4 regionalAt(vec2 uv) {
    return texture2D(uRegionalSupport, sampleUv(uv));
  }

  vec2 velocityAt(vec2 uv) {
    vec3 sphereUv = sphericalSampleUv(uv);
    vec2 velocity = (texture2D(uVelocity, sphereUv.xy).rg - 0.5) * 0.5;
    return mix(velocity, -velocity, sphereUv.z);
  }

  void main() {
    vec2 uv = vUv;
    vec2 mainDir = normalize(vec2(cos(uFlowDirection), sin(uFlowDirection)));
    vec2 sideDir = vec2(-mainDir.y, mainDir.x);
    vec2 alongStep = mainDir * uTexel * 1.5;
    vec2 wideAlongStep = mainDir * uTexel * 3.0;
    vec2 sideStep = sideDir * uTexel * 1.5;
    vec2 wideSideStep = sideDir * uTexel * 3.0;

    vec4 c = regionalAt(uv);
    vec4 alongA = regionalAt(uv + alongStep);
    vec4 alongB = regionalAt(uv - alongStep);
    vec4 wideAlongA = regionalAt(uv + wideAlongStep);
    vec4 wideAlongB = regionalAt(uv - wideAlongStep);
    vec4 sideA = regionalAt(uv + sideStep);
    vec4 sideB = regionalAt(uv - sideStep);
    vec4 wideSideA = regionalAt(uv + wideSideStep);
    vec4 wideSideB = regionalAt(uv - wideSideStep);

    float supportAlong = (c.r * 1.4 + alongA.r + alongB.r + wideAlongA.r * 0.55 + wideAlongB.r * 0.55) / 4.5;
    float supportAcross = (sideA.r + sideB.r + wideSideA.r * 0.55 + wideSideB.r * 0.55) / 3.1;
    float ridgeAlong = (c.b * 1.5 + alongA.b + alongB.b + wideAlongA.b * 0.65 + wideAlongB.b * 0.65) / 4.8;
    float ridgeAcross = (sideA.b + sideB.b + wideSideA.b * 0.65 + wideSideB.b * 0.65) / 3.3;
    float highAcross = (sideA.g + sideB.g + wideSideA.g * 0.45 + wideSideB.g * 0.45) / 2.9;
    float sheetAcross = (sideA.a + sideB.a + wideSideA.a * 0.45 + wideSideB.a * 0.45) / 2.9;

    vec2 gradRidge = vec2(
      regionalAt(uv + vec2(uTexel.x, 0.0)).b - regionalAt(uv - vec2(uTexel.x, 0.0)).b,
      regionalAt(uv + vec2(0.0, uTexel.y)).b - regionalAt(uv - vec2(0.0, uTexel.y)).b
    );
    vec2 gradSupport = vec2(
      regionalAt(uv + vec2(uTexel.x, 0.0)).r - regionalAt(uv - vec2(uTexel.x, 0.0)).r,
      regionalAt(uv + vec2(0.0, uTexel.y)).r - regionalAt(uv - vec2(0.0, uTexel.y)).r
    );
    vec2 tangentFromRidge = normalize(vec2(-gradRidge.y, gradRidge.x) + mainDir * 0.08);
    vec2 tangentFromSupport = normalize(vec2(-gradSupport.y, gradSupport.x) + mainDir * 0.12);
    float ridgeGradient = clamp(length(gradRidge) * 12.0, 0.0, 1.0);
    vec2 tangent = normalize(mix(tangentFromSupport, tangentFromRidge, ridgeGradient) + mainDir * 0.16);
    if (dot(tangent, mainDir) < 0.0) tangent *= -1.0;

    vec2 localVelocity = velocityAt(uv);
    if (dot(tangent, localVelocity + mainDir * 0.04) < 0.0) tangent *= -1.0;

    float ridgePeak = max(0.0, c.b - ridgeAcross * 0.62);
    float supportPeak = max(0.0, c.r - supportAcross * 0.86);
    float longitudinalPeak = max(0.0, ridgeAlong - ridgeAcross * 0.78);
    float skeletonSeed = c.b * 0.74 + ridgePeak * 1.35 + supportPeak * 0.48 + longitudinalPeak * 0.42;
    float alongContinuity = smoothstep(0.12, 0.58, supportAlong * 0.48 + ridgeAlong * 0.86);
    float sheetReject = smoothstep(0.24, 0.72, c.a + sheetAcross * 0.58 + max(0.0, highAcross - c.g) * 0.42 + supportAcross * 0.18);
    float skeleton = clamp(
      smoothstep(0.08, 0.46, skeletonSeed) *
      alongContinuity *
      smoothstep(0.045, 0.58, c.b + ridgePeak * 0.9 + supportPeak * 0.38) *
      (1.0 - sheetReject * 0.82),
      0.0,
      1.0
    );
    float bridgeSpeed = clamp(
      skeleton *
      (0.18 + c.b * 0.58 + longitudinalPeak * 0.62 + length(localVelocity) * 2.2) *
      (1.0 - smoothstep(0.36, 0.72, c.g) * (1.0 - c.b * 0.55)),
      0.0,
      1.0
    );

    gl_FragColor = vec4(tangent * 0.5 + 0.5, skeleton, bridgeSpeed);
  }
`;

const REGIONAL_RIDGE_FRAGMENT_SHADER = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uField;
  uniform sampler2D uVelocity;
  uniform sampler2D uRegionalSupport;
  uniform vec2 uTexel;
  uniform vec2 uFieldTexel;
  uniform float uFlowDirection;
  uniform float uCapillary;

  vec3 sphericalSampleUv(vec2 uv) {
    float x = uv.x;
    float y = uv.y;
    float poleCross = 0.0;
    if (y < 0.0) {
      y = -y;
      x += 0.5;
      poleCross = 1.0;
    }
    if (y > 1.0) {
      y = 2.0 - y;
      x += 0.5;
      poleCross = 1.0;
    }
    return vec3(fract(x), clamp(y, 0.002, 0.998), poleCross);
  }

  vec2 sampleUv(vec2 uv) {
    return sphericalSampleUv(uv).xy;
  }

  vec4 regionalAt(vec2 uv) {
    return texture2D(uRegionalSupport, sampleUv(uv));
  }

  vec4 fieldAt(vec2 uv) {
    return texture2D(uField, sampleUv(uv));
  }

  vec2 velocityAt(vec2 uv) {
    vec3 sphereUv = sphericalSampleUv(uv);
    vec2 velocity = (texture2D(uVelocity, sphereUv.xy).rg - 0.5) * 0.5;
    return mix(velocity, -velocity, sphereUv.z);
  }

  float physicalScoreAt(vec2 sampleUv, vec2 mainDir) {
    vec4 c = fieldAt(sampleUv);
    vec4 l = fieldAt(sampleUv - vec2(uFieldTexel.x, 0.0));
    vec4 r = fieldAt(sampleUv + vec2(uFieldTexel.x, 0.0));
    vec4 d = fieldAt(sampleUv - vec2(0.0, uFieldTexel.y));
    vec4 u = fieldAt(sampleUv + vec2(0.0, uFieldTexel.y));
    vec2 gradH = vec2(r.r - l.r, u.r - d.r);
    vec2 gradG = vec2(r.g - l.g, u.g - d.g);
    vec2 gradDye = vec2(r.a - l.a, u.a - d.a);
    float lapH = l.r + r.r + u.r + d.r - c.r * 4.0;
    vec2 lV = velocityAt(sampleUv - vec2(uFieldTexel.x, 0.0));
    vec2 rV = velocityAt(sampleUv + vec2(uFieldTexel.x, 0.0));
    vec2 dV = velocityAt(sampleUv - vec2(0.0, uFieldTexel.y));
    vec2 uV = velocityAt(sampleUv + vec2(0.0, uFieldTexel.y));
    float shear = length(rV - lV) + length(uV - dV);
    float convergence = max(0.0, -((rV.x - lV.x) + (uV.y - dV.y)) * 0.5);
    float upstream = dot(sampleUv - vec2(0.5), -mainDir);
    float drainageBand = smoothstep(-0.58, 0.14, upstream) * (1.0 - smoothstep(-0.08, 0.72, upstream));
    float inlet = clamp(0.18 + drainageBand * 0.82, 0.0, 1.0);
    float heightValley = smoothstep(0.72, 0.28, c.r);
    float thickIsland = smoothstep(0.6, 0.94, c.r + smoothstep(0.04, 0.18, length(gradH)) * 0.34 + c.b * 0.1);
    float surfactantRidge = smoothstep(0.006, 0.052, length(gradG));
    float phaseBoundary = smoothstep(0.012, 0.09, length(gradDye) * 1.7);
    float curvature = smoothstep(0.006, 0.095, abs(lapH) * (4.2 + uCapillary * 0.8) + length(gradDye) * 0.72 + shear * 0.38);
    return clamp(
      (
        heightValley * 0.22 +
        surfactantRidge * 0.34 +
        phaseBoundary * 0.22 +
        curvature * 0.24 +
        convergence * 0.34 +
        shear * 0.12 -
        thickIsland * 0.22
      ) * inlet,
      0.0,
      1.0
    );
  }

  void main() {
    vec2 uv = vUv;
    vec2 mainDir = normalize(vec2(cos(uFlowDirection), sin(uFlowDirection)));
    vec2 sideDir = vec2(-mainDir.y, mainDir.x);
    vec2 alongStep = mainDir * uTexel * 1.5;
    vec2 wideAlongStep = mainDir * uTexel * 3.2;
    vec2 sideStep = sideDir * uTexel * 1.45;
    vec2 wideSideStep = sideDir * uTexel * 3.1;

    vec4 c = regionalAt(uv);
    vec4 alongA = regionalAt(uv + alongStep);
    vec4 alongB = regionalAt(uv - alongStep);
    vec4 wideAlongA = regionalAt(uv + wideAlongStep);
    vec4 wideAlongB = regionalAt(uv - wideAlongStep);
    vec4 sideA = regionalAt(uv + sideStep);
    vec4 sideB = regionalAt(uv - sideStep);
    vec4 wideSideA = regionalAt(uv + wideSideStep);
    vec4 wideSideB = regionalAt(uv - wideSideStep);

    float supportAlong = (c.r * 1.35 + alongA.r + alongB.r + wideAlongA.r * 0.58 + wideAlongB.r * 0.58) / 4.51;
    float supportAcross = (sideA.r + sideB.r + wideSideA.r * 0.68 + wideSideB.r * 0.68) / 3.36;
    float ridgeAlong = (c.b * 1.45 + alongA.b + alongB.b + wideAlongA.b * 0.64 + wideAlongB.b * 0.64) / 4.73;
    float ridgeAcross = (sideA.b + sideB.b + wideSideA.b * 0.74 + wideSideB.b * 0.74) / 3.48;
    float highAcross = (sideA.g + sideB.g + wideSideA.g * 0.52 + wideSideB.g * 0.52) / 3.04;
    float sheetAcross = (sideA.a + sideB.a + wideSideA.a * 0.58 + wideSideB.a * 0.58) / 3.16;
    float physicalCenter = physicalScoreAt(uv, mainDir);
    float physicalAlong = (
      physicalCenter * 1.35 +
      physicalScoreAt(uv + alongStep, mainDir) +
      physicalScoreAt(uv - alongStep, mainDir) +
      physicalScoreAt(uv + wideAlongStep, mainDir) * 0.58 +
      physicalScoreAt(uv - wideAlongStep, mainDir) * 0.58
    ) / 4.51;
    float physicalAcross = (
      physicalScoreAt(uv + sideStep, mainDir) +
      physicalScoreAt(uv - sideStep, mainDir) +
      physicalScoreAt(uv + wideSideStep, mainDir) * 0.68 +
      physicalScoreAt(uv - wideSideStep, mainDir) * 0.68
    ) / 3.36;

    float supportPeak = max(0.0, c.r - supportAcross * 0.92);
    float ridgePeak = max(0.0, c.b - ridgeAcross * 0.82);
    float physicalPeak = max(0.0, physicalCenter - physicalAcross * 0.86);
    float supportCurvature = max(0.0, c.r * 2.0 - sideA.r - sideB.r) +
      max(0.0, c.r * 2.0 - wideSideA.r - wideSideB.r) * 0.38;
    float ridgeCurvature = max(0.0, c.b * 2.0 - sideA.b - sideB.b) +
      max(0.0, c.b * 2.0 - wideSideA.b - wideSideB.b) * 0.52;
    float longitudinalPeak = max(0.0, supportAlong + ridgeAlong * 0.58 + physicalAlong * 0.44 - supportAcross * 1.08 - ridgeAcross * 0.62 - physicalAcross * 0.36);

    float alongContinuity = smoothstep(0.12, 0.58, supportAlong * 0.36 + ridgeAlong * 0.86 + physicalAlong * 0.42 + longitudinalPeak * 0.58);
    float lateralWinner = smoothstep(
      0.1,
      0.52,
      ridgePeak * 1.72 +
      supportPeak * 1.18 +
      physicalPeak * 1.46 +
      ridgeCurvature * 0.92 +
      supportCurvature * 0.38 +
      longitudinalPeak * 0.62
    );
    float broadSheet = smoothstep(
      0.28,
      0.74,
      supportAcross * 0.74 +
      ridgeAcross * 0.34 +
      sheetAcross * 0.62 +
      c.a * 0.52 +
      max(0.0, highAcross - c.g) * 0.28
    );
    float starvationGuard = smoothstep(0.08, 0.34, c.r + supportAlong * 0.38 + physicalCenter * 0.36);
    float ridgeSkeleton = clamp(lateralWinner * alongContinuity * starvationGuard * (1.0 - broadSheet * 0.82), 0.0, 1.0);
    float residualSupport = c.r * smoothstep(0.08, 0.48, c.r) * (0.035 + 0.045 * (1.0 - broadSheet));
    float thinnedSupport = clamp(
      residualSupport +
      ridgeSkeleton * (0.42 + c.r * 0.28 + supportPeak * 0.28 + physicalPeak * 0.34) +
      max(0.0, physicalAlong - physicalAcross * 0.98) * 0.1,
      0.0,
      1.0
    );
    float thinnedHigh = clamp(c.g * (0.52 + ridgeSkeleton * 0.24) + ridgeSkeleton * 0.05 - broadSheet * 0.055, 0.0, 1.0);
    float directRidge = max(c.b, physicalCenter * 0.82) * smoothstep(0.08, 0.48, ridgePeak + ridgeCurvature * 0.72 + physicalPeak * 0.68) * (1.0 - broadSheet * 0.6);
    float thinnedRidge = clamp(max(ridgeSkeleton, directRidge), 0.0, 1.0);
    float competitionReject = clamp(max(c.a * 0.62, broadSheet), 0.0, 1.0);

    gl_FragColor = vec4(thinnedSupport, thinnedHigh, thinnedRidge, competitionReject);
  }
`;

const RIVER_CORE_SUPPORT_FRAGMENT_SHADER = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uField;
  uniform sampler2D uVelocity;
  uniform sampler2D uPreviousRiver;
  uniform sampler2D uRegionalSupport;
  uniform sampler2D uRegionalFlow;
  uniform vec2 uTexel;
  uniform float uFlowDirection;
  uniform float uCapillary;

  const float RIVER_CORE_PI = 3.141592653589793;

  vec3 sphericalSampleUv(vec2 uv) {
    float x = uv.x;
    float y = uv.y;
    float poleCross = 0.0;
    if (y < 0.0) {
      y = -y;
      x += 0.5;
      poleCross = 1.0;
    }
    if (y > 1.0) {
      y = 2.0 - y;
      x += 0.5;
      poleCross = 1.0;
    }
    return vec3(fract(x), clamp(y, 0.002, 0.998), poleCross);
  }

  vec2 sampleUv(vec2 uv) {
    return sphericalSampleUv(uv).xy;
  }

  vec4 fieldAt(vec2 uv) {
    return texture2D(uField, sampleUv(uv));
  }

  vec2 velocityAt(vec2 uv) {
    vec3 sphereUv = sphericalSampleUv(uv);
    vec2 velocity = (texture2D(uVelocity, sphereUv.xy).rg - 0.5) * 0.5;
    return mix(velocity, -velocity, sphereUv.z);
  }

  float sphereSinAt(vec2 uv) {
    return max(0.18, sin(sampleUv(uv).y * RIVER_CORE_PI));
  }

  vec2 sphericalGradient(float leftValue, float rightValue, float downValue, float upValue, vec2 uv) {
    float sinTheta = sphereSinAt(uv);
    return vec2((rightValue - leftValue) / (2.0 * sinTheta), (upValue - downValue) * 0.5);
  }

  float sphericalLaplacian(float centerValue, float leftValue, float rightValue, float downValue, float upValue, vec2 uv) {
    float sinC = sphereSinAt(uv);
    float sinD = sphereSinAt(uv - vec2(0.0, uTexel.y));
    float sinU = sphereSinAt(uv + vec2(0.0, uTexel.y));
    float phiCurvature = (leftValue + rightValue - centerValue * 2.0) / (sinC * sinC);
    float thetaCurvature = (sinU * (upValue - centerValue) - sinD * (centerValue - downValue)) / sinC;
    return phiCurvature + thetaCurvature;
  }

  float sphericalVelocityDivergence(vec2 uv, vec2 leftV, vec2 rightV, vec2 downV, vec2 upV) {
    float sinC = sphereSinAt(uv);
    float sinD = sphereSinAt(uv - vec2(0.0, uTexel.y));
    float sinU = sphereSinAt(uv + vec2(0.0, uTexel.y));
    float phiDiv = (rightV.x - leftV.x) / (2.0 * sinC);
    float thetaDiv = (sinU * upV.y - sinD * downV.y) / (2.0 * sinC);
    return (phiDiv + thetaDiv) * 0.5;
  }

  vec4 riverAt(vec2 uv) {
    return texture2D(uPreviousRiver, sampleUv(uv));
  }

  vec4 regionalAt(vec2 uv) {
    return texture2D(uRegionalSupport, sampleUv(uv));
  }

  vec4 flowAt(vec2 uv) {
    return texture2D(uRegionalFlow, sampleUv(uv));
  }

  vec2 safeNormalize(vec2 v, vec2 fallback) {
    float len = length(v);
    return len > 0.0001 ? v / len : fallback;
  }

  vec2 localTangentAt(vec2 sampleUv, vec2 fallbackDir) {
    vec4 flow = flowAt(sampleUv);
    vec2 flowTangent = safeNormalize(flow.rg * 2.0 - 1.0, fallbackDir);
    if (dot(flowTangent, fallbackDir) < 0.0) flowTangent *= -1.0;
    float occupancy = smoothstep(0.04, 0.78, flow.b);
    float speed = smoothstep(0.03, 0.82, flow.a);
    vec2 v = velocityAt(sampleUv);
    vec4 l = fieldAt(sampleUv - vec2(uTexel.x, 0.0));
    vec4 r = fieldAt(sampleUv + vec2(uTexel.x, 0.0));
    vec4 d = fieldAt(sampleUv - vec2(0.0, uTexel.y));
    vec4 u = fieldAt(sampleUv + vec2(0.0, uTexel.y));
    vec2 gradH = vec2(r.r - l.r, u.r - d.r);
    vec2 gradG = vec2(r.g - l.g, u.g - d.g);
    vec2 contourTangent = safeNormalize(vec2(-(gradH.y + gradG.y * 0.28), gradH.x + gradG.x * 0.28), fallbackDir);
    if (dot(contourTangent, fallbackDir) < -0.2) contourTangent *= -1.0;
    return safeNormalize(
      fallbackDir * 0.24 +
      flowTangent * (0.76 * occupancy + 0.18 * speed) +
      v * (3.4 + speed * 1.25) +
      contourTangent * (0.3 + occupancy * 0.2),
      fallbackDir
    );
  }

  float physicalScoreAt(vec2 sampleUv, vec2 mainDir) {
    vec4 c = fieldAt(sampleUv);
    vec4 l = fieldAt(sampleUv - vec2(uTexel.x, 0.0));
    vec4 r = fieldAt(sampleUv + vec2(uTexel.x, 0.0));
    vec4 d = fieldAt(sampleUv - vec2(0.0, uTexel.y));
    vec4 u = fieldAt(sampleUv + vec2(0.0, uTexel.y));
    vec2 gradH = sphericalGradient(l.r, r.r, d.r, u.r, sampleUv);
    vec2 gradG = sphericalGradient(l.g, r.g, d.g, u.g, sampleUv);
    vec2 gradDye = sphericalGradient(l.a, r.a, d.a, u.a, sampleUv);
    float lapH = sphericalLaplacian(c.r, l.r, r.r, d.r, u.r, sampleUv);
    vec2 lV = velocityAt(sampleUv - vec2(uTexel.x, 0.0));
    vec2 rV = velocityAt(sampleUv + vec2(uTexel.x, 0.0));
    vec2 dV = velocityAt(sampleUv - vec2(0.0, uTexel.y));
    vec2 uV = velocityAt(sampleUv + vec2(0.0, uTexel.y));
    float shear = length(rV - lV) + length(uV - dV);
    float divergence = sphericalVelocityDivergence(sampleUv, lV, rV, dV, uV);
    float convergence = max(0.0, -divergence);
    vec4 regional = regionalAt(sampleUv);
    vec2 sideDir = vec2(-mainDir.y, mainDir.x);
    float polarMetricReject = 1.0 - smoothstep(0.2, 0.46, sphereSinAt(sampleUv));
    float interiorGate = 1.0 - polarMetricReject * 0.72;
    float upstream = dot(sampleUv - vec2(0.5), -mainDir);
    float inlet = clamp(0.18 + smoothstep(-0.58, 0.16, upstream) * (1.0 - smoothstep(-0.08, 0.72, upstream)) * 0.82, 0.0, 1.0);
    float heightValley = smoothstep(0.72, 0.3, c.r);
    float thickIsland = smoothstep(0.62, 0.98, c.r + length(gradH) * 1.45 + c.b * 0.12);
    float surfactantRidge = smoothstep(0.005, 0.07, length(gradG) + abs(dot(gradG, sideDir)) * 0.52);
    float phaseBoundary = smoothstep(0.012, 0.09, length(gradDye) * 1.8);
    float curvature = smoothstep(0.006, 0.098, abs(lapH) * (4.4 + uCapillary * 0.72) + length(gradDye) * 0.76 + shear * 0.34);
    float huangConvergence = smoothstep(0.002, 0.052, convergence * (0.85 + c.r * 0.45) + shear * 0.11);
    float crossMarangoni = abs(dot(gradG, sideDir)) + abs(dot(gradH, sideDir)) * 0.58 + abs(dot(gradDye, sideDir)) * 0.36;
    float alongMarangoni = abs(dot(gradG, mainDir)) * 0.72 + abs(dot(gradH, mainDir)) * 0.42 + abs(dot(gradDye, mainDir)) * 0.24;
    float narrowPhysicalGate = smoothstep(0.004, 0.072, crossMarangoni - alongMarangoni * 0.58);
    float marangoniBranch = clamp(surfactantRidge * 0.42 + huangConvergence * 0.36 + curvature * 0.18, 0.0, 1.0) * interiorGate * (0.24 + narrowPhysicalGate * 0.76);
    return clamp(
      (
        heightValley * 0.1 +
        surfactantRidge * 0.2 +
        phaseBoundary * 0.06 +
        curvature * 0.18 +
        huangConvergence * 0.26 +
        marangoniBranch * 0.38 +
        regional.r * 0.12 +
        regional.b * 0.16 -
        regional.a * 0.2 -
        thickIsland * 0.24 -
        polarMetricReject * 0.18
      ) * inlet,
      0.0,
      1.0
    );
  }

  void main() {
    vec2 uv = vUv;
    vec2 baseDir = normalize(vec2(cos(uFlowDirection), sin(uFlowDirection)));
    vec2 mainDir = localTangentAt(uv, baseDir);
    vec2 sideDir = vec2(-mainDir.y, mainDir.x);
    vec2 alongStep = mainDir * uTexel * 4.2;
    vec2 sideStep = sideDir * uTexel * 4.2;
    vec2 wideAlongStep = mainDir * uTexel * 10.0;
    vec2 wideSideStep = sideDir * uTexel * 10.0;

    float center = physicalScoreAt(uv, mainDir);
    float alongP = physicalScoreAt(uv + alongStep, mainDir);
    float alongM = physicalScoreAt(uv - alongStep, mainDir);
    float alongP2 = physicalScoreAt(uv + wideAlongStep, mainDir);
    float alongM2 = physicalScoreAt(uv - wideAlongStep, mainDir);
    float sideP = physicalScoreAt(uv + sideStep, mainDir);
    float sideM = physicalScoreAt(uv - sideStep, mainDir);
    float sideP2 = physicalScoreAt(uv + wideSideStep, mainDir);
    float sideM2 = physicalScoreAt(uv - wideSideStep, mainDir);
    float diag = (
      physicalScoreAt(uv + alongStep + sideStep, mainDir) +
      physicalScoreAt(uv + alongStep - sideStep, mainDir) +
      physicalScoreAt(uv - alongStep + sideStep, mainDir) +
      physicalScoreAt(uv - alongStep - sideStep, mainDir)
    ) * 0.25;

    vec4 prev = riverAt(uv);
    float prevAlong = (riverAt(uv + alongStep).r + riverAt(uv - alongStep).r + riverAt(uv + wideAlongStep).r * 0.5 + riverAt(uv - wideAlongStep).r * 0.5) / 3.0;
    float prevSide = (riverAt(uv + sideStep).r + riverAt(uv - sideStep).r + riverAt(uv + wideSideStep).r * 0.44 + riverAt(uv - wideSideStep).r * 0.44) / 2.88;
    float along = (alongP + alongM + alongP2 * 0.56 + alongM2 * 0.56) / 3.12;
    float side = (sideP + sideM + sideP2 * 0.5 + sideM2 * 0.5) / 3.0;
    float sideBalance = min(sideP, sideM) + min(sideP2, sideM2) * 0.42;
    float sideContrast = abs(sideP - sideM) + abs(sideP2 - sideM2) * 0.38;
    float wideSide = max(sideP2, sideM2);
    float transverseContrast = max(0.0, center - side * 0.92) + abs(sideP - sideM) * 0.42 + abs(sideP2 - sideM2) * 0.18;
    float transverseCrest = max(0.0, center * 1.0 + along * 0.22 + diag * 0.08 + prev.r * 0.18 - side * 1.22 - wideSide * 0.32 - sideBalance * 0.24);
    float alongContinuity = smoothstep(0.08, 0.48, along * 0.72 + prevAlong * 0.42 + center * 0.22);
    float localMass = clamp((prev.r * 1.25 + prevAlong * 0.85 + prevSide * 0.62) / 2.72, 0.0, 1.0);
    float broadSheet = smoothstep(0.32, 0.74, sideBalance + side * 0.22 + localMass * 0.24) *
      (1.0 - smoothstep(0.025, 0.19, sideContrast + abs(center - side) * 0.34 + prev.b * 0.3));
    float flatSheetReject = smoothstep(0.18, 0.56, sideBalance + prevSide * 0.24 + localMass * 0.18) *
      (1.0 - smoothstep(0.04, 0.22, transverseContrast + prev.b * 0.24));
    float narrowGate = smoothstep(0.035, 0.18, transverseContrast) *
      (1.0 - smoothstep(0.62, 0.94, side + sideBalance * 0.42));
    float rawDrainageCandidate = smoothstep(0.055, 0.36, center * 0.78 + along * 0.34 + prevAlong * 0.22 + physicalScoreAt(uv, mainDir) * 0.18) *
      alongContinuity *
      (0.38 + narrowGate * 0.62) *
      (1.0 - broadSheet * 0.48) *
      (1.0 - flatSheetReject * 0.34);
    float coreCandidate = smoothstep(0.055, 0.28, transverseCrest) *
      alongContinuity *
      narrowGate *
      (1.0 - broadSheet * 0.9) *
      (1.0 - flatSheetReject * 0.78) *
      (1.0 - smoothstep(0.42, 0.72, localMass) * 0.42);
    float inheritedCore = prev.r *
      smoothstep(0.08, 0.52, center + along * 0.72 + prevAlong * 0.34) *
      narrowGate *
      (1.0 - broadSheet * 0.78) *
      (1.0 - flatSheetReject * 0.64);
    float coreSupport = clamp(max(max(coreCandidate, rawDrainageCandidate * 0.62), inheritedCore * 0.46), 0.0, 1.0);
    float edgeSupport = smoothstep(0.018, 0.18, sideContrast + abs(center - side) * 0.52 + prev.b * 0.32 + narrowGate * 0.08) *
      smoothstep(0.04, 0.58, coreSupport + prev.r * 0.42 + prevAlong * 0.24) *
      (1.0 - broadSheet * 0.36);
    float sheetSupport = clamp(max(max(broadSheet, flatSheetReject), smoothstep(0.36, 0.72, localMass) * (1.0 - edgeSupport * 0.48)), 0.0, 1.0);
    float localAreaBias = clamp(0.18 - localMass + coreSupport * 0.1 - sheetSupport * 0.16, -0.35, 0.35);

    gl_FragColor = vec4(coreSupport, edgeSupport, sheetSupport, localAreaBias * 0.5 + 0.5);
  }
`;

const RIVER_CORE_MASS_FRAGMENT_SHADER = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uRiverCoreSupport;
  uniform sampler2D uPreviousCoreBalance;
  uniform sampler2D uRegionalFlow;
  uniform vec2 uFieldTexel;
  uniform vec2 uTileTexel;
  uniform float uFlowDirection;

  vec2 sampleUv(vec2 uv) {
    float x = uv.x;
    float y = uv.y;
    if (y < 0.0) {
      y = -y;
      x += 0.5;
    }
    if (y > 1.0) {
      y = 2.0 - y;
      x += 0.5;
    }
    return vec2(fract(x), clamp(y, 0.002, 0.998));
  }

  vec4 supportAt(vec2 uv) {
    return texture2D(uRiverCoreSupport, sampleUv(uv));
  }

  vec4 coreHistoryAt(vec2 uv) {
    return texture2D(uPreviousCoreBalance, sampleUv(uv));
  }

  vec4 flowAt(vec2 uv) {
    return texture2D(uRegionalFlow, sampleUv(uv));
  }

  vec2 safeNormalize(vec2 v, vec2 fallback) {
    float len = length(v);
    return len > 0.0001 ? v / len : fallback;
  }

  vec2 localTangentAt(vec2 sampleUv, vec2 fallbackDir) {
    vec4 flow = flowAt(sampleUv);
    vec2 tangent = safeNormalize(flow.rg * 2.0 - 1.0, fallbackDir);
    if (dot(tangent, fallbackDir) < 0.0) tangent *= -1.0;
    float occupancy = smoothstep(0.04, 0.78, flow.b);
    float speed = smoothstep(0.03, 0.82, flow.a);
    return safeNormalize(fallbackDir * 0.32 + tangent * (0.78 * occupancy + 0.24 * speed), fallbackDir);
  }

  void main() {
    vec2 uv = vUv;
    vec2 baseDir = normalize(vec2(cos(uFlowDirection), sin(uFlowDirection)));
    vec2 mainDir = localTangentAt(uv, baseDir);
    vec2 sideDir = vec2(-mainDir.y, mainDir.x);
    vec2 alongA = mainDir * uFieldTexel * 5.0;
    vec2 alongB = mainDir * uFieldTexel * 13.0;
    vec2 alongC = mainDir * uFieldTexel * 26.0;
    vec2 sideA = sideDir * uFieldTexel * 5.0;
    vec2 sideB = sideDir * uFieldTexel * 13.0;
    vec2 sideC = sideDir * uFieldTexel * 26.0;
    vec2 diagA = (mainDir + sideDir) * uFieldTexel * 8.0;
    vec2 diagB = (mainDir - sideDir) * uFieldTexel * 8.0;

    vec4 c = supportAt(uv);
    vec4 alongP = supportAt(uv + alongA);
    vec4 alongM = supportAt(uv - alongA);
    vec4 alongP2 = supportAt(uv + alongB);
    vec4 alongM2 = supportAt(uv - alongB);
    vec4 alongP3 = supportAt(uv + alongC);
    vec4 alongM3 = supportAt(uv - alongC);
    vec4 sideP = supportAt(uv + sideA);
    vec4 sideM = supportAt(uv - sideA);
    vec4 sideP2 = supportAt(uv + sideB);
    vec4 sideM2 = supportAt(uv - sideB);
    vec4 sideP3 = supportAt(uv + sideC);
    vec4 sideM3 = supportAt(uv - sideC);
    vec4 diagPP = supportAt(uv + diagA);
    vec4 diagPM = supportAt(uv + diagB);
    vec4 diagMP = supportAt(uv - diagB);
    vec4 diagMM = supportAt(uv - diagA);

    float alongMean = (
      alongP.r + alongM.r +
      (alongP2.r + alongM2.r) * 0.7 +
      (alongP3.r + alongM3.r) * 0.34 +
      (diagPP.r + diagPM.r + diagMP.r + diagMM.r) * 0.2
    ) / 4.48;
    float sideNear = (sideP.r + sideM.r) * 0.5;
    float sideMid = (sideP2.r + sideM2.r) * 0.5;
    float sideWide = (sideP3.r + sideM3.r) * 0.5;
    float candidateMean = clamp(
      (
        c.r * 1.8 +
        alongP.r + alongM.r +
        sideP.r + sideM.r +
        (alongP2.r + alongM2.r + sideP2.r + sideM2.r) * 0.62 +
        (alongP3.r + alongM3.r + sideP3.r + sideM3.r) * 0.28 +
        (diagPP.r + diagPM.r + diagMP.r + diagMM.r) * 0.22
      ) / 8.68,
      0.0,
      1.0
    );
    float edgeMean = clamp(
      (
        c.g * 1.4 +
        alongP.g + alongM.g +
        sideP.g + sideM.g +
        (alongP2.g + alongM2.g + sideP2.g + sideM2.g) * 0.52 +
        (diagPP.g + diagPM.g + diagMP.g + diagMM.g) * 0.18
      ) / 6.2,
      0.0,
      1.0
    );
    float sheetMean = clamp(
      (
        c.b * 1.25 +
        sideP.b + sideM.b +
        (sideP2.b + sideM2.b) * 0.82 +
        (sideP3.b + sideM3.b) * 0.5 +
        (alongP.b + alongM.b) * 0.42 +
        (diagPP.b + diagPM.b + diagMP.b + diagMM.b) * 0.2
      ) / 6.29,
      0.0,
      1.0
    );
    float prevMean = clamp(
      (
        coreHistoryAt(uv).r * 1.15 +
        coreHistoryAt(uv + alongA).r + coreHistoryAt(uv - alongA).r +
        (coreHistoryAt(uv + alongB).r + coreHistoryAt(uv - alongB).r) * 0.62 +
        (coreHistoryAt(uv + sideA).r + coreHistoryAt(uv - sideA).r) * 0.38
      ) / 4.15,
      0.0,
      1.0
    );

    float lateralCrest = max(0.0, c.r + alongMean * 0.34 + prevMean * 0.2 - sideNear * 0.92 - sideMid * 0.48 - sideWide * 0.24 - sheetMean * 0.2);
    float sideContrast = abs(sideP.r - sideM.r) + abs(sideP2.r - sideM2.r) * 0.42 + abs(sideP.g - sideM.g) * 0.25;
    float alongContinuity = smoothstep(0.026, 0.34, c.r + alongMean * 0.72 + prevMean * 0.22);
    float transversePeak = smoothstep(0.014, 0.2, lateralCrest + sideContrast * 0.06);
    float wideSheet = smoothstep(
      0.08,
      0.46,
      sideNear * 0.42 + sideMid * 0.32 + sideWide * 0.18 + sheetMean * 0.46 - c.r * 0.5 - sideContrast * 0.1
    );
    float ridgeRank = smoothstep(0.02, 0.24, lateralCrest + sideContrast * 0.08 + max(0.0, c.r - sheetMean) * 0.08) * (1.0 - wideSheet * 0.58);
    float skeletonCandidate = clamp(
      (c.r * 0.66 + alongMean * 0.34 + prevMean * 0.22 + ridgeRank * 0.18) *
      alongContinuity *
      (0.24 + transversePeak * 0.76) *
      (1.0 - wideSheet * 0.74) *
      (1.0 - sheetMean * 0.32),
      0.0,
      1.0
    );
    float capacity = clamp(0.105 + skeletonCandidate * 0.095 + ridgeRank * 0.07 + prevMean * 0.025 - wideSheet * 0.045 - sheetMean * 0.04, 0.082, 0.245);
    float sheetReject = clamp(sheetMean * 0.54 + wideSheet * 0.52 + smoothstep(capacity + 0.05, capacity + 0.24, candidateMean) * 0.26 + (1.0 - ridgeRank) * smoothstep(0.2, 0.58, candidateMean) * 0.16, 0.0, 1.0);
    float projectedCandidate = clamp(skeletonCandidate + ridgeRank * 0.08 + prevMean * 0.1 * (1.0 - wideSheet), 0.0, 1.0);

    gl_FragColor = vec4(projectedCandidate, capacity, ridgeRank, sheetReject);
  }
`;

const RIVER_PATH_EVIDENCE_FRAGMENT_SHADER = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uField;
  uniform sampler2D uVelocity;
  uniform sampler2D uRiverCoreMass;
  uniform sampler2D uRegionalFlow;
  uniform vec2 uTileTexel;
  uniform vec2 uFieldTexel;
  uniform float uFlowDirection;
  uniform float uPathDiagnosticMode;

  const float RIVER_PATH_EVIDENCE_PI = 3.141592653589793;

  vec3 sphericalSampleUv(vec2 uv) {
    float x = uv.x;
    float y = uv.y;
    float poleCross = 0.0;
    if (y < 0.0) {
      y = -y;
      x += 0.5;
      poleCross = 1.0;
    }
    if (y > 1.0) {
      y = 2.0 - y;
      x += 0.5;
      poleCross = 1.0;
    }
    return vec3(fract(x), clamp(y, 0.002, 0.998), poleCross);
  }

  vec2 sampleUv(vec2 uv) {
    return sphericalSampleUv(uv).xy;
  }

  vec4 fieldAt(vec2 uv) {
    return texture2D(uField, sampleUv(uv));
  }

  vec2 velocityAt(vec2 uv) {
    vec3 sphereUv = sphericalSampleUv(uv);
    vec2 velocity = (texture2D(uVelocity, sphereUv.xy).rg - 0.5) * 0.5;
    return mix(velocity, -velocity, sphereUv.z);
  }

  vec4 massAt(vec2 uv) {
    return texture2D(uRiverCoreMass, sampleUv(uv));
  }

  vec4 flowAt(vec2 uv) {
    return texture2D(uRegionalFlow, sampleUv(uv));
  }

  vec2 safeNormalize(vec2 v, vec2 fallback) {
    float len = length(v);
    return len > 0.0001 ? v / len : fallback;
  }

  float sphereSinAt(vec2 uv) {
    return max(0.18, sin(sampleUv(uv).y * RIVER_PATH_EVIDENCE_PI));
  }

  float sphericalVelocityDivergence(vec2 uv, vec2 leftV, vec2 rightV, vec2 downV, vec2 upV) {
    float sinC = sphereSinAt(uv);
    float sinD = sphereSinAt(uv - vec2(0.0, uFieldTexel.y));
    float sinU = sphereSinAt(uv + vec2(0.0, uFieldTexel.y));
    float phiDiv = (rightV.x - leftV.x) / (2.0 * sinC);
    float thetaDiv = (sinU * upV.y - sinD * downV.y) / (2.0 * sinC);
    return (phiDiv + thetaDiv) * 0.5;
  }

  vec2 localTangentAt(vec2 sampleUv, vec2 fallbackDir) {
    vec4 flow = flowAt(sampleUv);
    vec2 tangent = safeNormalize(flow.rg * 2.0 - 1.0, fallbackDir);
    if (dot(tangent, fallbackDir) < 0.0) tangent *= -1.0;
    float occupancy = smoothstep(0.04, 0.78, flow.b);
    float speed = smoothstep(0.03, 0.82, flow.a);
    return safeNormalize(fallbackDir * 0.24 + tangent * (0.84 * occupancy + 0.22 * speed), fallbackDir);
  }

  void main() {
    vec2 uv = vUv;
    vec2 baseDir = normalize(vec2(cos(uFlowDirection), sin(uFlowDirection)));
    vec2 tangent = localTangentAt(uv, baseDir);
    vec2 side = vec2(-tangent.y, tangent.x);
    vec2 along2 = tangent * uTileTexel * 2.45;
    vec2 side1 = side * uTileTexel * 1.25;
    vec2 side2 = side * uTileTexel * 2.75;
    vec2 branchA = safeNormalize(tangent + side * 0.42, tangent) * uTileTexel * 2.4;
    vec2 branchB = safeNormalize(tangent - side * 0.42, tangent) * uTileTexel * 2.4;

    vec4 f = fieldAt(uv);
    vec4 fXR = fieldAt(uv + vec2(uFieldTexel.x * 5.0, 0.0));
    vec4 fXL = fieldAt(uv - vec2(uFieldTexel.x * 5.0, 0.0));
    vec4 fYU = fieldAt(uv + vec2(0.0, uFieldTexel.y * 5.0));
    vec4 fYD = fieldAt(uv - vec2(0.0, uFieldTexel.y * 5.0));
    vec4 fAP = fieldAt(uv + tangent * uFieldTexel * 7.0);
    vec4 fAM = fieldAt(uv - tangent * uFieldTexel * 7.0);
    vec4 fSP = fieldAt(uv + side * uFieldTexel * 6.0);
    vec4 fSM = fieldAt(uv - side * uFieldTexel * 6.0);
    vec2 vL = velocityAt(uv - vec2(uFieldTexel.x * 4.0, 0.0));
    vec2 vR = velocityAt(uv + vec2(uFieldTexel.x * 4.0, 0.0));
    vec2 vD = velocityAt(uv - vec2(0.0, uFieldTexel.y * 4.0));
    vec2 vU = velocityAt(uv + vec2(0.0, uFieldTexel.y * 4.0));
    vec2 vC = velocityAt(uv);

    vec4 c = massAt(uv);
    vec4 sP = massAt(uv + side1);
    vec4 sM = massAt(uv - side1);
    vec4 sP2 = massAt(uv + side2);
    vec4 sM2 = massAt(uv - side2);
    vec4 flow = flowAt(uv);

    float neighborHigh = max(max(fXR.r, fXL.r), max(fYU.r, fYD.r));
    float valleyEvidence = smoothstep(0.015, 0.17, neighborHigh - f.r) * (1.0 - smoothstep(0.72, 0.96, f.r));
    float alongValley = smoothstep(0.012, 0.13, max(fAP.r, fAM.r) - f.r);
    float transverseValley = smoothstep(0.012, 0.14, max(fSP.r, fSM.r) - f.r);
    float surfactantGradient = clamp(length(vec2(fXR.g - fXL.g, fYU.g - fYD.g)) * 7.2, 0.0, 1.0);
    float phaseGradient = clamp(length(vec2(fXR.a - fXL.a, fYU.a - fYD.a)) * 6.0, 0.0, 1.0);
    vec2 gradH = vec2(fXR.r - fXL.r, fYU.r - fYD.r);
    vec2 gradG = vec2(fXR.g - fXL.g, fYU.g - fYD.g);
    vec2 gradDye = vec2(fXR.a - fXL.a, fYU.a - fYD.a);
    float divergence = sphericalVelocityDivergence(uv, vL, vR, vD, vU);
    float convergence = max(0.0, -divergence);
    float shear = length(vR - vL) + length(vU - vD);
    float polarMetricReject = 1.0 - smoothstep(0.2, 0.48, sphereSinAt(uv));
    float interiorGate = 1.0 - polarMetricReject * 0.78;
    float capillaryEdge = smoothstep(
      0.003,
      0.058,
      abs(dot(gradH, side)) * 0.82 +
      abs(dot(gradG, side)) * 0.55 +
      abs(dot(gradDye, side)) * 0.36 +
      length(gradH) * 0.28
    );
    float regionalRidge = smoothstep(0.05, 0.72, max(c.b, flow.b * 0.64 + flow.a * 0.2));
    float foamPenalty = smoothstep(0.38, 0.88, f.b);
    float huangConvergence = smoothstep(0.002, 0.052, convergence * (0.86 + f.r * 0.42) + shear * 0.1 + length(vC) * 0.08);
    float marangoniBranch = smoothstep(
      0.006,
      0.085,
      length(gradG) * 0.82 +
      abs(dot(gradG, side)) * 0.64 +
      abs(dot(gradH, side)) * 0.32
    );
    vec2 tangentP = localTangentAt(uv + along2, tangent);
    vec2 tangentM = localTangentAt(uv - along2, tangent);
    vec2 tangentBA = localTangentAt(uv + branchA, tangent);
    vec2 tangentBB = localTangentAt(uv + branchB, tangent);
    float turnCost = 1.0 - min(abs(dot(tangent, tangentP)), abs(dot(tangent, tangentM)));
    float branchTurnCost = 1.0 - max(abs(dot(tangent, tangentBA)), abs(dot(tangent, tangentBB)));
    float curvatureGate = 1.0 - smoothstep(0.28, 0.84, turnCost + branchTurnCost * 0.45) * 0.55;

    float sideNear = (sP.r + sM.r) * 0.5;
    float sideWide = (sP2.r + sM2.r) * 0.5;
    float sideCrowd = smoothstep(0.08, 0.44, sideNear * 0.5 + sideWide * 0.34 - c.r * 0.42);
    float physicalNarrow = smoothstep(
      0.018,
      0.24,
      alongValley * 0.42 +
      capillaryEdge * 0.34 +
      marangoniBranch * 0.28 +
      huangConvergence * 0.2 -
      transverseValley * 0.62 -
      sideCrowd * 0.32 -
      polarMetricReject * 0.12
    );
    float physicalBranch = clamp(
      huangConvergence * 0.32 +
      marangoniBranch * 0.28 +
      capillaryEdge * 0.22 +
      regionalRidge * 0.1,
      0.0,
      1.0
    ) * interiorGate * (0.18 + physicalNarrow * 0.82);
    float sheetReject = clamp(c.a * 0.34 + sideCrowd * 0.28 + max(sP.a, sM.a) * 0.12 + foamPenalty * 0.1 + polarMetricReject * 0.16, 0.0, 1.0);
    float seedSupport = smoothstep(0.026, 0.42, c.r + c.b * 0.18 + capillaryEdge * 0.12 + physicalBranch * 0.16) * (1.0 - c.a * 0.38) * (1.0 - sideCrowd * 0.16);

    float valleyFloor = smoothstep(0.82, 0.26, f.r) * smoothstep(0.03, 0.72, neighborHigh - f.r + 0.035);
    float gradientRidge = clamp(surfactantGradient * 0.52 + phaseGradient * 0.42, 0.0, 1.0);
    float lowCost = clamp(
      valleyEvidence * 0.34 +
      alongValley * 0.28 +
      transverseValley * 0.18 +
      valleyFloor * 0.18 +
      gradientRidge * 0.28 +
      physicalBranch * 0.3 +
      regionalRidge * 0.18 +
      c.b * 0.18 -
      foamPenalty * 0.1 -
      polarMetricReject * 0.12,
      0.0,
      1.0
    );
    float pathOpen = clamp(
      lowCost *
      (0.66 + physicalBranch * 0.16 + regionalRidge * 0.12 + curvatureGate * 0.16) *
      (1.0 - sheetReject * 0.22) +
      seedSupport * 0.05,
      0.0,
      1.0
    );
    gl_FragColor = vec4(pathOpen, seedSupport, curvatureGate * (0.54 + lowCost * 0.46), sheetReject);
  }
`;

const RIVER_PATH_COST_FRAGMENT_SHADER = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uField;
  uniform sampler2D uVelocity;
  uniform sampler2D uRiverCoreMass;
  uniform sampler2D uRegionalFlow;
  uniform vec2 uTileTexel;
  uniform vec2 uFieldTexel;
  uniform float uFlowDirection;
  uniform float uPathDiagnosticMode;

  const float RIVER_PATH_COST_PI = 3.141592653589793;

  vec3 sphericalSampleUv(vec2 uv) {
    float x = uv.x;
    float y = uv.y;
    float poleCross = 0.0;
    if (y < 0.0) {
      y = -y;
      x += 0.5;
      poleCross = 1.0;
    }
    if (y > 1.0) {
      y = 2.0 - y;
      x += 0.5;
      poleCross = 1.0;
    }
    return vec3(fract(x), clamp(y, 0.002, 0.998), poleCross);
  }

  vec2 sampleUv(vec2 uv) {
    return sphericalSampleUv(uv).xy;
  }

  vec4 fieldAt(vec2 uv) {
    return texture2D(uField, sampleUv(uv));
  }

  vec2 velocityAt(vec2 uv) {
    vec3 sphereUv = sphericalSampleUv(uv);
    vec2 velocity = (texture2D(uVelocity, sphereUv.xy).rg - 0.5) * 0.5;
    return mix(velocity, -velocity, sphereUv.z);
  }

  vec4 massAt(vec2 uv) {
    return texture2D(uRiverCoreMass, sampleUv(uv));
  }

  vec4 flowAt(vec2 uv) {
    return texture2D(uRegionalFlow, sampleUv(uv));
  }

  vec2 safeNormalize(vec2 v, vec2 fallback) {
    float len = length(v);
    return len > 0.0001 ? v / len : fallback;
  }

  float sphereSinAt(vec2 uv) {
    return max(0.18, sin(sampleUv(uv).y * RIVER_PATH_COST_PI));
  }

  float sphericalVelocityDivergence(vec2 uv, vec2 leftV, vec2 rightV, vec2 downV, vec2 upV) {
    float sinC = sphereSinAt(uv);
    float sinD = sphereSinAt(uv - vec2(0.0, uFieldTexel.y));
    float sinU = sphereSinAt(uv + vec2(0.0, uFieldTexel.y));
    float phiDiv = (rightV.x - leftV.x) / (2.0 * sinC);
    float thetaDiv = (sinU * upV.y - sinD * downV.y) / (2.0 * sinC);
    return (phiDiv + thetaDiv) * 0.5;
  }

  vec2 localTangentAt(vec2 sampleUv, vec2 fallbackDir) {
    vec4 flow = flowAt(sampleUv);
    vec2 tangent = safeNormalize(flow.rg * 2.0 - 1.0, fallbackDir);
    if (dot(tangent, fallbackDir) < 0.0) tangent *= -1.0;
    float occupancy = smoothstep(0.035, 0.78, flow.b);
    float speed = smoothstep(0.025, 0.82, flow.a);

    vec4 left = fieldAt(sampleUv - vec2(uFieldTexel.x * 6.0, 0.0));
    vec4 right = fieldAt(sampleUv + vec2(uFieldTexel.x * 6.0, 0.0));
    vec4 down = fieldAt(sampleUv - vec2(0.0, uFieldTexel.y * 6.0));
    vec4 up = fieldAt(sampleUv + vec2(0.0, uFieldTexel.y * 6.0));
    vec2 gradH = vec2(right.r - left.r, up.r - down.r);
    vec2 gradG = vec2(right.g - left.g, up.g - down.g);
    vec2 contourTangent = safeNormalize(vec2(-(gradH.y + gradG.y * 0.34), gradH.x + gradG.x * 0.34), fallbackDir);
    if (dot(contourTangent, fallbackDir) < -0.15) contourTangent *= -1.0;

    return safeNormalize(
      fallbackDir * 0.2 +
      tangent * (0.76 * occupancy + 0.22 * speed) +
      contourTangent * (0.28 + occupancy * 0.18),
      fallbackDir
    );
  }

  float thinAmount(float h) {
    return 1.0 - smoothstep(0.22, 0.78, h);
  }

  float fieldContrast(vec4 a, vec4 b) {
    return abs(a.r - b.r) * 1.0 +
      abs(a.g - b.g) * 0.72 +
      abs(a.a - b.a) * 0.58 +
      abs(a.b - b.b) * 0.42;
  }

  void main() {
    vec2 uv = vUv;
    vec2 baseDir = normalize(vec2(cos(uFlowDirection), sin(uFlowDirection)));
    vec2 tangent = localTangentAt(uv, baseDir);
    vec2 side = vec2(-tangent.y, tangent.x);
    vec2 branchA = safeNormalize(tangent + side * 0.52, tangent);
    vec2 branchB = safeNormalize(tangent - side * 0.52, tangent);

    vec4 f = fieldAt(uv);
    vec4 t4p = fieldAt(uv + tangent * uFieldTexel * 4.0);
    vec4 t4m = fieldAt(uv - tangent * uFieldTexel * 4.0);
    vec4 s4p = fieldAt(uv + side * uFieldTexel * 4.0);
    vec4 s4m = fieldAt(uv - side * uFieldTexel * 4.0);
    vec4 t10p = fieldAt(uv + tangent * uFieldTexel * 10.0);
    vec4 t10m = fieldAt(uv - tangent * uFieldTexel * 10.0);
    vec4 s10p = fieldAt(uv + side * uFieldTexel * 10.0);
    vec4 s10m = fieldAt(uv - side * uFieldTexel * 10.0);
    vec4 t22p = fieldAt(uv + tangent * uFieldTexel * 22.0);
    vec4 t22m = fieldAt(uv - tangent * uFieldTexel * 22.0);
    vec4 s22p = fieldAt(uv + side * uFieldTexel * 22.0);
    vec4 s22m = fieldAt(uv - side * uFieldTexel * 22.0);
    vec4 b14p = fieldAt(uv + branchA * uFieldTexel * 14.0);
    vec4 b14m = fieldAt(uv - branchA * uFieldTexel * 14.0);
    vec4 c14p = fieldAt(uv + branchB * uFieldTexel * 14.0);
    vec4 c14m = fieldAt(uv - branchB * uFieldTexel * 14.0);

    vec4 fineMean = (t4p + t4m + s4p + s4m) * 0.25;
    vec4 midMean = (t10p + t10m + s10p + s10m) * 0.25;
    vec4 lowField = (
      f * 0.62 +
      (t22p + t22m + s22p + s22m) * 0.7 +
      (b14p + b14m + c14p + c14m) * 0.48 +
      (t10p + t10m + s10p + s10m) * 0.34
    ) / 6.5;

    vec4 fxr = fieldAt(uv + vec2(uFieldTexel.x * 5.0, 0.0));
    vec4 fxl = fieldAt(uv - vec2(uFieldTexel.x * 5.0, 0.0));
    vec4 fyu = fieldAt(uv + vec2(0.0, uFieldTexel.y * 5.0));
    vec4 fyd = fieldAt(uv - vec2(0.0, uFieldTexel.y * 5.0));
    vec4 lapL = fieldAt(uv - vec2(uFieldTexel.x * 2.0, 0.0));
    vec4 lapR = fieldAt(uv + vec2(uFieldTexel.x * 2.0, 0.0));
    vec4 lapD = fieldAt(uv - vec2(0.0, uFieldTexel.y * 2.0));
    vec4 lapU = fieldAt(uv + vec2(0.0, uFieldTexel.y * 2.0));
    vec2 vL = velocityAt(uv - vec2(uFieldTexel.x * 4.0, 0.0));
    vec2 vR = velocityAt(uv + vec2(uFieldTexel.x * 4.0, 0.0));
    vec2 vD = velocityAt(uv - vec2(0.0, uFieldTexel.y * 4.0));
    vec2 vU = velocityAt(uv + vec2(0.0, uFieldTexel.y * 4.0));
    vec2 vC = velocityAt(uv);

    vec2 gradH = vec2(fxr.r - fxl.r, fyu.r - fyd.r);
    vec2 gradG = vec2(fxr.g - fxl.g, fyu.g - fyd.g);
    vec2 gradDye = vec2(fxr.a - fxl.a, fyu.a - fyd.a);
    vec2 gradFoam = vec2(fxr.b - fxl.b, fyu.b - fyd.b);
    float lapH = lapL.r + lapR.r + lapD.r + lapU.r - f.r * 4.0;
    float lapWide = t22p.r + t22m.r + s22p.r + s22m.r - f.r * 4.0;

    float fineContrast = fieldContrast(f, fineMean);
    float midContrast = fieldContrast(fineMean, midMean);
    float lowContrast = fieldContrast(f, lowField);
    float heightThinResidual = smoothstep(0.006, 0.105, lowField.r - f.r);
    float heightThickResidual = smoothstep(0.01, 0.14, f.r - lowField.r);
    float surfactantResidual = smoothstep(0.004, 0.075, abs(f.g - lowField.g) + length(gradG) * 0.32);
    float phaseResidual = smoothstep(0.004, 0.08, abs(f.a - lowField.a) + length(gradDye) * 0.28);
    float foamResidual = smoothstep(0.012, 0.16, max(0.0, f.b - lowField.b) + length(gradFoam) * 0.34);
    float capillaryResidual = smoothstep(0.003, 0.075, abs(lapH - lapWide * 0.18) + length(gradH) * 0.12);
    float phaseShear = smoothstep(0.006, 0.08, length(gradDye) + abs(dot(gradDye, side)) * 0.42);
    float capillaryLine = smoothstep(0.004, 0.062, length(gradH) * 0.72 + abs(lapH) * 0.62 + length(gradG) * 0.42);
    float meniscusBoundary = smoothstep(
      0.003,
      0.058,
      abs(dot(gradH, side)) * 0.82 +
      abs(dot(gradG, side)) * 0.55 +
      abs(dot(gradDye, side)) * 0.36 +
      abs(lapH) * 0.38
    );
    float divergence = sphericalVelocityDivergence(uv, vL, vR, vD, vU);
    float convergence = max(0.0, -divergence);
    float shear = length(vR - vL) + length(vU - vD);
    float polarMetricReject = 1.0 - smoothstep(0.2, 0.48, sphereSinAt(uv));
    float interiorGate = 1.0 - polarMetricReject * 0.78;
    float huangConvergence = smoothstep(0.002, 0.052, convergence * (0.86 + f.r * 0.42) + shear * 0.1 + length(vC) * 0.08);
    float marangoniBranch = smoothstep(
      0.006,
      0.086,
      length(gradG) * 0.84 +
      abs(dot(gradG, side)) * 0.66 +
      abs(dot(gradH, side)) * 0.3
    );
    float huangLine = clamp(
      huangConvergence * 0.4 +
      marangoniBranch * 0.36 +
      capillaryLine * 0.22 +
      meniscusBoundary * 0.16,
      0.0,
      1.0
    ) * interiorGate;
    float huangNarrowGate = smoothstep(
      0.012,
      0.16,
      meniscusBoundary * 0.72 +
      capillaryLine * 0.42 +
      abs(dot(gradG, side)) * 0.24 +
      abs(dot(gradH, side)) * 0.16 -
      abs(dot(gradG, tangent)) * 0.2 -
      abs(dot(gradH, tangent)) * 0.12 -
      polarMetricReject * 0.12
    );
    huangLine *= 0.18 + huangNarrowGate * 0.82;

    vec4 flow = flowAt(uv);
    vec4 mass = massAt(uv);
    float regionalRidge = smoothstep(0.04, 0.72, max(mass.b * 0.42, flow.b * 0.46 + flow.a * 0.12));
    float flowContinuity = smoothstep(0.05, 0.7, flow.b + flow.a * 0.3);
    float centerResidual = smoothstep(0.012, 0.16, fineContrast * 0.74 + lowContrast * 0.32);
    float alongResidual = smoothstep(0.014, 0.15, (fieldContrast(t4p, lowField) + fieldContrast(t4m, lowField)) * 0.5);
    float sideResidual = smoothstep(0.014, 0.15, (fieldContrast(s4p, lowField) + fieldContrast(s4m, lowField)) * 0.5);
    float branchResidual = smoothstep(0.014, 0.16, (
      fieldContrast(b14p, lowField) +
      fieldContrast(b14m, lowField) +
      fieldContrast(c14p, lowField) +
      fieldContrast(c14m, lowField)
    ) * 0.25);
    float sideLowMean = (
      thinAmount(s10p.r) +
      thinAmount(s10m.r) +
      (thinAmount(s22p.r) + thinAmount(s22m.r)) * 0.56
    ) / 3.12;
    float broadFoam = smoothstep(0.18, 0.74, lowField.b + midMean.b * 0.35);
    float broadPhase = smoothstep(0.22, 0.76, lowField.a + midMean.a * 0.22);
    float broadDrainage = smoothstep(0.22, 0.92, sideLowMean * 0.62 + broadFoam * 0.26 + broadPhase * 0.16 + flowContinuity * 0.18 + polarMetricReject * 0.18);
    float localInstability = clamp(
      heightThinResidual * 0.34 +
      surfactantResidual * 0.28 +
      phaseResidual * 0.2 +
      capillaryResidual * 0.32 +
      capillaryLine * 0.28 +
      meniscusBoundary * 0.24 +
      phaseShear * 0.18 +
      foamResidual * 0.12 +
      centerResidual * 0.18 +
      huangLine * 0.34,
      0.0,
      1.0
    );
    float lineAnisotropy = smoothstep(
      -0.03,
      0.26,
      centerResidual +
      alongResidual * 0.52 +
      branchResidual * 0.26 +
      meniscusBoundary * 0.2 +
      capillaryLine * 0.14 -
      sideResidual * 0.68 -
      broadDrainage * 0.12 +
      huangLine * 0.22 -
      polarMetricReject * 0.14
    );
    float sheetWidth = smoothstep(
      0.3,
      0.9,
      sideResidual +
      sideLowMean * 0.48 +
      broadFoam * 0.24 -
      centerResidual * 0.4 -
      alongResidual * 0.22 -
      meniscusBoundary * 0.18
    );
    float sheetReject = clamp(
      broadDrainage * (1.0 - localInstability * 0.48) * 0.42 +
      sheetWidth * 0.34 +
      mass.a * 0.12 +
      smoothstep(0.72, 0.98, f.r + lowField.b * 0.14) * 0.08,
      0.0,
      1.0
    );
    float transverseNarrow = smoothstep(
      0.015,
      0.18,
      centerResidual +
      alongResidual * 0.42 +
      meniscusBoundary * 0.22 +
      capillaryLine * 0.12 -
      sideResidual * 0.74 -
      broadDrainage * 0.16
    );
    float connectedFilament = smoothstep(
      0.04,
      0.34,
      alongResidual +
      branchResidual * 0.42 +
      regionalRidge * 0.18 +
      capillaryLine * 0.1
    );

    float filamentPhysics = clamp(
      localInstability * (0.72 + lineAnisotropy * 0.4) +
      heightThinResidual * capillaryResidual * 0.28 +
      capillaryLine * meniscusBoundary * 0.28 +
      surfactantResidual * phaseShear * 0.26 +
      foamResidual * phaseResidual * 0.12 +
      regionalRidge * (centerResidual + meniscusBoundary * 0.42) * 0.14 +
      huangLine * 0.36,
      0.0,
      1.0
    );
    filamentPhysics *= (0.38 + transverseNarrow * 0.62) * (0.52 + connectedFilament * 0.48);
    float channelPotential = clamp(
      filamentPhysics *
      (0.62 + alongResidual * 0.32 + branchResidual * 0.24 + flowContinuity * 0.16 + meniscusBoundary * 0.18) *
      (1.0 - sheetReject * 0.32) +
      heightThickResidual * phaseShear * 0.08 +
      capillaryLine * lineAnisotropy * transverseNarrow * 0.08 +
      huangLine * (0.2 + lineAnisotropy * 0.22),
      0.0,
      1.0
    );
    channelPotential = max(channelPotential, filamentPhysics * lineAnisotropy * transverseNarrow * 0.52 * (1.0 - broadDrainage * 0.32));
    float rawChannelPotential = channelPotential;
    float lateralPeak = smoothstep(
      -0.02,
      0.2,
      centerResidual +
      alongResidual * 0.42 +
      branchResidual * 0.2 +
      meniscusBoundary * 0.22 +
      regionalRidge * 0.12 -
      sideResidual * 0.82 -
      sideLowMean * 0.2 -
      broadDrainage * 0.2
    );
    float forkPeak = smoothstep(
      0.015,
      0.22,
      branchResidual +
      alongResidual * 0.28 +
      capillaryLine * 0.12 -
      sideResidual * 0.56 -
      broadDrainage * 0.18
    );
    float broadBandReject = smoothstep(
      0.1,
      0.46,
      sideResidual +
      sideLowMean * 0.36 +
      broadDrainage * 0.26 +
      broadFoam * 0.14 -
      centerResidual * 0.48 -
      alongResidual * 0.18 -
      branchResidual * 0.12
    );
    float filamentMask = clamp(max(lateralPeak, forkPeak * 0.72) * (0.52 + connectedFilament * 0.48), 0.0, 1.0);
    float physicalLineSupport = clamp(
      max(huangLine, huangConvergence * marangoniBranch) * (0.52 + huangNarrowGate * 0.48) +
      capillaryLine * meniscusBoundary * 0.22 +
      lineAnisotropy * transverseNarrow * 0.2 +
      connectedFilament * 0.12 -
      broadBandReject * 0.26 -
      broadDrainage * 0.14 -
      polarMetricReject * 0.22,
      0.0,
      1.0
    );
    float sheetPhysicsReject = smoothstep(
      0.12,
      0.62,
      broadBandReject +
      sheetWidth * 0.32 +
      broadDrainage * 0.22 -
      physicalLineSupport * 0.72 -
      filamentMask * 0.18
    );
    filamentMask = clamp(filamentMask * (0.62 + physicalLineSupport * 0.38) + physicalLineSupport * 0.16, 0.0, 1.0);
    sheetReject = clamp(max(sheetReject, max(broadBandReject * 0.54, sheetPhysicsReject * 0.78)), 0.0, 1.0);
    channelPotential = clamp(
      rawChannelPotential *
      (0.42 + filamentMask * 0.58) *
      (0.32 + physicalLineSupport * 0.68) *
      (1.0 - broadBandReject * 0.32) *
      (1.0 - sheetReject * 0.1) +
      rawChannelPotential * connectedFilament * lineAnisotropy * 0.16 +
      mass.r * regionalRidge * filamentMask * (1.0 - mass.a * 0.62) * 0.08,
      0.0,
      1.0
    );
    float rawBoost = smoothstep(0.006, 0.22, rawChannelPotential) *
      (0.58 + connectedFilament * 0.22 + lineAnisotropy * 0.16) *
      (0.42 + physicalLineSupport * 0.58) *
      (1.0 - broadBandReject * 0.42) *
      (1.0 - sheetReject * 0.12);
    channelPotential = clamp(max(
      channelPotential,
      rawBoost * (0.42 + filamentMask * 0.58)
    ), 0.0, 1.0);
    float seedSupport = clamp(
      channelPotential * (0.64 + lineAnisotropy * 0.24 + branchResidual * 0.18 + meniscusBoundary * 0.12) +
      mass.r * 0.1 * channelPotential * (1.0 - mass.a * 0.48) +
      foamResidual * phaseShear * 0.08 +
      capillaryLine * lineAnisotropy * 0.08 +
      huangLine * 0.16 +
      physicalLineSupport * 0.1,
      0.0,
      1.0
    ) * (0.55 + filamentMask * 0.45);
    float ridgeSignal = clamp(
      capillaryResidual * 0.34 +
      capillaryLine * 0.24 +
      meniscusBoundary * 0.2 +
      surfactantResidual * 0.26 +
      phaseShear * 0.22 +
      lineAnisotropy * 0.26 +
      branchResidual * 0.16 +
      regionalRidge * channelPotential * 0.14 +
      huangLine * 0.22 +
      physicalLineSupport * 0.12,
      0.0,
      1.0
    ) * (0.5 + filamentMask * 0.5);

    if (uPathDiagnosticMode > 0.5) {
      gl_FragColor = vec4(
        clamp(rawChannelPotential, 0.0, 1.0),
        clamp(broadBandReject, 0.0, 1.0),
        clamp(filamentMask, 0.0, 1.0),
        clamp(sheetReject, 0.0, 1.0)
      );
      return;
    }

    gl_FragColor = vec4(channelPotential, seedSupport, ridgeSignal, sheetReject);
  }
`;

const RIVER_PATH_SKELETON_FRAGMENT_SHADER = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uPathCost;
  uniform sampler2D uRegionalFlow;
  uniform vec2 uTexel;
  uniform float uFlowDirection;

  vec2 sampleUv(vec2 uv) {
    float x = uv.x;
    float y = uv.y;
    if (y < 0.0) {
      y = -y;
      x += 0.5;
    }
    if (y > 1.0) {
      y = 2.0 - y;
      x += 0.5;
    }
    return vec2(fract(x), clamp(y, 0.002, 0.998));
  }

  vec4 costAt(vec2 uv) {
    return texture2D(uPathCost, sampleUv(uv));
  }

  vec4 flowAt(vec2 uv) {
    return texture2D(uRegionalFlow, sampleUv(uv));
  }

  vec2 safeNormalize(vec2 v, vec2 fallback) {
    float len = length(v);
    return len > 0.0001 ? v / len : fallback;
  }

  vec2 localTangentAt(vec2 sampleUv, vec2 fallbackDir) {
    vec4 flow = flowAt(sampleUv);
    vec2 tangent = safeNormalize(flow.rg * 2.0 - 1.0, fallbackDir);
    if (dot(tangent, fallbackDir) < 0.0) tangent *= -1.0;
    float centerCost = costAt(sampleUv).r;
    vec2 costGrad = vec2(
      costAt(sampleUv + vec2(uTexel.x, 0.0)).r - costAt(sampleUv - vec2(uTexel.x, 0.0)).r,
      costAt(sampleUv + vec2(0.0, uTexel.y)).r - costAt(sampleUv - vec2(0.0, uTexel.y)).r
    );
    vec2 valleyTangent = safeNormalize(vec2(-costGrad.y, costGrad.x), tangent);
    if (dot(valleyTangent, tangent) < 0.0) valleyTangent *= -1.0;
    float valleyStrength = smoothstep(0.012, 0.18, length(costGrad)) * smoothstep(0.04, 0.82, centerCost);
    float occupancy = smoothstep(0.035, 0.78, flow.b);
    float speed = smoothstep(0.025, 0.82, flow.a);
    return safeNormalize(
      fallbackDir * 0.16 +
      tangent * (0.64 * occupancy + 0.16 * speed) +
      valleyTangent * (0.72 * valleyStrength),
      fallbackDir
    );
  }

  float openCostAt(vec2 sampleUv) {
    vec4 c = costAt(sampleUv);
    return clamp(c.r * (1.0 - c.a * 0.42), 0.0, 1.0);
  }

  void main() {
    vec2 uv = vUv;
    vec2 baseDir = normalize(vec2(cos(uFlowDirection), sin(uFlowDirection)));
    vec2 tangent = localTangentAt(uv, baseDir);
    vec2 side = vec2(-tangent.y, tangent.x);
    vec2 along1 = tangent * uTexel * 1.15;
    vec2 along2 = tangent * uTexel * 2.35;
    vec2 along4 = tangent * uTexel * 4.4;
    vec2 side1 = side * uTexel * 1.05;
    vec2 side2 = side * uTexel * 2.45;
    vec2 side4 = side * uTexel * 4.4;
    vec2 branchA = safeNormalize(tangent + side * 0.42, tangent) * uTexel * 2.4;
    vec2 branchB = safeNormalize(tangent - side * 0.42, tangent) * uTexel * 2.4;

    vec4 c = costAt(uv);
    float center = clamp(c.r * (1.0 - c.a * 0.38), 0.0, 1.0);
    float alongNear = (openCostAt(uv + along1) + openCostAt(uv - along1)) * 0.5;
    float alongMid = (openCostAt(uv + along2) + openCostAt(uv - along2)) * 0.5;
    float alongFar = (openCostAt(uv + along4) + openCostAt(uv - along4)) * 0.5;
    float branch = (
      openCostAt(uv + branchA) + openCostAt(uv - branchA) +
      openCostAt(uv + branchB) + openCostAt(uv - branchB)
    ) * 0.25;
    float sideNear = max(openCostAt(uv + side1), openCostAt(uv - side1));
    float sideMid = max(openCostAt(uv + side2), openCostAt(uv - side2));
    float sideFar = max(openCostAt(uv + side4), openCostAt(uv - side4));

    float alongContinuity = clamp(alongNear * 0.48 + alongMid * 0.34 + alongFar * 0.18, 0.0, 1.0);
    float sideWide = clamp(sideNear * 0.5 + sideMid * 0.34 + sideFar * 0.18, 0.0, 1.0);
    float transversePeak = center + alongContinuity * 0.08 - max(sideNear * 0.62, sideMid * 0.48);
    float farPeak = center + alongContinuity * 0.22 + branch * 0.08 - sideFar * 0.48;
    float nms = smoothstep(-0.06, 0.12, transversePeak + c.b * 0.08);
    nms *= smoothstep(-0.08, 0.2, farPeak + branch * 0.07);
    float lineContinuity = smoothstep(0.025, 0.36, alongContinuity + branch * 0.38 + c.b * 0.28);
    float sheetReject = smoothstep(0.48, 0.96, sideWide - center * 0.48 - alongContinuity * 0.12) * (1.0 - nms * 0.36);
    float strictLine = clamp(
      smoothstep(0.018, 0.36, center + c.b * 0.18) *
      nms *
      lineContinuity *
      (1.0 - c.a * 0.5) *
      (1.0 - sheetReject * 0.62),
      0.0,
      1.0
    );
    float softLine = clamp(
      center *
      lineContinuity *
      smoothstep(-0.08, 0.24, center + alongContinuity * 0.4 + c.b * 0.24 - sideWide * 0.46) *
      (1.0 - c.a * 0.44) *
      (1.0 - sheetReject * 0.52),
      0.0,
      1.0
    );
    float centerline = clamp(max(strictLine, softLine * 0.62), 0.0, 1.0);
    float seed = clamp(max(max(c.g * 0.36, centerline * (0.5 + c.b * 0.38 + alongContinuity * 0.2)), softLine * 0.28), 0.0, 1.0);
    float quality = clamp(max(max(c.b * centerline, lineContinuity * max(centerline, softLine * 0.35)), nms * centerline), 0.0, 1.0);
    float reject = clamp(max(c.a * 0.58, sheetReject), 0.0, 1.0);
    gl_FragColor = vec4(centerline, seed, quality, reject);
  }
`;

const RIVER_PATH_HEAT_FRAGMENT_SHADER = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uPathEvidence;
  uniform sampler2D uPathCost;
  uniform sampler2D uPreviousPathHeat;
  uniform sampler2D uRiverCoreMass;
  uniform sampler2D uRegionalFlow;
  uniform vec2 uTexel;
  uniform float uFlowDirection;

  vec2 sampleUv(vec2 uv) {
    float x = uv.x;
    float y = uv.y;
    if (y < 0.0) {
      y = -y;
      x += 0.5;
    }
    if (y > 1.0) {
      y = 2.0 - y;
      x += 0.5;
    }
    return vec2(fract(x), clamp(y, 0.002, 0.998));
  }

  vec4 pathAt(vec2 uv) {
    return texture2D(uPathEvidence, sampleUv(uv));
  }

  vec4 costAt(vec2 uv) {
    return texture2D(uPathCost, sampleUv(uv));
  }

  vec4 heatAt(vec2 uv) {
    return texture2D(uPreviousPathHeat, sampleUv(uv));
  }

  vec4 massAt(vec2 uv) {
    return texture2D(uRiverCoreMass, sampleUv(uv));
  }

  vec4 flowAt(vec2 uv) {
    return texture2D(uRegionalFlow, sampleUv(uv));
  }

  vec2 safeNormalize(vec2 v, vec2 fallback) {
    float len = length(v);
    return len > 0.0001 ? v / len : fallback;
  }

  vec2 localTangentAt(vec2 sampleUv, vec2 fallbackDir) {
    vec4 flow = flowAt(sampleUv);
    vec2 tangent = safeNormalize(flow.rg * 2.0 - 1.0, fallbackDir);
    if (dot(tangent, fallbackDir) < 0.0) tangent *= -1.0;
    float centerCost = costAt(sampleUv).r;
    vec2 costGrad = vec2(
      costAt(sampleUv + vec2(uTexel.x, 0.0)).r - costAt(sampleUv - vec2(uTexel.x, 0.0)).r,
      costAt(sampleUv + vec2(0.0, uTexel.y)).r - costAt(sampleUv - vec2(0.0, uTexel.y)).r
    );
    vec2 valleyTangent = safeNormalize(vec2(-costGrad.y, costGrad.x), tangent);
    if (dot(valleyTangent, tangent) < 0.0) valleyTangent *= -1.0;
    float valleyStrength = smoothstep(0.012, 0.18, length(costGrad)) * smoothstep(0.04, 0.82, centerCost);
    float occupancy = smoothstep(0.04, 0.78, flow.b);
    float speed = smoothstep(0.03, 0.82, flow.a);
    return safeNormalize(
      fallbackDir * 0.16 +
      tangent * (0.68 * occupancy + 0.18 * speed) +
      valleyTangent * (0.68 * valleyStrength),
      fallbackDir
    );
  }

  float pathSupportAt(vec2 sampleUv) {
    vec4 raw = pathAt(sampleUv);
    vec4 cost = costAt(sampleUv);
    float skeleton = raw.r * (1.0 - raw.a * 0.28);
    float guideGate = 0.18 + 0.82 * smoothstep(0.025, 0.58, raw.r + raw.b);
    float guidedCost = cost.r * (1.0 - cost.a * 0.35) * guideGate;
    return clamp(max(skeleton, guidedCost * 0.28), 0.0, 1.0);
  }

  float seedAt(vec2 sampleUv) {
    vec4 raw = pathAt(sampleUv);
    vec4 cost = costAt(sampleUv);
    vec4 mass = massAt(sampleUv);
    float channelGate = smoothstep(0.025, 0.54, raw.r + cost.r + cost.g * 0.42);
    float massSeed = mass.r * 0.14 * channelGate * (1.0 - mass.a * 0.58);
    return clamp(max(max(raw.g, cost.g * 0.42), massSeed), 0.0, 1.0);
  }

  float storedDistanceAt(vec2 sampleUv) {
    vec4 heat = heatAt(sampleUv);
    float seed = seedAt(sampleUv);
    float reach = smoothstep(0.015, 0.2, max(heat.g, seed));
    float stored = mix(1.24, heat.r, reach);
    return min(stored, mix(1.18, 0.0, seed));
  }

  float frontAt(vec2 sampleUv) {
    vec4 heat = heatAt(sampleUv);
    float distanceFront = 1.0 - smoothstep(0.28, 1.02, storedDistanceAt(sampleUv));
    return clamp(max(max(heat.g, distanceFront * 0.78), seedAt(sampleUv) * 0.92), 0.0, 1.0);
  }

  float candidateDistance(vec2 sampleUv, vec2 currentTangent, float stepWeight) {
    vec4 h = heatAt(sampleUv);
    vec4 raw = pathAt(sampleUv);
    vec4 cost = costAt(sampleUv);
    vec4 mass = massAt(sampleUv);
    float previousDistance = storedDistanceAt(sampleUv);
    vec2 baseDir = normalize(vec2(cos(uFlowDirection), sin(uFlowDirection)));
    vec2 neighborTangent = localTangentAt(sampleUv, baseDir);
    float turnPenalty = 1.0 - abs(dot(currentTangent, neighborTangent));
    float support = clamp(max(raw.r, cost.r * (0.18 + raw.b * 0.42 + raw.r * 0.28)), 0.0, 1.0);
    float ridge = clamp(max(raw.b, cost.b), 0.0, 1.0);
    float reject = clamp(max(raw.a * 0.52, cost.a * 0.64) + mass.a * 0.16, 0.0, 1.0);
    float travelCost = mix(0.035, 0.36, 1.0 - support);
    travelCost += reject * 0.28 + turnPenalty * (0.08 + ridge * 0.18);
    return previousDistance + travelCost * stepWeight;
  }

  void main() {
    vec2 uv = vUv;
    vec2 baseDir = normalize(vec2(cos(uFlowDirection), sin(uFlowDirection)));
    vec2 tangent = localTangentAt(uv, baseDir);
    vec2 side = vec2(-tangent.y, tangent.x);
    vec2 along1 = tangent * uTexel * 1.15;
    vec2 along2 = tangent * uTexel * 2.35;
    vec2 along4 = tangent * uTexel * 4.25;
    vec2 side1 = side * uTexel * 1.15;
    vec2 side2 = side * uTexel * 2.7;
    vec2 branchA = safeNormalize(tangent + side * 0.48, tangent) * uTexel * 2.25;
    vec2 branchB = safeNormalize(tangent - side * 0.48, tangent) * uTexel * 2.25;
    vec2 branchFarA = safeNormalize(tangent + side * 0.34, tangent) * uTexel * 4.1;
    vec2 branchFarB = safeNormalize(tangent - side * 0.34, tangent) * uTexel * 4.1;

    vec4 raw = pathAt(uv);
    vec4 cost = costAt(uv);
    vec4 prev = heatAt(uv);
    vec4 mass = massAt(uv);

    float lowCost = max(raw.r * (1.0 - raw.a * 0.22), cost.r * (0.3 + raw.b * 0.42 + raw.r * 0.28) * (1.0 - cost.a * 0.24));
    float channelGate = smoothstep(0.03, 0.58, raw.r + raw.g * 0.34 + cost.r + cost.g * 0.42);
    float massSeed = mass.r * 0.18 * channelGate * (1.0 - mass.a * 0.55);
    float seed = clamp(max(max(raw.g, cost.g), max(prev.g * (0.42 + lowCost * 0.34), massSeed)), 0.0, 1.0);

    float alongSupport = (
      pathSupportAt(uv + along1) + pathSupportAt(uv - along1) +
      (pathSupportAt(uv + along2) + pathSupportAt(uv - along2)) * 0.72 +
      (pathSupportAt(uv + along4) + pathSupportAt(uv - along4)) * 0.48
    ) / 4.4;
    float branchSupport = (
      pathSupportAt(uv + branchA) + pathSupportAt(uv - branchA) +
      pathSupportAt(uv + branchB) + pathSupportAt(uv - branchB) +
      (pathSupportAt(uv + branchFarA) + pathSupportAt(uv - branchFarA) + pathSupportAt(uv + branchFarB) + pathSupportAt(uv - branchFarB)) * 0.32
    ) / 5.28;
    float sideSupport = (
      pathSupportAt(uv + side1) + pathSupportAt(uv - side1) +
      (pathSupportAt(uv + side2) + pathSupportAt(uv - side2)) * 0.58
    ) / 3.16;
    float skeletonSeed = raw.r * smoothstep(0.08, 0.7, raw.b + alongSupport * 0.36) * (1.0 - raw.a * 0.42);
    seed = max(seed, skeletonSeed * 0.46);
    float sideFront = (
      frontAt(uv + side1) + frontAt(uv - side1) +
      (frontAt(uv + side2) + frontAt(uv - side2)) * 0.56
    ) / 3.12;
    float alongFront = (
      frontAt(uv + along1) + frontAt(uv - along1) +
      (frontAt(uv + along2) + frontAt(uv - along2)) * 0.72 +
      (frontAt(uv + along4) + frontAt(uv - along4)) * 0.42
    ) / 4.28;

    float minDistance = min(storedDistanceAt(uv) + (1.0 - lowCost) * 0.012, mix(1.18, 0.0, seed));
    minDistance = min(minDistance, candidateDistance(uv + along1, tangent, 0.72));
    minDistance = min(minDistance, candidateDistance(uv - along1, tangent, 0.72));
    minDistance = min(minDistance, candidateDistance(uv + along2, tangent, 0.94));
    minDistance = min(minDistance, candidateDistance(uv - along2, tangent, 0.94));
    minDistance = min(minDistance, candidateDistance(uv + branchA, tangent, 0.96));
    minDistance = min(minDistance, candidateDistance(uv - branchA, tangent, 0.96));
    minDistance = min(minDistance, candidateDistance(uv + branchB, tangent, 0.96));
    minDistance = min(minDistance, candidateDistance(uv - branchB, tangent, 0.96));
    minDistance = min(minDistance, candidateDistance(uv + branchFarA, tangent, 1.22));
    minDistance = min(minDistance, candidateDistance(uv - branchFarA, tangent, 1.22));
    minDistance = min(minDistance, candidateDistance(uv + branchFarB, tangent, 1.22));
    minDistance = min(minDistance, candidateDistance(uv - branchFarB, tangent, 1.22));

    float widthPenalty = smoothstep(0.08, 0.42, sideFront + sideSupport * 0.46 - alongFront * 0.46 - alongSupport * 0.32 - lowCost * 0.2 - seed * 0.35);
    float lineSupport = lowCost + alongSupport * 0.56 + branchSupport * 0.2 - sideSupport * 0.5;
    float supportGate = smoothstep(0.1, 0.56, lineSupport + seed * 0.4) * (1.0 - widthPenalty * 0.46);
    float reject = clamp(max(raw.a * 0.28, cost.a * 0.34) + mass.a * 0.08 + widthPenalty * 0.24, 0.0, 1.0);
    minDistance = clamp(minDistance, 0.0, 1.24);
    float distanceGate = 1.0 - smoothstep(0.32, 1.02, minDistance);
    float occupancy = clamp(max(seed, distanceGate * supportGate) * (1.0 - reject * 0.28) * (1.0 - widthPenalty * 0.42), 0.0, 1.0);
    occupancy = max(occupancy, prev.g * (0.62 + lowCost * 0.18) * (1.0 - reject * 0.22));

    float reach = clamp(max(occupancy, distanceGate * supportGate * (0.5 + lowCost * 0.5)), 0.0, 1.0);
    float storedDistance = min(mix(1.24, minDistance, reach), mix(1.18, 0.0, seed));
    float turnQuality = clamp(max(max(raw.b, cost.b), 1.0 - smoothstep(0.08, 0.74, minDistance)) * (1.0 - widthPenalty * 0.35), 0.0, 1.0);
    gl_FragColor = vec4(storedDistance, occupancy, max(seed, turnQuality * occupancy), reject);
  }
`;

const RIVER_CORE_GEODESIC_FRAGMENT_SHADER = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uRiverCoreMass;
  uniform sampler2D uPathEvidence;
  uniform sampler2D uPreviousGeodesic;
  uniform sampler2D uRegionalFlow;
  uniform vec2 uTexel;
  uniform float uFlowDirection;

  vec2 sampleUv(vec2 uv) {
    float x = uv.x;
    float y = uv.y;
    if (y < 0.0) {
      y = -y;
      x += 0.5;
    }
    if (y > 1.0) {
      y = 2.0 - y;
      x += 0.5;
    }
    return vec2(fract(x), clamp(y, 0.002, 0.998));
  }

  vec4 massAt(vec2 uv) {
    return texture2D(uRiverCoreMass, sampleUv(uv));
  }

  vec4 pathAt(vec2 uv) {
    return texture2D(uPathEvidence, sampleUv(uv));
  }

  vec4 geodesicAt(vec2 uv) {
    return texture2D(uPreviousGeodesic, sampleUv(uv));
  }

  vec4 flowAt(vec2 uv) {
    return texture2D(uRegionalFlow, sampleUv(uv));
  }

  vec2 safeNormalize(vec2 v, vec2 fallback) {
    float len = length(v);
    return len > 0.0001 ? v / len : fallback;
  }

  vec2 localTangentAt(vec2 sampleUv, vec2 fallbackDir) {
    vec4 flow = flowAt(sampleUv);
    vec2 tangent = safeNormalize(flow.rg * 2.0 - 1.0, fallbackDir);
    if (dot(tangent, fallbackDir) < 0.0) tangent *= -1.0;
    float occupancy = smoothstep(0.04, 0.78, flow.b);
    float speed = smoothstep(0.03, 0.82, flow.a);
    return safeNormalize(fallbackDir * 0.25 + tangent * (0.84 * occupancy + 0.22 * speed), fallbackDir);
  }

  float pathFrontFrom(vec4 path) {
    float distanceFront = 1.0 - smoothstep(0.3, 1.02, path.r);
    float qualityGate = smoothstep(0.04, 0.7, max(path.b, path.g));
    return clamp(max(path.g, distanceFront * qualityGate * 0.42) * (1.0 - path.a * 0.3), 0.0, 1.0);
  }

  void main() {
    vec2 uv = vUv;
    vec2 baseDir = normalize(vec2(cos(uFlowDirection), sin(uFlowDirection)));
    vec2 tangent = localTangentAt(uv, baseDir);
    vec2 side = vec2(-tangent.y, tangent.x);
    vec2 along1 = tangent * uTexel * 1.2;
    vec2 along2 = tangent * uTexel * 2.4;
    vec2 side1 = side * uTexel * 1.2;
    vec2 side2 = side * uTexel * 2.65;
    vec2 branchA = safeNormalize(tangent + side * 0.42, tangent) * uTexel * 2.35;
    vec2 branchB = safeNormalize(tangent - side * 0.42, tangent) * uTexel * 2.35;

    vec4 c = massAt(uv);
    vec4 path = pathAt(uv);
    vec4 prev = geodesicAt(uv);

    vec4 gAP = geodesicAt(uv + along1);
    vec4 gAM = geodesicAt(uv - along1);
    vec4 gAP2 = geodesicAt(uv + along2);
    vec4 gAM2 = geodesicAt(uv - along2);
    vec4 gSP = geodesicAt(uv + side1);
    vec4 gSM = geodesicAt(uv - side1);
    vec4 gSP2 = geodesicAt(uv + side2);
    vec4 gSM2 = geodesicAt(uv - side2);
    vec4 gBA = geodesicAt(uv + branchA);
    vec4 gBM = geodesicAt(uv - branchA);
    vec4 gCA = geodesicAt(uv + branchB);
    vec4 gCM = geodesicAt(uv - branchB);

    vec4 pAP = pathAt(uv + along1);
    vec4 pAM = pathAt(uv - along1);
    vec4 pAP2 = pathAt(uv + along2);
    vec4 pAM2 = pathAt(uv - along2);
    vec4 pBA = pathAt(uv + branchA);
    vec4 pBM = pathAt(uv - branchA);
    vec4 pCA = pathAt(uv + branchB);
    vec4 pCM = pathAt(uv - branchB);

    float pathFront = pathFrontFrom(path);
    float pathGate = smoothstep(0.025, 0.7, pathFront);
    float massSeed = smoothstep(0.04, 0.5, c.r + c.b * 0.12) * (1.0 - c.a * 0.66) * pathGate;
    float seed = max(path.b * 0.62, massSeed);
    seed *= 0.06 + pathGate * 0.94;
    float alongFront = max(max(gAP.r * pathFrontFrom(pAP), gAM.r * pathFrontFrom(pAM)), max(gAP2.r * pathFrontFrom(pAP2), gAM2.r * pathFrontFrom(pAM2)) * 0.62);
    float branchFront = max(max(gBA.r * pathFrontFrom(pBA), gBM.r * pathFrontFrom(pBM)), max(gCA.r * pathFrontFrom(pCA), gCM.r * pathFrontFrom(pCM)));
    float sideFront = (gSP.r + gSM.r) * 0.5;
    float sideCrowd = smoothstep(0.09, 0.46, sideFront * 0.5 + (gSP2.r + gSM2.r) * 0.18 - seed * 0.36);
    float propagation = max(alongFront, branchFront * 0.86);
    propagation *= (0.36 + pathGate * 0.64) * (0.58 + path.b * 0.42) * (1.0 - path.a * 0.34);

    float front = max(seed, prev.r * 0.78 * (0.38 + pathGate * 0.62));
    front = max(front, propagation * 0.88);
    front = clamp(front - sideCrowd * 0.1 - path.a * 0.035, 0.0, 1.0);
    float capacity = clamp(max(c.g, pathFront * 0.22 + front * 0.18 + c.b * 0.08), 0.07, 0.25);
    float ridge = clamp(max(c.b * max(pathFront, 0.35), path.b * front * 0.38 + prev.b * 0.52), 0.0, 1.0);
    float reject = clamp(max(path.a * 0.72, c.a * 0.62 + sideCrowd * 0.22), 0.0, 1.0);
    gl_FragColor = vec4(front, capacity, ridge, reject);
  }
`;

const RIVER_CORE_TRANSPORT_FRAGMENT_SHADER = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uField;
  uniform sampler2D uRiverCoreMass;
  uniform sampler2D uPreviousCoreTransport;
  uniform sampler2D uRegionalFlow;
  uniform vec2 uTexel;
  uniform vec2 uFieldTexel;
  uniform float uFlowDirection;

  vec2 sampleUv(vec2 uv) {
    float x = uv.x;
    float y = uv.y;
    if (y < 0.0) {
      y = -y;
      x += 0.5;
    }
    if (y > 1.0) {
      y = 2.0 - y;
      x += 0.5;
    }
    return vec2(fract(x), clamp(y, 0.002, 0.998));
  }

  vec4 fieldAt(vec2 uv) {
    return texture2D(uField, sampleUv(uv));
  }

  vec4 massAt(vec2 uv) {
    return texture2D(uRiverCoreMass, sampleUv(uv));
  }

  vec4 transportAt(vec2 uv) {
    return texture2D(uPreviousCoreTransport, sampleUv(uv));
  }

  vec4 flowAt(vec2 uv) {
    return texture2D(uRegionalFlow, sampleUv(uv));
  }

  vec2 safeNormalize(vec2 v, vec2 fallback) {
    float len = length(v);
    return len > 0.0001 ? v / len : fallback;
  }

  vec2 localTangentAt(vec2 sampleUv, vec2 fallbackDir) {
    vec4 flow = flowAt(sampleUv);
    vec2 tangent = safeNormalize(flow.rg * 2.0 - 1.0, fallbackDir);
    if (dot(tangent, fallbackDir) < 0.0) tangent *= -1.0;
    float occupancy = smoothstep(0.04, 0.78, flow.b);
    float speed = smoothstep(0.03, 0.82, flow.a);
    return safeNormalize(fallbackDir * 0.26 + tangent * (0.82 * occupancy + 0.24 * speed), fallbackDir);
  }

  void main() {
    vec2 uv = vUv;
    vec2 baseDir = normalize(vec2(cos(uFlowDirection), sin(uFlowDirection)));
    vec2 tangent = localTangentAt(uv, baseDir);
    vec2 side = vec2(-tangent.y, tangent.x);
    vec2 along1 = tangent * uTexel * 1.25;
    vec2 along2 = tangent * uTexel * 2.5;
    vec2 along4 = tangent * uTexel * 4.5;
    vec2 side1 = side * uTexel * 1.25;
    vec2 side2 = side * uTexel * 2.75;
    vec2 branchA = safeNormalize(tangent + side * 0.42, tangent) * uTexel * 2.4;
    vec2 branchB = safeNormalize(tangent - side * 0.42, tangent) * uTexel * 2.4;

    vec4 f = fieldAt(uv);
    vec4 fXR = fieldAt(uv + vec2(uFieldTexel.x * 5.0, 0.0));
    vec4 fXL = fieldAt(uv - vec2(uFieldTexel.x * 5.0, 0.0));
    vec4 fYU = fieldAt(uv + vec2(0.0, uFieldTexel.y * 5.0));
    vec4 fYD = fieldAt(uv - vec2(0.0, uFieldTexel.y * 5.0));
    vec4 fXP = fieldAt(uv + tangent * uFieldTexel * 7.0);
    vec4 fXM = fieldAt(uv - tangent * uFieldTexel * 7.0);
    vec4 fSP = fieldAt(uv + side * uFieldTexel * 7.0);
    vec4 fSM = fieldAt(uv - side * uFieldTexel * 7.0);
    float neighborHigh = max(max(fXR.r, fXL.r), max(fYU.r, fYD.r));
    float valleyEvidence = smoothstep(0.016, 0.17, neighborHigh - f.r) * (1.0 - smoothstep(0.72, 0.96, f.r));
    float surfactantGradient = clamp(length(vec2(fXR.g - fXL.g, fYU.g - fYD.g)) * 7.4, 0.0, 1.0);
    float phaseGradient = clamp(length(vec2(fXR.a - fXL.a, fYU.a - fYD.a)) * 6.2, 0.0, 1.0);
    float alongValley = smoothstep(0.014, 0.12, max(fXP.r, fXM.r) - f.r);
    float transverseValley = smoothstep(0.014, 0.13, max(fSP.r, fSM.r) - f.r);
    vec2 gradH = vec2(fXR.r - fXL.r, fYU.r - fYD.r);
    vec2 gradG = vec2(fXR.g - fXL.g, fYU.g - fYD.g);
    vec2 gradDye = vec2(fXR.a - fXL.a, fYU.a - fYD.a);
    float capillaryEdge = smoothstep(
      0.003,
      0.058,
      abs(dot(gradH, side)) * 0.82 +
      abs(dot(gradG, side)) * 0.55 +
      abs(dot(gradDye, side)) * 0.36 +
      length(gradH) * 0.28
    );
    float foamPenalty = smoothstep(0.38, 0.88, f.b);

    vec4 c = massAt(uv);
    vec4 p = transportAt(uv);
    vec4 aP = massAt(uv + along1);
    vec4 aM = massAt(uv - along1);
    vec4 aP2 = massAt(uv + along2);
    vec4 aM2 = massAt(uv - along2);
    vec4 aP4 = massAt(uv + along4);
    vec4 aM4 = massAt(uv - along4);
    vec4 sP = massAt(uv + side1);
    vec4 sM = massAt(uv - side1);
    vec4 sP2 = massAt(uv + side2);
    vec4 sM2 = massAt(uv - side2);
    vec4 bAP = massAt(uv + branchA);
    vec4 bAM = massAt(uv - branchA);
    vec4 bBP = massAt(uv + branchB);
    vec4 bBM = massAt(uv - branchB);
    vec4 pAP = transportAt(uv + along1);
    vec4 pAM = transportAt(uv - along1);
    vec4 pAP2 = transportAt(uv + along2);
    vec4 pAM2 = transportAt(uv - along2);
    vec4 pSP = transportAt(uv + side1);
    vec4 pSM = transportAt(uv - side1);
    vec4 pBAP = transportAt(uv + branchA);
    vec4 pBAM = transportAt(uv - branchA);
    vec4 pBBP = transportAt(uv + branchB);
    vec4 pBBM = transportAt(uv - branchB);
    vec4 flow = flowAt(uv);

    vec2 tangentP = localTangentAt(uv + along2, tangent);
    vec2 tangentM = localTangentAt(uv - along2, tangent);
    vec2 tangentBA = localTangentAt(uv + branchA, tangent);
    vec2 tangentBB = localTangentAt(uv + branchB, tangent);
    float turnCost = 1.0 - min(abs(dot(tangent, tangentP)), abs(dot(tangent, tangentM)));
    float branchTurnCost = 1.0 - max(abs(dot(tangent, tangentBA)), abs(dot(tangent, tangentBB)));
    float curvatureGate = 1.0 - smoothstep(0.28, 0.82, turnCost + branchTurnCost * 0.45) * 0.54;

    float alongNear = (aP.r + aM.r) * 0.5;
    float alongMid = (aP2.r + aM2.r) * 0.5;
    float alongWide = (aP4.r + aM4.r) * 0.5;
    float sideNear = (sP.r + sM.r) * 0.5;
    float sideWide = (sP2.r + sM2.r) * 0.5;
    float prevAlong = (pAP.r + pAM.r + (pAP2.r + pAM2.r) * 0.62) / 3.24;
    float prevSide = (pSP.r + pSM.r) * 0.5;
    float sideCrowd = smoothstep(0.08, 0.44, sideNear * 0.48 + sideWide * 0.34 + prevSide * 0.26 - c.r * 0.38);
    float regionalRidge = smoothstep(0.05, 0.72, max(c.b, flow.b * 0.64 + flow.a * 0.18));
    float lowSheetReject = 1.0 - smoothstep(0.18, 0.76, c.a + max(sP.a, sM.a) * 0.36 + sideCrowd * 0.28);
    float pathEvidence = clamp(
      valleyEvidence * 0.58 +
      alongValley * 0.28 +
      capillaryEdge * 0.3 +
      surfactantGradient * 0.26 +
      phaseGradient * 0.2 +
      regionalRidge * 0.26 +
      c.b * 0.18 +
      c.r * 0.1 -
      foamPenalty * 0.12,
      0.0,
      1.0
    );
    float lateralEvidenceReject = smoothstep(
      0.12,
      0.46,
      transverseValley +
      sideCrowd * 0.52 -
      alongValley * 0.44 -
      capillaryEdge * 0.18
    );
    pathEvidence *= (1.0 - lateralEvidenceReject * 0.46);
    float geodesicGate = smoothstep(0.11, 0.42, pathEvidence) * lowSheetReject * curvatureGate;
    float sourceGate = max(
      geodesicGate,
      smoothstep(0.034, 0.42, c.r + c.b * 0.14 + capillaryEdge * 0.12) * (1.0 - c.a * 0.66) * (1.0 - sideCrowd * 0.24) * 0.74
    );

    float twoSidedBridge = sqrt(max(0.0, max(aP.r, pAP.r) * max(aM.r, pAM.r)));
    float longBridge = sqrt(max(0.0, max(aP2.r, pAP2.r) * max(aM2.r, pAM2.r)));
    float branchBridge = max(
      sqrt(max(0.0, max(bAP.r, pBAP.r) * max(bAM.r, pBAM.r))),
      sqrt(max(0.0, max(bBP.r, pBBP.r) * max(bBM.r, pBBM.r)))
    );
    float branchNeighbor = max(max(bAP.r, bAM.r), max(bBP.r, bBM.r));
    float oneSidedExtension = max(max(max(aP.r, aM.r), max(pAP.r, pAM.r)), max(branchNeighbor, max(max(pBAP.r, pBAM.r), max(pBBP.r, pBBM.r)) * 0.86)) *
      smoothstep(0.018, 0.42, c.r + c.b * 0.32 + p.r * 0.28 + branchBridge * 0.18);
    float alongContinuity = smoothstep(0.035, 0.48, c.r + alongNear * 0.6 + alongMid * 0.35 + prevAlong * 0.45);
    float bridge = max(twoSidedBridge * 0.86, longBridge * 0.48);
    bridge = max(bridge, branchBridge * 0.42);
    bridge = max(bridge, oneSidedExtension * 0.24);
    bridge *= geodesicGate;
    oneSidedExtension *= geodesicGate * (0.72 + regionalRidge * 0.28);

    float sheetReject = clamp(max(c.a, sideCrowd * 0.56 + max(sP.a, sM.a) * 0.24 + (1.0 - geodesicGate) * 0.16), 0.0, 1.0);
    float capacityGate = smoothstep(0.072, 0.25, c.g + c.b * 0.2 + c.r * 0.08 + bridge * 0.14 + prevAlong * 0.07 + regionalRidge * 0.05);
    float ridgeGate = smoothstep(0.04, 0.58, c.b + c.r * 0.08 + bridge * 0.34 + p.b * 0.18 + regionalRidge * 0.2);

    float connected = clamp(
      max(c.r * sourceGate, p.r * 0.68 * geodesicGate) +
      bridge * alongContinuity * (0.56 + ridgeGate * 0.42) +
      prevAlong * 0.11 * geodesicGate,
      0.0,
      1.0
    );
    connected *= (0.42 + capacityGate * 0.58) * (0.36 + max(geodesicGate, sourceGate * 0.52) * 0.64) * (1.0 - sheetReject * 0.56);
    connected = max(connected, c.r * sourceGate * (1.0 - c.a * 0.74));
    connected = clamp(connected - max(0.0, sideNear - connected) * 0.18, 0.0, 1.0);

    float capacity = clamp(mix(c.g, max(c.g, connected * 0.32 + c.b * 0.08), 0.42), 0.072, 0.25);
    float ridge = clamp(max(c.b * sourceGate, bridge * 0.34 + p.b * 0.22 * geodesicGate + regionalRidge * geodesicGate * 0.16) * (1.0 - sheetReject * 0.34), 0.0, 1.0);
    gl_FragColor = vec4(connected, capacity, ridge, sheetReject);
  }
`;

const RIVER_CORE_BALANCE_FRAGMENT_SHADER = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uRiverCoreSupport;
  uniform sampler2D uRiverCoreMass;
  uniform sampler2D uPreviousCoreBalance;
  uniform sampler2D uPreviousRiver;
  uniform sampler2D uRegionalFlow;
  uniform vec2 uTexel;
  uniform float uFlowDirection;

  vec2 sampleUv(vec2 uv) {
    float x = uv.x;
    float y = uv.y;
    if (y < 0.0) {
      y = -y;
      x += 0.5;
    }
    if (y > 1.0) {
      y = 2.0 - y;
      x += 0.5;
    }
    return vec2(fract(x), clamp(y, 0.002, 0.998));
  }

  vec4 supportAt(vec2 uv) {
    return texture2D(uRiverCoreSupport, sampleUv(uv));
  }

  vec4 coreMassAt(vec2 uv) {
    return texture2D(uRiverCoreMass, sampleUv(uv));
  }

  vec4 coreHistoryAt(vec2 uv) {
    return texture2D(uPreviousCoreBalance, sampleUv(uv));
  }

  vec4 riverAt(vec2 uv) {
    return texture2D(uPreviousRiver, sampleUv(uv));
  }

  vec4 flowAt(vec2 uv) {
    return texture2D(uRegionalFlow, sampleUv(uv));
  }

  vec2 safeNormalize(vec2 v, vec2 fallback) {
    float len = length(v);
    return len > 0.0001 ? v / len : fallback;
  }

  vec2 localTangentAt(vec2 sampleUv, vec2 fallbackDir) {
    vec4 flow = flowAt(sampleUv);
    vec2 tangent = safeNormalize(flow.rg * 2.0 - 1.0, fallbackDir);
    if (dot(tangent, fallbackDir) < 0.0) tangent *= -1.0;
    float occupancy = smoothstep(0.04, 0.76, flow.b);
    float speed = smoothstep(0.025, 0.78, flow.a);
    return safeNormalize(fallbackDir * 0.38 + tangent * (0.72 * occupancy + 0.24 * speed), fallbackDir);
  }

  void main() {
    vec2 uv = vUv;
    vec2 baseDir = normalize(vec2(cos(uFlowDirection), sin(uFlowDirection)));
    vec2 mainDir = localTangentAt(uv, baseDir);
    vec2 sideDir = vec2(-mainDir.y, mainDir.x);
    vec2 alongA = mainDir * uTexel * 3.5;
    vec2 alongB = mainDir * uTexel * 8.5;
    vec2 sideA = sideDir * uTexel * 3.5;
    vec2 sideB = sideDir * uTexel * 8.5;
    vec2 diagA = (mainDir + sideDir) * uTexel * 5.5;
    vec2 diagB = (mainDir - sideDir) * uTexel * 5.5;

    vec4 c = supportAt(uv);
    vec4 alongP = supportAt(uv + alongA);
    vec4 alongM = supportAt(uv - alongA);
    vec4 alongP2 = supportAt(uv + alongB);
    vec4 alongM2 = supportAt(uv - alongB);
    vec4 sideP = supportAt(uv + sideA);
    vec4 sideM = supportAt(uv - sideA);
    vec4 sideP2 = supportAt(uv + sideB);
    vec4 sideM2 = supportAt(uv - sideB);
    vec4 diagPP = supportAt(uv + diagA);
    vec4 diagPM = supportAt(uv + diagB);
    vec4 diagMP = supportAt(uv - diagB);
    vec4 diagMM = supportAt(uv - diagA);

    float alongMean = (
      alongP.r + alongM.r +
      (alongP2.r + alongM2.r) * 0.58 +
      (diagPP.r + diagPM.r + diagMP.r + diagMM.r) * 0.18
    ) / 3.88;
    float sideNearMean = (sideP.r + sideM.r) * 0.5;
    float sideWideMean = (sideP2.r + sideM2.r) * 0.5;
    float sideMean = sideNearMean * 0.72 + sideWideMean * 0.28;
    float localCoreMean = clamp(
      (
        c.r * 1.55 +
        alongP.r + alongM.r +
        sideP.r + sideM.r +
        (alongP2.r + alongM2.r + sideP2.r + sideM2.r) * 0.52 +
        (diagPP.r + diagPM.r + diagMP.r + diagMM.r) * 0.28
      ) / 7.23,
      0.0,
      1.0
    );
    float localEdgeMean = clamp(
      (
        c.g * 1.25 +
        alongP.g + alongM.g +
        sideP.g + sideM.g +
        (alongP2.g + alongM2.g + sideP2.g + sideM2.g) * 0.42
      ) / 5.61,
      0.0,
      1.0
    );
    float localSheetMean = clamp(
      (
        c.b * 1.15 +
        sideP.b + sideM.b +
        (sideP2.b + sideM2.b) * 0.75 +
        (alongP.b + alongM.b) * 0.42 +
        (diagPP.b + diagPM.b + diagMP.b + diagMM.b) * 0.16
      ) / 5.79,
      0.0,
      1.0
    );

    float prevRiverAlong = (
      riverAt(uv).r * 0.72 +
      riverAt(uv + alongA).r +
      riverAt(uv - alongA).r +
      (riverAt(uv + alongB).r + riverAt(uv - alongB).r) * 0.42
    ) / 3.56;
    float prevCoreCenter = coreHistoryAt(uv).r;
    float prevCoreAlong = (
      prevCoreCenter * 0.86 +
      coreHistoryAt(uv + alongA).r +
      coreHistoryAt(uv - alongA).r +
      (coreHistoryAt(uv + alongB).r + coreHistoryAt(uv - alongB).r) * 0.56
    ) / 3.98;
    float prevCoreSide = (
      coreHistoryAt(uv + sideA).r +
      coreHistoryAt(uv - sideA).r +
      (coreHistoryAt(uv + sideB).r + coreHistoryAt(uv - sideB).r) * 0.42
    ) / 2.84;
    float prevAlong = max(prevCoreAlong, prevRiverAlong * 0.34);
    float lateralPeak = max(0.0, c.r + alongMean * 0.18 + localEdgeMean * 0.1 - sideNearMean * 0.94 - sideWideMean * 0.24 - localSheetMean * 0.14);
    float sideContrast = abs(sideP.r - sideM.r) + abs(sideP2.r - sideM2.r) * 0.38 + abs(sideP.g - sideM.g) * 0.22;
    float crestGate = smoothstep(0.006, 0.118, lateralPeak + sideContrast * 0.18 + c.g * 0.07 + max(0.0, prevCoreCenter - prevCoreSide * 0.76) * 0.16);
    float narrowness = (1.0 - smoothstep(0.34, 0.78, sideMean + sideWideMean * 0.42 + localSheetMean * 0.24));
    float continuity = smoothstep(0.028, 0.36, alongMean * 0.72 + prevAlong * 0.52 + c.r * 0.24 + localEdgeMean * 0.14);

    float areaBias = clamp(c.a * 2.0 - 1.0, -1.0, 1.0);
    vec4 regionalMass = coreMassAt(uv);
    float regionalCandidate = smoothstep(0.035, 0.42, regionalMass.r);
    float regionalTarget = clamp(regionalMass.g, 0.11, 0.29);
    float regionalRank = smoothstep(0.035, 0.72, regionalMass.b);
    float regionalReject = smoothstep(0.16, 0.82, regionalMass.a);
    crestGate = max(crestGate, smoothstep(0.05, 0.42, c.r + alongMean * 0.24 + regionalRank * 0.18) * (0.46 + continuity * 0.54) * (1.0 - regionalReject * 0.42));
    narrowness = clamp(max(narrowness, smoothstep(0.035, 0.26, c.r + lateralPeak * 0.5 - sideMean * 0.38) * (0.52 + regionalRank * 0.24)) * (1.0 - regionalReject * 0.18), 0.0, 1.0);
    float occupiedCoreMean = max(localCoreMean, prevCoreAlong * 0.62 + prevCoreSide * 0.18);
    float targetArea = clamp(mix(0.19 + localEdgeMean * 0.07 - localSheetMean * 0.065 + areaBias * 0.04, regionalTarget, 0.72), 0.13, 0.285);
    float areaGain = clamp(targetArea / max(0.032, occupiedCoreMean), 0.42, 2.25);
    float overfill = smoothstep(targetArea * 1.16, targetArea + 0.22, occupiedCoreMean);
    float underfill = 1.0 - smoothstep(0.032, targetArea * 0.82, occupiedCoreMean);

    float core = c.r *
      areaGain *
      crestGate *
      (0.36 + continuity * 0.64) *
      (0.48 + narrowness * 0.52) *
      (1.0 - overfill * (0.36 + regionalReject * 0.22)) *
      (0.72 + regionalCandidate * 0.28);
    core += underfill * smoothstep(0.065, 0.42, c.r + alongMean * 0.58 + localEdgeMean * 0.26 + regionalRank * 0.08) * crestGate * (0.14 + regionalCandidate * 0.08);
    core = max(core, c.r * regionalCandidate * regionalRank * continuity * (0.46 + narrowness * 0.54) * (1.0 - regionalReject * 0.52) * 0.82);
    core = max(core, prevCoreCenter * continuity * (0.58 + narrowness * 0.22) * (1.0 - overfill * 0.56));
    core = max(core, riverAt(uv).r * continuity * crestGate * narrowness * (1.0 - overfill * 0.62) * 0.18);
    core = clamp(core, 0.0, 1.0);

    float coreInterior = smoothstep(0.26, 0.72, core);
    float edge = clamp(max(c.g, localEdgeMean * 0.48) *
      smoothstep(0.018, 0.44, core + lateralPeak + prevAlong * 0.18 + sideContrast * 0.12) *
      (1.0 - overfill * 0.18) *
      (1.0 - coreInterior * 0.68),
      0.0,
      1.0
    );
    float sheet = clamp(max(c.b, localSheetMean * 0.58 + overfill * 0.72 + (1.0 - narrowness) * 0.28) * (1.0 - core * 0.64), 0.0, 1.0);
    float areaError = clamp((localCoreMean - targetArea) * 1.9 + 0.5, 0.0, 1.0);

    gl_FragColor = vec4(core, edge, sheet, areaError);
  }
`;

const RIVER_PHASE_FRAGMENT_SHADER = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uField;
  uniform sampler2D uVelocity;
  uniform sampler2D uPreviousRiver;
  uniform sampler2D uRegionalSupport;
  uniform sampler2D uRegionalFlow;
  uniform sampler2D uRiverCoreSupport;
  uniform vec2 uTexel;
  uniform float uDelta;
  uniform float uFlowDirection;
  uniform float uDripAmount;
  uniform float uCapillary;

  vec3 sphericalSampleUv(vec2 uv) {
    float x = uv.x;
    float y = uv.y;
    float poleCross = 0.0;
    if (y < 0.0) {
      y = -y;
      x += 0.5;
      poleCross = 1.0;
    }
    if (y > 1.0) {
      y = 2.0 - y;
      x += 0.5;
      poleCross = 1.0;
    }
    return vec3(fract(x), clamp(y, 0.002, 0.998), poleCross);
  }

  vec2 sampleUv(vec2 uv) {
    return sphericalSampleUv(uv).xy;
  }

  vec4 fieldAt(vec2 uv) {
    return texture2D(uField, sampleUv(uv));
  }

  vec2 velocityAt(vec2 uv) {
    vec3 sphereUv = sphericalSampleUv(uv);
    vec2 velocity = (texture2D(uVelocity, sphereUv.xy).rg - 0.5) * 0.5;
    return mix(velocity, -velocity, sphereUv.z);
  }

  vec4 riverAt(vec2 uv) {
    return texture2D(uPreviousRiver, sampleUv(uv));
  }

  vec4 regionalAt(vec2 uv) {
    return texture2D(uRegionalSupport, sampleUv(uv));
  }

  vec4 flowAt(vec2 uv) {
    return texture2D(uRegionalFlow, sampleUv(uv));
  }

  vec4 coreSupportAt(vec2 uv) {
    return texture2D(uRiverCoreSupport, sampleUv(uv));
  }

  vec2 safeNormalize(vec2 v, vec2 fallback) {
    float len = length(v);
    return len > 0.0001 ? v / len : fallback;
  }

  vec2 localTangentAt(vec2 sampleUv, vec2 fallbackDir) {
    vec4 flow = flowAt(sampleUv);
    vec2 flowTangent = safeNormalize(flow.rg * 2.0 - 1.0, fallbackDir);
    if (dot(flowTangent, fallbackDir) < 0.0) flowTangent *= -1.0;
    float occupancy = smoothstep(0.04, 0.78, flow.b);
    float speed = smoothstep(0.03, 0.82, flow.a);
    vec2 v = velocityAt(sampleUv);
    vec4 l = fieldAt(sampleUv - vec2(uTexel.x, 0.0));
    vec4 r = fieldAt(sampleUv + vec2(uTexel.x, 0.0));
    vec4 d = fieldAt(sampleUv - vec2(0.0, uTexel.y));
    vec4 u = fieldAt(sampleUv + vec2(0.0, uTexel.y));
    vec2 gradH = vec2(r.r - l.r, u.r - d.r);
    vec2 gradG = vec2(r.g - l.g, u.g - d.g);
    vec2 contourTangent = safeNormalize(vec2(-(gradH.y + gradG.y * 0.28), gradH.x + gradG.x * 0.28), fallbackDir);
    if (dot(contourTangent, fallbackDir) < -0.2) contourTangent *= -1.0;
    return safeNormalize(
      fallbackDir * 0.34 +
      flowTangent * (0.72 * occupancy + 0.16 * speed) +
      v * (3.2 + speed * 1.4) +
      contourTangent * (0.22 + occupancy * 0.18),
      fallbackDir
    );
  }

  float highPhase(float dye) {
    return smoothstep(0.44, 0.7, dye);
  }

  float physicalChannelAt(vec2 sampleUv, vec2 mainDir) {
    vec4 c = fieldAt(sampleUv);
    vec4 l = fieldAt(sampleUv - vec2(uTexel.x, 0.0));
    vec4 r = fieldAt(sampleUv + vec2(uTexel.x, 0.0));
    vec4 d = fieldAt(sampleUv - vec2(0.0, uTexel.y));
    vec4 u = fieldAt(sampleUv + vec2(0.0, uTexel.y));
    vec2 gradH = vec2(r.r - l.r, u.r - d.r);
    vec2 gradG = vec2(r.g - l.g, u.g - d.g);
    vec2 gradDye = vec2(r.a - l.a, u.a - d.a);
    float lapH = l.r + r.r + u.r + d.r - c.r * 4.0;
    vec2 lV = velocityAt(sampleUv - vec2(uTexel.x, 0.0));
    vec2 rV = velocityAt(sampleUv + vec2(uTexel.x, 0.0));
    vec2 dV = velocityAt(sampleUv - vec2(0.0, uTexel.y));
    vec2 uV = velocityAt(sampleUv + vec2(0.0, uTexel.y));
    float shear = length(rV - lV) + length(uV - dV);
    float convergence = max(0.0, -((rV.x - lV.x) + (uV.y - dV.y)) * 0.5);
    vec4 regional = regionalAt(sampleUv);
    float upstream = dot(sampleUv - vec2(0.5), -mainDir);
    float inlet = clamp(0.18 + smoothstep(-0.58, 0.16, upstream) * (1.0 - smoothstep(-0.08, 0.72, upstream)) * 0.82, 0.0, 1.0);
    float heightValley = smoothstep(0.72, 0.3, c.r);
    float thickIsland = smoothstep(0.62, 0.98, c.r + length(gradH) * 1.45 + c.b * 0.12);
    float surfactantRidge = smoothstep(0.006, 0.055, length(gradG));
    float curvature = smoothstep(0.006, 0.098, abs(lapH) * (4.4 + uCapillary * 0.72) + length(gradDye) * 0.76 + shear * 0.34);
    return clamp(
      (
        heightValley * 0.34 +
        surfactantRidge * 0.38 +
        curvature * 0.34 +
        convergence * 0.36 +
        highPhase(c.a) * 0.32 +
        regional.r * 0.32 +
        regional.g * 0.18 +
        regional.b * 0.5 -
        regional.a * 0.16 -
        thickIsland * 0.22
      ) * inlet,
      0.0,
      1.0
    );
  }

  float channelTargetAt(vec2 sampleUv, vec2 mainDir) {
    vec2 localDir = localTangentAt(sampleUv, mainDir);
    vec2 sideDir = vec2(-localDir.y, localDir.x);
    vec2 alongStep = localDir * uTexel * 6.0;
    vec2 sideStep = sideDir * uTexel * 6.0;
    vec2 wideAlongStep = localDir * uTexel * 14.0;
    vec2 wideSideStep = sideDir * uTexel * 14.0;
    float core = physicalChannelAt(sampleUv, localDir);
    float along = (
      physicalChannelAt(sampleUv + alongStep, localDir) +
      physicalChannelAt(sampleUv - alongStep, localDir) +
      physicalChannelAt(sampleUv + wideAlongStep, localDir) * 0.58 +
      physicalChannelAt(sampleUv - wideAlongStep, localDir) * 0.58
    ) / 3.16;
    float across = (
      physicalChannelAt(sampleUv + sideStep, localDir) +
      physicalChannelAt(sampleUv - sideStep, localDir) +
      physicalChannelAt(sampleUv + wideSideStep, localDir) * 0.48 +
      physicalChannelAt(sampleUv - wideSideStep, localDir) * 0.48
    ) / 2.96;
    float diagonal = (
      physicalChannelAt(sampleUv + alongStep + sideStep, localDir) +
      physicalChannelAt(sampleUv + alongStep - sideStep, localDir) +
      physicalChannelAt(sampleUv - alongStep + sideStep, localDir) +
      physicalChannelAt(sampleUv - alongStep - sideStep, localDir)
    ) * 0.25;
    vec4 regional = regionalAt(sampleUv);
    vec4 coreSupport = coreSupportAt(sampleUv);
    vec4 c = fieldAt(sampleUv);
    vec4 l = fieldAt(sampleUv - vec2(uTexel.x, 0.0));
    vec4 r = fieldAt(sampleUv + vec2(uTexel.x, 0.0));
    vec4 d = fieldAt(sampleUv - vec2(0.0, uTexel.y));
    vec4 u = fieldAt(sampleUv + vec2(0.0, uTexel.y));
    vec2 gradH = vec2(r.r - l.r, u.r - d.r);
    vec2 gradG = vec2(r.g - l.g, u.g - d.g);
    vec2 gradDye = vec2(r.a - l.a, u.a - d.a);
    float lapH = l.r + r.r + u.r + d.r - c.r * 4.0;
    vec2 vL = velocityAt(sampleUv - vec2(uTexel.x, 0.0));
    vec2 vR = velocityAt(sampleUv + vec2(uTexel.x, 0.0));
    vec2 vD = velocityAt(sampleUv - vec2(0.0, uTexel.y));
    vec2 vU = velocityAt(sampleUv + vec2(0.0, uTexel.y));
    float shear = length(vR - vL) + length(vU - vD);
    float convergence = max(0.0, -((vR.x - vL.x) + (vU.y - vD.y)) * 0.5);
    float edgeEvidence = smoothstep(
      0.012,
      0.11,
      length(gradH) * 1.28 + length(gradG) * 1.72 + length(gradDye) * 0.58 + abs(lapH) * 3.2
    );
    float flowEvidence = smoothstep(0.006, 0.08, shear + convergence * 0.72 + length(velocityAt(sampleUv)) * 0.32);
    float branchEvidence = clamp(
      edgeEvidence * 0.56 +
      flowEvidence * 0.42 +
      coreSupport.r * 0.42 +
      coreSupport.b * 0.26 +
      regional.b * 0.14 -
      max(regional.a, coreSupport.a) * 0.28,
      0.0,
      1.0
    );
    float alongBias = max(0.0, along - across * 0.72);
    float anisotropyGate = smoothstep(0.025, 0.34, alongBias + diagonal * 0.06 + branchEvidence * 0.08);
    float sheetReject = smoothstep(
      0.16,
      0.56,
      across + regional.a * 0.22 + coreSupport.a * 0.16 - along * 0.56 - branchEvidence * 0.18
    );
    float ridgeCompetition = max(
      0.0,
      core * 0.46 + along * 0.82 + diagonal * 0.14 + coreSupport.r * 0.24 + coreSupport.b * 0.18 + regional.b * 0.28 - across * 0.96
    );
    float narrowGate = smoothstep(0.075, 0.38, ridgeCompetition + branchEvidence * 0.12) * (0.44 + anisotropyGate * 0.56);
    float supportGate = smoothstep(
      0.16,
      0.68,
      core + along * 0.62 + coreSupport.r * 0.34 + coreSupport.b * 0.22 + regional.r * 0.16 + regional.b * 0.12
    ) * (0.54 + branchEvidence * 0.46);
    float thickIsland = smoothstep(0.68, 0.98, fieldAt(sampleUv).r + fieldAt(sampleUv).b * 0.16);
    return clamp(narrowGate * supportGate * (1.0 - sheetReject * 0.54) * (1.0 - thickIsland * 0.24), 0.0, 1.0);
  }

  float localRiverMass(vec2 sampleUv, vec2 mainDir) {
    vec2 localDir = localTangentAt(sampleUv, mainDir);
    vec2 sideDir = vec2(-localDir.y, localDir.x);
    vec2 alongStep = localDir * uTexel * 5.0;
    vec2 sideStep = sideDir * uTexel * 5.0;
    vec2 wideAlongStep = localDir * uTexel * 12.0;
    vec2 wideSideStep = sideDir * uTexel * 12.0;
    return clamp((
      riverAt(sampleUv).r * 1.3 +
      riverAt(sampleUv + alongStep).r +
      riverAt(sampleUv - alongStep).r +
      riverAt(sampleUv + wideAlongStep).r * 0.62 +
      riverAt(sampleUv - wideAlongStep).r * 0.62 +
      riverAt(sampleUv + sideStep).r * 0.46 +
      riverAt(sampleUv - sideStep).r * 0.46 +
      riverAt(sampleUv + wideSideStep).r * 0.22 +
      riverAt(sampleUv - wideSideStep).r * 0.22
    ) / 5.9, 0.0, 1.0);
  }

  float riverPotentialAt(vec2 sampleUv, vec2 mainDir) {
    vec2 localDir = localTangentAt(sampleUv, mainDir);
    vec2 sideDir = vec2(-localDir.y, localDir.x);
    vec2 alongStep = localDir * uTexel * 4.0;
    vec2 sideStep = sideDir * uTexel * 4.0;
    vec4 c = riverAt(sampleUv);
    float phi = c.r * 2.0 - 1.0;
    float l = riverAt(sampleUv - vec2(uTexel.x, 0.0)).r * 2.0 - 1.0;
    float r = riverAt(sampleUv + vec2(uTexel.x, 0.0)).r * 2.0 - 1.0;
    float d = riverAt(sampleUv - vec2(0.0, uTexel.y)).r * 2.0 - 1.0;
    float u = riverAt(sampleUv + vec2(0.0, uTexel.y)).r * 2.0 - 1.0;
    float lapPhi = l + r + d + u - phi * 4.0;
    float target = channelTargetAt(sampleUv, mainDir);
    float localMass = localRiverMass(sampleUv, mainDir);
    float alongMass = (
      riverAt(sampleUv + alongStep).r +
      riverAt(sampleUv - alongStep).r +
      riverAt(sampleUv + alongStep * 2.2).r * 0.55 +
      riverAt(sampleUv - alongStep * 2.2).r * 0.55
    ) / 3.1;
    float crossMass = (
      riverAt(sampleUv + sideStep).r +
      riverAt(sampleUv - sideStep).r +
      riverAt(sampleUv + sideStep * 2.2).r * 0.45 +
      riverAt(sampleUv - sideStep * 2.2).r * 0.45
    ) / 2.9;
    float widthPressure = smoothstep(0.1, 0.4, crossMass - alongMass * 0.52);
    float broadSheetPenalty = clamp(
      smoothstep(0.34, 0.62, localMass) * (1.0 - c.b * 0.54) +
      widthPressure * 0.38 +
      max(regionalAt(sampleUv).a, coreSupportAt(sampleUv).a) * 0.1,
      0.0,
      1.0
    );
    float thickPenalty = smoothstep(0.62, 0.92, fieldAt(sampleUv).r + fieldAt(sampleUv).b * 0.22);
    return clamp(
      phi * phi * phi - phi -
      mix(0.05, 0.115, clamp(uCapillary, 0.0, 1.0)) * lapPhi -
      target * 1.14 +
      broadSheetPenalty * 0.62 +
      thickPenalty * 0.17,
      -6.0,
      6.0
    );
  }

  void main() {
    vec2 uv = vUv;
    vec2 baseDir = normalize(vec2(cos(uFlowDirection), sin(uFlowDirection)));
    vec2 mainDir = localTangentAt(uv, baseDir);
    vec2 sideDir = vec2(-mainDir.y, mainDir.x);
    vec2 v = velocityAt(uv);
    vec2 backUv = uv - (v * 1.35 + mainDir * (0.002 + uDripAmount * 0.0015)) * uDelta * 12.0;
    vec4 advected = riverAt(backUv);
    vec4 c = fieldAt(uv);
    vec2 vL = velocityAt(uv - vec2(uTexel.x, 0.0));
    vec2 vR = velocityAt(uv + vec2(uTexel.x, 0.0));
    vec2 vD = velocityAt(uv - vec2(0.0, uTexel.y));
    vec2 vU = velocityAt(uv + vec2(0.0, uTexel.y));
    float shear = length(vR - vL) + length(vU - vD);
    float target = channelTargetAt(uv, baseDir);
    float muC = riverPotentialAt(uv, baseDir);
    float lapMu =
      riverPotentialAt(uv - vec2(uTexel.x, 0.0), baseDir) +
      riverPotentialAt(uv + vec2(uTexel.x, 0.0), baseDir) +
      riverPotentialAt(uv - vec2(0.0, uTexel.y), baseDir) +
      riverPotentialAt(uv + vec2(0.0, uTexel.y), baseDir) -
      muC * 4.0;

    vec2 alongStep = mainDir * uTexel * 4.0;
    vec2 sideStep = sideDir * uTexel * 4.0;
    float alongMass = (riverAt(uv + alongStep).r + riverAt(uv - alongStep).r + riverAt(uv + alongStep * 2.2).r * 0.55 + riverAt(uv - alongStep * 2.2).r * 0.55) / 3.1;
    float crossMass = (riverAt(uv + sideStep).r + riverAt(uv - sideStep).r + riverAt(uv + sideStep * 2.2).r * 0.45 + riverAt(uv - sideStep * 2.2).r * 0.45) / 2.9;
    float localMass = localRiverMass(uv, baseDir);
    float continuity = max(0.0, alongMass - crossMass * 0.58) * smoothstep(0.12, 0.64, target + alongMass);
    float lateralLeak = max(0.0, crossMass - max(advected.r, alongMass) * 0.82);
    float sourceTarget = max(target, advected.r * (0.72 + continuity * 0.18));
    float widthPressure = smoothstep(0.1, 0.44, crossMass - alongMass * 0.54) * (1.0 - smoothstep(0.08, 0.62, continuity + target * 0.42));
    float massTarget = clamp(0.115 + sourceTarget * 0.052 + continuity * 0.038 - widthPressure * 0.044, 0.092, 0.19);
    float crowdDrain = clamp(localMass - massTarget + widthPressure * 0.18, 0.0, 0.54);
    float boundary = smoothstep(0.018, 0.12, abs(advected.r - localMass) + abs(target - advected.r) * 0.42);
    float mobility = (0.06 + uDripAmount * 0.016 + shear * 0.02) * (0.72 + boundary * 0.44);

    float river = advected.r + uDelta * (
      lapMu * mobility * 0.74 +
      (sourceTarget - advected.r) * (0.34 + sourceTarget * 0.22 + boundary * 0.08) +
      continuity * (0.12 + uDripAmount * 0.018) -
      lateralLeak * 0.24 -
      crowdDrain * (0.26 + smoothstep(0.5, 0.86, c.r) * 0.078) -
      widthPressure * 0.072
    );
    river = max(river, target * 0.18);
    river = clamp(river, 0.0, 0.98);

    float l = riverAt(uv - vec2(uTexel.x, 0.0)).r;
    float r = riverAt(uv + vec2(uTexel.x, 0.0)).r;
    float d = riverAt(uv - vec2(0.0, uTexel.y)).r;
    float u = riverAt(uv + vec2(0.0, uTexel.y)).r;
    float ml = riverAt(uv - vec2(uTexel.x, 0.0)).g;
    float mr = riverAt(uv + vec2(uTexel.x, 0.0)).g;
    float md = riverAt(uv - vec2(0.0, uTexel.y)).g;
    float mu = riverAt(uv + vec2(0.0, uTexel.y)).g;
    vec2 gradRiver = vec2(r - l, u - d);
    float lapRiver = l + r + u + d - advected.r * 4.0;
    float ridge = smoothstep(0.018, 0.14, length(gradRiver) * 1.7 + abs(lapRiver) * 0.76 + boundary * 0.1) *
      smoothstep(0.08, 0.76, river) *
      (1.0 - smoothstep(0.66, 0.92, localMass) * 0.58);
    float ageCenter = advected.b;
    float ageAlong = (riverAt(uv + alongStep).b + riverAt(uv - alongStep).b + riverAt(uv + alongStep * 2.2).b * 0.55 + riverAt(uv - alongStep * 2.2).b * 0.55) / 3.1;
    float ageSide = (riverAt(uv + sideStep).b + riverAt(uv - sideStep).b + riverAt(uv + sideStep * 2.2).b * 0.45 + riverAt(uv - sideStep * 2.2).b * 0.45) / 2.9;
    float ageContinuity = smoothstep(0.035, 0.42, ageAlong + alongMass * 0.22 - ageSide * 0.62 - crossMass * 0.18);
    float sheetReject = clamp(
      smoothstep(0.31, 0.6, localMass) * (1.0 - ridge * 0.56) +
      smoothstep(0.2, 0.58, crossMass - alongMass * 0.44) * 0.26 +
      smoothstep(0.72, 0.94, c.r + c.b * 0.16) * 0.2 +
      widthPressure * 0.26 -
      ageContinuity * 0.16,
      0.0,
      1.0
    );
    float lapMeniscus = ml + mr + md + mu - advected.g * 4.0;
    float displacedCore = max(0.0, localMass - river) * smoothstep(0.06, 0.62, ridge + boundary + target * 0.22);
    float meniscusEdgeGate = smoothstep(0.05, 0.56, ridge + boundary + abs(lapRiver) * 0.32 + target * 0.14);
    float sheetMeniscusReject = smoothstep(0.42, 0.76, advected.g) * (1.0 - meniscusEdgeGate);
    float sideDeposit = clamp(lateralLeak * 0.34 + crowdDrain * 0.34 + displacedCore * 0.38 + ridge * target * 0.4, 0.0, 1.0) * (0.28 + meniscusEdgeGate * 0.72);
    float meniscusTarget = clamp(ridge * (0.26 + river * 0.36) + sideDeposit * 0.58 + c.b * 0.035, 0.0, 0.9);
    float meniscusMass = advected.g + uDelta * (
      (meniscusTarget - advected.g) * (0.4 + ridge * 0.24 + uDripAmount * 0.04) +
      lapMeniscus * (0.018 + uCapillary * 0.018) -
      river * advected.g * 0.1 -
      sheetReject * advected.g * 0.12 -
      sheetMeniscusReject * 0.26
    );
    meniscusMass = clamp(meniscusMass * (1.0 - smoothstep(0.72, 0.96, river) * 0.22), 0.0, 0.96);

    vec4 sideA = riverAt(uv + sideStep);
    vec4 sideB = riverAt(uv - sideStep);
    vec4 sideA2 = riverAt(uv + sideStep * 2.2);
    vec4 sideB2 = riverAt(uv - sideStep * 2.2);
    float sideCoreMean = (sideA.r + sideB.r + sideA2.r * 0.45 + sideB2.r * 0.45) / 2.9;
    float sideMeniscusMean = (sideA.g + sideB.g + sideA2.g * 0.45 + sideB2.g * 0.45) / 2.9;
    float wallGate = smoothstep(0.035, 0.54, ridge + boundary + abs(lapRiver) * 0.35 + target * 0.16);
    float coreGate = smoothstep(0.18, 0.78, river) * (1.0 - smoothstep(0.76, 0.98, sideMeniscusMean) * 0.42);
    float sideCapacity = clamp(0.82 - sideMeniscusMean + ridge * 0.16 + target * 0.08, 0.0, 1.0);
    float coreOutflow = max(0.0, river - sideCoreMean) * coreGate * sideCapacity * (0.36 + wallGate * 0.64);
    float sideInflowToWall = max(0.0, sideCoreMean - river) *
      wallGate *
      smoothstep(0.08, 0.72, sideCoreMean + ridge * 0.42) *
      (1.0 - smoothstep(0.74, 0.96, meniscusMass));
    float pairedTransferOut = clamp(coreOutflow * (0.34 + uDripAmount * 0.04) + lateralLeak * 0.035 + crowdDrain * 0.045, 0.0, 0.18);
    float pairedTransferIn = clamp(sideInflowToWall * (0.42 + uDripAmount * 0.04) + displacedCore * 0.07 + sideDeposit * 0.035, 0.0, 0.22) * (0.34 + wallGate * 0.48);
    float sideFluxDt = uDelta * (1.9 + uDripAmount * 0.32);
    river = clamp(river - pairedTransferOut * sideFluxDt, 0.0, 0.98);
    meniscusMass = clamp(
      meniscusMass +
      pairedTransferIn * sideFluxDt +
      pairedTransferOut * wallGate * (1.0 - smoothstep(0.56, 0.88, river)) * sideFluxDt * 0.28 -
      meniscusMass * (0.012 + sheetReject * 0.026) * uDelta,
      0.0,
      0.96
    );

    float coreEvacuation = smoothstep(0.34, 0.9, meniscusMass) * smoothstep(0.48, 0.9, river) * wallGate;
    river = clamp(river - coreEvacuation * 0.045 - sheetReject * 0.024 - widthPressure * 0.01, 0.0, 0.98);
    float frontSeed = smoothstep(
      0.055,
      0.58,
      target * 0.54 + ridge * 0.28 + boundary * 0.24 + max(0.0, alongMass - crossMass * 0.54) * 0.44 + meniscusMass * 0.1
    ) * (1.0 - widthPressure * 0.54) * (1.0 - sheetReject * 0.62);
    float frontAge = clamp(
      max(
        ageCenter * (1.0 - uDelta * (0.018 + sheetReject * 0.075 + widthPressure * 0.04)),
        ageAlong * (0.76 + continuity * 0.12) + frontSeed * uDelta * (3.1 + uDripAmount * 0.32) - ageSide * 0.08
      ),
      0.0,
      0.98
    );
    frontAge = max(frontAge, ridge * 0.82);
    ridge = clamp(max(ridge, frontAge * smoothstep(0.035, 0.66, boundary + target + continuity * 0.34)), 0.0, 0.98);
    gl_FragColor = vec4(river, meniscusMass, ridge, sheetReject);
  }
`;

const RIVER_MENISCUS_FRAGMENT_SHADER = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uField;
  uniform sampler2D uVelocity;
  uniform sampler2D uPreviousRiver;
  uniform sampler2D uRegionalFlow;
  uniform vec2 uTexel;
  uniform float uDelta;
  uniform float uFlowDirection;
  uniform float uDripAmount;
  uniform float uCapillary;

  vec3 sphericalSampleUv(vec2 uv) {
    float x = uv.x;
    float y = uv.y;
    float poleCross = 0.0;
    if (y < 0.0) {
      y = -y;
      x += 0.5;
      poleCross = 1.0;
    }
    if (y > 1.0) {
      y = 2.0 - y;
      x += 0.5;
      poleCross = 1.0;
    }
    return vec3(fract(x), clamp(y, 0.002, 0.998), poleCross);
  }

  vec2 sampleUv(vec2 uv) {
    return sphericalSampleUv(uv).xy;
  }

  vec4 fieldAt(vec2 uv) {
    return texture2D(uField, sampleUv(uv));
  }

  vec2 velocityAt(vec2 uv) {
    vec3 sphereUv = sphericalSampleUv(uv);
    vec2 velocity = (texture2D(uVelocity, sphereUv.xy).rg - 0.5) * 0.5;
    return mix(velocity, -velocity, sphereUv.z);
  }

  vec4 riverAt(vec2 uv) {
    return texture2D(uPreviousRiver, sampleUv(uv));
  }

  vec4 flowAt(vec2 uv) {
    return texture2D(uRegionalFlow, sampleUv(uv));
  }

  vec2 safeNormalize(vec2 v, vec2 fallback) {
    float len = length(v);
    return len > 0.0001 ? v / len : fallback;
  }

  vec2 localTangentAt(vec2 sampleUv, vec2 fallbackDir) {
    vec4 flow = flowAt(sampleUv);
    vec2 flowTangent = safeNormalize(flow.rg * 2.0 - 1.0, fallbackDir);
    if (dot(flowTangent, fallbackDir) < 0.0) flowTangent *= -1.0;
    float occupancy = smoothstep(0.04, 0.78, flow.b);
    float speed = smoothstep(0.03, 0.82, flow.a);
    vec2 v = velocityAt(sampleUv);
    vec4 l = fieldAt(sampleUv - vec2(uTexel.x, 0.0));
    vec4 r = fieldAt(sampleUv + vec2(uTexel.x, 0.0));
    vec4 d = fieldAt(sampleUv - vec2(0.0, uTexel.y));
    vec4 u = fieldAt(sampleUv + vec2(0.0, uTexel.y));
    vec2 gradH = vec2(r.r - l.r, u.r - d.r);
    vec2 gradG = vec2(r.g - l.g, u.g - d.g);
    vec2 contourTangent = safeNormalize(vec2(-(gradH.y + gradG.y * 0.32), gradH.x + gradG.x * 0.32), fallbackDir);
    if (dot(contourTangent, fallbackDir) < -0.2) contourTangent *= -1.0;
    return safeNormalize(
      fallbackDir * 0.26 +
      flowTangent * (0.72 * occupancy + 0.18 * speed) +
      v * (3.0 + speed * 1.2) +
      contourTangent * (0.34 + occupancy * 0.18),
      fallbackDir
    );
  }

  void main() {
    vec2 uv = vUv;
    vec2 baseDir = normalize(vec2(cos(uFlowDirection), sin(uFlowDirection)));
    vec2 mainDir = localTangentAt(uv, baseDir);
    vec2 sideDir = vec2(-mainDir.y, mainDir.x);
    vec2 alongStep = mainDir * uTexel * 3.0;
    vec2 sideStep = sideDir * uTexel * 3.0;

    vec4 c = riverAt(uv);
    vec4 alongP = riverAt(uv + alongStep);
    vec4 alongM = riverAt(uv - alongStep);
    vec4 alongP2 = riverAt(uv + alongStep * 2.15);
    vec4 alongM2 = riverAt(uv - alongStep * 2.15);
    vec4 sideP = riverAt(uv + sideStep);
    vec4 sideM = riverAt(uv - sideStep);
    vec4 sideP2 = riverAt(uv + sideStep * 2.15);
    vec4 sideM2 = riverAt(uv - sideStep * 2.15);

    vec4 f = fieldAt(uv);
    vec4 fL = fieldAt(uv - vec2(uTexel.x, 0.0));
    vec4 fR = fieldAt(uv + vec2(uTexel.x, 0.0));
    vec4 fD = fieldAt(uv - vec2(0.0, uTexel.y));
    vec4 fU = fieldAt(uv + vec2(0.0, uTexel.y));
    vec2 gradH = vec2(fR.r - fL.r, fU.r - fD.r);
    vec2 gradDye = vec2(fR.a - fL.a, fU.a - fD.a);
    float lapH = fL.r + fR.r + fU.r + fD.r - f.r * 4.0;
    vec2 vL = velocityAt(uv - vec2(uTexel.x, 0.0));
    vec2 vR = velocityAt(uv + vec2(uTexel.x, 0.0));
    vec2 vD = velocityAt(uv - vec2(0.0, uTexel.y));
    vec2 vU = velocityAt(uv + vec2(0.0, uTexel.y));
    float shear = length(vR - vL) + length(vU - vD);

    float core = c.r;
    float meniscus = c.g;
    float ridge = c.b;
    float sheet = c.a;
    float alongCore = (alongP.r + alongM.r + alongP2.r * 0.54 + alongM2.r * 0.54) / 3.08;
    float sideCore = (sideP.r + sideM.r + sideP2.r * 0.48 + sideM2.r * 0.48) / 2.96;
    float alongMeniscus = (alongP.g + alongM.g + alongP2.g * 0.5 + alongM2.g * 0.5) / 3.0;
    float sideMeniscus = (sideP.g + sideM.g + sideP2.g * 0.48 + sideM2.g * 0.48) / 2.96;
    float alongRidge = (alongP.b + alongM.b + alongP2.b * 0.5 + alongM2.b * 0.5) / 3.0;
    float sideRidge = (sideP.b + sideM.b + sideP2.b * 0.48 + sideM2.b * 0.48) / 2.96;
    float previousAge = ridge;
    float ageContinuity = smoothstep(0.04, 0.48, alongRidge + alongCore * 0.18 - sideRidge * 0.58 - sideCore * 0.12);
    float lapCore = alongP.r + alongM.r + sideP.r + sideM.r - core * 4.0;
    float lapMeniscus = alongP.g + alongM.g + sideP.g + sideM.g - meniscus * 4.0;
    float lapRidge = alongP.b + alongM.b + sideP.b + sideM.b - ridge * 4.0;

    float boundaryGradient = abs(sideP.r - sideM.r) + abs(core - sideCore) * 0.9 + abs(lapCore) * 0.42;
    float edgeGate = smoothstep(0.035, 0.34, boundaryGradient + ridge * 0.34 + sideRidge * 0.22 + length(gradDye) * 0.56);
    float heightRidge = smoothstep(0.006, 0.12, length(gradH) * 1.8 + abs(lapH) * (2.2 + uCapillary * 0.9) + shear * 0.12);
    float wideSheet = smoothstep(0.08, 0.42, sideCore - alongCore * 0.58) *
      smoothstep(0.2, 0.78, sideCore + core) *
      (1.0 - edgeGate * 0.45);
    float centerInterior = smoothstep(0.34, 0.78, core) * smoothstep(0.32, 0.74, sideCore) * (1.0 - edgeGate * 0.55);

    float edgeOnlyGate = edgeGate * (1.0 - wideSheet * 0.76) * (1.0 - centerInterior * 0.52);
    float sideToEdge = max(0.0, sideCore - core * 0.62) *
      smoothstep(0.08, 0.72, sideCore + alongCore * 0.3) *
      edgeOnlyGate *
      (1.0 - smoothstep(0.58, 0.94, meniscus + sideMeniscus * 0.32));
    float coreToSides = max(0.0, core - max(alongCore * 0.72, sideCore * 0.66)) *
      smoothstep(0.24, 0.82, core) *
      (0.35 + edgeGate * 0.46 + heightRidge * 0.2) *
      (1.0 - smoothstep(0.72, 0.98, sideMeniscus));
    float sheetDrain = wideSheet * core * (0.12 + smoothstep(0.48, 0.92, sideCore) * 0.16);
    float pairedOut = clamp(coreToSides + sheetDrain, 0.0, 0.36);
    float pairedIn = clamp(sideToEdge * (0.48 + heightRidge * 0.2) + coreToSides * edgeOnlyGate * 0.11, 0.0, 0.26);
    float dtScale = uDelta * (5.9 + uDripAmount * 0.62);

    core = clamp(
      core -
      pairedOut * dtScale -
      sheet * core * uDelta * 0.045 +
      max(0.0, alongCore - core) * smoothstep(0.1, 0.72, alongCore) * uDelta * 0.18,
      0.0,
      0.98
    );

    float edgeDeposit = pairedIn * dtScale;
    float interiorMeniscus = smoothstep(0.36, 0.8, meniscus) * (1.0 - edgeGate) * smoothstep(0.24, 0.74, sideCore + core);
    meniscus = clamp(
      meniscus +
      edgeDeposit +
      lapMeniscus * (0.012 + uCapillary * 0.01) * uDelta -
      interiorMeniscus * uDelta * 0.62 -
      centerInterior * meniscus * uDelta * 0.22 -
      wideSheet * meniscus * uDelta * 0.36 -
      sheet * meniscus * uDelta * 0.28,
      0.0,
      0.96
    );

    float ridgeBirth = smoothstep(0.055, 0.58, meniscus) * edgeOnlyGate * (0.5 + heightRidge * 0.5);
    ridge = clamp(
      max(
        ridge * (1.0 - uDelta * 0.045) +
        edgeDeposit * (0.42 + heightRidge * 0.36) +
        lapRidge * (0.008 + uCapillary * 0.006) * uDelta,
        ridgeBirth * 0.86 + max(alongRidge, sideRidge) * 0.04
      ),
      0.0,
      0.98
    );
    float propagatedAge = clamp(
      max(
        previousAge * (1.0 - uDelta * (0.018 + wideSheet * 0.07 + sheet * 0.06)),
        alongRidge * (0.72 + edgeOnlyGate * 0.12) + ageContinuity * 0.08 + ridgeBirth * 0.12
      ) -
      sideRidge * wideSheet * 0.08,
      0.0,
      0.98
    );
    ridge = clamp(max(ridge, propagatedAge * (1.0 - wideSheet * 0.34)), 0.0, 0.98);

    sheet = clamp(
      max(sheet * (1.0 - uDelta * 0.1), wideSheet * 0.94 + interiorMeniscus * 0.48) -
      ridge * edgeGate * uDelta * 0.08,
      0.0,
      1.0
    );

    gl_FragColor = vec4(core, meniscus, ridge, sheet);
  }
`;

const RIVER_HEIGHT_FLUX_FRAGMENT_SHADER = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uField;
  uniform sampler2D uVelocity;
  uniform sampler2D uRiverPhase;
  uniform sampler2D uRegionalFlow;
  uniform vec2 uTexel;
  uniform float uFlowDirection;
  uniform float uDripAmount;
  uniform float uCapillary;

  vec3 sphericalSampleUv(vec2 uv) {
    float x = uv.x;
    float y = uv.y;
    float poleCross = 0.0;
    if (y < 0.0) {
      y = -y;
      x += 0.5;
      poleCross = 1.0;
    }
    if (y > 1.0) {
      y = 2.0 - y;
      x += 0.5;
      poleCross = 1.0;
    }
    return vec3(fract(x), clamp(y, 0.002, 0.998), poleCross);
  }

  vec2 sampleUv(vec2 uv) {
    return sphericalSampleUv(uv).xy;
  }

  vec4 fieldAt(vec2 uv) {
    return texture2D(uField, sampleUv(uv));
  }

  vec2 velocityAt(vec2 uv) {
    vec3 sphereUv = sphericalSampleUv(uv);
    vec2 velocity = (texture2D(uVelocity, sphereUv.xy).rg - 0.5) * 0.5;
    return mix(velocity, -velocity, sphereUv.z);
  }

  vec4 riverAt(vec2 uv) {
    return texture2D(uRiverPhase, sampleUv(uv));
  }

  vec4 flowAt(vec2 uv) {
    return texture2D(uRegionalFlow, sampleUv(uv));
  }

  vec2 safeNormalize(vec2 v, vec2 fallback) {
    float len = length(v);
    return len > 0.0001 ? v / len : fallback;
  }

  vec2 localTangentAt(vec2 sampleUv, vec2 fallbackDir) {
    vec4 flow = flowAt(sampleUv);
    vec2 flowTangent = safeNormalize(flow.rg * 2.0 - 1.0, fallbackDir);
    if (dot(flowTangent, fallbackDir) < 0.0) flowTangent *= -1.0;
    float occupancy = smoothstep(0.04, 0.78, flow.b);
    float speed = smoothstep(0.03, 0.82, flow.a);
    vec2 v = velocityAt(sampleUv);
    vec4 l = fieldAt(sampleUv - vec2(uTexel.x, 0.0));
    vec4 r = fieldAt(sampleUv + vec2(uTexel.x, 0.0));
    vec4 d = fieldAt(sampleUv - vec2(0.0, uTexel.y));
    vec4 u = fieldAt(sampleUv + vec2(0.0, uTexel.y));
    vec2 gradH = vec2(r.r - l.r, u.r - d.r);
    vec2 gradG = vec2(r.g - l.g, u.g - d.g);
    vec2 contourTangent = safeNormalize(vec2(-(gradH.y + gradG.y * 0.28), gradH.x + gradG.x * 0.28), fallbackDir);
    if (dot(contourTangent, fallbackDir) < -0.2) contourTangent *= -1.0;
    return safeNormalize(
      fallbackDir * 0.24 +
      flowTangent * (0.74 * occupancy + 0.16 * speed) +
      v * (2.8 + speed * 1.2) +
      contourTangent * (0.32 + occupancy * 0.16),
      fallbackDir
    );
  }

  void main() {
    vec2 uv = vUv;
    vec2 baseDir = normalize(vec2(cos(uFlowDirection), sin(uFlowDirection)));
    vec2 mainDir = localTangentAt(uv, baseDir);
    vec2 sideDir = vec2(-mainDir.y, mainDir.x);
    vec2 alongStep = mainDir * uTexel * 3.0;
    vec2 sideStep = sideDir * uTexel * 3.0;

    vec4 c = riverAt(uv);
    vec4 alongP = riverAt(uv + alongStep);
    vec4 alongM = riverAt(uv - alongStep);
    vec4 sideP = riverAt(uv + sideStep);
    vec4 sideM = riverAt(uv - sideStep);
    vec4 sideP2 = riverAt(uv + sideStep * 2.2);
    vec4 sideM2 = riverAt(uv - sideStep * 2.2);
    vec4 alongP2 = riverAt(uv + alongStep * 2.2);
    vec4 alongM2 = riverAt(uv - alongStep * 2.2);
    vec4 sidePAlongP = riverAt(uv + sideStep + alongStep);
    vec4 sidePAlongM = riverAt(uv + sideStep - alongStep);
    vec4 sideMAlongP = riverAt(uv - sideStep + alongStep);
    vec4 sideMAlongM = riverAt(uv - sideStep - alongStep);

    vec4 f = fieldAt(uv);
    vec4 fL = fieldAt(uv - vec2(uTexel.x, 0.0));
    vec4 fR = fieldAt(uv + vec2(uTexel.x, 0.0));
    vec4 fD = fieldAt(uv - vec2(0.0, uTexel.y));
    vec4 fU = fieldAt(uv + vec2(0.0, uTexel.y));
    vec2 gradH = vec2(fR.r - fL.r, fU.r - fD.r);
    vec2 gradDye = vec2(fR.a - fL.a, fU.a - fD.a);
    float lapH = fL.r + fR.r + fU.r + fD.r - f.r * 4.0;
    vec2 vL = velocityAt(uv - vec2(uTexel.x, 0.0));
    vec2 vR = velocityAt(uv + vec2(uTexel.x, 0.0));
    vec2 vD = velocityAt(uv - vec2(0.0, uTexel.y));
    vec2 vU = velocityAt(uv + vec2(0.0, uTexel.y));
    float shear = length(vR - vL) + length(vU - vD);

    float core = smoothstep(0.1, 0.72, c.r);
    float meniscus = smoothstep(0.04, 0.76, c.g);
    float ridge = smoothstep(0.035, 0.7, c.b);
    float sideCore = (sideP.r + sideM.r + sideP2.r * 0.48 + sideM2.r * 0.48) / 2.96;
    float alongCore = (alongP.r + alongM.r + alongP2.r * 0.52 + alongM2.r * 0.52) / 3.04;
    float sideMeniscus = (sideP.g + sideM.g + sideP2.g * 0.42 + sideM2.g * 0.42) / 2.84;
    float sideRidge = (sideP.b + sideM.b + sideP2.b * 0.42 + sideM2.b * 0.42) / 2.84;
    float lapCore = sideP.r + sideM.r + alongP.r + alongM.r - c.r * 4.0;
    float nearSidePeak = max(sideP.r, sideM.r);
    float farSidePeak = max(sideP2.r, sideM2.r);
    float balancedSideCore = min(sideP.r, sideM.r);
    float sideContrast = abs(sideP.r - sideM.r);
    float alongContinuity = smoothstep(0.08, 0.56, alongCore + max(alongP.r, alongM.r) * 0.45);
    float transversePeak = smoothstep(
      0.018,
      0.22,
      sideContrast * 0.7 + nearSidePeak - farSidePeak * 0.82 - c.r * 0.12
    );
    float sideSourceP = max(0.0, sideP.r - max((sidePAlongP.r + sidePAlongM.r) * 0.36, sideP2.r * 0.58));
    float sideSourceM = max(0.0, sideM.r - max((sideMAlongP.r + sideMAlongM.r) * 0.36, sideM2.r * 0.58));
    float availableSideDrain = clamp(sideSourceP + sideSourceM + nearSidePeak * 0.18, 0.0, 1.0);
    float sheetInterior = smoothstep(0.35, 0.82, balancedSideCore + c.r * 0.52) *
      (1.0 - smoothstep(0.025, 0.2, sideContrast));
    float ridgeGate = clamp(
      transversePeak *
      (0.45 + alongContinuity * 0.55) *
      (1.0 - sheetInterior * 0.88),
      0.0,
      1.0
    );

    float edge = smoothstep(
      0.026,
      0.34,
      abs(sideP.r - sideM.r) +
      abs(c.r - sideCore) * 0.92 +
      abs(lapCore) * 0.36 +
      ridge * 0.3 +
      sideRidge * 0.22 +
      length(gradDye) * 0.42
    );
    float heightEdge = smoothstep(0.006, 0.11, length(gradH) * 1.7 + abs(lapH) * (2.1 + uCapillary * 0.8) + shear * 0.1);
    float wideSheet = max(
      smoothstep(0.08, 0.42, sideCore - alongCore * 0.58) *
        smoothstep(0.22, 0.78, sideCore + c.r) *
        (1.0 - edge * 0.52),
      sheetInterior * (1.0 - transversePeak * 0.64)
    );
    float coreInterior = smoothstep(0.38, 0.8, c.r) * smoothstep(0.34, 0.78, sideCore) * (1.0 - edge * 0.52);

    float outwardCore = max(0.0, c.r - max(alongCore * 0.74, sideCore * 0.64)) *
      smoothstep(0.22, 0.82, c.r) *
      (0.45 + heightEdge * 0.25 + wideSheet * 0.18);
    float softRidgeGate = clamp(
      0.16 +
      ridgeGate * 0.74 +
      edge * 0.18 +
      sideRidge * 0.22 -
      sheetInterior * 0.58,
      0.0,
      1.0
    );
    float pairedReceiving = clamp(
      max(0.0, nearSidePeak - c.r * 0.48) * 0.68 +
      availableSideDrain * 0.46,
      0.0,
      1.0
    );
    float edgeReceiving = pairedReceiving *
      edge *
      softRidgeGate *
      smoothstep(0.035, 0.48, availableSideDrain + ridge * 0.2 + sideRidge * 0.16) *
      (1.0 - wideSheet * 0.48) *
      (1.0 - sheetInterior * 0.5) *
      (1.0 - coreInterior * 0.72) *
      (1.0 - smoothstep(0.7, 0.96, meniscus + sideMeniscus * 0.24));
    float drain = clamp(outwardCore + wideSheet * core * 0.15, 0.0, 0.92);
    float depositQuota = clamp(availableSideDrain * (0.48 + heightEdge * 0.22) + outwardCore * 0.18, 0.0, 0.92);
    float rawDeposit = edgeReceiving * (0.64 + heightEdge * 0.24 + ridge * 0.18 + sideRidge * 0.16);
    float deposit = clamp(min(rawDeposit, depositQuota), 0.0, 0.92);
    float ridgeDeposit = clamp(max(
      deposit * (0.72 + meniscus * 0.28),
      softRidgeGate * (ridge * edge * 0.42 + sideRidge * edge * 0.18)
    ), 0.0, 0.96);
    float sheet = clamp(max(max(c.a * 0.55, wideSheet), sheetInterior * (1.0 - softRidgeGate * 0.58)), 0.0, 1.0);

    gl_FragColor = vec4(drain, deposit, ridgeDeposit, sheet);
  }
`;

const PHASE_POTENTIAL_FRAGMENT_SHADER = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uField;
  uniform sampler2D uVelocity;
  uniform sampler2D uRegionalSupport;
  uniform sampler2D uRiverPhase;
  uniform sampler2D uRiverPathCost;
  uniform vec2 uTexel;
  uniform float uTime;
  uniform float uFlowDirection;
  uniform float uCapillary;

  float hash21(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise21(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
      mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 4; i += 1) {
      value += noise21(p) * amplitude;
      p = mat2(1.61, 1.14, -1.14, 1.61) * p + vec2(0.21, 0.13);
      amplitude *= 0.52;
    }
    return value;
  }

  vec3 sphericalSampleUv(vec2 uv) {
    float x = uv.x;
    float y = uv.y;
    float poleCross = 0.0;
    if (y < 0.0) {
      y = -y;
      x += 0.5;
      poleCross = 1.0;
    }
    if (y > 1.0) {
      y = 2.0 - y;
      x += 0.5;
      poleCross = 1.0;
    }
    return vec3(fract(x), clamp(y, 0.002, 0.998), poleCross);
  }

  vec2 sampleUv(vec2 uv) {
    return sphericalSampleUv(uv).xy;
  }

  vec4 fieldAt(vec2 uv) {
    return texture2D(uField, sampleUv(uv));
  }

  vec2 velocityAt(vec2 uv) {
    vec3 sphereUv = sphericalSampleUv(uv);
    vec2 velocity = (texture2D(uVelocity, sphereUv.xy).rg - 0.5) * 0.5;
    return mix(velocity, -velocity, sphereUv.z);
  }

  vec4 regionalAt(vec2 uv) {
    return texture2D(uRegionalSupport, sampleUv(uv));
  }

  vec4 riverAt(vec2 uv) {
    return texture2D(uRiverPhase, sampleUv(uv));
  }

  vec4 pathCostAt(vec2 uv) {
    return texture2D(uRiverPathCost, sampleUv(uv));
  }

  float highPhase(float dye) {
    return smoothstep(0.44, 0.66, dye);
  }

  float physicalSupportAt(vec2 sampleUv, vec2 mainDir) {
    vec4 c = fieldAt(sampleUv);
    vec4 l = fieldAt(sampleUv - vec2(uTexel.x, 0.0));
    vec4 r = fieldAt(sampleUv + vec2(uTexel.x, 0.0));
    vec4 d = fieldAt(sampleUv - vec2(0.0, uTexel.y));
    vec4 u = fieldAt(sampleUv + vec2(0.0, uTexel.y));
    vec2 gradH = vec2(r.r - l.r, u.r - d.r);
    vec2 gradG = vec2(r.g - l.g, u.g - d.g);
    vec2 gradDye = vec2(r.a - l.a, u.a - d.a);
    float lapH = l.r + r.r + u.r + d.r - c.r * 4.0;
    vec2 lV = velocityAt(sampleUv - vec2(uTexel.x, 0.0));
    vec2 rV = velocityAt(sampleUv + vec2(uTexel.x, 0.0));
    vec2 dV = velocityAt(sampleUv - vec2(0.0, uTexel.y));
    vec2 uV = velocityAt(sampleUv + vec2(0.0, uTexel.y));
    float shear = length(rV - lV) + length(uV - dV);
    float convergence = max(0.0, -((rV.x - lV.x) + (uV.y - dV.y)) * 0.5);
    float upstream = dot(sampleUv - vec2(0.5), -mainDir);
    float drainageBand = smoothstep(-0.58, 0.14, upstream) * (1.0 - smoothstep(-0.08, 0.72, upstream));
    float inlet = clamp(0.18 + drainageBand * 0.82, 0.0, 1.0);
    float heightValley = smoothstep(0.72, 0.3, c.r);
    float thickIsland = smoothstep(0.58, 0.94, c.r + smoothstep(0.04, 0.18, length(gradH)) * 0.32 + c.b * 0.12);
    float surfactantRidge = smoothstep(0.006, 0.055, length(gradG));
    float curvature = smoothstep(0.006, 0.095, abs(lapH) * (4.2 + uCapillary * 0.8) + length(gradDye) * 0.85 + shear * 0.45);
    return clamp(
      (
        heightValley * 0.36 +
        surfactantRidge * 0.3 +
        curvature * 0.22 +
        convergence * 0.34 -
        thickIsland * 0.3
      ) * inlet,
      0.0,
      1.0
    );
  }

  void main() {
    vec2 uv = vUv;
    vec4 c = fieldAt(uv);
    vec4 l = fieldAt(uv - vec2(uTexel.x, 0.0));
    vec4 r = fieldAt(uv + vec2(uTexel.x, 0.0));
    vec4 d = fieldAt(uv - vec2(0.0, uTexel.y));
    vec4 u = fieldAt(uv + vec2(0.0, uTexel.y));
    vec4 l2 = fieldAt(uv - vec2(uTexel.x * 2.0, 0.0));
    vec4 r2 = fieldAt(uv + vec2(uTexel.x * 2.0, 0.0));
    vec4 d2 = fieldAt(uv - vec2(0.0, uTexel.y * 2.0));
    vec4 u2 = fieldAt(uv + vec2(0.0, uTexel.y * 2.0));
    vec4 ul = fieldAt(uv + vec2(-uTexel.x, uTexel.y));
    vec4 ur = fieldAt(uv + vec2(uTexel.x, uTexel.y));
    vec4 dl = fieldAt(uv + vec2(-uTexel.x, -uTexel.y));
    vec4 dr = fieldAt(uv + vec2(uTexel.x, -uTexel.y));

    float phi = c.a * 2.0 - 1.0;
    float phiL = l.a * 2.0 - 1.0;
    float phiR = r.a * 2.0 - 1.0;
    float phiD = d.a * 2.0 - 1.0;
    float phiU = u.a * 2.0 - 1.0;
    float lapPhi = phiL + phiR + phiD + phiU - phi * 4.0;

    vec2 gradH = vec2(r.r - l.r, u.r - d.r);
    vec2 gradG = vec2(r.g - l.g, u.g - d.g);
    vec2 gradDye = vec2(r.a - l.a, u.a - d.a);
    float lapH = l.r + r.r + u.r + d.r - c.r * 4.0;
    vec2 lV = velocityAt(uv - vec2(uTexel.x, 0.0));
    vec2 rV = velocityAt(uv + vec2(uTexel.x, 0.0));
    vec2 dV = velocityAt(uv - vec2(0.0, uTexel.y));
    vec2 uV = velocityAt(uv + vec2(0.0, uTexel.y));
    float shear = length(rV - lV) + length(uV - dV);
    float convergence = max(0.0, -((rV.x - lV.x) + (uV.y - dV.y)) * 0.5);

    vec2 mainDir = normalize(vec2(cos(uFlowDirection), sin(uFlowDirection)));
    float upstream = dot(uv - vec2(0.5), -mainDir);
    float drainageBand = smoothstep(-0.58, 0.14, upstream) * (1.0 - smoothstep(-0.08, 0.72, upstream));
    float inlet = clamp(0.18 + drainageBand * 0.82, 0.0, 1.0);
    float heightValley = smoothstep(0.72, 0.3, c.r);
    float thickIsland = smoothstep(0.58, 0.94, c.r + smoothstep(0.04, 0.18, length(gradH)) * 0.32 + c.b * 0.12);
    float surfactantRidge = smoothstep(0.006, 0.055, length(gradG));
    float curvature = smoothstep(0.006, 0.095, abs(lapH) * (4.2 + uCapillary * 0.8) + length(gradDye) * 0.85 + shear * 0.45);
    float sourceNoise = fbm(uv * vec2(4.8, 12.5) + mainDir * uTime * 0.04 + vec2(c.g * 1.7, -c.r));
    vec2 sideDir = vec2(-mainDir.y, mainDir.x);
    float alongCoord = dot(uv - vec2(0.5), mainDir);
    float crossCoord = dot(uv - vec2(0.5), sideDir);
    float streamNoise = fbm(vec2(crossCoord * 9.0, alongCoord * 2.2) + vec2(uTime * 0.035, c.g * 1.4 - c.r * 0.7));
    float wideStreamNoise = fbm(vec2(crossCoord * 3.3 + c.g * 0.68, alongCoord * 1.28 - c.r * 0.42) + vec2(uTime * 0.022, -uTime * 0.014));
    float wideStreamBranch = fbm(vec2(crossCoord * 5.6 - c.a * 0.52, alongCoord * 2.15 + c.g * 0.36) - vec2(uTime * 0.018, uTime * 0.025));
    float wideStreamLane = smoothstep(
      0.55,
      0.8,
      wideStreamNoise * 0.64 +
      wideStreamBranch * 0.28 +
      convergence * 0.16 +
      heightValley * 0.1 -
      thickIsland * 0.18
    ) * inlet;
    vec2 streamStep = mainDir * uTexel;
    vec2 sideStep = sideDir * uTexel;
    vec2 pathAlongStep = mainDir * uTexel * 8.0;
    vec2 pathSideStep = sideDir * uTexel * 8.0;
    vec4 pathC = pathCostAt(uv);
    vec4 pathA = pathCostAt(uv + pathAlongStep);
    vec4 pathB = pathCostAt(uv - pathAlongStep);
    vec4 pathA2 = pathCostAt(uv + pathAlongStep * 2.15);
    vec4 pathB2 = pathCostAt(uv - pathAlongStep * 2.15);
    vec4 pathS1 = pathCostAt(uv + pathSideStep);
    vec4 pathS2 = pathCostAt(uv - pathSideStep);
    vec4 pathS3 = pathCostAt(uv + pathSideStep * 2.05);
    vec4 pathS4 = pathCostAt(uv - pathSideStep * 2.05);
    float pathAlong = (
      pathC.r * 1.25 +
      pathA.r + pathB.r +
      pathA2.r * 0.56 + pathB2.r * 0.56 +
      (pathA.b + pathB.b) * 0.18
    ) / 4.53;
    float pathAcross = (
      pathS1.r + pathS2.r +
      pathS3.r * 0.56 + pathS4.r * 0.56
    ) / 3.12;
    float pathRidge = smoothstep(
      0.035,
      0.34,
      pathC.b + max(0.0, pathAlong - pathAcross * 0.72) * 0.8
    );
    float pathNarrow = smoothstep(0.018, 0.28, pathAlong - pathAcross * 0.86) *
      (1.0 - smoothstep(0.36, 0.76, pathAcross));
    float pathGate = clamp(
      pathC.r * 0.42 +
      pathC.g * 0.2 +
      pathRidge * 0.48,
      0.0,
      1.0
    ) * pathNarrow * (1.0 - pathC.a * 0.75);
    float pathSheetDrain = smoothstep(0.22, 0.62, pathAcross + pathC.a * 0.4) *
      (1.0 - pathNarrow * 0.6);
    float supportCore = physicalSupportAt(uv, mainDir);
    float supportAlong = (
      supportCore * 1.15 +
      physicalSupportAt(uv + streamStep * 5.0, mainDir) +
      physicalSupportAt(uv - streamStep * 5.0, mainDir) +
      physicalSupportAt(uv + streamStep * 11.0, mainDir) * 0.72 +
      physicalSupportAt(uv - streamStep * 11.0, mainDir) * 0.72
    ) / 4.59;
    float supportAcross = (
      physicalSupportAt(uv + sideStep * 5.0, mainDir) +
      physicalSupportAt(uv - sideStep * 5.0, mainDir) +
      physicalSupportAt(uv + sideStep * 11.0, mainDir) * 0.55 +
      physicalSupportAt(uv - sideStep * 11.0, mainDir) * 0.55
    ) / 3.1;
    float channelSkeleton = smoothstep(
      0.12,
      0.46,
      supportAlong * 1.18 -
      supportAcross * 0.48 +
      convergence * 0.16 +
      surfactantRidge * 0.1 -
      thickIsland * 0.16
    );
    float streamLane = smoothstep(
      0.48,
      0.78,
      streamNoise * 0.14 +
      wideStreamLane * 0.3 +
      channelSkeleton * 0.44 +
      supportAlong * 0.36 -
      supportAcross * 0.16 +
      convergence * 0.36 +
      surfactantRidge * 0.28 +
      heightValley * 0.22 +
      curvature * 0.18 -
      thickIsland * 0.2
    ) * inlet;
    float sourceLane = smoothstep(
      0.44,
      0.76,
      sourceNoise * 0.08 +
      wideStreamLane * 0.32 +
      channelSkeleton * 0.48 +
      supportAlong * 0.34 -
      supportAcross * 0.18 +
      convergence * 0.38 +
      surfactantRidge * 0.32 +
      heightValley * 0.22 +
      curvature * 0.2 -
      thickIsland * 0.2
    ) * inlet;
    float supportRidge = smoothstep(0.0, 0.28, supportAlong - supportAcross * 0.54);
    float supportCoreLine = channelSkeleton * supportRidge;
    float supportExcessSheet = smoothstep(0.46, 0.86, supportCore + supportAlong) * (1.0 - supportRidge * 0.72);
    vec4 regional = regionalAt(uv);
    float regionalSupport = regional.r;
    float regionalMassHigh = regional.g;
    float regionalRidge = regional.b;
    float regionalSheet = regional.a;
    vec4 river = riverAt(uv);
    float riverPhase = river.r;
    float riverMeniscusMass = river.g;
    float riverRidge = river.b;
    float riverSheet = river.a;
    float riverFilament = riverRidge *
      smoothstep(0.06, 0.62, riverPhase + riverMeniscusMass * 0.2) *
      (1.0 - riverSheet * 0.65);
    float preSupport = clamp(
      sourceLane * 0.035 +
      streamLane * 0.06 +
      wideStreamLane * 0.015 +
      supportCoreLine * 0.45 +
      max(0.0, supportAlong - supportAcross * 0.72) * 0.32 +
      pathGate * 0.76 +
      regionalSupport * 0.075 +
      regionalRidge * 0.34 +
      riverFilament * 0.36 +
      riverMeniscusMass * riverRidge * 0.055 +
      channelSkeleton * 0.08 +
      surfactantRidge * 0.1 +
      curvature * 0.1 +
      convergence * 0.14 -
      supportAcross * 0.34 -
      supportExcessSheet * 0.34 -
      regionalSheet * 0.36 -
      riverSheet * 0.3 -
      smoothstep(0.24, 0.46, regionalMassHigh) * 0.2 -
      thickIsland * 0.22,
      0.0,
      1.0
    );

    float localHigh = (
      highPhase(c.a) + highPhase(l.a) + highPhase(r.a) + highPhase(u.a) + highPhase(d.a) +
      highPhase(ul.a) + highPhase(ur.a) + highPhase(dl.a) + highPhase(dr.a) +
      highPhase(l2.a) + highPhase(r2.a) + highPhase(u2.a) + highPhase(d2.a)
    ) / 13.0;
    vec2 tileA = uTexel * 6.0;
    vec2 tileB = uTexel * 13.0;
    float wideHigh = (
      highPhase(fieldAt(uv + vec2(tileA.x, 0.0)).a) +
      highPhase(fieldAt(uv - vec2(tileA.x, 0.0)).a) +
      highPhase(fieldAt(uv + vec2(0.0, tileA.y)).a) +
      highPhase(fieldAt(uv - vec2(0.0, tileA.y)).a) +
      highPhase(fieldAt(uv + tileA).a) +
      highPhase(fieldAt(uv - tileA).a) +
      highPhase(fieldAt(uv + vec2(tileA.x, -tileA.y)).a) +
      highPhase(fieldAt(uv + vec2(-tileA.x, tileA.y)).a) +
      highPhase(fieldAt(uv + vec2(tileB.x, 0.0)).a) +
      highPhase(fieldAt(uv - vec2(tileB.x, 0.0)).a) +
      highPhase(fieldAt(uv + vec2(0.0, tileB.y)).a) +
      highPhase(fieldAt(uv - vec2(0.0, tileB.y)).a)
    ) / 12.0;
    float regionalHigh = mix(mix(localHigh, wideHigh, 0.42), max(regionalMassHigh, riverFilament * 0.24 + riverMeniscusMass * riverRidge * 0.08 + riverRidge * 0.14), 0.72);
    float combinedRidge = max(regionalRidge, riverRidge);
    float broadSheetMass = clamp(
      smoothstep(0.22, 0.55, regionalHigh) * (1.0 - combinedRidge * 0.55) +
      regionalSheet * 0.45 +
      riverSheet * 0.36 +
      wideStreamLane * 0.22 +
      supportExcessSheet * 0.28 +
      pathSheetDrain * 0.34,
      0.0,
      1.0
    );
    float targetRegionalHigh = clamp(
      0.17 +
      preSupport * 0.045 +
      pathGate * 0.06 +
      supportCoreLine * 0.055 +
      combinedRidge * 0.052 +
      riverFilament * 0.052 -
      broadSheetMass * 0.062 -
      thickIsland * 0.055,
      0.105,
      0.27
    );
    float areaFeedback = clamp(regionalHigh - targetRegionalHigh, -0.24, 0.62);
    float highDeficit = max(0.0, targetRegionalHigh - regionalHigh);
    float overfill = max(0.0, regionalHigh - targetRegionalHigh);
    float sheetDrain = smoothstep(0.04, 0.4, overfill + broadSheetMass * 0.42) *
      broadSheetMass *
      (1.0 - combinedRidge * 0.65);
    float support = clamp(
      preSupport +
      highDeficit * (0.28 + combinedRidge * 0.18) -
      overfill * (0.42 + broadSheetMass * 0.24) -
      sheetDrain * 0.34,
      0.0,
      1.0
    );

    float interfaceWidth = mix(0.08, 0.24, smoothstep(0.04, 0.18, length(gradH) + length(gradG)));
    float chemical = phi * phi * phi - phi - interfaceWidth * lapPhi;
    chemical -= (support - 0.38) * (0.44 + highDeficit * 0.52) * (0.35 + combinedRidge * 0.65);
    chemical -= riverFilament * 0.2 + riverMeniscusMass * riverRidge * 0.035 + pathGate * 0.26;
    chemical += areaFeedback * 1.55;
    chemical += sheetDrain * 0.72 + broadSheetMass * 0.18 + thickIsland * 0.24 + pathSheetDrain * 0.35;
    chemical = clamp(chemical, -6.0, 6.0);

    gl_FragColor = vec4(clamp(0.5 + chemical * 0.075, 0.0, 1.0), support, regionalHigh, combinedRidge);
  }
`;

const FILAMENT_CONNECTIVITY_FRAGMENT_SHADER = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uField;
  uniform sampler2D uVelocity;
  uniform sampler2D uRegionalSupport;
  uniform sampler2D uRiverPathCost;
  uniform sampler2D uPreviousFilament;
  uniform sampler2D uHuangLocalDiagnostic;
  uniform sampler2D uHuangFrontState;
  uniform vec2 uFieldTexel;
  uniform vec2 uTileTexel;
  uniform float uFlowDirection;
  uniform float uCapillary;
  uniform float uDelta;

  const float FILAMENT_PI = 3.141592653589793;

  vec3 sphericalSampleUv(vec2 uv) {
    float x = uv.x;
    float y = uv.y;
    float poleCross = 0.0;
    if (y < 0.0) {
      y = -y;
      x += 0.5;
      poleCross = 1.0;
    }
    if (y > 1.0) {
      y = 2.0 - y;
      x += 0.5;
      poleCross = 1.0;
    }
    return vec3(fract(x), clamp(y, 0.002, 0.998), poleCross);
  }

  vec2 sampleUv(vec2 uv) {
    return sphericalSampleUv(uv).xy;
  }

  vec4 fieldAt(vec2 uv) {
    return texture2D(uField, sampleUv(uv));
  }

  vec2 velocityAt(vec2 uv) {
    vec3 sphereUv = sphericalSampleUv(uv);
    vec2 velocity = (texture2D(uVelocity, sphereUv.xy).rg - 0.5) * 0.5;
    return mix(velocity, -velocity, sphereUv.z);
  }

  vec4 regionalAt(vec2 uv) {
    return texture2D(uRegionalSupport, sampleUv(uv));
  }

  vec4 pathCostAt(vec2 uv) {
    return texture2D(uRiverPathCost, sampleUv(uv));
  }

  vec4 previousFilamentAt(vec2 uv) {
    return texture2D(uPreviousFilament, sampleUv(uv));
  }

  vec4 huangAt(vec2 uv) {
    return texture2D(uHuangLocalDiagnostic, sampleUv(uv));
  }

  vec4 huangFrontAt(vec2 uv) {
    return texture2D(uHuangFrontState, sampleUv(uv));
  }

  float sphereSinAt(vec2 uv) {
    return max(0.22, sin(sampleUv(uv).y * FILAMENT_PI));
  }

  float phiDerivativeScale() {
    return min(4.5, 1.0 / max(0.0001, 4.0 * FILAMENT_PI * uFieldTexel.x));
  }

  float thetaDerivativeScale() {
    return min(4.5, 1.0 / max(0.0001, 2.0 * FILAMENT_PI * uFieldTexel.y));
  }

  vec2 sphericalGradient(float leftValue, float rightValue, float downValue, float upValue, vec2 uv) {
    float sinTheta = sphereSinAt(uv);
    return vec2(
      (rightValue - leftValue) * 0.5 * phiDerivativeScale() / sinTheta,
      (upValue - downValue) * 0.5 * thetaDerivativeScale()
    );
  }

  float sphericalLaplacian(float centerValue, float leftValue, float rightValue, float downValue, float upValue, vec2 uv) {
    float sinC = sphereSinAt(uv);
    float sinD = sphereSinAt(uv - vec2(0.0, uFieldTexel.y));
    float sinU = sphereSinAt(uv + vec2(0.0, uFieldTexel.y));
    float phiScale = phiDerivativeScale();
    float thetaScale = thetaDerivativeScale();
    float phiCurvature = (leftValue + rightValue - centerValue * 2.0) * phiScale * phiScale / (sinC * sinC);
    float thetaCurvature = (sinU * (upValue - centerValue) - sinD * (centerValue - downValue)) * thetaScale * thetaScale / sinC;
    return phiCurvature + thetaCurvature;
  }

  float sphericalVelocityDivergence(vec2 uv, vec2 leftV, vec2 rightV, vec2 downV, vec2 upV) {
    float sinC = sphereSinAt(uv);
    float sinD = sphereSinAt(uv - vec2(0.0, uFieldTexel.y));
    float sinU = sphereSinAt(uv + vec2(0.0, uFieldTexel.y));
    float phiDiv = (rightV.x - leftV.x) * phiDerivativeScale() / sinC;
    float thetaDiv = (sinU * upV.y - sinD * downV.y) * thetaDerivativeScale() / sinC;
    return phiDiv + thetaDiv;
  }

  float localEvidenceAt(vec2 uv, vec2 tangent, vec2 normalDir) {
    vec4 c = fieldAt(uv);
    vec4 l = fieldAt(uv - vec2(uFieldTexel.x, 0.0));
    vec4 r = fieldAt(uv + vec2(uFieldTexel.x, 0.0));
    vec4 d = fieldAt(uv - vec2(0.0, uFieldTexel.y));
    vec4 u = fieldAt(uv + vec2(0.0, uFieldTexel.y));
    vec2 gradH = sphericalGradient(l.r, r.r, d.r, u.r, uv);
    vec2 gradG = sphericalGradient(l.g, r.g, d.g, u.g, uv);
    vec2 gradDye = sphericalGradient(l.a, r.a, d.a, u.a, uv);
    float lapH = sphericalLaplacian(c.r, l.r, r.r, d.r, u.r, uv);
    float lapG = sphericalLaplacian(c.g, l.g, r.g, d.g, u.g, uv);
    float lapDye = sphericalLaplacian(c.a, l.a, r.a, d.a, u.a, uv);
    vec2 vL = velocityAt(uv - vec2(uFieldTexel.x, 0.0));
    vec2 vR = velocityAt(uv + vec2(uFieldTexel.x, 0.0));
    vec2 vD = velocityAt(uv - vec2(0.0, uFieldTexel.y));
    vec2 vU = velocityAt(uv + vec2(0.0, uFieldTexel.y));
    float convergence = max(0.0, -sphericalVelocityDivergence(uv, vL, vR, vD, vU));
    float shear = length(vR - vL) + length(vU - vD);
    float across = abs(dot(gradH, normalDir)) * 1.35 + abs(dot(gradG, normalDir)) * 1.05 + abs(dot(gradDye, normalDir)) * 0.82;
    float along = abs(dot(gradH, tangent)) * 0.68 + abs(dot(gradG, tangent)) * 0.5 + abs(dot(gradDye, tangent)) * 0.44;
    float curvature = smoothstep(0.006, 0.13, abs(lapH) * (3.0 + uCapillary * 0.65) + abs(lapG) * 1.25 + abs(lapDye) * 0.72);
    float ridge = smoothstep(0.002, 0.08, across - along * 0.52);
    float boundary = smoothstep(0.01, 0.18, length(gradDye) * 1.8 + length(gradH) * 1.3 + length(gradG) * 0.82);
    float thinValley = smoothstep(0.82, 0.36, c.r);
    float eta = max(c.r, 0.035);
    float gammaAcross = abs(dot(gradG, normalDir)) / eta;
    float gammaAlong = abs(dot(gradG, tangent)) / eta;
    float etaAcross = abs(dot(gradH, normalDir));
    float etaAlong = abs(dot(gradH, tangent));
    float marangoniLine = smoothstep(
      0.006,
      0.11,
      gammaAcross - gammaAlong * 0.36 + abs(lapG) * 0.06 + convergence * 0.08
    ) *
      smoothstep(0.004, 0.1, etaAcross - etaAlong * 0.28 + abs(lapH) * 0.05) *
      (0.35 + thinValley * 0.25 + boundary * 0.25 + curvature * 0.15) *
      (1.0 - smoothstep(0.62, 0.92, c.r));
    return clamp(
      curvature * ridge * (0.48 + boundary * 0.32 + thinValley * 0.2) +
      marangoniLine * 0.55 +
      convergence * 5.8 +
      shear * 0.16 +
      boundary * smoothstep(0.35, 0.78, c.a) * 0.18,
      0.0,
      1.0
    );
  }

  void main() {
    vec2 uv = vUv;
    vec2 mainDir = normalize(vec2(cos(uFlowDirection), sin(uFlowDirection)));
    vec2 localVelocity = velocityAt(uv);
    vec2 tangent = normalize(mainDir * 0.72 + localVelocity * 2.8 + vec2(0.001, -0.002));
    if (dot(tangent, mainDir) < 0.0) tangent *= -1.0;
    vec2 normalDir = vec2(-tangent.y, tangent.x);

    float c0 = localEvidenceAt(uv, tangent, normalDir);
    float a1 = localEvidenceAt(uv + tangent * uTileTexel * 2.0, tangent, normalDir);
    float a2 = localEvidenceAt(uv - tangent * uTileTexel * 2.0, tangent, normalDir);
    float a3 = localEvidenceAt(uv + tangent * uTileTexel * 5.0, tangent, normalDir);
    float a4 = localEvidenceAt(uv - tangent * uTileTexel * 5.0, tangent, normalDir);
    float s1 = localEvidenceAt(uv + normalDir * uTileTexel * 2.0, tangent, normalDir);
    float s2 = localEvidenceAt(uv - normalDir * uTileTexel * 2.0, tangent, normalDir);
    float s3 = localEvidenceAt(uv + normalDir * uTileTexel * 5.0, tangent, normalDir);
    float s4 = localEvidenceAt(uv - normalDir * uTileTexel * 5.0, tangent, normalDir);

    vec4 path = pathCostAt(uv);
    vec4 regional = regionalAt(uv);
    vec4 f = fieldAt(uv);
    float alongEvidence = (c0 * 1.3 + a1 + a2 + a3 * 0.52 + a4 * 0.52) / 4.34;
    float acrossEvidence = (s1 + s2 + s3 * 0.58 + s4 * 0.58) / 3.16;
    float lineNms = smoothstep(0.02, 0.24, alongEvidence - acrossEvidence * 0.78);
    float localContinuity = smoothstep(0.045, 0.42, min(a1, a2) * 0.8 + min(a3, a4) * 0.2 + c0 * 0.12);
    float broadSheetEvidence = acrossEvidence * 0.86 + path.a * 0.46 + regional.a * 0.32 + f.b * 0.22;
    float broadSheet = smoothstep(0.34, 0.82, broadSheetEvidence) *
      (1.0 - lineNms * 0.58) *
      (1.0 - localContinuity * 0.22);
    vec4 hC = huangAt(uv);
    vec4 hA = huangAt(uv + tangent * uTileTexel * 2.0);
    vec4 hB = huangAt(uv - tangent * uTileTexel * 2.0);
    vec4 hA2 = huangAt(uv + tangent * uTileTexel * 5.0);
    vec4 hB2 = huangAt(uv - tangent * uTileTexel * 5.0);
    vec4 hS1 = huangAt(uv + normalDir * uTileTexel * 2.0);
    vec4 hS2 = huangAt(uv - normalDir * uTileTexel * 2.0);
    vec4 hS3 = huangAt(uv + normalDir * uTileTexel * 5.0);
    vec4 hS4 = huangAt(uv - normalDir * uTileTexel * 5.0);
    float hLineC = clamp(hC.a * 0.64 + hC.b * hC.r * 0.24 + hC.g * hC.b * 0.12, 0.0, 1.0);
    float hAlong = (
      hLineC * 1.2 +
      hA.a + hB.a +
      max(hA.r * hA.b, hB.r * hB.b) * 0.32 +
      hA2.a * 0.54 + hB2.a * 0.54
    ) / 3.92;
    float hAcross = (
      hS1.a + hS2.a +
      max(hS1.b * hS1.r, hS2.b * hS2.r) * 0.22 +
      hS3.a * 0.58 + hS4.a * 0.58
    ) / 3.38;
    float hContinuity = smoothstep(
      0.012,
      0.34,
      min(hA.a, hB.a) * 0.7 +
      min(hA2.a, hB2.a) * 0.25 +
      hLineC * 0.22 -
      max(hS1.a, hS2.a) * 0.28
    );
    float hNms = smoothstep(
      0.008,
      0.26,
      hLineC +
      min(hA.a, hB.a) * 0.36 +
      min(hA2.a, hB2.a) * 0.16 -
      hAcross * 0.86
    );
    float hSideReject = smoothstep(0.18, 0.62, hAcross - hAlong * 0.58 + broadSheet * 0.18);
    vec4 hfC = huangFrontAt(uv);
    vec4 hfA = huangFrontAt(uv + tangent * uTileTexel * 2.0);
    vec4 hfB = huangFrontAt(uv - tangent * uTileTexel * 2.0);
    vec4 hfA2 = huangFrontAt(uv + tangent * uTileTexel * 5.0);
    vec4 hfB2 = huangFrontAt(uv - tangent * uTileTexel * 5.0);
    vec4 hfS1 = huangFrontAt(uv + normalDir * uTileTexel * 2.0);
    vec4 hfS2 = huangFrontAt(uv - normalDir * uTileTexel * 2.0);
    vec4 hfS3 = huangFrontAt(uv + normalDir * uTileTexel * 5.0);
    vec4 hfS4 = huangFrontAt(uv - normalDir * uTileTexel * 5.0);
    float hfAlong = max(
      max(max(hfA.g, hfB.g), max(hfA2.g, hfB2.g) * 0.78),
      max(hfA.b, hfB.b) * 0.72
    );
    float hfSide = max(max(hfS1.g, hfS2.g), max(hfS3.g, hfS4.g) * 0.78);
    float hfOccupancyGate = smoothstep(0.08, 0.5, hfC.g);
    float hfSideReject = smoothstep(0.2, 0.68, hfC.a + hfSide * 0.36 + broadSheet * 0.18);
    float hfDistanceLine = smoothstep(0.54, 0.11, hfC.r) * hfOccupancyGate * (1.0 - hfSideReject);
    float hfNarrowGate = hfOccupancyGate *
      (1.0 - hfSideReject) *
      smoothstep(0.02, 0.45, hfC.g + hfDistanceLine + hfAlong * 0.18 - hfSide * 0.4);
    float hfContinuity = smoothstep(
      0.04,
      0.52,
      hfC.g * 0.7 +
      hfC.b * 0.38 +
      hfAlong * 0.45 +
      hfDistanceLine * 0.24 -
      hfSide * 0.58 -
      hfC.a * 0.5 -
      hfSideReject * 0.38
    );
    float hfTransport = clamp(
      hfC.g * (0.5 + hfContinuity * 0.35) +
      hfC.b * 0.34 +
      hfDistanceLine * 0.16 +
      hfAlong * 0.18 -
      hfSide * 0.28 -
      hfC.a * 0.34,
      0.0,
      1.0
    ) * hfNarrowGate * (1.0 - hfSideReject * 0.78);
    float huangDiagnosticTransport = clamp(
      hNms * hContinuity * (0.52 + hLineC * 0.48) +
      hLineC * (0.24 + hContinuity * 0.2) +
      max(hA.r * hA.b, hB.r * hB.b) * 0.12 +
      hfTransport * 0.22,
      0.0,
      1.0
    ) * (1.0 - hSideReject * 0.56) * (1.0 - hfC.a * 0.5) * (1.0 - hfSideReject * 0.72) * (1.0 - broadSheet * 0.42);
    float huangLineNms = smoothstep(
      0.018,
      0.3,
      c0 + min(a1, a2) * 0.55 + min(a3, a4) * 0.25 -
      max(max(s1, s2), max(s3, s4) * 0.72) * 0.82
    );
    float huangCompressionSeed = clamp(
      c0 *
      huangLineNms *
      (0.42 + lineNms * 0.28 + localContinuity * 0.3) *
      (1.0 - broadSheet * 0.56) +
      huangDiagnosticTransport * (0.38 + lineNms * 0.2 + localContinuity * 0.16) +
      hfTransport * hfContinuity * 0.24,
      0.0,
      1.0
    );
    float localRaw = clamp(
      alongEvidence * lineNms * localContinuity +
      huangCompressionSeed * 0.46 +
      huangDiagnosticTransport * 0.34 +
      hfTransport * 0.22 +
      path.r * 0.1 +
      path.b * 0.08 +
      regional.b * 0.06,
      0.0,
      1.0
    ) * (1.0 - broadSheet * 0.88);
    float seedEvidence = c0 *
      smoothstep(0.012, 0.18, alongEvidence - acrossEvidence * 0.52 + path.b * 0.08) *
      smoothstep(0.025, 0.34, c0 + path.r * 0.18 + regional.b * 0.12) *
      (1.0 - broadSheet * 0.48);
    seedEvidence = max(seedEvidence, max(huangDiagnosticTransport * hContinuity * 0.56, hfTransport * hfContinuity * 0.42));
    localRaw = max(localRaw, max(seedEvidence * 0.42, huangCompressionSeed * 0.54));

    vec2 advectDir = normalize(tangent * 0.82 + localVelocity * 1.5 + vec2(0.001, -0.001));
    if (dot(advectDir, mainDir) < 0.0) advectDir *= -1.0;
    float historyStep = 1.0 + clamp(length(localVelocity) * 18.0 + uDelta * 80.0, 0.0, 5.0);
    vec4 prevC = previousFilamentAt(uv);
    vec4 prevBack = previousFilamentAt(uv - advectDir * uTileTexel * historyStep);
    vec4 prevFront = previousFilamentAt(uv + advectDir * uTileTexel * 1.5);
    vec4 prevAlongA = previousFilamentAt(uv + tangent * uTileTexel * 2.0);
    vec4 prevAlongB = previousFilamentAt(uv - tangent * uTileTexel * 2.0);
    vec4 prevAlongWideA = previousFilamentAt(uv + tangent * uTileTexel * 4.0);
    vec4 prevAlongWideB = previousFilamentAt(uv - tangent * uTileTexel * 4.0);
    vec4 prevSideA = previousFilamentAt(uv + normalDir * uTileTexel * 1.5);
    vec4 prevSideB = previousFilamentAt(uv - normalDir * uTileTexel * 1.5);
    vec4 prevSideWideA = previousFilamentAt(uv + normalDir * uTileTexel * 4.0);
    vec4 prevSideWideB = previousFilamentAt(uv - normalDir * uTileTexel * 4.0);
    vec2 branchDirA = normalize(tangent * 0.78 + normalDir * 0.62);
    vec2 branchDirB = normalize(tangent * 0.78 - normalDir * 0.62);
    vec4 prevBranchA = previousFilamentAt(uv + branchDirA * uTileTexel * 3.0);
    vec4 prevBranchB = previousFilamentAt(uv - branchDirA * uTileTexel * 3.0);
    vec4 prevBranchC = previousFilamentAt(uv + branchDirB * uTileTexel * 3.0);
    vec4 prevBranchD = previousFilamentAt(uv - branchDirB * uTileTexel * 3.0);
    float prevAlong = max(
      max(max(prevBack.r, prevFront.r), max(prevAlongA.r, prevAlongB.r) * 0.94),
      max(prevAlongWideA.r, prevAlongWideB.r) * 0.78
    );
    float prevAcross = max(max(prevSideA.r, prevSideB.r), max(prevSideWideA.r, prevSideWideB.r) * 0.84);
    float prevBranch = max(max(prevBranchA.r, prevBranchB.r), max(prevBranchC.r, prevBranchD.r));
    float prevBranchAge = max(max(prevBranchA.g, prevBranchB.g), max(prevBranchC.g, prevBranchD.g));
    float widthCore = smoothstep(
      0.018,
      0.34,
      max(prevAlong, prevBranch * 0.86) +
      localRaw * 0.64 +
      huangCompressionSeed * 0.42 +
      huangDiagnosticTransport * 0.2 +
      hfTransport * 0.16 +
      lineNms * 0.08 -
      prevAcross * 0.78 -
      broadSheet * 0.32
    );
    float geodesicContinuity = clamp(
      smoothstep(0.06, 0.48, max(prevAlong, prevBranch * 0.9) + seedEvidence * 0.42 + huangCompressionSeed * 0.28 + hfTransport * 0.16 + c0 * 0.08 - prevAcross * 0.52 - hfSide * 0.2 - hfSideReject * 0.22) *
      (0.42 + lineNms * 0.46 + localContinuity * 0.18 + huangDiagnosticTransport * 0.13 + hfContinuity * 0.18) *
      (1.0 - broadSheet * 0.48),
      0.0,
      1.0
    );
    float widthPenalty = smoothstep(0.18, 0.62, prevAcross - prevAlong * 0.7 + acrossEvidence * 0.22);
    widthPenalty = clamp(
      max(
        widthPenalty,
        smoothstep(0.18, 0.64, prevAcross - max(prevAlong, prevBranch * 0.78) * 0.64 + broadSheet * 0.3 + (1.0 - lineNms) * 0.05)
      ) -
      widthCore * 0.22,
      0.0,
      1.0
    );
    float narrowHistoryGate = clamp(
      lineNms * 0.48 +
      localContinuity * 0.2 +
      geodesicContinuity * 0.28 +
      widthCore * 0.18 -
      widthPenalty * 0.34 -
      broadSheet * 0.28 -
      smoothstep(0.12, 0.46, prevAcross - max(prevAlong, prevBranch * 0.82) * 0.66) * 0.24,
      0.0,
      1.0
    );
    float previousCenterLine = prevC.r * 0.56 * narrowHistoryGate;
    float frontPropagation = max(max(prevAlong * 0.91, prevBranch * 0.84), previousCenterLine) *
      (0.24 + localContinuity * 0.18 + lineNms * 0.22 + geodesicContinuity * 0.24 + widthCore * 0.14 + narrowHistoryGate * 0.28) -
      broadSheet * 0.18 -
      widthPenalty * 0.26;
    float rawFilament = max(localRaw * (0.62 + widthCore * 0.38), frontPropagation);
    float prevAlongAge = max(
      max(max(prevBack.g, prevFront.g * 0.92), max(prevAlongA.g, prevAlongB.g)),
      max(prevAlongWideA.g, prevAlongWideB.g) * 0.82
    );
    float sideAge = max(max(prevSideA.g, prevSideB.g), max(prevSideWideA.g, prevSideWideB.g) * 0.78);
    float ageSeed = max(max(localRaw * 0.3, seedEvidence * 0.46), max(huangCompressionSeed * 0.38, max(huangDiagnosticTransport * 0.44, hfTransport * 0.34)));
    float ageAdvance = rawFilament * (0.045 + localContinuity * 0.06 + lineNms * 0.045 + geodesicContinuity * 0.075);
    float previousCenterAge = prevC.g * 0.68 * narrowHistoryGate;
    float ageLineGate = clamp(
      lineNms * 0.5 +
      geodesicContinuity * 0.34 +
      widthCore * 0.2 +
      hfContinuity * 0.16 +
      localRaw * 0.22 -
      broadSheet * 0.44 -
      widthPenalty * 0.4 -
      sideAge * 0.28 -
      hfSide * 0.22 -
      hfSideReject * 0.22 -
      smoothstep(0.08, 0.42, prevAcross - max(prevAlong, prevBranch * 0.8) * 0.62) * 0.22,
      0.0,
      1.0
    );
    float transportedAge = max(
      max(previousCenterAge, prevAlongAge * 0.72),
      prevBranchAge * 0.52
    ) * ageLineGate;
    float frontAge = clamp(
      max(ageSeed, transportedAge + ageAdvance) *
      (0.34 + ageLineGate * 0.66) *
      (0.58 + rawFilament * 0.42) -
      broadSheet * 0.16 -
      widthPenalty * 0.18 -
      sideAge * (0.08 + widthPenalty * 0.16),
      0.0,
      1.0
    );
    float ageGate = smoothstep(0.08, 0.58, frontAge) *
      (1.0 - broadSheet * 0.44) *
      (1.0 - widthPenalty * 0.42) *
      (0.52 + geodesicContinuity * 0.28 + ageLineGate * 0.2) *
      (0.7 + widthCore * 0.3);
    rawFilament = max(
      rawFilament * (0.72 + narrowHistoryGate * 0.28),
      ageGate * max(max(prevAlong * 0.84, prevBranch * 0.66), localRaw) * (0.28 + lineNms * 0.26 + widthCore * 0.22 + ageLineGate * 0.16)
    );
    rawFilament = clamp(
      rawFilament *
      (1.0 - broadSheet * 0.5 - widthPenalty * 0.42 - sideAge * 0.1) *
      (0.58 + geodesicContinuity * 0.42),
      0.0,
      1.0
    );
    frontAge = clamp(
      max(frontAge, rawFilament * (0.14 + lineNms * 0.16 + geodesicContinuity * 0.12 + narrowHistoryGate * 0.08 + ageLineGate * 0.1)) *
      (0.42 + ageLineGate * 0.58) -
      broadSheet * 0.08 -
      widthPenalty * 0.07 -
      sideAge * 0.04,
      0.0,
      1.0
    );
    float dropletEdge = smoothstep(0.035, 0.38, rawFilament + c0 * 0.42 + huangCompressionSeed * 0.36 + path.b * 0.18) *
      smoothstep(0.012, 0.2, acrossEvidence + abs(f.a - 0.5) * 0.08) *
      (1.0 - broadSheet * 0.62) *
      (0.55 + widthCore * 0.25 + widthPenalty * 0.12 + max(prevSideA.r, prevSideB.r) * 0.08) *
      (0.72 + ageGate * 0.28);
    float widthSheetReject = clamp(
      max(
        max(broadSheet * 0.72, widthPenalty * 0.64 + sideAge * 0.24),
        smoothstep(0.08, 0.48, prevAcross - max(prevAlong, prevBranch * 0.8) * 0.52)
      ) -
      widthCore * 0.08,
      0.0,
      0.94
    );

    gl_FragColor = vec4(
      clamp(rawFilament, 0.0, 1.0),
      clamp(frontAge, 0.0, 1.0),
      clamp(dropletEdge, 0.0, 1.0),
      clamp(widthSheetReject, 0.0, 1.0)
    );
  }
`;

const FILAMENT_CONNECTIVITY_DIAGNOSTIC_FRAGMENT_SHADER = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uFilamentConnectivity;

  void main() {
    gl_FragColor = clamp(texture2D(uFilamentConnectivity, vUv), 0.0, 1.0);
  }
`;

const PHASE_AREA_FRAGMENT_SHADER = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uField;
  uniform sampler2D uVelocity;
  uniform sampler2D uRegionalSupport;
  uniform sampler2D uRiverPhase;
  uniform sampler2D uRiverPathCost;
  uniform sampler2D uFilamentConnectivity;
  uniform sampler2D uHuangFrontState;
  uniform sampler2D uEtaGammaVelocity;
  uniform sampler2D uGammaCandidate;
  uniform vec2 uFieldTexel;
  uniform vec2 uTileTexel;
  uniform float uFlowDirection;
  uniform float uCapillary;
  uniform float uAreaDiagnosticMode;

  const float PHASE_AREA_PI = 3.141592653589793;

  vec3 sphericalSampleUv(vec2 uv) {
    float x = uv.x;
    float y = uv.y;
    float poleCross = 0.0;
    if (y < 0.0) {
      y = -y;
      x += 0.5;
      poleCross = 1.0;
    }
    if (y > 1.0) {
      y = 2.0 - y;
      x += 0.5;
      poleCross = 1.0;
    }
    return vec3(fract(x), clamp(y, 0.002, 0.998), poleCross);
  }

  vec2 sampleUv(vec2 uv) {
    return sphericalSampleUv(uv).xy;
  }

  vec4 fieldAt(vec2 uv) {
    return texture2D(uField, sampleUv(uv));
  }

  vec2 velocityAt(vec2 uv) {
    vec3 sphereUv = sphericalSampleUv(uv);
    vec2 velocity = (texture2D(uVelocity, sphereUv.xy).rg - 0.5) * 0.5;
    return mix(velocity, -velocity, sphereUv.z);
  }

  vec4 regionalAt(vec2 uv) {
    return texture2D(uRegionalSupport, sampleUv(uv));
  }

  vec4 riverAt(vec2 uv) {
    return texture2D(uRiverPhase, sampleUv(uv));
  }

  vec4 pathCostAt(vec2 uv) {
    return texture2D(uRiverPathCost, sampleUv(uv));
  }

  vec4 filamentAt(vec2 uv) {
    return texture2D(uFilamentConnectivity, sampleUv(uv));
  }

  vec4 huangFrontAt(vec2 uv) {
    return texture2D(uHuangFrontState, sampleUv(uv));
  }

  vec4 etaGammaVelocityAt(vec2 uv) {
    return texture2D(uEtaGammaVelocity, sampleUv(uv));
  }

  vec4 gammaCandidateAt(vec2 uv) {
    return texture2D(uGammaCandidate, sampleUv(uv));
  }

  float highPhase(float dye) {
    return smoothstep(0.44, 0.66, dye);
  }

  float sphereSinAt(vec2 uv) {
    return max(0.22, sin(sampleUv(uv).y * PHASE_AREA_PI));
  }

  float phasePhiDerivativeScale() {
    return min(2.45, 1.0 / max(uFieldTexel.x, 0.001));
  }

  float phaseThetaDerivativeScale() {
    return min(2.45, 1.0 / max(uFieldTexel.y, 0.001));
  }

  vec2 sphericalGradient(float leftValue, float rightValue, float downValue, float upValue, vec2 uv) {
    float sinTheta = sphereSinAt(uv);
    return vec2(
      (rightValue - leftValue) * 0.5 * phasePhiDerivativeScale() / sinTheta,
      (upValue - downValue) * 0.5 * phaseThetaDerivativeScale()
    );
  }

  float sphericalVelocityDivergence(vec2 uv, vec2 leftV, vec2 rightV, vec2 downV, vec2 upV) {
    float sinC = sphereSinAt(uv);
    float sinD = sphereSinAt(uv - vec2(0.0, uFieldTexel.y));
    float sinU = sphereSinAt(uv + vec2(0.0, uFieldTexel.y));
    float phiDiv = (rightV.x - leftV.x) * 0.5 * phasePhiDerivativeScale() / sinC;
    float thetaDiv = (sinU * upV.y - sinD * downV.y) * 0.5 * phaseThetaDerivativeScale() / sinC;
    return phiDiv + thetaDiv;
  }

  void main() {
    vec2 uv = vUv;
    vec4 c = fieldAt(uv);
    vec4 l = fieldAt(uv - vec2(uFieldTexel.x, 0.0));
    vec4 r = fieldAt(uv + vec2(uFieldTexel.x, 0.0));
    vec4 d = fieldAt(uv - vec2(0.0, uFieldTexel.y));
    vec4 u = fieldAt(uv + vec2(0.0, uFieldTexel.y));
    vec2 gradH = sphericalGradient(l.r, r.r, d.r, u.r, uv);
    vec2 gradDye = sphericalGradient(l.a, r.a, d.a, u.a, uv);
    vec2 gradG = sphericalGradient(l.g, r.g, d.g, u.g, uv);
    float lapH = l.r + r.r + u.r + d.r - c.r * 4.0;
    float lapDye = l.a + r.a + u.a + d.a - c.a * 4.0;
    float lapG = l.g + r.g + u.g + d.g - c.g * 4.0;
    vec2 globalFlowDir = normalize(vec2(cos(uFlowDirection), sin(uFlowDirection)));
    vec2 localAreaVelocity = velocityAt(uv);
    vec2 gammaTangent = normalize(vec2(-gradG.y, gradG.x) + vec2(0.001, -0.001));
    vec2 mainDir = normalize(
      globalFlowDir * 0.24 +
      localAreaVelocity * 3.1 +
      gammaTangent * (0.42 + smoothstep(0.004, 0.08, length(gradG)) * 0.58) +
      vec2(0.001, -0.001)
    );
    if (dot(mainDir, globalFlowDir) < -0.38) mainDir *= -1.0;
    vec2 sideDir = vec2(-mainDir.y, mainDir.x);
    vec2 alongStep = mainDir * uTileTexel * 2.0;
    vec2 sideStep = sideDir * uTileTexel * 2.0;
    vec2 wideAlong = mainDir * uTileTexel * 5.0;
    vec2 wideSide = sideDir * uTileTexel * 5.0;

    vec4 pathC = pathCostAt(uv);
    vec4 pathA = pathCostAt(uv + alongStep);
    vec4 pathB = pathCostAt(uv - alongStep);
    vec4 pathA2 = pathCostAt(uv + wideAlong);
    vec4 pathB2 = pathCostAt(uv - wideAlong);
    vec4 pathS1 = pathCostAt(uv + sideStep);
    vec4 pathS2 = pathCostAt(uv - sideStep);
    vec4 pathS3 = pathCostAt(uv + wideSide);
    vec4 pathS4 = pathCostAt(uv - wideSide);
    float pathAlong = (
      pathC.r * 1.22 +
      pathA.r + pathB.r +
      pathA2.r * 0.54 + pathB2.r * 0.54 +
      (pathC.b + pathA.b + pathB.b) * 0.12
    ) / 4.54;
    float pathAcross = (
      pathS1.r + pathS2.r +
      pathS3.r * 0.58 + pathS4.r * 0.58
    ) / 3.16;
    float pathRidge = smoothstep(0.035, 0.42, pathC.b + max(0.0, pathAlong - pathAcross * 0.68));
    float narrowPath = smoothstep(0.012, 0.24, pathAlong - pathAcross * 0.78) *
      (1.0 - smoothstep(0.34, 0.74, pathAcross)) *
      (1.0 - pathC.a * 0.7);
    float closedLoopPath = smoothstep(
      0.025,
      0.42,
      pathC.r * 0.48 +
      pathC.g * 0.34 +
      pathC.b * 0.3 +
      max(0.0, pathAlong - pathAcross * 0.82) * 0.45 -
      pathC.a * 0.48 -
      pathAcross * 0.2
    );

    vec4 river = riverAt(uv);
    vec4 regional = regionalAt(uv);
    float acrossRidge = abs(dot(gradH, sideDir)) * 1.25 + abs(dot(gradDye, sideDir)) * 0.92 + abs(dot(gradG, sideDir)) * 0.85;
    float alongRidge = abs(dot(gradH, mainDir)) * 0.72 + abs(dot(gradDye, mainDir)) * 0.52 + abs(dot(gradG, mainDir)) * 0.46;
    float capillaryResidual = smoothstep(
      0.006,
      0.105,
      abs(lapH) * (2.7 + uCapillary * 0.58) +
      abs(lapG) * 1.15 +
      abs(lapDye) * 0.62 +
      length(gradH) * 0.82 +
      length(gradG) * 0.58
    );
    float capillaryFilament = capillaryResidual *
      smoothstep(0.0015, 0.052, acrossRidge - alongRidge * 0.46) *
      (1.0 - smoothstep(0.46, 0.92, pathAcross + pathC.a * 0.24 + river.a * 0.18));
    float riverFrontAge = smoothstep(0.12, 0.72, river.b);
    float riverFilament = max(
      river.b * smoothstep(0.06, 0.62, river.r + river.g * 0.2),
      riverFrontAge * smoothstep(0.04, 0.58, river.r + river.g * 0.16 + pathRidge * 0.16 + capillaryFilament * 0.12) * 0.9
    ) *
      (1.0 - river.a * 0.65);
    vec4 filament = filamentAt(uv);
    vec2 localFilamentVelocity = velocityAt(uv);
    vec2 filamentDir = normalize(mainDir * 0.62 + localFilamentVelocity * 2.6 + vec2(0.001, -0.001));
    if (dot(filamentDir, mainDir) < 0.0) filamentDir *= -1.0;
    vec2 filamentSideDir = vec2(-filamentDir.y, filamentDir.x);
    vec2 filamentAlongStep = filamentDir * uTileTexel * 2.0;
    vec2 filamentWideAlongStep = filamentDir * uTileTexel * 4.0;
    vec2 filamentSideStep = filamentSideDir * uTileTexel * 2.0;
    vec2 filamentWideSideStep = filamentSideDir * uTileTexel * 4.0;
    vec4 filamentAlongA = filamentAt(uv + filamentAlongStep);
    vec4 filamentAlongB = filamentAt(uv - filamentAlongStep);
    vec4 filamentAlongWideA = filamentAt(uv + filamentWideAlongStep);
    vec4 filamentAlongWideB = filamentAt(uv - filamentWideAlongStep);
    vec4 filamentSideA = filamentAt(uv + filamentSideStep);
    vec4 filamentSideB = filamentAt(uv - filamentSideStep);
    vec4 filamentSideWideA = filamentAt(uv + filamentWideSideStep);
    vec4 filamentSideWideB = filamentAt(uv - filamentWideSideStep);
    vec4 hfC = huangFrontAt(uv);
    vec4 hfAlongA = huangFrontAt(uv + filamentAlongStep);
    vec4 hfAlongB = huangFrontAt(uv - filamentAlongStep);
    vec4 hfAlongWideA = huangFrontAt(uv + filamentWideAlongStep);
    vec4 hfAlongWideB = huangFrontAt(uv - filamentWideAlongStep);
    vec4 hfSideA = huangFrontAt(uv + filamentSideStep);
    vec4 hfSideB = huangFrontAt(uv - filamentSideStep);
    vec4 hfSideWideA = huangFrontAt(uv + filamentWideSideStep);
    vec4 hfSideWideB = huangFrontAt(uv - filamentWideSideStep);
    float hfAlong = max(max(hfAlongA.g, hfAlongB.g), max(hfAlongWideA.g, hfAlongWideB.g) * 0.72);
    float hfSide = max(max(hfSideA.g, hfSideB.g), max(hfSideWideA.g, hfSideWideB.g) * 0.72);
    float hfDistance = smoothstep(0.52, 0.1, hfC.r);
    float hfOccupancy = smoothstep(0.03, 0.3, hfC.g + hfC.b * 0.3 + hfAlong * 0.2 - hfSide * 0.3);
    float hfSideReject = smoothstep(0.2, 0.66, hfC.a * 0.8 + hfSide * 0.28 - hfAlong * 0.22);
    float hfCenterRank = smoothstep(
      0.012,
      0.24,
      hfC.g +
      hfC.b * 0.22 +
      hfAlong * 0.1 -
      hfSide * 0.68 -
      hfC.a * 0.24
    );
    float hfWideReject = smoothstep(
      0.18,
      0.62,
      hfSide +
      hfC.a * 0.44 -
      hfC.g * 0.42 -
      hfAlong * 0.18
    );
    float hfNarrowLine = clamp(
      hfOccupancy *
      (0.38 + hfDistance * 0.3 + hfC.b * 0.28 + hfAlong * 0.14) *
      (1.0 - hfSideReject * 0.72),
      0.0,
      1.0
    ) * (0.26 + hfCenterRank * 0.74) * (1.0 - hfWideReject * 0.32);
    float filamentAlong = max(
      max(filamentAlongA.r, filamentAlongB.r) * 0.94,
      max(filamentAlongWideA.r, filamentAlongWideB.r) * 0.78
    );
    float filamentAcross = max(
      max(filamentSideA.r, filamentSideB.r),
      max(filamentSideWideA.r, filamentSideWideB.r) * 0.82
    );
    float ageAlong = max(
      max(filamentAlongA.g, filamentAlongB.g) * 0.94,
      max(filamentAlongWideA.g, filamentAlongWideB.g) * 0.78
    );
    float ageAcross = max(
      max(filamentSideA.g, filamentSideB.g),
      max(filamentSideWideA.g, filamentSideWideB.g) * 0.82
    );
    float rawFrontAge = smoothstep(0.16, 0.72, filament.g);
    float filamentNarrow = smoothstep(
      0.015,
      0.32,
      max(filament.r, filamentAlong * 0.86) +
      filament.b * 0.12 -
      filamentAcross * 0.72 -
      filament.a * 0.32
    );
    float frontAge = rawFrontAge *
      filamentNarrow *
      (1.0 - smoothstep(0.28, 0.78, filament.a + filamentAcross * 0.18 + ageAcross * 0.22));
    float geodesicLine = smoothstep(
      0.018,
      0.46,
      filament.r * 0.46 +
      filamentAlong * 0.34 +
      frontAge * 0.3 +
      ageAlong * 0.18 +
      filament.b * 0.12 +
      capillaryFilament * 0.18 +
      riverFrontAge * 0.12 +
      narrowPath * 0.1 -
      filamentAcross * 0.48 -
      filament.a * 0.36 -
      ageAcross * 0.12
    );
    float lineEvidence = clamp(
      geodesicLine * 0.58 +
      filamentNarrow * 0.3 +
      capillaryFilament * 0.18 +
      riverFrontAge * 0.1 +
      filament.b * 0.08,
      0.0,
      1.0
    );
    float filamentWidthPenalty = clamp(
      smoothstep(0.34, 0.86, filament.a + filamentAcross * 0.32 + ageAcross * 0.18) *
      (1.0 - smoothstep(0.24, 0.7, geodesicLine + filamentNarrow * 0.45)) +
      smoothstep(0.36, 0.86, filamentAcross - filamentAlong * 0.58) * 0.72,
      0.0,
      1.0
    );
    float frontUsable = clamp(
      frontAge * geodesicLine * (1.0 - smoothstep(0.48, 0.92, filament.a)) +
      geodesicLine * 0.22 +
      filamentNarrow * 0.12 +
      lineEvidence * 0.16 +
      riverFrontAge * filamentNarrow * 0.08,
      0.0,
      1.0
    );
    float connectedFilament = smoothstep(
      0.018,
      0.4,
      geodesicLine * 0.68 +
      filamentNarrow * 0.42 +
      frontUsable * 0.36 +
      capillaryFilament * 0.26 +
      riverFrontAge * narrowPath * 0.12
    ) * (1.0 - filamentWidthPenalty * 0.64);
    float filamentGate = clamp(
      narrowPath * 0.42 +
      pathRidge * 0.05 +
      riverFilament * 0.32 +
      riverFrontAge * 0.14 +
      capillaryFilament * 0.5 +
      connectedFilament * 0.54 +
      frontUsable * 0.3 +
      geodesicLine * 0.56 +
      filamentNarrow * 0.36,
      0.0,
      1.0
    );
    filamentGate *= 0.34 + closedLoopPath * 0.44 + geodesicLine * 0.28;
    float support = clamp(
      filamentGate +
      closedLoopPath * 0.08 +
      capillaryFilament * 0.12 +
      connectedFilament * 0.22 +
      frontUsable * 0.12 +
      riverFrontAge * 0.04 +
      regional.r * 0.035 -
      pathC.a * 0.08 -
      filamentWidthPenalty * 0.05,
      0.0,
      1.0
    );

    float highNear = (
      highPhase(c.a) +
      highPhase(l.a) + highPhase(r.a) + highPhase(u.a) + highPhase(d.a) +
      highPhase(fieldAt(uv + alongStep).a) +
      highPhase(fieldAt(uv - alongStep).a) +
      highPhase(fieldAt(uv + sideStep).a) +
      highPhase(fieldAt(uv - sideStep).a)
    ) / 9.0;
    float highWide = (
      highNear * 2.0 +
      highPhase(fieldAt(uv + wideAlong).a) +
      highPhase(fieldAt(uv - wideAlong).a) +
      highPhase(fieldAt(uv + wideSide).a) +
      highPhase(fieldAt(uv - wideSide).a) +
      highPhase(fieldAt(uv + wideAlong + sideStep).a) +
      highPhase(fieldAt(uv - wideAlong - sideStep).a)
    ) / 8.0;
    float foamWide = (
      c.b +
      fieldAt(uv + alongStep).b + fieldAt(uv - alongStep).b +
      fieldAt(uv + sideStep).b + fieldAt(uv - sideStep).b +
      fieldAt(uv + wideAlong).b + fieldAt(uv - wideAlong).b +
      fieldAt(uv + wideSide).b + fieldAt(uv - wideSide).b
    ) / 9.0;
    vec2 vL = velocityAt(uv - vec2(uFieldTexel.x, 0.0));
    vec2 vR = velocityAt(uv + vec2(uFieldTexel.x, 0.0));
    vec2 vD = velocityAt(uv - vec2(0.0, uFieldTexel.y));
    vec2 vU = velocityAt(uv + vec2(0.0, uFieldTexel.y));
    float shear = length(vR - vL) + length(vU - vD);
    float physicalDivergence = sphericalVelocityDivergence(uv, vL, vR, vD, vU);
    vec4 etaGammaVelocity = etaGammaVelocityAt(uv);
    vec4 gammaCandidate = gammaCandidateAt(uv);
    float closureDivergence = (etaGammaVelocity.a - 0.5) / 2.8;
    float candidateDivergence = (gammaCandidate.g - 0.5) / 8.0;
    float explicitDivergence = mix(closureDivergence, candidateDivergence, 0.42);
    float explicitCompression = smoothstep(0.002, 0.042, max(0.0, -explicitDivergence));
    float explicitExpansion = smoothstep(0.002, 0.052, max(0.0, explicitDivergence));
    float recomputedCompression = smoothstep(0.008, 0.07, max(0.0, -physicalDivergence));
    float gammaResidualLine = smoothstep(0.0015, 0.032, abs(gammaCandidate.b - 0.5) / 18.0);
    float gammaDeltaLine = smoothstep(0.006, 0.19, gammaCandidate.a);
    float explicitVelocityLine = smoothstep(0.04, 0.22, etaGammaVelocity.b);
    float physicalCompression = clamp(
      explicitCompression * 0.66 +
      recomputedCompression * 0.2 +
      gammaDeltaLine * 0.12,
      0.0,
      1.0
    );
    float etaValleyLine = smoothstep(0.015, 0.22, max(0.0, (l.r + r.r + d.r + u.r) * 0.25 - c.r) + length(gradH) * 0.22);
    float gammaFront = smoothstep(0.018, 0.22, length(gradG) + abs(dot(gradG, sideDir)) * 0.42);
    float acrossPhysical =
      abs(dot(gradG, sideDir)) * 0.62 +
      abs(dot(gradH, sideDir)) * 0.36 +
      abs(dot(gradDye, sideDir)) * 0.2;
    float alongPhysical =
      abs(dot(gradG, mainDir)) * 0.46 +
      abs(dot(gradH, mainDir)) * 0.28 +
      abs(dot(gradDye, mainDir)) * 0.16;
    float explicitLineEnergy = clamp(
      explicitCompression * 0.42 +
      gammaResidualLine * 0.24 +
      gammaDeltaLine * 0.22 +
      explicitVelocityLine * 0.12,
      0.0,
      1.0
    );
    float narrowPhysicalGate = smoothstep(
      0.018,
      0.22,
      acrossPhysical - alongPhysical * 0.62 + explicitLineEnergy * 0.045 - explicitExpansion * 0.04
    );
    float physicalLineEvidence = clamp(
      physicalCompression * 0.36 +
      gammaFront * 0.24 +
      etaValleyLine * 0.2 +
      explicitLineEnergy * 0.3 +
      shear * 0.045,
      0.0,
      1.0
    ) * (0.14 + narrowPhysicalGate * 0.86) * (1.0 - explicitExpansion * 0.18);
    float boundary = smoothstep(
      0.03,
      0.34,
      length(gradDye) * 0.82 +
      abs(lapDye) * 0.7 +
      abs(lapH) * (1.6 + uCapillary * 0.28) +
      length(gradH) * 0.92 +
      shear * 0.16 +
      physicalLineEvidence * 0.12
    );
    float thickIsland = smoothstep(0.58, 0.94, c.r + length(gradH) * 1.8 + c.b * 0.24);
    float skeletonEvidence = clamp(
      geodesicLine * 0.45 +
      filamentNarrow * 0.26 +
      connectedFilament * 0.26 +
      physicalLineEvidence * 0.22 +
      narrowPhysicalGate * explicitLineEnergy * 0.18 +
      hfNarrowLine * 0.34 +
      riverFilament * 0.12 +
      narrowPath * 0.1,
      0.0,
      1.0
    );
    float narrowSkeletonGate = smoothstep(
      0.08,
      0.52,
      geodesicLine * 0.68 +
      filamentNarrow * 0.48 +
      connectedFilament * 0.36 +
      frontUsable * 0.24 +
      narrowPath * 0.22 +
      capillaryFilament * 0.16 +
      physicalLineEvidence * narrowPhysicalGate * 0.2 -
      hfSideReject * 0.26 -
      hfWideReject * 0.1 -
      filamentWidthPenalty * 0.42 -
      pathAcross * 0.16
    );
    float broadSheet = smoothstep(0.34, 0.72, highWide + foamWide * 0.22 + pathAcross * 0.14 + regional.a * 0.22 + explicitExpansion * 0.12) *
      (1.0 - filamentGate * 0.58) *
      (1.0 - skeletonEvidence * 0.56) *
      (1.0 - lineEvidence * 0.28) *
      (1.0 - closedLoopPath * 0.54) *
      (1.0 - narrowPhysicalGate * explicitLineEnergy * 0.42);
    broadSheet = clamp(
      max(
        broadSheet,
        smoothstep(0.24, 0.6, highWide + foamWide * 0.2 + pathAcross * 0.12 + regional.a * 0.14) *
        (1.0 - skeletonEvidence * 0.86) *
        (1.0 - narrowPhysicalGate * 0.28) *
        0.62
      ),
      0.0,
      1.0
    );
    float huangAreaAdmission = clamp(
      hfNarrowLine * 1.02 +
      hfOccupancy * 0.12 +
      hfDistance * hfC.g * 0.14 +
      physicalLineEvidence * narrowPhysicalGate * 0.14 -
      hfSideReject * 0.3 -
      hfWideReject * 0.14 -
      broadSheet * 0.24,
      0.0,
      1.0
    );
    narrowSkeletonGate *= (1.0 - broadSheet * 0.46) * (0.26 + huangAreaAdmission * 0.74);
    float narrowPhysicalLine = physicalLineEvidence * narrowPhysicalGate * (0.34 + narrowSkeletonGate * 0.66);
    float compactLineGate = clamp(
      narrowPhysicalLine * 2.4 +
      capillaryFilament * 0.92 +
      filamentNarrow * connectedFilament * 0.88 +
      lineEvidence * filamentNarrow * 0.64 +
      huangAreaAdmission * 0.86 +
      narrowPath * 0.42 +
      closedLoopPath * 0.18 -
      hfSideReject * 0.36 -
      filamentWidthPenalty * 0.52 -
      pathAcross * 0.22 -
      broadSheet * 0.36,
      0.0,
      1.0
    );
    filamentGate *= (1.0 - broadSheet * 0.36);
    float broadAreaBrake = smoothstep(
      0.16,
      0.48,
      highWide +
      foamWide * 0.12 +
      filament.a * 0.22 +
      filamentAcross * 0.2 +
      ageAcross * 0.16 +
      explicitExpansion * 0.08 -
      compactLineGate * 0.14 -
      narrowPhysicalLine * 0.1 -
      frontUsable * 0.06 -
      huangAreaAdmission * 0.12
    );
    float areaCapacity = clamp(
      huangAreaAdmission * 0.62 +
      compactLineGate * 0.34 +
      narrowPhysicalLine * 0.26 +
      max(0.0, frontUsable - ageAcross * 0.42) * 0.18 +
      capillaryFilament * 0.12 -
      hfSideReject * 0.24 -
      hfWideReject * 0.1 -
      filamentWidthPenalty * 0.36 -
      broadSheet * 0.28 -
      broadAreaBrake * 0.28,
      0.0,
      1.0
    );
    float blockFeedbackReject = smoothstep(
      0.18,
      0.58,
      skeletonEvidence * 0.48 +
      highWide * 0.22 +
      pathAcross * 0.16 +
      filamentAcross * 0.18 +
      ageAcross * 0.14 -
      compactLineGate * 0.22 -
      huangAreaAdmission * 0.24 -
      narrowPhysicalLine * 0.18
    );
    float highResFrontGate = clamp(
      huangAreaAdmission * 0.62 +
      narrowPhysicalLine * 0.34 +
      compactLineGate * 0.22 +
      frontUsable * 0.14 -
      blockFeedbackReject * 0.36 -
      hfSideReject * 0.16 -
      hfWideReject * 0.08,
      0.0,
      1.0
    );
    float skeletonBudgetEvidence = skeletonEvidence *
      areaCapacity *
      (0.055 + compactLineGate * 0.24 + huangAreaAdmission * 0.22 + highResFrontGate * 0.36) *
      (0.08 + highResFrontGate * 0.92) *
      (1.0 - broadSheet * 0.68) *
      (1.0 - blockFeedbackReject * 0.78) *
      (1.0 - filamentWidthPenalty * 0.42);
    float areaGate = smoothstep(
      0.06,
      0.44,
      support * 0.28 +
      skeletonBudgetEvidence * 0.012 +
      lineEvidence * 0.28 +
      connectedFilament * 0.36 +
      capillaryFilament * 0.2 +
      narrowPhysicalLine * 0.34 +
      huangAreaAdmission * 0.52 +
      areaCapacity * 0.42 +
      riverFrontAge * narrowPath * 0.12 +
      narrowPath * 0.08 -
      broadSheet * 0.42 -
      hfSideReject * 0.28 -
      blockFeedbackReject * 0.32 -
      pathC.a * 0.1 -
      filamentWidthPenalty * 0.16
    );
    areaGate *= clamp(0.02 + compactLineGate * 0.42 + huangAreaAdmission * 0.5 + areaCapacity * 0.22, 0.0, 1.0);
    areaGate *= (1.0 - broadAreaBrake * (0.72 + broadSheet * 0.24 + hfSideReject * 0.14));
    areaGate *= (1.0 - blockFeedbackReject * (0.58 + broadSheet * 0.18 + filamentWidthPenalty * 0.16));

    float materialNarrowSupport = clamp(
      max(
        huangAreaAdmission,
        max(
          narrowPhysicalLine * (0.58 + areaCapacity * 0.42),
          compactLineGate * frontUsable
        )
      ),
      0.0,
      1.0
    );
    float broadMaterialReject = clamp(
      max(broadSheet, broadAreaBrake) * 0.78 +
      blockFeedbackReject * 0.44 +
      hfSideReject * 0.26 +
      filamentWidthPenalty * 0.24,
      0.0,
      1.0
    );

    float targetHigh = clamp(
      0.032 +
      areaGate * materialNarrowSupport * (
        0.1 +
        frontUsable * 0.075 +
        filamentGate * 0.1 +
        skeletonBudgetEvidence * 0.001 +
        boundary * filamentGate * 0.04 +
        narrowPath * 0.024 +
        capillaryFilament * 0.075 +
        physicalLineEvidence * 0.085 +
        connectedFilament * 0.07 +
        geodesicLine * 0.075 +
        filamentNarrow * 0.06 +
        areaCapacity * 0.08 +
        huangAreaAdmission * 0.065 +
        riverFrontAge * 0.045 +
        riverFilament * 0.02
      ) -
      broadMaterialReject * 0.13 -
      broadAreaBrake * 0.048 -
      broadSheet * 0.04 -
      filamentWidthPenalty * 0.034 -
      blockFeedbackReject * 0.045 -
      thickIsland * 0.028,
      0.024,
      0.22
    );
    targetHigh = mix(
      min(targetHigh, 0.082 + materialNarrowSupport * 0.026),
      targetHigh,
      materialNarrowSupport * (1.0 - broadMaterialReject * 0.48)
    );
    float phaseDeficit = max(0.0, targetHigh - highWide);
    float phaseExcess = max(0.0, highWide - targetHigh);
    float frontFillGate = max(
      max(
        frontUsable * (0.52 + boundary * 0.26),
        huangAreaAdmission * (0.36 + boundary * 0.24 + hfNarrowLine * 0.18)
      ) * areaGate * areaCapacity,
      max(filamentGate * 0.24 + geodesicLine * 0.18, connectedFilament * 0.28 + capillaryFilament * 0.2 + narrowPhysicalLine * 0.16) * (0.22 + boundary * 0.28) * areaCapacity
    ) * (0.42 + highResFrontGate * 0.2 + skeletonBudgetEvidence * 0.006 + areaCapacity * 0.22 + compactLineGate * 0.16) * (0.18 + compactLineGate * 0.82);
    frontFillGate *= materialNarrowSupport * (1.0 - broadAreaBrake * 0.78) * (0.18 + huangAreaAdmission * 0.66 + areaCapacity * 0.16) * (1.0 - blockFeedbackReject * 0.72) * (1.0 - broadMaterialReject * 0.62);
    float fillBudget = phaseDeficit * frontFillGate * (0.42 + highResFrontGate * 0.14 + skeletonBudgetEvidence * 0.004 + areaCapacity * 0.2) * (1.0 - broadSheet * 0.68) * (1.0 - filamentWidthPenalty * 0.48) * (1.0 - broadAreaBrake * 0.76) * (1.0 - hfSideReject * 0.34) * (1.0 - blockFeedbackReject * 0.74);
    float isolatedDrain = (1.0 - max(frontUsable, max(narrowPhysicalLine, huangAreaAdmission) * 0.72)) * smoothstep(0.14, 0.48, highWide) * 0.36;
    float sheetDrain = phaseExcess * (0.34 + broadSheet * 1.05 + foamWide * 0.2 + broadAreaBrake * 1.05 + blockFeedbackReject * 0.72 + (1.0 - max(frontUsable, max(areaCapacity, narrowPhysicalLine) * 0.64)) * 0.34 + filamentWidthPenalty * 0.32 + broadMaterialReject * 0.46) + isolatedDrain + broadAreaBrake * smoothstep(0.16, 0.5, highWide) * 0.18 + blockFeedbackReject * smoothstep(0.16, 0.5, highWide) * 0.12;
    float targetFoam = clamp(
      0.006 +
      materialNarrowSupport * boundary * filamentGate * 0.03 +
      skeletonBudgetEvidence * boundary * 0.002 +
      materialNarrowSupport * narrowPhysicalLine * boundary * 0.012 +
      materialNarrowSupport * frontUsable * boundary * 0.014 +
      huangAreaAdmission * boundary * 0.018 +
      materialNarrowSupport * capillaryFilament * boundary * 0.014 +
      materialNarrowSupport * physicalLineEvidence * boundary * 0.016 +
      materialNarrowSupport * connectedFilament * boundary * 0.007 -
      broadMaterialReject * 0.038 -
      broadAreaBrake * 0.034 -
      broadSheet * 0.05 -
      filamentWidthPenalty * 0.034 -
      thickIsland * 0.02,
      0.003,
      0.065
    );
    float foamExcess = max(0.0, foamWide - targetFoam) * (0.55 + broadSheet * 0.86 + broadMaterialReject * 0.34);

    if (uAreaDiagnosticMode > 0.5) {
      if (uAreaDiagnosticMode > 1.5) {
        gl_FragColor = vec4(
          clamp(skeletonBudgetEvidence, 0.0, 1.0),
          clamp(frontUsable, 0.0, 1.0),
          clamp(areaGate, 0.0, 1.0),
          clamp(fillBudget, 0.0, 1.0)
        );
        return;
      }
      gl_FragColor = vec4(
        clamp(physicalLineEvidence, 0.0, 1.0),
        clamp(narrowPhysicalGate, 0.0, 1.0),
        clamp(max(broadSheet, broadAreaBrake), 0.0, 1.0),
        clamp(phaseDeficit + foamExcess * 0.35, 0.0, 1.0)
      );
      return;
    }

    gl_FragColor = vec4(
      clamp(highWide, 0.0, 1.0),
      targetHigh,
      clamp(fillBudget, 0.0, 1.0),
      clamp(sheetDrain + foamExcess * 0.55, 0.0, 1.0)
    );
  }
`;

const PHASE_STEP_FRAGMENT_SHADER = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uField;
  uniform sampler2D uPotential;
  uniform sampler2D uVelocity;
  uniform sampler2D uRegionalFlow;
  uniform sampler2D uRiverPhase;
  uniform sampler2D uRiverPathCost;
  uniform sampler2D uPhaseArea;
  uniform sampler2D uFilamentConnectivity;
  uniform sampler2D uHuangFrontState;
  uniform vec2 uTexel;
  uniform float uDelta;
  uniform float uDiffusion;
  uniform float uDripAmount;
  uniform float uFlowDirection;
  uniform float uFoamSource;
  uniform float uFoamDecay;

  vec3 sphericalSampleUv(vec2 uv) {
    float x = uv.x;
    float y = uv.y;
    float poleCross = 0.0;
    if (y < 0.0) {
      y = -y;
      x += 0.5;
      poleCross = 1.0;
    }
    if (y > 1.0) {
      y = 2.0 - y;
      x += 0.5;
      poleCross = 1.0;
    }
    return vec3(fract(x), clamp(y, 0.002, 0.998), poleCross);
  }

  vec2 sampleUv(vec2 uv) {
    return sphericalSampleUv(uv).xy;
  }

  vec4 fieldAt(vec2 uv) {
    return texture2D(uField, sampleUv(uv));
  }

  vec4 potentialAt(vec2 uv) {
    return texture2D(uPotential, sampleUv(uv));
  }

  float muAt(vec2 uv) {
    return (potentialAt(uv).r - 0.5) / 0.075;
  }

  vec2 velocityAt(vec2 uv) {
    vec3 sphereUv = sphericalSampleUv(uv);
    vec2 velocity = (texture2D(uVelocity, sphereUv.xy).rg - 0.5) * 0.5;
    return mix(velocity, -velocity, sphereUv.z);
  }

  vec4 regionalFlowAt(vec2 uv) {
    return texture2D(uRegionalFlow, sampleUv(uv));
  }

  vec4 riverAt(vec2 uv) {
    return texture2D(uRiverPhase, sampleUv(uv));
  }

  vec4 pathCostAt(vec2 uv) {
    return texture2D(uRiverPathCost, sampleUv(uv));
  }

  vec4 phaseAreaAt(vec2 uv) {
    return texture2D(uPhaseArea, sampleUv(uv));
  }

  vec4 filamentAt(vec2 uv) {
    return texture2D(uFilamentConnectivity, sampleUv(uv));
  }

  vec4 huangFrontAt(vec2 uv) {
    return texture2D(uHuangFrontState, sampleUv(uv));
  }

  vec2 bridgeVelocityAt(vec2 uv, vec2 mainDir) {
    vec4 pot = potentialAt(uv);
    vec4 flow = regionalFlowAt(uv);
    vec2 v = velocityAt(uv);
    vec4 fL = fieldAt(uv - vec2(uTexel.x, 0.0));
    vec4 fR = fieldAt(uv + vec2(uTexel.x, 0.0));
    vec4 fD = fieldAt(uv - vec2(0.0, uTexel.y));
    vec4 fU = fieldAt(uv + vec2(0.0, uTexel.y));
    vec2 gradGamma = vec2(fR.g - fL.g, fU.g - fD.g);
    float gammaLine = smoothstep(0.006, 0.08, length(gradGamma));
    vec2 flowTangent = normalize((flow.rg * 2.0 - 1.0) + mainDir * 0.08);
    if (dot(flowTangent, mainDir) < 0.0) flowTangent *= -1.0;
    float ridgeGate = smoothstep(0.08, 0.56, flow.b + pot.a * 0.24) * smoothstep(0.18, 0.72, pot.g + flow.a * 0.34);
    float massLimiter = 1.0 - smoothstep(0.44, 0.78, pot.b) * (1.0 - smoothstep(0.08, 0.5, pot.a));
    vec2 transportDir = normalize(
      flowTangent * (0.12 + flow.b * 1.6 + flow.a * 0.7 + gammaLine * 0.42) +
      v * (0.46 + pot.g * 0.7 + gammaLine * 0.24) +
      mainDir * (0.02 + pot.g * 0.026) +
      vec2(0.001, -0.002)
    );
    float speed = (0.006 + length(v) * 0.16 + flow.a * 0.018 + gammaLine * 0.008 + uDripAmount * 0.0018) * ridgeGate * (0.72 + massLimiter * 0.28);
    return transportDir * speed;
  }

  float upwindDye(float faceVelocity, float upstreamDye, float downstreamDye) {
    return faceVelocity >= 0.0 ? upstreamDye : downstreamDye;
  }

  float bridgeFaceGate(vec4 a, vec4 b) {
    float support = (a.g + b.g) * 0.5;
    float ridge = max(a.a, b.a);
    float localHigh = (a.b + b.b) * 0.5;
    return clamp(
      smoothstep(0.06, 0.5, ridge) *
      smoothstep(0.22, 0.68, support + ridge * 0.45) *
      (0.55 + ridge * 0.45) *
      (1.0 - smoothstep(0.5, 0.84, localHigh) * (1.0 - ridge * 0.55)),
      0.0,
      1.0
    );
  }

  void main() {
    vec2 uv = vUv;
    vec4 c = fieldAt(uv);
    vec4 l = fieldAt(uv - vec2(uTexel.x, 0.0));
    vec4 r = fieldAt(uv + vec2(uTexel.x, 0.0));
    vec4 d = fieldAt(uv - vec2(0.0, uTexel.y));
    vec4 u = fieldAt(uv + vec2(0.0, uTexel.y));
    vec4 p = potentialAt(uv);
    vec4 pL = potentialAt(uv - vec2(uTexel.x, 0.0));
    vec4 pR = potentialAt(uv + vec2(uTexel.x, 0.0));
    vec4 pD = potentialAt(uv - vec2(0.0, uTexel.y));
    vec4 pU = potentialAt(uv + vec2(0.0, uTexel.y));

    float dye = c.a;
    float foam = c.b;
    float lapMu = muAt(uv - vec2(uTexel.x, 0.0)) + muAt(uv + vec2(uTexel.x, 0.0)) +
      muAt(uv - vec2(0.0, uTexel.y)) + muAt(uv + vec2(0.0, uTexel.y)) -
      muAt(uv) * 4.0;
    float lapDye = l.a + r.a + u.a + d.a - dye * 4.0;
    float lapFoam = l.b + r.b + u.b + d.b - foam * 4.0;
    float localMeanFoam = (foam * 1.6 + l.b + r.b + u.b + d.b) / 5.6;
    float foamPeakContrast = clamp(
      max(0.0, foam - localMeanFoam * 1.12) * 2.7 +
      max(0.0, -lapFoam) * 0.32 +
      abs(foam - localMeanFoam) * 0.16,
      0.0,
      1.0
    );
    float lapH = l.r + r.r + u.r + d.r - c.r * 4.0;
    vec2 gradDye = vec2(r.a - l.a, u.a - d.a);
    vec2 gradH = vec2(r.r - l.r, u.r - d.r);
    vec2 gradGamma = vec2(r.g - l.g, u.g - d.g);
    vec2 vL = velocityAt(uv - vec2(uTexel.x, 0.0));
    vec2 vR = velocityAt(uv + vec2(uTexel.x, 0.0));
    vec2 vD = velocityAt(uv - vec2(0.0, uTexel.y));
    vec2 vU = velocityAt(uv + vec2(0.0, uTexel.y));
    float shear = length(vR - vL) + length(vU - vD);
    float velocityDivergence = ((vR.x - vL.x) + (vU.y - vD.y)) * 0.5;
    float flowCompression = smoothstep(0.002, 0.042, -velocityDivergence);
    float flowExpansion = smoothstep(0.002, 0.042, velocityDivergence);
    vec2 globalFlowDir = normalize(vec2(cos(uFlowDirection), sin(uFlowDirection)));
    vec2 localPhaseVelocity = velocityAt(uv);
    vec2 gammaTangent = normalize(vec2(-gradGamma.y, gradGamma.x) + vec2(0.001, -0.001));
    vec2 mainDir = normalize(
      globalFlowDir * 0.20 +
      localPhaseVelocity * 3.2 +
      gammaTangent * (0.36 + smoothstep(0.004, 0.075, length(gradGamma)) * 0.58) +
      vec2(0.001, -0.002)
    );
    if (dot(mainDir, globalFlowDir) < -0.36) mainDir *= -1.0;
    vec2 tangent = localPhaseVelocity + mainDir * 0.08;
    tangent = normalize(tangent + vec2(0.001, -0.002));
    vec2 normalDir = vec2(-tangent.y, tangent.x);
    float streamDye = (
      fieldAt(uv + tangent * uTexel * 3.0).a +
      fieldAt(uv - tangent * uTexel * 3.0).a +
      fieldAt(uv + tangent * uTexel * 7.0).a +
      fieldAt(uv - tangent * uTexel * 7.0).a
    ) * 0.25;
    float nearAlongA = fieldAt(uv + tangent * uTexel * 2.0).a;
    float nearAlongB = fieldAt(uv - tangent * uTexel * 2.0).a;
    float farAlongA = fieldAt(uv + tangent * uTexel * 6.0).a;
    float farAlongB = fieldAt(uv - tangent * uTexel * 6.0).a;
    float alongNeck = min(nearAlongA, nearAlongB) * 0.72 + min(farAlongA, farAlongB) * 0.28;
    float crossDye = (
      fieldAt(uv + normalDir * uTexel * 3.0).a +
      fieldAt(uv - normalDir * uTexel * 3.0).a
    ) * 0.5;

    float support = p.g;
    float localHigh = p.b;
    float regionalRidge = p.a;
    vec4 river = riverAt(uv);
    float riverSupport = river.r;
    float riverMeniscusMass = river.g;
    float riverRidge = river.b;
    float riverSheet = river.a;
    float riverFrontAge = smoothstep(0.12, 0.72, riverRidge);
    float riverFilament = max(
      riverRidge * smoothstep(0.06, 0.62, riverSupport + riverMeniscusMass * 0.2),
      riverFrontAge * smoothstep(0.035, 0.58, riverSupport + riverMeniscusMass * 0.16 + regionalRidge * 0.14) * 0.9
    ) *
      (1.0 - riverSheet * 0.65);
    vec2 pathAlongStep = tangent * uTexel * 8.0;
    vec2 pathSideStep = normalDir * uTexel * 8.0;
    vec4 pathC = pathCostAt(uv);
    vec4 pathA = pathCostAt(uv + pathAlongStep);
    vec4 pathB = pathCostAt(uv - pathAlongStep);
    vec4 pathA2 = pathCostAt(uv + pathAlongStep * 2.15);
    vec4 pathB2 = pathCostAt(uv - pathAlongStep * 2.15);
    vec4 pathS1 = pathCostAt(uv + pathSideStep);
    vec4 pathS2 = pathCostAt(uv - pathSideStep);
    vec4 pathS3 = pathCostAt(uv + pathSideStep * 2.05);
    vec4 pathS4 = pathCostAt(uv - pathSideStep * 2.05);
    float pathAlong = (
      pathC.r * 1.25 +
      pathA.r + pathB.r +
      pathA2.r * 0.56 + pathB2.r * 0.56 +
      (pathA.b + pathB.b) * 0.18
    ) / 4.53;
    float pathAcross = (
      pathS1.r + pathS2.r +
      pathS3.r * 0.56 + pathS4.r * 0.56
    ) / 3.12;
    float pathRidge = smoothstep(
      0.035,
      0.34,
      pathC.b + max(0.0, pathAlong - pathAcross * 0.72) * 0.8
    );
    float pathNarrow = smoothstep(0.018, 0.28, pathAlong - pathAcross * 0.86) *
      (1.0 - smoothstep(0.36, 0.76, pathAcross));
    float pathGate = clamp(
      pathC.r * 0.42 +
      pathC.g * 0.2 +
      pathRidge * 0.48,
      0.0,
      1.0
    ) * pathNarrow * (1.0 - pathC.a * 0.75);
    float pathSheetDrain = smoothstep(0.22, 0.62, pathAcross + pathC.a * 0.4) *
      (1.0 - pathNarrow * 0.6);
    vec4 phaseArea = phaseAreaAt(uv);
    float areaHigh = phaseArea.r;
    float areaTarget = phaseArea.g;
    float areaFillBudget = phaseArea.b;
    float areaSheetDrain = phaseArea.a;
    float areaExcess = max(0.0, areaHigh - areaTarget);
    vec4 filament = filamentAt(uv);
    float filamentAge = smoothstep(0.05, 0.5, filament.g);
    float filamentReject = smoothstep(0.36, 0.86, filament.a);
    float connectedFilament = smoothstep(
      0.012,
      0.38,
      filament.r * 1.05 + filamentAge * 0.5 + filament.b * 0.28
    ) * (1.0 - filamentReject);
    float rawFilamentGate = smoothstep(0.015, 0.42, filament.r) * (1.0 - filamentReject);
    float dropletFilamentGate = smoothstep(0.018, 0.5, filament.b) * (1.0 - filamentReject);
    vec4 filamentSideA = filamentAt(uv + normalDir * uTexel * 6.0);
    vec4 filamentSideB = filamentAt(uv - normalDir * uTexel * 6.0);
    float sideAge = max(smoothstep(0.1, 0.68, filamentSideA.g), smoothstep(0.1, 0.68, filamentSideB.g));
    vec4 hf = huangFrontAt(uv);
    vec4 hfAlongA = huangFrontAt(uv + tangent * uTexel * 3.0);
    vec4 hfAlongB = huangFrontAt(uv - tangent * uTexel * 3.0);
    vec4 hfSideA = huangFrontAt(uv + normalDir * uTexel * 3.0);
    vec4 hfSideB = huangFrontAt(uv - normalDir * uTexel * 3.0);
    float hfAlongOcc = max(hfAlongA.g, hfAlongB.g);
    float hfSideOcc = max(hfSideA.g, hfSideB.g);
    float hfSideReject = smoothstep(0.24, 0.74, hf.a * 0.78 + hfSideOcc * 0.28 + filament.a * 0.1 + sideAge * 0.05 - hfAlongOcc * 0.12);
    float hfOccupancyGate = smoothstep(0.025, 0.28, hf.g + hf.b * 0.32 + hfAlongOcc * 0.22 - hfSideOcc * 0.26);
    float hfNarrowAdmission = clamp(
      hfOccupancyGate *
      (1.0 - hfSideReject * 0.72) *
      smoothstep(0.035, 0.42, hf.g + hf.b * 0.34 + hfAlongOcc * 0.26 - hfSideOcc * 0.34 - filament.a * 0.1),
      0.0,
      1.0
    );
    float hfLineSource = clamp(
      hfOccupancyGate *
      smoothstep(
        0.08,
        0.46,
        hf.g * 0.58 +
        hf.b * 0.32 +
        hfAlongOcc * 0.28 -
        hfSideOcc * 0.58 -
        hf.a * 0.42 -
        filament.a * 0.14
      ) *
      (0.18 + hfNarrowAdmission * 0.42 + smoothstep(0.14, 0.62, hfAlongOcc + hf.b * 0.16 - hfSideOcc * 0.18) * 0.18) *
      (1.0 - hfSideReject * 0.82) *
      (1.0 - smoothstep(0.42, 0.82, hf.a + filament.a * 0.16)),
      0.0,
      1.0
    );
    float broadFeedbackReject = clamp(
      max(
        max(filamentReject, smoothstep(0.28, 0.74, filament.a + hfSideReject * 0.32)),
        smoothstep(0.22, 0.68, areaSheetDrain + areaExcess * 0.48 + sideAge * 0.14 + hfSideOcc * 0.18)
      ) *
      (1.0 - max(hfNarrowAdmission, hfLineSource) * 0.64),
      0.0,
      1.0
    );
    float filamentEdge = smoothstep(
      0.02,
      0.42,
      filament.b * 0.82 +
      abs(filament.r - max(filamentSideA.r, filamentSideB.r)) * 0.68 +
      max(filamentSideA.b, filamentSideB.b) * 0.18
    ) * (1.0 - filamentReject) * (0.65 + filamentAge * 0.35);
    float filamentBridge = connectedFilament *
      smoothstep(0.14, 0.66, filament.g + max(filamentSideA.g, filamentSideB.g) * 0.24) *
      (1.0 - smoothstep(0.54, 0.84, crossDye)) *
      (1.0 - smoothstep(0.3, 0.84, filament.a)) *
      (0.62 + max(filamentAge, sideAge) * 0.38);
    float usableFilamentAge = filamentAge * (1.0 - filamentReject) * (0.35 + connectedFilament * 0.65);
    float filamentSkeletonGate = clamp(
      pathGate * 0.48 +
      riverFilament * 0.42 +
      riverFrontAge * 0.12 +
      connectedFilament * 0.62 +
      rawFilamentGate * 0.32 +
      filamentBridge * 0.68 +
      usableFilamentAge * 0.28 +
      hfLineSource * 0.56 +
      filamentEdge * 0.2 +
      dropletFilamentGate * 0.26 +
      regionalRidge * 0.16,
      0.0,
      1.0
    );
    float frontQualifiedFill = clamp(
      filamentSkeletonGate * 0.42 +
      connectedFilament * 0.22 +
      rawFilamentGate * 0.12 +
      hfNarrowAdmission * 0.88 -
      broadFeedbackReject * 0.3 -
      hfSideReject * 0.12,
      0.0,
      1.0
    );
    float areaFillAdmission = clamp(
      hfNarrowAdmission * 0.74 +
      frontQualifiedFill * 0.32 +
      connectedFilament * 0.08 +
      rawFilamentGate * 0.06 +
      hfLineSource * 0.18 -
      broadFeedbackReject * 0.28 -
      hfSideReject * 0.12 -
      sideAge * 0.1 -
      filamentReject * 0.16 -
      areaSheetDrain * 0.12,
      0.0,
      1.0
    );
    float areaSkeletonBudgetGate = clamp(
      hfNarrowAdmission * 0.66 +
      frontQualifiedFill * 0.36 +
      connectedFilament * 0.1 +
      filamentSkeletonGate * 0.08 +
      hfLineSource * 0.12 -
      broadFeedbackReject * 0.38 -
      areaSheetDrain * 0.18 -
      filamentReject * 0.2 -
      sideAge * 0.14,
      0.0,
      1.0
    );
    // The coarse phaseAreaSkeleton buffer is diagnostic only; it must not seed phase or foam growth.
    float areaSkeletonFill = 0.0;
    float areaUngatedFill = areaFillBudget * (1.0 - areaFillAdmission) + areaFillBudget * broadFeedbackReject * 0.42;
    float eta = max(c.r, 0.035);
    float gammaGradient = length(gradGamma) / eta;
    float etaCurvature = abs(lapH) * 4.2 + length(gradH) * 1.25 + abs(dot(gradH, normalDir)) * 1.1;
    float phaseBoundaryGate = smoothstep(0.012, 0.11, length(gradDye) * 1.45 + abs(lapDye) * 0.55);
    float marangoniCompression = smoothstep(
      0.012,
      0.19,
      gammaGradient * 0.62 + flowCompression * 0.34 + shear * 0.12 + etaCurvature * 0.12
    );
    float narrowEtaGate = smoothstep(0.07, 0.42, etaCurvature) * (1.0 - smoothstep(0.42, 0.86, c.r));
    float huangLineSource = clamp(
      marangoniCompression *
      (0.22 + phaseBoundaryGate * 0.26 + narrowEtaGate * 0.24 + flowCompression * 0.28) *
      (0.24 + frontQualifiedFill * 0.34 + hfNarrowAdmission * 0.3 + hfLineSource * 0.56 + connectedFilament * 0.14 + filamentBridge * 0.14 + pathGate * 0.1 + riverFilament * 0.08) *
      (1.0 - filamentReject * 0.62) *
      (1.0 - broadFeedbackReject * 0.44) *
      (1.0 - areaSheetDrain * 0.58) *
      (1.0 - pathSheetDrain * 0.5) *
      (1.0 - riverSheet * 0.38),
      0.0,
      1.0
    );
    support = max(
      support * (1.0 - broadFeedbackReject * 0.22),
      pathGate * 0.52 +
      riverFilament * 0.28 +
      riverFrontAge * 0.12 +
      connectedFilament * 0.22 +
      rawFilamentGate * 0.14 +
      dropletFilamentGate * 0.08 +
      filamentBridge * 0.26 +
      usableFilamentAge * 0.1 +
      hfNarrowAdmission * 0.58 +
      hfLineSource * 0.72 +
      riverMeniscusMass * riverRidge * 0.06 +
      areaSkeletonFill * 0.0005 +
      huangLineSource * 0.34
    );
    localHigh = max(
      localHigh * (1.0 - broadFeedbackReject * 0.28),
      pathGate * 0.095 +
      riverFilament * 0.1 +
      riverFrontAge * 0.035 +
      connectedFilament * 0.04 +
      rawFilamentGate * 0.026 +
      dropletFilamentGate * 0.016 +
      filamentBridge * 0.052 +
      usableFilamentAge * 0.018 +
      hfNarrowAdmission * 0.14 +
      hfLineSource * 0.18 +
      riverMeniscusMass * riverRidge * 0.055 +
      areaSkeletonFill * 0.00008 +
      huangLineSource * 0.058
    );
    regionalRidge = max(regionalRidge, riverRidge * (1.0 - riverSheet * 0.45));
    float physicalFillGate = clamp(
      areaSkeletonFill * 0.0008 +
      huangLineSource * 0.58 +
      hfNarrowAdmission * 0.26 +
      hfLineSource * 0.42 +
      pathGate * 0.36 +
      riverFilament * 0.24 +
      riverFrontAge * 0.12 +
      connectedFilament * 0.28 +
      rawFilamentGate * 0.34 +
      dropletFilamentGate * 0.16 +
      filamentBridge * 0.32 +
      usableFilamentAge * 0.14 +
      filament.b * 0.12 -
      flowExpansion * 0.08 -
      broadFeedbackReject * 0.44 -
      areaSheetDrain * 0.62 -
      areaUngatedFill * 0.38 -
      pathSheetDrain * 0.42 -
      riverSheet * 0.22,
      0.0,
      1.0
    );
    float narrowPhaseAdmission = clamp(
      max(
        areaFillAdmission,
        max(
          hfNarrowAdmission,
          physicalFillGate * (0.34 + frontQualifiedFill * 0.44 + hfLineSource * 0.22)
        )
      ) -
      broadFeedbackReject * 0.36 -
      areaSheetDrain * 0.28 -
      areaUngatedFill * 0.22 -
      hfSideReject * 0.16,
      0.0,
      1.0
    );
    float broadPhaseRetentionReject = clamp(
      max(broadFeedbackReject, areaSheetDrain) * 0.68 +
      areaExcess * 0.36 +
      areaUngatedFill * 0.28 +
      (1.0 - narrowPhaseAdmission) * smoothstep(0.22, 0.64, localHigh) * 0.34,
      0.0,
      1.0
    );
    vec2 bridgeC = bridgeVelocityAt(uv, mainDir);
    vec2 bridgeL = bridgeVelocityAt(uv - vec2(uTexel.x, 0.0), mainDir);
    vec2 bridgeR = bridgeVelocityAt(uv + vec2(uTexel.x, 0.0), mainDir);
    vec2 bridgeD = bridgeVelocityAt(uv - vec2(0.0, uTexel.y), mainDir);
    vec2 bridgeU = bridgeVelocityAt(uv + vec2(0.0, uTexel.y), mainDir);
    float faceVR = (bridgeC.x + bridgeR.x) * 0.5 * bridgeFaceGate(p, pR);
    float faceVL = (bridgeL.x + bridgeC.x) * 0.5 * bridgeFaceGate(pL, p);
    float faceVU = (bridgeC.y + bridgeU.y) * 0.5 * bridgeFaceGate(p, pU);
    float faceVD = (bridgeD.y + bridgeC.y) * 0.5 * bridgeFaceGate(pD, p);
    float fluxR = faceVR * upwindDye(faceVR, dye, r.a);
    float fluxL = faceVL * upwindDye(faceVL, l.a, dye);
    float fluxU = faceVU * upwindDye(faceVU, dye, u.a);
    float fluxD = faceVD * upwindDye(faceVD, d.a, dye);
    float bridgeFluxDiv = (fluxR - fluxL + fluxU - fluxD) * 0.5;
    float bridgeConvergence = max(0.0, -bridgeFluxDiv);
    float ridgeContinuity = smoothstep(0.06, 0.56, regionalRidge + support * 0.42);
    float massSupport = max(support, regionalRidge * 0.16 + riverFilament * 0.14 + pathGate * 0.18 + rawFilamentGate * 0.12 + dropletFilamentGate * 0.08 + huangLineSource * 0.24 + hfNarrowAdmission * 0.28 + hfLineSource * 0.46);
    float phaseSourceBudget = (
      support * 0.05 +
      regionalRidge * 0.032 +
      riverFilament * 0.052 +
      riverFrontAge * 0.026 +
      pathGate * 0.06 +
      rawFilamentGate * 0.055 +
      dropletFilamentGate * 0.026 +
      huangLineSource * 0.16 +
      hfNarrowAdmission * 0.13 +
      hfLineSource * 0.16 +
      physicalFillGate * 0.22
    );
    float targetHigh = clamp(
      0.034 +
      narrowPhaseAdmission * phaseSourceBudget +
      areaTarget * (0.26 + areaFillAdmission * 0.28 + hfNarrowAdmission * 0.18) -
      connectedFilament * filament.a * 0.025 +
      connectedFilament * 0.034 -
      filamentAge * filamentReject * 0.025 +
      usableFilamentAge * 0.016 -
      broadFeedbackReject * 0.085 -
      broadPhaseRetentionReject * 0.11 -
      areaSheetDrain * 0.09 +
      areaSkeletonFill * 0.00005 -
      areaUngatedFill * 0.075 -
      pathSheetDrain * 0.07 -
      riverSheet * 0.072 -
      smoothstep(0.62, 0.92, c.r) * 0.052,
      0.018,
      0.28
    );
    targetHigh = mix(
      min(targetHigh, 0.07 + areaTarget * 0.42),
      targetHigh,
      narrowPhaseAdmission * (1.0 - broadPhaseRetentionReject * 0.42)
    );
    float areaCorrection = clamp(
      (targetHigh - localHigh) +
      areaSkeletonFill * 0.0002 * narrowPhaseAdmission * (0.2 + physicalFillGate * 0.52 + hfNarrowAdmission * 0.28) +
      huangLineSource * 0.16 * narrowPhaseAdmission * (0.35 + flowCompression * 0.65) +
      hfLineSource * 0.1 * narrowPhaseAdmission * (0.22 + flowCompression * 0.54 + phaseBoundaryGate * 0.24) -
      broadFeedbackReject * 0.28 -
      broadPhaseRetentionReject * 0.26 -
      areaUngatedFill * 0.34 -
      areaSheetDrain * 0.58 -
      areaExcess * 0.46,
      -0.46,
      0.18
    );
    float overgrownPhase = smoothstep(0.22, 0.44, localHigh);
    float lowSupportDrain = (1.0 - smoothstep(0.18, 0.56, support)) * smoothstep(0.24, 0.72, dye);
    float tileExcessDrain = smoothstep(0.22, 0.48, localHigh) * (1.0 - smoothstep(0.3, 0.74, support));
    float boundary = smoothstep(0.012, 0.09, length(gradDye) * 1.8 + abs(lapDye) * 0.75);
    float thickIsland = smoothstep(0.56, 0.92, c.r + smoothstep(0.04, 0.18, length(gradH)) * 0.34 + foam * 0.3);
    float broadSheetDrain = smoothstep(0.3, 0.58, localHigh) *
      (1.0 - regionalRidge * 0.55) *
      smoothstep(0.28, 0.7, dye + foam * 0.32 + riverSheet * 0.2) *
      (0.045 + riverSheet * 0.05 + foam * 0.035 + pathSheetDrain * 0.045 + areaSheetDrain * 0.075);
    float islandInteriorDrain = smoothstep(0.42, 0.78, localHigh) *
      (1.0 - boundary * 0.82) *
      smoothstep(0.46, 0.8, dye) *
      (0.035 + thickIsland * 0.045 + foam * 0.035);
    float advectiveNeckFill = smoothstep(0.44, 0.74, alongNeck) *
      smoothstep(0.02, 0.24, alongNeck - dye) *
      (1.0 - smoothstep(0.56, 0.82, crossDye)) *
      (0.016 + massSupport * 0.026 + ridgeContinuity * 0.02) *
      (0.25 + physicalFillGate * 0.75);
    float unsupportedPhaseDrain = (1.0 - smoothstep(0.035, 0.22, physicalFillGate)) *
      smoothstep(0.22, 0.68, dye) *
      (0.044 + localHigh * 0.038 + areaSheetDrain * 0.06 + pathSheetDrain * 0.05 + riverSheet * 0.03);
    float broadPhaseReject = smoothstep(0.24, 0.62, dye + localHigh * 0.42 + areaHigh * 0.18) *
      (1.0 - hfNarrowAdmission * 0.72) *
      (0.34 + broadFeedbackReject * 0.38 + areaUngatedFill * 0.32 + areaSheetDrain * 0.28 + filamentReject * 0.18 + sideAge * 0.16);
    float mobility = (0.05 + uDripAmount * 0.018 + shear * 0.024) * (0.72 + boundary * 0.42);

    dye += uDelta * (
      lapMu * mobility * 0.86 +
      lapDye * (0.0003 + uDiffusion * 0.00135) +
      (massSupport - smoothstep(0.38, 0.7, dye)) * (0.018 + boundary * 0.014) * (0.28 + physicalFillGate * 0.72) +
      (pathGate - smoothstep(0.34, 0.72, dye)) * (0.03 + boundary * 0.02) +
      (riverFilament - smoothstep(0.34, 0.72, dye)) * (0.02 + riverRidge * 0.02 + riverFrontAge * 0.012) +
      (riverFrontAge - smoothstep(0.3, 0.68, dye)) * (0.01 + boundary * 0.008 + areaSkeletonFill * 0.00008) +
      (connectedFilament - smoothstep(0.34, 0.72, dye)) * (0.018 + boundary * 0.012 + filament.b * 0.01) +
      (rawFilamentGate - smoothstep(0.28, 0.66, dye)) * (0.034 + boundary * 0.016 + dropletFilamentGate * 0.008) +
      (filamentBridge - smoothstep(0.32, 0.68, dye)) * (0.022 + boundary * 0.01 + areaSkeletonFill * 0.00008) +
      (huangLineSource - smoothstep(0.3, 0.68, dye)) * (0.056 + boundary * 0.026 + flowCompression * 0.018 + gammaGradient * 0.006) +
      (hfLineSource - smoothstep(0.28, 0.66, dye)) * (0.038 + boundary * 0.02 + flowCompression * 0.014 + gammaGradient * 0.004) +
      (areaSkeletonFill - smoothstep(0.34, 0.72, dye)) * (0.00008 + boundary * 0.00008) * (0.22 + physicalFillGate * 0.46 + hfNarrowAdmission * 0.32) +
      areaCorrection * (0.24 + boundary * 0.08) * (0.35 + physicalFillGate * 0.65) -
      overgrownPhase * smoothstep(0.42, 0.82, dye) * (0.055 + (1.0 - support) * 0.052 + riverSheet * 0.024 + broadFeedbackReject * 0.07) -
      lowSupportDrain * (0.044 + overgrownPhase * 0.026 + broadFeedbackReject * 0.04) -
      tileExcessDrain * smoothstep(0.42, 0.78, dye) * (0.045 + broadFeedbackReject * 0.055) -
      thickIsland * smoothstep(0.54, 0.84, dye) * 0.04 -
      islandInteriorDrain -
      broadSheetDrain * (1.0 + broadFeedbackReject * 0.9) +
      advectiveNeckFill * (0.42 + hfNarrowAdmission * 0.58) +
      (streamDye - dye) * (0.006 + support * 0.012 + shear * 0.004) * (0.18 + physicalFillGate * 0.54 + hfNarrowAdmission * 0.28) -
      bridgeFluxDiv * (0.024 + ridgeContinuity * 0.038 + boundary * 0.014) +
      bridgeConvergence * (0.0012 + ridgeContinuity * 0.0018) -
      unsupportedPhaseDrain -
      broadPhaseReject * (0.045 + smoothstep(0.36, 0.82, dye) * 0.055) -
      broadPhaseRetentionReject * smoothstep(0.24, 0.76, dye) * (0.082 + areaExcess * 0.08) -
      areaSheetDrain * smoothstep(0.36, 0.78, dye) * (0.1 + areaExcess * 0.14 + broadFeedbackReject * 0.08) -
      areaUngatedFill * smoothstep(0.32, 0.74, dye) * 0.09 -
      filament.a * smoothstep(0.36, 0.78, dye) * (0.06 + areaExcess * 0.06 + broadFeedbackReject * 0.04) -
      pathSheetDrain * smoothstep(0.42, 0.8, dye) * 0.075 -
      max(0.0, crossDye - dye) * (0.006 + (1.0 - support) * 0.014)
    );
    float physicalPhaseCeiling = clamp(
      0.072 +
      areaTarget * 0.55 +
      narrowPhaseAdmission * (
        physicalFillGate * 0.66 +
        pathGate * 0.22 +
        riverFilament * 0.18 +
        connectedFilament * 0.16 +
        rawFilamentGate * 0.22 +
        dropletFilamentGate * 0.09 +
        filamentBridge * 0.18 +
        huangLineSource * 0.28 +
        hfNarrowAdmission * 0.3 +
        hfLineSource * 0.28 +
        boundary * 0.05
      ) -
      broadFeedbackReject * 0.14 -
      broadPhaseRetentionReject * 0.18 -
      areaSheetDrain * 0.11 -
      areaUngatedFill * 0.1 -
      broadPhaseReject * 0.12 -
      pathSheetDrain * 0.06,
      0.035,
      0.64
    );
    float phaseCeilingRelax = clamp(
      (1.0 - physicalFillGate) * 0.16 +
      (1.0 - narrowPhaseAdmission) * 0.2 +
      broadFeedbackReject * 0.18 +
      broadPhaseRetentionReject * 0.2 +
      areaSheetDrain * 0.14 +
      areaUngatedFill * 0.08 +
      broadPhaseReject * 0.14 +
      pathSheetDrain * 0.1 +
      riverSheet * 0.08 +
      smoothstep(0.35, 0.72, localHigh) * 0.06,
      0.0,
      0.68
    );
    dye = mix(
      dye,
      min(dye, physicalPhaseCeiling),
      clamp(uDelta * phaseCeilingRelax * 18.0, 0.0, 0.55)
    );

    float interfaceStress = smoothstep(0.012, 0.11, abs(lapDye) * 0.85 + length(gradDye) * 1.55 + length(gradH) * 2.6 + gammaGradient * 0.18 + shear * 0.16);
    float foamSheetDrain = smoothstep(0.28, 0.62, localHigh + foam * 0.4 + riverSheet * 0.25 + filament.a * 0.24) *
      (1.0 - boundary * 0.72) *
      (1.0 - regionalRidge * 0.55) *
      (1.0 - connectedFilament * 0.48) +
      (1.0 - filamentEdge) * smoothstep(0.18, 0.62, foam + localHigh * 0.34) * 0.22 +
      pathSheetDrain * smoothstep(0.28, 0.72, foam + localHigh * 0.5) * 0.45 +
      areaSheetDrain * smoothstep(0.18, 0.68, foam + areaHigh * 0.42) * 0.62 +
      filamentReject * smoothstep(0.16, 0.58, foam + localHigh * 0.32) * 0.28 +
      broadFeedbackReject * smoothstep(0.14, 0.58, foam + localHigh * 0.35 + areaHigh * 0.2) * 0.58;
    float dropletNucleation = boundary * interfaceStress * smoothstep(0.08, 0.64, support + regionalRidge * 0.14 + pathGate * 0.32 + connectedFilament * 0.24 + rawFilamentGate * 0.16 + usableFilamentAge * 0.18 + dropletFilamentGate * 0.22 + areaSkeletonFill * 0.0002 + huangLineSource * 0.42 + hfNarrowAdmission * 0.42 + hfLineSource * 0.46 + riverFilament * 0.12 + riverFrontAge * 0.08 + shear * 0.16 + length(gradH) * 3.2 + gammaGradient * 0.14) *
      (1.0 - foamSheetDrain * 0.72) *
      (1.0 - broadFeedbackReject * 0.62) *
      (0.08 + filamentEdge * 0.82 + areaSkeletonFill * 0.00015 + hfNarrowAdmission * 0.24 + hfLineSource * 0.32 + connectedFilament * boundary * 0.08) *
      (0.72 + filamentAge * 0.28) *
      (0.08 + physicalFillGate * 0.62 + huangLineSource * 0.2 + hfLineSource * 0.26);
    foam += uDelta * (
      lapFoam * (0.00016 + uDiffusion * 0.00085) +
      dropletNucleation * uFoamSource * 0.024 -
      foam * (0.076 + uFoamDecay * 0.13 + (1.0 - boundary) * 0.052 + thickIsland * 0.05 + foamSheetDrain * 0.5 + areaSheetDrain * 0.28 + riverSheet * 0.12)
    );
    float edgeFoamSupport = clamp(
      boundary * interfaceStress * (0.22 + filamentEdge * 0.56 + connectedFilament * 0.18 + huangLineSource * 0.22 + hfNarrowAdmission * 0.1 + hfLineSource * 0.24) +
      filamentEdge * 0.22 +
      dropletFilamentGate * 0.14 +
      areaSkeletonFill * boundary * 0.0002 +
      riverFrontAge * boundary * 0.08,
      0.0,
      1.0
    );
    float microFoamNucleus = clamp(
      boundary * interfaceStress * (0.18 + filamentEdge * 0.48) +
      dropletFilamentGate * 0.22 +
      rawFilamentGate * boundary * 0.16 +
      huangLineSource * boundary * 0.24 +
      hfNarrowAdmission * boundary * 0.16 +
      hfLineSource * boundary * 0.24 +
      foamPeakContrast * edgeFoamSupport * 0.18 +
      smoothstep(0.035, 0.42, shear) * boundary * 0.12 +
      smoothstep(0.035, 0.34, etaCurvature) * filamentEdge * 0.12,
      0.0,
      1.0
    );
    float broadFoamSheet = smoothstep(0.18, 0.58, foam + localHigh * 0.34 + areaHigh * 0.22 + filament.a * 0.18) *
      (1.0 - edgeFoamSupport * 0.68) *
      (1.0 - microFoamNucleus * 0.56) *
      (1.0 - foamPeakContrast * 0.5);
    float foamCeiling = clamp(
      0.012 +
      edgeFoamSupport * 0.18 +
      microFoamNucleus * 0.20 +
      foamPeakContrast * 0.08 +
      dropletNucleation * 0.12 -
      foamSheetDrain * 0.24 -
      broadFoamSheet * 0.16 -
      areaSheetDrain * 0.14 -
      pathSheetDrain * 0.1 -
      (1.0 - boundary) * 0.055,
      0.006,
      0.34
    );
    float foamSheetRelax = clamp(
      uDelta * (
        4.2 +
        foamSheetDrain * 13.0 +
        broadFoamSheet * 14.0 +
        areaSheetDrain * 7.0 +
        pathSheetDrain * 5.5 +
        filamentReject * 5.0 +
        (1.0 - boundary) * 4.0 +
        (1.0 - foamPeakContrast) * 2.6
      ),
      0.0,
      0.78
    );
    foam = mix(foam, min(foam, foamCeiling), foamSheetRelax);

    gl_FragColor = vec4(
      c.r,
      c.g,
      clamp(foam, 0.0, 0.98),
      clamp(dye, 0.0, 0.98)
    );
  }
`;

function clampNumber(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, number));
}

function normalizeSimSize(size) {
  const requested = clampNumber(size || 256, 128, 512);
  const choices = [128, 256, 320, 384, 512];
  return choices.reduce((best, choice) => (
    Math.abs(choice - requested) < Math.abs(best - requested) ? choice : best
  ), 256);
}

function normalizeRegionalSupportSize(size) {
  return Math.max(32, Math.min(128, Math.round(size / 4)));
}

function renderToTarget(renderer, scene, camera, target) {
  const previousTarget = renderer.getRenderTarget();
  renderer.setRenderTarget(target);
  renderer.render(scene, camera);
  renderer.setRenderTarget(previousTarget);
}

function createRenderTarget(size, targetOptions) {
  const target = new THREE.WebGLRenderTarget(size, size, targetOptions);
  target.texture.generateMipmaps = false;
  return target;
}

export function createThinFilmSimulator(renderer, options = {}) {
  let size = normalizeSimSize(options.size || 256);
  let regionalSupportSize = normalizeRegionalSupportSize(size);
  let huangFrontStateSize = size;
  let phaseAreaSize = size;
  const seedBase = Number.isFinite(options.seed) ? options.seed : DEFAULT_SIM_SEED;
  const huangCore = createHuangSphericalCore({ size, seed: seedBase });
  let activeFilmSolver = "legacy";
  const supportsHalfFloat = renderer.capabilities.isWebGL2 || renderer.extensions.get("OES_texture_half_float");
  const supportsHalfFloatLinear = renderer.capabilities.isWebGL2 || renderer.extensions.get("OES_texture_half_float_linear");
  const type = supportsHalfFloat ? THREE.HalfFloatType : THREE.UnsignedByteType;
  const filter = type === THREE.UnsignedByteType || supportsHalfFloatLinear ? THREE.LinearFilter : THREE.NearestFilter;
  const targetOptions = {
    minFilter: filter,
    magFilter: filter,
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
    format: THREE.RGBAFormat,
    type,
    depthBuffer: false,
    stencilBuffer: false,
  };
  const diagnosticTargetOptions = {
    ...targetOptions,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    type: THREE.UnsignedByteType,
  };
  const frontStateTargetOptions = {
    ...targetOptions,
    type: THREE.UnsignedByteType,
  };

  let fieldRead = createRenderTarget(size, targetOptions);
  let fieldWrite = createRenderTarget(size, targetOptions);
  let velocityRead = createRenderTarget(size, targetOptions);
  let velocityWrite = createRenderTarget(size, targetOptions);
  let divergenceTarget = createRenderTarget(size, targetOptions);
  let pressureRead = createRenderTarget(size, targetOptions);
  let pressureWrite = createRenderTarget(size, targetOptions);
  let gammaResidualTarget = createRenderTarget(size, diagnosticTargetOptions);
  let gammaCandidateTarget = createRenderTarget(size, targetOptions);
  let gammaSolveReadTarget = createRenderTarget(size, targetOptions);
  let gammaSolveWriteTarget = createRenderTarget(size, targetOptions);
  let gammaTileMassBeforeTarget = createRenderTarget(regionalSupportSize, targetOptions);
  let gammaTileMassAfterTarget = createRenderTarget(regionalSupportSize, targetOptions);
  let gammaProjectionDivergenceTarget = createRenderTarget(size, diagnosticTargetOptions);
  let gammaCandidateDiagnosticTarget = createRenderTarget(size, diagnosticTargetOptions);
  let etaGammaVelocityTarget = createRenderTarget(size, diagnosticTargetOptions);
  let huangMapStateReadTarget = createRenderTarget(size, frontStateTargetOptions);
  let huangMapStateWriteTarget = createRenderTarget(size, frontStateTargetOptions);
  let huangForwardMapStateReadTarget = createRenderTarget(size, frontStateTargetOptions);
  let huangForwardMapStateWriteTarget = createRenderTarget(size, frontStateTargetOptions);
  let huangResidualTransportReadTarget = createRenderTarget(size, frontStateTargetOptions);
  let huangResidualTransportWriteTarget = createRenderTarget(size, frontStateTargetOptions);
  let fieldDiagnosticTarget = createRenderTarget(size, diagnosticTargetOptions);
  let huangLocalDiagnosticTarget = createRenderTarget(size, targetOptions);
  let huangFrontStateReadTarget = createRenderTarget(huangFrontStateSize, frontStateTargetOptions);
  let huangFrontStateWriteTarget = createRenderTarget(huangFrontStateSize, frontStateTargetOptions);
  let phasePotentialTarget = createRenderTarget(size, targetOptions);
  let filamentConnectivityReadTarget = createRenderTarget(regionalSupportSize, targetOptions);
  let filamentConnectivityWriteTarget = createRenderTarget(regionalSupportSize, targetOptions);
  let filamentConnectivityDiagnosticTarget = createRenderTarget(regionalSupportSize, diagnosticTargetOptions);
  let phaseAreaTarget = createRenderTarget(phaseAreaSize, targetOptions);
  let phaseAreaDiagnosticTarget = createRenderTarget(phaseAreaSize, diagnosticTargetOptions);
  let phaseAreaSkeletonTarget = createRenderTarget(phaseAreaSize, diagnosticTargetOptions);
  let regionalSupportTarget = createRenderTarget(regionalSupportSize, targetOptions);
  let regionalEvolveRead = createRenderTarget(regionalSupportSize, targetOptions);
  let regionalEvolveWrite = createRenderTarget(regionalSupportSize, targetOptions);
  let regionalRidgeTarget = createRenderTarget(regionalSupportSize, targetOptions);
  let regionalFlowTarget = createRenderTarget(regionalSupportSize, targetOptions);
  let riverPhaseRead = createRenderTarget(size, targetOptions);
  let riverPhaseWrite = createRenderTarget(size, targetOptions);
  let riverCoreSupportTarget = createRenderTarget(size, targetOptions);
  let riverCoreMassTarget = createRenderTarget(regionalSupportSize, targetOptions);
  let riverPathCostTarget = createRenderTarget(regionalSupportSize, targetOptions);
  let riverPathDiagnosticsTarget = createRenderTarget(regionalSupportSize, targetOptions);
  let riverPathSkeletonTarget = createRenderTarget(regionalSupportSize, targetOptions);
  let riverPathEvidenceTarget = createRenderTarget(regionalSupportSize, targetOptions);
  let riverPathHeatReadTarget = createRenderTarget(regionalSupportSize, targetOptions);
  let riverPathHeatWriteTarget = createRenderTarget(regionalSupportSize, targetOptions);
  let riverCoreGeodesicReadTarget = createRenderTarget(regionalSupportSize, targetOptions);
  let riverCoreGeodesicWriteTarget = createRenderTarget(regionalSupportSize, targetOptions);
  let riverCoreTransportReadTarget = createRenderTarget(regionalSupportSize, targetOptions);
  let riverCoreTransportWriteTarget = createRenderTarget(regionalSupportSize, targetOptions);
  let riverCoreBalanceTarget = createRenderTarget(size, targetOptions);
  let riverCoreBalanceWriteTarget = createRenderTarget(size, targetOptions);
  let riverHeightFluxTarget = createRenderTarget(size, targetOptions);

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const geometry = new THREE.PlaneGeometry(2, 2);
  const scene = new THREE.Scene();
  const quad = new THREE.Mesh(geometry);
  scene.add(quad);

  const initFieldMaterial = new THREE.ShaderMaterial({
    vertexShader: SIM_VERTEX_SHADER,
    fragmentShader: INIT_FIELD_FRAGMENT_SHADER,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uSeed: { value: Math.random() * 1000 },
    },
  });

  const initVelocityMaterial = new THREE.ShaderMaterial({
    vertexShader: SIM_VERTEX_SHADER,
    fragmentShader: INIT_VELOCITY_FRAGMENT_SHADER,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uSeed: { value: Math.random() * 1000 },
    },
  });

  const velocityMaterial = new THREE.ShaderMaterial({
    vertexShader: SIM_VERTEX_SHADER,
    fragmentShader: VELOCITY_STEP_FRAGMENT_SHADER,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uField: { value: fieldRead.texture },
      uVelocity: { value: velocityRead.texture },
      uTexel: { value: new THREE.Vector2(1 / size, 1 / size) },
      uTime: { value: 0 },
      uDelta: { value: FIXED_SIM_DT },
      uPressure: { value: 0 },
      uFlowSpeed: { value: 0.46 },
      uFlowDirection: { value: 92 * Math.PI / 180 },
      uFlowCoherence: { value: 0.76 },
      uViscosity: { value: 0.35 },
      uMarangoni: { value: 0.72 },
      uCapillary: { value: 0.52 },
      uDrainage: { value: 0.58 },
      uGravity: { value: 0.72 },
    },
  });

  const divergenceMaterial = new THREE.ShaderMaterial({
    vertexShader: SIM_VERTEX_SHADER,
    fragmentShader: DIVERGENCE_FRAGMENT_SHADER,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uVelocity: { value: velocityRead.texture },
      uTexel: { value: new THREE.Vector2(1 / size, 1 / size) },
    },
  });

  const clearPressureMaterial = new THREE.ShaderMaterial({
    vertexShader: SIM_VERTEX_SHADER,
    fragmentShader: CLEAR_PRESSURE_FRAGMENT_SHADER,
    depthTest: false,
    depthWrite: false,
  });

  const pressureJacobiMaterial = new THREE.ShaderMaterial({
    vertexShader: SIM_VERTEX_SHADER,
    fragmentShader: PRESSURE_JACOBI_FRAGMENT_SHADER,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uPressure: { value: pressureRead.texture },
      uDivergence: { value: divergenceTarget.texture },
      uTexel: { value: new THREE.Vector2(1 / size, 1 / size) },
    },
  });

  const projectVelocityMaterial = new THREE.ShaderMaterial({
    vertexShader: SIM_VERTEX_SHADER,
    fragmentShader: PROJECT_VELOCITY_FRAGMENT_SHADER,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uVelocity: { value: velocityRead.texture },
      uPressure: { value: pressureRead.texture },
      uTexel: { value: new THREE.Vector2(1 / size, 1 / size) },
    },
  });

  const gammaImplicitMaterial = new THREE.ShaderMaterial({
    name: "soap-film-gamma-implicit",
    vertexShader: SIM_VERTEX_SHADER,
    fragmentShader: GAMMA_IMPLICIT_FRAGMENT_SHADER,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uField: { value: fieldRead.texture },
      uVelocity: { value: velocityRead.texture },
      uTexel: { value: new THREE.Vector2(1 / size, 1 / size) },
      uDelta: { value: FIXED_SIM_DT },
      uMarangoni: { value: 0.72 },
      uDiffusion: { value: 0.38 },
    },
  });

  const gammaResidualMaterial = new THREE.ShaderMaterial({
    vertexShader: SIM_VERTEX_SHADER,
    fragmentShader: GAMMA_RESIDUAL_FRAGMENT_SHADER,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uField: { value: fieldRead.texture },
      uVelocity: { value: velocityRead.texture },
      uTexel: { value: new THREE.Vector2(1 / size, 1 / size) },
      uDelta: { value: FIXED_SIM_DT },
      uDiffusion: { value: 0.38 },
      uMarangoni: { value: 0.72 },
    },
  });

  const gammaProjectionJacobiMaterial = new THREE.ShaderMaterial({
    name: "soap-film-gamma-projection-jacobi",
    vertexShader: SIM_VERTEX_SHADER,
    fragmentShader: GAMMA_PROJECTION_JACOBI_FRAGMENT_SHADER,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uBaseField: { value: fieldRead.texture },
      uSolveField: { value: gammaSolveReadTarget.texture },
      uVelocity: { value: velocityRead.texture },
      uTexel: { value: new THREE.Vector2(1 / size, 1 / size) },
      uDelta: { value: FIXED_SIM_DT },
      uDiffusion: { value: 0.38 },
      uMarangoni: { value: 0.72 },
    },
  });

  const gammaTileMassMaterial = new THREE.ShaderMaterial({
    name: "soap-film-gamma-tile-mass",
    vertexShader: SIM_VERTEX_SHADER,
    fragmentShader: GAMMA_TILE_MASS_FRAGMENT_SHADER,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uField: { value: fieldRead.texture },
      uTileTexel: { value: new THREE.Vector2(1 / regionalSupportSize, 1 / regionalSupportSize) },
      uFieldTexel: { value: new THREE.Vector2(1 / size, 1 / size) },
    },
  });

  const gammaTileMassCorrectionMaterial = new THREE.ShaderMaterial({
    name: "soap-film-gamma-tile-mass-correction",
    vertexShader: SIM_VERTEX_SHADER,
    fragmentShader: GAMMA_TILE_MASS_CORRECTION_FRAGMENT_SHADER,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uField: { value: fieldRead.texture },
      uTileBefore: { value: gammaTileMassBeforeTarget.texture },
      uTileAfter: { value: gammaTileMassAfterTarget.texture },
      uTexel: { value: new THREE.Vector2(1 / size, 1 / size) },
      uCorrectionStrength: { value: 0.78 },
    },
  });

  const gammaCandidateDiagnosticMaterial = new THREE.ShaderMaterial({
    vertexShader: SIM_VERTEX_SHADER,
    fragmentShader: GAMMA_CANDIDATE_DIAGNOSTIC_FRAGMENT_SHADER,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uField: { value: fieldRead.texture },
      uVelocity: { value: velocityRead.texture },
      uTexel: { value: new THREE.Vector2(1 / size, 1 / size) },
      uDelta: { value: FIXED_SIM_DT },
      uDiffusion: { value: 0.38 },
      uMarangoni: { value: 0.72 },
    },
  });

  const etaGammaVelocityDiagnosticMaterial = new THREE.ShaderMaterial({
    vertexShader: SIM_VERTEX_SHADER,
    fragmentShader: ETA_GAMMA_VELOCITY_DIAGNOSTIC_FRAGMENT_SHADER,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uField: { value: fieldRead.texture },
      uVelocity: { value: velocityRead.texture },
      uTexel: { value: new THREE.Vector2(1 / size, 1 / size) },
      uDelta: { value: FIXED_SIM_DT },
      uMarangoni: { value: 0.72 },
    },
  });

  const fieldDiagnosticMaterial = new THREE.ShaderMaterial({
    vertexShader: SIM_VERTEX_SHADER,
    fragmentShader: FIELD_DIAGNOSTIC_FRAGMENT_SHADER,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uField: { value: fieldRead.texture },
    },
  });

  const huangLocalDiagnosticMaterial = new THREE.ShaderMaterial({
    vertexShader: SIM_VERTEX_SHADER,
    fragmentShader: HUANG_LOCAL_DIAGNOSTIC_FRAGMENT_SHADER,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uField: { value: fieldRead.texture },
      uVelocity: { value: velocityRead.texture },
      uTexel: { value: new THREE.Vector2(1 / size, 1 / size) },
      uDelta: { value: FIXED_SIM_DT },
      uMarangoni: { value: 0.72 },
    },
  });

  const gammaVelocityCorrectionMaterial = new THREE.ShaderMaterial({
    name: "soap-film-gamma-velocity-correction",
    vertexShader: SIM_VERTEX_SHADER,
    fragmentShader: GAMMA_VELOCITY_CORRECTION_FRAGMENT_SHADER,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uField: { value: fieldRead.texture },
      uVelocity: { value: velocityRead.texture },
      uGammaResidual: { value: gammaCandidateDiagnosticTarget.texture },
      uTexel: { value: new THREE.Vector2(1 / size, 1 / size) },
      uDelta: { value: FIXED_SIM_DT },
      uMarangoni: { value: 0.72 },
      uViscosity: { value: 0.35 },
    },
  });

  const gammaProjectionDivergenceMaterial = new THREE.ShaderMaterial({
    name: "soap-film-gamma-projection-divergence",
    vertexShader: SIM_VERTEX_SHADER,
    fragmentShader: GAMMA_DIVERGENCE_FIELD_FRAGMENT_SHADER,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uField: { value: gammaCandidateTarget.texture },
      uVelocity: { value: velocityRead.texture },
      uTexel: { value: new THREE.Vector2(1 / size, 1 / size) },
      uDelta: { value: FIXED_SIM_DT },
      uDiffusion: { value: 0.38 },
      uMarangoni: { value: 0.72 },
    },
  });

  const gammaDivergenceFeedbackMaterial = new THREE.ShaderMaterial({
    name: "soap-film-gamma-divergence-feedback",
    vertexShader: SIM_VERTEX_SHADER,
    fragmentShader: GAMMA_DIVERGENCE_FEEDBACK_FRAGMENT_SHADER,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uField: { value: fieldRead.texture },
      uVelocity: { value: velocityRead.texture },
      uGammaProjection: { value: gammaProjectionDivergenceTarget.texture },
      uTexel: { value: new THREE.Vector2(1 / size, 1 / size) },
      uDelta: { value: FIXED_SIM_DT },
      uDiffusion: { value: 0.38 },
      uMarangoni: { value: 0.72 },
    },
  });

  const gammaContinuityMaterial = new THREE.ShaderMaterial({
    name: "soap-film-gamma-continuity",
    vertexShader: SIM_VERTEX_SHADER,
    fragmentShader: GAMMA_CONTINUITY_FRAGMENT_SHADER,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uField: { value: fieldRead.texture },
      uVelocity: { value: velocityRead.texture },
      uTexel: { value: new THREE.Vector2(1 / size, 1 / size) },
      uDelta: { value: FIXED_SIM_DT },
      uDiffusion: { value: 0.38 },
      uMarangoni: { value: 0.72 },
      uDrainage: { value: 0.58 },
    },
  });

  const fieldMaterial = new THREE.ShaderMaterial({
    name: "soap-film-field-step",
    vertexShader: SIM_VERTEX_SHADER,
    fragmentShader: FIELD_STEP_FRAGMENT_SHADER,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uField: { value: fieldRead.texture },
      uVelocity: { value: velocityRead.texture },
      uRiverPhase: { value: riverPhaseRead.texture },
      uRiverHeightFlux: { value: riverHeightFluxTarget.texture },
      uTexel: { value: new THREE.Vector2(1 / size, 1 / size) },
      uTime: { value: 0 },
      uDelta: { value: FIXED_SIM_DT },
      uPressure: { value: 0 },
      uFlowDirection: { value: 92 * Math.PI / 180 },
      uFlowSpeed: { value: 0.46 },
      uDiffusion: { value: 0.38 },
      uDripAmount: { value: 1.24 },
      uDrainage: { value: 0.58 },
      uMarangoni: { value: 0.72 },
      uCapillary: { value: 0.52 },
      uGravity: { value: 0.72 },
      uViscosity: { value: 0.35 },
      uSourceAmount: { value: 0.7 },
      uFoamSource: { value: 0.78 },
      uFoamDecay: { value: 0.28 },
    },
  });

  const initRiverPhaseMaterial = new THREE.ShaderMaterial({
    vertexShader: SIM_VERTEX_SHADER,
    fragmentShader: INIT_RIVER_PHASE_FRAGMENT_SHADER,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uField: { value: fieldRead.texture },
      uTexel: { value: new THREE.Vector2(1 / size, 1 / size) },
      uFlowDirection: { value: 92 * Math.PI / 180 },
    },
  });

  const regionalSupportMaterial = new THREE.ShaderMaterial({
    vertexShader: SIM_VERTEX_SHADER,
    fragmentShader: REGIONAL_SUPPORT_FRAGMENT_SHADER,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uField: { value: fieldRead.texture },
      uVelocity: { value: velocityRead.texture },
      uTexel: { value: new THREE.Vector2(1 / size, 1 / size) },
      uFlowDirection: { value: 92 * Math.PI / 180 },
      uCapillary: { value: 0.52 },
    },
  });

  const regionalFlowMaterial = new THREE.ShaderMaterial({
    vertexShader: SIM_VERTEX_SHADER,
    fragmentShader: REGIONAL_FLOW_FRAGMENT_SHADER,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uRegionalSupport: { value: regionalSupportTarget.texture },
      uVelocity: { value: velocityRead.texture },
      uTexel: { value: new THREE.Vector2(1 / regionalSupportSize, 1 / regionalSupportSize) },
      uFlowDirection: { value: 92 * Math.PI / 180 },
    },
  });

  const riverCoreSupportMaterial = new THREE.ShaderMaterial({
    vertexShader: SIM_VERTEX_SHADER,
    fragmentShader: RIVER_CORE_SUPPORT_FRAGMENT_SHADER,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uField: { value: fieldRead.texture },
      uVelocity: { value: velocityRead.texture },
      uPreviousRiver: { value: riverPhaseRead.texture },
      uRegionalSupport: { value: regionalRidgeTarget.texture },
      uRegionalFlow: { value: regionalFlowTarget.texture },
      uTexel: { value: new THREE.Vector2(1 / size, 1 / size) },
      uFlowDirection: { value: 92 * Math.PI / 180 },
      uCapillary: { value: 0.52 },
    },
  });

  const riverCoreBalanceMaterial = new THREE.ShaderMaterial({
    vertexShader: SIM_VERTEX_SHADER,
    fragmentShader: RIVER_CORE_BALANCE_FRAGMENT_SHADER,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uRiverCoreSupport: { value: riverCoreSupportTarget.texture },
      uRiverCoreMass: { value: riverCoreMassTarget.texture },
      uPreviousCoreBalance: { value: riverCoreBalanceTarget.texture },
      uPreviousRiver: { value: riverPhaseRead.texture },
      uRegionalFlow: { value: regionalFlowTarget.texture },
      uTexel: { value: new THREE.Vector2(1 / size, 1 / size) },
      uFlowDirection: { value: 92 * Math.PI / 180 },
    },
  });

  const riverCoreMassMaterial = new THREE.ShaderMaterial({
    vertexShader: SIM_VERTEX_SHADER,
    fragmentShader: RIVER_CORE_MASS_FRAGMENT_SHADER,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uRiverCoreSupport: { value: riverCoreSupportTarget.texture },
      uPreviousCoreBalance: { value: riverCoreBalanceTarget.texture },
      uRegionalFlow: { value: regionalFlowTarget.texture },
      uFieldTexel: { value: new THREE.Vector2(1 / size, 1 / size) },
      uTileTexel: { value: new THREE.Vector2(1 / regionalSupportSize, 1 / regionalSupportSize) },
      uFlowDirection: { value: 92 * Math.PI / 180 },
    },
  });

  const riverCoreTransportMaterial = new THREE.ShaderMaterial({
    vertexShader: SIM_VERTEX_SHADER,
    fragmentShader: RIVER_CORE_TRANSPORT_FRAGMENT_SHADER,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uField: { value: fieldRead.texture },
      uRiverCoreMass: { value: riverCoreMassTarget.texture },
      uPreviousCoreTransport: { value: riverCoreTransportReadTarget.texture },
      uRegionalFlow: { value: regionalFlowTarget.texture },
      uTexel: { value: new THREE.Vector2(1 / regionalSupportSize, 1 / regionalSupportSize) },
      uFieldTexel: { value: new THREE.Vector2(1 / size, 1 / size) },
      uFlowDirection: { value: 92 * Math.PI / 180 },
    },
  });

  const riverPathEvidenceMaterial = new THREE.ShaderMaterial({
    vertexShader: SIM_VERTEX_SHADER,
    fragmentShader: RIVER_PATH_EVIDENCE_FRAGMENT_SHADER,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uField: { value: fieldRead.texture },
      uVelocity: { value: velocityRead.texture },
      uRiverCoreMass: { value: riverCoreMassTarget.texture },
      uRegionalFlow: { value: regionalFlowTarget.texture },
      uTileTexel: { value: new THREE.Vector2(1 / regionalSupportSize, 1 / regionalSupportSize) },
      uFieldTexel: { value: new THREE.Vector2(1 / size, 1 / size) },
      uFlowDirection: { value: 92 * Math.PI / 180 },
      uPathDiagnosticMode: { value: 0 },
    },
  });

  const riverPathCostMaterial = new THREE.ShaderMaterial({
    vertexShader: SIM_VERTEX_SHADER,
    fragmentShader: RIVER_PATH_COST_FRAGMENT_SHADER,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uField: { value: fieldRead.texture },
      uVelocity: { value: velocityRead.texture },
      uRiverCoreMass: { value: riverCoreMassTarget.texture },
      uRegionalFlow: { value: regionalFlowTarget.texture },
      uTileTexel: { value: new THREE.Vector2(1 / regionalSupportSize, 1 / regionalSupportSize) },
      uFieldTexel: { value: new THREE.Vector2(1 / size, 1 / size) },
      uFlowDirection: { value: 92 * Math.PI / 180 },
      uPathDiagnosticMode: { value: 0 },
    },
  });

  const riverPathSkeletonMaterial = new THREE.ShaderMaterial({
    vertexShader: SIM_VERTEX_SHADER,
    fragmentShader: RIVER_PATH_SKELETON_FRAGMENT_SHADER,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uPathCost: { value: riverPathCostTarget.texture },
      uRegionalFlow: { value: regionalFlowTarget.texture },
      uTexel: { value: new THREE.Vector2(1 / regionalSupportSize, 1 / regionalSupportSize) },
      uFlowDirection: { value: 92 * Math.PI / 180 },
    },
  });

  const riverPathHeatMaterial = new THREE.ShaderMaterial({
    vertexShader: SIM_VERTEX_SHADER,
    fragmentShader: RIVER_PATH_HEAT_FRAGMENT_SHADER,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uPathEvidence: { value: riverPathEvidenceTarget.texture },
      uPathCost: { value: riverPathCostTarget.texture },
      uPreviousPathHeat: { value: riverPathHeatReadTarget.texture },
      uRiverCoreMass: { value: riverCoreMassTarget.texture },
      uRegionalFlow: { value: regionalFlowTarget.texture },
      uTexel: { value: new THREE.Vector2(1 / regionalSupportSize, 1 / regionalSupportSize) },
      uFlowDirection: { value: 92 * Math.PI / 180 },
    },
  });

  const riverCoreGeodesicMaterial = new THREE.ShaderMaterial({
    vertexShader: SIM_VERTEX_SHADER,
    fragmentShader: RIVER_CORE_GEODESIC_FRAGMENT_SHADER,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uRiverCoreMass: { value: riverCoreMassTarget.texture },
      uPathEvidence: { value: riverPathHeatReadTarget.texture },
      uPreviousGeodesic: { value: riverCoreGeodesicReadTarget.texture },
      uRegionalFlow: { value: regionalFlowTarget.texture },
      uTexel: { value: new THREE.Vector2(1 / regionalSupportSize, 1 / regionalSupportSize) },
      uFlowDirection: { value: 92 * Math.PI / 180 },
    },
  });

  const regionalEvolveMaterial = new THREE.ShaderMaterial({
    vertexShader: SIM_VERTEX_SHADER,
    fragmentShader: REGIONAL_EVOLVE_FRAGMENT_SHADER,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uRegionalSource: { value: regionalSupportTarget.texture },
      uRegionalPrevious: { value: regionalEvolveRead.texture },
      uVelocity: { value: velocityRead.texture },
      uTexel: { value: new THREE.Vector2(1 / regionalSupportSize, 1 / regionalSupportSize) },
      uDelta: { value: FIXED_SIM_DT },
      uFlowDirection: { value: 92 * Math.PI / 180 },
      uDripAmount: { value: 1.24 },
    },
  });

  const regionalRidgeMaterial = new THREE.ShaderMaterial({
    vertexShader: SIM_VERTEX_SHADER,
    fragmentShader: REGIONAL_RIDGE_FRAGMENT_SHADER,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uField: { value: fieldRead.texture },
      uVelocity: { value: velocityRead.texture },
      uRegionalSupport: { value: regionalSupportTarget.texture },
      uTexel: { value: new THREE.Vector2(1 / regionalSupportSize, 1 / regionalSupportSize) },
      uFieldTexel: { value: new THREE.Vector2(1 / size, 1 / size) },
      uFlowDirection: { value: 92 * Math.PI / 180 },
      uCapillary: { value: 0.52 },
    },
  });

  const phasePotentialMaterial = new THREE.ShaderMaterial({
    vertexShader: SIM_VERTEX_SHADER,
    fragmentShader: PHASE_POTENTIAL_FRAGMENT_SHADER,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uField: { value: fieldRead.texture },
      uVelocity: { value: velocityRead.texture },
      uRegionalSupport: { value: regionalSupportTarget.texture },
      uRiverPhase: { value: riverPhaseRead.texture },
      uRiverPathCost: { value: riverPathCostTarget.texture },
      uTexel: { value: new THREE.Vector2(1 / size, 1 / size) },
      uTime: { value: 0 },
      uFlowDirection: { value: 92 * Math.PI / 180 },
      uCapillary: { value: 0.52 },
    },
  });

  const phaseAreaMaterial = new THREE.ShaderMaterial({
    vertexShader: SIM_VERTEX_SHADER,
    fragmentShader: PHASE_AREA_FRAGMENT_SHADER,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uField: { value: fieldRead.texture },
      uVelocity: { value: velocityRead.texture },
      uRegionalSupport: { value: regionalRidgeTarget.texture },
      uRiverPhase: { value: riverPhaseRead.texture },
      uRiverPathCost: { value: riverPathCostTarget.texture },
      uFilamentConnectivity: { value: filamentConnectivityReadTarget.texture },
      uHuangFrontState: { value: huangFrontStateReadTarget.texture },
      uEtaGammaVelocity: { value: etaGammaVelocityTarget.texture },
      uGammaCandidate: { value: gammaCandidateDiagnosticTarget.texture },
      uFieldTexel: { value: new THREE.Vector2(1 / size, 1 / size) },
      uTileTexel: { value: new THREE.Vector2(1 / phaseAreaSize, 1 / phaseAreaSize) },
      uFlowDirection: { value: 92 * Math.PI / 180 },
      uCapillary: { value: 0.52 },
      uAreaDiagnosticMode: { value: 0 },
    },
  });

  const filamentConnectivityMaterial = new THREE.ShaderMaterial({
    vertexShader: SIM_VERTEX_SHADER,
    fragmentShader: FILAMENT_CONNECTIVITY_FRAGMENT_SHADER,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uField: { value: fieldRead.texture },
      uVelocity: { value: velocityRead.texture },
      uRegionalSupport: { value: regionalRidgeTarget.texture },
      uRiverPathCost: { value: riverPathCostTarget.texture },
      uPreviousFilament: { value: filamentConnectivityReadTarget.texture },
      uHuangLocalDiagnostic: { value: huangLocalDiagnosticTarget.texture },
      uHuangFrontState: { value: huangFrontStateReadTarget.texture },
      uFieldTexel: { value: new THREE.Vector2(1 / size, 1 / size) },
      uTileTexel: { value: new THREE.Vector2(1 / regionalSupportSize, 1 / regionalSupportSize) },
      uFlowDirection: { value: 92 * Math.PI / 180 },
      uCapillary: { value: 0.52 },
      uDelta: { value: FIXED_SIM_DT },
    },
  });

  const huangFrontStateMaterial = new THREE.ShaderMaterial({
    vertexShader: SIM_VERTEX_SHADER,
    fragmentShader: HUANG_FRONT_STATE_FRAGMENT_SHADER,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uField: { value: fieldRead.texture },
      uVelocity: { value: velocityRead.texture },
      uHuangLocalDiagnostic: { value: huangLocalDiagnosticTarget.texture },
      uPreviousFront: { value: huangFrontStateReadTarget.texture },
      uGammaCandidate: { value: gammaCandidateDiagnosticTarget.texture },
      uEtaGammaVelocity: { value: etaGammaVelocityTarget.texture },
      uTransportResidual: { value: huangResidualTransportReadTarget.texture },
      uHuangMapState: { value: huangMapStateReadTarget.texture },
      uHuangForwardMapState: { value: huangForwardMapStateReadTarget.texture },
      uFieldTexel: { value: new THREE.Vector2(1 / size, 1 / size) },
      uTileTexel: { value: new THREE.Vector2(1 / huangFrontStateSize, 1 / huangFrontStateSize) },
      uDelta: { value: FIXED_SIM_DT },
      uFlowDirection: { value: 92 * Math.PI / 180 },
    },
  });

  const huangMapStateMaterial = new THREE.ShaderMaterial({
    vertexShader: SIM_VERTEX_SHADER,
    fragmentShader: HUANG_MAP_STATE_FRAGMENT_SHADER,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uField: { value: fieldRead.texture },
      uVelocity: { value: velocityRead.texture },
      uHuangLocalDiagnostic: { value: huangLocalDiagnosticTarget.texture },
      uGammaCandidate: { value: gammaCandidateDiagnosticTarget.texture },
      uEtaGammaVelocity: { value: etaGammaVelocityTarget.texture },
      uPreviousMap: { value: huangMapStateReadTarget.texture },
      uPairMap: { value: huangForwardMapStateReadTarget.texture },
      uFieldTexel: { value: new THREE.Vector2(1 / size, 1 / size) },
      uDelta: { value: FIXED_SIM_DT },
      uFlowDirection: { value: 92 * Math.PI / 180 },
      uMapDirection: { value: -1 },
    },
  });

  const huangForwardMapStateMaterial = new THREE.ShaderMaterial({
    vertexShader: SIM_VERTEX_SHADER,
    fragmentShader: HUANG_MAP_STATE_FRAGMENT_SHADER,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uField: { value: fieldRead.texture },
      uVelocity: { value: velocityRead.texture },
      uHuangLocalDiagnostic: { value: huangLocalDiagnosticTarget.texture },
      uGammaCandidate: { value: gammaCandidateDiagnosticTarget.texture },
      uEtaGammaVelocity: { value: etaGammaVelocityTarget.texture },
      uPreviousMap: { value: huangForwardMapStateReadTarget.texture },
      uPairMap: { value: huangMapStateReadTarget.texture },
      uFieldTexel: { value: new THREE.Vector2(1 / size, 1 / size) },
      uDelta: { value: FIXED_SIM_DT },
      uFlowDirection: { value: 92 * Math.PI / 180 },
      uMapDirection: { value: 1 },
    },
  });

  const huangResidualTransportMaterial = new THREE.ShaderMaterial({
    vertexShader: SIM_VERTEX_SHADER,
    fragmentShader: HUANG_RESIDUAL_TRANSPORT_FRAGMENT_SHADER,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uField: { value: fieldRead.texture },
      uVelocity: { value: velocityRead.texture },
      uHuangLocalDiagnostic: { value: huangLocalDiagnosticTarget.texture },
      uGammaCandidate: { value: gammaCandidateDiagnosticTarget.texture },
      uEtaGammaVelocity: { value: etaGammaVelocityTarget.texture },
      uPreviousTransport: { value: huangResidualTransportReadTarget.texture },
      uHuangMapState: { value: huangMapStateReadTarget.texture },
      uHuangForwardMapState: { value: huangForwardMapStateReadTarget.texture },
      uFieldTexel: { value: new THREE.Vector2(1 / size, 1 / size) },
      uDelta: { value: FIXED_SIM_DT },
      uFlowDirection: { value: 92 * Math.PI / 180 },
    },
  });

  const filamentConnectivityDiagnosticMaterial = new THREE.ShaderMaterial({
    vertexShader: SIM_VERTEX_SHADER,
    fragmentShader: FILAMENT_CONNECTIVITY_DIAGNOSTIC_FRAGMENT_SHADER,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uFilamentConnectivity: { value: filamentConnectivityReadTarget.texture },
    },
  });

  const riverPhaseMaterial = new THREE.ShaderMaterial({
    vertexShader: SIM_VERTEX_SHADER,
    fragmentShader: RIVER_PHASE_FRAGMENT_SHADER,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uField: { value: fieldRead.texture },
      uVelocity: { value: velocityRead.texture },
      uPreviousRiver: { value: riverPhaseRead.texture },
      uRegionalSupport: { value: regionalRidgeTarget.texture },
      uRegionalFlow: { value: regionalFlowTarget.texture },
      uRiverCoreSupport: { value: riverCoreSupportTarget.texture },
      uTexel: { value: new THREE.Vector2(1 / size, 1 / size) },
      uDelta: { value: FIXED_SIM_DT },
      uFlowDirection: { value: 92 * Math.PI / 180 },
      uDripAmount: { value: 1.24 },
      uCapillary: { value: 0.52 },
    },
  });

  const riverMeniscusMaterial = new THREE.ShaderMaterial({
    name: "soap-film-river-meniscus",
    vertexShader: SIM_VERTEX_SHADER,
    fragmentShader: RIVER_MENISCUS_FRAGMENT_SHADER,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uField: { value: fieldRead.texture },
      uVelocity: { value: velocityRead.texture },
      uPreviousRiver: { value: riverPhaseRead.texture },
      uRegionalFlow: { value: regionalFlowTarget.texture },
      uTexel: { value: new THREE.Vector2(1 / size, 1 / size) },
      uDelta: { value: FIXED_SIM_DT },
      uFlowDirection: { value: 92 * Math.PI / 180 },
      uDripAmount: { value: 1.24 },
      uCapillary: { value: 0.52 },
    },
  });

  const riverHeightFluxMaterial = new THREE.ShaderMaterial({
    vertexShader: SIM_VERTEX_SHADER,
    fragmentShader: RIVER_HEIGHT_FLUX_FRAGMENT_SHADER,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uField: { value: fieldRead.texture },
      uVelocity: { value: velocityRead.texture },
      uRiverPhase: { value: riverPhaseRead.texture },
      uRegionalFlow: { value: regionalFlowTarget.texture },
      uTexel: { value: new THREE.Vector2(1 / size, 1 / size) },
      uFlowDirection: { value: 92 * Math.PI / 180 },
      uDripAmount: { value: 1.24 },
      uCapillary: { value: 0.52 },
    },
  });

  const phaseMaterial = new THREE.ShaderMaterial({
    vertexShader: SIM_VERTEX_SHADER,
    fragmentShader: PHASE_STEP_FRAGMENT_SHADER,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uField: { value: fieldRead.texture },
      uPotential: { value: phasePotentialTarget.texture },
      uVelocity: { value: velocityRead.texture },
      uRegionalFlow: { value: regionalFlowTarget.texture },
      uRiverPhase: { value: riverPhaseRead.texture },
      uRiverPathCost: { value: riverPathCostTarget.texture },
      uPhaseArea: { value: phaseAreaTarget.texture },
      uFilamentConnectivity: { value: filamentConnectivityReadTarget.texture },
      uHuangFrontState: { value: huangFrontStateReadTarget.texture },
      uTexel: { value: new THREE.Vector2(1 / size, 1 / size) },
      uDelta: { value: FIXED_SIM_DT },
      uDiffusion: { value: 0.38 },
      uDripAmount: { value: 1.24 },
      uFlowDirection: { value: 92 * Math.PI / 180 },
      uFoamSource: { value: 0.78 },
      uFoamDecay: { value: 0.28 },
    },
  });

  initFieldMaterial.name = "soap-film-init-field";
  initVelocityMaterial.name = "soap-film-init-velocity";
  velocityMaterial.name = "soap-film-velocity-step";
  divergenceMaterial.name = "soap-film-divergence";
  clearPressureMaterial.name = "soap-film-clear-pressure";
  pressureJacobiMaterial.name = "soap-film-pressure-jacobi";
  projectVelocityMaterial.name = "soap-film-project-velocity";
  gammaImplicitMaterial.name = "soap-film-gamma-implicit";
  gammaResidualMaterial.name = "soap-film-gamma-residual";
  gammaProjectionJacobiMaterial.name = "soap-film-gamma-projection-jacobi";
  gammaTileMassMaterial.name = "soap-film-gamma-tile-mass";
  gammaTileMassCorrectionMaterial.name = "soap-film-gamma-tile-mass-correction";
  gammaCandidateDiagnosticMaterial.name = "soap-film-gamma-candidate-diagnostic";
  etaGammaVelocityDiagnosticMaterial.name = "soap-film-eta-gamma-velocity-diagnostic";
  huangLocalDiagnosticMaterial.name = "soap-film-huang-local-diagnostic";
  huangMapStateMaterial.name = "soap-film-huang-map-state";
  huangForwardMapStateMaterial.name = "soap-film-huang-forward-map-state";
  huangFrontStateMaterial.name = "soap-film-huang-front-state";
  huangResidualTransportMaterial.name = "soap-film-huang-residual-transport";
  gammaVelocityCorrectionMaterial.name = "soap-film-gamma-velocity-correction";
  gammaProjectionDivergenceMaterial.name = "soap-film-gamma-projection-divergence";
  gammaDivergenceFeedbackMaterial.name = "soap-film-gamma-divergence-feedback";
  gammaContinuityMaterial.name = "soap-film-gamma-continuity";
  fieldMaterial.name = "soap-film-field-step";
  initRiverPhaseMaterial.name = "soap-film-init-river-phase";
  regionalSupportMaterial.name = "soap-film-regional-support";
  regionalFlowMaterial.name = "soap-film-regional-flow";
  riverCoreSupportMaterial.name = "soap-film-river-core-support";
  riverCoreBalanceMaterial.name = "soap-film-river-core-balance";
  riverCoreMassMaterial.name = "soap-film-river-core-mass";
  riverCoreTransportMaterial.name = "soap-film-river-core-transport";
  riverPathEvidenceMaterial.name = "soap-film-river-path-evidence";
  riverPathCostMaterial.name = "soap-film-river-path-cost";
  riverPathSkeletonMaterial.name = "soap-film-river-path-skeleton";
  riverPathHeatMaterial.name = "soap-film-river-path-heat";
  riverCoreGeodesicMaterial.name = "soap-film-river-core-geodesic";
  regionalEvolveMaterial.name = "soap-film-regional-evolve";
  regionalRidgeMaterial.name = "soap-film-regional-ridge";
  phasePotentialMaterial.name = "soap-film-phase-potential";
  phaseAreaMaterial.name = "soap-film-phase-area";
  filamentConnectivityMaterial.name = "soap-film-filament-connectivity";
  filamentConnectivityDiagnosticMaterial.name = "soap-film-filament-connectivity-diagnostic";
  riverPhaseMaterial.name = "soap-film-river-phase";
  riverMeniscusMaterial.name = "soap-film-river-meniscus";
  riverHeightFluxMaterial.name = "soap-film-river-height-flux";
  phaseMaterial.name = "soap-film-phase-step";

  let lastTime = 0;
  let accumulator = 0;
  let simTime = 0;
  let needsPrewarm = true;
  let diagnosticStep = 0;
  let diagnosticReadStep = -1;
  let diagnosticReadback = new Uint8Array(size * size * 4);
  let gammaResidualReadback = new Uint8Array(size * size * 4);
  let gammaCandidateDiagnosticReadback = new Uint8Array(size * size * 4);
  let fieldDiagnosticReadback = new Uint8Array(size * size * 4);
  let huangMapStateReadback = new Uint8Array(size * size * 4);
  let huangForwardMapStateReadback = new Uint8Array(size * size * 4);
  let huangResidualTransportReadback = new Uint8Array(size * size * 4);
  let huangFrontStateReadback = new Uint8Array(huangFrontStateSize * huangFrontStateSize * 4);
  let filamentConnectivityReadback = new Uint8Array(regionalSupportSize * regionalSupportSize * 4);
  let phaseAreaDiagnosticReadback = new Uint8Array(phaseAreaSize * phaseAreaSize * 4);
  let phaseAreaSkeletonReadback = new Uint8Array(phaseAreaSize * phaseAreaSize * 4);
  let lastDiagnosticDelta = FIXED_SIM_DT;
  let lastDiagnostics = null;

  function assignTextures() {
    velocityMaterial.uniforms.uField.value = fieldRead.texture;
    velocityMaterial.uniforms.uVelocity.value = velocityRead.texture;
    divergenceMaterial.uniforms.uVelocity.value = velocityRead.texture;
    pressureJacobiMaterial.uniforms.uPressure.value = pressureRead.texture;
    pressureJacobiMaterial.uniforms.uDivergence.value = divergenceTarget.texture;
    projectVelocityMaterial.uniforms.uVelocity.value = velocityRead.texture;
    projectVelocityMaterial.uniforms.uPressure.value = pressureRead.texture;
    gammaImplicitMaterial.uniforms.uField.value = fieldRead.texture;
    gammaImplicitMaterial.uniforms.uVelocity.value = velocityRead.texture;
    gammaResidualMaterial.uniforms.uField.value = fieldRead.texture;
    gammaResidualMaterial.uniforms.uVelocity.value = velocityRead.texture;
    gammaProjectionJacobiMaterial.uniforms.uBaseField.value = fieldRead.texture;
    gammaProjectionJacobiMaterial.uniforms.uSolveField.value = gammaSolveReadTarget.texture;
    gammaProjectionJacobiMaterial.uniforms.uVelocity.value = velocityRead.texture;
    gammaTileMassMaterial.uniforms.uField.value = fieldRead.texture;
    gammaTileMassCorrectionMaterial.uniforms.uField.value = fieldRead.texture;
    gammaTileMassCorrectionMaterial.uniforms.uTileBefore.value = gammaTileMassBeforeTarget.texture;
    gammaTileMassCorrectionMaterial.uniforms.uTileAfter.value = gammaTileMassAfterTarget.texture;
    gammaCandidateDiagnosticMaterial.uniforms.uField.value = fieldRead.texture;
    gammaCandidateDiagnosticMaterial.uniforms.uVelocity.value = velocityRead.texture;
    etaGammaVelocityDiagnosticMaterial.uniforms.uField.value = fieldRead.texture;
    etaGammaVelocityDiagnosticMaterial.uniforms.uVelocity.value = velocityRead.texture;
    fieldDiagnosticMaterial.uniforms.uField.value = fieldRead.texture;
    huangLocalDiagnosticMaterial.uniforms.uField.value = fieldRead.texture;
    huangLocalDiagnosticMaterial.uniforms.uVelocity.value = velocityRead.texture;
    huangMapStateMaterial.uniforms.uField.value = fieldRead.texture;
    huangMapStateMaterial.uniforms.uVelocity.value = velocityRead.texture;
    huangMapStateMaterial.uniforms.uHuangLocalDiagnostic.value = huangLocalDiagnosticTarget.texture;
    huangMapStateMaterial.uniforms.uGammaCandidate.value = gammaCandidateDiagnosticTarget.texture;
    huangMapStateMaterial.uniforms.uEtaGammaVelocity.value = etaGammaVelocityTarget.texture;
    huangMapStateMaterial.uniforms.uPreviousMap.value = huangMapStateReadTarget.texture;
    huangMapStateMaterial.uniforms.uPairMap.value = huangForwardMapStateReadTarget.texture;
    huangForwardMapStateMaterial.uniforms.uField.value = fieldRead.texture;
    huangForwardMapStateMaterial.uniforms.uVelocity.value = velocityRead.texture;
    huangForwardMapStateMaterial.uniforms.uHuangLocalDiagnostic.value = huangLocalDiagnosticTarget.texture;
    huangForwardMapStateMaterial.uniforms.uGammaCandidate.value = gammaCandidateDiagnosticTarget.texture;
    huangForwardMapStateMaterial.uniforms.uEtaGammaVelocity.value = etaGammaVelocityTarget.texture;
    huangForwardMapStateMaterial.uniforms.uPreviousMap.value = huangForwardMapStateReadTarget.texture;
    huangForwardMapStateMaterial.uniforms.uPairMap.value = huangMapStateReadTarget.texture;
    huangFrontStateMaterial.uniforms.uField.value = fieldRead.texture;
    huangFrontStateMaterial.uniforms.uVelocity.value = velocityRead.texture;
    huangFrontStateMaterial.uniforms.uHuangLocalDiagnostic.value = huangLocalDiagnosticTarget.texture;
    huangFrontStateMaterial.uniforms.uPreviousFront.value = huangFrontStateReadTarget.texture;
    huangFrontStateMaterial.uniforms.uGammaCandidate.value = gammaCandidateDiagnosticTarget.texture;
    huangFrontStateMaterial.uniforms.uEtaGammaVelocity.value = etaGammaVelocityTarget.texture;
    huangFrontStateMaterial.uniforms.uTransportResidual.value = huangResidualTransportReadTarget.texture;
    huangFrontStateMaterial.uniforms.uHuangMapState.value = huangMapStateReadTarget.texture;
    huangFrontStateMaterial.uniforms.uHuangForwardMapState.value = huangForwardMapStateReadTarget.texture;
    huangResidualTransportMaterial.uniforms.uField.value = fieldRead.texture;
    huangResidualTransportMaterial.uniforms.uVelocity.value = velocityRead.texture;
    huangResidualTransportMaterial.uniforms.uHuangLocalDiagnostic.value = huangLocalDiagnosticTarget.texture;
    huangResidualTransportMaterial.uniforms.uGammaCandidate.value = gammaCandidateDiagnosticTarget.texture;
    huangResidualTransportMaterial.uniforms.uEtaGammaVelocity.value = etaGammaVelocityTarget.texture;
    huangResidualTransportMaterial.uniforms.uPreviousTransport.value = huangResidualTransportReadTarget.texture;
    huangResidualTransportMaterial.uniforms.uHuangMapState.value = huangMapStateReadTarget.texture;
    huangResidualTransportMaterial.uniforms.uHuangForwardMapState.value = huangForwardMapStateReadTarget.texture;
    gammaVelocityCorrectionMaterial.uniforms.uField.value = fieldRead.texture;
    gammaVelocityCorrectionMaterial.uniforms.uVelocity.value = velocityRead.texture;
    gammaVelocityCorrectionMaterial.uniforms.uGammaResidual.value = gammaCandidateDiagnosticTarget.texture;
    gammaProjectionDivergenceMaterial.uniforms.uField.value = gammaCandidateTarget.texture;
    gammaProjectionDivergenceMaterial.uniforms.uVelocity.value = velocityRead.texture;
    gammaDivergenceFeedbackMaterial.uniforms.uField.value = fieldRead.texture;
    gammaDivergenceFeedbackMaterial.uniforms.uVelocity.value = velocityRead.texture;
    gammaDivergenceFeedbackMaterial.uniforms.uGammaProjection.value = gammaProjectionDivergenceTarget.texture;
    gammaContinuityMaterial.uniforms.uField.value = fieldRead.texture;
    gammaContinuityMaterial.uniforms.uVelocity.value = velocityRead.texture;
    fieldMaterial.uniforms.uField.value = fieldRead.texture;
    fieldMaterial.uniforms.uVelocity.value = velocityRead.texture;
    fieldMaterial.uniforms.uRiverPhase.value = riverPhaseRead.texture;
    fieldMaterial.uniforms.uRiverHeightFlux.value = riverHeightFluxTarget.texture;
    regionalSupportMaterial.uniforms.uField.value = fieldRead.texture;
    regionalSupportMaterial.uniforms.uVelocity.value = velocityRead.texture;
    regionalEvolveMaterial.uniforms.uRegionalSource.value = regionalSupportTarget.texture;
    regionalEvolveMaterial.uniforms.uRegionalPrevious.value = regionalEvolveRead.texture;
    regionalEvolveMaterial.uniforms.uVelocity.value = velocityRead.texture;
    regionalRidgeMaterial.uniforms.uField.value = fieldRead.texture;
    regionalRidgeMaterial.uniforms.uVelocity.value = velocityRead.texture;
    regionalRidgeMaterial.uniforms.uRegionalSupport.value = regionalEvolveRead.texture;
    regionalFlowMaterial.uniforms.uRegionalSupport.value = regionalRidgeTarget.texture;
    regionalFlowMaterial.uniforms.uVelocity.value = velocityRead.texture;
    riverCoreSupportMaterial.uniforms.uField.value = fieldRead.texture;
    riverCoreSupportMaterial.uniforms.uVelocity.value = velocityRead.texture;
    riverCoreSupportMaterial.uniforms.uPreviousRiver.value = riverPhaseRead.texture;
    riverCoreSupportMaterial.uniforms.uRegionalSupport.value = regionalRidgeTarget.texture;
    riverCoreSupportMaterial.uniforms.uRegionalFlow.value = regionalFlowTarget.texture;
    riverCoreMassMaterial.uniforms.uRiverCoreSupport.value = riverCoreSupportTarget.texture;
    riverCoreMassMaterial.uniforms.uPreviousCoreBalance.value = riverCoreBalanceTarget.texture;
    riverCoreMassMaterial.uniforms.uRegionalFlow.value = regionalFlowTarget.texture;
    riverPathCostMaterial.uniforms.uField.value = fieldRead.texture;
    riverPathCostMaterial.uniforms.uVelocity.value = velocityRead.texture;
    riverPathCostMaterial.uniforms.uRiverCoreMass.value = riverCoreMassTarget.texture;
    riverPathCostMaterial.uniforms.uRegionalFlow.value = regionalFlowTarget.texture;
    riverPathSkeletonMaterial.uniforms.uPathCost.value = riverPathCostTarget.texture;
    riverPathSkeletonMaterial.uniforms.uRegionalFlow.value = regionalFlowTarget.texture;
    riverPathEvidenceMaterial.uniforms.uField.value = fieldRead.texture;
    riverPathEvidenceMaterial.uniforms.uVelocity.value = velocityRead.texture;
    riverPathEvidenceMaterial.uniforms.uRiverCoreMass.value = riverCoreMassTarget.texture;
    riverPathEvidenceMaterial.uniforms.uRegionalFlow.value = regionalFlowTarget.texture;
    riverPathHeatMaterial.uniforms.uPathEvidence.value = riverPathEvidenceTarget.texture;
    riverPathHeatMaterial.uniforms.uPathCost.value = riverPathCostTarget.texture;
    riverPathHeatMaterial.uniforms.uPreviousPathHeat.value = riverPathHeatReadTarget.texture;
    riverPathHeatMaterial.uniforms.uRiverCoreMass.value = riverCoreMassTarget.texture;
    riverPathHeatMaterial.uniforms.uRegionalFlow.value = regionalFlowTarget.texture;
    riverCoreGeodesicMaterial.uniforms.uRiverCoreMass.value = riverCoreMassTarget.texture;
    riverCoreGeodesicMaterial.uniforms.uPathEvidence.value = riverPathHeatReadTarget.texture;
    riverCoreGeodesicMaterial.uniforms.uPreviousGeodesic.value = riverCoreGeodesicReadTarget.texture;
    riverCoreGeodesicMaterial.uniforms.uRegionalFlow.value = regionalFlowTarget.texture;
    riverCoreTransportMaterial.uniforms.uField.value = fieldRead.texture;
    riverCoreTransportMaterial.uniforms.uRiverCoreMass.value = riverCoreMassTarget.texture;
    riverCoreTransportMaterial.uniforms.uPreviousCoreTransport.value = riverCoreTransportReadTarget.texture;
    riverCoreTransportMaterial.uniforms.uRegionalFlow.value = regionalFlowTarget.texture;
    riverCoreBalanceMaterial.uniforms.uRiverCoreSupport.value = riverCoreSupportTarget.texture;
    riverCoreBalanceMaterial.uniforms.uRiverCoreMass.value = riverCoreGeodesicReadTarget.texture;
    riverCoreBalanceMaterial.uniforms.uPreviousCoreBalance.value = riverCoreBalanceTarget.texture;
    riverCoreBalanceMaterial.uniforms.uPreviousRiver.value = riverPhaseRead.texture;
    riverCoreBalanceMaterial.uniforms.uRegionalFlow.value = regionalFlowTarget.texture;
    riverPhaseMaterial.uniforms.uField.value = fieldRead.texture;
    riverPhaseMaterial.uniforms.uVelocity.value = velocityRead.texture;
    riverPhaseMaterial.uniforms.uPreviousRiver.value = riverPhaseRead.texture;
    riverPhaseMaterial.uniforms.uRegionalSupport.value = regionalRidgeTarget.texture;
    riverPhaseMaterial.uniforms.uRegionalFlow.value = regionalFlowTarget.texture;
    riverPhaseMaterial.uniforms.uRiverCoreSupport.value = riverCoreBalanceTarget.texture;
    riverMeniscusMaterial.uniforms.uField.value = fieldRead.texture;
    riverMeniscusMaterial.uniforms.uVelocity.value = velocityRead.texture;
    riverMeniscusMaterial.uniforms.uPreviousRiver.value = riverPhaseRead.texture;
    riverMeniscusMaterial.uniforms.uRegionalFlow.value = regionalFlowTarget.texture;
    riverHeightFluxMaterial.uniforms.uField.value = fieldRead.texture;
    riverHeightFluxMaterial.uniforms.uVelocity.value = velocityRead.texture;
    riverHeightFluxMaterial.uniforms.uRiverPhase.value = riverPhaseRead.texture;
    riverHeightFluxMaterial.uniforms.uRegionalFlow.value = regionalFlowTarget.texture;
    phasePotentialMaterial.uniforms.uField.value = fieldRead.texture;
    phasePotentialMaterial.uniforms.uVelocity.value = velocityRead.texture;
    phasePotentialMaterial.uniforms.uRegionalSupport.value = regionalRidgeTarget.texture;
    phasePotentialMaterial.uniforms.uRiverPhase.value = riverPhaseRead.texture;
    phasePotentialMaterial.uniforms.uRiverPathCost.value = riverPathCostTarget.texture;
    phaseAreaMaterial.uniforms.uField.value = fieldRead.texture;
    phaseAreaMaterial.uniforms.uVelocity.value = velocityRead.texture;
    phaseAreaMaterial.uniforms.uRegionalSupport.value = regionalRidgeTarget.texture;
    phaseAreaMaterial.uniforms.uRiverPhase.value = riverPhaseRead.texture;
    phaseAreaMaterial.uniforms.uRiverPathCost.value = riverPathCostTarget.texture;
    phaseAreaMaterial.uniforms.uFilamentConnectivity.value = filamentConnectivityReadTarget.texture;
    phaseAreaMaterial.uniforms.uHuangFrontState.value = huangFrontStateReadTarget.texture;
    phaseAreaMaterial.uniforms.uEtaGammaVelocity.value = etaGammaVelocityTarget.texture;
    phaseAreaMaterial.uniforms.uGammaCandidate.value = gammaCandidateDiagnosticTarget.texture;
    filamentConnectivityMaterial.uniforms.uField.value = fieldRead.texture;
    filamentConnectivityMaterial.uniforms.uVelocity.value = velocityRead.texture;
    filamentConnectivityMaterial.uniforms.uRegionalSupport.value = regionalRidgeTarget.texture;
    filamentConnectivityMaterial.uniforms.uRiverPathCost.value = riverPathCostTarget.texture;
    filamentConnectivityMaterial.uniforms.uPreviousFilament.value = filamentConnectivityReadTarget.texture;
    filamentConnectivityMaterial.uniforms.uHuangLocalDiagnostic.value = huangLocalDiagnosticTarget.texture;
    filamentConnectivityMaterial.uniforms.uHuangFrontState.value = huangFrontStateReadTarget.texture;
    filamentConnectivityDiagnosticMaterial.uniforms.uFilamentConnectivity.value = filamentConnectivityReadTarget.texture;
    phaseMaterial.uniforms.uField.value = fieldRead.texture;
    phaseMaterial.uniforms.uVelocity.value = velocityRead.texture;
    phaseMaterial.uniforms.uPotential.value = phasePotentialTarget.texture;
    phaseMaterial.uniforms.uRegionalFlow.value = regionalFlowTarget.texture;
    phaseMaterial.uniforms.uRiverPhase.value = riverPhaseRead.texture;
    phaseMaterial.uniforms.uRiverPathCost.value = riverPathCostTarget.texture;
    phaseMaterial.uniforms.uPhaseArea.value = phaseAreaTarget.texture;
    phaseMaterial.uniforms.uFilamentConnectivity.value = filamentConnectivityReadTarget.texture;
    phaseMaterial.uniforms.uHuangFrontState.value = huangFrontStateReadTarget.texture;
  }

  function updateTexelUniforms() {
    const texel = new THREE.Vector2(1 / size, 1 / size);
    const regionalTexel = new THREE.Vector2(1 / regionalSupportSize, 1 / regionalSupportSize);
    const frontStateTexel = new THREE.Vector2(1 / huangFrontStateSize, 1 / huangFrontStateSize);
    const phaseAreaTexel = new THREE.Vector2(1 / phaseAreaSize, 1 / phaseAreaSize);
    velocityMaterial.uniforms.uTexel.value.copy(texel);
    divergenceMaterial.uniforms.uTexel.value.copy(texel);
    pressureJacobiMaterial.uniforms.uTexel.value.copy(texel);
    projectVelocityMaterial.uniforms.uTexel.value.copy(texel);
    gammaImplicitMaterial.uniforms.uTexel.value.copy(texel);
    gammaResidualMaterial.uniforms.uTexel.value.copy(texel);
    gammaProjectionJacobiMaterial.uniforms.uTexel.value.copy(texel);
    gammaTileMassMaterial.uniforms.uFieldTexel.value.copy(texel);
    gammaTileMassMaterial.uniforms.uTileTexel.value.copy(regionalTexel);
    gammaTileMassCorrectionMaterial.uniforms.uTexel.value.copy(texel);
    gammaCandidateDiagnosticMaterial.uniforms.uTexel.value.copy(texel);
    etaGammaVelocityDiagnosticMaterial.uniforms.uTexel.value.copy(texel);
    huangLocalDiagnosticMaterial.uniforms.uTexel.value.copy(texel);
    huangMapStateMaterial.uniforms.uFieldTexel.value.copy(texel);
    huangResidualTransportMaterial.uniforms.uFieldTexel.value.copy(texel);
    huangFrontStateMaterial.uniforms.uFieldTexel.value.copy(texel);
    huangFrontStateMaterial.uniforms.uTileTexel.value.copy(frontStateTexel);
    gammaVelocityCorrectionMaterial.uniforms.uTexel.value.copy(texel);
    gammaProjectionDivergenceMaterial.uniforms.uTexel.value.copy(texel);
    gammaDivergenceFeedbackMaterial.uniforms.uTexel.value.copy(texel);
    gammaContinuityMaterial.uniforms.uTexel.value.copy(texel);
    fieldMaterial.uniforms.uTexel.value.copy(texel);
    regionalSupportMaterial.uniforms.uTexel.value.copy(texel);
    regionalEvolveMaterial.uniforms.uTexel.value.copy(regionalTexel);
    regionalRidgeMaterial.uniforms.uFieldTexel.value.copy(texel);
    regionalRidgeMaterial.uniforms.uTexel.value.copy(regionalTexel);
    regionalFlowMaterial.uniforms.uTexel.value.copy(regionalTexel);
    riverCoreSupportMaterial.uniforms.uTexel.value.copy(texel);
    riverCoreMassMaterial.uniforms.uFieldTexel.value.copy(texel);
    riverCoreMassMaterial.uniforms.uTileTexel.value.copy(regionalTexel);
    riverPathCostMaterial.uniforms.uTileTexel.value.copy(regionalTexel);
    riverPathCostMaterial.uniforms.uFieldTexel.value.copy(texel);
    riverPathSkeletonMaterial.uniforms.uTexel.value.copy(regionalTexel);
    riverPathEvidenceMaterial.uniforms.uTileTexel.value.copy(regionalTexel);
    riverPathEvidenceMaterial.uniforms.uFieldTexel.value.copy(texel);
    riverPathHeatMaterial.uniforms.uTexel.value.copy(regionalTexel);
    riverCoreGeodesicMaterial.uniforms.uTexel.value.copy(regionalTexel);
    riverCoreTransportMaterial.uniforms.uTexel.value.copy(regionalTexel);
    riverCoreTransportMaterial.uniforms.uFieldTexel.value.copy(texel);
    riverCoreBalanceMaterial.uniforms.uTexel.value.copy(texel);
    initRiverPhaseMaterial.uniforms.uTexel.value.copy(texel);
    riverPhaseMaterial.uniforms.uTexel.value.copy(texel);
    riverMeniscusMaterial.uniforms.uTexel.value.copy(texel);
    riverHeightFluxMaterial.uniforms.uTexel.value.copy(texel);
    phasePotentialMaterial.uniforms.uTexel.value.copy(texel);
    filamentConnectivityMaterial.uniforms.uFieldTexel.value.copy(texel);
    filamentConnectivityMaterial.uniforms.uTileTexel.value.copy(regionalTexel);
    phaseAreaMaterial.uniforms.uFieldTexel.value.copy(texel);
    phaseAreaMaterial.uniforms.uTileTexel.value.copy(phaseAreaTexel);
    phaseMaterial.uniforms.uTexel.value.copy(texel);
    huangForwardMapStateMaterial.uniforms.uFieldTexel.value.copy(texel);
  }

  function disposeTargets() {
    fieldRead.dispose();
    fieldWrite.dispose();
    velocityRead.dispose();
    velocityWrite.dispose();
    divergenceTarget.dispose();
    pressureRead.dispose();
    pressureWrite.dispose();
    gammaResidualTarget.dispose();
    gammaCandidateTarget.dispose();
    gammaSolveReadTarget.dispose();
    gammaSolveWriteTarget.dispose();
    gammaTileMassBeforeTarget.dispose();
    gammaTileMassAfterTarget.dispose();
    gammaProjectionDivergenceTarget.dispose();
    gammaCandidateDiagnosticTarget.dispose();
    etaGammaVelocityTarget.dispose();
    huangMapStateReadTarget.dispose();
    huangMapStateWriteTarget.dispose();
    huangForwardMapStateReadTarget.dispose();
    huangForwardMapStateWriteTarget.dispose();
    huangResidualTransportReadTarget.dispose();
    huangResidualTransportWriteTarget.dispose();
    fieldDiagnosticTarget.dispose();
    huangLocalDiagnosticTarget.dispose();
    huangFrontStateReadTarget.dispose();
    huangFrontStateWriteTarget.dispose();
    phasePotentialTarget.dispose();
    filamentConnectivityReadTarget.dispose();
    filamentConnectivityWriteTarget.dispose();
    filamentConnectivityDiagnosticTarget.dispose();
    phaseAreaTarget.dispose();
    phaseAreaDiagnosticTarget.dispose();
    phaseAreaSkeletonTarget.dispose();
    regionalSupportTarget.dispose();
    regionalEvolveRead.dispose();
    regionalEvolveWrite.dispose();
    regionalRidgeTarget.dispose();
    regionalFlowTarget.dispose();
    riverPhaseRead.dispose();
    riverPhaseWrite.dispose();
    riverCoreSupportTarget.dispose();
    riverCoreMassTarget.dispose();
    riverPathCostTarget.dispose();
    riverPathDiagnosticsTarget.dispose();
    riverPathSkeletonTarget.dispose();
    riverPathEvidenceTarget.dispose();
    riverPathHeatReadTarget.dispose();
    riverPathHeatWriteTarget.dispose();
    riverCoreGeodesicReadTarget.dispose();
    riverCoreGeodesicWriteTarget.dispose();
    riverCoreTransportReadTarget.dispose();
    riverCoreTransportWriteTarget.dispose();
    riverCoreBalanceTarget.dispose();
    riverCoreBalanceWriteTarget.dispose();
    riverHeightFluxTarget.dispose();
  }

  function reset() {
    const seed = seedBase;
    initFieldMaterial.uniforms.uSeed.value = seed;
    initVelocityMaterial.uniforms.uSeed.value = seed + 19.37;
    quad.material = initFieldMaterial;
    renderToTarget(renderer, scene, camera, fieldRead);
    renderToTarget(renderer, scene, camera, fieldWrite);
    quad.material = initVelocityMaterial;
    renderToTarget(renderer, scene, camera, velocityRead);
    renderToTarget(renderer, scene, camera, velocityWrite);
    initRiverPhaseMaterial.uniforms.uField.value = fieldRead.texture;
    quad.material = initRiverPhaseMaterial;
    renderToTarget(renderer, scene, camera, riverPhaseRead);
    renderToTarget(renderer, scene, camera, riverPhaseWrite);
    quad.material = clearPressureMaterial;
    renderToTarget(renderer, scene, camera, riverCoreSupportTarget);
    quad.material = clearPressureMaterial;
    renderToTarget(renderer, scene, camera, riverCoreMassTarget);
    quad.material = clearPressureMaterial;
    renderToTarget(renderer, scene, camera, riverPathCostTarget);
    renderToTarget(renderer, scene, camera, riverPathSkeletonTarget);
    quad.material = clearPressureMaterial;
    renderToTarget(renderer, scene, camera, riverPathEvidenceTarget);
    renderToTarget(renderer, scene, camera, riverPathHeatReadTarget);
    renderToTarget(renderer, scene, camera, riverPathHeatWriteTarget);
    renderToTarget(renderer, scene, camera, riverCoreGeodesicReadTarget);
    renderToTarget(renderer, scene, camera, riverCoreGeodesicWriteTarget);
    quad.material = clearPressureMaterial;
    renderToTarget(renderer, scene, camera, riverCoreTransportReadTarget);
    renderToTarget(renderer, scene, camera, riverCoreTransportWriteTarget);
    quad.material = clearPressureMaterial;
    renderToTarget(renderer, scene, camera, riverCoreBalanceTarget);
    quad.material = clearPressureMaterial;
    renderToTarget(renderer, scene, camera, riverCoreBalanceWriteTarget);
    quad.material = clearPressureMaterial;
    renderToTarget(renderer, scene, camera, riverHeightFluxTarget);
    quad.material = clearPressureMaterial;
    renderToTarget(renderer, scene, camera, gammaResidualTarget);
    renderToTarget(renderer, scene, camera, gammaCandidateTarget);
    renderToTarget(renderer, scene, camera, gammaSolveReadTarget);
    renderToTarget(renderer, scene, camera, gammaSolveWriteTarget);
    renderToTarget(renderer, scene, camera, gammaTileMassBeforeTarget);
    renderToTarget(renderer, scene, camera, gammaTileMassAfterTarget);
    renderToTarget(renderer, scene, camera, gammaProjectionDivergenceTarget);
    renderToTarget(renderer, scene, camera, gammaCandidateDiagnosticTarget);
    renderToTarget(renderer, scene, camera, etaGammaVelocityTarget);
    renderToTarget(renderer, scene, camera, huangMapStateReadTarget);
    renderToTarget(renderer, scene, camera, huangMapStateWriteTarget);
    renderToTarget(renderer, scene, camera, huangForwardMapStateReadTarget);
    renderToTarget(renderer, scene, camera, huangForwardMapStateWriteTarget);
    renderToTarget(renderer, scene, camera, huangResidualTransportReadTarget);
    renderToTarget(renderer, scene, camera, huangResidualTransportWriteTarget);
    renderToTarget(renderer, scene, camera, fieldDiagnosticTarget);
    renderToTarget(renderer, scene, camera, huangLocalDiagnosticTarget);
    quad.material = clearPressureMaterial;
    renderToTarget(renderer, scene, camera, huangFrontStateReadTarget);
    renderToTarget(renderer, scene, camera, huangFrontStateWriteTarget);
    quad.material = clearPressureMaterial;
    renderToTarget(renderer, scene, camera, divergenceTarget);
    renderToTarget(renderer, scene, camera, pressureRead);
    renderToTarget(renderer, scene, camera, pressureWrite);
    renderToTarget(renderer, scene, camera, regionalSupportTarget);
    renderToTarget(renderer, scene, camera, regionalEvolveRead);
    renderToTarget(renderer, scene, camera, regionalEvolveWrite);
    renderToTarget(renderer, scene, camera, regionalRidgeTarget);
    renderToTarget(renderer, scene, camera, regionalFlowTarget);
    renderToTarget(renderer, scene, camera, phasePotentialTarget);
    renderToTarget(renderer, scene, camera, filamentConnectivityReadTarget);
    renderToTarget(renderer, scene, camera, filamentConnectivityWriteTarget);
    renderToTarget(renderer, scene, camera, filamentConnectivityDiagnosticTarget);
    renderToTarget(renderer, scene, camera, phaseAreaTarget);
    renderToTarget(renderer, scene, camera, phaseAreaDiagnosticTarget);
    renderToTarget(renderer, scene, camera, phaseAreaSkeletonTarget);
    renderToTarget(renderer, scene, camera, riverPathDiagnosticsTarget);
    assignTextures();
    lastTime = 0;
    accumulator = 0;
    simTime = 0;
    needsPrewarm = true;
    diagnosticStep = 0;
    diagnosticReadStep = -1;
    lastDiagnosticDelta = FIXED_SIM_DT;
    lastDiagnostics = null;
  }

  function resize(nextSize) {
    const normalized = normalizeSimSize(nextSize);
    if (normalized === size) return;
    disposeTargets();
    size = normalized;
    fieldRead = createRenderTarget(size, targetOptions);
    fieldWrite = createRenderTarget(size, targetOptions);
    velocityRead = createRenderTarget(size, targetOptions);
    velocityWrite = createRenderTarget(size, targetOptions);
    divergenceTarget = createRenderTarget(size, targetOptions);
    pressureRead = createRenderTarget(size, targetOptions);
    pressureWrite = createRenderTarget(size, targetOptions);
    gammaResidualTarget = createRenderTarget(size, diagnosticTargetOptions);
    gammaCandidateTarget = createRenderTarget(size, targetOptions);
    gammaSolveReadTarget = createRenderTarget(size, targetOptions);
    gammaSolveWriteTarget = createRenderTarget(size, targetOptions);
    gammaProjectionDivergenceTarget = createRenderTarget(size, diagnosticTargetOptions);
    gammaCandidateDiagnosticTarget = createRenderTarget(size, diagnosticTargetOptions);
    etaGammaVelocityTarget = createRenderTarget(size, diagnosticTargetOptions);
    huangMapStateReadTarget = createRenderTarget(size, frontStateTargetOptions);
    huangMapStateWriteTarget = createRenderTarget(size, frontStateTargetOptions);
    huangForwardMapStateReadTarget = createRenderTarget(size, frontStateTargetOptions);
    huangForwardMapStateWriteTarget = createRenderTarget(size, frontStateTargetOptions);
    huangResidualTransportReadTarget = createRenderTarget(size, frontStateTargetOptions);
    huangResidualTransportWriteTarget = createRenderTarget(size, frontStateTargetOptions);
    fieldDiagnosticTarget = createRenderTarget(size, diagnosticTargetOptions);
    huangLocalDiagnosticTarget = createRenderTarget(size, targetOptions);
    phasePotentialTarget = createRenderTarget(size, targetOptions);
    regionalSupportSize = normalizeRegionalSupportSize(size);
    huangFrontStateSize = size;
    phaseAreaSize = size;
    huangFrontStateReadTarget = createRenderTarget(huangFrontStateSize, frontStateTargetOptions);
    huangFrontStateWriteTarget = createRenderTarget(huangFrontStateSize, frontStateTargetOptions);
    gammaTileMassBeforeTarget = createRenderTarget(regionalSupportSize, targetOptions);
    gammaTileMassAfterTarget = createRenderTarget(regionalSupportSize, targetOptions);
    diagnosticReadback = new Uint8Array(size * size * 4);
    gammaResidualReadback = new Uint8Array(size * size * 4);
    gammaCandidateDiagnosticReadback = new Uint8Array(size * size * 4);
    fieldDiagnosticReadback = new Uint8Array(size * size * 4);
    huangMapStateReadback = new Uint8Array(size * size * 4);
    huangForwardMapStateReadback = new Uint8Array(size * size * 4);
    huangResidualTransportReadback = new Uint8Array(size * size * 4);
    huangFrontStateReadback = new Uint8Array(huangFrontStateSize * huangFrontStateSize * 4);
    filamentConnectivityReadback = new Uint8Array(regionalSupportSize * regionalSupportSize * 4);
    phaseAreaDiagnosticReadback = new Uint8Array(phaseAreaSize * phaseAreaSize * 4);
    phaseAreaSkeletonReadback = new Uint8Array(phaseAreaSize * phaseAreaSize * 4);
    filamentConnectivityReadTarget = createRenderTarget(regionalSupportSize, targetOptions);
    filamentConnectivityWriteTarget = createRenderTarget(regionalSupportSize, targetOptions);
    filamentConnectivityDiagnosticTarget = createRenderTarget(regionalSupportSize, diagnosticTargetOptions);
    phaseAreaTarget = createRenderTarget(phaseAreaSize, targetOptions);
    phaseAreaDiagnosticTarget = createRenderTarget(phaseAreaSize, diagnosticTargetOptions);
    phaseAreaSkeletonTarget = createRenderTarget(phaseAreaSize, diagnosticTargetOptions);
    regionalSupportTarget = createRenderTarget(regionalSupportSize, targetOptions);
    regionalEvolveRead = createRenderTarget(regionalSupportSize, targetOptions);
    regionalEvolveWrite = createRenderTarget(regionalSupportSize, targetOptions);
    regionalRidgeTarget = createRenderTarget(regionalSupportSize, targetOptions);
    regionalFlowTarget = createRenderTarget(regionalSupportSize, targetOptions);
    riverPhaseRead = createRenderTarget(size, targetOptions);
    riverPhaseWrite = createRenderTarget(size, targetOptions);
    riverCoreSupportTarget = createRenderTarget(size, targetOptions);
    riverCoreMassTarget = createRenderTarget(regionalSupportSize, targetOptions);
    riverPathCostTarget = createRenderTarget(regionalSupportSize, targetOptions);
    riverPathDiagnosticsTarget = createRenderTarget(regionalSupportSize, targetOptions);
    riverPathSkeletonTarget = createRenderTarget(regionalSupportSize, targetOptions);
    riverPathEvidenceTarget = createRenderTarget(regionalSupportSize, targetOptions);
    riverPathHeatReadTarget = createRenderTarget(regionalSupportSize, targetOptions);
    riverPathHeatWriteTarget = createRenderTarget(regionalSupportSize, targetOptions);
    riverCoreGeodesicReadTarget = createRenderTarget(regionalSupportSize, targetOptions);
    riverCoreGeodesicWriteTarget = createRenderTarget(regionalSupportSize, targetOptions);
    riverCoreTransportReadTarget = createRenderTarget(regionalSupportSize, targetOptions);
    riverCoreTransportWriteTarget = createRenderTarget(regionalSupportSize, targetOptions);
    riverCoreBalanceTarget = createRenderTarget(size, targetOptions);
    riverCoreBalanceWriteTarget = createRenderTarget(size, targetOptions);
    riverHeightFluxTarget = createRenderTarget(size, targetOptions);
    updateTexelUniforms();
    reset();
  }

  function applyUniforms(material, dt, config, pressure) {
    const flowDirection = (config.filmFlowDirection ?? 92) * Math.PI / 180;
    if (material.uniforms.uTime) material.uniforms.uTime.value = simTime;
    if (material.uniforms.uDelta) material.uniforms.uDelta.value = dt;
    if (material.uniforms.uPressure) material.uniforms.uPressure.value = pressure;
    if (material.uniforms.uFlowSpeed) material.uniforms.uFlowSpeed.value = config.filmFlowSpeed ?? 0.46;
    if (material.uniforms.uFlowDirection) material.uniforms.uFlowDirection.value = flowDirection;
    if (material.uniforms.uFlowCoherence) material.uniforms.uFlowCoherence.value = config.filmFlowCoherence ?? 0.76;
    if (material.uniforms.uDiffusion) material.uniforms.uDiffusion.value = config.filmDiffusionAmount ?? 0.38;
    if (material.uniforms.uDripAmount) material.uniforms.uDripAmount.value = config.filmDripAmount ?? 1.24;
    if (material.uniforms.uMarangoni) material.uniforms.uMarangoni.value = config.filmMarangoniStrength ?? 0.72;
    if (material.uniforms.uCapillary) material.uniforms.uCapillary.value = config.filmCapillaryStrength ?? 0.52;
    if (material.uniforms.uDrainage) material.uniforms.uDrainage.value = config.filmDrainageAmount ?? 0.58;
    if (material.uniforms.uGravity) material.uniforms.uGravity.value = config.filmGravity ?? 0.72;
    if (material.uniforms.uViscosity) material.uniforms.uViscosity.value = config.filmViscosity ?? 0.35;
    if (material.uniforms.uSourceAmount) material.uniforms.uSourceAmount.value = config.filmSourceAmount ?? 0.7;
    if (material.uniforms.uFoamSource) material.uniforms.uFoamSource.value = config.filmFoamSource ?? 0.78;
    if (material.uniforms.uFoamDecay) material.uniforms.uFoamDecay.value = config.filmFoamDecay ?? 0.28;
  }

  function swapVelocity() {
    const nextRead = velocityWrite;
    velocityWrite = velocityRead;
    velocityRead = nextRead;
  }

  function swapPressure() {
    const nextRead = pressureWrite;
    pressureWrite = pressureRead;
    pressureRead = nextRead;
  }

  function swapField() {
    const nextRead = fieldWrite;
    fieldWrite = fieldRead;
    fieldRead = nextRead;
  }

  function swapGammaSolve() {
    const nextRead = gammaSolveWriteTarget;
    gammaSolveWriteTarget = gammaSolveReadTarget;
    gammaSolveReadTarget = nextRead;
  }

  function swapHuangMapState() {
    const nextRead = huangMapStateWriteTarget;
    huangMapStateWriteTarget = huangMapStateReadTarget;
    huangMapStateReadTarget = nextRead;
  }

  function swapHuangForwardMapState() {
    const nextRead = huangForwardMapStateWriteTarget;
    huangForwardMapStateWriteTarget = huangForwardMapStateReadTarget;
    huangForwardMapStateReadTarget = nextRead;
  }

  function swapHuangFrontState() {
    const nextRead = huangFrontStateWriteTarget;
    huangFrontStateWriteTarget = huangFrontStateReadTarget;
    huangFrontStateReadTarget = nextRead;
  }

  function swapHuangResidualTransport() {
    const nextRead = huangResidualTransportWriteTarget;
    huangResidualTransportWriteTarget = huangResidualTransportReadTarget;
    huangResidualTransportReadTarget = nextRead;
  }

  function swapRegionalEvolve() {
    const nextRead = regionalEvolveWrite;
    regionalEvolveWrite = regionalEvolveRead;
    regionalEvolveRead = nextRead;
  }

  function swapRiverPhase() {
    const nextRead = riverPhaseWrite;
    riverPhaseWrite = riverPhaseRead;
    riverPhaseRead = nextRead;
  }

  function swapRiverCoreBalance() {
    const nextRead = riverCoreBalanceWriteTarget;
    riverCoreBalanceWriteTarget = riverCoreBalanceTarget;
    riverCoreBalanceTarget = nextRead;
  }

  function swapRiverCoreTransport() {
    const nextRead = riverCoreTransportWriteTarget;
    riverCoreTransportWriteTarget = riverCoreTransportReadTarget;
    riverCoreTransportReadTarget = nextRead;
  }

  function swapRiverPathHeat() {
    const nextRead = riverPathHeatWriteTarget;
    riverPathHeatWriteTarget = riverPathHeatReadTarget;
    riverPathHeatReadTarget = nextRead;
  }

  function swapRiverCoreGeodesic() {
    const nextRead = riverCoreGeodesicWriteTarget;
    riverCoreGeodesicWriteTarget = riverCoreGeodesicReadTarget;
    riverCoreGeodesicReadTarget = nextRead;
  }

  function swapFilamentConnectivity() {
    const nextRead = filamentConnectivityWriteTarget;
    filamentConnectivityWriteTarget = filamentConnectivityReadTarget;
    filamentConnectivityReadTarget = nextRead;
  }

  function renderGammaTileMass(sourceTexture, target) {
    gammaTileMassMaterial.uniforms.uField.value = sourceTexture;
    quad.material = gammaTileMassMaterial;
    renderToTarget(renderer, scene, camera, target);
  }

  function correctGammaTileMass(strength) {
    renderGammaTileMass(fieldRead.texture, gammaTileMassAfterTarget);
    gammaTileMassCorrectionMaterial.uniforms.uField.value = fieldRead.texture;
    gammaTileMassCorrectionMaterial.uniforms.uTileBefore.value = gammaTileMassBeforeTarget.texture;
    gammaTileMassCorrectionMaterial.uniforms.uTileAfter.value = gammaTileMassAfterTarget.texture;
    gammaTileMassCorrectionMaterial.uniforms.uCorrectionStrength.value = strength;
    quad.material = gammaTileMassCorrectionMaterial;
    renderToTarget(renderer, scene, camera, fieldWrite);
    swapField();
    assignTextures();
  }

  function step(dt, config, pressure) {
    simTime += dt;
    lastDiagnosticDelta = dt;
    assignTextures();
    renderGammaTileMass(fieldRead.texture, gammaTileMassBeforeTarget);
    applyUniforms(velocityMaterial, dt, config, pressure);
    quad.material = velocityMaterial;
    renderToTarget(renderer, scene, camera, velocityWrite);
    swapVelocity();

    divergenceMaterial.uniforms.uVelocity.value = velocityRead.texture;
    quad.material = divergenceMaterial;
    renderToTarget(renderer, scene, camera, divergenceTarget);

    quad.material = clearPressureMaterial;
    renderToTarget(renderer, scene, camera, pressureRead);
    renderToTarget(renderer, scene, camera, pressureWrite);

    const pressureIterations = Math.max(4, Math.min(96, Math.round(config.filmPressureIterations ?? 56)));
    for (let i = 0; i < pressureIterations; i += 1) {
      pressureJacobiMaterial.uniforms.uPressure.value = pressureRead.texture;
      pressureJacobiMaterial.uniforms.uDivergence.value = divergenceTarget.texture;
      quad.material = pressureJacobiMaterial;
      renderToTarget(renderer, scene, camera, pressureWrite);
      swapPressure();
    }

    projectVelocityMaterial.uniforms.uVelocity.value = velocityRead.texture;
    projectVelocityMaterial.uniforms.uPressure.value = pressureRead.texture;
    quad.material = projectVelocityMaterial;
    renderToTarget(renderer, scene, camera, velocityWrite);
    swapVelocity();

    const gammaProjectionIterations = Math.max(5, Math.min(16, Math.round(pressureIterations * 0.34)));
    const gammaJacobiIterations = Math.max(8, Math.min(24, Math.round(pressureIterations * 0.62)));
    const gammaProjectionDt = dt;
    const gammaVelocityDt = dt * Math.min(0.70, 0.34 + gammaProjectionIterations * 0.026);
    const gammaFeedbackDt = dt * Math.min(0.54, 0.26 + gammaProjectionIterations * 0.018);
    const gammaMassCorrectionStrength = 1.0;
    for (let gammaIteration = 0; gammaIteration < gammaProjectionIterations; gammaIteration += 1) {
      gammaImplicitMaterial.uniforms.uField.value = fieldRead.texture;
      gammaImplicitMaterial.uniforms.uVelocity.value = velocityRead.texture;
      applyUniforms(gammaImplicitMaterial, gammaProjectionDt, config, pressure);
      quad.material = gammaImplicitMaterial;
      renderToTarget(renderer, scene, camera, gammaSolveReadTarget);

      for (let gammaJacobi = 0; gammaJacobi < gammaJacobiIterations; gammaJacobi += 1) {
        gammaProjectionJacobiMaterial.uniforms.uBaseField.value = fieldRead.texture;
        gammaProjectionJacobiMaterial.uniforms.uSolveField.value = gammaSolveReadTarget.texture;
        gammaProjectionJacobiMaterial.uniforms.uVelocity.value = velocityRead.texture;
        applyUniforms(gammaProjectionJacobiMaterial, gammaProjectionDt, config, pressure);
        quad.material = gammaProjectionJacobiMaterial;
        renderToTarget(renderer, scene, camera, gammaSolveWriteTarget);
        swapGammaSolve();
      }
      gammaProjectionJacobiMaterial.uniforms.uBaseField.value = fieldRead.texture;
      gammaProjectionJacobiMaterial.uniforms.uSolveField.value = gammaSolveReadTarget.texture;
      gammaProjectionJacobiMaterial.uniforms.uVelocity.value = velocityRead.texture;
      applyUniforms(gammaProjectionJacobiMaterial, gammaProjectionDt, config, pressure);
      renderToTarget(renderer, scene, camera, gammaCandidateTarget);

      gammaCandidateDiagnosticMaterial.uniforms.uField.value = gammaCandidateTarget.texture;
      gammaCandidateDiagnosticMaterial.uniforms.uVelocity.value = velocityRead.texture;
      applyUniforms(gammaCandidateDiagnosticMaterial, gammaProjectionDt, config, pressure);
      quad.material = gammaCandidateDiagnosticMaterial;
      renderToTarget(renderer, scene, camera, gammaCandidateDiagnosticTarget);

      gammaVelocityCorrectionMaterial.uniforms.uField.value = gammaCandidateTarget.texture;
      gammaVelocityCorrectionMaterial.uniforms.uVelocity.value = velocityRead.texture;
      gammaVelocityCorrectionMaterial.uniforms.uGammaResidual.value = gammaCandidateDiagnosticTarget.texture;
      applyUniforms(gammaVelocityCorrectionMaterial, gammaVelocityDt, config, pressure);
      quad.material = gammaVelocityCorrectionMaterial;
      renderToTarget(renderer, scene, camera, velocityWrite);
      swapVelocity();

      gammaProjectionDivergenceMaterial.uniforms.uField.value = gammaCandidateTarget.texture;
      gammaProjectionDivergenceMaterial.uniforms.uVelocity.value = velocityRead.texture;
      applyUniforms(gammaProjectionDivergenceMaterial, gammaFeedbackDt, config, pressure);
      quad.material = gammaProjectionDivergenceMaterial;
      renderToTarget(renderer, scene, camera, gammaProjectionDivergenceTarget);

      gammaDivergenceFeedbackMaterial.uniforms.uField.value = gammaCandidateTarget.texture;
      gammaDivergenceFeedbackMaterial.uniforms.uVelocity.value = velocityRead.texture;
      gammaDivergenceFeedbackMaterial.uniforms.uGammaProjection.value = gammaProjectionDivergenceTarget.texture;
      applyUniforms(gammaDivergenceFeedbackMaterial, gammaFeedbackDt, config, pressure);
      quad.material = gammaDivergenceFeedbackMaterial;
      renderToTarget(renderer, scene, camera, fieldWrite);
      swapField();
      correctGammaTileMass(gammaMassCorrectionStrength);
    }

    gammaContinuityMaterial.uniforms.uField.value = fieldRead.texture;
    gammaContinuityMaterial.uniforms.uVelocity.value = velocityRead.texture;
    applyUniforms(gammaContinuityMaterial, gammaVelocityDt * 0.42, config, pressure);
    quad.material = gammaContinuityMaterial;
    renderToTarget(renderer, scene, camera, fieldWrite);
    swapField();
    correctGammaTileMass(gammaMassCorrectionStrength);

    gammaResidualMaterial.uniforms.uField.value = fieldRead.texture;
    gammaResidualMaterial.uniforms.uVelocity.value = velocityRead.texture;
    applyUniforms(gammaResidualMaterial, dt, config, pressure);
    quad.material = gammaResidualMaterial;
    renderToTarget(renderer, scene, camera, gammaResidualTarget);

    gammaCandidateDiagnosticMaterial.uniforms.uField.value = fieldRead.texture;
    gammaCandidateDiagnosticMaterial.uniforms.uVelocity.value = velocityRead.texture;
    applyUniforms(gammaCandidateDiagnosticMaterial, dt, config, pressure);
    quad.material = gammaCandidateDiagnosticMaterial;
    renderToTarget(renderer, scene, camera, gammaCandidateDiagnosticTarget);

    etaGammaVelocityDiagnosticMaterial.uniforms.uField.value = fieldRead.texture;
    etaGammaVelocityDiagnosticMaterial.uniforms.uVelocity.value = velocityRead.texture;
    applyUniforms(etaGammaVelocityDiagnosticMaterial, dt, config, pressure);
    quad.material = etaGammaVelocityDiagnosticMaterial;
    renderToTarget(renderer, scene, camera, etaGammaVelocityTarget);

    fieldDiagnosticMaterial.uniforms.uField.value = fieldRead.texture;
    quad.material = fieldDiagnosticMaterial;
    renderToTarget(renderer, scene, camera, fieldDiagnosticTarget);

    huangLocalDiagnosticMaterial.uniforms.uField.value = fieldRead.texture;
    huangLocalDiagnosticMaterial.uniforms.uVelocity.value = velocityRead.texture;
    applyUniforms(huangLocalDiagnosticMaterial, dt, config, pressure);
    quad.material = huangLocalDiagnosticMaterial;
    renderToTarget(renderer, scene, camera, huangLocalDiagnosticTarget);

    const huangMapIterations = 2;
    for (let huangMap = 0; huangMap < huangMapIterations; huangMap += 1) {
      huangMapStateMaterial.uniforms.uField.value = fieldRead.texture;
      huangMapStateMaterial.uniforms.uVelocity.value = velocityRead.texture;
      huangMapStateMaterial.uniforms.uHuangLocalDiagnostic.value = huangLocalDiagnosticTarget.texture;
      huangMapStateMaterial.uniforms.uGammaCandidate.value = gammaCandidateDiagnosticTarget.texture;
      huangMapStateMaterial.uniforms.uEtaGammaVelocity.value = etaGammaVelocityTarget.texture;
      huangMapStateMaterial.uniforms.uPreviousMap.value = huangMapStateReadTarget.texture;
      huangMapStateMaterial.uniforms.uPairMap.value = huangForwardMapStateReadTarget.texture;
      applyUniforms(huangMapStateMaterial, dt, config, pressure);
      quad.material = huangMapStateMaterial;
      renderToTarget(renderer, scene, camera, huangMapStateWriteTarget);
      swapHuangMapState();

      huangForwardMapStateMaterial.uniforms.uField.value = fieldRead.texture;
      huangForwardMapStateMaterial.uniforms.uVelocity.value = velocityRead.texture;
      huangForwardMapStateMaterial.uniforms.uHuangLocalDiagnostic.value = huangLocalDiagnosticTarget.texture;
      huangForwardMapStateMaterial.uniforms.uGammaCandidate.value = gammaCandidateDiagnosticTarget.texture;
      huangForwardMapStateMaterial.uniforms.uEtaGammaVelocity.value = etaGammaVelocityTarget.texture;
      huangForwardMapStateMaterial.uniforms.uPreviousMap.value = huangForwardMapStateReadTarget.texture;
      huangForwardMapStateMaterial.uniforms.uPairMap.value = huangMapStateReadTarget.texture;
      applyUniforms(huangForwardMapStateMaterial, dt, config, pressure);
      quad.material = huangForwardMapStateMaterial;
      renderToTarget(renderer, scene, camera, huangForwardMapStateWriteTarget);
      swapHuangForwardMapState();
    }

    const residualTransportIterations = 3;
    for (let residualTransport = 0; residualTransport < residualTransportIterations; residualTransport += 1) {
      huangResidualTransportMaterial.uniforms.uField.value = fieldRead.texture;
      huangResidualTransportMaterial.uniforms.uVelocity.value = velocityRead.texture;
      huangResidualTransportMaterial.uniforms.uHuangLocalDiagnostic.value = huangLocalDiagnosticTarget.texture;
      huangResidualTransportMaterial.uniforms.uGammaCandidate.value = gammaCandidateDiagnosticTarget.texture;
      huangResidualTransportMaterial.uniforms.uEtaGammaVelocity.value = etaGammaVelocityTarget.texture;
      huangResidualTransportMaterial.uniforms.uPreviousTransport.value = huangResidualTransportReadTarget.texture;
      huangResidualTransportMaterial.uniforms.uHuangMapState.value = huangMapStateReadTarget.texture;
      huangResidualTransportMaterial.uniforms.uHuangForwardMapState.value = huangForwardMapStateReadTarget.texture;
      applyUniforms(huangResidualTransportMaterial, dt, config, pressure);
      quad.material = huangResidualTransportMaterial;
      renderToTarget(renderer, scene, camera, huangResidualTransportWriteTarget);
      swapHuangResidualTransport();
    }

    const huangFrontIterations = 5;
    for (let huangFront = 0; huangFront < huangFrontIterations; huangFront += 1) {
      huangFrontStateMaterial.uniforms.uField.value = fieldRead.texture;
      huangFrontStateMaterial.uniforms.uVelocity.value = velocityRead.texture;
      huangFrontStateMaterial.uniforms.uHuangLocalDiagnostic.value = huangLocalDiagnosticTarget.texture;
      huangFrontStateMaterial.uniforms.uPreviousFront.value = huangFrontStateReadTarget.texture;
      huangFrontStateMaterial.uniforms.uGammaCandidate.value = gammaCandidateDiagnosticTarget.texture;
      huangFrontStateMaterial.uniforms.uEtaGammaVelocity.value = etaGammaVelocityTarget.texture;
      huangFrontStateMaterial.uniforms.uTransportResidual.value = huangResidualTransportReadTarget.texture;
      huangFrontStateMaterial.uniforms.uHuangMapState.value = huangMapStateReadTarget.texture;
      huangFrontStateMaterial.uniforms.uHuangForwardMapState.value = huangForwardMapStateReadTarget.texture;
      applyUniforms(huangFrontStateMaterial, dt, config, pressure);
      quad.material = huangFrontStateMaterial;
      renderToTarget(renderer, scene, camera, huangFrontStateWriteTarget);
      swapHuangFrontState();
    }

    diagnosticStep += 1;

    velocityMaterial.uniforms.uVelocity.value = velocityRead.texture;
    riverHeightFluxMaterial.uniforms.uField.value = fieldRead.texture;
    riverHeightFluxMaterial.uniforms.uVelocity.value = velocityRead.texture;
    riverHeightFluxMaterial.uniforms.uRiverPhase.value = riverPhaseRead.texture;
    riverHeightFluxMaterial.uniforms.uRegionalFlow.value = regionalFlowTarget.texture;
    applyUniforms(riverHeightFluxMaterial, dt, config, pressure);
    quad.material = riverHeightFluxMaterial;
    renderToTarget(renderer, scene, camera, riverHeightFluxTarget);

    fieldMaterial.uniforms.uVelocity.value = velocityRead.texture;
    fieldMaterial.uniforms.uField.value = fieldRead.texture;
    fieldMaterial.uniforms.uRiverPhase.value = riverPhaseRead.texture;
    fieldMaterial.uniforms.uRiverHeightFlux.value = riverHeightFluxTarget.texture;
    applyUniforms(fieldMaterial, dt, config, pressure);
    quad.material = fieldMaterial;
    renderToTarget(renderer, scene, camera, fieldWrite);
    swapField();
    correctGammaTileMass(gammaMassCorrectionStrength);

    const phaseIterations = Math.max(1, Math.min(8, Math.round(config.filmPhaseIterations ?? 2)));
    for (let i = 0; i < phaseIterations; i += 1) {
      regionalSupportMaterial.uniforms.uField.value = fieldRead.texture;
      regionalSupportMaterial.uniforms.uVelocity.value = velocityRead.texture;
      applyUniforms(regionalSupportMaterial, dt, config, pressure);
      quad.material = regionalSupportMaterial;
      renderToTarget(renderer, scene, camera, regionalSupportTarget);

      const regionalIterations = 4;
      for (let regional = 0; regional < regionalIterations; regional += 1) {
        regionalEvolveMaterial.uniforms.uRegionalSource.value = regionalSupportTarget.texture;
        regionalEvolveMaterial.uniforms.uRegionalPrevious.value = regionalEvolveRead.texture;
        regionalEvolveMaterial.uniforms.uVelocity.value = velocityRead.texture;
        applyUniforms(regionalEvolveMaterial, dt, config, pressure);
        quad.material = regionalEvolveMaterial;
        renderToTarget(renderer, scene, camera, regionalEvolveWrite);
        swapRegionalEvolve();
      }

      regionalRidgeMaterial.uniforms.uField.value = fieldRead.texture;
      regionalRidgeMaterial.uniforms.uVelocity.value = velocityRead.texture;
      regionalRidgeMaterial.uniforms.uRegionalSupport.value = regionalEvolveRead.texture;
      applyUniforms(regionalRidgeMaterial, dt, config, pressure);
      quad.material = regionalRidgeMaterial;
      renderToTarget(renderer, scene, camera, regionalRidgeTarget);

      regionalFlowMaterial.uniforms.uRegionalSupport.value = regionalRidgeTarget.texture;
      regionalFlowMaterial.uniforms.uVelocity.value = velocityRead.texture;
      applyUniforms(regionalFlowMaterial, dt, config, pressure);
      quad.material = regionalFlowMaterial;
      renderToTarget(renderer, scene, camera, regionalFlowTarget);

      riverCoreSupportMaterial.uniforms.uField.value = fieldRead.texture;
      riverCoreSupportMaterial.uniforms.uVelocity.value = velocityRead.texture;
      riverCoreSupportMaterial.uniforms.uPreviousRiver.value = riverPhaseRead.texture;
      riverCoreSupportMaterial.uniforms.uRegionalSupport.value = regionalRidgeTarget.texture;
      riverCoreSupportMaterial.uniforms.uRegionalFlow.value = regionalFlowTarget.texture;
      applyUniforms(riverCoreSupportMaterial, dt, config, pressure);
      quad.material = riverCoreSupportMaterial;
      renderToTarget(renderer, scene, camera, riverCoreSupportTarget);

      riverCoreMassMaterial.uniforms.uRiverCoreSupport.value = riverCoreSupportTarget.texture;
      riverCoreMassMaterial.uniforms.uPreviousCoreBalance.value = riverCoreBalanceTarget.texture;
      riverCoreMassMaterial.uniforms.uRegionalFlow.value = regionalFlowTarget.texture;
      applyUniforms(riverCoreMassMaterial, dt, config, pressure);
      quad.material = riverCoreMassMaterial;
      renderToTarget(renderer, scene, camera, riverCoreMassTarget);

      riverPathCostMaterial.uniforms.uField.value = fieldRead.texture;
      riverPathCostMaterial.uniforms.uVelocity.value = velocityRead.texture;
      riverPathCostMaterial.uniforms.uRiverCoreMass.value = riverCoreMassTarget.texture;
      riverPathCostMaterial.uniforms.uRegionalFlow.value = regionalFlowTarget.texture;
      applyUniforms(riverPathCostMaterial, dt, config, pressure);
      quad.material = riverPathCostMaterial;
      riverPathCostMaterial.uniforms.uPathDiagnosticMode.value = 0;
      renderToTarget(renderer, scene, camera, riverPathCostTarget);
      riverPathCostMaterial.uniforms.uPathDiagnosticMode.value = 1;
      renderToTarget(renderer, scene, camera, riverPathDiagnosticsTarget);
      riverPathCostMaterial.uniforms.uPathDiagnosticMode.value = 0;

      riverPathSkeletonMaterial.uniforms.uPathCost.value = riverPathCostTarget.texture;
      riverPathSkeletonMaterial.uniforms.uRegionalFlow.value = regionalFlowTarget.texture;
      applyUniforms(riverPathSkeletonMaterial, dt, config, pressure);
      quad.material = riverPathSkeletonMaterial;
      renderToTarget(renderer, scene, camera, riverPathSkeletonTarget);

      riverPathEvidenceMaterial.uniforms.uField.value = fieldRead.texture;
      riverPathEvidenceMaterial.uniforms.uVelocity.value = velocityRead.texture;
      riverPathEvidenceMaterial.uniforms.uRiverCoreMass.value = riverCoreMassTarget.texture;
      riverPathEvidenceMaterial.uniforms.uRegionalFlow.value = regionalFlowTarget.texture;
      applyUniforms(riverPathEvidenceMaterial, dt, config, pressure);
      quad.material = riverPathEvidenceMaterial;
      renderToTarget(renderer, scene, camera, riverPathEvidenceTarget);

      const pathHeatIterations = 7;
      for (let pathHeat = 0; pathHeat < pathHeatIterations; pathHeat += 1) {
        riverPathHeatMaterial.uniforms.uPathEvidence.value = riverPathSkeletonTarget.texture;
        riverPathHeatMaterial.uniforms.uPathCost.value = riverPathCostTarget.texture;
        riverPathHeatMaterial.uniforms.uPreviousPathHeat.value = riverPathHeatReadTarget.texture;
        riverPathHeatMaterial.uniforms.uRiverCoreMass.value = riverCoreMassTarget.texture;
        riverPathHeatMaterial.uniforms.uRegionalFlow.value = regionalFlowTarget.texture;
        applyUniforms(riverPathHeatMaterial, dt, config, pressure);
        quad.material = riverPathHeatMaterial;
        renderToTarget(renderer, scene, camera, riverPathHeatWriteTarget);
        swapRiverPathHeat();
      }

      const geodesicIterations = 8;
      for (let coreGeodesic = 0; coreGeodesic < geodesicIterations; coreGeodesic += 1) {
        riverCoreGeodesicMaterial.uniforms.uRiverCoreMass.value = riverCoreMassTarget.texture;
        riverCoreGeodesicMaterial.uniforms.uPathEvidence.value = riverPathHeatReadTarget.texture;
        riverCoreGeodesicMaterial.uniforms.uPreviousGeodesic.value = riverCoreGeodesicReadTarget.texture;
        riverCoreGeodesicMaterial.uniforms.uRegionalFlow.value = regionalFlowTarget.texture;
        applyUniforms(riverCoreGeodesicMaterial, dt, config, pressure);
        quad.material = riverCoreGeodesicMaterial;
        renderToTarget(renderer, scene, camera, riverCoreGeodesicWriteTarget);
        swapRiverCoreGeodesic();
      }

      const coreTransportIterations = 4;
      for (let coreTransport = 0; coreTransport < coreTransportIterations; coreTransport += 1) {
        riverCoreTransportMaterial.uniforms.uField.value = fieldRead.texture;
        riverCoreTransportMaterial.uniforms.uRiverCoreMass.value = riverCoreMassTarget.texture;
        riverCoreTransportMaterial.uniforms.uPreviousCoreTransport.value = riverCoreTransportReadTarget.texture;
        riverCoreTransportMaterial.uniforms.uRegionalFlow.value = regionalFlowTarget.texture;
        applyUniforms(riverCoreTransportMaterial, dt, config, pressure);
        quad.material = riverCoreTransportMaterial;
        renderToTarget(renderer, scene, camera, riverCoreTransportWriteTarget);
        swapRiverCoreTransport();
      }

      riverCoreBalanceMaterial.uniforms.uRiverCoreSupport.value = riverCoreSupportTarget.texture;
      riverCoreBalanceMaterial.uniforms.uRiverCoreMass.value = riverCoreGeodesicReadTarget.texture;
      riverCoreBalanceMaterial.uniforms.uPreviousCoreBalance.value = riverCoreBalanceTarget.texture;
      riverCoreBalanceMaterial.uniforms.uPreviousRiver.value = riverPhaseRead.texture;
      riverCoreBalanceMaterial.uniforms.uRegionalFlow.value = regionalFlowTarget.texture;
      applyUniforms(riverCoreBalanceMaterial, dt, config, pressure);
      quad.material = riverCoreBalanceMaterial;
      renderToTarget(renderer, scene, camera, riverCoreBalanceWriteTarget);
      swapRiverCoreBalance();

      const riverIterations = 3;
      for (let river = 0; river < riverIterations; river += 1) {
        riverPhaseMaterial.uniforms.uField.value = fieldRead.texture;
        riverPhaseMaterial.uniforms.uVelocity.value = velocityRead.texture;
        riverPhaseMaterial.uniforms.uPreviousRiver.value = riverPhaseRead.texture;
        riverPhaseMaterial.uniforms.uRegionalSupport.value = regionalRidgeTarget.texture;
        riverPhaseMaterial.uniforms.uRegionalFlow.value = regionalFlowTarget.texture;
        riverPhaseMaterial.uniforms.uRiverCoreSupport.value = riverCoreBalanceTarget.texture;
        applyUniforms(riverPhaseMaterial, dt, config, pressure);
        quad.material = riverPhaseMaterial;
        renderToTarget(renderer, scene, camera, riverPhaseWrite);
        swapRiverPhase();

        riverMeniscusMaterial.uniforms.uField.value = fieldRead.texture;
        riverMeniscusMaterial.uniforms.uVelocity.value = velocityRead.texture;
        riverMeniscusMaterial.uniforms.uPreviousRiver.value = riverPhaseRead.texture;
        riverMeniscusMaterial.uniforms.uRegionalFlow.value = regionalFlowTarget.texture;
        applyUniforms(riverMeniscusMaterial, dt, config, pressure);
        quad.material = riverMeniscusMaterial;
        renderToTarget(renderer, scene, camera, riverPhaseWrite);
        swapRiverPhase();
      }

      phasePotentialMaterial.uniforms.uField.value = fieldRead.texture;
      phasePotentialMaterial.uniforms.uVelocity.value = velocityRead.texture;
      phasePotentialMaterial.uniforms.uRegionalSupport.value = regionalRidgeTarget.texture;
      phasePotentialMaterial.uniforms.uRiverPhase.value = riverPhaseRead.texture;
      phasePotentialMaterial.uniforms.uRiverPathCost.value = riverPathCostTarget.texture;
      applyUniforms(phasePotentialMaterial, dt, config, pressure);
      quad.material = phasePotentialMaterial;
      renderToTarget(renderer, scene, camera, phasePotentialTarget);

      const filamentIterations = 6;
      for (let filament = 0; filament < filamentIterations; filament += 1) {
        filamentConnectivityMaterial.uniforms.uField.value = fieldRead.texture;
        filamentConnectivityMaterial.uniforms.uVelocity.value = velocityRead.texture;
        filamentConnectivityMaterial.uniforms.uRegionalSupport.value = regionalRidgeTarget.texture;
        filamentConnectivityMaterial.uniforms.uRiverPathCost.value = riverPathCostTarget.texture;
        filamentConnectivityMaterial.uniforms.uPreviousFilament.value = filamentConnectivityReadTarget.texture;
        filamentConnectivityMaterial.uniforms.uHuangFrontState.value = huangFrontStateReadTarget.texture;
        applyUniforms(filamentConnectivityMaterial, dt, config, pressure);
        quad.material = filamentConnectivityMaterial;
        renderToTarget(renderer, scene, camera, filamentConnectivityWriteTarget);
        swapFilamentConnectivity();
      }

      filamentConnectivityDiagnosticMaterial.uniforms.uFilamentConnectivity.value = filamentConnectivityReadTarget.texture;
      quad.material = filamentConnectivityDiagnosticMaterial;
      renderToTarget(renderer, scene, camera, filamentConnectivityDiagnosticTarget);

      phaseAreaMaterial.uniforms.uField.value = fieldRead.texture;
      phaseAreaMaterial.uniforms.uVelocity.value = velocityRead.texture;
      phaseAreaMaterial.uniforms.uRegionalSupport.value = regionalRidgeTarget.texture;
      phaseAreaMaterial.uniforms.uRiverPhase.value = riverPhaseRead.texture;
      phaseAreaMaterial.uniforms.uRiverPathCost.value = riverPathCostTarget.texture;
      phaseAreaMaterial.uniforms.uFilamentConnectivity.value = filamentConnectivityReadTarget.texture;
      phaseAreaMaterial.uniforms.uHuangFrontState.value = huangFrontStateReadTarget.texture;
      phaseAreaMaterial.uniforms.uEtaGammaVelocity.value = etaGammaVelocityTarget.texture;
      phaseAreaMaterial.uniforms.uGammaCandidate.value = gammaCandidateDiagnosticTarget.texture;
      applyUniforms(phaseAreaMaterial, dt, config, pressure);
      quad.material = phaseAreaMaterial;
      phaseAreaMaterial.uniforms.uAreaDiagnosticMode.value = 0;
      renderToTarget(renderer, scene, camera, phaseAreaTarget);
      phaseAreaMaterial.uniforms.uAreaDiagnosticMode.value = 1;
      renderToTarget(renderer, scene, camera, phaseAreaDiagnosticTarget);
      phaseAreaMaterial.uniforms.uAreaDiagnosticMode.value = 2;
      renderToTarget(renderer, scene, camera, phaseAreaSkeletonTarget);
      phaseAreaMaterial.uniforms.uAreaDiagnosticMode.value = 0;

      phaseMaterial.uniforms.uField.value = fieldRead.texture;
      phaseMaterial.uniforms.uVelocity.value = velocityRead.texture;
      phaseMaterial.uniforms.uPotential.value = phasePotentialTarget.texture;
      phaseMaterial.uniforms.uRegionalFlow.value = regionalFlowTarget.texture;
      phaseMaterial.uniforms.uRiverPhase.value = riverPhaseRead.texture;
      phaseMaterial.uniforms.uRiverPathCost.value = riverPathCostTarget.texture;
      phaseMaterial.uniforms.uPhaseArea.value = phaseAreaTarget.texture;
      phaseMaterial.uniforms.uFilamentConnectivity.value = filamentConnectivityReadTarget.texture;
      phaseMaterial.uniforms.uHuangFrontState.value = huangFrontStateReadTarget.texture;
      applyUniforms(phaseMaterial, dt, config, pressure);
      quad.material = phaseMaterial;
      renderToTarget(renderer, scene, camera, fieldWrite);
      swapField();
    }
    assignTextures();
  }

  function update(timeSeconds, config = {}, pressure = 0) {
    activeFilmSolver = config.filmSolver === "legacy" ? "legacy" : "huangCore";
    if (activeFilmSolver === "huangCore") {
      huangCore.update(timeSeconds, config, pressure);
      return;
    }
    resize(config.filmSimResolution ?? size);
    if (needsPrewarm) {
      const warmupSteps = Math.max(0, Math.min(480, Math.round(config.filmPrewarmSteps ?? 96)));
      const warmupSubsteps = Math.max(1, Math.min(24, Math.round(config.filmSubsteps ?? 8)));
      const warmupDt = FIXED_SIM_DT / warmupSubsteps;
      for (let warmup = 0; warmup < warmupSteps; warmup += 1) {
        for (let substep = 0; substep < warmupSubsteps; substep += 1) {
          step(warmupDt, config, pressure);
        }
      }
      needsPrewarm = false;
      accumulator = 0;
    }
    const currentTime = Number.isFinite(timeSeconds) ? timeSeconds : 0;
    const frameDelta = lastTime ? clampNumber(currentTime - lastTime, 0, 0.25) : FIXED_SIM_DT;
    lastTime = currentTime;
    accumulator += frameDelta;

    const ticks = Math.min(MAX_TICKS_PER_UPDATE, Math.floor(accumulator / FIXED_SIM_DT));
    if (ticks <= 0) return;

    const substeps = Math.max(1, Math.min(24, Math.round(config.filmSubsteps ?? 8)));
    const dt = FIXED_SIM_DT / substeps;
    for (let tick = 0; tick < ticks; tick += 1) {
      for (let substep = 0; substep < substeps; substep += 1) {
        step(dt, config, pressure);
      }
    }
    accumulator = Math.max(0, accumulator - ticks * FIXED_SIM_DT);
  }

  function roundedStat(value) {
    return Math.round(value * 10000) / 10000;
  }

  function createRangeStats() {
    return {
      min: Number.POSITIVE_INFINITY,
      max: Number.NEGATIVE_INFINITY,
      sum: 0,
      absMax: 0,
    };
  }

  function pushRangeStats(stats, value) {
    stats.min = Math.min(stats.min, value);
    stats.max = Math.max(stats.max, value);
    stats.sum += value;
    stats.absMax = Math.max(stats.absMax, Math.abs(value));
  }

  function finalizeRangeStats(stats, samples) {
    const safeSamples = Math.max(1, samples);
    return {
      min: roundedStat(Number.isFinite(stats.min) ? stats.min : 0),
      max: roundedStat(Number.isFinite(stats.max) ? stats.max : 0),
      mean: roundedStat(stats.sum / safeSamples),
      absMax: roundedStat(stats.absMax),
    };
  }

  function summarizeChannels(buffer, width, labels) {
    const channelStats = labels.map(() => createRangeStats());
    const above01 = labels.map(() => 0);
    const above035 = labels.map(() => 0);
    const above06 = labels.map(() => 0);
    const stride = Math.max(1, Math.floor(width / 96));
    let samples = 0;
    for (let y = 0; y < width; y += stride) {
      for (let x = 0; x < width; x += stride) {
        const offset = (y * width + x) * 4;
        for (let channel = 0; channel < labels.length; channel += 1) {
          const value = buffer[offset + channel] / 255;
          pushRangeStats(channelStats[channel], value);
          if (value > 0.1) above01[channel] += 1;
          if (value > 0.35) above035[channel] += 1;
          if (value > 0.6) above06[channel] += 1;
        }
        samples += 1;
      }
    }
    const safeSamples = Math.max(1, samples);
    return labels.reduce((acc, label, index) => {
      acc[label] = {
        ...finalizeRangeStats(channelStats[index], safeSamples),
        above01Fraction: roundedStat(above01[index] / safeSamples),
        above035Fraction: roundedStat(above035[index] / safeSamples),
        above06Fraction: roundedStat(above06[index] / safeSamples),
      };
      return acc;
    }, { samples });
  }

  function readDiagnostics() {
    if (activeFilmSolver === "huangCore") return huangCore.diagnostics;
    if (diagnosticReadStep === diagnosticStep && lastDiagnostics) return lastDiagnostics;
    if (diagnosticReadback.length !== size * size * 4) {
      diagnosticReadback = new Uint8Array(size * size * 4);
    }
    if (gammaResidualReadback.length !== size * size * 4) {
      gammaResidualReadback = new Uint8Array(size * size * 4);
    }
    if (gammaCandidateDiagnosticReadback.length !== size * size * 4) {
      gammaCandidateDiagnosticReadback = new Uint8Array(size * size * 4);
    }
    if (fieldDiagnosticReadback.length !== size * size * 4) {
      fieldDiagnosticReadback = new Uint8Array(size * size * 4);
    }
    if (huangMapStateReadback.length !== size * size * 4) {
      huangMapStateReadback = new Uint8Array(size * size * 4);
    }
    if (huangForwardMapStateReadback.length !== size * size * 4) {
      huangForwardMapStateReadback = new Uint8Array(size * size * 4);
    }
    if (huangResidualTransportReadback.length !== size * size * 4) {
      huangResidualTransportReadback = new Uint8Array(size * size * 4);
    }
    const huangFrontReadbackSize = huangFrontStateSize * huangFrontStateSize * 4;
    const regionalReadbackSize = regionalSupportSize * regionalSupportSize * 4;
    const phaseAreaReadbackSize = phaseAreaSize * phaseAreaSize * 4;
    if (huangFrontStateReadback.length !== huangFrontReadbackSize) {
      huangFrontStateReadback = new Uint8Array(huangFrontReadbackSize);
    }
    if (filamentConnectivityReadback.length !== regionalReadbackSize) {
      filamentConnectivityReadback = new Uint8Array(regionalReadbackSize);
    }
    if (phaseAreaDiagnosticReadback.length !== phaseAreaReadbackSize) {
      phaseAreaDiagnosticReadback = new Uint8Array(phaseAreaReadbackSize);
    }
    if (phaseAreaSkeletonReadback.length !== phaseAreaReadbackSize) {
      phaseAreaSkeletonReadback = new Uint8Array(phaseAreaReadbackSize);
    }

    try {
      renderer.readRenderTargetPixels(etaGammaVelocityTarget, 0, 0, size, size, diagnosticReadback);
      renderer.readRenderTargetPixels(fieldDiagnosticTarget, 0, 0, size, size, fieldDiagnosticReadback);
      renderer.readRenderTargetPixels(gammaResidualTarget, 0, 0, size, size, gammaResidualReadback);
      renderer.readRenderTargetPixels(
        gammaCandidateDiagnosticTarget,
        0,
        0,
        size,
        size,
        gammaCandidateDiagnosticReadback,
      );
      renderer.readRenderTargetPixels(
        huangMapStateReadTarget,
        0,
        0,
        size,
        size,
        huangMapStateReadback,
      );
      renderer.readRenderTargetPixels(
        huangForwardMapStateReadTarget,
        0,
        0,
        size,
        size,
        huangForwardMapStateReadback,
      );
      renderer.readRenderTargetPixels(
        huangResidualTransportReadTarget,
        0,
        0,
        size,
        size,
        huangResidualTransportReadback,
      );
      renderer.readRenderTargetPixels(
        huangFrontStateReadTarget,
        0,
        0,
        huangFrontStateSize,
        huangFrontStateSize,
        huangFrontStateReadback,
      );
      renderer.readRenderTargetPixels(
        filamentConnectivityDiagnosticTarget,
        0,
        0,
        regionalSupportSize,
        regionalSupportSize,
        filamentConnectivityReadback,
      );
      renderer.readRenderTargetPixels(
        phaseAreaDiagnosticTarget,
        0,
        0,
        phaseAreaSize,
        phaseAreaSize,
        phaseAreaDiagnosticReadback,
      );
      renderer.readRenderTargetPixels(
        phaseAreaSkeletonTarget,
        0,
        0,
        phaseAreaSize,
        phaseAreaSize,
        phaseAreaSkeletonReadback,
      );
    } catch (error) {
      lastDiagnostics = {
        size,
        step: diagnosticStep,
        readbackError: error?.message || String(error),
      };
      diagnosticReadStep = diagnosticStep;
      return lastDiagnostics;
    }

    const stride = Math.max(1, Math.floor(size / 96));
    const stats = {
      eta: createRangeStats(),
      gamma: createRangeStats(),
      speed: createRangeStats(),
      projectedDivergence: createRangeStats(),
      gammaCandidate: createRangeStats(),
      gammaCandidateProjectedDivergence: createRangeStats(),
      gammaRhsResidual: createRangeStats(),
      gammaDeltaMagnitude: createRangeStats(),
      foam: createRangeStats(),
      phase: createRangeStats(),
      closureCompressionEncoded: createRangeStats(),
      closureMobilityDivergenceEncoded: createRangeStats(),
      closureGammaResidualEncoded: createRangeStats(),
      closureEtaContinuityEncoded: createRangeStats(),
      etaThick: 0,
      etaThin: 0,
      gammaHigh: 0,
      foamVisible: 0,
      foamDense: 0,
      phaseVisible: 0,
      phaseHigh: 0,
      speedActive: 0,
      speedInteriorActive: 0,
      interiorSamples: 0,
      divergenceCompressionSmall: 0,
      divergenceCompressionStrong: 0,
      divergenceInteriorCompressionSmall: 0,
      divergenceExpansionSmall: 0,
      divergenceExpansionStrong: 0,
      divergenceInteriorExpansionSmall: 0,
      gammaRhsNonZero: 0,
      gammaRhsStrong: 0,
      gammaDeltaNonZero: 0,
      closureVisible: 0,
      samples: 0,
    };
    const gammaDeltaScale = 82.0 + lastDiagnosticDelta * 120.0;

    for (let y = 0; y < size; y += stride) {
      for (let x = 0; x < size; x += stride) {
        const offset = (y * size + x) * 4;
        const eta = diagnosticReadback[offset] / 255;
        const gamma = diagnosticReadback[offset + 1] / 255;
        const speed = diagnosticReadback[offset + 2] / 255 / 2.0;
        const projectedDivergence = (diagnosticReadback[offset + 3] / 255 - 0.5) / 2.8;
        const gammaCandidate = gammaCandidateDiagnosticReadback[offset] / 255;
        const candidateProjectedDivergence = (gammaCandidateDiagnosticReadback[offset + 1] / 255 - 0.5) / 8.0;
        const gammaRhsResidual = (gammaCandidateDiagnosticReadback[offset + 2] / 255 - 0.5) / 18.0;
        const gammaDeltaMagnitude = gammaCandidateDiagnosticReadback[offset + 3] / 255 / gammaDeltaScale;
        const foam = fieldDiagnosticReadback[offset + 2] / 255;
        const phase = fieldDiagnosticReadback[offset + 3] / 255;
        const closureCompressionEncoded = gammaResidualReadback[offset] / 255;
        const closureMobilityDivergenceEncoded = gammaResidualReadback[offset + 1] / 255;
        const closureGammaResidualEncoded = gammaResidualReadback[offset + 2] / 255;
        const closureEtaContinuityEncoded = gammaResidualReadback[offset + 3] / 255;
        const interiorSample = y > size * 0.16 && y < size * 0.84;
        const closureMaxEncoded = Math.max(
          closureCompressionEncoded,
          closureMobilityDivergenceEncoded,
          closureGammaResidualEncoded,
          closureEtaContinuityEncoded,
        );

        pushRangeStats(stats.eta, eta);
        pushRangeStats(stats.gamma, gamma);
        pushRangeStats(stats.speed, speed);
        pushRangeStats(stats.projectedDivergence, projectedDivergence);
        pushRangeStats(stats.gammaCandidate, gammaCandidate);
        pushRangeStats(stats.gammaCandidateProjectedDivergence, candidateProjectedDivergence);
        pushRangeStats(stats.gammaRhsResidual, gammaRhsResidual);
        pushRangeStats(stats.gammaDeltaMagnitude, gammaDeltaMagnitude);
        pushRangeStats(stats.foam, foam);
        pushRangeStats(stats.phase, phase);
        pushRangeStats(stats.closureCompressionEncoded, closureCompressionEncoded);
        pushRangeStats(stats.closureMobilityDivergenceEncoded, closureMobilityDivergenceEncoded);
        pushRangeStats(stats.closureGammaResidualEncoded, closureGammaResidualEncoded);
        pushRangeStats(stats.closureEtaContinuityEncoded, closureEtaContinuityEncoded);

        if (eta > 0.62) stats.etaThick += 1;
        if (eta < 0.26) stats.etaThin += 1;
        if (gamma > 0.62) stats.gammaHigh += 1;
        if (foam > 0.035) stats.foamVisible += 1;
        if (foam > 0.16) stats.foamDense += 1;
        if (phase > 0.18) stats.phaseVisible += 1;
        if (phase > 0.34) stats.phaseHigh += 1;
        if (speed > 0.05) stats.speedActive += 1;
        if (interiorSample) {
          stats.interiorSamples += 1;
          if (speed > 0.05) stats.speedInteriorActive += 1;
          if (projectedDivergence < -0.002) stats.divergenceInteriorCompressionSmall += 1;
          if (projectedDivergence > 0.002) stats.divergenceInteriorExpansionSmall += 1;
        }
        if (projectedDivergence < -0.002) stats.divergenceCompressionSmall += 1;
        if (projectedDivergence < -0.015) stats.divergenceCompressionStrong += 1;
        if (projectedDivergence > 0.002) stats.divergenceExpansionSmall += 1;
        if (projectedDivergence > 0.015) stats.divergenceExpansionStrong += 1;
        if (Math.abs(gammaRhsResidual) > 0.001) stats.gammaRhsNonZero += 1;
        if (Math.abs(gammaRhsResidual) > 0.01) stats.gammaRhsStrong += 1;
        if (gammaDeltaMagnitude > 0.0002) stats.gammaDeltaNonZero += 1;
        if (closureMaxEncoded > 0.02) stats.closureVisible += 1;
        stats.samples += 1;
      }
    }

    const samples = Math.max(1, stats.samples);
    const interiorSamples = Math.max(1, stats.interiorSamples);
    lastDiagnostics = {
      size,
      step: diagnosticStep,
      samples,
      dt: roundedStat(lastDiagnosticDelta),
      encoding: {
        etaGammaVelocity: "r=eta, g=Gamma, b=|u|*2, a=0.5+projectedDivergence*2.8",
        gammaCandidate: "r=GammaCandidate, g=0.5+projectedDivergence*8, b=0.5+gammaRhsResidual*18, a=|DeltaGamma|*(82+dt*120)",
        gammaResidual: "rgba are display-encoded closure terms; use fractions to detect visible signal, not raw magnitudes",
        huangMapState: "r=materialBackU, g=materialBackV, b=mapConfidence, a=mapRoundTripReject",
        huangForwardMapState: "r=materialForwardU, g=materialForwardV, b=mapConfidence, a=mapRoundTripReject",
        huangResidualTransport: "r=materialResidual, g=mappingConfidence/alongContinuity, b=lineAge, a=sideReject+mappingError",
        huangFrontState: "r=lineDistance, g=occupancy, b=lineAge, a=sideReject",
        filamentConnectivity: "r=rawFilament, g=frontAge, b=dropletEdge, a=widthSheetReject",
        phaseAreaError: "r=physicalLineEvidence, g=narrowPhysicalGate, b=broadSheet, a=phaseDeficit+foamExcess",
        phaseAreaSkeleton: "r=skeletonBudgetEvidence, g=frontUsable, b=areaGate, a=fillBudget",
      },
      eta: {
        ...finalizeRangeStats(stats.eta, samples),
        thickFraction: roundedStat(stats.etaThick / samples),
        thinFraction: roundedStat(stats.etaThin / samples),
      },
      gamma: {
        ...finalizeRangeStats(stats.gamma, samples),
        highFraction: roundedStat(stats.gammaHigh / samples),
      },
      foam: {
        ...finalizeRangeStats(stats.foam, samples),
        visibleFraction: roundedStat(stats.foamVisible / samples),
        denseFraction: roundedStat(stats.foamDense / samples),
      },
      phase: {
        ...finalizeRangeStats(stats.phase, samples),
        visibleFraction: roundedStat(stats.phaseVisible / samples),
        highFraction: roundedStat(stats.phaseHigh / samples),
      },
      velocity: {
        ...finalizeRangeStats(stats.speed, samples),
        activeFraction: roundedStat(stats.speedActive / samples),
        interiorActiveFraction: roundedStat(stats.speedInteriorActive / interiorSamples),
      },
      projectedDivergence: {
        ...finalizeRangeStats(stats.projectedDivergence, samples),
        compressionSmallFraction: roundedStat(stats.divergenceCompressionSmall / samples),
        compressionStrongFraction: roundedStat(stats.divergenceCompressionStrong / samples),
        interiorCompressionSmallFraction: roundedStat(stats.divergenceInteriorCompressionSmall / interiorSamples),
        expansionSmallFraction: roundedStat(stats.divergenceExpansionSmall / samples),
        expansionStrongFraction: roundedStat(stats.divergenceExpansionStrong / samples),
        interiorExpansionSmallFraction: roundedStat(stats.divergenceInteriorExpansionSmall / interiorSamples),
      },
      gammaCandidate: {
        gamma: finalizeRangeStats(stats.gammaCandidate, samples),
        projectedDivergence: finalizeRangeStats(stats.gammaCandidateProjectedDivergence, samples),
        gammaRhsResidual: {
          ...finalizeRangeStats(stats.gammaRhsResidual, samples),
          nonZeroFraction: roundedStat(stats.gammaRhsNonZero / samples),
          strongFraction: roundedStat(stats.gammaRhsStrong / samples),
        },
        gammaDeltaMagnitude: {
          ...finalizeRangeStats(stats.gammaDeltaMagnitude, samples),
          nonZeroFraction: roundedStat(stats.gammaDeltaNonZero / samples),
        },
      },
      gammaClosureEncoded: {
        compression: finalizeRangeStats(stats.closureCompressionEncoded, samples),
        mobilityDivergence: finalizeRangeStats(stats.closureMobilityDivergenceEncoded, samples),
        gammaResidual: finalizeRangeStats(stats.closureGammaResidualEncoded, samples),
        etaContinuity: finalizeRangeStats(stats.closureEtaContinuityEncoded, samples),
        visibleFraction: roundedStat(stats.closureVisible / samples),
      },
      huangMapStateTarget: summarizeChannels(huangMapStateReadback, size, [
        "materialBackU",
        "materialBackV",
        "mapConfidence",
        "mapRoundTripReject",
      ]),
      huangForwardMapStateTarget: summarizeChannels(huangForwardMapStateReadback, size, [
        "materialForwardU",
        "materialForwardV",
        "mapConfidence",
        "mapRoundTripReject",
      ]),
      huangResidualTransportTarget: summarizeChannels(huangResidualTransportReadback, size, [
        "materialResidual",
        "alongContinuity",
        "lineAge",
        "sideReject",
      ]),
      huangFrontStateTarget: summarizeChannels(huangFrontStateReadback, huangFrontStateSize, [
        "lineDistance",
        "occupancy",
        "lineAge",
        "sideReject",
      ]),
      filamentConnectivityTarget: summarizeChannels(filamentConnectivityReadback, regionalSupportSize, [
        "rawFilament",
        "frontAge",
        "dropletEdge",
        "widthSheetReject",
      ]),
      phaseAreaErrorTarget: summarizeChannels(phaseAreaDiagnosticReadback, phaseAreaSize, [
        "physicalLineEvidence",
        "narrowPhysicalGate",
        "broadSheet",
        "phaseDeficitFoamExcess",
      ]),
      phaseAreaSkeletonTarget: summarizeChannels(phaseAreaSkeletonReadback, phaseAreaSize, [
        "skeletonBudgetEvidence",
        "frontUsable",
        "areaGate",
        "fillBudget",
      ]),
    };
    diagnosticReadStep = diagnosticStep;
    return lastDiagnostics;
  }

  function dispose() {
    huangCore.dispose();
    disposeTargets();
    initFieldMaterial.dispose();
    initVelocityMaterial.dispose();
    initRiverPhaseMaterial.dispose();
    velocityMaterial.dispose();
    divergenceMaterial.dispose();
    clearPressureMaterial.dispose();
    pressureJacobiMaterial.dispose();
    projectVelocityMaterial.dispose();
    gammaImplicitMaterial.dispose();
    gammaResidualMaterial.dispose();
    gammaProjectionJacobiMaterial.dispose();
    gammaTileMassMaterial.dispose();
    gammaTileMassCorrectionMaterial.dispose();
    gammaCandidateDiagnosticMaterial.dispose();
    etaGammaVelocityDiagnosticMaterial.dispose();
    fieldDiagnosticMaterial.dispose();
    huangLocalDiagnosticMaterial.dispose();
    huangMapStateMaterial.dispose();
    huangForwardMapStateMaterial.dispose();
    huangResidualTransportMaterial.dispose();
    huangFrontStateMaterial.dispose();
    gammaVelocityCorrectionMaterial.dispose();
    gammaProjectionDivergenceMaterial.dispose();
    gammaDivergenceFeedbackMaterial.dispose();
    gammaContinuityMaterial.dispose();
    fieldMaterial.dispose();
    regionalSupportMaterial.dispose();
    regionalEvolveMaterial.dispose();
    regionalRidgeMaterial.dispose();
    regionalFlowMaterial.dispose();
    riverCoreSupportMaterial.dispose();
    riverCoreMassMaterial.dispose();
    riverPathCostMaterial.dispose();
    riverPathSkeletonMaterial.dispose();
    riverPathEvidenceMaterial.dispose();
    riverPathHeatMaterial.dispose();
    riverCoreGeodesicMaterial.dispose();
    riverCoreTransportMaterial.dispose();
    riverCoreBalanceMaterial.dispose();
    riverPhaseMaterial.dispose();
    riverMeniscusMaterial.dispose();
    riverHeightFluxMaterial.dispose();
    phasePotentialMaterial.dispose();
    filamentConnectivityMaterial.dispose();
    filamentConnectivityDiagnosticMaterial.dispose();
    phaseAreaMaterial.dispose();
    phaseMaterial.dispose();
    geometry.dispose();
  }

  function isHuangCoreActive() {
    return activeFilmSolver === "huangCore";
  }

  function coreTexture(name, legacyTexture) {
    return isHuangCoreActive() ? huangCore[name] : legacyTexture;
  }

  function setSolverMode(mode) {
    activeFilmSolver = mode === "legacy" ? "legacy" : "huangCore";
  }

  reset();

  return {
    get texture() {
      return coreTexture("texture", fieldRead.texture);
    },
    get velocityTexture() {
      return coreTexture("velocityTexture", velocityRead.texture);
    },
    get gammaResidualTexture() {
      return coreTexture("gammaResidualTexture", gammaResidualTarget.texture);
    },
    get gammaCandidateDiagnosticTexture() {
      return coreTexture("gammaCandidateDiagnosticTexture", gammaCandidateDiagnosticTarget.texture);
    },
    get etaGammaVelocityTexture() {
      return coreTexture("etaGammaVelocityTexture", etaGammaVelocityTarget.texture);
    },
    get huangLocalDiagnosticTexture() {
      return coreTexture("huangLocalDiagnosticTexture", huangLocalDiagnosticTarget.texture);
    },
    get huangMapStateTexture() {
      return coreTexture("huangMapStateTexture", huangMapStateReadTarget.texture);
    },
    get huangForwardMapStateTexture() {
      return coreTexture("huangForwardMapStateTexture", huangForwardMapStateReadTarget.texture);
    },
    get huangFrontStateTexture() {
      return coreTexture("huangFrontStateTexture", huangFrontStateReadTarget.texture);
    },
    get huangResidualTransportTexture() {
      return coreTexture("huangResidualTransportTexture", huangResidualTransportReadTarget.texture);
    },
    get phasePotentialTexture() {
      return coreTexture("phasePotentialTexture", phasePotentialTarget.texture);
    },
    get phaseAreaTexture() {
      return coreTexture("phaseAreaTexture", phaseAreaTarget.texture);
    },
    get phaseAreaDiagnosticTexture() {
      return coreTexture("phaseAreaDiagnosticTexture", phaseAreaDiagnosticTarget.texture);
    },
    get phaseAreaSkeletonTexture() {
      return coreTexture("phaseAreaSkeletonTexture", phaseAreaSkeletonTarget.texture);
    },
    get filamentConnectivityTexture() {
      return coreTexture("filamentConnectivityTexture", filamentConnectivityReadTarget.texture);
    },
    get regionalRawSupportTexture() {
      return coreTexture("regionalRawSupportTexture", regionalSupportTarget.texture);
    },
    get regionalSupportTexture() {
      return coreTexture("regionalSupportTexture", regionalEvolveRead.texture);
    },
    get regionalRidgeTexture() {
      return coreTexture("regionalRidgeTexture", regionalRidgeTarget.texture);
    },
    get regionalFlowTexture() {
      return coreTexture("regionalFlowTexture", regionalFlowTarget.texture);
    },
    get riverCoreSupportTexture() {
      return coreTexture("riverCoreSupportTexture", riverCoreBalanceTarget.texture);
    },
    get riverCoreRawMassTexture() {
      return coreTexture("riverCoreRawMassTexture", riverCoreMassTarget.texture);
    },
    get riverPathRawEvidenceTexture() {
      return coreTexture("riverPathRawEvidenceTexture", riverPathEvidenceTarget.texture);
    },
    get riverPathCostTexture() {
      return coreTexture("riverPathCostTexture", riverPathCostTarget.texture);
    },
    get riverPathDiagnosticsTexture() {
      return coreTexture("riverPathDiagnosticsTexture", riverPathDiagnosticsTarget.texture);
    },
    get riverPathSkeletonTexture() {
      return coreTexture("riverPathSkeletonTexture", riverPathSkeletonTarget.texture);
    },
    get riverPathEvidenceTexture() {
      return coreTexture("riverPathEvidenceTexture", riverPathHeatReadTarget.texture);
    },
    get riverCoreGeodesicTexture() {
      return coreTexture("riverCoreGeodesicTexture", riverCoreGeodesicReadTarget.texture);
    },
    get riverCoreMassTexture() {
      return coreTexture("riverCoreMassTexture", riverCoreTransportReadTarget.texture);
    },
    get riverPhaseTexture() {
      return coreTexture("riverPhaseTexture", riverPhaseRead.texture);
    },
    get riverHeightFluxTexture() {
      return coreTexture("riverHeightFluxTexture", riverHeightFluxTarget.texture);
    },
    get size() {
      return isHuangCoreActive() ? huangCore.size : size;
    },
    get diagnostics() {
      return readDiagnostics();
    },
    get solver() {
      return activeFilmSolver;
    },
    reset,
    resize,
    setSolverMode,
    update,
    dispose,
  };
}
