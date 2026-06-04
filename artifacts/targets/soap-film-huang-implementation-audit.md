# Huang 2020 Implementation Audit

## 审计状态

阶段：M1 论文算法审计和参数锁定。

结论：当前 `artifacts/huang-clean/huang-clean-sim.mjs` 是有用的 legacy baseline，但不是 Huang et al. 2020 的严格实现。它已经使用 `eta/Gamma/u`、球面度量、近似 velocity-aligned vector advection 和 matrix-free CG，但仍包含多个论文级复现不可接受的替代项：方形低分辨率经纬网格、cell-centered 速度主状态、BFECC 替代 BiMocq2、弱近似 Gamma 系统、显式 clamp/速度上限/极区阻尼、后验质量修正、简化薄膜光学和派生 foam/phase 视觉项。

## 真实参考源

- Full Paper：`artifacts/references/HuangEtAl-SoapBubbles-SIGGRAPH2020.pdf`
- Full Paper 文本：`artifacts/references/HuangEtAl-SoapBubbles-SIGGRAPH2020.txt`
- Supplemental：`artifacts/references/HuangEtAl-SoapBubbles-SIGGRAPH2020-supp.pdf`
- Supplemental 文本：`artifacts/references/HuangEtAl-SoapBubbles-SIGGRAPH2020-supp.txt`
- 全文级本地笔记：`artifacts/targets/soap-film-huang-2020-fulltext-notes.md`
- 美学参考：`artifacts/targets/soap-film-reference.jpg`，仅作美学参考，不作物理真值。

## 论文算法硬约束

Huang 2020 主模型必须按以下路径实现：

1. 空间离散：staggered spherical grid。`eta` 和 `Gamma` 位于 cell center，`u_theta/u_phi` 位于对应 cell boundary midpoint。`phi` 周期，跨极点采样需要 `phi + pi` 和速度符号翻转。
2. 球面算子：`grad_s`、`div_s`、`laplace_s` 必须含 `sin(theta)` 度量，不能把经纬 UV 当平面。
3. 时间分裂：先解材料导数/平流，再处理 force、divergence 和 chemomechanical coupling。
4. 平流：Section 4.2 的 velocity-aligned spherical advection。向量不能把两个分量当平面标量搬运，必须在局部 flow-aligned great-circle frame 中 transport。
5. 细节保持：Section 4.2.1 的 spherical BiMocq2。维护 backward map `X` 和 forward map `Y`，失真超过论文阈值 `pi/128` 时 reset mapping。
6. Gamma 隐式步：Section 4.3 / Eq. 24-26 的 projection-like implicit SPD system。解 `Gamma` 后更新 `u` 和 `eta`，不能用显式力步或视觉 clamp 冒充。
7. 论文典型运行设置：网格 `1024 x 2048`，时间步 `0.002 s`，PCG 约 `16-27` 迭代，论文实现单步约 `1.1 s`。
8. 渲染：Section 5。薄膜光学厚度为 `2 * eta`，水折射率约 `1.33`，空气折射率 `1`；按 5nm 波长间隔积分，区分 s/p 偏振，使用复振幅 Fresnel 反射/透射，并追踪球泡多路径，论文示例使用前 `N=8` 条光路。

## 参数锁定

后续默认参数必须来自论文 Table 1 和 Table 2，而不是当前程序常量。

Table 1 dimensional parameters：

- Bubble radius `R`: `0.02 - 0.1 m`
- Mean half thickness `eta0`: `4e-7 - 1e-6 m`
- Characteristic velocity `U`: `1 m/s`
- Mean soap concentration `Gamma0`: `1e-8 - 1e-6 mol/m^2`
- Water-air surface tension: `7.275e-2 N/m`
- Gas constant: `8.3144598 J/(mol K)`
- Room temperature: `298.15 K`
- Water mass density: `997 kg/m^3`
- Water dynamic viscosity: `8.9e-4 Pa s`
- Air density: `1.184 kg/m^3`
- Air kinematic viscosity: `1.562e-5 m^2/s`
- Gravitational acceleration: `9.8 m/s^2`
- Surfactant diffusivity: `0`

Table 2 dimensionless parameters：

- Expansion parameter `epsilon`: `1e-5`
- Marangoni number `M`: `0.83`
- Reynolds number `Re`: `5.6e4`
- Drag coefficient `Cr`: `2.1`
- Scaled gravitational acceleration `g`: `0.49`

## 当前实现逐项审计

