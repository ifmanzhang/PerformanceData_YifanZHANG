# Raw 数据目录

这里保存未处理的离线采集或开源测试数据。原始 ECG / 呼吸数据不应直接放入最终公开 portfolio，除非数据来源、同意方式和匿名化边界都已经说明。

当前阶段可放置 PhysioNet 导出的短 CSV 片段，用于测试 `scripts/data/preprocess_replay.py --physionet-demo`。

## 当前开源测试数据

- 文件：`physionet_bidmc/bidmc_01_Signals.csv`
- 来源：PhysioNet BIDMC PPG and Respiration Dataset v1.0.0
- 用途：测试 ECG + respiration CSV 是否能转换为统一 replay JSON。
- 输出：`mvp/data/replay/bidmc_01_open_data_replay.json`
- 测试报告：`artifacts/test-runs/open_data_preprocess_bidmc_01/测试报告.json`

伦理边界：开源数据只用于算法测试和调参，不能在最终表演或文档中伪装成表演者本人身体数据。
