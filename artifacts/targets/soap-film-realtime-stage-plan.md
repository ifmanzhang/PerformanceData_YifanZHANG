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

## RT-M4 Progress

- Multi-frame cache support:
  - `cache-builder.mjs` now supports `--frames` and `--frameDt`.
  - Multi-frame caches are stored as physical field sequences under `frames/frame0000/...`, not image textures.
  - Generated local cache:
    - `artifacts/realtime-soap/cache/gravity_fig14_like_temporal32_soft`
    - Command:
      - `node artifacts/realtime-soap/cache-builder.mjs --source=artifacts/realtime-soap/baseline/huang-official-highres512/frame0499.exr --outDir=artifacts/realtime-soap/cache/gravity_fig14_like_temporal32_soft --frames=32 --frameDt=0.006`
    - Size: about `406 MB`, intentionally not committed.
  - Failed/too-aggressive cache:
    - `gravity_fig14_like_temporal32` with `frameDt=1/24` caused visible blocky advected cache artifacts and should not be used as default.
- Runtime support:
  - `realtime-soap.mjs` now detects `manifest.frames`, pre-samples each frame onto the realtime grid, and time-interpolates cache fields during physics and rendering.
  - `cacheFrameCount` is written into `performance.json` and `diagnostics.json`.
- Parameter scan:
  - Added `artifacts/realtime-soap/parameter-scan.mjs`.
  - Scan output:
    - `artifacts/realtime-soap/runs/RT-scan-temporal32-soft-v1`
  - All six scan cases reached `>=24fps`.
  - Best current display case:
    - `high-cache-stable`
    - Average physics fps: `32.98`
    - p95 physics frame time: `36.80 ms`
    - Cache frame count: `32`
    - Latest preview copied to `artifacts/targets/latest-realtime-soap-beauty.png`.
  - Current judgment:
    - Multi-frame cache is useful for animation and recovery continuity, but only with small precomputed time steps.
    - For a single still image, the stable temporal cache is close to v6 but not necessarily better.
    - Next visual improvement should focus on better spectral/Fresnel rendering, not more aggressive cache advection.

## RT-M4 Visual Clarity / Anti-Aliasing Patch

- Problem observed:
  - The latest preview was `2048 x 2048`, but clarity was still insufficient and stair-step aliasing was visible.
  - Root causes:
    - The sphere renderer used one point sample per output pixel.
    - The sphere silhouette was a hard binary coverage test.
    - High-contrast thin-film bands and cache-derived front lines were sampled without subpixel averaging.
    - Realtime physics is `256 x 512` and the cache is `512 x 1024`, so high-resolution output needs a better render sampling layer.
- Fix:
  - Added `--renderSamples=N` to `realtime-soap.mjs`.
  - Default is now `4`, implemented as a 2x2 supersampling grid per final output pixel.
  - Rendering now shades subpixel positions and averages in linear color before gamma encoding.
  - `performance.json` records `renderSamples` so high-quality still render time is separated from realtime physics fps.
- Validation plan:
  - Run `2048 x 2048` with `renderSamples=4`.
  - Run a sharper inspection still at `4096 x 4096` with `renderSamples=4` if runtime is reasonable.
  - Copy the best beauty render to `artifacts/targets/latest-realtime-soap-beauty.png`.
- Validation results:
  - `artifacts/realtime-soap/runs/RT-aa-2048-s4-v1`
    - Physics: `256 x 512`
    - Render: `2048 x 2048`
    - Render samples: `4`
    - Simulated seconds: `5`
    - Average physics fps: `30.26`
    - p95 physics frame time: `40.79 ms`
    - Final PNG render time: `8791.6 ms`
  - `artifacts/realtime-soap/runs/RT-aa-4096-s4-v1`
    - Physics: `256 x 512`
    - Render: `4096 x 4096`
    - Render samples: `4`
    - Simulated seconds: `5`
    - Average physics fps: `30.11`
    - p95 physics frame time: `40.47 ms`
    - Final PNG render time: `33318.9 ms`
    - Copied to `artifacts/targets/latest-realtime-soap-beauty.png`.
