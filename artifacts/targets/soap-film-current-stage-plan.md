# Current Stage Plan

## Stage

M5 - Gamma projection-like implicit SPD solve

状态：已完成。

## Paper Sources Required

- Full Paper sections: Section 4.3 Time integration and chemomechanical forces, Eq. 24-26, Section 4.4 runtime notes.
- Supplemental sections: Appendix C / linear-system derivation where available in the converted text, plus the Full Paper reference to sparse SPD construction.
- Figures used as visual truth: not a final visual result stage; M5 is a numerical solver milestone supporting Fig. 14-17 later.
- Tables/parameters: paper-scale grid `1024 x 2048`, `dt=0.002`, typical paper discussion of CG iterations, and paper parameter mode enabled.

## Current Gap

- Algorithm gap: M5 now expresses the Huang Eq. 24-26 structure in matrix-free form:
  - `base = (eta* u* + Cr dt u_air + dt eta* g)/(eta* + Cr dt)`;
  - `beta = M dt/(eta* + Cr dt)`;
  - `A(Gamma)=Gamma-dt*div_s(GammaStar*beta*grad_s(Gamma))`;
  - `rhs=GammaStar-dt*GammaStar*div_s(base)`;
  - `u = base - beta grad_s(Gamma)`;
  - `eta = eta* - dt eta* div_s(u)`.
- Numeric gap remaining: this is a CPU/JS matrix-free reference path. The raw L2 residual samples are not strictly monotone at every CG step, but the full 22-iteration run reduces residual by roughly 1600x and the operator symmetry test is near machine precision for this implementation.
- Rendering gap: unchanged; M5 does not claim Huang Section 5 rendering.
- Result figure gap: M5 supports later Fig. 14-17 reproduction but does not claim visual scene parity.

## Tasks

1. Done - Re-read Huang Section 4.3 and Eq. 24-26 before editing code.
2. Done - Add an explicit matrix-free Eq. 26 operator using area-weighted inner products.
3. Done - Separate scratch face arrays used by the operator from persistent physical face velocities.
4. Done - Build RHS in the equivalent Eq. 26 form multiplied by `Gamma* dt`; documented in diagnostics and solver report.
5. Done - Store `gammaRhs`, residual history, CG iteration count, final relative residual, and operator symmetry diagnostics.
6. Done - Update face velocity strictly from Eq. 24a using solved Gamma.
7. Done - Add `gammaProjection` scenario with paper-scale surfactant perturbation and no image reference tuning.
8. Done - Run a full-size `1024 x 2048` validation with `dt=0.002` and paper params.
9. Done - Save beauty, eta, Gamma, velocity, divergence, mapError, diagnostics, and textual solver report.
10. Done - Record remaining mismatch: viscosity/diffusion are not added to this M5 isolated solve; L2 residual history is globally decreasing but not pointwise monotone; full coupled behavior remains M6.

## Full-Size Run Command

```bash
node artifacts/huang-clean/huang-clean-sim.mjs --simTheta=1024 --simPhi=2048 --paperParams=1 --scenario=gammaProjection --steps=1 --dt=0.002 --cg=22 --render=1200 --tag=M5-gamma-projection --outDir=artifacts/huang-clean/runs/M5-gamma-projection-20260604-053501
```

## Acceptance

- Physics:
  - Passed: `Gamma` gradient produces velocity response in the `-grad_s(Gamma)` Marangoni direction.
  - Passed: no visual field feeds back into `eta/Gamma/u`.
- Numerics:
  - Passed: full-size grid `1024 x 2048`.
  - Passed with note: residual drops from `1.9658219054583247e-5` to `1.2249744356244108e-8`, reduction factor `1604.7860659690248`; raw L2 samples are not strictly monotone at every step.
  - Passed: final relative residual `6.23136018691791e-4`.
  - Passed: matrix-free operator relative asymmetry `6.925791170645115e-11` under area-weighted probes.
  - Passed: velocity finite everywhere, max speed `0.006997541389180135`.
  - Passed: `eta` update follows `eta = eta* - dt eta* div_s(u)` with mass correction disabled.
- Rendering: diagnostic output only; Huang Section 5 rendering remains deferred to M7.
- Paper figure comparison: this stage supports later Fig. 14-17 reproduction but does not claim visual scene parity.
- Runtime: passed, `2752 ms` under the 30 minute limit.

## Results

- Primary output directory: `artifacts/huang-clean/runs/M5-gamma-projection-20260604-053501`.
- Early-stop diagnostic run: `artifacts/huang-clean/runs/M5-gamma-projection-20260604-053131`; this run exposed that the previous absolute residual threshold stopped after one CG step and is not the primary M5 acceptance run.
- Diagnostics: `artifacts/huang-clean/runs/M5-gamma-projection-20260604-053501/M5-gamma-projection-diagnostics.json`.
- Solver report: `artifacts/huang-clean/runs/M5-gamma-projection-20260604-053501/M5-gamma-projection-solver-report.md`.
- Screenshots:
  - `M5-gamma-projection-beauty.png`
  - `M5-gamma-projection-thickness.png`
  - `M5-gamma-projection-surfactant.png`
  - `M5-gamma-projection-velocity.png`
  - `M5-gamma-projection-divergence.png`
  - `M5-gamma-projection-gamma-rhs.png`
  - `M5-gamma-projection-map-error.png`
  - `M5-gamma-projection-reset-mask.png`
- Git commit: pending this heartbeat.
- Git push: pending this heartbeat.

## Next Stage

M6 - eta/Gamma/u 全耦合论文场景。下一阶段要把 M2-M5 的网格、advection、BiMocq2 和 Gamma projection 组合成论文 Fig. 14、Fig. 15/16、Fig. 17 的三个真实场景；不得使用参考图调参或视觉补偿。
