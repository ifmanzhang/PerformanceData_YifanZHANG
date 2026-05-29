import * as THREE from "../../vendor/three.module.min.js";
import { clamp, lerp, pressureWindow, smoothstep } from "../utils/math.js";
import { createThinFilmSimulator } from "./thinFilmSim.js";

let els = null;

const GPU_THIN_FILM_SIM_MODE = true;
const FRONT_HEMISPHERE_TEST_MODE = false;
const SINGLE_REFERENCE_FILM_TEST_MODE = false;
const FRONT_HEMISPHERE_MIN_FACING = 0.38;

const logo3d = {
  ready: false,
  renderer: null,
  scene: null,
  camera: null,
  group: null,
  core: null,
  coreUniforms: null,
  glass: null,
  glassUniforms: null,
  thinFilmSim: null,
  filmSurface: null,
  filmUniforms: null,
  glow: null,
  centerGlow: null,
  shellHighlight: null,
  petals: [],
  flowFan: null,
  flowFanGeometry: null,
  flowLine: null,
  flowLineGeometry: null,
  curveCloud: null,
  curveGeometry: null,
  curveLines: null,
  curveLineGeometry: null,
  particles: null,
  particleMaterial: null,
  goldDust: null,
  goldDustUniforms: null,
  lights: [],
  width: 0,
  height: 0,
  baseScale: 1,
  pixelRatio: 0,
  pixelRatioLimit: 1.25,
};

const LOGO3D_RESET = {
  ready: false,
  renderer: null,
  scene: null,
  camera: null,
  group: null,
  core: null,
  coreUniforms: null,
  glass: null,
  glassUniforms: null,
  thinFilmSim: null,
  filmSurface: null,
  filmUniforms: null,
  glow: null,
  centerGlow: null,
  shellHighlight: null,
  petals: [],
  flowFan: null,
  flowFanGeometry: null,
  flowLine: null,
  flowLineGeometry: null,
  curveCloud: null,
  curveGeometry: null,
  curveLines: null,
  curveLineGeometry: null,
  particles: null,
  particleMaterial: null,
  goldDust: null,
  goldDustUniforms: null,
  lights: [],
  width: 0,
  height: 0,
  baseScale: 1,
  pixelRatio: 0,
};

const LIGHT_PALETTE = {
  ambientCalm: new THREE.Color(0x9adce0),
  ambientClinical: new THREE.Color(0xd8fff2),
  cyanCalm: new THREE.Color(0x68e5ec),
  cyanClinical: new THREE.Color(0xb8eadc),
  roseCalm: new THREE.Color(0xd68d9f),
  roseClinical: new THREE.Color(0x8a7a4b),
  glowCalm: new THREE.Color(0xd9fffb),
  glowClinical: new THREE.Color(0xe8f4f1),
  highlightCalm: new THREE.Color(0xffffff),
  highlightClinical: new THREE.Color(0xd9eee6),
  centerCalm: new THREE.Color(0xffffff),
  centerClinical: new THREE.Color(0xecf5f1),
  particleCalm: new THREE.Color(0xe9fffb),
  particleClinical: new THREE.Color(0xd9e8df),
};

const CAMERA_VIEWS = {
  near: {
    cameraZ: 5.9,
    scale: 1.72,
    x: -0.16,
    y: -0.3,
    rotateX: -0.2,
    rotateY: -0.08,
    rotateZ: 0.015,
  },
  macro: {
    cameraZ: 5.55,
    scale: 2.22,
    x: -0.24,
    y: -0.52,
    rotateX: -0.28,
    rotateY: -0.12,
    rotateZ: 0.02,
  },
  wide: {
    cameraZ: 6.6,
    scale: 0.96,
    x: -0.03,
    y: 0.02,
    rotateX: -0.02,
    rotateY: -0.04,
    rotateZ: 0,
  },
};

function cameraViewFor(visualTuning = {}) {
  return CAMERA_VIEWS[visualTuning.cameraView] || CAMERA_VIEWS.near;
}

function mixRgb(a, b, t) {
  return [
    lerp(a[0], b[0], t),
    lerp(a[1], b[1], t),
    lerp(a[2], b[2], t),
  ];
}

function desaturateRgb(color, amount) {
  const luma = color[0] * 0.299 + color[1] * 0.587 + color[2] * 0.114;
  return [
    lerp(color[0], luma, amount),
    lerp(color[1], luma, amount),
    lerp(color[2], luma, amount),
  ];
}

function clinicalRgb(calm, clinical, shift, desaturateAmount = 0.5) {
  const mixed = mixRgb(calm, clinical, clamp(shift, 0, 1));
  return desaturateRgb(mixed, clamp(shift * desaturateAmount, 0, 1));
}

function clinicalShiftForTimeline(pressure, visualTuning = {}, stageName = "") {
  const start = visualTuning.clinicalShiftStart ?? 0.62;
  const end = Math.max(start + 0.04, visualTuning.clinicalShiftEnd ?? 0.96);
  const amount = visualTuning.clinicalShiftAmount ?? 1;
  const pressureShift = smoothstep((pressure - start) / (end - start));
  const afterEvaluation = stageName === "overload" || stageName === "ending";
  const endingHold = stageName === "ending" ? 1 : 0;
  return clamp(Math.max(afterEvaluation ? pressureShift : 0, endingHold) * amount, 0, 1);
}

function disposeMaterial(material) {
  if (!material) return;
  if (Array.isArray(material)) {
    material.forEach(disposeMaterial);
    return;
  }
  Object.values(material).forEach((value) => {
    if (value?.isTexture) value.dispose();
  });
  Object.values(material.uniforms || {}).forEach((uniform) => {
    if (uniform?.value?.isTexture) uniform.value.dispose();
  });
  material.dispose?.();
}

export function disposeLogo3d() {
  if (!logo3d.ready) return;
  logo3d.thinFilmSim?.dispose?.();
  logo3d.scene?.traverse((object) => {
    object.geometry?.dispose?.();
    disposeMaterial(object.material);
  });
  logo3d.renderer?.renderLists?.dispose?.();
  logo3d.renderer?.dispose?.();
  logo3d.renderer?.forceContextLoss?.();
  Object.assign(logo3d, LOGO3D_RESET, {
    pixelRatioLimit: logo3d.pixelRatioLimit,
  });
}

function createGlowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(128, 128, 8, 128, 128, 126);
  gradient.addColorStop(0, "rgba(255,255,255,0.95)");
  gradient.addColorStop(0.24, "rgba(176,226,222,0.44)");
  gradient.addColorStop(0.56, "rgba(206,143,154,0.12)");
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(canvas);
}

function createCenterGlowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  gradient.addColorStop(0, "rgba(245,255,250,0.42)");
  gradient.addColorStop(0.18, "rgba(238,252,246,0.28)");
  gradient.addColorStop(0.36, "rgba(154,224,219,0.12)");
  gradient.addColorStop(0.6, "rgba(211,132,146,0.035)");
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(canvas);
}

function createShellHighlightTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 384;
  canvas.height = 192;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(150, 92, 0, 150, 92, 164);
  gradient.addColorStop(0, "rgba(248,255,252,0.34)");
  gradient.addColorStop(0.18, "rgba(226,244,239,0.2)");
  gradient.addColorStop(0.38, "rgba(138,222,216,0.075)");
  gradient.addColorStop(0.56, "rgba(205,128,140,0.025)");
  gradient.addColorStop(0.72, "rgba(0,0,0,0)");
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const streak = ctx.createLinearGradient(42, 114, 328, 76);
  streak.addColorStop(0, "rgba(0,0,0,0)");
  streak.addColorStop(0.36, "rgba(255,255,255,0.08)");
  streak.addColorStop(0.5, "rgba(255,255,255,0.24)");
  streak.addColorStop(0.66, "rgba(164,226,218,0.06)");
  streak.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalCompositeOperation = "screen";
  ctx.fillStyle = streak;
  ctx.beginPath();
  ctx.ellipse(186, 92, 138, 14, -0.13, 0, Math.PI * 2);
  ctx.fill();
  return new THREE.CanvasTexture(canvas);
}

function createCoreMaterial() {
  const uniforms = {
    uTime: { value: 0 },
    uPressure: { value: 0 },
    uBrightness: { value: 0.5 },
    uClinicalShift: { value: 0 },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: `
      uniform float uTime;
      uniform float uPressure;
      varying vec3 vNormal;
      varying vec3 vPosition;

      void main() {
        vNormal = normalize(normalMatrix * normal);
        vPosition = position;
        float wave =
          sin(position.x * 4.6 + uTime * 0.76) +
          sin(position.y * 5.2 - uTime * 0.62) +
          sin(position.z * 4.1 + uTime * 0.92);
        vec3 displaced = position + normal * wave * (0.012 + uPressure * 0.026);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uPressure;
      uniform float uBrightness;
      uniform float uClinicalShift;
      varying vec3 vNormal;
      varying vec3 vPosition;

      void main() {
        vec3 n = normalize(vNormal);
        float fresnel = pow(1.0 - abs(n.z), 2.1);
        float f1 = sin(vPosition.x * 3.6 + uTime * 0.72);
        float f2 = sin(vPosition.y * 4.2 - uTime * 0.58);
        float f3 = sin((vPosition.x - vPosition.y + vPosition.z) * 3.1 + uTime * 0.86);
        float flow = (f1 + f2 + f3) / 3.0;

        vec3 coldWhite = vec3(0.84, 0.92, 0.90);
        vec3 paleGreen = vec3(0.55, 0.73, 0.63);
        vec3 darkGold = vec3(0.48, 0.39, 0.22);
        vec3 cyan = mix(vec3(0.32, 0.84, 0.80), paleGreen, uClinicalShift);
        vec3 mint = mix(vec3(0.62, 0.90, 0.74), paleGreen, uClinicalShift * 0.86);
        vec3 rose = mix(vec3(0.82, 0.43, 0.54), vec3(0.74, 0.70, 0.66), uClinicalShift);
        vec3 amber = mix(vec3(0.86, 0.66, 0.28), darkGold, uClinicalShift);

        vec3 color = mix(cyan, rose, smoothstep(-0.62, 0.78, flow));
        color = mix(color, mint, smoothstep(0.18, 0.92, f2) * 0.34);
        color = mix(color, amber, smoothstep(0.44, 0.98, f3) * (0.18 + uPressure * 0.22));
        color += fresnel * mix(vec3(0.36, 0.72, 0.68), coldWhite, uClinicalShift) * (0.12 + uBrightness * 0.08);

        float luma = dot(color, vec3(0.299, 0.587, 0.114));
        vec3 clinical = mix(coldWhite, paleGreen, smoothstep(-0.2, 0.72, flow));
        clinical = mix(clinical, darkGold, smoothstep(0.46, 0.98, f3) * 0.38);
        color = mix(color, mix(vec3(luma), clinical, 0.54), uClinicalShift * 0.72);

        float alpha = 0.032 + fresnel * 0.074;
        gl_FragColor = vec4(color * (0.18 + uBrightness * 0.12), alpha);
      }
    `,
  });

  return { material, uniforms };
}