- Remaining clarity boundary:
  - SSAA reduces raster stair-stepping and hard sphere-edge aliasing.
  - It does not invent missing physical detail beyond the realtime field/cache resolution.
  - Further improvement requires either higher physics/cache resolution, bicubic/edge-aware field reconstruction, or a GPU renderer with temporal antialiasing for interactive display.

## RT-M4 Second Clarity Patch / Bicubic Reconstruction

- Problem observed after SSAA:
  - Sphere edge aliasing improved, but internal bands still looked both blurry and stair-stepped.
  - Root cause: final render still linearly upsampled `256 x 512` live physics and `512 x 1024` cache fields into a `2048/4096` image.
- Fix:
  - Added `--renderReconstruction=bicubic`, implemented as clamped Catmull-Rom bicubic reconstruction for final render sampling.
  - Added `--renderSharpen`, a light post-render unsharp pass for PNG stills.
  - Added `--renderDetailBoost`, a physical front/compression-derived detail lift. It uses `front` computed from `eta/Gamma/u/div`, not a texture or reference image.
- Validation runs:
  - `artifacts/realtime-soap/runs/RT-recon-bicubic-2048-s4-v1`
    - Physics: `256 x 512`
    - Render: `2048 x 2048`
    - Reconstruction: `bicubic`
    - Render samples: `4`
    - Render sharpen: `0.16`
    - Average physics fps: `32.82`
    - Final PNG render time: `16159.9 ms`
    - Result: still realtime at physics level, cleaner sampling, but source-field blur remains visible.
  - `artifacts/realtime-soap/runs/RT-recon-bicubic-384x768-2048-s4-v1`
    - Physics: `384 x 768`
    - Render: `2048 x 2048`
    - Reconstruction: `bicubic`
    - Render samples: `4`
    - Render sharpen: `0.22`
    - Average physics fps: `13.64`
    - Final PNG render time: `16751.7 ms`
    - Result: noticeably more internal structure, but CPU physics no longer realtime.
  - `artifacts/realtime-soap/runs/RT-recon-bicubic-384x768-4096-s4-detail-v1`
    - Physics: `384 x 768`
    - Render: `4096 x 4096`
    - Reconstruction: `bicubic`
    - Render samples: `4`
    - Render sharpen: `0.22`
    - Render detail boost: `0.14`
    - Average physics fps: `13.55`
    - Final PNG render time: `69715.1 ms`
    - Copied to `artifacts/targets/latest-realtime-soap-beauty.png`.
- Current conclusion:
  - The remaining blur is not primarily output resolution; it is source physical-field resolution and cache detail.
  - CPU can keep `256 x 512` realtime, but `384 x 768` is the first visibly better clarity tier and only reaches about `13.5fps`.
  - To get both clarity and realtime, next implementation step should be GPU/WebGL/WebGPU for `384 x 768` or higher physics, plus temporal antialiasing in the viewer.

## RT-M4 Source-Resolution Reality Check / Cache-Only Spectral Still

- User feedback:
  - Even the bicubic/4096 render still looks fake because the source field is too low resolution.
- Audit result:
  - Highest available physical source in `artifacts/realtime-soap/baseline/huang-official-highres512/frame0499.exr` is `1024 x 512`.
  - The realtime physical layer is lower (`256 x 512` or `384 x 768`) and therefore cannot generate true `4096` physical detail.
  - The cache contains truly sourced `eta`; `Gamma`, velocity, `front`, and foam are derived from that single source field, so dense Fig.14-like flow/microstructure cannot appear honestly from this cache alone.
- Fix implemented:
  - Added `--renderSource=cache` so highest-quality stills can bypass the low-resolution realtime residual layer.
  - Added `--renderOptics=spectral`, a thin-film spectral renderer based on optical thickness instead of the earlier visual palette.
  - Added physical optics controls:
    - `--renderEtaScale`
    - `--renderExposure`
    - `--renderSaturation`
