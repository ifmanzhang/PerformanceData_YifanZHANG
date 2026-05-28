# Replay 数据说明

本目录保存 MVP 可直接读取的 replay JSON。所有文件使用统一 schema，因此 `mvp/src/main.js` 不需要关心数据来自合成、开源数据集还是学校设备。

## 当前文件

- `demo_replay.json`：五分钟合成数据，模拟 calm -> guidance -> evaluation -> overload -> ending。

## 生成方式

```bash
python3 scripts/data/preprocess_replay.py --synthetic --output mvp/data/replay/demo_replay.json
```

校验：

```bash
python3 scripts/data/preprocess_replay.py --validate mvp/data/replay/demo_replay.json
```

## 开源数据测试

若已从 PhysioNet 或其他来源导出 CSV 片段，可先尝试：

```bash
python3 scripts/data/preprocess_replay.py --physionet-demo data/raw/example.csv --output mvp/data/replay/open_data_replay.json
```

CSV 最好包含 `time`、`ecg`、`respiration` 或类似列名。脚本会尝试识别 `ECG`、`II`、`MLII`、`resp`、`breath` 等常见列名。

## 语义边界

合成数据用于开发 replay 架构、调表演节奏、测试 orb / 声音 / 语音映射。开源数据用于验证 ECG + respiration 预处理能否面对真实噪声和采样格式。两者都不能在最终 portfolio 中伪装成表演者本人的身体数据。

最终表演优先使用学校设备或本人采集的离线数据；若最终只能使用开源数据，文档必须明确说明来源，并把作品概念调整为“被数据集训练出的睡眠助手”或“他人身体基线的幽灵”，而不是个人身体记录。

所有生理指标都是艺术 proxy，不是医学诊断。
