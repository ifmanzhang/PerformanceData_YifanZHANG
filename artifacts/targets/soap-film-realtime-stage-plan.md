# Soap Film Realtime Stage Plan

## Stage

RT-M0 to RT-M3 initial implementation.

## Tasks

1. Preserve baseline commit and push.
2. Write realtime final goal and plan documents.
3. Create `artifacts/realtime-soap/`.
4. Implement physical cache builder.
5. Implement realtime residual solver.
6. Implement 2048 sphere renderer.
7. Run benchmark at 256 x 512 for 20 seconds.
8. Save beauty/debug/performance outputs.
9. Commit and push implementation.

## Default Inputs

- Baseline source:
  - `artifacts/realtime-soap/baseline/huang-official-highres512/frame0499.exr`
  - `artifacts/realtime-soap/baseline/huang-official-highres512/frame0499-thinfilm-sphere.png`
- Cache output:
  - `artifacts/realtime-soap/cache/gravity_fig14_like`

## Runtime Command

```bash
node artifacts/realtime-soap/cache-builder.mjs --source=artifacts/realtime-soap/baseline/huang-official-highres512/frame0499.exr --outDir=artifacts/realtime-soap/cache/gravity_fig14_like
node artifacts/realtime-soap/realtime-soap.mjs --mode=benchmark --physics=256x512 --render=2048 --fpsTarget=24 --seconds=20 --cache=artifacts/realtime-soap/cache/gravity_fig14_like --outDir=artifacts/realtime-soap/runs/RT-initial
```

## Acceptance

- Cache manifest exists and records eta/Gamma/u/front fields.
- Realtime benchmark completes.
- Average physics fps >= 24.
- Output includes beauty, eta, Gamma, velocity, front, foam, diagnostics, and performance files.
- The implementation labels the solver as realtime hybrid approximation.

## Results

- Baseline commit pushed:
  - `7a591545 REALTIME_SOAP_FILM_BASELINE`
- Cache generated:
  - `artifacts/realtime-soap/cache/gravity_fig14_like`
  - Source: `artifacts/realtime-soap/baseline/huang-official-highres512/frame0499.exr`
  - Cache grid: `512 x 1024`
  - Fields: `eta`, `gamma`, `uTheta`, `uPhi`, `div`, `curl`, `front`
- Main benchmark:
  - Output: `artifacts/realtime-soap/runs/RT-initial-256x512-2048`
  - Command: `node artifacts/realtime-soap/realtime-soap.mjs --mode=benchmark --physics=256x512 --render=2048 --fpsTarget=24 --seconds=20 --cache=artifacts/realtime-soap/cache/gravity_fig14_like --outDir=artifacts/realtime-soap/runs/RT-initial-256x512-2048`
  - Frames: `480`
  - Average physics frame time: `31.203 ms`
  - Average physics fps: `32.05`
  - p95 physics frame time: `34.983 ms`
  - p99 physics frame time: `43.382 ms`
  - 2048 PNG render/write time: `1372.7 ms`
  - Reached 24fps: `true`
- Parameter response checks:
  - `artifacts/realtime-soap/runs/RT-disturbance-strong-256x512-2048`
    - Average physics fps: `31.56`
    - Stronger local disturbance increased `eta` max to `1.304` and changed `Gamma/front/foam` statistics.
  - `artifacts/realtime-soap/runs/RT-air-strong-256x512-2048`
    - Average physics fps: `31.78`
    - Stronger air and Marangoni parameters changed `Gamma`, `velocity`, `front`, and `foam` statistics.
- Current technical boundary:
  - This is a realtime hybrid approximation, not strict Huang 2020.
  - Cache fields are physical field caches generated from Huang-style output; no reference image sampling or color texture is used.
  - Rendering color is derived from `eta`, view angle, front/foam fields, and thin-film phase approximation.

## Next Stage

RT-M4:

1. Add multi-frame physical cache support and time interpolation.
2. Implement local cacheBlend suppression and recovery diagnostics for interactive disturbance.
3. Add a parameter scan runner that saves side-by-side result summaries.
4. Keep 256 x 512 physics at or above 24fps while preserving 2048 final rendering.