| 子系统 | 当前实现 | 论文贴合度 | M2+ 要求 |
| --- | --- | --- | --- |
| 网格尺寸 | CLI 默认 `--sim=512` 且 `nPhi = nTheta` | 不符合。论文典型为 `1024 x 2048` | 改为 `--simTheta=1024 --simPhi=2048`，方形网格不得作为验收 |
| 主状态布局 | `eta/Gamma/uTheta/uPhi` 多为 cell-centered，face arrays 多为重建/临时缓存 | 不符合 staggered 主状态 | `uThetaFace/uPhiFace` 必须成为 primary state |
| pole topology | `normalizeAngles()` 反射 theta、`phi += pi`，vector sample 符号翻转 | 部分符合，但只覆盖中心采样 | 扩展到 face velocity、map、BiMocq2、所有插值 |
| 球面散度 | `divergenceFromFaces()` 使用 `sin(theta)` 面权重 | 部分符合 | 保留思想，但基于 primary face velocity 和面积权重重写 |
| 初始条件 | 使用 procedural noise、plume、drainage、scenario patch | 只能作为 legacy baseline；不是论文结果复现参数 | M6 必须按论文结果场景重新定义 |
| 力项参数 | `M=0.72/0.92`、`Cr=0.22/0.58`、`gravityScale=0.24/0.46`、`viscosity=0.008` | 不符合 Table 2 | 使用 `M=0.83`、`Cr=2.1`、`g=0.49`、`Re=5.6e4` 等论文参数 |
| 速度更新 | `buildBaseAndBeta()` 形状近似 Eq.24a，但混入自定义参数与中心速度平均 | 部分接近，不严格 | 按 Eq.24a face-based 更新 |
| Gamma operator | `applyGammaOperator()` 用近似 face flux 加固定 `Ds=0.00012` | 不符合，论文默认 `Ds=0` 且 operator 应来自 Eq.25-26 | 构造严格 matrix-free SPD operator |
| Gamma solve | PCG 但弱 diag、RHS/solution clamp、只记录初末 residual | 不符合论文级求解 | 加入 residual history、严格预条件、面积加权对称性检查 |
| face velocity | `updateVelocityFromGamma()` 后又 `rebuildFacesFromCenters()` 覆盖 face | 不符合 staggered grid | 禁止中心速度覆盖 face 主状态 |
| 极区速度控制 | `polarDamp` 和 `maxSpeed=0.42` | 非论文算法 | 若需稳定，必须来自 CFL 或论文离散，不得硬阻尼冒充 |
| 标量平流 | `advectScalarBfecc()` 是 BFECC/round-trip correction | 不符合 BiMocq2 | M4 替换为 spherical BiMocq2 |
| 向量平流 | `advectVectorAligned()` 近似 great-circle frame transport | 部分符合 | 改为论文 Section 4.2/Appendix B half-step，且作用于 staggered face velocity |
| eta 更新 | `eta = etaAdv - dt etaAdv div(u)`，再 clamp + global mass correction | 只有方程形状接近；后验 mass correction 不严格 | 改为面积权重守恒更新，mass correction 只能作诊断兜底 |
| Gamma 质量 | `correctMass(gamma)` 后验修正 | 不符合严格守恒审计 | 来自 projection-like solve 和守恒更新 |
| phase/foam | `deriveFields()` 用 `eta/Gamma/u` 梯度、压缩和 sinusoid 生成 phase/foam | 可作为诊断；不可作为论文主物理或视觉假纹理 | 关闭其对 beauty 的白化/假相位影响，除非可追溯物理派生 |
| thin-film 渲染 | `thinFilmColor()` 用 9 个波长、高曝光、色彩增强和 foam white | 不符合 Section 5 | 实现复振幅、s/p、5nm 积分、N=8 多路径 |
| diagnostics | 记录 mass、Gamma residual 初末、debug ranges | 不足 | 增加 residual history、operator symmetry、map error、paper figure metrics |

## 必须删除或禁用的替代项

以下项不得进入“严格复现”验收路径：

- 用 BFECC 声称替代 BiMocq2。
- 用 cell-centered `uTheta/uPhi` 作为速度主状态。
- `rebuildFacesFromCenters()` 覆盖 face velocity 的主状态。
- `polarDamp`、固定 `maxSpeed=0.42` 这类非论文极区/速度视觉稳定项。
- 固定 `Ds=0.00012`，除非阶段明确切换到补充论文/参数实验；论文主场景默认 `Ds=0`。
- RHS/solution clamp 作为 Gamma solve 成功依据。
- 后验全局 mass correction 作为主要守恒机制。
- `phase` 中的任意 sinusoid 或视觉相位场参与 beauty。
- foam white 混合把画面刷白，除非来自明确物理微滴模型并通过补充论文审核。
- 参考图颜色比例或像素相似度作为论文复现验收。

## M2 入口要求

M2 不得继续调 beauty。M2 的唯一目标是把独立模拟器改成论文级 staggered spherical grid：

- 增加 `--simTheta` 和 `--simPhi`，默认 `1024 x 2048`。
- 建立 primary face velocity buffers。
- 所有 `grad_s(Gamma)`、`div_s(u)`、质量积分和 pole sampling 都基于论文网格。
- 输出 grid diagnostics：constant field、area sum、pole continuity、face divergence consistency。
- 若全尺寸运行时间在 30 分钟内，不得降分辨率验证。

## M1 结论

M1 完成。当前 baseline 可以保留作失败对照，但从 M2 开始必须按论文算法重建核心网格和算子；不能在当前近似求解器上继续靠参数、调色或 foam/phase 视觉项推进。
