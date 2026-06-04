# Current Stage Plan

## Stage

M3 - velocity-aligned spherical advection

状态：已完成。

## Paper Sources Required

- Full Paper sections: Section 4.1 Spatial discretization, Section 4.2 Advection.
- Supplemental sections: Appendix B, 2nd-order half-step update.
- Figures used as visual truth: Fig. 8, Fig. 9, Fig. 21.
- Tables/parameters: Table 1 and Table 2 for full-size grid and `dt=0.002`; M3 pole-advection test is a numerical transport test, not a physical result scene.

## Current Gap

- Algorithm gap: before M3, `advectPoint` used a single-step great-circle backtrace; vector advection used a local approximation instead of explicit geodesic frame transport.
- Numeric gap: no full-size pole-crossing test existed for the independent simulator.
- Rendering gap: unchanged; M3 does not claim Section 5 rendering.
- Result figure gap: Fig. 8-style pole transport is now represented by a full-size local test, but it is not yet BiMocq2 detail preservation.

## Tasks

1. Re-read Huang Section 4.2 and Appendix B. Done.
2. Replace single-step point tracing with the Appendix B-style half-step velocity-aligned great-circle update. Done.
3. Transport sampled vectors between spherical tangent frames using geodesic rotation rather than UV component copying. Done.
4. Add a full-size `poleAdvection` scenario with a sharp thickness band crossing the north pole. Done.
5. Save initial/final thickness, velocity, divergence, and diagnostics. Done.
6. Record the first failed test case where the initial scalar field collapsed to a constant after advection. Done.
7. Commit and push M3. Done after this stage commit.

## Full-Size Run Command

```bash
node artifacts/huang-clean/huang-clean-sim.mjs --simTheta=1024 --simPhi=2048 --paperParams=1 --scenario=poleAdvection --steps=4 --dt=0.002 --cg=22 --render=1200 --tag=M3-pole-advection --outDir=artifacts/huang-clean/runs/M3-pole-advection-20260604-014415
```

## Acceptance

- Physics: not a physical result scene; this is the paper's numerical transport category.
- Numerics:
  - Full-size grid `1024 x 2048`.
  - `dt=0.002`.
  - Four pole-crossing advection steps.
  - `finiteVelocity=true`.
  - `expectedPaperGrid=true`.
  - `poleVectorSignError=0`.
  - `eta` remains non-constant after crossing: final range `0.22..1.2`.
  - The final band is continuous in the saved thickness image.
- Rendering: diagnostic lat-long output only.
- Paper figure comparison: corresponds to Fig. 8's purpose: avoid pole artifacts during scalar/vector advection. It does not yet claim BiMocq2 detail quality.
- Runtime <= 30 min: full-size test completed in about `19.4s`.

## Results

- Failed first attempt: `artifacts/huang-clean/runs/M3-pole-advection-20260604-014246`.
  - Failure reason: initial field was a low north-pole cap plus high reservoir; after four backward lookups the scalar collapsed to a constant high value.
  - Diagnostic signal: `finalTotalVariation=0`.
- Accepted output directory: `artifacts/huang-clean/runs/M3-pole-advection-20260604-014415`.
- Diagnostics:
  - `nTheta=1024`, `nPhi=2048`.
  - `steps=4`, `dt=0.002`.
  - `scheme=Huang Section 4.2 velocity-aligned great-circle half-step`.
  - `finiteVelocity=true`.
  - `maxVectorSpeed=24`.
  - `initialTotalVariation=2.2990424974753307`.
  - `finalTotalVariation=0.3639875620189837`.
  - `totalVariationRatio=0.1583213717966035`.
  - `etaMassError=-0.03278011028445435`.
  - `eta` debug range: `0.2199999988079071..1.2000000476837158`.
- Interpretation:
  - Pole crossing is finite and visually continuous.
  - Semi-Lagrangian advection remains non-conservative and diffusive.
  - M4 BiMocq2 is therefore mandatory for paper-level detail preservation; M3 alone is insufficient for final visual quality.
- Screenshots:
  - `M3-pole-advection-initial-thickness.png`.
  - `M3-pole-advection-thickness.png`.
  - `M3-pole-advection-velocity.png`.
  - `M3-pole-advection-divergence.png`.
  - `M3-pole-advection-beauty.png`.
- Git commit: pending.
- Git push: pending.
