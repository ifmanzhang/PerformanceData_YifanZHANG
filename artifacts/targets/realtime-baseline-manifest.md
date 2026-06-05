# Realtime Soap Film Baseline Manifest

## Commit Name

`REALTIME_SOAP_FILM_BASELINE`

## Purpose

This baseline is created before starting the realtime hybrid solver work. It preserves the current Huang-clean implementation state, the current planning documents, and the key official high-resolution Huang output used as the first realtime cache source.

## Included

- Tracked Huang-clean solver and planning edits:
  - `artifacts/huang-clean/huang-clean-sim.mjs`
  - `artifacts/targets/soap-film-current-stage-plan.md`
  - `artifacts/targets/soap-film-final-goal.md`
  - `artifacts/targets/soap-film-iterations.md`
  - `artifacts/targets/soap-film-milestones.md`
  - `artifacts/targets/soap-film-physics-handoff.md`
  - `artifacts/targets/soap-film-target.md`
- Tracked MVP realtime/visual code edits:
  - `mvp/src/config/controlSchema.js`
  - `mvp/src/main.js`
  - `mvp/src/visual/logoScene.js`
  - `mvp/src/visual/thinFilmSim.js`
- New Huang spherical frontend core:
  - `mvp/src/visual/huangSphericalCore.js`
- Supplemental BiMocq2 audit note:
  - `artifacts/targets/soap-film-bimocq2-qu-2019-fulltext-notes.md`
- Huang official high-resolution run reference:
  - `artifacts/realtime-soap/baseline/huang-official-highres512/config-highres512.txt`
  - `artifacts/realtime-soap/baseline/huang-official-highres512/huang-official-highres512-run.log`
  - `artifacts/realtime-soap/baseline/huang-official-highres512/frame0499.exr`
  - `artifacts/realtime-soap/baseline/huang-official-highres512/frame0499-thickness.png`
  - `artifacts/realtime-soap/baseline/huang-official-highres512/frame0499-thinfilm-map.png`
  - `artifacts/realtime-soap/baseline/huang-official-highres512/frame0499-thinfilm-sphere.png`

## Excluded

- Full `artifacts/references/SoapBubble/` source/build tree except the selected config, final EXR, log, and rendered images listed above.
- Full `artifacts/references/AMGX/` source/build tree.
- Full 500-frame `huang-official-highres512/frame0000..frame0498.exr` sequence.
- Chrome profiles and browser caches under `artifacts/logs/`.
- Historical screenshot sweeps under `artifacts/soap-film-runs/` and `artifacts/targets/run-*`.
- Bulk diagnostic run directories under `artifacts/huang-clean/runs/`, except references already summarized in target documents.
- Large external PDFs and raw third-party source trees unless separately needed in a later documented commit.

## Notes

- The official high-resolution Huang run was `512 x 1024`, 500 frames, and completed successfully.
- The selected `frame0499.exr` is a physical field output used as the first cache seed for the realtime hybrid solver.
- The rendered sphere image is a visual inspection artifact derived from the physical EXR thickness field, not a texture source for the realtime solver.
