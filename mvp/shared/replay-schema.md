# Guided Baseline Replay Schema

Replay JSON uses `schemaVersion: guided-baseline-replay-v1` and a `frames` array.

Each frame must include:

- `time`: seconds from replay start, monotonically increasing.
- `stageHint`: one of `calm`, `guidance`, `evaluation`, `overload`, `ending`.
- `breathPhase`: 0-1 phase proxy.
- `breathRate`: breaths per minute proxy.
- `breathingStability`: 0-1 stability proxy.
- `heartRateBpm`: heart rate proxy.
- `rrInterval`: seconds between detected ECG peaks.
- `hrvProxy`: 0-1 HRV proxy.
- `cardiacArousal`: 0-1 arousal proxy.
- `baselineDeviation`: 0-1 deviation proxy.
- `pressure`: 0-1 performance pressure control signal.

These values are artistic control signals for performance mapping, not medical data or diagnosis.
