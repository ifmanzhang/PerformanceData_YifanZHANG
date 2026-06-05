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
- 全尺寸运行保存完整诊断和真实用时；不再以 30 分钟作为停止条件。
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

状态：已完成。已按 Huang Section 4.2 和 Appendix B 将点回溯改成 velocity-aligned great-circle half-step，并将向量搬运改成球面 geodesic frame transport；全尺寸 Fig. 8 类 pole-advection 测试保存到 `artifacts/huang-clean/runs/M3-pole-advection-20260604-014415`，失败的第一次测试也保留为 `M3-pole-advection-20260604-014246` 以记录偏差原因。

目标：

- 按论文 Section 4.2 实现 velocity-aligned advection。
- 标量和向量平流都沿球面 great-circle 回溯。
- 向量必须通过局部 flow-aligned frame transport，而不是 UV 平面插值。

完成条件：

- 复现论文 Fig. 8 类 sharp transition 过极区测试。
- 速度向量平流无极区爆炸和纬向断裂。
- 全尺寸运行保存 advection debug。
- commit 并 push。

结果：

- full-size grid: `1024 x 2048`。
- `dt=0.002`，4 个 pole-crossing advection steps。
- `finiteVelocity=true`。
- `poleVectorSignError=0`。
- 最终 `eta` 范围保持 `0.22..1.2`，未塌成常量。
- `totalVariationRatio=0.1583213717966035`，说明半拉格朗日仍耗散；M4 必须实现 BiMocq2。
- full-size runtime about `19.4s`。

## M4 Huang BiMocq2 球面材料映射

状态：已完成。已实现 Huang Section 4.2.1 的 spherical backward/forward material maps、spherical interpolation、`pi/128` distortion reset，并保存全尺寸 `biMocqPole` 对照结果到 `artifacts/huang-clean/runs/M4-bimocq-pole-20260604-035641`；扩展压力测试保存到 `artifacts/huang-clean/runs/M4-bimocq-pole-extended-20260604-035801`。M4 仅完成 eta pure-advection 细节保持路径，完整 `-eta div(u)` forward-map source accumulation 将在 M5/M6 后接入耦合求解。

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

状态：已完成。已按 Huang Section 4.3 与 Eq. 24-26 实现 matrix-free Gamma projection-like SPD solve，并保存全尺寸 `1024 x 2048` 验收结果到 `artifacts/huang-clean/runs/M5-gamma-projection-20260604-053501`。主验收运行使用 `dt=0.002`、`cg=22`、paper 参数，残差从 `1.9658219054583247e-5` 降到 `1.2249744356244108e-8`，reduction factor 为 `1604.7860659690248`，operator area-weighted relative asymmetry 为 `6.925791170645115e-11`，Marangoni 方向加权余弦约 `1.0`，Gamma clamp fraction 为 `0`，运行耗时 `2752 ms`。注意：raw L2 residual samples 不是每一步严格单调，但整体下降约 1600x；这已记录在当前阶段计划和 solver report 中。

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

状态：进行中。已实现 M6 paper-coupled 场景入口和全尺寸 `1024 x 2048` 运行记录；gravity、air friction、evaporation/life 三组结果均已保存为 in-progress diagnostics，但尚未达到论文 Fig. 14/15/16/17 的形态验收，不能标记完成或推送为阶段通过。2026-06-04 追加规则变更：阶段内允许低分辨率诊断，但里程碑完成前必须跑至少一次全分辨率验收；运行时间软标记改为 90 分钟，超过后不得停掉，必须等自然完成并记录真实用时。当前 full-size gravity/buoyancy `steps=260`、`dt=0.002`、`cg=16`、`deriveEvery=0` 已自然完成多轮。旧 `M6-gravity-buoyancy-paper-time-derive-final-20260604-120950` 用时 `2397321 ms`，确认重力排液趋势但暴露极区 source limiter/material clamp 和宽带形态失败；raw field 诊断显示失败集中在极帽。随后已加入 scalar pole crossing diagnostics，并把 paper-coupled `u_phi/basePhi/betaPhi` 极区处理从分辨率相关 `4*dTheta` 改为固定物理 `0.035 rad` taper。新 full-size `M6-gravity-buoyancy-paper-time-fixed-pole-taper-20260604-144105` 用时 `3805094 ms`，将 source limiter fraction 从 `0.0038099288940429688` 降到 `0.000072479248046875`，material clamp fraction 从 `0.003600597381591797` 降到 `0.000469207763671875`，map reset fraction 从 `0.0005383491516113281` 降到 `0`，Gamma residual 从旧的 `0.004266264052492427` 降到 `0.0002774470338390492`。但该结果仍然缺少 Fig.14 的 downward tears、upward thin rivers 和 drop-shaped islands，因此 M6 仍未完成。

