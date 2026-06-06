# Realtime Soap Film Hybrid Solver

This directory contains the independent realtime visual-physics path.

It is not a strict Huang 2020 reproduction. It is a realtime approximation that keeps physically interpretable `eta/Gamma/u` fields and couples them to physical caches generated from Huang-style output.

## Build Cache

```bash
node artifacts/realtime-soap/cache-builder.mjs --source=artifacts/realtime-soap/baseline/huang-official-highres512/frame0499.exr --outDir=artifacts/realtime-soap/cache/gravity_fig14_like
```

Build a local 32-frame physical cache for smoother realtime recovery:

```bash
node artifacts/realtime-soap/cache-builder.mjs --source=artifacts/realtime-soap/baseline/huang-official-highres512/frame0499.exr --outDir=artifacts/realtime-soap/cache/gravity_fig14_like_temporal32_soft --frames=32 --frameDt=0.006
```

The temporal cache is about 406MB and is intentionally not committed. It can be regenerated from the command above.

## Run Benchmark

```bash
node artifacts/realtime-soap/realtime-soap.mjs --mode=benchmark --physics=256x512 --render=2048 --fpsTarget=24 --seconds=20 --cache=artifacts/realtime-soap/cache/gravity_fig14_like --outDir=artifacts/realtime-soap/runs/RT-latest
```

High-quality still render with 4x supersampling anti-aliasing:

```bash
node artifacts/realtime-soap/realtime-soap.mjs --mode=benchmark --physics=256x512 --render=2048 --renderSamples=4 --renderReconstruction=bicubic --renderSharpen=0.16 --fpsTarget=24 --seconds=5 --cache=artifacts/realtime-soap/cache/gravity_fig14_like_temporal32_soft --outDir=artifacts/realtime-soap/runs/RT-aa-2048-s4 --cacheBlend=0.90 --renderCacheBlend=0.86 --disturbanceStrength=0.08
```

For inspection stills, `--render=4096 --renderSamples=4` gives a cleaner image at the cost of PNG render time. Physics fps is measured separately from final PNG rendering.

Maximum-current-clarity CPU inspection render:

```bash
node artifacts/realtime-soap/realtime-soap.mjs --mode=benchmark --physics=384x768 --render=4096 --renderSamples=4 --renderReconstruction=bicubic --renderSharpen=0.22 --renderDetailBoost=0.14 --fpsTarget=24 --seconds=5 --cache=artifacts/realtime-soap/cache/gravity_fig14_like_temporal32_soft --outDir=artifacts/realtime-soap/runs/RT-recon-bicubic-384x768-4096-s4-detail-v1 --cacheBlend=0.82 --renderCacheBlend=0.68 --disturbanceStrength=0.08 --diffusion=0.008 --pressureIterations=4
```

This high-clarity CPU mode is not realtime; it is a quality ceiling test. The same physics resolution should move to GPU/WebGL/WebGPU to meet the `>=24fps` target.

Highest-trust cache-only spectral still render:

```bash
node artifacts/realtime-soap/realtime-soap.mjs --mode=benchmark --physics=256x512 --render=4096 --renderSamples=4 --renderReconstruction=bicubic --renderSource=cache --renderOptics=spectral --renderEtaScale=3600 --renderExposure=1.08 --renderSaturation=1.55 --renderSharpen=0.10 --renderDetailBoost=0.06 --fpsTarget=24 --seconds=1 --cache=artifacts/realtime-soap/cache/gravity_fig14_like --outDir=artifacts/realtime-soap/runs/RT-cache-spectral-4096-s4-v2-eta3600 --cacheBlend=0 --renderCacheBlend=1 --disturbanceStrength=0
```

This path bypasses the low-resolution realtime residual layer for final stills and renders directly from the highest available physical cache. It is more trustworthy than the hybrid visual path, but it is limited by the source EXR/cache resolution: `1024 x 512`, with only `eta` truly sourced and `Gamma/u/front` derived.

Transparent PNG still render:

```bash
node artifacts/realtime-soap/realtime-soap.mjs --mode=benchmark --physics=256x512 --render=2048 --renderSamples=4 --renderReconstruction=bicubic --renderSource=cache --renderOptics=palette --renderEtaScale=2100 --renderExposure=1.08 --renderSaturation=1.20 --renderSharpen=0.08 --renderDetailBoost=0.015 --renderTransparent=1 --renderBaseAlpha=0.32 --renderRimAlpha=0.10 --renderRimPower=5.8 --renderFrontAlpha=0.06 --renderEdgeGlow=0 --renderEdgePower=5.5 --fpsTarget=24 --seconds=1 --cache=artifacts/realtime-soap/cache/gravity_fig14_like --outDir=artifacts/realtime-soap/runs/RT-cache-palette-alpha-no-white-rim-2048-s4-v1 --cacheBlend=0 --renderCacheBlend=1 --disturbanceStrength=0
```

