# Multicache Interpolation Evidence

Original local source:

`artifacts/targets/soap-film-multicache-interpolation-test-20260616.md`

## Purpose

This test examined whether a cheaper middle visual state could be made by interpolating between two simulation caches instead of recomputing physics at the middle parameter setting.

## Test Structure

The comparison used:

- a safe simulation cache;
- a border simulation cache;
- an interpolated middle cache;
- a true middle recomputation.

The true middle recomputation used:

`SOAP_AIR_STRENGTH=1.40`, `ANGLE=0.80`, `PHASE=2.75`, `WINDOW=1.15`.

## Key Finding

The middle recomputation again took about 1,084 seconds for 4,500 frames, around 4 simulation frames per second. Cache interpolation was close enough for previewing and timeline scrubbing, but it was not numerically or visually identical to a true recomputation. The original comparison recorded eta RMSE and RGB differences between the interpolated and recomputed states.

## Evidence Value

This supports a conservative technical decision: cache interpolation is useful as a development tool, but the final work should not present interpolated caches as true physical output. The submitted video therefore prioritises stable offline simulation/rendering over a cheaper approximation.