function createPhysicalThinFilmShellMaterial(filmStateTexture, simSize = 256) {
  const uniforms = {
    uTime: { value: 0 },
    uPressure: { value: 0 },
    uBrightness: { value: 0.5 },
    uClinicalShift: { value: 0 },
    uFilmStateMap: { value: filmStateTexture },
    uFilmTexel: { value: new THREE.Vector2(1 / simSize, 1 / simSize) },
    uEdge: { value: 0.1 },
    uDeform: { value: 0 },
    uWindBase: { value: 0.68 },
    uWindGustAmount: { value: 0.23 },
    uWindGustSpeed: { value: 0.39 },
    uWindYawAmount: { value: 0.72 },
    uWindYawSpeed: { value: 0.21 },
    uWindPitchAmount: { value: 0.32 },
    uWindPitchSpeed: { value: 0.27 },
    uDownwindBulge: { value: 0.2 },
    uUpwindCompression: { value: 0.1 },
    uRimFlutterAmount: { value: 0.038 },
    uSurfaceWaveAmount: { value: 0.07 },
    uFilmFlowSpeed: { value: 0.46 },
    uFilmFlowDirection: { value: 92 * Math.PI / 180 },
    uFilmFlowCoherence: { value: 0.76 },
    uFilmDiffusionAmount: { value: 0.38 },
    uFilmDripAmount: { value: 1.24 },
    uFilmBandContrast: { value: 1.22 },
    uFilmCoverage: { value: 1.08 },
    uFilmSpeckleAmount: { value: 0.86 },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
    blending: THREE.NormalBlending,
    vertexShader: `
      uniform float uTime;
      uniform float uPressure;
      uniform float uDeform;
      uniform float uWindBase;
      uniform float uWindGustAmount;
      uniform float uWindGustSpeed;
      uniform float uWindYawAmount;
      uniform float uWindYawSpeed;
      uniform float uWindPitchAmount;
      uniform float uWindPitchSpeed;
      uniform float uDownwindBulge;
      uniform float uUpwindCompression;
      uniform float uRimFlutterAmount;
      uniform float uSurfaceWaveAmount;
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;
      varying vec3 vLocalPosition;

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
          p = mat2(1.62, 1.18, -1.18, 1.62) * p + vec2(0.13, 0.31);
          amplitude *= 0.52;
        }
        return value;
      }

      void main() {
        vec3 localDir = normalize(position);
        float gust = uWindBase + sin(uTime * uWindGustSpeed) * uWindGustAmount + sin(uTime * (uWindGustSpeed * 2.33) + 1.7) * uWindGustAmount * 0.6 + sin(uTime * (uWindGustSpeed * 3.77)) * uWindGustAmount * 0.3;
        float wind = clamp(uDeform * (0.72 + uPressure * 0.38) * gust, 0.0, 1.15);
        float yaw = sin(uTime * uWindYawSpeed) * uWindYawAmount + sin(uTime * (uWindYawSpeed * 0.32) + 1.7) * uWindYawAmount * 0.52;
        float pitch = sin(uTime * uWindPitchSpeed + 0.8) * uWindPitchAmount + sin(uTime * (uWindPitchSpeed * 2.33)) * uWindPitchAmount * 0.25;
        vec3 windDir = normalize(vec3(cos(yaw) * cos(pitch), sin(pitch), sin(yaw) * cos(pitch) * 0.52));
        vec3 crossDir = normalize(cross(windDir, vec3(0.0, 1.0, 0.0)));
        vec3 liftDir = normalize(cross(crossDir, windDir));
        float alongWind = dot(localDir, windDir);
        float lift = dot(localDir, liftDir);
        float side = dot(localDir, crossDir);
        float membraneWave =
          sin(alongWind * 5.6 + lift * 2.2 - uTime * 0.72) * 0.48 +
          sin(side * 4.8 - alongWind * 1.6 + uTime * 0.44) * 0.34 +
          sin((side + lift) * 8.2 - uTime * 0.28) * 0.18;
        float downwind = smoothstep(-0.18, 0.86, alongWind);
        float upwind = smoothstep(0.2, -0.82, alongWind);
        float rimFlutter = pow(1.0 - abs(alongWind), 2.0) * sin(side * 10.8 + uTime * 0.82);
        float surfaceTension = 0.7 + 0.3 * sin(uTime * 0.16 + side * 2.0);

        vec3 membrane = position;
        membrane += windDir * wind * (0.052 + downwind * (uDownwindBulge + 0.06) - upwind * uUpwindCompression);
        membrane += liftDir * wind * (0.03 * sin(uTime * 0.21) + lift * 0.028);
        membrane += crossDir * wind * side * (0.024 + downwind * 0.036);
        membrane += localDir * wind * (downwind * uDownwindBulge - upwind * uUpwindCompression + membraneWave * uSurfaceWaveAmount);
        membrane += crossDir * rimFlutter * wind * uRimFlutterAmount * surfaceTension;

        vLocalPosition = membrane;
        vec4 worldPosition = modelMatrix * vec4(membrane, 1.0);
        vWorldPosition = worldPosition.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normalize(mix(normal, membrane, 0.42)));
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uPressure;
      uniform float uBrightness;
      uniform float uClinicalShift;
      uniform sampler2D uFilmStateMap;
      uniform vec2 uFilmTexel;
      uniform float uEdge;
      uniform float uFilmBandContrast;
      uniform float uFilmCoverage;
      uniform float uFilmSpeckleAmount;
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;
      varying vec3 vLocalPosition;

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
          p = mat2(1.61, 1.17, -1.17, 1.61) * p + vec2(0.21, 0.13);
          amplitude *= 0.52;
        }
        return value;
      }

      vec3 thinFilmRgb(float thickness, float cosTheta) {
        vec3 wavelength = vec3(0.66, 0.53, 0.45);
        vec3 phase = (4.0 * 3.14159265 * 1.33 * thickness * cosTheta) / wavelength + 3.14159265;
        vec3 reflected = 0.5 + 0.5 * cos(phase);
        vec3 softened = pow(clamp(reflected, vec3(0.0), vec3(1.0)), vec3(1.38));
        float luma = dot(softened, vec3(0.299, 0.587, 0.114));
        return clamp(mix(vec3(luma), softened * vec3(1.08, 1.0, 1.14), 0.58), vec3(0.0), vec3(1.12));
      }

      vec4 filmAt(vec2 uv) {
        return texture2D(uFilmStateMap, clamp(uv, vec2(0.002), vec2(0.998)));
      }

      void main() {
        vec3 normal = normalize(vWorldNormal);
        vec3 local = normalize(vLocalPosition);
        vec3 viewDir = normalize(cameraPosition - vWorldPosition);
        float facing = clamp(dot(normal, viewDir), 0.0, 1.0);
        float frontMask = smoothstep(0.05, 0.28, facing);
        if (frontMask < 0.012) discard;

        vec2 filmUv = vec2(0.5 + local.x * 0.49, 0.5 + local.y * 0.49);
        vec4 state = filmAt(filmUv);
        vec4 left = filmAt(filmUv - vec2(uFilmTexel.x, 0.0));
        vec4 right = filmAt(filmUv + vec2(uFilmTexel.x, 0.0));
        vec4 down = filmAt(filmUv - vec2(0.0, uFilmTexel.y));
        vec4 up = filmAt(filmUv + vec2(0.0, uFilmTexel.y));

        float height = state.r;
        float surfactant = state.g;
        vec2 filmVelocity = (state.ba - 0.5) * 2.0;
        float velocityMag = clamp(length(filmVelocity) * 3.6, 0.0, 1.0);
        vec2 gradH = vec2(right.r - left.r, up.r - down.r);
        vec2 gradG = vec2(right.g - left.g, up.g - down.g);
        float slope = clamp(length(gradH) * 22.0 + length(gradG) * 8.0, 0.0, 1.0);
        vec3 opticalNormal = normalize(normal + vec3(-gradH.x * 1.25, -gradH.y * 1.25, 0.0));
        float rim = 1.0 - facing;
        float fresnel = pow(rim, 2.55);
        float cosTheta = mix(0.52, 1.0, facing);
        float opticalThickness = 0.16 + height * (1.34 + uFilmBandContrast * 0.28) + (surfactant - 0.5) * 0.24 + slope * 0.08;
        vec3 physical = thinFilmRgb(opticalThickness * (1.08 + uPressure * 0.16), cosTheta);

        vec3 amber = vec3(0.98, 0.55, 0.08);
        vec3 honey = vec3(1.0, 0.74, 0.24);
        vec3 darkGold = vec3(0.48, 0.36, 0.18);
        vec3 cyan = vec3(0.02, 0.78, 0.88);
        vec3 aqua = vec3(0.18, 0.9, 0.76);
        vec3 rose = vec3(0.82, 0.18, 0.38);
        vec3 violet = vec3(0.3, 0.12, 0.78);
        vec3 pearl = vec3(1.0, 0.92, 0.68);
        vec3 coldWhite = vec3(0.84, 0.92, 0.89);
        vec3 paleGreen = vec3(0.55, 0.74, 0.62);

        float thinFilm = smoothstep(0.28, 0.72, 1.0 - height + slope * 0.08);
        float cyanChannel = pow(clamp(thinFilm * (0.42 + surfactant * 0.48), 0.0, 1.0), 1.35);
        float amberPool = smoothstep(0.1, 0.78, height) * (0.92 + (1.0 - surfactant) * 0.12);
        float boundary = pow(slope, 0.82) * (0.44 + thinFilm * 0.36);
        float roseBoundary = boundary * smoothstep(0.42, 0.96, physical.r);
        float violetBoundary = boundary * smoothstep(0.48, 0.98, physical.b);
        vec2 flowDir = normalize(filmVelocity + vec2(0.08, -0.32));
        vec2 flowCross = vec2(-flowDir.y, flowDir.x);
        vec2 flowUv = vec2(dot(filmUv, flowCross), dot(filmUv, flowDir));
        float microPearl = smoothstep(0.72, 0.972, fbm(filmUv * vec2(42.0, 82.0) + flowDir * uTime * 0.035));
        float microStreak = smoothstep(0.5, 0.82, fbm(vec2(flowUv.x * 16.0 + height * 1.7, flowUv.y * 54.0 + uTime * 0.045)));
        float whiteSpeck = clamp(microPearl * microStreak * (0.13 + slope * 0.28 + velocityMag * 0.18), 0.0, 1.0);

        vec3 color = mix(amber, honey, smoothstep(0.18, 0.74, height));
        color = mix(color, darkGold, smoothstep(0.86, 0.99, height) * 0.18);
        color = mix(color, honey * 1.05, amberPool * 0.32);
        color = mix(color, physical, 0.3 + boundary * 0.24);
        color = mix(color, cyan, cyanChannel * 0.34);
        color = mix(color, aqua, cyanChannel * smoothstep(0.24, 0.92, physical.g) * 0.2);
        color = mix(color, violet, violetBoundary * 0.24);
        color = mix(color, rose, roseBoundary * 0.18);
        color = mix(color, pearl, whiteSpeck * 0.52);

        float luma = dot(color, vec3(0.299, 0.587, 0.114));
        vec3 clinical = mix(coldWhite, paleGreen, smoothstep(0.18, 0.82, 1.0 - height + cyanChannel * 0.2));
        clinical = mix(clinical, darkGold, amberPool * 0.26);
        color = mix(color, mix(vec3(luma), clinical, 0.66), uClinicalShift * 0.72);

        float spec = pow(max(dot(reflect(normalize(vec3(0.45, -0.28, 0.84)), opticalNormal), viewDir), 0.0), 28.0);
        vec3 rimColor = mix(color, mix(cyan, rose, smoothstep(0.26, 0.82, physical.r)), 0.28);
        color += rimColor * fresnel * (0.22 + uEdge * 0.24);
        color += coldWhite * spec * (0.1 + slope * 0.14 + uBrightness * 0.08);
        color += pearl * microPearl * microStreak * (0.035 + slope * 0.05 + velocityMag * 0.035);
        color *= 0.98 + uBrightness * 0.34 + amberPool * 0.16 + boundary * 0.08;

        float alpha = frontMask * (0.46 + amberPool * 0.18 + cyanChannel * 0.1 + boundary * 0.12 + whiteSpeck * 0.06);
        alpha += frontMask * fresnel * (0.16 + uEdge * 0.1);
        alpha = clamp(alpha * uFilmCoverage * (0.94 + uPressure * 0.08), 0.08, 0.84);
        gl_FragColor = vec4(color, alpha);
      }
    `,
  });

  return { material, uniforms };
}

