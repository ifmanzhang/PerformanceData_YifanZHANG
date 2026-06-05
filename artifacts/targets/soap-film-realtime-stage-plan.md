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
- Visual fidelity repair after first review:
  - Problem observed:
    - `RT-initial-256x512-2048` was too pale and structurally weaker than the previous high-resolution offline sphere.
    - Root causes: single-channel cache derivation, live-field-only render upsampling, high diffusion/low cache preservation, overly gray RGB phase mapping, and flipped render V orientation relative to the cached sphere reference.
  - Fixes:
    - Pre-sample physical cache fields onto the realtime grid for faster and more stable coupling.
    - Preserve high-resolution physical cache detail at render time through `renderCacheBlend`.
    - Reduce default disturbance, air forcing, and diffusion for the default beauty render while preserving CLI control.
    - Add cache `curl` influence and cache `front` preservation.
    - Replace pale additive phase color with a thickness-derived continuous thin-film color band.
    - Add `renderFlipV=1` for the current cache/view mapping.
  - Verified output:
    - `artifacts/realtime-soap/runs/RT-visual-fidelity-v6-256x512-2048`
    - `artifacts/targets/latest-realtime-soap-beauty.png`
  - Performance:
    - Frames: `480`
    - Average physics frame time: `21.342 ms`
    - Average physics fps: `46.86`
    - p95 physics frame time: `24.190 ms`
    - p99 physics frame time: `29.320 ms`
    - 2048 PNG render/write time: `2248.4 ms`
    - Reached 24fps: `true`
  - Parameter response after visual repair:
    - `artifacts/realtime-soap/runs/RT-visual-v6-disturbance-strong-256x512-2048`
      - Average physics fps: `45.29`
    - `artifacts/realtime-soap/runs/RT-visual-v6-air-strong-256x512-2048`
      - Average physics fps: `46.58`
  - Remaining visual gap:
    - This is closer in saturation and structure, but still uses a fast thickness-band approximation rather than the previous offline optical renderer.
    - Next quality step is multi-frame physical cache plus a stricter spectral/Fresnel thin-film renderer in the high-resolution render layer.

## Next Stage

RT-M4:

1. Add multi-frame physical cache support and time interpolation.
2. Implement local cacheBlend suppression and recovery diagnostics for interactive disturbance.
3. Add a parameter scan runner that saves side-by-side result summaries.
4. Keep 256 x 512 physics at or above 24fps while preserving 2048 final rendering.
