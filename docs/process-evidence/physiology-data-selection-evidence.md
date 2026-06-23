# Physiology Data Selection Evidence

Original local sources:

- `Plux-analysis-standalone/output/ANALYSIS_RESULTS.md`
- `Plux-analysis-standalone/output/data_quality_compare_new_vs_old/`
- `Plux-analysis-standalone/output/ecg_rip_stage_comparison/`
- `Symovia/Plux-test` group preparation repository

## Purpose

The early group work explored PLUX data collection, EDA/RIP/ECG analysis, three-state pressure classification and five public artistic indicators. The final project did not use this early control layer directly. This document summarises why.

## Early Direction

The early analysis tested:

- three pressure states;
- EDA, ECG-labelled and RIP-labelled channels;
- a classifier-style pressure score;
- five artistic indicators: `fatigue`, `focus`, `heart_age`, `coherence` and `resilience`.

This was useful for proving that collected physiological data could drive artistic control signals. It also showed that a single medical-sounding score would create interpretation problems.

## Why It Was Not Used Directly

The final work moved away from the early EDA-led classifier and five public indicators for several reasons:

- the final four-stage dataset had zero EDA, so EDA could not be used as a final control source;
- the early three-state dataset did not match the final four-stage performance structure;
- the five public indicators were not stable enough for the intended visual narrative;
- terms such as `heart_age` were too medicalised for an artwork that should not make diagnostic claims;
- a 60-second classifier window was too slow for visible soap-bubble dynamics.

## Final Selection

The final project uses the four-stage ECG/RIP-labelled offline dataset. The final submission keeps the original CSV labels for reproducibility, but interprets the two non-zero channels by audited observed function rather than by assuming that the raw column names are physiologically literal.

The output is therefore framed as an artistic control system, not a medical diagnosis.

## Evidence Value

This evidence supports the final methodological narrowing: the early PLUX and five-indicator work was not wasted, but it became process evidence. The final control layer is simpler, more auditable and better aligned with the final performance structure.
