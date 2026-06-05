# Current Stage Plan

## Stage

M6 - eta/Gamma/u 全耦合论文场景

状态：进行中。

## Paper Sources Required

- Full Paper Section 3.3: gravity and air friction force definitions, including `g=(g sin theta, 0)^T` and `fair=(Cr/eta)(uair-u)`.
- Full Paper Section 4.2: velocity-aligned spherical advection.
- Full Paper Section 4.2.1: BiMocq2 spherical backward/forward maps; source accumulation for `-eta div(u)`.
- Full Paper Section 4.3: Gamma projection-like implicit solve, Eq. 24-26.
- Full Paper Section 6.2: Fig. 14 gravity and buoyancy: thick regions form downward tears, thin regions rise, drop-shaped islands and rivers.
- Full Paper Section 6.3: Fig. 15/16 air friction: rotating air induces shear, thin stripes, vortices/line-like velocity structures.
- Full Paper Section 6.4: Fig. 17 evaporation: subtract a small constant amount of eta each step; bands move downward; top becomes thin and gray.
- Supplemental: full governing equations and optional viscous term; viscosity remains diagnostic/deferred unless explicitly needed for Fig. 19.

## Current Gap

- Algorithm gap:
  - Existing general `step()` still advects `eta` with BFECC. M6 must use M4 BiMocq2 maps for eta detail preservation and accumulate the `-eta div(u)` source term in material coordinates.
  - Existing scenarios are generic (`referenceFlow`, `gravityDrainage`) and not paper-result scenarios. M6 must add `paperGravityBuoyancy`, `paperAirFriction`, and `paperEvaporationLife`.
  - Existing air field is a single fixed vector with a sinusoidal band. Fig. 15/16 needs a rotating/corridor-style tangential airflow field derived from a recorded analytic vector field, not from any image.
  - Existing evaporation is absent. Fig. 17 needs constant eta subtraction per simulation step.
- Numeric gap:
  - Need full-size `1024 x 2048` runs for all three scenes.
  - Need diagnostics for finite fields, eta/Gamma mass behavior, BiMocq map error/reset fraction, residuals, velocity/divergence statistics, and scene morphology proxies.
  - Stage-level low-resolution runs are allowed for algorithm diagnosis and performance profiling only; they cannot satisfy M6 acceptance.
  - M6 completion requires at least one full-resolution `1024 x 2048` acceptance run per claimed paper scene, with no hard runtime stop and exact elapsed time recorded.
- Rendering gap:
  - M6 uses current diagnostic beauty only. Huang Section 5 rendering remains M7; M6 beauty is not final optical parity.
- Result figure gap:
  - M6 must check physical structure against Fig. 14/15/16/17 descriptions, not against `soap-film-reference.jpg`.

## Tasks

1. Implement paper scene initial conditions:
   - `paperGravityBuoyancy`: random smooth thickness/Gamma perturbations under gravity, no active air corridor.
   - `paperAirFriction`: gravity-sagged/noisy thickness plus rotating/corridor tangential airflow.
   - `paperEvaporationLife`: Perlin/value-noise thickness, curl-like airflow, and per-step evaporation.
2. Implement `paperAirVelocity(theta, phi, step, time)` with:
   - zero or weak damping air for gravity;
   - rotating ball/corridor airflow for air friction;
   - curl-noise-like analytic airflow for evaporation.
3. Replace the generic coupled path with `stepCoupledPaper()` for M6 scenarios:
   - advect Gamma with velocity-aligned BFECC or paper-compatible scalar advection;
   - advect u with velocity-aligned vector transport;
   - update BiMocq backward/forward maps;
   - reconstruct eta from `eta0(backMap) + etaSource0(backMap)`;
   - solve Gamma with Eq. 24-26;
   - update u with Eq. 24a;
   - compute `etaSourceStep=-dt eta* div(u)` and accumulate it in material coordinates through the forward map;
   - apply optional evaporation only for `paperEvaporationLife`.
4. Add diagnostics:
   - `m6Scene`, `m6FigureTarget`;
   - `biMocqMapStats`, `etaSourceMass`, `evaporationLoss`, `topMeanEta`, `bottomMeanEta`;
   - morphology proxies for downward thick tears, upward thin regions, stripe anisotropy/velocity magnitude, and top fading trend.
5. Run full-size paper settings:
   - gravity scene;
   - air friction scene;
   - evaporation scene.
6. Save outputs under `artifacts/huang-clean/runs/M6-*`.
7. Update this plan and `soap-film-milestones.md` after runs.
8. Add M6 diagnostic output support:
   - quantile-scaled `q01-q99` debug PNGs for `eta/Gamma/div/source/mapError`;
   - optional gzip-compressed raw Float32 fields for offline analysis;
   - low-resolution validation only to verify diagnostic plumbing, not to satisfy acceptance.

## Full-Size Run Commands

