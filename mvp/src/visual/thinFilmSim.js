import * as THREE from "../../vendor/three.module.min.js";

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

    float height = 0.5 + (broad - 0.5) * 0.2 + (medium - 0.5) * 0.11 + (fine - 0.5) * 0.03;
    height += dropletSeed * 0.2 + microDroplets * 0.08 - pinhole * 0.16;
    height = mix(0.24, height, dome);

    float surfactant = 0.5 + (fbm(uv * 4.4 + vec2(4.2 + uSeed, 1.3)) - 0.5) * 0.18;
    surfactant += pinhole * 0.16 - dropletSeed * 0.08 + microDroplets * 0.04;

    float foam = smoothstep(0.84, 0.995, fine) * (0.08 + pinhole * 0.18 + dropletSeed * 0.12 + microDroplets * 0.18);
    float phaseNoise = (broad - 0.5) * 0.26 + (medium - 0.5) * 0.18 + (fine - 0.5) * 0.05;
    float dye = 0.5 + phaseNoise + pinhole * 0.08 - dropletSeed * 0.05;

    gl_FragColor = vec4(
      clamp(height, 0.035, 0.97),
      clamp(surfactant, 0.035, 0.97),
      clamp(foam, 0.0, 0.95),
      clamp(dye, 0.04, 0.96)
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
    vec2 velocity = vec2(0.026, -0.012) + curl * 0.09;
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

  vec4 fieldAt(vec2 uv) {
    return texture2D(uField, clamp(uv, vec2(0.002), vec2(0.998)));
  }

  vec2 decodeVelocity(vec4 encoded) {
    return (encoded.rg - 0.5) * 0.5;
  }

  vec4 encodeVelocity(vec2 velocity, float divergence) {
    vec2 encoded = clamp(0.5 + velocity * 2.0, vec2(0.0), vec2(1.0));
    return vec4(encoded, clamp(0.5 + divergence * 2.0, 0.0, 1.0), 1.0);
  }

  vec2 velocityAt(vec2 uv) {
    return decodeVelocity(texture2D(uVelocity, clamp(uv, vec2(0.002), vec2(0.998))));
  }

  float lapHeight(vec2 uv) {
    float c = fieldAt(uv).r;
    float l = fieldAt(uv - vec2(uTexel.x, 0.0)).r;
    float r = fieldAt(uv + vec2(uTexel.x, 0.0)).r;
    float d = fieldAt(uv - vec2(0.0, uTexel.y)).r;
    float u = fieldAt(uv + vec2(0.0, uTexel.y)).r;
    return l + r + d + u - c * 4.0;
  }

  void main() {
    vec2 uv = vUv;
    vec2 previousVelocity = velocityAt(uv);
    vec2 backUv = uv - previousVelocity * uDelta * 1.55;
    vec4 center = fieldAt(backUv);
    vec4 left = fieldAt(backUv - vec2(uTexel.x, 0.0));
    vec4 right = fieldAt(backUv + vec2(uTexel.x, 0.0));
    vec4 down = fieldAt(backUv - vec2(0.0, uTexel.y));
    vec4 up = fieldAt(backUv + vec2(0.0, uTexel.y));

    float height = center.r;
    vec2 gradH = vec2(right.r - left.r, up.r - down.r);
    vec2 gradG = vec2(right.g - left.g, up.g - down.g);
    vec2 gradPhi = vec2(right.a - left.a, up.a - down.a);
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
    vec2 gradPressure = vec2(pressureR - pressureL, pressureU - pressureD);
    vec2 gradGamma = vec2(gammaR - gammaL, gammaU - gammaD);

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
    vec2 marangoni = gradGamma * filmMobility * (0.24 + uMarangoni * 0.56);
    vec2 capillary = -gradPressure * filmMobility * (0.18 + uCapillary * 0.52);
    vec2 drainageSlope = -gradH * uDrainage * (0.04 + height * 0.12);
    vec2 phaseBoundaryForce = -gradPhi * (phi * phi - 1.0 - lapPhi * 0.9) * (0.02 + uCapillary * 0.045);

    float divergence = ((rightV.x - leftV.x) + (upV.y - downV.y)) * 0.5;
    vec2 velocity = advectedVelocity;
    velocity += (externalFlow + marangoni + capillary + drainageSlope + phaseBoundaryForce) * uDelta * (0.72 + mobility * 0.62);
    velocity += viscous * clamp(uViscosity, 0.0, 1.5) * 0.68;
    velocity -= gradH * divergence * 0.42;
    velocity *= 0.992 - clamp(uViscosity, 0.0, 1.5) * 0.016;
    velocity = clamp(velocity, vec2(-0.23), vec2(0.23));

    gl_FragColor = encodeVelocity(velocity, divergence);
  }
`;

const DIVERGENCE_FRAGMENT_SHADER = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uVelocity;
  uniform vec2 uTexel;

  vec2 decodeVelocity(vec4 encoded) {
    return (encoded.rg - 0.5) * 0.5;
  }

  vec2 velocityAt(vec2 uv) {
    return decodeVelocity(texture2D(uVelocity, clamp(uv, vec2(0.002), vec2(0.998))));
  }

  void main() {
    vec2 left = velocityAt(vUv - vec2(uTexel.x, 0.0));
    vec2 right = velocityAt(vUv + vec2(uTexel.x, 0.0));
    vec2 down = velocityAt(vUv - vec2(0.0, uTexel.y));
    vec2 up = velocityAt(vUv + vec2(0.0, uTexel.y));
    float divergence = (right.x - left.x + up.y - down.y) * 0.5;
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

  vec2 decodeVelocity(vec4 encoded) {
    return (encoded.rg - 0.5) * 0.5;
  }

  vec4 encodeVelocity(vec2 velocity) {
    return vec4(clamp(0.5 + velocity * 2.0, vec2(0.0), vec2(1.0)), 0.5, 1.0);
  }

  float pressureAt(vec2 uv) {
    return texture2D(uPressure, clamp(uv, vec2(0.002), vec2(0.998))).r;
  }

  void main() {
    vec2 velocity = decodeVelocity(texture2D(uVelocity, clamp(vUv, vec2(0.002), vec2(0.998))));
    float left = pressureAt(vUv - vec2(uTexel.x, 0.0));
    float right = pressureAt(vUv + vec2(uTexel.x, 0.0));
    float down = pressureAt(vUv - vec2(0.0, uTexel.y));
    float up = pressureAt(vUv + vec2(0.0, uTexel.y));
    vec2 gradPressure = vec2(right - left, up - down) * 0.5;
    velocity -= gradPressure * 0.72;
    velocity = clamp(velocity, vec2(-0.24), vec2(0.24));
    gl_FragColor = encodeVelocity(velocity);
  }
`;

const FIELD_STEP_FRAGMENT_SHADER = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uField;
  uniform sampler2D uVelocity;
  uniform vec2 uTexel;
  uniform float uTime;
  uniform float uDelta;
  uniform float uPressure;
  uniform float uFlowDirection;
  uniform float uFlowSpeed;
  uniform float uDiffusion;
  uniform float uDripAmount;
  uniform float uDrainage;
  uniform float uSourceAmount;
  uniform float uFoamSource;
  uniform float uFoamDecay;

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
    return texture2D(uField, clamp(uv, vec2(0.002), vec2(0.998)));
  }

  vec2 decodeVelocity(vec4 encoded) {
    return (encoded.rg - 0.5) * 0.5;
  }

  vec2 velocityAt(vec2 uv) {
    return decodeVelocity(texture2D(uVelocity, clamp(uv, vec2(0.002), vec2(0.998))));
  }

  void main() {
    vec2 uv = vUv;
    vec2 velocity = velocityAt(uv);
    vec2 backUv = uv - velocity * uDelta * (1.45 + uFlowSpeed * 0.22);
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

    vec2 leftV = velocityAt(backUv - vec2(uTexel.x, 0.0));
    vec2 rightV = velocityAt(backUv + vec2(uTexel.x, 0.0));
    vec2 downV = velocityAt(backUv - vec2(0.0, uTexel.y));
    vec2 upV = velocityAt(backUv + vec2(0.0, uTexel.y));

    float height = center.r;
    float surfactant = center.g;
    float foam = center.b;
    float dye = center.a;
    vec2 gradH = vec2(right.r - left.r, up.r - down.r);
    vec2 gradG = vec2(right.g - left.g, up.g - down.g);
    float lapH = left.r + right.r + up.r + down.r - height * 4.0;
    float lapG = left.g + right.g + up.g + down.g - surfactant * 4.0;
    float lapFoam = left.b + right.b + up.b + down.b - foam * 4.0;
    float lapDye = left.a + right.a + up.a + down.a - dye * 4.0;
    vec2 gradDye = vec2(right.a - left.a, up.a - down.a);
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
    float cahnHilliard = lapBulk - biLapPhi * 0.72;
    float divergence = ((rightV.x - leftV.x) + (upV.y - downV.y)) * 0.5;
    float fluxDiv = ((right.r * rightV.x - left.r * leftV.x) + (up.r * upV.y - down.r * downV.y)) * 0.5;
    float shear = length(rightV - leftV) + length(upV - downV);

    vec2 mainDir = normalize(vec2(cos(uFlowDirection), sin(uFlowDirection)));
    float upstream = dot(uv - vec2(0.5), -mainDir);
    float inlet = smoothstep(0.05, 0.62, upstream + 0.35);
    float sourceNoise = fbm(uv * vec2(5.2, 13.0) + mainDir * uTime * 0.05 + vec2(dye * 2.0, -dye));
    float sourceLane = pow(clamp(sourceNoise, 0.0, 1.0), 6.8) * inlet;
    float edgeLoss = smoothstep(0.5, 0.78, length(uv - vec2(0.5)));
    float thinFilm = smoothstep(0.4, 0.88, 1.0 - height);
    float meniscus = smoothstep(0.012, 0.085, length(gradH)) * smoothstep(0.24, 0.9, height);
    float beadBreakup = smoothstep(0.82, 0.98, height) * smoothstep(0.04, 0.18, length(gradH));
    float dyeEdge = length(gradDye);
    float foamBirth = (shear * 2.8 + abs(lapH) * 14.0 + dyeEdge * 13.0 + meniscus * 0.82 + beadBreakup * 0.44) * thinFilm;
    float drainageLoss = uDrainage * uDripAmount * (0.002 + height * height * 0.014 + edgeLoss * 0.01);
    float heightQuench = smoothstep(0.6, 0.9, height) * smoothstep(0.1, 0.52, foam + abs(lapH) * 3.0);
    float phaseMobility = 0.055 + uDripAmount * 0.018 + shear * 0.028;

    height += uDelta * (
      lapH * (0.006 + uDiffusion * 0.024) -
      fluxDiv * 1.42 -
      divergence * height * 0.18 -
      drainageLoss +
      sourceLane * uSourceAmount * (0.01 + uPressure * 0.004) -
      beadBreakup * 0.003
    );
    surfactant += uDelta * (
      lapG * (0.025 + uDiffusion * 0.075) -
      divergence * surfactant * 0.22 -
      dot(gradH, gradG) * 0.18 +
      (0.52 - surfactant) * 0.018 -
      sourceLane * uSourceAmount * 0.006
    );
    foam += uDelta * (
      lapFoam * (0.004 + uDiffusion * 0.011) +
      foamBirth * uFoamSource * 0.14 +
      sourceLane * uFoamSource * 0.014 -
      foam * (0.022 + uFoamDecay * 0.082 + height * 0.01)
    );
    dye += uDelta * (
      cahnHilliard * phaseMobility * 0.42 +
      lapDye * (0.0008 + uDiffusion * 0.0035) +
      sourceLane * uSourceAmount * 0.0008 +
      foamBirth * uFoamSource * 0.0032 -
      (dye - 0.5) * heightQuench * 0.018 -
      dye * (edgeLoss * 0.016 + uDrainage * 0.0025)
    );

    gl_FragColor = vec4(
      clamp(height, 0.035, 0.975),
      clamp(surfactant, 0.025, 0.975),
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
  const seedBase = Number.isFinite(options.seed) ? options.seed : DEFAULT_SIM_SEED;
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

  let fieldRead = createRenderTarget(size, targetOptions);
  let fieldWrite = createRenderTarget(size, targetOptions);
  let velocityRead = createRenderTarget(size, targetOptions);
  let velocityWrite = createRenderTarget(size, targetOptions);
  let divergenceTarget = createRenderTarget(size, targetOptions);
  let pressureRead = createRenderTarget(size, targetOptions);
  let pressureWrite = createRenderTarget(size, targetOptions);

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

  const fieldMaterial = new THREE.ShaderMaterial({
    vertexShader: SIM_VERTEX_SHADER,
    fragmentShader: FIELD_STEP_FRAGMENT_SHADER,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uField: { value: fieldRead.texture },
      uVelocity: { value: velocityRead.texture },
      uTexel: { value: new THREE.Vector2(1 / size, 1 / size) },
      uTime: { value: 0 },
      uDelta: { value: FIXED_SIM_DT },
      uPressure: { value: 0 },
      uFlowDirection: { value: 92 * Math.PI / 180 },
      uFlowSpeed: { value: 0.46 },
      uDiffusion: { value: 0.38 },
      uDripAmount: { value: 1.24 },
      uDrainage: { value: 0.58 },
      uSourceAmount: { value: 0.7 },
      uFoamSource: { value: 0.78 },
      uFoamDecay: { value: 0.28 },
    },
  });

  let lastTime = 0;
  let accumulator = 0;
  let simTime = 0;
  let needsPrewarm = true;

  function assignTextures() {
    velocityMaterial.uniforms.uField.value = fieldRead.texture;
    velocityMaterial.uniforms.uVelocity.value = velocityRead.texture;
    divergenceMaterial.uniforms.uVelocity.value = velocityRead.texture;
    pressureJacobiMaterial.uniforms.uPressure.value = pressureRead.texture;
    pressureJacobiMaterial.uniforms.uDivergence.value = divergenceTarget.texture;
    projectVelocityMaterial.uniforms.uVelocity.value = velocityRead.texture;
    projectVelocityMaterial.uniforms.uPressure.value = pressureRead.texture;
    fieldMaterial.uniforms.uField.value = fieldRead.texture;
    fieldMaterial.uniforms.uVelocity.value = velocityRead.texture;
  }

  function updateTexelUniforms() {
    const texel = new THREE.Vector2(1 / size, 1 / size);
    velocityMaterial.uniforms.uTexel.value.copy(texel);
    divergenceMaterial.uniforms.uTexel.value.copy(texel);
    pressureJacobiMaterial.uniforms.uTexel.value.copy(texel);
    projectVelocityMaterial.uniforms.uTexel.value.copy(texel);
    fieldMaterial.uniforms.uTexel.value.copy(texel);
  }

  function disposeTargets() {
    fieldRead.dispose();
    fieldWrite.dispose();
    velocityRead.dispose();
    velocityWrite.dispose();
    divergenceTarget.dispose();
    pressureRead.dispose();
    pressureWrite.dispose();
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
    quad.material = clearPressureMaterial;
    renderToTarget(renderer, scene, camera, divergenceTarget);
    renderToTarget(renderer, scene, camera, pressureRead);
    renderToTarget(renderer, scene, camera, pressureWrite);
    assignTextures();
    lastTime = 0;
    accumulator = 0;
    simTime = 0;
    needsPrewarm = true;
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
    updateTexelUniforms();
    reset();
  }

  function applyUniforms(material, dt, config, pressure) {
    const flowDirection = (config.filmFlowDirection ?? 92) * Math.PI / 180;
    material.uniforms.uTime.value = simTime;
    material.uniforms.uDelta.value = dt;
    material.uniforms.uPressure.value = pressure;
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

  function step(dt, config, pressure) {
    simTime += dt;
    assignTextures();
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

    velocityMaterial.uniforms.uVelocity.value = velocityRead.texture;
    fieldMaterial.uniforms.uVelocity.value = velocityRead.texture;
    fieldMaterial.uniforms.uField.value = fieldRead.texture;
    applyUniforms(fieldMaterial, dt, config, pressure);
    quad.material = fieldMaterial;
    renderToTarget(renderer, scene, camera, fieldWrite);
    swapField();
    assignTextures();
  }

  function update(timeSeconds, config = {}, pressure = 0) {
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

  function dispose() {
    disposeTargets();
    initFieldMaterial.dispose();
    initVelocityMaterial.dispose();
    velocityMaterial.dispose();
    divergenceMaterial.dispose();
    clearPressureMaterial.dispose();
    pressureJacobiMaterial.dispose();
    projectVelocityMaterial.dispose();
    fieldMaterial.dispose();
    geometry.dispose();
  }

  reset();

  return {
    get texture() {
      return fieldRead.texture;
    },
    get velocityTexture() {
      return velocityRead.texture;
    },
    get size() {
      return size;
    },
    reset,
    resize,
    update,
    dispose,
  };
}