function createBubbleShellMaterial(referenceFilmTexture) {
  const uniforms = {
    uTime: { value: 0 },
    uPressure: { value: 0 },
    uBrightness: { value: 0.5 },
    uClinicalShift: { value: 0 },
    uReferenceFilmMap: { value: referenceFilmTexture },
    uReferenceFilmMix: { value: 1 },
    uEdge: { value: 0.1 },
    uDeform: { value: 0 },
    uWindBase: { value: 0.68 },
    uWindGustAmount: { value: 0.23 },
    uWindGustSpeed: { value: 0.39 },
    uWindYawAmount: { value: 0.72 },
    uWindYawSpeed: { value: 0.21 },
    uWindPitchAmount: { value: 0.32 },
    uWindPitchSpeed: { value: 0.27 },
    uDownwindBulge: { value: 0.2 },
    uUpwindCompression: { value: 0.1 },
    uRimFlutterAmount: { value: 0.038 },
    uSurfaceWaveAmount: { value: 0.07 },
    uFilmFlowSpeed: { value: 0.46 },
    uFilmFlowDirection: { value: 92 * Math.PI / 180 },
    uFilmFlowCoherence: { value: 0.76 },
    uFilmDiffusionAmount: { value: 0.38 },
    uFilmDripAmount: { value: 1.24 },
    uFilmBandContrast: { value: 1.22 },
    uFilmCoverage: { value: 1.08 },
    uFilmSpeckleAmount: { value: 0.86 },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
    blending: THREE.NormalBlending,
    vertexShader: `
      uniform float uTime;
      uniform float uPressure;
      uniform float uDeform;
      uniform float uWindBase;
      uniform float uWindGustAmount;
      uniform float uWindGustSpeed;
      uniform float uWindYawAmount;
      uniform float uWindYawSpeed;
      uniform float uWindPitchAmount;
      uniform float uWindPitchSpeed;
      uniform float uDownwindBulge;
      uniform float uUpwindCompression;
      uniform float uRimFlutterAmount;
      uniform float uSurfaceWaveAmount;
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;
      varying vec3 vLocalPosition;

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
          p = mat2(1.62, 1.18, -1.18, 1.62) * p + vec2(0.13, 0.31);
          amplitude *= 0.52;
        }
        return value;
      }

      void main() {
        vec3 localDir = normalize(position);
        float gust = uWindBase + sin(uTime * uWindGustSpeed) * uWindGustAmount + sin(uTime * (uWindGustSpeed * 2.33) + 1.7) * uWindGustAmount * 0.6 + sin(uTime * (uWindGustSpeed * 3.77)) * uWindGustAmount * 0.3;
        float wind = clamp(uDeform * (0.72 + uPressure * 0.38) * gust, 0.0, 1.15);
        float yaw = sin(uTime * uWindYawSpeed) * uWindYawAmount + sin(uTime * (uWindYawSpeed * 0.32) + 1.7) * uWindYawAmount * 0.52;
        float pitch = sin(uTime * uWindPitchSpeed + 0.8) * uWindPitchAmount + sin(uTime * (uWindPitchSpeed * 2.33)) * uWindPitchAmount * 0.25;
        vec3 windDir = normalize(vec3(cos(yaw) * cos(pitch), sin(pitch), sin(yaw) * cos(pitch) * 0.52));
        vec3 crossDir = normalize(cross(windDir, vec3(0.0, 1.0, 0.0)));
        vec3 liftDir = normalize(cross(crossDir, windDir));
        float alongWind = dot(localDir, windDir);
        float lift = dot(localDir, liftDir);
        float side = dot(localDir, crossDir);
        float membraneWave =
          sin(alongWind * 5.6 + lift * 2.2 - uTime * 0.72) * 0.48 +
          sin(side * 4.8 - alongWind * 1.6 + uTime * 0.44) * 0.34 +
          sin((side + lift) * 8.2 - uTime * 0.28) * 0.18;
        float downwind = smoothstep(-0.18, 0.86, alongWind);
        float upwind = smoothstep(0.2, -0.82, alongWind);
        float rimFlutter = pow(1.0 - abs(alongWind), 2.0) * sin(side * 10.8 + uTime * 0.82);
        float surfaceTension = 0.7 + 0.3 * sin(uTime * 0.16 + side * 2.0);

        vec3 membrane = position;
        membrane += windDir * wind * (0.052 + downwind * (uDownwindBulge + 0.06) - upwind * uUpwindCompression);
        membrane += liftDir * wind * (0.03 * sin(uTime * 0.21) + lift * 0.028);
        membrane += crossDir * wind * side * (0.024 + downwind * 0.036);
        membrane += localDir * wind * (downwind * uDownwindBulge - upwind * uUpwindCompression + membraneWave * uSurfaceWaveAmount);
        membrane += crossDir * rimFlutter * wind * uRimFlutterAmount * surfaceTension;

        vLocalPosition = membrane;
        vec4 worldPosition = modelMatrix * vec4(membrane, 1.0);
        vWorldPosition = worldPosition.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normalize(mix(normal, membrane, 0.42)));
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uPressure;
      uniform float uBrightness;
      uniform float uClinicalShift;
      uniform sampler2D uReferenceFilmMap;
      uniform float uReferenceFilmMix;
      uniform float uEdge;
      uniform float uFilmFlowSpeed;
      uniform float uFilmFlowDirection;
      uniform float uFilmFlowCoherence;
      uniform float uFilmDiffusionAmount;
      uniform float uFilmDripAmount;
      uniform float uFilmBandContrast;
      uniform float uFilmCoverage;
      uniform float uFilmSpeckleAmount;
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;
      varying vec3 vLocalPosition;

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
          p = mat2(1.62, 1.18, -1.18, 1.62) * p + vec2(0.13, 0.31);
          amplitude *= 0.52;
        }
        return value;
      }

      vec3 thinFilmRgb(float thickness, float cosTheta) {
        vec3 wavelength = vec3(0.64, 0.53, 0.46);
        vec3 phase = (4.0 * 3.14159265 * 1.33 * thickness * cosTheta) / wavelength + 3.14159265;
        vec3 reflected = 0.5 + 0.5 * cos(phase);
        return pow(clamp(reflected, vec3(0.0), vec3(1.0)), vec3(1.35));
      }

      float mirror01(float value) {
        float wrapped = mod(value, 2.0);
        return 1.0 - abs(wrapped - 1.0);
      }

      vec2 mirrorUv(vec2 uv) {
        return vec2(mirror01(uv.x), mirror01(uv.y));
      }

      vec2 referenceCropUv(vec2 uv) {
        vec2 wrapped = mirrorUv(uv);
        return vec2(
          mix(0.055, 0.945, wrapped.x),
          mix(0.145, 0.815, wrapped.y)
        );
      }

      void main() {
        vec3 normal = normalize(vWorldNormal);
        vec3 local = normalize(vLocalPosition);
        vec3 viewDir = normalize(cameraPosition - vWorldPosition);
        float facing = clamp(dot(normal, viewDir), 0.0, 1.0);
        float frontMask = smoothstep(${FRONT_HEMISPHERE_MIN_FACING.toFixed(2)}, ${(FRONT_HEMISPHERE_MIN_FACING + 0.14).toFixed(2)}, facing);
        if (frontMask < 0.01) discard;
        float rim = 1.0 - facing;
        float fresnel = pow(rim, 1.82);
        float broadRim = pow(rim, 2.65);
        float softRim = pow(rim, 3.35);
        float hardRim = pow(rim, 7.2);
        float band =
          sin(dot(local, normalize(vec3(1.7, -0.55, 1.1))) * 4.8 + local.y * 2.1 + uTime * 0.18) * 0.5 + 0.5;
        float band2 =
          sin(dot(local, normalize(vec3(-0.82, 1.35, 0.62))) * 5.6 + local.z * 2.4 - uTime * 0.22) * 0.5 + 0.5;
        float fineFilm =
          sin(dot(local, normalize(vec3(0.34, 0.88, -1.42))) * 9.4 + local.x * 2.2 + uTime * 0.34) * 0.5 + 0.5;
        float edgeVariation = 0.58 + band * 0.34 + fineFilm * 0.28;
        float sheetFlow = uTime * (0.075 + uPressure * 0.04) * uFilmFlowSpeed;
        float lateral = dot(local, normalize(vec3(0.72, 0.08, 0.46)));
        float vertical = local.y;
        vec2 surfaceUv = vec2(lateral * 1.18 + local.z * 0.36, -vertical * 1.52 + local.x * 0.08);
        vec2 mainFlowDir = normalize(vec2(cos(uFilmFlowDirection), sin(uFilmFlowDirection)));
        vec2 crossFlowDir = vec2(-mainFlowDir.y, mainFlowDir.x);
        float flowTime = uTime * (0.06 + uPressure * 0.028) * uFilmFlowSpeed;
        float localSlip = fbm(surfaceUv * 1.45 + vec2(0.18, -0.31));
        float velocity = mix(0.58, 1.42, localSlip) * (0.82 + uPressure * 0.18);
        float wander = (fbm(surfaceUv * 2.2 + vec2(flowTime * 0.06, -flowTime * 0.025)) - 0.5) * (1.0 - uFilmFlowCoherence) * 1.9;
        vec2 localFlowDir = normalize(mainFlowDir + crossFlowDir * wander);
        vec2 advectedUv = surfaceUv - localFlowDir * flowTime * velocity;
        vec2 tailUv = surfaceUv - localFlowDir * flowTime * (velocity * 1.45 + 0.18);
        float runnelSeed =
          sin(dot(advectedUv, vec2(9.0, 5.2)) + localSlip * 2.2 + sin(local.z * 8.0 + uTime * 0.1) * 0.8) * 0.5 + 0.5;
        float runnel = smoothstep(0.62, 0.98, runnelSeed) * smoothstep(-0.86, 0.68, vertical) * uFilmDripAmount;
        float dropletSeed =
          sin(dot(advectedUv, vec2(7.4, -11.2)) + localSlip * 4.8) *
          sin(dot(tailUv, vec2(-2.2, 8.6)) + vertical * 3.6);
        float droplet = pow(smoothstep(0.66, 1.0, dropletSeed * 0.5 + 0.5), 2.4) * uFilmDripAmount;
        float gravityFlow = flowTime;
        vec2 drainUv = advectedUv;
        float drainNoise = fbm(advectedUv * 1.25 + crossFlowDir * localSlip * 0.34);
        float shearNoise = fbm(advectedUv * vec2(2.65, 1.9) + localFlowDir * localSlip * 1.4 - mainFlowDir * flowTime * 0.28);
        float rivulet = smoothstep(0.56, 0.88, shearNoise) * (1.0 - smoothstep(0.88, 0.99, shearNoise)) * uFilmDripAmount;
        float fallingDrop = smoothstep(0.64, 0.96, fbm(advectedUv * vec2(4.9, 3.2) + crossFlowDir * shearNoise * 1.9)) * uFilmDripAmount;
        float trailingFilm = smoothstep(0.54, 0.82, fbm(tailUv * vec2(8.0, 10.4) + localFlowDir * drainNoise * 1.8)) * uFilmDripAmount;
        float bleed = smoothstep(0.4, 1.0, uFilmDiffusionAmount) * (0.35 + trailingFilm * 0.42 + rivulet * 0.22);
        float filmThickness =
          vertical * 9.2 +
          lateral * 3.8 -
          sheetFlow * 2.4 +
          runnel * 4.2 +
          droplet * 3.5 +
          rivulet * 3.2 +
          fallingDrop * 2.4 +
          trailingFilm * 1.35 +
          band * 2.0 +
          fineFilm * 1.5;
        vec3 diffraction = 0.56 + 0.44 * cos(vec3(0.1, 2.33, 4.55) + filmThickness);
        edgeVariation += (runnel * 0.14 + droplet * 0.18) * smoothstep(0.1, 0.92, rim);
        vec2 filmUv = vec2(lateral * 1.75 + local.z * 0.52, vertical * 1.38 - sheetFlow * 0.32 - gravityFlow * 0.34);
        float warpA = fbm(filmUv * 2.2 + vec2(sheetFlow * 0.08, -sheetFlow * 0.16));
        float warpB = fbm(filmUv * 4.6 + vec2(3.4, sheetFlow * 0.22));
        vec2 flowUv = filmUv;
        flowUv.x += (warpA - 0.5) * 1.35 + sin(flowUv.y * 4.2 - sheetFlow * 0.7) * 0.22;
        flowUv.y += (warpB - 0.5) * 0.72 + sin(flowUv.x * 2.8 + sheetFlow * 0.5) * 0.12;
        float eddyA = fbm(flowUv * 1.35 + vec2(sheetFlow * 0.06, -sheetFlow * 0.12));
        float eddyB = fbm(vec2(flowUv.x * 2.25 + eddyA * 0.9, flowUv.y * 3.45 - sheetFlow * 0.42));
        float sheetField = fbm(vec2(flowUv.x * 1.1 + eddyA * 1.4, flowUv.y * 2.85 + eddyB * 0.72 - sheetFlow * 0.34));
        float streamField = fbm(vec2(flowUv.x * 1.8 + sheetField * 1.2, flowUv.y * 5.1 - sheetFlow * 0.6));
        float liquidField = sheetField * 0.62 + eddyB * 0.38 - 0.5;
        float liquidRidge = smoothstep(0.42, 0.84, sheetField);
        float liquidChannel = smoothstep(0.48, 0.82, streamField) * (1.0 - smoothstep(0.9, 1.0, streamField));
        float microNoise = fbm(flowUv * 28.0 + vec2(sheetFlow * 0.52, -sheetFlow * 0.28));
        float speckle = smoothstep(0.62, 0.98, microNoise) * uFilmSpeckleAmount;
        float drainage = smoothstep(-0.86, 0.96, -vertical);
        float filmMicrons = clamp(
          0.18 +
          drainage * 0.62 +
          (eddyA - 0.5) * 0.26 +
          (sheetField - 0.5) * 0.34 +
          runnel * 0.18 +
          droplet * 0.12 -
          rivulet * 0.16 +
          fallingDrop * 0.18 +
          trailingFilm * 0.1 -
          liquidChannel * 0.2,
          0.07,
          1.24
        );
        float cyanRiver = clamp(liquidChannel * 0.72 + smoothstep(0.62, 0.9, 1.0 - filmMicrons) * 0.18, 0.0, 0.88);
        float amberPool = clamp(smoothstep(0.28, 0.86, filmMicrons) * (0.66 + sheetField * 0.34), 0.0, 1.0);
        float violetBoundary = smoothstep(0.26, 0.62, abs(streamField - 0.55)) * (1.0 - smoothstep(0.62, 0.92, abs(streamField - 0.55)));
        float filmLace = 0.0;
        float pearlFlecks = smoothstep(0.86, 0.995, fbm(flowUv * 54.0 + vec2(-sheetFlow * 0.72, gravityFlow * 0.82))) * (0.24 + liquidRidge * 0.32 + trailingFilm * 0.12) * uFilmSpeckleAmount;
        float surfaceFilmMask = clamp((0.34 + liquidRidge * 0.38 + liquidChannel * 0.5 + runnel * 0.34 + droplet * 0.32 + rivulet * 0.24 + fallingDrop * 0.22 + trailingFilm * 0.18 + pearlFlecks * 0.14) * uFilmCoverage, 0.0, 1.0);
        surfaceFilmMask *= frontMask * smoothstep(0.02, 0.86, facing) * (0.68 + pow(rim, 1.3) * 0.32);
        float visibleFilm = surfaceFilmMask * (1.0 - uClinicalShift * 0.12);

        vec3 keyDir = normalize(vec3(-0.62, 0.32, 0.72));
        vec3 cyanDir = normalize(vec3(0.78, -0.34, 0.52));
        vec3 roseDir = normalize(vec3(-0.44, 0.72, 0.5));
        vec3 amberDir = normalize(vec3(-0.7, -0.42, 0.36));
        float keySpec = pow(max(dot(reflect(-keyDir, normal), viewDir), 0.0), 30.0);
        float cyanSpec = pow(max(dot(reflect(-cyanDir, normal), viewDir), 0.0), 22.0);
        float roseSpec = pow(max(dot(reflect(-roseDir, normal), viewDir), 0.0), 20.0);
        float amberSpec = pow(max(dot(local, amberDir), 0.0), 5.0);

        vec3 coldWhite = vec3(0.82, 0.91, 0.88);
        vec3 paleGreen = vec3(0.54, 0.76, 0.65);
        vec3 darkGold = vec3(0.48, 0.39, 0.22);
        vec3 cyan = mix(vec3(0.34, 0.86, 0.82), paleGreen, uClinicalShift);
        vec3 rose = mix(vec3(0.84, 0.46, 0.57), vec3(0.75, 0.72, 0.68), uClinicalShift);
        vec3 amber = mix(vec3(0.86, 0.68, 0.32), darkGold, uClinicalShift);
        vec3 violet = mix(vec3(0.62, 0.58, 0.78), coldWhite, uClinicalShift);
        vec3 blue = mix(vec3(0.34, 0.55, 0.72), paleGreen, uClinicalShift);
        vec3 film = mix(cyan, rose, band);
        film = mix(film, violet, band2 * 0.48);
        film = mix(film, blue, smoothstep(0.2, 0.95, fineFilm) * 0.28);
        film = mix(film, amber, amberSpec * 0.34);
        vec3 tealPaint = vec3(0.0, 0.72, 0.86);
        vec3 aquaPaint = vec3(0.12, 0.9, 0.82);
        vec3 amberPaint = vec3(1.08, 0.52, 0.06);
        vec3 honeyPaint = vec3(1.0, 0.72, 0.22);
        vec3 violetPaint = vec3(0.24, 0.08, 0.74);
        vec3 rosePaint = vec3(0.86, 0.18, 0.32);
        vec3 pearlPaint = vec3(1.0, 0.92, 0.68);
        vec3 physicalFilm = thinFilmRgb(filmMicrons, mix(0.56, 1.0, facing));
        vec3 interferenceFilm = mix(amberPaint, honeyPaint, smoothstep(0.22, 0.92, amberPool));
        interferenceFilm = mix(interferenceFilm, physicalFilm * vec3(1.12, 1.02, 1.18), 0.28);
        interferenceFilm = mix(interferenceFilm, honeyPaint, amberPool * 0.38);
        interferenceFilm = mix(interferenceFilm, tealPaint, cyanRiver * 0.86);
        interferenceFilm = mix(interferenceFilm, aquaPaint, cyanRiver * smoothstep(0.28, 0.9, diffraction.g) * 0.46);
        interferenceFilm = mix(interferenceFilm, violetPaint, violetBoundary * (0.32 + liquidRidge * 0.22));
        interferenceFilm = mix(interferenceFilm, rosePaint, smoothstep(0.44, 0.96, diffraction.r) * smoothstep(0.18, 0.8, warpB) * 0.42);
        interferenceFilm = mix(interferenceFilm, pearlPaint, clamp(pearlFlecks * 0.82 + speckle * 0.18, 0.0, 0.68));
        vec2 referenceBaseUv = vec2(0.5 + local.x * 0.48, 0.52 - local.y * 0.46);
        referenceBaseUv += vec2((warpA - 0.5) * 0.028 + sin(sheetFlow + local.y * 6.0) * 0.008, (warpB - 0.5) * 0.02);
        vec2 referenceUv = referenceCropUv(referenceBaseUv);
        vec2 referenceFlow = normalize(localFlowDir + crossFlowDir * (drainNoise - 0.5) * (1.0 - uFilmFlowCoherence) * 0.6);
        vec2 referenceCross = vec2(-referenceFlow.y, referenceFlow.x);
        float sampleDrift = flowTime * (0.08 + fallingDrop * 0.018 + rivulet * 0.012) * velocity;
        vec2 movingReferenceBaseUv =
          referenceBaseUv +
          referenceFlow * sampleDrift +
          referenceCross * ((drainNoise - 0.5) * 0.038 + sin(dot(drainUv, vec2(4.1, 2.7))) * 0.006);
        vec2 movingReferenceUv = referenceCropUv(movingReferenceBaseUv);
        vec3 referenceFilmStill = texture2D(uReferenceFilmMap, referenceUv).rgb;
        vec3 referenceFilmMoving = texture2D(uReferenceFilmMap, movingReferenceUv).rgb;
        float diffusionRadius = (0.004 + surfaceFilmMask * 0.012 + fallingDrop * 0.01 + trailingFilm * 0.006) * uFilmDiffusionAmount;
        vec3 referenceFilmBleed = (
          texture2D(uReferenceFilmMap, referenceCropUv(movingReferenceBaseUv - referenceFlow * diffusionRadius * 2.8)).rgb +
          texture2D(uReferenceFilmMap, referenceCropUv(movingReferenceBaseUv - referenceFlow * diffusionRadius * 1.35 + referenceCross * diffusionRadius * 0.9)).rgb +
          texture2D(uReferenceFilmMap, referenceCropUv(movingReferenceBaseUv + referenceCross * diffusionRadius * 1.35)).rgb +
          texture2D(uReferenceFilmMap, referenceCropUv(movingReferenceBaseUv - referenceCross * diffusionRadius * 1.2)).rgb
        ) * 0.25;
        referenceFilmMoving = mix(referenceFilmMoving, referenceFilmBleed, clamp(uFilmDiffusionAmount * (0.18 + bleed * 0.58), 0.0, 0.82));
        float movingFilmMix = clamp(0.34 + uFilmDripAmount * 0.16 + surfaceFilmMask * 0.2, 0.0, 0.78);
        vec3 referenceFilm = mix(referenceFilmStill, referenceFilmMoving, movingFilmMix);
        float referenceLuma = dot(referenceFilm, vec3(0.299, 0.587, 0.114));
        referenceFilm = clamp(mix(vec3(referenceLuma), referenceFilm, 1.18), vec3(0.0), vec3(1.18));
        referenceFilm = mix(referenceFilm, vec3(referenceLuma) * 0.82 + coldWhite * 0.12, uClinicalShift * 0.54);
        ${SINGLE_REFERENCE_FILM_TEST_MODE ? `
        vec3 singleFilm = referenceFilm * (0.9 + uBrightness * 0.18);
        singleFilm = mix(singleFilm, vec3(referenceLuma) * 0.72, uClinicalShift * 0.24);
        float singleAlpha = frontMask * (0.72 + surfaceFilmMask * 0.18 + uBrightness * 0.06);
        gl_FragColor = vec4(singleFilm, singleAlpha);
        return;
        ` : ""}
        float referenceMask = frontMask * smoothstep(0.03, 0.72, facing) * (0.66 + surfaceFilmMask * 0.34);
        interferenceFilm = mix(interferenceFilm, referenceFilm * (0.96 + surfaceFilmMask * 0.18), clamp(uReferenceFilmMix * referenceMask, 0.0, 1.0));
        interferenceFilm = mix(interferenceFilm, coldWhite, uClinicalShift * 0.1);
        float flowFilmMask = clamp((visibleFilm * 0.94 + fineFilm * 0.08 + filmLace * 0.18) * uFilmBandContrast, 0.0, 1.0);
        film = mix(film, interferenceFilm, flowFilmMask * (0.9 - uClinicalShift * 0.22));
        float filmLuma = dot(film, vec3(0.299, 0.587, 0.114));
        film = clamp(mix(vec3(filmLuma), film, mix(1.24, 0.38, uClinicalShift)), vec3(0.0), vec3(1.35));
        vec3 rimFilm = mix(cyan, rose, band2);
        rimFilm = mix(rimFilm, interferenceFilm, flowFilmMask * 0.52);
        float rimLuma = dot(rimFilm, vec3(0.299, 0.587, 0.114));
        rimFilm = clamp(mix(vec3(rimLuma), rimFilm, mix(1.34, 0.42, uClinicalShift)), vec3(0.0), vec3(1.42));

        vec3 color = film * fresnel * (0.14 + uBrightness * 0.1) * edgeVariation;
        color += film * broadRim * (0.58 + uBrightness * 0.28) * (0.72 + edgeVariation);
        color += film * softRim * (1.15 + uBrightness * 0.48) * (0.78 + edgeVariation);
        color += rimFilm * hardRim * (2.25 + uEdge * 1.12) * edgeVariation;
        color += mix(film, mix(vec3(1.0, 0.96, 0.84), coldWhite, uClinicalShift), 0.08) * keySpec * (0.42 + uEdge * 0.16);
        color += cyan * cyanSpec * (0.58 + uBrightness * 0.22);
        color += rose * roseSpec * (0.46 + uBrightness * 0.18);
        color += amber * amberSpec * hardRim * 0.52;
        vec3 macroFilm = interferenceFilm * (0.96 + amberPool * 0.42 + cyanRiver * 0.12 + filmLace * 0.18);
        color += macroFilm * visibleFilm * (1.05 + uBrightness * 0.4 + uPressure * 0.12);
        color = mix(color, macroFilm * (1.02 + uBrightness * 0.24), visibleFilm * 0.66);
        color += mix(vec3(0.1, 0.28, 0.28), vec3(0.12, 0.18, 0.15), uClinicalShift) * pow(fresnel, 3.4) * 0.1;
        float edgeSat = smoothstep(0.18, 0.96, rim);
        float colorLuma = dot(color, vec3(0.299, 0.587, 0.114));
        vec3 saturatedEdge = clamp(mix(vec3(colorLuma), color, 1.0 + edgeSat * mix(0.42, 0.06, uClinicalShift)), vec3(0.0), vec3(1.42));
        color = mix(color, saturatedEdge, edgeSat);
        float edgeLuma = dot(color, vec3(0.299, 0.587, 0.114));
        float whiteHot = smoothstep(0.68, 1.08, edgeLuma) * edgeSat;
        color = mix(color, film * edgeLuma * 0.78 + rimFilm * 0.42, whiteHot * 0.82);
        vec3 clinicalGlass = coldWhite * edgeLuma * 0.52 + paleGreen * broadRim * 0.48 + darkGold * amberSpec * 0.32;
        color = mix(color, clinicalGlass, uClinicalShift * 0.58 * (1.0 - visibleFilm * 0.78));
        color += macroFilm * visibleFilm * (0.78 + uBrightness * 0.3 + speckle * 0.12 + filmLace * 0.24);
        color = mix(color, macroFilm * (1.0 + uBrightness * 0.22), visibleFilm * 0.56);
        color *= mix(1.0, 0.74, smoothstep(0.88, 1.46, edgeLuma) * edgeSat);
        float photographicFilm = clamp(referenceMask * visibleFilm * uReferenceFilmMix, 0.0, 1.0);
        color = mix(color, referenceFilm * (1.08 + uBrightness * 0.18), photographicFilm * 0.72);
        float alpha = fresnel * (0.034 + uBrightness * 0.028) * (0.6 + edgeVariation * 0.42);
        alpha += broadRim * (0.08 + edgeVariation * 0.1 + uEdge * 0.04);
        alpha += softRim * (0.16 + edgeVariation * 0.15 + uEdge * 0.08);
        alpha += hardRim * (0.52 + edgeVariation * 0.38 + uEdge * 0.28);
        alpha += (keySpec + cyanSpec * 0.58 + roseSpec * 0.5) * 0.14;
        alpha += visibleFilm * (0.46 + uBrightness * 0.12 + speckle * 0.07 + filmLace * 0.08) * (0.56 + facing * 0.38);
        alpha += flowFilmMask * (0.16 + uBrightness * 0.048) * (0.32 + rim * 0.68);
        alpha = max(alpha, photographicFilm * (0.58 + uBrightness * 0.16));
        alpha *= (0.82 + uPressure * 0.18) * frontMask;
        gl_FragColor = vec4(color, alpha);
      }
    `,
  });

  return { material, uniforms };
}

