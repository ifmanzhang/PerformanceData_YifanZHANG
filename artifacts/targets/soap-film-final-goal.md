# Soap Film Final Goal

## 不可变最终目标

本项目目标是严格复现 Huang et al. 2020《Chemomechanical Simulation of Soap Film Flow on Spherical Bubbles》的球面肥皂膜化学-力学耦合模拟与论文结果级视觉表现。

真实参考优先级：

1. Huang et al. 2020 Full Paper。
2. Huang et al. 2020 Supplemental。
3. Huang 官方页面与官方 video。
4. 论文中的结果图，尤其 Fig. 1、Fig. 12、Fig. 13、Fig. 14、Fig. 15、Fig. 16、Fig. 17、Fig. 19。
5. `artifacts/targets/soap-film-reference.jpg` 仅作为美学参考，不作为物理真值、像素真值或调参目标。

## 不可违反约束

- 必须严格按照 Huang 2020 论文算法实现。
- 不得自行捏造替代算法。
- 不得用贴图、参考图采样、预烘焙纹理、canvas pattern、样式拟合或假纹理。
- 不得为了视觉效果绕过 `eta/Gamma/u` 物理主状态。
- 可以使用较低分辨率做阶段内算法诊断、性能定位和失败复现，但不得把低分辨率结果当作里程碑完成验收或论文级结果。
- 默认使用论文级全尺寸设置，典型网格为 `1024 x 2048`，物理参数来自论文 Table 1、Table 2、主文和 Supplemental。
- 阶段内诊断运行以 90 分钟作为软时间标记；若超过 90 分钟，不得自动重试、不得停掉计算，必须继续等待到计算自然完成并记录真实用时。
- 每个里程碑完成前必须至少执行一次全分辨率 `1024 x 2048` 验收运行；该全分辨率验收运行不限制时长，必须保存完整结果和用时。
- 若论文未公开某个必要细节，不得擅自发明视觉算法；必须记录缺失点，并从论文上下文、Supplemental 或同行评审补充论文中寻找依据。补充论文采用前必须全文审核并确认不冲突 Huang 主模型。
- 若无法严格复现论文某结果，必须说明原因：缺少公开初始条件、参数、容差、随机种子、渲染环境，或当前实现与论文 C++/GPU 研究级管线存在不可弥补差距。

## 必须实现的 Huang 主模型

核心状态：

- 球面半厚度 `eta(theta, phi, t)`。
- 表活剂浓度 `Gamma(theta, phi, t)`。
- 球面切向速度 `u = (u_theta, u_phi)`。

核心方程：

- `D u / D t = -(M / eta) grad_s(Gamma) + Re^-1 V + bodyForces`
- `D Gamma / D t = -Gamma div_s(u) + Ds laplace_s(Gamma)`
- `D eta / D t = -eta div_s(u)`

必须包含：

- staggered spherical grid。
- 球面 `grad_s/div_s/laplace_s`，包含 `sin(theta)` 度量。
- pole crossing 的 `phi + pi` 与速度符号翻转。
- velocity-aligned spherical advection。
- Huang 论文中的 BiMocq2 球面扩展。
- Huang 论文中的 Gamma projection-like implicit SPD solve。
- 重力、外部气流 drag、Marangoni 耦合。
- 论文 Section 5 的 thin-film rendering：复振幅、s/p 偏振、5nm 光谱积分、多路径球泡光线近似。

## 完成标准

最终结果必须能以论文级设置生成：

- 重力排液场景，对应 Fig. 14 的 downward tears、upward thin rivers、drop-shaped islands。
- 外部气流剪切场景，对应 Fig. 15、Fig. 16 的条带、旋涡和速度线结构。
- 生命周期场景，对应 Fig. 17 的厚薄带下移、蒸发变薄和顶部灰化趋势。
- 渲染结果应接近论文图像的物理结构和视觉质量，而不是仅仅颜色相似。
- 所有 beauty 图必须能由 `eta/Gamma/u`、视角、曲率和论文渲染公式解释。
