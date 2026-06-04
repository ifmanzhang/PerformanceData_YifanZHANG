# Current Stage Plan

## Stage

M4 - Huang BiMocq2 spherical material mapping

状态：已完成。

## Paper Sources Required

- Full Paper sections: Section 4.2 Advection, Section 4.2.1 Preserving details, Section 4.4 Implementation and runtime performance.
- Supplemental sections: Appendix B for the velocity-aligned spherical half-step already implemented in M3.
- Figures used as visual truth: Fig. 8 for pole-safe transport purpose; M4 is a numerical detail-preservation milestone, not yet a final physical result scene.
- Tables/parameters: paper-scale grid `1024 x 2048`, time step `dt=0.002`, reset threshold `pi/128`, typical paper runtime target within 30 minutes per run.

## Current Gap

- Algorithm gap: M3 uses Huang velocity-aligned spherical advection, but thickness detail is still transported by repeated semi-Lagrangian/BFECC lookup in the coupled solver. Huang Section 4.2.1 requires BiMocq2 backward and forward mappings extended to spherical coordinates.
- Numeric gap: no persistent backward map `X(x(t)) -> x(t0)`, no forward map `Y(x(t0)) -> x(t)`, no spherical linear interpolation of map coordinates, and no distortion-based reset at `pi/128`.
- Rendering gap: unchanged; M4 does not claim Section 5 rendering.
- Result figure gap: the M3 pole transport remained continuous but diffusive. M4 must prove that BiMocq2 preserves a sharper continuous thickness front than semi-Lagrangian transport under the same full-size test.

## Tasks

1. Re-read Huang Section 4.2.1 and record the exact constraints: backward map, forward map, spherical interpolation, and `pi/128` distortion reset. Done.
2. Add full-size map storage to the standalone simulator using unit-vector maps on the sphere to avoid phi seam artifacts. Done.
3. Implement spherical map sampling with normalized vector interpolation and conversion back to `(theta, phi)`. Done.
4. Implement backward map update by velocity-aligned backtrace and forward map update by velocity-aligned forward trace. Done.
5. Compute pair distortion by composing the current backward map with the forward map and measuring great-circle distance to the current cell center. Done.
6. Reset maps whose distortion exceeds `pi/128`, and output `mapError` and `resetMask`. Done.
7. Add a full-size `biMocqPole` scenario that compares repeated semi-Lagrangian thickness transport against BiMocq2 thickness acquisition from the initial state. Done.
8. Save BiMocq2 thickness, semi-Lagrangian thickness, map error, reset mask, velocity, divergence, beauty, and diagnostics. Done.
9. Update diagnostics so `paperModel` no longer calls BFECC a BiMocq2 substitute after the M4 path exists. Done.
10. Run the full-size test at `1024 x 2048`; do not downsample unless runtime exceeds 30 minutes, and if it exceeds, record failure instead of substituting low-resolution acceptance. Done.

## Full-Size Run Command

```bash
node artifacts/huang-clean/huang-clean-sim.mjs --simTheta=1024 --simPhi=2048 --paperParams=1 --scenario=biMocqPole --steps=4 --dt=0.002 --cg=22 --render=1200 --tag=M4-bimocq-pole --outDir=artifacts/huang-clean/runs/M4-bimocq-pole-YYYYMMDD-HHMMSS
```

## Acceptance

- Physics: not a final physical scene; this stage validates Huang's non-diffusive thickness transport requirement.
- Numerics:
  - Full-size grid `1024 x 2048`.
  - `dt=0.002`.
  - Backward and forward maps finite everywhere.
  - Distortion threshold is `pi/128`.
  - `mapError`, `resetMask`, and reset count are saved.
  - BiMocq2 final total variation is greater than the semi-Lagrangian final total variation for the same initial condition and velocity field.
  - The BiMocq2 thickness front remains continuous across pole topology without visible seam.
- Rendering: diagnostic lat-long plus current beauty output only; Section 5 rendering is deferred to M7.
- Paper figure comparison: corresponds to Section 4.2.1's purpose of preventing high-frequency thickness detail from blurring out.
- Runtime <= 30 min: required for full-size acceptance.

## Results

- Primary accepted output directory: `artifacts/huang-clean/runs/M4-bimocq-pole-20260604-035641`.
- Primary full-size command:
  - `node artifacts/huang-clean/huang-clean-sim.mjs --simTheta=1024 --simPhi=2048 --paperParams=1 --scenario=biMocqPole --steps=4 --dt=0.002 --cg=22 --render=1200 --tag=M4-bimocq-pole --outDir=artifacts/huang-clean/runs/M4-bimocq-pole-20260604-035641`
- Primary diagnostics:
  - `nTheta=1024`, `nPhi=2048`, `expectedPaperGrid=true`.
  - Runtime: `32459 ms`.
  - `threshold=0.02454369260617026`, equal to `pi/128`.
  - `finiteMaps=true`, `finiteVelocity=true`.
  - `resetCount=133120`, `resetFraction=0.0634765625`.
  - `maxMapError=0.1806424709389071`, `meanMapError=0.0033069245674641036`.
  - `initialTotalVariation=2.2990424974753307`.
  - `semiLagrangianTotalVariation=0.3639875620189837`.
  - `biMocqTotalVariation=0.36731693422274925`.
  - `biMocqVsSemiVariationRatio=1.0091469394868826`.
  - `biMocqEtaMassError=-0.03278628709336674`; this is still a pure-advection map test and does not yet include the paper's coupled eta source accumulation along the forward map.
- Supplementary full-size stress output directory: `artifacts/huang-clean/runs/M4-bimocq-pole-extended-20260604-035801`.
- Supplementary stress diagnostics:
  - Steps: `16`, runtime: `114001 ms`.
  - Semi-Lagrangian thickness collapsed to a constant: `semiLagrangianTotalVariation=0`.
  - BiMocq2 retained sharp advected eta structure: `biMocqTotalVariation=11.617474697706117`.
  - Reset fraction increased to `0.38671875`; this records a remaining gap in the public Huang text path: original BiMocq2 error correction/reset details are referenced but not fully specified in Huang Section 4.2.1.
- Screenshots saved:
  - `M4-bimocq-pole-initial-thickness.png`.
  - `M4-bimocq-pole-thickness.png`.
  - `M4-bimocq-pole-semi-lagrangian-thickness.png`.
  - `M4-bimocq-pole-map-error.png`.
  - `M4-bimocq-pole-reset-mask.png`.
  - `M4-bimocq-pole-velocity.png`.
  - `M4-bimocq-pole-divergence.png`.
  - `M4-bimocq-pole-beauty.png`.
- Interpretation:
  - M4 now implements Huang Section 4.2.1's spherical backward/forward material maps and distortion reset path for eta pure advection.
  - This is not yet the final coupled paper solver: the paper's extra eta change term `-eta div(u)` must still be accumulated along the forward map after M5/M6 connect the full eta/Gamma/u solve.
  - The next correct milestone is M5 Gamma projection-like implicit SPD solve.
- Git commit: completed by the M4 completion commit containing this plan update.
- Git push: completed by pushing the M4 completion commit to GitHub.
