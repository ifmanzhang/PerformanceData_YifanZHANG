# Current Stage Plan

## Stage

M2 - 论文级 staggered spherical grid

状态：已完成。

## Paper Sources Required

- Full Paper sections: Section 4.1 Spatial discretization, Section 4.4 Implementation and runtime performance.
- Supplemental sections: spherical-coordinate definitions, surface differential operators, boundary/pole handling assumptions.
- Figures used as visual truth: Fig. 8 for pole transport motivation; later M3/M4 will reproduce its advection behavior.
- Tables/parameters: Table 1 and Table 2; M2 locks default grid to paper typical `1024 x 2048`, `dt=0.002`, paper dimensionless parameters.

## Current Gap

- Algorithm gap: M2 only fixes grid/state layout foundation. It does not yet implement Huang BiMocq2, strict Eq. 24-26 Gamma solve, or Section 5 rendering.
- Numeric gap: full-size grid diagnostics pass, but dynamic advection/projection diagnostics remain M3-M5 work.
- Rendering gap: rendering remains legacy diagnostic output; M2 does not claim Section 5 rendering compliance.
- Result figure gap: M2 is not expected to reproduce Fig. 14-17 yet; it only establishes the paper grid required by later stages.

## Tasks

1. Change default simulator grid to `simTheta=1024`, `simPhi=2048`. Done.
2. Keep `eta/Gamma` at cell centers and make `uThetaFace/uPhiFace` the primary velocity storage. Done for M2 foundation.
3. Remove the face-velocity overwrite path that rebuilt faces from center velocity after the Gamma update. Done.
4. Add full-size grid diagnostics: paper grid flag, aspect ratio, area integral error, zero-face divergence, constant-field Laplacian, pole sign behavior. Done.
5. Run the full-size paper-grid diagnostic with paper parameters and no low-resolution substitute. Done.
6. Save outputs under `artifacts/huang-clean/runs/M2-paper-grid-*`. Done.
7. Update milestones, commit, and push when the run passes M2 acceptance. Done after this stage commit.

## Full-Size Run Command

```bash
node artifacts/huang-clean/huang-clean-sim.mjs --simTheta=1024 --simPhi=2048 --paperParams=1 --steps=0 --dt=0.002 --cg=22 --render=1200 --tag=M2-paper-grid --outDir=artifacts/huang-clean/runs/M2-paper-grid-20260604-013546
```

## Acceptance

- Physics: state layout matches Huang's cell-centered scalar fields plus staggered face velocity storage.
- Numerics: area-weighted sphere integral is close to `4*pi`; zero face velocity gives zero divergence; constant scalar field Laplacian is zero; pole crossing diagnostic is finite and recorded.
- Rendering: only diagnostic rendering is required for M2.
- Paper figure comparison: no Fig. 14-17 claim yet; M2 only validates the grid foundation required by those scenes.
- Runtime <= 30 min: full-size diagnostic completed in about `6.2s`.

## Results

- Output directory: `artifacts/huang-clean/runs/M2-paper-grid-20260604-013546`.
- Diagnostics:
  - `nTheta=1024`, `nPhi=2048`.
  - `expectedPaperGrid=true`.
  - `aspectPhiOverTheta=2`.
  - `areaRelativeError=3.9218205314127053e-7`.
  - `maxZeroDivergence=0`.
  - `maxConstantLaplacian=0`.
  - `poleVectorSignError=0`.
  - `staggeredVelocityPrimary=true`.
  - `massError=2.9262856987916405e-10`.
  - `gammaMassError=3.805447833550517e-10`.
- Screenshots:
  - `M2-paper-grid-beauty.png`.
  - `M2-paper-grid-thickness.png`.
  - `M2-paper-grid-surfactant.png`.
  - `M2-paper-grid-velocity.png`.
  - `M2-paper-grid-divergence.png`.
  - `M2-paper-grid-foam.png`.
- Git commit: pending.
- Git push: pending.