```bash
node artifacts/huang-clean/huang-clean-sim.mjs --simTheta=1024 --simPhi=2048 --paperParams=1 --scenario=paperGravityBuoyancy --steps=96 --dt=0.002 --cg=22 --render=1200 --tag=M6-gravity-buoyancy --outDir=artifacts/huang-clean/runs/M6-gravity-buoyancy-YYYYMMDD-HHMMSS
node artifacts/huang-clean/huang-clean-sim.mjs --simTheta=1024 --simPhi=2048 --paperParams=1 --scenario=paperAirFriction --steps=96 --dt=0.002 --cg=22 --render=1200 --tag=M6-air-friction --outDir=artifacts/huang-clean/runs/M6-air-friction-YYYYMMDD-HHMMSS
node artifacts/huang-clean/huang-clean-sim.mjs --simTheta=1024 --simPhi=2048 --paperParams=1 --scenario=paperEvaporationLife --steps=96 --dt=0.002 --cg=22 --render=1200 --tag=M6-evaporation-life --outDir=artifacts/huang-clean/runs/M6-evaporation-life-YYYYMMDD-HHMMSS
node artifacts/huang-clean/huang-clean-sim.mjs --simTheta=1024 --simPhi=2048 --paperParams=1 --scenario=paperGravityBuoyancy --steps=260 --dt=0.002 --cg=16 --operatorAudit=0 --deriveEvery=0 --progressEvery=52 --render=1200 --tag=M6-gravity-buoyancy-paper-time --outDir=artifacts/huang-clean/runs/M6-gravity-buoyancy-paper-time-YYYYMMDD-HHMMSS
```

## Acceptance

- Physics:
  - Fig. 14 scene: bottom mean eta exceeds top mean eta; thick regions move downward; thin regions leave upward river-like paths.
  - Fig. 15/16 scene: tangential airflow produces shear stripes, vortices/line-like velocity structures, and finite post-excitation motion.
  - Fig. 17 scene: eta decreases by documented evaporation loss; top eta becomes thin relative to bottom; bands trend downward.
- Numerics:
  - Full-size grid `1024 x 2048`.
  - Stage diagnostics use `90 min` only as a soft reporting threshold; if a run exceeds it, the process must continue until natural completion and the true elapsed time must be recorded.
  - Any M6 completion claim must include at least one full-resolution run for the claimed scene. Full-resolution acceptance runs have no hard runtime limit.
  - Finite eta/Gamma/u everywhere.
  - Gamma projection residuals recorded.
  - BiMocq map error/reset fraction recorded.
  - Mass changes are explained by continuity and evaporation, not hidden by visual clamping.
- Rendering:
  - Diagnostic beauty/debug outputs saved; no Section 5 final rendering claim.
- Paper figure comparison:
  - For each scene, save a markdown comparison report against the corresponding Huang figure description.

## Results

- Output directories:
  - `artifacts/huang-clean/runs/M6-gravity-buoyancy-20260604-083830`
  - `artifacts/huang-clean/runs/M6-air-friction-20260604-085838`
  - `artifacts/huang-clean/runs/M6-evaporation-life-20260604-092212` (failed diagnostic: curl-like air field had a pole singularity)
  - `artifacts/huang-clean/runs/M6-evaporation-life-20260604-094207` (current smooth curl-like air field)
  - `artifacts/huang-clean/runs/M6-gravity-buoyancy-paper-time-20260604-101301` (timeout diagnostic only; no accepted images/diagnostics)
  - `artifacts/huang-clean/runs/M6-gravity-buoyancy-paper-time-derive-final-20260604-120950` (completed full-size paper-time gravity diagnostic)
  - `artifacts/huang-clean/runs/M6-lowres-diagnostic-quantile-raw-20260604-125450` (low-resolution diagnostic-output validation only; not an acceptance result)
  - `artifacts/huang-clean/runs/M6-lowres-pole-index-paper-time-20260604-134451` (low-resolution paper-time diagnostic; not an acceptance result)
  - `artifacts/huang-clean/runs/M6-gravity-buoyancy-paper-time-pole-index-20260604-134851` (full-size scalar pole-index diagnostic; improved topology reporting but still failed pole/source stability)
  - `artifacts/huang-clean/runs/M6-lowres-fixed-physical-pole-taper-20260604-143731` (low-resolution fixed physical pole-taper diagnostic; not an acceptance result)
  - `artifacts/huang-clean/runs/M6-gravity-buoyancy-paper-time-fixed-pole-taper-20260604-144105` (completed full-size fixed physical pole-taper gravity diagnostic)
  - `artifacts/huang-clean/runs/M6-lowres-front-scale-085-vdrop-055-20260604-175410` (low-resolution corrected vertical-gradient diagnostic; not an acceptance result)
  - `artifacts/huang-clean/runs/M6-gravity-buoyancy-front-scale-085-vdrop-055-full-20260604-175818` (full-size gravity diagnostic before Eq.24c source fix; exposed remaining source/material clamp)
  - `artifacts/huang-clean/runs/M6-lowres-eq24c-source-front-scale-085-vdrop-055-20260604-185147` (low-resolution Eq.24b/24c eta-source consistency diagnostic; not an acceptance result)
  - `artifacts/huang-clean/runs/M6-gravity-buoyancy-eq24c-source-front-scale-085-vdrop-055-full-20260604-185551` (completed full-size Eq.24c gravity diagnostic)
  - `artifacts/huang-clean/runs/M6-air-friction-eq24c-source-full-20260604-194706` (completed full-size Eq.24c air-friction diagnostic)
  - `artifacts/huang-clean/runs/M6-evaporation-life-eq24c-source-full-20260604-200835` (completed full-size Eq.24c evaporation/life diagnostic)
