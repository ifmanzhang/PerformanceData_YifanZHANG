# Soap Film Realtime Plan

## Strategy

Create an independent realtime hybrid solver under `artifacts/realtime-soap/`.

The solver uses:

- A physical cache layer seeded from local Huang output.
- A low-resolution realtime residual solver for eta/Gamma/u.
- A high-resolution renderer that derives thin-film color from physical fields.

This is a visual realtime path, not the strict Huang reproduction path.

## Milestones

### RT-M0 Baseline and Documents

- Commit and push baseline as `REALTIME_SOAP_FILM_BASELINE`.
- Create immutable realtime goal document.
- Create realtime plan document.
- Create current realtime stage plan.

### RT-M1 Cache Builder

- Build a physical cache package from the selected Huang high-resolution result.
- Store cache fields as gzip-compressed Float32 arrays plus manifest.
- Generate cache debug images.

### RT-M2 Realtime Residual Physics

- Implement independent realtime CPU reference solver.
- Default resolution: 256 x 512.
- Support disturbance, gravity, air drag, Marangoni, viscosity, diffusion, evaporation, and cache blend.
- Benchmark at least 20 seconds of simulated time.

### RT-M3 High-Resolution Renderer

- Render a 2048 x 2048 sphere from realtime fields plus cache fields.
- Use thin-film interference approximation from optical thickness.
- Generate beauty, eta, Gamma, velocity, front, and foam images.

### RT-M4 Cache/Disturbance Interaction

- Local disturbance must reduce cache binding and produce visible local response.
- Cache binding should restore coherent structure after disturbance decays.
- Save comparison runs with different disturbance positions and strengths.

### RT-M5 Performance Optimization

- Optimize layout and sampling until realtime physics reaches at least 24 fps.
- If CPU cannot reach target, move the hot loop to a GPU/WebGL/WebGPU path.

### RT-M6 Visual Acceptance Package

- Produce final static, parameter-response, and disturbance-response outputs.
- Compare with Huang high-resolution output and the aesthetic reference.
- Record remaining artifacts and physical/visual tradeoffs.

## Default Runtime Command

```bash
node artifacts/realtime-soap/realtime-soap.mjs --mode=benchmark --physics=256x512 --render=2048 --fpsTarget=24 --seconds=20 --cache=artifacts/realtime-soap/cache/gravity_fig14_like --outDir=artifacts/realtime-soap/runs/RT-latest
```

## Acceptance

- Average physics fps >= 24.
- p95 physics frame time <= 50 ms.
- No NaN or Inf in eta/Gamma/u.
- Parameter changes measurably affect diagnostics and visible fields.
- Disturbance changes local eta/Gamma/u and does not get immediately overwritten by cache.
- High-resolution output has no obvious pixel blocks, UV seam, or pole explosion.
