#!/usr/bin/env python3
"""生成或预处理呼吸 + ECG replay 数据。

这个脚本先服务“没有真实学校数据”的阶段：
- --synthetic 生成可控的五分钟表演数据。
- --physionet-demo 读取已下载/导出的开源 CSV 片段，输出同一套 replay JSON。

注意：这里的指标都是艺术 proxy，用于表演系统调参，不是医学诊断。
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import statistics
from bisect import bisect_left
from pathlib import Path
from typing import Iterable


REQUIRED_FIELDS = [
    "time",
    "stageHint",
    "breathPhase",
    "breathRate",
    "breathingStability",
    "heartRateBpm",
    "rrInterval",
    "hrvProxy",
    "cardiacArousal",
    "baselineDeviation",
    "pressure",
]

STAGES = [
    ("calm", 55.0, (0.03, 0.12)),
    ("guidance", 65.0, (0.12, 0.28)),
    ("evaluation", 80.0, (0.28, 0.62)),
    ("overload", 75.0, (0.62, 0.96)),
    ("ending", 25.0, (0.96, 0.08)),
]

STAGE_BREATH_RATE = {
    "calm": (8.4, 10.2),
    "guidance": (10.2, 11.8),
    "evaluation": (11.8, 14.6),
    "overload": (14.8, 19.2),
    "ending": (18.0, 9.2),
}


def clamp(value: float, low: float, high: float) -> float:
    return min(high, max(low, value))


def lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def smoothstep(t: float) -> float:
    x = clamp(t, 0.0, 1.0)
    return x * x * (3.0 - 2.0 * x)


def round_frame(frame: dict) -> dict:
    rounded = dict(frame)
    for key, digits in {
        "time": 3,
        "breathPhase": 4,
        "breathRate": 3,
        "breathingStability": 4,
        "heartRateBpm": 3,
        "rrInterval": 4,
        "hrvProxy": 4,
        "cardiacArousal": 4,
        "baselineDeviation": 4,
        "pressure": 4,
    }.items():
        if key in rounded:
            rounded[key] = round(float(rounded[key]), digits)
    return rounded


def stage_at(time_sec: float) -> tuple[str, float, float]:
    cursor = 0.0
    for name, duration, pressure_range in STAGES:
        end = cursor + duration
        if time_sec <= end:
            progress = clamp((time_sec - cursor) / duration, 0.0, 1.0)
            pressure = lerp(pressure_range[0], pressure_range[1], smoothstep(progress))
            return name, progress, pressure
        cursor = end
    return STAGES[-1][0], 1.0, STAGES[-1][2][1]


def generate_synthetic(duration: float, fps: float) -> dict:
    frames = []
    phase = 0.08
    frame_count = int(duration * fps) + 1

    for index in range(frame_count):
        time_sec = index / fps
        stage, stage_progress, target_pressure = stage_at(time_sec)
        stage_eased = smoothstep(stage_progress)

        breath_min, breath_max = STAGE_BREATH_RATE.get(stage, (10.0, 14.0))
        breath_rate = lerp(breath_min, breath_max, stage_eased)
        breath_rate += math.sin(time_sec * 0.09) * 0.38 + math.sin(time_sec * 0.027 + 1.4) * 0.22
        breath_rate = clamp(breath_rate, 7.0, 22.0)

        phase = (phase + (breath_rate / 60.0) / fps) % 1.0
        breath_wave = 0.5 + 0.5 * math.sin(phase * math.tau)

        hrv_proxy = clamp(0.88 - target_pressure * 0.74 + math.sin(time_sec * 0.047 + 2.0) * 0.035, 0.08, 0.92)
        breathing_stability = clamp(
            0.92 - target_pressure * 0.68 + math.sin(time_sec * 0.063) * 0.04 - abs(breath_wave - 0.5) * target_pressure * 0.08,
            0.12,
            0.96,
        )
        heart_rate = clamp(
            61.5
            + target_pressure * 49.0
            + math.sin(time_sec * 0.05 + 0.7) * 2.2
            + math.sin(time_sec * 0.17) * target_pressure * 4.2,
            54.0,
            116.0,
        )
        rr_interval = 60.0 / heart_rate
        cardiac_arousal = clamp((heart_rate - 62.0) / 52.0 * 0.64 + (1.0 - hrv_proxy) * 0.38, 0.0, 1.0)
        baseline_deviation = clamp(target_pressure * 0.88 + (1.0 - breathing_stability) * 0.18, 0.0, 1.0)
        pressure = clamp(
            target_pressure * 0.64
            + cardiac_arousal * 0.18
            + (1.0 - breathing_stability) * 0.13
            + (1.0 - hrv_proxy) * 0.09,
            0.0,
            1.0,
        )

        frames.append(
            round_frame(
                {
                    "time": time_sec,
                    "stageHint": stage,
                    "breathPhase": phase,
                    "breathRate": breath_rate,
                    "breathingStability": breathing_stability,
                    "heartRateBpm": heart_rate,
                    "rrInterval": rr_interval,
                    "hrvProxy": hrv_proxy,
                    "cardiacArousal": cardiac_arousal,
                    "baselineDeviation": baseline_deviation,
                    "pressure": pressure,
                }
            )
        )

    return {
        "meta": {
            "schemaVersion": "guided-baseline-replay-v1",
            "sourceType": "synthetic",
            "source": "deterministic synthetic breath + ECG proxy",
            "durationSec": duration,
            "fps": fps,
            "sampleRate": fps,
            "notes": "合成数据只用于系统结构、映射和表演节奏测试；不是个人真实身体数据，也不是医学分析。",
        },
        "frames": frames,
    }


def safe_float(value: object, default: float | None = None) -> float | None:
    try:
        if value is None or str(value).strip() == "":
            return default
        parsed = float(str(value).strip())
        if math.isfinite(parsed):
            return parsed
    except (TypeError, ValueError):
        return default
    return default


def normalize_name(name: str) -> str:
    return "".join(ch for ch in name.lower() if ch.isalnum())


def pick_column(headers: list[str], aliases: Iterable[str]) -> str | None:
    normalized = {normalize_name(header): header for header in headers}
    for alias in aliases:
        found = normalized.get(normalize_name(alias))
        if found:
            return found
    for header in headers:
        clean = normalize_name(header)
        if any(normalize_name(alias) in clean for alias in aliases):
            return header
    return None


def first_row_is_header(row: list[str]) -> bool:
    numeric = [safe_float(value) is not None for value in row]
    return not all(numeric)


def read_csv_signals(path: Path, sample_rate: float) -> dict[str, list[float]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        rows = [row for row in csv.reader(handle) if row and any(cell.strip() for cell in row)]

    if not rows:
        raise ValueError(f"CSV 文件为空: {path}")

    has_header = first_row_is_header(rows[0])
    time_values: list[float] = []
    ecg_values: list[float] = []
    resp_values: list[float] = []

    if has_header:
        headers = rows[0]
        records = [dict(zip(headers, row)) for row in rows[1:]]
        time_col = pick_column(headers, ["time", "timestamp", "seconds", "sec", "t"])
        ecg_col = pick_column(headers, ["ecg", "ekg", "ii", "mlii", "signal", "ch1"])
        resp_col = pick_column(headers, ["resp", "respiration", "breath", "ch2", "airflow"])
        if not ecg_col:
            raise ValueError("未找到 ECG 列。请把列名设为 ecg / ECG / II / MLII 等。")
        for index, record in enumerate(records):
            ecg = safe_float(record.get(ecg_col))
            if ecg is None:
                continue
            time_value = safe_float(record.get(time_col)) if time_col else None
            resp = safe_float(record.get(resp_col), 0.0) if resp_col else 0.0
            time_values.append(time_value if time_value is not None else index / sample_rate)
            ecg_values.append(ecg)
            resp_values.append(float(resp or 0.0))
    else:
        for index, row in enumerate(rows):
            values = [safe_float(cell) for cell in row]
            values = [value for value in values if value is not None]
            if not values:
                continue
            if len(values) >= 3:
                time_value, ecg, resp = values[0], values[1], values[2]
            elif len(values) == 2:
                time_value, ecg, resp = index / sample_rate, values[0], values[1]
            else:
                time_value, ecg, resp = index / sample_rate, values[0], 0.0
            time_values.append(time_value)
            ecg_values.append(ecg)
            resp_values.append(resp)

    if len(ecg_values) < 5:
        raise ValueError("有效 ECG 样本太少，无法生成 replay。")

    origin = time_values[0]
    time_values = [max(0.0, value - origin) for value in time_values]
    return {"time": time_values, "ecg": ecg_values, "resp": resp_values}


def percentile(values: list[float], pct: float) -> float:
    if not values:
        return 0.0
    sorted_values = sorted(values)
    position = clamp(pct / 100.0, 0.0, 1.0) * (len(sorted_values) - 1)
    lower = int(math.floor(position))
    upper = int(math.ceil(position))
    if lower == upper:
        return sorted_values[lower]
    return lerp(sorted_values[lower], sorted_values[upper], position - lower)


def mean_std(values: list[float]) -> tuple[float, float]:
    if not values:
        return 0.0, 1.0
    mean = statistics.fmean(values)
    if len(values) < 2:
        return mean, 1.0
    std = statistics.pstdev(values)
    return mean, std if std > 1e-9 else 1.0


def zscore(values: list[float]) -> list[float]:
    mean, std = mean_std(values)
    return [(value - mean) / std for value in values]


def detect_peaks(values: list[float], sample_rate: float, min_distance_sec: float, threshold_pct: float) -> list[int]:
    if len(values) < 3:
        return []
    normalized = zscore(values)
    threshold = max(percentile(normalized, threshold_pct), 0.6)
    min_distance = max(1, int(sample_rate * min_distance_sec))
    peaks: list[int] = []
    for index in range(1, len(normalized) - 1):
        value = normalized[index]
        if value < threshold:
            continue
        if value < normalized[index - 1] or value < normalized[index + 1]:
            continue
        if peaks and index - peaks[-1] < min_distance:
            if value > normalized[peaks[-1]]:
                peaks[-1] = index
            continue
        peaks.append(index)
    return peaks


def window_values(times: list[float], values: list[float], center: float, window: float) -> list[float]:
    start = center - window
    end = center
    left = bisect_left(times, start)
    right = bisect_left(times, end)
    return values[left:right]


def sample_signal(times: list[float], values: list[float], time_sec: float) -> float:
    if not times:
        return 0.0
    index = bisect_left(times, time_sec)
    if index <= 0:
        return values[0]
    if index >= len(times):
        return values[-1]
    left_t, right_t = times[index - 1], times[index]
    left_v, right_v = values[index - 1], values[index]
    if right_t <= left_t:
        return left_v
    return lerp(left_v, right_v, (time_sec - left_t) / (right_t - left_t))


def rmssd(rr_values: list[float]) -> float:
    if len(rr_values) < 3:
        return 0.0
    diffs = [rr_values[index] - rr_values[index - 1] for index in range(1, len(rr_values))]
    return math.sqrt(statistics.fmean(diff * diff for diff in diffs))


def rate_from_rr(rr_values: list[float], fallback: float) -> tuple[float, float]:
    clean_rr = [value for value in rr_values if 0.28 <= value <= 1.8]
    if not clean_rr:
        return fallback, 60.0 / fallback
    mean_rr = statistics.fmean(clean_rr)
    return clamp(60.0 / mean_rr, 35.0, 180.0), mean_rr


def normalize_unit(values: list[float]) -> list[float]:
    low = percentile(values, 2)
    high = percentile(values, 98)
    span = high - low if high > low else 1.0
    return [clamp((value - low) / span, 0.0, 1.0) for value in values]


def preprocess_physionet_csv(input_path: Path, duration: float | None, fps: float, sample_rate: float) -> dict:
    signals = read_csv_signals(input_path, sample_rate)
    times = signals["time"]
    ecg = signals["ecg"]
    resp = signals["resp"]
    inferred_rate = (len(times) - 1) / max(times[-1] - times[0], 1e-6)
    working_sample_rate = inferred_rate if inferred_rate > 0 else sample_rate

    ecg_peaks = detect_peaks(ecg, working_sample_rate, min_distance_sec=0.3, threshold_pct=92)
    rr_times: list[float] = []
    rr_values: list[float] = []
    for previous, current in zip(ecg_peaks, ecg_peaks[1:]):
        interval = times[current] - times[previous]
        if 0.28 <= interval <= 1.8:
            rr_times.append(times[current])
            rr_values.append(interval)

    resp_unit = normalize_unit(resp)
    resp_peaks = detect_peaks(resp, working_sample_rate, min_distance_sec=2.0, threshold_pct=86)
    resp_peak_times = [times[index] for index in resp_peaks]
    resp_intervals = [
        resp_peak_times[index] - resp_peak_times[index - 1]
        for index in range(1, len(resp_peak_times))
        if 1.6 <= resp_peak_times[index] - resp_peak_times[index - 1] <= 12.0
    ]
    baseline_hr, _ = rate_from_rr(rr_values[: max(3, min(20, len(rr_values)))], fallback=72.0)
    baseline_breath = 60.0 / statistics.fmean(resp_intervals[:5]) if resp_intervals[:5] else 12.0

    output_duration = duration if duration else times[-1]
    frame_count = int(output_duration * fps) + 1
    frames = []

    for frame_index in range(frame_count):
        time_sec = frame_index / fps
        stage, _stage_progress, _target_pressure = stage_at(time_sec)

        recent_rr = window_values(rr_times, rr_values, time_sec, window=12.0)
        heart_rate, rr_interval = rate_from_rr(recent_rr, fallback=baseline_hr)
        local_rmssd = rmssd(recent_rr)
        hrv_proxy = clamp((local_rmssd - 0.012) / 0.11, 0.0, 1.0) if recent_rr else 0.5

        recent_resp_peak_times = [value for value in resp_peak_times if time_sec - 30.0 <= value <= time_sec]
        recent_resp_intervals = [
            recent_resp_peak_times[index] - recent_resp_peak_times[index - 1]
            for index in range(1, len(recent_resp_peak_times))
            if 1.6 <= recent_resp_peak_times[index] - recent_resp_peak_times[index - 1] <= 12.0
        ]
        if recent_resp_intervals:
            breath_rate = clamp(60.0 / statistics.fmean(recent_resp_intervals), 4.0, 36.0)
            if len(recent_resp_intervals) > 1:
                variability = statistics.pstdev(recent_resp_intervals) / max(statistics.fmean(recent_resp_intervals), 1e-6)
            else:
                variability = 0.15
        else:
            breath_rate = baseline_breath
            variability = 0.25

        breath_phase = sample_signal(times, resp_unit, time_sec)
        local_resp = window_values(times, resp_unit, time_sec, window=6.0)
        resp_std = statistics.pstdev(local_resp) if len(local_resp) > 2 else 0.15
        breathing_stability = clamp(1.0 - variability * 1.9 - max(0.0, 0.22 - resp_std) * 0.8, 0.0, 1.0)

        cardiac_arousal = clamp((heart_rate - baseline_hr) / 42.0 * 0.58 + (1.0 - hrv_proxy) * 0.42, 0.0, 1.0)
        baseline_deviation = clamp(
            abs(heart_rate - baseline_hr) / 45.0 * 0.45
            + abs(breath_rate - baseline_breath) / 14.0 * 0.35
            + (1.0 - breathing_stability) * 0.2,
            0.0,
            1.0,
        )
        pressure = clamp(
            baseline_deviation * 0.42
            + cardiac_arousal * 0.32
            + (1.0 - breathing_stability) * 0.16
            + (1.0 - hrv_proxy) * 0.1,
            0.0,
            1.0,
        )

        frames.append(
            round_frame(
                {
                    "time": time_sec,
                    "stageHint": stage,
                    "breathPhase": breath_phase,
                    "breathRate": breath_rate,
                    "breathingStability": breathing_stability,
                    "heartRateBpm": heart_rate,
                    "rrInterval": rr_interval,
                    "hrvProxy": hrv_proxy,
                    "cardiacArousal": cardiac_arousal,
                    "baselineDeviation": baseline_deviation,
                    "pressure": pressure,
                }
            )
        )

    return {
        "meta": {
            "schemaVersion": "guided-baseline-replay-v1",
            "sourceType": "physionet-demo",
            "source": str(input_path),
            "durationSec": output_duration,
            "fps": fps,
            "sampleRate": round(working_sample_rate, 3),
            "rPeakCount": len(ecg_peaks),
            "respPeakCount": len(resp_peaks),
            "notes": "开源数据只用于算法和噪声测试；不能在最终文档中伪装成表演者本人的身体数据。",
        },
        "frames": frames,
    }


def validate_replay(payload: dict) -> list[str]:
    errors: list[str] = []
    frames = payload.get("frames")
    if not isinstance(frames, list) or not frames:
        return ["frames 为空或不是列表"]

    last_time = -math.inf
    for index, frame in enumerate(frames):
        if not isinstance(frame, dict):
            errors.append(f"frame {index} 不是对象")
            continue
        for field in REQUIRED_FIELDS:
            if field not in frame:
                errors.append(f"frame {index} 缺少字段 {field}")
        time_value = safe_float(frame.get("time"))
        if time_value is None:
            errors.append(f"frame {index} time 不是有效数字")
            continue
        if time_value < last_time:
            errors.append(f"frame {index} time 倒退")
        last_time = time_value
        for field in REQUIRED_FIELDS:
            if field in {"stageHint"}:
                continue
            value = safe_float(frame.get(field))
            if value is None:
                errors.append(f"frame {index} {field} 不是有效数字")
        for field in ["breathPhase", "breathingStability", "hrvProxy", "cardiacArousal", "baselineDeviation", "pressure"]:
            value = safe_float(frame.get(field))
            if value is not None and not 0.0 <= value <= 1.0:
                errors.append(f"frame {index} {field} 超出 0-1 范围")
    return errors[:50]


def write_json(payload: dict, output_path: Path) -> None:
    errors = validate_replay(payload)
    if errors:
        joined = "\n".join(f"- {error}" for error in errors)
        raise ValueError(f"replay 校验失败:\n{joined}")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="生成或预处理 Guided Baseline replay JSON。")
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--synthetic", action="store_true", help="生成五分钟合成呼吸 + ECG proxy replay。")
    source.add_argument("--physionet-demo", type=Path, help="读取已下载/导出的开源 CSV 片段。")
    source.add_argument("--validate", type=Path, help="只校验已有 replay JSON。")
    parser.add_argument("--output", type=Path, default=Path("mvp/data/replay/demo_replay.json"), help="输出 replay JSON 路径。")
    parser.add_argument("--duration", type=float, default=300.0, help="输出时长，单位秒。")
    parser.add_argument("--fps", type=float, default=5.0, help="replay 输出帧率。")
    parser.add_argument("--sample-rate", type=float, default=125.0, help="无时间列 CSV 的输入采样率。")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.validate:
        errors = validate_replay(load_json(args.validate))
        if errors:
            raise SystemExit("replay 校验失败:\n" + "\n".join(f"- {error}" for error in errors))
        print(f"OK: {args.validate}")
        return

    if args.synthetic:
        payload = generate_synthetic(duration=args.duration, fps=args.fps)
    else:
        payload = preprocess_physionet_csv(
            input_path=args.physionet_demo,
            duration=args.duration,
            fps=args.fps,
            sample_rate=args.sample_rate,
        )
    write_json(payload, args.output)
    print(f"Wrote {len(payload['frames'])} frames -> {args.output}")


if __name__ == "__main__":
    main()