- Diagnostics:
  - Full-size `1024 x 2048`, `steps=96`, `dt=0.002`, `cg=22`, runtime `940019 ms`.
  - M6 Gamma transport was changed from BFECC to Huang Section 4.2 velocity-aligned semi-Lagrangian scalar advection; BiMocq2 remains the eta detail-preserving path.
  - `massError=0.000023016295284349155`, `gammaMassError=0.000020035299596959553`.
  - `gammaResidual=0.0034077703846653157 -> 0.001804271925996232`, relative final `0.5294581859491785`; this is not M5-quality convergence and is an unresolved coupled-solve gap.
  - `maxSpeed=0.2081464481594206`, `divVelocity` range `[-587.9779052734375, 587.9779052734375]`.
  - `sourceLimiterFraction=0.0002980232238769531`, `materialClampFraction=0.0005340576171875`; tiny but nonzero limiter/clamp use means M6 is not acceptable as a strict paper result yet.
  - Final `bottomMinusTopEta=0.10915708977274163` confirms gravity drainage trend, but the saved beauty/thickness output does not yet show Huang Fig.14 downward tears, upward thin rivers, or drop-shaped islands.
  - Full-size air-friction run: runtime `1010611 ms`, `massError=0.0001653048541512147`, `gammaMassError=0.00038736624011168525`, `gammaResidual=0.02557015284052881 -> 0.011590655737621221`, relative final `0.45328848090614376`.
  - Air-friction run: `meanSpeed=0.1455897284223577`, `etaStripeAnisotropyPhiOverTheta=4.885237863649857`, map reset fraction `0.00008869171142578125`, source limiter fraction `0.0036401748657226562`, material clamp fraction `0.0006618499755859375`.
  - Air-friction output has visible large-scale shear deformation, but not Huang Fig.15/Fig.16 fine shear stripes/vortices. Stronger local divergence `[-2576.939208984375, 2576.939208984375]` shows the coupled source/projection path is still too stiff for acceptance.
  - First evaporation run `20260604-092212` exposed a non-paper pole singularity in the analytic curl-like air field: `maxSpeed=8.159811240244737`, `divVelocity=[-67548.640625, 67548.640625]`, map reset fraction `0.0400390625`. This run is kept only as failure evidence.
  - The evaporation air field was corrected to a smooth world-space curl-like tangential field with no `1/sin(theta)` division.
  - Corrected evaporation run `20260604-094207`: runtime `999882 ms`, `massError=-0.027684686432813296`, `gammaMassError=0.00003114735505336549`, `gammaResidual=0.01773106436391771 -> 0.006119354333453366`, relative final `0.3451205301530632`.
  - Corrected evaporation run: `maxSpeed=0.45559880294618227`, `divVelocity=[-2636.654052734375, 2636.654052734375]`, map reset fraction `0.0000171661376953125`, source limiter fraction `0.0022034645080566406`, material clamp fraction `0.0013332366943359375`.
  - Corrected evaporation run shows expected mean thinning and top/bottom separation (`topMeanEta 0.5634421497457445 -> 0.5402984321810026`, `bottomMinusTopEta 0.10401783350370464 -> 0.1163163409582626`) but does not yet reproduce Huang Fig.17 fine bands/lifetime rendering.
  - A longer paper-time gravity attempt was run full-size with `steps=260`, `dt=0.002`, `cg=16`, and nonessential per-step operator audit disabled. It was stopped under the now-obsolete 30 minute rule and produced no complete beauty/debug/diagnostics files. This is recorded in `M6-gravity-buoyancy-paper-time-timeout-report.md` only as historical failure evidence.
  - Under the updated rule, a new full-size paper-time gravity attempt completed with `deriveEvery=0`: runtime `2397321 ms` (`39.96 min`), `steps=260`, `dt=0.002`, `cg=16`, `simTime=0.52`.
  - Completed paper-time gravity diagnostic: `massError=0.0002800732271907249`, `gammaMassError=0.00041923881131041636`, `gammaResidual=0.007064896979073986 -> 0.004266264052492427`, relative final `0.6038678363080132`, `gammaCgIterationsUsed=16`.
  - Completed paper-time gravity diagnostic: final `topMeanEta=0.4868302967362635`, `bottomMeanEta=0.6455526346017588`, `bottomMinusTopEta=0.15872233786549533`, `thinAreaFraction=0.2992458688826619`, `thickAreaFraction=0.2867582992288777`, `etaStripeAnisotropyPhiOverTheta=4.429916610071256`.
  - Completed paper-time gravity diagnostic still fails Fig.14 shape acceptance: beauty remains broad smooth bands rather than downward tears/upward thin rivers/drop-shaped islands; thickness debug is mostly saturated because `eta` touches the `[0.02, 2.4]` clamp extremes.
  - Completed paper-time gravity diagnostic exposes the next numerical target: `sourceLimiterFraction=0.0038099288940429688`, `materialClampFraction=0.003600597381591797`, `mapResetFraction=0.0005383491516113281`, `divVelocity=[-1628.643310546875, 1628.643310546875]`. These are physical/numerical failures to diagnose, not rendering/color problems.
  - Added diagnostic-output support in `huang-clean-sim.mjs`: `--quantileDebug=1` writes `q01-q99` PNGs, and `--rawFields=1` writes gzip-compressed raw Float32 fields for `eta`, `Gamma`, `uTheta`, `uPhi`, `divVelocity`, `etaSource0`, `etaSourceStep`, and `mapError`.
  - Low-resolution diagnostic plumbing run `256 x 512`, `steps=40`, `dt=0.002`, `cg=16`, `rawFields=1` completed in `24110 ms`; it confirms quantile PNG and raw field output works. This run is explicitly not an M6 acceptance result.
  - Raw-field analysis of the completed full-size paper-time gravity diagnostic showed the failure concentrated in the polar caps: the north `0-5 deg` cap had high divergence/source and near-min eta concentration, while the south cap had near-max eta concentration. This identified a latitude-longitude pole treatment issue, not a beauty/rendering issue.
  - Implemented scalar pole-crossing diagnostics and changed paper-coupled `u_phi/basePhi/betaPhi` pole handling from a resolution-dependent `4*dTheta` taper to a fixed physical `0.035 rad` taper. This keeps low-resolution diagnostics and full-resolution runs under the same physical pole treatment.
  - Full-size fixed-taper gravity run `M6-gravity-buoyancy-paper-time-fixed-pole-taper-20260604-144105`: runtime `3805094 ms` (`63.42 min`), below the current `90 min` soft reporting threshold; full resolution `1024 x 2048`, `steps=260`, `dt=0.002`, `cg=16`.
  - Fixed-taper run diagnostics: `massError=0.00004971475767229162`, `gammaMassError=0.00006138875826558701`, `gammaResidual=0.0003286418231714963 -> 0.0002774470338390492`, `gridDiagnostics.expectedPaperGrid=true`, `northScalarPoleIndexError=0`, `southScalarPoleIndexError=0`, `paperPhiPoleTaperAngleRad=0.035`.
  - Fixed-taper run significantly reduced the previous full-size pole/source failure: source limiter fraction `0.0038099288940429688 -> 0.000072479248046875`, material clamp fraction `0.003600597381591797 -> 0.000469207763671875`, map reset fraction `0.0005383491516113281 -> 0`, global near-min eta fraction `0.0026640892028808594 -> 0.000037670135498046875`, global high-divergence fraction `0.0006003379821777344 -> 0.00008869171142578125`.
  - Fixed-taper run still fails Huang Fig.14 morphology acceptance: it strengthens gravity drainage (`bottomMinusTopEta 0.0971237373510545 -> 0.15915508872499612`) but remains dominated by broad smooth bands and does not yet show clear downward tears, upward thin rivers, or drop-shaped islands.
  - Corrected the `paperGravityBuoyancy` vertical initial-condition sign: `vertical=cos(theta)` is positive at the top, so the paper-style drainage setup now uses `eta = baseEta - verticalEtaDrop * cos(theta) + proceduralFront`. Old negative CLI values are interpreted by magnitude for compatibility.
  - The corrected vertical-gradient full-size run before Eq.24c source consistency completed in `3009095 ms` (`50.15 min`) at `1024 x 2048`, `steps=260`, `dt=0.002`, `cg=16`. It recovered gravity morphology (`bottomMinusTopEta=0.19890088164146041`) but still hit source/material guards: `sourceLimiterFraction=0.0024099349975585938`, `materialClampFraction=0.0010023117065429688`, `mapResetFraction=0.00000667572021484375`.
  - Implemented Huang Eq.24b/24c consistency for eta source accumulation: after the implicit Gamma solve, the material source now uses `etaStar/GammaStar * (Gamma-GammaStar)` instead of recomputing an explicit face-divergence source. This is algebraically tied to Eq.24b/24c and removes the previous inconsistent source spike. The source guard now only enforces the physical eta range `[0.02, 2.4]`.
  - Full-size Eq.24c gravity run `20260604-185551`: runtime `2979041 ms` (`49.65 min`), `massError=-0.00003073829692740429`, `gammaMassError=0.00002141769611235618`, `gammaResidual=0.00024759951050743877 -> 0.00012349369231337353`, `sourceLimiterFraction=0`, `materialClampFraction=0`, `mapResetFraction=0`, `etaRange=[0.36779674887657166, 0.7747095227241516]`, `bottomMinusTopEta=0.19811308472054173`.
  - Full-size Eq.24c air-friction run `20260604-194706`: runtime `1251507 ms` (`20.86 min`), `massError=0.00007541240139876678`, `gammaMassError=0.00004362804625393043`, `gammaResidual=0.0005661929023640935 -> 0.00013399407144796147`, `sourceLimiterFraction=0`, `materialClampFraction=0`, `mapResetFraction=0`, `meanSpeed=0.14551964046843818`, `etaStripeAnisotropyPhiOverTheta=2.87629374499812`.
  - Full-size Eq.24c evaporation/life run `20260604-200835`: runtime `1254798 ms` (`20.91 min`), `massError=-0.02773585953853095` from recorded evaporation loss, `gammaMassError=-0.000018727928826849833`, `gammaResidual=0.0001775254530109909 -> 0.00006517650967445633`, `sourceLimiterFraction=0`, `materialClampFraction=0`, `mapResetFraction=0`, `topMeanEta 0.5634421497457445 -> 0.5402516157393153`, `bottomMinusTopEta=0.11635884371217553`.
  - Eq.24c consistency changes the M6 failure mode: the main numerical overrun is now resolved for the three full-size diagnostics, but paper-result morphology is still insufficient. Gravity still appears broader and smoother than Huang Fig.14; air friction shows large shear bands but not enough Fig.15/Fig.16 fine vortex/line structures; evaporation shows thinning and top/bottom separation but not the full Fig.17 lifecycle visual richness. Therefore M6 remains in progress and must not be marked complete.
