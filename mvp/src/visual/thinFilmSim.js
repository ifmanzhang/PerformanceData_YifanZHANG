import * as THREE from "../../vendor/three.module.min.js";

const SIM_VERTEX_SHADER = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const INIT_FRAGMENT_SHADER = `
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

  vec2 rotate2(vec2 p, float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return vec2(c * p.x - s * p.y, s * p.x + c * p.y);
  }

  float ellipsoidDrop(vec2 uv, vec2 center, vec2 radius, float angle, float edgeSoftness) {
    vec2 p = rotate2(uv - center, angle) / radius;
    float d = length(p);
    float body = exp(-pow(d, 2.45) * 2.2);
    float rim = exp(-pow((d - 0.86) / edgeSoftness, 2.0));
    return body + rim * 0.18;
  }

  float capsuleDistance(vec2 p, vec2 a, vec2 b) {
    vec2 pa = p - a;
    vec2 ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h);
  }

  void main() {
    vec2 uv = vUv;
    vec2 centered = uv - 0.5;
    float dome = smoothstep(0.72, 0.08, length(centered));
    float verticalDrain = smoothstep(-0.24, 0.92, 0.5 - uv.y);
    float broad = fbm(uv * vec2(1.45, 2.35) + uSeed);
    float shear = fbm(vec2(uv.x * 2.0 + broad * 0.74, uv.y * 6.2 + broad * 1.1 + uSeed * 0.23));
    float lanes = fbm(vec2(uv.x * 3.0 + shear * 1.45, uv.y * 8.8 + broad * 1.8 + uSeed * 0.23));
    float fine = fbm(uv * 20.0 + vec2(uSeed * 0.71, -uSeed * 0.37));

    float riverA = exp(-pow(capsuleDistance(uv, vec2(0.05, 0.77), vec2(0.93, 0.58)) / 0.045, 2.0));
    float riverB = exp(-pow(capsuleDistance(uv, vec2(0.02, 0.34), vec2(0.92, 0.28)) / 0.035, 2.0));
    float riverC = exp(-pow(capsuleDistance(uv, vec2(0.2, 0.54), vec2(0.78, 0.48)) / 0.03, 2.0));
    float rivulet = clamp(riverA * 0.8 + riverB * 0.62 + riverC * 0.52, 0.0, 1.0);
    float blobs =
      ellipsoidDrop(uv, vec2(0.28, 0.68), vec2(0.22, 0.07), -0.24, 0.2) * 0.72 +
      ellipsoidDrop(uv, vec2(0.56, 0.62), vec2(0.18, 0.06), -0.12, 0.22) * 0.54 +
      ellipsoidDrop(uv, vec2(0.38, 0.39), vec2(0.2, 0.055), -0.18, 0.2) * 0.58 +
      ellipsoidDrop(uv, vec2(0.68, 0.33), vec2(0.24, 0.07), -0.14, 0.2) * 0.66 +
      ellipsoidDrop(uv, vec2(0.77, 0.73), vec2(0.15, 0.05), -0.12, 0.2) * 0.38;
    float cellularDrops = pow(smoothstep(0.42, 0.92, lanes), 2.2) * (0.24 + broad * 0.18);
    float filmHeight = 0.26 + verticalDrain * 0.22 + broad * 0.18 + shear * 0.08;
    filmHeight += blobs * 0.58 + cellularDrops;
    filmHeight -= rivulet * 0.2;
    filmHeight += pow(fine, 7.0) * 0.035;
    filmHeight = mix(0.24, filmHeight, dome);

    float surfactant = 0.46 + fbm(uv * 4.2 + vec2(4.2 + uSeed, 1.3)) * 0.18 + rivulet * 0.34 - blobs * 0.14 - filmHeight * 0.06;
    vec2 seedVelocity = vec2(
      fbm(uv * 5.0 + vec2(2.1, uSeed)) - 0.5,
      fbm(uv * 5.0 + vec2(uSeed, 7.4)) - 0.5
    ) * 0.012 + vec2(0.028, -0.01) * (0.45 + filmHeight);
    gl_FragColor = vec4(
      clamp(filmHeight, 0.04, 0.96),
      clamp(surfactant, 0.04, 0.96),
      clamp(0.5 + seedVelocity.x, 0.0, 1.0),
      clamp(0.5 + seedVelocity.y, 0.0, 1.0)
    );
  }
`;