2026-06-04 后续进展：修正 `paperGravityBuoyancy` 初始垂向厚度符号，使 `eta = baseEta - verticalEtaDrop * cos(theta) + proceduralFront` 与顶部薄、底部厚的重力排液趋势一致；并按 Huang Eq.24b/24c 的同一散度关系，把 eta material source 改为 `etaStar/GammaStar * (Gamma-GammaStar)`，不再用显式 face-divergence 另算一个不一致源项。三组全尺寸 Eq.24c diagnostics 均已自然完成并保存：gravity `M6-gravity-buoyancy-eq24c-source-front-scale-085-vdrop-055-full-20260604-185551` 用时 `2979041 ms`、air friction `M6-air-friction-eq24c-source-full-20260604-194706` 用时 `1251507 ms`、evaporation/life `M6-evaporation-life-eq24c-source-full-20260604-200835` 用时 `1254798 ms`。三组 `sourceLimiterFraction=0`、`materialClampFraction=0`、`mapResetFraction=0`，说明旧的正性/材料夹限失败已消除；但 Fig.14 仍偏宽带、Fig.15/16 仍缺细旋涡/线状速度结构、Fig.17 仍缺完整生命周期细节和 Section 5 渲染，因此 M6 仍不能标记完成。

2026-06-04 追加进展：M6 paper-coupled 速度平流已从 cell-centered vector advection 改为 staggered `uThetaFace/uPhiFace` 上的 velocity-aligned spherical vector transport，`uTheta/uPhi` 中心场仅作为派生诊断/插值量。Gravity 初始 `Gamma` 不再与厚度反相关；低分辨率测试确认 full Eq.33 equilibrium 初始化过于接近平衡，当前使用弱 Eq.33 方向纬向偏置加非平衡 procedural 初态。新的 full-size gravity run `M6-gravity-staggered-vel-gamma-bias028-front-scale-085-vdrop-055-full-20260604-210024` 自然完成，用时 `3562532 ms` (`59.38 min`)，`sourceLimiterFraction=0`、`materialClampFraction=0`、`mapResetFraction=0`、`massError=0.000019145764679404677`、`bottomMinusTopEta=0.1790505949020132`。该结果数值稳定且更贴近 staggered paper path，但仍缺 Huang Fig.14 的 downward tears、upward thin rivers、drop-shaped islands；M6 继续进行，下一步审计 BiMocq2 细节保持和论文未公开初始 noise/Perlin-like material fronts。

2026-06-04 最新诊断：低分辨率 ridged physical initial-front candidate `M6-lowres-ridged-front-staggered-gravity-bias028-front-scale-085-vdrop-055-20260604-220639` 自然完成，用时 `210096 ms`，数值稳定且 `sourceLimiterFraction=0`、`materialClampFraction=0`、`mapResetFraction=0`，但图像只增加碎噪和局部梯度，仍未形成 Fig.14 的连续 tears/rivers/islands。因此它不是验收候选；M6 下一步优先补审 Huang 引用的原始 BiMocq2 error-correction / detail-preservation 细节，而不是继续放大初始噪声。

2026-06-04 BiMocq2 补充审计：已保存 Qu et al. 2019 `Efficient and Conservative Fluids with Bidirectional Mapping` 全文 PDF/文本与代码 README，并整理 `artifacts/targets/soap-film-bimocq2-qu-2019-fulltext-notes.md`。审计结论：该论文与 Huang 不冲突，因为 Huang Section 4.2.1 明确引用它补足 error correction 等实现细节；当前独立程序缺少 Qu 的双层 mapping、gapped/regular error correction 和 extrema clamp。下一步应实现 Huang-compatible spherical two-level eta reconstruction / gapped EC，再继续 M6 形态验收。