- Screenshots:
  - `M6-gravity-buoyancy-beauty.png`
  - `M6-gravity-buoyancy-thickness.png`
  - `M6-gravity-buoyancy-velocity.png`
  - `M6-gravity-buoyancy-divergence.png`
  - `M6-gravity-buoyancy-map-error.png`
  - `M6-gravity-buoyancy-eta-source-material.png`
  - `M6-gravity-buoyancy-paper-time-fixed-pole-taper-beauty.png`
  - `M6-gravity-buoyancy-paper-time-fixed-pole-taper-thickness-q01-q99.png`
  - `M6-gravity-buoyancy-paper-time-fixed-pole-taper-divergence-q01-q99.png`
  - `M6-gravity-buoyancy-paper-time-fixed-pole-taper-paper-comparison.md`
  - `M6-gravity-buoyancy-eq24c-source-front-scale-085-vdrop-055-full-beauty.png`
  - `M6-gravity-buoyancy-eq24c-source-front-scale-085-vdrop-055-full-thickness-q01-q99.png`
  - `M6-gravity-buoyancy-eq24c-source-front-scale-085-vdrop-055-full-paper-scene-report.md`
  - `M6-air-friction-eq24c-source-full-beauty.png`
  - `M6-air-friction-eq24c-source-full-thickness-q01-q99.png`
  - `M6-air-friction-eq24c-source-full-paper-scene-report.md`
  - `M6-evaporation-life-eq24c-source-full-beauty.png`
  - `M6-evaporation-life-eq24c-source-full-thickness-q01-q99.png`
  - `M6-evaporation-life-eq24c-source-full-paper-scene-report.md`
  - `M6-air-friction-beauty.png`
  - `M6-air-friction-thickness.png`
  - `M6-air-friction-velocity.png`
  - `M6-air-friction-divergence.png`
  - `M6-air-friction-map-error.png`
  - `M6-air-friction-eta-source-material.png`
  - `M6-evaporation-life-beauty.png`
  - `M6-evaporation-life-thickness.png`
  - `M6-evaporation-life-velocity.png`
  - `M6-evaporation-life-divergence.png`
  - `M6-evaporation-life-map-error.png`
  - `M6-evaporation-life-eta-source-material.png`