const STEP_FRAGMENT_SHADER = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uPrevState;
  uniform vec2 uTexel;
  uniform float uTime;
  uniform float uDelta;
  uniform float uPressure;
  uniform float uFlowSpeed;
  uniform float uFlowDirection;
  uniform float uFlowCoherence;
  uniform float uDiffusion;
  uniform float uDripAmount;
  uniform float uMarangoni;
  uniform float uCapillary;
  uniform float uDrainage;
  uniform float uSourceAmount;

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

  vec4 stateAt(vec2 uv) {
    return texture2D(uPrevState, clamp(uv, vec2(0.002), vec2(0.998)));
  }

  void main() {
    vec2 uv = vUv;
    vec4 center = stateAt(uv);
    vec4 left = stateAt(uv - vec2(uTexel.x, 0.0));
    vec4 right = stateAt(uv + vec2(uTexel.x, 0.0));
    vec4 down = stateAt(uv - vec2(0.0, uTexel.y));
    vec4 up = stateAt(uv + vec2(0.0, uTexel.y));

    float height = center.r;
    float surfactant = center.g;
    vec2 storedVelocity = (center.ba - 0.5) * 2.0;
    vec2 gradH = vec2(right.r - left.r, up.r - down.r);
    vec2 gradG = vec2(right.g - left.g, up.g - down.g);
    float lapH = left.r + right.r + up.r + down.r - height * 4.0;
    float lapG = left.g + right.g + up.g + down.g - surfactant * 4.0;

    vec2 mainDir = normalize(vec2(cos(uFlowDirection), sin(uFlowDirection)));
    vec2 crossDir = vec2(-mainDir.y, mainDir.x);
    float potential = fbm(uv * 3.2 + vec2(uTime * 0.018, -uTime * 0.012));
    float potentialX = fbm((uv + vec2(uTexel.x * 2.0, 0.0)) * 3.2 + vec2(uTime * 0.018, -uTime * 0.012));
    float potentialY = fbm((uv + vec2(0.0, uTexel.y * 2.0)) * 3.2 + vec2(uTime * 0.018, -uTime * 0.012));
    vec2 curl = normalize(vec2(potential - potentialY, potentialX - potential) + 0.0001);
    float pinning = hash21(floor(uv * 256.0));
    float slipNoise = fbm(uv * 9.0 + vec2(pinning * 3.1, potential * 2.4));
    float thicknessMobility = smoothstep(0.18, 0.86, height);
    float slip = 0.46 + slipNoise * 0.36 + thicknessMobility * 0.78 + pinning * 0.08;

    vec2 marangoniFlow = gradG * (0.038 + uMarangoni * 0.09);
    vec2 capillaryFlow = -gradH * (0.018 + uCapillary * 0.08);
    vec2 localShear = mix(curl, mainDir + crossDir * (slipNoise - 0.5) * 0.5, clamp(uFlowCoherence, 0.0, 1.0));
    vec2 externalVelocity =
      mainDir * (0.004 + uFlowSpeed * 0.022) * (0.72 + uPressure * 0.38) * (0.44 + height * 0.95) +
      localShear * (1.0 - uFlowCoherence) * (0.004 + uFlowSpeed * 0.018);
    externalVelocity += vec2(0.0, -1.0) * uDrainage * 0.006 * (0.35 + height * height);
    vec2 forceVelocity = externalVelocity + marangoniFlow + capillaryFlow;
    vec2 velocity = storedVelocity * 0.86 + forceVelocity;

    vec2 backUv = uv - velocity * uDelta * slip;
    vec4 advected = stateAt(backUv);

    float downwind = dot(uv - vec2(0.5), mainDir);
    float downhill = smoothstep(-0.48, 0.74, downwind);
    float sourceNoise = fbm(uv * vec2(4.4, 11.0) + mainDir * uTime * 0.04 + crossDir * potential);
    float sourceLane = pow(clamp(sourceNoise, 0.0, 1.0), 4.2) * smoothstep(-0.82, 0.72, -downwind);
    float beadSeed = smoothstep(0.976, 0.999, fbm(uv * 92.0 + vec2(-uTime * 0.08, uTime * 0.05) + pinning));
    float edgeLoss = smoothstep(0.48, 0.76, length(uv - vec2(0.5)));
    float thickFilmLoss = smoothstep(0.88, 0.98, advected.r);

    height = advected.r;
    surfactant = advected.g;
    vec2 advectedVelocity = (advected.ba - 0.5) * 2.0;
    vec2 nextVelocity = advectedVelocity * 0.94 + forceVelocity * uDelta * (1.3 + slip * 0.4);
    nextVelocity += curl * (1.0 - uFlowCoherence) * uDelta * 0.015;
    nextVelocity -= gradH * uDelta * (0.04 + uCapillary * 0.08);
    nextVelocity = clamp(nextVelocity, vec2(-0.18), vec2(0.18));
    float dropletCore = smoothstep(0.58, 0.9, height);
    float thinCut = smoothstep(0.16, 0.38, height);
    float rimFlow = smoothstep(0.035, 0.18, length(gradH));
    height += uDelta * (
      lapH * (0.022 + uDiffusion * 0.055 + dropletCore * 0.025) +
      downhill * uDrainage * 0.02 * uDripAmount * (0.35 + height * height) -
      height * (0.004 + edgeLoss * 0.018) * uDrainage -
      thickFilmLoss * 0.025 +
      sourceLane * uSourceAmount * 0.026 -
      beadSeed * uDripAmount * 0.012 -
      rimFlow * thinCut * 0.008
    );
    surfactant += uDelta * (
      lapG * (0.034 + uDiffusion * 0.09) +
      (0.52 - surfactant) * 0.018 -
      sourceLane * uSourceAmount * 0.012 +
      dot(gradH, mainDir) * 0.018
    );
    gl_FragColor = vec4(
      clamp(height, 0.025, 0.985),
      clamp(surfactant, 0.025, 0.985),
      clamp(0.5 + nextVelocity.x * 2.0, 0.0, 1.0),
      clamp(0.5 + nextVelocity.y * 2.0, 0.0, 1.0)
    );
  }
