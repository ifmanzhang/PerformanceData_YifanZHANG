# Current Stage Plan

## Stage

M0 - 文档、自动化和分支锁定

## Paper Sources Required

- Full Paper sections: 全文作为后续阶段真实参考，本阶段只锁定流程。
- Supplemental sections: 全文作为后续阶段真实参考，本阶段只锁定流程。
- Figures used as visual truth: Fig. 1、Fig. 12、Fig. 13、Fig. 14、Fig. 15、Fig. 16、Fig. 17、Fig. 19。
- Tables/parameters: Table 1、Table 2 后续 M1 提取。

## Current Gap

- Algorithm gap: 当前 `artifacts/huang-clean/huang-clean-sim.mjs` 是 Huang clean baseline，但仍包含 BFECC 替代、弱 SPD 近似、简化渲染等非严格复现环节。
- Numeric gap: 当前最新 512 baseline 的 Gamma residual 下降不足，且不是论文典型 `1024 x 2048` 全尺寸设置。
- Rendering gap: 当前 thin-film color 是简化光学，不是论文 Section 5 的复振幅、偏振、5nm 光谱积分和多路径球泡渲染。
- Result figure gap: 当前图像是宽色带和软边，未复现论文 Fig. 14/15/16 的细长材料前沿、tears、rivers、shear stripes 和旋涡结构。

## Tasks

1. 创建不可变最终目标文档 `artifacts/targets/soap-film-final-goal.md`。
2. 创建可变里程碑骨架 `artifacts/targets/soap-film-milestones.md`。
3. 创建本阶段详细计划 `artifacts/targets/soap-film-current-stage-plan.md`。
4. 新建并切换到 `codex/huang-clean-paper-reproduction`。
5. 更新当前线程 heartbeat 自动化为每 2 小时 ACTIVE。
6. 保存当前独立程序和最新输出为 M0 legacy baseline。
7. 提交并推送当前阶段结果到 GitHub。

## Full-Size Run Command

M0 不进行论文全尺寸求解；本阶段只保存已有 legacy baseline。后续阶段默认命令模板为：

```bash
node artifacts/huang-clean/huang-clean-sim.mjs --simTheta=1024 --simPhi=2048 --paperParams=1 --steps=... --dt=... --outDir=artifacts/huang-clean/runs/Mxx-...
```

## Acceptance

- Physics: 不在 M0 验收物理正确性；只明确当前 baseline 不是论文复现成功状态。
- Numerics: 不在 M0 改数值算法。
- Rendering: 不在 M0 改渲染算法。
- Paper figure comparison: 后续 M1 开始以论文图为真实参考；M0 仅锁定参考优先级。
- Runtime <= 30 min: 后续全尺寸阶段必须遵守；M0 不运行全尺寸。

## Results

- Output directory: `artifacts/huang-clean/runs/M0-baseline-20260604-012357`。
- Diagnostics: 已复制 `huang-clean-512-spd-v4-diagnostics.json`。
- Screenshots: 已复制 `huang-clean-512-spd-v4-beauty/thickness/surfactant/velocity/divergence/foam.png`。
- Automation: 已更新现有 `automation` heartbeat 为 ACTIVE，每 2 小时一次，绑定当前线程。
- Branch: 已切换到 `codex/huang-clean-paper-reproduction`。
- Git commit: 已完成，baseline 提交为 `a41b786`，M0 完成状态记录将随本文件更新提交。
- Git push: 已推送到 `origin/codex/huang-clean-paper-reproduction`。