function createFilmSurfaceMaterial() {
  const uniforms = {
    uTime: { value: 0 },
    uPressure: { value: 0 },
    uBrightness: { value: 0.5 },
    uClinicalShift: { value: 0 },
    uDeform: { value: 0 },
    uWindBase: { value: 0.68 },
    uWindGustAmount: { value: 0.23 },
    uWindGustSpeed: { value: 0.39 },
    uWindYawAmount: { value: 0.72 },
    uWindYawSpeed: { value: 0.21 },
    uWindPitchAmount: { value: 0.32 },
    uWindPitchSpeed: { value: 0.27 },
    uDownwindBulge: { value: 0.2 },
    uUpwindCompression: { value: 0.1 },
    uRimFlutterAmount: { value: 0.038 },
    uSurfaceWaveAmount: { value: 0.07 },
    uFilmFlowSpeed: { value: 0.46 },
    uFilmFlowDirection: { value: 92 * Math.PI / 180 },
    uFilmFlowCoherence: { value: 0.76 },
    uFilmDiffusionAmount: { value: 0.38 },
    uFilmDripAmount: { value: 1.24 },
    uFilmBandContrast: { value: 1.24 },
    uFilmCoverage: { value: 1.08 },
    uFilmSpeckleAmount: { value: 0.72 },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    side: THREE.FrontSide,
    blending: THREE.NormalBlending,
    vertexShader: `
      uniform float uTime;
      uniform float uPressure;
      uniform float uDeform;
      uniform float uWindBase;
      uniform float uWindGustAmount;
      uniform float uWindGustSpeed;
      uniform float uWindYawAmount;
      uniform float uWindYawSpeed;
      uniform float uWindPitchAmount;
      uniform float uWindPitchSpeed;
      uniform float uDownwindBulge;
      uniform float uUpwindCompression;
      uniform float uRimFlutterAmount;
      uniform float uSurfaceWaveAmount;
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;
      varying vec3 vLocalPosition;

      void main() {
        vec3 localDir = normalize(position);
        float gust = uWindBase + sin(uTime * uWindGustSpeed) * uWindGustAmount + sin(uTime * (uWindGustSpeed * 2.33) + 1.7) * uWindGustAmount * 0.6 + sin(uTime * (uWindGustSpeed * 3.77)) * uWindGustAmount * 0.3;
        float wind = clamp(uDeform * (0.72 + uPressure * 0.38) * gust, 0.0, 1.15);
        float yaw = sin(uTime * uWindYawSpeed) * uWindYawAmount + sin(uTime * (uWindYawSpeed * 0.32) + 1.7) * uWindYawAmount * 0.52;
        float pitch = sin(uTime * uWindPitchSpeed + 0.8) * uWindPitchAmount + sin(uTime * (uWindPitchSpeed * 2.33)) * uWindPitchAmount * 0.25;
        vec3 windDir = normalize(vec3(cos(yaw) * cos(pitch), sin(pitch), sin(yaw) * cos(pitch) * 0.52));
        vec3 crossDir = normalize(cross(windDir, vec3(0.0, 1.0, 0.0)));
        vec3 liftDir = normalize(cross(crossDir, windDir));
        float alongWind = dot(localDir, windDir);
        float lift = dot(localDir, liftDir);
        float side = dot(localDir, crossDir);
        float membraneWave =
          sin(alongWind * 5.6 + lift * 2.2 - uTime * 0.72) * 0.48 +
          sin(side * 4.8 - alongWind * 1.6 + uTime * 0.44) * 0.34 +
          sin((side + lift) * 8.2 - uTime * 0.28) * 0.18;
        float downwind = smoothstep(-0.18, 0.86, alongWind);
        float upwind = smoothstep(0.2, -0.82, alongWind);
        float rimFlutter = pow(1.0 - abs(alongWind), 2.0) * sin(side * 10.8 + uTime * 0.82);
        float surfaceTension = 0.7 + 0.3 * sin(uTime * 0.16 + side * 2.0);

        vec3 membrane = position;
        membrane += windDir * wind * (0.052 + downwind * (uDownwindBulge + 0.06) - upwind * uUpwindCompression);
        membrane += liftDir * wind * (0.03 * sin(uTime * 0.21) + lift * 0.028);
        membrane += crossDir * wind * side * (0.024 + downwind * 0.036);
        membrane += localDir * wind * (downwind * uDownwindBulge - upwind * uUpwindCompression + membraneWave * uSurfaceWaveAmount);
        membrane += crossDir * rimFlutter * wind * uRimFlutterAmount * surfaceTension;
        membrane *= 1.003;

        vLocalPosition = membrane;
        vec4 worldPosition = modelMatrix * vec4(membrane, 1.0);
        vWorldPosition = worldPosition.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normalize(mix(normal, membrane, 0.42)));
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uPressure;
      uniform float uBrightness;
      uniform float uClinicalShift;
      uniform float uFilmFlowSpeed;
      uniform float uFilmFlowDirection;
      uniform float uFilmFlowCoherence;
      uniform float uFilmDiffusionAmount;
      uniform float uFilmDripAmount;
      uniform float uFilmBandContrast;
      uniform float uFilmCoverage;
      uniform float uFilmSpeckleAmount;
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;
      varying vec3 vLocalPosition;

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
          p = mat2(1.58, 1.16, -1.16, 1.58) * p + vec2(0.19, 0.27);
          amplitude *= 0.52;
        }
        return value;
      }

      void main() {
        vec3 normal = normalize(vWorldNormal);
        vec3 local = normalize(vLocalPosition);
        vec3 viewDir = normalize(cameraPosition - vWorldPosition);
        float facing = clamp(dot(normal, viewDir), 0.0, 1.0);
        float rim = 1.0 - facing;
        float sheetFlow = uTime * (0.12 + uPressure * 0.1) * uFilmFlowSpeed;
        float lateral = dot(local, normalize(vec3(0.72, 0.08, 0.46)));
        float vertical = local.y;
        vec2 uv = vec2(lateral * 1.95 + local.z * 0.62, vertical * 1.44 - sheetFlow * 0.38);
        float warpA = fbm(uv * 2.0 + vec2(sheetFlow * 0.12, -sheetFlow * 0.18));
        float warpB = fbm(uv * 4.7 + vec2(3.2, sheetFlow * 0.24));
        vec2 flowUv = uv;
        flowUv.x += (warpA - 0.5) * 1.5 + sin(flowUv.y * 4.6 - sheetFlow) * 0.24;
        flowUv.y += (warpB - 0.5) * 0.82 + sin(flowUv.x * 2.8 + sheetFlow * 0.42) * 0.14;
        float streamA = sin(flowUv.x * 7.5 + flowUv.y * 2.3 + warpA * 6.0);
        float streamB = sin(flowUv.x * 4.1 - flowUv.y * 6.1 + warpB * 6.8);
        float streamC = sin(flowUv.x * 12.0 + flowUv.y * 8.4 - sheetFlow * 0.72);
        float liquidField = streamA * 0.58 + streamB * 0.36 + streamC * 0.2;
        float ridge = smoothstep(0.25, 0.82, abs(liquidField));
        float channel = smoothstep(-0.24, 0.42, liquidField) * smoothstep(0.08, 0.86, warpA);
        float drip = smoothstep(0.52, 0.96, sin(flowUv.x * 6.2 - vertical * 13.0 + sheetFlow * 2.8) * 0.5 + 0.5) * uFilmDripAmount;
        float speckle = smoothstep(0.72, 0.98, fbm(flowUv * 19.0 + vec2(sheetFlow * 0.4, -sheetFlow * 0.2))) * uFilmSpeckleAmount;
        float phase = flowUv.x * 8.2 + flowUv.y * 4.2 + warpA * 7.0 + drip * 3.5;
        vec3 diffraction = 0.5 + 0.5 * cos(vec3(0.0, 2.25, 4.48) + phase);

        vec3 teal = vec3(0.0, 0.82, 0.92);
        vec3 amber = vec3(1.0, 0.5, 0.05);
        vec3 violet = vec3(0.34, 0.08, 0.95);
        vec3 rose = vec3(0.92, 0.2, 0.34);
        vec3 pearl = vec3(1.0, 0.9, 0.62);
        vec3 color = mix(amber, teal, smoothstep(-0.06, 0.44, liquidField));
        color = mix(color, violet, smoothstep(0.42, 0.94, diffraction.b) * (0.32 + ridge * 0.36));
        color = mix(color, rose, smoothstep(0.42, 0.96, diffraction.r) * smoothstep(0.12, 0.86, warpB) * 0.36);
        color = mix(color, pearl, speckle * 0.72);
        color = mix(color, vec3(0.78, 0.9, 0.84), uClinicalShift * 0.08);

        float mask = clamp((0.3 + ridge * 0.48 + channel * 0.42 + drip * 0.24) * uFilmCoverage, 0.0, 1.0);
        mask *= smoothstep(0.03, 0.86, facing);
        mask *= 1.0 - uClinicalShift * 0.08;
        float alpha = mask * (0.28 + ridge * 0.22 + channel * 0.16 + speckle * 0.12) * (0.52 + facing * 0.48);
        alpha *= 0.74 + uBrightness * 0.28 + uPressure * 0.1;
        color *= 0.82 + uBrightness * 0.24 + ridge * 0.24;
        color += vec3(0.05, 0.18, 0.16) * pow(rim, 2.4) * 0.08;
        gl_FragColor = vec4(color, alpha * uFilmBandContrast);
      }
    `,
  });

  return { material, uniforms };
}

