# True Physics Parameter Rerun Evidence

Original local source:

`artifacts/targets/soap-film-true-physics-param-test-20260616.md`

## Purpose

This test checked whether soap-film changes should be produced by true simulation parameter changes rather than by reusing one cached sequence with warping, recolouring or post-processing.

## Key Recorded Runs

Two full physics configurations were tested:

- Safe configuration: `SOAP_AIR_STRENGTH=1.15`, `ANGLE=0.45`, `PHASE=1.5`, `WINDOW=1.05`.
- Border configuration: `SOAP_AIR_STRENGTH=1.65`, `ANGLE=1.15`, `PHASE=4.0`, `WINDOW=1.25`.

Each run used 4,500 simulation frames for a 180-second, 25 fps target. The recorded wall time was about 1,100 seconds per full pass, with throughput around 4 simulation frames per second.

## What It Demonstrates

- Physically different parameter settings required expensive reruns.
- Earlier visual comparisons could look similar when they came from the same underlying sequence and only differed by post-processing.
- The final pipeline needed to separate fast physiological control generation from slow physical simulation and high-resolution rendering.

## Evidence Value

This supports the final decision to use a frozen offline pipeline for the assessed performance media. It also explains why live TTS or live visual regeneration was not the cleanest submission route once the input data and physics render were already delayed and precomputed.