`renderTransparent=1` writes a real PNG alpha channel: outside the bubble is transparent, the film body is semi-transparent, and rim/front/foam regions get higher opacity from physical fields and view angle. Set `renderTransparent=0` for opaque black-background preview output.

The wide white rim from the first alpha test was a render-layer artifact caused by broad edge glow, high rim alpha, and over-amplified cache front. The no-white-rim preset disables `renderEdgeGlow`, narrows the rim contribution with `renderRimPower`, and reduces `renderFrontAlpha`.

Lit transparent preview:

```bash
node artifacts/realtime-soap/realtime-soap.mjs --mode=benchmark --physics=256x512 --render=2048 --renderSamples=4 --renderReconstruction=bicubic --renderSource=cache --renderOptics=palette --renderEtaScale=2100 --renderExposure=1.08 --renderSaturation=1.20 --renderSharpen=0.08 --renderDetailBoost=0.015 --renderTransparent=1 --renderBaseAlpha=0.32 --renderRimAlpha=0.10 --renderRimPower=5.8 --renderFrontAlpha=0.06 --renderEdgeGlow=0 --renderEdgePower=5.5 --renderLighting=1 --renderAmbient=0.60 --renderDiffuse=0.40 --renderTransmission=0.14 --renderSpecular=0.42 --renderSpecularPower=44 --renderFresnelReflect=0.075 --renderLightX=-0.58 --renderLightY=0.56 --renderLightZ=0.59 --fpsTarget=24 --seconds=1 --cache=artifacts/realtime-soap/cache/gravity_fig14_like --outDir=artifacts/realtime-soap/runs/RT-cache-palette-alpha-lit-contrast-2048-s4-v1 --cacheBlend=0 --renderCacheBlend=1 --disturbanceStrength=0
```

Lighting is a view/normal-derived render layer on top of physical film color: hemisphere environment, directional transmission, compact specular highlight, and a small Fresnel reflection. It does not sample reference images or paint color regions.

Environment-composited lighting preview:

```bash
node artifacts/realtime-soap/realtime-soap.mjs --mode=benchmark --physics=256x512 --render=2048 --renderSamples=4 --renderReconstruction=bicubic --renderSource=cache --renderOptics=palette --renderEtaScale=2100 --renderExposure=1.08 --renderSaturation=1.20 --renderSharpen=0.08 --renderDetailBoost=0.015 --renderTransparent=1 --renderCompositeBackground=1 --renderBaseAlpha=0.50 --renderRimAlpha=0.15 --renderRimPower=5.4 --renderFrontAlpha=0.09 --renderEdgeGlow=0 --renderEdgePower=5.5 --renderLighting=1 --renderAmbient=0.63 --renderDiffuse=0.36 --renderTransmission=0.24 --renderEnvironmentStrength=0.50 --renderSpecular=0.55 --renderSpecularPower=42 --renderSoftbox=0.38 --renderSoftboxPower=18 --renderFresnelReflect=0.12 --renderBacklight=0.14 --renderLightX=-0.58 --renderLightY=0.56 --renderLightZ=0.59 --fpsTarget=24 --seconds=1 --cache=artifacts/realtime-soap/cache/gravity_fig14_like --outDir=artifacts/realtime-soap/runs/RT-cache-palette-alpha-envlit-composite-2048-s4-balanced-v1 --cacheBlend=0 --renderCacheBlend=1 --disturbanceStrength=0
```

`renderCompositeBackground=1` is for judging lighting in still images: it composites the semi-transparent film over the analytic environment so transmission and reflection are visible. For an actual transparent asset, keep `renderCompositeBackground=0` and composite the PNG in the final viewer.

Soap-like environment reflection preview with pure black background:

```bash
node artifacts/realtime-soap/realtime-soap.mjs --mode=benchmark --physics=256x512 --render=2048 --renderSamples=4 --renderReconstruction=bicubic --renderSource=cache --renderOptics=palette --renderEtaScale=2150 --renderExposure=1.04 --renderSaturation=1.38 --renderSharpen=0.08 --renderDetailBoost=0.012 --renderTransparent=1 --renderCompositeBackground=1 --renderBackground=black --renderBaseAlpha=0.30 --renderRimAlpha=0.26 --renderRimPower=4.9 --renderFrontAlpha=0.07 --renderEdgeGlow=0 --renderEdgePower=5.5 --renderLighting=1 --renderAmbient=0.48 --renderDiffuse=0.10 --renderTransmission=0.38 --renderEnvironmentStrength=1.18 --renderSpecular=0.28 --renderSpecularPower=92 --renderSoftbox=1.25 --renderSoftboxPower=24 --renderFresnelReflect=0.42 --renderBacklight=0.18 --renderBumpStrength=0.14 --renderRefraction=0.38 --renderLightX=-0.58 --renderLightY=0.56 --renderLightZ=0.59 --fpsTarget=24 --seconds=1 --cache=artifacts/realtime-soap/cache/gravity_fig14_like --outDir=artifacts/realtime-soap/runs/RT-cache-palette-soaplike-blackbg-2048-s4-v1 --cacheBlend=0 --renderCacheBlend=1 --disturbanceStrength=0
```