2026-06-04 EC 对照：已实现可开关 `--biMocqEc=1/0` 的 Qu Eq.27-style eta reconstruction error correction，并保存低分辨率 EC-on / EC-off 对照。EC-on 稳定但形态几乎未改善，final mean correction 约 `0.0005273`，extrema clamp fraction 约 `0.0631`；Fig.14 coherent tears/rivers/islands 仍失败。由于当前 map error 低于 Huang `pi/128`，不能为了触发 two-level/gapped reinitialization 而自行加入非论文周期重置；M6 继续转向论文场景时间、外力、初始条件和 map-advection 精度审计。

2026-06-04 诊断修正：此前 `marangoniDirection.cosine` 误把总速度 `u` 与 `-grad_s(Gamma)` 比较，导致重力/气流主导时出现负值误报。现已改为比较 `(u - baseVelocity)` 与 `-grad_s(Gamma)`，并保留 `totalVelocityCosine`。短跑 `M6-lowres-marangoni-score-check-20260604-223528` 得到 `correctionCosine=0.9908740463746487`，说明 Marangoni 符号正确；M6 形态失败不来自全局符号翻转。

2026-06-04 长时低分辨率重力诊断：`M6-lowres-long-gravity-t156-bias028-front-scale-085-vdrop-055-20260604-223737` 自然完成，用时 `659411 ms` (`10.99 min`)，低于 `90 min` 阶段诊断软标记但仍不是里程碑验收。该 run 数值稳定：`massError=0.00004051176366317133`、`gammaResidual=0.00010177421703211192 -> 0.000013391252747470449`、`sourceLimiterFraction=0`、`materialClampFraction=0`、`mapResetFraction=0`；更长物理时间使 `bottomMinusTopEta` 达到 `0.3267180723443252`，但图像仍是纬向宽带和碎片小纹理，没有形成 Huang Fig.14 的 coherent downward tears / upward thin rivers / drop-shaped islands。因此延长时间本身不是充分条件，M6 继续进行，下一步转向 Fig.14 场景设定、外力/时间积分和 Eq.17/Eq.24-26 耦合强度审计。

2026-06-04 Eq.26 修正：审计 Huang Eq.24-26 后，将 Gamma 隐式系统从近似的 `Gamma - dt*div_s(GammaStar*beta*grad_s(Gamma)) = GammaStar - dt*GammaStar*div_s(base)` 改为论文形式 `Gamma/(GammaStar*dt) - div_s((M*dt)/(etaStar+Cr*dt)*grad_s(Gamma)) = 1/dt - div_s(base)`。全尺寸 operator audit `M6-paper-eq26-gamma-projection-fullsize-audit-20260604-2338` 用时 `8033 ms`，残差 `0.008118551670214236 -> 0.0000013915802870419416`，reduction factor `5834.05193779491`，relative asymmetry `1.587593557486631e-10`，`gammaClampFraction=0`。低分辨率 gravity 诊断表明新算子需要更高 CG 预算：`cg=16` relative residual 约 `0.0392`，`cg=64` 可降到约 `1.96e-5` 绝对残差；paper-coupled 场景已改为未显式传 `--cg` 时默认 `cg=64`。但短时和长时 corrected Eq.26 结果仍保持纬向宽带，未生成 Fig.14 的 coherent tears/rivers/islands。因此 Eq.26 修正保留为唯一论文路径，但 M6 形态缺口继续归因到 Fig.14 未公开初始条件/场景 forcing 或剩余时间积分细节，不能标记完成。

2026-06-04 Eq.34 诊断：为 `paperGravityBuoyancy` 增加并默认启用 `--gravityGammaRatio=1`，使初始 `Gamma = (gammaBase/baseEta) * eta`，对应 Huang Eq.34 的 `D(Gamma/eta)/Dt = 0` 材料不变量。低分辨率诊断 `M6-lowres-eq34-ratio-gamma-eq26-cg64-gravity-front-scale-085-vdrop-055-20260604-2348` 自然完成，用时 `244373 ms`，`gammaResidual=0.1685240970595692 -> 0.000014763756935558321`，`sourceLimiterFraction=0`、`materialClampFraction=0`、`mapResetFraction=0`，`bottomMinusTopEta=0.18281171792188367`。但该结果过于平滑、仍呈全局宽带，未形成 Fig.14 的 coherent tears/rivers/islands。因此它是方程贴合证据，不是 M6 验收候选；M6 仍继续调查论文未公开 Fig.14 初始物理场、forcing 和输运细节。

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