- Git commit: pending; M6 is still in progress and must not be committed as complete.
- Git push: pending.

## Current Notes

- `soap-film-reference.jpg` was viewed this heartbeat only as an aesthetic reference. It is not used for M6 algorithm decisions.
- M6 may complete partially if coupled full-size runs reveal stability or runtime problems; such failure must be recorded with exact diagnostics rather than hidden by lower-resolution substitutes.
- The current gravity, air-friction, and corrected evaporation results are recorded in-progress diagnostics, not milestone passes. The fixed physical pole-taper plus Eq.24b/24c-consistent eta source removed the old limiter/clamp/map reset failure in the three full-size diagnostics, but Fig.14/Fig.15/Fig.16/Fig.17 morphology is still insufficient. M6 must not be committed/pushed as complete until these morphology gaps are resolved or formally documented as caused by unpublished paper details.
- The old 30 minute cap has been superseded. Performance remains a practical concern, but it is no longer a stopping condition. Low-resolution tests may be used to locate algorithm/performance failures; M6 acceptance still requires full-resolution runs with complete saved outputs.
- Next concrete M6 task: now that the source overrun is resolved, focus on paper-result morphology. Audit Huang Fig.14/Fig.15/Fig.16/Fig.17 setup details and adjust only paper-justified initial conditions, air forcing, simulation duration, and optional Supplemental viscosity diagnostics. Low-resolution runs may be used to compare candidate physical scene settings, but any M6 acceptance claim still requires full-resolution `1024 x 2048` runs with complete diagnostics and paper comparison reports.

## 2026-06-04 Staggered Velocity / Gamma Bias Update

