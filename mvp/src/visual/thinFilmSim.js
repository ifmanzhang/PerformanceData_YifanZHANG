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

  void main() {
    vec2 uv = vUv;
    vec2 centered = uv - 0.5;
    float dome = smoothstep(0.72, 0.08, length(centered));
    float verticalDrain = smoothstep(-0.18, 0.88, 0.5 - uv.y);
    float broad = fbm(uv * vec2(2.0, 3.8) + uSeed);
    float lanes = fbm(vec2(uv.x * 3.2 + broad * 0.85, uv.y * 8.8 + broad * 1.4 + uSeed * 0.23));
    float fine = fbm(uv * 16.0 + vec2(uSeed * 0.71, -uSeed * 0.37));

    float channel = smoothstep(0.44, 0.7, lanes) * (1.0 - smoothstep(0.7, 0.94, lanes));
    float filmHeight = 0.34 + verticalDrain * 0.32 + broad * 0.28 + smoothstep(0.62, 0.92, lanes) * 0.24;
    filmHeight -= channel * 0.12;
    filmHeight += smoothstep(0.82, 0.99, fine) * 0.1;
    filmHeight = mix(0.24, filmHeight, dome);

    float surfactant = 0.42 + fbm(uv * 4.6 + vec2(4.2 + uSeed, 1.3)) * 0.28 + channel * 0.34 - filmHeight * 0.1;
    float fleck = smoothstep(0.84, 0.992, fbm(uv * 72.0 + vec2(8.2, uSeed)));
    float pinning = hash21(floor(uv * 256.0) + uSeed);
    gl_FragColor = vec4(
      clamp(filmHeight, 0.04, 0.96),
      clamp(surfactant, 0.04, 0.96),
      clamp(fleck * dome, 0.0, 1.0),
      pinning
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
    float fleck = center.b;
    float pinning = center.a;
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
    float slipNoise = fbm(uv * 9.0 + vec2(pinning * 3.1, potential * 2.4));
    float slip = 0.68 + slipNoise * 0.54 + pinning * 0.18;

    vec2 marangoniFlow = gradG * (0.03 + uMarangoni * 0.1);
    vec2 capillaryFlow = -gradH * (0.018 + uCapillary * 0.09);
    vec2 localShear = mix(curl, mainDir + crossDir * (slipNoise - 0.5) * 0.5, clamp(uFlowCoherence, 0.0, 1.0));
    vec2 velocity =
      mainDir * (0.012 + uFlowSpeed * 0.085) * (0.72 + uPressure * 0.38) +
      localShear * (1.0 - uFlowCoherence) * (0.012 + uFlowSpeed * 0.038) +
      marangoniFlow +
      capillaryFlow;

    vec2 backUv = uv - velocity * uDelta * slip;
    vec4 advected = stateAt(backUv);

    float downwind = dot(uv - vec2(0.5), mainDir);
    float downhill = smoothstep(-0.48, 0.74, downwind);
    float sourceNoise = fbm(uv * vec2(5.2, 12.0) + mainDir * uTime * 0.04 + crossDir * potential);
    float sourceLane = smoothstep(0.68, 0.96, sourceNoise) * smoothstep(-0.82, 0.72, -downwind);
    float beadSeed = smoothstep(0.955, 0.995, fbm(uv * 72.0 + vec2(-uTime * 0.08, uTime * 0.05) + pinning));
    float edgeLoss = smoothstep(0.48, 0.76, length(uv - vec2(0.5)));
    float thickFilmLoss = smoothstep(0.88, 0.98, advected.r);

    height = advected.r;
    surfactant = advected.g;
    fleck = advected.b;
    height += uDelta * (
      lapH * (0.026 + uDiffusion * 0.085) +
      downhill * uDrainage * 0.032 * uDripAmount -
      height * (0.008 + edgeLoss * 0.026) * uDrainage -
      thickFilmLoss * 0.034 +
      sourceLane * uSourceAmount * 0.052 -
      beadSeed * uDripAmount * 0.026
    );
    surfactant += uDelta * (
      lapG * (0.028 + uDiffusion * 0.075) +
      (0.52 - surfactant) * 0.018 -
      sourceLane * uSourceAmount * 0.008 +
      gradH.x * 0.015
    );
    fleck = max(fleck * (0.988 - edgeLoss * 0.01), beadSeed * (0.42 + uDripAmount * 0.3));
    fleck += sourceLane * smoothstep(0.72, 0.96, slipNoise) * uDripAmount * 0.012;

    gl_FragColor = vec4(
      clamp(height, 0.025, 0.985),
      clamp(surfactant, 0.025, 0.985),
      clamp(fleck, 0.0, 1.0),
      pinning
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
