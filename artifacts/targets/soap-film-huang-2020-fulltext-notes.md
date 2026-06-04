# Huang et al. 2020 Full-Text Notes

已读取材料：
- 官方页面：https://light.informatik.uni-bonn.de/chemomechanical-simulation-of-soap-film-flow-on-spherical-bubbles/
- Full Paper PDF：`artifacts/references/HuangEtAl-SoapBubbles-SIGGRAPH2020.pdf`
- Supplemental PDF：`artifacts/references/HuangEtAl-SoapBubbles-SIGGRAPH2020-supp.pdf`
- 已转文本：`artifacts/references/HuangEtAl-SoapBubbles-SIGGRAPH2020.txt` 与 `artifacts/references/HuangEtAl-SoapBubbles-SIGGRAPH2020-supp.txt`

## 不能再只用摘要
后续每轮实现前，不能只读官方页面摘要或三条简化方程。必须把主文第 3-5 节、结果/讨论第 6-7 节、附录 A/B/C 和 Supplemental 的推导作为实现约束。当前代码若与下面要点冲突，以论文全文模型为准。

## 主物理变量
- 泡泡被视为固定球面，真实变化来自球面上的材料输运，不是贴图或外部图案。
- 膜厚变量是半厚度 `eta(theta, phi, t)`，真实光学厚度为 `2 * eta`。
- 表活剂变量是 `Gamma(theta, phi, t)`，表面张力近似为 `gamma = gamma0 - gammaElastic * Gamma`。
- 速度变量是球面切向速度 `u = (u_theta, u_phi)`；径向速度只通过运动学条件与 `eta` 的变化相关，不作为主模拟自由度。
- 论文主系统里 `eta/Gamma/u` 是核心耦合场；当前项目里的 `phase/dye/foam/filament` 只能作为诊断、微滴密度或可视化辅助，不能取代主物理。

## 主方程要点
- 主文从 3D incompressible Navier-Stokes、表面应力边界条件和表活剂平流扩散方程出发，通过薄膜/润滑近似降到球面二维系统。
- 无量纲后主系统为：
  - `D u / D t = -(M / eta) * grad(Gamma) + Re^-1 * V + bodyForces`
  - `D Gamma / D t = -Gamma * div(u) + Ds * laplacian(Gamma)`
  - `D eta / D t = -eta * div(u)`
- 主文在核心模拟里通常忽略 surfactant diffusion，并可忽略粘性项；Supplemental 给出含 `Re^-1 V` 的完整粘性表达。
- 加上外力后，速度方程应按主文 Equation 17 的结构处理：Marangoni/表面力和空气阻力都除以 `eta`，重力作为体力不除以 `eta`。
- 重要修正：Huang 2020 的主模型不是把 `eta` 作为固体表面薄液层的 `h^3 grad(p)` 保守通量来驱动。当前代码中的 `p = -gamma laplacian(h)` 和 `q = -(h^3/3mu)grad(p) + ...` 可作为其他薄膜模型的启发，但不能继续作为最高优先级主线；主线应回到 `u/Gamma/eta` 的球面可压缩流耦合。

## 球面微分算子和网格
- 球面梯度、散度、拉普拉斯必须包含 `sin(theta)` 度量；不能把 UV 当平面。
- 论文使用 staggered spherical grid：`eta` 和 `Gamma` 在 cell center，`u_theta/u_phi` 在边界中点，目的是避免 checkerboard 并准确计算 `grad(Gamma)` 与 `div(u)`。
- `phi` 方向周期；跨越极点时 `phi` 平移 180 度，速度基向量发生符号翻转。当前 WebGL 近似若继续用 2D wrap/clamp，会在极区和大范围流动中偏离论文。

## 平流与细节保持
- 论文先做 operator splitting：先解材料导数/平流，再处理力和散度项。
- 标量平流用半拉格朗日回溯；向量平流不能把两个分量当平面标量搬运，而要在局部速度方向构造 great-circle/正交坐标系，把速度分解、回溯、再投回球面基。
- 为保持 `eta` 的高频细节，论文把 BiMocq2 扩展到球面：维护 backward/forward mapping，失真过大时重置映射。当前项目若继续只靠普通半拉格朗日，会把参考图所需的细丝和液滴拉丝数值耗散掉。

## 隐式 Gamma/速度更新
- 平流后得到 `u* / Gamma* / eta*`，再处理 Marangoni、drag、gravity 和散度。
- 论文将 `u` 方程与 `Gamma` 方程组合成一个关于 `Gamma` 的 SPD 线性系统，类似投影法；解出 `Gamma` 后再更新 `u` 和 `eta`。
- 这是当前实现最大缺口之一：现在仍多为显式多 pass 和局部启发项，缺少这个“Gamma pressure/projection-like”步骤，所以容易在宽片/全灭之间摆动。

## 渲染模型
- 光学层是 air-water-air 薄膜，水折射率约 `1.33`，局部厚度是 `2 * eta`。
- 干涉色来自 Fresnel 复振幅、相位差和光程差；相位差由膜厚、折射角和波长决定，不能由颜色纹理或参考图采样决定。
- 论文按波长积分并区分 s/p 偏振；球形泡泡里同一路径的多个交互可累积反射/透射，示例追踪多阶光路。项目可先用近似谱积分，但必须由 `eta`、视角、曲率法线和物理场推导。

## 结果和现象约束
- 静止重力下，泡泡上方更薄、下方更厚，会形成受视角影响的色带。
- 重力/浮力类行为会让厚区下落、薄区上升，产生向下的 tear/island 和其后的 river。
- 外部/内部空气流和 drag 会在球面上形成剪切，产生稳定细条纹。
- 蒸发可先近似为每步从 `eta` 减去小常数；黑膜约 5-30 nm，涉及范德华/静电/Born 等分子力，论文列为未来工作，当前可先不作为主线。

## 对当前代码的直接要求
1. 先把 `field.r` 严格重命名/注释为 `eta`，`field.g` 严格为 `Gamma`，不要再把 `surfactant` 与 `surfaceTension` 的梯度混着当主力。
2. 速度步主力应是 `-(M/eta) grad(Gamma)`，drag 应是 `(Cr/eta)(u_air-u)`，重力是切向体力。
3. `eta/Gamma` 更新应从当前显式通量和局部补给，逐步迁移到论文的平流后 `Gamma` 隐式系统与 `eta = eta* - dt * eta* div(u)`。
4. `phaseArea/filamentConnectivity/foam` 只能读取 `eta/Gamma/u` 派生出的曲率、剪切、收敛、Marangoni 梯度和边界条件；不能反过来主导 `eta/Gamma/u` 成为画图工具。
5. 下一轮代码不应继续调 `beauty`、构图或阈值，而应先实现共享球面算子、velocity-aligned advection 的近似版本，以及一个可调试的 `Gamma` projection/implicit pass。