- Validation:
  - `artifacts/realtime-soap/runs/RT-cache-spectral-4096-s4-v1`
    - Render: `4096 x 4096`
    - Source: cache-only
    - Optics: spectral
    - Result: more physically plausible, less plastic/fake, but too pale.
  - `artifacts/realtime-soap/runs/RT-cache-spectral-2048-s4-v2-eta3600`
    - Render: `2048 x 2048`
    - `renderEtaScale=3600`, `renderExposure=1.08`, `renderSaturation=1.55`
    - Result: stronger interference color and better edge credibility.
  - `artifacts/realtime-soap/runs/RT-cache-spectral-4096-s4-v2-eta3600`
    - Render: `4096 x 4096`
    - Average physics fps: `29.60`
    - Final PNG render time: `153874.3 ms`
    - Copied to `artifacts/targets/latest-realtime-soap-beauty.png`.
- Current hard conclusion:
  - This is the most honest still path from current data, but it cannot reach reference/Fig.14 richness because the available physical cache is only `1024 x 512` and incomplete.
  - Further visual improvement must come from a new higher-resolution physical cache with at least `eta/Gamma/u/front` at native high resolution, or by running a proper high-resolution offline solver. More upsampling/sharpening would only make a sharper fake.

## RT-M4 Transparency / Alpha Channel Patch

- Problem observed:
  - Previous beauty PNGs had `alpha=255` everywhere, so the bubble was technically opaque even when the colors looked film-like.
- Fix:
  - Added true PNG alpha output.
  - New parameters:
    - `renderTransparent`: enables alpha output when `1`.
    - `renderBaseAlpha`: base film opacity.
    - `renderRimAlpha`: view-angle/rim opacity contribution.
    - `renderFrontAlpha`: opacity contribution from front/foam physical fields.
  - Outside the sphere now writes `alpha=0`.
  - Sphere interior is semi-transparent; rim/front/foam can become more opaque.
- Validation:
  - Run: `artifacts/realtime-soap/runs/RT-cache-spectral-alpha-2048-s4-v1`
  - Render: `2048 x 2048`
  - Source: cache-only spectral
  - Alpha settings:
    - `renderTransparent=1`
    - `renderBaseAlpha=0.30`
    - `renderRimAlpha=0.58`
    - `renderFrontAlpha=0.24`
  - PNG alpha audit:
    - `alpha_min=0`
    - `alpha_max=255`
    - `alpha_mean=101.30`
    - transparent pixels: `898152`
    - semi-transparent pixels: `3293710`
    - opaque pixels: `2442`
  - Copied to `artifacts/targets/latest-realtime-soap-alpha.png`.

## RT-M4 White Rim Artifact Removal

- User comparison:
  - The earlier baseline image `artifacts/realtime-soap/baseline/huang-official-highres512/frame0499-thinfilm-sphere.png` does not show the broad white rim.
  - The first transparent alpha render did show a broad white line.
- Cause:
  - The broad white line was a render-layer artifact, not a Huang/physical result.
  - It came from the newer alpha/spectral render path: broad `edgeGlow`, high `renderRimAlpha`, and over-amplified cache `front`/foam contribution.
  - The baseline image did not have that artifact because it was an older opaque/composited thin-film sphere render without the new rim/alpha/front opacity layer.
- Fix:
  - Added `numberArg()` so explicit zero values such as `--renderEdgeGlow=0` are honored instead of falling back to defaults.
  - Added `renderEdgeGlow`, `renderEdgePower`, and `renderRimPower`.
  - Reduced default `renderRimAlpha` and `renderFrontAlpha`.
  - Reduced cache-only `front` and foam amplification.
  - Added a no-white-rim transparent preset:
    - `renderEdgeGlow=0`
    - `renderRimAlpha=0.10`
    - `renderRimPower=5.8`
    - `renderFrontAlpha=0.06`
