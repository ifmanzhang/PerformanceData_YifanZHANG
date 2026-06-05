# Soap Film Target

## 目标摘要
- 构图是近景半球/穹顶，不是完整球体；画面上缘有暖黄色弧形高光，下缘有暗色虚化边缘。
- 主体色彩为橙金厚膜，约占 60-75%；橙色区域内部必须有细密液体拉丝、旋涡和微泡，而不是平滑色块。
- 青绿液膜河道约占 15-25%；河道要宽窄变化、弯曲、分叉、晕染，整体朝一个主方向缓慢流动。
- 紫蓝/玫瑰边界只贴着青绿河道和局部弯折边缘出现，不能变成整屏等高线或多边形网格。
- 白色/奶金泡沫点随机密集，聚集在橙金厚膜与河道边缘附近；不能形成规则斜线、点阵、数字噪声或栅格。
- active 渲染路径绝不采样照片、参考图、canvas 图案或预烘焙纹理；参考图只用于人工对照。

## 最高优先级参考
- 视觉目标：`artifacts/targets/soap-film-reference.jpg`。
- 物理模型目标：Huang et al. 2020, [Chemomechanical Simulation of Soap Film Flow on Spherical Bubbles](https://light.informatik.uni-bonn.de/chemomechanical-simulation-of-soap-film-flow-on-spherical-bubbles/)，以及页面里的 Full Paper PDF、Supplemental PDF 和 video。
- 这篇论文与参考图同级；后续不得只靠阈值、颜色或构图调整推进，必须把当前模拟逐步改成该论文的球面 chemomechanical/lubrication 模型。
- 最高优先级补充文献规则：当 Huang et al. 2020 未覆盖、或按该论文仍无法复现的具体物理现象/数值环节出现时，可以主动寻找对应的同行评审论文或可靠开源研究实现作为补充参考；必须下载/保存全文到 `artifacts/references/`，整理全文级笔记到 `artifacts/targets/`，并在每轮实现前阅读关键章节。
- 任何补充论文只能解释 Huang et al. 2020 未说明的局部机制；采用前必须逐项审核其假设、方程、边界条件、变量定义和数值方法是否与 Huang et al. 2020 这个核心模型冲突。若存在冲突，默认以 Huang et al. 2020 为主，除非明确记录冲突原因、适用范围，以及为什么该补充模型不会破坏 `eta/Gamma/u` 球面 chemomechanical 耦合主线。
- 已补充全文级笔记：`artifacts/targets/soap-film-huang-2020-fulltext-notes.md`。后续每轮不能只读摘要或三条简化方程，必须按主文第 3-5 节、结果/讨论第 6-7 节、附录 A/B/C 与 Supplemental 推导检查实现差距。
- 关键状态量应以论文为准：半厚度 `eta`、表活剂浓度 `Gamma`、球面切向速度 `u=(u_theta,u_phi)`、表面张力/Marangoni 耦合、球面散度/梯度/拉普拉斯、重力和外部气流体力。
- 当前实现若出现宽片、孤立竖条、连续白带或暗完整球，优先检查是否偏离 Huang et al. 的耦合方程，而不是继续盲目调色。

## 硬性约束：无贴图
- 绝对不可以用贴图逼近参考图效果。active path 不允许采样任何照片、参考图、预烘焙纹理、程序预渲染 canvas 图案或把图片贴上去扭曲/旋转。
- `artifacts/targets/soap-film-reference.jpg` 只允许作为人工观察和截图对照目标；不能进入 shader、不能传给 `TextureLoader`、不能被 canvas 读入生成图案。
- 允许使用 GPU render target，因为它保存的是实时模拟出来的膜厚、速度、表活剂、相场、泡沫密度等物理状态，不是外部图案。
- 允许使用程序化 noise/hash，但只能作为初始扰动、微扰动或不稳定性来源；不能直接当作最终贴图图案来糊在表面。
- 如果某一版看起来像“贴了一张图在转”“彩色纹理被扭曲”“静态图案漂移”，即使颜色相似也判定失败。

## 物理模拟方案
- 当前核心需求不是“模仿参考图”，而是用真实物理算法生成肥皂泡表面液滴/膜厚不均，再由膜厚不均产生薄膜干涉色；参考图只能帮助判断质感，不能成为拟合目标或图案来源。
- 用低精度 GPU 物理模拟替代贴图：膜厚 `h`、表活剂 `gamma`、青绿薄膜相/染料 `phase/dye`、泡沫/微滴密度 `foam`、速度场 `v` 必须随时间真实演化。
- Huang et al. 2020 的最低对齐目标：
  - `D u / D t = -(M / eta) * grad(Gamma) + Re^-1 * V + bodyForces`
  - `D Gamma / D t = -Gamma * div(u) + Ds * laplacian(Gamma)`
  - `D eta / D t = -eta * div(u)`
  - 所有 `grad/div/laplacian` 必须使用球面度量，不能退化成平面 UV 贴图逻辑。
- 按全文修正后的优先级：Huang 2020 主模型应优先实现 `u/Gamma/eta` 的球面可压缩流耦合、速度方向对齐的球面平流、BiMocq2/细节保持和 `Gamma` 隐式 projection-like 更新；旧的固体表面薄液层式 `h^3 grad(p)` 保守通量只能作为次级启发，不能继续压过论文主方程。
- 每步模拟至少包含：半拉格朗日平流、主流向/重力排液、Marangoni 表面张力梯度、毛细回缩、粘性扩散、泡沫生成/衰减、边界回流或质量限制。
- 优先用薄膜流守恒通量更新膜厚：膜厚压力来自 `p = -gamma * laplacian(h) + disjoining/hydrostatic terms`，速度/通量来自 `h^3 * grad(p)`、`h^2 * grad(gamma)` 和切向重力；膜厚变化来自 `-div(h * v)`，不是直接按颜色或 UV 画出来。
- 青绿河道必须来自 `phase/dye` 场的相分离、平流、扩散、拉伸和分叉；不能由颜色边缘、UV 等高线或固定图案伪造。
- 橙金厚膜必须来自较高膜厚区域；泡沫点和拉丝必须来自 `foam`、局部剪切、相场边界、膜厚梯度和速度方向。
- 薄膜干涉色只从膜厚、视角、曲率、相场边界和泡沫状态推导；不能手动画一张彩色纹理。

## 性能取舍
- 先实现效果，再考虑性能；允许 384/512 分辨率、8-24 子步、几十次压力迭代、首次预热或延迟渲染。
- 默认 simulation 可以固定 30Hz，渲染帧率可限制；标签页不可见或前端未打开时必须暂停模拟和渲染，避免后台耗电。
- 为了性能可以减少子步数、降低分辨率、降低粒子/泡沫细节，但不能牺牲“实时物理场驱动”的原则。

## 失败判定
- 只要 active path 采样参考图、照片、预烘焙纹理或 canvas 图案，直接失败。
- 只要视觉主要像一张贴图在球面上扭曲、旋转或漂移，直接失败。
- 只要青绿洗满全屏、边界像多边形网格、泡沫点成规则斜线/点阵、旧内核曲线可见，都必须继续改。
- 做不到参考图的物理质感时，应该继续改物理场和渲染映射，而不是用贴图补效果。

## 每轮检查
- 打开本文件和 `artifacts/targets/soap-film-reference.jpg`。
- 生成截图到 `artifacts/soap-film-runs/run-N.png`。
- 截图后重新对照参考图，记录相似点、偏差和下一步。
- 如果出现青色洗满全屏、边界像多边形格子、泡沫点成规则斜线，必须继续改。

## 当前优先级
1. 先确保 `solid` debug 壳层可见、`window.__soapFilmDebug` 非空、浏览器控制台无 shader/WebGL 错误。
2. 把 Huang et al. 2020 的球面 chemomechanical 方程作为主线实现，而不是继续调构图或调 beauty 颜色。
3. 若 Huang et al. 2020 未覆盖的环节仍无法复现，先寻找、保存并全文审核补充论文；必须确认它不冲突于 Huang et al. 2020 的核心 `eta/Gamma/u` 球面耦合后再采用。
4. 用 `thickness/phase/velocity/foam/filamentConnectivity/phaseArea` 验证物理场是否自洽，再看 beauty。
5. 只有物理场先形成橙金厚膜岛、青绿分叉河道、紫蓝窄边和离散微滴密度后，才允许微调干涉色映射。