- Implemented M6 velocity advection on staggered `uThetaFace/uPhiFace` instead of advecting only cell-centered velocity and averaging back to faces. This better matches Huang Section 4.2 and the staggered grid requirement; `uTheta/uPhi` centers are now derived for interpolation/diagnostics in the paper-coupled path.
- Gravity initial `Gamma` was changed away from the previous eta-anticorrelated field. A full Eq.33 equilibrium initialization was tested at low resolution and found too close to static equilibrium for Fig.14 dynamics. The current gravity setup uses a weak Eq.33-direction latitude bias plus non-equilibrium procedural initial perturbation; this records the paper equilibrium direction without pretending the unpublished Fig.14 initial condition is known.
- Full-size run: `artifacts/huang-clean/runs/M6-gravity-staggered-vel-gamma-bias028-front-scale-085-vdrop-055-full-20260604-210024`.
- Runtime: `3562532 ms` (`59.38 min`), below the `90 min` soft marker. The run completed naturally and saved full diagnostics/raw fields/quantile debug images.
- Numeric result: `massError=0.000019145764679404677`, `gammaMassError=0.000018500416095861114`, `gammaResidual=0.0002531711555575382 -> 0.00013387197202854978`, `sourceLimiterFraction=0`, `materialClampFraction=0`, `mapResetFraction=0`, `bottomMinusTopEta=0.1790505949020132`.
- Paper comparison: still fails Huang Fig.14 morphology. The output remains broad latitude-dominated bands with soft material boundaries; it lacks clear downward-moving tears, upward thin rivers, and drop-shaped islands.
- Record: `artifacts/targets/soap-film-m6-staggered-velocity-gamma-bias-comparison.md`.
- M6 status remains in progress. Do not commit/push as milestone complete.
- Next task: audit and improve BiMocq2 detail preservation / initial physical noise resolution. The current stable solver is preserving broad patches, but not generating the high-frequency material fronts visible in Huang Fig.14/Fig.15/Fig.17.

## 2026-06-04 Low-Resolution Ridged Physical Initial-Front Diagnostic

- Added a low-resolution diagnostic candidate in which procedural multi-octave ridged value-noise is written into the physical initial `eta/Gamma` fields for the gravity/buoyancy scene. This is not a rendering texture, reference sampling, canvas pattern, or visual overlay; it is recorded as an initial physical field because Huang Fig.15/Fig.17 explicitly describe noise-texture / Perlin-noise style initial conditions, while Fig.14's exact initial condition is unpublished.
- Diagnostic run: `artifacts/huang-clean/runs/M6-lowres-ridged-front-staggered-gravity-bias028-front-scale-085-vdrop-055-20260604-220639`.
- Grid/runtime: `256 x 512`, `steps=260`, `dt=0.002`, `cg=16`, runtime `210096 ms` (`3.50 min`). This is explicitly a stage diagnostic, not milestone acceptance.
- Numeric result: `massError=-0.000005819303202633352`, `gammaMassError=0.000033965414760222895`, `gammaResidual=0.00016773134842367794 -> 0.000018460322467058772`, `sourceLimiterFraction=0`, `materialClampFraction=0`, `mapResetFraction=0`, `maxMapError=0.002191060832830644`, `bottomMinusTopEta=0.18243471451918158`.
- Paper comparison: still fails Huang Fig.14. The added physical high-frequency content creates speckled/fragmented detail and raises the local gradient budget, but it does not produce coherent long downward tears, upward thin rivers, or drop-shaped islands. This points to a material-transport / BiMocq2 detail-preservation gap rather than a simple missing noise amplitude.
- Decision: do not promote this candidate to a full-resolution acceptance run yet. First audit Huang's BiMocq2 dependency and the original BiMocq2 error-correction details referenced by the paper; if the current implementation lacks a required correction/reset/reconstruction step, implement that before spending an unlimited full-resolution run.

## 2026-06-04 Qu et al. 2019 BiMocq2 Audit

- Added local supplemental source files:
  - `artifacts/references/QuEtAl-2019-BiMocq2.pdf`
  - `artifacts/references/QuEtAl-2019-BiMocq2.txt`
  - `artifacts/references/QuEtAl-2019-BiMocq2-code-README.md`
- Added audit notes: `artifacts/targets/soap-film-bimocq2-qu-2019-fulltext-notes.md`.
- Conflict review: Qu et al. 2019 is not a replacement model; Huang Section 4.2.1 explicitly cites it for BiMocq2 and error-correction details. The implementation must keep Huang's spherical grid, `eta/Gamma/u` equations, `pi/128` spherical reset criterion, and Eq.24-26 Gamma coupling. Qu only supplies the missing material-mapping details.
- Current code gap confirmed: `huang-clean-sim.mjs` currently has one `backMap`/`forwardMap` pair, local `pi/128` reset, and `etaSource0` accumulation, but no `Xprev`/two-level mapping, no previous material-state preservation across reinitialization, no gapped/regular BiMocq2 error correction, no extrema clamp for corrected reconstruction, and no DMC mapping advection.
- Next implementation task: add a Huang-compatible spherical two-level `eta` reconstruction and gapped BiMocq2 error correction for reset/reinitialization events. Low-resolution diagnostics may compare the new path against the current single-level path, but any M6 pass still requires full-resolution natural completion with complete diagnostics.

## 2026-06-04 BiMocq2 Error-Correction Diagnostic