function createPetalGeometry() {
  const uSegments = 56;
  const vSegments = 16;
  const positions = new Float32Array((uSegments + 1) * (vSegments + 1) * 3);
  const uvs = new Float32Array((uSegments + 1) * (vSegments + 1) * 2);
  const indices = [];

  for (let uIndex = 0; uIndex <= uSegments; uIndex += 1) {
    const u = uIndex / uSegments;
    for (let vIndex = 0; vIndex <= vSegments; vIndex += 1) {
      const v = vIndex / vSegments;
      const index = uIndex * (vSegments + 1) + vIndex;
      uvs[index * 2] = u;
      uvs[index * 2 + 1] = v;
    }
  }

  for (let uIndex = 0; uIndex < uSegments; uIndex += 1) {
    for (let vIndex = 0; vIndex < vSegments; vIndex += 1) {
      const a = uIndex * (vSegments + 1) + vIndex;
      const b = a + 1;
      const c = (uIndex + 1) * (vSegments + 1) + vIndex;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  return geometry;
}

function createPetalMaterial(colorA, colorB, opacity) {
  const uniforms = {
    uColorA: { value: new THREE.Color(colorA) },
    uColorB: { value: new THREE.Color(colorB) },
    uOpacity: { value: opacity },
    uBrightness: { value: 0.5 },
    uPressure: { value: 0 },
    uClinicalShift: { value: 0 },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vPosition;

      void main() {
        vUv = uv;
        vPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uColorA;
      uniform vec3 uColorB;
      uniform float uOpacity;
      uniform float uBrightness;
      uniform float uPressure;
      uniform float uClinicalShift;
      varying vec2 vUv;
      varying vec3 vPosition;

      void main() {
        float u = vUv.x;
        float v = abs(vUv.y * 2.0 - 1.0);
        float lengthFade = pow(sin(u * 3.14159265), 0.42);
        float widthFade = exp(-v * v * 3.2);
        float center = exp(-(pow(u - 0.5, 2.0) * 26.0 + v * v * 3.8));
        vec3 color = mix(uColorA, uColorB, smoothstep(0.12, 0.88, u));
        color = mix(color, vec3(1.0), center * 0.18);
        float luma = dot(color, vec3(0.299, 0.587, 0.114));
        vec3 clinical = mix(vec3(0.82, 0.91, 0.88), vec3(0.52, 0.66, 0.55), smoothstep(0.18, 0.9, u));
        clinical = mix(clinical, vec3(0.45, 0.36, 0.2), smoothstep(0.68, 1.0, u) * 0.28);
        color = mix(color, mix(vec3(luma), clinical, 0.5), uClinicalShift * 0.78);
        color *= 1.05 + center * 0.42 + uBrightness * 0.34;
        float alpha = uOpacity * lengthFade * widthFade * (0.68 + center * 0.18 + uPressure * 0.2);
        gl_FragColor = vec4(color, alpha);
      }
    `,
  });

  return { material, uniforms };
}

function createSiriPetal(config) {
  const geometry = createPetalGeometry();
  const shader = createPetalMaterial(config.colorA, config.colorB, config.opacity);
  const mesh = new THREE.Mesh(geometry, shader.material);
  mesh.renderOrder = config.renderOrder || 3;
  mesh.userData = {
    ...config,
    uniforms: shader.uniforms,
    uSegments: 56,
    vSegments: 16,
  };
  return mesh;
}

const FLOW_CURVE_COUNT = 8;
const FLOW_CURVE_POINTS = 84;
const FLOW_COLORS = [
  [0.34, 0.82, 0.78],
  [0.78, 0.44, 0.55],
  [0.52, 0.86, 0.68],
  [0.84, 0.65, 0.3],
  [0.56, 0.78, 0.76],
  [0.74, 0.58, 0.36],
  [0.72, 0.88, 0.82],
  [0.68, 0.5, 0.56],
];
const FLOW_CLINICAL_COLORS = [
  [0.78, 0.88, 0.86],
  [0.62, 0.74, 0.66],
  [0.54, 0.7, 0.58],
  [0.44, 0.36, 0.2],
  [0.66, 0.78, 0.72],
  [0.5, 0.42, 0.25],
  [0.84, 0.9, 0.86],
  [0.56, 0.62, 0.54],
];

function createFlowFan() {
  const triangleCount = FLOW_CURVE_COUNT * (FLOW_CURVE_POINTS - 1);
  const vertexCount = triangleCount * 3;
  const positions = new Float32Array(vertexCount * 3);
  const colors = new Float32Array(vertexCount * 3);
  const alpha = new Float32Array(vertexCount);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("aAlpha", new THREE.BufferAttribute(alpha, 1));

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
    blending: THREE.NormalBlending,
    vertexShader: `
      attribute float aAlpha;
      attribute vec3 aColor;
      varying vec3 vColor;
      varying float vAlpha;
      varying float vDepth;

      void main() {
        vColor = aColor;
        vAlpha = aAlpha;
        vDepth = position.z;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vAlpha;
      varying float vDepth;

      void main() {
        if (vAlpha < 0.006) discard;
        float front = smoothstep(-0.84, 0.9, vDepth);
        float depthLight = 0.54 + front * 0.72;
        gl_FragColor = vec4(vColor * depthLight, vAlpha * (0.7 + front * 0.42));
      }
    `,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 4;
  logo3d.flowFanGeometry = geometry;
  return mesh;
}

function createFlowLine() {
  const segmentCount = FLOW_CURVE_COUNT * (FLOW_CURVE_POINTS - 1);
  const vertexCount = segmentCount * 2;
  const positions = new Float32Array(vertexCount * 3);
  const colors = new Float32Array(vertexCount * 3);
  const alpha = new Float32Array(vertexCount);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("aAlpha", new THREE.BufferAttribute(alpha, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: 0.62 },
    },
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute vec3 aColor;
      attribute float aAlpha;
      varying vec3 vColor;
      varying float vAlpha;
      varying float vDepth;

      void main() {
        vColor = aColor;
        vAlpha = aAlpha;
        vDepth = position.z;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uOpacity;
      varying vec3 vColor;
      varying float vAlpha;
      varying float vDepth;

      void main() {
        if (vAlpha < 0.004) discard;
        float front = smoothstep(-0.84, 0.9, vDepth);
        gl_FragColor = vec4(vColor * (0.82 + front * 0.72), vAlpha * uOpacity * (0.55 + front * 0.45));
      }
    `,
  });
  const lines = new THREE.LineSegments(geometry, material);
  lines.renderOrder = 5;
  logo3d.flowLineGeometry = geometry;
  return lines;
}

function flowCurvePoint(curveIndex, pointIndex, seconds, pressure) {
  const t = pointIndex / (FLOW_CURVE_POINTS - 1);
  const phase = curveIndex * 1.21 + 0.37;
  const u = t * 2 - 1;
  const envelope = Math.pow(Math.sin(Math.PI * t), 0.72);
  const baseAngle = (curveIndex / FLOW_CURVE_COUNT) * Math.PI * 2 + seconds * (0.1 + pressure * 0.18);
  const elevation = Math.sin(phase * 1.73 + seconds * 0.07) * 0.42;
  const radial = [Math.cos(baseAngle) * Math.cos(elevation), Math.sin(elevation), Math.sin(baseAngle) * Math.cos(elevation)];
  const tangent = [-Math.sin(baseAngle), 0, Math.cos(baseAngle)];
  const normal = [
    tangent[1] * radial[2] - tangent[2] * radial[1],
    tangent[2] * radial[0] - tangent[0] * radial[2],
    tangent[0] * radial[1] - tangent[1] * radial[0],
  ];
  const lobeLength = 0.46 + (curveIndex % 3) * 0.065 + pressure * 0.03;
  const lobeDepth = 0.18 + (curveIndex % 4) * 0.035;
  const forward =
    0.28 +
    envelope * (0.46 + Math.sin(seconds * 0.21 + phase) * 0.06) +
    Math.sin(t * Math.PI * 2.0 + phase + seconds * 0.34) * 0.04;
  const side =
    u * lobeLength +
    Math.sin(t * Math.PI * 2.0 + seconds * 0.38 + phase) * envelope * 0.13;
  const lift =
    Math.cos(t * Math.PI * 1.6 - seconds * 0.3 + phase) * envelope * lobeDepth +
    Math.sin(t * Math.PI * 3.1 + phase) * 0.035;
  let x = radial[0] * forward + tangent[0] * side + normal[0] * lift;
  let y = radial[1] * forward + tangent[1] * side + normal[1] * lift;
  let z = radial[2] * forward + tangent[2] * side + normal[2] * lift;
  const radius = Math.hypot(x, y, z);
  if (radius > 0.96) {
    const scale = 0.96 / radius;
    x *= scale;
    y *= scale;
    z *= scale;
  }
  return rotateVector3(
    x,
    y,
    z,
    Math.sin(seconds * 0.08 + phase) * 0.08,
    seconds * (0.08 + pressure * 0.13),
    Math.cos(seconds * 0.06 + phase) * 0.08,
  );
}

function setRgb(array, vertexIndex, color, multiplier = 1) {
  array[vertexIndex * 3] = color[0] * multiplier;
  array[vertexIndex * 3 + 1] = color[1] * multiplier;
  array[vertexIndex * 3 + 2] = color[2] * multiplier;
}

function curveEndFade(t) {
  const head = smoothstep(t / 0.14);
  const tail = smoothstep((1 - t) / 0.14);
  return Math.pow(head * tail, 0.58);
}

function updateFlowField(seconds, pressure, brightness, flowParticles = {}, clinicalShift = 0) {
  if (!logo3d.flowFanGeometry || !logo3d.flowLineGeometry) return;

  const fanOpacity = flowParticles.flowFanOpacity ?? 0;
  const lineOpacity = flowParticles.flowLineOpacity ?? 0;
  logo3d.flowFan.visible = fanOpacity > 0.001;
  logo3d.flowLine.visible = lineOpacity > 0.001;
  if (!logo3d.flowFan.visible && !logo3d.flowLine.visible) return;

  const fanPositions = logo3d.flowFanGeometry.attributes.position.array;
  const fanColors = logo3d.flowFanGeometry.attributes.aColor.array;
  const fanAlpha = logo3d.flowFanGeometry.attributes.aAlpha.array;
  const linePositions = logo3d.flowLineGeometry.attributes.position.array;
  const lineColors = logo3d.flowLineGeometry.attributes.aColor.array;
  const lineAlpha = logo3d.flowLineGeometry.attributes.aAlpha.array;
  const center = [0, 0, 0];
  let fanVertex = 0;
  let lineVertex = 0;

  for (let curveIndex = 0; curveIndex < FLOW_CURVE_COUNT; curveIndex += 1) {
    const colorIndex = curveIndex % FLOW_COLORS.length;
    const nextIndex = (curveIndex + 2) % FLOW_COLORS.length;
    const color = clinicalRgb(FLOW_COLORS[colorIndex], FLOW_CLINICAL_COLORS[colorIndex], clinicalShift, 0.62);
    const nextColor = clinicalRgb(FLOW_COLORS[nextIndex], FLOW_CLINICAL_COLORS[nextIndex], clinicalShift, 0.62);
    for (let pointIndex = 0; pointIndex < FLOW_CURVE_POINTS - 1; pointIndex += 1) {
      const p0 = flowCurvePoint(curveIndex, pointIndex, seconds, pressure);
      const p1 = flowCurvePoint(curveIndex, pointIndex + 1, seconds, pressure);
      const d0 = Math.hypot(p0[0], p0[1], p0[2]);
      const d1 = Math.hypot(p1[0], p1[1], p1[2]);
      const t0 = pointIndex / (FLOW_CURVE_POINTS - 1);
      const t1 = (pointIndex + 1) / (FLOW_CURVE_POINTS - 1);
      const fade0 = curveEndFade(t0);
      const fade1 = curveEndFade(t1);
      const segmentFade = Math.min(1, (fade0 + fade1) * 0.56);
      const alphaBase = 0.62 + brightness * 0.2 + pressure * 0.08;
      const alpha0 = alphaBase * Math.exp(-d0 * 0.58) * fade0;
      const alpha1 = alphaBase * Math.exp(-d1 * 0.58) * fade1;
      const mixValue = pointIndex / (FLOW_CURVE_POINTS - 1);
      const curveColor = [
        lerp(color[0], nextColor[0], mixValue * 0.45),
        lerp(color[1], nextColor[1], mixValue * 0.45),
        lerp(color[2], nextColor[2], mixValue * 0.45),
      ];
      const centerColor = [
        lerp(curveColor[0], 1, 0.32),
        lerp(curveColor[1], 1, 0.32),
        lerp(curveColor[2], 1, 0.32),
      ];

      [center, p0, p1].forEach((point, localIndex) => {
        fanPositions[fanVertex * 3] = point[0];
        fanPositions[fanVertex * 3 + 1] = point[1];
        fanPositions[fanVertex * 3 + 2] = point[2];
        if (localIndex === 0) {
          setRgb(fanColors, fanVertex, centerColor, 1.15 + brightness * 0.22);
          fanAlpha[fanVertex] = (0.13 + brightness * 0.035) * segmentFade * fanOpacity;
        } else {
          setRgb(fanColors, fanVertex, curveColor, 1.28 + brightness * 0.32);
          fanAlpha[fanVertex] = (localIndex === 1 ? alpha0 : alpha1) * 0.74 * fanOpacity;
        }
        fanVertex += 1;
      });

      [
        [p0, alpha0 * 0.7, 1.6],
        [p1, alpha1 * 0.7, 1.6],
      ].forEach(([point, pointAlpha, multiplier]) => {
        linePositions[lineVertex * 3] = point[0];
        linePositions[lineVertex * 3 + 1] = point[1];
        linePositions[lineVertex * 3 + 2] = point[2];
        lineAlpha[lineVertex] = pointAlpha;
        setRgb(lineColors, lineVertex, curveColor, multiplier);
        lineVertex += 1;
      });
    }
  }

  logo3d.flowFanGeometry.attributes.position.needsUpdate = true;
  logo3d.flowFanGeometry.attributes.aColor.needsUpdate = true;
  logo3d.flowFanGeometry.attributes.aAlpha.needsUpdate = true;
  logo3d.flowLineGeometry.attributes.position.needsUpdate = true;
  logo3d.flowLineGeometry.attributes.aColor.needsUpdate = true;
  logo3d.flowLineGeometry.attributes.aAlpha.needsUpdate = true;
  logo3d.flowLine.material.uniforms.uOpacity.value = (0.34 + brightness * 0.14 + pressure * 0.14) * lineOpacity;
  logo3d.flowFan.material.opacity = fanOpacity;
}

function updateSiriPetal(petal, seconds, pressure, brightness, clinicalShift = 0) {
  const { uSegments, vSegments, length, width, depth, phase, twist, curl } = petal.userData;
  const positions = petal.geometry.attributes.position.array;
  const time = seconds * (petal.userData.speed || 1) + phase;
  const lengthScale = length * (0.96 + Math.sin(time * 0.52) * 0.045 + pressure * 0.035);
  const widthScale = width * (0.92 + Math.cos(time * 0.46) * 0.08 + pressure * 0.04);

  for (let uIndex = 0; uIndex <= uSegments; uIndex += 1) {
    const u = uIndex / uSegments;
    const s = u * 2 - 1;
    const edge = Math.pow(Math.max(0, 1 - Math.abs(s)), 0.52);
    const bend = Math.sin(u * Math.PI + time * 0.35);
    for (let vIndex = 0; vIndex <= vSegments; vIndex += 1) {
      const v = vIndex / vSegments;
      const q = v * 2 - 1;
      const index = (uIndex * (vSegments + 1) + vIndex) * 3;
      const widthAtU = widthScale * (0.18 + edge * 0.82);
      const x = s * lengthScale * 0.5;
      const y = q * widthAtU + Math.sin(s * Math.PI * 1.25 + time) * edge * curl;
      const z =
        Math.sin(s * Math.PI * 1.7 + time * 0.72) * edge * depth +
        q * edge * twist * Math.cos(time * 0.6 + s * 2.2);
      positions[index] = x;
      positions[index + 1] = y;
      positions[index + 2] = z;
    }
  }

  petal.geometry.attributes.position.needsUpdate = true;
  petal.geometry.computeVertexNormals();
  petal.rotation.x = petal.userData.baseRotation.x + Math.sin(seconds * 0.18 + phase) * 0.18;
  petal.rotation.y = petal.userData.baseRotation.y + seconds * (petal.userData.spin || 0.12) + pressure * 0.18;
  petal.rotation.z = petal.userData.baseRotation.z + Math.cos(seconds * 0.16 + phase) * 0.18;
  petal.position.set(
    Math.sin(time * 0.37) * 0.06,
    Math.cos(time * 0.31) * 0.05,
    Math.sin(time * 0.29) * 0.08,
  );
  petal.userData.uniforms.uBrightness.value = brightness;
  petal.userData.uniforms.uPressure.value = pressure;
  petal.userData.uniforms.uClinicalShift.value = clinicalShift;
  petal.userData.uniforms.uOpacity.value = petal.userData.opacity * (0.88 + brightness * 0.28 + pressure * 0.14);
}

const CURVE_COUNT = 8;
const CURVE_POINTS = 76;
const CURVE_COLORS = [
  [0.38, 0.82, 0.78],
  [0.78, 0.46, 0.56],
  [0.78, 0.9, 0.84],
  [0.86, 0.68, 0.32],
  [0.58, 0.84, 0.66],
  [0.66, 0.72, 0.78],
];
const CURVE_CLINICAL_COLORS = [
  [0.78, 0.88, 0.86],
  [0.64, 0.72, 0.66],
  [0.82, 0.9, 0.86],
  [0.46, 0.38, 0.22],
  [0.56, 0.72, 0.6],
  [0.7, 0.76, 0.72],
];

function createCurveCloud() {
  const count = CURVE_COUNT * CURVE_POINTS;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);

  for (let curveIndex = 0; curveIndex < CURVE_COUNT; curveIndex += 1) {
    const color = CURVE_COLORS[curveIndex % CURVE_COLORS.length];
    for (let pointIndex = 0; pointIndex < CURVE_POINTS; pointIndex += 1) {
      const index = curveIndex * CURVE_POINTS + pointIndex;
      colors[index * 3] = color[0];
      colors[index * 3 + 1] = color[1];
      colors[index * 3 + 2] = color[2];
      sizes[index] = 2.8 + curveIndex * 0.22;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: 0.035 },
      uPressure: { value: 0 },
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthTest: true,
    depthWrite: false,
    vertexColors: true,
    vertexShader: `
      attribute float aSize;
      varying vec3 vColor;
      varying float vDepth;

      void main() {
        vColor = color;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vDepth = smoothstep(1.6, -1.4, mvPosition.z);
        gl_PointSize = aSize * (128.0 / max(2.7, -mvPosition.z));
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform float uOpacity;
      uniform float uPressure;
      varying vec3 vColor;
      varying float vDepth;

      void main() {
        vec2 uv = gl_PointCoord - vec2(0.5);
        float radius = length(uv) * 2.0;
        float falloff = exp(-radius * radius * (5.8 - uPressure * 1.4));
        float edge = 1.0 - smoothstep(0.82, 1.0, radius);
        float alpha = falloff * edge * uOpacity * (0.28 + vDepth * 0.3);
        vec3 color = vColor * (0.32 + falloff * 0.55);
        gl_FragColor = vec4(color, alpha);
      }
    `,
  });

  const points = new THREE.Points(geometry, material);
  points.renderOrder = 4;
  logo3d.curveGeometry = geometry;
  return points;
}

function createCurveLines() {
  const segmentCount = CURVE_COUNT * (CURVE_POINTS - 1);
  const positions = new Float32Array(segmentCount * 2 * 3);
  const colors = new Float32Array(segmentCount * 2 * 3);

  for (let curveIndex = 0; curveIndex < CURVE_COUNT; curveIndex += 1) {
    const color = CURVE_COLORS[curveIndex % CURVE_COLORS.length];
    for (let pointIndex = 0; pointIndex < CURVE_POINTS - 1; pointIndex += 1) {
      const segmentIndex = curveIndex * (CURVE_POINTS - 1) + pointIndex;
      for (let end = 0; end < 2; end += 1) {
        const index = segmentIndex * 2 + end;
        colors[index * 3] = color[0];
        colors[index * 3 + 1] = color[1];
        colors[index * 3 + 2] = color[2];
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const material = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.36,
    blending: THREE.AdditiveBlending,
    depthTest: true,
    depthWrite: false,
  });
  const lines = new THREE.LineSegments(geometry, material);
  lines.renderOrder = 5;
  logo3d.curveLineGeometry = geometry;
  return lines;
}

function rotateVector3(x, y, z, ax, ay, az) {
  const cx = Math.cos(ax);
  const sx = Math.sin(ax);
  const cy = Math.cos(ay);
  const sy = Math.sin(ay);
  const cz = Math.cos(az);
  const sz = Math.sin(az);

  let yy = y * cx - z * sx;
  let zz = y * sx + z * cx;
  let xx = x * cy + zz * sy;
  zz = -x * sy + zz * cy;
  const rx = xx * cz - yy * sz;
  const ry = xx * sz + yy * cz;
  return [rx, ry, zz];
}

function updateCurveCloud(seconds, pressure, brightness, clinicalShift = 0) {
  if (!logo3d.curveGeometry || !logo3d.curveCloud) return;

  const positions = logo3d.curveGeometry.attributes.position.array;
  const colors = logo3d.curveGeometry.attributes.color.array;
  const sizes = logo3d.curveGeometry.attributes.aSize.array;
  const linePositions = logo3d.curveLineGeometry?.attributes.position.array;
  const lineColors = logo3d.curveLineGeometry?.attributes.color.array;

  for (let curveIndex = 0; curveIndex < CURVE_COUNT; curveIndex += 1) {
    const phase = curveIndex * 1.143 + 0.37;
    const colorIndex = curveIndex % CURVE_COLORS.length;
    const curveColor = clinicalRgb(CURVE_COLORS[colorIndex], CURVE_CLINICAL_COLORS[colorIndex], clinicalShift, 0.58);
    const baseAngle = (curveIndex / CURVE_COUNT) * Math.PI * 2;
    const baseElevation = Math.sin(curveIndex * 1.91) * 0.36;
    const ax = Math.sin(seconds * 0.14 + phase) * 0.38;
    const ay = seconds * (0.16 + pressure * 0.22) + phase * 0.34;
    const az = Math.cos(seconds * 0.11 + phase) * 0.28;

    for (let pointIndex = 0; pointIndex < CURVE_POINTS; pointIndex += 1) {
      const index = curveIndex * CURVE_POINTS + pointIndex;
      const t = pointIndex / (CURVE_POINTS - 1);
      const radial = Math.pow(t, 0.82) * (0.78 + pressure * 0.08);
      const envelope = Math.sin(Math.PI * t);
      const morph = Math.sin(seconds * 0.58 + phase + t * 2.4);
      const theta = baseAngle + t * (0.92 + Math.sin(seconds * 0.31 + phase) * 0.34) + envelope * morph * 0.42;
      const phi = baseElevation * (0.28 + t * 0.72) + envelope * Math.cos(seconds * 0.47 + phase) * 0.24;
      const x = Math.cos(theta) * Math.cos(phi) * radial;
      const y = Math.sin(phi) * radial + envelope * Math.sin(seconds * 0.71 + phase) * 0.08;
      const z = Math.sin(theta) * Math.cos(phi) * radial;
      const [rx, ry, rz] = rotateVector3(x, y, z, ax, ay, az);

      positions[index * 3] = rx;
      positions[index * 3 + 1] = ry;
      positions[index * 3 + 2] = rz;
      colors[index * 3] = curveColor[0];
      colors[index * 3 + 1] = curveColor[1];
      colors[index * 3 + 2] = curveColor[2];
      sizes[index] = (2.5 + brightness * 2.0 + pressure * 2.8) * (0.64 + envelope * 0.36 + t * 0.08);
    }
  }

  if (linePositions) {
    for (let curveIndex = 0; curveIndex < CURVE_COUNT; curveIndex += 1) {
      const colorIndex = curveIndex % CURVE_COLORS.length;
      const curveColor = clinicalRgb(CURVE_COLORS[colorIndex], CURVE_CLINICAL_COLORS[colorIndex], clinicalShift, 0.58);
      for (let pointIndex = 0; pointIndex < CURVE_POINTS - 1; pointIndex += 1) {
        const from = curveIndex * CURVE_POINTS + pointIndex;
        const to = from + 1;
        const segment = curveIndex * (CURVE_POINTS - 1) + pointIndex;
        const base = segment * 6;
        linePositions[base] = positions[from * 3];
        linePositions[base + 1] = positions[from * 3 + 1];
        linePositions[base + 2] = positions[from * 3 + 2];
        linePositions[base + 3] = positions[to * 3];
        linePositions[base + 4] = positions[to * 3 + 1];
        linePositions[base + 5] = positions[to * 3 + 2];
        if (lineColors) {
          lineColors[base] = curveColor[0];
          lineColors[base + 1] = curveColor[1];
          lineColors[base + 2] = curveColor[2];
          lineColors[base + 3] = curveColor[0];
          lineColors[base + 4] = curveColor[1];
          lineColors[base + 5] = curveColor[2];
        }
      }
    }
    logo3d.curveLineGeometry.attributes.position.needsUpdate = true;
    if (lineColors) logo3d.curveLineGeometry.attributes.color.needsUpdate = true;
    logo3d.curveLines.material.opacity = 0.34 + brightness * 0.16 + pressure * 0.14;
  }

  logo3d.curveGeometry.attributes.position.needsUpdate = true;
  logo3d.curveGeometry.attributes.color.needsUpdate = true;
  logo3d.curveGeometry.attributes.aSize.needsUpdate = true;
  logo3d.curveCloud.material.uniforms.uOpacity.value = 0.026 + brightness * 0.022 + pressure * 0.04;
  logo3d.curveCloud.material.uniforms.uPressure.value = pressure;
}

function createParticleField() {
  const count = 150;
  const positions = new Float32Array(count * 3);
  for (let index = 0; index < count; index += 1) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 2 - 1);
    const radius = 0.2 + Math.random() * 1.15;
    positions[index * 3] = Math.sin(phi) * Math.cos(theta) * radius;
    positions[index * 3 + 1] = Math.cos(phi) * radius * 0.86;
    positions[index * 3 + 2] = Math.sin(phi) * Math.sin(theta) * radius;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: 0xe9fffb,
    size: 0.025,
    transparent: true,
    opacity: 0.42,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  logo3d.particleMaterial = material;
  return new THREE.Points(geometry, material);
}

function createGoldDustField() {
  const count = 4600;
  const innerRadius = 0.28;
  const outerRadius = 3.15;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const alpha = new Float32Array(count);
  const phase = new Float32Array(count);

  for (let index = 0; index < count; index += 1) {
    const stream = Math.floor(Math.random() * 5);
    const streamAngle = [0.25, 1.42, 2.35, 3.9, 5.08][stream];
    const angle = streamAngle + (Math.random() - 0.5) * lerp(0.62, 1.7, Math.random());
    const radius = innerRadius + Math.pow(Math.random(), 0.92) * (outerRadius - innerRadius);
    const innerFade = smoothstep((radius - innerRadius) / 0.88);
    const outerFade = 1 - smoothstep((radius - outerRadius + 0.18) / 0.82);
    const streamWeight = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(angle * 3.0 + stream * 1.7));
    const edgeWeight = clamp(innerFade * outerFade * streamWeight, 0.04, 0.86);
    const depth = (Math.random() - 0.5) * (1.0 + Math.random() * 1.4);
    const verticalDrift = (Math.random() - 0.5) * 0.26;

    positions[index * 3] = Math.cos(angle) * radius * (0.9 + Math.random() * 0.18);
    positions[index * 3 + 1] = Math.sin(angle) * radius * 0.74 + verticalDrift;
    positions[index * 3 + 2] = depth + Math.sin(angle * 1.7 + radius) * 0.16;

    const warm = Math.random();
    colors[index * 3] = lerp(1.0, 0.95, warm);
    colors[index * 3 + 1] = lerp(0.86, 0.68, warm);
    colors[index * 3 + 2] = lerp(0.42, 0.18, warm);
    sizes[index] = lerp(1.6, 7.2, Math.random()) * (0.62 + edgeWeight * 0.5);
    alpha[index] = lerp(0.08, 0.54, edgeWeight) * lerp(0.52, 1.0, Math.random());
    phase[index] = Math.random() * Math.PI * 2;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute("aAlpha", new THREE.BufferAttribute(alpha, 1));
  geometry.setAttribute("aPhase", new THREE.BufferAttribute(phase, 1));

  const uniforms = {
    uTime: { value: 0 },
    uOpacity: { value: 0.5 },
    uFocusDepth: { value: 6.5 },
    uOccluderRadius: { value: 1.0 },
    uClinicalShift: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute vec3 aColor;
      attribute float aSize;
      attribute float aAlpha;
      attribute float aPhase;
      uniform float uTime;
      uniform float uFocusDepth;
      uniform float uOccluderRadius;
      varying vec3 vColor;
      varying float vAlpha;
      varying float vBlur;
      varying float vOcclusion;

      void main() {
        vColor = aColor;
        vec3 drift = position;
        drift += vec3(
          sin(uTime * 0.18 + aPhase) * 0.012,
          cos(uTime * 0.14 + aPhase * 1.7) * 0.01,
          sin(uTime * 0.11 + aPhase * 0.8) * 0.012
        );
        vec4 mvPosition = modelViewMatrix * vec4(drift, 1.0);
        vec4 mvCenter = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        float depth = -mvPosition.z;
        float centerDepth = -mvCenter.z;
        vec2 pointScreen = mvPosition.xy / max(0.1, depth);
        vec2 centerScreen = mvCenter.xy / max(0.1, centerDepth);
        vOcclusion = 1.0;
        vBlur = smoothstep(0.08, 1.72, abs(depth - uFocusDepth));
        float twinkle = 0.76 + sin(uTime * 0.72 + aPhase) * 0.12 + sin(uTime * 0.31 + aPhase * 2.3) * 0.08;
        vAlpha = aAlpha * twinkle;
        gl_PointSize = aSize * (uFocusDepth / max(2.8, depth)) * (1.0 + vBlur * 2.8);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform float uOpacity;
      uniform float uClinicalShift;
      varying vec3 vColor;
      varying float vAlpha;
      varying float vBlur;
      varying float vOcclusion;

      void main() {
        vec2 uv = gl_PointCoord - vec2(0.5);
        float radius = length(uv) * 2.0;
        float core = exp(-radius * radius * mix(18.0, 6.2, vBlur));
        float halo = exp(-radius * radius * mix(4.2, 1.45, vBlur));
        float edge = 1.0 - smoothstep(0.82, 1.0, radius);
        float alpha = (core * 0.72 + halo * 0.32) * edge * vAlpha * uOpacity * (1.0 - vBlur * 0.18) * vOcclusion;
        vec3 baseColor = vColor * (core * 1.15 + halo * 0.52);
        float luma = dot(baseColor, vec3(0.299, 0.587, 0.114));
        vec3 darkGold = vec3(0.44, 0.36, 0.2) * (0.72 + core * 0.68) + vec3(luma) * 0.18;
        vec3 color = mix(baseColor, darkGold, uClinicalShift * 0.72);
        gl_FragColor = vec4(color, alpha);
      }
    `,
  });

  const points = new THREE.Points(geometry, material);
  points.renderOrder = 2;
  logo3d.goldDustUniforms = uniforms;
  return points;
}

export function resizeLogo3d() {
  if (!logo3d.ready || !els.siriScene) return;
  const width = Math.max(1, els.siriScene.clientWidth);
  const height = Math.max(1, els.siriScene.clientHeight);
  const pixelRatio = Math.min(window.devicePixelRatio || 1, logo3d.pixelRatioLimit || 1.25);
  if (width === logo3d.width && height === logo3d.height && pixelRatio === logo3d.pixelRatio) return;

  logo3d.width = width;
  logo3d.height = height;
  logo3d.pixelRatio = pixelRatio;
  logo3d.baseScale = width < 720 ? 0.68 : width < 1080 ? 0.8 : width < 1280 ? 0.94 : 1.08;
  logo3d.renderer.setPixelRatio(pixelRatio);
  logo3d.renderer.setSize(width, height, false);
  logo3d.camera.aspect = width / height;
  logo3d.camera.updateProjectionMatrix();
}

export function initLogo3d(elements) {
  els = elements;
  if (!els?.siriCanvas || logo3d.ready) return;

  const renderer = new THREE.WebGLRenderer({
    canvas: els.siriCanvas,
    alpha: true,
    antialias: true,
    preserveDrawingBuffer: false,
    powerPreference: "low-power",
  });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 80);
  camera.position.set(0, 0, 6.5);

  const group = new THREE.Group();
  scene.add(group);

  const ambient = new THREE.AmbientLight(0x9adce0, 1.4);
  const key = new THREE.PointLight(0xffffff, 3.4, 16);
  key.position.set(2.1, 2.4, 4.2);
  const cyan = new THREE.PointLight(0x68e5ec, 2.8, 12);
  cyan.position.set(-2.6, -0.6, 3.6);
  const rose = new THREE.PointLight(0xd68d9f, 2.2, 10);
  rose.position.set(1.6, -1.5, 2.8);
  scene.add(ambient, key, cyan, rose);

  let referenceFilmTexture = null;
  if (!GPU_THIN_FILM_SIM_MODE) {
    referenceFilmTexture = new THREE.TextureLoader().load("./assets/reference-soap-film.jpg");
    referenceFilmTexture.colorSpace = THREE.SRGBColorSpace;
    referenceFilmTexture.wrapS = THREE.ClampToEdgeWrapping;
    referenceFilmTexture.wrapT = THREE.ClampToEdgeWrapping;
    referenceFilmTexture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy?.() || 1, 4);
  }

  const coreShader = createCoreMaterial();
  const core = new THREE.Mesh(new THREE.SphereGeometry(1.0, 96, 96), coreShader.material);
  core.renderOrder = 0;
  core.visible = false;
  group.add(core);

  const thinFilmSim = GPU_THIN_FILM_SIM_MODE ? createThinFilmSimulator(renderer, { size: 256 }) : null;
  const glassShader = GPU_THIN_FILM_SIM_MODE
    ? createPhysicalThinFilmShellMaterial(thinFilmSim.texture, thinFilmSim.size)
    : createBubbleShellMaterial(referenceFilmTexture);
  const glass = new THREE.Mesh(new THREE.SphereGeometry(1.0, 128, 128), glassShader.material);
  glass.renderOrder = 7;
  group.add(glass);

  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: createGlowTexture(),
      transparent: true,
      opacity: 0.86,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  glow.renderOrder = 1;
  glow.scale.set(3.0, 3.0, 1);
  glow.visible = false;
  group.add(glow);

  const goldDust = createGoldDustField();
  group.add(goldDust);

  const shellHighlight = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: createShellHighlightTexture(),
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
      alphaTest: 0.025,
      depthWrite: false,
      depthTest: true,
    }),
  );
  shellHighlight.position.set(-0.34, 0.18, 0.96);
  shellHighlight.scale.set(0.72, 0.24, 1);
  shellHighlight.renderOrder = 6;
  shellHighlight.visible = false;
  group.add(shellHighlight);

  const centerGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: createCenterGlowTexture(),
      transparent: true,
      opacity: 0.24,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
    }),
  );
  centerGlow.position.set(-0.08, 0.02, 1.02);
  centerGlow.scale.set(0.32, 0.32, 1);
  centerGlow.renderOrder = 6;
  centerGlow.visible = false;
  group.add(centerGlow);

  const flowFan = createFlowFan();
  group.add(flowFan);
  const flowLine = createFlowLine();
  group.add(flowLine);

  const particles = createParticleField();
  particles.visible = false;
  group.add(particles);

  logo3d.ready = true;
  logo3d.renderer = renderer;
  logo3d.scene = scene;
  logo3d.camera = camera;
  logo3d.group = group;
  logo3d.core = core;
  logo3d.coreUniforms = coreShader.uniforms;
  logo3d.glass = glass;
  logo3d.glassUniforms = glassShader.uniforms;
  logo3d.thinFilmSim = thinFilmSim;
  logo3d.filmSurface = null;
  logo3d.filmUniforms = null;
  logo3d.glow = glow;
  logo3d.goldDust = goldDust;
  logo3d.shellHighlight = shellHighlight;
  logo3d.centerGlow = centerGlow;
  logo3d.flowFan = flowFan;
  logo3d.flowLine = flowLine;
  logo3d.particles = particles;
  logo3d.lights = [ambient, key, cyan, rose];
  resizeLogo3d();
}

export function updateLogo3d(visual, timeMs, pressureValue = 0, visualConfig = {}, stageName = "") {
  if (!logo3d.ready) return;

  const seconds = timeMs / 1000;
  const pressure = clamp(pressureValue, 0, 1);
  const visualTuning = visualConfig.visual || {};
  const clinicalShift = clinicalShiftForTimeline(pressure, visualTuning, stageName);
  logo3d.pixelRatioLimit = visualTuning.pixelRatioLimit ?? 1.25;
  resizeLogo3d();
  const cameraView = cameraViewFor(visualTuning);
  const cameraBoost = logo3d.width < 720 ? 0.9 : logo3d.width < 1080 ? 0.35 : 0;
  const nextCameraZ = cameraView.cameraZ + cameraBoost;
  if (Math.abs(logo3d.camera.position.z - nextCameraZ) > 0.001) {
    logo3d.camera.position.z = nextCameraZ;
    logo3d.camera.updateProjectionMatrix();
  }
  const glassWind = visualConfig.glassWind || {};
  const flowParticles = visualConfig.flowParticles || {};
  const breathWave = Math.sin(seconds * Math.PI * 2 * visual.pulseRate);
  const pulse = 0.5 + 0.5 * Math.sin(seconds * Math.PI * 2 * visual.pulseRate);
  const frameScale = (visualTuning.frameScale ?? 1) * cameraView.scale;
  const breath = logo3d.baseScale * frameScale * (1.04 + pulse * visual.pulseAmplitude * 0.28 + pressure * 0.08);

  logo3d.group.scale.setScalar(breath);
  logo3d.group.position.x = (visualTuning.frameOffsetX ?? 0) + cameraView.x;
  logo3d.group.position.y = (visualTuning.frameOffsetY ?? 0) + cameraView.y;
  logo3d.group.rotation.y = cameraView.rotateY + Math.sin(seconds * 0.24) * 0.08;
  logo3d.group.rotation.x = cameraView.rotateX + Math.sin(seconds * 0.18) * 0.06 + pressure * 0.05;
  logo3d.group.rotation.z = cameraView.rotateZ + Math.cos(seconds * 0.16) * 0.04;

  logo3d.coreUniforms.uTime.value = seconds;
  logo3d.coreUniforms.uPressure.value = pressure;
  logo3d.coreUniforms.uBrightness.value = visual.brightness;
  logo3d.coreUniforms.uClinicalShift.value = clinicalShift;
  if (FRONT_HEMISPHERE_TEST_MODE) {
    logo3d.core.visible = false;
    logo3d.goldDust.visible = false;
    logo3d.flowFan.visible = false;
    logo3d.flowLine.visible = false;
    logo3d.particles.visible = false;
  } else {
    updateFlowField(seconds, pressure, visual.brightness, flowParticles, clinicalShift);
    updateCurveCloud(seconds, pressure, visual.brightness, clinicalShift);
  }
  logo3d.glassUniforms.uTime.value = seconds;
  logo3d.glassUniforms.uPressure.value = pressure;
  logo3d.glassUniforms.uBrightness.value = visual.brightness;
  logo3d.glassUniforms.uClinicalShift.value = clinicalShift;
  logo3d.glassUniforms.uEdge.value = visual.edgeSharpness;
  if (logo3d.filmUniforms) {
    logo3d.filmUniforms.uTime.value = seconds;
    logo3d.filmUniforms.uPressure.value = pressure;
    logo3d.filmUniforms.uBrightness.value = visual.brightness;
    logo3d.filmUniforms.uClinicalShift.value = clinicalShift;
  }
  const membraneBaseTension = glassWind.membraneBaseTension ?? 0.26;
  const windBase = glassWind.windBase ?? 0.68;
  const windGustAmount = glassWind.windGustAmount ?? 0.23;
  const windGustSpeed = glassWind.windGustSpeed ?? 0.39;
  const windYawAmount = glassWind.windYawAmount ?? 0.72;
  const windYawSpeed = glassWind.windYawSpeed ?? 0.21;
  const windPitchAmount = glassWind.windPitchAmount ?? 0.32;
  const windPitchSpeed = glassWind.windPitchSpeed ?? 0.27;
  const membraneTension = clamp(membraneBaseTension + visual.jitter * 0.34 + visual.drift * 0.42 + visual.edgeSharpness * 0.24 + pressure * 0.16, 0, 1);
  const windGust = clamp(windBase + Math.sin(seconds * windGustSpeed) * windGustAmount + Math.sin(seconds * windGustSpeed * 2.33 + 1.7) * windGustAmount * 0.6 + Math.sin(seconds * windGustSpeed * 3.77) * windGustAmount * 0.3, 0.05, 1.6);
  const windYaw = Math.sin(seconds * windYawSpeed) * windYawAmount + Math.sin(seconds * windYawSpeed * 0.32 + 1.7) * windYawAmount * 0.52;
  const windPitch = Math.sin(seconds * windPitchSpeed + 0.8) * windPitchAmount + Math.sin(seconds * windPitchSpeed * 2.33) * windPitchAmount * 0.25;
  const windPush = membraneTension * windGust;
  const windOffsetX = Math.cos(windYaw) * windPush * 0.038;
  const windOffsetY = Math.sin(windPitch) * windPush * 0.032;
  const windOffsetZ = Math.sin(windYaw) * windPush * 0.02;
  logo3d.glassUniforms.uDeform.value = membraneTension;
  logo3d.glassUniforms.uWindBase.value = windBase;
  logo3d.glassUniforms.uWindGustAmount.value = windGustAmount;
  logo3d.glassUniforms.uWindGustSpeed.value = windGustSpeed;
  logo3d.glassUniforms.uWindYawAmount.value = windYawAmount;
  logo3d.glassUniforms.uWindYawSpeed.value = windYawSpeed;
  logo3d.glassUniforms.uWindPitchAmount.value = windPitchAmount;
  logo3d.glassUniforms.uWindPitchSpeed.value = windPitchSpeed;
  logo3d.glassUniforms.uDownwindBulge.value = glassWind.downwindBulge ?? 0.2;
  logo3d.glassUniforms.uUpwindCompression.value = glassWind.upwindCompression ?? 0.1;
  logo3d.glassUniforms.uRimFlutterAmount.value = glassWind.rimFlutterAmount ?? 0.038;
  logo3d.glassUniforms.uSurfaceWaveAmount.value = glassWind.surfaceWaveAmount ?? 0.07;
  logo3d.glassUniforms.uFilmFlowSpeed.value = glassWind.filmFlowSpeed ?? 0.46;
  logo3d.glassUniforms.uFilmFlowDirection.value = (glassWind.filmFlowDirection ?? 92) * Math.PI / 180;
  logo3d.glassUniforms.uFilmFlowCoherence.value = glassWind.filmFlowCoherence ?? 0.76;
  logo3d.glassUniforms.uFilmDiffusionAmount.value = glassWind.filmDiffusionAmount ?? 0.38;
  logo3d.glassUniforms.uFilmDripAmount.value = glassWind.filmDripAmount ?? 1.24;
  logo3d.glassUniforms.uFilmBandContrast.value = glassWind.filmBandContrast ?? 1.22;
  logo3d.glassUniforms.uFilmCoverage.value = glassWind.filmCoverage ?? 1.08;
  logo3d.glassUniforms.uFilmSpeckleAmount.value = glassWind.filmSpeckleAmount ?? 0.86;
  if (logo3d.thinFilmSim && logo3d.glassUniforms.uFilmStateMap) {
    logo3d.thinFilmSim.update(seconds, glassWind, pressure);
    logo3d.glassUniforms.uFilmStateMap.value = logo3d.thinFilmSim.texture;
  }
  if (logo3d.filmUniforms) {
    [
      "uDeform",
      "uWindBase",
      "uWindGustAmount",
      "uWindGustSpeed",
      "uWindYawAmount",
      "uWindYawSpeed",
      "uWindPitchAmount",
      "uWindPitchSpeed",
      "uDownwindBulge",
      "uUpwindCompression",
      "uRimFlutterAmount",
      "uSurfaceWaveAmount",
      "uFilmFlowSpeed",
      "uFilmFlowDirection",
      "uFilmFlowCoherence",
      "uFilmDiffusionAmount",
      "uFilmDripAmount",
      "uFilmBandContrast",
      "uFilmCoverage",
      "uFilmSpeckleAmount",
    ].forEach((uniformName) => {
      logo3d.filmUniforms[uniformName].value = logo3d.glassUniforms[uniformName].value;
    });
  }
  logo3d.glass.scale.set(
    1 + membraneTension * (0.01 + windGust * 0.026) + breathWave * visual.pulseAmplitude * 0.01,
    1 - membraneTension * (0.006 + windGust * 0.018) + Math.sin(seconds * 0.19) * membraneTension * 0.006,
    1 + membraneTension * (0.008 + windGust * 0.016),
  );
  logo3d.glass.position.set(
    windOffsetX + Math.sin(seconds * 0.37) * membraneTension * 0.01,
    windOffsetY + Math.cos(seconds * 0.31) * membraneTension * 0.008,
    windOffsetZ,
  );
  logo3d.glass.rotation.y = Math.sin(windYaw) * membraneTension * 0.085;
  logo3d.glass.rotation.z = Math.sin(seconds * 0.21) * membraneTension * 0.045 + windYaw * membraneTension * 0.035;
  if (logo3d.filmSurface) {
    logo3d.filmSurface.visible = (glassWind.filmCoverage ?? 1.08) > 0.001;
    logo3d.filmSurface.scale.copy(logo3d.glass.scale);
    logo3d.filmSurface.position.copy(logo3d.glass.position);
    logo3d.filmSurface.rotation.copy(logo3d.glass.rotation);
  }
  logo3d.glow.visible = false;
  logo3d.glow.material.color.lerpColors(LIGHT_PALETTE.glowCalm, LIGHT_PALETTE.glowClinical, clinicalShift);
  logo3d.glow.material.opacity = 0;
  logo3d.glow.scale.setScalar((lerp(2.7, 3.25, visual.brightness) + pressure * 0.22 + pulse * 0.08) * (flowParticles.glowScale ?? 1));
  logo3d.shellHighlight.visible = false;
  logo3d.shellHighlight.material.color.lerpColors(LIGHT_PALETTE.highlightCalm, LIGHT_PALETTE.highlightClinical, clinicalShift);
  logo3d.shellHighlight.material.opacity = 0;
  logo3d.shellHighlight.position.set(-0.34 + windOffsetX * (glassWind.shellHighlightFollow ?? 1.9), 0.18 + windOffsetY * 1.2, 0.88);
  logo3d.shellHighlight.scale.set(
    lerp(0.42, 0.72, visual.brightness) + pulse * 0.02,
    lerp(0.13, 0.23, visual.brightness) + pulse * 0.008,
    1,
  );
  logo3d.centerGlow.visible = false;
  logo3d.centerGlow.material.color.lerpColors(LIGHT_PALETTE.centerCalm, LIGHT_PALETTE.centerClinical, clinicalShift);
  logo3d.centerGlow.material.opacity = 0;
  logo3d.centerGlow.position.set(-0.08 + windOffsetX * (glassWind.centerGlowFollow ?? 0.72), 0.02 + windOffsetY * 0.58, 0.84);
  logo3d.centerGlow.scale.setScalar(lerp(0.2, 0.34, visual.brightness) + pressure * 0.025 + pulse * 0.012);

  logo3d.goldDust.rotation.y = seconds * (0.035 + pressure * 0.035) * (flowParticles.goldDustSpeed ?? 1);
  logo3d.goldDust.rotation.x = Math.sin(seconds * 0.11) * 0.08 + pressure * 0.03;
  logo3d.goldDust.rotation.z = Math.cos(seconds * 0.09) * 0.05;
  const goldDustScale = 1 + breathWave * visual.pulseAmplitude * 0.18 + pressure * 0.035;
  logo3d.goldDust.scale.setScalar(goldDustScale);
  const goldDustOpacity = flowParticles.goldDustOpacity ?? 1.05;
  logo3d.goldDust.visible = !FRONT_HEMISPHERE_TEST_MODE && goldDustOpacity > 0.001;
  logo3d.goldDustUniforms.uTime.value = seconds;
  logo3d.goldDustUniforms.uFocusDepth.value = logo3d.camera.position.z;
  logo3d.goldDustUniforms.uOccluderRadius.value = 1 / goldDustScale;
  logo3d.goldDustUniforms.uClinicalShift.value = clinicalShift;
  logo3d.goldDustUniforms.uOpacity.value = (lerp(0.38, 0.72, visual.brightness) + pressure * 0.07) * goldDustOpacity;

  logo3d.particles.rotation.y = -seconds * lerp(0.05, 0.52, pressure);
  logo3d.particles.rotation.x = Math.sin(seconds * 0.25) * 0.16;
  logo3d.particleMaterial.color.lerpColors(LIGHT_PALETTE.particleCalm, LIGHT_PALETTE.particleClinical, clinicalShift);
  logo3d.particleMaterial.size = (lerp(0.018, 0.036, pressure) + pulse * 0.004) * (flowParticles.particleSize ?? 1);
  logo3d.particleMaterial.opacity = lerp(0.08, 0.22, visual.brightness) * (flowParticles.particleOpacity ?? 1);

  logo3d.lights[0].color.lerpColors(LIGHT_PALETTE.ambientCalm, LIGHT_PALETTE.ambientClinical, clinicalShift);
  logo3d.lights[2].color.lerpColors(LIGHT_PALETTE.cyanCalm, LIGHT_PALETTE.cyanClinical, clinicalShift);
  logo3d.lights[3].color.lerpColors(LIGHT_PALETTE.roseCalm, LIGHT_PALETTE.roseClinical, clinicalShift);
  logo3d.lights[1].intensity = (lerp(2.2, 4.2, visual.brightness) + pulse * 0.38) * (flowParticles.keyLight ?? 1);
  logo3d.lights[2].intensity = lerp(1.35, 3.2, pressure) * (1 - clinicalShift * 0.22) * (flowParticles.cyanLight ?? 1);
  logo3d.lights[3].intensity = lerp(0.95, 2.55, pressureWindow(pressure, 0.42, 1)) * (1 - clinicalShift * 0.36) * (flowParticles.roseLight ?? 1);
  logo3d.renderer.render(logo3d.scene, logo3d.camera);
}
