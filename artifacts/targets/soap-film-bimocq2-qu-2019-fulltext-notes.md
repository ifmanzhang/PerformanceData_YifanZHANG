# Qu et al. 2019 BiMocq2 Fulltext Notes

## Source

- Paper: Qu, Zhang, Gao, Jiang, Chen. 2019. `Efficient and Conservative Fluids with Bidirectional Mapping`, ACM Transactions on Graphics / SIGGRAPH 2019.
- Local PDF: `artifacts/references/QuEtAl-2019-BiMocq2.pdf`.
- Local extracted text: `artifacts/references/QuEtAl-2019-BiMocq2.txt`.
- Author/code README: `artifacts/references/QuEtAl-2019-BiMocq2-code-README.md`.
- Source URL used for PDF: `https://mingg13.github.io/papers/2019_Advection.pdf`.
- Source URL used for code README: `https://raw.githubusercontent.com/ziyinq/Bimocq/master/README.md`.

## Why This Paper Is Allowed

Huang et al. 2020 Section 4.2.1 explicitly states that their soap-film simulator extends BiMocq2 to spherical coordinates and refers to Qu et al. 2019 for implementation details such as error correction. This is therefore not an unrelated replacement algorithm. It is the original method Huang depends on for material detail preservation.

## Core Algorithm Pieces Relevant To Huang

1. `BiMocq2` is a characteristic-mapping advection method. Instead of repeatedly interpolating the latest field, it evolves material mappings and samples from the stored state at the last mapping initialization time.
2. The method maintains both a backward mapping `X`, from current position to previous material origin, and a forward mapping `Y`, from previous material origin to current position.
3. The method stores accumulated physical changes in material coordinates. Huang uses this same concept for the extra `-eta div_s(u)` contribution to film thickness.
4. Reinitialization is triggered when the backward/forward maps are no longer mutually consistent. Huang adapts this as a spherical distortion threshold of `pi / 128`.
5. Qu's full algorithm is not just one `X/Y` pair. It uses double / multi-level mapping (`Xprev`, `Xcurr`, `Ycurr`) to reduce blur after reinitialization.
6. Qu adds long-term error correction. It estimates the difference between a backward-mapped field and a forward/back mapped reconstruction, then maps that error forward and subtracts it from the reconstructed field.
7. Qu recommends a gapped error correction strategy for efficiency. It is applied at reinitialization and was reported to preserve visual sharpness similarly to regular correction.
8. Error correction may create new extrema, so corrected values must be clamped against neighboring post-advection values.
9. Qu also uses Dual Mesh Characteristics (DMC) for more accurate mapping advection; DMC requires substeps when CFL exceeds 1. Huang only says they use Section 4.2 velocity-aligned spherical advection and spherical linear interpolation, so DMC is an optional fidelity target unless Huang's result still cannot be reproduced without it.

## Conflict Audit Against Huang 2020

- No core conflict: Qu's `X/Y` maps, material accumulation, reinitialization, and error correction are the cited basis for Huang's Section 4.2.1.
- Coordinate-system change: Qu describes Cartesian dense grids / MAC; Huang adapts the method to a staggered spherical grid with spherical linear interpolation and pole topology. Any implementation here must keep Huang's spherical `theta/phi` / unit-vector mapping, not switch to Cartesian volumes.
- Source term difference: Qu discusses velocity/density/temperature accumulated changes; Huang's soap-film use case accumulates the thickness source from `-eta div_s(u)` and the Eq.24b/24c-compatible `etaStar/GammaStar * (Gamma - GammaStar)` update. Do not import Qu's smoke/pressure terms.
- Reinitialization threshold: Huang gives `pi / 128` on the sphere; prefer Huang's threshold over Qu's dimensionless `q` threshold.
- Rendering: Qu has no soap-film optics. It must not affect Section 5 thin-film rendering.

## Current Implementation Gap

Current `artifacts/huang-clean/huang-clean-sim.mjs` implements:

- one current `backMapX/Y/Z`;
- one current `forwardMapX/Y/Z`;
- spherical map sampling and spherical reset when `F(B(x))` distance exceeds `pi / 128`;
- material-coordinate accumulation buffer `etaSource0`;
- reconstruction `eta = sample(eta0, X) + sample(etaSource0, X)`.

It currently does not implement:

- `Xprev` / double-level mapping;
- preservation of previous mapped field/state across reinitialization;
- gapped or regular BiMocq2 error correction;
- extrema clamp for corrected reconstruction;
- DMC mapping advection.

## M6 Consequence

The latest gravity diagnostics are stable, but Fig.14 morphology is too broad or, after adding ridged physical initial fronts, too speckled. This matches the missing BiMocq2 behavior: the solver has a map reset and source accumulation path, but it lacks the multi-level and error-correction machinery meant to preserve coherent thin structures over long advection.

## Implementation Direction

For M6, implement a conservative subset that is directly justified by Huang + Qu:

1. Add previous-level maps and previous-level material state buffers for `eta`.
2. On global or local reinitialization, keep the current mapping/state as the previous level before resetting the current map to identity.
3. Reconstruct `eta` from a blend of previous-level and current-level material reconstructions, following Qu's two-level idea, but keep the spherical coordinate sampling and Huang's `pi/128` reset criterion.
4. Add gapped error correction for `eta` at reinitialization first. Regular per-step correction can be evaluated later if needed.
5. Clamp corrected `eta` to the local neighboring extrema of the post-advection field to avoid nonphysical overshoots.
6. Keep `Gamma` transport and `u` projection governed by Huang Eq.24-26; do not use BiMocq2 to replace the concentration split unless a later audit explicitly justifies it.

## Acceptance For This Substep

- A controlled low-resolution diagnostic may be used to compare single-level vs two-level/error-corrected map behavior.
- M6 acceptance still requires full-resolution `1024 x 2048` natural completion before the milestone can be marked complete.
- Passing this substep means the gravity scene develops more coherent transported material fronts without source/material clamps and without map reset explosions.
