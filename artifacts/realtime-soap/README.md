# Realtime Soap Film Hybrid Solver

This directory contains the independent realtime visual-physics path.

It is not a strict Huang 2020 reproduction. It is a realtime approximation that keeps physically interpretable `eta/Gamma/u` fields and couples them to physical caches generated from Huang-style output.

## Build Cache

```bash
node artifacts/realtime-soap/cache-builder.mjs --source=artifacts/realtime-soap/baseline/huang-official-highres512/frame0499.exr --outDir=artifacts/realtime-soap/cache/gravity_fig14_like
```

## Run Benchmark

```bash
node artifacts/realtime-soap/realtime-soap.mjs --mode=benchmark --physics=256x512 --render=2048 --fpsTarget=24 --seconds=20 --cache=artifacts/realtime-soap/cache/gravity_fig14_like --outDir=artifacts/realtime-soap/runs/RT-latest
```

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
