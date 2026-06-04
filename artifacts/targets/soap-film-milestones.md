# Soap Film Milestones

## M0 文档、自动化和分支锁定

状态：已完成。文档、当前阶段计划、当前线程 2 小时 heartbeat、新分支、M0 legacy baseline、commit 和 GitHub push 均已完成。

目标：

- 创建 `soap-film-final-goal.md`。
- 创建 `soap-film-milestones.md`。
- 创建当前阶段详细计划文件 `artifacts/targets/soap-film-current-stage-plan.md`。
- 更新当前线程 heartbeat：每 2 小时运行一次。
- 新建并切换到 `codex/huang-clean-paper-reproduction`。
- 记录当前独立程序和当前输出作为 legacy baseline，不把它当作论文复现成功状态。

完成条件：

- 两个目标文档存在。
- heartbeat 为 ACTIVE，间隔 2 小时。
- 当前分支为 `codex/huang-clean-paper-reproduction`。
- baseline 输出保存到 `artifacts/huang-clean/runs/M0-baseline-*`。
- commit 并 push 到 GitHub。

## M1 论文算法审计和参数锁定

状态：已完成。已生成 `artifacts/targets/soap-film-huang-implementation-audit.md`，明确当前独立程序与 Huang 2020 全文算法的差距，并锁定 M2 必须先重建论文级 staggered spherical grid。

目标：

- 全文重读 Huang Full Paper 和 Supplemental。
- 从论文中提取所有实现必需项：变量定义、参数表、网格布局、边界条件、时间步分裂、advection、BiMocq2、projection-like solve、rendering。
- 生成实现审计表：当前 `huang-clean-sim.mjs` 哪些严格符合论文，哪些只是近似，哪些必须删除。

完成条件：

- `artifacts/targets/soap-film-huang-implementation-audit.md` 完成。
- 参数表和方程索引可追溯到论文页码/章节。
- 明确列出不得继续使用的替代算法。
- commit 并 push。

## M2 论文级 staggered spherical grid

状态：已完成。独立程序默认全尺寸锁定为 `1024 x 2048`，`eta/Gamma` 仍为 cell center，`uThetaFace/uPhiFace` 为 staggered face 主速度存储；M2 全尺寸诊断保存到 `artifacts/huang-clean/runs/M2-paper-grid-20260604-013546`。

目标：

- 将独立模拟器主状态改为论文网格。
- `eta/Gamma` 存 cell center。
- `u_theta/u_phi` 存 staggered face。
- 全部分辨率使用 `1024 x 2048`。
- 实现严格 pole topology 和球面度量项。

完成条件：

- 常量场 `grad/div/laplace` 为零。
- pole crossing 无 seam。
- 面速度散度和面积权重质量积分自洽。
- 全尺寸运行不超过 30 分钟。
- 输出 grid diagnostics。
- commit 并 push。

结果：

- `expectedPaperGrid=true`。
- `areaRelativeError=3.9218205314127053e-7`。
- `maxZeroDivergence=0`。
- `maxConstantLaplacian=0`。
- `poleVectorSignError=0`。
- full-size diagnostic runtime about `6.2s`。

## M3 velocity-aligned spherical advection

状态：待开始。

目标：

- 按论文 Section 4.2 实现 velocity-aligned advection。
- 标量和向量平流都沿球面 great-circle 回溯。
- 向量必须通过局部 flow-aligned frame transport，而不是 UV 平面插值。

完成条件：

- 复现论文 Fig. 8 类 sharp transition 过极区测试。
- 速度向量平流无极区爆炸和纬向断裂。
- 全尺寸运行保存 advection debug。
- commit 并 push。

## M4 Huang BiMocq2 球面材料映射

状态：待开始。

目标：

- 按论文 Section 4.2.1 实现 BiMocq2。
- 维护 backward map 和 forward map。
- 使用论文失真阈值，超过阈值 reset map。
- `eta` 细节保持必须来自 BiMocq2，不得用噪声或视觉前沿补偿。

完成条件：

- 同一初始条件下，BiMocq2 比 semi-Lagrangian/BFECC 保留更清晰连续 front。
- 输出 map pair error、reset mask、advected eta。
- 全尺寸运行保存对比图。
- commit 并 push。

## M5 Gamma projection-like implicit SPD solve

状态：待开始。

目标：

- 按论文 Section 4.3 和 Eq. 24-26 实现 Gamma projection-like solve。
- 构造 matrix-free SPD operator。
- 使用论文离散关系更新 `Gamma` 和 face velocity。
- 不得用视觉 clamp 掩盖求解失败。

完成条件：

- residual history 下降。
- operator 在面积加权内积下近似对称。
- `Gamma` 更新后 `u` 与 `-grad_s(Gamma)` 响应符合 Marangoni 方向。
- 全尺寸运行保存 residual 曲线和 debug 图。
- commit 并 push。

## M6 eta/Gamma/u 全耦合论文场景

状态：待开始。

目标：

- 按论文结果章节建立三个真实场景：
  - gravity and buoyancy，对应 Fig. 14。
  - air friction，对应 Fig. 15、Fig. 16。
  - evaporation/life of bubble，对应 Fig. 17。
- 只使用论文参数和论文描述的初始条件类型。
- 不使用参考图调参。

完成条件：

- Fig. 14 场景出现 downward tears、thin rivers、drop-shaped islands。
- Fig. 15/16 场景出现 shear stripes、vortices、line-like flow structures。
- Fig. 17 场景出现 bands moving downward 和 top fading gray trend。
- 每个场景保存 beauty、eta、Gamma、velocity、divergence、mapError、diagnostics。
- commit 并 push。

## M7 论文 Section 5 渲染

状态：待开始。

目标：

- 实现论文 thin film rendering。
- 使用 `2 * eta` 光学厚度。
- 使用 Fresnel complex amplitudes。
- 分别计算 s/p polarization。
- 5nm 光谱积分。
- 实现球泡多路径 `N=8` 近似。
- 环境光不伪造参考图，只使用固定可记录环境设置。

完成条件：

- 复现论文 Fig. 3 的薄膜干涉色趋势。
- 在相同 `eta` 场下，渲染颜色能由光学公式解释。
- 论文场景 beauty 不再是大块糊色带。
- commit 并 push。

## M8 论文结果图对照

状态：待开始。

目标：

- 将当前实现输出与论文 Fig. 1、Fig. 12、Fig. 13、Fig. 14、Fig. 15、Fig. 16、Fig. 17、Fig. 19 对照。
- 参考图只记录美学差距，不参与算法判断。

完成条件：

- 每张论文关键图都有对应本地结果和对照记录。
- 差距分为：物理场差距、数值输运差距、渲染差距、论文未公开条件差距。
- commit 并 push。

## M9 美学参考靠近

状态：待开始。

目标：

- 在不违反论文算法的前提下，让结果美学接近 `soap-film-reference.jpg`。
- 只允许调论文物理参数范围内的初始条件、场景、外力、渲染环境。
- 不允许图像采样或颜色拟合。

完成条件：

- 橙金厚膜、青绿河道、紫蓝窄边、微细结构都能追溯到论文物理场或明确补充论文模型。
- 美学参考不覆盖论文验收。
- commit 并 push。

## M10 阶段封版

状态：待开始。

目标：

- 汇总最终代码、文档、运行结果。
- 说明哪些达到论文级，哪些因论文未公开条件无法逐像素复刻。
- 保留可重复运行命令。

完成条件：

- 所有核心结果保存在 `artifacts/huang-clean/runs/`。
- README 给出全尺寸复现命令。
- GitHub 已 push。