- Validation runs:
  - `artifacts/realtime-soap/runs/RT-cache-spectral-alpha-no-white-rim-2048-s4-v1`
    - Render: `2048 x 2048`
    - Source: cache-only spectral
    - Render samples: `4`
    - Final PNG render time: `42465.5 ms`
    - Alpha audit: `alpha_min=0`, `alpha_max=130`, `alpha_mean=63.18`, `opaque_pixels=0`.
    - Result: broad white rim mostly removed, but spectral mode still leaves pale bright regions from the optical color response.
  - `artifacts/realtime-soap/runs/RT-cache-palette-alpha-no-white-rim-2048-s4-v1`
    - Render: `2048 x 2048`
    - Source: cache-only palette optics
    - Render samples: `4`
    - Final PNG render time: `16951.0 ms`
    - Alpha audit: `alpha_min=0`, `alpha_max=117`, `alpha_mean=66.02`, `transparent_pixels=898152`, `semi_pixels=3296152`, `opaque_pixels=0`.
    - Copied to `artifacts/targets/latest-realtime-soap-alpha.png`.
    - Result: no broad white rim; remaining edge is a narrow transparent film edge rather than a fake opaque white stripe.
- Current conclusion:
  - The white wide line should not be treated as physical evidence or desired output.
  - For transparent preview, use the palette no-white-rim preset until a higher-quality physical cache and spectral opacity model are available.

## RT-M4 Lighting / Transparent Volume Patch

- Problem observed:
  - After removing the fake white rim, the bubble looked too flat.
  - Cause: the transparent preview was mostly thin-film color plus alpha. It had no explicit environment lighting, directional transmission, compact specular highlight, or Fresnel reflection.
- Fix:
  - Added a render-only lighting pass derived from sphere normal, view direction, and physical front/foam fields.
  - New controls:
    - `renderLighting`
    - `renderAmbient`
    - `renderDiffuse`
    - `renderTransmission`
    - `renderSpecular`
    - `renderSpecularPower`
    - `renderFresnelReflect`
    - `renderLightX/renderLightY/renderLightZ`
  - The lighting pass does not sample reference images or paint new color regions. Thin-film color still comes from optical thickness / palette phase and physical fields.
  - The previous white-rim fix remains active via `renderEdgeGlow=0`, low `renderRimAlpha`, and high `renderRimPower`.
- Validation runs:
  - `artifacts/realtime-soap/runs/RT-cache-palette-alpha-lit-2048-s4-v1`
    - Render: `2048 x 2048`
    - Average physics fps: `30.83`
    - Final PNG render time: `20537.7 ms`
    - Result: lighting was present but too subtle.
  - `artifacts/realtime-soap/runs/RT-cache-palette-alpha-lit-contrast-2048-s4-v1`
    - Render: `2048 x 2048`
    - Average physics fps: `29.48`
    - Final PNG render time: `20611.4 ms`
    - Copied to `artifacts/targets/latest-realtime-soap-alpha.png`.
    - Result: visible upper-left highlight and clearer sphere lighting gradient without reintroducing the broad fake white rim.
  - Current boundary:
    - This is a transparent preview lighting layer, not a full ray-traced environment/refraction solution.
    - A production viewer should later use an HDR environment map or analytic multi-light environment and premultiplied alpha compositing, while preserving this no-wide-rim constraint.

## RT-M4 Environment-Composite Lighting Clarification

- User feedback:
  - The first lighting pass looked nearly identical and did not read as real light.
- Technical cause:
  - The first lighting pass was only a weak normal-derived shading term.
  - In transparent PNG preview over a black/default viewer background, transmission/refraction cannot be judged.
  - The first composite incorrectly let alpha attenuate surface reflection too much, so specular highlights were mostly swallowed.
