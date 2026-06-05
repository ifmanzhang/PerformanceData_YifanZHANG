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