- Implemented a controllable `--biMocqEc=1/0` path in `artifacts/huang-clean/huang-clean-sim.mjs`.
- The new path estimates an `eta` material reconstruction error using the forward map `Y`, maps the correction back with the backward map `X`, and clamps corrected `eta` to neighboring post-advection extrema. It is documented as a Qu Eq.27-style regular EC approximation, not a completed two-level BiMocq2 implementation.
- EC-on diagnostic: `artifacts/huang-clean/runs/M6-lowres-bimocq-ec-gravity-bias028-front-scale-085-vdrop-055-20260604-222351`, `256 x 512`, `steps=260`, runtime `249747 ms`.
- EC-off control: `artifacts/huang-clean/runs/M6-lowres-no-bimocq-ec-gravity-bias028-front-scale-085-vdrop-055-20260604-222818`, same grid/steps, runtime `210805 ms`.
- Numeric comparison: EC-on remained stable (`sourceLimiterFraction=0`, no map reset explosion) but changed shape statistics only marginally: bottom-minus-top `0.182422` vs `0.182435`, meanSpeed `0.0634003` vs `0.0634009`, anisotropy `1.06282` vs `1.06434`. EC final mean correction was only `0.0005273`, with extrema clamp fraction `0.0631`.
- Visual comparison: EC-on beauty remains broad latitude-dominated patches with fragmented high-frequency speckles. It still does not show Huang Fig.14 coherent downward tears / upward thin rivers / drop-shaped islands.
- Decision: keep the EC code path and diagnostics because it is paper-justified, but do not promote it as solving M6. Since current `mapError` remains far below Huang's `pi/128` reset threshold, Qu's two-level/gapped reinitialization would not naturally trigger in this scene unless we add a non-Huang periodic reset. Do not do that. The next paper-justified targets are scene setup/time/forcing and, if needed, the map-advection accuracy itself.

## 2026-06-04 Marangoni Direction Diagnostic Fix

- Previous `marangoniDirection.cosine` compared total velocity `u` against `-grad_s(Gamma)`, so gravity/air/advection base velocity could make the score negative even when the Marangoni correction itself had the correct sign.
- Updated diagnostics in `huang-clean-sim.mjs` so `cosine` / `correctionCosine` now compare `(u - baseVelocity)` against `-grad_s(Gamma)`, while `totalVelocityCosine` separately records the old total-velocity relationship.
- Short check run: `artifacts/huang-clean/runs/M6-lowres-marangoni-score-check-20260604-223528`, `128 x 256`, `steps=40`, runtime `9771 ms`.
- Result: `correctionCosine=0.9908740463746487`, `correctionPositiveAreaFraction=0.9999747033307416`, `totalVelocityCosine=0.14178891613093234`. Conclusion: the M6 Marangoni velocity update sign is correct; the Fig.14 morphology failure is not caused by a global Marangoni sign flip.

## 2026-06-04 Long Gravity Duration Diagnostic

- Run: `artifacts/huang-clean/runs/M6-lowres-long-gravity-t156-bias028-front-scale-085-vdrop-055-20260604-223737`.
- Command: `node artifacts/huang-clean/huang-clean-sim.mjs --simTheta=256 --simPhi=512 --paperParams=1 --scenario=paperGravityBuoyancy --steps=780 --dt=0.002 --cg=16 --operatorAudit=0 --deriveEvery=0 --progressEvery=156 --render=900 --rawFields=1 --quantileDebug=1 --gravityFrontScale=0.85 --gravityVerticalGradient=0.055 --biMocqEc=0`.
- Runtime: `659411 ms` (`10.99 min`), natural completion. This is below the `90 min` stage diagnostic soft marker, but it remains low-resolution and cannot be used as M6 milestone acceptance.
- Numeric result: `massError=0.00004051176366317133`, `gammaMassError=0.00012172660345885693`, `gammaResidual=0.00010177421703211192 -> 0.000013391252747470449`, `sourceLimiterFraction=0`, `materialClampFraction=0`, `mapResetFraction=0`, `maxMapError=0.004220567324377708`.
- Physical trend: longer time strengthens gravity drainage; `bottomMinusTopEta` rises from initial `0.13008353896362435` to `0.3267180723443252`, and thin area rises to `0.30436565551441835`.
- Paper comparison: still fails Huang Fig.14. Beauty and thickness outputs remain dominated by broad latitude bands plus fragmented small texture; they do not form coherent downward tears, upward thin rivers, or drop-shaped islands. Longer time alone is not the missing ingredient.
- Decision: do not launch a full-resolution acceptance run for this candidate. M6 should continue with paper-justified algorithm/scene gaps: the exact Fig.14 initial material distribution is unpublished, and the current velocity field remains too smooth/latitude-dominated to create tear/rivers morphology. Next work should examine Huang Fig.14 setup language, Supplemental force terms, and whether the current acceleration/time integration underuses the surface-tension/Marangoni coupling implied by Eq. 17 and Eq. 24-26.

## 2026-06-04 Strict Huang Eq.26 Gamma Operator Correction