- Fix:
  - Added analytic environment color for preview: dark lower environment, brighter upper hemisphere, horizon band, and softbox contribution.
  - Added `renderCompositeBackground=1` preview mode. It composites the semi-transparent film over the analytic environment so transmission and reflection are visible.
  - Added independent surface reflection in composite preview so compact specular/Fresnel reflection is not multiplied away by film transparency.
  - Added controls:
    - `renderCompositeBackground`
    - `renderEnvironmentStrength`
    - `renderSoftbox`
    - `renderSoftboxPower`
    - `renderBacklight`
- Validation:
  - `artifacts/realtime-soap/runs/RT-cache-palette-alpha-envlit-composite-1024-s4-glint-v1`
    - Result: light became visible, but highlight was too broad.
  - `artifacts/realtime-soap/runs/RT-cache-palette-alpha-envlit-composite-1024-s4-balanced-v1`
    - Result: narrower, more controlled environment reflection.
  - `artifacts/realtime-soap/runs/RT-cache-palette-alpha-envlit-composite-2048-s4-balanced-v1`
    - Render: `2048 x 2048`
    - Average physics fps: `29.93`
    - Final PNG render time: `33683.9 ms`
    - Copied to:
      - `artifacts/targets/latest-realtime-soap-lit-preview.png`
      - `artifacts/targets/latest-realtime-soap-alpha.png`
- Honesty boundary:
  - This is not a full physically exact path tracer.
  - It is an analytic real-time lighting approximation: environment transmission, compact specular, Fresnel reflection, and hemisphere lighting on top of physical film color.
  - True production lighting should eventually happen in the interactive viewer with premultiplied alpha, HDR/environment lighting, and optional refraction/background distortion.

## RT-M4 Soap-Like Reflection / Refraction Patch

- User feedback:
  - The environment-composite version still looked fake because it mostly read as a brightness lift, not a soap-bubble surface.
- Technical cause:
  - Environment reflection was still mostly mixed into the film color layer and then attenuated by transparency.
  - The independent reflection term was mainly a white specular lobe, not a reflected environment.
  - The film surface normal was a perfect sphere, so the environment reflection did not respond to membrane structure.
- Fix:
  - Added analytic studio environment features in `environmentColor()`:
    - softbox panel
    - vertical side strip
    - top strip
    - horizon band
    - dark flag band
  - Added membrane-gradient normal perturbation:
    - `renderBumpStrength`
    - normal is perturbed from local `eta` gradients sampled from the current render source.
  - Added analytic refraction/distortion for composite preview:
    - `renderRefraction`
    - composite background direction is shifted by perturbed normal.
  - Reworked `surfaceReflectionAdd()`:
    - independent surface reflection now samples analytic environment with Fresnel weighting.
    - reflection is no longer just a white lobe.
    - reflection is not multiplied away by transparent film alpha in composite preview.
- Validation:
  - `artifacts/realtime-soap/runs/RT-cache-palette-soaplike-env-1024-s4-v1`
    - Result: subtle bump/refraction, still too flat.
  - `artifacts/realtime-soap/runs/RT-cache-palette-soaplike-env-1024-s4-v2`
    - Result: stronger transparency and environment response, still muted.
  - `artifacts/realtime-soap/runs/RT-cache-palette-soaplike-env-1024-s4-v3`
    - Result: clearer shell/edge reflection, acceptable for full render.
  - `artifacts/realtime-soap/runs/RT-cache-palette-soaplike-env-2048-s4-v3`
    - Render: `2048 x 2048`
    - Average physics fps: `30.73`
    - Final PNG render time: `64540.9 ms`
    - Copied to:
      - `artifacts/targets/latest-realtime-soap-lit-preview.png`
      - `artifacts/targets/latest-realtime-soap-alpha.png`
- Current boundary:
  - This is the first version that is closer to soap-bubble lighting instead of plain brightening.
  - It is still analytic realtime lighting, not full multi-bounce optical simulation.
  - The color looks more muted because actual reflected environment competes with thin-film color; recovering stronger color should be done by adjusting physical/optical balance, not by painting fake light.