`;

function renderToTarget(renderer, scene, camera, target) {
  const previousTarget = renderer.getRenderTarget();
  renderer.setRenderTarget(target);
  renderer.render(scene, camera);
  renderer.setRenderTarget(previousTarget);
}

export function createThinFilmSimulator(renderer, options = {}) {
  const size = options.size || 256;
  const supportedHalfFloat = renderer.capabilities.isWebGL2 || renderer.extensions.get("OES_texture_half_float");
  const type = supportedHalfFloat ? THREE.HalfFloatType : THREE.UnsignedByteType;
  const targetOptions = {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
    format: THREE.RGBAFormat,
    type,
    depthBuffer: false,
    stencilBuffer: false,
  };
  const readTarget = new THREE.WebGLRenderTarget(size, size, targetOptions);
  const writeTarget = new THREE.WebGLRenderTarget(size, size, targetOptions);
  readTarget.texture.generateMipmaps = false;
  writeTarget.texture.generateMipmaps = false;

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const geometry = new THREE.PlaneGeometry(2, 2);
  const scene = new THREE.Scene();
  const quad = new THREE.Mesh(geometry);
  scene.add(quad);

  const initMaterial = new THREE.ShaderMaterial({
    vertexShader: SIM_VERTEX_SHADER,
    fragmentShader: INIT_FRAGMENT_SHADER,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uSeed: { value: Math.random() * 1000 },
    },
  });

  const stepMaterial = new THREE.ShaderMaterial({
    vertexShader: SIM_VERTEX_SHADER,
    fragmentShader: STEP_FRAGMENT_SHADER,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uPrevState: { value: readTarget.texture },
      uTexel: { value: new THREE.Vector2(1 / size, 1 / size) },
      uTime: { value: 0 },
      uDelta: { value: 1 / 30 },
      uPressure: { value: 0 },
      uFlowSpeed: { value: 0.46 },
      uFlowDirection: { value: 92 * Math.PI / 180 },
      uFlowCoherence: { value: 0.76 },
      uDiffusion: { value: 0.38 },
      uDripAmount: { value: 1.24 },
      uMarangoni: { value: 0.72 },
      uCapillary: { value: 0.52 },
      uDrainage: { value: 0.58 },
      uSourceAmount: { value: 0.7 },
    },
  });

  let currentRead = readTarget;
  let currentWrite = writeTarget;
  let lastTime = 0;

  function reset() {
    initMaterial.uniforms.uSeed.value = Math.random() * 1000;
    quad.material = initMaterial;
    renderToTarget(renderer, scene, camera, currentRead);
    renderToTarget(renderer, scene, camera, currentWrite);
    lastTime = 0;
  }

  function update(timeSeconds, config = {}, pressure = 0) {
    const rawDelta = lastTime ? timeSeconds - lastTime : 1 / 30;
    const delta = Math.min(1 / 18, Math.max(1 / 90, rawDelta || 1 / 30));
    lastTime = timeSeconds;
    stepMaterial.uniforms.uPrevState.value = currentRead.texture;
    stepMaterial.uniforms.uTime.value = timeSeconds;
    stepMaterial.uniforms.uDelta.value = delta;
    stepMaterial.uniforms.uPressure.value = pressure;
    stepMaterial.uniforms.uFlowSpeed.value = config.filmFlowSpeed ?? 0.46;
    stepMaterial.uniforms.uFlowDirection.value = (config.filmFlowDirection ?? 92) * Math.PI / 180;
    stepMaterial.uniforms.uFlowCoherence.value = config.filmFlowCoherence ?? 0.76;
    stepMaterial.uniforms.uDiffusion.value = config.filmDiffusionAmount ?? 0.38;
    stepMaterial.uniforms.uDripAmount.value = config.filmDripAmount ?? 1.24;
    stepMaterial.uniforms.uMarangoni.value = config.filmMarangoniStrength ?? 0.72;
    stepMaterial.uniforms.uCapillary.value = config.filmCapillaryStrength ?? 0.52;
    stepMaterial.uniforms.uDrainage.value = config.filmDrainageAmount ?? 0.58;
    stepMaterial.uniforms.uSourceAmount.value = config.filmSourceAmount ?? 0.7;

    quad.material = stepMaterial;
    renderToTarget(renderer, scene, camera, currentWrite);
    const nextRead = currentWrite;
    currentWrite = currentRead;
    currentRead = nextRead;
  }

  function dispose() {
    readTarget.dispose();
    writeTarget.dispose();
    initMaterial.dispose();
    stepMaterial.dispose();
    geometry.dispose();
  }

  reset();

  return {
    get texture() {
      return currentRead.texture;
    },
    get size() {
      return size;
    },
    reset,
    update,
    dispose,
  };
}
