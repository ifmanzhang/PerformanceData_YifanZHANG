# Current Stage Plan

## Stage

M1 - 论文算法审计和参数锁定

状态：已完成。

## Paper Sources Required

- Full Paper sections: 4.1 Spatial discretization、4.2 Advection、4.2.1 Preserving details、4.3 Concentration splitting、4.4 Implementation and runtime performance、5 Soap bubble rendering、6 Results、7 Discussion。
- Supplemental sections: kinematic condition、surface stress boundary conditions、dimensionless derivation、viscosity term `Re^-1 V`。
- Figures used as visual truth: Fig. 1、Fig. 8、Fig. 10、Fig. 11、Fig. 12、Fig. 13、Fig. 14、Fig. 15、Fig. 16、Fig. 17、Fig. 19。
- Tables/parameters: Table 1、Table 2。

## Current Gap

- Algorithm gap: 当前独立程序不是严格论文实现，关键替代项包括 BFECC 替代 BiMocq2、cell-centered 速度主状态、弱近似 Gamma projection、后验 mass correction、简化 thin-film rendering。
- Numeric gap: 当前默认 `512 x 512` 方形网格，不符合论文典型 `1024 x 2048`；Gamma residual、staggered face velocity 和 pole topology 都未达到论文级。
- Rendering gap: 当前使用 9 个波长和简化 Fresnel/曝光/foam white；论文要求复振幅、s/p 偏振、5nm 光谱积分和 N=8 球泡多路径。
- Result figure gap: 当前宽色带和软边不能复现论文 Fig. 14/15/16 的 tears、rivers、shear stripes、vortices 和 line-like flow structures。

## Tasks

1. 全文重读 Huang Full Paper、Supplemental 和本地 fulltext notes。
2. 提取论文硬约束：staggered grid、sphere operators、velocity-aligned advection、BiMocq2、Gamma SPD solve、rendering、result scenarios。
3. 审计 `artifacts/huang-clean/huang-clean-sim.mjs` 的严格符合项、近似项和必须删除项。
4. 锁定 Table 1、Table 2 参数。
5. 写入 `artifacts/targets/soap-film-huang-implementation-audit.md`。

## Full-Size Run Command

M1 是审计阶段，不运行模拟。后续 M2 起默认全尺寸命令必须使用论文参数：

```bash
node artifacts/huang-clean/huang-clean-sim.mjs --simTheta=1024 --simPhi=2048 --paperParams=1 --steps=... --dt=0.002 --outDir=artifacts/huang-clean/runs/M02-...
```

## Acceptance

- Physics: 明确 Huang 主方程和不可替代算法。
- Numerics: 明确当前数值路径与论文离散差距。
- Rendering: 明确 Section 5 渲染差距。
- Paper figure comparison: 明确后续以论文 Fig. 1/12/13/14/15/16/17/19 为真实参考。
- Runtime <= 30 min: M1 不运行；M2 起全尺寸运行若小于 30 分钟不得降精度。

## Results

- Audit document: `artifacts/targets/soap-film-huang-implementation-audit.md`。
- Key conclusion: 当前独立程序只可作为 legacy baseline；M2 必须先重建论文级 staggered spherical grid。
- Git commit: 待完成。
- Git push: 待完成。