- Paper audit: Huang main text Eq.24-26 writes the implicit concentration system as `Gamma/(GammaStar*dt) - div_s((M*dt)/(etaStar+Cr*dt) grad_s(Gamma)) = 1/dt - div_s(base)`. The previous implementation solved a nearby SPD form `Gamma - dt*div_s(GammaStar*beta*grad_s(Gamma)) = GammaStar - dt*GammaStar*div_s(base)`, which incorrectly placed spatially varying `GammaStar` inside the stiffness flux.
- Code change: `artifacts/huang-clean/huang-clean-sim.mjs` now applies the Eq.26 form directly. `GammaStar` appears only in the diagonal `Gamma/(GammaStar*dt)` term and in the eta source relation; it is no longer used as a face flux coefficient.
- Full-size operator audit: `artifacts/huang-clean/runs/M6-paper-eq26-gamma-projection-fullsize-audit-20260604-2338`, `1024 x 2048`, `cg=64`, runtime `8033 ms`. Residual `0.008118551670214236 -> 0.0000013915802870419416`, reduction factor `5834.05193779491`, relative asymmetry `1.587593557486631e-10`, `gammaClampFraction=0`. This confirms the corrected operator remains effectively SPD.
- Low-resolution gravity diagnostic with corrected Eq.26 and `cg=16`: `artifacts/huang-clean/runs/M6-lowres-paper-eq26-gravity-bias028-front-scale-085-vdrop-055-20260604-2310`, runtime `205343 ms`. It remained stable but stopped with relative residual `0.039225515708383236`, so `cg=16` is insufficient for the corrected scaling.
- Low-resolution gravity diagnostic with corrected Eq.26 and `cg=64`: `artifacts/huang-clean/runs/M6-lowres-paper-eq26-cg64-gravity-bias028-front-scale-085-vdrop-055-20260604-2317`, runtime `258591 ms`, residual `0.11025958286979397 -> 0.00001962473459299292`, `sourceLimiterFraction=0`, `materialClampFraction=0`, `mapResetFraction=0`, final `bottomMinusTopEta=0.1825611706946163`.
- Long low-resolution corrected Eq.26 run: `artifacts/huang-clean/runs/M6-lowres-paper-eq26-cg64-long-gravity-t156-bias028-front-scale-085-vdrop-055-20260604-2323`, runtime `781018 ms` (`13.02 min`), residual `0.06434413232704639 -> 0.000017879597431261793`, `sourceLimiterFraction=0`, `materialClampFraction=0`, final `bottomMinusTopEta=0.3268520848343914`.
- Paper comparison: the corrected Eq.26 operator is required for strict paper alignment, but it does not by itself produce Huang Fig.14 morphology. The short and long gravity outputs remain visually close to the previous broad-band result. Therefore the active M6 gap is no longer this operator form; it is the unpublished Fig.14 initial material/soap distribution and/or scene forcing/time-integration setup that generates coherent tears/rivers.
- Implementation follow-up: paper-coupled scenarios now default to `cg=64` when `--cg` is not explicitly provided. This is a numerical precision default for the corrected Eq.26 scale, not a visual tuning parameter.
- Next decision: keep corrected Eq.26 as the only allowed path. Do not run full-resolution acceptance until a lower-resolution candidate shows the required Fig.14 tear/rivers morphology, but any eventual M6 completion still requires full-resolution `1024 x 2048` natural completion with no runtime limit.

## 2026-06-04 Eq.34 Gamma/Eta Ratio Diagnostic

- Paper audit: Huang Eq.34 states that the material derivative of `Gamma/eta` vanishes under the simplified gravity/buoyancy setting. A new `--gravityGammaRatio=1/0` option was added; for `paperGravityBuoyancy` the default now initializes `Gamma = (gammaBase/baseEta) * eta`, recording the Eq.34 material-invariant interpretation instead of the earlier weak independent Gamma latitude bias.
- Diagnostic run: `artifacts/huang-clean/runs/M6-lowres-eq34-ratio-gamma-eq26-cg64-gravity-front-scale-085-vdrop-055-20260604-2348`.
- Command class: `256 x 512`, `steps=260`, `dt=0.002`, corrected Eq.26, `cg=64`, `gravityFrontScale=0.85`, `gravityVerticalGradient=0.055`, `gravityGammaRatio=1`. This was a lower-resolution stage diagnostic, not a milestone acceptance run.
- Runtime: `244373 ms` (`4.07 min`), natural completion and below the `90 min` diagnostic soft marker.
- Numeric result: `massError=-0.00022663639434764105`, `gammaMassError=-0.00022103824157593727`, `gammaResidual=0.1685240970595692 -> 0.000014763756935558321`, relative final `0.00008760620702414854`, `gammaCgIterationsUsed=47`, `sourceLimiterFraction=0`, `materialClampFraction=0`, `mapResetFraction=0`, `maxMapError=0.0026176230510693184`.
- Physical trend: `bottomMinusTopEta` rose from `0.13008353896362435` to `0.18281171792188367`, and Marangoni correction direction remained correct (`correctionCosine=0.9904615295884582`).
- Paper comparison: the Eq.34 ratio field is more strictly paper-justified, but the image becomes overly smooth and globally banded. It suppresses most localized material-front detail and still does not form Huang Fig.14 downward tears, upward thin rivers, or drop-shaped islands. Therefore this is a useful equation-alignment diagnostic, not an M6 acceptance candidate.
- Decision: keep `--gravityGammaRatio` as the default paper-aligned initialization path, but continue investigating Fig.14 morphology through paper-justified scene setup, forcing, and transport details. If an unpublished Fig.14 initial condition requires stronger localized `eta/Gamma` structure, it must be documented as an initial physical field assumption rather than introduced as a visual texture or color trick.