This preset is the current best still-image lighting preview. It uses analytic studio panels/strips in `environmentColor()` for reflection only, but composites the actual canvas over pure black via `--renderBackground=black`. Pixel audit of the outer corners is `0,0,0,255`.

## Outputs

- `beauty.png`
- `eta.png`
- `Gamma.png`
- `velocity.png`
- `front.png`
- `foam.png`
- `divergence.png`
- `diagnostics.json`
- `performance.json`

## Boundary

The cache stores physical fields, not visual textures. The renderer computes color from optical thickness and derived physical fields.

## Verified Run

Initial verified run:

- Output: `artifacts/realtime-soap/runs/RT-initial-256x512-2048`
- Physics resolution: `256 x 512`
- Render output: `2048 x 2048`
- Simulated time: `20s`
- Frames: `480`
- Average physics frame time: `31.203ms`
- Average physics fps: `32.05`
- p95 physics frame time: `34.983ms`
- 2048 PNG render/write time: `1372.7ms`
- Result: reached the `>=24fps` physics target.

Parameter response smoke checks:

- `artifacts/realtime-soap/runs/RT-disturbance-strong-256x512-2048`
- `artifacts/realtime-soap/runs/RT-air-strong-256x512-2048`

Both completed above 31fps and produced different `eta/Gamma/u/front/foam` diagnostics under changed inputs.

Visual fidelity repair run:

- Output: `artifacts/realtime-soap/runs/RT-visual-fidelity-v6-256x512-2048`
- Latest preview copy: `artifacts/targets/latest-realtime-soap-beauty.png`
- Physics resolution: `256 x 512`
- Render output: `2048 x 2048`
- Simulated time: `20s`
- Frames: `480`
- Average physics frame time: `21.342ms`
- Average physics fps: `46.86`
- p95 physics frame time: `24.190ms`
- 2048 PNG render/write time: `2248.4ms`
- Result: reached the `>=24fps` physics target with improved cache-preserved visual structure.

Temporal-cache parameter scan:

```bash
node artifacts/realtime-soap/parameter-scan.mjs --cache=artifacts/realtime-soap/cache/gravity_fig14_like_temporal32_soft --outDir=artifacts/realtime-soap/runs/RT-scan-temporal32-soft-v1 --physics=256x512 --render=2048 --seconds=5 --fpsTarget=24
```

Best current display case:

- Output: `artifacts/realtime-soap/runs/RT-scan-temporal32-soft-v1/high-cache-stable`
- Average physics fps: `32.98`
- Cache frames: `32`
- Preview copy: `artifacts/targets/latest-realtime-soap-beauty.png`

Anti-aliased render update:

- `realtime-soap.mjs` supports `--renderSamples=N`, default `4`.
- The final sphere renderer uses subpixel supersampling before writing PNG, reducing the hard sphere rim and high-contrast internal stair-stepping.
- `--renderReconstruction=bicubic` uses clamped Catmull-Rom reconstruction for final field sampling.
- `--renderSharpen` and `--renderDetailBoost` improve clarity from the rendered physical fields and front/compression fields; they do not sample any reference image.
- `--renderSource=cache --renderOptics=spectral` is the preferred still-image path when avoiding the fake low-resolution hybrid look is more important than live perturbation.
- `--renderTransparent=1` enables semi-transparent soap-film alpha. Opacity is controlled by `renderBaseAlpha`, `renderRimAlpha`, and `renderFrontAlpha`.
- `--renderEdgeGlow=0 --renderRimAlpha=0.10 --renderRimPower=5.8` avoids the earlier broad white edge artifact.
- `--renderLighting=1` enables hemisphere lighting, transmission, compact specular, and Fresnel reflection from the sphere normal. Use this for transparent preview outputs that otherwise look too flat.
- `--renderCompositeBackground=1` composites the transparent film over an analytic environment for preview only. It is closer to how the bubble will look inside a viewer than inspecting the alpha PNG over a black background.
- `--renderBackground=black` makes the preview canvas pure black while preserving hidden analytic environment reflection on the bubble surface.
- `--renderBumpStrength` perturbs the shading normal from membrane thickness gradients so reflected/transmitted environment light bends with the simulated film field.
- `--renderRefraction` controls analytic background distortion in composite preview. It is a realtime approximation, not full ray-traced refraction.
