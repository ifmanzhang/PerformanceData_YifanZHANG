# Soap Film Iterations

## 2026-06-01 heartbeat / Run 2472-2511: 诊断确认 phase 全场高值，加入物理上限后高相预算回到约 19%，但河道仍未成形

本轮开始前重新读取了 `artifacts/targets/soap-film-huang-2020-fulltext-notes.md`、`artifacts/targets/soap-film-physics-handoff.md`、`artifacts/targets/soap-film-target.md` 和本迭代记录，并重新对照 `artifacts/targets/soap-film-reference.jpg`、上一轮最新 `run-2469-beauty-huang-eta-feedback-loop-headed-low.png`、`run-2471-thickness`、`run-2460-phase`、`run-2462-foam`、`run-2464-phaseArea`、`run-2465-phaseAreaError`、`run-2466-etaGammaVelocity`、`run-2467-gammaCandidate` 和 `run-2468-gammaRhsResidual`。改前结论：上一轮 `eta/Gamma/u` 同子步反馈让厚膜回升，但 `phase` 仍近乎整球青片、`foam` 是宽雾，beauty 没有参考图里的青绿分叉河道、紫蓝窄边和边界微滴。Huang 全文对照说明这不是构图问题，而是辅助相场没有被限制到局部 `eta/Gamma/u` 压缩、Marangoni 前沿和球面连通细丝上。

本轮只改 `mvp/src/visual/thinFilmSim.js`，没有改构图、相机、beauty 调色，也没有使用贴图、参考图采样、预烘焙纹理、canvas 图案、样式拟合或假纹理。第一版改动把 `FIELD_STEP` 和 `PHASE_STEP` 中旧的噪声/sourceLane/areaFillBudget 宽片正反馈压低，并增强 broad-sheet drain；验证 `run-2472` 到 `run-2485` 显示 shader/WebGL 无错误，`solid` 可见，但效果仍失败：beauty 内部纹理略增强，`phase` 仍是宽片，`eta thickFraction` 从上一轮 beauty 的约 `0.50` 回落到约 `0.33`。这说明继续猜 gate 阈值不够，必须读回真实 `field.a/field.b`。

第二版新增 `FIELD_DIAGNOSTIC_FRAGMENT_SHADER` 和 `fieldDiagnosticTarget`，把实时 `field.rgba = eta/Gamma/foam/phase` 原样编码进 `window.__soapFilmDebug.filmDiagnostics`，并新增 `foam`、`phase` 的 min/max/mean/visibleFraction/highFraction 数值读回。验证 `run-2486` 到 `run-2498` 证明新增诊断不破坏 shader；它同时明确暴露真实失败：`run-2497 beauty` 中 `phase.mean=0.4756`、`phase.highFraction=1.0`，也就是相场真实全场高值，不只是 debug 色误导；`foam.mean=0.0095`、`foam.visibleFraction=0`，说明奶金/白色微滴密度还没有起来。

第三版在 `FIELD_STEP` 与 `PHASE_STEP` 后加入 phase ceiling relaxation：只有在局部 `physicalFillGate`、`pathGate`、`riverFilament`、`connectedFilament`、`filamentBridge`、`physicalRiverPotential` 和 `filamentPhaseSource` 等来自 Huang 主链/细丝证据的地方允许高相保留；无证据区域被压回低基线。验证 `run-2499` 到 `run-2511`：`solid` 可见，`thickness` 补拍 `run-2511` 有效，所有最终有效视图 console/shader/WebGL problem count 为 0。`run-2510 beauty` 读回 `eta mean=0.6005`、`eta thickFraction=0.4023`、`Gamma mean=0.4713`、`velocity.interiorActiveFraction=0.1961`、`projectedDivergence.interiorCompressionSmallFraction=0.1054`、`phase.mean=0.2802`、`phase.highFraction=0.1916`、`foam.mean=0.0244`、`foam.visibleFraction=0.1989`。这比 `phase.highFraction=1.0` 是实质进展：高相面积预算回到了目标 15-25% 附近。

但视觉仍没有达标。`run-2501 phase` 从全青片变成紫/青局部岛和短裂纹，证明 ceiling 有效；可它仍不是参考图中连续弯曲、分叉、宽窄变化的青绿河道。`run-2505 phaseArea` 仍大面积平滑偏粉/紫，说明 tile-level 预算和 physicalFillGate 没有形成窄连通骨架。`run-2503 foam` 有灰白/奶金宽片和局部点，但不是沿橙金/青绿边界的离散高密度微滴。`run-2510 beauty` 现在有更多奶金/橙金液滴纹理和局部青绿小亮点，但粗 HSV 统计仍为 `cyanGreen=0`、`purpleBlue=0`，参考图同口径约 `cyanGreen=0.0507`、`purpleBlue=0.0303`；所以不能说相似，只能说从“相场全场错误”推进到了“相场面积预算接近但连通形态失败”。

Huang et al. 2020 全文模型对照：当前仍是显式/capped WebGL 近似，不是论文第 4.3 节的 staggered spherical SPD `Gamma` projection-like solve，也没有 velocity-aligned/BiMocq2 球面平流，所以 `eta/Gamma/u` 的局部收缩带会耗散成岛块或宽片。新增 phase ceiling 是防止辅助相场反过来主导主物理场的约束，方向符合“phase/foam 只能读取 `eta/Gamma/u` 派生证据”；但下一步必须把 `phaseArea/filamentConnectivity` 从平滑预算改成真正的球面 geodesic/front-distance 连通场，否则 beauty 仍不会出现参考图的青绿分叉河道和贴边紫蓝窄线。

下一步计划：

1. 不改构图、不调 beauty 色彩、不引入任何贴图/参考图/预烘焙/canvas 伪造；保留本轮 field 读回诊断和 phase ceiling。
2. 审计 `PHASE_AREA_FRAGMENT_SHADER` 的 `physicalLineEvidence/narrowPhysicalGate/fillBudget/sheetDrain`：现在面积预算数值对了，但 spatial support 仍平滑；下一轮要把它改成基于 `etaGammaVelocity`、`gammaCandidate`、`projectedDivergence` 和持久化 filament 的窄连通 front-distance。
3. 给 `filamentConnectivity` 增加更强的 geodesic relaxation/age-distance 约束，让 `phase.highFraction≈0.18-0.24` 只分配到分叉骨架，而不是岛块；宽片和孤立块继续排水。
4. foam 出生只允许在 phase 边界、局部剪切、曲率、Marangoni 梯度和 filament edge 同时成立的位置累积，目标是从 `foam.visibleFraction≈0.20` 的宽雾转成参考图那种边界离散微滴。
5. 下一轮继续完整跑 `solid -> thickness -> phase -> velocity -> foam -> filamentConnectivity -> phaseArea -> phaseAreaError -> etaGammaVelocity -> gammaCandidate -> gammaRhsResidual -> beauty`，并把截图、数值读回、参考图/Huang 全文偏差写回本文件。

## 2026-06-01 heartbeat / Run 2458-2471: eta 加入 Gamma projection 同子步反馈，厚膜和压缩信号回升但河道仍失败

本轮开始前重新读取了 `artifacts/targets/soap-film-huang-2020-fulltext-notes.md`、`artifacts/targets/soap-film-physics-handoff.md`、`artifacts/targets/soap-film-target.md` 和本迭代记录，并重新对照 `artifacts/targets/soap-film-reference.jpg`、上一轮最新 `run-2456-beauty-huang-fieldstep-narrow-channel-headed-low.png`、`run-2457-thickness`、`run-2447-phase`、`run-2448-velocity`、`run-2449-foam`、`run-2451-phaseArea`、`run-2452-phaseAreaError`、`run-2453-etaGammaVelocity`、`run-2454-gammaCandidate` 和 `run-2455-gammaRhsResidual`。改前结论：上一轮相对更早版本已有厚膜回升，但仍是小完整橙球和少量微滴；参考图的橙金厚膜岛、青绿分叉河道、紫蓝窄边和奶金/白色微滴密度仍基本没有出现。Huang 全文对照也说明失败不在构图，而在 `Gamma_candidate -> u_after_gamma -> div_s(u_after_gamma) -> eta/Gamma continuity` 没有形成同子步闭环。

本轮只改 `mvp/src/visual/thinFilmSim.js` 的 Huang 主链，没有改构图、相机、beauty 调色，也没有使用贴图、参考图采样、预烘焙纹理、canvas 图案、样式拟合或假纹理。代码审计发现 `GAMMA_DIVERGENCE_FEEDBACK_FRAGMENT_SHADER` 在每个 Gamma projection 外循环里已经读取 `gammaCandidateTarget`、更新速度后的 `u` 和 `gammaProjectionDivergenceTarget`，但它只按 `D Gamma / Dt = -Gamma div_s(u) + Ds laplacian(Gamma)` 回写 `Gamma`，`eta` 仍原样透传；真正的 `D eta / Dt = -eta div_s(u)` 只在整个 projection 循环之后由 `GAMMA_CONTINUITY_FRAGMENT_SHADER` 做一次。按 Huang et al. 2020 第 4.3 节的 projection-like 更新意图，这会让同一子步的下一轮 Gamma solve 看不到刚生成的厚度收缩/膨胀反馈。

实现改动：在 `GAMMA_DIVERGENCE_FEEDBACK_FRAGMENT_SHADER` 中加入 `eta` 连续项，使用同一个球面散度、存储的 projection divergence、`lapEta` 和局部稳定门控计算 `etaNext = eta + dt * (-eta div_s(u))`，压缩处弱增强厚膜、扩张处弱排水，并保留很小的 `lapEta` 平滑与高频厚度保持；同时把循环后的 `gammaContinuity` 额外步从 `gammaVelocityDt * 0.86` 降到 `0.42`，避免新增同子步 `eta` 回写后重复过冲。`node --check mvp/src/visual/thinFilmSim.js` 通过。

验证为 `run-2458` 到 `run-2469`，补拍有效 thickness `run-2471-thickness-huang-eta-feedback-loop-headed-low-retry2.png`。所有有效视图 console/shader/WebGL problem count 为 0，`solid` 可见，`run-2458-solid` 为纯红壳层。`run-2469 beauty` 读回 `eta min=0.4510 max=0.9608 mean=0.6331 thickFraction=0.5009`，`Gamma mean=0.4488`，`velocity.interiorActiveFraction=0.3219`，`projectedDivergence.interiorCompressionSmallFraction=0.3731`，`gammaRhsResidual.nonZeroFraction=0.4848`，`gammaDeltaMagnitude.nonZeroFraction=0.2567`。相对上一轮 `run-2456` 的 `eta mean=0.5815 thickFraction=0.3364`，厚膜和内部压缩反馈确实增强，说明补上的同子步 eta 回写有效。

但视觉仍明显失败。新 beauty 仍是完整球体，主要为暗橙/橙金薄膜，只有很弱的黄绿痕迹；没有参考图中贯穿且分叉的青绿河道，没有沿河道贴附的紫蓝窄边，奶金/白色微滴也远低于参考图。粗 HSV 统计写入 `run-2469-huang-eta-feedback-loop-comparison.json`：参考图为 `orangeGold=0.3637 cyanGreen=0.0675 purpleBlue=0.0385 creamWhite=0.0471 bright=0.4134`；上一轮 `run-2456` 为 `orangeGold=0.1254 cyanGreen=0 purpleBlue=0 creamWhite=0.0053 bright=0.1143`；本轮 `run-2469` 为 `orangeGold=0.1827 cyanGreen=0 purpleBlue=0 creamWhite=0.0011 bright=0.1712`。也就是说主链厚度更强，但参考图最核心的青绿/紫蓝结构仍为 0。

失败原因对照 Huang 全文：本轮更接近 `eta/Gamma/u` 在同一 projection 子步内耦合，且 `etaGammaVelocity/gammaCandidate/gammaRhsResidual` 诊断显示 `Gamma` 不再只是静态诊断；但当前仍是 capped explicit WebGL 近似，不是 staggered spherical SPD solve，也没有 velocity-aligned/BiMocq2 细节保持。更直接的问题是辅助相场仍不合格：`phase` 调试图几乎整球青绿，`phaseArea` 仍是平滑宽片，`phaseAreaError` 只在边缘/局部块状区域有信号。这说明 `eta/Gamma/u` 已产生一些压缩和厚膜变化，但 `field.a/phase` 与 `foam` 还没有被严格限制到局部连通压缩带与 Marangoni 前沿，反而把整球染成宽片；beauty 只能反映这个失败物理场，不能用调色或构图掩盖。

下一步计划：

1. 继续不改构图、不调 beauty 色彩、不引入任何贴图、参考图、预烘焙、canvas 或样式拟合。
2. 保留本轮 `eta` 同子步反馈，但审计 `FIELD_STEP` / `PHASE_STEP` 中所有会把 `field.a` 推成整球青绿宽片的源项和回补项；相场只允许从局部 `projectedDivergence` 压缩、`grad_s(Gamma)` 前沿、`eta` 谷/边界、剪切和曲率派生。
3. 把 `phaseArea` 的目标从“调阈值”改成物理约束：先用 `etaGammaVelocityTarget` 和 `gammaCandidateTarget` 的显式诊断生成窄连通候选，再让 `field.a`/foam 只沿这些候选演化，过量从 broad sheet 和孤立块抽走。
4. 若相场严格绑定 Huang 主链后仍没有微滴密度，再按目标文档规则寻找补充同行评审论文或可靠开源研究实现，保存全文并审核是否与 Huang 的 `eta/Gamma/u` 球面耦合冲突。
5. 下一轮继续完整跑 `solid -> thickness -> phase -> velocity -> foam -> filamentConnectivity -> phaseArea -> phaseAreaError -> etaGammaVelocity -> gammaCandidate -> gammaRhsResidual -> beauty`，并把截图、数值读回、参考图/Huang 模型偏差写回本文件。

## 2026-06-01 heartbeat / Run 2432-2457: phaseArea 接入显式 Huang 诊断场，FIELD_STEP 收窄后厚膜回升但河道仍失败

本轮开始前重新读取了 `artifacts/targets/soap-film-huang-2020-fulltext-notes.md`、`artifacts/targets/soap-film-physics-handoff.md`、`artifacts/targets/soap-film-target.md` 和本迭代记录，并重新查看 `artifacts/targets/soap-film-reference.jpg`、上一轮最新 `run-2430-beauty-huang-narrow-physical-phase-gate-headed-low.png`、`run-2431-thickness`、`run-2422-phase`、`run-2423-velocity`、`run-2424-foam`、`run-2426-phaseArea` 等调试图。改前对比结论：参考图仍是大面积橙金厚膜岛、青绿分叉河道、贴河道紫蓝窄边和密集奶金/白色微滴；`run-2430` 仍是小完整球，一条暗绿/黄绿带和少量微滴，`phase` 是整球青绿宽片，`velocity` 仍全场彩带，`phaseArea` 近乎平滑，没有形成 Huang 模型中 `eta/Gamma/u` 局部闭环应产生的分叉压缩带。

本轮只改 `mvp/src/visual/thinFilmSim.js` 的物理求解/相场派生，没有改构图、相机或 beauty 调色，也没有使用贴图、参考图采样、预烘焙纹理、canvas 图案、样式拟合或假纹理。第一步给 `PHASE_AREA_FRAGMENT_SHADER` 接入已存在的 `etaGammaVelocityTarget` 和 `gammaCandidateDiagnosticTarget`，让 `phaseArea` 直接读取显式诊断出的 `projectedDivergence`、`gammaRhsResidual`、`DeltaGamma` 和 `|u|`，而不是在多个 shader 内重复估算散度；同时把 `phaseAreaError` 临时改成 `physicalLineEvidence/narrowPhysicalGate/broadSheet/deficit` 诊断。第二步降低 `FIELD_STEP` 与 `PHASE_AREA` 的球面导数 cap，并压低 `physicalRiverPotential -> channelSupport/channelCore/targetDye/foamBirth` 的正反馈，增加 broad sheet 排水，目标是把整球相场宽片收回局部物理证据。

第一组验证为 `run-2432` 到 `run-2443`，补拍 `run-2444-thickness-huang-explicit-closure-phasearea-headed-low-retry.png`。所有成功视图 console/shader error 为 0，`solid` 可见，补拍 thickness `ready=true`。该组证明显式诊断 target 已接通，但视觉仍失败：`run-2443 beauty` 读回 `eta mean=0.4519`、`thickFraction` 未明显提升，`velocity.interiorActiveFraction=0.6684`，`gammaRhsResidual.nonZeroFraction=0.6483`，`gammaDeltaMagnitude.nonZeroFraction=0.3528`；图像仍是完整橙球加弱绿带，`phase` 仍宽片。粗统计同口径为 `run-2443 orangeGold=0.123258 cyanGreen=0 purpleBlue=0 creamWhite=0.000352 bright=0.126890 meanVal=0.090170`，相对 `run-2430` 只有橙金略升，核心青绿/紫蓝仍为 0。

随后第二版继续收窄 `FIELD_STEP` 的 `channelSupport/channelCore/targetDye`，验证为 `run-2445` 到 `run-2456`，补拍 `run-2457-thickness-huang-fieldstep-narrow-channel-headed-low-retry.png`。该组数值比上一组更稳：中间视图 `velocity.interiorActiveFraction` 多数降到 `0.19-0.31`，`run-2456 beauty` 为 `eta mean=0.5815`、`thickFraction=0.3364`、`Gamma mean=0.4040`、`velocity.interiorActiveFraction=0.4676`、`gammaRhsResidual.nonZeroFraction=0.5609`、`gammaDeltaMagnitude.nonZeroFraction=0.2976`。相对 `run-2430` 的 `thickFraction=0.0562` 和 `vInterior=0.6389`，厚膜岛方向和速度过活跃都有改善；但 beauty 仍没有参考图中的青绿分叉河道和紫蓝窄边。粗统计写入 `run-2456-huang-fieldstep-narrow-channel-comparison.json`：参考图为 `orangeGold=0.371604 cyanGreen=0.045410 purpleBlue=0.026613 bright=0.526629`，`run-2456` 为 `orangeGold=0.124770 cyanGreen=0 purpleBlue=0 creamWhite=0.000657 bright=0.125823 meanVal=0.099370`。

Huang et al. 2020 全文模型对照：本轮改动让辅助相场更明确地从 `eta/Gamma/u` 的显式闭环诊断读取证据，符合“phase/foam 不能反过来主导主物理场”的要求；降低导数 cap 和宽片正反馈也让 `eta` 厚区不再被相场过度冲散。但这仍不是论文第 4.3 节的 staggered spherical SPD `Gamma` projection-like solve，也没有 velocity-aligned/BiMocq2 细节保持。当前失败已经说明继续调 `channelCore/targetDye` 阈值收益很低：`Gamma/u/eta` 主链没有生成内部分叉压缩网络，beauty 自然不会出现青绿河道和贴边紫蓝。

下一步计划：

1. 不改构图、不调 beauty 色彩、不引入任何贴图/参考图/预烘焙/canvas 伪造。
2. 暂停继续堆 phaseArea 阈值；回到 Huang 4.3 主链，把 `Gamma_candidate -> u_after_gamma -> div_s(u_after_gamma) -> eta/Gamma continuity` 做成同一子步内可反馈的多 pass，并用读回约束 `Gamma` 不塌陷、`DeltaGamma` 不只是诊断可见、内部 `projectedDivergence` 出现局部连通压缩带。
3. 继续保留本轮显式诊断 target 作为 `phaseArea/foam` 的唯一物理证据来源；如果主链有压缩带但仍缺微滴/破裂，再按目标文档规则寻找补充同行评审论文并全文审核是否与 Huang 的 `eta/Gamma/u` 球面耦合冲突。
4. 下一轮仍完整跑 `solid -> thickness -> phase -> velocity -> foam -> filamentConnectivity -> phaseArea -> phaseAreaError -> etaGammaVelocity -> gammaCandidate -> gammaRhsResidual -> beauty`，并把截图、数值读回、与参考图/Huang 全文的偏差继续写回本文件。

## 2026-06-01 heartbeat / Run 2409-2431: FIELD_STEP 接入物理河道证据，微滴恢复但相场仍宽片且速度过强

本轮开始前按自动化要求重新读取了 `artifacts/targets/soap-film-huang-2020-fulltext-notes.md`、`artifacts/targets/soap-film-physics-handoff.md`、`artifacts/targets/soap-film-target.md` 和本迭代记录，并重新查看 `artifacts/targets/soap-film-reference.jpg`、上一轮最新 `run-2408-beauty-huang-spherical-derivative-scale-balanced-headed-low.png`，以及 `run-2399-thickness`、`run-2401-velocity`、`run-2402-foam`、`run-2404-phaseArea` 等调试图。改前对比结论：参考图仍是橙金厚膜岛被青绿分叉河道切开，河道两侧有紫蓝窄边和密集奶金/白色微滴；`run-2408` 虽然 `Gamma/u` 闭环已恢复，但 beauty 仍是小完整橙球，青绿/紫蓝统计为 0，`phaseArea` 只是柔和色块，没有从 `projectedDivergence/grad_s(Gamma)/eta` 谷线派生出分叉通道。

本轮只改 `mvp/src/visual/thinFilmSim.js` 的物理求解与相场派生，没有改构图、相机或 beauty 调色，也没有使用贴图、参考图采样、预烘焙纹理、canvas 图案、样式拟合或假纹理。第一步在 `FIELD_STEP_FRAGMENT_SHADER` 中给球面梯度/通量散度补入受限导数尺度，并新增 `physicalRiverPotential`：它只由 `-div_s(u)`/`flowConvergence`、`eta` 谷线、`grad_s(Gamma)` 前沿、曲率和剪切得到；同时降低 `sourceLane/noise` 对 `eta/Gamma/dye/foam` 的直接驱动，削弱把 `Gamma` 拉回常数的 `surfactantReservoir`。第二步在 `PHASE_AREA_FRAGMENT_SHADER` 中增加球面梯度/速度散度、`physicalLineEvidence` 和 narrow gate，让 `phaseArea` 更依赖横向物理前沿、压缩带和 `Gamma` 梯度，而不是旧的宽 sheet 或单纯相场高值。

第一组验证为 `run-2409` 到 `run-2419`，覆盖 `solid -> thickness -> phase -> velocity -> foam -> filamentConnectivity -> phaseArea -> etaGammaVelocity -> gammaCandidate -> gammaRhsResidual -> beauty`，结果 JSON 为 `run-2409-2419-huang-physical-derived-phase-fieldstep-headed-low-capture-results.json`。除 `thickness` 导航等待超时但已保存错误截图外，其余视图控制台/shader error 为 0，`solid` 继续可见。该组证实物理证据确实能激活相场和微滴：`run-2419 beauty` 的 `creamWhite` 从 `run-2408` 的 `0.000489` 升到 `0.005423`，但速度明显过强，`velocity.interiorActiveFraction=0.7325`、`gammaDeltaMagnitude.nonZeroFraction=0.3778`、`gammaRhsResidual.nonZeroFraction=0.8276`；`phase` 调试几乎整球青绿，说明没有足够 narrow gate，物理证据变成宽片而不是河网。

随后第二版降低 `FIELD_STEP` 导数 cap 到 `3.2`，`phaseArea` cap 到 `3.0`，并加入横向物理前沿必须强于纵向前沿的 `narrowPhysicalGate`。验证为 `run-2420` 到 `run-2430`，补拍 `run-2431-thickness-huang-narrow-physical-phase-gate-headed-low-retry.png` 以取得 thickness debug；主要 JSON 为 `run-2420-2430-huang-narrow-physical-phase-gate-headed-low-capture-results.json`，补拍 JSON 为 `run-2431-thickness-huang-narrow-physical-phase-gate-headed-low-retry.json`。该组没有 shader/WebGL console error；`run-2430 beauty` step `367` 为 `eta mean=0.4472 thickFraction=0.0562`、`Gamma mean=0.3494`、`velocity.interiorActiveFraction=0.6389`、`gammaDeltaMagnitude.nonZeroFraction=0.3499`、`gammaRhsResidual.nonZeroFraction=0.7564`。narrow gate 把整球相场压窄了一些，beauty 中出现一条暗绿/黄绿带和更多奶金微滴，但速度仍偏全场过活跃，且河道仍不分叉。

图像统计写入 `run-2419-huang-physical-derived-phase-fieldstep-comparison.json` 与 `run-2430-huang-narrow-physical-phase-gate-comparison.json`。同一 HSV 粗口径下，参考图为 `orangeGold=0.313612 cyanGreen=0.039702 purpleBlue=0.026393 creamWhite=0.017673 bright=0.297683`；上一轮 `run-2408` 为 `orangeGold=0.129951 cyanGreen=0 purpleBlue=0 creamWhite=0.000489 bright=0.019634`；宽片版 `run-2419` 为 `orangeGold=0.117226 cyanGreen=0 purpleBlue=0 creamWhite=0.005423 bright=0.052721`；窄门版 `run-2430` 为 `orangeGold=0.109775 cyanGreen=0 purpleBlue=0 creamWhite=0.004451 bright=0.026053`。因此本轮只恢复了部分微滴/亮边和一条物理相场带，仍没有参考图核心的青绿分叉河道、紫蓝窄边和大面积橙金厚膜岛。

Huang et al. 2020 全文模型对照：本轮把相场/泡沫派生更直接地挂到 `eta/Gamma/u` 的球面压缩、`grad_s(Gamma)`、曲率和剪切上，比旧的 `sourceLane/noise` 驱动更符合“辅助场只能由主物理场派生”的要求；但当前仍是 capped explicit multi-pass，不是论文中的 staggered spherical SPD `Gamma` projection-like solve，也没有 velocity-aligned/BiMocq2 的细节保持。新暴露的问题是 `FIELD_STEP` 自己重新计算的通量散度和相场 gate 会把速度/相场推向宽片或全场活跃；它还没有形成 Huang 模型里那种沿局部前沿移动、收缩、破裂的 river/island 结构。

下一步计划：

1. 不改构图、不调 beauty 颜色、不引入任何图像/纹理伪造。保留本轮“辅助场从物理证据派生”的方向，但继续压低 `FIELD_STEP` 对速度/相场的全场正反馈。
2. 把 phase/river 派生改为优先读取已经存在的 `etaGammaVelocity/gammaCandidate` 诊断 target 或显式 `projectedDivergence` target，而不是在多个 shader 中各自重新估计散度；目标是减少 `velocity.interiorActiveFraction` 从 `0.64-0.73` 这种全场活跃回到局部连通压缩带。
3. 给 `phaseArea` 增加更细的调试读回或诊断颜色，区分 `physicalLineEvidence`、`broadSheet`、`narrowPhysicalGate`、`targetHigh` 和 `fillBudget`，先让调试图出现真正窄且分叉的通道，再期待 beauty 的 `cyanGreen/purpleBlue` 非零。
4. 继续审计 `FIELD_STEP` 中的旧 `thinFilmFlux/sourceLane/reservoir` 项，保证 `eta = eta* - dt * eta* div_s(u)` 和 `Gamma` continuity 不被旧的薄液层/源项覆盖；如这一主链稳定后仍缺微滴成核，再按目标文档规则寻找补充论文并全文审核冲突。

## 2026-06-01 heartbeat / Run 2387-2408: 补入受限球面导数尺度，Huang 闭环恢复但河道仍未成形

本轮开始前按自动化要求重新读取了 `artifacts/targets/soap-film-huang-2020-fulltext-notes.md`、`artifacts/targets/soap-film-physics-handoff.md`、`artifacts/targets/soap-film-target.md` 和本迭代记录，并重新查看 `artifacts/targets/soap-film-reference.jpg`、上一轮最新 `run-2386-beauty-huang-gamma-tile-mass-strict-headed-low.png`，以及 `run-2377-thickness`、`run-2379-velocity`、`run-2380-foam`、`run-2382-phaseArea` 等调试图。改前强制对比结论：参考图仍是大面积橙金厚膜岛、青绿分叉河道、贴河道紫蓝窄边和密集奶金/白色微滴；`run-2386` 只有小完整橙金球，几乎没有青绿/紫蓝信号，`velocity.interiorActiveFraction=0.0004`、`gammaDeltaMagnitude.nonZeroFraction=0.0021`，说明上一轮虽然救回了 `Gamma` 质量，但 Huang et al. 2020 的 `grad_s(Gamma) -> u -> div_s(u) -> eta/Gamma` 内部耦合仍太弱。

本轮只改 `mvp/src/visual/thinFilmSim.js` 的 Huang 主物理链路，没有改构图、相机、beauty 调色，也没有使用贴图、参考图采样、预烘焙纹理、canvas 图案、样式拟合或假纹理。代码审计发现 `GAMMA_VELOCITY_CORRECTION_FRAGMENT_SHADER`、`GAMMA_DIVERGENCE_FIELD_FRAGMENT_SHADER`、`GAMMA_DIVERGENCE_FEEDBACK_FRAGMENT_SHADER` 和 `GAMMA_CONTINUITY_FRAGMENT_SHADER` 里的球面梯度/散度虽然包含 `sin(theta)`，但没有把有限差分除以球面网格步长，导致 `grad_s(Gamma)`、`div_s(u)` 和 continuity 残差被压小几十倍。按 Huang 全文对球面微分算子的要求，本轮加入受限的 `phi/theta` 导数尺度：速度校正 pass cap 为 `8`，divergence field/feedback cap 为 `6`，continuity cap 为 `5`，用受限尺度恢复网格导数强度，同时避免显式 WebGL 近似直接爆炸。

验证先跑过强版 `run-2387` 到 `run-2397`，所有视图无 shader/WebGL console error，`solid` 可见，但数值明显过冲：`run-2397 beauty` 为 `Gamma mean=0.2621`、`velocity.interiorActiveFraction=0.9970`、`gammaDeltaMagnitude.nonZeroFraction=0.4335`，画面变成发白完整球和全屏活跃噪声。判定这是正确方向的过强失败：补网格尺度确实打开了闭环，但显式 pass 不能承受接近完整 `1/dx` 的强度。随后降到受限平衡版，重新跑 `run-2398` 到 `run-2408`，截图顺序为 `solid -> thickness -> phase -> velocity -> foam -> filamentConnectivity -> phaseArea -> etaGammaVelocity -> gammaCandidate -> gammaRhsResidual -> beauty`，结果 JSON 为 `run-2398-2408-huang-spherical-derivative-scale-balanced-headed-low-capture-results.json`。

平衡版 `run-2408 beauty` 在 step `806` 时读回：`eta min=0.3686 max=0.8235 mean=0.5416 thickFraction=0.2275 thinFraction=0`，`Gamma min=0.3333 max=0.3608 mean=0.3461`，`velocity max=0.0961 mean=0.0281 activeFraction=0.0217 interiorActiveFraction=0.0040`，`projectedDivergence compressionSmallFraction=0.1713 compressionStrongFraction=0.0637 interiorCompressionSmallFraction=0.0819 expansionSmallFraction=0.2224 expansionStrongFraction=0.0756 interiorExpansionSmallFraction=0.0849`，`gammaRhsResidual.nonZeroFraction=0.2916 strongFraction=0.0802`，`gammaDeltaMagnitude.nonZeroFraction=0.0939`。相对 `run-2386`，`Gamma` 均值保住，内部速度活跃面积从 `0.0004` 升到 `0.0040`，Gamma 写回面积从 `0.0021` 升到 `0.0939`，说明 Huang 闭环确实比上一轮更接近自洽。

但是视觉仍失败。`run-2408` 仍是小完整橙褐/橙金球，只出现少量很细的青色痕迹，没有参考图的大面积青绿分叉河道、贴河道紫蓝窄边和高密度奶金/白微滴。图像统计写入 `run-2408-huang-spherical-derivative-scale-balanced-comparison.json`：参考图粗统计为 `orangeGold=0.313612 cyanGreen=0.039702 purpleBlue=0.026393 creamWhite=0.017673 bright=0.297683`；`run-2386` 为 `orangeGold=0.131872 cyanGreen=0 purpleBlue=0 creamWhite=0.000194 bright=0.029050`；过强 `run-2397` 为 `orangeGold=0.054341 cyanGreen=0 purpleBlue=0 creamWhite=0.037620 bright=0.129563`；平衡 `run-2408` 为 `orangeGold=0.129951 cyanGreen=0 purpleBlue=0 creamWhite=0.000489 bright=0.019634`。因此本轮不是视觉达标，只是物理闭环从“近乎不动”推进到“可读写但还没有形成河网”。

Huang et al. 2020 全文模型对照：加入网格尺度后更符合球面 `grad/div` 离散的基本量纲，也解释了为什么此前 Marangoni/Gamma residual 长期过弱；但当前实现仍是 capped explicit multi-pass，不是论文里的 staggered spherical SPD `Gamma` projection-like solve，也缺少 velocity-aligned/BiMocq2 的细节保持。当前主要偏差已经从 `Gamma` 质量和导数强度转移到两个环节：其一，`FIELD_STEP` 中残留的非 Huang `surfactantFluxDiv/source/ridge/river` 项可能仍把 `eta/phase` 压成完整球并抹掉分叉；其二，`phaseArea/foam/beauty` 没有把已经可见的 `interiorCompression/expansion`、`grad_s(Gamma)` 和 `eta` 谷线派生成青绿河道与边界微滴。

下一步计划：

1. 保留严格分块 `Gamma` 质量守恒和本轮平衡导数尺度，继续禁止构图、相机、beauty 调色和任何图像/纹理伪造。
2. 审计 `FIELD_STEP_FRAGMENT_SHADER`：逐项降低或删除会抹平 `Gamma` 梯度、把 `eta` 推成完整球的非 Huang 源项，尤其是旧的 `surfactantFluxDiv`、source/ridge/river 启发项，保证 `eta = eta* - dt * eta* div_s(u)` 这条主线不被覆盖。
3. 让 `phaseArea/filamentConnectivity/foam` 只从 `projectedDivergence`、`grad_s(Gamma)`、`eta` 谷线、剪切和曲率派生河道/边界/微滴证据，不允许直接画颜色或放宽成样式拟合；目标是先让调试图出现连通分叉通道，再看 beauty 的 `cyanGreen/purpleBlue` 是否自然非零。
4. 下一轮仍跑完整 `solid -> thickness -> phase -> velocity -> foam -> filamentConnectivity -> phaseArea -> etaGammaVelocity -> gammaCandidate -> gammaRhsResidual -> beauty` 截图，并继续同时对照参考图和 Huang 全文模型；若 Huang 主链可自洽但微滴成核仍无法解释，再按目标规则寻找补充同行评审论文并全文审核冲突。

## 2026-06-01 heartbeat / Run 2354-2386: 新增分块 Gamma 质量守恒，Gamma 均值恢复但视觉仍未达标

本轮开始前按自动化要求重新读取了 `artifacts/targets/soap-film-huang-2020-fulltext-notes.md`、`artifacts/targets/soap-film-physics-handoff.md`、`artifacts/targets/soap-film-target.md` 和本迭代记录，并重新对照 `artifacts/targets/soap-film-reference.jpg`、上一轮最新 `run-2353-beauty-huang-gamma-mass-guard-headed-low.png`、`run-2344-thickness`、`run-2346-velocity`、`run-2351-gammaCandidate` 等调试图。改前结论不变：参考图有大面积橙金厚膜岛、青绿分叉河道、贴河道紫蓝窄边和高密度奶金/白色微滴；上一轮只有小完整橙金球，`cyanGreen=0`、`purpleBlue=0`，`Gamma mean=0.1184`，说明失败仍在 Huang et al. 2020 的 `eta/Gamma/u` 闭环内部，而不是构图或最终调色。

本轮只改 `mvp/src/visual/thinFilmSim.js` 的物理求解链路，没有改相机、构图或 beauty 调色，也没有使用贴图、参考图采样、预烘焙纹理、canvas 图案、样式拟合或假纹理。新增 `GAMMA_TILE_MASS_FRAGMENT_SHADER` 与 `GAMMA_TILE_MASS_CORRECTION_FRAGMENT_SHADER`：每个物理步开头把当前 `field.g = Gamma` 投影到低分辨率 tile mass target，之后在 Gamma Jacobi/feedback、Gamma continuity 和 field step 后重新估计更新后的 tile mass，并按更新前/更新后的局部质量误差回写 `Gamma`。这相当于给当前 WebGL 近似补一个局部分块守恒约束，目标是先阻止数值耗散把 Huang 模型里的表活剂质量长期抽空；该 pass 只读实时模拟场，不读外部图像。

验证分三次递进：`run-2354` 到 `run-2364` 为第一版软校正，`Gamma mean` 仍约 `0.1182`，判定门槛太高、每步小耗散仍会长期累积；`run-2365` 到 `run-2375` 降低门槛并增强校正后，`Gamma mean` 提升到 `0.1957`，但仍远低于健康基线；`run-2376` 到 `run-2386` 改为近似严格的每步局部质量校正后，`run-2386 beauty` 在 step `801` 时得到 `eta min=0.4314 max=0.7961 mean=0.6290 thickFraction=0.5732`、`Gamma min=0.3176 max=0.3608 mean=0.3419`、`velocity max=0.0627 mean=0.0316 activeFraction=0.0005 interiorActiveFraction=0.0004`、`gammaDeltaMagnitude.nonZeroFraction=0.0021`、`gammaRhsResidual.nonZeroFraction=0.1334 strongFraction=0.0011`。这说明质量塌陷已明显改善：相对上一轮 `Gamma mean=0.1184` 和 `gammaDeltaMagnitude.nonZeroFraction=0`，Huang 闭环开始重新有可读写的 Gamma 残差与内部速度信号。

截图顺序按要求完成：`run-2376-solid-huang-gamma-tile-mass-strict-headed-low.png`、`run-2377-thickness`、`run-2378-phase`、`run-2379-velocity`、`run-2380-foam`、`run-2381-filamentConnectivity`、`run-2382-phaseArea`、`run-2383-etaGammaVelocity`、`run-2384-gammaCandidate`、`run-2385-gammaRhsResidual`、`run-2386-beauty`；对应 JSON 为 `run-2376-2386-huang-gamma-tile-mass-strict-headed-low-capture-results.json`。所有视图 `errorCount=0`，`solid` 仍为 `ready=true/glassVisible=true`，最小可见性通过，且没有 shader/WebGL console error。图像统计写入 `run-2386-huang-gamma-tile-mass-strict-comparison.json`：按同一 HSV 粗统计，参考图 `orangeGold=0.320017 cyanGreen=0.065160 purpleBlue=0.036300 creamWhite=0.010455`，`run-2386` 为 `orangeGold=0.131877 cyanGreen=0 purpleBlue=0 creamWhite=0 bright=0.029050`。因此视觉仍失败，虽然 Gamma 守恒改善了，青绿河道、紫蓝窄边和奶金/白色微滴仍没有进入 beauty。

Huang et al. 2020 全文模型对照：本轮更接近主文 4.3 的 projection-like 思路，因为 `Gamma` 不再被显式 pass 长期耗散到低值，而是通过局部质量约束维持；但它仍不是完整的 staggered spherical SPD solve，也没有真正的 velocity-aligned/BiMocq2 平流。当前偏差已经从“Gamma 质量塌陷”转移到“`grad_s(Gamma)` 与 `u`、`div_s(u)` 的耦合强度和相场/泡沫派生不足”：调试图可见 `thickness/phase/velocity` 有场结构，`phaseArea` 也有暗色局部链路，但 beauty 仍是完整橙球和水平/纵向软条纹，没有形成参考图那种大尺度分叉河网。

下一步计划：

1. 不改构图、不调 beauty 颜色、不引入任何图像/纹理伪造。保留本轮严格分块 Gamma 质量守恒，继续以 `Gamma mean` 不低于约 `0.33` 作为底线。
2. 查 `GAMMA_VELOCITY_CORRECTION_FRAGMENT_SHADER` 和后续 continuity：把 `grad_s(Gamma)` 经过 `-(M/eta) grad(Gamma)` 产生的 Marangoni 速度写回强度、方向和球面散度逐项核对 Huang 2020，目标是把 `velocity.interiorActiveFraction` 从 `0.0004` 提升到至少 `>0.001`，并让 `projectedDivergence` 形成内部连通压缩/膨胀带。
3. 检查 `fieldMaterial` 中仍残留的非 Huang 式 `surfactantFluxDiv`、source、ridge 和 river/phase 派生项，删减会抹平 `Gamma` 梯度或把场压成完整球面的项；只有明确由 `eta/Gamma/u`、曲率、剪切和相场边界派生的 foam/微滴可保留。
4. 下一轮仍从 `solid -> thickness -> phase -> velocity -> foam -> filamentConnectivity -> phaseArea -> etaGammaVelocity -> gammaCandidate -> gammaRhsResidual -> beauty` 全序列截图，并继续对照参考图和 Huang 全文模型；如果严格守恒后仍无法形成内部 river/front，需要按目标文档规则寻找补充论文，但必须先审核是否与 Huang 的 `eta/Gamma/u` 球面耦合冲突。

## 2026-06-01 heartbeat / Run 2332-2353: 新增 Gamma Jacobi projection，但长跑 Gamma 质量仍塌陷

本轮开始前按自动化要求重新读取了 `artifacts/targets/soap-film-huang-2020-fulltext-notes.md`、`artifacts/targets/soap-film-physics-handoff.md`、`artifacts/targets/soap-film-target.md` 和本迭代记录，并重新查看参考图、最终保留的 `run-2331-beauty-huang-retained-explicit-gamma-targets-headed-long.png` 以及上一轮稳定调试图。改前强制对比结论：参考图有大面积橙金厚膜、青绿分叉河道、贴河道紫蓝窄边和奶金/白色微滴；`run-2331` 仍只是小橙球加水平细线，`cyanGreen=0`、`purpleBlue=0`、`creamWhite=0.000355`。`window.__soapFilmDebug` 显示 `gammaDeltaMagnitude.nonZeroFraction=0.0007`，说明 Huang 2020 的 `Gamma/u/eta` 闭环没有有效写回，不是构图问题，也不是 beauty 调色问题。

本轮代码只改 `mvp/src/visual/thinFilmSim.js` 的物理求解链路，没有改相机、构图或最终颜色，也没有使用贴图、参考图采样、预烘焙纹理、canvas 图案或样式拟合。新增 `GAMMA_PROJECTION_JACOBI_FRAGMENT_SHADER`、`gammaSolveReadTarget/gammaSolveWriteTarget` ping-pong target 和 `soap-film-gamma-projection-jacobi` material：每个 Gamma 外层循环先写 `Gamma*`，再对 `Gamma - dt * div((M/eta) grad Gamma)` 做多次 Jacobi 近似，然后用求出的 `Gamma_candidate` 更新 Marangoni 速度、divergence target 和 field。与此同时移除了若干逐 texel 常数 `Gamma` 锚点，把原来的 `0.50/0.46` 拉回改成邻域或当前值回拉；随后又去掉了 `GAMMA_DIVERGENCE_FEEDBACK` 里对 compression/expansion 的重复加减项，以及 `FIELD_STEP` 中重复的 `divergence * surfactant` 消耗项。

静态检查 `Get-Content -Raw -Encoding UTF8 mvp/src/visual/thinFilmSim.js | node --input-type=module --check` 通过。内置浏览器没有可用 pane，已按 browser 插件流程尝试后改用本机 Chrome + Playwright headed GPU 路径截图。第一组 `run-2332` 到 `run-2342`，第二组去掉重复 divergence 后为 `run-2343` 到 `run-2353`；两组均覆盖 `solid/thickness/phase/velocity/foam/filamentConnectivity/phaseArea/etaGammaVelocity/gammaCandidate/gammaRhsResidual/beauty`，结果 JSON 分别是 `run-2332-2342-huang-gamma-jacobi-headed-low-capture-results.json` 和 `run-2343-2353-huang-gamma-mass-guard-headed-low-capture-results.json`。两组控制台/shader error 均为 0，`solid` 红壳可见，最小可见性继续通过。

数值结果：第一组 `run-2342 beauty` step 786 为 `eta mean=0.6212 thickFraction=0.5231`，厚膜面积明显增大，但 `Gamma mean=0.1185 range=0.0863..0.1373`，`velocity.interiorActiveFraction=0`，`gammaDeltaMagnitude.nonZeroFraction=0.0001`。第二组 `run-2353 beauty` step 785 几乎相同：`eta mean=0.6225 thickFraction=0.5327`，`Gamma mean=0.1184 range=0.0863..0.1373`，`velocity.interiorActiveFraction=0`，`gammaDeltaMagnitude.nonZeroFraction=0`。这说明新增 Jacobi pass 可以推高 eta，但没有守住 Huang 模型中应近似守恒的表活剂质量，也没有产生足够的 Marangoni 梯度和内部速度连通。

图像统计对比写入 `run-2353-huang-gamma-mass-guard-comparison.json`。参考图为 `orangeGold=0.314169 cyanGreen=0.050212 purpleBlue=0.037640 creamWhite=0.010444 bright=0.462470`；保留基线 `run-2331` 为 `orangeGold=0.117897 cyanGreen=0 purpleBlue=0 creamWhite=0.000355 bright=0.110409`；Jacobi 后 `run-2342` 为 `orangeGold=0.132839 cyanGreen=0 purpleBlue=0 creamWhite=0.000285 bright=0.129628`；去掉重复 divergence 后 `run-2353` 为 `orangeGold=0.132778 cyanGreen=0 purpleBlue=0 creamWhite=0.000285 bright=0.129919`。视觉上新结果只是更厚的暗橙/金球，仍没有参考图的青绿分叉河道、紫蓝窄边和沿边界高密度奶金/白微滴。

Huang et al. 2020 全文模型对照：本轮比上一轮更接近主文 4.3 的 projection-like 结构，因为 `Gamma` 成为一个独立 Jacobi 未知量，而不是单 fragment 即时混合；但它仍缺论文中的全局/隐式质量约束和 staggered 球面离散，长时间积分时 `Gamma` 系统性流失。当前失败仍在 Huang 核心 `eta/Gamma/u` 主模型内部，不应转向构图、调色或 phase/foam 伪造。下一步应实现分块或全局 Gamma 质量投影：用 reduction/mip 或低分辨率 tile target 估计 `Gamma` 总量/块质量，把 Jacobi 解后的 `Gamma` 做质量守恒校正，同时保留局部梯度；之后再把 `div_s(u_after_gamma)` 直接用于 eta continuity，目标是 `Gamma mean` 不再从约 `0.40` 塌到 `0.12`，并让 `velocity.interiorActiveFraction > 0.001`、`gammaDeltaMagnitude.nonZeroFraction` 明显高于 `0.001`。

下一步计划：
1. 不改构图，不调 beauty 颜色。新增一个低分辨率 `Gamma` mass/tile projection pass 或 mip reduction 近似，先守住总表活剂质量，再继续看 Marangoni 是否能形成内部压缩带。
2. 将 `Gamma` Jacobi 的 RHS 与 `FIELD_STEP` 的 surfactant flux 做守恒审计，删除/降权所有非 Huang 的隐式耗散项，只保留明确的 diffusion/source 项。
3. 重新跑 `solid -> thickness -> phase -> velocity -> foam -> filamentConnectivity -> phaseArea -> etaGammaVelocity -> gammaCandidate -> gammaRhsResidual -> beauty`；若 `Gamma mean` 仍塌陷，优先查 `surfactantFluxDiv` 和球面 divergence 离散的净通量误差。
4. 只有当 `eta/Gamma/u` 出现自洽的分叉压缩/膨胀结构后，才继续微滴、foam 和薄膜干涉细节。

## 2026-06-01 heartbeat / Run 2285-2331: 低频 Gamma 守恒尝试失败，已回退到显式中间 target 稳定结构

本轮开始前按自动化要求重新读取了 `artifacts/targets/soap-film-huang-2020-fulltext-notes.md`、`artifacts/targets/soap-film-physics-handoff.md`、`artifacts/targets/soap-film-target.md` 和本迭代记录，并重新查看参考图、上一轮 `run-2273-beauty-huang-explicit-gamma-targets-headed-low.png` 以及 `thickness/phase/velocity/foam` 等调试图。改前强制对比结论：参考图仍是橙金厚膜岛被青绿分叉河道切开，河道边缘有紫蓝窄边和奶金/白色微滴；`run-2273` 仍是小完整球、暗橙膜和水平青线，`cyanGreen/purpleBlue` 基本为 0。失败点仍是 Huang 2020 主文 4.3 的 `Gamma -> u_after_gamma -> div_s(u_after_gamma) -> eta/Gamma` 闭环没有形成内部连通分叉压缩带。

本轮先尝试按上一轮计划把局部 `Gamma` 锚定改成“弱低频/目标均值守恒”，并让 `gammaContinuity` 读取显式 `div_s(u_after_gamma)` target。实现过程中先出现一次初始化回退：`run-2274` 到 `run-2282` 的 `solid/thickness/...` 近黑，`window.__soapFilmDebug.lastError` 显示 `gammaContinuityMaterial.uniforms.uGammaProjection` 未定义；修复后 `run-2285` 到 `run-2295` 无 shader error，但物理场更差。`run-2295 beauty` 只有 `eta thickFraction=0.0682`、`Gamma mean=0.3889`、`velocity.activeFraction=0`，说明该低频均值保护把 `Gamma` 梯度和速度闭环进一步压平。

随后把 `Gamma` 锚定和 continuity 读 projection target 的改动撤回，只试图单独增强 `GAMMA_VELOCITY_CORRECTION_FRAGMENT_SHADER` 的 Marangoni acceleration。第一次恢复验证 `run-2307` 到 `run-2317` 暴露 shader 编译错误：`soap-film-gamma-divergence-feedback` 里重复定义 `gradientPreservation`，导致非 solid 视图场值退化到 `eta=0.0353/Gamma=0.0235`。删除重复定义后，`run-2318` 到 `run-2328` 全序列重新通过，控制台/shader error 为 0，`solid` 最小可见性继续成立。

长跑对齐验证为 `run-2330` 与最终保留的 `run-2331`。增强 Marangoni 的 `run-2330` step 421 仍不优于上一轮：`eta thickFraction=0.1063`、`Gamma mean=0.4016`、`velocity.activeFraction=0.0008 interiorActiveFraction=0.0007`，虽然内部速度略回升，但厚膜面积和图像统计仍差。最终已把 Marangoni 增益撤回到上一轮稳定值，保留代码回到 `run-2273` 的显式 `Gamma_candidate / div_s(u)` 中间 target 结构；用保留代码长跑的 `run-2331 beauty` step 424 为 `eta min=0.3804 max=0.7804 mean=0.5264 thickFraction=0.1647`，`Gamma min=0.3176 max=0.4275 mean=0.3980`，`velocity max=0.0706 mean=0.0270 activeFraction=0.0007 interiorActiveFraction=0.0003`，`gammaDeltaMagnitude nonZeroFraction=0.0007`。这仍未达到上一轮计划中的 `interiorActiveFraction > 0.001` 和可见分叉要求。

图像统计对比写入 `artifacts/targets/run-2285-2331-huang-lowfreq-failure-and-retained-comparison.json`。参考图为 `orangeGold=0.310129 cyanGreen=0.049901 purpleBlue=0.038598 creamWhite=0.010330 bright=0.461617`；上一轮 `run-2273` 为 `orangeGold=0.128879 cyanGreen=0.000001 purpleBlue=0 creamWhite=0.000285 bright=0.126451`；最终保留验证 `run-2331` 为 `orangeGold=0.117897 cyanGreen=0 purpleBlue=0 creamWhite=0.000355 bright=0.110409`。视觉上 `run-2331` 仍是小橙球和水平青线，没有青绿分叉河道、紫蓝窄边和密集奶金/白微滴，因此本轮判定为物理求解失败，不是有效视觉进步。

Huang et al. 2020 全文模型对照：本轮证明“局部/低频目标均值锚定”不是 Huang 主文 4.3 的 projection-like `Gamma` solve，它会把 `Gamma` 梯度和 `u` 的内部活跃面积一起压平；单纯增加显式 Marangoni acceleration 也不足以替代论文中的 SPD 线性系统。当前失败仍在 Huang 核心模型内部，不应转向补充论文或样式拟合。下一步应实现真正的多 pass 线性解近似：把 `Gamma` solve 作为未知量迭代求解 `Gamma - dt * div((M/eta) grad Gamma)`，用残差 target 迭代而不是把每个 texel 拉向邻域/目标常数；同时需要一个低分辨率全局/分块质量统计或双层 mip 约束，保护总 `Gamma` 质量但不抹掉局部梯度。

下一步计划：
1. 不改构图，不调 beauty 颜色。实现一个明确的 `Gamma` Poisson/Jacobi 近似 pass：输入 `Gamma*`、`eta*`、`u*` 和 RHS，反复写 `Gamma_solve`，最后再更新 `u` 和 `eta`，避免当前 fragment 内即时混合。
2. 暂停“局部低频目标均值”路线；质量保护只能作为全局或分块尺度的守恒校正，不能逐 texel 拉向 `0.43/0.47/0.50`。
3. 保留 `Gamma_candidate`、`gammaRhsResidual`、`div_s(u_after_gamma)` 诊断，但下一轮读回门槛仍是 `velocity.interiorActiveFraction > 0.001`、`gammaDeltaMagnitude.nonZeroFraction` 明显高于 `0.0018`，并且内部压缩带不再是水平条纹。
4. 只有 `eta/Gamma/u` 自洽后才允许继续调整 `phaseArea/foam/beauty`；本轮没有使用贴图、参考图采样、预烘焙纹理、canvas 图案或样式拟合。

## 2026-06-01 heartbeat / Run 2263-2273: 显式 `Gamma_candidate / u_after_gamma / div_s(u)` 中间 target 验证

本轮开始前按自动化要求重新读取了 `artifacts/targets/soap-film-huang-2020-fulltext-notes.md`、`artifacts/targets/soap-film-physics-handoff.md`、`artifacts/targets/soap-film-target.md` 和本迭代记录，并重新查看 `artifacts/targets/soap-film-reference.jpg`、上一轮最新 `run-2262-beauty-huang-gamma-divfeedback-headed-low.png`、`run-2253-thickness`、`run-2255-velocity`、`run-2254-phase`、`run-2256-foam`。改前对比结论不变：参考图的核心是大面积橙金厚膜岛、青绿分叉河道、贴河道的紫蓝窄边以及高密度奶金/白色微滴；上一轮仍是完整小球、平滑橙膜和中下部水平青线。失败点继续是 Huang 2020 主模型的 `Gamma -> u_after_gamma -> div_s(u_after_gamma) -> eta/Gamma` 闭环过弱，不是构图或 beauty 调色。

本轮只改 `mvp/src/visual/thinFilmSim.js` 的物理求解链路，没有改相机、构图或最终 beauty 调色，也没有使用贴图、参考图采样、预烘焙纹理、canvas 图案、样式拟合或假纹理。新增 `GAMMA_DIVERGENCE_FIELD_FRAGMENT_SHADER`、`gammaCandidateTarget` 和 `gammaProjectionDivergenceTarget`：每次 Gamma 隐式更新先写出显式 `Gamma_candidate`，随后用这个候选 Gamma 更新 Marangoni 速度，接着把 `u_after_gamma` 的球面散度和 `D Gamma / D t = -Gamma div_s(u) + Ds lap_s Gamma` 残差写入独立 divergence/residual target，最后由 `GAMMA_DIVERGENCE_FEEDBACK_FRAGMENT_SHADER` 读取该 target 回写 Gamma。这样比上一轮的“同一个 fragment 内即时估算后立刻混合”更接近 Huang 4.3 的 projection-like 多阶段闭环，但仍不是完整的全局 SPD/staggered solve。

静态检查 `Get-Content -Raw -Encoding UTF8 mvp/src/visual/thinFilmSim.js | node --input-type=module --check` 通过。headed Chrome GPU 路径按顺序截图 `solid -> thickness -> phase -> velocity -> foam -> filamentConnectivity -> phaseArea -> etaGammaVelocity -> gammaCandidate -> gammaRhsResidual -> beauty`，对应 `run-2263` 到 `run-2273`，结果 JSON 为 `artifacts/targets/run-2263-2273-huang-explicit-gamma-targets-headed-low-capture-results.json`，对比 JSON 为 `artifacts/targets/run-2263-2273-huang-explicit-gamma-targets-headed-low-comparison.json`。所有视图完成截图，控制台/shader error 为 0，`solid` 最小可见性继续通过。

读回结果：`run-2273 beauty` step 411 时 `eta min=0.3765 max=0.7765 mean=0.5173 thickFraction=0.1306`，`Gamma min=0.3216 max=0.4275 mean=0.4000`，`|u|max=0.0725 mean=0.0270 activeFraction=0.0006 interiorActiveFraction=0.0004`，`projectedDivergence compressionSmallFraction=0.1264 interiorCompressionSmallFraction=0.0752`。`gammaCandidate.gammaDeltaMagnitude nonZeroFraction=0.0007`，`gammaRhsResidual nonZeroFraction=0.0864 strongFraction=0.0002`。与上一轮 `run-2262` 相比，`|u|max` 略升、残差 target 可独立读回，但有效 Gamma 写回面积从 `0.0018` 下降到 `0.0007`，`eta thickFraction` 从 `0.1569` 降到 `0.1306`，说明显式中间 target 没有把闭环变强，反而被局部锚定/残差混合继续抹平。

图像对比：`run-2273 beauty` 仍是小的橙褐球，只有弱水平青线和少量淡白擦痕；没有参考图中的青绿分叉河网、紫蓝窄边和沿边界聚集的奶金/白色微滴。粗 HSV 统计只用于人工跟踪，不参与渲染或拟合：参考图 `orangeGold=0.310129 cyanGreen=0.049901 purpleBlue=0.038598 creamWhite=0.010330 bright=0.461617`；上一轮 `run-2262` 为 `orangeGold=0.128382 cyanGreen=0 purpleBlue=0 creamWhite=0.000323 bright=0.123231`；本轮 `run-2273` 为 `orangeGold=0.128879 cyanGreen=0.000001 purpleBlue=0 creamWhite=0.000285 bright=0.126451`。本轮只带来极小的橙金/亮度变化，核心青绿、紫蓝和奶白微滴仍基本为零。

Huang et al. 2020 全文模型对照：本轮把 `Gamma_candidate`、`u_after_gamma` 和 `div_s(u_after_gamma)` 的顺序拆清楚了，便于继续逼近主文 4.3；但当前仍是局部 multi-pass 近似，没有真正求解球面 `Gamma` projection-like 线性系统，也没有 velocity-aligned/BiMocq2 的数值保持能力。当前失败仍在 Huang 主模型内部：`Gamma` 质量和梯度被过早局部保护，`u` 的内部活跃面积没有扩大，`-div_s(u)` 没有形成分叉压缩网络。因此暂不引入补充论文；应先把 Huang 核心闭环做成更强的全局/低频守恒求解。

下一步计划：
1. 不改构图，不调 beauty 颜色。把当前局部 `Gamma` feedback 改成带低频/全局守恒的多 pass Jacobi/Poisson 近似：保留 `Gamma mean`，但不把每个 texel 拉回邻域平均，目标是扩大 `Gamma range` 和 `grad_s Gamma` 的内部连通面积。
2. 将 `gammaDivergenceFeedback` 的局部锚定从高频全抹平改为只抑制数值爆炸，让 `gammaDeltaMagnitude.nonZeroFraction` 至少回到并超过 `run-2262` 的 `0.0018`，同时保持 `Gamma mean` 约 `0.40-0.45` 不塌陷。
3. 用新的 `div_s(u_after_gamma)` target 驱动下一轮 `eta` continuity，而不是只回写 Gamma；读回门槛为 `velocity.interiorActiveFraction` 明显高于 `0.001`，内部压缩/膨胀带从水平条纹转向分叉连通结构。
4. 在 `eta/Gamma/u` 自洽之前继续禁止 `riverPathSkeleton/phaseArea` 放宽 gate；只有主物理场支持后，才检查 beauty 是否自然出现青绿河道、紫蓝窄边和微滴。若完成 Huang 核心闭环后仍缺微滴成核，再按目标文档规则寻找补充同行评审论文并全文审核冲突。

## 2026-06-01 heartbeat / Run 2252-2262: Gamma/u/div_s 显式残差反馈 pass

本轮开始前按自动化要求重新读取了 `artifacts/targets/soap-film-huang-2020-fulltext-notes.md`、`artifacts/targets/soap-film-physics-handoff.md`、`artifacts/targets/soap-film-target.md` 和本迭代记录，并重新查看 `artifacts/targets/soap-film-reference.jpg`、上一轮 `run-2251-beauty-huang-velocity-aligned-gamma-headed-low.png`、`run-2242-thickness`、`run-2244-velocity` 与 `run-2260` 前的 Gamma 诊断链路。改前对比结论不变：参考图是大面积橙金厚膜岛、15-25% 左右青绿分叉河道、贴河道的紫蓝窄边和高密度奶金/白色微滴；上一轮仍是小球、平滑橙膜和中下部水平青线。厚度图和速度图没有分叉连通结构，失败点仍在 Huang 2020 主模型的 `Gamma -> u_after_gamma -> div_s(u_after_gamma) -> eta/Gamma` 闭环，不是构图或 beauty 调色。

本轮代码只改 `mvp/src/visual/thinFilmSim.js` 的物理闭环，没有改相机、构图或 beauty 颜色，也没有使用贴图、参考图采样、预烘焙纹理、canvas 图案或样式拟合。新增 `GAMMA_DIVERGENCE_FEEDBACK_FRAGMENT_SHADER` 和 `soap-film-gamma-divergence-feedback` material，并把它插入每次 `Gamma implicit` 与 `Marangoni velocity correction` 之后：先用新的 `Gamma` 更新 `u`，再读取修正后的球面速度散度 `div_s(u)`，用 `D Gamma / D t = -Gamma div_s(u) + Ds lap_s Gamma` 的残差回写 `Gamma`，下一轮 Gamma 迭代再读取该结果。这个 pass 只更新 `field.g = Gamma`，`eta` 仍由每个物理 step 末尾的 continuity pass 更新，以避免上一轮把完整 continuity 放进内循环导致导航/渲染卡住。

静态检查 `Get-Content -Raw -Encoding UTF8 mvp/src/visual/thinFilmSim.js | node --input-type=module --check` 通过。headed Chrome GPU 路径按顺序截图 `solid -> thickness -> phase -> velocity -> foam -> filamentConnectivity -> phaseArea -> etaGammaVelocity -> gammaCandidate -> gammaRhsResidual -> beauty`，对应 `run-2252` 到 `run-2262`，结果 JSON 为 `artifacts/targets/run-2252-2262-huang-gamma-divfeedback-headed-low-capture-results.json`，对比 JSON 为 `artifacts/targets/run-2252-2262-huang-gamma-divfeedback-headed-low-comparison.json`。所有视图 `ready=true`，控制台/shader error 为 0，`solid` 最小可见性继续通过。

读回结果：`run-2262 beauty` step 419 时 `eta min=0.3961 max=0.7922 mean=0.5291 thickFraction=0.1569`，`Gamma min=0.3216 max=0.4275 mean=0.4004`，`|u|max=0.0667 mean=0.0277 activeFraction=0.0012 interiorActiveFraction=0.0009`，`projectedDivergence compressionSmallFraction=0.1285 interiorCompressionSmallFraction=0.0756`。相对上一轮 `run-2251` 的 `activeFraction=0.0005 interiorActiveFraction=0.0004`，速度闭环确实被轻微激活；但 `Gamma mean` 继续偏低，`gammaDeltaMagnitude nonZeroFraction=0.0018` 仍说明真正写回 Gamma 的有效面积太小，`eta thickFraction` 也从上一轮约 `0.2299` 降到 `0.1569`，厚膜主体没有变成参考图需要的大面积岛屿。

图像对比：`run-2262 beauty` 比 `run-2251` 稍亮，水平青绿条纹稍多，顶部也出现细弱青线；但仍没有青绿分叉河道、紫蓝窄边和沿边界聚集的奶金/白色微滴。粗 HSV 统计只用于人工追踪、不参与渲染或拟合：本轮口径下参考图 `orangeGold=0.3102 cyanGreen=0.0499 purpleBlue=0.0386 creamWhite=0.0103 bright=0.4616`；上一轮 `run-2251` 为 `orangeGold=0.1187 cyanGreen=0 purpleBlue=0 creamWhite=0.0003 bright=0.1162`；本轮 `run-2262` 为 `orangeGold=0.1284 cyanGreen=0 purpleBlue=0 creamWhite=0.0003 bright=0.1232`。也就是说本轮只带来很小的橙金/亮度恢复，核心的青绿河网和紫蓝窄边仍完全失败。

Huang et al. 2020 全文模型对照：本轮比上一轮更接近主文 4.3 的“Gamma 解出后影响 u，再由 div(u) 回写 Gamma/eta”的联立结构，但仍只是局部 fragment 多 pass 近似，不是真正的 staggered spherical grid + SPD projection-like solve，也没有 BiMocq2/velocity-aligned transport 的细节保持能力。当前失败仍属于 Huang 主模型内部的离散与求解问题，不需要先引入补充论文。

下一步计划：
1. 不改构图、不调 beauty 颜色。把当前轻量 feedback 升级为明确的多目标闭环：显式保存 `Gamma_candidate`、`u_after_gamma`、`div_s(u_after_gamma)` 或至少保存一个可复用的 divergence/residual target，而不是每个 fragment 内部即时近似后马上被局部锚定抹平。
2. 把 `Gamma` 质量保护从局部 neighbor anchor 继续改向低频/全局守恒近似，目标是保持 `Gamma mean` 不继续跌破约 `0.40`，同时让 `Gamma range` 与 `grad_s Gamma` 不被抹平；否则 `u` 仍不会形成内部连通分叉。
3. 下一轮读回门槛：`velocity.interiorActiveFraction` 需要明显高于 `0.001` 且不能只在边缘/水平带活跃；`gammaDeltaMagnitude.nonZeroFraction` 需要从当前 `0.0018` 提升到可见面积级；`projectedDivergence` 的内部压缩带要从横向条纹转为分叉连通结构。未达到这些门槛前，不继续放开 `riverPathSkeleton/phaseArea` 去伪装河道。
4. 如果上述 Huang 主闭环完成后仍缺微滴/泡沫成核，再按目标文档规则寻找补充同行评审论文或可靠开源研究实现，保存全文并审核是否冲突；当前还没到这一步。

## 2026-06-01 heartbeat / Run 2230-2251: Huang Gamma/u 连续性闭环与 velocity-aligned Gamma 平流验证

本轮开始前按自动化要求重新读取了 `artifacts/targets/soap-film-huang-2020-fulltext-notes.md`、`artifacts/targets/soap-film-physics-handoff.md`、`artifacts/targets/soap-film-target.md` 和本迭代记录，并重新查看 `artifacts/targets/soap-film-reference.jpg`、上一轮最新 `run-2221-beauty-huang-mass-guard-headed-check.png` 以及 `run-2220-thickness`、`run-2223-velocity`、`run-2224-foam`、`run-2226-phaseArea`、`run-2228-gammaCandidate`、`run-2229-gammaRhsResidual`。改前结论：solid 可见性已经恢复；上一轮在 Gamma 质量保护后稳定，但 beauty 仍是橙金小球，只有弱水平青带，没有参考图的大面积橙金厚膜、青绿分叉河道、紫蓝窄边和奶金/白色微滴密度。读回显示 `Gamma` 被保护项压平，`velocity.activeFraction` 极低，失败点仍在 Huang 2020 主文 4.3 的 `Gamma -> u_after_gamma -> div_s(u) -> eta/Gamma continuity` 闭环，而不是构图或最终调色。

本轮没有改相机、构图或 beauty 调色，没有使用贴图、参考图采样、预烘焙纹理、canvas 图案或样式拟合。第一步在 `mvp/src/visual/thinFilmSim.js` 增加 `GAMMA_CONTINUITY_FRAGMENT_SHADER`，在 Gamma 隐式更新和 Marangoni 速度修正后，用修正后的球面速度散度回灌 `eta` 与 `Gamma` 连续性，并增加 `velocity.interiorActiveFraction`、内部压缩/膨胀面积读回。最初把连续性 pass 放进每次 Gamma 迭代后会让 `thickness` 导航卡住；随后改为每个物理 step 只执行一次，恢复可验证性。静态检查 `Get-Content -Raw mvp/src/visual/thinFilmSim.js | node --input-type=module --check` 通过。

第一组验证为 `run-2230` 到 `run-2240`，其中 `run-2230 solid` 红色壳层可见，`run-2231 thickness` 能读回 `window.__soapFilmDebug` 且无控制台/shader error，后续 `phase/velocity/foam/filamentConnectivity/phaseArea/etaGammaVelocity/gammaCandidate/gammaRhsResidual/beauty` 成功截图，结果 JSON 为 `artifacts/targets/run-2232-2240-huang-continuity-loop-headed-low-capture-results.json`，对比为 `artifacts/targets/run-2230-2240-huang-continuity-loop-headed-low-comparison.json`。`run-2240 beauty` step 418 时 `eta mean=0.5541 thickFraction=0.2643`，`Gamma mean=0.4537 range=0.3804..0.4824`，`|u|max=0.0627 activeFraction=0.0008 interiorActiveFraction=0.0008`，内部散度有弱信号但仍不连通。图像仍是橙金小球和水平青纹；HSV 粗统计 `orangeGold=0.1297 cyanGreen=0 purpleBlue=0 creamWhite=0.0013 bright=0.1283`，参考为 `orangeGold=0.3115 cyanGreen=0.0565 purpleBlue=0.0381 creamWhite=0.0474 bright=0.4686`。

第二步按 Huang 的 velocity-aligned 平流要求，把 `sphericalBacktrace()` 加入 Gamma continuity pass，让新 `u` 沿球面回溯搬运 `eta/Gamma`，并放松过强的 Gamma 质量锚定；同时降低 `FIELD_STEP` 里把 surfactant 拉回 0.52 的全局回归，稍微增强 `GAMMA_VELOCITY_CORRECTION_FRAGMENT_SHADER` 的 Marangoni acceleration。静态检查再次通过。第二组完整验证为 `run-2241` 到 `run-2251`，覆盖 `solid/thickness/phase/velocity/foam/filamentConnectivity/phaseArea/etaGammaVelocity/gammaCandidate/gammaRhsResidual/beauty`，结果 JSON 为 `artifacts/targets/run-2241-2251-huang-velocity-aligned-gamma-headed-low-capture-results.json`，对比为 `artifacts/targets/run-2241-2251-huang-velocity-aligned-gamma-headed-low-comparison.json`，控制台/shader error 为 0。

第二组读回显示这次仍失败：`run-2251 beauty` step 442 时 `eta mean=0.5533 thickFraction=0.2299`，`Gamma mean=0.4084 range=0.3216..0.4392`，`|u|max=0.0627 activeFraction=0.0005 interiorActiveFraction=0.0004`。放松锚定确实拉开了 Gamma 范围，但把平均 Gamma 拉低，速度活跃面积反而更小；`projectedDivergence compressionSmallFraction=0.1251`、`interiorCompressionSmallFraction=0.0738` 有局部压缩，但没有参考图需要的分叉连通网络。图像上青绿色只沿底部/中下部形成水平细纹，紫蓝窄边仍无，奶金/白色微滴密度仍极低。粗统计 `run-2251 beauty` 为 `orangeGold=0.1194 cyanGreen=0 purpleBlue=0 creamWhite=0.0011 bright=0.1174`，比 `run-2221` 的 `orangeGold=0.1316 bright=0.1275` 还差；所以本轮物理闭环方向有诊断价值，但参数/离散方式还没有产生目标结构。

Huang et al. 2020 全文模型对照：本轮实现了一个局部 fragment 近似的 `Gamma/u/eta` 回灌和球面 velocity-aligned 回溯，但仍不是主文 4.3 的全局 projection-like Gamma solve，也没有真正的 staggered spherical grid 或稳定的 velocity-aligned transport。当前 `Gamma` 梯度能被保留一点，但 `u_after_gamma` 的内部活跃面积没有扩大，说明失败点仍是 `Gamma` solve 与 `u` projection 的耦合强度、离散位置和质量约束方式，而不是论文未覆盖的新物理。因此暂不引入补充论文。

下一步计划：
1. 不改构图，不调 beauty 颜色。先把 `Gamma` projection 从局部 relaxation 改成更接近 Huang 4.3 的小型多 pass solve：显式保存 `Gamma_candidate` target、`u_after_gamma` target、`div_s(u_after_gamma)` target，再把 residual 输入下一轮，而不是在同一 shader 内混合后立刻锚定。
2. 给 `Gamma` 质量约束改成全局/低频守恒项，而不是局部把 Gamma 拉向 0.50；目标是保持 `Gamma mean` 不坍塌，同时让 `Gamma range` 和 `grad_s Gamma` 不被抹平。
3. 下一轮读回门槛：`velocity.interiorActiveFraction` 必须明显高于当前 `0.0004-0.0008`，`projectedDivergence` 内部压缩带要出现连续分叉；否则不继续放开 `riverPathSkeleton/phaseArea`。
4. 只有当 `eta/Gamma/u` 读回自洽后，再检查 beauty 是否自然出现青绿河道、紫蓝窄边和奶金/白微滴；如果这个主模型闭环完成后仍缺微滴成核机制，再按目标文档规则查找补充同行评审论文并逐项审核是否与 Huang 冲突。

## 2026-06-01 heartbeat / Run 2206-2229: Gamma/u 闭环增益、质量保护与 headed 验证

本轮开始前重新读取了 `artifacts/targets/soap-film-huang-2020-fulltext-notes.md`、`artifacts/targets/soap-film-physics-handoff.md`、`artifacts/targets/soap-film-target.md` 和本迭代文件，并重新对照 `artifacts/targets/soap-film-reference.jpg` 与上一轮最新 `run-2189-beauty-huang-readback-diagnostics-low.png`、`run-2172-thickness`、`run-2174-velocity`、`run-2179-gammaCandidate`、`run-2180-gammaRhsResidual`。改前结论：solid 最小可见性已经通过；上一轮 beauty 仍是暗橙小球，参考图需要的大面积橙金厚膜、青绿分叉河道、紫蓝窄边和奶金/白色微滴都缺失。读回显示 `gammaRhsResidual absMax=0.0278` 有信号，但 `DeltaGamma absMax=0.0007`、`|u|max=0.0373`，说明 Huang 2020 的 `Gamma -> u -> eta` 闭环回写太弱，而不是构图或最终调色问题。

本轮第一步只改物理闭环，不改相机/构图/beauty 调色，也没有使用贴图、参考图采样、预烘焙纹理、canvas 图案或样式拟合。`mvp/src/visual/thinFilmSim.js` 中增强了 `GAMMA_IMPLICIT_FRAGMENT_SHADER` 的 residual relaxation、`GAMMA_VELOCITY_CORRECTION_FRAGMENT_SHADER` 的 Marangoni 速度回写，并提高 Gamma projection 迭代强度；随后用 headed Chrome 验证。headless/SwiftShader 下多个旧有大型 pass 会报 `VALIDATE_STATUS false`，这是验证环境假阴性；headed GPU 路径无 shader error。

第一轮增强截图为 `run-2206` 到 `run-2218`，结果 JSON 为 `artifacts/targets/run-2206-2218-huang-closure-gain-headed-low-capture-results.json`，对比为 `run-2206-2218-huang-closure-gain-headed-low-comparison.json`。结果失败：`run-2218 beauty` 跑到 step 1087 后 `eta mean=0.6823 thickFraction=0.7288`，`Gamma mean=0.2477`，`|u|max=0.051 activeFraction=0.0001`。图像出现非物理横向条纹，青绿/紫蓝仍为 0；说明闭环增益过强但没有质量约束，导致表活剂全局塌陷、厚膜过度堆积。

随后增加 Huang 模型一致的质量保护：`Gamma` 隐式投影加入弱的 surfactant mass anchor，避免全局流失；`FIELD_STEP` 增加 `etaMassRelaxation` 与 `highEtaDrain`，把膜厚增长限制为可排液的守恒近似；同时略降 Gamma 投影和速度回写强度。语法检查通过：`Get-Content -Raw mvp/src/visual/thinFilmSim.js | node --input-type=module --check`。

质量保护后的验证为 `run-2219` 到 `run-2229`：`run-2219-2221-huang-mass-guard-headed-check-capture-results.json`、`run-2219-2221-huang-mass-guard-headed-check-comparison.json`、`run-2222-2229-huang-mass-guard-headed-views-capture-results.json`。solid 继续通过；thickness/phase/velocity/foam/filamentConnectivity/phaseArea/etaGammaVelocity/gammaCandidate/gammaRhsResidual 均成功截图且 headed 路径无 shader error。关键读回：step 193 左右 `eta mean≈0.545 thickFraction≈0.20`、`Gamma mean≈0.466`、`|u|max≈0.053-0.061 activeFraction≈0.0002-0.0004`、`DeltaGamma absMax≈0.0003-0.0015`；长跑 beauty `run-2221` step 660 时 `eta mean=0.6248 thickFraction=0.5034`、`Gamma mean=0.4402`、`|u|max=0.0647 activeFraction=0.0014`。质量保护有效，但速度场仍未形成足够内部活跃面积。

图像对比：`run-2221 beauty` 相比 `run-2189` 亮度和橙金占比略升，`orangeGold` 从约 0.1218 到 0.1308，`p95Value` 从 0.4392 到 0.5294；但参考图仍为 `orangeGold≈0.2425`、`cyanGreen≈0.0312`、`purpleBlue≈0.034`、`bright≈0.3882`。当前 `cyanGreen≈0.0002`、`purpleBlue=0`、`creamWhite≈0.0003`，与参考图核心特征仍差很远。视觉上仍是小球，只有局部青绿横向带和大片橙膜，没有参考图的分叉河网、紫蓝窄边和微滴密度。

与 Huang et al. 2020 全文模型对照：本轮修复了一个必要的数值稳定性问题，即 `Gamma` 和 `eta` 不应在局部显式近似中无约束漂移；但仍没有达到主文 4.3 的强耦合效果。当前 `Gamma_candidate` 和 `gammaRhsResidual` 有可读信号，`uAfterMarangoni` 也能显示速度场，但 `velocity.activeFraction` 仍接近 0，`divergenceAfterGammaProjection` 没有在球面内部形成连续分叉压缩带。因此下一步仍应留在 Huang 主模型范围内，不引入补充论文；需要先把 `Gamma_candidate -> u_after_gamma -> div_s(u_after_gamma) -> eta/Gamma continuity` 做成更硬的多 pass 闭环，并用读回约束 `|u| activeFraction` 和内部 `projectedDivergence` 连通性。

下一步计划：
1. 不改构图，不调 beauty 颜色。给 `uAfterMarangoni` / `divergenceAfterGammaProjection` 增加更直接的内部连通统计，确认速度弱是梯度不足、阻尼过强，还是 projection 顺序问题。
2. 把 `Gamma` projection 循环改成每轮都先写 `Gamma_candidate`，再用新 `Gamma` 更新 `u_after_gamma`，再重新计算 `div_s(u_after_gamma)` 和 residual；当前单次弱反馈不够。
3. 在 `riverPathSkeleton/phaseArea` 继续要求来自 `-div_s(u)`、`|grad_s Gamma|`、`eta` 薄谷和速度方向连续性的物理证据；没有这些证据时不允许大 sheet 假装河道。
4. 目标读回门槛：`Gamma` 不塌陷（mean 约 0.43-0.52）、`eta` 厚区不过饱和（thickFraction 不长期超过 0.45）、`velocity.activeFraction` 明显脱离 0、内部 `projectedDivergence` 出现连续分叉压缩带；然后再检查 beauty 是否自然出现青绿河道和紫蓝窄边。

## 2026-06-01 heartbeat / Run 2171-2189: eta/Gamma/u 读回诊断，确认 Gamma RHS 有信号但回写量级太弱

本轮开始前按硬要求重新读取了 `artifacts/targets/soap-film-huang-2020-fulltext-notes.md`、`artifacts/targets/soap-film-physics-handoff.md`、`artifacts/targets/soap-film-target.md` 和本迭代文件，并重新查看 `artifacts/targets/soap-film-reference.jpg`、上一轮最新 `run-2170-beauty-huang-gamma-feedback-loop-low.png`、`run-2154-thickness`、`run-2160-gammaCandidate`、`run-2161-gammaRhsResidual`、`run-2169-riverPhase`。改前对比：参考图仍是橙金厚膜主体、青绿分叉河道、紫蓝窄边和密集奶金/白色微滴；上一轮 beauty 仍是暗橙小球，青绿/紫蓝/奶金微滴统计几乎为 0。`gammaCandidate` 有整壳层青绿信号，但 `gammaRhsResidual` 和投影后散度近黑，说明失败点继续在 Huang 2020 的 `eta/Gamma/u` projection-like 闭环，不是构图或调色。

本轮计划按上一轮记录执行：先做安全数值读回，明确 `gammaResidual/projectedDivergence/divMobilityGradGamma` 是真实过小、被 clamp 压扁，还是只在显示尺度上过暗。本轮没有改相机、构图、beauty 干涉色，也没有使用贴图、参考图采样、预烘焙纹理、canvas 图案或样式拟合。代码改动集中在 `mvp/src/visual/thinFilmSim.js`：把 `gammaResidualTarget` 和 `gammaCandidateDiagnosticTarget` 改为 byte 诊断 target，并扩展 `readDiagnostics()`，在 `filmReadback=1` 时同时读回 `etaGammaVelocityTarget`、`gammaResidualTarget`、`gammaCandidateDiagnosticTarget`，解码出 `eta/Gamma/|u|/projectedDivergence/gammaRhsResidual/DeltaGamma` 的数值范围和有效面积分数。

静态检查：`thinFilmSim.js`、`logoScene.js`、`controlSchema.js`、`main.js` 均通过 `Get-Content -Raw -Encoding UTF8 | node --input-type=module --check`。本地服务 HTTP 200。截图序列 `run-2171` 到 `run-2189`，全部带 `filmReadback=1`，结果 JSON 为 `artifacts/targets/run-2171-2189-huang-readback-diagnostics-low-capture-results.json`，对比统计为 `artifacts/targets/run-2171-2189-huang-readback-diagnostics-low-comparison.json`。

验证结果：`run-2171 solid` 红色壳层稳定可见，`redSolid=0.1273`，最小可见性继续通过。`thickness/phase/velocity/foam/filamentConnectivity/phaseArea/etaGammaVelocity/gammaCandidate/gammaRhsResidual/gammaResidual/divergenceAfterGammaProjection/uAfterMarangoni/huangMobilityDivergence/huangGammaResidual/huangEtaContinuity/riverPathSkeleton/riverPhase/beauty` 全部 `ready=true`，`readbackEnabled=true`，`readbackError=null`，控制台 logs 为 0；`run-2172 thickness` 仍有一次导航等待超时，但截图与 debug 有效。`run-2178 etaGammaVelocity` 显示厚度/Gamma/速度有低频结构；`run-2179 gammaCandidate` 仍是整壳层青绿；`run-2180 gammaRhsResidual` 仍接近黑；`run-2188 riverPhase` 仍是紫色斜向片状结构；`run-2189 beauty` 仍是暗橙小球，没有参考图的青绿河网、紫蓝窄边和微滴密度。

关键数值读回来自 `run-2189 beauty` 的 `window.__soapFilmDebug.filmDiagnostics`：`eta min=0.2902 max=0.6941 mean=0.5071 thickFraction=0.0387`，说明膜厚已经不全薄，但厚岛面积远小于参考图的大面积橙金厚膜；`Gamma min=0.4392 max=0.498 mean=0.4722 highFraction=0`，说明表活剂范围过窄，没有足够梯度；真实速度 `|u| max=0.0373 mean=0.0200 activeFraction=0`，速度场太弱；`projectedDivergence min=-0.0595 max=0.0581` 但强压缩/强膨胀面积都只有约 `0.004`；`gammaRhsResidual absMax=0.0278 nonZeroFraction=0.1274 strongFraction=0.0034`，说明 RHS 并非全无，但 `DeltaGamma absMax=0.0007 nonZeroFraction=0.0046`，真正写回 Gamma 的量级太小。`gammaClosureEncoded.visibleFraction=0.0562` 也支持这一点：闭环有微弱可见信号，但没有形成内部连通河道。

图像统计：参考图 `orangeGold=0.3933 cyanGreen=0.0636 purpleBlue=0.0293 creamWhite=0.0078 bright=0.4441 meanValue=0.3614`；上一轮 `run-2170 beauty` 为 `orangeGold=0.1222 cyanGreen=0 purpleBlue=0 creamWhite=0.0003 bright=0.0906 meanValue=0.0862`；本轮 `run-2189 beauty` 为 `orangeGold=0.1225 cyanGreen=0 purpleBlue=0 creamWhite=0.0003 bright=0.0943 meanValue=0.0868`。诊断改动没有伪造画面，也没有实质改善 beauty；它确认了失败原因是物理闭环量级不足。

与 Huang et al. 2020 全文模型对照：本轮只是诊断，不是完整解法。按照主文 4.3，`Gamma` projection-like solve 应当把 `Gamma` 解出的表面张力梯度强回写到 `u`，再通过新的 `div_s(u)` 更新 `eta` 和 `Gamma`。当前实现虽然有 `gammaRhsResidual`，但 `DeltaGamma` 被压到 `1e-3` 以下，`u` 也低于 active 阈值，导致 `eta/Gamma/u` 没有形成参考图所需的 Marangoni 收缩、分叉河道和边界微滴触发。失败仍在 Huang 主模型覆盖范围内，暂不引入补充论文。

下一步计划：
1. 不改构图，不调 beauty。把 Gamma projection 更新从“RHS 有信号但 DeltaGamma 近零”的状态改成真正的闭环放大：提高 `Gamma` solve 中 residual 对 `Gamma` 的写回量，同时限制总量守恒和 clamp，避免全屏漂移。
2. 用更新后的 `Gamma` 立即重新计算 `u_after_gamma`，提高 `-(M/eta)grad_s(Gamma)` 对速度的作用，让 `|u| max` 和 activeFraction 脱离 0；之后再用新的 `div_s(u)` 写回 `eta`。
3. 每次改动后继续用 `filmReadback=1` 验证：目标不是先让颜色好看，而是让 `Gamma range` 拉开、`DeltaGamma` 上升到能被连续性看到、`velocity.activeFraction > 0`、`projectedDivergence` 在内部形成连通压缩带。
4. 只有上述物理读数成立后，才继续放开 `riverPathSkeleton/phaseArea/riverPhase` 的宽片 gate，否则所有青绿/紫边仍应判为失败。

## 2026-06-01 heartbeat / Run 2153-2170: Gamma full-step residual feedback 验证，确认仍未进入 Huang 主闭环

本轮开始前按自动化要求重新读取了 `artifacts/targets/soap-film-huang-2020-fulltext-notes.md`、`artifacts/targets/soap-film-physics-handoff.md`、`artifacts/targets/soap-film-target.md` 和本迭代文件，并重新查看 `artifacts/targets/soap-film-reference.jpg`、上一轮 `run-2151-beauty-huang-gamma-candidate-diagnostics-low.png`、`run-2135-thickness`、`run-2136-phase`、`run-2140-phaseArea`、`run-2141-gammaCandidate`、`run-2142-gammaRhsResidual`。改前对比结论：参考图仍是大面积橙金厚膜，被青绿分叉河道切开，边界有紫蓝窄带与奶金/白色微滴；上一轮 beauty 仍是暗橙小球，`gammaCandidate` 近似均匀青绿，`gammaRhsResidual` 和投影后散度几乎全黑。失败点仍在 Huang 2020 全文覆盖的 `eta/Gamma/u`、Marangoni 和 projection-like 闭环，不是构图或最终调色。

本轮计划来自上一轮：不改构图，不调 beauty 颜色，不采样参考图，不使用贴图、预烘焙纹理、canvas 图案或样式拟合；先把 `Gamma` 隐式近似从过弱的单步候选值改成带 residual feedback 的 full-step 近似。实现集中在 `mvp/src/visual/thinFilmSim.js`：`GAMMA_IMPLICIT_FRAGMENT_SHADER` 改用球面加权 Laplacian 和 `marangoniProjectionWeights` 估算 `div_s(M grad_s Gamma)`，把 `projectedDivergence`、`gammaResidual`、`divMobilityGradGamma` 组成更强 RHS，并让 Gamma Jacobi 使用完整 `dt` 迭代；速度修正仍按迭代次数分摊，避免单步把 `u` 打爆。`gammaCandidate/gammaRhsResidual` 诊断显示尺度也被放大，只用于观察中间物理场，没有反向伪造最终画面。

静态检查：`thinFilmSim.js`、`logoScene.js`、`controlSchema.js` 均通过 `Get-Content -Raw -Encoding UTF8 | node --input-type=module --check`。内置浏览器仍返回 “No active Codex browser pane available”，因此沿用 headed/offscreen Edge 验证路径。本地服务 HTTP 200。第一次截图在 `run-2152 solid` 后因 `thickness` 等待 `load` 超时中断；随后改用 `domcontentloaded` 并完成完整序列 `run-2153` 到 `run-2170`。截图 JSON 为 `artifacts/targets/run-2153-2170-huang-gamma-feedback-loop-low-capture-results.json`，对比统计为 `artifacts/targets/run-2153-2170-huang-gamma-feedback-loop-low-comparison.json`。

验证结果：`run-2153 solid` 红色壳层稳定可见，`redSolid=0.1277`，最小可见性继续通过。`thickness/phase/velocity/foam/filamentConnectivity/phaseArea/gammaCandidate/gammaRhsResidual/gammaResidual/divergenceAfterGammaProjection/uAfterMarangoni/huangMobilityDivergence/huangGammaResidual/huangEtaContinuity/riverPathSkeleton/riverPhase/beauty` 全部截图成功，控制台未记录 shader/WebGL error；`run-2154 thickness` 导航仍有一次 `domcontentloaded` 超时，但 `window.__soapFilmDebug.ready=true` 且截图有效。`run-2160 gammaCandidate` 现在有明显青绿壳层信号，说明候选 Gamma 场可见；但 `run-2161 gammaRhsResidual`、`run-2163 divergenceAfterGammaProjection`、`run-2166 huangGammaResidual`、`run-2167 huangEtaContinuity` 仍接近黑，只在边缘/极弱区域有信号。`run-2169 riverPhase` 出现紫色斜向片状结构，仍不是参考图中的青绿分叉河道；`run-2170 beauty` 仍是小暗橙球，内部有淡白/淡绿擦痕，但没有参考图的青绿河网、紫蓝窄边和高密度微滴。

图像对比统计采用本轮比较脚本口径：参考图 `orangeGold=0.3933 cyanGreen=0.0636 purpleBlue=0.0293 creamWhite=0.0078 bright=0.4441 meanValue=0.3614`；上一轮 `run-2151 beauty` 为 `orangeGold=0.1212 cyanGreen=0 purpleBlue=0 creamWhite=0.0003 bright=0.0977 meanValue=0.0879`；本轮 `run-2170 beauty` 为 `orangeGold=0.1222 cyanGreen=0 purpleBlue=0 creamWhite=0.0003 bright=0.0906 meanValue=0.0862`。即本轮 orangeGold 只微增 `+0.0010`，亮度下降，青绿/紫蓝/奶金微滴仍没有进入最终 beauty。该结果明确说明 full-step residual feedback 仍没有把 Huang 的 chemomechanical 耦合传到 `eta` 厚度场与干涉色主通道。

与 Huang et al. 2020 全文模型对照：本轮更接近主文 4.3 的 `Gamma` projection-like 思路，但仍不是论文中的完整球面线性系统。当前 fragment 近似没有真正求解全局 SPD 系统，也没有把更新后的 `Gamma`、`u_after_gamma`、`div_s(u)` 与 `eta` 连续性在同一子步内形成强反馈；`Gamma_candidate` 可见而 residual/continuity 近黑，说明变量尺度、mobility/eta 权重和回写顺序仍不对。暂不引入补充论文，因为失败仍处于 Huang 2020 已明确覆盖的核心 `eta/Gamma/u` 耦合范围内。

下一步计划：
1. 不改构图，不调 beauty 颜色。先给 `Gamma/u/eta` 中间 target 增加安全数值读回或低分辨率统计输出，明确 `gammaResidual/projectedDivergence/divMobilityGradGamma` 是真实过小、被 clamp 压扁，还是只在显示尺度上过暗。
2. 按 Huang 2020 的变量定义重新核对当前 shader 通道：确认 `eta` 半厚度、`Gamma` 表面浓度、`u_phi/u_theta`、`gamma(Gamma)` 和 mobility 的量纲/范围，没有把可视归一化量当物理量直接代入。
3. 把 `Gamma` projection-like 更新拆成更硬的闭环：`Gamma_candidate -> u_after_gamma -> div_s(u_after_gamma) -> eta/Gamma continuity` 在同一 substep 内反复回写，而不是只更新一个 Gamma target 后依赖下游弱耦合。
4. 只有当 `divergenceAfterGammaProjection/huangGammaResidual/huangEtaContinuity` 在泡面内部形成连通压缩与 Marangoni 梯度后，才允许 `riverPathSkeleton/phaseArea/riverPhase` 生成大面积河道；否则继续把宽片状相场判为失败。

## 2026-06-01 heartbeat / Run 2134-2151: Gamma 候选场与 RHS 残差拆分，确认主失败点仍在 `Gamma/u` 闭环过弱

本轮开始前已重新读取 `artifacts/targets/soap-film-huang-2020-fulltext-notes.md`、`artifacts/targets/soap-film-physics-handoff.md`、`artifacts/targets/soap-film-target.md` 和本迭代文件，并重新查看 `artifacts/targets/soap-film-reference.jpg`、上一轮 `run-2133-beauty-huang-solid-restored-headed-low.png`、`run-2117-thickness`、`run-2118-phase`、`run-2120-foam`、`run-2122-phaseArea`。对比结论：参考图是近景穹顶，橙金厚膜占主体，内部有青绿分叉河道、紫蓝窄边和大量奶金/白色微滴；上一轮仍是小完整球，beauty 暗橙、青绿与紫蓝几乎为零，phase/phaseArea 是宽片和竖向缺口，不是 Huang 2020 的 `eta/Gamma/u`、Marangoni 与 `-div_s(u)` 自洽产生的窄分叉通道。

本轮计划按上一轮记录执行：不改构图，不调 beauty 颜色，不采样参考图，先把 Huang 主文 4.3 相关的 `Gamma_candidate`、`u_after_gamma`、`projected_divergence`、`gamma_rhs_residual` 拆成可见中间场。实现集中在 `mvp/src/visual/thinFilmSim.js`、`mvp/src/visual/logoScene.js` 和 `mvp/src/config/controlSchema.js`：新增 `GAMMA_CANDIDATE_DIAGNOSTIC_FRAGMENT_SHADER` 与 `gammaCandidateDiagnosticTarget`，输出 `r=Gamma_candidate`、`g=0.5+projected_divergence`、`b=0.5+gamma_rhs_residual`、`a=|Delta Gamma|`；新增 debug view `gammaCandidate` 和 `gammaRhsResidual`。该 target 只做诊断，没有反向驱动 `eta/Gamma/u`，也没有使用贴图、参考图采样、预烘焙纹理、canvas 图案或样式拟合。

静态检查：`thinFilmSim.js`、`logoScene.js`、`controlSchema.js` 均通过 `Get-Content -Raw -Encoding UTF8 | node --input-type=module --check`。内置浏览器当前返回 “No active Codex browser pane available”，因此延续上一轮可用的 headed/offscreen Edge 截图路径；本轮本地服务返回 HTTP 200，完成后会停止。截图序列为 `run-2134` 到 `run-2151`，结果 JSON 为 `artifacts/targets/run-2134-2151-huang-gamma-candidate-diagnostics-low-capture-results.json`，对比统计为 `artifacts/targets/run-2134-2151-huang-gamma-candidate-diagnostics-low-comparison.json`。

验证结果：`run-2134 solid` 红色壳层稳定可见，说明壳层几何、材质、相机和 front-face/side 链路继续成立。`thickness/phase/velocity/foam/filamentConnectivity/phaseArea/gammaCandidate/gammaRhsResidual/gammaResidual/divergenceAfterGammaProjection/uAfterMarangoni/huangMobilityDivergence/huangGammaResidual/huangEtaContinuity/riverPathSkeleton/riverPhase/beauty` 均 `ready=true`、`runtimeLogCount=0`，无新增 shader/WebGL 报错；`run-2135 thickness` 有一次 `page.goto` 超时但最终 `ready=true` 且截图成功。新增 `run-2141 gammaCandidate` 近似均匀青绿，说明当前 `Gamma_candidate` 基本没有形成分叉结构；`run-2142 gammaRhsResidual` 和 `run-2144 divergenceAfterGammaProjection` 几乎全黑，说明 RHS 残差与投影后散度在可见尺度上太弱，不足以驱动参考图中的收缩河道。

图像对比统计：参考图 `orangeGold=0.3265 cyanGreen=0.0636 purpleBlue=0.0303 creamWhite=0.0077 bright=0.3894 meanValue=0.3614`；上一轮 `run-2133 beauty` 为 `orangeGold=0.1223 cyanGreen=0 purpleBlue=0 creamWhite=0.0004 bright=0.0447 meanValue=0.0882`；本轮 `run-2151 beauty` 为 `orangeGold=0.1201 cyanGreen=0 purpleBlue=0 creamWhite=0.0003 bright=0.0476 meanValue=0.0879`。也就是说本轮没有视觉接近参考图，反而明确证明 beauty 失败不是构图或调色问题，而是主物理中 `Gamma/u` 残差和投影散度没有在球面内部形成足够强的局部收敛。

与 Huang et al. 2020 全文模型对照：本轮新增的是诊断拆分，不是完整 SPD projection-like solve。当前实现仍缺少主文所需的真正联合线性系统：`Gamma` 解出后应更强地回写 `u`，再由新的 `div_s(u)` 同步更新 `eta/Gamma`；现在 `gamma_rhs_residual` 太弱，`u_after_gamma` 和 `projected_divergence` 也没有内部连通结构，导致 `riverPathSkeleton/phaseArea` 继续从宽片诊断而不是物理收敛前沿派生。暂不寻找补充论文，因为失败仍处在 Huang 2020 已覆盖的 `eta/Gamma/u` 球面 chemomechanical 主模型。

下一步计划：
1. 不改构图，不调 beauty 颜色。先把 `Gamma` 隐式近似从“局部候选值很小”升级为显式残差反馈循环：每轮用 `gamma_rhs_residual` 构造下一轮 RHS，并用更新后的 `Gamma` 立即计算 `u_after_gamma`、重新计算 `div_s(u)`。
2. 为 `gammaRhsResidual` 增加数值读回或独立归一化诊断，确认它是物理量真实过小，还是 debug 显示尺度过暗。
3. 继续收紧 `riverPathSkeleton/phaseArea` 的宽片 gate：没有 `projected_divergence + div((M/eta)grad Gamma) + gamma_rhs_residual` 的内部连通信号时，不允许大面积 sheet 进入 `riverPhase`。
4. 完成上述 Huang 主模型环节后，如果微滴/泡沫成核仍无法复现，再按目标文档规则寻找补充论文并全文审核与 Huang 核心模型是否冲突。

## 2026-06-01 heartbeat / Run 2116-2133: solid 最小可见性恢复，headless readback/context loss 隔离，sheet gate 初步收紧

本轮开始前重新读取了 `artifacts/targets/soap-film-huang-2020-fulltext-notes.md`、`artifacts/targets/soap-film-physics-handoff.md`、`artifacts/targets/soap-film-target.md` 和本迭代文档，并先强制对比上一轮 `run-2110-beauty-huang-projection-diagnostics-low.png`、`run-2101-divergenceAfterGammaProjection`、`run-2104-huangGammaResidual`、`run-2108-riverPathSkeleton`、`run-2109-riverPhase` 与 `artifacts/targets/soap-film-reference.jpg`。对比结论：参考图仍是大面积橙金厚膜、青绿分叉河道、紫蓝窄边和奶金/白色微滴；上一轮仍是小完整球、右上粉白/暗金块、几乎无青绿/紫蓝，`riverPathSkeleton/riverPhase` 仍是宽 sheet，不是 Huang 2020 的 `eta/Gamma/u`、Marangoni 与 `-div_s(u)` 支撑出的窄连通河道。

本轮计划按上一轮记录执行：先不要修构图，不做 beauty 调色，先恢复/验证 `solid` 最小可见性，再检查 `thickness/phase/velocity/foam/filamentConnectivity/phaseArea` 和 Huang 诊断。开始时尝试把 `Gamma` 隐式步改为带 `M/eta` 权重的 projection-like Jacobi，并给 `Gamma/u` 回写加 residual gate；但 headless Edge 在非 solid 视图中触发 `CONTEXT_LOST_WEBGL`，所以立即回退最激进的变系数求解和速度 residual 增益，保留稳定的常系数 `Gamma` residual 反馈，并把主要改动集中到两点：
- `mvp/src/visual/logoScene.js`：`solid` debug view 不再执行薄膜仿真更新，只用于验证壳层几何/材质/相机/front-face 最小可见性；默认关闭每帧 `readPixels` 调试探针和 `thinFilmSim.diagnostics` 全图 readback，只有显式 `filmReadback=1` 时开启，避免 headless readback 把 WebGL context 打掉。
- `mvp/src/visual/thinFilmSim.js`：`riverPathCost` 新增 `physicalLineSupport` 与 `sheetPhysicsReject`，要求河道 birth 同时有 Huang convergence、Marangoni branch、窄线门控和 capillary/meniscus 证据；`phaseArea` 新增 `closedLoopPath`，让相区填充受 path cost 的闭环证据约束，减少宽片状 sheet 直接进入 `riverPhase`。

静态检查：`thinFilmSim.js`、`logoScene.js`、`controlSchema.js` 均通过 `Get-Content -Raw -Encoding UTF8 | node --input-type=module --check`。内置浏览器通道出现过 tab session 失效；headless Edge 会在仿真视图读回/截图路径上丢 context，但 headed/offscreen Edge 可稳定截图。因此本轮正式截图用 headed/offscreen Edge，验证对象仍是同一个 `http://127.0.0.1:4173/` 页面。截图序列 `run-2116` 到 `run-2133`，JSON 为 `artifacts/targets/run-2116-2133-huang-solid-restored-headed-low-capture-results.json`，比较统计为 `artifacts/targets/run-2116-2133-huang-solid-restored-headed-low-comparison.json`。

验证结果：`run-2116 solid` 恢复红色壳层可见，`ready=true`、`glassVisible=true`，说明几何、材质、相机和 front-face 链路可用；`thickness/phase/velocity/foam/filamentConnectivity/phaseArea/gammaResidual/divergenceAfterGammaProjection/uAfterMarangoni/huangMobilityDivergence/huangGammaResidual/huangEtaContinuity/huangDivergence/huangGradGamma/riverPathSkeleton/riverPhase/beauty` 均完成截图且无 shader error。`run-2117 thickness` 可见橙金厚度场；`run-2131 riverPathSkeleton` 仍是紫绿大块 sheet，加黑洞，不是参考图那种窄分叉河道；`run-2122 phaseArea` 仍有单条宽竖向缺口和大片粉紫相区；`run-2133 beauty` 是暗橙金小球和少量淡青/白边线，仍不接近参考图。

粗略统计同一脚本口径：参考图 `orangeGold=0.4757 cyanGreen=0.0676 purpleBlue=0.0430 creamWhite=0.0032 bright=0.4625 meanValue=0.3614`；上一轮 `run-2110` 为 `orangeGold=0.1093 cyanGreen=0 purpleBlue=0 creamWhite=0.0236 bright=0.1311 meanValue=0.1119`；本轮 `run-2133` 为 `orangeGold=0.1234 cyanGreen=0 purpleBlue=0 creamWhite=0.0003 bright=0.1109 meanValue=0.0882`。`solid` 的红色覆盖约 `debugRedSolid=0.1259`，确认最小可见性恢复；但 beauty 的青绿/紫蓝仍为 0，奶金/白色微滴反而更低。

与 Huang et al. 2020 全文模型对照：本轮没有完成真正的主文 4.3 `Gamma/u` SPD projection-like 联立求解；最激进的变系数 fragment 近似被证明不适合作为直接替代，已回退到稳定路径。当前保留的 sheet gate 只是防止 `riverPathSkeleton/phaseArea` 把宽片误当河道，不能替代 Huang 的球面 `eta/Gamma/u` 闭环。下一步必须在可验证、可分阶段回退的前提下实现真正的多 pass residual feedback：每轮 `Gamma` 更新后回写 `u`、重新计算 `div_s(u)` 与 `div_s((M/eta)grad_s Gamma)`，再把 residual 输入下一轮，而不是一次性把变系数 SPD 近似硬塞进单个 shader。

下一步计划：
1. 保持 `solid` 路径独立，先用它做每轮最小可见性守门；仿真视图继续用 headed/offscreen 验证，直到能找到不丢 context 的 headless 参数或读回策略。
2. 给 `Gamma/u` 闭环拆出更小的中间 target：`Gamma_candidate`、`u_after_gamma`、`projected_divergence`、`gamma_rhs_residual`，逐 pass 验证数值范围，避免再次黑屏。
3. 继续收紧 `riverPathSkeleton/phaseArea`：没有内部 `divergenceAfterGammaProjection + huangMobilityDivergence + huangGammaResidual` 连通证据时，不允许大面积 sheet 进入 `riverPhase`。
4. 暂不寻找补充论文，因为当前失败点仍属于 Huang 2020 覆盖的 `eta/Gamma/u` 球面 chemomechanical 主模型，而不是论文未覆盖机制。

## 2026-06-01 heartbeat / Run 2093-2110: Huang 投影后散度与残差拆分，确认主缺口仍在 Gamma/u 闭环

本轮开始前按自动化硬要求重新读取了 `artifacts/targets/soap-film-huang-2020-fulltext-notes.md`、`artifacts/targets/soap-film-physics-handoff.md`、`artifacts/targets/soap-film-target.md` 和本迭代文档，并重新查看 `artifacts/targets/soap-film-reference.jpg`、上一轮最新 `run-2092-beauty-huang-pole-aware-final-prewarm-low.png`、`run-2084-huangDivergence`、`run-2085-huangGradGamma`、`run-2090-riverPathSkeleton` 与 `run-2078-thickness`。改前对比结论：参考图是橙金厚膜主体被青绿分叉河道切开，河道两侧有紫蓝窄边和奶金/白色微滴；`run-2092` 仍是小完整球体、弱橙色水平条纹和极少青绿/紫蓝，Huang divergence/gradGamma 主要只在上下极区发光，`riverPathSkeleton` 仍是大片 sheet，不是由 `eta/Gamma/u`、Marangoni 和 `-div_s(u)` 支撑的窄连通河道。失败原因继续指向 Huang 2020 主模型的 `Gamma/u` projection-like 闭环不足，不是构图，也不是 beauty 调色。

本轮计划来自上一轮记录：不改相机，不调最终颜色，先把 Huang 全文第 4.3 相关的投影后物理量拆开看。具体实现集中在 `mvp/src/visual/thinFilmSim.js`、`mvp/src/visual/logoScene.js` 和 `mvp/src/config/controlSchema.js`：
- 将现有 `gammaResidual` render target 改为 4 通道诊断：`r=projectedCompression=max(0,-div_s(u_afterGamma))`，`g=abs(div_s((M/eta) grad_s Gamma))`，`b=abs(-Gamma div_s(u_afterGamma)+Ds lap_s Gamma)`，`a=abs(eta div_s(u_afterGamma))`。
- 新增 debug view：`divergenceAfterGammaProjection`、`uAfterMarangoni`、`huangMobilityDivergence`、`huangGammaResidual`、`huangEtaContinuity`。
- 新增视图只复用实时 GPU 物理 render target，没有新增任何贴图、参考图采样、预烘焙纹理、canvas 图案或样式拟合。

静态检查：`thinFilmSim.js`、`logoScene.js`、`controlSchema.js` 均通过 `Get-Content -Raw -Encoding UTF8 | node --input-type=module --check`。内置浏览器当前没有可用活动 pane，因此截图回退到本地 Playwright/Edge；这是验证手段，不影响实现路径。截图序列 `run-2093` 到 `run-2110`，JSON 为 `artifacts/targets/run-2093-2110-huang-projection-diagnostics-low-capture-results.json`。18 个视图全部 `ready=true`、`simSize=128`、`glassVisible=true`、浏览器 error 为空，包含 `solid/thickness/phase/velocity/foam/filamentConnectivity/phaseArea/gammaResidual/divergenceAfterGammaProjection/uAfterMarangoni/huangMobilityDivergence/huangGammaResidual/huangEtaContinuity/huangDivergence/huangGradGamma/riverPathSkeleton/riverPhase/beauty`。

截图后对比：`run-2093 solid` 继续通过最小可见性；`run-2101 divergenceAfterGammaProjection`、`run-2104 huangGammaResidual`、`run-2105 huangEtaContinuity` 都主要集中在上下极区条纹，内部缺少参考图所需的分叉河道压缩场；`run-2102 uAfterMarangoni` 仍是大块平滑速度/eta/Gamma 区域，不是沿河道的连续切向流；`run-2108 riverPathSkeleton` 仍是紫色大 sheet 加黑洞，`run-2109 riverPhase` 仍是大块相场。beauty `run-2110` 出现更明显的右上粉白厚区和底部条纹，但没有青绿分叉河网、紫蓝窄边和自洽微滴链。

粗略统计同一脚本口径：参考图 `orangeGold=0.3628 cyanGreen=0.0902 purpleBlue=0.0245 creamWhite=0.0090 bright=0.4441 meanValue=0.3614`；上一轮 `run-2092` 为 `orangeGold=0.1288 cyanGreen=0 purpleBlue=0 creamWhite=0.0002 bright=0.1050 meanValue=0.0930`；本轮 `run-2110` 为 `orangeGold=0.1083 cyanGreen=0 purpleBlue=0 creamWhite=0.0297 bright=0.1146 meanValue=0.1119`。因此本轮没有视觉接近参考图，反而确认了投影残差和连续性残差被极区/水平带主导。

与 Huang et al. 2020 全文模型对照：本轮完成的是诊断拆分，不是完整解法。当前仍没有真正的 staggered spherical grid、velocity-aligned great-circle/BiMocq2 平流，也没有主文 4.3 中 `Gamma` 与 `u` 的联合 SPD projection-like solve。现有多次 Jacobi pass 虽然回写了 `u`，但诊断显示它没有在泡面内部形成参考图式的 Marangoni 收缩/分叉通道，说明下一步不能继续喂 `riverPathSkeleton/phaseArea`，必须先改 `Gamma/u` 闭环本身。

下一步计划：
1. 在 `Gamma` projection-like 循环中加入每轮重新计算 `div_s(u)` 与 residual 的闭环，而不是只用局部 `Gamma` 平滑后单次修正速度。
2. 把 `riverPathSkeleton/phaseArea` 的 birth/propagation 暂时硬性依赖 `divergenceAfterGammaProjection`、`huangMobilityDivergence`、`huangGammaResidual` 的内部连通信号；若信号只在极区条纹，就不允许生成大面积 sheet。
3. 如果完成上述 Huang 主模型环节后仍没有微滴/泡沫成核与边界聚集，再按目标文档规则查找补充论文，保存全文并逐项审核是否与 Huang 的 `eta/Gamma/u` 球面耦合冲突。

## 2026-06-01 heartbeat / Run 2061-2092: Huang 极点跨越采样修复，solid/全部视图无错但视觉仍失败

本轮开始前按自动化硬要求重新读取了 `artifacts/targets/soap-film-huang-2020-fulltext-notes.md`、`artifacts/targets/soap-film-physics-handoff.md`、`artifacts/targets/soap-film-target.md` 和本迭代文档，并重新查看 `artifacts/targets/soap-film-reference.jpg` 与上一轮最新 `run-2059-beauty-huang-local-diagnostics-prewarm-low.png`、`run-2052-huangDivergence`、`run-2053-huangGradGamma`、`run-2055-huangNarrowGate`、`run-2056-riverPathRawEvidence`、`run-2057-riverPathSkeleton`、`run-2058-riverPhase`。

改前对比：参考图是橙金厚膜主体被青绿分叉河道切开，河道两侧有紫蓝窄边和奶金/白色微滴；`run-2059` 仍是小完整球、橙/棕水平条纹和少量青色边缘，几乎没有青绿分叉河道、紫蓝窄边和微滴密度。`huangDivergence/huangGradGamma` 主要在上下极区/纬向条纹发光，`huangNarrowGate` 基本全黑，`riverPathSkeleton` 是大片紫底加黑洞，不是 Huang 模型中由 `eta/Gamma/u`、Marangoni 和 `-div_s(u)` 支撑的窄连通河道。失败原因仍是球面离散和 `Gamma/u/eta` 联立耦合不足，不是构图或 beauty 调色。

本轮计划：先修 Huang 全文明确要求的球面极点跨越采样。论文要求 `phi` 方向周期，跨越极点时 `theta` 镜像、`phi += 180deg`，速度基向量翻转；上一轮仍有大量 `fract(x)+clamp(y)` 和 `texture2D(... clamp(uv))`，会把极区样本钉死成水平条纹。本轮不改相机/构图，不调 beauty 颜色，不采样参考图、贴图、预烘焙纹理或 canvas 图案。

实现变更集中在 `mvp/src/visual/thinFilmSim.js`：

- 给主 `velocity/field/Gamma` 更新、Huang 诊断、regional/path/river/phase/filament 链路加入 pole-aware spherical sampling：`theta` 越界时镜像，`phi` 加半圈并 `fract`。
- 对所有关键 `velocityAt()` 增加一阶基向量处理：跨极点读取速度时将 `(u_phi,u_theta)` 同时取反，避免把极点另一侧的速度当同一局部基直接使用。
- 将 `sphereSinAt()` 改为基于 pole-aware 后的 `theta`，减少度量项在越界采样处继续使用 clamp 极区值。
- 覆盖范围包括 `VELOCITY_STEP`、`DIVERGENCE`、`PROJECT_VELOCITY`、`GAMMA_IMPLICIT/GAMMA_RESIDUAL/GAMMA_VELOCITY_CORRECTION`、`HUANG_LOCAL_DIAGNOSTIC`、`FIELD_STEP`、`REGIONAL_*`、`RIVER_CORE_*`、`RIVER_PATH_*`、`RIVER_PHASE`、`RIVER_HEIGHT_FLUX`、`FILAMENT_CONNECTIVITY`、`PHASE_AREA`、`PHASE_STEP` 等关键实时物理/诊断 pass。

验证：

- `thinFilmSim.js`、`logoScene.js`、`controlSchema.js` 均通过 `node --input-type=module --check` 或等价 ESM 语法检查。
- 中途验证 `run-2061` 到 `run-2076`：16 个视图全部 `ready=true`、新浏览器上下文 `errorCount=0`。
- 最终验证 `run-2077` 到 `run-2092`：`solid/thickness/phase/velocity/foam/filamentConnectivity/phaseArea/huangDivergence/huangGradGamma/huangMarangoniGate/huangNarrowGate/huangPolarReject/riverPathRawEvidence/riverPathSkeleton/riverPhase/beauty` 全部 `ready=true`、`errorCount=0`；结果 JSON 为 `run-2077-2092-huang-pole-aware-final-prewarm-low-capture-results.json`。
- `run-2077 solid` 最小可见性继续通过，说明本轮没有重新打坏壳层和 shader 编译链路。

视觉与统计对比：参考图粗略 `orangeGold=0.5020 cyanGreen=0.0975 purpleBlue=0.0420 creamWhite=0.0062 bright=0.6229`；上一轮 `run-2059 beauty` 为 `orangeGold=0.1327 cyanGreen=0.0002 purpleBlue=0 creamWhite=0.0002 bright=0.1372`；本轮 `run-2092 beauty` 为 `orangeGold=0.1310 cyanGreen=0 purpleBlue=0 creamWhite=0.0002 bright=0.1329`。因此本轮没有带来可见目标提升：橙金厚膜占比仍远低，青绿分叉河道和紫蓝窄边仍为零，奶金/白色微滴仍极少。

与 Huang et al. 2020 全文模型对照：本轮只把采样坐标从明显违反论文的 UV clamp 推向球面极点合法映射，属于必要基础修复；但仍没有完成 staggered spherical grid、velocity-aligned great-circle/BiMocq2 平流、以及主文 4.3 的 `Gamma/u` SPD projection-like 联立求解。`run-2084 huangDivergence` 仍主要是上下极区条纹，`run-2085 huangGradGamma` 底部/侧边仍更强，`run-2090 riverPathSkeleton` 仍是大片状而不是内部分叉窄线。说明当前失败已经越过“采样错位”层，真正卡在 `Gamma` 投影、速度对齐输运和 path skeleton 宽片抑制。

下一步计划：

1. 不继续改构图、不调 beauty 颜色。先新增/改造 `divergenceAfterGammaProjection` 与 `uAfterMarangoni` 调试，把 `div(u)`、`div((M/eta)grad(Gamma))`、`Gamma residual`、`eta continuity residual` 分开显示，确认主文 4.3 缺口在哪里。
2. 把现在的 `Gamma` 多 pass Jacobi 升级为更接近 Huang 的 projection-like 闭环：每轮用更新后的 `Gamma` 回写 `u`，重新计算球面 `div(u)`，再进入下一次残差，而不是只用局部平滑和弱速度修正。
3. 将 `riverPathSkeleton/phaseArea` 的大面积 sheet 作为强抑制项，只有同时满足 `-div_s(u)`、`|grad_s Gamma|`、Marangoni transverse gate、`eta` 薄谷和速度方向连续性的窄通道才能进入 `riverPhase`。
4. 若完成上述 Huang 主模型环节后仍无法复现微滴/泡沫成核密度，再按目标文件规则寻找补充同行评审论文，保存全文并审核是否与 Huang 的 `eta/Gamma/u` 球面耦合冲突。

## 2026-06-01 heartbeat / Run 2017-2060: Huang 局部算子诊断拆分，确认极区采样与旧宽片链路仍主导

本轮开始前按自动化要求重新读取了 `artifacts/targets/soap-film-huang-2020-fulltext-notes.md`、`artifacts/targets/soap-film-physics-handoff.md`、`artifacts/targets/soap-film-target.md` 和本迭代文档，并重新查看 `artifacts/targets/soap-film-reference.jpg`、上一轮 `run-1999-beauty-huang-internal-river-narrowed-low.png`、`run-1994-riverPathRawEvidence`、`run-1998-riverPhase`。对照结论：参考图是橙金厚膜岛被青绿分叉河道切开，并有紫蓝窄边和奶金/白色微滴；`run-1999` 仍是淡粉/橙宽片，青绿和紫蓝基本为 0。失败仍在 `eta/Gamma/u -> riverPath/core -> riverPhase/phaseArea -> beauty` 的物理链路，不是构图问题。

本轮计划来自上一轮：先新增 Huang 局部物理诊断，而不是继续把宽片 evidence 直接喂给 beauty。实现没有使用贴图、参考图采样、预烘焙纹理、canvas 图案或样式拟合，也没有修改相机/构图/最终调色。

实现变更：

- `mvp/src/visual/thinFilmSim.js` 新增 `HUANG_LOCAL_DIAGNOSTIC_FRAGMENT_SHADER` 和 `huangLocalDiagnosticTarget`，实时输出来自当前模拟场的局部物理量：`r=-div_s(u)` 压缩、`g=|grad_s Gamma|`、`b=cross/along Marangoni gate`、`a=narrowPhysicalGate`。
- `mvp/src/visual/logoScene.js` 和 `mvp/src/config/controlSchema.js` 新增调试视图：`huangDivergence`、`huangGradGamma`、`huangMarangoniGate`、`huangNarrowGate`、`huangPolarReject`。`huangPolarReject` 在壳层 shader 中按同一球面纬向 metric 直接显示，用于检查上下极区/边缘污染。
- 第一次截图后发现四个 Huang 局部视图几乎全黑，于是只放大诊断量程，不改变物理更新和 beauty 映射；目的是看清信号是否存在。

静态检查：

- `thinFilmSim.js` 通过 `node --input-type=module --check`。
- `logoScene.js` 通过 ESM 语法检查。
- `controlSchema.js` 用 UTF-8 管道通过 ESM 语法检查。

截图验证：

- 干净 low-only 序列 `run-2017` 到 `run-2032`，结果 JSON 为 `run-2033-huang-local-diagnostics-clean-low-capture-results.json`，全部 `ready=true`、`errorCount=0`。`run-2017 solid` 红色壳层可见。
- 诊断量程放大后生成 `run-2034` 到 `run-2049`，结果 JSON 为 `run-2050-huang-local-diagnostics-scaled-low-capture-results.json`，全部 `errorCount=0`。`run-2041 huangDivergence` 和 `run-2042 huangGradGamma` 只显示很弱的内部细线，`run-2044 huangNarrowGate` 基本只有底部零星点，未形成可传播的内部连通河道。
- 为排除预热不足，额外用 `filmSubsteps=2`、`filmPrewarmSteps=40`、`filmPressureIterations=8`、`filmSimResolution=128` 生成 `run-2051` 到 `run-2059`，结果 JSON 为 `run-2060-huang-local-diagnostics-prewarm-low-capture-results.json`，全部 `errorCount=0`。预热后 `huangDivergence/gradGamma` 主要变成上下极区条纹和水平带，`narrowGate` 仍不成内部河网。
- 视觉/统计对比：参考图约 `orangeGold=0.4639 cyanGreen=0.0923 purpleBlue=0.0330 creamWhite=0.0150 bright=0.4623`；`run-2049 beauty` 约 `orangeGold=0.1385 cyanGreen=0 purpleBlue=0 creamWhite=0.0023 bright=0.1264`；`run-2059 beauty` 约 `orangeGold=0.1307 cyanGreen=0.0001 purpleBlue=0 creamWhite=0.0002 bright=0.1227`。橙金仍低很多，青绿分叉河道和紫蓝窄边仍未出现。

与 Huang et al. 2020 全文模型对照：

- 本轮诊断证明当前实现虽然已经有球面 `eta/Gamma/u` 局部算子，但其有效信号弱且被极区/纬向条纹污染。Huang 全文要求球面 staggered grid、极点跨越时 `phi` 平移 180 度并处理速度基向量符号；当前大部分 shader 仍用 `fract(x)+clamp(y)` 的简化采样，因此预热后极区条纹会压过内部物理结构。
- `riverPathRawEvidence` 和 `riverPathSkeleton` 仍由旧区域/宽片链路主导：`run-2056` 是块状青/金证据，`run-2057` 是大面积紫色 sheet 加黑色洞，不是沿 `-div_s(u)`、`grad_s Gamma`、Marangoni gate 传播的窄连通河道。
- 因失败点仍属于 Huang 主模型覆盖的球面离散、velocity-aligned advection 和 Gamma projection-like 更新问题，本轮不需要引入补充论文；下一轮应先修这些与 Huang 直接冲突的数值环节。

下一步计划：

1. 先实现共用的 pole-aware spherical sampling：跨越 `theta` 极点时镜像 `theta`、`phi += 0.5`，速度分量按球面基向量做必要符号处理；至少覆盖 `field/velocity/gamma/huangLocal/riverPath` 的核心采样，而不是继续用简单 clamp。
2. 把 `riverPathEvidence/Skeleton` 的 birth 权重改成必须由 `huangDivergence + gradGamma + narrowGate` 支持；旧 `regional` 和宽片相场只能作为低权重背景，不能直接生成 skeleton。
3. 在 Gamma projection-like 更新里输出 `divergenceAfterGammaProjection`，确认 Marangoni 更新后 `-div_s(u)` 是否能在内部产生连续线，而不是只在极区/上下边缘产生条纹。
4. 继续用 low-only 稳定截图 JSON 先验证 `solid -> huangDivergence/gradGamma/narrowGate -> riverPathRawEvidence -> riverPathSkeleton -> riverPhase -> beauty`，通过后再恢复中/高参数。

## 2026-06-01 heartbeat / Run 1976-1999: Huang 球面内部河道证据与窄门控复核

本轮开始前重新读取了 `artifacts/targets/soap-film-huang-2020-fulltext-notes.md`、`artifacts/targets/soap-film-physics-handoff.md`、`artifacts/targets/soap-film-target.md` 和本迭代文档，并回看 `run-1968-beauty-huang-phasearea-local-budget-high.png`、`run-1969-phase`、`run-1970-phaseArea`、`run-1972-riverPhase`、`run-1974-etaGammaVelocity`，同时对照 `artifacts/targets/soap-film-reference.jpg`。上一轮失败点不是构图，而是物理场到可见河道的链路：参考图约 `orangeGold=0.3037`、`cyanGreen=0.0668`、`purpleBlue=0.0286`；`run-1968` 只有 `orangeGold=0.0416`，青绿/紫蓝接近 0。上游 `riverPathRawEvidence/riverPathSkeleton` 仍主要受上下边缘和横带控制，`riverPhase` 没有把内部通道传给 beauty。

本轮计划是不改构图、不盲调颜色，把 river core/path evidence 从平面梯度和区域 mask 改成更接近 Huang et al. 2020 的球面局部证据：球面 `eta` 梯度/拉普拉斯、`Gamma` 梯度、切向速度 `u` 的球面散度、Marangoni 分支项，并压制极区/边缘横带。若证据变成片状，则用物理窄门控收敛，而不是补色。

实现集中在 `mvp/src/visual/thinFilmSim.js`：

- `RIVER_CORE_SUPPORT_FRAGMENT_SHADER` 增加球面 `sin(theta)` 度量下的 gradient/laplacian/velocity divergence，使用 `-div_s(u)`、`grad_s(Gamma)` 和 `grad_s(eta)` 的夹角/横向分量形成内部 core 证据，并加入极区 metric reject。
- `RIVER_PATH_EVIDENCE_FRAGMENT_SHADER` 增加 `uVelocity` 输入和球面散度，让 path open/seed support 接收 Huang 风格的内部收敛与 Marangoni 分支证据。
- `RIVER_PATH_COST_FRAGMENT_SHADER` 增加 `uVelocity`、球面散度和 `huangLine`，降低内部窄河道 cost，减少对宽片状 regional ridge 的依赖。
- 第一次验证发现内部证据变成大块片状后，补上 `narrowPhysicalGate/huangNarrowGate`，用 `cross(grad eta, grad Gamma)`、局部梯度强度、极区抑制和 side-crowd 抑制来收窄证据。

验证结果：

- `node --input-type=module --check` 对 `thinFilmSim.js` 通过。
- low 参数下 solid 最小可见性通过：`run-1976-solid-huang-internal-river-evidence-low.png` 和 `run-1988-solid-huang-internal-river-narrowed-low.png` 均显示红色壳层；最终 low 视图真实 console errors 为 0。
- 第一次改动截图 `run-1982-riverPathRawEvidence` 到 `run-1987-beauty`：内部证据脱离了上下边缘，但变成块状/片状，beauty 为淡橙奶色大块，青绿河道仍为 0。
- 第二次窄门控截图 `run-1994-riverPathRawEvidence`、`run-1995-riverPathSkeleton`、`run-1996-riverCore`、`run-1997-phaseArea`、`run-1998-riverPhase`、`run-1999-beauty`：path evidence 比第一次更暗且更靠内部，但 skeleton 仍是大面积紫/绿片，riverPhase 仍是宽片状洋红/橙色，beauty 仍无参考图的青绿分叉河道和紫蓝窄边。
- low 统计：参考 `orangeGold=0.3037 cyanGreen=0.0668 purpleBlue=0.0286 meanVal=0.3612`；旧高参 `run-1968 beauty` 为 `orangeGold=0.0416 cyanGreen=0 purpleBlue=0 meanVal=0.0718`；本轮最终 `run-1999 beauty` 为 `orangeGold=0.0671 cyanGreen=0 purpleBlue=0 bright=0.0446 nonBlack=0.3675 meanVal=0.1214`。`run-1994 riverPathRawEvidence` 中已有少量 `cyanGreen=0.0101`，但没有传成连通细河道。
- 中/高参数尝试在 `filmSimResolution=256`、多子步/预热条件下页面导航超时，未保存完整 JSON。low 级别已经足够证明本轮修改仍未达到目标。

与 Huang et al. 2020 全文模型对照：本轮只把局部证据从平面启发式改向球面 `eta/Gamma/u` differential operators，并没有完成论文里的 velocity-aligned advection、Gamma projection-like implicit update、全局 coupled surface solve 和 BiMocq2 式传输闭环。因此它比上一轮更接近 Huang 的变量定义，但仍不是完整 chemomechanical 求解器；当前失败说明不能再把宽片状 evidence 直接喂给 `phaseArea/riverPhase`。

下一步计划：

1. 先新增或改造调试输出，分别显示 `-div_s(u)`、`|grad_s Gamma|`、`cross/along Marangoni gate`、`narrowPhysicalGate`、`polarReject`，不要直接进入 beauty。
2. 将 `riverPathSkeleton` 从面积阈值改为沿球面切向速度/Marangoni 方向的连通细线传播；宽片区域只能作为低权重背景，不能直接变成 phase。
3. 对 `phaseArea/riverPhase` 加物理守恒约束：只有和 `eta` 薄化谷、`Gamma` 梯度、`-div_s(u)` 同时自洽的窄连通分支可进入青绿河道；大面积 magenta/orange 片应被降权。
4. 在继续中/高分辨率前先做 low-only 稳定截图 JSON，避免高参数超时掩盖物理链路错误。

## 2026-06-01 heartbeat / Run 1933-1975：phaseArea 编译修复、局部面积预算与仍未形成 Huang 分叉河道
本轮开始前已重新读取 `artifacts/targets/soap-film-huang-2020-fulltext-notes.md`、`artifacts/targets/soap-film-physics-handoff.md`、`artifacts/targets/soap-film-target.md` 和本文档，并确认 `artifacts/references/HuangEtAl-SoapBubbles-SIGGRAPH2020.txt` / `HuangEtAl-SoapBubbles-SIGGRAPH2020-supp.txt` 可用于全文核对。对照仍以 `artifacts/targets/soap-film-reference.jpg` 与 Huang et al. 2020 全文模型并列最高优先级；本轮没有引入贴图、参考图采样、预烘焙纹理、canvas 图案、样式拟合或假纹理，也没有改构图、相机或做单纯调色。

改前强制对比的上一轮结果为 `run-1925-beauty-huang-river-front-age-high.png`、`run-1927-phase-huang-river-front-age-high.png`、`run-1929-riverPhase-huang-river-front-age-high.png`、`run-1926-thickness-huang-river-front-age-high.png`、`run-1928-foam-huang-river-front-age-high.png`、`run-1923-filamentConnectivity-huang-river-front-age-low.png`、`run-1924-phaseArea-huang-river-front-age-low.png`。上一轮相对参考图只有壳层和若干厚膜/泡沫信号可见；主要偏差是 beauty 仍为暗橙/黄绿整球和水平带，青绿分叉河道为零，紫蓝窄边为零，奶金/白色微滴远低于参考密度；phase 是上/下宽 cyan 片夹中间黑带，riverPhase 接近全黑，phaseArea 接近全黑，filamentConnectivity 只有宽紫色/水平证据，说明 `eta/Gamma/u` 还没有形成 Huang 模型要求的局部收敛河道闭环。

本轮首先确认了一个真实 shader 链路错误：`PHASE_AREA_FRAGMENT_SHADER` 中 `riverFilament` 在 `capillaryFilament` 声明前使用了 `capillaryFilament`。该错误在 `run-1932-huang-river-front-age-capture-results.json` 的控制台里表现为 `ERROR: 0:163: 'capillaryFilament' : undeclared identifier` 和后续 `useProgram: program not valid`，这解释了上一轮 `phaseArea` 近黑并非自然物理失败，而是 shader 编译失败。已在 `mvp/src/visual/thinFilmSim.js` 中重排 `capillaryFilament` 声明顺序，并把 `phaseArea` 的主方向改为由基础流向和局部速度混合的 velocity-aligned 方向，同时加入 `lineEvidence/frontUsable/filamentWidthPenalty`，让 `phaseArea` 读取 `filamentConnectivity + riverFrontAge + capillary residual`，而不是只看单帧宽片。

第一组验证 `huang-phasearea-compile-fix` 生成 `run-1933` 到 `run-1948`，结果 JSON 为 `run-1949-huang-phasearea-compile-fix-capture-results.json`。`solid/thickness/phase/velocity/foam/filamentConnectivity/phaseArea/beauty` 全部无 WebGL 新错误；`run-1933 solid` 为 `ready=true`、`glassVisible=true`、中心像素 `[255,20,10,255]`，最小可见性仍通过。`run-1940 beauty` 仍不达标：`eta.max=0.8627`、`eta.mean=0.3186`、`thickFraction=0.0039`，但画面还是暗橙/绿整球和水平带，没有参考图里的青绿分叉河道。`run-1946 phaseArea` 从黑屏恢复为可见，但变成大面积粉橙水平片，证明编译问题已修，新的失败点转为 phaseArea 目标面积过宽、未局部化。

为查上游，本轮生成 `huang-river-upstream-diagnostics`：`run-1950` 到 `run-1958`，结果 JSON 为 `run-1959-huang-river-upstream-diagnostics-results.json`。`riverCoreRawMass/riverPathRawEvidence/riverPathEvidence/riverPathSkeleton/riverCoreGeodesic/riverCoreMass/riverCore/riverPhase/phaseAreaError` 全部无 shader error。对比图像后，`riverPathRawEvidence` 和 `riverPathSkeleton` 的信号主要集中在上下边缘/水平带，不是内部弯曲分叉；`riverCore` 只剩边缘和底部残留；`riverPhase` 仍近黑；`phaseAreaError` 近乎整球 cyan，说明 `targetHigh` 的基线在全局制造相面积缺口，而不是沿 Huang 的 velocity-aligned `eta/Gamma/u` 收敛前沿制造局部河道。

第二次修改把 `PHASE_AREA_FRAGMENT_SHADER` 的 `targetHigh` 改为局部面积预算：新增 `areaGate = f(support, lineEvidence, connectedFilament, capillaryFilament, riverFrontAge, narrowPath, broadSheet)`，把全局基线 `targetHigh` 降低，并仅在 `areaGate/frontUsable/filamentGate/capillaryFilament/riverFrontAge` 同时支持时提高高相目标；同时让 `frontFillGate` 的主填充受 `areaGate` 限制。这个修改的意图不是按参考图画河道，而是避免相面积约束全局扩散，让它只读 Huang 主变量派生出的局部收敛、Marangoni/毛细证据和前沿 age。

第二组验证 `huang-phasearea-local-budget` 生成 `run-1960` 到 `run-1974`，结果 JSON 为 `run-1975-huang-phasearea-local-budget-capture-results.json`。所有视图 `errorCount=0`。`run-1960 solid` 仍为 `ready=true`、`glassVisible=true`、中心像素 `[255,20,10,255]`。`run-1968 beauty` 为 `eta.max=0.6510`、`eta.mean=0.3172`、`thickFraction=0.0004`、`thinFraction=0.0184`；`run-1970 phaseArea` 已不再是完全黑，也比第一组的全局粉橙片更局部，但仍是横向大片结构；`run-1971 phaseAreaError` 仍有大面积 cyan 残差；`run-1972 riverPhase` 和 `run-1973 riverFlux` 仍接近全黑；`run-1974 etaGammaVelocity` 可达到 `eta.max=0.9294`、`thickFraction=0.0131`，说明 `eta/Gamma/u` 局部厚峰存在，但没有被上游 river/core/phaseArea 链路转成参考图里的可见青绿河网。

粗 HSV 对比进一步确认视觉仍失败：参考图约 `orangeGold=0.3037`、`cyanGreen=0.0668`、`purpleBlue=0.0286`、`nonBlack=0.9963`；上一轮 `run-1925 beauty` 约 `orangeGold=0.0445`、`cyanGreen=0`、`purpleBlue=0`；本轮 `run-1968 beauty` 约 `orangeGold=0.0416`、`cyanGreen=0`、`purpleBlue=0`。`run-1969 phase` 有 `cyanGreen=0.0868`，但这些 cyan 仍停留在调试相场宽片里，没有经由膜厚、视角、曲率、Gamma、泡沫/微滴场进入真实干涉 beauty。奶金/白色微滴统计仍接近零，边界微滴也没有沿河道出现。

当前失败原因：渲染最小可见性和 shader 编译链路已恢复，当前不是黑屏问题，也不是构图问题。真正卡点是上游 `riverPath/core` 证据仍由上下边缘和水平带主导，`riverPhase` birth/core support 过弱，`phaseArea` 的面积约束即使局部化后仍未能绑定到内部 `eta/Gamma/u` 收敛分支；因此 Huang 2020 的 `eta/Gamma/u`、Marangoni、球面平流和 projection-like Gamma 近似还没有形成自洽的内部 branching river。因为这个失败仍属于 Huang 主模型覆盖范围内的数值耦合/离散化问题，本轮暂未寻找补充论文；若下一轮仍无法从 Huang 的速度对齐平流、Gamma 投影和球面散度/梯度中复现内部河道，再按最高优先级规则寻找补充同行评审论文或可靠开源研究实现，并保存全文与冲突审核笔记。

下一步计划：

1. 继续不改构图、不调 beauty 颜色、不使用任何图像/纹理伪造。先把 `riverPathRawEvidence/riverPathSkeleton/riverCore` 的证据从上下边缘转移到球面内部 `eta/Gamma/u` 收敛区。
2. 在 `RIVER_PHASE_FRAGMENT_SHADER` 和/或其上游 path/core pass 中加入更直接的 Huang 型局部指标：`-div(u)`、`|grad(Gamma)|`、`grad(eta)` 横向曲率、速度剪切、Marangoni 驱动与 geodesic 宽度惩罚；把宽水平 sheet 当作抑制项，而不是让它决定 river birth。
3. 单独截图并数值检查 `riverPathRawEvidence -> riverPathEvidence -> riverPathSkeleton -> riverCore -> riverPhase -> phaseArea -> beauty`，确认每一级是否产生内部连通分支；不要直接在 beauty 端补 cyan/purple。
4. 只有当内部 river core 稳定后，再把微滴/泡沫显式限制到 meniscus、曲率峰、剪切和 Marangoni 梯度附近，恢复参考图中的奶金/白色微滴密度。
5. 下一轮仍需从 `solid` 开始验证最小可见性，再依次验证 `thickness/phase/velocity/foam/filamentConnectivity/phaseArea/beauty`，并强制与参考图和 Huang 全文模型逐项对比。

## 2026-06-01 heartbeat / Run 1918-1932：river front-age 持久化尝试，solid 通过但 phaseArea/riverPhase 仍失败
本轮开始前已重新读取 `artifacts/targets/soap-film-huang-2020-fulltext-notes.md`、`artifacts/targets/soap-film-physics-handoff.md`、`artifacts/targets/soap-film-target.md` 和本文件，并重新查看 `artifacts/targets/soap-film-reference.jpg`、上一轮 `run-1911-beauty-huang-chem-island-river-mid-high.png`、`run-1913-phase-huang-chem-island-river-mid-high.png`、`run-1914-foam-huang-chem-island-river-mid-high.png`、`run-1915-riverPhase-huang-chem-island-river-mid-high.png`。对照结论没有变化：上一轮只有厚膜峰值恢复；参考图的橙金厚膜大面积主体、青绿分叉河道、紫蓝窄边、奶金/白色微滴密度仍没有出现。Huang et al. 2020 对照点仍是 `eta/Gamma/u` 球面耦合、Marangoni 驱动、velocity-aligned 平流和 projection-like Gamma 更新；本轮不改构图、不改相机、不采样参考图、不引入贴图或 canvas 图案。

本轮改动集中在 `mvp/src/visual/thinFilmSim.js`。`RIVER_PHASE_FRAGMENT_SHADER` 里把 `riverPhase.b` 从瞬时 ridge 升级为随速度/主流方向平流、沿向传播、横向衰减的 `frontAge`，仍保留输出语义 `r=core, g=meniscus, b=ridge/frontAge, a=sheetReject`；`RIVER_MENISCUS_FRAGMENT_SHADER` 增加 age propagation，避免 meniscus pass 把 age 抹掉；`PHASE_AREA_FRAGMENT_SHADER` 和 `PHASE_STEP_FRAGMENT_SHADER` 新增 `riverFrontAge`，让相场填充和微滴成核读取持久前沿，而不是只读单帧局部 ridge。静态语法检查通过，未触碰构图和最终颜色调色。

验证截图为 `run-1918-solid-huang-river-front-age-low.png` 到 `run-1931-etaGammaVelocity-huang-river-front-age-high.png`，结果 JSON 为 `run-1932-huang-river-front-age-capture-results.json`。最小可见性通过：`run-1918 solid` 为 `ready=true`、`glassVisible=true`、`simSize=128`、中心像素 `[255,20,10,255]`，说明壳层/材质/相机/front-face 管线不是当前失败点。低参 `thickness/phase/velocity/foam/filamentConnectivity/phaseArea` 均能返回 `ready=true`。

高参数值：`run-1925 beauty` 为 `eta.min=0.2196`、`eta.max=0.6314`、`eta.mean=0.3149`、`thickFraction=0.0004`、`thinFraction=0.0248`、`gamma.mean=0.2568`、`velocity.mean=0.0722`、`velocity.activeFraction=0.1512`；`run-1931 etaGammaVelocity` 的 `eta.max=0.8039`、`thickFraction=0.0081` 说明主 `eta/Gamma/u` 场仍能生成局部厚峰。但可视结果仍失败：`beauty` 是暗橙/黄绿完整球和上下厚膜带，没有青绿分叉河道；`phase` 仍是上下青绿色宽片夹中间黑带；`riverPhase` 接近全黑，只在下缘有弱青带；`phaseArea` 仍几乎全黑；`foam` 仍是连续暗带而非沿河道边界的离散微滴。

粗 HSV 对比：参考图约 `orangeGold=0.5262`、`cyanGreen=0.1032`、`purpleBlue=0.0406`、`bright=0.2463`；上一轮 `run-1911 beauty` 约 `orangeGold=0.1453`、`cyanGreen=0`、`purpleBlue=0`、`bright=0.0004`；本轮 `run-1925 beauty` 约 `orangeGold=0.1339`、`cyanGreen=0`、`purpleBlue=0`、`bright=0.0003`。`run-1927 phase` 有 `cyanGreen=0.1288`，但这些青绿仍停留在调试相场宽片里，没有被 `eta/Gamma/u` 和薄膜干涉链路转化成参考图的窄河道。视觉上本轮相对上一轮没有达标提升，甚至 beauty 的橙金可见占比略退。

失败原因：front-age 的引入方向正确，但当前 `riverPhase` 的 birth gate 仍被 `target/widthPressure/sheetReject` 压得过弱；`filamentConnectivity` 低参有明显信号，却在 `PHASE_AREA_FRAGMENT_SHADER` 中被 `filamentWidthPenalty/broadSheet/frontUsable` 组合几乎全部拒掉，导致 `phaseArea` 不能承担目标面积约束。换句话说，持久化前沿还没有形成 Huang 风格的自洽面积/质量闭环：`eta/Gamma/u` 的收敛和 Marangoni 梯度能产生局部厚峰，但派生的 river/front/phaseArea 没有稳定连通，最终只能剩横向带状排液。

下一步计划：

1. 继续不改构图、不调色、不引入贴图；先把 `phaseArea` 从几乎全黑修到能读取 `filamentConnectivity + riverFrontAge + eta/Gamma/u convergence` 的物理面积预算。
2. 检查并缩放 `frontUsable`、`filamentWidthPenalty`、`broadSheet` 的阈值，让它们抑制宽片但不压灭窄前沿；目标是 `phaseArea.b fillBudget` 出现沿速度/Marangoni 前沿的连通分支，而非整球宽片。
3. 若 `filamentConnectivity` 的纵向大块仍主导，需要把连接方向从固定主方向改成 Huang 对应的 velocity-aligned 球面平流方向，并用局部 `eta/Gamma` 梯度决定分叉。
4. 下一轮截图必须重复 `solid -> thickness -> phase -> velocity -> foam -> filamentConnectivity -> phaseArea -> riverPhase -> beauty`，并强制把新的 beauty/phaseArea/riverPhase 与参考图和 Huang 全文模型逐项对照。

## 2026-06-01 heartbeat / Run 1886-1917：river 宽片抑制过强，chemomechanical 厚膜保液恢复但仍未达标
本轮开始前已重新读取 `artifacts/targets/soap-film-huang-2020-fulltext-notes.md`、`artifacts/targets/soap-film-physics-handoff.md`、`artifacts/targets/soap-film-target.md` 和本文件，并重新查看 `artifacts/targets/soap-film-reference.jpg`、上一轮 `run-1878-beauty-huang-drain-sign-island-hold-high.png` 以及高参诊断 `run-1880-thickness-highdiag-drain-sign-island-hold-high.png`、`run-1883-riverPhase-highdiag-drain-sign-island-hold-high.png`、`run-1884-riverFlux-highdiag-drain-sign-island-hold-high.png`、`run-1885-etaGammaVelocity-highdiag-drain-sign-island-hold-high.png`。对照结论：上一轮相似点只有厚膜峰值恢复、奶金微滴开始可见；主要偏差仍是完整球/横向宽带，参考图中的橙金厚膜岛面积、青绿分叉河道、紫蓝窄边和边界微滴密度都没有形成。高参 `riverPhase/riverFlux` 证明失败来自物理场宽片，而不是构图或最终调色。

对照 Huang et al. 2020 全文，本轮没有改构图、相机或参考图采样；继续把 `eta/Gamma/u` 作为主物理变量。第一版改动在 `RIVER_PHASE_FRAGMENT_SHADER` 中增加由 `eta/Gamma/phase` 梯度、速度剪切/收敛、`coreSupport` 和 `regional sheetReject` 派生的分叉门控，并提高横向质量压力，目标是阻止 riverPhase 变成整条横向宽片。验证截图为 `run-1886-solid-huang-river-width-physical-low.png` 到 `run-1901-etaGammaVelocity-huang-river-width-physical-high.png`，全部 logs=0，solid 最小可见性继续通过。

第一版判定失败：它确实压住了横向宽片，但压过头，`run-1899-riverPhase-huang-river-width-physical-high.png` 和 `run-1900-riverFlux-huang-river-width-physical-high.png` 几乎全黑。高参 beauty `run-1895` 退化到 `eta.max=0.4863`、`eta.mean=0.2545`、`thickFraction=0`、`thinFraction=0.3000`，说明之前的厚膜岛仍部分依赖 river/meniscus 供给；直接压灭 river 会把厚膜岛也抽掉。

第二版改动把 river 宽片惩罚调回中间值，同时在 `FIELD_STEP_FRAGMENT_SHADER` 新增 `chemIslandShoulder/chemIslandSeed`：厚膜保液直接由 Huang 主变量派生的 `flowConvergence`、`Gamma` 梯度、曲率、`-thinFluxDiv`、`convergenceReservoir` 和入口供给触发，而不是依赖宽 riverPhase。验证截图为 `run-1902-solid-huang-chem-island-river-mid-low.png` 到 `run-1917-etaGammaVelocity-huang-chem-island-river-mid-high.png`，全部 logs=0。

第二版结果：厚膜峰值恢复，`run-1911-beauty` 为 `eta.max=0.6431`、`eta.mean=0.3142`、`thickFraction=0.0001`、`thinFraction=0.0192`；高参调试视图中 `run-1913 phase`、`run-1915 riverPhase`、`run-1916 riverFlux` 的 `eta.max` 约 `0.68-0.70`。但这仍远低于上一轮 `run-1878` 的 `thickFraction=0.0426`，更远低于参考图的橙金厚膜主体。粗 HSV 对比显示参考图约 `orangeGold=0.5197`、`cyanGreen=0.0761`、`purpleBlue=0.0299`、`bright=0.2462`；`run-1911` 约 `orangeGold=0.0520`、`cyanGreen=0`、`purpleBlue=0`、`bright=0.0002`、`dark=0.7871`。图像上 `phase` 仍是上下青绿色宽片夹黑色水平带，`riverPhase` 不是弯曲分叉河道，beauty 仍无参考图的青绿河网和紫蓝窄边。

当前失败原因：只靠单帧局部 `channelTarget`/`widthPressure` 不能同时保留连通河道和抑制横向宽片。压强了会熄灭 river 和厚膜岛，放松后又回到宽片/水平带。Huang 2020 的主模型需要更稳定的 `eta/Gamma/u` 平流与 `Gamma` projection-like 约束；当前相场/river 仍是派生层的局部启发，缺少随时间持久化的 front distance、目标面积守恒和分叉选择，所以不能产生参考图那种 15-25% 的青绿分叉河道。

下一步计划：

1. 不改构图、不调 beauty 颜色；保留 `chemIslandSeed` 这种从 `eta/Gamma/u` 直接来的厚膜保液，但继续让厚膜面积恢复到至少几个百分点。
2. 把 `riverPhase` 从单 pass 局部 target 改为持久化 ping-pong front-distance/age 场，输出 `core probability / age-distance / meniscus / sheetReject`，用沿速度方向和横向 geodesic relaxation 维护连通分叉，而不是每帧靠宽片阈值重算。
3. `phaseArea` 需要做目标面积约束：青绿高相目标仍按参考约 15-25% 作为诊断预算，但实现只能通过 `eta/Gamma/u` 的收敛、Marangoni 梯度、曲率和 front age 派生，不能按图片采样或画图案。
4. `foam`/微滴只能从 meniscus、剪切、曲率峰、Marangoni 梯度和局部扰动生成；下一轮要避免连续白带，同时增加边界离散微滴密度。
5. 若持久化 front-distance 的数值细节在 Huang 2020 中不够明确，再按最高优先级规则寻找补充同行评审论文或可靠开源研究实现，保存全文并审核其是否冲突于 Huang 的 `eta/Gamma/u` 球面耦合主线。

## 2026-06-01 heartbeat / Run 1829-1858：局部压缩回补、厚岛成核与仍未达标的光学响应
本轮开始前已重新读取 `artifacts/targets/soap-film-huang-2020-fulltext-notes.md`、`artifacts/targets/soap-film-physics-handoff.md`、`artifacts/targets/soap-film-target.md` 和本文件，并把上一轮最新 `run-1828-beauty-huang-reservoir-high.png`、`run-1822-thickness-huang-reservoir-low.png`、`run-1823-phase-huang-reservoir-low.png`、`run-1825-foam-huang-reservoir-low.png`、`run-1827-etaGammaVelocity-huang-reservoir-low.png` 与 `artifacts/targets/soap-film-reference.jpg` 强制对比。上一轮相似点只有 solid/调试链路已可见，且 eta 不再全局塌陷；主要偏差是 beauty 仍为暗金整球，参考图里的青绿分叉河道、紫蓝窄边、奶金/白色微滴几乎全缺。上一轮 `run-1828` 的 `eta.mean=0.2721`、`eta.max=0.3882`、`eta.thinFraction=0.2636`、`velocity.mean=0.0544`，说明问题在 Huang eta/Gamma/u 物理场还没形成局部厚岛与薄通道，而不是构图。

本轮对照 Huang et al. 2020 的主线：继续沿球面半厚度 `eta`、表活剂 `Gamma`、切向速度 `u` 的可压缩 chemomechanical/lubrication 模型推进，不使用贴图、参考图采样、预烘焙纹理、canvas 图案、样式拟合或假纹理。实现重点放在 `D eta / D t = -eta div(u) + source - evaporation` 和 `D Gamma / D t = -Gamma div(u) + Ds laplacian(Gamma)` 的局部源/汇项与 `-(M/eta) grad(Gamma)` Marangoni 驱动，而不是改构图或盲目调色。

本轮改动：

- 在 `mvp/src/visual/thinFilmSim.js` 的 velocity step 和 `GAMMA_VELOCITY_CORRECTION_FRAGMENT_SHADER` 中增强 Huang Marangoni 项：把主驱动改成更强的 `-(M/eta) grad(Gamma)`，降低过强数值阻尼，让 Gamma 梯度能更明显反馈到 `u`。
- 把上一轮近似均匀的 `plateauReservoirFeed` 改成由 `flowConvergence + convergenceReservoir + surfactantRidge + riverBoundary + meniscus + edgeBoundedMeniscus` 触发的局部质量回补；新增弱 `baselineReservoirFeed` 只用于防止长预热全场破膜。
- 第三轮把厚岛目标上限提高到 `eta≈0.86`，并增强 `thickIslandSeed/edgeBoundedMeniscus` 对 `plateauTargetEta` 和 `plateauReservoirFeed` 的贡献，目标是先让真实膜厚峰值越过 `eta=0.62`，再继续扩展厚膜岛面积。

验证截图：

- 第一组局部 Marangoni：`run-1829-solid-huang-local-marangoni-low.png` 到 `run-1838-beauty-huang-local-marangoni-high.png`。
- 第二组压缩质量回流：`run-1839-solid-huang-compression-return-low.png` 到 `run-1848-beauty-huang-compression-return-high.png`。
- 第三组厚岛目标增强：`run-1849-solid-huang-thick-island-target-low.png`、`run-1850-thickness-huang-thick-island-target-low.png`、`run-1851-phase-huang-thick-island-target-low.png`、`run-1852-velocity-huang-thick-island-target-low.png`、`run-1853-foam-huang-thick-island-target-low.png`、`run-1854-phaseArea-huang-thick-island-target-low.png`、`run-1855-filamentConnectivity-huang-thick-island-target-low.png`、`run-1856-gammaResidual-huang-thick-island-target-low.png`、`run-1857-etaGammaVelocity-huang-thick-island-target-low.png`、`run-1858-beauty-huang-thick-island-target-high.png`。

数值结果：

- Run 1829-1838：速度增强有效，但 high 预热下膜被排薄，`eta.mean=0.2074`、`eta.max=0.2902`、`eta.thinFraction=0.6419`，判定失败。
- Run 1839-1848：压缩质量回流把 high 恢复到 `eta.mean=0.2629`、`eta.max=0.4980`、`eta.thinFraction=0.3189`，但厚岛峰值仍不够。
- Run 1849-1858：低参 `eta.max≈0.64-0.67`、`thickFraction≈0.05-0.11`；高参 `run-1858` 达到 `eta.mean=0.3027`、`eta.max=0.6314`、`eta.thickFraction=0.0007`、`eta.thinFraction=0.2977`、`velocity.mean=0.0734`、`velocity.activeFraction=0.1555`。这说明厚岛已经成核，但 high 下厚区面积远小于参考图。
- 粗 HSV 统计：参考图约 `orangeGold=0.3737`、`cyanGreen=0.0647`、`purpleBlue=0.0224`、`creamWhite=0.0039`；`run-1858` 为 `orangeGold=0.7012`、`cyanGreen=0`、`purpleBlue=0`、`creamWhite=0.0003`。相对 `run-1828` 的 `orangeGold=0.8847` 有进步，但仍完全缺青绿/紫蓝可见干涉区。

当前偏差和失败原因：

- `eta.max` 首次越过 0.62，这是本轮硬进展；但 `run-1858` 的 thickFraction 只有 `0.0007`，厚膜岛只是少量成核，还不是参考图中大面积橙金厚膜岛。
- `velocity.mean` 提高到约 0.073，说明 Marangoni 反馈更强；但低参 `projectedDivergence.compressionFraction` 仍接近 0，高参压缩/膨胀各约 10%，尚未在球面内部形成稳定分叉收敛前沿。
- `phase` 诊断有青绿/紫边卷曲，但 beauty 仍输出近乎纯橙金/粉带，说明最终薄膜干涉的光谱归一化和物理场映射没有把薄通道厚度区间转成参考图的青绿/紫蓝；下一步如果改渲染，必须限定为薄膜干涉公式/光谱响应修正，不能做调色板拟合。
- `foam` 诊断增强了边界/厚区纹理，但 beauty 中奶金/白色微滴仍远低于参考，说明微滴需要继续从 `foam + curvature + shear + meniscus` 的物理场以离散密度显现，而不是背景散点。

下一步计划：

1. 继续扩大厚膜岛面积而非只提高峰值：让 `plateauReservoirFeed` 的局部回补在 high 预热下维持 `eta > 0.62` 的连片区域，目标 `thickFraction` 至少到几个百分点，并保持河道核心较薄。
2. 查 `phase -> beauty` 的物理光学链路：用真实薄膜干涉的光谱响应重算 `thinFilmRgb` 的归一化/对比，让青绿薄通道和紫蓝窄边从 `eta/cosTheta/curvature/Gamma/foam` 得出；不得把 cyan/purple 当样式色硬混。
3. 继续把 `foam` 的可见微滴限制到 meniscus、曲率峰、剪切和厚膜内部扰动上，提高参考图所需的奶金/白色微滴密度。
4. 若 Huang 2020 对微滴可见性或薄膜光谱显示不足，按目标文件最高优先级规则寻找补充同行评审论文或可靠开源研究实现，保存全文并审查是否冲突于 Huang 的 `eta/Gamma/u` 主模型。

## Run 1727-1780 / heartbeat：变系数 Gamma projection 尝试失败，主路径恢复到稳定残差反馈
本轮开始前重新读取了 `artifacts/targets/soap-film-huang-2020-fulltext-notes.md`、`soap-film-physics-handoff.md`、`soap-film-target.md` 和本文件，并先对照上一轮最新 `run-1726-beauty-huang-residual-feedback-high.png`、`run-1720-phase-huang-residual-feedback-low.png`、`run-1722-foam-huang-residual-feedback-low.png`、`run-1725-gammaResidual-huang-residual-feedback-high.png` 与 `artifacts/targets/soap-film-reference.jpg`。参考图仍是橙金厚膜主体、15-25% 青绿分叉河道、贴河道紫蓝窄边和高密度奶金/白色微滴；`run-1726` 仍是暗金完整球，只有一个弱孤立厚片/河道痕迹，`phase` 有宽泛卷曲但不是窄河网，`foam` 是连续灰白场，`gammaResidual` 主要仍由大尺度边缘/条纹主导。粗略统计里参考图约 `orange_gold=0.2306, cyan_green=0.0539, purple_blue=0.0232`；`run-1726` 约 `orange_gold=0.1593, cyan_green=0.0000, purple_blue=0.0000, dark=0.8086`，说明失败不在构图或调色，而在 `eta/Gamma/u` 还没有形成可见的 Marangoni 河道和边界微滴。

本轮计划：不改构图、不调 beauty 颜色、不引入贴图或参考图采样。由于当前缺口仍属于 Huang et al. 2020 主文 4.3 覆盖的 `Gamma/u` projection-like 联立更新，本轮不找补充论文。先尝试把 `GAMMA_IMPLICIT_FRAGMENT_SHADER` 从常系数 `mobility * lapGamma` 近似升级为球面变系数 stencil：用相邻 `eta` 构造面系数，近似 `div((M/eta) grad(Gamma))`，并同步让 `gammaResidual` debug 显示该变系数投影后的 divergence/residual。

本轮改动与回退：先在 `mvp/src/visual/thinFilmSim.js` 中实现了变系数 `Gamma` projection 权重，并生成 `run-1727` 到 `run-1735`；`solid` 可见，但主场明显被压灭。随后给该 Jacobi 步加入欠松弛和单步限幅，生成 `run-1736` 到 `run-1744`；再把右端项从硬性的 `-Gamma div(u)` 改回残差反馈，生成 `run-1745` 到 `run-1753`。三组结果都证明当前局部 shader 不能直接承受完整变系数 SPD 近似：`phase/foam/filament` 过暗，beauty 退成近乎均匀暗金球。为避免把失败 solver 留在主路径，最终把主 `GAMMA_IMPLICIT_FRAGMENT_SHADER` 恢复到上一轮稳定的常系数残差反馈公式，只保留 `GAMMA_RESIDUAL_FRAGMENT_SHADER` 里的变系数 `div((M/eta)grad(Gamma))` 诊断，用于后续真正尺度化 SPD 求解器对照。

最终有效截图：`run-1772-solid-huang-main-projection-restored-low.png`、`run-1773-thickness-huang-main-projection-restored-low.png`、`run-1774-phase-huang-main-projection-restored-low.png`、`run-1775-velocity-huang-main-projection-restored-low.png`、`run-1776-foam-huang-main-projection-restored-low.png`、`run-1777-filamentConnectivity-huang-main-projection-restored-high.png`、`run-1778-phaseArea-huang-main-projection-restored-high.png`、`run-1779-gammaResidual-huang-main-projection-restored-high.png`、`run-1780-beauty-huang-main-projection-restored-high.png`。`solid` 最小可见性通过：`ready=true`、`glassVisible=true`、`debugView=solid`、`debugUniform=1`、`simSize=128`、中心像素 `[255,20,10,255]`。高参 beauty 为 `simSize=384`。浏览器日志仍只返回 2026-05-31 22:52-22:56 的历史 `capillaryEdge/transverseValley` shader error；本轮截图和 dataset 显示当前壳层/渲染路径可见，但后续仍应换更干净的日志捕获方式。

结果对比：`run-1780` 比失败的变系数尝试恢复了基础场活性，`thickness/phase/foam/gammaResidual` 都能出图；但它仍完全不达标。beauty 仍是暗金完整球和稀疏散点，没有参考图的青绿分叉河道、紫蓝窄边、橙金内部液体拉丝，也没有沿河道边缘聚集的奶金微滴。粗略统计 `run-1780` 约 `orange_gold=0.1826, cyan_green=0.0000, purple_blue=0.0000, cream_white=0.0000, dark=0.7961`，相对参考图仍严重缺少青绿/紫蓝可见干涉区。`phase` 仍更像大尺度纬向条带/整球场，不是 15-25% 的弯曲分叉高相河道；`foam` 仍是连续条带，不是离散微滴密度；`gammaResidual` 诊断显示投影残差还没有在球面内部形成局部收敛前沿。

下一步：不要继续把完整 Huang SPD 近似硬塞进单个 fragment shader。应先做数值尺度诊断和最小闭环：新增或复用一个纯物理 `eta/Gamma/u` state debug，把 `Gamma` 投影前后总量、范围、`div(u)`、`div((M/eta)grad(Gamma))` 分别可视化，确认是哪个项把相场/foam 压灭；然后再实现真正的多迭代 projection 状态场，而不是单 pass 局部替代。与此同时，`phase/foam/filament` 必须继续降级为读取 `eta/Gamma/u` 的派生诊断，不能让宽片相场反向主导主物理。若后续需要微滴成核或泡沫边界密度的细节，而 Huang 2020 未覆盖，再按目标文件规则寻找补充论文并全文审核是否冲突。

## Run 1718+ / heartbeat：Gamma 残差反馈 projection
本轮开始前重新读取了 `artifacts/targets/soap-film-huang-2020-fulltext-notes.md`、`soap-film-physics-handoff.md`、`soap-film-target.md` 和本文件，并强制对比最新 `run-1717-beauty-huang-coupled-backtrace-high.png`、`run-1711-phase-huang-coupled-backtrace-low.png`、`run-1713-foam-huang-coupled-backtrace-low.png`、`run-1710-thickness-huang-coupled-backtrace-low.png`、`run-1716-gammaResidual-huang-coupled-backtrace-high.png` 与 `artifacts/targets/soap-film-reference.jpg`。参考图仍是橙金厚膜主体、青绿分叉河道、紫蓝窄边和沿边界/厚膜内部的奶金微滴；`run-1717` 只出现一个孤立厚膜/河道团，`phase` 虽有卷曲但接近整球宽相，`gammaResidual` 仍集中在上下边缘规则条纹，说明上一轮球面回溯和迭代速度回写改变了输运，但还没有实现 Huang et al. 2020 主文 4.3 的投影式 `Gamma/u` 联立约束。

本轮计划：不改构图，不调 beauty 颜色，也暂不找补充论文，因为当前失败点仍属于 Huang 2020 全文明确覆盖的 `Gamma/u/eta` 耦合。先把 `GAMMA_IMPLICIT_FRAGMENT_SHADER` 从只用邻域平均的局部平滑，改成显式把 `residual = -Gamma * div(u_projected) + Ds * laplacian(Gamma)` 写入右端项，其中 `u_projected` 用当前 Marangoni 更新近似 `div(u - dt * M/eta * grad(Gamma))`；同时让 `gammaResidual` debug 显示投影后的 divergence/residual，而不是只显示旧速度残差。验证顺序继续为 `solid -> thickness -> phase -> velocity -> foam -> filamentConnectivity -> phaseArea -> gammaResidual -> beauty`。

## Run 1709+ / heartbeat：改前强制对比与本轮计划
本轮开始前重新读取了 `artifacts/targets/soap-film-huang-2020-fulltext-notes.md`、`soap-film-physics-handoff.md`、`soap-film-target.md` 和本文件。目标文件已把 Huang et al. 2020 全文与 `soap-film-reference.jpg` 并列为最高优先级，并新增补充文献规则：只有当 Huang 2020 未覆盖或按其全文模型仍无法复现某个局部机制时，才允许寻找补充论文/开源研究实现；补充材料必须保存全文、整理全文笔记，并逐项审核是否冲突于 Huang 2020 的 `eta/Gamma/u` 球面 chemomechanical 主线。

改前图像对比：最新有效 beauty `run-1707-beauty-huang-gamma-velocity-high.png` 与参考图仍明显不相似。参考图中橙金厚膜约占主体，内部有高密度液体拉丝和奶金/白色微滴；青绿河道约 15-25%，呈弯曲、分叉、宽窄变化，并被紫蓝窄边包围。`run-1707` 则是暗金完整球体和稀疏散点，没有清晰青绿分叉河道，也没有沿河道聚集的紫蓝窄边和微滴。`run-1702 phase` 近似整球青绿宽片，`run-1704 foam` 是连续横向烟带，`run-1701 thickness` 过于平滑，`run-1708 gammaResidual` 主要是上下边缘规则条纹，说明当前 `Gamma/u/eta` 还没有形成 Huang 2020 所需的局部收敛、Marangoni 梯度和球面平流细丝。

本轮计划：不改构图，不做 beauty 调色。先把 `Gamma` projection 从“多次 Gamma Jacobi 后单独速度回写”改为“每次 Gamma 迭代后立即按 `-(M/eta) grad(Gamma)` 回写速度，并让下一次 Gamma 迭代读取新速度”，更接近 Huang 2020 主文 4.3 的 `Gamma/u` 联立投影结构；同时把主 `velocity` 与 `field` 回溯从平面 UV 回溯改成包含 `sin(theta)` 度量的球面近似回溯，减少水平/极区规则条纹。验证顺序仍为 `solid -> thickness -> phase -> velocity -> foam -> filamentConnectivity -> phaseArea -> gammaResidual -> beauty`，之后再把结果对比和下一步补回本节。

本轮改动：`mvp/src/visual/thinFilmSim.js` 中新增了主 `velocity` 与 `field` shader 的球面度量回溯，`phi` 方向按 `velocity.x / sin(theta)` 近似回溯并周期包裹，避免继续把球面切向速度当平面 UV 位移；同时把 `Gamma` projection loop 改为每次 `Gamma` Jacobi 后立即执行一次 `Gamma` 驱动的速度回写，下一次 `Gamma` 迭代读取更新后的 `u`，不再等全部 `Gamma` 迭代结束后才单独修正速度。该改动仍只作用于实时 GPU 物理场，没有采样贴图、参考图、canvas 图案或预烘焙纹理。

验证截图：`run-1709-solid-huang-coupled-backtrace-low.png`、`run-1710-thickness-huang-coupled-backtrace-low.png`、`run-1711-phase-huang-coupled-backtrace-low.png`、`run-1712-velocity-huang-coupled-backtrace-low.png`、`run-1713-foam-huang-coupled-backtrace-low.png`、`run-1714-filamentConnectivity-huang-coupled-backtrace-high.png`、`run-1715-phaseArea-huang-coupled-backtrace-high.png`、`run-1716-gammaResidual-huang-coupled-backtrace-high.png`、`run-1717-beauty-huang-coupled-backtrace-high.png`。低参新标签页复核 `solid` 得到 DOM dataset：`ready=true`、`renderCount=87`、`simSize=128`、`debugView=solid`、`debugUniform=1`、`glassVisible=true`、中心像素 `[255,20,10,255]`。浏览器日志仍会返回 2026-05-31 22:52-22:56 的历史 `capillaryEdge/transverseValley` shader error，但本轮新截图和 dataset 说明壳层/当前渲染路径可见；后续需要更干净的日志截断机制，而不能把旧日志误判为当前失败原因。

结果对比：本轮仍失败。相对 `run-1707`，`run-1711 phase` 的局部卷曲和竖向结构更明显，`run-1717 beauty` 从几乎纯暗金完整球变成左侧一个孤立的厚膜/河道团，说明球面回溯和耦合回写确实改变了物理输运；但这不是参考图需要的 15-25% 青绿分叉河网，而是单个局部团块。参考图的橙金厚膜应占主体且内部有细密流丝/微滴，本轮 `run-1717` 仍是大面积暗金平球，只有少量散点；青绿和紫蓝在 beauty 中几乎没有形成可统计面积，粗略颜色统计显示 `run-1717` 总图 `cyan_green=0.0000`、`purple_blue=0.0000`，而参考图约 `cyan_green=0.0608`、`purple_blue=0.0343`。`run-1716 gammaResidual` 仍主要是上下边缘规则条纹，内部残差信号很暗，说明当前“迭代回写”仍远不是 Huang 2020 的联合 SPD projection；`run-1714/1715` 仍是宽片相场诊断，没有把 core/meniscus/ridge 骨架化成分叉河道。

下一步：不要回头调构图或 beauty 颜色。当前最近的物理缺口是 `Gamma/u` 耦合仍缺真正的投影残差反馈：下一轮应在 `Gamma` projection 里显式计算更新后 `u` 的 `div(u)`，把 `residual = -Gamma div(u) + Ds laplacian(Gamma)` 作为下一次 Gamma 更新的右端项，而不是只用局部邻域平均；同时应把 `phase/river/foam` 的宽片诊断进一步降权，改成只从 `eta/Gamma/u` 的收敛、Marangoni 梯度和曲率派生窄 core，再由 core 两侧的守恒沉积产生厚膜边界。若 Huang 2020 对微滴/泡沫成核细节不足，按目标文件新规则可以寻找补充论文，但必须保存全文并逐项审核不冲突于 Huang 的 `eta/Gamma/u` 主模型。

## Run 1682-1708 / heartbeat：Gamma 多迭代 projection、采样器上限修复与速度回写仍未达标
本轮开始前按自动化要求重新读取了 `artifacts/targets/soap-film-huang-2020-fulltext-notes.md`、`soap-film-physics-handoff.md`、`soap-film-target.md` 和本文件，并回到 `artifacts/references/HuangEtAl-SoapBubbles-SIGGRAPH2020.txt` / `-supp.txt` 核对主文第 3-5 节、结果/讨论与 Supplemental 推导。重点再次确认：Huang 2020 的主线不是继续调色或构图，也不是 `h^3 grad(p)` 旧薄液层通量主导，而是球面 `eta/Gamma/u` 的可压缩 chemomechanical 耦合，`Gamma` projection-like 隐式步之后必须影响速度 `u`，再由 `div(u)` 更新 `eta/Gamma`。

改前强制对比：上一轮最新有效图 `run-1681-beauty-huang-continuity-dominant-high.png` 仍是暗完整球和粉紫水平宽带；`phase` 接近整球青绿，`foam` 是连续灰白烟带，`filamentConnectivity/phaseArea` 是宽片诊断。参考图则是橙金厚膜主体、15-25% 青绿分叉河道、贴河道紫蓝窄边以及大量奶金/白色离散微滴。失败原因不是构图，而是 `eta/Gamma/u` 没有形成 Huang 模型所需的局部收敛前沿和 Marangoni 耦合河道。

本轮改动：在 `mvp/src/visual/thinFilmSim.js` 中把 `GAMMA_IMPLICIT_FRAGMENT_SHADER` 从单 pass 改为按 `filmPressureIterations` 派生的 2-10 次 ping-pong Jacobi 近似；projection pass 不再直接改写 `eta`，只更新 `Gamma`，避免多迭代重复压缩厚度。新增 `GAMMA_RESIDUAL_FRAGMENT_SHADER` 与 `gammaResidualTarget`，输出 `r=|-Gamma div(u)+Ds laplacian(Gamma)|`、`g=div(u)`、`b=|grad(Gamma)|` 诊断。随后补上 `GAMMA_VELOCITY_CORRECTION_FRAGMENT_SHADER`，用 projection 后的 `Gamma` 按 `-(M/eta) grad(Gamma)` 回写速度，向 Huang 主文 4.3 的“解 Gamma 后更新 u”结构靠近。没有使用贴图、参考图采样、预烘焙纹理、canvas 图案、样式拟合或假纹理。

中途诊断：第一次给壳层 shader 直接新增 `uFilmGammaResidualMap` sampler 后，`run-1682` 到 `run-1690` 变成近黑屏；这不是物理结果，而是调试实现超过 WebGL1 片元纹理单元上限的表现。已修复为复用既有 `uFilmRiverPathCostMap` 调试通道，`run-1691-solid-huang-gamma-iter-samplerfix-low.png` 和 `run-1700-solid-huang-gamma-velocity-low.png` 均确认 solid 红色壳层可见，dataset 为 `ready=true`、`glassVisible=true`、`debugUniform=1`，中心像素 `[255,20,10,255]`。浏览器日志里仍能读到 22:52-22:56 的历史 shader error，但本轮截图 dataset 和画面表明当前壳层已恢复；后续最好换新 tab 或清日志再确认“本轮新增 error=0”。

有效截图：`run-1700-solid-huang-gamma-velocity-low.png`、`run-1701-thickness-huang-gamma-velocity-low.png`、`run-1702-phase-huang-gamma-velocity-low.png`、`run-1703-velocity-huang-gamma-velocity-low.png`、`run-1704-foam-huang-gamma-velocity-low.png`、`run-1705-filamentConnectivity-huang-gamma-velocity-high.png`、`run-1706-phaseArea-huang-gamma-velocity-high.png`、`run-1707-beauty-huang-gamma-velocity-high.png`、`run-1708-gammaResidual-huang-gamma-velocity-high.png`。

结果对比：`solid` 最小可见性通过，`thickness/phase/velocity/foam/filamentConnectivity/phaseArea/gammaResidual` 都能渲染。`run-1707` 与参考图相比仍失败：橙金厚膜有一定回归，微滴/颗粒密度比 `run-1681` 增加，但青绿分叉河道几乎没有，紫蓝窄边没有沿河道形成，画面仍是暗完整球加散点，缺少参考图中橙金内部流丝、河道侵入和边界泡沫聚集。`run-1702 phase` 仍接近整球青绿/蓝绿宽片，不是 15-25% 连通河网；`run-1704 foam` 仍偏连续场而非边界离散微滴；`run-1708 gammaResidual` 主要在上下边缘出现规则条纹，内部残差信号过暗，说明当前 projection 近似被过度平滑，且速度回写仍不是论文里的联合 SPD 系统。

下一步：不要改构图，不要调 beauty 颜色。优先把 `Gamma/u` 从“Gamma 多次 Jacobi + 独立速度回写”升级为更接近 Huang 4.3 的联合 projection 近似：在同一迭代里用 `Gamma` 残差更新速度、重新计算球面 `div(u)`，并输出 `divergenceAfterGammaProjection`，而不是只看旧速度残差。其次要实现 velocity-aligned 球面平流或至少基于局部速度方向的 great-circle 近似，减少现在的水平/极区条纹；再把 `phase/foam/filament` 降级为只读 `eta/Gamma/u` 的派生诊断，避免宽片相场继续反向主导主物理场。

## Run 1666-1681 / heartbeat：Huang 全文模型对齐，弱化不可压投影并加入 Gamma projection 近似
本轮开始前已重读 `artifacts/targets/soap-film-huang-2020-fulltext-notes.md`、`soap-film-physics-handoff.md`、`soap-film-target.md`、`soap-film-iterations.md`，并回到 `artifacts/references/HuangEtAl-SoapBubbles-SIGGRAPH2020.txt` 与 supplemental TXT 核对主文 3-5 节、结果/讨论和附录/Supplemental。关键约束再次确认：Huang 2020 主线是球面 `eta/Gamma/u` 可压缩 chemomechanical flow，不是让固体表面薄液层 `h^3 grad(p)` 通量主导；`div(u)` 必须真实进入 `D eta / D t = -eta div(u)` 与 `D Gamma / D t = -Gamma div(u) + Ds laplacian(Gamma)`。

改前对照：上一轮最新 `run-1665-beauty-huang-velocity-high.png` 与参考图差距仍然很大。参考图有橙金厚膜主体、青绿分叉河道、贴河道的紫蓝窄边和密集奶金/白色微滴；`run-1665` 是暗完整球加左侧单块厚膜岛，青绿河网、紫蓝窄边和微滴密度几乎都没有。`run-1660-phase` 几乎整球青绿，`run-1662-foam` 是连续烟带，说明相场/泡沫不是从稳定 `eta/Gamma/u` 细丝前沿自洽派生。

本轮改动：在 `mvp/src/visual/thinFilmSim.js` 中把 divergence/projection 改为带 `sin(theta)` 的球面近似；把旧的不可压压力投影从强清 divergence 降为弱数值清理；新增 `GAMMA_IMPLICIT_FRAGMENT_SHADER`，在 field 更新前对 `Gamma` 做一轮 projection-like 隐式近似；随后把 `FIELD_STEP_FRAGMENT_SHADER` 里旧 `thinFluxDiv/surfactantFluxDiv` 权重降为辅助项，把 Huang 连续项 `huangThicknessContinuity/huangSurfactantContinuity` 提升为主导。未使用贴图、参考图采样、预烘焙纹理、canvas 图案或样式拟合。

验证截图：第一组 `run-1666` 到 `run-1673`，第二组 `run-1674` 到 `run-1681`。`solid` 最小可见性通过：`run-1674-solid-huang-continuity-dominant-low.png` 红色壳层稳定可见，debug dataset 显示 `ready=true`、`glassVisible=true`、`simSize=128`；`thickness/phase/velocity/foam/filamentConnectivity/phaseArea/beauty` 均能截图。浏览器日志里只剩 22:52-22:56 的历史 shader error 记录，本轮截图时间没有新的编译错误。

结果偏差：本轮仍失败。`run-1681-beauty-huang-continuity-dominant-high.png` 变成偏暗完整球和宽粉紫水平带，仍没有参考图的青绿分叉河道；`run-1676-phase` 仍接近整球青绿/蓝绿，只是有更多低频卷曲，不是 15-25% 的连通窄河网；`run-1678-foam` 仍是连续灰白烟带，不是沿边界离散微滴；`run-1679-filamentConnectivity` 与 `run-1680-phaseArea` 仍偏成整球/宽区诊断，没形成可传播的 geodesic 河道骨架。粗略颜色统计把背景计入时，参考约 `orange_gold=0.2401, cyan_green=0.0480, purple_blue=0.0442, cream_white=0.0115`；`run-1681` 约 `orange_gold=0.0078, cyan_green=0.0001, purple_blue=0.0266, cream_white=0.0001, dark=0.7684`，说明 beauty 仍严重缺橙金厚膜亮度、青绿河道和微滴。

失败原因：弱化不可压投影是对的，但当前还没有实现 Huang 论文真正的 velocity-aligned 球面平流、BiMocq2 细节保持，以及主文 4.3 的 `Gamma/u` 联立 SPD 线性系统；新增 pass 只是单步 Jacobi 近似，无法替代真正 projection-like solve。旧的 phase/foam/filament 层仍把宽 sheet 当作通道，导致 `Gamma/eta` 连续项一强就产生整球/水平带，而不是参考图里被 Marangoni/曲率/剪切约束出的细窄分叉流。

下一步：不要改构图、不要调 beauty 颜色。优先把 `Gamma` projection 从单 pass 变成多迭代 ping-pong 近似，至少输出可调试 `GammaResidual/divergenceAfterProjection`；同时把 `filamentConnectivity` 的证据源改为读取 `eta/Gamma/u` 的局部收敛、Marangoni 梯度、曲率和宽度惩罚，而不是让 phase 自己反向主导主物理场。验证顺序继续为 `solid -> thickness -> phase -> velocity -> foam -> filamentConnectivity -> phaseArea -> beauty`。

## Run 0 / 目标建立
相似点：已有 GPU 膜厚/表活剂/泡沫/相场的无贴图路径，可以继续迭代。

偏差：历史截图多次出现青色过量、边界像等高线或多边形泡沫格、泡沫点像规则数字噪声；有些版本还出现多层边界和旧内核曲线干扰。

下一步：把 active shader 的青绿颜色改为只由 phase/dye 河道主导，紫蓝只沿 dye 梯度窄边出现；移除规则 hash 点阵和假高光，把白点改成来自 foam 场的随机泡沫。

## Run 1 / `artifacts/soap-film-runs/run-1.png`
相似点：已经变成近景穹顶，青绿区域是连续液膜河道而不是旧内核曲线；紫蓝边界主要沿河道出现，没有明显双层球壳。

偏差：青绿占比过大，中心被 cyan 洗满，橙金厚膜只剩边缘大块；橙色区域太平滑，缺少参考图中密集微泡、液体拉丝和细碎旋涡；白色泡沫点不够明显。

下一步：收紧 `dye/phase` 的可见阈值并降低 cyan 混合强度，让橙金回到 60-75%；提高 foam 场对高光微泡的贡献，但不恢复规则 hash 点阵。

## Run 2 / `artifacts/soap-film-runs/run-2.png`
相似点：橙金主体回到主导位置，青绿河道不再洗满全屏，紫蓝边界也基本只围绕河道。

偏差：橙色区域仍然太平滑，像大块干净渐变；局部浅黄色高光过大、过假；微泡点和液体拉丝数量远少于参考图，缺少近景肥皂膜的颗粒密度。

下一步：加入由 foam/速度/膜厚场调制的亚网格微泡和方向性拉丝，让橙金区域出现细碎流纹；同时压低大面积假高光，增强青绿河道的饱和度但不扩大面积。

## Run 3 / `artifacts/soap-film-runs/run-3.png`
相似点：橙金、青绿、紫蓝的关系比前两轮稳定，青绿河道开始有方向性，橙色区域出现了一些流纹。

偏差：构图仍像完整球体，左右圆边太明显；浅黄色高光仍是大块斑，不像参考图里的细密泡点；橙色膜内拉丝密度仍不足，河道边缘还偏平滑。

下一步：把 macro 视角推近为裁切穹顶；降低大块 honey/pearl 混合，改成更高阈值的细碎泡点；给橙金区域增加暗红/金色细拉丝。

## Run 4 / `artifacts/soap-film-runs/run-4.png`
相似点：macro 构图已经接近近景穹顶，左右边被裁掉；橙金主体、青绿河道、紫蓝窄边三层关系比较清楚。

偏差：膜面仍太光滑，参考图里最关键的密集微泡、颗粒和橙金内部拉丝还不够；青绿河道的大块区域缺少内部细节，局部仍像柔焦色块。

下一步：用 foam 场叠加双尺度亚网格泡点，增加可见颗粒密度；用速度方向生成更细的金/暗红拉丝，避免恢复规则点阵。

## Run 6 / `artifacts/soap-film-runs/run-6.png`
相似点：橙金区域已经出现密集泡沫点和方向性拉丝，近景穹顶构图成立，紫蓝边界没有扩散成全屏网格。

偏差：右侧青绿区域仍像一片大湖，参考图更像多条弯曲河道与分叉；青绿内部还偏平滑，橙金与青绿比例仍略偏青。

下一步：收窄 phase 相场，让青绿从大块湖面退回河道；提高相分离阈值，减少持续补给造成的青绿扩张。

## Run 7 / `artifacts/soap-film-runs/run-7.png`
相似点：橙金厚膜占比更接近目标，微泡和方向性拉丝明显增强；青绿区域退回到河道/分叉形态，紫蓝窄边贴着河道走。

偏差：右侧仍有一块较大的青绿区域，内部细节比参考图少；参考图中橙金区域的泡沫点还更密、更细，真实照片的景深/暗边也更自然。

下一步：作为当前可运行版本保留；后续若继续逼近，应优先做青绿内部微泡/条纹和照片式景深暗边，而不是再扩大颜色对比。

## 无贴图验收
相似点：临时改名 `mvp/public/assets/reference-soap-film.jpg` 后，active GPU 路径仍然正常截图到 `artifacts/soap-film-runs/no-reference-active-path.png`。

偏差：旧参考贴图 fallback 代码仍保留在禁用分支，便于回退；默认 `GPU_THIN_FILM_SIM_MODE = true`，不会加载该贴图。

下一步：如果要彻底消除 grep 噪音，可以后续把 fallback 分支移到独立 legacy 文件；当前按“保留可回退代码但默认禁用”的要求处理。

## Run 8 / `artifacts/soap-film-runs/run-8.png`
相似点：橙金泡沫和拉丝密度增强，局部有更接近显微液膜的颗粒感。

偏差：相场收缩过度，青绿河道被压成暗褐色/紫色边界，失去参考图中鲜明的青绿液膜；暗边也过重，右侧变脏。

下一步：恢复青绿相场强度，降低横向暗边，只保留上下近景景深；让青绿以窄河道形式出现，而不是消失成暗块。

## Run 9 / `artifacts/soap-film-runs/run-9.png`
相似点：青绿重新出现，橙金泡沫密度和拉丝比 Run 7 更接近显微液膜；暗边没有像 Run 8 那样压黑整块画面。

偏差：青绿河道仍偏右，形状像一块厚色面贴在边缘；参考图的青绿河道横贯中部并有橙金侵入、内部流丝和分叉。

下一步：调整膜面采样剪切与偏移，把 phase 河道拉回画面中心；给青绿区域加入相分离裂纹/内部流丝，让它不像单一色块。

## Run 10 / `artifacts/soap-film-runs/run-10.png`
相似点：青绿相场终于横贯画面中部，整体构图比 Run 9 更接近参考图的河道布局；橙金颗粒和拉丝保留。

偏差：青绿内部纤维过暗，变成灰绿色条纹块；参考图的青绿应该更亮、更水润，内部裂纹应是浅色/橙金侵入而不是黑条。

下一步：保留相场位置和分叉，但移除暗色河道纤维，把青绿恢复为明亮青蓝，内部裂纹改成浅青/橙金流痕。

## Run 11 / `artifacts/soap-film-runs/run-11.png`
相似点：河道位置仍在画面中部，橙金泡沫和细拉丝保持。

偏差：青绿仍偏灰，并出现规则斜向暗纹；这不像参考图里的液膜流淌，反而像 shader 条纹。

下一步：撤掉削暗式 `cyanRift`，只保留亮青相场、紫蓝窄边和泡沫细节；稍微回收采样偏移，避免顶部青绿块过大。

## Run 12 / `artifacts/soap-film-runs/run-12.png`
相似点：规则斜向暗纹基本消失，河道布局保持中部横贯。

偏差：青绿变成低饱和灰绿，失去参考图中的明亮青蓝液膜；暗边/厚膜映射仍然压到了 cyan 区域。

下一步：让暗边只主要作用在橙金厚膜，青绿液膜保留高饱和；提高 `dye` 到 cyan 的映射权重。

## Run 13 / `artifacts/soap-film-runs/run-13.png`
相似点：青绿重新变亮，紫蓝边界和橙金泡沫/拉丝关系较清楚。

偏差：青绿面积过大，变成一整片 cyan 湖面；参考图应是多条青绿河道穿过橙金厚膜，中间有橙金岛和侵入纹。

下一步：缩小 cyan 可见区域但保留高饱和；回收膜面采样偏移，让橙金岛回到河道内部。

## Run 14 / `artifacts/soap-film-runs/run-14.png`
相似点：青绿面积回到更合理范围，橙金占比更接近目标。

偏差：青绿仍偏灰偏脏，不像参考图中清亮的青蓝薄膜；右上河道内部细节少。

下一步：不再扩大 cyan 面积，只增强现有 `dye` 河道的青绿饱和度，保持紫蓝窄边和橙金主体。

## Run 15 / `artifacts/soap-film-runs/run-15.png`
相似点：橙金厚膜和颗粒拉丝比前一轮更强，整体不再是青绿大湖。
偏差：相场收得过度，青绿河道只剩右上和中部细缝；参考图需要贯穿中部的青蓝河道网络。
下一步：适度降低 dye 可见阈值，保留高膜厚侵蚀，扩回河道但不回到色块。

## Run 16 / `artifacts/soap-film-runs/run-16.png`
相似点：青绿饱和度明显回到参考图方向，紫蓝边界也更清楚。
偏差：形态仍像几块光滑 cyan 泡，不是贯穿中部的液膜河道；内部橙金侵入和流丝不足。
下一步：加强中部主流道和分叉，把相场切成连续河道网络，同时保留橙金侵蚀。

## Run 17 / `artifacts/soap-film-runs/run-17.png`
相似点：出现横向贯穿的 cyan 液膜，颜色和紫边比 Run 16 更接近参考图。
偏差：主河道太宽、太干净，像平滑色带；缺少橙金岛、内部微泡和液体晕染。
下一步：在物理场里加入高膜厚岛切割主河道，并加强边缘泡沫和橙金侵入。

## Run 18 / `artifacts/soap-film-runs/run-18.png`
相似点：主河道被橙金岛切割，整体比 Run 17 少了整片 cyan 色带。
偏差：青绿仍偏灰偏平，内部泡点和拉丝不够，整体仍像 CG 色块而不是显微液膜。
下一步：把 foam/height/slope 的微泡、橙金侵入和拉丝更强地映射进青绿区域。

## Run 19 / `artifacts/soap-film-runs/run-19.png`
相似点：青绿河道开始有内部泡点、橙金侵入和流丝，整体比 Run 18 更接近液膜。
偏差：构图过度贴近，像局部表面而不是参考图的近景半球；上方弧线和下方暗边缺失。
下一步：调回 macro 视角，让穹顶轮廓、顶部高光和底部暗边回到画面。

## Run 20 / `artifacts/soap-film-runs/run-20.png`
相似点：穹顶轮廓回来了，橙金主体和青绿河道能同时看见。
偏差：退得太多，变成完整球体，不是参考图的近景半球；戏剧性和显微质感被缩小了。
下一步：把 macro 视角拉近并下移，形成顶部弧线可见、底部裁切的半球构图。

## Run 21 / `artifacts/soap-film-runs/run-21.png`
相似点：构图从完整球体回到近景半球/穹顶，橙金颗粒和暗边更合理。
偏差：青绿主河道偏到右侧，画面中心仍缺参考图那种贯穿中部的青蓝河道。
下一步：调整物理场采样窗口，把现有河道移回画面中心，而不是靠扩大 cyan 面积解决。

## Run 22 / `artifacts/soap-film-runs/run-22.png`
相似点：半球构图、中部青绿河道和紫边都比 Run 21 更接近参考图。
偏差：橙金区域还有块状拼接感，厚膜池边界偏几何，缺少参考图里被液体拉扯出的有机边缘。
下一步：用流场扰动厚膜池初始边界，让橙金/青绿交界更自然。

## Run 23 / `artifacts/soap-film-runs/run-23.png`
相似点：半球近景稳定，中部青绿河道、紫边、橙金颗粒都成立，比 Run 22 更自然。
偏差：仍缺参考图里更密集的青绿分叉和白色微泡；另一个问题是随机种子会导致刷新后画面不稳定。
下一步：固定默认模拟种子，保证验收看到同一张物理场，再基于稳定画面微调。

## Run 24 / `artifacts/soap-film-runs/run-24.png`
相似点：固定种子后画面可复现，半球构图稳定。
偏差：默认物理场主河道膨胀成 cyan 湖面，刷新验收会稳定地偏离参考图。
下一步：收窄主流道物理宽度和 dye 可见阈值，让青绿回到河道而不是湖面。

## Run 25 / `artifacts/soap-film-runs/run-25.png`
相似点：固定种子后画面稳定；青绿主河道被收窄，保留了紫蓝边、橙金侵入、微泡点和近景半球构图。
偏差：距离参考图仍有差距，尤其是青绿河道分叉数量不够、内部液滴纹理还偏平，白色微泡密度也不如参考图。
下一步：继续应优先做相场分叉/泡沫聚集模型，而不是再调单纯颜色；可以增加一个真实 Cahn-Hilliard/浅水耦合迭代来制造更细的指状分叉。

## Run 26 / `artifacts/soap-film-runs/run-26.png`
相似点：回到单层近景穹顶；橙金主体、青绿河道、紫蓝窄边同时存在。
偏差：中央青绿仍像一条过宽色带，橙金厚膜岛和泡沫切割不足；整体仍偏 CG 平滑。
下一步：拉近 macro 构图，并让厚膜岛/泡沫侵入青绿相场。

## Run 27 / `artifacts/soap-film-runs/run-27.png`
相似点：构图更接近参考图的近景半球，顶部弧线和下方裁切感更明显。
偏差：中部仍是宽 cyan 缎带，缺少参考图里的多条河道和橙金夹层。
下一步：增强相场里的厚膜岛，切开中央主流道。

## Run 28 / `artifacts/soap-film-runs/run-28.png`
相似点：橙金侵入略有增强，主河道不再完全干净。
偏差：中央 cyan 仍偏宽，橙金/青绿交界缺少细密拉丝和随机泡点。
下一步：继续调整初始相场，把中心河道切成更不规则的分段。

## Run 29 / `artifacts/soap-film-runs/run-29.png`
相似点：中央河道被橙金岛切开，橙金区域细纹对比增强。
偏差：cyan 区域发灰发白，像雾化高光；参考图应是清亮青绿加点状泡沫。
下一步：压低白雾，把泡沫从雾状亮斑改成颗粒。

## Run 30 / `artifacts/soap-film-runs/run-30.png`
相似点：青绿本体更干净，白雾减少。
偏差：微泡颗粒仍不够明确，细丝和液滴卷曲的显微质感不足。
下一步：提高物理场默认分辨率到 320，并增加由速度/foam 调制的流向细丝。

## Run 31 / `artifacts/soap-film-runs/run-31.png`
相似点：320 分辨率保持稳定，边界没有出现多层或贴图感。
偏差：肉眼细节提升有限，仍需要亚网格泡沫和流向拉丝参与最终映射。
下一步：加入由速度场、膜厚、foam、dye 调制的细丝层。

## Run 32 / `artifacts/soap-film-runs/run-32.png`
相似点：橙金和青绿内部出现更多顺流方向细丝。
偏差：泡沫还是偏雾状，参考图中的白色/奶金颗粒更明确。
下一步：放大泡沫点尺寸、降低泡沫点阈值，同时继续由 foam/边界/厚膜控制出现位置。

## Run 33 / `artifacts/soap-film-runs/run-33.png`
相似点：白色/奶金泡沫点更明确，橙金区域有更多细密拉丝，整体比 Run 26 更接近参考图的液膜质感。
偏差：泡沫点仍略均匀，青绿内部卷曲和分叉还不如参考图自然；后续应继续做更真实的 Cahn-Hilliard/薄膜排液耦合，而不是只调颜色。
下一步：如果继续推进，重点是把 `phase/dye` 更新改成更完整的 Cahn-Hilliard 化学势迭代，并增加压力投影或近似不可压约束，让河道自发分叉。

## Run 43-61 / solid 可见性与保守通量诊断
相似点：`filmDebugView=solid` 已恢复可见，红色壳层稳定渲染；DOM 诊断状态显示 `ready=true`、`glassVisible=true`、`renderCount` 持续增长、`simSize` 能被 URL 参数改到 128/320。`thickness`、`phase`、`velocity`、`foam` 四个 debug view 都能渲染，不再是黑屏或空纹理。

偏差：Browser 的只读 evaluate 仍读不到页面主上下文里的 `window.__soapFilmDebug`，因此本轮新增了 `document.documentElement.dataset.soapFilmDebug` 作为可机器验证备份；真实浏览器控制台路径仍由 `window/globalThis.__soapFilmDebug` 发布。物理上，低预热时 `phase` 与 `foam` 有空间结构，但高预热后 beauty 仍偏暗棕、青绿河道不成立，`foam` 容易变成顺流大条带而不是微滴颗粒。当前新增的保守通量项让膜厚更新更接近 `dh/dt = -div(q)`，但还没有形成参考图所需的橙金厚膜岛、青绿分叉河道和密集奶金微泡。

已做改动：在 `thinFilmSim.js` 的 field step 中加入基于 `p = -gamma * laplacian(h) - Pi(h) + rho * g_n * h` 的局部压力、`q = -(h^3 / 3mu) * grad(p) + (h^2 / 2mu) * grad(gamma) + tangentGravity` 的保守通量，并用 `-div(q)` 参与膜厚更新；同时收紧高预热下的通量时间尺度，减少相场被直接排空，降低泡沫条带化。`logoScene.js` 的 debug 视图只增强物理场可读性，不参与 beauty 贴图或拟合。

下一步：继续改 `phase/dye` 的 Cahn-Hilliard 化学势和质量约束，让它从物理场中自发形成 15-25% 的青绿分叉河道，而不是整面偏暗或整面 cyan；同时把 `foam` 生成从顺流雾状条带改成由剪切、相场边界和膜厚梯度共同控制的局部微滴颗粒。完成前不要再做单纯颜色调参。

## Run 62-75 / 心跳继续：相场支撑与微滴泡沫门控
相似点：`solid`、`thickness`、`phase`、`velocity`、`foam` 五个调试视图在本轮继续可见，`soapFilmDebug` 的 DOM 诊断显示 `ready=true`、`glassVisible=true`、`renderCount` 正常增长，浏览器日志没有 WebGL 或 shader 错误。`foam` 相比 Run 58-60 已从大面积顺流雾带退回更局部的斑点/条带结构，说明由剪切、曲率、相场边界和微扰门控的泡沫出生方向比之前更可控。

偏差：相场从上一轮“整面偏 cyan”被压回后又偏弱，Run 67-73 中 `phase` 主要是暗蓝/紫色边界，尚未形成参考图要求的 15-25% 清亮青绿河道；Run 75 beauty 仍以暗橙棕厚膜为主，只有边缘和局部薄区泛青，远没有达到参考图中贯穿中部的青绿分叉网络。`velocity` 仍偏平滑，速度剪切还不足以自发拉出细密河道和微滴聚集。

已做改动：`INIT_FIELD_FRAGMENT_SHADER` 的初始 `dye` 改为较低平均值加随机物理扰动和通道种子；field step 中新增 `channelSupport/targetDye`，由膜厚谷、曲率、表活剂梯度、上游源和厚膜淬灭共同决定高相支撑；`foamBirth` 增加 `dropletGate`，让泡沫更依赖局部高频微扰、相场边界、曲率与剪切，而不是整面平流条带。beauty shader 中 `thinPhase` 改为由 `dye + valley + surfactant + phaseBoundary + thin-height` 推导，以减少只看单一 dye 通道造成的暗场。

下一步：需要把 `phase/dye` 从单 pass 局部目标推进为更严格的双相质量控制。建议增加独立相场 pass 或在 ping-pong field 中用更强的 Cahn-Hilliard 化学势迭代，把 `dye` 高相面积稳定在约 15-25%，并让高膜厚岛从压力/通量中切割河道；同时速度场需要更强的局部剪切反馈，否则河道会停在柔和暗块而不是清晰分叉。

## Run 76-131 / 心跳继续：双相质量约束与过冲诊断
相似点：本轮首先复核了 `solid` 最小可见性，Run 76、84、92、100、108、116、124 均显示红色壳层稳定渲染；每轮低参数 `thickness`、`phase`、`velocity`、`foam` 都返回 `ready=true`、`glassVisible=true`，浏览器控制台没有 WebGL/shader 错误。field step 继续基于实时 GPU 状态推进膜厚、表活剂、泡沫和 `phase/dye`，没有引入贴图、参考图、canvas 图案或预烘焙纹理。

偏差：Run 83 的 beauty 仍偏暗棕，青绿河道太弱；随后加入局部质量约束和由通量收敛/膜厚谷/表活剂脊线驱动的 `channelCore` 后出现两类过冲：Run 97-99 变成整面 cyan，高相面积过大；Run 105-107 能恢复双相结构，但高相形态是大块泡状岛，foam debug 也被相界带成大块亮斑，不像目标中 15-25% 的分叉青绿河道和奶金微滴。继续尝试 filament-only 回拉后，Run 113-123 又把相场压得过暗，说明单 pass 局部目标和局部均值回拉很容易在“整面 cyan / 熄灭 / 大块相团”三种状态之间振荡。

已做改动：`thinFilmSim.js` 中初始 `dye` 略提高通道种子响应；field step 新增 `flowConvergence`、`localMeanDye`、`localMassBias`、`thickIsland`、`phaseSharpen`、`boundaryNucleation` 等物理量，让 `targetDye` 同时受薄膜通量收敛、膜厚谷、表活剂梯度、曲率、厚膜岛和局部相场质量影响；泡沫生成改为更依赖相界、曲率、剪切与微扰门控，并降低了无门控的雾状扩散。最终代码停在 Run 129-131 的可见双相版本：不是目标质量，但比“黑相场/整面 cyan”更适合作为下一轮起点。

下一步：不要继续靠阈值拉扯 `targetDye`。应增加独立的相场/化学势 pass 或多子步 ping-pong：先计算 `mu = phi^3 - phi - epsilon^2 laplacian(phi) + lambda(local/global mass)`，再用 `dphi/dt = M laplacian(mu) - advect(phi)` 更新，并单独做面积约束，把高相面积稳定在 15-25%；同时把 foam 从连续密度场拆出一个“微滴成核/寿命”通道，或至少让泡沫只在相界和厚膜岛边缘短寿命成核，避免再次出现大块白斑。

## Run 132-163 / 心跳继续：独立化学势 pass
相似点：新增独立 `phasePotential` render target 和 `phase` 更新 pass 后，`solid` 最小可见性继续稳定；Run 132、140、148、156 的红色壳层都可见，`thickness`、`phase`、`velocity`、`foam` 均返回 `ready=true`、`glassVisible=true`，浏览器日志没有 shader/WebGL 错误。相场更新已经从 field step 的单次 `targetDye` 拖拽中拆出：先计算 `mu = phi^3 - phi - epsilon^2 laplacian(phi) + local mass/support terms`，再用 `laplacian(mu)` 更新 `dye`，并让泡沫只在相界/剪切附近短寿命补给。

偏差：Run 137 说明第一版化学势 pass 过度阻尼，高相几乎熄灭；Run 145/153 又过冲到大面积 cyan/中相背景；加入低支撑排液后，Run 161/163 回到可见双相结构，但背景仍偏中相，青绿没有收成 15-25% 的贯穿分叉河道，仍有岛状/块状相团。beauty 的橙金主体被恢复了一部分，但整体仍偏灰绿、低对比，微滴泡沫在目标照片中的奶金颗粒密度还不够。

已做改动：`thinFilmSim.js` 新增 `PHASE_POTENTIAL_FRAGMENT_SHADER` 和 `PHASE_STEP_FRAGMENT_SHADER`；新增 `phasePotentialTarget`，并在每次 field step 后执行独立相场迭代。`FIELD_STEP_FRAGMENT_SHADER` 中原本强推 `dye` 的 Cahn-Hilliard/target 项已降权，主要保留平流后的弱源项；新的 phase pass 引入局部高相占比、物理支撑、厚膜岛回拉、低支撑排液和相界泡沫成核。该路径仍只使用实时模拟 render target 和程序扰动，不采样任何贴图、参考图、canvas 图案或预烘焙纹理。

下一步：需要真正的全局或分块质量约束，而不是只靠局部 13 点均值。建议增加一个低分辨率 tile mass pass 或 mip/reduction 近似，把高相面积反馈从局部变成区域级，目标高相占比锁到 0.18-0.25；同时增加一个 `phaseSupport` debug view 或临时诊断通道，确认膜厚谷/表活剂脊线/通量收敛支撑场是否过宽。随后再把 support 从岛状源改成沿速度主方向的各向异性扩散/剪切拉伸，切出河道分叉。

## Run 164-190 / 心跳继续：宽邻域质量反馈与方向性支撑诊断
相似点：本轮再次从 `filmDebugView=solid` 开始验证，Run 164、172、180 的红色壳层都稳定可见；`thickness`、`phase`、`velocity`、`foam` 也都返回 `ready=true`、`glassVisible=true`，浏览器日志未出现 shader/WebGL 错误。宽邻域高相反馈把上一轮偏中相的背景压回了较低高相占比，Run 171/179/187/190 的 beauty 能重新保持橙金主体、局部青绿相和微泡点，仍然只使用实时物理场、GPU render target 和程序扰动，没有贴图、参考图、canvas 图案或预烘焙纹理。

偏差：Run 169/177/185/188 的 `phase` 说明高相仍主要是椭圆岛、块状团和局部亮斑，没有形成目标文件中 15-25% 占比、贯穿中部的青绿分叉河道；Run 170/178/186/189 的 `foam` 没有整面白斑，但仍偏柔和亮团，不是参考目标里的密集奶金微滴。把 `filmPhaseIterations` 提到 8 后，Run 188-190 只是让岛状相团更稳定，并没有把它们连成河道，说明继续增加相场子步或盲目扩散不是正确方向。

已做改动：`PHASE_POTENTIAL_FRAGMENT_SHADER` 从 13 点局部均值扩展到更宽的 tile-like 区域高相反馈，并把 `potential.b` 用作区域高相占比；`PHASE_STEP_FRAGMENT_SHADER` 加强低支撑区排液、区域过量排液，并加入沿局部速度/主流方向的各向异性相场扩散；同时在支撑项中加入沿流向的 `streamLane`，让高相源更依赖通量收敛、表活剂脊线、膜厚谷和曲率。语法检查通过，所有 debug view 均截图验证。

下一步：需要把 `phasePotential` 的 support/区域质量场显式可视化或可采样诊断，例如新增 `phaseSupport` debug view，确认膜厚谷、表活剂脊线、通量收敛支撑场究竟是岛状还是河道状；如果支撑场本身就是岛状，应实现真正的低分辨率 mass/support pass 或骨架化的沿流向通量收敛源，而不是继续调色、加扩散或提高 phase 子步。目标仍是用 Cahn-Hilliard/薄膜排液耦合方程自发生成青绿分叉河道与奶金微滴。

## Run 191-225 / 心跳继续：`phaseSupport` 可视化与支撑场骨架诊断
相似点：新增 `filmDebugView=phaseSupport` 后，Run 191-198、199-207、208-216、217-225 都先复核了 `solid` 最小可见性，红色壳层稳定可见；`thickness`、`phase`、`velocity`、`foam` 和新 `phaseSupport` 均返回 `ready=true`、`glassVisible=true`，浏览器日志没有 WebGL/shader 错误。`phaseSupport` 直接读取独立 `phasePotential` render target 中的化学势、物理支撑和区域高相占比，只作为诊断视图，不参与贴图、参考图拟合或 beauty 伪造。

偏差：Run 196/197 证明上一轮失败的根因在支撑场本身：支撑已经是孤立斑块/小岛，phase 只是跟着长成岛状。加入沿主流方向的通量收敛、膜厚谷、表活剂脊线各向异性采样后，Run 204/205 把支撑从孤岛推成下半部连通带，但过宽，像“支撑毯”而不是窄河道。进一步加入 ridge 条件后，Run 214/215 又把支撑压得过窄，高相几乎熄灭。最终放松 ridge 的 Run 223-225 保留了一些沿流向支撑，但 phase 仍集中在底部岛状团，beauty 仍是橙金主体加底部青紫小岛，离目标文件中贯穿中部的 15-25% 青绿分叉河道、紫蓝边界和密集奶金微滴仍有明显差距。

已做改动：`logoScene.js` 新增 `uFilmSupportMap`、`phaseSupport` debug view 和相应 URL/controlSchema 选项；`thinFilmSim.js` 暴露 `phasePotentialTexture` 给壳层 shader。`PHASE_POTENTIAL_FRAGMENT_SHADER` 新增 `physicalSupportAt()`，从实时膜厚、表活剂、相场梯度、速度散度/收敛、剪切和曲率推导支撑源，并尝试沿主流方向采样 `supportAlong`、横向采样 `supportAcross`，再用 ridge/横向惩罚避免整片支撑。所有改动仍只基于实时物理 render target 和程序扰动，没有采样任何外部图像、参考图、canvas 图案或预烘焙纹理。

下一步：单 pass 局部支撑公式已经被验证为不够稳定，会在“岛状、宽毯、熄灭”之间摆动。下一轮应实现真正的低分辨率区域 `mass/support` pass 或 mip/reduction 近似：先把支撑场和高相面积降采样到分块纹理，做区域级目标占比与连通性反馈，再回写给 Cahn-Hilliard phase pass；同时新增一个只显示 tile mass / support ridge 的 debug view。这样才能把高相面积锁在 0.18-0.25，并从区域通量骨架中长出贯穿中部的分叉河道。

## Run 226-249 / 心跳继续：低分辨率区域 `mass/support` pass
相似点：本轮新增独立低分辨率 `regionalSupport` render target 和 `filmDebugView=regionalSupport`。Run 226-232 与 Run 238-244 都按 `solid`、`thickness`、`phase`、`velocity`、`foam`、`phaseSupport`、`regionalSupport` 顺序截图验证，全部返回 `ready=true`、`glassVisible=true`，浏览器日志没有 WebGL/shader 错误。区域 pass 从实时膜厚、表活剂梯度、曲率、速度收敛、剪切和当前高相占比推导区域支撑、区域高相占比与 ridge 指示，再由 `phasePotential` 读取并参与 Cahn-Hilliard 化学势；仍未使用贴图、参考图、canvas 图案或预烘焙纹理。

偏差：第一版区域 pass 的 Run 233-237 能让支撑更连续，但 `regionalSupport` 仍主要压在下半球，Run 235 的 phase 是底部宽带加椭圆团，不是贯穿中部的分叉河道。随后把物理供给窗口从单向下游 `inlet` 改为中段排液带，Run 245-249 明显把支撑和 phase 推回画面中部；这是本轮最有价值的进展。但高相仍是宽青绿带与椭圆岛，紫边和青绿没有形成参考图中的细长、弯曲、多分叉河道；Run 249 beauty 仍以橙金主体加中部/右侧局部青绿团为主，奶金微滴密度和沿河道边界的聚集仍不足。

已做改动：`thinFilmSim.js` 新增 `REGIONAL_SUPPORT_FRAGMENT_SHADER`，并新增 `regionalSupportTarget`，尺寸约为主模拟的四分之一；每个 phase 子步前先渲染区域支撑，再让 `PHASE_POTENTIAL_FRAGMENT_SHADER` 采样 `uRegionalSupport`。`phasePotential` 中的 `regionalHigh`、`targetRegionalHigh` 和 `support` 现在结合局部高相、宽邻域高相、区域高相、区域支撑和区域 ridge 共同决定；`logoScene.js` 新增 `uFilmRegionalSupportMap` 和 `regionalSupport` debug view，`controlSchema` 同步增加该选项。第二轮修正把 `physicalSupportAt()` 的供给窗口改成中段排液带，避免所有支撑沉到底部。

下一步：区域 pass 已经证明方向正确，但它仍在做“宽区域支持”，缺少能把宽带切成多条河道的竞争机制。下一轮应在 `REGIONAL_SUPPORT_FRAGMENT_SHADER` 里加入区域级骨架化/竞争项：例如用横向二阶差分或 DoG 近似，只保留沿流向连续且横向局部极大的支撑脊线；同时让 `phase` 的目标高相不是整块区域补给，而是由 ridge 和区域质量缺口共同限宽。这样才可能把当前宽青绿带切成 15-25% 的窄分叉河道。

## Run 250-273 / 心跳继续：区域支撑骨架化与桥接
相似点：本轮仍从 `filmDebugView=solid` 开始复核最小可见性，Run 250 与 Run 262 的红色壳层都稳定可见；随后按 `thickness`、`phase`、`velocity`、`foam`、`phaseSupport`、`regionalSupport` 顺序截图验证，全部返回 `ready=true`、`glassVisible=true`，浏览器日志没有 WebGL/shader 错误。新增的区域级横向竞争、脊线、片状惩罚和桥接项都只读取实时模拟 render target 中的膜厚、表活剂、曲率、速度、相场和区域质量场，没有使用贴图、参考图、canvas 图案或预烘焙纹理。

偏差：Run 257-261 证明第一版骨架竞争过强，`regionalSupport` 被切成中部亮斑/小团，`phase` 退回孤立椭圆团，beauty 中青绿成分比 Run 249 更少。随后加入 `lineBridge` 后，Run 269-273 把区域支撑恢复成更连续的中段带，`phaseSupport` 也重新出现较多沿流向亮区；但 Run 271 的高相仍然是椭圆团和短拖尾，Run 273 beauty 仍是橙金主体加局部青绿/紫色岛状纹，而不是目标文件中贯穿画面中部的细长、多分叉青绿河道。微滴/泡沫也仍偏局部亮团，缺少沿相界和河道边缘密集分布的奶金颗粒。

已做改动：`REGIONAL_SUPPORT_FRAGMENT_SHADER` 增加 near/far 横向支撑采样、`transverseRidge`、`sheetPenalty`、`sharpRidge` 与 `lineBridge`，用横向竞争压制整片宽带，同时用沿流向桥接避免支撑完全断裂；`PHASE_POTENTIAL_FRAGMENT_SHADER` 主体中残留的旧下游 `inlet` 也改成中段排液窗口，避免区域 pass 已居中但 phase 主体仍被旧供给偏置拉回下方。`phasePotential` 现在提高区域 ridge 权重，并把区域片状惩罚写入支撑/目标高相计算；`logoScene.js` 的 `regionalSupport` debug view 同步显示 sheet penalty，便于区分真实支撑脊线和过宽片状供给。

下一步：不要再继续靠加 ridge 权重或直接压窄支撑图。当前结果说明支撑图骨架化只是必要诊断，还不足以让相场长出连续河道；下一轮应把桥接机制放进真正的相场更新里，例如在 `PHASE_STEP_FRAGMENT_SHADER` 中加入沿区域 ridge/速度方向的保守 advective bridge 或各向异性 Cahn-Hilliard mobility，让高相质量沿物理流线运输，而不是只在支撑图上被静态限宽。同时需要小的 global/tile mass correction，避免桥接后重新膨胀成宽带或断裂成孤岛。

## Run 274-321 / 心跳继续：相场保守桥接通量试验
相似点：本轮按要求每次都先验证 `filmDebugView=solid`。Run 274、286、298、310 的红色壳层均稳定可见；`thickness`、`phase`、`velocity`、`foam`、`phaseSupport`、`regionalSupport` 也都返回 `ready=true`、`glassVisible=true`，浏览器日志没有 WebGL/shader 错误。`thinFilmSim.js` 的 ESM 临时语法检查通过。新增的相场桥接项只读取实时 `field/velocity/phasePotential/regionalSupport` render target，通过 ridge/support 与速度场计算上风通量 `-div(phi * v_bridge)`，没有使用贴图、参考图、canvas 图案、预烘焙纹理或样式拟合。

偏差：强桥接版 Run 281-285 失败：宽 `support` 把桥接通量激活成整片中段带，`regionalSupport` 过于平滑，`phase` 被抽成暗宽带，beauty 只剩低对比橙绿块面。随后把门控改为 ridge 优先的 Run 293-297 仍没有恢复细长河道，说明单靠在相场 step 里加通量会被当前过宽的区域支撑牵着走。最终 Run 317-321 把质量目标和阻尼恢复到上一轮稳定公式，只保留极弱 ridge 上风通量；这避免了把退化强桥接作为默认结果留下，但视觉上仍未达到目标：区域支撑仍是宽青绿中段带，phase 仍是暗带和局部短边界，不是目标文件里的 15-25% 细长、多分叉青绿河道，奶金微滴也没有沿河道边缘密集聚集。

已做改动：`PHASE_STEP_FRAGMENT_SHADER` 新增 `bridgeVelocityAt()`、`upwindDye()` 和 `bridgeFaceGate()`，用 `phasePotential` 的 support/ridge/区域高相、真实速度场与主流方向计算物理桥接速度；在相场更新里加入很弱的保守桥接通量项与局部收敛补给。强版本和 ridge-gated 版本经截图证明会退化，最终代码保留的是低权重版本，便于下一轮继续扩展但不把默认结果推向更糟的暗宽带。

下一步：不要继续在 `PHASE_STEP_FRAGMENT_SHADER` 里简单放大桥接权重。真正的问题已经更明确：`regionalSupport` 本身仍是宽带，而不是可运输的细骨架。下一轮应把区域 pass 从“标量支撑图”升级为“方向化支撑/通量图”，例如在 `regionalSupport` 的通道中输出 ridge tangent、横向曲率或局部 skeleton occupancy，再由相场 pass 按这个方向做守恒运输；同时新增一个 debug view 明确显示 `v_bridge` 或 ridge tangent。这样才能避免整片 support 驱动，转而让高相沿真实流线连接成窄分叉河道。

## Run 322-349 / 心跳继续：方向化 `regionalFlow` target 与骨架诊断
相似点：本轮新增独立低分辨率 `regionalFlow` render target 和 `filmDebugView=regionalFlow`。Run 322-329 与 Run 336-343 都先按 `solid`、`thickness`、`phase`、`velocity`、`foam`、`phaseSupport`、`regionalSupport`、`regionalFlow` 顺序截图验证，全部返回 `ready=true`、`glassVisible=true`，浏览器日志没有 WebGL/shader 错误；高参数 Run 330-335 与 Run 344-349 也均无 shader/WebGL 错误。新增 target 只从实时 `regionalSupport`、速度场和相场势场中推导 ridge tangent、skeleton occupancy 与 bridge speed，没有使用贴图、参考图、canvas 图案、预烘焙纹理或样式拟合。

偏差：第一版 Run 330-335 证明链路可视化成功，但 `regionalFlow` 仍是一整条亮中段带，说明方向化通量仍被宽 `regionalSupport` 驱动，没有形成细骨架。随后把 occupancy 改为依赖 `ridgePeak/supportPeak/longitudinalPeak` 的 Run 344-349 仍未明显变窄：`regionalFlow` 继续显示宽亮带，`phase` 仍是暗中段带与上下紫边，beauty 仍是橙金主体加低对比绿褐区，没有生成目标文件里的 15-25% 细长、多分叉青绿河道。这个结果很关键：问题不再是“缺少方向图接口”，而是区域支撑场本身缺少可被骨架化的横向局部极大。

已做改动：`thinFilmSim.js` 新增 `REGIONAL_FLOW_FRAGMENT_SHADER`、`regionalFlowTarget`、`regionalFlowMaterial` 与 `regionalFlowTexture` getter；每个 phase 子步中先渲染 `regionalSupport`，再渲染 `regionalFlow`，最后让 `PHASE_STEP_FRAGMENT_SHADER` 通过 `uRegionalFlow` 读取方向化桥接速度。`bridgeVelocityAt()` 现在优先读取 `regionalFlow` 的 tangent/occupancy/speed，再结合真实速度场与主流方向计算弱保守上风通量。`logoScene.js` 新增 `uFilmRegionalFlowMap` 与 `regionalFlow` debug view；`controlSchema.js` 增加 `regionalFlow` 选项。

下一步：不要再只调整 `regionalFlow` 的可视化阈值。需要在区域 pass 本身之前或之内产生真正的“竞争/细化”物理量：例如新增一个低分辨率多次迭代的 ridge thinning / lateral competition pass，让支撑质量沿横向竞争并保留局部极大，或者在 `REGIONAL_SUPPORT_FRAGMENT_SHADER` 中输出横向曲率/二阶差分并把宽带支撑重新分配到少数流线。只有先让 `regionalSupport` 产生真实横向极大，`regionalFlow` 和相场守恒运输才有可能把高相连成目标中的窄分叉河道。

## Run 350-397 / heartbeat 继续：低分辨率脊线细化 pass 诊断
相似点：本轮继续从 `filmDebugView=solid` 开始复核最小可见性。Run 350、366、382 的红色壳层均稳定可见；低参和高参序列里的 `thickness`、`phase`、`velocity`、`foam`、`phaseSupport`、`regionalSupport`、新增 `regionalRidge`、`regionalFlow` 均返回 `ready=true`、`glassVisible=true`，`simSize` 能在 128/320 间切换，浏览器日志没有 WebGL 或 shader 错误。新增的 `regionalRidgeTarget` 是由实时 `regionalSupport`、膜厚、表活剂梯度、相界、速度剪切/收敛等物理场推导出的低分辨率 render target，没有使用贴图、参考图、canvas 图案、预烘焙纹理或样式拟合。
偏差：第一版 Run 350-365 证明链路能工作，但 `regionalRidge` 仍是宽紫色中段带，`regionalFlow` 继续被整片宽支撑驱动，`phase` 仍偏暗带状，beauty 仍是低对比橙绿膜面。第二版 Run 366-381 收紧横向竞争后，宽片被压下去了，但 `regionalFlow` 几乎熄灭，`phase` 只剩零散暗紫片，说明只从低分辨率 `regionalSupport` 自身做局部极大筛选会在“宽片”和“饥饿”之间摆动。第三版 Run 382-397 把真实 `field/velocity` 重新接入 ridge pass 后，仍未生成目标文件要求的 15-25% 细长、多分叉青绿河道；`regionalSupport` 的源场本身还是过宽且缺少横向内部分裂，`regionalRidge` 只能得到一条暗红/暗紫带或碎片，beauty 仍缺少清亮青绿通道、紫蓝边界和沿边界密集的奶金微滴。
已做改动：`thinFilmSim.js` 新增 `REGIONAL_RIDGE_FRAGMENT_SHADER`、`regionalRidgeTarget`、`regionalRidgeMaterial` 和 `regionalRidgeTexture` getter；phase 循环现在按 `regionalSupport -> regionalRidge -> regionalFlow -> phasePotential -> phase` 执行，并让 `phasePotential` 与 `regionalFlow` 读取细化后的 ridge target。`logoScene.js` 新增 `uFilmRegionalRidgeMap` 和 `filmDebugView=regionalRidge` 可视化；`controlSchema.js` 同步新增 `regionalRidge` 选项。后续又把 ridge pass 扩展为读取实时膜厚、表活剂、相界和速度场，用物理梯度作为横向竞争种子。
下一步：不要继续在 `regionalRidge` 后处理阈值上来回摆动。需要把区域支撑从“单帧后处理筛选”升级为真正的低分辨率演化场：给 `regionalSupport/regionalRidge` 增加 ping-pong 迭代或 Cahn-Hilliard/anti-diffusion 风格的质量重分配，让支撑质量沿流向守恒输运、横向反扩散并受全局/分块高相占比约束。也就是说，要让低分辨率支撑场自己长出横向局部极大，而不是事后从一条宽带里筛。完成这一步后再把 `regionalFlow` 的 advective bridge 权重逐步加回，验证能否把高相连成目标里的细长分叉河道。

## Run 398-443 / heartbeat 继续：低分辨率支撑场 ping-pong 演化与伪影修正
相似点：本轮继续严格从 `filmDebugView=solid` 开始复核最小可见性。Run 398、414、429 的红色壳层均稳定可见；随后 `thickness`、`phase`、`velocity`、`foam`、`phaseSupport`、`regionalSupport`、`regionalRidge`、`regionalFlow` 均返回 `ready=true`、`glassVisible=true`，`simSize` 在 128/320 间切换正常。浏览器日志没有 WebGL 或 shader 错误。新增/调整的低分辨率演化 pass 只读取实时 `regionalSupport`、速度场和当前模拟状态，没有使用贴图、参考图、canvas 图案、预烘焙纹理或样式拟合。

偏差：Run 398-413 的第一版 `regionalEvolve` 失败，`regionalSupport` 与 `regionalRidge` 出现规则竖向梳齿，属于数值输运/横向反扩散伪影，不是目标中的物理分叉河道。Run 414-428 把固定 x/y 面通量改为沿主流方向的半拉格朗日回溯和方向通量后，梳齿仍然存在，说明横向反扩散仍在网格尺度上放大周期误差。Run 429-443 改为稳定跟随物理源场、温和方向输运和正扩散后，最明显的规则梳齿消失，但 `regionalSupport` 退回平滑宽中段带，`regionalRidge` 只在宽带边缘保留少量尖刺/硬片，beauty 仍是橙金/绿褐低对比膜面，没有形成目标文件要求的 15-25% 细长、多分叉青绿河道、紫蓝窄边和沿边界密集奶金微滴。

已做改动：`thinFilmSim.js` 新增 `REGIONAL_EVOLVE_FRAGMENT_SHADER`、`regionalEvolveRead`、`regionalEvolveWrite`、`regionalEvolveMaterial` 和 `swapRegionalEvolve()`；phase 循环现在先渲染原始区域支撑，再执行低分辨率 ping-pong 演化，随后再进入 `regionalRidge -> regionalFlow -> phasePotential -> phase`。第一版守恒输运被证明会制造竖向网格伪影；最终保留的是更保守的稳定演化：以物理源场为目标，加入沿主流方向的小步回溯、弱方向通量、沿/横向正扩散和很小的限幅横向竞争，迭代次数降为 1，避免把梳齿伪影留在默认路径。

下一步：当前结果说明“横向反扩散”不能直接在低分辨率支撑质量上无约束放大，否则会产生规则条纹；但完全收敛到正扩散又会回到宽带。下一轮应把细化机制改成受物理场约束的连续能量最小化/质量重分配，而不是裸反扩散：例如为 `regionalEvolve` 增加局部能量 `E = double-well(support) + kappa * |grad_side support|^2 + sheetPenalty + massPenalty` 的 Cahn-Hilliard 风格更新，并用真实速度场只做沿流向的保守输运；同时新增一个 `regionalEvolve` 或 `regionalRawSupport` debug view 区分原始源场、演化支撑和 ridge 后处理。目标仍是让支撑场先长出非规则横向局部极大，再让 `regionalFlow` 和相场通量连接成真实细长分叉河道。

## Run 444-477 / 继续：raw/evolved 区域支撑拆分与源场去条带
相似点：本轮新增 `filmDebugView=regionalRawSupport`，用于把原始低分辨率区域支撑源场和演化后的 `regionalSupport` 分开观察。Run 444-453 与 Run 461-470 均按 `solid`、`thickness`、`phase`、`velocity`、`foam`、`phaseSupport`、`regionalRawSupport`、`regionalSupport`、`regionalRidge`、`regionalFlow` 顺序截图验证，全部返回 `ready=true`、`glassVisible=true`；高参 Run 454-460 与 Run 471-477 也没有 WebGL/shader 错误。新增 debug 只读取实时 render target，没有引入贴图、参考图、canvas 图案、预烘焙纹理或样式拟合。

偏差：Run 454/455 证明上一轮的问题并不只在 evolve pass：`regionalRawSupport` 本身就是宽青色中段带，并带轻微竖向条带；`regionalEvolve` 会把这些条带放大，`regionalRidge` 随后变成间距较规则的紫色竖向尖刺。把源场采样跨度缩小、降低 `lineBridge` 权重后，Run 471-477 的 raw/evolved 支撑场条带规则性有所减弱，ridge 也从完整梳齿变成较破碎的竖向片段；但结果仍然不是目标文件要求的 15-25% 细长、多分叉、弯曲青绿河道，beauty 仍是橙金/绿褐低对比膜面加竖向淡痕，奶金微滴也没有沿河道边界密集聚集。

已做改动：`thinFilmSim.js` 暴露 `regionalRawSupportTexture`，`logoScene.js` 新增 `uFilmRegionalRawSupportMap` 与 `regionalRawSupport` debug view，`controlSchema.js` 增加对应选项。`REGIONAL_EVOLVE_FRAGMENT_SHADER` 从上一轮的平滑目标跟随改为更接近受约束能量更新：包含局部 `targetSupport`、`massPenalty`、双稳态阈值 `binodal`、沿主流弱输运、沿/横向扩散和受 ridge/sourcePeak 门控的极弱横向 winner 项。随后又调整 `REGIONAL_SUPPORT_FRAGMENT_SHADER`，减小 along/side 采样跨度，降低 `lineBridge` 对 raw support/ridge 的贡献，避免源场先天生成等间距候选线。

下一步：需要继续把“宽中段源场”改造成真正的低分辨率相分离场。当前单 pass raw support 仍太像连续供给带，后处理和 evolve 都只能把它切成竖向碎片。下一轮应新增一个独立 chemical-potential target 或在 `regionalEvolve` 中显式计算 `mu = phi^3 - phi - epsilon^2 laplacian(phi) + mass/support constraints`，再用 `dphi/dt = laplacian(mu) - div(phi * v_flow)` 更新，而不是局部 Allen-Cahn 式推拉；同时让主输运方向更多来自真实速度/ridge tangent，少依赖固定全局 `uFlowDirection`，以减少竖直片段并推动非规则弯曲分叉。

## Run 495-534 / 继续：相场质量、细界面与两级排液支撑诊断
相似点：本轮再次从 `filmDebugView=solid` 开始复核最小可见性。Run 495-499 和 Run 507-514、Run 518-525、Run 529-534 均返回 `ready=true`、`glassVisible=true`，浏览器日志没有 WebGL 或 shader 错误；`solid`、`thickness`、`phase`、`velocity`、`foam` 低参链路稳定可见。代码仍只使用实时 GPU render target 与程序物理扰动，没有使用贴图、参考图、canvas 图案、预烘焙纹理或样式拟合。

偏差：用户指出当前画面与参考图完全不像，这个判断成立。本轮首先降低宽区域支撑对相场的牵引，并把 `phase` 质量目标提高到约 20%，但 Run 504-506 仍是暗紫相团和灰绿 beauty。随后提高初始相浓度、降低 Cahn-Hilliard 界面宽度并加入厚膜/泡沫岛侵入与沿真实速度方向的颈部填充，Run 526-528 仍主要是圆胖相团。继续把相场界面能降到更细尺度后，Run 529-531 产生了更多细胞状微结构和更密泡沫，但仍不是目标中的 15-25% 青绿分叉河道。最后加入低频排液脊线与高频相分离两级源项，Run 532-534 的细节密度提升，右侧有较大薄相区，但整体仍是蜂窝/斑块与灰绿低对比，不是参考图的橙金主体、清亮青绿河道、紫蓝窄边和奶金微滴聚集。

已做改动：`thinFilmSim.js` 中调整了 `regionalSupport` 的横向竞争和质量目标，减少宽带支撑直接驱动；`PHASE_POTENTIAL_FRAGMENT_SHADER` 改为更低界面宽度的 Cahn-Hilliard 化学势；`PHASE_STEP_FRAGMENT_SHADER` 新增 `massSupport`、厚膜/泡沫岛内部侵入、沿速度方向的 `advectiveNeckFill`，并把泡沫生成约束到相界、膜厚梯度和剪切处；`INIT_FIELD_FRAGMENT_SHADER` 与 field step 新增低频 `riverInstability/wideStreamInstability` 和高频 `streamInstability`，作为排液方向的物理初始扰动和持续源项。

下一步：不要继续调构图，也不要继续只调颜色。当前最关键失败是相场形态：低频支撑还没有成为连通、弯曲、宽窄变化的河道骨架，而细界面版本会退化成蜂窝。下一轮应新增一个独立全分辨率或半分辨率的河道相场 target，把低频支撑作为守恒质量场单独做多步 Cahn-Hilliard/各向异性 mobility 更新，再把结果作为 `phase` 的目标，而不是在同一个 `field.a` 上同时承担成核、排液、细化和泡沫耦合。完成前 beauty 截图仍应判定失败。

## Run 535-565 / heartbeat 继续：独立 `riverPhase` 河道相场 target 与膜厚反馈
相似点：本轮按新自动化要求先重新读取 handoff/target/iterations，并把上一轮 `run-534-beauty-wide-stream-high.png`、`run-532-phase-wide-stream-high.png`、`run-533-foam-wide-stream-high.png`、低参 `thickness/solid` 与 `soap-film-reference.jpg` 做了对比。参考图的核心是橙金厚膜占大头、15-25% 青绿分叉河道、紫蓝窄边和沿边界/橙区内部密集奶金微滴；上一轮结果仍是灰绿蜂窝/斑块，失败点在物理场形态而不是构图。随后 Run 535 先验证 `solid` debug，红色壳层稳定可见；`thickness`、`phase`、`velocity`、`foam`、新增 `riverPhase` debug 也都返回 `ready=true`、`glassVisible=true`，控制台没有 WebGL/shader 错误。直接读取 `window.__soapFilmDebug` 在当前浏览器隔离上下文里为 null，但 `document.documentElement.dataset.soapFilmDebug` 有完整调试信息，渲染链路可用。

偏差：独立 `riverPhase` 第一版 Run 541-544 太弱，只在局部/边缘有少量响应，高预热后相场仍是暗紫带和灰白泡沫块。第二版 Run 545-549 加强物理源项后变成偏宽绿带，说明单纯保相会退化为面状支撑。第三版 Run 550-554 用沿主流向连续、横向受抑制的 ridge target 后，能切出窄紫边和横向排液带，但仍不是参考图那种弯曲分叉河道。第四版 Run 555-562 把 `riverPhase` 反馈进薄膜方程后，`phase/foam/riverPhase` 开始在同一条排液带附近自洽，出现青绿薄区、粉紫边界和密集微泡；但结构仍是水平带加竖向滴落，不是参考图的大面积橙金岛之间的青绿河网。第五版 Run 563-565 把最终光学厚度更强地耦合到 `riverPhase`，结果 beauty 反而偏粉紫/灰绿，说明光学厚度区间仍没有和真实膜厚/相场稳定对齐，不能把这当作成功。

已做改动：`thinFilmSim.js` 新增 `INIT_RIVER_PHASE_FRAGMENT_SHADER`、`RIVER_PHASE_FRAGMENT_SHADER`、`riverPhaseRead/riverPhaseWrite` ping-pong target、`riverPhaseMaterial` 和 `riverPhaseTexture` getter；phase 循环现在在 `regionalFlow` 后执行独立河道相场演化，再把 `uRiverPhase` 输入 `phasePotential` 和 `phase` step。`riverPhase` 从实时膜厚谷、表活剂梯度、曲率、速度收敛、区域支撑/脊线和当前相场推导，并做 Cahn-Hilliard 风格化学势、沿向连通、横向泄漏和局部质量约束。随后把 `uRiverPhase` 接入 `FIELD_STEP_FRAGMENT_SHADER`，让河道相场直接影响高度排液、meniscus、表活剂和泡沫生成；`logoScene.js` 新增 `uFilmRiverPhaseMap` 与 `filmDebugView=riverPhase`，并让最终干涉色从合成后的真实相场/河道相场、膜厚、视角和曲率推导。`controlSchema.js` 同步新增 `riverPhase` 调试选项。全程没有使用贴图、参考图采样、canvas 图案、预烘焙纹理或样式拟合。

下一步：继续不要碰构图。当前进展证明“独立河道 target + 膜厚反馈”方向有效，但河道源仍过度受固定全局流向支配，导致水平带和竖向滴落；下一轮应把 `riverPhase` 的主方向从固定 `uFlowDirection` 改为由 `regionalFlow`/速度场/曲率梯度共同决定的局部 tangent，并在 river target 中加入局部质量重分配，避免宽带和直线滴落。同时需要重新校准光学厚度区间：不是调色，而是让低 `h` 河道、较高 `h` 橙金岛、相界 meniscus 与薄膜干涉公式对应到参考图里的青绿河道、橙金厚膜和紫蓝窄边。

## Run 566-576 / heartbeat 继续：局部 tangent 河道相场与光学厚度复核
相似点：本轮按自动化要求先重新读取 `soap-film-physics-handoff.md`、`soap-film-target.md`、`soap-film-iterations.md`，并把上一轮最新 `run-565-beauty-optical-v5-high.png`、`run-563-phase-optical-v5-high.png`、`run-564-foam-optical-v5-high.png`、`run-558-thickness-height-v4-high.png`、`run-559-riverPhase-height-v4-high.png` 与 `soap-film-reference.jpg` 做了对比。上一轮已经有同一条排液带附近的 phase/foam/riverPhase 自洽性，但参考图要求的是橙金厚膜占约 60-75%、青绿分叉河道占约 15-25%、紫蓝只在窄边界出现、奶金/白色微滴沿边界和橙金膜内密集分布；上一轮仍是偏灰绿/粉紫的水平带和竖向滴落。随后本轮 Run 566 先验证 `solid`，`window.__soapFilmDebug` 返回 `ready=true`、`glassVisible=true`、`renderCount=42`、`simSize=128`，壳层稳定可见；Run 567-571 又按 `thickness`、`phase`、`velocity`、`foam`、`riverPhase` 顺序验证，全部可见且浏览器日志没有 WebGL/shader 错误。高参数 Run 572-576 也全部返回 `ready=true`、`glassVisible=true`、`simSize=320`，没有 shader 报错。

偏差：本轮把 `riverPhase` 的方向从固定全局 `uFlowDirection` 改成由 `regionalFlow`、真实速度场、膜厚/表活剂等值线共同决定的局部 tangent，并重新让河道内部主要通过更薄的光程产生青绿、把紫蓝限制到 meniscus/ridge 边界。结果相比 Run 565，beauty 的大面积粉紫被压低，下半部出现更多青绿薄膜响应；但这仍然明显失败：Run 576 的橙金厚膜只在上半部和局部边缘占约三分之一，不是参考图里主导画面的橙金厚膜岛；青绿区域变成下半球宽毯和竖向细纹，不是穿过橙金厚膜的弯曲分叉河道；紫/粉边界仍偏宽且集中在中部带，不是参考图里贴着河道边缘的窄蓝紫边；奶金/白色微滴在 foam 调试图里很强，但 beauty 中没有以参考图那种沿相界密集、大小混合的亮滴表现出来。更关键的是 Run 572 `thickness` 仍整体很暗，说明厚膜岛的高度场没有真正建立，beauty 中的橙金仍主要来自光学映射和上部厚区，而不是大面积物理厚膜岛。

已做改动：`RIVER_PHASE_FRAGMENT_SHADER` 新增 `uRegionalFlow` 采样和 `localTangentAt()`，用区域流向、真实速度、膜厚/表活剂等值线切向合成局部主方向；`channelTargetAt()`、`localRiverMass()`、river chemical potential 与更新步骤改为沿局部 tangent 计算，并收紧局部质量目标与 crowd drain，避免继续被固定全局方向拉成水平带。`logoScene.js` 的最终干涉色也改为区分 `riverInterior` 与 `riverRidgeOptical`：河道内部降低光学厚度，相界/毛细脊才进入紫蓝 ridge shift，橙金厚膜仍由较高 `height` 与薄膜干涉公式给出。全程没有使用贴图、参考图采样、canvas 图案、预烘焙纹理或样式拟合，也没有修改构图。

下一步：不要继续调构图，也不要只调 beauty 颜色。最新失败点已经更具体：`riverPhase` 已能被局部流向影响，但 `thickness` 高度场没有把被河道排开的液体堆成橙金厚膜岛；同时 `riverPhase` 的质量仍铺成下半球宽毯。下一轮应先在真实薄膜方程里加强“河道排液 -> 两侧 meniscus/厚膜堆积”的保守反馈：让 `FIELD_STEP_FRAGMENT_SHADER` 用 `riverCore/riverMeniscus` 和膜厚梯度把河道核心排出的液体局部转移到相界两侧，而不是只整体降低高度；同时在 `riverPhase` 里用 local mass/crowding 把宽毯压回窄分叉通道。验证标准先看 `thickness`：必须出现大面积亮的厚膜岛与暗的河道核心自洽分布，再看 beauty 是否自然变成橙金主体、青绿窄河道、紫蓝窄边和密集奶金微滴。

## Run 577-598 / heartbeat 继续：河道排液质量重分配与失败定位
相似点：本轮在 Run 566-576 的基础上继续，没有修改构图。Run 577 与 Run 588 均先验证 `solid`，壳层稳定可见；随后两轮低参都按 `thickness`、`phase`、`velocity`、`foam`、`riverPhase` 顺序截图，全部返回 `ready=true`、`glassVisible=true`，浏览器日志没有 WebGL/shader 错误。高参 Run 583-587 与 Run 594-598 也均无 shader 报错。实现仍只读取实时 GPU 物理场和程序化数值扰动，没有使用贴图、参考图采样、canvas 图案、预烘焙纹理或样式拟合。

偏差：Run 577-587 的强压窄版本把 `riverPhase` 宽毯确实压下去了，beauty 的橙金占比也比 Run 576 大，但代价是青绿河道几乎消失，只剩下半部少量暗青绿/橙褐块；这说明把宽相场简单靠 sheet penalty/crowd drain 压窄，会让河道质量饥饿，并不能生成参考图的 15-25% 连通青绿分叉。随后 Run 588-598 把 `riverPhase` 质量目标回调到中间值，河道响应恢复，但又退回宽粉紫/青绿带，Run 598 beauty 仍是大块粉紫下半部、橙金不够亮且不够主导，青绿不是分叉河网，紫蓝边界过宽，微滴在 `foam` 调试图里强但最终画面仍不像参考图的奶金/白色边界滴。Run 594 `thickness` 相比 Run 572 有局部厚度/沉积响应，但仍不是参考图需要的大面积橙金厚膜岛和暗河道核心的清晰分离。

已做改动：`FIELD_STEP_FRAGMENT_SHADER` 新增基于 `riverCore/riverBoundary/riverMeniscus` 的排液与沉积反馈：河道核心通过 `riverDrain` 降低膜厚，邻近河道核心但当前像素在相界处时通过 `displacedRidge` 与 `riverRidgeDeposit` 把排开的液体加回 meniscus/厚膜边界，尝试形成真实厚膜岛，而不是只在 beauty shader 里调颜色。同时在 `RIVER_PHASE_FRAGMENT_SHADER` 试验了两档局部质量约束：强版本降低 `regionalSupport` 宽源、提高横向竞争与 crowd drain；平衡版本恢复部分 regional/ridge 供给并减弱 sheet penalty，保留局部 tangent。`logoScene.js` 保持上一轮光学厚度推导，没有继续盲目调色。

下一步：不要继续在同一个 `riverPhase.r` 上用阈值来回压宽度；这已经被 Run 587 和 Run 598 证明会在“河道饥饿”和“宽粉紫毯”之间摆动。下一轮应把独立河道模型拆成至少两个物理变量：`riverCore` 表示窄的薄膜排液核心，`riverRidge/meniscusMass` 表示被排开的厚膜边界质量，并在 `FIELD_STEP_FRAGMENT_SHADER` 或新的 river pass 中显式守恒地用 `source = -div(q_core)` 和 `deposit = +div(q_to_ridge)` 更新高度。也就是说，`riverPhase` 不能再同时承担“哪里是薄河道”和“哪里是厚边界沉积”；必须先让 `thickness` 调试图出现暗窄核心与亮厚膜岛的物理分离，再让 beauty 的青绿/橙金/紫蓝自然从薄膜干涉公式出来。

## Run 599-620 / heartbeat 继续：`riverCore` 与 `meniscusMass` 通道拆分试验
相似点：本轮先按自动化要求重新读取 handoff、target、iterations，并重新对照 `soap-film-reference.jpg` 与上一轮 `run-598-beauty-balanced-riverphase-high.png`、`run-594-thickness-balanced-riverphase-high.png`、`run-595-riverPhase-balanced-riverphase-high.png`、`run-596-phase-balanced-riverphase-high.png`、`run-597-foam-balanced-riverphase-high.png`。上一轮失败点确认不是构图，而是宽相场同时承担“薄河道核心”和“厚膜边界沉积”，导致橙金厚膜、青绿河道、紫蓝窄边和奶金微滴无法同时成立。本轮修改后，Run 599 与 Run 610 均先验证 `solid`，`ready=true`、`glassVisible=true`、`renderCount` 正常，低参 `thickness/phase/velocity/foam/riverPhase` 与高参 Run 605-609、Run 616-620 均没有 WebGL/shader 报错。实现仍只读取实时 GPU render target 和物理扰动，没有采样贴图、参考图、canvas 图案或预烘焙纹理。

偏差：第一版拆分 Run 599-609 把 `riverPhase.g` 改成 `meniscusMass`，并让膜厚方程用 `riverCore` 排液、用 `meniscusMass/ridge` 沉积厚边；beauty 的粉紫宽带有所减弱，橙金占比略回升，但 `run-605-thickness` 仍整体偏暗，没有出现参考图所需的大面积亮厚膜岛与暗窄河道核心。`run-606-riverPhase` 仍是宽青绿/粉紫带，说明 `meniscusMass` 还没有成为独立边界质量，而是跟着核心宽带铺开。第二版 Run 610-620 用 `meniscusMass` 反向挖掉 `riverCore` 并加强沉积，结果 `run-620-beauty` 更橙，但河道核心被挖得过弱，`run-616-thickness` 仍暗，`run-617/618/619` 仍不是参考图里的青绿分叉河网、紫蓝窄边和边界奶金微滴。当前结果证明：仅在同一个 river pass 内用 `g` 通道附着式沉积，仍会在“宽带”和“熄灭”之间摆动。

已做改动：`INIT_RIVER_PHASE_FRAGMENT_SHADER` 与 `RIVER_PHASE_FRAGMENT_SHADER` 的 `riverPhase.g` 语义从 `localHigh` 改为 `meniscusMass`；`riverPhase.r` 保留窄薄膜排液核心，`riverPhase.b` 保留 ridge/boundary，`riverPhase.a` 保留 sheetReject。`FIELD_STEP_FRAGMENT_SHADER` 新增 `riverMeniscusMass`，让高度更新使用 `riverDrain` 降低河道核心膜厚，并用 `riverRidgeDeposit` 从 `meniscusMass/geometricMeniscus/displacedRidge` 向厚膜边界沉积；表活剂、泡沫和相场目标也改为区分 `riverCore` 与 `meniscusMass`。`PHASE_POTENTIAL_FRAGMENT_SHADER`、`PHASE_STEP_FRAGMENT_SHADER` 和 `logoScene.js` 同步改用 `meniscusMass` 作为边界/厚膜质量，而不是把它当高相面积。第二版又加入 `coreEvacuation`，用 `meniscusMass` 从核心中挖出边界沉积区域，并提高 `riverRidgeDeposit` 系数。

下一步：不要继续在 `riverPhase` 单 pass 里加阈值。下一轮应把 `meniscusMass` 从附着变量升级成独立守恒更新：至少新增一个 `RIVER_MENISCUS_FRAGMENT_SHADER` 或在 river pass 中显式计算侧向通量 `q_side = riverCore * grad(riverCore)`，用 `meniscus += div(q_side) - decay`、`riverCore -= div(q_side)` 做成对的质量转移；同时新增或改进 debug，使 `riverPhase` 能清楚区分 core、meniscus、ridge 三者。验证标准仍先看 `thickness`：如果厚膜岛没有在调试图中变亮，beauty 的橙金就不能算真实物理成功。

## Run 621-631 / heartbeat 继续：`meniscusMass` 侧向守恒通量试验
相似点：本轮仍先按自动化要求重读 handoff、target、iterations，并强制对比上一轮 `run-620-beauty-meniscus-core-split-high.png`、`run-616-thickness-meniscus-core-split-high.png`、`run-617-riverPhase-meniscus-core-split-high.png`、`run-618-phase-meniscus-core-split-high.png`、`run-619-foam-meniscus-core-split-high.png` 与 `soap-film-reference.jpg`。上一轮确认失败点不是构图，而是物理场：橙金不是由亮的厚度场支撑，青绿相场是下半球宽带，不是 15-25% 的分叉薄河道，紫蓝窄边和奶金微滴也没有沿边界自洽出现。本轮修改后，`run-621-debug-solid-meniscus-flux-low.png` 重新验证了 solid 最小可见性，壳层稳定可见；`run-622` 到 `run-626` 依次验证 thickness、phase、velocity、foam、riverPhase，均返回 `ready=true`、`glassVisible=true`。高参 `run-627` 到 `run-631` 也无 WebGL/shader 警告。与上一轮相比，`run-627-thickness-meniscus-flux-high.png` 下半部第一次出现了明显橙金厚膜沉积带，说明 `riverCore -> meniscusMass -> h` 的物理反馈方向开始生效，而不是只靠 beauty 映射给橙色。

偏差：结果仍然失败，且失败原因更明确。`run-631-beauty-meniscus-flux-high.png` 仍是完整小球视图，不在本轮处理范围；物理质感方面，橙金厚膜只集中在上半球和下缘局部，距离参考图 60-75% 的大面积橙金主导仍差很多。青绿区域在 `run-628-riverPhase-meniscus-flux-high.png` 和 `run-629-phase-meniscus-flux-high.png` 里仍然是下半球宽毯/宽带，缺少参考图里的弯曲、分叉、宽窄变化的青绿河道。紫蓝边界还是偏宽、偏片状，没有贴着河道两侧形成窄边。`run-630-foam-meniscus-flux-high.png` 的奶金/白色微滴被放大成一整片泡沫/乳白块，局部颗粒有了，但密度和位置不对：参考图是沿相界和橙金厚膜内部散布的微滴，本轮是下半球大面积 foam 堆积。物理自洽性上，厚度场变亮是进步，但 `meniscusMass` 与 `foam` 仍耦合过宽，`riverCore` 没有保持为暗窄核心，因此 beauty 仍不像参考图。

已做改动：在 `mvp/src/visual/thinFilmSim.js` 的 `RIVER_PHASE_FRAGMENT_SHADER` 中加入局部侧向通量近似：用沿局部 tangent 的法向采样估算 `sideCoreMean`、`sideMeniscusMean`，从 `riverCore` 中扣除 `pairedTransferOut`，并把来自两侧核心差的 `pairedTransferIn` 加入 `meniscusMass`，同时把上一轮过强的 `coreEvacuation` 降为只在 ridge/wallGate 上起作用的弱分离项。对应地，在 `FIELD_STEP_FRAGMENT_SHADER` 中新增 `meniscusRecovery`，让 `riverPhase.g` 的边界质量能实际抬高 `h`，形成可见厚膜沉积。整个过程只读实时 GPU 物理场、速度/相场/泡沫/厚度和程序扰动，没有使用贴图、参考图采样、canvas 图案、预烘焙纹理或样式拟合。

下一步：不要继续调构图，也不要把白块当微滴成功。下一轮应把 `foamBirth` 与 `meniscusMass` 的耦合改成只在 `ridge + dyeEdge + shear + curvature` 同时满足时产生小尺度微滴，禁止 `meniscusMass` 宽带直接整片变白；同时把侧向通量拆成更真正的 core/ridge 成对场，最好新增独立 meniscus pass 或在现有 pass 中用双向邻域通量分别更新 `riverCore` 和 `meniscusMass`，让 `riverPhase.r` 保持暗窄分叉核心、`riverPhase.g/b` 只贴边沉积。验证标准仍先看 `thickness` 与 `riverPhase`：厚膜岛必须扩大并变亮，河道核心必须收窄成连通分叉，再让 beauty 自然出现橙金主体、青绿窄河、紫蓝窄边和奶金微滴。

## Run 632-653 / heartbeat 继续：微滴门控与宽河道压力试验
相似点：本轮继续按自动化要求先重读 handoff、target、iterations，并把上一轮最新 `run-631-beauty-meniscus-flux-high.png`、`run-627-thickness-meniscus-flux-high.png`、`run-628-riverPhase-meniscus-flux-high.png`、`run-640-phase-microfoam-gate-high.png`、`run-641/652-foam` 等结果与 `soap-film-reference.jpg` 对照。`run-632` 与 `run-643` 都重新验证了 `solid` 最小可见性，壳层稳定可见；`thickness`、`phase`、`velocity`、`foam`、`riverPhase` 的低参链路，以及高参 `run-638` 到 `run-653` 均返回 `ready=true`、`glassVisible=true`、`simSize=320`，浏览器日志无 WebGL/shader 警告。与 run-631 相比，run-642/run-653 beauty 中上一轮最刺眼的整块乳白泡沫略被压暗，说明泡沫出生门控开始起作用；局部橙金/青绿交界仍能从真实物理场中出现，没有使用贴图、参考图采样、canvas 图案、预烘焙纹理或样式拟合。

偏差：本轮仍然失败。参考图的橙金厚膜应占 60-75%，且内部有细密液体拉丝和奶金微滴；run-653 仍只有上半球与下缘局部橙金，厚膜调试图 `run-649-thickness-width-pressure-high.png` 仍整体偏暗，只在下部有弱厚膜沉积。参考图的青绿河道应是 15-25% 的弯曲分叉窄河；`run-650-riverPhase-width-pressure-high.png` 与 `run-651-phase-width-pressure-high.png` 仍是下半球宽带/宽毯，并没有形成清晰暗窄核心和分叉骨架。紫蓝边仍偏宽、偏片状，没有只贴着河道边界。泡沫方面，`run-652-foam-width-pressure-high.png` 的白色/奶金区域虽然比 run-630 略弱，但仍是大面积连续泡沫块，不是参考图里沿相界和橙金厚膜内部散布的微滴。物理自洽性结论：微滴门控有小进步，但 `meniscusMass`、`riverPhase`、`foam` 仍共享同一条宽下半球带，说明同一个 river pass 内继续靠阈值和宽度压力修正已经不够。

已做改动：`FIELD_STEP_FRAGMENT_SHADER` 中新增 `riverEdgeDroplet`、`microDropletSupport` 和 `wideFoamQuench`，让泡沫出生必须同时满足相界、曲率、剪切、膜厚梯度与河道 ridge/meniscus 边界条件，并削弱 `riverMeniscus` 对 `foam` 的直接整片补给；宽 `meniscusMass` 内部增加泡沫衰减，避免把边界质量直接刷成白片。`RIVER_PHASE_FRAGMENT_SHADER` 中加入 `widthPressure`，当横向质量相对沿向质量过宽时，提高 `crowdDrain` 与 `sheetReject`，并加强宽片 `meniscusMass` 的衰减；相场相关 pass 中降低了 `riverMeniscusMass` 对 `regionalHigh/localHigh` 的面积支撑，让 `meniscusMass` 更像边界质量而不是青绿高相面积。

下一步：不要继续在同一个 river pass 里用更强阈值压宽度；run-642/653 已经显示这只会把画面整体压暗，不能长出参考图需要的分叉河网。下一轮应拆出真正独立的 meniscus/ridge 通量步骤：用单独 pass 或更明确的双向邻域通量保存 `riverCore`、`meniscusMass`、`ridgeMass` 三个变量，核心只表示薄河道，边界质量只能沿核心梯度两侧沉积；同时需要一个 `riverCore/meniscus/ridge` 分离 debug 视图，先证明 `riverPhase.r` 已经变成窄分叉核心、`riverPhase.g/b` 只贴边，再允许 beauty 参与评估。泡沫下一步也应从连续 `foam` 密度再拆出短寿命微滴成核/衰减，避免任何宽带直接变白。

## Run 654-675 / heartbeat 继续：独立 `meniscus/ridge` 通量 pass
相似点：本轮按自动化要求先重新读取 `soap-film-physics-handoff.md`、`soap-film-target.md`、`soap-film-iterations.md`，并把上一轮最新 `run-653-beauty-width-pressure-high.png`、`run-649-thickness-width-pressure-high.png`、`run-650-riverPhase-width-pressure-high.png`、`run-651-phase-width-pressure-high.png`、`run-652-foam-width-pressure-high.png` 与 `soap-film-reference.jpg` 对照。上一轮的失败点确认不是构图，而是物理场：参考图中橙金厚膜约占 60-75%，青绿分叉河道约占 15-25%，紫蓝只贴着河道窄边，奶金/白色微滴沿相界和橙金厚膜内部密集；而 run-653 仍是完整小球视图下的暗橙上半部、下半球灰绿/白块，`thickness` 没有大面积亮厚膜岛，`riverPhase/phase/foam` 共享同一片下半球宽毯。修改后，Run 654 与 Run 665 都重新验证 `solid`，壳层稳定可见；Run 655-659 与 Run 666-670 依次验证 `thickness/phase/velocity/foam/riverPhase`，高参数 Run 660-664 与 Run 671-675 均返回 `ready=true`、`glassVisible=true`、`simSize=320`，浏览器日志没有 WebGL/shader 报错。实现仍只读取实时 GPU render target、速度、膜厚、表活剂、相场、区域流和程序化扰动，没有使用贴图、参考图采样、canvas 图案、预烘焙纹理或样式拟合。

偏差：本轮仍然失败。第一版独立 pass 的 Run 660-664 让 `riverPhase` debug 中 core、meniscus、ridge 的分色更清楚，但 `meniscus` 在下半球被推成大片粉/白沉积，`run-663-foam-meniscus-pass-high.png` 又出现大面积奶白泡沫块；这说明独立 pass 结构是对的，但横向沉积门控太宽，宽片内部仍在吃到 meniscus/ridge 质量。第二版 Run 671-675 加强了 `edgeOnlyGate`、宽片 `sheetReject` 和宽 meniscus 的 foam 衰减后，白块略有减弱，但 `run-671-thickness-meniscus-edge-high.png` 仍整体偏暗，只在下半部有弱厚膜沉积；`run-672-riverPhase-meniscus-edge-high.png` 与 `run-673-phase-meniscus-edge-high.png` 仍是下半球宽带/宽毯，而不是参考图的弯曲分叉青绿河道；`run-674-foam-meniscus-edge-high.png` 仍是连续泡沫场，不是沿相界和橙金膜内随机密集的微滴；`run-675-beauty-meniscus-edge-high.png` 只回到较暗橙金小球，橙金厚膜占比不足、青绿河道不清、紫蓝窄边不成立。当前物理自洽性结论：新增独立 pass 只是拆开了变量通道，还没有解决“排出的核心质量如何守恒地堆成大面积厚膜岛”和“宽相场如何骨架化成窄分叉河道”。

已做改动：`thinFilmSim.js` 新增 `RIVER_MENISCUS_FRAGMENT_SHADER`，在每次 `riverPhaseMaterial` 更新后单独执行。该 pass 读取当前 `riverCore/meniscusMass/ridge/sheetReject`、真实速度、膜厚梯度、相场梯度、区域流向和曲率，按局部 tangent 的横向采样计算 `sideCore/alongCore`、`edgeGate`、`wideSheet`、`pairedOut/pairedIn`，把核心质量向两侧 meniscus/ridge 转移，并把宽片标记为 sheet。随后又把旧 `RIVER_PHASE_FRAGMENT_SHADER` 内部的侧向通量降权，避免同一个 pass 里继续用阈值硬压宽度；`FIELD_STEP_FRAGMENT_SHADER` 改为用 `edgeBoundedMeniscus` 和 ridge 参与高度沉积、泡沫出生/衰减，避免宽 `meniscusMass` 直接刷成白片；`logoScene.js` 的 `riverPhase` debug 视图改为更清楚地区分 cyan core、orange meniscus、purple ridge、brown sheet。全程没有改构图，也没有调 beauty 颜色去糊结果。

下一步：本轮证明“独立 pass”还不够，需要把质量守恒做得更显式。下一轮不要碰构图，也不要先调 beauty；应先继续改物理：在 `RIVER_MENISCUS_FRAGMENT_SHADER` 或新增第二个高度反馈 pass 中计算更明确的 `q_side` 与 `deposit = div(q_side)`，把 `riverCore` 排出的质量按局部横向法线成对沉积到 ridge 两侧，并把 `FIELD_STEP_FRAGMENT_SHADER` 的高度更新从局部加法改成读取这个沉积通量，而不是只看 `meniscusMass` 标量。验证标准先看 `thickness` 和 `riverPhase`：`thickness` 必须出现大面积亮厚膜岛与暗窄核心，`riverPhase.r` 必须变成连通窄分叉，`riverPhase.g/b` 只贴边；然后再拆出短寿命微滴成核/衰减通道，让 `foam` 从连续白块变成沿相界和厚膜内部散布的奶金/白色微滴。

## Run 676-686 / heartbeat 继续：显式 `riverHeightFlux` 高度反馈
相似点：本轮再次按自动化要求先重读 handoff、target、iterations，并把上一轮最新 `run-675-beauty-meniscus-edge-high.png`、`run-671-thickness-meniscus-edge-high.png`、`run-672-riverPhase-meniscus-edge-high.png`、`run-673-phase-meniscus-edge-high.png`、`run-674-foam-meniscus-edge-high.png` 与 `soap-film-reference.jpg` 对照。上一轮与参考图唯一接近处只是仍有橙/青/紫三类物理响应；主要偏差仍是橙金厚膜占比远低于参考图 60-75%，青绿不是 15-25% 的分叉河道而是下半球宽毯，紫蓝边过宽，奶金/白色微滴是连续白块。修改后，Run 676 重新验证 `solid`，壳层稳定可见；Run 677-681 依次验证 `thickness/phase/velocity/foam/riverPhase`，高参数 Run 682-686 均返回 `ready=true`、`glassVisible=true`、`simSize=320`，浏览器日志没有 WebGL/shader 报错。实现仍只使用实时 GPU render target 和物理场，没有贴图、参考图采样、canvas 图案、预烘焙纹理或样式拟合。

偏差：本轮仍然失败，但定位比上一轮更窄。`run-682-thickness-height-flux-high.png` 相比 `run-671` 下半部沉积略更亮、更连续，说明新增的显式高度通量确实进入了 `h` 更新，不再完全靠 `meniscusMass` 标量间接加高度；但它仍只是下半球宽亮带，没有形成参考图里被河道切割出的多块橙金厚膜岛，也没有暗窄河道核心。`run-683-riverPhase-height-flux-high.png` 和 `run-684-phase-height-flux-high.png` 仍是宽片/宽毯，`riverCore` 没有骨架化为弯曲分叉；`run-685-foam-height-flux-high.png` 仍是连续奶白泡沫场，微滴没有变成沿相界和厚膜内部的随机颗粒；`run-686-beauty-height-flux-high.png` 依旧是暗橙完整小球加一条灰绿下半部宽带，橙金占比、青绿河道、紫蓝窄边和奶金微滴都不符合参考图。物理自洽性结论：`riverCore -> height` 的显式反馈开始生效，但沉积通量仍跟宽相场绑定，没有变成两侧窄 ridge 的守恒沉积。

已做改动：`thinFilmSim.js` 新增 `RIVER_HEIGHT_FLUX_FRAGMENT_SHADER` 和 `riverHeightFluxTarget`。每个 field step 前先由实时 `field/velocity/riverPhase/regionalFlow` 计算通量缓存：`r = core drain`、`g = edge deposit`、`b = ridge deposit`、`a = wide sheet`；随后 `FIELD_STEP_FRAGMENT_SHADER` 新增 `uRiverHeightFlux`，把 `fluxDrain` 与 `fluxDeposit` 直接加入高度方程的 `-coreDrain + edgeDeposit`，并用 `fluxWideSheet` 抑制宽片泡沫。也就是说，这一轮开始把“河道核心排出的质量”显式传给高度场，而不是继续靠 beauty 映射或宽 `meniscusMass` 假装厚膜。全程没有改构图，也没有改薄膜干涉颜色去掩盖结果。

下一步：不要先调 beauty。下一轮应先新增 `riverFlux` debug view 或把 `riverHeightFluxTarget` 接入现有 `riverPhase` 诊断，确认 `r/g/b/a` 到底是窄边沉积还是宽片沉积；若通量本身仍是宽片，必须在 `RIVER_HEIGHT_FLUX_FRAGMENT_SHADER` 中加入区域级横向竞争或 DoG/ridge 骨架化，只允许横向局部极大值成为 `edge deposit`，宽片只能进入 `sheet` 衰减。验证顺序仍是：`solid` 可见，再看 `thickness` 是否出现亮厚膜岛和暗窄核心，再看 `riverPhase/phase/foam` 是否从宽毯退回分叉河道与边界微滴。

## Run 687-712 / heartbeat 继续：`riverFlux` 诊断与横向 DoG 骨架门控
相似点：本轮继续按自动化要求先重读 `soap-film-physics-handoff.md`、`soap-film-target.md`、`soap-film-iterations.md`，并把上一轮最新 `run-686-beauty-height-flux-high.png`、`run-682-thickness-height-flux-high.png`、`run-683-riverPhase-height-flux-high.png`、`run-684-phase-height-flux-high.png`、`run-685-foam-height-flux-high.png` 与 `soap-film-reference.jpg` 对照。上一轮确认 solid 已可见，真正失败点是物理场：橙金厚膜不是 60-75% 主体，青绿相场是下半球宽毯而非 15-25% 分叉河道，紫蓝边过宽，奶金/白色微滴连成连续泡沫块。本轮第一步只做诊断暴露：`run-687-debug-solid-riverflux-low.png` 重新验证红色壳层稳定可见，`run-688` 到 `run-693` 依次验证 `thickness/phase/velocity/foam/riverPhase/riverFlux`，高参 `run-694` 到 `run-699` 返回 `ready=true`、`glassVisible=true`、`simSize=320`，浏览器日志无 WebGL/shader 报错。实现仍只读取实时 GPU render target 和程序扰动，没有采样贴图、参考图、canvas 图案、预烘焙纹理或样式拟合。

偏差：`run-696-riverFlux-riverflux-high.png` 直接证明上一轮高度通量本身已经宽片化：沉积/脊线/宽片信号主要集中在下半球大面积带状区域，而不是贴着窄河道两侧。这解释了为什么 `run-694-thickness-riverflux-high.png` 只有下半球宽亮带，`run-695-riverPhase-riverflux-high.png` 仍是宽青绿/粉紫毯，`run-698-foam-riverflux-high.png` 仍是连续奶白块，`run-699-beauty-riverflux-high.png` 仍是暗橙完整小球加灰绿宽带。根据这个诊断，本轮继续在 `RIVER_HEIGHT_FLUX_FRAGMENT_SHADER` 里加入横向局部极大值/DoG 近似门控：沉积需要 `nearSidePeak - farSidePeak`、横向对比、沿向连续性和非宽片内部共同满足。第二轮验证 `run-700` 到 `run-712` 也无 shader 报错，solid 仍可见；但 `run-709-riverFlux-riverflux-dog-high.png` 说明门控压得过狠，通量可见信号大幅变暗，`run-707-thickness-riverflux-dog-high.png` 没有长出更亮厚膜岛，`run-710-phase-riverflux-dog-high.png` 还出现泡状大相团，`run-711-foam-riverflux-dog-high.png` 仍是宽泡沫块，`run-712-beauty-riverflux-dog-high.png` 仍不接近参考图。物理自洽性结论：新增诊断是有效的，DoG 方向也验证了“宽片沉积是根因”，但单 pass 硬门控会把真实通量一起压灭，不能作为最终解。

已做改动：`thinFilmSim.js` 暴露 `riverHeightFluxTexture` getter；`logoScene.js` 新增 `uFilmRiverFluxMap`、`riverFluxAt()`、`filmDebugView=riverFlux` 的 debug 映射，其中 `r=core drain`、`g=edge deposit`、`b=ridge deposit`、`a=wide sheet` 分别用红/青/紫/暗褐显示；`controlSchema.js` 新增 “河道高度通量” 选项。随后在 `RIVER_HEIGHT_FLUX_FRAGMENT_SHADER` 中加入 `nearSidePeak/farSidePeak/balancedSideCore/sideContrast/alongContinuity/transversePeak/sheetInterior/ridgeGate`，让 `deposit` 与 `ridgeDeposit` 需要通过横向 ridge gate，宽片进入 `sheet` 衰减。整个过程没有改构图，没有用参考图采样，也没有调 beauty 颜色去掩盖结果。

下一步：不要再继续靠单 pass 阈值压宽片；`run-709` 已说明这样会把通量一起压暗。下一轮应把 `riverHeightFlux` 拆成更明确的两步守恒更新：第一步只计算 `coreDrain` 和侧向质量通量强度并做局部归一化/能量限制，第二步把可用质量沿横向法线分配到两侧 ridge/meniscus，保证 `sum(deposit) <= drain` 且宽片只作为 sheet 衰减。新增一个更敏感的 `riverFlux` 诊断缩放或统计输出，先确认 `r/g/b/a` 的数值范围，避免因为 debug 阈值看不到小但有效的通量。验证标准仍然是先 `solid`，再看 `thickness` 是否出现亮厚膜岛和暗窄核心，再看 `riverPhase/phase/foam` 是否从宽毯退回分叉河道与边界微滴，最后才评估 beauty。

## Run 713-738 / 继续：邻近 core 排液配额与沉积接收试验
相似点：本轮按要求先重读 handoff、target、iterations，并重新对照 `soap-film-reference.jpg` 与上一轮最新 `run-712-beauty-riverflux-dog-high.png`、`run-707-thickness-riverflux-dog-high.png`、`run-708-riverPhase-riverflux-dog-high.png`、`run-709-riverFlux-riverflux-dog-high.png`、`run-711-foam-riverflux-dog-high.png`。上一轮失败点确认不是构图，而是 `riverFlux` 被 DoG 硬门控压得过暗，`thickness` 没有厚膜岛，`riverPhase/phase/foam` 仍是下半球宽毯。本轮修改后，`run-713-debug-solid-riverflux-quota-low.png` 与 `run-726-debug-solid-riverflux-quota2-low.png` 均重新验证 solid，红色壳层稳定可见；`thickness/phase/velocity/foam/riverPhase/riverFlux` 低参链路和高参 `run-720` 到 `run-725`、`run-733` 到 `run-738` 均返回 `ready=true`、`glassVisible=true`、`simSize=320`，浏览器日志没有 WebGL/shader 错误。实现仍只使用实时 GPU 物理场和程序扰动，没有贴图、参考图采样、canvas 图案、预烘焙纹理或样式拟合。

偏差：本轮仍然失败。第一版 `run-722-riverFlux-riverflux-quota-high.png` 相比 `run-709` 恢复了可见的红色 drain 区域，说明不再把通量完全压灭；但 cyan/purple 的 edge/ridge deposit 仍弱，`run-720-thickness-riverflux-quota-high.png` 只显示下半球宽厚度带，`run-725-beauty-riverflux-quota-high.png` 仍是暗橙完整小球加灰绿宽带。第二版放宽 `pairedReceiving` 后，`run-735-riverFlux-riverflux-quota2-high.png` 的通量可见性略好，但仍主要跟随同一片下半球宽相带；`run-733-thickness-riverflux-quota2-high.png` 没有出现参考图需要的大面积亮橙金厚膜岛和暗窄河道核心，`run-734-riverPhase-riverflux-quota2-high.png` 仍是宽青绿/粉紫毯，`run-737-foam-riverflux-quota2-high.png` 仍是连续泡沫块，`run-738-beauty-riverflux-quota2-high.png` 与参考图的橙金 60-75%、青绿分叉河道 15-25%、紫蓝窄边、奶金微滴密度都不匹配。物理自洽性结论：高度通量分配从“被压灭”恢复到“能排液”，但上游 `riverPhase` 源场仍是宽毯，导致排液/沉积/泡沫都绑定在宽片上，单独修 `riverHeightFlux` 已经不够。

已做改动：`RIVER_HEIGHT_FLUX_FRAGMENT_SHADER` 增加邻近 core 的沿向采样 `sidePAlongP/sidePAlongM/sideMAlongP/sideMAlongM`，计算 `availableSideDrain`，用邻近核心可用排液质量对 edge/ridge deposit 做配额限制；同时把上一轮过硬的 `ridgeGate` 改成 `softRidgeGate`，并用 `depositQuota = availableSideDrain + outwardCore` 限制沉积，避免宽片无限沉积。`logoScene.js` 的 `riverFlux` debug 阈值下调，方便看到较小但真实的 drain/deposit/ridge/sheet 信号。第二版再加入 `pairedReceiving = nearSidePeak + availableSideDrain`，允许邻近核心排出的质量被相邻 edge 像素接收。全程没有修改构图，没有调整 beauty 颜色映射来掩盖失败。

下一步：不要继续只在 `riverHeightFlux` 里调接收阈值；本轮证明真正瓶颈已经回到 `riverPhase` 的 core/sheet 分离。下一轮应先改 `RIVER_PHASE_FRAGMENT_SHADER` 或新增独立的 `riverCore` 骨架 pass：把 `riverPhase.r` 从宽高相面积改成守恒的窄 core，占比明确限制在 15-25%，宽片必须流入 `riverPhase.a` 的 sheetReject 并衰减；`riverPhase.g/b` 只允许沿 core 横向梯度两侧沉积。验证标准是 `riverPhase` 先出现连通窄分叉核心，`riverFlux` 的 r/g/b 才有窄排液和两侧沉积，随后 `thickness` 才能生成橙金厚膜岛；在此之前不要评估 beauty 成功，也不要做构图或调色。

## Run 739-803 / heartbeat 继续：core/sheet 末端拆分试验失败并恢复基线
相似点：本轮先按自动化要求重读 `soap-film-physics-handoff.md`、`soap-film-target.md`、`soap-film-iterations.md`，并把上一轮最新 `run-738-beauty-riverflux-quota2-high.png`、`run-733-thickness-riverflux-quota2-high.png`、`run-734-riverPhase-riverflux-quota2-high.png`、`run-735-riverFlux-riverflux-quota2-high.png`、`run-737-foam-riverflux-quota2-high.png` 与 `soap-film-reference.jpg` 对照。参考图的橙金厚膜约 60-75%，青绿分叉河道约 15-25%，紫蓝窄边只贴河道，奶金/白色微滴沿相界和厚膜内部高密度分布；上一轮结果仍是完整小球、下半球宽相带和连续白块。`run-739/752/765/778/791` 都重新验证了 `solid` 最小可见性，红色壳层稳定可见；所有低参 `thickness/phase/velocity/foam/riverPhase/riverFlux` 和高参截图均返回 `ready=true`、`glassVisible=true`，浏览器日志没有 WebGL 或 shader 报错。自动化已更新为 15 分钟一次，并保留“先对比上一轮图，再计划，再改”的提示。

偏差：本轮试图在 `RIVER_PHASE_FRAGMENT_SHADER` 与 `RIVER_MENISCUS_FRAGMENT_SHADER` 末端直接做 core/sheet 拆分：宽而横向均衡的相场写入 sheet，横向局部峰值和沿向连续部分保留为 core。但 `run-746-751`、`run-759-764`、`run-772-777`、`run-785-790` 证明这个做法失败：`riverPhase.r` 在低参和高参下都被过度熄灭，`riverFlux` 几乎消失，beauty 退成平橙球或暗球。这说明不能在每个 river 子迭代末端用乘法/阈值直接压 core；18 次以上子迭代叠加后会把真实核心一起杀掉。已将这些破坏性 core 折减从 active shader 撤掉，最终恢复验证为 `run-798-thickness-rivercore-restore-high.png`、`run-799-riverPhase-rivercore-restore-high.png`、`run-800-riverFlux-rivercore-restore-high.png`、`run-802-foam-rivercore-restore-high.png`、`run-803-beauty-rivercore-restore-high.png`。恢复后的结果不黑屏，但仍然失败：`thickness` 只有下半球宽厚度带，没有亮橙金厚膜岛；`riverPhase` 仍是宽青绿/粉紫毯，不是窄分叉 core；`riverFlux` 仍随宽带排液；`foam` 仍是连续奶白块；beauty 仍与参考图在橙金主体、青绿分叉、紫蓝窄边、微滴密度上严重不符。

已做改动：最终 active 代码没有保留本轮 destructive 末端拆分，避免把仓库停在更差的黑相场状态。本轮保留的是截图证据和诊断结论：`riverPhase` 的 core/sheet 分离不能作为 `RIVER_MENISCUS_FRAGMENT_SHADER` 末端的局部乘法衰减来做，必须拆成独立、守恒、带面积/质量约束的 core 支撑或归一化步骤。全程没有使用贴图、参考图采样、canvas 图案、预烘焙纹理、样式拟合，也没有改构图或调 beauty 颜色糊结果。

下一步：新增独立 `riverCore`/`sheetReject` 归一化 pass，而不是继续在 meniscus 末端改 core。具体建议：在 regional ridge/flow 之后先生成一个 `riverCoreSupportTarget`，用横向局部极大、沿向连续、曲率/表活剂/膜厚谷共同定义窄 core 候选；再用局部面积约束或 tile-level 近似质量约束把 core 占比限制在目标 15-25%，宽片只进入 sheetReject，不直接乘法杀 core。随后 `RIVER_PHASE_FRAGMENT_SHADER` 只负责 advect/reaction-diffusion 追随这个 support，`RIVER_MENISCUS_FRAGMENT_SHADER` 只把 core 边界质量沉积到 g/b，不再同时决定 core 生死。验证顺序仍是 `solid -> thickness -> phase -> velocity -> foam -> riverPhase -> riverFlux -> beauty`；下一轮成功标准先看 `riverPhase.r` 是否变成连通窄分叉核心，再看 `riverFlux` 是否出现窄排液和两侧沉积，最后才评估 beauty。

## Run 804-863 / heartbeat 继续：独立 `riverCoreSupport` 诊断 pass，耦合失败后保留为诊断通道
相似点：本轮按自动化要求先重读 `soap-film-physics-handoff.md`、`soap-film-target.md`、`soap-film-iterations.md`，并强制把上一轮最新 `run-803-beauty-rivercore-restore-high.png`、`run-798-thickness-rivercore-restore-high.png`、`run-799-riverPhase-rivercore-restore-high.png`、`run-800-riverFlux-rivercore-restore-high.png`、`run-802-foam-rivercore-restore-high.png` 与 `soap-film-reference.jpg` 对照。上一轮结果只有“仍有橙/青/紫物理响应”这一点勉强相关；参考图需要 60-75% 橙金厚膜、15-25% 青绿分叉河道、贴河道的紫蓝窄边和高密度奶金/白色微滴，而 `run-803` 仍是暗橙完整小球、下半球宽相带和连续白泡沫块。本轮所有验证都先从 `solid` 开始：`run-804/819/834/849` 均确认红色壳层稳定可见；最终保留态 `run-849` 到 `run-863` 的 `thickness/phase/velocity/foam/riverCore/riverPhase/riverFlux/beauty` 均返回 `ready=true`、`glassVisible=true`，浏览器日志无 WebGL/shader 报错。

偏差：本轮尝试新增独立 `RIVER_CORE_SUPPORT_FRAGMENT_SHADER` 和 `riverCoreSupportTarget`。第一版直接耦合到 `RIVER_PHASE_FRAGMENT_SHADER` 后，`run-813-riverCore-rivercore-support-high.png` 证明支撑场过宽，几乎把整片膜当作 core，导致 `run-814-riverPhase-rivercore-support-high.png` 变成大面积粉紫片，`run-818-beauty-rivercore-support-high.png` 比上一轮更差。第二版收紧横向局部极大和宽片拒绝后，`run-828-riverCore-rivercore-support-tight-high.png` 只剩零散斑点，`run-829/830` 的 `riverPhase/riverFlux` 被压暗，`run-833-beauty-rivercore-support-tight-high.png` 变成暗橙球和中心脏斑。第三版改成温和引导后，`run-848-beauty-rivercore-support-guided-high.png` 仍没有青绿分叉河道，厚膜/泡沫也不自洽。结论：这个支撑场作为诊断有价值，但当前耦合方式会要么铺满 core、要么杀死 core，不能留在 active 物理更新里。

已做改动：`thinFilmSim.js` 保留 `RIVER_CORE_SUPPORT_FRAGMENT_SHADER`、`riverCoreSupportTarget`、`riverCoreSupportMaterial`、resize/reset/dispose/update 管线和 `riverCoreSupportTexture` getter；`logoScene.js` 新增 `uFilmRiverCoreMap`、`riverCoreAt()` 和 `filmDebugView=riverCore`，`controlSchema.js` 新增“河道核心支撑”选项。最终 active 版本没有让 `riverCoreSupport` 直接驱动 `riverPhase`，避免把仓库停在更差状态；`run-863-beauty-rivercore-diagnostic-high.png` 因而回到接近 `run-803` 的基线，而不是保留 `run-818/833/848` 的破坏性结果。全程没有用贴图、参考图采样、预烘焙纹理、canvas 图案、样式拟合，也没有改构图或调 beauty 颜色遮丑。

下一步：不要把 `riverCoreSupport` 直接作为 per-pixel target 混进 `riverPhase`。下一轮应先把 `riverCoreSupport` 做成真正守恒/归一化的两阶段物理约束：第一阶段只输出候选强度和宽片拒绝，第二阶段做 tile 或多尺度局部面积约束，让 core 占比稳定在 15-25%，并把多余质量写入 sheet/reject，而不是在 `riverPhase` 子迭代里反复杀 core。验证时先看 `riverCore` 是否形成连通窄分叉而非满屏或斑点，再看 `riverPhase.r` 是否追随它、`riverFlux` 是否沿两侧沉积、`thickness` 是否长出橙金厚膜岛；在这些成立之前，不再评价 beauty 成功。

## Run 864-908 / heartbeat 继续：`riverCoreBalance` 两阶段归一化诊断仍未生成核心骨架
相似点：本轮按自动化要求先重读 `soap-film-physics-handoff.md`、`soap-film-target.md`、`soap-film-iterations.md`，并把上一轮最新 `run-863-beauty-rivercore-diagnostic-high.png`、`run-857-thickness-rivercore-diagnostic-high.png`、`run-858-riverCore-rivercore-diagnostic-high.png`、`run-859-riverPhase-rivercore-diagnostic-high.png`、`run-860-riverFlux-rivercore-diagnostic-high.png`、`run-862-foam-rivercore-diagnostic-high.png` 与 `soap-film-reference.jpg` 对照。上一轮结果只有暗橙/青绿/紫边这类弱物理响应；参考图要求 60-75% 橙金厚膜、15-25% 青绿分叉河道、贴河道的紫蓝窄边和密集奶金/白色微滴，而 `run-863` 仍是完整暗球、下半球宽灰绿带和连续泡沫块。本轮三次验证都从 `solid` 开始，`run-864`、`run-879`、`run-894` 均确认红色壳层稳定可见；所有低参 `thickness/phase/velocity/foam/riverCore/riverPhase/riverFlux` 与高参截图均返回 `ready=true`、`glassVisible=true`，浏览器日志没有 WebGL 或 shader 报错。实现仍只使用实时 GPU render target 和程序扰动，没有贴图、参考图采样、预烘焙纹理、canvas 图案、样式拟合或构图修改。

偏差：本轮仍然失败。第一版 `run-873-riverCore-rivercore-balance-high.png` 证明多尺度面积约束没有把候选变成青色连通 core，而是把多数区域压成暗 sheet 与少量 edge；`run-872-thickness`、`run-874-riverPhase`、`run-875-riverFlux`、`run-877-foam` 和 `run-878-beauty` 仍沿下半球宽片走。第二版加入 core balance 自历史 ping-pong 后，`run-888-riverCore-rivercore-balance-relax-high.png` 仍没有形成 15-25% 的连通窄分叉，`run-893-beauty` 与参考图的橙金厚膜占比、青绿分叉河道、紫蓝窄边、微滴密度都严重不符。第三版放宽第一阶段 raw 候选后，`run-903-riverCore-rivercore-candidate-balance-high.png` 的可见信号增加，但主要是橙色 edge/sheet，真正 `r=core` 仍不足；`run-904/905/907/908` 继续显示 `riverPhase/riverFlux/foam/beauty` 被宽片主导。物理自洽性结论：局部 `physicalScore + lateralPeak + smoothstep areaGain` 无法完成 tile 级核心质量选择；它只是在 edge/sheet 间移动信号，没有建立可守恒排液的 core skeleton。

已做改动：`thinFilmSim.js` 新增 `RIVER_CORE_BALANCE_FRAGMENT_SHADER`，在 `riverCoreSupportTarget` 后增加第二阶段 `riverCoreBalanceTarget`，用多尺度邻域估计 `localCoreMean/localEdgeMean/localSheetMean`、横向 crest、沿向 continuity、目标面积 `targetArea` 与 overfill/underfill，把候选分成 `r=core`、`g=edge`、`b=sheet/reject`、`a=areaError`；随后改为 ping-pong 的 `riverCoreBalanceTarget/riverCoreBalanceWriteTarget`，让 balance pass 读取上一轮 core 历史进行守恒松弛；最后在第一阶段新增 `rawDrainageCandidate`，把连续排液候选先保留下来，再交给第二阶段约束。`riverCoreSupportTexture` getter 现在返回 balance 后的目标，供 `riverCore` debug 视图读取；`riverPhase` 仍未直接消费这个 support，因此没有把失败的诊断结果硬塞进 active 相场。

下一步：不要再在同一个局部 shader 里继续调 `smoothstep` 阈值。应新增真正的区域级 core 质量选择：先用一个低分辨率 `riverCoreMassTarget` 或 tile pass 统计/平滑 raw candidate 的局部均值和容量，再让高分辨率 core pass 依据区域容量、横向 ridge 排名和沿向连通性投影到目标 15-25% 占比；宽片质量写入 sheet/reject，不能再靠局部乘法杀 core。验证标准仍然是先 `solid`，再看 `riverCore.r` 是否出现青色连通窄分叉；只有它成立后，才把 `riverPhase` 改成追随该 core，并继续检查 `riverFlux` 两侧沉积、`thickness` 橙金厚膜岛和 `foam` 微滴化。

## Run 909-972 / heartbeat 继续：`riverCoreMass` tile 投影暴露宽块根因，骨架门控仍未连通
相似点：本轮按自动化要求先重读 `soap-film-physics-handoff.md`、`soap-film-target.md`、`soap-film-iterations.md`，并把上一轮最新 `run-908-beauty-rivercore-candidate-balance-high.png`、`run-902-thickness-rivercore-candidate-balance-high.png`、`run-903-riverCore-rivercore-candidate-balance-high.png`、`run-904-riverPhase-rivercore-candidate-balance-high.png`、`run-905-riverFlux-rivercore-candidate-balance-high.png`、`run-907-foam-rivercore-candidate-balance-high.png` 与 `soap-film-reference.jpg` 对照。上一轮与参考图唯一接近处只是仍有暗橙、青绿、紫边、白泡沫这些物理响应类别；参考图要求橙金厚膜占主体、青绿为分叉窄河道、紫蓝只贴河道窄边、奶金/白色微滴沿相界和厚膜内部高密度分布。修改后，`run-909`、`run-924`、`run-939`、`run-956` 都重新验证了 `solid`，红色壳层稳定可见；`thickness/phase/velocity/foam/riverCoreMass/riverCore/riverPhase/riverFlux/beauty` 全部截图均返回 `ready=true`、`glassVisible=true`，浏览器日志没有 WebGL 或 shader 报错。实现仍只使用实时 GPU render target、局部速度、膜厚、表活剂、相场和程序扰动，没有贴图、参考图采样、canvas 图案、预烘焙纹理、样式拟合或构图修改。

偏差：本轮仍然失败。第一步加入低分辨率 `riverCoreMassTarget` 后，`run-918-riverCore-rivercore-tile-mass-high.png` 仍主要是橙色 edge/sheet，`run-923-beauty-rivercore-tile-mass-high.png` 仍是暗球加下半球宽带。随后对 balance 通道做 core/edge/sheet 分离，`run-933-riverCore-rivercore-tile-separate-high.png` 有更多可见结构，但仍是下半球颗粒/宽片，没有青色连通 core，`run-938-beauty-rivercore-tile-separate-high.png` 只是变成暗黄球和水平片状带。新增 `riverCoreMass` debug 后，`run-949-riverCoreMass-rivercore-mass-view-high.png` 直接确认 tile 投影本身已经宽块化：下半球是一整片粉紫/青绿容量和 ridge 信号，不是参考图所需的 15-25% 分叉骨架。最后把 mass pass 改成横向局部极大、沿向连续、宽片拒绝的骨架门控后，`run-966-riverCoreMass-rivercore-mass-skeleton-high.png` 从宽块变成竖向斑点/短段，说明宽片被压住了，但缺少沿向连接和分叉连通；`run-967-riverCore` 仍是橙色颗粒片，`run-968/970/971` 的 `riverPhase/phase/foam` 仍绑定下半球宽毯，`run-972-beauty` 与参考图的橙金厚膜占比、青绿分叉河道、紫蓝窄边和微滴密度仍严重不符。

已做改动：`thinFilmSim.js` 新增 `RIVER_CORE_MASS_FRAGMENT_SHADER`、`riverCoreMassTarget`、`riverCoreMassMaterial`、resize/reset/dispose 管线和每步渲染，使 balance pass 能读取低分辨率区域候选、容量、ridge 排名和 sheetReject。`RIVER_CORE_BALANCE_FRAGMENT_SHADER` 新增 `uRiverCoreMass`，先尝试用区域容量和历史 ping-pong 把 high-res core 投影到目标占比；随后又把 core/edge/sheet 输出分离，避免 edge/sheet 直接吞掉 core。`logoScene.js` 与 `controlSchema.js` 新增 `filmDebugView=riverCoreMass`，并把该低分辨率质量投影作为独立诊断视图暴露出来。第二轮物理修改把 mass pass 的 `projectedCandidate/capacity/ridgeRank/sheetReject` 从横向平均改为基于 `lateralCrest + alongContinuity + transversePeak - wideSheet` 的骨架候选，避免把整片宽相场直接计入 core 容量。

下一步：不要继续靠单次横向阈值或 tile 平均调 `smoothstep`，这已经在 `run-949` 和 `run-966` 分别证明会在“宽块”和“斑点”之间摆动。下一轮应新增一个真正的 core 传输/连通 pass：把 `riverCoreMass.r` 当作候选源，但用沿局部流向的各向异性扩散或 hysteresis ping-pong 把短段连接成连续分叉中心线，同时跨流向加入抑制项，宽片只进入 sheetReject；tile 容量只能作为总量限制，不能再作为直接铺开的颜色场。验证标准仍然先看 `solid`，再看 `riverCoreMass` 是否由斑点变成连通分叉候选，`riverCore.r` 是否出现青色窄骨架；只有这个成立后，才把 `RIVER_PHASE_FRAGMENT_SHADER` 真正追随该 core，并继续检查 `riverFlux` 两侧沉积、`thickness` 橙金厚膜岛和 `foam` 微滴化。

## Run 973-1006 / heartbeat 继续：低分辨率 core 传输 pass 只生成短柱/盖帽，仍未形成分叉骨架
相似点：本轮继续严格按自动化要求先重读 handoff、target、iterations，并把上一轮最新 `run-972-beauty-rivercore-mass-skeleton-high.png`、`run-965-thickness-rivercore-mass-skeleton-high.png`、`run-966-riverCoreMass-rivercore-mass-skeleton-high.png`、`run-967-riverCore-rivercore-mass-skeleton-high.png`、`run-968-riverPhase-rivercore-mass-skeleton-high.png`、`run-971-foam-rivercore-mass-skeleton-high.png` 与 `soap-film-reference.jpg` 对照。上一轮确认 solid 可见但物理场失败：`riverCoreMass` 是竖向短段，`riverCore` 是橙色颗粒片，`riverPhase/foam` 仍被下半球宽毯主导。修改后，`run-973` 与 `run-990` 均重新验证 `solid`，红色壳层稳定可见；`thickness/phase/velocity/foam/riverCoreMass/riverCore/riverPhase/riverFlux/beauty` 两轮截图都返回 `ready=true`、`glassVisible=true`，浏览器日志没有 WebGL 或 shader 报错。实现仍只读取实时 GPU 物理场、区域流向、膜厚/相场/泡沫状态和程序扰动，没有贴图、参考图采样、canvas 图案、预烘焙纹理、样式拟合或构图修改。

偏差：本轮仍然失败。第一版新增 `RIVER_CORE_TRANSPORT_FRAGMENT_SHADER` 后，`run-983-riverCoreMass-rivercore-transport-high.png` 相比 `run-966` 确实把部分斑点拉成更亮的短竖段，说明沿局部流向的 hysteresis/桥接进入了低分辨率 core 诊断；但这些结构仍是断续短柱，不是参考图中弯曲、分叉、宽窄变化的青绿河道。`run-984-riverCore` 继续显示橙色颗粒片，`run-985/987/988` 的 `riverPhase/phase/foam` 仍是下半球宽毯，`run-989-beauty` 与参考图几乎没有实质接近。第二版加入弱分叉方向桥接并提高桥接容量门控后，`run-1000-riverCoreMass-rivercore-transport-branch-high.png` 过度连接出顶部青色盖帽，同时下半球仍是竖向短柱和点列；这不是物理上自洽的河道骨架，而是桥接项沿区域流向把候选拖成柱状。`run-1001-riverCore` 仍未产生青色 core，`run-999-thickness` 没有亮橙金厚膜岛，`run-1002/1004/1005` 仍是宽相场/连续泡沫，`run-1006-beauty` 仍是暗完整球和水平宽带，橙金厚膜占比、青绿分叉、紫蓝窄边、奶金微滴密度都不符合参考图。

已做改动：`thinFilmSim.js` 新增 `RIVER_CORE_TRANSPORT_FRAGMENT_SHADER`、`riverCoreTransportReadTarget/riverCoreTransportWriteTarget`、`riverCoreTransportMaterial`、ping-pong 交换、resize/reset/dispose/assignTextures 管线，并让 `RIVER_CORE_BALANCE_FRAGMENT_SHADER` 读取 transport 后的低分辨率 core mass，而不是直接读取 raw `riverCoreMassTarget`。第一版 transport 使用 `riverCoreMass`、历史 transport 和 `regionalFlow` 的局部 tangent，沿向采样 `along1/2/4` 做 two-sided bridge、one-sided extension 和跨向 sideCrowd 抑制。第二版又加入局部分叉方向 `tangent +/- side * 0.42` 的桥接采样，希望连接短段。`riverCoreMassTexture` getter 现在返回 transport 后的诊断场，所以 `filmDebugView=riverCoreMass` 可直接观察连接结果。

下一步：不要继续简单加大 bridge 权重；`run-983` 到 `run-1000` 已证明它会在“断续短柱”和“顶部盖帽/竖柱”之间摆动。下一轮应把低分辨率 core 连接从扩散桥接改成更受约束的 geodesic/active-contour 更新：连接只允许发生在 `height valley + surfactant gradient + regional ridge + low sheetReject` 同时支持的路径上，并加入局部曲率/转角成本，禁止单纯沿固定流向拉直；同时需要暴露 raw mass 与 transport 两个 debug，避免连接 pass 把源场失败掩盖掉。验证仍先看 `solid`，再看 raw/transport core 是否由短柱变为连通弯曲分叉，`riverCore.r` 是否真正出现青色窄骨架；在此之前不把该 core 强耦合进 `riverPhase`，也不把 beauty 判成成功。

## Run 1007-1044 / heartbeat 继续：raw/transport 分离与 geodesic core 约束仍未形成连通骨架
相似点：本轮继续按自动化要求先重读 `soap-film-physics-handoff.md`、`soap-film-target.md`、`soap-film-iterations.md`，并把上一轮最新 `run-1006-beauty-rivercore-transport-branch-high.png`、`run-999-thickness-rivercore-transport-branch-high.png`、`run-1000-riverCoreMass-rivercore-transport-branch-high.png`、`run-1001-riverCore-rivercore-transport-branch-high.png`、`run-1002-riverPhase-rivercore-transport-branch-high.png`、`run-1005-foam-rivercore-transport-branch-high.png` 与 `soap-film-reference.jpg` 强制对照。上一轮与参考图的差距仍非常大：参考图需要 60-75% 橙金厚膜、15-25% 弯曲分叉青绿河道、只贴河道的紫蓝窄边和高密度奶金/白色微滴；`run-1006` 仍是暗完整球、水平宽带和连续泡沫块。修改后，`run-1007` 与 `run-1026` 都重新验证 `solid`，红色壳层稳定可见；`thickness/phase/velocity/foam/riverCoreRawMass/riverCoreMass/riverCore/riverPhase/riverFlux/beauty` 两组截图均返回 `ready=true`、`glassVisible=true`，浏览器日志为空。实现仍只读取实时 GPU 物理场、膜厚、表活剂、相场、泡沫、区域 ridge/flow 和程序扰动，没有使用贴图、参考图采样、canvas 图案、预烘焙纹理、样式拟合或构图修改。

偏差：本轮仍然失败。第一版 geodesic gate 后，`run-1018-riverCoreRawMass-rivercore-geodesic-high.png` 把源场与传输场成功分开，证明 raw 候选本身主要是下半球点云/短段；`run-1019-riverCoreMass-rivercore-geodesic-high.png` 压掉了上一轮 `run-1000` 的顶部青色假盖帽，这是正确方向，但也把 transport 连接压得过暗，未形成连通分叉骨架。第二版保留 raw source、只让 bridge/extension 受 geodesic 约束后，`run-1037` 到 `run-1038` 显示传输场保留了更多物理候选，但仍只是稀疏点云/短斑，不能生成参考图里的青绿分叉河道；`run-1039-riverCore` 仍是橙色 edge/sheet 颗粒片，没有 cyan core；`run-1036-thickness` 没有亮橙金厚膜岛；`run-1040/1042/1043` 仍是宽相场、宽泡沫和连续白块；`run-1044-beauty` 仍是暗完整球加水平灰绿宽带，橙金占比、青绿河道、紫蓝窄边、微滴密度和膜厚/相场/泡沫自洽性都不符合参考图。

已做改动：`thinFilmSim.js` 的 `RIVER_CORE_TRANSPORT_FRAGMENT_SHADER` 新增对实时 `uField` 的采样，用膜厚谷、表活剂梯度、相场梯度、泡沫惩罚、区域 ridge、低 sheetReject 与局部 tangent 转角成本构造 `geodesicGate`，并把 core transport 迭代从 5 降到 4，避免单纯沿流向扩散长出假盖帽。随后加入 `sourceGate`，使 raw mass 作为已经由物理场推导出的候选源被保留，而桥接/单侧扩展仍必须通过 geodesic 约束。`logoScene.js` 与 `controlSchema.js` 新增 `filmDebugView=riverCoreRawMass`，`riverCoreMass` 改为表示 transport 后结果；`thinFilmSim.js` 新增 `riverCoreRawMassTexture` getter，使 raw 与 transport 可以同时诊断，不再互相遮蔽。

下一步：不要继续微调 `geodesicGate/sourceGate/bridge` 的阈值；`run-1019` 和 `run-1038` 已经证明它只会在“过暗断点”和“稀疏点云”之间摆动。下一轮应先新增一个 `riverCoreGeodesic` 或 `riverPathEvidence` debug/pass，把 `height valley + surfactant gradient + phase edge + regional ridge + low sheetReject + curvature cost` 的路径代价直接可视化，确认成本场是否真的存在连续低成本通道；如果成本场本身仍断裂，就需要用持久化 active-contour / eikonal / heat-method 风格的低分辨率前沿传播，而不是扩散桥接：从 raw 候选种子出发沿低成本物理路径传播距离/占用，加入转角成本和面积上限，再把结果投影给 high-res balance。只有 `riverCoreMass` 和 `riverCore.r` 先形成连通窄分叉 core，才继续把它耦合进 `riverPhase`、`riverFlux`、`thickness` 和 `foam`。

## Run 1045-1067 / heartbeat 继续：路径证据场与 geodesic 前沿传播暴露成本场断裂
相似点：本轮再次按自动化要求先重读 `soap-film-physics-handoff.md`、`soap-film-target.md`、`soap-film-iterations.md`，并把上一轮最新 `run-1044-beauty-rivercore-geodesic-source-high.png`、`run-1036-thickness-rivercore-geodesic-source-high.png`、`run-1042-phase-rivercore-geodesic-source-high.png`、`run-1043-foam-rivercore-geodesic-source-high.png`、`run-1037-riverCoreRawMass-rivercore-geodesic-source-high.png`、`run-1038-riverCoreMass-rivercore-geodesic-source-high.png`、`run-1039-riverCore-rivercore-geodesic-source-high.png` 与 `soap-film-reference.jpg` 对照。上一轮确认：参考图需要橙金厚膜主体、青绿分叉河道、贴河道紫蓝窄边和高密度奶金/白色微滴；`run-1044` 仍是暗完整球、水平灰绿宽带、连续泡沫块和点云 core。修改后，本轮 `run-1045` 重新验证 `solid` 最小可见性，红色壳层稳定可见；`run-1046` 到 `run-1056` 低参依次验证 `thickness/phase/velocity/foam/riverCoreRawMass/riverPathEvidence/riverCoreGeodesic/riverCoreMass/riverCore/riverPhase/riverFlux`，高参 `run-1057` 到 `run-1067` 全部返回 `ready=true`、`glassVisible=true`，浏览器日志为空。实现仍只读取实时 GPU 物理场、膜厚、表活剂、相场、泡沫、区域流向和程序扰动，没有使用贴图、参考图采样、canvas 图案、预烘焙纹理、样式拟合或构图修改。

偏差：本轮仍然失败，但根因更明确。新增 `run-1059-riverPathEvidence-rivercore-path-evidence-high.png` 说明路径证据场本身不是连续低成本通道，而是下半球离散点云/短斑；这解释了为什么上一轮 geodesic gate 只能在“过暗断点”和“稀疏点云”之间摆动。新增持久化前沿传播后，`run-1060-riverCoreGeodesic-rivercore-path-evidence-high.png` 只把部分点云轻微扩张为短斑，没有形成弯曲、分叉、宽窄变化的青绿骨架。`run-1062-riverCore` 仍是橙色 edge/sheet 颗粒片，不是 cyan core；`run-1057-thickness` 没有生成大面积橙金厚膜岛；`run-1065/1066` 的 phase/foam 仍是宽毯和连续白块；`run-1067-beauty` 与参考图在橙金厚膜占比、青绿分叉河道、紫蓝窄边、奶金/白色微滴密度和膜厚/相场/泡沫自洽性上仍严重不符。也就是说，当前不是传播迭代数不够，而是路径代价场没有连续的物理通路。

已做改动：`thinFilmSim.js` 新增 `RIVER_PATH_EVIDENCE_FRAGMENT_SHADER`、`riverPathEvidenceTarget`、`riverPathEvidenceMaterial` 和 `riverPathEvidenceTexture` getter，用实时膜厚谷、沿向/横向谷、表活剂梯度、相场梯度、泡沫惩罚、区域 ridge、sheetReject 与局部转角成本输出 `r=pathOpen`、`g=seedSupport`、`b=curvatureGate`、`a=sheetReject`。同时新增 `RIVER_CORE_GEODESIC_FRAGMENT_SHADER`、`riverCoreGeodesicRead/WriteTarget`、`riverCoreGeodesicMaterial` 和 `riverCoreGeodesicTexture` getter，用 raw mass 种子和路径证据做 8 次低分辨率持久化前沿传播；`riverCoreBalance` 现在读取 geodesic 前沿结果而不是直接读取 transport。`logoScene.js` 与 `controlSchema.js` 新增 `filmDebugView=riverPathEvidence` 和 `filmDebugView=riverCoreGeodesic`，用于把路径代价和传播前沿分开诊断。语法检查通过，所有截图验证通过。

下一步：不要继续增加 geodesic 迭代数，也不要继续调 display 阈值；`run-1059` 已证明路径证据源场本身断裂。下一轮应把 `riverPathEvidence` 从“局部证据混合”升级成真正的低分辨率路径代价求解：先对膜厚谷/表活剂梯度/相界/区域 ridge 做沿 tangent 的多尺度积分或 heat diffusion，得到连续的低成本 valley skeleton，再让 `riverCoreGeodesic` 从 raw seeds 沿这个 skeleton 传播；同时要把 `sheetReject` 只用于宽片抑制，不能把潜在连接路径直接切成点。验证标准仍先看 `solid`，然后看 `riverPathEvidence` 是否出现连续分叉通道，`riverCoreGeodesic` 是否沿通道连成窄骨架，之后才评估 `riverCore/riverPhase/riverFlux/thickness/foam/beauty`。

## Run 1068-1115 / heartbeat 继续：路径 heat diffusion 与软 reject 仍只放大点列，未形成连续 valley skeleton
相似点：本轮按自动化要求先重读 `soap-film-physics-handoff.md`、`soap-film-target.md`、`soap-film-iterations.md`，并把上一轮最新 `run-1067-beauty-rivercore-path-evidence-high.png`、`run-1057-thickness-rivercore-path-evidence-high.png`、`run-1059-riverPathEvidence-rivercore-path-evidence-high.png`、`run-1060-riverCoreGeodesic-rivercore-path-evidence-high.png`、`run-1065-phase-rivercore-path-evidence-high.png`、`run-1066-foam-rivercore-path-evidence-high.png` 与 `soap-film-reference.jpg` 对照。上一轮确认：参考图是 60-75% 橙金厚膜、15-25% 青绿弯曲分叉河道、只贴河道的紫蓝窄边和高密度奶金/白色微滴；`run-1067` 仍是暗完整球、下半部宽灰绿片、连续白块和断裂路径点云。修改后，`run-1068/1084/1100` 均重新验证 `solid`，红色壳层稳定可见；`thickness/phase/velocity/foam/riverPathEvidence/riverCoreGeodesic/riverCore/riverPhase/beauty` 三组截图均返回 `ready=true`、`glassVisible=true`，浏览器日志无 error/warning。实现仍只使用实时 GPU 物理场、膜厚、表活剂、相场、泡沫、区域流向和程序扰动，没有贴图、参考图采样、canvas 图案、预烘焙纹理、样式拟合或构图修改。

偏差：本轮仍失败。第一版 `run-1077-riverPathEvidence-riverpath-heat-high.png` 证明新增 heat pass 后，路径证据仍被红色 reject 和离散点列支配；`run-1078-riverCoreGeodesic-riverpath-heat-high.png` 只轻微扩张点云，没有生成连续弯曲骨架。第二版把 `sheetReject` 从硬门控降成宽片惩罚后，`run-1093/1094` 仍是白粉点列和竖短段，`run-1095-riverCore` 仍是橙色颗粒片，不是 cyan core。第三版把 raw `pathOpen` 从硬阈值改为连续物理代价后，`run-1109/1110` 仍没有出现参考图那种青绿分叉河道，说明当前 `pathEvidence` 的物理支撑源仍偏“seed 点/短柱”，heat diffusion 只是放大这些源，而不是求出了真正连续低成本 valley skeleton。`run-1115-beauty-riverpath-continuous-cost-high.png` 仍是暗球、下半宽灰绿/奶白片和低密度边缘色，橙金厚膜占比、青绿分叉河道、紫蓝窄边、奶金/白色微滴密度都严重不符合参考图；`thickness/phase/foam` 也仍互相自洽地指向错误的宽片排液结构，而不是河道边界微滴结构。

已做改动：`thinFilmSim.js` 新增 `RIVER_PATH_HEAT_FRAGMENT_SHADER`、`riverPathHeatReadTarget/riverPathHeatWriteTarget`、`riverPathHeatMaterial`、ping-pong 交换、resize/reset/dispose/assignTextures 管线，并让 `riverCoreGeodesic` 和 `riverPathEvidenceTexture` 读取 heat 后的路径场。heat pass 从 raw path、上一帧 path heat、`riverCoreMass` 和 `regionalFlow` 读取实时物理状态，沿局部 tangent 做多尺度 along/branch/side 采样，输出 `r=skeleton`、`g=seed`、`b=curvature/continuity`、`a=softReject`。随后两次修正：先降低 heat/geodesic 中的 `sheetReject` 权重，避免宽片惩罚直接切断潜在连接；再把 raw `RIVER_PATH_EVIDENCE_FRAGMENT_SHADER` 的 `pathOpen` 从硬 `smoothstep` 阈值改为连续代价输出，并把 raw `sheetReject` 降为软惩罚。

下一步：不要继续提高 heat/geodesic 迭代数，也不要继续降显示阈值；`run-1109` 已证明当前 heat diffusion 只是在点列源上扩散。下一轮应先把 raw 与 evolved path 分开暴露为两个 debug view，确认连续代价在进入 heat 前是否已经存在；然后把路径求解从“局部证据 + 扩散”改成显式低分辨率 active-contour/eikonal/heat-method 两阶段：第一阶段计算真正的低成本标量 `cost = height valley + surfactant ridge + phase edge + regional ridge - sheet width penalty`，第二阶段从 raw seeds 通过最小 cost 前沿传播并用曲率/转角成本限制，而不是直接把 seedSupport 作为 openPath。只有 `riverPathEvidence` 先形成连续分叉 valley，再继续评估 `riverCoreGeodesic/riverCore/riverPhase/thickness/foam/beauty`。

## Run 1116-1201 / heartbeat 继续：raw/evolved path 分离完成，但路径场仍是点列；低代价试验已回退
相似点：本轮开始前按自动化要求重读了 handoff、target、iterations，并强制把上一轮最新 `run-1115-beauty-riverpath-continuous-cost-high.png`、`run-1108-thickness-riverpath-continuous-cost-high.png`、`run-1109-riverPathEvidence-riverpath-continuous-cost-high.png`、`run-1110-riverCoreGeodesic-riverpath-continuous-cost-high.png`、`run-1113-phase-riverpath-continuous-cost-high.png`、`run-1114-foam-riverpath-continuous-cost-high.png` 与 `soap-film-reference.jpg` 对照。修改后 `run-1116`、`run-1134`、`run-1151`、`run-1168`、`run-1185` 都重新验证了 `solid` 最小可见性；所有 `thickness/phase/velocity/foam/riverPathRawEvidence/riverPathEvidence/riverCoreGeodesic/riverCore/beauty` 截图均返回 `ready=true`、`glassVisible=true`，最终回退验证 `run-1185` 到 `run-1201` 浏览器日志为 0。实现仍只使用实时 GPU render target、膜厚、表活剂、相场、泡沫、速度/区域流向和程序扰动，没有贴图、参考图采样、canvas 图案、预烘焙纹理、样式拟合或构图修改。

偏差：本轮仍失败。参考图需要 60-75% 橙金厚膜、15-25% 青绿弯曲分叉河道、贴河道的紫蓝窄边以及沿河道/厚膜边界高密度奶金/白色微滴；最终 `run-1201-beauty-path-reverted-high.png` 仍是暗完整球、下半部灰白宽片和弱橙绿干涉，青绿没有形成贯穿分叉河道，紫蓝边界不成立，微滴集中成下半部点列而不是贴河道边缘。`run-1195/1196` 证明 raw/evolved path 分开后仍主要是下半部点列和短段；`run-1197` geodesic 只是放大这些点列；`run-1198` core 仍是橙色颗粒片，不是青色窄骨架。中途 `run-1144` 到 `run-1184` 的低代价标量试验还暴露了一个具体失败：我把 path shader 收得过暗，并一度留下未定义 `lowCost` 的 GLSL 输出路径，导致 raw path 近黑；该实验已经回退，最终代码停在已验证的 raw/evolved 分离版本。

已做改动：`logoScene.js` 与 `controlSchema.js` 增加 `filmDebugView=riverPathRawEvidence`，并在壳层 shader 中新增 `uFilmRiverPathRawEvidenceMap`，使 raw path 与 heat/evolved path 可同时诊断；`thinFilmSim.js` 新增 `riverPathRawEvidenceTexture` getter，保留 `riverPathEvidenceTexture` 指向 heat 后路径。`RIVER_PATH_EVIDENCE_FRAGMENT_SHADER`、`RIVER_PATH_HEAT_FRAGMENT_SHADER`、`RIVER_CORE_GEODESIC_FRAGMENT_SHADER` 维持上一轮较稳定的软 reject/连续代价版本；本轮尝试过把 raw path 改成更强的膜厚谷/表活剂/相界多尺度低代价场，但截图证明它没有生成有效通道，且引入了黑 path 回归，因此已回退。

下一步：不要再在当前 shader 里继续盲目调权重。下一轮应先加数值诊断：把 raw path 的 `lowCost/seed/sheetReject/curvature` 或最小/最大/均值以独立 debug 或 CPU readback 暴露出来，确认是物理场源本身无连续通路、还是显示/阈值/坐标映射问题。随后实现真正的低分辨率 Eikonal/fast-marching/heat-method 距离场：先输出标量 cost，再从物理 seed 做最小代价前沿传播，传播结果必须在 `riverPathRawEvidence` 和 `riverPathEvidence` 中先形成连续弯曲分叉骨架；这个成立前不要继续改 beauty 映射或构图。

## Run 1202-1239 / heartbeat 继续：路径代价分量诊断与独立多尺度 cost 初步接入
相似点：本轮开始时按自动化要求重读了 `soap-film-physics-handoff.md`、`soap-film-target.md`、`soap-film-iterations.md`，并强制把上一轮最新 `run-1201-beauty-path-reverted-high.png`、`run-1194-thickness-path-reverted-high.png`、`run-1195-riverPathRawEvidence-path-reverted-high.png`、`run-1196-riverPathEvidence-path-reverted-high.png`、`run-1197-riverCoreGeodesic-path-reverted-high.png`、`run-1199-phase-path-reverted-high.png`、`run-1200-foam-path-reverted-high.png` 与 `soap-film-reference.jpg` 对照。修改后 `run-1202` 与 `run-1221` 都重新验证 `solid`，红色壳层稳定可见；`thickness/phase/velocity/foam/riverPathCost/riverPathRawEvidence/riverPathEvidence/riverCoreGeodesic/riverCore/beauty` 两组截图全部返回 `ready=true`、`glassVisible=true`，浏览器 error/warn 日志为 0。实现仍只使用实时 GPU 物理场、膜厚、表活剂、相场、泡沫、区域流向和程序扰动，没有贴图、参考图采样、canvas 图案、预烘焙纹理、样式拟合或构图修改。

偏差：本轮仍未达到目标。第一阶段新增 `run-1213-riverPathCost-path-cost-components-high.png` 后确认，旧 path cost 分量本身仍是下半球点列，说明不是显示阈值把连续通路藏起来，而是成本源场仍被 seed/core 点列支配。第二阶段把 `riverPathCost` 改为独立多尺度物理标量后，`run-1232-riverPathCost-independent-path-cost-high.png` 已经出现更多由膜厚谷、表活剂梯度、相界和区域流向推导出的连续青色低成本环/槽，这是比 `run-1213` 更正确的诊断方向；但 `run-1234-riverPathEvidence-independent-path-cost-high.png` 和 `run-1235-riverCoreGeodesic-independent-path-cost-high.png` 仍主要停在暗场加 seed 点，前沿传播没有把 cost 网络转成窄的连通分叉骨架。`run-1239-beauty-independent-path-cost-high.png` 仍是完整暗球、单块橙黄厚膜和左下灰绿宽片：橙金厚膜占比不足且不成岛状网络，青绿河道没有贯穿分叉，紫蓝窄边不贴河道，奶金/白色微滴仍集中成点列/宽片，不是参考图中的河道边界微滴。

已做改动：`thinFilmSim.js` 新增 `riverPathCostTarget`、`riverPathCostMaterial`、`riverPathCostTexture` getter、resize/reset/dispose/assignTextures/step 管线；`logoScene.js` 与 `controlSchema.js` 新增 `filmDebugView=riverPathCost`，在壳层 shader 中以 `r=lowCost`、`g=seed`、`b=ridge/curvature`、`a=sheetReject` 显示路径代价分量。第一版诊断 shader 复用已验证的 path evidence 计算以避免未定义 GLSL 变量；第二版改成独立的多尺度物理 cost：沿局部 tangent/side/branch 采样膜厚谷，叠加表活剂梯度、相界、毛细曲率和区域流向，并把宽片/泡沫/厚膜作为软 reject。`RIVER_PATH_HEAT_FRAGMENT_SHADER` 新增 `uPathCost`，传播时把独立 cost 作为 travel surface 参与 lowCost、frontSource、curvature 与 reject。

下一步：不要把这一步误判成视觉成功。`run-1232` 说明连续物理 cost 开始出现，但 `run-1234/1235` 说明当前 heat/geodesic 仍没有做真正的最小代价前沿，只是在 seed 点附近保守扩散。下一轮应把 `riverPathHeat` 改成显式距离/占用传播：在低分辨率 ping-pong 中保存 `distance/occupancy/seed/turnCost`，用 `newDistance = min(neighborDistance + cost + curvaturePenalty)` 类似 Eikonal/fast-marching 的更新，而不是把 cost 当亮度扩散；同时需要加入面积上限和局部宽度约束，目标先让 `riverPathEvidence` 与 `riverCoreGeodesic` 形成连续窄分叉骨架，再把它耦合回 `riverCore/riverPhase/thickness/foam/beauty`。

## Run 1240-1258 / heartbeat 继续：Eikonal-like 占用传播仍失败，distance 没有被真正保存
相似点：本轮开始前再次重读 `soap-film-physics-handoff.md`、`soap-film-target.md`、`soap-film-iterations.md`，并把上一轮最新 `run-1239-beauty-independent-path-cost-high.png`、`run-1231-thickness-independent-path-cost-high.png`、`run-1232-riverPathCost-independent-path-cost-high.png`、`run-1234-riverPathEvidence-independent-path-cost-high.png`、`run-1235-riverCoreGeodesic-independent-path-cost-high.png`、`run-1237-phase-independent-path-cost-high.png`、`run-1238-foam-independent-path-cost-high.png` 与 `soap-film-reference.jpg` 强制对照。修改后 `run-1240` 重新验证 `solid`，红色壳层稳定可见；`run-1241` 到 `run-1244` 依次验证 `thickness/phase/velocity/foam` 可见；高参 `run-1250` 到 `run-1258` 全部返回 `ready=true`、`glassVisible=true`，浏览器日志为 0。实现仍只使用实时 GPU 物理场、膜厚、表活剂、相场、泡沫、区域流向和程序扰动，没有贴图、参考图采样、canvas 图案、预烘焙纹理、样式拟合或构图修改。

偏差：本轮仍失败。参考图需要橙金厚膜占 60-75%、青绿弯曲分叉河道占 15-25%、紫蓝窄边只贴河道、奶金/白色微滴沿河道边界和厚膜岛高密度聚集；`run-1258-beauty-eikonal-path-high.png` 仍是暗完整球、一块橙黄厚膜和左下灰绿宽片，缺少贯穿中部的青绿分叉河道和橙金岛网络。`run-1251-riverPathCost-eikonal-path-high.png` 仍能看到一些连续低代价环/槽，说明物理 cost 比早期点列更有信息；但 `run-1253-riverPathEvidence-eikonal-path-high.png` 和 `run-1254-riverCoreGeodesic-eikonal-path-high.png` 仍主要是下半部种子点、短柱和暗场，没有沿 cost 网络传播成窄骨架。`run-1250-thickness` 近似大面积暗蓝平板，`run-1256-phase` 是全局蓝绿蜂窝/宽片，`run-1257-foam` 是大块奶白雾片，三者仍自洽地指向错误的宽片排液结构，而不是参考图的河道边界微滴结构。

已做改动：`RIVER_PATH_HEAT_FRAGMENT_SHADER` 从亮度扩散改成了候选距离形式，沿 tangent、branch、side 多方向采样邻居，用 `candidateDistance = previousDistance + travelCost + turnPenalty` 求局部最小值，再从 `distanceGate` 计算 `occupancy`。这一步没有改 beauty 映射或构图，也没有引入任何禁用资源。

失败原因：当前 heat target 仍把 `r` 通道当作 occupancy 保存，下一步又用 `previousDistance = 1.0 - occupancy` 反推距离。远离种子的像素没有真实距离记忆，邻居距离很快退回 1 附近，`distanceGate` 被关掉，前沿传播只会停在种子点附近。也就是说这不是阈值太暗，而是数值状态语义错误。

下一步：把 `riverPathHeat` 的通道语义改成真正的 `r=distance`、`g=occupancy`、`b=seed/turnQuality`、`a=reject`，初始化/迭代时保存可累积的低代价距离；`riverPathEvidence` debug 和 `riverCoreGeodesic` 需要改读 `g` 作为可见前沿，而不是继续读 `r`。验证仍从 `solid` 开始，然后检查 `riverPathEvidence` 和 `riverCoreGeodesic` 是否从点列变成连续窄分叉骨架，成立前不改构图和 beauty 颜色。

## Run 1259-1273 / heartbeat 继续：distance 状态能传播，但被误读成宽片前沿
相似点：本轮先按计划把 `riverPathHeat` 改成 `r=distance`、`g=occupancy`、`b=seed/turnQuality`、`a=reject`，并让 `riverCoreGeodesic` 与 debug 读新语义。验证时 `run-1259` 的 `solid` 仍为稳定红色壳层；`run-1260` 到 `run-1265` 依次验证 `thickness/phase/velocity/foam/riverPathEvidence/riverCoreGeodesic` 可渲染；高参 `run-1266` 到 `run-1273` 全部 `ready=true`、`glassVisible=true`、`simSize=384`，浏览器 error/warn 日志为 0。实现仍只使用实时 GPU 物理场和程序扰动，没有贴图、参考图采样、canvas 图案、预烘焙纹理、样式拟合或构图修改。

偏差：本轮仍失败，但失败形态从“点列不传播”变成了“宽片过传播”。`run-1268-riverPathEvidence-distance-path-high.png` 和 `run-1269-riverCoreGeodesic-distance-path-high.png` 出现了下半球大面积粉白/青白横向宽带，说明 distance 状态已经能跨像素累积，但后级把低 distance 直接当可见 path，缺少 occupancy/turnQuality 门控和横向宽度限制。`run-1273-beauty-distance-path-high.png` 变成暗完整球加大块灰白横带，离参考图的橙金厚膜主体、15-25% 青绿弯曲分叉河道、紫蓝窄边和密集奶金微滴更远。`run-1266-thickness` 仍缺橙金厚膜岛网络，`run-1271-phase` 仍是整面蓝绿宽片，`run-1272-foam` 仍是大块奶白雾带，膜厚/相场/泡沫自洽地指向错误的宽片结构。

已做改动：`RIVER_PATH_HEAT_FRAGMENT_SHADER` 新增 `storedDistanceAt()`，用真实 distance 取代 `1 - occupancy` 反推；输出通道改为 `distance/occupancy/seed-or-quality/reject`。`RIVER_CORE_GEODESIC_FRAGMENT_SHADER` 和 `logoScene.js` 的 `riverPathEvidence` debug 已改成理解新通道语义。

失败原因：distance 本身只能表示可达性，不等于河道骨架；本轮的 `pathFrontFrom()` 和 debug 显示仍把低 distance 过强地转成 open path，导致整个低代价宽片被当成河道。heat pass 的 `supportGate` 也没有显式比较 along 支撑与 side 支撑，缺少对横向宽度和面积占比的惩罚。

下一步：不要改构图和 beauty 颜色。先把 `pathFrontFrom()` 改为主要读 `occupancy`，distance 只在 `seed/turnQuality` 支持下少量补充；同时在 `riverPathHeat` 里加入 `sideSupport` 宽度惩罚，让可见 occupancy 必须满足“沿 tangent 连续强、横向扩张弱”的骨架条件。验证标准仍是 `riverPathEvidence/riverCoreGeodesic` 先变成窄的弯曲分叉骨架，而不是横向白带。

## Run 1274-1288 / heartbeat 继续：宽片被压回，但又退化成点列/竖短段
相似点：本轮继续验证 `solid` 到 `foam` 的基础视图，`run-1274` 红色壳层稳定；`run-1275` 到 `run-1280` 低参调试图和 `run-1281` 到 `run-1288` 高参图全部 `ready=true`、`glassVisible=true`，浏览器 error/warn 日志为 0。窄化修正确实把 `run-1268/1269` 的大面积粉白横带压掉了，说明 distance 现在不再被无条件当作 open path 使用。

偏差：本轮仍失败，而且又回到了早期的点列问题。`run-1283-riverPathEvidence-narrow-distance-path-high.png` 和 `run-1284-riverCoreGeodesic-narrow-distance-path-high.png` 主要是下半球白/粉种子点、竖短柱和少量断裂斑，不是参考图中青绿河道那种连续、弯曲、分叉、宽窄变化的骨架。`run-1288-beauty-narrow-distance-path-high.png` 仍是暗完整球加灰白宽片，橙金厚膜不足，青绿河道没有贯穿，紫蓝窄边和奶金微滴都没有沿河道边界组织起来。

已做改动：`riverPathHeat` 新增 `sideSupport`，用横向支撑与横向 front 惩罚宽片；`pathFrontFrom()` 和 `logoScene.js` 的 path debug 改成主要读 `occupancy`，distance 只有在 `seed/turnQuality` 质量门控下才少量贡献。

失败原因：宽度约束有效，但当前可传播源仍主要来自 raw seed/core 点列；独立 `riverPathCost` 中已经存在的连续低代价槽没有被转成局部骨架 seed，所以传播只能围绕点列和短柱进行。

下一步：在 heat pass 内加入由真实物理 cost 推导的局部 ridge/vesselness seed：必须同时满足中心 lowCost 强、沿 tangent 支撑强、横向 sideSupport 弱、sheetReject 低。这样不是调色或贴图，而是把膜厚谷/表活剂梯度/相界/区域流向的连续低代价槽转成可传播的物理骨架源。验证仍先看 `riverPathEvidence/riverCoreGeodesic` 是否从点列变成连续窄分叉，再看 downstream。

## Run 1289-1303 / heartbeat 继续：cost-vesselness seed 未能把低代价槽转成连续河道
相似点：本轮继续完整验证，`run-1289` 的 `solid` 红壳稳定；`run-1290` 到 `run-1295` 低参 `thickness/phase/velocity/foam/riverPathEvidence/riverCoreGeodesic` 可见；`run-1296` 到 `run-1303` 高参全部 `ready=true`、`glassVisible=true`、浏览器 error/warn 日志为 0。新增的 seed 仍来自实时物理 cost：膜厚谷、表活剂梯度、相界、区域流向、横向宽度惩罚和 sheetReject，没有使用贴图、参考图采样、canvas 图案、预烘焙纹理、样式拟合或构图修改。

偏差：本轮仍失败。`run-1298-riverPathEvidence-vessel-seed-path-high.png` 和 `run-1299-riverCoreGeodesic-vessel-seed-path-high.png` 与 `run-1283/1284` 几乎同类，仍是下半球点列、竖短柱和断裂斑；没有形成参考图中青绿河道需要的连续弯曲分叉中心线。`run-1303-beauty-vessel-seed-path-high.png` 仍是暗完整球加灰白宽片，橙金厚膜占比不足、青绿河道不存在、紫蓝窄边没有贴河道、奶金/白色微滴仍成点列/片带。与参考图相比，当前最根本的失败仍是膜厚/相场/泡沫的组织结构错误，而不是颜色或构图问题。

已做改动：`RIVER_PATH_HEAT_FRAGMENT_SHADER` 中加入 `costRidge/directionalRidge/costSeed`，只有中心 lowCost 强、沿 tangent 支撑强、横向 sideSupport 弱、reject 低的区域才补充为可传播 seed；并继续保留 `distance/occupancy/seed-or-quality/reject` 通道语义。

失败原因：简单的局部 vesselness 仍不足以从当前 cost 图中抽出稳定中心线；`riverPathCost` 的连续低代价区域本身偏环槽和宽片，并非已经骨架化的 valley centerline，所以 heat/geodesic 只能在点列、竖段和宽片之间摆动。

下一步：下一轮不要再在 heat 里叠加局部 seed 权重。应新增独立的低分辨率 skeletonization/pass，把 `riverPathCost` 先转成中心线场：例如在 cost pass 里输出沿 tangent 的一阶/二阶响应、横向非极大值抑制、局部宽度估计和低成本脊线置信度，然后 heat 只沿这个中心线传播。也就是说先把“连续低代价宽槽”变成“窄中心线物理场”，再让 geodesic 连通；在这个成立前不要继续改 beauty 或构图。

## Run 1304-1321 / heartbeat 继续：新增 skeleton pass 后出现严重断供回归
相似点：本轮开始前按自动化要求重读了 `soap-film-physics-handoff.md`、`soap-film-target.md`、`soap-film-iterations.md`，并强制把上一轮最新 `run-1303-beauty-vessel-seed-path-high.png`、`run-1296-thickness-vessel-seed-path-high.png`、`run-1298-riverPathEvidence-vessel-seed-path-high.png`、`run-1299-riverCoreGeodesic-vessel-seed-path-high.png`、`run-1301-phase-vessel-seed-path-high.png`、`run-1302-foam-vessel-seed-path-high.png` 与 `soap-film-reference.jpg` 对照。上一轮仍然是暗完整球、下半部灰白宽片和点列/竖短段，未出现参考图要求的橙金厚膜岛、青绿分叉河道、紫蓝窄边和高密度奶金/白色微滴。本轮新增独立 `riverPathSkeleton` pass 后，`run-1304` 的 `solid` 最小可见性仍返回 `ready=true`、`glassVisible=true`；`thickness/phase/velocity/foam/riverPathCost/riverPathSkeleton/riverPathEvidence/riverCoreGeodesic/beauty` 截图也都完成，浏览器日志为空。实现仍只使用实时 GPU 物理场、膜厚、表活剂、相场、泡沫、区域流向和程序扰动，没有贴图、参考图采样、canvas 图案、预烘焙纹理、样式拟合或构图修改。

偏差：这是一次明确回归。`run-1321-beauty-path-skeleton-high.png`、`run-1313-thickness-path-skeleton-high.png`、`run-1319-phase-path-skeleton-high.png`、`run-1320-foam-path-skeleton-high.png` 全部接近黑场，只剩中心一点弱青蓝辉光；`run-1315-riverPathSkeleton-path-skeleton-high.png` 和 `run-1316-riverPathEvidence-path-skeleton-high.png` 也几乎没有可见骨架。也就是说，这不是颜色或构图问题，而是新增 skeleton 非极大值抑制过严，并且 `riverPathHeat` 过强依赖 skeleton 输出，导致 cost 场、前沿传播、膜厚、相场、泡沫和 beauty 被整体饿死。与参考图相比，橙金厚膜占比为零或近零，青绿分叉河道没有形成，紫蓝窄边和奶金/白色微滴也随物理场一起消失。

已做改动：`thinFilmSim.js` 新增 `RIVER_PATH_SKELETON_FRAGMENT_SHADER`、`riverPathSkeletonTarget`、`riverPathSkeletonMaterial`、`riverPathSkeletonTexture` getter，并把它插入在 `riverPathCost` 与 `riverPathHeat` 之间；`logoScene.js` 与 `controlSchema.js` 新增 `filmDebugView=riverPathSkeleton`。该 pass 试图用沿 tangent 连续性、横向非极大值抑制、branch 支撑和 sheetReject 把低代价宽槽转成中心线，但当前阈值和 heat 门控过严。

下一步：不要改构图，不要调 beauty 颜色。先修数值管线断供：放松 skeleton pass，让它输出一个来自物理 cost 的软中心线保底通道，同时保留 NMS 作为质量而不是硬开关；`riverPathHeat` 也必须允许 `riverPathCost` 以弱引导形式保底传播，不能在 skeleton 近零时把所有 path support 关掉。验证标准仍是先看 `solid`，再看 `riverPathCost` 是否仍有物理低代价结构、`riverPathSkeleton` 是否从黑场恢复为窄线/软中心线、`riverPathEvidence/riverCoreGeodesic` 是否不再断供，然后再评估 `thickness/phase/foam/beauty` 是否至少恢复到上一轮基线。

## Run 1322-1331 / heartbeat 继续：solid 最小可见性恢复，根因是 sampler 超上限
相似点：本轮没有改构图，先按要求回到最小可见性。`run-1322-debug-solid-sampler-limit-fix-low.png` 已恢复为红色壳层，`document.documentElement.dataset.soapFilmDebug` 显示 `ready=true`、`glassVisible=true`、`debugUniform=1`、`simSize=128`，framebuffer 中心像素为 `[255,20,10,255]`，浏览器 error/warn 日志为 0。随后 `run-1323` 到 `run-1326` 依次验证 `thickness/phase/velocity/foam`，全部可见；`run-1327-riverPathCost-sampler-limit-fix-low.png` 显示低代价结构仍存在；高参 `run-1331-beauty-sampler-limit-fix-high.png` 也恢复到可渲染状态。实现仍只使用实时 GPU render target 与程序物理场，没有使用贴图、参考图采样、canvas 图案、预烘焙纹理、样式拟合或构图修改。

偏差：虽然黑屏回归修好了，物理结果仍明显失败。`run-1331` 还是完整球加横向粉白/灰绿宽带，橙金厚膜不形成参考图那种 60-75% 岛状主结构；青绿河道没有贯穿分叉，紫蓝窄边没有沿河道收窄，奶金/白色微滴仍集中成宽带/片状。`run-1328-riverPathSkeleton-sampler-limit-fix-low.png`、`run-1329-riverPathEvidence-sampler-limit-fix-low.png`、`run-1330-riverCoreGeodesic-sampler-limit-fix-low.png` 说明 skeleton/evidence/core 仍主要集中在右侧碎片和短斑，没有把 `riverPathCost` 中较连续的低代价槽转成窄中心线。

已做改动：`logoScene.js` 移除了新增的独立 `uFilmRiverPathSkeletonMap` sampler。新增 skeleton debug 不再额外占用第 17 个 fragment sampler，而是在 `filmDebugView=riverPathSkeleton` 时临时把已有 `uFilmRiverPathEvidenceMap` 绑定到 `thinFilmSim.riverPathSkeletonTexture`。这样壳层 shader 的 sampler 数回到 16，避免 WebGL1 常见 fragment texture unit 上限导致整个物理壳层材质不出像素。同时 solid debug 分支提前到任何纹理采样之前，并让 debug 视图绕过 front-face discard，主渲染前显式恢复默认 framebuffer、viewport、scissor 与颜色写入状态。

失败原因：上一轮 `run-1304` 到 `run-1321` 的“全黑”首先不是物理场本身全灭，而是新增 sampler 让壳层 shader 超过 WebGL1 上限；修复 sampler 后，真实的物理偏差重新暴露出来：skeleton pass 仍把宽槽收得过碎，heat/geodesic 仍依赖碎片，不能形成连续河道。

下一步：继续按上一节计划，不改 beauty 和构图。放松 `riverPathSkeleton`：保留横向 NMS 作为质量项，但增加由真实 `riverPathCost` 推导的软中心线保底；同时放松 `riverPathHeat` 对 skeleton 的硬依赖，让 cost 以弱引导形式保底参与距离传播。目标不是调亮，而是让 `riverPathSkeleton -> riverPathEvidence -> riverCoreGeodesic` 从右侧碎片恢复成更连续的窄分叉物理场。

## Run 1332-1362 / heartbeat 继续：soft skeleton 恢复通道但退化成横向排液带里的竖柱点列
相似点：本轮继续从 `solid` 开始验证。`run-1332` 与 `run-1349` 的红色壳层稳定可见；`thickness/phase/velocity/foam` 基础视图在 `run-1333` 到 `run-1336`、`run-1350` 到 `run-1353` 中全部返回 `ready=true`、`glassVisible=true`，浏览器 error/warn 日志为 0。高参 `run-1348` 与 `run-1362` 也恢复可渲染，不再是 sampler 超限导致的黑屏。实现仍只使用实时 GPU 物理场、膜厚、表活剂、相场、泡沫、区域流向和程序扰动，没有贴图、参考图采样、canvas 图案、预烘焙纹理、样式拟合或构图修改。

偏差：结果仍严重失败。soft skeleton 后，`run-1343-riverPathSkeleton-soft-skeleton-high.png`、`run-1344-riverPathEvidence-soft-skeleton-high.png`、`run-1345-riverCoreGeodesic-soft-skeleton-high.png` 不再近黑，但主要变成横向宽排液带里的竖向点柱/短斑；cost-gradient tangent 后的 `run-1358` 到 `run-1360` 仍是同类点柱，没有形成参考图中连续、弯曲、分叉、宽窄变化的青绿河道。`run-1348` 与 `run-1362` beauty 仍是完整球加一条粉白/灰绿宽带，参考图需要的 60-75% 橙金厚膜岛、15-25% 青绿分叉河道、贴边紫蓝窄带、奶金/白色微滴密度都没有成立。`run-1361-foam-cost-gradient-tangent-high.png` 还显示泡沫仍是一整条白色宽带，不是沿河道边界的微滴。

已做改动：`RIVER_PATH_SKELETON_FRAGMENT_SHADER` 把 NMS 从硬开关改为质量项，新增由 `riverPathCost`、沿 tangent 连续性、横向宽度惩罚和 sheetReject 推导的 `softLine`，让中心线有物理 cost 保底。`RIVER_PATH_HEAT_FRAGMENT_SHADER` 放松了对 skeleton 的硬依赖，在 `pathSupportAt/candidateDistance/lowCost` 中允许 `riverPathCost` 以弱引导参与传播。随后在 skeleton 和 heat 的 `localTangentAt` 中加入 `riverPathCost` 梯度等值线方向，把区域流向与低代价谷方向混合，试图减少固定方向竖柱。

失败原因：当前 `riverPathCost` 的主能量仍是宏观水平排液带/宽槽，skeleton 只是把这个宽槽离散成竖向柱状碎片。也就是说，问题不是 tangent 方向单独错误，而是 path cost 没有把“长波重力排液片/宽带”和“短波 Marangoni-毛细不稳定河道中心线”分离。直接对 raw cost 做 NMS 或 cost-gradient tangent，只会在宽带中制造点列。

下一步：不要继续调 skeleton 阈值。下一轮应重写 `riverPathCost` 的物理分解：先用低频膜厚/泡沫/相场估计宏观 drainage sheet/reservoir，再从膜厚残差、表活剂梯度残差、曲率二阶响应和相界剪切中提取高频 filament/channel potential；skeleton 只读这个高频 channel potential，宏观 sheet 只作为 reservoir/供液项。验证目标是 `riverPathCost` 先出现连续弯曲分叉的窄通道，而不是横向宽带；然后再让 skeleton/heat/geodesic 传播。

## Run 1363-1415 / heartbeat 继续：高频 cost 与相场质量约束仍未打破宽排液片
相似点：本轮开始前按自动化要求重读 `soap-film-physics-handoff.md`、`soap-film-target.md`、`soap-film-iterations.md`，并把上一轮最新 `run-1362-beauty-cost-gradient-tangent-high.png`、`run-1358-riverPathSkeleton-cost-gradient-tangent-high.png`、`run-1361-foam-cost-gradient-tangent-high.png`、`run-1350-debug-thickness-cost-gradient-tangent-low.png` 与 `soap-film-reference.jpg` 对照。参考图是橙金厚膜岛和青绿弯曲分叉河道，上一轮则是完整球加粉白水平宽带、白色宽泡沫带和竖向点柱。本轮每次修改后都重新从 `solid` 验证，`run-1363`、`run-1380`、`run-1391`、`run-1406` 均显示红色壳层稳定可见，`ready=true`、`glassVisible=true`，浏览器 error/warn 日志为 0。实现仍只使用实时 GPU 物理场、膜厚、表活剂、相场、泡沫、速度/区域流和程序扰动，没有贴图、参考图采样、canvas 图案、预烘焙纹理、样式拟合或构图修改。

偏差：本轮仍失败。`run-1372-riverPathCost-highfreq-cost-high.png` 和 `run-1385-riverPathCost-seed-gated-high.png` 证明重写 cost 后宏观水平宽带被明显压暗，旧点列也被 seed 门控削弱；但 `cost` 变成少量暗残差信号，没有生成参考图需要的连续、弯曲、分叉、宽窄变化的窄河道。`run-1387/1403/1414-riverPathEvidence` 仍只有零散残差点，不能传播为可用骨架。`run-1399/1410-phase` 仍是整球偏 cyan 的相场背景加中部宽片；`run-1400/1411-foam` 仍是大面积奶白水平泡沫片；`run-1405/1415-beauty` 仍是完整球体上的粉白宽带，几乎没有 60-75% 橙金厚膜岛、15-25% 青绿分叉河道、贴边紫蓝窄边和沿边界密集的奶金/白色微滴。

已做改动：`RIVER_PATH_COST_FRAGMENT_SHADER` 改成先估计低频 drainage sheet/reservoir，再由膜厚残差、表活剂残差、相场残差、泡沫残差、曲率二阶响应和相界剪切提取高频 `channelPotential`，输出 `r=channelPotential`、`g=seedSupport`、`b=ridgeQuality`、`a=sheetReject`。随后把 `RIVER_PATH_HEAT_FRAGMENT_SHADER` 和 `RIVER_CORE_GEODESIC_FRAGMENT_SHADER` 中旧 `riverCoreMass` 点列种子改为必须经 `channelPotential`/path front 门控，避免旧质量场绕过 cost 继续制造竖柱。最后在 `FIELD_STEP_FRAGMENT_SHADER` 中降低 `wideStreamInstability/sourceLane` 对宽片的供给，加入 `broadPhaseSheet` 抑制项、降低相场局部质量目标，并把 `INIT_FIELD_FRAGMENT_SHADER` 的初始 dye 基线从高相 0.38 降到更接近 15-25% 目标体积分数的 0.24。

失败原因：这轮确认了两个层级的问题。第一，单独把 `riverPathCost` 改成高频残差场会压掉错误宽带，但当前膜厚/相场/泡沫底层仍主要产生水平排液片，所以 cost 没有足够连续的真实通道可提取。第二，`FIELD_STEP` 仍把相场/泡沫质量推回宽片，说明局部目标项和 foam 出生/衰减还没有真正做全局或分块质量守恒，也没有把 Cahn-Hilliard 相分离稳定在 15-25% 高相面积；当前只是局部回拉，容易被 drainage/source 项重新洗成宽带。

下一步：不要改构图，不要调 beauty 颜色。下一轮应把相场/泡沫从单 pass 局部目标改为更明确的质量控制：在 regional/tile pass 中保存高相面积误差，把 `targetDye` 和 `foamBirth` 由局部宽片供给改成“高相面积不足时只沿高频 filamentGate/相界/曲率脊线补给，高相过量时优先从宽片 sheet 中抽走”。同时需要把 `foam` 作为微滴密度而不是白色连续片：出生只允许在相界剪切、膜厚曲率、Marangoni 梯度和局部微扰同时满足时发生，宽片区域增加更强衰减。验证标准先看 `phase` 是否从整球 cyan 退为 15-25% 连续分叉高相，再看 `foam` 是否从白带变为沿边界颗粒，最后才看 `riverPathCost/skeleton/evidence` 能否从这些物理场中提取连续河道。

## Run 1416-1427 / heartbeat 继续：tile 质量钳制压掉宽片但通道供给过弱
相似点：本轮开始前按自动化要求重读 `soap-film-physics-handoff.md`、`soap-film-target.md`、`soap-film-iterations.md`，并把上一轮 `run-1415-beauty-init-phase-mass-high.png`、`run-1410-phase-init-phase-mass-high.png`、`run-1411-foam-init-phase-mass-high.png`、`run-1409-thickness-init-phase-mass-high.png` 与 `soap-film-reference.jpg` 对照。修改后 `run-1416` 的 `solid` 最小可见性仍稳定，`ready=true`、`glassVisible=true`、中心像素为红壳，浏览器 error/warn 为 0。`run-1427-beauty-tile-mass-clamp-high.png` 不再是上一轮的粉白水平宽带，说明宽排液片被质量控制压下去了；橙褐厚膜重新占主体。
偏差：本轮仍失败，而且是相反方向的失败。参考图需要 60-75% 橙金厚膜内有密集液滴拉丝、15-25% 青绿分叉河道、贴河道的紫蓝窄边和奶金/白色微滴；`run-1427` 变成几乎整球暗橙厚膜，青绿河道基本消失。`run-1422-phase` 只有低对比整球青背景和局部暗斑，没有连续分叉高相；`run-1423-foam` 从白色宽片退成过弱暗斑，微滴密度明显不足；`run-1424-riverPathCost` 与 `run-1425-riverPathSkeleton` 也几乎失去可用通道。也就是说，本轮修掉了“宽片过量”，但把 filament 供给一起压死了。
已做改动：降低初始 dye 基线和 channel seed 面积；在 regional support/evolve 中把高相目标改低并加强 sheet excess drain；在 phase potential/step 中把 `riverPhase`、`wideStreamLane`、`regionalSupport` 的宽片回灌改为脊线/边界门控，并给 broad sheet 增加相场和 foam 衰减。这些仍只使用实时 GPU 物理场、膜厚、表活剂、相场、泡沫、速度/区域流和程序扰动，没有贴图、参考图采样、canvas 图案、预烘焙纹理或样式拟合。
失败原因：质量控制项从局部宽片回灌切到了强衰减，但“面积不足时沿高频 filament 补给”的正向项不够。`phase` 没有形成 15-25% 的高相河道，导致 `riverPathCost/skeleton/evidence` 没有真实物理通道可提取；`foam` 的出生也被宽片衰减和低边界强度一起压弱。
下一步：保持不改构图、不调 beauty 颜色。应把正向补给只加回高频物理 filament：用 `filamentGate + channelSupport + riverBoundary/riverRidge + curvatureSupport + surfactantRidge` 形成窄的 `filamentPhaseSource`，只在非 broad sheet 且高相面积不足时提高 `targetDye`、`phaseSharpen` 和少量 dye source；foam 出生也只沿该 filament/相界恢复，宽片区域继续强衰减。验证标准是 `phase` 出现连续窄分叉而不是整球 cyan，`foam` 出现边界颗粒而不是白带或全灭，随后 `riverPathCost/skeleton` 重新有可传播通道。

## Run 1428-1439 / heartbeat 继续：filament 补给恢复过宽，回到水平片
相似点：`run-1428-debug-solid-filament-refill-low.png` 再次确认 solid 红壳可见，`ready=true`、`glassVisible=true`，浏览器 error/warn 仍为 0。与 `run-1427` 相比，`run-1434-phase-filament-refill-high.png` 和 `run-1435-foam-filament-refill-high.png` 重新有足够强的相场/泡沫信号；`run-1437-riverPathSkeleton-filament-refill-high.png` 出现少量绿色分叉残片，说明“只靠强衰减”之后至少能恢复一点可传播结构。
偏差：本轮仍失败。参考图的青绿应是弯曲、分叉、宽窄变化的河道，占 15-25%；当前 `run-1439-beauty-filament-refill-high.png` 又出现横向粉白/灰绿宽片，和 `run-1415` 的失败形态接近。`phase` 仍是整球青背景加水平高相片，不是独立河道；`foam` 也回到白色连续带，缺少沿橙金/青绿边界的离散奶金微滴；`thickness` 仍以水平排液带为主，橙金厚膜内部的液滴拉丝和旋涡不足；`riverPathCost/skeleton` 只在局部产生残片，没有形成贯穿分叉中心线。
已做改动：在 `FIELD_STEP_FRAGMENT_SHADER` 中加入 `filamentPhaseSource`，由 `filamentGate`、`channelSupport`、`riverBoundary/riverRidge`、`curvatureSupport`、`surfactantRidge` 推导窄补给；在 `targetDye`、`phaseSharpen`、dye source 和 foamBirth 中只沿该物理 filament 恢复供给，并略微恢复初始 phase seed。仍没有使用贴图、参考图采样、canvas 图案、预烘焙纹理、样式拟合或构图修改。
失败原因：`filamentPhaseSource` 的横向宽度估计仍依赖 `channelSupport/sourceLane`，这些量在当前底层膜厚/相场里会沿水平 drainage sheet 连续变亮；因此补给虽然不是全局开放，但仍会在宽排液片上成带。真正缺的是横向非极大值抑制/宽度惩罚：相场补给必须先被压成中心线，再允许 Cahn-Hilliard/平流把它扩成有限宽度河道。
下一步：不要继续加源强，也不要调 beauty。把 `filamentPhaseSource` 改成读取或复用 `riverPathCost` 已有的高频 channelPotential / ridgeQuality / sheetReject 逻辑，加入横向 NMS 或显式 `supportAlong - supportAcross` 宽度惩罚；只有“沿流连续、横向窄、sheetReject 低”的位置能补给相场和 foam。验证顺序仍是 solid、thickness、phase、velocity、foam，再看 riverPathCost/skeleton/evidence 和 beauty。
## Run 1440-1475 / heartbeat 继续：path cost 窄门控在过弱/过宽之间摆动，仍未生成参考图河道
相似点：本轮每次修改后都重新从 `solid` 验证最小可见性，`run-1440`、`run-1452`、`run-1464` 都显示红色壳层稳定可见，`ready=true`、`glassVisible=true`、`debugUniform=1`，浏览器 error/warn 日志为 0。`thickness/phase/velocity/foam` 低参调试图也都能渲染，说明这轮改动没有再次引入 shader 编译或壳层绘制问题。实现仍只使用实时 GPU 物理场、膜厚、表活剂、相场、泡沫、速度、曲率和程序扰动，没有使用贴图、参考图采样、canvas 图案、预烘焙纹理、样式拟合或构图修改。
偏差：本轮仍失败。参考图需要 60-75% 橙金厚膜岛、15-25% 青绿弯曲分叉河道、贴河道的紫蓝窄边、奶金/白色微滴沿边界和厚膜内部高密度分布。`run-1439` 的上一轮结果是水平粉白/灰绿宽片；第一版 `run-1451-beauty-path-gated-filament-high.png` 把 `filamentPhaseSource` 接入 `riverPathCost` 后过度收窄，`riverPathCost/skeleton/evidence` 只剩左侧短残片，beauty 退成暗橙整球，几乎没有青绿通道。第二版 `run-1463-beauty-path-cost-rebuild-high.png` 重建 path cost 后又过宽，`run-1460/1461/1462` 显示 path cost/skeleton/evidence 被大面积粉绿块填满，`run-1459-foam` 变成连续白色宽带，不是微滴。第三版 `run-1475-beauty-narrow-nms-high.png` 加强横向 NMS 后再次过窄，只保留左侧局部块，`run-1470-phase` 是整球暗青背景加左侧残片，`run-1471-foam` 是左侧白块，`run-1472/1473/1474` 也只剩局部残片；没有连续弯曲分叉河道，也没有参考图的橙金厚膜主体和边界微滴密度。
已做改动：`PHASE_POTENTIAL_FRAGMENT_SHADER` 与 `PHASE_STEP_FRAGMENT_SHADER` 新增 `uRiverPathCost`，用 `channelPotential/seedSupport/ridgeQuality/sheetReject` 加沿向/横向采样，生成 `pathGate` 和 `pathSheetDrain`，只有沿流连续、横向窄、sheetReject 低的位置才能补给相场和 foam。`FIELD_STEP_FRAGMENT_SHADER` 降低上一轮过宽的 `filamentPhaseSource`，去掉对 `channelSupport/sourceLane` 的强依赖，减少宽片回灌。随后重建 `RIVER_PATH_COST_FRAGMENT_SHADER` 的物理证据，加入 `capillaryLine`、`meniscusBoundary`、相场剪切、表活剂残差和横向宽度惩罚；又在 `RIVER_PATH_EVIDENCE_FRAGMENT_SHADER` 与 `RIVER_PATH_SKELETON_FRAGMENT_SHADER` 中加入 lateral reject / NMS 收窄。
失败原因：当前底层膜厚/相场/泡沫仍主要给出水平 drainage sheet，而不是连续弯曲的高频物理通道。把 phase 补给强接到 path cost 时，如果 gate 严格就把通道杀死；放宽 path cost 后又把宏观水平片当成通道填满；再收紧 NMS 又只留下局部短块。这说明问题不再是单个 `smoothstep` 阈值，而是缺少明确的区域质量守恒和连通性选择：高相面积、foam 微滴密度、path cost 候选和 skeleton 连通性没有共享一个稳定的目标占比/宽度约束。
下一步：不要改构图，不要调 beauty 颜色，也不要继续在同一处阈值来回摆动。下一轮应先新增或暴露区域级诊断：`phaseAreaError` / `foamAreaError` / raw `channelPotential`，把高相目标固定在约 15-25%，让欠量时只沿高频 filament/曲率/表活剂脊线补给，过量时优先从 broad sheet 抽走；foam 则从连续片改成受相界剪切、膜厚曲率、Marangoni 梯度和局部扰动共同触发的微滴密度场，并对 broad sheet 强衰减。验证顺序仍是 `solid -> thickness -> phase -> velocity -> foam -> riverPathCost/skeleton/evidence -> beauty`，只有 phase/foam 先不再是水平宽片，path skeleton 才有可能长成参考图的青绿分叉河道。

## Run 1476-1547 / heartbeat 继续：phaseArea 诊断已接线，但路径代价仍在“宽带/全无”之间摆动
相似点：本轮开始前按自动化要求重新读取 `soap-film-physics-handoff.md`、`soap-film-target.md`、`soap-film-iterations.md`，并把上一轮 `run-1475-beauty-narrow-nms-high.png`、`run-1470-phase-narrow-nms-high.png`、`run-1471-foam-narrow-nms-high.png`、`run-1469-thickness-narrow-nms-high.png`、`run-1472-riverPathCost-narrow-nms-high.png` 与 `soap-film-reference.jpg` 对比。上一轮仍是暗橙完整球体和局部残片；参考图要求橙金厚膜岛占主体、青绿弯曲分叉河道约 15-25%、紫蓝窄边和奶金/白色微滴沿边界高密度分布。本轮每次修改后都先验证 `solid`，`run-1476`、`run-1488`、`run-1500`、`run-1512`、`run-1524`、`run-1536` 都显示红色壳层稳定可见，`ready=true`、`glassVisible=true`、`debugUniform=1`，浏览器 error/warn 日志为 0；`thickness/phase/velocity/foam/phaseArea/riverPathCost/beauty` 均能渲染。实现仍只使用实时 GPU 物理场、膜厚、速度、表活剂、相场、泡沫、曲率、路径代价和程序扰动，没有贴图、参考图采样、预烘焙纹理、canvas 图案、样式拟合或构图修改。
偏差：本轮仍失败。第一版新增 `phaseArea` 后，`run-1487-beauty-phase-area-high.png` 仍是暗橙球，`run-1483-phase-phase-area-high.png` 变成整球青绿，说明区域欠填预算被铺到全局；`run-1484-foam` 几乎全暗/块状，不是参考图微滴。第二版收紧欠填后，`run-1499-beauty-phase-area-tight-high.png` 出现横向粉白带，`run-1495-phase` 和 `run-1496-foam` 都被同一条宽带主导，`run-1497-riverPathCost` 证明路径代价仍是宽排液带而非分叉骨架。第三版加强横向 NMS 后，`run-1511-beauty-path-nms-high.png` 退回暗橙球，`run-1509-riverPathCost` 和 `run-1510-phaseArea` 几乎无有效信号，说明过度抑制。第四、第五版改为软抑制和 raw boost 后，`run-1545-riverPathCost-path-rawboost-high.png` 只剩右侧弱横向残片，`run-1546-phaseArea` 仍近黑，`run-1547-beauty` 仍是暗橙整球；没有橙金厚膜岛的大面积亮度、没有连续青绿分叉河道、没有贴河道的紫蓝窄边，foam 也不是沿界面的离散微滴密度。
已做改动：`thinFilmSim.js` 新增 `PHASE_AREA_FRAGMENT_SHADER`、`phaseAreaTarget`、`phaseAreaMaterial`、`uPhaseArea` 反馈和 `phaseAreaTexture` getter；`PHASE_STEP_FRAGMENT_SHADER` 使用区域高相面积、目标面积、欠填预算和片状排空来调节 dye 与 foam；`logoScene.js` 新增 `filmDebugView=phaseArea`，复用 `uFilmRiverPathCostMap` 显示相场区域诊断；`controlSchema.js` 新增 `phaseArea` 调试选项。随后在 `RIVER_PATH_COST_FRAGMENT_SHADER` 中加入 `lateralPeak/forkPeak/broadBandReject/filamentMask`，尝试把宽带压成中心线；发现过硬后改为保留 `rawChannelPotential` 的软抑制，再用 raw boost 恢复高分辨率预热后的低幅物理信号。
失败原因：当前 `phaseArea` 诊断本身已经可见并可反馈，但它依赖的 `riverPathCost` 还没有稳定的物理中心线。路径代价如果放宽，就把宏观水平 drainage sheet 当成河道，foam 变成连续白带；如果收紧 NMS，又把高分辨率预热后的低幅 filament 一起杀掉，phaseArea 变黑、beauty 回到暗橙整球。也就是说，本轮确认问题不在壳层可见性、WebGL、材质或 beauty 调色，而在真实物理场的层级分离：宏观排液片、局部曲率/Marangoni filament、相场面积守恒、泡沫微滴出生没有被分成互相约束的独立场。
下一步：不要改构图，不要调 beauty 颜色。下一轮应先暴露 raw `channelPotential` 作为独立 debug view，并把 `phaseArea` 拆成更明确的 `phaseAreaError/foamAreaError` 分量；然后把路径代价分成两个 pass：低频 reservoir/sheet 只供液和排空，高频 filament/channel 只由膜厚残差、曲率二阶响应、表活剂梯度、相界剪切和低 sheetReject 生成。相场欠填只沿高频 filament/channel 补给，过量优先从 broad sheet 抽走；foam 只在相界剪切 + 曲率 + Marangoni + 局部扰动同时成立处出生，并对宽片强衰减。验证顺序继续为 `solid -> thickness -> phase -> velocity -> foam -> phaseArea/rawChannel/riverPathCost -> beauty`，目标是先让 `phase` 出现 15-25% 连续弯曲分叉高相区，再让 `foam` 变成边界微滴密度，最后才看 thin-film interference beauty。

## Run 1548-1600 / 继续：solid 回归修复后接入 Huang 2020 风格球面通量，但相场仍被团块/宽片主导
相似点：本轮开始前重新读取 `soap-film-physics-handoff.md`、`soap-film-target.md`、`soap-film-iterations.md`，并对照 `soap-film-reference.jpg`、上一轮可用 `run-1547-beauty-path-rawboost-high.png`、黑屏回归 `run-1558-beauty-diagnostics-high.png` 和修复截图 `run-1562-solid-recovered.png`。`run-1547` 仍是暗橙完整球，缺少参考图里的橙金厚膜岛、青绿分叉河道、紫蓝窄边和奶金微滴；`run-1548` 到 `run-1561` 是初始化异常造成的黑屏，不可作为物理结果；`run-1562` 证明红色 solid 壳层已恢复。

已做改动：修复 `uPathDiagnosticMode` 接到错误 material 后导致启动抛错的问题，补到 `RIVER_PATH_COST_FRAGMENT_SHADER/riverPathCostMaterial`，随后 `run-1563`、`run-1573`、`run-1587`、`run-1595` 均显示 solid 红壳稳定可见，`ready=true`、`glassVisible=true`，浏览器 error/warn 为 0。按 Huang 2020 的球面肥皂膜思路推进 `FIELD_STEP_FRAGMENT_SHADER`：增加球面度量 `sphereSinAt`、球面梯度/拉普拉斯、膜厚压力 `p = -gamma * laplacian(h) - Pi(h) + rho*g_n*h`、球面保守通量 `q = -(h^3/3mu)grad(p) + (h^2/2mu)grad(gamma) + tangentGravity + airShear`，并用 `-div(q)` 更新膜厚；表活剂也接入 `-div(Gamma*u - D grad Gamma)`。随后把主场里的 `h/Gamma/foam/dye` 梯度与拉普拉斯改为球面度量，并给 foam 出生增加由相界、膜厚曲率、Marangoni 梯度、剪切共同触发的微滴门控，宽 foam 团块增加衰减。最后在 `PHASE_AREA_FRAGMENT_SHADER` 中加入由膜厚残差、表活剂梯度、曲率各向异性推导的 `capillaryFilament`，把高相面积目标明确推回约 15-25% 区间，欠填只沿物理细丝补给。

偏差：本轮仍失败。`run-1572-beauty-spherical-flux-high.png` 比 `run-1547` 多了一些由球面通量推出来的局部青灰/奶白结构，但整体仍是完整球加局部宽片，远不像参考图的近景半球分叉液膜。`run-1582` 把 foam 宽团块压弱后，又把 `phase` 压成少量孤立短斑；`run-1594` 毛细细丝门控仍过弱，`phaseAreaError` 继续显示全局欠填。`run-1600-beauty-area-target-high.png` 在提高 15-25% 面积目标后出现更强的左下相场团块，但它仍是水平团块/片状 reservoir，不是连续、弯曲、分叉、宽窄变化的青绿河道；`run-1597-foam-area-target-high.png` 也回到连续白片趋势，不是沿相界分布的微滴密度。粗略色彩统计也显示当前 beauty 的 cyan/purple 仍几乎没有进入可见前景，橙金主体虽有但偏暗且缺少参考图的高密度液滴拉丝。

失败原因：这轮确认了 “solid/渲染可见性” 已不是瓶颈，瓶颈在物理场层级。球面保守通量会把膜厚、表活剂、相场推向局部 reservoir，但当前 phase-area 与 path-cost 仍缺少真正的球面连通约束；面积欠填一旦放开就补成水平团块/宽片，收紧则只剩孤立短斑。foam 微滴出生也还依赖局部高相团块，无法从连续片分解成边界颗粒。现有 path cost 仍不能从膜厚残差/Marangoni/曲率中提取连续高频中心线，因此 phase 和 foam 没有可共享的稳定河道骨架。

下一步：不要改构图，不要调 beauty 颜色。下一轮应新增独立的球面 `filament/connectivity` pass，而不是继续在 `PHASE_AREA` 阈值上摆动：输入低频 reservoir、膜厚残差、表活剂梯度残差、二阶曲率、相界剪切和速度收敛，输出连续性/宽度受控的细丝概率和连通距离；phase 欠填只沿这个 pass 补给，过量仍从 broad sheet 抽走。foam 需要改为粒子密度/泊松出生近似：出生只在细丝边界的剪切-曲率-Maragoni 联合峰值，连续片区域强衰减。验证顺序保持 `solid -> thickness -> phase -> velocity -> foam -> phaseArea/phaseAreaError/foamAreaError/channelPotential/riverPathCost -> beauty`。

## Run 1601-1618 / heartbeat 继续：新增球面 filament/connectivity pass，但单 pass 在“宽片/熄灭”之间摆动
相似点：本轮开始前按自动化要求重新读取三份目标文件，并把上一轮最新 `run-1600-beauty-area-target-high.png`、`run-1596-phase-area-target-high.png`、`run-1597-foam-area-target-high.png` 与 `soap-film-reference.jpg` 对照。参考图是近景半球内的橙金厚膜岛、15-25% 青绿分叉河道、贴边紫蓝窄线和高密度奶金/白色微滴；`run-1600` 只有暗橙完整球和左下水平团块，青绿/紫边/微滴都不成立。本轮修改后 `run-1601` 与 `run-1613` 均确认 `solid` 红壳稳定可见，`ready=true`、`glassVisible=true`、浏览器 error/warn 为 0；`thickness/phase/velocity/foam/filamentConnectivity/phaseArea/riverPathCost/beauty` 均能渲染。四个 JS 文件 `node --check` 全通过。

已做改动：新增 `FILAMENT_CONNECTIVITY_FRAGMENT_SHADER` 和 `filamentConnectivityTarget`，输入实时 `field/velocity/regionalRidge/riverPathCost`，输出 `r=物理细丝概率`、`g=沿流连通性`、`b=微滴边界触发`、`a=broad sheet 排斥`。这个 pass 使用膜厚残差、表活剂梯度、相场边界、球面拉普拉斯、速度收敛、沿向/横向采样和 NMS 宽度惩罚，没有使用贴图、参考图、canvas 图案或预烘焙纹理。`PHASE_AREA_FRAGMENT_SHADER` 与 `PHASE_STEP_FRAGMENT_SHADER` 新增 `uFilamentConnectivity`，让相场欠填和 foam 出生读取这个独立物理细丝场；`logoScene.js`/`controlSchema.js` 新增 `filmDebugView=filamentConnectivity` 方便诊断。

偏差：本轮仍失败。第一版 `run-1609-filamentConnectivity-high.png` 证明新增 pass 能产生连续信号，但它本身仍是左下 cyan 宽块，导致 `run-1607-phase` 和 `run-1608-foam` 继续走向团块/连续白片，`run-1612-beauty` 仍是完整球和左下宽 reservoir。随后加强横向 NMS、削弱 path/regional 直接加成后，`run-1614-filamentConnectivity-nms-high.png` 过度收紧，基本只剩暗场与弱残片；`run-1615-phase` 退回孤立短斑，`run-1616-foam` 仍有连续白团，`run-1618-beauty` 变回偏平的暗橙球，几乎没有可见青绿分叉河道。也就是说，新增 pass 解决了“没有独立物理细丝层”的结构问题，但单 pass 的即时 NMS 仍无法同时保持连续性和宽度控制。

失败原因：当前细丝证据来自同一帧局部梯度/曲率/速度收敛，缺少随时间累积的连通距离或前沿传播。证据放宽时会把低频 reservoir 当作 filament，证据收紧时又只剩孤立斑点，无法生成参考图那种连通、弯曲、分叉且宽窄变化的青绿河道。foam 仍依赖相场团块局部出生，尚未实现沿细丝边界的离散微滴密度；beauty 继续只是反映这些错误物理场，没有做颜色拟合。

下一步：不要改构图，不要调 beauty 颜色。应把 `filamentConnectivity` 从单 pass 证据图升级为 ping-pong 迭代场：`newFilament = max(localEvidence, advectedPrevious * persistence, neighborFrontPropagation - sheetReject)`，用 6-12 次 Jacobi/fast-marching 近似传播连通前沿，并在输出中同时保存 `distance/age/widthPenalty`。phase 欠填只沿持久化 filament 前沿补给，过量继续从 broad sheet 抽走；foam 出生要改为细丝边界上的泊松密度近似，而不是由连续相场块直接发白。验证继续按 `solid -> thickness -> phase -> velocity -> foam -> filamentConnectivity/phaseArea/riverPathCost -> beauty`。

## Run 1619-1639 / heartbeat 继续：filamentConnectivity 升级为持久化 ping-pong 前沿，但仍未达到参考图
相似点：本轮开始前按自动化要求重新读取了 `soap-film-physics-handoff.md`、`soap-film-target.md`、`soap-film-iterations.md`，并重新查看 `soap-film-reference.jpg`、上一轮最新 `run-1618-beauty-filament-nms-high.png`、`run-1615-phase-filament-nms-high.png`、`run-1616-foam-filament-nms-high.png`、`run-1614-filamentConnectivity-nms-high.png`、`run-1617-phaseArea-filament-nms-high.png`。上一轮与参考图相比只保留了暗橙主体和少量粒点；参考图要求 60-75% 橙金厚膜、15-25% 青绿弯曲分叉河道、贴河道的紫蓝窄边和高密度奶金/白色微滴。本轮 `run-1619-solid-filament-persist-low.png`、`run-1629-solid-filament-persist2-low.png` 继续确认 solid debug 红色壳层稳定可见，浏览器日志无 error/warn；`thickness/phase/velocity/foam` 均可渲染，不是 WebGL 黑屏问题。

已做改动：`thinFilmSim.js` 中把 `filamentConnectivityTarget` 改为 `filamentConnectivityReadTarget/filamentConnectivityWriteTarget` ping-pong 状态场，shader 新增 `uPreviousFilament/uDelta`，用上一帧前沿做回溯、沿流传播、邻域 front propagation、宽度惩罚和 broad-sheet 衰减；每个 phase iteration 内执行 6 次 filament 前沿传播，再让 `phaseArea` 和 `phaseStep` 读取持久化后的 filament 场。随后降低全局 broad-sheet reject 对整壳层的误杀，并在 `PHASE_STEP_FRAGMENT_SHADER` 中加入 `filamentEdge/filamentBridge`：相场欠填只沿持久化细丝连续性补桥，foam 出生被限制到 filament 边界、剪切、曲率和 Marangoni 共同成立的位置，宽片 foam 继续衰减。未使用贴图、参考图采样、预烘焙纹理、canvas 图案或样式拟合；所有新信号都来自实时膜厚、速度、表活剂、曲率、相场、foam 和前沿历史场。

偏差：本轮仍失败，但失败位置更清楚。第一组 `run-1624-filamentConnectivity-persist-high.png` 仍几乎全暗/暗红，说明最初的持久化场被 broad-sheet reject 压死；`run-1625-phase` 接近全暗，`run-1626-foam` 仍有连续白团，`run-1628-beauty` 基本回到暗橙球。第二组放松 reject 并加 6 次传播后，`run-1630-filamentConnectivity-persist2-high.png` 开始出现左下到中部的连续条带，说明 ping-pong 前沿有效；但 `run-1631-phase` 仍是孤立竖向紫青块，`run-1632-foam` 仍是宽白带，`run-1634-beauty` 只有局部条斑，没有参考图那种横向贯穿、弯曲、分叉、宽窄变化的青绿河道。第三组 `run-1635` 到 `run-1639` 限制 foam 边界出生后，白带略被压弱，但相场还是块状竖条，beauty 仍是完整球加局部斑块；橙金厚膜缺少参考图内部密集液体拉丝/旋涡，青绿面积远低于 15-25%，紫蓝窄边没有沿河道形成，奶金/白色微滴仍不够密、不够离散。

失败原因：现在已经确认最小可见性、shader 初始化、材质和调试视图不是瓶颈；瓶颈是 filament 前沿虽然能持久化，但仍受宏观排液方向支配，缺少真正的球面 geodesic/fast-marching 连通距离、分叉选择和目标面积约束。当前 phase 读到的前沿没有被转化成连续河道骨架，而是被局部相场补给放大成竖向块；foam 仍在高相块内成片堆积，未形成参考图那种沿橙金/青绿边界的离散微滴密度。beauty 的差异是这些物理场失败的结果，不应该用调色或构图去掩盖。

下一步：继续不改构图、不调 beauty 颜色。应把 `filamentConnectivity` 从“上一帧传播概率”继续升级为显式的球面 front-distance 场：输出 `r=filament probability`、`g=front age/distance`、`b=edge droplet density`、`a=width penalty/sheet reject`，并在迭代中做沿流向和横向的 geodesic relaxation；phaseArea 应按目标高相面积 15-25% 做 tile-level 守恒，只沿低 widthPenalty、高 age 连通前沿补相，过量从 broad sheet 和孤立竖条抽走；foam 出生改为边界上的随机泊松密度近似并立即受局部曲率/剪切约束，避免连续白带。验证顺序继续为 `solid -> thickness -> phase -> velocity -> foam -> filamentConnectivity/phaseArea -> beauty`。

## Reference Update / 2026-05-31：Huang 2020 作为最高优先级物理参考
用户指定把 Huang et al. 2020《Chemomechanical Simulation of Soap Film Flow on Spherical Bubbles》官方页面作为最高优先级参考文档，和 `artifacts/targets/soap-film-reference.jpg` 并列。已读取官方页面：该工作是 ACM TOG / SIGGRAPH 2020 论文，核心是球面肥皂膜内部物质流动，强调表活剂浓度与 Marangoni 表面张力的复杂耦合，并提供 Full Paper、Supplemental Document 和 video。Supplemental 明确给出球面运动学条件和润滑模型推导，最后把主系统整理为 `D u / D t = -(M / eta) grad(Gamma) + Re^-1 V`、`D Gamma / D t = -Gamma div(u) + Ds laplacian(Gamma)`、`D eta / D t = -eta div(u)`。

已同步改动：`soap-film-target.md` 新增“最高优先级参考”章节，把参考图和 Huang 2020 并列；`soap-film-physics-handoff.md` 新增明确交接要求；heartbeat 自动化 `automation` 已更新为每 15 分钟一次，并要求每轮同时对照参考图和 Huang 2020 模型。后续每轮不得只比较颜色/构图，必须记录当前代码与该论文在球面度量、Marangoni 项、表活剂输运、膜厚守恒、外力项和润滑近似上的差距。

本轮中途诊断：在继续 `front age/distance` 改动并截图时，浏览器控制台发现旧路径中的 shader 编译错误：`RIVER_CORE_TRANSPORT_FRAGMENT_SHADER` 使用了未定义的 `capillaryEdge` 和 `transverseValley`。已先补回这些量的现场计算，否则后续截图不具备物理诊断意义。下一步必须重跑有效截图并确认 error/warn 为 0，然后暂停继续堆启发式 front-distance；优先按 Huang 2020 重排实现：把当前 `field.r/g` 明确映射为 `eta/Gamma`，把 velocity step 改成论文式球面切向速度更新和表活剂驱动 Marangoni 项，把膜厚更新改成 `D eta / D t = -eta div(u)` 的守恒形式，再让 phase/foam/干涉色作为诊断和渲染层读取这些物理场。

## Reference Correction / 2026-06-01：已按用户要求读取 Huang 2020 全文
用户明确指出“不要只读摘要，读全文”。已下载官方 Full Paper PDF 和 Supplemental PDF，并转文本保存到 `artifacts/references/HuangEtAl-SoapBubbles-SIGGRAPH2020.txt` 与 `artifacts/references/HuangEtAl-SoapBubbles-SIGGRAPH2020-supp.txt`。已阅读主文的动机/相关工作、物理模型、方法、薄膜渲染、结果/讨论和附录 A/B/C，以及 Supplemental 的运动学条件与润滑推导。全文级实现笔记已写入 `artifacts/targets/soap-film-huang-2020-fulltext-notes.md`，并同步到 target/handoff。

全文阅读后的关键纠偏：Huang 2020 主线不是继续把膜厚当作固体表面薄液层，用 `h^3 grad(p)` 型保守通量主导图案；它是球面上 `eta/Gamma/u` 的可压缩 chemomechanical 流。速度主力是除以半厚度的 Marangoni 项 `-(M/eta) grad(Gamma)`，空气阻力也除以 `eta`，重力是切向体力；`Gamma` 和 `eta` 的变化来自 `div(u)`，且论文把平流后的 `Gamma` 与 `u` 组合成 projection-like 的隐式线性系统。下一轮改代码要以这个全文模型为主，当前 `phase/foam/filament` 只能作为由 `eta/Gamma/u` 派生的诊断/微滴层，不能继续反过来主导主物理场。

## Run 1650-1665 / heartbeat 继续：Huang 2020 速度与连续项一阶对齐，但相场仍不是分叉河道
相似点：本轮开始前重新读取了 `soap-film-physics-handoff.md`、`soap-film-target.md`、`soap-film-iterations.md`，并按最高优先级同时对照 `soap-film-reference.jpg` 和 Huang et al. 2020 的球面 chemomechanical/lubrication 模型。先确认上一轮高参 `run-1649-beauty-frontage-high.png` 是旧 shader 编译错误前后的无效/低可信基线：整球暗橙加均匀黄点，没有参考图的青绿分叉河道、紫蓝窄边和奶金微滴。随后重跑有效基线，`run-1650-solid-huang-baseline-low.png` 与修改后 `run-1658-solid-huang-velocity-low.png` 均证明 solid debug 红壳可见；`thickness/phase/velocity/foam/filamentConnectivity/phaseArea/beauty` 均能截图，不是黑屏或壳层初始化问题。

已做改动：`VELOCITY_STEP_FRAGMENT_SHADER` 新增球面 `sin(theta)` 度量、球面梯度/拉普拉斯和球面速度散度；把速度步里的膜厚、表活剂、相场、压力和表面张力梯度改为球面梯度；把 Marangoni 主项从启发式 `grad(gamma)` 改为更接近 Huang 2020 的 `-(M/eta) grad(Gamma)`，保留很弱的表面张力梯度通量作为数值辅助。`FIELD_STEP_FRAGMENT_SHADER` 的速度散度与 `h*u` 通量散度也改为球面通量散度，并显式加入 `D eta / D t = -eta div(u)` 与 `D Gamma / D t = -Gamma div(u) + Ds laplacian(Gamma)` 对应项。实现仍只使用实时 GPU 物理场：膜厚 `eta`、表活剂 `Gamma`、切向速度、曲率/压力、相场和泡沫密度；没有贴图、参考图采样、预烘焙纹理、canvas 图案、样式拟合或构图修改。

偏差：本轮仍失败。低参修改后 `run-1659-thickness-huang-velocity-low.png` 仍是平滑橙褐/低频竖带，不是参考图里橙金厚膜内的液滴拉丝与局部薄膜河道；`run-1660-phase-huang-velocity-low.png` 仍几乎整球青绿/青蓝，远超参考图约 15-25% 的青绿河道预算；`run-1662-foam-huang-velocity-low.png` 仍是宽片/烟带，不是离散奶金/白色微滴。高参 `run-1663-filamentConnectivity-huang-velocity-high.png` 出现局部紫青细丝信号，但连通性不足且集中成块；`run-1664-phaseArea-huang-velocity-high.png` 仍基本是整球橙褐诊断，没有稳定的高相面积误差结构；`run-1665-beauty-huang-velocity-high.png` 从旧的整球暗橙散点变成橙金背景加左侧单块厚膜岛，说明 Huang 项确实改变了输运，但它仍然不是参考图：青绿没有分叉成河网，紫蓝边界只围着单块岛，微滴稀疏且不沿边界密集分布。

粗略图像统计：把背景也计入时，参考图约为 `orange_gold=0.2939`、`cyan_green=0.0523`、`purple_blue=0.0320`、`cream_white=0.0443`；`run-1665` 为 `orange_gold=0.1623`、`cyan_green=0.0000`、`purple_blue=0.0000`、`cream_white=0.0018`、`dark=0.7859`。这个数字不能替代视觉判断，但足以说明最终 beauty 仍严重缺少可见青绿/紫蓝干涉带和奶金微滴密度。

失败原因：这轮把 Huang 2020 的球面度量、Marangoni 符号、膜厚/表活剂连续项接入了主模拟，但相场和 foam 仍不是由稳定的 `eta/Gamma/u` 细丝前沿自洽生成。当前 `phase` 在低参下仍全局过量，高参下又塌成单块岛；`filamentConnectivity` 有局部信号但没有球面 geodesic 连通距离和目标面积约束；`foam` 仍像连续片或泛点，而不是由细丝边界处的剪切、曲率、Marangoni 梯度和局部扰动共同触发的微滴密度。beauty 的不相似是物理场失败的结果，不能通过调色、构图或纹理伪造来修。

下一步：继续不改构图、不调 beauty 颜色。先把 Huang 2020 的主变量命名和数值尺度彻底统一：`field.r=eta`、`field.g=Gamma`，把 velocity step 中的 `u`、field step 中的 `eta/Gamma` 和 filament pass 共享同一个球面散度/梯度工具；然后把 `filamentConnectivity` 升级为真正的 front-distance/geodesic relaxation 场，输出 `probability/age-distance/edge-droplet/widthPenalty` 并在多次迭代中传播。`phaseArea` 需要按 15-25% 高相目标做 tile-level 守恒：欠量只沿低 widthPenalty、高连通 age 的细丝补给，过量从 broad sheet 和孤立块抽走；`foam` 出生改成细丝边界的泊松密度近似，并对宽片强衰减。下一轮验证顺序仍为 `solid -> thickness -> phase -> velocity -> foam -> filamentConnectivity -> phaseArea -> beauty`，每张继续和参考图及 Huang 模型逐项对照。
# 2026-06-01 heartbeat / Run 1805-1828：修复诊断链路，加入 Huang eta/Gamma/u 质量回补诊断

本轮开始前已重读 `soap-film-huang-2020-fulltext-notes.md`、`soap-film-physics-handoff.md`、`soap-film-target.md`、本迭代文件，并对上一轮最新有效图 `run-1780-beauty-huang-main-projection-restored-high.png` 与 `soap-film-reference.jpg` 做强制对比。上一轮主要失败不是构图，而是物理场：beauty 仍是暗金整球，青绿分叉河道、紫蓝窄边、奶金/白色微滴几乎没有；phase/foam/gammaResidual 不形成 Huang eta/Gamma/u 耦合下应有的局部收缩、表活剂梯度和相场边界。

本轮实现：

- 修复 `GAMMA_RESIDUAL_FRAGMENT_SHADER` / velocity shader 中变系数球面算子重复/缺失导致的 WebGL program invalid 问题；最终 `run-1813..1820`、`run-1821..1828` 控制台均无 shader error。
- 新增 `etaGammaVelocity` debug view 和 `window.__soapFilmDebug.filmDiagnostics`，读回 eta、Gamma、|u|、projected divergence 的 min/max/mean/fraction，避免只凭颜色猜测。
- 在 WebGLRenderer 初始化前加入 shader precision 空值兜底，并把短暂无 WebGL context 改为 `webgl-pending` 返回，避免把 headless 初始化差异误报成模拟错误。
- 按 Huang 模型中 eta/Gamma/u 主变量的可演化性，加入 Plateau border/液膜浴式的局部 `plateauReservoirFeed` 和弱 `surfactantReservoir`：这是 `source - evaporation` 项，不采样参考图、不用贴图、不做样式拟合。

正式截图：

- 最小可见性：`run-1821-solid-huang-reservoir-low.png`，`ready=true`，`debugUniform=1`，centerPixel `[255,20,10,255]`。
- 物理场链路：`run-1822-thickness-huang-reservoir-low.png`、`run-1823-phase-huang-reservoir-low.png`、`run-1824-velocity-huang-reservoir-low.png`、`run-1825-foam-huang-reservoir-low.png`、`run-1826-gammaResidual-huang-reservoir-low.png`、`run-1827-etaGammaVelocity-huang-reservoir-low.png`。
- 最新 beauty：`run-1828-beauty-huang-reservoir-high.png`，384 sim，96 prewarm，56 pressure iterations，控制台 logs `[]`。

数值对比：

- reservoir 前 `run-1820`：high beauty `eta.mean=0.0741`、`eta.thinFraction=1.0`、`gamma.mean=0.2087`，说明长预热后全场塌到薄膜下限，颜色必然暗且无厚膜结构。
- reservoir 后 `run-1828`：`eta.mean=0.2721`、`eta.max=0.3882`、`eta.thinFraction=0.2636`、`gamma.mean=0.2771`，质量塌陷明显缓解，但还没有参考图所需的厚橙岛。
- 粗 HSV 区域统计：参考图橙金约 `45.02%`、青绿 `13.27%`、紫蓝 `5.14%`、奶金/白点 `1.16%`；`run-1828` 橙金约 `66.86%`、青绿 `0%`、紫蓝 `0%`、奶金/白点 `0%`，且暗区约 `23.96%`。

当前偏差和失败原因：

- `eta` 已不再全局塌陷，但 `eta.max=0.3882` 仍远低于厚膜岛阈值，无法生成大面积橙金厚膜和局部奶金微滴。
- `Gamma` 仍偏低且范围窄，Marangoni 耦合没有把 `u` 推成参考图中那种分叉河道；`etaGammaVelocity` 显示低分辨率下 `|u|.mean≈0.018`、active fraction 仍为 `0`，速度场太弱。
- 相场仍是宽泛的蓝绿纹理，没有从 `eta/Gamma/u` 的收缩、边界张力和润滑通量中形成清晰分叉通道；foam 也仍是低密度背景点，不是边界上的奶金/白色微滴。
- beauty 变亮并出现横向厚膜带，说明质量回补有效，但结构仍不是参考图；下一步不能调色，应继续改物理：提高局部 Marangoni/收缩速度、让 plateau 回补只喂厚岛/边界、让薄通道由 `div((M/eta)grad Gamma)` 和 `-div(q)` 自发变窄。

下一步计划：

1. 把当前 `plateauReservoirFeed` 从近似均匀回补改成沿 `flowConvergence + surfactantRidge + riverBoundary` 的局部回补，并加入上限为 `eta≈0.62` 的厚岛成核，目标让 `eta.max > 0.62` 且厚区面积接近参考的橙金占比。
2. 增强 `Gamma` projection 对速度的反馈：以 Huang 的 `-(M/eta)grad(Gamma)` 为主，检查 `gammaVelocityCorrection` 当前速度过弱的问题，让 `velocity.activeFraction` 不再为 0。
3. 再验证 `phase/foam/filamentConnectivity/phaseArea`：只有当 eta/Gamma/u 诊断出现局部压缩和窄通道后，才继续微滴和干涉色。
## 2026-06-01 heartbeat / Run 2552-2576：相场面积回补改为骨架门控，但青绿河道仍未成立

开始前检查：本轮重新读取了 `artifacts/targets/soap-film-huang-2020-fulltext-notes.md`、`soap-film-physics-handoff.md`、`soap-film-target.md` 和本迭代文件；继续以 `artifacts/targets/soap-film-reference.jpg` 与 Huang et al. 2020 全文模型并列为最高优先级。上一轮最新有效图为 `run-2551-beauty-huang-phase-fill-response-headed-check.png`，指标为 `eta.thickFraction=0.3771`、`phase.highFraction=0.1411`、`velocity.interiorActiveFraction=0.2041`、`foam.visibleFraction=0.2841`。它比前一版恢复了厚膜和相场面积，但人工对照参考图后仍失败：画面仍是完整小球上的橙/奶金纹理，没有参考图中贯穿中部的青绿分叉河道、紫蓝窄边和沿边界密集的白/奶金微滴。

对 Huang 2020 的模型差距：当前 `eta/Gamma/u` 已经在动，速度场和投影残差不是空的；问题不在 solid 可见性、初始化或 shader 编译，而在由 `eta/Gamma/u` 派生出的 `filamentConnectivity` 与 `phaseArea` 拓扑。上一轮 `phaseArea` 的面积回补仍会把高相质量以宽片状方式喂回 `PHASE_STEP_FRAGMENT_SHADER`，这与 Huang 模型里由 Marangoni 梯度、可压缩球面速度、局部收缩/剪切形成窄前沿的逻辑不符。

本轮修改：在 `mvp/src/visual/thinFilmSim.js` 的 `PHASE_STEP_FRAGMENT_SHADER` 中加入 `usableFilamentAge`、`filamentSkeletonGate`、`areaSkeletonFill` 和 `areaUngatedFill`。`areaFillBudget` 不再直接大权重进入 support/localHigh/physicalFillGate/areaCorrection/dye/foam，而是必须经过 path、river、connected filament、filament bridge、front age、edge droplet 与 regional ridge 组成的骨架门控；未通过门控的面积回补会作为 drain/penalty 处理。这个修改只读取实时模拟出的膜厚、Gamma、速度、相场、foam、filament 和区域诊断 render target，没有使用贴图、参考图采样、预烘焙纹理、canvas 图案或样式拟合。

验证结果：语法检查 `Get-Content -Raw mvp/src/visual/thinFilmSim.js | node --input-type=module --check` 通过。重启本地服务后，用 headed Chrome 完整验证 `solid -> thickness -> phase -> velocity -> foam -> filamentConnectivity -> phaseArea -> phaseAreaError -> etaGammaVelocity -> gammaCandidate -> gammaRhsResidual -> beauty`，所有最终截图 `ready=true`、`glassVisible=true`、无等待错误、无 console shader error。主要产物：
- `run-2565-2576-huang-skeleton-gated-area-fill-headed-low-capture-results.json`
- `run-2566-thickness-huang-skeleton-gated-area-fill-headed-low.png`
- `run-2567-phase-huang-skeleton-gated-area-fill-headed-low.png`
- `run-2570-filamentConnectivity-huang-skeleton-gated-area-fill-headed-low.png`
- `run-2571-phaseArea-huang-skeleton-gated-area-fill-headed-low.png`
- `run-2576-beauty-huang-skeleton-gated-area-fill-headed-low.png`
- `run-2576-huang-skeleton-gated-area-fill-comparison.json`

数值对比：修改前完整 headed 低参 beauty `run-2563` 为 `eta.mean=0.5457`、`eta.thickFraction=0.2086`、`phase.mean=0.2836`、`phase.highFraction=0.2529`、`foam.visibleFraction=0.2811`、`velocity.interiorActiveFraction=0.3788`。修改后 beauty `run-2576` 为 `eta.mean=0.5468`、`eta.thickFraction=0.2066`、`phase.mean=0.2439`、`phase.highFraction=0.0856`、`foam.visibleFraction=0.2586`、`velocity.interiorActiveFraction=0.3238`。骨架门控确实切断了部分宽片相场正反馈，但把 beauty 的高相压得过低；phase debug 单独看仍有青/紫结构，beauty 中仍没有可见的青绿河网。

图像偏差：参考图的橙金厚膜占主体，并被青绿河道切割成大陆状区域，河道边界有窄紫蓝干涉带，奶金/白色微滴沿相界密集分布。`run-2576` 仍是橙/奶金完整球，内部只有灰绿/浅色宽纹和局部块状纹理；`run-2570 filamentConnectivity` 和 `run-2571 phaseArea` 依然偏大块片状 magenta 支持，说明当前支撑场不是细骨架；微滴有但偏少，且没有沿青绿/紫蓝边界聚集。相似点只剩：壳层可见、膜厚非均匀、速度/eta/Gamma/u 诊断有效、未使用贴图。

下一步计划：不要改构图，不调 beauty 颜色。下一轮应把骨架/宽度竞争继续前移到 `filamentConnectivity` 或 Gamma projection 诊断里，而不是在 `PHASE_STEP` 末端补救。具体做法：让 `filamentConnectivity` 输出真正的 front-distance/geodesic relaxation 场，并显式增加横向非极大值抑制与 tile-level 质量守恒，只允许持久且窄的前沿作为 `areaSkeletonFill`；同时检查 `phaseArea` debug 的 magenta 宽片到底来自 `filament.r/g`、`regional.a` 还是 `pathAcross`，必要时新增一个诊断通道显示 `filamentSkeletonGate/areaUngatedFill`。目标是让 `phase.highFraction` 回到约 0.15-0.25，但以窄分叉河道而非整片高相实现；随后再让薄膜干涉色从该 `eta/Gamma/u + phase/foam` 场自然推出青绿/紫蓝，而不是手工上色。
## 2026-06-01 heartbeat / Run 2577-2619：新增 phaseArea 骨架诊断，并确认失败源是 filament/geodesic 宽面而不是调色

开始前检查：本轮继续按要求重读 `artifacts/targets/soap-film-huang-2020-fulltext-notes.md`、`soap-film-physics-handoff.md`、`soap-film-target.md` 和本迭代文件，并重新对照上一轮 `run-2576-beauty-huang-skeleton-gated-area-fill-headed-low.png`、`run-2570 filamentConnectivity`、`run-2571 phaseArea` 与 `artifacts/targets/soap-film-reference.jpg`。结论不变：solid/初始化/渲染链路不是主故障；上一轮 beauty 与参考图几乎不相似，缺少中部青绿分叉河道、紫蓝窄边和沿界面密集奶金/白色微滴。问题来自物理场拓扑：`filamentConnectivity` 与 `phaseArea` 仍是面状支撑。

本轮实现：

- 新增 `phaseAreaSkeleton` debug view，URL 可用 `filmDebugView=phaseAreaSkeleton`。该视图复用实时 GPU 物理场，不使用贴图/参考图/canvas 图案，通道含义为 `r=skeletonEvidence`、`g=frontUsable`、`b=areaGate`、`a=fillBudget`。
- `window.__soapFilmDebug.filmDiagnostics` 新增 `phaseAreaErrorTarget` 与 `phaseAreaSkeletonTarget` 的 readback 统计。诊断 RT 改为 8-bit diagnostic target，主模拟 `phaseAreaTarget` 仍保持浮点，避免为了读数牺牲模拟精度。
- 在 `PHASE_AREA_FRAGMENT_SHADER` 中加入 `narrowSkeletonGate` 与 `compactLineGate`，使面积填充不再直接相信宽的 geodesic/frontAge，而必须通过 `narrowPhysicalLine`、`capillaryFilament`、`filamentNarrow * connectedFilament`、`lineEvidence * filamentNarrow` 等更紧凑的物理线证据。
- 在 `FILAMENT_CONNECTIVITY_FRAGMENT_SHADER` 中收紧历史传播：`prevC.r/g` 不能再无条件自我延寿，必须经过 `narrowHistoryGate`，更接近 Huang 2020 中 velocity-aligned transport 的含义。

验证截图：

- 完整顺序截图：`run-2594-2606-huang-narrow-skeleton-gated-area-final-headed-low-capture-results.json`，包含 `solid/thickness/phase/velocity/foam/filamentConnectivity/phaseArea/phaseAreaSkeleton/phaseAreaError/etaGammaVelocity/gammaCandidate/gammaRhsResidual/beauty`。`solid` 可见；`thickness` 截图存在但 Playwright 等待函数偶发 timeout，画面实际已渲染。
- 通道统计补抓：`run-2610-2612-huang-phasearea-readable-channel-stats-headed-low-capture-results.json`、`run-2613-2616-huang-filament-history-gated-stats-headed-low-capture-results.json`、`run-2617-2619-huang-compact-line-area-gate-stats-headed-low-capture-results.json`。
- 最新 beauty：`run-2619-beauty-huang-compact-line-area-gate-stats-headed-low.png`。

关键数值：

- 收紧前 `run-2611/run-2612` 显示 `broadSheet.mean=0`，但 `skeletonEvidence.mean≈0.54`、`frontUsable.mean≈0.67`、`areaGate.mean≈0.72`、`areaGate>0.35≈0.76`。这证明宽片不是 `broadSheet` 漏判，而是上游 filament/geodesic/frontAge 已经把“骨架”本身铺成了面。
- 只收紧 filament 历史传播后反而更宽：`run-2616 beauty` 中 `areaGate.mean≈0.843`、`areaGate>0.35≈0.872`，说明 `lineNms/localContinuity/geodesicContinuity` 仍会把宽面当作可传播前沿。
- 加入 `compactLineGate` 后，`run-2619 beauty` 降到 `areaGate.mean=0.3096`、`areaGate>0.35=0.3369`、`fillBudget.mean=0.0424`；但 `skeletonEvidence.mean=0.6813`、`frontUsable.mean=0.7647` 仍偏高，说明上游骨架诊断仍不可信。

图像对照：

- 相似点：solid 可见；thickness 仍有真实膜厚线状变化；诊断链路现在能明确读出 `eta/Gamma/u` 与 phaseArea 通道；没有使用贴图、参考图采样、预烘焙纹理、canvas 图案或样式拟合。
- 主要偏差：`run-2619 beauty` 仍不是参考图。参考图是橙金厚膜大陆被青绿分叉河道切开，边界有紫蓝窄带和密集奶金微滴；当前结果上半部过亮发白、青绿分叉不足、紫蓝边界几乎没有，微滴也没有沿相界聚集。`phaseAreaSkeleton`/`phaseAreaError` 已从“整片洋红”降了一些，但仍表现为块状/像素化通道，不是连续流体前沿。
- 失败原因：当前 `filamentConnectivity` 的 `localEvidenceAt` 和历史传播仍把宽的梯度/边界/旧前沿当作窄线。Huang 2020 的主模型要求窄结构来自球面 `eta/Gamma/u` 的 Marangoni 压缩、速度散度和表活剂梯度耦合；而当前 phase/filament 仍含太多派生启发式反馈。不能通过调 beauty 颜色或构图解决。

下一步计划：

1. 新增或重构 `filamentConnectivity` 的通道统计，直接读出 `rawFilament/frontAge/dropletEdge/widthSheetReject` 均值与覆盖率，确认究竟是 `localEvidenceAt` 太宽、`lineNms` 太松，还是历史传播仍在扩散。
2. 将 `localEvidenceAt` 改为更严格的球面非极大值抑制：要求横向梯度峰值大于纵向梯度且两侧下降，宽片必须被 `widthSheetReject` 迅速杀掉；历史传播只能沿速度方向的上风窄线进行。
3. 继续把 phaseArea 作为下游面积约束，不能让它反向制造骨架；目标是先让 `areaGate>0.35` 降到 0.15-0.25 且形成连续分叉线，而不是整球/块状覆盖。
4. 只有当 `filamentConnectivity` 与 `phaseAreaSkeleton` 出现细长、分叉、低宽片覆盖后，才继续恢复青绿/紫蓝干涉强度和微滴密度；仍不改构图、不调色救场。

## 2026-06-01 heartbeat / Run 2620-2640：filament 前缘年龄场收窄，确认 beauty 仍缺真实青绿/紫蓝物理通道

开始前检查：本轮按 heartbeat 要求重新读取 `artifacts/targets/soap-film-huang-2020-fulltext-notes.md`、`soap-film-physics-handoff.md`、`soap-film-target.md` 和本迭代文件，并强制对照上一轮最新 beauty `run-2619-beauty-huang-compact-line-area-gate-stats-headed-low.png`、`phaseAreaSkeleton/phaseAreaError/filamentConnectivity` 调试图与 `artifacts/targets/soap-film-reference.jpg`。结论：solid/壳层/初始化不是主故障；上一轮仍是完整小球上的棕金/白亮区域，缺少参考图中橙金厚膜大陆、青绿分叉河道、紫蓝窄边和沿边界密集奶金/白色微滴。按 Huang 2020 全文模型对照，失败点仍是由 `eta/Gamma/u` 派生的前沿连通与相场面积约束，而不是构图或调色。

本轮实现：

- 在 `mvp/src/visual/thinFilmSim.js` 新增 `FILAMENT_CONNECTIVITY_DIAGNOSTIC_FRAGMENT_SHADER`、`filamentConnectivityDiagnosticTarget` 与 `filamentConnectivityTarget` readback 统计，通道含义为 `r=rawFilament, g=frontAge, b=dropletEdge, a=widthSheetReject`。该 target 只做 8-bit 诊断拷贝，不参与主模拟或 beauty 渲染。
- 第一轮截图 `run-2620-2629-huang-filament-channel-stats-headed-low-capture-results.json` 证明病灶明确：最新 beauty 中 `rawFilament.mean≈0.0885`、`rawFilament>0.35≈0.0791`，但 `frontAge.mean≈0.5598`、`frontAge>0.35≈0.9531`，即历史/前缘年龄几乎铺满区域图，导致 `phaseArea` 把宽面误当成骨架。
- 随后把 `FILAMENT_CONNECTIVITY_FRAGMENT_SHADER` 的 `frontAge` 改为只能经 `ageLineGate` 沿 `lineNms/geodesicContinuity/widthCore/localRaw` 认可的窄线输运；宽片、横向旧前沿、`widthPenalty` 和 `broadSheet` 会直接削弱年龄传播。`PHASE_AREA_FRAGMENT_SHADER` 侧也把 `frontAge` 先乘以 `filamentNarrow` 和宽面拒绝门，再参与 `geodesicLine/frontUsable`。

验证结果：

- 语法检查通过：`Get-Content -Raw -Encoding UTF8 mvp/src/visual/thinFilmSim.js | node --input-type=module --check`。
- 第二轮完整验证 `run-2630-2639-huang-age-gated-filament-headed-low-capture-results.json` 覆盖 `solid/thickness/phase/velocity/foam/filamentConnectivity/phaseArea/phaseAreaSkeleton/phaseAreaError/beauty`。`run-2630-solid...png` 红色实体壳清晰可见，最小可见性仍成立。
- `thickness` 在 Playwright 的 `renderCount>=24` 等待上仍偶发超时，但单独重拍 `run-2640-thickness-huang-age-gated-thickness-retry-headed-low-error.png` 实际画面已渲染出橙色膜厚网络；随后直接读 `window.__soapFilmDebug` 得到 `debugView=thickness`、`renderCount=3`、`filmDiagnostics` 有效，说明是低参+readback 下帧率/等待阈值问题，不是黑屏或 debug null。
- 关键数值改善：`frontAge>0.35` 从上一轮 beauty 的约 `0.9531` 降到 `run-2639 beauty` 的约 `0.0400`；`frontAge.mean` 从约 `0.5598` 降到 `0.0367`。`phaseAreaSkeleton.frontUsable.mean` 从约 `0.6338` 降到约 `0.1033`，`areaGate.mean≈0.2620`、`areaGate>0.35≈0.3018`。这说明宽面历史传播被明显切断。

图像对照：

- 相似点：solid 可见；thickness 仍有真实膜厚不均；`filamentConnectivity` 不再是全球洋红宽面，已经收缩到较暗的局部青绿/边界块；没有使用贴图、参考图采样、预烘焙纹理、canvas 图案、样式拟合或构图修改。
- 主要偏差：`run-2639-beauty-huang-age-gated-filament-headed-low.png` 仍不接近参考图。参考图是橙金厚膜被青绿分叉河道切开，河道边有紫蓝窄干涉带，微滴沿界面密集；当前 beauty 仍是完整小球上的低饱和橙棕膜，只有一条弱青白线和少量边界高光，没有连续青绿河网，也没有紫蓝窄边和奶金/白色微滴密度。
- 粗略颜色统计写入 `run-2639-huang-age-gated-color-comparison.json`：参考图前景中 `orange_gold≈0.2866`、`cyan_green≈0.0625`、`purple_blue≈0.0301`、`white_cream≈0.0063`；最新 beauty 前景中 `orange_gold≈0.9665`，`cyan_green=0`、`purple_blue=0`、`white_cream≈0.0098`。这个统计只用于对比失败，不参与生成；它证明当前缺色来自物理场没有形成薄通道/相位边界，而不是需要给 shader 硬补颜色。

失败原因：本轮修掉了 `frontAge` 全域扩散，但相场/foam 现在偏保守、过稀，`eta/Gamma/u` 仍没有在球面上形成 Huang 2020 所需的连续 Marangoni 压缩前沿。`phaseAreaSkeleton` 由整片宽面变成块状稀疏信号，说明方向正确但还缺真正的 velocity-aligned geodesic relaxation 和 tile-level 守恒输运；`beauty` 仍读不到足够的薄膜通道、边界相位和微滴密度，因此青绿/紫蓝为 0。

下一步计划：继续不改构图、不调 beauty 颜色。下一轮应把 `phase/foam` 的恢复放回 Huang 主模型：让 `eta/Gamma/u` 的球面散度、Marangoni 压缩和局部收缩直接产生连续薄通道，再由 `PHASE_STEP` 做守恒输运，而不是靠 `frontAge` 面状记忆。具体应先重查 `riverPhase` 与 `phaseArea` 的耦合：把 `areaGate` 目标降到 0.15-0.25 但保持连通线；增强 `bridgeVelocityAt`/`physicalFillGate` 对 `Gamma` 梯度和压缩散度的依赖；foam 出生只允许在高曲率/高剪切/高相界边界上产生离散微滴。验证继续按 `solid -> thickness -> phase -> velocity -> foam -> filamentConnectivity -> phaseArea -> phaseAreaSkeleton -> beauty`，并强制与参考图和 Huang 2020 全文模型逐项对照。

## 2026-06-01 heartbeat / Run 2641-2667：把 Huang 压缩证据接入 phase/filament，确认仍未达到参考图

开始前检查：本轮重新读取 `artifacts/targets/soap-film-huang-2020-fulltext-notes.md`、`artifacts/targets/soap-film-physics-handoff.md`、`artifacts/targets/soap-film-target.md` 和本迭代文件；重新查看 `soap-film-reference.jpg`、上一轮最新 `run-2639-beauty-huang-age-gated-filament-headed-low.png`，以及 `thickness/phase/foam/filamentConnectivity/phaseArea/phaseAreaSkeleton` 调试图。结论：上一轮已恢复 solid 最小可见性并收窄了 frontAge，但 beauty 仍是完整小球、低饱和橙棕膜，缺参考图中的橙金厚膜大陆、青绿分叉河道、紫蓝窄边与沿相界密集奶金/白色微滴。Huang 2020 对照也指向同一故障：`eta/Gamma/u` 没有把 Marangoni 压缩和球面速度散度转成连续薄膜通道。

本轮实现：先在 `PHASE_STEP_FRAGMENT_SHADER` 中加入由 `Gamma` 梯度、膜厚曲率、速度压缩和相界梯度组成的 `huangLineSource`，并让 `bridgeVelocityAt` 读取表活剂梯度以增强沿物理 ridge 的输运。随后在 `FILAMENT_CONNECTIVITY_FRAGMENT_SHADER` 中加入 Marangoni 细线证据：使用球面 `grad(Gamma)` 的横向峰值、`eta` 横向曲率、局部速度收敛与 NMS 宽度过滤生成 `huangCompressionSeed`，接入 raw filament、front age 和 droplet edge。最后在 `PHASE_STEP_FRAGMENT_SHADER` 中降低已通过宽片排斥的 raw filament 门槛，让 `rawFilamentGate/dropletFilamentGate` 直接抬高相场目标、物理填充门和 foam 成核。所有新增信号都来自实时膜厚、表活剂、速度、曲率、相场和泡沫物理场；没有使用贴图、参考图采样、预烘焙纹理、canvas 图案、样式拟合或构图修改。

验证结果：语法检查 `Get-Content -Raw mvp/src/visual/thinFilmSim.js | node --input-type=module --check` 通过。三轮 headed Chrome 截图分别为 `run-2641-2649-huang-gamma-compression-phase-headed-low-capture-results.json`、`run-2650-2658-huang-compression-filament-headed-low-capture-results.json`、`run-2659-2667-huang-phase-filament-feed-headed-low-capture-results.json`，每轮均覆盖 `solid -> thickness -> phase -> velocity -> foam -> filamentConnectivity -> phaseArea -> phaseAreaSkeleton -> beauty`。`solid` 全部可见；除 thickness 的 Playwright `domcontentloaded` 等待偶发 timeout 但实际保存了有效画面外，其余 view 均 `ready=true`，console/shader problem 为 0。

图像对比：`run-2667-beauty-huang-phase-filament-feed-headed-low.png` 比 `run-2639` 多了一些真实物理纹理和局部奶白微滴，但仍远不接近参考图。参考图是大视场肥皂膜内的橙金厚膜块被青绿分叉河道切割，河道两侧有紫蓝窄边；当前仍是居中的完整小球，橙棕/暗绿低饱和区域占主导，青绿只在局部低亮边缘若隐若现，紫蓝窄边没有沿河道成形，foam 仍偏宽白片而不是沿边界离散微滴。`phase` 从 `run-2643` 到 `run-2661` 确实出现更多 cyan 斑块，但主体仍是紫暗相界而非连续 cyan 河道；`filamentConnectivity` 的 cyan 证据增强，说明 Marangoni 细线证据已进入诊断层，但 `phaseArea` 仍是暗背景上的块状橙/紫支撑，没有形成 15-25% 连通分叉面积。

粗统计写入 `run-2649-huang-gamma-compression-phase-color-comparison.json`、`run-2658-huang-compression-filament-color-comparison.json` 和 `run-2667-huang-phase-filament-feed-color-comparison.json`。同一阈值下，参考图前景中 `orange_gold≈0.4614`、`cyan_green≈0.1054`、`purple_blue≈0.0429`；最新 `run-2667 beauty` 为 `orange_gold≈0.9583`、`cyan_green=0`、`purple_blue=0`、`white_cream≈0.0045`。该统计只用于失败诊断，不参与生成；它说明缺色仍来自物理场没有产生足够薄通道/相位边界，而不是需要手工调色。

失败原因：`filamentConnectivity` 已能读到 Huang 压缩证据，但 `PHASE_STEP` 仍没有把这些细线转成连续、守恒、可见的高相通道。增加 raw filament 反馈会提高局部 cyan/foam，但也容易把 foam 拉成宽白片；收紧时又只剩稀疏块。下一步应停止继续在相场末端堆权重，转向主模型闭环：把 `eta/Gamma/u` 的压缩散度和 `Gamma` 隐式 projection-like 更新做成可直接读出的连通前沿，再由 `phaseArea` 做面积守恒，而不是由 `phaseArea` 或历史 frontAge 反造骨架。

下一步计划：不改构图、不调 beauty 颜色。下一轮先新增/暴露 `huangLineSource` 或等价的 `eta/Gamma/u` 压缩诊断通道，检查它相对 `filamentConnectivity.r/g/b/a` 的覆盖率和连通性；然后把 phase 填充改成“只沿 Huang 压缩前沿守恒平流 + tile-level 0.15-0.25 面积约束”，并把 foam 出生改成只沿该前沿两侧的曲率/剪切峰值做离散密度。继续按固定顺序截图并逐项对照参考图与 Huang 2020 全文模型。

## 2026-06-01 heartbeat / Run 2668-2695：校正捕获路径，确认 latest beauty 仍是物理场失败

开始前检查：本轮重新读取了 `artifacts/targets/soap-film-huang-2020-fulltext-notes.md`、`artifacts/targets/soap-film-physics-handoff.md`、`artifacts/targets/soap-film-target.md` 和本迭代文件，并重新查看 `artifacts/targets/soap-film-reference.jpg`、上一轮最新 `run-2667-beauty-huang-phase-filament-feed-headed-low.png`，以及 `phase/foam/thickness/filamentConnectivity/phaseArea/phaseAreaSkeleton` 调试图。上一轮与参考图的相似点只有壳层可见、膜厚有非均匀和 `filamentConnectivity` 内存在局部 cyan 压缩证据；关键偏差仍是完整小球几乎全橙棕、没有青绿分叉河道、没有紫蓝窄边、奶金/白色微滴不沿相界密集分布。按 Huang 2020 全文模型对照，`eta/Gamma/u` 的局部压缩诊断没有被守恒输运成可见相场和泡沫前沿。

本轮诊断过程：先尝试把 `huangLocalDiagnosticTarget` 直接采样进 `PHASE_AREA_FRAGMENT_SHADER` 与 `PHASE_STEP_FRAGMENT_SHADER`，让 `-div_s(u)`、`grad_s(Gamma)`、Marangoni gate 和 narrow gate 参与相场/泡沫门控。但第一轮截图 `run-2668..2674` 在 `--use-angle=swiftshader` 捕获路径下出现大量 `THREE.WebGLProgram Shader Error VALIDATE_STATUS false`，非 solid 视图空白。随后撤回这次额外 sampler 改动，并用安装版 Google Chrome headless 且不带 SwiftShader 参数重测，旧 shader 也不再报错。因此本轮确认：这批 shader validation 并不是当前代码的 solid/初始化故障，而是 SwiftShader 路径承载不了当前重着色器组合。后续捕获禁止使用 `--use-angle=swiftshader`，否则会把工具问题误判为物理问题。

正式验证：撤回上述额外 sampler 改动后，用非 SwiftShader Chrome headless 重新跑 `solid -> thickness -> phase -> velocity -> foam -> filamentConnectivity -> phaseArea -> phaseAreaSkeleton -> phaseAreaError -> huangDivergence -> huangGradGamma -> huangMarangoniGate -> huangNarrowGate -> beauty`。产物为 `run-2682-2695-huang-line-diagnostic-restored-headless-low-capture-results.json`，全部 view `status=ok`、`problems=[]`，`solid` 可见，`window.__soapFilmDebug.ready=true`，没有 console/shader error。关键截图包括 `run-2682-solid...png`、`run-2684-phase...png`、`run-2686-foam...png`、`run-2687-filamentConnectivity...png`、`run-2689-phaseAreaSkeleton...png`、`run-2694-huangNarrowGate...png` 和最新 `run-2695-beauty-huang-line-diagnostic-restored-headless-low.png`。

图像与数值对照：`run-2695 beauty` 仍明显失败，仍是完整小球上的橙/棕厚膜外观，几乎没有参考图里贯穿画面的 cyan/green 分叉河道和 purple/blue 窄边。新统计写入 `run-2695-huang-line-diagnostic-restored-color-comparison.json`，同一阈值下参考图前景约 `orange_gold=0.4026`、`cyan_green=0.0388`、`purple_blue=0.1006`、`white_cream=0.0297`；最新 beauty 为 `orange_gold=0.9484`、`cyan_green=0.0001`、`purple_blue=0`、`white_cream=0.0073`。前景覆盖率也从参考图约 `0.8205` 降到 latest beauty 的 `0.1174`，说明当前画面与参考图视野差异仍很大，但本轮按用户要求不修构图，只记录偏差。诊断图中 `huangNarrowGate` 的可见前景约 `0.0006`，几乎只有微弱轮廓/散点；`phaseAreaSkeleton` 仍是块状紫粉支撑，`foam` 是宽的奶灰片，不是离散边界微滴。

失败原因：本轮确认渲染链路可信，但 Huang 压缩信号本身太弱、太稀疏，且仍没有被 velocity-aligned 球面输运和 `Gamma` projection-like 更新放大成连续前沿。`filamentConnectivity` 有局部 cyan 证据，证明 `eta/Gamma/u` 不是完全空的；但 `huangNarrowGate` 不能提供连续河道种子，`phaseArea` 又把支持场离散成块，所以 beauty 只能表现为过量橙金厚膜和少量无组织微滴。继续调色、调构图或在 beauty 层补 cyan/purple 都会违背目标，不能做。

下一步计划：不再向 phase shader 额外堆 sampler 或末端权重。下一轮应先在现有 Huang 诊断链里重算 `huangNarrowGate` 的来源：检查 `huangDivergence`、`huangGradGamma`、`huangMarangoniGate` 是否被阈值压得过低，必要时在主 `eta/Gamma/u` 闭环中增强真实 Marangoni 速度与 `Gamma` 隐式投影残差，而不是在渲染层补色。具体目标是让 `huangNarrowGate` 从孤立散点变成连续且窄的 velocity-aligned 前沿，再让 `phaseArea` 只做 0.15-0.25 的 tile-level 守恒面积约束，foam 只在该前沿两侧由曲率/剪切/局部扰动触发离散微滴。下一轮继续先截图对照参考图与 Huang 2020 全文模型，再动代码；捕获使用非 SwiftShader Chrome。

## 2026-06-01 heartbeat / Run 2700-2774：球面度量修正与 foam 微滴局部峰值限制

开始前检查：本轮重新读取了 `artifacts/targets/soap-film-huang-2020-fulltext-notes.md`、`artifacts/targets/soap-film-physics-handoff.md`、`artifacts/targets/soap-film-target.md` 和本迭代文件，并先对照上一轮 `run-2695-beauty-huang-line-diagnostic-restored-headless-low.png`、`run-2687-filamentConnectivity...png`、`run-2694-huangNarrowGate...png` 与 `artifacts/targets/soap-film-reference.jpg`。结论：solid/初始化/渲染链路不是主故障；上一轮仍是完整小球上过量橙棕厚膜，`huangNarrowGate` 近乎黑屏，缺参考图的青绿分叉河道、紫蓝窄边和沿相界的奶金/白色微滴。按 Huang 2020 全文模型对照，主要偏差仍在球面 `eta/Gamma/u` 的 Marangoni 投影、散度/梯度度量和前沿守恒输运。

本轮实现：
- 在 `mvp/src/visual/thinFilmSim.js` 的 Huang/Gamma 相关 shader 中补齐角向微分尺度：`VELOCITY_STEP_FRAGMENT_SHADER`、Gamma implicit/projection/residual/candidate diagnostics、`ETA_GAMMA_VELOCITY_DIAGNOSTIC_FRAGMENT_SHADER`、`HUANG_LOCAL_DIAGNOSTIC_FRAGMENT_SHADER`、`GAMMA_VELOCITY_CORRECTION_FRAGMENT_SHADER` 与 `FILAMENT_CONNECTIVITY_FRAGMENT_SHADER` 现在不再只乘 `sin(theta)`，还把 `phi/theta` 的角分辨率尺度纳入 `grad/div/laplacian` 和 Marangoni projection weights。这是对 Huang 球面算子的物理修正，不是调色。
- 第一次验证后发现 `foam` 被连续白片吞掉，于是把 `FIELD_STEP_FRAGMENT_SHADER` 和 `PHASE_STEP_FRAGMENT_SHADER` 的 foam 更新改成“边界微滴核 + 宽片快速衰减”：保留 `capillaryDropletRidge`、`riverEdgeDroplet`、相界曲率/剪切/filament/Huang 前沿支持，新增局部峰值与邻域均值对比 `foamPeakContrast/localMeanFoam`，只有局部尖峰能作为短寿命微滴留存，均匀白片会被 `fieldBroadFoamSheet/broadFoamSheet` 快速压回。
- 全程没有改构图，没有给 beauty 手工补 cyan/purple，也没有使用贴图、参考图采样、canvas 图案、预烘焙纹理或样式拟合；所有新增信号来自实时 `eta/Gamma/u/phase/foam/filament` 物理场。

验证截图：
- `run-2700-2716-huang-metric-projection-low-capture-results.json` 覆盖 `solid/thickness/phase/velocity/foam/filamentConnectivity/phaseArea/phaseAreaSkeleton/phaseAreaError/etaGammaVelocity/gammaCandidate/gammaRhsResidual/huangDivergence/huangGradGamma/huangMarangoniGate/huangNarrowGate/beauty`。除 `thickness` 偶发等待超时外，其余 OK，`solid` 可见且无 shader/WebGL 报错。
- `run-2717-2723-huang-metric-projection-mid-capture-results.json` 高一点参数验证了同一趋势：`huangNarrowGate` 不再全黑，但仍是断裂散点；`foam` 成大片奶白场。
- `run-2748-2764-foam-micro-nucleus-limiter-low-capture-results.json` 验证第一版 foam 微滴限制；`run-2764` 仍出现大块底部白片。
- 最终本轮采用局部峰值限制后，截图为 `run-2765-2771-foam-local-peak-limiter-low-capture-results.json` 和补拍 `run-2772-2774-foam-local-peak-limiter-low-capture-results.json`。`solid/velocity/foam/filamentConnectivity/phaseArea/phaseAreaSkeleton/huangNarrowGate/beauty` 均 OK 且 `problems=[]`；`thickness` 与 `phase` 仍是 Playwright 等待阈值超时，但 `window.__soapFilmDebug.ready=true`、`glassVisible=true`、`debugView` 正确且截图已落盘，未见 shader/WebGL 报错。

图像与数值对照：
- 正向进展：局部峰值限制后 `run-2771-beauty-foam-local-peak-limiter-low.png` 的连续白片显著减少。粗统计写入 `run-2771-foam-local-peak-limiter-color-comparison.json`：`white_cream` 从 `run-2764` 的约 `0.1962` 降到 `0.0107`，已接近参考图约 `0.0053` 的量级；这说明 foam 现在更像短寿命局部微滴密度，而不是整片白膜。
- 仍然失败：参考图前景约 `orange_gold=0.3389`、`cyan_green=0.0740`、`purple_blue=0.0401`、`white_cream=0.0053`；`run-2771` 为 `orange_gold=0.6537`、`cyan_green=0.0007`、`purple_blue=0.0022`、`white_cream=0.0107`。白片问题被压下后，青绿/紫蓝物理通道不足的问题更明显。
- 物理场自洽性：`run-2768-filamentConnectivity` 与 `run-2769-phaseAreaSkeleton` 仍是沿 UV/速度方向的块状、竖向条带化支撑，不是参考图里的弯曲分叉河网；`run-2770-huangNarrowGate` 仍主要是暗场与局部散点，未形成 Huang 2020 所需的连续 velocity-aligned Marangoni 前沿。

失败原因：本轮修正了球面度量并压住了伪连续 foam，但 `eta/Gamma/u` 主闭环仍没有把 `Gamma` 隐式 projection-like 残差、Marangoni 速度修正和球面 velocity-aligned 平流联成持续窄前沿。`gammaCandidate`、`huangGradGamma`、`huangMarangoniGate` 有大尺度信号，但 `huangNarrowGate/filamentConnectivity/phaseArea` 仍把它离散成网格块或散点，导致 beauty 缺参考图的青绿分叉河道和紫蓝窄边。

下一步计划：停止继续收紧 foam 或调 beauty。下一轮应把重点放回 Huang 主模型：先把 `huangNarrowGate` 的来源从单点阈值改成沿速度方向的球面 NMS/上风连续性诊断，检查 `gammaCandidate` 和 `huangMarangoniGate` 为什么不能被转换成窄而连续的前沿；随后增强 `Gamma` projection-like 更新的残差闭环，让 `eta/Gamma/u` 自己产生 15-25% 的连通薄膜河道，再让 `phaseArea` 只做守恒面积约束，`foam` 只沿该前沿两侧产生离散微滴。

## 2026-06-01 heartbeat / Run 2775-2825：Huang velocity-aligned NMS 与 phase 方向修复，仍未形成参考图河道

开始前检查：本轮重新读取 `artifacts/targets/soap-film-huang-2020-fulltext-notes.md`、`artifacts/targets/soap-film-physics-handoff.md`、`artifacts/targets/soap-film-target.md` 和本迭代文件，并先查看 `soap-film-reference.jpg`、上一轮 `run-2771-beauty-foam-local-peak-limiter-low.png`、`run-2770-huangNarrowGate-foam-local-peak-limiter-low.png`、`run-2768-filamentConnectivity-foam-local-peak-limiter-low.png`、`run-2769-phaseAreaSkeleton-foam-local-peak-limiter-low.png` 与 `run-2767-foam-foam-local-peak-limiter-low.png`。上一轮相似点只有 solid/壳层稳定、foam 白片已被压下、膜厚存在非均匀；关键偏差仍是完整小球、没有连续青绿分叉河道、没有贴河道的紫蓝窄边，`huangNarrowGate` 太散，`phaseAreaSkeleton` 与 `filamentConnectivity` 仍呈块状/竖向网格化。按 Huang 2020 全文模型对照，失败点仍是 `eta/Gamma/u` 的 Marangoni 压缩证据没有被球面速度方向输运成守恒窄前沿。

本轮实现：在 `HUANG_LOCAL_DIAGNOSTIC_FRAGMENT_SHADER` 中把原来的点阈值诊断拆成 `huangEvidenceAt()` 与 `huangLineScalar()`，新增沿局部速度、`grad_s(Gamma)` 切向和横向采样的球面 NMS、side rejection、along/upwind continuity，把 alpha 改成 velocity-aligned narrow gate。随后在 `FILAMENT_CONNECTIVITY_FRAGMENT_SHADER` 中新增 `uHuangLocalDiagnostic`，把 Huang narrow gate 的沿向连续、横向抑制和 Marangoni/压缩证据接入 raw filament、seed evidence、width core 与 front age。第二步尝试把 `phaseArea` 与 `phase` 的主方向改成由全局流向、局部速度和 Gamma 切向共同决定；中间一次 patch 误打到早期 regional support shader，导致 `gradG undeclared identifier` 的 shader 编译错误，随后已撤回错误位置并只在 `PHASE_AREA_FRAGMENT_SHADER` 与 `PHASE_STEP_FRAGMENT_SHADER` 中 `gradG/gradGamma` 已定义的位置保留方向修复。所有新增信号仍来自实时 `eta/Gamma/u/phase/foam/filament` 物理场；没有贴图、参考图采样、canvas 图案、预烘焙纹理、样式拟合或构图修改。

验证截图：第一轮有效验证为 `run-2775-2791-huang-velocity-nms-filament-low-capture-results.json`，覆盖 `solid/thickness/phase/velocity/foam/filamentConnectivity/phaseArea/phaseAreaSkeleton/phaseAreaError/etaGammaVelocity/gammaCandidate/gammaRhsResidual/huangDivergence/huangGradGamma/huangMarangoniGate/huangNarrowGate/beauty`；`solid` 可见，主要 view 无 shader/WebGL 问题，`thickness` 只有导航等待超时但 debug readback 有效。中间 `run-2792-2808-huang-velocity-aligned-phase-low-capture-results.json` 因上述 misplaced patch 出现 shader compile error，标记为无效中间轮，不用于视觉判断。修复后最终有效验证为 `run-2809-2825-huang-velocity-aligned-phase-fixed-low-capture-results.json`；`solid`、`phase`、`velocity`、`foam`、Huang 诊断、`beauty` 均 `ready=true` 且 `problemCount=0`，`thickness` 仍是导航超时但 `window.__soapFilmDebug.ready=true`、截图有效。

图像与数值对照：第一轮 `run-2791-beauty-huang-velocity-nms-filament-low.png` 没有成功，`huangNarrowGate` 可见覆盖从上一轮约 `0.0713` 提到约 `0.0846`，但 beauty 变成更大面积橙金，青绿和紫蓝几乎消失。最终 `run-2825-beauty-huang-velocity-aligned-phase-fixed-low.png` 进一步偏离参考：画面是浅粉/奶金完整小球和底部金色噪声，仍没有参考图里 15-25% 的青绿弯曲分叉河道，也没有贴河道的紫蓝窄边。粗统计写入 `run-2825-huang-velocity-aligned-phase-fixed-color-comparison.json`：参考图前景约 `orange=0.1783`、`cyan=0.0876`、`purple=0.0339`；`run-2825` 为 `orange=0.0846`、`cyan=0.0016`、`purple=0.0016`、`white=0.1665`，说明这轮把干涉结果压成浅色/奶色而不是生成物理河道。`run-2814-filamentConnectivity` 有更多 cyan 支撑但仍是宽块；`run-2816-phaseAreaSkeleton` 仍是网格状紫粉块；`run-2824-huangNarrowGate` 覆盖约 `0.0836`，但主要是散点和局部块，不是连续 velocity-aligned 前沿。

失败原因：Huang narrow gate 的 NMS/上风连续性让诊断图稍微不再全暗，但它仍没有成为可输运的连续中心线；把该诊断喂给 filament 后，物理证据被扩大成宽块，而不是变成参考图中的窄河道。`phaseArea` 与 `phase` 的局部速度/Gamma 切向方向修复没有解决面积守恒和连通性，反而让 beauty 的相位分布退化成低饱和浅色片。根因仍在主 `eta/Gamma/u` 闭环：`Gamma` projection-like 更新和 Marangoni 速度修正没有把残差变成守恒窄前沿，后级 phase/filament 只能在散点、宽块和浅色片之间摆动。

下一步计划：不要继续调 beauty、构图或 foam 颜色。下一轮先把 Huang 诊断从“显示门控”推进到真正的状态变量：在低分辨率 ping-pong target 中保存 `lineDistance/occupancy/lineAge/sideReject`，只沿 velocity/Gamma tangent 做守恒传播，并用 side NMS 维持窄宽度；同时检查 `Gamma` projection-like residual 是否需要作为源项回写到速度校正，而不是只用于可视化。验收目标先放在 debug：`huangNarrowGate`、`filamentConnectivity`、`phaseAreaSkeleton` 必须先出现连续弯曲分叉中心线，再允许它驱动 `phase/foam/beauty`。

## 2026-06-01 heartbeat / Run 2826-2868：Huang 前沿状态变量接入与全分辨率修正，仍未达到参考图

开始前检查：本轮重新读取 `artifacts/targets/soap-film-huang-2020-fulltext-notes.md`、`artifacts/targets/soap-film-physics-handoff.md`、`artifacts/targets/soap-film-target.md` 和本迭代文件，并强制查看 `soap-film-reference.jpg`、上一轮最新 `run-2825-beauty-huang-velocity-aligned-phase-fixed-low.png`、`run-2824-huangNarrowGate-huang-velocity-aligned-phase-fixed-low.png`、`run-2814-filamentConnectivity-huang-velocity-aligned-phase-fixed-low.png`、`run-2816-phaseAreaSkeleton-huang-velocity-aligned-phase-fixed-low.png` 与 `run-2813-foam-huang-velocity-aligned-phase-fixed-low.png`。对照结论：上一轮 solid/壳层可见，但 beauty 是浅粉/奶金完整小球，缺参考图中的橙金厚膜大陆、青绿分叉河道、紫蓝窄边和沿界面密集奶金/白色微滴；`huangNarrowGate` 仍是散点/局部块，`filamentConnectivity` 与 `phaseAreaSkeleton` 仍是宽块和网格。按 Huang 2020 全文模型对照，`eta/Gamma/u` 的 Marangoni 压缩证据还没有形成可守恒输运的球面窄前沿。

本轮实现：新增 `HUANG_FRONT_STATE_FRAGMENT_SHADER` 和 `huangFrontStateRead/WriteTarget`，把上一轮计划中的 `lineDistance/occupancy/lineAge/sideReject` 做成真实 ping-pong 状态变量。该状态只读取实时 `eta/Gamma/u`、`huangLocalDiagnostic` 和上一帧前沿，沿局部速度、全局流向与 `grad_s(Gamma)` 切向混合方向做上风传播，并用横向采样做 side NMS；随后把 `uHuangFrontState` 接入 `FILAMENT_CONNECTIVITY_FRAGMENT_SHADER`，作为细丝连通的物理前沿证据，而不是直接给 beauty 补色。第一版用区域分辨率时读回触发 `WebGL: INVALID_OPERATION: readPixels: type HALF_FLOAT but ArrayBufferView not Uint16Array`，已改为单独 `frontStateTargetOptions`，使用可读回的 `UnsignedByteType` 状态 target。第二版发现 32x32 区域状态在 debug 中形成明显块状网格，于是把 Huang 前沿状态提升到主模拟分辨率 `huangFrontStateSize=size`，`uTileTexel` 同步改为前沿状态 texel，读回与统计也改为全分辨率。

验证结果：`thinFilmSim.js`、`logoScene.js`、`controlSchema.js` 均按 UTF-8 通过 `node --input-type=module --check`。新增非 SwiftShader Chrome/CDP 截图脚本 `artifacts/targets/capture-soap-front-state.mjs`，只用于验证，不参与模拟。第一轮 `run-2826-2842-huang-front-state-low-capture-results.json` 证明 shader 可渲染但 HalfFloat 读回错误污染控制台；修复 target 类型后，`run-2843-2859-huang-front-state-byte-low-capture-results.json` 除 `thickness` 的 CDP 等待问题外全部 `problemCount=0`，另补拍 `run-2862-thickness-huang-front-state-byte-low.png`。全分辨率修正后，关键六视图 `run-2863-2868-huang-front-state-fullres-low-capture-results.json` 覆盖 `solid/thickness/huangFrontState/filamentConnectivity/phaseAreaSkeleton/beauty`，全部截图成功且 `problemCount=0`；`solid` 最小可见性仍成立。

图像对比：第一版 `run-2851-huangFrontState-huang-front-state-byte-low.png` 有前沿状态信号，但呈区域块状；`run-2859-beauty-huang-front-state-byte-low.png` 仍是大面积奶白球，只在底部有棕金噪声，完全缺连续青绿河道。全分辨率后 `run-2865-huangFrontState-huang-front-state-fullres-low.png` 消除了大块像素格，但变成噪声云和局部弧线，仍不是参考图那种连续、分叉、窄边界河网；`run-2866-filamentConnectivity` 仍是宽块，`run-2867-phaseAreaSkeleton` 仍是网格状紫粉支撑。最终 `run-2868-beauty-huang-front-state-fullres-low.png` 只有左侧/底部出现更多橙棕厚膜，主体仍是奶白/浅粉完整小球，没有青绿分叉河道和紫蓝窄边。

量化对照：统计只用于失败诊断，不参与生成。`run-2859-huang-front-state-byte-color-comparison.json` 中参考图前景约 `orangeGold=0.3665`、`cyanGreen=0.1379`、`purpleBlue=0.1049`、`milkWhite=0.0002`、`brightDroplet=0.1260`；`run-2859 beauty` 为 `orangeGold=0.0942`、`cyanGreen=0.0001`、`purpleBlue=0.0097`、`milkWhite=0.7647`、`brightDroplet=0.8563`。全分辨率后 `run-2868-huang-front-state-fullres-color-comparison.json` 中 `beauty` 变为 `orangeGold=0.1492`、`cyanGreen=0.0001`、`purpleBlue=0.0154`、`milkWhite=0.4837`、`brightDroplet=0.7744`：橙金有所恢复、奶白减少，但青绿仍几乎为零，紫蓝仍远低于参考。对应 debug 数值：`eta.mean≈0.4914`、`eta.thickFraction≈0.0641`、`frontOccupancy.mean≈0.1698`、`frontAge.mean≈0.1207`、`filamentRaw.mean≈0.3395`、`phaseAreaSkeleton.skeletonEvidence.mean≈0.3937`。

失败原因：本轮把 Huang 前沿从显示门控推进成了真实状态变量，并修复了读回与分辨率问题，但状态传播还没有实现 Huang 2020 所需的稳定 chemomechanical/lubrication 闭环。前沿状态有信号，却不是守恒、连续、窄宽度的 velocity-aligned 分叉中心线；进入 `filamentConnectivity` 后仍被扩大成宽块或噪声云，`phaseAreaSkeleton` 继续离散成网格支撑，最终干涉色只能表现为奶白厚膜和局部棕金，无法产生参考图中的 cyan/green 薄通道与 purple/blue 窄边。继续调色、改构图或直接在 beauty 层补色都不能解决，也不允许。

下一步计划：不改构图、不调 beauty 颜色、不采样参考图。下一轮应先修 `HUANG_FRONT_STATE_FRAGMENT_SHADER` 的数值形式：把当前多方向 max/宽邻域传播改为更接近 Huang 2020 的 velocity-aligned 球面守恒前沿，降低局部噪声源，加入沿线二阶平滑但保持横向 NMS，并让 `occupancy` 必须同时满足 `Gamma` 梯度横向峰值、速度压缩和 `eta` 曲率三者中的至少两项；同时把 `filamentConnectivity` 对 `huangFrontState` 的读取改成只接受 `occupancy` 高且 `sideReject` 低的窄线，禁止再把前沿扩成宽块。验收仍先看 debug：`huangFrontState -> filamentConnectivity -> phaseAreaSkeleton` 必须形成连续弯曲分叉线，再允许驱动 `phase/foam/beauty`。

## 2026-06-01 heartbeat / Run 2869-2898：Huang 前沿二取二物理门控接入，debug 收窄但 beauty 仍失败

开始前检查：本轮重新读取了 `artifacts/targets/soap-film-huang-2020-fulltext-notes.md`、`artifacts/targets/soap-film-physics-handoff.md`、`artifacts/targets/soap-film-target.md` 和本迭代文件，并强制查看 `soap-film-reference.jpg`、上一轮最新 `run-2868-beauty-huang-front-state-fullres-low.png`、`run-2865-huangFrontState-huang-front-state-fullres-low.png`、`run-2866-filamentConnectivity-huang-front-state-fullres-low.png`、`run-2867-phaseAreaSkeleton-huang-front-state-fullres-low.png`、`run-2864-thickness-huang-front-state-fullres-low.png`。对照结论：上一轮 solid/thickness 可见，说明不是最小可见性问题；但 beauty 仍是奶白/浅粉完整小球，缺参考图的橙金厚膜大陆、青绿分叉河道、紫蓝窄边和边界奶金/白色微滴。`huangFrontState` 是噪声云与局部弧线，`filamentConnectivity` 是宽块，`phaseAreaSkeleton` 仍有明显块状/网格支撑；按 Huang 2020 全文模型，这说明 `eta/Gamma/u` 的 Marangoni 压缩证据还没有成为守恒、连续、窄宽度的 velocity-aligned 前沿。

本轮实现只改 `mvp/src/visual/thinFilmSim.js`，没有改构图、相机、beauty 调色，也没有使用贴图、参考图采样、预烘焙纹理、canvas 图案、样式拟合或假纹理。第一步在 `HUANG_FRONT_STATE_FRAGMENT_SHADER` 内加入球面 `laplacian` 与 `div_s(u)`，让前沿种子不再只由已有 Huang local diagnostic 邻域 max 触发，而必须由 `Gamma` 横向峰、`eta` 曲率/谷线、速度压缩/剪切三类 Huang 主变量证据中的至少两类共同支持；同时加入沿线二阶距离平滑、横向 NMS、历史宽片惩罚和 `missingPhysicsReject`。第二步在 `FILAMENT_CONNECTIVITY_FRAGMENT_SHADER` 中把 `uHuangFrontState` 的读取改成高 occupancy、低 sideReject、低横向 side occupancy 的窄线门控，降低 `hfTransport` 直接推高 raw filament、seed、widthCore、geodesicContinuity 和 frontAge 的权重，避免把前沿状态再扩成宽块。

中间验证 `run-2869-2878-huang-front-state-narrow-gates-low-capture-results.json` 暴露一次 shader 编译错误：新增球面算子被误插入到前面的 `soap-film-velocity-step` shader，导致 `uFieldTexel` 未声明和函数重复定义；该中间轮只作为错误记录，不用于视觉评价。随后删除误插入段，并把算子放回 `HUANG_FRONT_STATE_FRAGMENT_SHADER` 正确位置。`thinFilmSim.js`、`logoScene.js`、`controlSchema.js` 均按 UTF-8 通过 `node --input-type=module --check`。

有效验证分两组：严格门控版 `run-2879-2888-huang-front-state-narrow-gates-fixed-low-capture-results.json` 覆盖 `solid/thickness/phase/velocity/foam/filamentConnectivity/phaseArea/phaseAreaSkeleton/huangFrontState/beauty`，全部 `problemCount=0`。但它把前沿杀得太狠：`frontOccupancy.mean` 从上一轮 `0.1698` 降到 `0.0507`，`frontSideReject.mean` 从 `0.1823` 升到 `0.4964`，beauty 的奶白比例更高。随后保留二取二物理门控，但降低 reject 输出、历史宽片惩罚和 sideReject 对 occupancy 的杀伤，得到最终有效验证 `run-2889-2898-huang-front-state-balanced-gates-low-capture-results.json`；所有视图仍 `problemCount=0`，`solid` 最小可见性成立，`thickness/phase/velocity/foam/filamentConnectivity/phaseArea/phaseAreaSkeleton/huangFrontState/beauty` 均成功截图。

最终图像对照：`run-2897-huangFrontState-huang-front-state-balanced-gates-low.png` 相比上一轮噪声云更暗、更受限制，局部有窄线/竖带；`run-2894-filamentConnectivity` 宽糊略少，但仍是块状青绿/粉色团；`run-2896-phaseAreaSkeleton` 仍是块状/网格支撑，而不是参考图那种连续弯曲分叉河道骨架。`run-2898-beauty-huang-front-state-balanced-gates-low.png` 仍是奶白/浅粉完整小球，下缘有棕金厚膜和细微纹理，但没有可见的青绿分叉河道、紫蓝窄边或沿边界密集奶金/白色微滴。

量化对照写入 `run-2898-huang-front-state-balanced-gates-color-comparison.json`，统计只用于失败诊断，不参与生成。参考图同口径约 `orangeGold=0.3433`、`cyanGreen=0.0670`、`purpleBlue=0.0377`、`milkWhite=0.0004`、`brightDroplet=0.0131`；上一轮 `run-2868` 为 `orangeGold=0.3450`、`cyanGreen=0`、`purpleBlue=0`、`milkWhite=0.6262`、`brightDroplet=0.7389`；最终 `run-2898` 为 `orangeGold=0.1191`、`cyanGreen=0`、`purpleBlue=0`、`milkWhite=0.7727`、`brightDroplet=0.8233`。debug 数值方面，最终 `phase.highFraction=0.1761` 接近面积预算，但形态错误；`frontOccupancy.mean=0.0643` 只比严格版 `0.0507` 略好，仍远低于上一轮 `0.1698`；`frontSideReject.mean=0.3286` 比严格版下降但仍偏高；`filament_rawFilament.mean=0.2942`、`phaseAreaSkeleton.areaGate.mean=0.3957` 说明后级仍把稀疏前沿/旧相场支持扩成块状面积。

失败原因：本轮把 Huang 前沿状态的来源从宽邻域启发式推进到 `Gamma/eta/u` 二取二物理证据，方向符合 Huang 2020 的 `eta/Gamma/u` 自洽耦合要求；但当前仍不是论文第 4.3 节的 staggered spherical `Gamma` projection-like 隐式系统，也没有真正的 velocity-aligned/BiMocq2 守恒平流。新的前沿门控能抑制一部分噪声和宽块，却没有产生连续、可输运、可分叉的中心线；`phaseAreaSkeleton` 仍把面积预算分配到块状支撑，beauty 因此继续缺 cyan/green 薄通道和 purple/blue 窄边。继续调色、改构图或在 beauty 直接补色仍然不允许，也不能解决根因。

下一步计划：

1. 不改构图、不调 beauty 颜色、不采样参考图；继续只从 Huang 2020 主变量 `eta/Gamma/u` 派生。
2. 暂停继续在 `huangFrontState` 里堆阈值；下一轮应把 `Gamma` projection-like 残差真正回写到速度/前沿源项，而不是只作为 local diagnostic。重点检查 `gammaCandidate/gammaRhsResidual/huangGradGamma/huangMarangoniGate` 到 `frontOccupancy` 之间为什么衰减过大。
3. 给前沿状态增加一个保守通量式更新：沿 velocity/Gamma tangent 的 occupancy 通量、横向 NMS 只做宽度约束，不用 `phaseAreaSkeleton` 或历史宽块反造骨架。目标 debug 是 `frontOccupancy.mean` 回到约 `0.12-0.18`，`sideReject.mean` 控制在约 `0.18-0.28`，同时 `filament_rawFilament>0.35` 不超过约 `0.25-0.35` 且形态连续分叉。
4. `phaseArea` 只做 0.15-0.25 的面积守恒分配，不再让块状 support 推高高相；foam 仍只允许在前沿两侧曲率/剪切峰生成离散微滴。
5. 下一轮继续固定顺序 `solid -> thickness -> phase -> velocity -> foam -> filamentConnectivity -> phaseArea -> phaseAreaSkeleton -> huangFrontState -> beauty`，并再次对照参考图与 Huang 2020 全文模型。

## 2026-06-01 heartbeat / Run 2899-2928：Gamma projection 残差回写到速度/前沿，solid 恢复但前沿被块状接收

开始前检查：本轮重新读取了 `artifacts/targets/soap-film-huang-2020-fulltext-notes.md`、`artifacts/targets/soap-film-physics-handoff.md`、`artifacts/targets/soap-film-target.md` 和本迭代文件；并重新查看 `soap-film-reference.jpg`、上一轮 `run-2898-beauty-huang-front-state-balanced-gates-low.png`、`run-2897-huangFrontState...png`、`run-2894-filamentConnectivity...png`、`run-2896-phaseAreaSkeleton...png`、`run-2890-thickness...png`。上一轮结论仍成立：solid/壳层可见性不是主故障；beauty 是奶白/浅粉完整小球，缺参考图中的橙金厚膜大陆、青绿弯曲分叉河道、紫蓝窄边和沿边界密集奶金/白色微滴。按 Huang et al. 2020 全文模型对照，关键缺口是 `Gamma` projection-like residual 只做诊断/门控，没有真正参与 `u` 和前沿通量闭环。

本轮实现只改 `mvp/src/visual/thinFilmSim.js` 和验证脚本 `artifacts/targets/capture-soap-front-state.mjs` 的 Chrome 调试端口选择；没有改构图、相机、beauty 调色，也没有使用贴图、参考图采样、预烘焙纹理、canvas 图案、样式拟合或假纹理。实现上给 `GAMMA_VELOCITY_CORRECTION_FRAGMENT_SHADER` 增加 `uGammaResidual`，把 `gammaCandidateDiagnosticTarget` 中的 `projectedDivergence`、`gammaRhsResidual` 和 `DeltaGamma` 解码后加入 Marangoni closure，并产生受限的 `residualConvergenceSteer` / `residualProjectionSteer`；同时给 `HUANG_FRONT_STATE_FRAGMENT_SHADER` 增加 `uGammaCandidate`，让当前 projection residual 只在同时满足 residual compression、局部 `Gamma/eta` 或 Huang line evidence 时补充 `twoOfThreeGate/localSeed/narrowStateGate`。渲染顺序也改为每次 `Gamma` projection 生成 `gammaCandidateTarget` 后，立即渲染当前 candidate diagnostic，再用它校正速度，避免速度读上一帧 residual。

验证过程：首次 `run-2899-2908-huang-gamma-residual-feedback-low` 是无效中间轮，Chrome 临时调试端口落在 Windows 排除范围 `9432-9531` 内，CDP 连接失败，没有生成有效图像。随后把验证脚本默认调试端口移到未排除区间。第二次 `run-2909-2918-huang-gamma-residual-feedback-low` 暴露真实初始化错误：`assignTextures` 设置 `gammaVelocityCorrectionMaterial.uniforms.uGammaResidual` 时该 uniform 未定义；原因是第一次补 uniform 时误插到别的 material。修复后 `thinFilmSim.js`、`logoScene.js`、`controlSchema.js` 均通过 `node --input-type=module --check`。

有效验证：`run-2919-solid-huang-gamma-residual-feedback-fixed-low.png` 先单独确认 `solid` 红壳恢复，`ready=true`、`debugView=solid`、`renderCount=2`、`problemCount=0`。随后 `run-2920-2928-huang-gamma-residual-feedback-fixed-low-capture-results.json` 覆盖 `thickness/phase/velocity/foam/filamentConnectivity/phaseArea/phaseAreaSkeleton/huangFrontState/beauty`，全部 `problemCount=0`；`thickness` 截图成功但 CDP 结果中 `render=n/a`，没有控制台问题。Codex 内置浏览器当前没有活动窗格，无法接管，因此本轮使用仓库 CDP 截图脚本作为浏览器验证来源。

图像对照：`run-2919-solid...png` 证明壳层可画出。`run-2920-thickness...png` 有更多橙金厚膜通路和局部线状结构，比上一轮厚膜可见性好。`run-2927-huangFrontState...png` 出现大面积青绿噪声/暗区和横向条纹，说明 residual 已进入前沿系统，但没有成为窄、守恒、连续的 velocity-aligned 中心线。`run-2924-filamentConnectivity...png` 被青绿/粉色宽块占据，`run-2926-phaseAreaSkeleton...png` 仍是低分辨率块状紫粉棋盘/竖条支撑。最终 `run-2928-beauty...png` 仍失败：画面是奶白/浅粉完整小球，底部有棕金厚膜噪声和少量拉丝，但没有参考图中贯穿中部的青绿分叉河道、贴河道的紫蓝窄边，也没有沿界面高密度的奶金/白色微滴。

量化对照写入 `run-2928-huang-gamma-residual-feedback-fixed-color-comparison.json`，统计只用于失败诊断，不参与生成。该口径下参考图约 `orangeGold=0.3137`、`cyanGreen=0.0948`、`purpleBlue=0.0598`、`milkWhite=0.0033`、`brightDroplet=0.0046`；上一轮 `run-2898` 为 `orangeGold=0.0717`、`cyanGreen=0.0010`、`purpleBlue=0.0046`、`milkWhite=0.8884`、`brightDroplet=0.8926`；本轮 `run-2928` 为 `orangeGold=0.2485`、`cyanGreen=0.0005`、`purpleBlue=0.0023`、`milkWhite=0.7304`、`brightDroplet=0.8369`。也就是橙金厚膜比例比上一轮明显恢复，但青绿/紫蓝仍几乎为零，奶白和亮点仍严重过量。

debug 数值对照：本轮 `eta.mean=0.5493`、`eta.thickFraction=0.1012`，厚膜比上一轮更合理；`gammaRhsResidual.strongFraction=0.9081`、`gammaDeltaMagnitude.nonZeroFraction=0.9224`，说明 projection residual 很强，已经不是“信号不够”的问题；`velocity.activeFraction=0.9587`，速度场过于全局活跃；`phase.highFraction=0.2585` 已超过目标上沿，且 `phase.visibleFraction=0.9512` 说明相场铺得太满；`huangFrontState.occupancy.mean=0.0908` 仍低于计划目标 `0.12-0.18`，`sideReject.mean=0.3204` 仍偏高；`filament.rawFilament.mean=0.2923` 虽在范围内，但 `filament.widthSheetReject.mean=0.4483` 和 `phaseAreaSkeleton.areaGate.mean=0.3727` 表明后级仍把前沿/相场接成宽片和块状面积。

失败原因：本轮确实把 Huang 2020 的 `Gamma` projection-like residual 从纯诊断推进到速度校正和前沿源项，方向正确；但 residual 当前是高覆盖、强幅值信号，直接参与前沿 seed 后被 `phaseAreaSkeleton` 和 `filamentConnectivity` 的宽片接收，形成块状青绿/粉支撑，而不是 Huang 模型中由 `eta/Gamma/u` 守恒输运出的窄、连续、可分叉界面。继续增强 residual 会更糟；继续调 beauty 或改构图仍然不允许，也不能解决根因。

下一步计划：

1. 不再增强 `gammaRhsResidual` 到前沿 seed 的直连权重；应把 residual 保留为速度/通量驱动，让前沿 occupancy 通过守恒通量演化，而不是直接铺相场。
2. 新增或重构 `huangFrontState` 的保守通量更新：`occupancy` 沿 `u + Gamma_tangent` 做球面平流，横向只允许 NMS/宽度约束，源项必须是 residual compression 的局部极大值，并加上每步面积/质量上限。
3. 给 `phaseArea` 增加明确的宽片刹车：当 `phase.highFraction` 超过 0.22 或 `frontSideReject` 偏高时，优先从 broad sheet 抽走面积，而不是继续把 `areaGate` 分配给块状 skeleton。
4. `foam` 不应从整片高相出生成，应只从窄前沿两侧的曲率/剪切/Gamma 残差峰生成离散微滴；当前 `foam.visibleFraction=0.0046` 低但形态仍灰片，应在前沿变窄后再恢复微滴密度。
5. 下一轮继续固定验证顺序 `solid -> thickness -> phase -> velocity -> foam -> filamentConnectivity -> phaseArea -> phaseAreaSkeleton -> huangFrontState -> beauty`，并重新对照参考图与 Huang et al. 2020 全文模型。

## 2026-06-01 heartbeat / Run 2929-2949：前沿改为局部极大残差源与上风通量，仍被相场宽片压住

开始前检查：本轮重新读取了 `artifacts/targets/soap-film-huang-2020-fulltext-notes.md`、`artifacts/targets/soap-film-physics-handoff.md`、`artifacts/targets/soap-film-target.md` 和本迭代文件，并强制查看 `soap-film-reference.jpg`、上一轮最新 `run-2928-beauty-huang-gamma-residual-feedback-fixed-low.png`、`run-2927-huangFrontState...png`、`run-2924-filamentConnectivity...png`、`run-2926-phaseAreaSkeleton...png`。对照结论：上一轮 solid 可见，失败不在壳层或 shader 初始化；失败在 `gammaRhsResidual` 过强且高覆盖，被 `huangFrontState/filamentConnectivity/phaseAreaSkeleton` 接成噪声云、宽块和棋盘支撑，最终 beauty 仍是奶白/浅粉完整球，没有参考图里的青绿分叉河道、紫蓝窄边和边界微滴。

本轮实现只改 `mvp/src/visual/thinFilmSim.js`，没有改构图、相机、beauty 调色，也没有使用贴图、参考图采样、预烘焙纹理、canvas 图案、样式拟合或假纹理。第一步在 `HUANG_FRONT_STATE_FRAGMENT_SHADER` 新增 `gammaResidualScalar()`，对 `gammaCandidateDiagnosticTarget` 的 projection residual 做沿线/横向邻域比较；residual 现在必须是局部极大并通过横向预算，才能作为前沿源项。`occupancy` 更新也加入了上风 `prevBack/prevBack2` 通量、`sourceBudget` 和 `occupancyCeiling`，让 residual 主要作为守恒输运的局部压缩源，而不是直接铺相场。第二步在 `PHASE_AREA_FRAGMENT_SHADER` 加入 `broadAreaBrake`，当高相、foam、横向 filament/age、显式膨胀显示为宽片时，会降低 `areaGate/fillBudget/targetHigh` 并提高 `sheetDrain`；`phaseAreaError.b` 现在输出 `max(broadSheet, broadAreaBrake)`，方便确认刹车触发。

验证过程：`thinFilmSim.js`、`logoScene.js`、`controlSchema.js` 均通过 `node --input-type=module --check`。第一轮 `run-2929-2938-huang-front-conservative-flux-low-capture-results.json` 覆盖 `solid/thickness/phase/velocity/foam/filamentConnectivity/phaseArea/phaseAreaSkeleton/huangFrontState/beauty`，全部 `problemCount=0`，但前沿被压得过低：`huangFrontState.occupancy.mean=0.0474`，`sideReject.mean=0.3166`，`phase.highFraction=0.2584`。随后放宽局部极大 residual 源和上风通量、增强 `phaseArea` 宽片刹车，得到最终验证 `run-2939-2949-huang-front-conservative-flux-balanced-low-capture-results.json`，所有视图仍 `problemCount=0`，solid 最小可见性成立。

最终图像对照：`run-2948-huangFrontState...png` 的噪声云比上一轮略受限，但仍不是连续、可输运、可分叉的 velocity-aligned 中心线；`run-2944-filamentConnectivity...png` 仍是青绿/粉色宽块，`run-2946-phaseAreaSkeleton...png` 仍有低分辨率棋盘/块状支撑，`run-2947-phaseAreaError...png` 证明宽片刹车有触发但没有压住下游相场正反馈。最终 `run-2949-beauty...png` 仍失败：主体仍是奶白/浅粉完整球，底部有棕金厚膜和少量拉丝，但没有参考图的橙金厚膜大陆被青绿河道切割的结构，紫蓝窄边和沿界面奶金/白色微滴仍缺失。

量化对照写入 `run-2949-huang-front-conservative-flux-balanced-color-comparison.json`，统计只用于失败诊断，不参与生成。该口径下参考图全局约 `orangeGold=0.2351`、`cyanGreen=0.1003`、`purpleBlue=0.0449`、`brightDroplet=0.0043`；上一轮 `run-2928` 为 `orangeGold=0.0399`、`cyanGreen=0.0002`、`purpleBlue=0.0004`、`milkWhite=0.0850`、`brightDroplet=0.1215`；最终 `run-2949` 为 `orangeGold=0.0295`、`cyanGreen=0.0003`、`purpleBlue=0.0004`、`milkWhite=0.1202`、`brightDroplet=0.1316`。颜色数字再次说明 cyan/green 与 purple/blue 没有进入 beauty，奶白/亮部仍远超参考；这不是调色问题，而是物理通道没有形成。

debug 数值对照：最终 `eta.mean=0.5546`、`eta.thickFraction=0.1484`，厚膜质量还在；`phase.mean=0.2957`、`phase.highFraction=0.3053`，高相面积反而过量；`velocity.activeFraction=0.9637`，速度仍几乎全局活跃；`huangFrontState.occupancy.mean=0.0669`，虽然比第一刀回升但仍低于目标 `0.12-0.18`；`sideReject.mean=0.3129` 仍高；`filament.rawFilament.mean=0.3307`、`filament.widthSheetReject.mean=0.4537`，说明 filament 是宽块；`phaseAreaError.broadSheet/broadAreaBrake.mean=0.3411` 已触发，但 `phaseAreaSkeleton.areaGate.mean=0.3775` 和 `phase.highFraction=0.3053` 表明 `PHASE_STEP` 仍把宽片回补和局部 high phase 正反馈放大。

失败原因：本轮方向符合 Huang 2020 的要求，即 residual 不再直接画相场，而是作为 `eta/Gamma/u` 耦合中的局部压缩源和速度/通量驱动；但当前仍不是论文的 staggered spherical grid、velocity-aligned/BiMocq2 平流和 `Gamma` implicit projection-like 系统。`huangFrontState` 的守恒通量只是局部近似，源项过弱时前沿 occupancy 不足，源项稍放宽又被 `filamentConnectivity/PHASE_STEP` 的宽片正反馈吃掉。下游 `PHASE_STEP` 仍有 `areaSkeletonFill/physicalFillGate/localHigh` 等项把块状 support 推成高相面积，导致 beauty 继续奶白而不是产生参考图的 cyan/green river 和 purple/blue edge。

下一步计划：不要继续在 beauty 或构图层处理，也不要单纯继续调 residual 阈值。下一轮应直接改 `PHASE_STEP_FRAGMENT_SHADER` 的面积反馈：降低 `areaSkeletonFill` 对 `support/localHigh/physicalFillGate/targetHigh/dye` 的正反馈，显著增强 `areaSheetDrain/areaExcess/filamentReject` 对 `dye` 和 `physicalPhaseCeiling` 的抑制，并要求所有高相补给必须同时通过窄 `huangFrontState occupancy`、低 `sideReject` 和低横向 filament age。并行推进真正的 Huang 主线：把 `Gamma` projection-like 更新从当前局部 Jacobi/diagnostic 近似推进为更接近论文第 4.3 节的隐式系统，并把 phase/foam 只当作 `eta/Gamma/u` 派生诊断，不允许反向制造骨架。下一轮仍按 `solid -> thickness -> phase -> velocity -> foam -> filamentConnectivity -> phaseArea -> phaseAreaSkeleton -> phaseAreaError -> huangFrontState -> beauty` 截图并对照参考图与 Huang 全文模型。

## 2026-06-01 heartbeat / Run 2950-2982：相场宽片被 Huang 前沿压下，白散射污染下降，但 cyan/purple 仍未进入 beauty

开始前检查：本轮重新读取了 `artifacts/targets/soap-film-huang-2020-fulltext-notes.md`、`artifacts/targets/soap-film-physics-handoff.md`、`artifacts/targets/soap-film-target.md` 和本迭代文件，并查看 `soap-film-reference.jpg`、上一轮 `run-2949-beauty-huang-front-conservative-flux-balanced-low.png`、`run-2948-huangFrontState...png`、`run-2946-phaseAreaSkeleton...png`、`run-2947-phaseAreaError...png`。对照结论：上一轮壳层/solid 可见，失败不在初始化；`huangFrontState` 有实时 `eta/Gamma/u` 派生的前沿信号，但 `phase.highFraction=0.3053`、`phaseAreaSkeleton.areaGate.mean=0.3775`、`phaseAreaError.broadSheet.mean=0.3411`，说明宽片面积反馈仍压过 Huang 前沿，最终 beauty 是奶白/粉白球，没有参考图的橙金厚膜大陆、青绿分叉河道、紫蓝窄边和密集微滴。

本轮实现：第一步在 `PHASE_STEP_FRAGMENT_SHADER` 中把 `uHuangFrontState` 接入相场更新，让 `areaSkeletonFill`、`physicalFillGate`、`targetHigh`、`areaCorrection`、`dye` 和 `foam` 的补给必须受高 occupancy、低 sideReject、低横向 occupancy 的窄前沿约束，并增强 `broadFeedbackReject/areaSheetDrain/areaUngatedFill` 对宽片的排斥。第二步在 `PHASE_AREA_FRAGMENT_SHADER` 中也接入 `uHuangFrontState`，新增 `hfNarrowLine` 和 `huangAreaAdmission`，让低分辨率 `phaseAreaSkeleton` 在写出 `areaGate/fillBudget` 前接受 Huang 前沿约束，而不是独立长成棋盘块。第三步在 `logoScene.js` 中修正最终物理散射：旧 `whiteSpeck` 由全局 `shear` 直接触发，而当前 `velocity.activeFraction≈0.96` 会把整片膜错误混成奶白；新逻辑要求 `foam/boundary/localCrest/riverMeniscus` 形成 `microDropletGate` 后，剪切才可贡献白色微滴散射。该改动仍由物理场推导，没有改构图、相机，没有采样参考图，也没有贴图、预烘焙纹理、canvas 图案或假纹理。

验证结果：`thinFilmSim.js`、`logoScene.js`、`controlSchema.js` 均通过 `node --input-type=module --check`。`run-2950-2960-huang-front-qualified-phase-low-capture-results.json`、`run-2961-2971-huang-area-gated-phase-low-capture-results.json` 和 `run-2972-2982-physical-white-scatter-gated-low-capture-results.json` 均覆盖 `solid/thickness/phase/velocity/foam/filamentConnectivity/phaseArea/phaseAreaSkeleton/phaseAreaError/huangFrontState/beauty`，有效重跑后全部 `problemCount=0`；其中第一次 `run-2972-2982` capture 曾出现一次 `socket hang up`，服务未崩且日志无 shader 错，重跑成功。

图像对照：`run-2960-beauty...png` 相比上一轮相场高值被压低，但画面更奶白；`run-2971-beauty...png` 仍粉白，`phaseAreaSkeleton` 的棋盘块面积门下降但没有消失；最终 `run-2982-beauty-physical-white-scatter-gated-low.png` 的白色污染明显减少，局部膜纹更清楚，底部橙棕厚膜还在，但整体仍是粉白小球，缺参考图中贯穿画面的青绿分叉河道和贴边紫蓝窄线。`run-2974-phase...png` 和 `run-2981-huangFrontState...png` 说明窄前沿物理场存在，但它没有在最终干涉色里形成足够薄的 cyan/green 相位带。

量化对照：相场门控后 `phase.highFraction` 从上一轮 `0.3053` 降到 `0.1069`，但 `areaGate.mean` 升到 `0.4012`；接入 Huang 面积门后 `areaGate.mean` 降到 `0.1962`，但 `fillBudget.mean` 也掉到 `0.0067`，`broadSheet.mean` 回升到 `0.3435`。最终白散射门控后 `eta.mean=0.5584`、`eta.thickFraction=0.1487`、`phase.highFraction=0.0975`、`foam.visibleFraction=0.0008`、`huangOccupancy.mean=0.0680`、`sideReject.mean=0.3155`、`areaGate.mean=0.1994`、`broadSheet.mean=0.3436`。颜色统计写入 `run-2982-physical-white-scatter-gated-color-comparison.json`：参考图约 `orange_gold=0.3627`、`cyan_green=0.0842`、`purple_blue=0.0409`、`milk_white=0.0002`、`saturated=0.6759`；最终 `run-2982` 为 `orange_gold=0.1341`、`cyan_green=0.0`、`purple_blue=0.0`、`milk_white=0.1334`、`saturated=0.1504`。白污染从 `run-2971` 的 `0.6925` 降到 `0.1334` 是有效进展，但 cyan/purple 仍完全失败。

失败原因：本轮按 Huang 2020 主变量把相场和面积门都改成由 `eta/Gamma/u` 派生的窄前沿接收，宽片正反馈确实被压低；最终白散射也不再由全局速度直接伪造。但 `huangFrontState.occupancy.mean≈0.068` 仍低于目标 `0.12-0.18`，`sideReject.mean≈0.316` 仍偏高，且当前 `phaseArea` 是低分辨率面积预算，仍会以块状方式影响 `phase`。更关键的是最终光学厚度映射中河道没有形成更薄的相位带：`phase` debug 有青紫结构，beauty 却没有 cyan/green 与 purple/blue，说明 `eta/Gamma/phase` 到 optical thickness 的耦合仍把薄通道洗成粉白厚膜，而不是参考图中的薄膜干涉条带。

下一步计划：不要回头改构图，也不要按参考图补颜色。下一轮应把 `phase/riverInterior/hf occupancy` 对光学厚度的作用改成物理薄化：窄前沿和高 Marangoni 压缩应降低局部 `eta`/optical thickness 进入 0.24-0.40 微米附近，宽橙金区域保持较厚；同时继续提高 `huangFrontState` 的守恒 occupancy 到 `0.12-0.18`、降低 sideReject 到约 `0.18-0.28`。`phaseAreaSkeleton` 的低分辨率棋盘仍需改成只输出面积预算，不得作为块状骨架反向驱动高相。下一轮继续按 `solid -> thickness -> phase -> velocity -> foam -> filamentConnectivity -> phaseArea -> phaseAreaSkeleton -> phaseAreaError -> huangFrontState -> beauty` 截图，并重新对照参考图与 Huang 2020 全文模型。

## 2026-06-01 heartbeat / Run 2983-3015：Huang 前沿进入光学厚度，随后改成一侧速度对齐平流；有进展但仍远未达标

开始前检查：本轮继续按 heartbeat 要求重新读取 `artifacts/targets/soap-film-huang-2020-fulltext-notes.md`、`artifacts/targets/soap-film-physics-handoff.md`、`artifacts/targets/soap-film-target.md` 和本文件，并重新查看 `artifacts/targets/soap-film-reference.jpg`、上一轮最新 `run-2982-beauty-physical-white-scatter-gated-low.png`、`run-2974-phase...png`、`run-2979-phaseAreaSkeleton...png`、`run-2980-phaseAreaError...png`、`run-2981-huangFrontState...png`。对照结论：上一轮 solid/壳层可见，`phase` 与 `huangFrontState` 中已有由 `eta/Gamma/u` 派生的窄前沿，但 beauty 完全没有 cyan/green 与 purple/blue，说明主要失败在物理前沿到光学厚度映射，以及 Huang 前沿守恒输运还太碎、太弱。

本轮第一步实现：在 `mvp/src/visual/logoScene.js` 中把 `huangFrontState` 接入最终 beauty 的物理光学路径。新增逻辑读取 Huang 前沿的 `lineDistance/occupancy/lineAge/sideReject`，结合 `Gamma` 梯度、相场边界、膜厚谷值和速度剪切得到 `physicalThinChannel`，再以局部 optical thickness drain 的形式进入 `thinFilmRgb(thickness, cosTheta)`。这不是贴色或参考图拟合：颜色仍由薄膜谱积分和视角计算，只是让实时物理前沿把局部膜厚推入更薄的干涉相位带。

第一步验证暴露了一个管线错误：`run-2983-2993-huang-front-optical-thinning-low` 不是有效结果，新增独立 `uFilmHuangFrontStateMap` 后 fragment shader 超过 `MAX_TEXTURE_IMAGE_UNITS(16)`，`solid` 即报 `FRAGMENT shader texture image units count exceeds MAX_TEXTURE_IMAGE_UNITS(16)`。随后修复为复用现有 `uFilmRiverPathCostMap` 的 multiplex 纹理槽：`beauty` 和 `huangFrontState` 视图绑定 `huangFrontStateTexture`，其它调试视图仍按原逻辑绑定各自诊断图。修复后 `run-2994-3004-huang-front-optical-thinning-fixed-low-capture-results.json` 覆盖 `solid/thickness/phase/velocity/foam/filamentConnectivity/phaseArea/phaseAreaSkeleton/phaseAreaError/huangFrontState/beauty`，全部 `problemCount=0`，`solid` 最小可见性成立。

第一步图像和颜色对照：`run-3004-beauty-huang-front-optical-thinning-fixed-low.png` 第一次出现少量 cyan/purple 窄边，但远远不够，且画面变成大面积橙棕完整小球。粗略 HSV 统计写入 `run-3004-huang-front-optical-thinning-fixed-color-comparison.json`：同一口径下参考图约 `orange_gold=0.3485`、`cyan_green=0.0924`、`purple_blue=0.0478`、`milk_white=0.0025`；上一轮 `run-2982` 为 `orange_gold=0.1572`、`cyan_green=0`、`purple_blue=0`、`milk_white=0.1775`；`run-3004` 为 `orange_gold=0.8526`、`cyan_green=0.0044`、`purple_blue=0.0070`、`milk_white=0.0060`。这说明光学映射开始读到前沿，但 Huang 前沿本身仍太碎太稀，不能只靠 beauty 继续加权。

本轮第二步实现：再次重读目标文件和 Huang 全文笔记后，只改 `mvp/src/visual/thinFilmSim.js` 的 `HUANG_FRONT_STATE_FRAGMENT_SHADER`。依据 Huang 2020 的 velocity-aligned transport 思路，把前沿连续性从“双侧都要有证据”改成允许上风/一侧延拓：新增 `bidirectionalAlong` 与 `oneSidedAlong`，`alongContinuity/localSeedRaw/advectedOccupancy/narrowStateGate/occupancy` 都更多依赖速度方向上风邻域和上一帧前沿，同时仍保留横向 `sideReject/historyWideReject/sourceBudget/occupancyCeiling` 抑制宽片。目的不是调色，而是让 `eta/Gamma/u` 的局部压缩线沿球面速度方向守恒传播，减少被横向拒绝打碎成噪点。

第二步验证：`thinFilmSim.js`、`logoScene.js`、`controlSchema.js` 均通过 `node --input-type=module --check`。完整截图 `run-3005-3015-huang-front-one-sided-transport-low-capture-results.json` 再次覆盖固定视图顺序，全部 `problemCount=0`。关键数值相对 `run-3004` 有明确进展：beauty 帧中 `huangFrontState.occupancy.mean` 从约 `0.0687` 升到 `0.1294`，进入计划的 `0.12-0.18` 区间；`sideReject.mean` 从约 `0.3164` 降到 `0.3029`，仍偏高但方向正确；`phase.highFraction` 从约 `0.1053` 降到 `0.0740`，`areaGate.mean` 从约 `0.2123` 升到 `0.2441`，`fillBudget.mean` 从约 `0.0070` 到 `0.0102`，说明前沿更多但低分辨率面积预算仍块状。

第二步图像对照：`run-3014-huangFrontState...png` 比 `run-3003` 连续且占比更高，但仍不是参考图里宽窄变化、弯曲分叉的河道中心线；`phaseAreaSkeleton` 和 `phaseAreaError` 仍有低分辨率棋盘/块状反馈。`run-3015-beauty...png` 的 cyan/purple 比 `run-3004` 增多，但仍主要围在边缘和碎片处，没有贯穿中部的青绿分叉河道；橙金区域仍偏整片，内部拉丝不够像液体守恒流，奶白/白点密度和分布也不符合参考图。

量化对照写入 `run-3015-huang-front-one-sided-transport-color-comparison.json`，统计只用于失败诊断，不参与生成。参考图约 `orange_gold=0.3485`、`cyan_green=0.0924`、`purple_blue=0.0478`、`milk_white=0.0025`；`run-3015` 为 `orange_gold=0.7338`、`cyan_green=0.0085`、`purple_blue=0.0145`、`milk_white=0.0363`。相较 `run-3004`，cyan 从 `0.0044` 到 `0.0085`，purple 从 `0.0070` 到 `0.0145`，是进展；但仍只有参考图的很小一部分，且橙金厚膜占比过高、微白偏多。

Huang 2020 全文模型对照：本轮更贴近论文的 velocity-aligned 球面平流思路，但仍只是 fragment shader 局部近似，没有真正实现论文第 4 节的 staggered spherical grid、BiMocq2 映射维护和 `Gamma` implicit projection-like SPD 系统。当前 `Gamma` residual/前沿通量仍在 `phaseArea/filament` 低分辨率链路中被块化；`phase/foam` 仍会作为视觉辅助反馈到最终 appearance，尚未完全退回“只由 eta/Gamma/u 派生诊断”的位置。

失败原因：本轮证明了两点：第一，beauty 缺 cyan/purple 不是壳层或 shader 问题，而是物理前沿与光学厚度耦合不足；第二，提高 `huangFrontState.occupancy` 会让 cyan/purple 增加，但如果前沿形态仍碎且 `phaseAreaSkeleton` 是块状，最终只会得到边缘碎色和过量橙厚膜，无法达到参考图的河道结构。不能用构图、参考图采样或直接调色救场。

下一步计划：继续不修构图、不采样参考图、不做样式拟合。下一轮应拆掉 `phaseAreaSkeleton` 对 high phase 的块状反向驱动：让它只输出 tile-level 面积预算和窄前沿可用容量，不能把低分辨率方块当骨架；`PHASE_STEP` 的高相补给必须同时满足 `huangFrontState occupancy`、低 `sideReject`、低横向 filament age 和局部 `eta/Gamma/u` 压缩。并行继续推进 Huang 主线：把 `Gamma` projection-like 更新和 velocity-aligned advection 做成更接近论文全文的共享球面算子/隐式更新，而不是继续靠局部阈值。验证仍按 `solid -> thickness -> phase -> velocity -> foam -> filamentConnectivity -> phaseArea -> phaseAreaSkeleton -> phaseAreaError -> huangFrontState -> beauty`，并继续记录颜色统计和图像偏差。

## 2026-06-01 heartbeat / Run 3016-3048：phaseArea 块状回写被削弱，但 beauty 被推入粉白相位，仍未接近参考图

开始前检查：本轮重新读取了 `artifacts/targets/soap-film-huang-2020-fulltext-notes.md`、`artifacts/targets/soap-film-physics-handoff.md`、`artifacts/targets/soap-film-target.md` 和本迭代文件，并重新查看 `artifacts/targets/soap-film-reference.jpg`、上一轮最新 `run-3015-beauty-huang-front-one-sided-transport-low.png`、`run-3014-huangFrontState...png`、`run-3012-phaseAreaSkeleton...png`、`run-3013-phaseAreaError...png`、`run-3007-phase...png`。对照结论：上一轮壳层可见、Huang 前沿 occupancy 已到 `0.1294`，但 `phaseAreaSkeleton` 仍是明显棋盘/块状，最终 beauty 缺参考图的青绿分叉河道、紫蓝窄边和沿边界密集奶金微滴；失败源不是构图，也不是 shader 初始化，而是低分辨率面积预算仍在反向制造高相块。

本轮实现都只改 `mvp/src/visual/thinFilmSim.js`，没有改构图、相机、beauty 调色，也没有使用贴图、参考图采样、预烘焙纹理、canvas 图案或假纹理。第一步在 `PHASE_AREA_FRAGMENT_SHADER` 中加入 `areaCapacity` 与 `blockFeedbackReject`，降低 `skeletonEvidence` 的直接权重，要求 `areaGate/fillBudget` 同时满足 `huangAreaAdmission`、`compactLineGate`、`narrowPhysicalLine`、低 `hfSideReject`、低 `filamentWidthPenalty` 和低 `broadAreaBrake`。第二步在 `PHASE_STEP_FRAGMENT_SHADER` 新增 `areaFillAdmission`，把 `areaSkeletonFill` 对 `support/localHigh/physicalFillGate/targetHigh/dye/foam` 的正反馈下调，并添加 `broadPhaseReject` 以排掉未通过 Huang 窄前沿支持的宽相场。第三步进一步把 `phaseAreaSkeleton` 基本降级为预算/诊断项，主要补给改由 `huangLineSource` 和 `hfNarrowAdmission` 这些从 `eta/Gamma/u` 推导出的前沿通道承担。

验证结果：三轮都通过 `thinFilmSim.js`、`logoScene.js`、`controlSchema.js` 的 `node --input-type=module --check`。截图顺序均为 `solid -> thickness -> phase -> velocity -> foam -> filamentConnectivity -> phaseArea -> phaseAreaSkeleton -> phaseAreaError -> huangFrontState -> beauty`，且 `run-3016-3026-phasearea-block-feedback-cut-low-capture-results.json`、`run-3027-3037-phasearea-block-feedback-cut-broad-phase-drain-low-capture-results.json`、`run-3038-3048-phasearea-budget-only-huang-front-feed-low-capture-results.json` 全部 `problemCount=0`，`solid` 最小可见性成立。

图像对照：本轮没有达到参考图。`run-3026` 和 `run-3037` 大面积变成粉白/淡橙完整球，`run-3048` 虽比 `run-3026` 少一些白污染，但仍是完整小球上的浅粉橙膜，没有参考图里贯穿中部、宽窄变化、弯曲分叉的青绿河道；紫蓝窄边只剩极少碎边；奶金/白色微滴没有沿河道边界形成高密度颗粒。`run-3045 phaseAreaSkeleton` 的 `areaGate/fillBudget` 被压低但仍呈低分辨率块状；`run-3047 huangFrontState` 仍是暗带加散点，没有连续 velocity-aligned 的河道中心线；`run-3040 phase` 和 `run-3043 filamentConnectivity` 仍是宽块/宽片，而不是 Huang 2020 的 `eta/Gamma/u` 压缩前沿自然拉出的细长分支。

关键数值：相对上一轮 `run-3015`，最终 `run-3048` 的 `huangFrontState.occupancy.mean` 基本持平在 `0.1320`，`sideReject.mean` 仍约 `0.3020`；`phaseAreaSkeleton.areaGate.mean` 从 `0.2441` 降到 `0.1774`，`fillBudget.mean` 从 `0.0102` 降到 `0.0028`，`phaseAreaError.broadSheet.mean` 从 `0.3226` 降到 `0.2759`，说明块状回写确实被削弱。但 `phase.highFraction` 从 `0.0740` 升到 `0.1098`，`foam.visibleFraction` 从 `0.0008` 升到 `0.0098`，最终仍出现宽相场/白相位污染。`eta.thickFraction` 最终为 `0.2689`，厚膜质量还在，但没有被正确切成青绿薄膜河道。

颜色统计写入 `run-3048-phasearea-budget-only-huang-front-feed-color-comparison.json`，只用于失败诊断，不参与生成。同一 HSV 阈值口径下，参考图约 `orange_gold=0.3288`、`cyan_green=0.0685`、`purple_blue=0.0253`、`milk_white=0.0003`；上一轮 `run-3015` 为 `orange_gold=0.5583`、`cyan_green=0.0016`、`purple_blue=0.0048`、`milk_white=0.0030`；本轮最终 `run-3048` 为 `orange_gold=0.2701`、`cyan_green=0.0007`、`purple_blue=0.0017`、`milk_white=0.0883`。也就是说，削弱块状回写后没有得到参考图的青绿/紫蓝河道，反而把一部分区域推入低饱和粉白相位。

Huang 2020 全文模型对照：本轮只是在下游相场/面积预算层做了局部修正，仍没有实现论文第 4 节的 staggered spherical grid、velocity-aligned/BiMocq2 细节保持、以及 `Gamma` implicit projection-like SPD 更新。现有 `huangFrontState` 虽然 occupancy 数值在目标附近，但它不是由真正隐式 `Gamma/u` 系统产生的连续材料前沿，而是局部 residual/filament/phaseArea 诊断拼接出来的近似场；因此下游怎么削块状回写，都无法自然产生参考图里的主河道拓扑。

下一步计划：不要继续在 beauty、构图或颜色上补救；也不要继续只在 `PHASE_STEP` 末端调阈值。下一轮应把工作上移到 Huang 主线：实现一个共享的球面 `Gamma` projection-like 迭代 pass，至少把 `u*`、`Gamma*`、`eta*` 组合成近似隐式的 `Gamma` 更新，再由更新后的 `Gamma` 反算 Marangoni 速度和 `eta = eta* - dt * eta* div(u)`；同时把 `huangFrontState` 的前沿来源改为这个隐式系统的 `Gamma` 残差/收敛压缩，而不是 `phaseAreaSkeleton` 或宽 `filamentConnectivity`。`phaseAreaSkeleton` 后续应只作为低频面积预算统计，不得再直接制造 high phase 骨架；验证顺序继续固定，并继续与参考图和 Huang 全文模型逐项对照。

## 2026-06-02 heartbeat / Run 3049-3076：Gamma projection-like 主链被加强但过度闭合，厚膜/相场被压平，仍未接近参考图

开始前检查：本轮重新读取了 `artifacts/targets/soap-film-huang-2020-fulltext-notes.md`、`artifacts/targets/soap-film-physics-handoff.md`、`artifacts/targets/soap-film-target.md` 和本迭代文件，并重新查看 `artifacts/targets/soap-film-reference.jpg`、上一轮最新 `run-3048-beauty-phasearea-budget-only-huang-front-feed-low.png`、`run-3047-huangFrontState...png`、`run-3045-phaseAreaSkeleton...png`、`run-3040-phase...png` 和 `run-3039-thickness...png`。对照结论：上一轮 solid 可见、壳层渲染正常，问题不在初始化或构图；参考图仍是橙金厚膜岛被青绿分叉河道切开，边缘有紫蓝窄相位和密集奶金/白色微滴，而上一轮是完整浅粉橙小球，`phaseAreaSkeleton` 仍有低分辨率棋盘块，`huangFrontState` 是暗带加散点，没有连续物理河网。

本轮只改 `mvp/src/visual/thinFilmSim.js` 的 Huang 主链，没有改构图、相机或 beauty 调色，也没有使用贴图、参考图采样、预烘焙纹理、canvas 图案、样式拟合或假纹理。第一步把 `GAMMA_PROJECTION_JACOBI_FRAGMENT_SHADER` 的 RHS 和椭圆权重从近似局部 `-Gamma * div(u)` 改成显式包含 `div(u - dt * M/eta * grad(Gamma))` 的 projected divergence，增加 `divMobilitySolveGamma`、`projectedDivergenceStar` 和更强的 Jacobi solve 权重；同时把 `GAMMA_DIVERGENCE_FIELD_FRAGMENT_SHADER` 的诊断/反馈口径改成 projected divergence，并把 Gamma projection 外循环/Jacobi 内循环从约 `4-12/6-18` 提高到约 `6-24/10-36`。这一步是按 Huang et al. 2020 第 4 节的 `Gamma` projection-like 隐式耦合方向推进，不是下游相场阈值或颜色修补。

第一组验证为 `run-3049` 到 `run-3062`，覆盖 `solid -> thickness -> phase -> velocity -> foam -> filamentConnectivity -> phaseArea -> phaseAreaSkeleton -> phaseAreaError -> etaGammaVelocity -> gammaCandidate -> gammaRhsResidual -> huangFrontState -> beauty`，全部 `problemCount=0`，solid 可见，shader/WebGL 没有错误。结果不合格：`run-3062 beauty` 变成更浅的奶白/粉白完整小球，底部只有少量碎青蓝，不存在参考图主河道。数值上 `huangFrontState.occupancy.mean` 从上一轮约 `0.1320` 升到 `0.1434`，`sideReject.mean` 从约 `0.3020` 降到 `0.2870`，看似改善；但 `eta.thickFraction` 从上一轮 `0.2689` 掉到 `0.0803`，`phase.highFraction` 从 `0.1098` 掉到 `0.0059`，`foam.visibleFraction` 变成 `0`，说明主链闭合太强，厚膜和高相都被压平了。

第二步没有回到 beauty 或构图，而是在同一主链中给 projection 加了结构门控：新增 `implicitLineGate`，让强 Gamma 梯度/局部结构/压缩区域承担较多隐式权重，降低广域 RHS、椭圆权重和全局 projected divergence 反馈；`GAMMA_DIVERGENCE_FIELD` 也从全 projected divergence 改成基于 `closureGate` 的 `feedbackDivergence = mix(divergence, projectedDivergence, ...)`，避免 `eta` 连续项把整个球面洗平。语法检查仍通过。

第二组验证为 `run-3063` 到 `run-3076`，同样全部 `problemCount=0`。它比 `run-3062` 略恢复 phase，但仍远不达标：`run-3076 beauty` 仍是浅粉/奶白完整小球，没有参考图中贯穿中部的青绿分叉河道、贴边紫蓝窄相位和沿边界的奶金微滴。最终读回为 `eta.mean=0.5326`、`eta.thickFraction=0.0823`、`phase.mean=0.1584`、`phase.highFraction=0.0214`、`foam.mean=0.0075`、`foam.visibleFraction=0.0001`、`velocity.interiorActiveFraction=0.9652`、`projectedDivergence.interiorCompressionSmallFraction=0.3198`、`projectedDivergence.interiorExpansionSmallFraction=0.6740`、`gammaRhsResidual.nonZeroFraction=0.9914`、`gammaDeltaMagnitude.nonZeroFraction=0.9402`、`huangFrontState.occupancy.mean=0.1265`、`sideReject.mean=0.2950`、`phaseAreaError.physicalLineEvidence.mean=0.0679`、`narrowPhysicalGate.mean=0.0504`、`broadSheet.mean=0.3162`、`phaseAreaSkeleton.areaGate.mean=0.1790`、`fillBudget.mean=0.0032`。

颜色统计写入 `run-3062-gamma-projection-closure-color-comparison.json` 和 `run-3076-gamma-projection-line-gated-color-comparison.json`，只用于失败诊断，不参与生成。当前统计口径下参考图为 `orange_gold=0.4164`、`cyan_green=0.0796`、`purple_blue=0.0414`、`milk_white=0.0009`；上一轮 `run-3048` 为 `orange_gold=0.6129`、`cyan_green=0.0016`、`purple_blue=0.0040`、`milk_white=0.0208`；第一组 `run-3062` 为 `orange_gold=0.5651`、`cyan_green=0`、`purple_blue=0`、`milk_white=0.0961`；第二组 `run-3076` 为 `orange_gold=0.5725`、`cyan_green=0.0001`、`purple_blue=0.0010`、`milk_white=0.0547`。结论是：本轮加强主链闭合没有生成青绿/紫蓝河道，反而明显增加低饱和奶白相位。

Huang 2020 全文模型对照：本轮比上一轮更接近 `Gamma` projection-like 隐式系统的数学结构，但仍不是论文的 staggered spherical SPD solve，也没有 velocity-aligned/BiMocq2 映射保持。更重要的是，当前 WebGL 近似把 projected divergence 当成全局闭合误差后，会快速压平 `eta` 厚膜和 `phase` 高相，而不是形成材料前沿；`huangFrontState.occupancy` 数值可以保持在目标范围附近，但它的形态仍是暗带/散点，不是 `eta/Gamma/u` 共同输运出的连通分叉河道。这说明下一步不能继续单纯加大 projection 权重或 Jacobi 次数。

下一步计划：
1. 不改构图、不调 beauty 色彩、不采样参考图，不做贴图/预烘焙/canvas/样式拟合。
2. 继续沿 Huang 主线，但从“更强 projection”改为“正确输运 projection 结果”：给 `Gamma` projection 增加上一帧/上风 velocity-aligned transport 或 residual memory，让 `Gamma` 残差沿速度方向形成材料线，而不是每步被 Jacobi 洗成宽区。
3. 把 `huangFrontState` 的 source 从 `phaseAreaSkeleton/filamentConnectivity` 进一步移到 `gammaCandidate/gammaRhsResidual/etaGammaVelocity` 的局部极大值和压缩残差，并增加沿速度方向的 age/occupancy 保守更新；`phaseAreaSkeleton` 继续只作为低频面积预算，不得反向制造骨架。
4. 如果按 Huang 主文仍无法保持细长液膜线，按目标文档允许寻找补充论文，优先找球面/薄膜上的 level-set、surfactant transport、BiMocq2 或 conservative semi-Lagrangian 细节保持实现；必须保存全文和全文级笔记，并审核不冲突 Huang 的 `eta/Gamma/u` 主耦合。
5. 下一轮继续固定截图顺序，并以 `eta.thickFraction` 不低于约 `0.20`、`phase.highFraction` 回到约 `0.08-0.18`、`foam.visibleFraction` 明显非零、`cyan/purple` 统计上升为最低健康信号。

## 2026-06-02 heartbeat / Run 3077-3146: residual transport state 接入 Huang 前沿，结构收窄但仍未形成参考图河道

开始前检查：本轮重新读取了 `artifacts/targets/soap-film-huang-2020-fulltext-notes.md`、`artifacts/targets/soap-film-physics-handoff.md`、`artifacts/targets/soap-film-target.md` 和本迭代文件，并查看了 `artifacts/targets/soap-film-reference.jpg` 与上一轮最新图像。上一轮 `run-3076` 的 solid/壳层可见性成立，问题不是 shader 黑屏或相机/壳层初始化，而是 beauty 仍为奶白/粉白完整球，缺少参考图中的橙金厚膜大陆、青绿分叉河道、紫蓝窄边和沿界面高密度奶金/白色微滴。按 Huang et al. 2020 全文模型对照，主要失败点是 `Gamma` residual 几乎全域非零，却没有变成随速度输运、守恒、窄宽度的 material front。

本轮实现只改 `mvp/src/visual/thinFilmSim.js`，没有改构图、相机或 beauty 调色，也没有使用贴图、参考图采样、预烘焙纹理、canvas 图案、样式拟合或假纹理。第一步把 `etaGammaVelocityTarget` 接入 `HUANG_FRONT_STATE_FRAGMENT_SHADER`，让 Huang 前沿不只看局部 diagnostic，而是同时看 `eta/Gamma/u` 的 projected divergence、速度强度和 Gamma residual。并把上一轮过强的 Gamma projection 迭代降回更温和的范围，避免把 `eta` 和相场洗平。验证 `run-3077-3090-gamma-residual-transport-memory-low` 全部 view 成功，`solid -> thickness -> phase -> velocity -> foam -> filamentConnectivity -> phaseArea -> phaseAreaSkeleton -> phaseAreaError -> etaGammaVelocity -> gammaCandidate -> gammaRhsResidual -> huangFrontState -> beauty` 均 `problemCount=0`。相对 `run-3076`，橙金和少量 cyan/purple 有恢复，但仍是碎片，未形成贯穿中部的青绿河道。

第二步尝试把 regional support 提到全分辨率并增加 residual coherence gate，验证为 `run-3091-3104-gamma-front-fullres-coherence-low`。该尝试失败：粗块被高分辨率竖向 dash/checker 噪声替代，beauty 回到大面积奶白/粉白，cyan/purple 继续缺失。因此已回退这部分失败实验，保留第一步的 `etaGammaVelocity`/residual 接入。

第三步新增 `HUANG_RESIDUAL_TRANSPORT_FRAGMENT_SHADER` 和 `huangResidualTransportRead/WriteTarget`。该 pass 在 `huangFrontState` 前运行，保存 `materialResidual / alongContinuity / age / sideReject`，来源只包括 `eta`、`Gamma`、`u`、球面梯度/拉普拉斯、Gamma residual、eta-Gamma projected divergence 和上一帧上风采样。严格版 `run-3119-3132-huang-residual-transport-state` 证明 shader 与生命周期接线正确，全部 view `problemCount=0`，`huangFrontState.occupancy.mean` 从约 `0.2203` 降到 `0.1311`，说明 transport gate 能收窄前沿；但它过严，beauty 变成大面积奶白，颜色统计中 `orange=0.0228`、`cyan=0.0005`、`purple=0.0009`、`milk=0.1702`，不合格。

第四步平衡 transport：保留 transport memory 为主，但允许即时 residual 以更强弱源进入中心/沿流方向，同时让横向 residual 更强参与宽片 reject。最终验证为 `run-3133-3146-huang-residual-transport-balanced`，所有固定 debug view 仍 `problemCount=0`。最终关键数值：`eta.mean=0.5713`，`eta.thickFraction=0.1949`，`phase.highFraction=0.0514`，`foam.visibleFraction=0.0007`，`huangFrontState.occupancy.mean=0.1275`，`huangFrontState.sideReject.mean=0.3015`，`huangFrontState.lineAge.mean=0.0739`，`phaseAreaError.physicalLineEvidence.mean=0.0920`，`phaseAreaError.narrowPhysicalGate.mean=0.0863`，`phaseAreaError.broadSheet.mean=0.3247`，`phaseAreaSkeleton.areaGate.mean=0.1659`，`gammaRhsResidual.strongFraction=0.9171`。

图像对照：`run-3146-beauty-huang-residual-transport-balanced.png` 比严格 transport 版好，奶白退掉、橙金厚膜回来；但它仍然不是参考图。当前图主要是整片橙褐厚膜和边缘碎 cyan/purple，缺少参考图中贯穿中部、宽窄变化明显、弯曲分叉的青绿河道；紫蓝窄边只在碎片边缘出现；奶金/白色微滴没有沿河道边界形成高密度颗粒。`run-3145-huangFrontState...png` 更像被 transport 收窄的暗带/散点场，仍不是连续物质中心线。`run-3140-phaseAreaSkeleton...png` 仍有低分辨率块状/棋盘反馈，这是后续必须拆掉的失败源。

颜色统计写入 `artifacts/targets/run-3146-huang-residual-transport-balanced-color-comparison.json`，只用于失败诊断，不参与生成。统一 HSV 阈值下参考图约 `orange=0.4654`、`cyan=0.0947`、`purple=0.0340`、`milk=0.0128`；严格 transport 的 `run-3132` 为 `orange=0.0228`、`cyan=0.0005`、`purple=0.0009`、`milk=0.1702`；最终 `run-3146` 为 `orange=0.2069`、`cyan=0.0015`、`purple=0.0025`、`milk=0.0049`。结论：奶白被压住，橙金恢复，但 cyan/purple 仍差两个数量级左右，且空间形态完全不对。

Huang 2020 全文模型对照：本轮新增的 residual transport state 比直接用当前帧 residual 更接近 velocity-aligned material transport，但仍是片段 shader 近似，不是论文中完整的 staggered spherical grid、BiMocq2 映射维护、`Gamma` implicit projection-like SPD 系统。当前最大物理缺口是 `Gamma` residual 强但全域化，transport pass 只能收窄它，不能凭空生成守恒、连续、可分叉的河道中心线；下游 `phaseAreaSkeleton` 仍会把低频面积预算块状化，导致 beauty 中只出现边缘碎彩而非参考图的主河网。

下一步计划：不要改构图，不要调 beauty 颜色，不要采样参考图。下一轮应先让 `huangResidualTransport` 可被调试查看或纳入诊断统计，然后把它从“局部残差筛选器”推进到更接近 Huang 的守恒通量更新：沿 `u`/Gamma tangent 做 upwind 或 BFECC/BiMocq-like backtrace，横向 NMS 只约束宽度，不直接杀死中心线；同时把 `phaseAreaSkeleton` 降级为面积预算统计，不允许它继续直接制造块状 high phase 骨架。验收优先看 `huangFrontState` 和 transport state 是否形成连续弯曲分叉线，再看 `filamentConnectivity/phaseAreaSkeleton` 是否不再块状，最后才看 beauty 的 cyan/purple 是否随物理线自然增加。

## 2026-06-02 heartbeat / Run 3147-3161: 暴露 Huang residual transport 调试视图，并把 phaseAreaSkeleton 降级为预算项

开始前检查：本轮重新读取了 `artifacts/targets/soap-film-huang-2020-fulltext-notes.md`、`artifacts/targets/soap-film-physics-handoff.md`、`artifacts/targets/soap-film-target.md` 和本迭代文件，并重新查看 `artifacts/targets/soap-film-reference.jpg`、上一轮 `run-3146-beauty-huang-residual-transport-balanced.png`、`run-3145-huangFrontState...png`、`run-3140-phaseAreaSkeleton...png`、`run-3134-thickness...png`、`run-3135-phase...png`、`run-3137-foam...png`。对照结论：solid/壳层可见性已经成立；上一轮 beauty 虽然恢复了橙金厚膜、压低了奶白污染，但仍缺参考图中贯穿中心的青绿分叉河道、贴边紫蓝窄相位和沿边界高密度奶金/白微滴。Huang 2020 全文模型对照后，失败点仍在 `eta/Gamma/u` 主链没有产生守恒输运的连续 material front，且 `phaseAreaSkeleton` 低分辨率块状反馈仍会参与下游相场骨架。

本轮实现只改物理诊断和派生场反馈，没有改构图、相机或 beauty 调色，也没有使用贴图、参考图采样、预烘焙纹理、canvas 图案、样式拟合或假纹理。具体改动：`mvp/src/visual/logoScene.js` 新增 `filmDebugView=huangResidualTransport`，把 `huangResidualTransportTexture` 路由到 shader 并提供可视化分支；`mvp/src/config/controlSchema.js` 和 `artifacts/targets/capture-soap-front-state.mjs` 加入该视图；`mvp/src/visual/thinFilmSim.js` 增加 `huangResidualTransportTarget` 的 readback 统计和 getter。相场侧把 `phaseAreaSkeleton` 的 `skeletonEvidence` 改为 `skeletonBudgetEvidence`，只按 `areaCapacity/compactLineGate/huangAreaAdmission` 和宽片 reject 过滤后参与面积预算；同时显著降低 `areaSkeletonFill` 对 `support/localHigh/physicalFillGate/targetHigh/dye/foam` 的正反馈，目标是阻止低频块状 skeleton 直接制造 high phase。

验证为 `run-3147` 到 `run-3161`，顺序覆盖 `solid -> thickness -> phase -> velocity -> foam -> filamentConnectivity -> phaseArea -> phaseAreaSkeleton -> phaseAreaError -> etaGammaVelocity -> gammaCandidate -> gammaRhsResidual -> huangResidualTransport -> huangFrontState -> beauty`，全部 `problemCount=0`，新增 shader/纹理路由没有 WebGL 或控制台错误，`solid` 最小可见性继续通过。主结果 JSON 为 `artifacts/targets/run-3147-3161-huang-residual-transport-budget-capture-results.json`，颜色对比写入 `artifacts/targets/run-3161-huang-residual-transport-budget-color-comparison.json`。

图像对照：`run-3159-huangResidualTransport...png` 能看到 residual transport 形成了宽暗带和零散物质残差信号，说明调试视图有效，但它仍不是参考图那种细长、连续、可分叉的青绿河道中心线；`run-3154-phaseAreaSkeleton...png` 的 r 通道已经变成预算证据，但图像仍有明显低分辨率块状/棋盘结构；`run-3160-huangFrontState...png` 仍是青绿暗带和噪点，不是守恒 material front；`run-3161-beauty...png` 视觉退化为偏浅粉/奶白完整球，底部只有少量棕橙碎边和极弱 cyan/purple，离参考图更远。

关键数值：相对上一轮 `run-3146`，`eta.thickFraction` 从 `0.1949` 降到 `0.1113`，`phase.highFraction` 从 `0.0514` 降到 `0.0419`，`foam.visibleFraction` 从 `0.0007` 降到 `0.0003`；`huangResidualTransportTarget.materialResidual.mean=0.1557`、`alongContinuity.mean=0.6619`、`lineAge.mean=0.0721`、`sideReject.mean=0.6885`，说明 transport reject 很强且宽域化；`huangFrontState.occupancy.mean=0.1288` 基本还在目标附近，但 `sideReject.mean=0.3031` 偏高；`phaseAreaSkeleton.skeletonBudgetEvidence.mean=0.0752` 已从上一轮 `areaGate/skeleton` 的块状强反馈方向压低，`areaGate.mean=0.1553`，`fillBudget.mean=0.0025`，说明预算削弱有效但也把视觉相场进一步压淡。粗 HSV 评估只用于失败诊断、不参与生成：参考图为 `orange=0.5929`、`cyan=0.0900`、`purple=0.0383`、`milk=0.0245`；上一轮 `run-3146` 为 `orange=0.2559`、`cyan=0.0012`、`purple=0.0099`、`milk=0.0092`；本轮 `run-3161` 为 `orange=0.1878`、`cyan=0.0004`、`purple=0.0077`、`milk=0.0434`。结论是本轮作为视觉结果失败：橙金和青绿都下降，奶白上升。

Huang 2020 全文模型对照：本轮把 residual transport 从隐藏内部 target 变成可视化/可统计状态，并阻止 `phaseAreaSkeleton` 继续直接当相场骨架，这符合“辅助场只能从 `eta/Gamma/u` 派生，不能反向伪造纹理”的方向；但当前 transport 仍只是 fragment shader 的局部上风近似，不是论文中的 staggered spherical grid、velocity-aligned/BiMocq2 平流和 `Gamma` implicit projection-like SPD solve。更关键的是，当前 residual transport 主要显示宽域残差/拒绝场，而不是可守恒输运的窄材料界面；继续削弱 phaseArea 只会让 beauty 变淡，不会凭空产生参考图的青绿分叉河道。

下一步计划：不要继续削 phaseAreaSkeleton 或调 beauty 颜色。下一轮应优先把 `huangResidualTransport` 从“诊断宽带”改成真正沿 `u + Gamma_tangent` 的守恒窄带输运：沿速度方向做 backtrace/upwind 或 BFECC/BiMocq-like 校正，横向只做 NMS/宽度约束，源项必须来自 `Gamma` projection residual 与 `eta` 连续性残差的局部极大值；同时把 `sideReject` 从当前 `0.6885` 降到可用范围，否则 front 会被拒绝场吃掉。`phaseAreaSkeleton` 后续只保留面积预算统计，不再承担 high phase 骨架；待 transport/front 形成连续分叉线后，再恢复 phase/foam 对窄前沿两侧曲率、剪切、Gamma 残差峰的派生微滴。

## 2026-06-02 heartbeat / Run 3162-3206: Huang residual transport 窄带化，并把 Huang front 接回相场/微滴通道

开始前检查：本轮重新读取了 `artifacts/targets/soap-film-huang-2020-fulltext-notes.md`、`soap-film-physics-handoff.md`、`soap-film-target.md` 和本迭代文件，并重新对照 `artifacts/targets/soap-film-reference.jpg` 与上一轮 `run-3161-beauty-huang-residual-transport-budget.png`、`run-3159-huangResidualTransport...png`、`run-3160-huangFrontState...png`、`run-3153-phaseArea...png`、`run-3154-phaseAreaSkeleton...png`。结论：solid/壳层可见性已成立，上一轮失败不在初始化/相机/Shader 黑屏，而在 `huangResidualTransport` 仍是宽暗带/拒绝场，`phaseAreaSkeleton` 是低分辨率块状反馈，最终 beauty 变成大面积粉白薄膜，缺参考图的橙金厚膜大陆、青绿分叉河道、紫蓝窄边和奶金/白色微滴密度。

本轮实现只改真实物理派生场，没有改构图、相机或按参考图调色，也没有使用贴图、参考图采样、预烘焙纹理、canvas 图案、样式拟合或假纹理。第一步在 `HUANG_RESIDUAL_TRANSPORT_FRAGMENT_SHADER` 中把 residual source 改为横向 NMS + 纵向支撑 + 沿 `u + Gamma_tangent` 的上风回溯，并加入简单 BFECC-like 历史校正，让 `materialResidual` 必须来自 `Gamma` projection residual、`eta` 连续性残差和球面速度方向的局部峰值。初版 `run-3162-3176-huang-transport-narrow-band` 通过所有视图但失败：`materialResidual.mean=0.4880`、`alongContinuity.mean=1.0`，说明 source 被放得过宽，形成粉橙整面噪点。

第二步收紧 transport：要求 center dominance、two-sided/one-sided longitudinal support，并让历史回溯服从当前线形一致性。`run-3177-3191-huang-transport-narrow-band-v2` 全部 `problemCount=0`，关键指标改善为 `materialResidual.mean=0.1130`、`above035=0.1107`、`sideReject.mean=0.2801`、`alongContinuity.mean=0.3070`、`huangFrontState.occupancy.mean=0.1539`。这说明 residual transport 已从整面激活收回到较窄的物质线候选，但视觉仍是散斑/暗带，不是参考图的连通分叉河道；beauty 仍偏奶白。

第三步把已收窄的 Huang front 接回 `PHASE_AREA_FRAGMENT_SHADER` 与 `PHASE_STEP_FRAGMENT_SHADER`：降低 `hfNarrowLine/hfNarrowAdmission` 对已通过 Huang transport 的前沿的横向拒绝，增加其对 `fillBudget`、`huangLineSource`、`physicalFillGate`、`targetHigh`、`dropletNucleation` 和 `foamCeiling` 的贡献，同时保留 `broadSheet`、`areaSheetDrain`、`filamentWidthPenalty` 作为宽片制动。`run-3192-3206-huang-front-phase-coupling` 也全部 `problemCount=0`。关键指标：`eta.mean=0.5589`、`eta.thickFraction=0.1371`、`phase.highFraction=0.1279`、`foam.visibleFraction=0.0009`、`residualMean=0.1208`、`residualSideReject=0.2853`、`frontOcc=0.1610`、`frontSideReject=0.2818`、`phaseAreaSkeleton.skeletonBudgetEvidence.mean=0.2158`、`fillBudget.mean=0.0201`、`areaGate.mean=0.3794`、`phaseAreaError.physicalLineEvidence.mean=0.0872`、`narrowPhysicalGate.mean=0.0833`、`broadSheet.mean=0.2463`。

图像对照：`run-3206-beauty-huang-front-phase-coupling.png` 相比 `run-3161` 明显恢复了橙金厚膜，不再是整片粉白；底部和局部边缘出现青绿/紫蓝薄膜干涉边。但它仍远未达标：橙金变成过连续的大块平面，参考图中贯穿中心的青绿分叉河道没有形成，紫蓝窄边只在碎边出现，微滴/泡沫密度仍低且没有沿河道边界成串分布。`run-3204-huangResidualTransport...png` 和 `run-3205-huangFrontState...png` 仍显示宽暗带与散点，而非守恒输运出的细长 material front；`run-3199-phaseAreaSkeleton...png` 的低分辨率块状/棋盘结构仍存在。

粗 HSV 统计写入 `artifacts/targets/run-3206-huang-front-phase-coupling-color-comparison.json`，仅用于失败诊断，不参与生成：参考图 `orange=0.5369`、`cyan=0.0892`、`purple=0.0312`、`milk=0.0081`；上一轮 `run-3161` 为 `orange=0.3443`、`cyan=0.0025`、`purple=0.0094`、`milk=0.1541`；窄带 v2 `run-3191` 为 `orange=0.3689`、`cyan=0.0025`、`purple=0.0088`、`milk=0.4110`；最终 `run-3206` 为 `orange=0.5285`、`cyan=0.0044`、`purple=0.0106`、`milk=0.0194`。结论：橙金比例接近参考图，奶白污染被压下，但 cyan 仍约低 20 倍、purple 约低 3 倍，且空间结构不对。

Huang 2020 全文模型对照：本轮更接近 `eta/Gamma/u` 派生的 material transport，因为 residual 不再直接涂到相场，而是先经过球面局部梯度、投影散度、速度方向回溯和横向 NMS；但它仍不是论文中的 staggered spherical grid、velocity-aligned/BiMocq2 平流和 `Gamma` 隐式 projection-like SPD 系统。最大失败点是 material front 没有守恒成连续分叉线，`phaseAreaSkeleton` 仍能把低频块状预算放大到相场，导致最终只有橙金厚膜大面而没有参考图的青绿河网。

下一步计划：不要改构图，不要调 beauty 颜色，不要采样参考图。优先继续 Huang 主线，把 `huangResidualTransport` 从局部 shader 近似推进到更真正的守恒窄带输运：沿 `u + Gamma_tangent` 做更稳定的 backtrace/BFECC 或 BiMocq-like 双向校正，增加中心线 age 的连通保持，源项只接受 `Gamma` projection residual 与 `eta` 连续性残差的局部极大值；同时把 `phaseAreaSkeleton` 对 `areaGate/fillBudget` 的低分辨率块状反馈进一步限制为统计预算，不允许它独立制造 high phase 骨架。验收先看 `huangResidualTransport/huangFrontState` 是否形成连续弯曲分叉线，再看 `phaseAreaSkeleton` 是否不再棋盘化，最后才看 beauty 的 cyan/purple 是否随物理线自然上升。

## 2026-06-02 heartbeat / Run 3207-3236: material front 历史桥接尝试，v1 过宽后收紧为 v2

开始前检查：本轮按自动化要求重新读取 `artifacts/targets/soap-film-huang-2020-fulltext-notes.md`、`soap-film-physics-handoff.md`、`soap-film-target.md` 和本迭代文件，并重新查看 `soap-film-reference.jpg`、上一轮 `run-3206-beauty-huang-front-phase-coupling.png`、`run-3204-huangResidualTransport...png`、`run-3205-huangFrontState...png`、`run-3199-phaseAreaSkeleton...png` 与 `run-3198-phaseArea...png`。对照结论：上一轮 solid/物理场可见性已经成立，不是黑屏、初始化或 shader 路由问题；橙金厚膜比例被恢复，但仍是过连续的大块厚膜，参考图里的青绿分叉河道、贴河道的紫蓝窄边、沿边界的奶金/白色微滴密度都没有形成。Huang 全文模型对照后，失败点仍是 `eta/Gamma/u` 派生的 material front 没有守恒连通成窄线，且 `phaseAreaSkeleton` 的低分辨率块状预算仍会影响下游相场。

本轮实现没有改构图、相机或 beauty 调色，也没有使用贴图、参考图采样、预烘焙纹理、canvas 图案、样式拟合或假纹理。第一步在 `HUANG_RESIDUAL_TRANSPORT_FRAGMENT_SHADER` 中加入沿 `u + Gamma_tangent` 的分支采样、历史前沿桥接、BFECC-like 历史校正继承和 line age/continuity 传递；在 `HUANG_FRONT_STATE_FRAGMENT_SHADER` 中加入 `transportLineContinuity`/`transportBridgeGate`，让 front state 更相信有输运历史和年龄的窄前沿。`run-3207-3221-huang-material-front-continuity` 全部视图 `problemCount=0`，但失败：`materialResidual.mean=0.3179`、`alongContinuity.mean=0.7655`、`lineAge.mean=0.5783`，说明桥接过宽，把前沿记忆铺成片。对应 beauty 的 cyan/purple 略增，但这是宽 residual 的副作用，不是守恒窄河道。

第二步立刻收紧 v2：桥接必须同时满足局部 residual 峰、分支邻域支撑与横向拒绝，line age 也只有在 `historyLineNms/bridgeCoherence` 通过时才继承。`run-3222-3236-huang-material-front-continuity-v2` 再次按 `solid -> thickness -> phase -> velocity -> foam -> filamentConnectivity -> phaseArea -> phaseAreaSkeleton -> phaseAreaError -> etaGammaVelocity -> gammaCandidate -> gammaRhsResidual -> huangResidualTransport -> huangFrontState -> beauty` 验证，全部 `problemCount=0`。关键数值：`eta.mean=0.5938`、`eta.thickFraction=0.3354`、`phase.highFraction=0.1899`、`foam.visibleFraction=0.0085`、`huangResidualTransport.materialResidual.mean=0.2073`、`above035=0.3173`、`alongContinuity.mean=0.4228`、`lineAge.mean=0.1668`、`sideReject.mean=0.2496`、`huangFrontState.occupancy.mean=0.1689`、`lineAge.mean=0.1299`、`sideReject.mean=0.2857`、`phaseAreaSkeleton.skeletonBudgetEvidence.mean=0.2231`、`areaGate.mean=0.3951`、`fillBudget.mean=0.0211`、`phaseAreaError.physicalLineEvidence.mean=0.0875`、`narrowPhysicalGate.mean=0.0817`、`broadSheet.mean=0.2392`。

图像对照：`run-3236-beauty-huang-material-front-continuity-v2.png` 比 v1 收紧后更接近上一轮橙金主体，但仍不是参考图。它有少量青绿/紫蓝边缘，尤其右下侧出现一些由 front 派生出的窄条，但主画面仍是大块连续橙金膜，中心贯穿、宽窄变化、弯曲分叉的青绿河道没有形成；奶金/白色微滴虽比上一轮有所增加，但仍不是沿河道边界成串的高密度颗粒。`run-3234-huangResidualTransport...png` 从 v1 的铺片回收了一部分，但还是宽暗带、块状残差和散点；`run-3235-huangFrontState...png` 仍偏暗带/噪点，不是 material front 细线；`run-3229-phaseAreaSkeleton...png` 的紫色格块仍然明显，这是下游相场块状化的主要失败源之一。

粗 HSV 统计写入 `artifacts/targets/run-3236-huang-material-front-continuity-v2-color-comparison.json`，只用于失败诊断，不参与生成。使用本轮同一套阈值时，参考图约 `orange=0.5532`、`cyan=0.0811`、`purple=0.0312`、`milk=0.0154`；`run-3206` 为 `orange=0.6823`、`cyan=0.0040`、`purple=0.0071`、`milk=0.0395`；v1 `run-3221` 为 `orange=0.5763`、`cyan=0.0138`、`purple=0.0305`、`milk=0.0510`；v2 `run-3236` 为 `orange=0.6491`、`cyan=0.0050`、`purple=0.0112`、`milk=0.0385`。结论：v1 的 cyan/purple 增加来自过宽 residual，不可接受；v2 回到较稳状态但 cyan 仍比参考低约一个数量级以上，且空间结构完全不对。

Huang 2020 全文模型对照：本轮比上一轮更接近“沿速度和表活剂切线输运 material front”的方向，因为 residual 不再只做当前帧局部筛选，而是引入历史回溯、分支延续和年龄继承；但它仍只是片段 shader 近似，尚未达到论文的 staggered spherical grid、velocity-aligned/BiMocq2 映射维护和 `Gamma` implicit projection-like SPD 更新。最大的数值偏差是 transport 仍在宽暗带和格块之间摆动，说明局部 residual/历史桥接无法替代真正的球面守恒平流；`phaseAreaSkeleton` 仍能把低分辨率块状预算放大成相场骨架，破坏参考图需要的连续青绿河网。

下一步计划：保留 v2 的收紧，不回到 v1。下一轮不要改构图，不要调 beauty 颜色，不要采样参考图。优先做两件事：第一，把 `huangResidualTransport` 的历史桥接从“局部上一帧采样”升级为更明确的双向 backtrace/BFECC 误差限制，输出额外的 transport confidence 或 reset gate，避免全屏 age/continuity 扩散；第二，把 `phaseAreaSkeleton` 的低分辨率格块反馈进一步降级为只读统计预算，`areaGate/fillBudget` 必须主要来自高分辨率 `huangFrontState`、局部 `eta/Gamma/u` 残差和真实相界剪切。验收指标先看 `huangResidualTransport.materialResidual.mean` 回到约 `0.12-0.16` 且 `huangFrontState` 形成连续弯曲分叉窄线，再看 `phaseAreaSkeleton` 是否去格块化，最后才看 beauty 的 cyan/purple 是否沿这些物理线自然增加。

## 2026-06-02 heartbeat / Run 3237-3251: transport confidence/reset gate 收紧过头，前沿源不足

开始前检查：本轮按自动化要求重新读取 `artifacts/targets/soap-film-huang-2020-fulltext-notes.md`、`artifacts/targets/soap-film-physics-handoff.md`、`artifacts/targets/soap-film-target.md` 和本迭代文件，并重新查看 `soap-film-reference.jpg`、上一轮 `run-3236-beauty-huang-material-front-continuity-v2.png`、`run-3234-huangResidualTransport...png`、`run-3235-huangFrontState...png`、`run-3229-phaseAreaSkeleton...png` 与 `run-3230-phaseAreaError...png`。对照结论：上一轮 solid/壳层可见性成立，失败不在初始化、构图、相机或 shader 黑屏；核心偏差是 `huangResidualTransport` 仍是宽暗带/块状残差，`huangFrontState` 是雾状散点而不是守恒窄 material front，`phaseAreaSkeleton` 仍有低分辨率棋盘反馈，最终 beauty 缺参考图的青绿分叉河道、紫蓝窄边和沿河道边界的奶金/白色微滴。

本轮实现仍然没有改构图、相机或 beauty 调色，也没有使用贴图、参考图采样、预烘焙纹理、canvas 图案、样式拟合或假纹理。第一步在 `HUANG_RESIDUAL_TRANSPORT_FRAGMENT_SHADER` 中加入 `resetGate` 和 `transportConfidence`，让历史残差只有在当前局部 `Gamma/eta/u` 源、中心线 dominance、桥接源和前一帧中心线一致时才继承；同时把 age/continuity 继承乘上置信度，侧向响应和历史 reject 会压低传输。第二步在 `HUANG_FRONT_STATE_FRAGMENT_SHADER` 中修改 `transportedResidualScalar`，不再允许 residual 红通道单独形成前沿，必须同时有沿线连续性/年龄且侧向 reject 低。第三步在 `PHASE_AREA_FRAGMENT_SHADER` 与 `PHASE_STEP_FRAGMENT_SHADER` 中继续把 `phaseAreaSkeleton` 降级为预算提示：`skeletonBudgetEvidence` 需要高分辨率 `huangFrontState`、`narrowPhysicalLine`、`compactLineGate` 共同门控，`areaSkeletonFill` 对 `support/localHigh/physicalFillGate/targetHigh` 的正反馈进一步降低。

验证结果：`mvp/src/visual/thinFilmSim.js` 通过 `node --input-type=module --check`。完整截图 `run-3237-3251-huang-transport-confidence-reset` 覆盖 `solid -> thickness -> phase -> velocity -> foam -> filamentConnectivity -> phaseArea -> phaseAreaSkeleton -> phaseAreaError -> etaGammaVelocity -> gammaCandidate -> gammaRhsResidual -> huangResidualTransport -> huangFrontState -> beauty`，全部 `problemCount=0`。结果 JSON 写入 `artifacts/targets/run-3237-3251-huang-transport-confidence-reset-capture-results.json`，色彩诊断写入 `artifacts/targets/run-3251-huang-transport-confidence-reset-color-comparison.json`。

关键数值：以最终 beauty 帧为准，`eta.mean=0.5628`、`eta.thickFraction=0.2318`、`phase.highFraction=0.1577`、`foam.visibleFraction=0.0159`。`huangResidualTransport.materialResidual.mean=0.1861`、`above035=0.3071`、`alongContinuity.mean=0.3885`、`lineAge.mean=0.1246`、`sideReject.mean=0.3548`；相对上一轮 v2 的 `materialResidual.mean=0.2073` 确实收窄，但没有达到目标 `0.12-0.16`。`huangFrontState.occupancy.mean=0.1580`、`above035=0.1798`、`lineAge.mean=0.1157`、`sideReject.mean=0.2886`，占比仍在可用范围附近，但画面形态不是连续分叉线。

图像对照：`run-3251-beauty-huang-transport-confidence-reset.png` 明显退化为大面积浅粉/奶白厚膜球，橙金厚膜大陆减少，青绿/紫蓝窄边几乎被杀掉，和参考图中贯穿中部的青绿分叉河网完全不相似。`run-3249-huangResidualTransport...png` 的宽残差被压暗压窄了一部分，但呈现大块黑带、棕色噪点和局部条纹，不是守恒输运出的细长物质界面。`run-3250-huangFrontState...png` 仍是雾状青绿/黑带斑点，缺少连续弯曲分叉前沿。`run-3244-phaseAreaSkeleton...png` 和 `run-3245-phaseAreaError...png` 依旧显示明显低分辨率格块结构，说明只降低权重还不足以解除棋盘反馈。

粗 HSV 统计只用于失败诊断，不参与生成或拟合。同一口径下参考图约 `orange=0.3634`、`cyan=0.0910`、`purple=0.0338`、`milk=0.0031`；上一轮 `run-3236` 为 `orange=0.1773`、`cyan=0.0024`、`purple=0.0032`、`milk=0.0048`；本轮 `run-3251` 为 `orange=0.0788`、`cyan=0.0001`、`purple=0.0007`、`milk=0.1030`。结论是本轮作为视觉结果失败：收紧 reject 以后 cyan/purple 被进一步压没，奶白急剧上升，说明问题不是“残差太宽所以再压”这么简单，而是连续物理前沿源不足，且相场/光学厚度耦合把画面推入奶白厚膜相位。

Huang 2020 全文模型对照：本轮的 `resetGate/transportConfidence` 仍只是 fragment shader 局部近似，能抑制一部分全局 age/continuity 扩散，但没有实现论文中的 velocity-aligned/BiMocq2 映射维护、staggered spherical grid 和 `Gamma` implicit projection-like solve。因此它会在“宽残差”和“杀死前沿”之间摆动：过宽时 cyan/purple 是伪宽带副作用，过窄时 material front 断裂，不能自发形成参考图的青绿分叉河道。`phaseAreaSkeleton` 继续证明低分辨率面积预算不能作为 high phase 骨架，只能作为只读统计量。

下一步计划：不要继续单纯提高 reject，也不要回到 v1 宽残差；不要改构图、不要调 beauty 颜色、不要采样参考图。下一轮应补“真实连续前沿源”：把 `Gamma` projection residual、`eta` 连续性残差和速度压缩先做局部极大值/中心线提取，再沿 `u + Gamma_tangent` 做更明确的双向 backtrace/BFECC 误差限制，允许守恒窄线延续但禁止横向铺片；同时把 `phaseAreaSkeleton` 的低分辨率输出从相场增长链路中进一步剥离，只保留诊断/预算，不再进入 `targetHigh` 或 `areaSkeletonFill` 的正反馈。验收先看 `huangResidualTransport` 是否从宽暗带变成连续弯曲分叉窄线，再看 `phaseAreaSkeleton` 是否去格块化，最后才看 beauty 的 cyan/purple 是否沿物理线自然回升。

## 2026-06-02 heartbeat / Run 3252-3266: 中心线源恢复少量颜色，但 residual/front 再次过宽

开始前检查：本轮按要求重新读取 `artifacts/targets/soap-film-huang-2020-fulltext-notes.md`、`artifacts/targets/soap-film-physics-handoff.md`、`artifacts/targets/soap-film-target.md` 和本迭代文件，并重新查看 `soap-film-reference.jpg`、上一轮 `run-3251-beauty-huang-transport-confidence-reset.png`、`run-3249-huangResidualTransport...png`、`run-3250-huangFrontState...png`、`run-3243-phaseArea...png`、`run-3244-phaseAreaSkeleton...png` 与 `run-3245-phaseAreaError...png`。对照结论：上一轮收紧过头，`beauty` 退化为奶白/浅粉厚膜，青绿和紫蓝几乎消失；但继续单纯放宽 residual 会回到宽暗带和伪宽带副作用。因此本轮目标不是调色，也不是构图，而是补一个由 `Gamma/eta/u` 局部中心线和 BFECC 一致性支持的物理前沿源。

本轮实现只改 `mvp/src/visual/thinFilmSim.js`，没有改构图、相机或 beauty 调色，也没有使用贴图、参考图采样、预烘焙纹理、canvas 图案、样式拟合或假纹理。在 `HUANG_RESIDUAL_TRANSPORT_FRAGMENT_SHADER` 中新增 `physicalCenterPeak`、`velocityLineSource`、`centerlineSource` 与 `bfeccConsistency`，让当前帧局部极大值、速度/表活剂切向支撑、前后回溯误差和侧向 reject 共同决定 material residual 的源项与传输置信度；在 `HUANG_FRONT_STATE_FRAGMENT_SHADER` 中让 `transportedResidualScalar` 更依赖沿线连续性和年龄，并加入 `materialLineGate`，避免只有红通道 residual 单独铺片；同时继续降低 `PHASE_AREA_FRAGMENT_SHADER` 与 `PHASE_STEP_FRAGMENT_SHADER` 中 `phaseAreaSkeleton` 对 `areaGate/fillBudget/areaSkeletonFill` 的正反馈权重。

验证结果：`mvp/src/visual/thinFilmSim.js` 通过 `node --input-type=module --check`。完整截图 `run-3252-3266-huang-centerline-transport-source` 覆盖 `solid -> thickness -> phase -> velocity -> foam -> filamentConnectivity -> phaseArea -> phaseAreaSkeleton -> phaseAreaError -> etaGammaVelocity -> gammaCandidate -> gammaRhsResidual -> huangResidualTransport -> huangFrontState -> beauty`，全部 `problemCount=0`。结果 JSON 写入 `artifacts/targets/run-3252-3266-huang-centerline-transport-source-capture-results.json`。

关键数值：以最终 `run-3266-beauty-huang-centerline-transport-source.png` 为准，`eta.mean=0.5789`、`eta.thickFraction=0.2971`、`phase.highFraction=0.1625`、`foam.visibleFraction=0.0008`。`huangResidualTransport.materialResidual.mean=0.2383`、`above035=0.3456`、`alongContinuity.mean=0.4208`、`lineAge.mean=0.1747`、`sideReject.mean=0.3216`；`huangFrontState.occupancy.mean=0.1959`、`above035=0.2333`、`lineAge.mean=0.1521`、`sideReject.mean=0.2919`。也就是说，中心线源恢复了 material residual，但强度和覆盖又偏宽，超过当前计划中的 `0.12-0.16` residual 目标和 `0.12-0.18` front occupancy 目标。

图像对照：`run-3266-beauty...png` 比 `run-3251` 恢复了一些橙金厚膜和很少量青绿/紫蓝边，但仍远低于参考图。参考图的核心是橙金厚膜被连续青绿分叉河道切开，河道边缘有紫蓝窄边和高密度奶金/白色微滴；本轮仍主要是大块平滑橙金厚膜，青绿河道没有贯穿和分叉，紫蓝只在局部边缘零散出现，微滴也没有沿河道边界成串生成。`run-3264-huangResidualTransport...png` 仍是宽暗带、棕色噪点和局部块状残差，而不是守恒输运出的细长 material front；`run-3265-huangFrontState...png` 更活跃但偏雾状/片状；`run-3259-phaseAreaSkeleton...png` 与 `run-3260-phaseAreaError...png` 仍有低分辨率格块结构。

粗 HSV 统计只用于失败诊断，不参与生成或拟合。同一口径下参考图约 `orange=0.3218`、`cyan=0.0764`、`purple=0.0296`、`milk=0.0039`；上一轮 `run-3251` 为 `orange=0.0590`、`cyan=0.0000`、`purple=0.0002`、`milk=0.0426`；本轮 `run-3266` 为 `orange=0.1270`、`cyan=0.0019`、`purple=0.0023`、`milk=0.0047`。结论是：相比上一轮，奶白污染下降、橙金恢复、青绿/紫蓝略有回升；但 cyan 仍比参考低约 40 倍，purple 低约 13 倍，且空间结构不对。

Huang 2020 全文模型对照：本轮比上一轮更接近“由 `eta/Gamma/u` 局部极值和沿速度/Marangoni 切向输运形成前沿源”的方向，但仍只是 fragment shader 的局部近似，没有达到论文中的 staggered spherical grid、velocity-aligned/BiMocq2 映射维护、`Gamma` implicit projection-like SPD solve 和真正守恒的球面通量离散。当前算法仍会在两个错误之间摆动：收紧时杀死前沿和颜色，放宽时 residual/front 变成宽暗带。它不违背“不贴图/不拟合/不调色”的约束，但与 Huang 2020 的完整数值方法仍有明显差距。

下一步计划：保留 `physicalCenterPeak`/BFECC 一致性的方向，但必须把它改成更守恒、更窄的通量更新，而不是直接提高 `centerlineSource`。下一轮优先做两件事：第一，把 `centerlineSource` 从“可直接增大 residual/front 的源”改为“只允许局部极大值沿 `u + Gamma_tangent` 输运的候选”，并用 side reject、BFECC error 和横向梯度比限制横向铺片；第二，把 `phaseAreaSkeleton` 对 `targetHigh/areaSkeletonFill/fillBudget` 的残余正反馈继续剥离，只保留诊断预算。验收先看 `huangResidualTransport.materialResidual.mean` 回到约 `0.14-0.18` 且形态变成连续分叉窄线，再看 `huangFrontState.occupancy.mean` 回到 `0.12-0.18`，最后才看 beauty 的 cyan/purple 是否沿物理线自然上升。

## 2026-06-02 heartbeat / Run 3267-3296: centerline 收窄与相场回补，数值回到目标但河网仍失败

开始前检查：本轮按自动化要求重新读取 `artifacts/targets/soap-film-huang-2020-fulltext-notes.md`、`artifacts/targets/soap-film-physics-handoff.md`、`artifacts/targets/soap-film-target.md` 和本迭代文件，并重新查看 `soap-film-reference.jpg`、上一轮 `run-3266-beauty-huang-centerline-transport-source.png`、`run-3264-huangResidualTransport...png`、`run-3265-huangFrontState...png`、`run-3259-phaseAreaSkeleton...png`。对照结论：上一轮比 `run-3251` 恢复了一点橙金和少量青/紫，但 `centerlineSource` 直接增大 residual/front，导致 `materialResidual.mean=0.2383`、`frontOccupancy.mean=0.1959` 偏宽；参考图需要的是连续弯曲分叉的青绿河道，而不是宽暗带或雾状 front。

本轮实现只改 `mvp/src/visual/thinFilmSim.js`，没有改构图、相机或 beauty 调色，也没有使用贴图、参考图采样、预烘焙纹理、canvas 图案、样式拟合或假纹理。第一步在 `HUANG_RESIDUAL_TRANSPORT_FRAGMENT_SHADER` 中收紧 `physicalCenterPeak/velocityLineSource/sideReject/bfeccConsistency`，删除 `centerlineSource * 0.74` 对 `materialResidual` 的直通抬高，让中心线只通过 NMS、BFECC 一致性和沿线 transport confidence 成为候选；第二步在 `HUANG_FRONT_STATE_FRAGMENT_SHADER` 中降低 `materialLineGate/residualSeed/residualTransportMemory` 对 occupancy 的直通贡献，并提高侧向/历史宽片拒绝；第三步把 `PHASE_STEP_FRAGMENT_SHADER` 中 `areaSkeletonFill` 及其对 `support/localHigh/physicalFillGate/targetHigh/dye/foam` 的残余权重继续压到诊断级。

第一组验证为 `run-3267-3281-huang-centerline-narrow-flux`，覆盖 `solid -> thickness -> phase -> velocity -> foam -> filamentConnectivity -> phaseArea -> phaseAreaSkeleton -> phaseAreaError -> etaGammaVelocity -> gammaCandidate -> gammaRhsResidual -> huangResidualTransport -> huangFrontState -> beauty`，全部 `problemCount=0`。数值上 `beauty` 帧为 `eta.mean=0.5579`、`eta.thickFraction=0.1622`、`phase.highFraction=0.1234`、`foam.visibleFraction=0.0007`、`materialResidual.mean=0.1858`、`frontOccupancy.mean=0.1352`，看起来回到了目标范围；但视觉退化为大面积奶粉厚膜，cyan 统计为 0。说明单纯收窄确实能压宽 residual，却把本来已经很弱的青绿前沿也杀掉。

第二组只做小幅相场回补，没有放宽 residual 本身：提高 `huangLineSource/hfNarrowAdmission/physicalFillGate` 对 `targetHigh/areaCorrection/dye` 的物理相场贡献，让已通过 `huangFrontState` 的窄线证据能生成薄相。验证为 `run-3282-3296-huang-front-phase-refeed`，所有视图仍 `problemCount=0`，结果 JSON 写入 `artifacts/targets/run-3282-3296-huang-front-phase-refeed-capture-results.json`，色彩诊断写入 `artifacts/targets/run-3296-huang-front-phase-refeed-color-comparison.json`。

最终关键数值：以 `run-3296-beauty-huang-front-phase-refeed.png` 为准，`eta.mean=0.5814`、`eta.thickFraction=0.3023`、`phase.highFraction=0.1617`、`foam.visibleFraction=0.0082`、`huangResidualTransport.materialResidual.mean=0.1789`、`above035=0.3090`、`alongContinuity.mean=0.3922`、`lineAge.mean=0.1164`、`sideReject.mean=0.4078`；`huangFrontState.occupancy.mean=0.1318`、`above035=0.1592`、`lineAge.mean=0.1069`、`sideReject.mean=0.2873`。数值范围比 `run-3266` 更接近计划，但形态仍失败：`huangResidualTransport` 还是宽暗带/噪点，`huangFrontState` 仍是雾状青绿场，`phaseAreaSkeleton` 仍显示明显低分辨率格块。

图像对照：`run-3296-beauty...png` 相比 `run-3281` 稍微恢复橙金和局部青绿/紫蓝边，但仍远不接近参考图。参考图里青绿河道贯穿中部并分叉，河道边有紫蓝窄边和密集奶金/白色微滴；本轮中部仍是大块平滑厚膜，青绿只在局部边缘和底部碎片出现，微滴不是沿河道边界成串分布。`run-3294-huangResidualTransport...png` 和 `run-3295-huangFrontState...png` 说明根因仍在 Huang front：当前没有真正的 velocity-aligned 守恒 material front。

粗 HSV 统计只用于失败诊断，不参与生成或拟合。同一口径下参考图约 `orange=0.3218`、`cyan=0.0764`、`purple=0.0296`、`milk=0.0039`；`run-3266` 为 `orange=0.1270`、`cyan=0.0019`、`purple=0.0023`、`milk=0.0047`；过度收窄的 `run-3281` 为 `orange=0.1145`、`cyan=0.0000`、`purple=0.0008`、`milk=0.0081`；最终 `run-3296` 为 `orange=0.1393`、`cyan=0.0011`、`purple=0.0010`、`milk=0.0033`。结论：最终版数值比 3266 稳，但 cyan/purple 仍极低，且空间结构完全不对。

Huang 2020 全文模型对照：本轮进一步证明局部 fragment shader 门控无法替代论文中的 staggered spherical grid、velocity-aligned/BiMocq2 映射维护和 `Gamma` implicit projection-like SPD solve。我们能用门控把 `materialResidual.mean/frontOccupancy.mean` 调回目标范围，但前沿形态仍在“宽暗带/雾场/格块”之间摆动，没有变成由 `eta/Gamma/u` 守恒输运出的连续分叉窄线。当前实现仍不违背禁用贴图和禁用样式拟合的要求，但贴合论文程度仍停留在局部近似，不足以复现参考图的核心物理质感。

下一步计划：不要继续调 `centerlineSource` 的标量权重，也不要继续在 `phaseAreaSkeleton` 上打补丁。下一轮应推进真正的结构改造：把 `huangResidualTransport` 或一个新 front buffer 改成高分辨率守恒通量更新，明确存储 `materialResidual/lineAge/confidence` 的前向/后向映射误差，按 `u + Gamma_tangent` 做双向 backtrace，并在横向方向只做 NMS/宽度约束；同时把 `phaseAreaSkeleton` 从相场增长链路中完全剥离，改为只读诊断或升为高分辨率从 `huangFrontState` 下采样的显示层。验收不再先看 beauty，而先看 `huangResidualTransport` 是否出现连续弯曲分叉窄线，再看 phase 是否沿这些线生成青绿河道。

## 2026-06-02 heartbeat / Run 3297-3326: 守恒 front 尝试与高分辨率相场源，视觉结果明显倒退

开始前检查：本轮按要求重新读取 `artifacts/targets/soap-film-huang-2020-fulltext-notes.md`、`artifacts/targets/soap-film-physics-handoff.md`、`artifacts/targets/soap-film-target.md` 和本迭代文件，并重新查看 `soap-film-reference.jpg`、上一轮 `run-3296-beauty-huang-front-phase-refeed.png`、`run-3294-huangResidualTransport...png`、`run-3295-huangFrontState...png`、`run-3289-phaseAreaSkeleton...png`。对照结论：上一轮最小可见性与 debug view 都可用，但最终 beauty 仍只有局部青/紫碎片，没有参考图的贯穿式青绿分叉河道；更关键的是 `huangResidualTransport` 与 `huangFrontState` 仍是宽暗带/雾场，说明不能继续做构图或 beauty 调色。

本轮实现只改 `mvp/src/visual/thinFilmSim.js`，没有改构图、相机或 beauty 调色，也没有使用贴图、参考图采样、预烘焙纹理、canvas 图案、样式拟合或假纹理。第一步在 `HUANG_RESIDUAL_TRANSPORT_FRAGMENT_SHADER` 中加入 `incomingFlux/outgoingFlux/lateralLeak/conservativeFluxGate/conservativeFluxBalance` 等守恒近似，让 material residual 更依赖沿 `u + Gamma_tangent` 的输入/输出通量，而不是直接由局部 `centerlineSource` 抬高；第二步在 `HUANG_FRONT_STATE_FRAGMENT_SHADER` 中加入 `materialFluxGate`，让 residual 需要通过 material flux、line age、side reject 和 continuity 才能进入 occupancy；第三步把 `PHASE_STEP_FRAGMENT_SHADER` 里的 `areaSkeletonFill` 设为 0，使低分辨率 `phaseAreaSkeleton` 只保留诊断意义，不再作为相场/foam 增长骨架。

第一组验证为 `run-3297-3311-huang-conservative-front-flux`，覆盖 `solid -> thickness -> phase -> velocity -> foam -> filamentConnectivity -> phaseArea -> phaseAreaSkeleton -> phaseAreaError -> etaGammaVelocity -> gammaCandidate -> gammaRhsResidual -> huangResidualTransport -> huangFrontState -> beauty`，全部 `problemCount=0`，`solid` 最小可见性成立。数值上 `beauty` 帧约 `eta.mean=0.5765`、`eta.thickFraction=0.3326`、`phase.highFraction=0.1682`、`foam.visibleFraction=0.0035`、`materialResidual.mean=0.1822`、`frontOccupancy.mean=0.1260`，看似仍在可用区间；但图像倒退成大面积浅粉/奶白膜，青绿和紫蓝几乎消失，说明把低分辨率 skeleton 剥离后，当前高分辨率 front 本身并不能支撑河道相场。

第二组小幅补救不是调色，而是在 `PHASE_STEP_FRAGMENT_SHADER` 中加入来自高分辨率 `huangFrontState` 的 `hfLineSource`，让相场补给至少直接由 `occupancy/lineAge/sideReject` 的物理 front 进入，而不是回到低分辨率 skeleton。验证为 `run-3312-3326-huang-highres-front-phase-source`，同样覆盖全部指定 debug views，所有截图 `problemCount=0`，结果 JSON 写入 `artifacts/targets/run-3312-3326-huang-highres-front-phase-source-capture-results.json`，色彩诊断写入 `artifacts/targets/run-3326-huang-highres-front-phase-source-color-comparison.json`。

最终关键数值：以 `run-3326-beauty-huang-highres-front-phase-source.png` 为准，`eta.mean=0.5708`、`eta.thickFraction=0.2729`、`phase.highFraction=0.1527`、`foam.visibleFraction=0.0009`；`huangResidualTransport.materialResidual.mean=0.1890`、`alongContinuity.mean=0.4013`、`lineAge.mean=0.1182`、`sideReject.mean=0.4188`；`huangFrontState.occupancy.mean=0.1290`、`lineAge.mean=0.1050`、`sideReject.mean=0.2895`。这些数字本身没有彻底崩，但图像失败更明确：`run-3324-huangResidualTransport...png` 仍是黑暗宽带和噪点，`run-3325-huangFrontState...png` 仍是雾状青绿色团，`run-3314-phase...png` 只有左侧/底部局部竖向青紫条，没有参考图的连续分叉河网。

图像对照：参考图的核心是橙金厚膜大面积存在，同时被贯穿中部的青绿分叉河道切开，河道边缘有紫蓝窄边，且奶金/白色微滴沿边界和厚膜纹理高密度分布。`run-3296` 至少还有少量边缘青/紫碎片；`run-3311` 和 `run-3326` 则被浅粉/奶白覆盖，橙金厚膜占比大幅下降，青绿河道为 0，紫蓝只剩极弱噪声，微滴也没有沿河道边界成串组织。`phaseAreaSkeleton` 虽然仍显示低分辨率格块，但本轮已从增长链路中剥离；失败原因不再主要是 skeleton 喂相场，而是高分辨率 Huang front 没有形成可用的 material river。

粗 HSV 统计只用于失败诊断，不参与生成或拟合。本轮同一口径下参考图约 `orange=0.3648`、`cyan=0.0827`、`purple=0.0269`、`milk=0.0001`；上一轮 `run-3296` 为 `orange=0.1391`、`cyan=0.0013`、`purple=0.0021`、`milk=0.0006`；第一组 `run-3311` 为 `orange=0.0601`、`cyan=0.0000`、`purple=0.0001`、`milk=0.0490`；最终 `run-3326` 为 `orange=0.0492`、`cyan=0.0000`、`purple=0.0004`、`milk=0.0561`。结论非常直接：守恒近似和高分辨率 front 相场源没有把 cyan/purple 河道拉起来，反而把橙金厚膜压低并增加奶白覆盖。

Huang 2020 全文模型对照：本轮在意图上更接近论文的 material transport，因为 residual/front 不再直接由局部源和低分辨率 skeleton 决定，而是尝试用 `eta/Gamma/u` 派生的沿线通量和 side reject 约束。但是它仍只是 fragment shader 局部近似：没有论文中的 staggered spherical grid，没有 velocity-aligned/BiMocq2 映射状态，没有 `Gamma` implicit projection-like SPD solve，也没有真正守恒的球面通量离散。当前实现能把均值维持在目标附近，却不能生成连续弯曲分叉的 material front；因此贴合 Huang 2020 的程度仍不足，视觉失败不是调色问题，而是数值结构问题。

下一步计划：停止继续在 `hfLineSource`、`centerlineSource` 或 `phaseAreaSkeleton` 权重上小修小补。下一轮应建立独立的高分辨率 front/material 映射状态，至少存储 `materialResidual/lineAge/confidence/forwardError/backwardError`，用 `u + Gamma_tangent` 做 velocity-aligned 双向 backtrace 或 BFECC-like 更新；`phase` 只能读取这个 front 状态生成薄膜河道，不能再自行用低分辨率面积预算或局部门控反向制造骨架。验收顺序仍是先 `solid`，再 `thickness/phase/velocity/foam/filamentConnectivity/phaseArea/huangResidualTransport/huangFrontState`，并且只有当 `huangResidualTransport` 出现连续弯曲分叉窄线、`huangFrontState` 不再是雾团时，才看 beauty 是否自然恢复青绿河道和紫蓝窄边。

## 2026-06-02 heartbeat / Run 3327-3356: BFECC-like front 映射降低奶白，但河网仍未成立

开始前检查：本轮重新读取 `artifacts/targets/soap-film-huang-2020-fulltext-notes.md`、`artifacts/targets/soap-film-physics-handoff.md`、`artifacts/targets/soap-film-target.md` 和本迭代文件，并重新查看 `soap-film-reference.jpg`、上一轮 `run-3326-beauty-huang-highres-front-phase-source.png`、`run-3324-huangResidualTransport...png`、`run-3325-huangFrontState...png`、`run-3314-phase...png` 与 `run-3316-foam...png`。对照结论：上一轮最小可见性成立，所有 debug view 能渲染，但 beauty 被浅粉/奶白覆盖；`huangResidualTransport` 是黑暗宽带和噪点，`huangFrontState` 是雾状青绿色团，完全没有参考图中贯穿中部、弯曲分叉、边缘带紫蓝窄线的青绿河道。

本轮实现只改 `mvp/src/visual/thinFilmSim.js`，没有改构图、相机或 beauty 调色，也没有使用贴图、参考图采样、预烘焙纹理、canvas 图案、样式拟合或假纹理。第一步在 `HUANG_RESIDUAL_TRANSPORT_FRAGMENT_SHADER` 中加入 `materialTangentAt()`、`transportSpeedAt()` 和 `texelDistance()`，用 `u + Gamma_tangent` 做 backward/forward 回溯：从当前点回溯到 `backUv`，再用回溯点的局部速度方向前推回来；同时从 `forwardUv` 回溯回来，得到 `backwardMapError/forwardMapError/mapRoundTripError`。继承的 `materialResidual` 现在必须通过 `bfeccConsistency/mappingConfidence/conservativeFluxGate`，而不是只靠上一帧残差或局部中心线源。第二步在 `HUANG_FRONT_STATE_FRAGMENT_SHADER` 中把 residual 的 g/a 通道解释为 `mappingConfidence` 与 `sideReject+mappingError`，front 只接受低误差、高连续性的 material residual。第三步把上一轮导致奶白覆盖的 `hfLineSource` 收紧，只让高 occupancy、低 side reject、低宽片证据的 high-res front 少量进入相场补给。

第一组验证为 `run-3327-3341-huang-bfecc-front-map`，覆盖 `solid -> thickness -> phase -> velocity -> foam -> filamentConnectivity -> phaseArea -> phaseAreaSkeleton -> phaseAreaError -> etaGammaVelocity -> gammaCandidate -> gammaRhsResidual -> huangResidualTransport -> huangFrontState -> beauty`，全部 `problemCount=0`，结果 JSON 写入 `artifacts/targets/run-3327-3341-huang-bfecc-front-map-capture-results.json`，色彩诊断写入 `artifacts/targets/run-3341-huang-bfecc-front-map-color-comparison.json`。关键数值：`run-3341` 中 `eta.mean=0.5945`、`eta.thickFraction=0.3633`、`phase.highFraction=0.1802`、`foam.visibleFraction=0.0027`；`huangResidualTransport.materialResidual.mean=0.0969`、`mappingConfidence/continuity.mean=0.0909`、`lineAge.mean=0.0818`、`reject/error.mean=0.4741`；`huangFrontState.occupancy.mean=0.1170`、`lineAge.mean=0.0862`、`sideReject.mean=0.2907`。这说明严格映射门控明显降低 residual，front 仍偏弱。

图像对照：`run-3341-beauty...png` 相比 `run-3326` 的奶白覆盖有改善，橙金/橙粉厚膜回升，奶白污染下降；但它仍没有参考图的青绿分叉河道，青绿只剩底部和局部边缘的碎片，紫蓝窄边也没有沿河道组织。`run-3339-huangResidualTransport...png` 比上一轮少了一些雾状青绿，但仍是暗宽带、噪点和散碎高亮，不是连续 material front；`run-3340-huangFrontState...png` 仍是青绿雾团；`phaseAreaSkeleton` 仍显示大块低分辨率格子，但本轮确认它已是诊断/预算问题，不是 active 相场主源。

第二组只做反例验证：稍微放松 `mapRoundTripError` 惩罚和 front pass 的误差拒绝，得到 `run-3342-3356-huang-bfecc-front-map-balanced`，全部视图仍 `problemCount=0`，但视觉直接倒退。`run-3356` 中 `huangResidualTransport.materialResidual.mean=0.1255`、`mappingConfidence/continuity.mean=0.1734`，数值看似更接近计划下限；然而 beauty 变成大面积奶白厚膜，橙金占比崩掉，青绿仍为 0。该放松不保留，最终代码回到第一组较严格的 BFECC-like 映射版本，只保留 debug encoding 文案更新。

粗 HSV 统计只用于失败诊断，不参与生成或拟合。同一口径下参考图约 `orange=0.3648`、`cyan=0.0827`、`purple=0.0269`、`milk=0.0001`；上一轮 `run-3326` 为 `orange=0.0492`、`cyan=0.0000`、`purple=0.0004`、`milk=0.0561`；保留版 `run-3341` 为 `orange=0.1356`、`cyan=0.0001`、`purple=0.0010`、`milk=0.0047`；反例 `run-3356` 为 `orange=0.0237`、`cyan=0.0000`、`purple=0.0006`、`milk=0.0832`。结论：严格映射门控能把奶白污染压下去并恢复橙金，但青绿/紫蓝仍几乎没有；放松误差只会把错误 front 重新喂成奶白。

Huang 2020 全文模型对照：本轮比上一轮更贴近论文的 velocity-aligned 思路，因为 material residual 的历史继承第一次显式使用了 backward/forward 映射一致性，而不是纯局部阈值或低分辨率 skeleton。但是它仍只是 fragment shader 上的近似映射，没有真正维护 BiMocq2 的 forward/backward map 纹理，也没有 staggered spherical grid、`Gamma` implicit projection-like SPD solve 或严格球面守恒通量。当前实现仍在两个失败状态之间摆动：严格时 residual/front 太弱，放松时相场/光学厚度立刻奶白化；这说明仅在 front shader 层补 BFECC-like 门控不足以复现 Huang 2020 的 material transport。

下一步计划：不要继续调 `mapRoundTripError`、`hfLineSource` 或 `centerlineSource` 的标量权重。下一轮应下沉到主物理更新：优先实现更接近 Huang 4.3 的 `Gamma` projection-like 更新或至少一个独立 forward/backward map render target，显式存储映射坐标/误差，而不是把误差压在 residual 的 RGBA 里；同时从 `PHASE_STEP` 中继续削弱相场对错误 front 的放大，让 `phase` 只读经过映射一致性验证的 high-res material front。验收仍先看 `huangResidualTransport` 是否从暗宽带变成连续弯曲分叉窄线，再看 `huangFrontState`、`phase` 和最后的 beauty。

## 2026-06-02 heartbeat / Run 3357-3372: 独立 Huang map-state 接通，但显式 map 仍宽片且 beauty 奶白倒退

开始前检查：本轮按要求重新读取 `artifacts/targets/soap-film-huang-2020-fulltext-notes.md`、`artifacts/targets/soap-film-physics-handoff.md`、`artifacts/targets/soap-film-target.md` 和本迭代文件，并重新对照 `soap-film-reference.jpg`、保留版 `run-3341-beauty-huang-bfecc-front-map.png`、`run-3339-huangResidualTransport...png`、`run-3340-huangFrontState...png` 以及反例 `run-3356-beauty-huang-bfecc-front-map-balanced.png`。对照结论仍是：参考图有大面积橙金厚膜、贯穿中部的青绿分叉河道、贴河道的紫蓝窄边和边界/厚膜上的奶金白色微滴；`run-3341` 只是恢复部分橙金并压低奶白，青绿/紫蓝几乎为 0；`run-3356` 证明放松 map/error 门控会直接奶白化，不能继续靠放松阈值或调色前进。

本轮实现只改物理/调试链路，没有改构图、相机或 beauty 调色，也没有使用贴图、参考图采样、预烘焙纹理、canvas 图案、样式拟合或假纹理。核心改动是在 `mvp/src/visual/thinFilmSim.js` 中新增 `HUANG_MAP_STATE_FRAGMENT_SHADER` 和独立 `huangMapState` read/write target，用 `u + Gamma_tangent` 做 backward/forward 回溯，显式保存 `materialBackU/materialBackV/mapConfidence/mapRoundTripReject`；随后让 `HUANG_RESIDUAL_TRANSPORT_FRAGMENT_SHADER` 与 `HUANG_FRONT_STATE_FRAGMENT_SHADER` 读取这个 map-state，而不是只把映射误差压在 residual 的 RGBA 通道里。配套把 `huangMapStateTexture` 暴露给 `mvp/src/visual/logoScene.js`，在 `mvp/src/config/controlSchema.js` 增加 `huangMapState` debug view，并让 `artifacts/targets/capture-soap-front-state.mjs` 默认捕捉该视图。

语法验证全部通过：`mvp/src/config/controlSchema.js`、`mvp/src/visual/thinFilmSim.js`、`mvp/src/visual/logoScene.js` 和 `artifacts/targets/capture-soap-front-state.mjs` 均用 UTF-8 管道与 `node --input-type=module --check` 检查通过。完整截图为 `run-3357-3372-huang-explicit-map-state`，覆盖 `solid -> thickness -> phase -> velocity -> foam -> filamentConnectivity -> phaseArea -> phaseAreaSkeleton -> phaseAreaError -> etaGammaVelocity -> gammaCandidate -> gammaRhsResidual -> huangMapState -> huangResidualTransport -> huangFrontState -> beauty`；所有视图 `problemCount=0`，`solid` 最小可见性成立，`thickness` PNG 生成但本次仍出现一次 `debug not ready for thickness` 的等待提示，未影响后续调试图。结果 JSON 写入 `artifacts/targets/run-3357-3372-huang-explicit-map-state-capture-results.json`。

关键数值：以最终 `run-3372-beauty-huang-explicit-map-state.png` 为准，`eta.mean=0.5921`、`eta.thickFraction=0.3336`、`phase.highFraction=0.1611`、`foam.visibleFraction=0.0007`、`huangMapState.mapConfidence.mean=0.3461`、`huangMapState.mapRoundTripReject.mean=0.6100`、`huangResidualTransport.materialResidual.mean=0.0901`、`alongContinuity.mean=0.1121`、`huangFrontState.occupancy.mean=0.1199`、`lineAge.mean=0.0915`。这说明独立 map-state 确实接入了诊断和 front 链路，但 map reject 仍偏高、residual/front 仍偏弱，而且 map confidence 分布不是窄线。

图像对照：`run-3369-huangMapState...png` 能看到显式 map 坐标与置信度，但青绿置信区域是噪点和宽片，不是 Huang/BiMocq 意义上的连续 material map；`run-3370-huangResidualTransport...png` 仍是暗红宽带和散碎点，没有变成连续弯曲分叉窄线；`run-3371-huangFrontState...png` 仍是青绿色雾团/宽片；`run-3359-phase...png` 只有左侧/底部竖向青紫带和局部宽片；`run-3361-foam...png` 近似灰白/奶金宽雾，微滴没有沿河道边界成串组织。最终 `run-3372-beauty...png` 大面积奶白/浅粉，底部残留橙褐和碎青紫，整体比保留版 `run-3341` 明显倒退，更接近 `run-3356` 的奶白失败状态。

粗 HSV 统计只用于失败诊断，不参与生成或拟合。本轮另存 `artifacts/targets/run-3372-huang-explicit-map-state-color-comparison.json`；该 .NET/HSV 诊断口径下参考图为 `orange=0.5026`、`cyan=0.0747`、`purple=0.0340`、`milk=0.0001`、`bright=0.3894`，保留版 `run-3341` 为 `orange=0.1122`、`cyan=0.0000`、`purple=0.0003`、`milk=0.0033`，反例 `run-3356` 为 `orange=0.0175`、`cyan=0.0000`、`purple=0.0001`、`milk=0.0532`，本轮 `run-3372` 为 `orange=0.0191`、`cyan=0.0000`、`purple=0.0002`、`milk=0.0452`。虽然该统计口径与上一轮手写 JSON 的阈值略有差异，但趋势一致：本轮没有恢复青绿/紫蓝，橙金接近奶白反例，视觉倒退。

Huang 2020 全文模型对照：本轮比 `run-3341` 更接近“显式存储 material mapping state”的方向，因为不再只靠 residual 的 RGBA 临时携带 mapping confidence/error；但它仍没有实现论文中的 velocity-aligned/BiMocq2 forward/backward map 维护。当前 `huangMapState` 只有一个 back coordinate、confidence 和 reject，没有成对 forward map texture、没有一致性 reset/pass、没有 staggered spherical grid，也没有 `Gamma` implicit projection-like SPD solve。因此它能说明 map 误差在哪里，却不能自己生成参考图要求的守恒 material front；继续调 `mapConfidence` 或 `mapRoundTripReject` 标量只会在“front 太弱”和“奶白宽片”之间摆动。

下一步计划：不要继续做构图、不要调 beauty 颜色、不要放松错误 front。下一轮应二选一推进真正数值结构：第一，建立成对 forward/backward map render target，显式维护 forward map、backward map、confidence、round-trip error 和 reset gate，再让 residual/front/phase 读取通过一致性检验的 material coordinates；第二，下沉到 Huang 4.3 的 `Gamma` projection-like 更新，至少让 `eta/Gamma/u` 主链通过更严格的球面散度/通量守恒产生真实压缩窄线。短期验收先看 `huangMapState` 是否从宽片变成低 reject 的连续窄 material map，再看 `huangResidualTransport` 是否出现弯曲分叉窄线，最后才允许判断 beauty 的青绿河道、紫蓝窄边和奶金微滴是否自然恢复。

## 2026-06-02 heartbeat / Run 3373-3440: 成对 map-state 显著改善闭合，光学厚度耦合有进展但河网仍失败

开始前检查：本轮重新读取 `artifacts/targets/soap-film-huang-2020-fulltext-notes.md`、`artifacts/targets/soap-film-physics-handoff.md`、`artifacts/targets/soap-film-target.md` 和本迭代文件，并重新对照 `soap-film-reference.jpg`、上一轮 `run-3372-beauty-huang-explicit-map-state.png`、`run-3369-huangMapState...png`、`run-3370-huangResidualTransport...png`、`run-3371-huangFrontState...png`。对照结论：`solid` 最小可见性已经成立，问题不在壳层渲染或构图；上一轮单向显式 map 只有 `materialBackU/V/confidence/reject`，没有成对 forward map，导致 `mapConfidence.mean` 约 0.35、`mapRoundTripReject.mean` 约 0.59-0.61，`beauty` 大面积奶白/浅粉，缺参考图的橙金厚膜、青绿分叉河道、紫蓝窄边和沿河道微滴。

本轮实现没有改构图、相机或参考图采样，也没有使用贴图、预烘焙纹理、canvas 图案、样式拟合或假纹理。第一步在 `mvp/src/visual/thinFilmSim.js` 中把 `HUANG_MAP_STATE_FRAGMENT_SHADER` 改成 direction-based map shader：同一段 shader 由 `uMapDirection=-1/+1` 分别维护 backward/forward material coordinates，并新增 `uPairMap` 做 `F(B(x))` 与 `B(F(x))` 的 round-trip consistency。新增 `huangForwardMapState` read/write target、material、readback、debug texture getter 和 capture/control view，让 `HUANG_RESIDUAL_TRANSPORT_FRAGMENT_SHADER` 与 `HUANG_FRONT_STATE_FRAGMENT_SHADER` 同时读取 backward/forward map。第二步把 map confidence 从“线源/残差源”改成“全域速度对齐物质映射可靠度”，更符合 Huang 2020/BiMocq 的思路：map 自身由 `u`、`Gamma` 切向、round-trip error 和 pair consistency 决定，源项只负责后续 front/phase。第三步在 `mvp/src/visual/logoScene.js` 中只改物理场到光学厚度的映射，让 `eta/Gamma/phase/huangFront` 判定到的薄通道进入当前光谱函数的青绿/蓝紫干涉厚度带，并把白色散射重新绑定到 `foam/localCrest/meniscus`，避免边界整片漂白。

验证过程：先用 `node --input-type=module --check` 检查 `mvp/src/config/controlSchema.js`、`mvp/src/visual/thinFilmSim.js`、`mvp/src/visual/logoScene.js` 和 `artifacts/targets/capture-soap-front-state.mjs`，全部通过。随后完成三组截图：`run-3373-3389-huang-paired-forward-back-map`、`run-3390-3406-huang-domain-paired-map`、`run-3407-3423-huang-domain-map-optical-thin-coupling` 和最终 `run-3424-3440-huang-domain-map-channel-band`，均覆盖 `solid -> thickness -> phase -> velocity -> foam -> filamentConnectivity -> phaseArea -> phaseAreaSkeleton -> phaseAreaError -> etaGammaVelocity -> gammaCandidate -> gammaRhsResidual -> huangMapState -> huangForwardMapState -> huangResidualTransport -> huangFrontState -> beauty`，所有截图 `problemCount=0`。结果 JSON 分别写入对应 `run-*-capture-results.json`。

关键数值：第一组 `run-3389` 的 map 仍失败，`backConf=0.3580/backReject=0.5813`、`fwdConf=0.3463/fwdReject=0.5876`。改成全域速度对齐 map 后，`run-3406` 提升到 `backConf=0.7039/backReject=0.2004`、`fwdConf=0.6659/fwdReject=0.2218`；最终 `run-3440` 保持在 `backConf=0.7132/backReject=0.1952`、`fwdConf=0.6666/fwdReject=0.2231`。这说明成对 backward/forward map-state 确实显著改善了 material coordinate 的闭合性。最终 beauty 帧同时为 `eta.mean=0.5844`、`phase.mean=0.2388`、`foam.visibleFraction=0.0035`、`huangResidualTransport.materialResidual.mean=0.0935`、`alongContinuity.mean=0.1872`、`huangFrontState.occupancy.mean=0.1374`、`frontReject.mean=0.2582`。

图像对照：最终 `run-3440-beauty-huang-domain-map-channel-band.png` 比 `run-3372` 明显恢复了橙金厚膜，并把奶白污染压回较低；但它仍不接近参考图。参考图里青绿河道贯穿中部并连续分叉，边缘有紫蓝窄线和成串奶金/白色微滴；本轮只是橙金厚膜上出现零散蓝紫边和少量青点，没有连续河道拓扑。`run-3436-huangMapState...png` 与 `run-3437-huangForwardMapState...png` 已经是稳定的大面积物质坐标场，不再是上一轮噪点宽片；但 `run-3439-huangFrontState...png` 仍是雾状青绿场，`run-3438-huangResidualTransport...png` 仍没有形成细长分叉 material front。`phase` 调试图能看到一些青紫薄区，但它们没有组织成参考图那种河网。

粗 HSV 统计只用于失败诊断，不参与生成或拟合。本轮使用同一 .NET/HSV 口径比较可见区域：参考图约 `orange=0.2643`、`cyan=0.0569`、`purpleBlue=0.0389`、`creamWhite=0.0141`；上一轮 `run-3372` 为 `orange=0.1192`、`cyan=0.0003`、`purpleBlue=0.0034`、`creamWhite=0.8300`；全域 map 但未修光学的 `run-3406` 为 `orange=0.8507`、`cyan=0.0011`、`purpleBlue=0.0082`、`creamWhite=0.0834`；最终 `run-3440` 为 `orange=0.7420`、`cyan=0.0079`、`purpleBlue=0.0851`、`creamWhite=0.0131`。结论：奶白污染已压到接近参考，紫蓝反而偏多，橙金仍过多，最关键的青绿连续河道仍比参考低约 7 倍且空间结构失败。

Huang 2020 全文模型对照：本轮比上一轮更贴合论文的 velocity-aligned/BiMocq2 方向，因为现在有显式成对 backward/forward material map、round-trip consistency、pair map reject 和独立 debug/readback；map-state 不再由线源证据控制，而是全域物质坐标可靠度。但它仍不是 Huang 2020 的完整模型：没有 staggered spherical grid，没有真正的 BiMocq2 映射重初始化/组合，没有 `Gamma` implicit projection-like SPD solve，也没有严格球面守恒通量离散。当前 map 已经比之前可靠，但 residual/front 仍不能从 `eta/Gamma/u` 生成连续弯曲分叉窄线，所以 beauty 的青绿河网仍失败。

下一步计划：不要再调构图，也不要继续只在 beauty 端拉光学厚度。下一轮应把已改善的 paired map-state 用到真正的守恒 front 更新：`huangResidualTransport` 需要直接读取 `B/F` map 进行 semi-Lagrangian/BFECC-like transport，并输出明确的 `materialResidual/lineAge/confidence/pairError`，而不是继续靠局部 residual 与前一帧模糊采样；`huangFrontState` 只接受 pair-consistent、低横向宽度、沿 `u + Gamma_tangent` 连续的 material residual。验收先看 `huangResidualTransport` 是否从暗带/雾场变成连续弯曲分叉窄线，再看 `phase` 是否沿这些线生成青绿河道，最后才看 beauty 的橙金/青绿/紫蓝/微滴分布。

## 2026-06-02 heartbeat / Run 3441-3491: paired map 直接接入 residual transport，但最终 beauty 退步，河网仍失败

开始前检查：本轮重新读取了 `artifacts/targets/soap-film-huang-2020-fulltext-notes.md`、`artifacts/targets/soap-film-physics-handoff.md`、`artifacts/targets/soap-film-target.md` 和本迭代文件，并重新查看了 `artifacts/targets/soap-film-reference.jpg`、上一轮 `run-3440-beauty-huang-domain-map-channel-band.png`、`run-3438-huangResidualTransport...png`、`run-3439-huangFrontState...png`、`run-3436-huangMapState...png` 与 `run-3437-huangForwardMapState...png`。对照结论：上一轮成对 map-state 已经健康，back/fwd confidence 约 `0.71/0.67`，reject 约 `0.20/0.22`；失败点不是 solid 可见性、构图或 map 闭合，而是 residual/front 没有把 paired map 变成参考图里的连续青绿分叉河道。参考图仍要求橙金厚膜大陆被青绿河道切开、河道边缘有紫蓝窄边和密集奶金/白色微滴；上一轮只是橙金厚膜加零散青/蓝点。

本轮实现只改 `mvp/src/visual/thinFilmSim.js` 的 Huang residual/front 输运链路，没有改构图、相机或 beauty 调色，也没有使用贴图、参考图采样、预烘焙纹理、canvas 图案、样式拟合或假纹理。第一步把 `HUANG_RESIDUAL_TRANSPORT_FRAGMENT_SHADER` 的 `materialTangentAt/transportSpeedAt` 对齐到上一轮更健康的 paired map-state 速度方向和步长，并让 residual transport 直接读取 `uHuangMapState/uHuangForwardMapState`：通过 `B(x)`、`F(x)`、`F(B(x))` 和 `B(F(x))` 计算 pair confidence、return error，再从上一帧 `uPreviousTransport` 中采样 `prevMapBack/prevPairForward/prevMapBack2`，构造 BFECC-like 的 `mappedBfeccResidual/mappedBfeccContinuity/mappedBfeccAge`。第二步尝试让 `mapAdvected` 参与 `incomingFlux/transportConfidence/continuityEvidence/mappingConfidence/materialResidual`，但首次验证 `run-3441-3457-huang-paired-map-residual-transport` 出现明显粉白宽片倒退。

根据第一组失败，本轮没有把失败版当进展保留，而是收紧 map 搬运：新增 `mappedSideLeak/mappedNarrowGate`，要求 map 继承必须通过上一帧横向泄漏、map return error、line continuity 和当前 side reject 约束；同时把 `mapAdvected` 从直接抬高 `materialResidual` 改为主要增强已有窄线的连续性。第二组 `run-3458-3474-huang-paired-map-residual-transport-narrow` 仍未解决粉白倒退。随后把 `huangFrontState` 的邻域方向从过度 velocity-aligned 的版本退回上一轮更稳定的 `globalFlow + velocity + Gamma_tangent` 混合，只保留 residual pass 的 paired-map 输运，得到最终 `run-3475-3491-huang-paired-map-residual-transport-stable-front`。

验证：`node --input-type=module --check` 已通过 `mvp/src/visual/thinFilmSim.js` 与 `mvp/src/visual/logoScene.js`；最终截图覆盖 `solid -> thickness -> phase -> velocity -> foam -> filamentConnectivity -> phaseArea -> phaseAreaSkeleton -> phaseAreaError -> etaGammaVelocity -> gammaCandidate -> gammaRhsResidual -> huangMapState -> huangForwardMapState -> huangResidualTransport -> huangFrontState -> beauty`，全部 `problemCount=0`，solid 最小可见性继续成立，结果 JSON 为 `artifacts/targets/run-3475-3491-huang-paired-map-residual-transport-stable-front-capture-results.json`。最终关键读回：`run-3491 beauty` 中 `eta.mean=0.5546`、`eta.thickFraction=0.1269`、`phase.mean=0.2230`、`phase.highFraction=0.1287`、`foam.visibleFraction=0`、`backConf/backReject=0.7154/0.1904`、`fwdConf/fwdReject=0.6800/0.2098`、`huangResidualTransport.materialResidual.mean=0.0871`、`alongContinuity.mean=0.1543`、`sideReject.mean=0.5377`、`huangFrontState.occupancy.mean=0.1324`、`frontReject.mean=0.2586`。

图像和颜色对照：最终 `run-3491-beauty...png` 是大面积粉白/奶粉薄膜，左下角有少量棕橙厚膜，边缘有少量蓝紫碎片，但仍没有参考图中贯穿中部、宽窄变化、弯曲分叉的青绿河道，也没有沿河道边界组织的白/奶金微滴。`run-3489-huangResidualTransport...png` 比上一轮仍更像暗带/散点残差，不是连续 material front；`run-3490-huangFrontState...png` 是青绿雾场/宽带，不是细长分叉中心线。颜色诊断只用于失败分析，不参与生成：`artifacts/targets/run-3491-huang-paired-map-residual-transport-stable-front-color-comparison.json` 中参考图约 `orange=0.3866`、`cyan=0.0862`、`purpleBlue=0.0398`、`creamWhite=0.0075`；上一轮 `run-3440` 为 `orange=0.7315`、`cyan=0.0133`、`purpleBlue=0.1220`、`creamWhite=0.0076`；最终 `run-3491` 为 `orange=0.2354`、`cyan=0.0002`、`purpleBlue=0.0384`、`creamWhite=0.0830`。结论：本轮最终视觉退步，青绿河道几乎归零，奶白/粉白显著上升。

Huang 2020 全文模型对照：本轮做对了一个方向，即 residual transport 开始直接使用 paired backward/forward material map 与 BFECC-like 校正，不再只靠局部 residual 和上一帧模糊采样；这更接近 Huang 2020 的 velocity-aligned/BiMocq2 细节保持思想。但是当前实现仍严重不完整：没有真正的 BiMocq2 map composition/reset，没有 staggered spherical grid，没有 `Gamma` implicit projection-like SPD solve，也没有严格球面守恒通量。更关键的是，当前 `B/F` map 置信度是全域健康的物质坐标场，但 residual/front 仍把它转成宽域雾场或粉白薄膜，而不是守恒窄带材料前沿；说明问题不能继续靠 front shader 标量权重修补。

下一步计划：不要继续在 `mapAdvected`、`hfLineSource`、`centerlineSource` 或 beauty 光学映射上小修小补。下一轮应下沉到 Huang 主系统的状态更新，优先实现或近似实现 `Gamma` projection-like SPD/Poisson 解与 `eta = eta* - dt eta* div(u)` 的同步闭合，让 `eta/Gamma/u` 主场自己形成压缩窄带；同时让 map-state 维护真正的 forward/backward composition 与 reset gate，而不是只输出单步坐标。短期验收必须看 `huangResidualTransport.sideReject` 从约 `0.54` 降下来且图像出现连续弯曲分叉窄线；否则不允许再把 front 喂给 phase/beauty。必要时按目标文档寻找并保存 BiMocq2/conservative semi-Lagrangian/球面表活剂输运补充论文全文，审核其是否与 Huang 2020 的 `eta/Gamma/u` 耦合冲突后再采用。
## 2026-06-02 heartbeat / Run 3492-3533: Huang 主场连续性接管验证，厚膜恢复但 front 仍是宽雾

### 本轮开始前强制复核

- 已重新读取 `artifacts/targets/soap-film-huang-2020-fulltext-notes.md`、`artifacts/targets/soap-film-physics-handoff.md`、`artifacts/targets/soap-film-target.md`、`artifacts/targets/soap-film-iterations.md`。
- 已对照上一轮 `run-3491` 与 `artifacts/targets/soap-film-reference.jpg`：上一轮几何/debug 管线可见，但 beauty 大面积粉/奶白，青绿河道几乎没有；`huangResidualTransport` 有暗带和斑点，`huangFrontState` 是青绿宽雾，不是连续窄分叉线。
- 对 Huang et al. 2020 全文模型的本轮检查重点：当前实现已有 `eta/Gamma/u`、Gamma implicit/projection-like Jacobi、Marangoni/表面张力梯度、球面近似梯度/散度/拉普拉斯和 map 诊断；但主 `FIELD_STEP_FRAGMENT_SHADER` 仍混有旧 `p=-gamma lap(h)-Pi+rho g h`、`h^3 grad(p)`、source/reservoir/phase/foam 经验项，会覆盖 Huang 连续性闭合。

### 本轮修改

- 在 `mvp/src/visual/thinFilmSim.js` 的 field step 中加入 Huang 压缩门控、窄 reservoir 门控、Huang reservoir gate 和 legacy thin flux gate，让 reservoir/source/meniscus/deposit 更多受 `eta/Gamma/u` 连续性、压缩和窄 front 约束。
- 提高 `D eta / Dt = -eta div(u)` 与 `D Gamma / Dt = -Gamma div(u)+diffusion` 在厚度/表活剂更新中的权重，降低旧 `thinFluxDiv/sourceLane/surfactantFluxDiv` 的直接主导。
- 第一版 `run-3492-3512-huang-main-continuity-reservoir-gate` 发现过度排干：`etaMean=0.2544`、`etaThick=0`、`etaThin=0.5322`，beauty 变成粉紫且青绿仍缺失。
- 第二版加入 Huang 连续性限幅与质量补偿：`huangThicknessContinuity` 和 `huangSurfactantContinuity` 改为 clamp，恢复 baseline/plateau/high-prewarm/eta-mass 的物理补偿门控，避免全局过度 drainage。

### 本轮验证结果

- 运行 `node artifacts/targets/capture-soap-front-state.mjs 3492 huang-main-continuity-reservoir-gate ...`，solid/thickness/phase/velocity/foam/filamentConnectivity/phaseArea/phaseAreaSkeleton/phaseAreaError/etaGammaVelocity/gammaCandidate/gammaRhsResidual/huangDivergence/huangGradGamma/huangMarangoniGate/huangNarrowGate/huangMapState/huangForwardMapState/huangResidualTransport/huangFrontState/beauty 全部截图成功，`problemCount=0`。
- 运行 `node artifacts/targets/capture-soap-front-state.mjs 3513 huang-main-continuity-limited-mass ...`，所有同组 debug/beauty 截图成功，`problemCount=0`。
- `run-3513-3533` 关键数值：`etaMean=0.4445`、`etaThick=0.0048`、`etaThin=0`、`gammaMean=0.4946`、`phaseMean=0.2002`、`phaseHigh=0.1326`、`foamVisible=0.041`、`speedActive=0.9688`、`frontOcc=0.1343`、`frontReject=0.2486`、`residualMean=0.0896`、`residualContinuity=0.1509`、`phaseAreaBroad=0.2184`。
- 颜色占比对比 JSON：`artifacts/targets/run-3533-huang-main-continuity-limited-mass-color-comparison.json`。参考图约 `orange=0.4136`、`cyan=0.0527`、`purpleBlue=0.0355`、`creamWhite=0.0243`；`run-3533` 为 `orange=0.3972`、`cyan=0.0005`、`purpleBlue=0.0140`、`creamWhite=0.0704`。
- 视觉结论：第二版橙金厚膜占比已经接近参考图，但青绿分叉河道仍严重失败，约低两个数量级；紫蓝窄边偏少；奶金/白色微滴仍偏宽偏集中。`huangFrontState` 仍是宽绿/青雾与大块片区，不是 Huang 物理场应产生的窄、连续、速度/压缩对齐 front。

### 与 Huang et al. 2020 的贴合度

- 更贴合的部分：本轮让厚度和表活剂更新更明确服从 `D eta / Dt = -eta div(u)`、`D Gamma / Dt = -Gamma div(u)` 的球面薄膜连续性；Gamma projection-like 更新、Marangoni 梯度和 paired map 诊断仍保持主导参考。
- 仍不贴合的部分：还没有完整复现论文的 staggered spherical grid、BiMocq2 velocity-aligned map composition、严格 SPD/Poisson 投影；当前 field step 仍保留旧经验源项和 reservoir 项，只是被 Huang gate 压制。最关键失败是 `HUANG_FRONT_STATE`/phaseArea 把物理残差转为宽雾，而不是论文视频/参考图中那种被速度、表活剂梯度和局部压缩共同限定的窄 material front。

### 下一步计划

- 不改构图，不做样式调色，不动参考图采样。
- 下一轮优先改 `HUANG_FRONT_STATE_FRAGMENT_SHADER` 及其下游 `phaseArea`：用 `eta/Gamma/u` 的 residual、压缩、side reject、paired-map consistency 做 NMS-like 中心线提取，强制 front 是窄线而不是宽雾。
- 把低分辨率 `phaseAreaSkeleton` 从正向增生项继续降级为诊断辅助，避免它把 front 扩成宽片。
- 验证顺序仍是 solid、thickness、phase、velocity、foam、filamentConnectivity、phaseArea、huangFrontState、beauty；只有当 `huangResidualTransport` 和 `huangFrontState` 出现连续弯曲窄分叉网络后，再判断 beauty 中 cyan/purple/cream-white 是否随物理场自然出现。

## 2026-06-02 heartbeat / Run 3542-3574: NMS 前沿提取试验失败，确认不能继续靠 front 标量门控修补

本轮开始前按自动化要求重新读取了 `artifacts/targets/soap-film-huang-2020-fulltext-notes.md`、`artifacts/targets/soap-film-physics-handoff.md`、`artifacts/targets/soap-film-target.md` 和本文档，并重新对照了 `artifacts/targets/soap-film-reference.jpg` 与上一轮有效结果 `run-3533-beauty-huang-main-continuity-limited-mass.png`、`run-3532-huangFrontState...png`、`run-3531-huangResidualTransport...png`、`run-3519-phaseArea...png`、`run-3514-thickness...png`。上一轮基线的优点是橙金厚膜占比已接近参考图；失败点是青绿分叉河道几乎为 0，`huangFrontState` 仍是宽雾/大块片区，`phaseArea` 有块状区域而不是连续窄线。

本轮没有改构图、相机或 beauty 调色，也没有使用贴图、参考图采样、预烘焙纹理、canvas 图案、样式拟合或假纹理。修改只在 `mvp/src/visual/thinFilmSim.js`：先在 `HUANG_FRONT_STATE_FRAGMENT_SHADER` 中加入基于 `eta/Gamma/u` residual、paired-map consistency、沿线/侧向邻域的 NMS-like 中心线提取；再让 `PHASE_AREA_FRAGMENT_SHADER` 读取 `huangFrontState` 时更重视窄线证据并抑制宽雾。第一版 `run-3542-3552-huang-front-nms-phasearea-gate-valid` 证明这条路过硬：`frontOcc=0.0238`、`frontReject=0.4101`、`skeleton=0.0032`，beauty 变成大面积淡奶白/粉膜，参考图所需青绿河道仍为 0。

随后做了软化版 `run-3553-3563-huang-front-soft-nms-continuity`：把 phaseArea 里的 `hfWideReject` 和 admission 惩罚放松，试图保留更多物理前沿。结果有轻微恢复但仍失败：`frontOcc=0.0341`、`frontReject=0.3060`、`skeleton=0.0088`，图像中 `huangFrontState` 仍然偏暗且断裂，`phaseAreaError` 继续有低分辨率块状感。颜色诊断仅用于失败分析，不参与生成：参考图约 `orange=0.3801 cyan=0.0684 purpleBlue=0.0410 creamWhite=0.0415`，`run-3563` 为 `orange=0.1289 cyan=0 purpleBlue=0.0121 creamWhite=0.5059`，说明青绿河道没有恢复，奶白污染反而严重。

第三版 `run-3564-3574-huang-front-state-decoupled-nms` 把 NMS 从“front 是否存在”的硬条件改成软选择器，让 front 状态更多来自物理连续性、paired map 和 residual transport。数值略有回升：`frontOcc=0.0527`、`frontReject=0.2699`、`phaseHigh=0.1494`，但 `skeleton=0.0138` 仍远低于上一轮基线 `0.1028`，图像没有贯穿式青绿分叉河网；beauty 更糟，颜色诊断为 `orange=0.0132 cyan=0 purpleBlue=0.0076 creamWhite=0.8404`。因此本轮试验不能作为有效视觉进展。

与 Huang et al. 2020 的贴合度结论：本轮的方向表面上更接近“沿 `eta/Gamma/u` 与 material map 的前沿提取”，但实际仍只是 fragment shader 局部门控，不是论文里的 staggered spherical grid、velocity-aligned/BiMocq2 material mapping、`Gamma` implicit projection-like SPD solve 或严格球面守恒通量。更关键的是，`logoScene.js` 的 beauty 模式直接把 `huangFrontStateTexture` 绑定到 `uFilmRiverPathCostMap` 并按 `r=lineDistance, g=occupancy, b=lineAge, a=sideReject` 读取；所以随意改变 front 编码/门控会直接破坏光学厚度和相场映射。当前失败说明：不能继续靠 `HUANG_FRONT_STATE` 标量权重/NMS 小修补来逼出参考图河网，必须回到更完整的守恒 material-front 更新。

下一步计划：先不要继续改 beauty，也不要继续调 NMS 权重。下一轮应优先重构 `huangResidualTransport`/front buffer 的更新方式：用更接近 Huang/BiMocq2 的 forward/backward map composition、reset gate 和沿 `u + Gamma_tangent` 的双向 backtrace 保存 `materialResidual/lineAge/confidence/pairError`；横向方向只做宽度约束和 NMS 诊断，而不直接决定物理前沿存在。验收顺序仍是 `solid -> thickness -> phase -> velocity -> foam -> filamentConnectivity -> phaseArea -> phaseAreaError -> huangResidualTransport -> huangFrontState -> beauty`，并且只有当 `huangResidualTransport` 先出现连续弯曲分叉窄线时，才允许继续把它喂给 phase/beauty。
## 2026-06-02 heartbeat：Huang material-front composition/reset + phase narrow budget

### 本轮改动前强制对比
- 已重新读取 `artifacts/targets/soap-film-huang-2020-fulltext-notes.md`、`soap-film-physics-handoff.md`、`soap-film-target.md`、`soap-film-iterations.md`，并按 Huang et al. 2020 全文模型检查当前实现：主线仍必须以球面 `eta/Gamma/u`、Marangoni 耦合、球面算子、velocity-aligned/BiMocq2 式映射和 Gamma projection-like 更新为准；`phase/foam/filament` 只能作为由主物理场派生的诊断/可视化场，不能替代主模型。
- 上一轮最新 beauty：`run-3574-beauty-huang-front-state-decoupled-nms.png`。参考图：`soap-film-reference.jpg`。
- 对比失败点：参考图有橙金厚膜主体、连续青绿分叉河道、紫蓝窄边和局部奶白/微滴；3574 基本无青绿，橙金极少，大片奶白。独立 HSV 诊断：参考图 orange≈0.3245、cyan≈0.0707、purpleBlue≈0.0284；3574 orange≈0.0268、cyan=0、purpleBlue≈0.0391。
- 物理场失败原因：`huangFrontState` 过稀碎，phaseArea 低分辨率块状明显；`phase/foam` 宽片和奶白输出没有服从 Huang 窄前沿物理预算。

### 本轮实现
1. 在 `mvp/src/visual/thinFilmSim.js` 的 `HUANG_RESIDUAL_TRANSPORT_FRAGMENT_SHADER` 中加入 material map composition/reset 试验：用 back map 和 forward map 检查 material parent/round-trip，一并影响 residual、continuity、side reject 和 mapping confidence，避免只靠单步 advect 的断裂记忆。这是向 Huang/BiMocq2 velocity-aligned 映射靠近的实现，不使用贴图或参考图采样。
2. 在 `HUANG_FRONT_STATE_FRAGMENT_SHADER` 中弱化 NMS/wideReject 对前沿生死的硬切断，让 material residual、continuity 和 conservative flux 可以延续窄前沿。
3. 将 `phaseAreaTarget / diagnostic / skeleton` 从 regional 低分辨率改为 full simulation resolution，修复 phaseArea/phaseAreaError 的粗块状诊断。
4. 在 `PHASE_AREA_FRAGMENT_SHADER` 中增加 `materialNarrowSupport` 和 `broadMaterialReject`，让 phase/foam 预算必须由 Huang front、narrow physical line 和 area capacity 支持，同时更强排出 broad sheet。
5. 在 `PHASE_STEP_FRAGMENT_SHADER` 中加入 `narrowPhaseAdmission` 和 `broadPhaseRetentionReject`，把原先 `targetHigh=0.065`、`physicalPhaseCeiling=0.135` 这类宽相场保底改为由 Huang/phaseArea 窄准入控制，并排出非窄前沿的历史 dye。

### 截图与诊断
- 第一组：`run-3575-3587-huang-material-front-composition-reset-*`。所有 solid/thickness/phase/velocity/foam/filamentConnectivity/phaseArea/phaseAreaError/huangMapState/huangForwardMapState/huangResidualTransport/huangFrontState/beauty 均可渲染，problem=0。效果：phaseArea 块状改善，front 连续性略好，但 beauty 仍偏白，无青绿河道。run3587 独立 HSV：orange≈0.039、cyan=0、purpleBlue≈0.0484、creamWhite≈0.1423。
- 第二组：`run-3588-3600-huang-phase-narrow-budget-*`。所有 debug view 可渲染，problem=0。phaseArea 预算被压窄，但 PHASE_STEP 历史相场仍撑住宽片。run3600：orange≈0.108、cyan=0、purpleBlue≈0.0357、creamWhite≈0.2076，仍失败。
- 第三组：`run-3601-3613-huang-phase-step-narrow-retention-*`。所有 debug view 可渲染，problem=0。beauty 终于不再整片奶白，转为橙金主体并带少量蓝紫窄边。run3613 独立 HSV：orange≈0.6552、cyan≈0.0001、purpleBlue≈0.0209、creamWhite≈0、bright≈0.0011。

### 与参考图/Huang 模型的偏差
- 橙金厚膜占比：3613 已从 3574 的极低橙色恢复，但过量，参考约 0.3245，3613≈0.6552；同时 `eta.thickFraction` 在 3613 beauty 只有≈0.0001，说明橙金并非可靠来自厚 `eta` 域，仍需让 optical thickness 与 `eta/Gamma/u` 更自洽。
- 青绿分叉河道：仍基本缺失，参考≈0.0707，3613≈0.0001。`huangFrontState` debug 有青绿结构，但 beauty 没把这个窄前沿转成薄膜干涉青绿带。
- 紫蓝窄边：有少量恢复，3613≈0.0209，接近但略低于参考≈0.0284；形态仍像局部边缘/纹线，不是围绕青绿河道的窄边。
- 奶金/白色微滴：白雾已被压掉，但参考图需要局部奶金/白色微滴密度；3613 几乎为 0，下一轮要从物理边界/泡沫微滴重新生成局部点状，不允许用噪声贴图或假纹理。
- Huang 自洽性：material-front composition/reset、full-res phaseArea 和窄准入更贴合 Huang 的 velocity-aligned material map 思路；但当前 `phase` 已被压到 visible≈0.0229，低于参考所需的青绿河道面积，且 beauty 的干涉色仍没有正确使用 `eta/Gamma/u/front` 产生窄青绿。

### 下一步计划
1. 不再继续压宽相场；下一轮应检查 `logoScene.js` beauty shader 中 `huangFrontStateTexture`、`phase`、`eta`、`Gamma` 到干涉色的耦合，确认是否把窄 front 误用为暗化/拒绝而不是 optical-thickness/phase-band 输入。
2. 在不改构图的前提下，把 Huang front 的窄 material residual/occupancy/age 转成物理上合理的局部 `eta`/optical phase perturbation：青绿河道必须来自薄膜厚度、视角、曲率和 surfactant 变化，不是调色或贴图。
3. 重新审计 `eta.thickFraction` 与橙金显示不一致的问题：如果橙色不是厚 `eta` 域导致，就要修正干涉映射或 `eta` 读入，而不是继续调颜色。
4. 完成后仍按 solid→thickness→phase→velocity→foam→filamentConnectivity→phaseArea→huangFrontState→beauty 全序列截图，并继续独立 HSV 诊断。

## 2026-06-02 heartbeat / Run 3614-3665: beauty 光学耦合接管，确认 front 已进干涉色但河道物理源仍不足

### 本轮开始前强制复核
- 已重新读取 `artifacts/targets/soap-film-huang-2020-fulltext-notes.md`、`artifacts/targets/soap-film-physics-handoff.md`、`artifacts/targets/soap-film-target.md`、`artifacts/targets/soap-film-iterations.md`，并按 Huang et al. 2020 全文模型复核：主场仍必须是球面 `eta/Gamma/u`、Marangoni 耦合、球面 grad/div/laplace、velocity-aligned material front、Gamma projection-like 更新；`phase/foam/filament` 只能是由主物理场派生的诊断/可视化场。
- 已重新对照参考图 `artifacts/targets/soap-film-reference.jpg` 与上一轮最新有效结果 `run-3613-beauty-huang-phase-step-narrow-retention.png`，并查看 `run-3612-huangFrontState...png`、`run-3602-thickness...png`、`run-3603-phase...png`、`run-3605-foam...png`。
- 上一轮失败结论：`huangFrontState` 调试图已有局部青绿结构，但 beauty 没有把它变成青绿干涉河道；同时 `run3613` 橙色覆盖远高于 `eta.thickFraction`，说明橙金不是可靠地来自厚 `eta` 域，而是 beauty shader 里的暖色/amberPool 覆盖。继续改 front 门控或继续调构图都不是第一优先级。

### 本轮实现
- 只修改 `mvp/src/visual/logoScene.js` 的 beauty fragment，没有改构图、相机或参考图采样，也没有使用贴图、预烘焙纹理、canvas 图案、样式拟合或假纹理。
- 将 `huangFrontState` 的 `r=lineDistance, g=occupancy, b=lineAge, a=sideReject` 改为物理输入：先生成 `huangNarrowOptical` 和 `huangFrontRimOptical`，再作用于局部 optical thickness、front drain、capillary/Marangoni rim 厚度与泡沫散射；不直接把 front 混成青色。
- 将橙金区域改为 `etaReservoir` 门控，使其由 `height/eta`、局部 crest、capillary ridge、foam 与 thin-channel drain 共同决定，而不是单纯按低阈值 `height` 全局铺色。
- 让通道颜色由 `thinFilmRgb(channelThickness, cosTheta)` 产生，`channelThickness` 由 `eta/Gamma/phaseBoundary/huangFront` 的厚度扰动给出；紫蓝边由 `huangFrontRimOptical` 只在 front 边界处把 rim optical thickness 拉到窄边干涉带。
- 中途试验 `run-3639-huang-optical-front-coupling-cyan-band` 失败：通道厚度目标和白散射阈值过强，导致大面积奶白/粉白，`creamWhite=0.0554`、`bright=0.4961`，cyan/purple 反而塌缩。该方向已回退，未作为最终状态。

### 截图与诊断
- `run-3614-3626-huang-optical-front-coupling-*`：所有 `solid/thickness/phase/velocity/foam/filamentConnectivity/phaseArea/phaseAreaError/huangMapState/huangForwardMapState/huangResidualTransport/huangFrontState/beauty` 截图成功，`problemCount=0`。这是第一版有效光学耦合，cyan 从 `run3613` 的约 `0.0001` 提到 `0.0060`，purpleBlue 从约 `0.0119` 提到 `0.0337`。
- `run-3627-3639-huang-optical-front-coupling-cyan-band-*`：所有 debug 截图成功，`problemCount=0`，但视觉失败并回退，原因是全局变白、失去橙金/青绿/紫边层次。
- `run-3640-3652-huang-optical-front-coupling-front-only-*`：所有 debug 截图成功，`problemCount=0`。cyan 升到 `0.0097`，creamWhite 回到 `0.0046`，但 purpleBlue 降到 `0.0065`。
- 最终保留 `run-3653-3665-huang-optical-front-coupling-rim-phase-*`：所有 debug 截图成功，`problemCount=0`。最终 beauty 为 `artifacts/targets/run-3665-beauty-huang-optical-front-coupling-rim-phase.png`，颜色诊断写入 `artifacts/targets/run-3665-huang-optical-front-coupling-rim-phase-color-comparison.json`。

### 最终数值与参考图对比
- 参考图独立 HSV 诊断：`orange=0.5100`、`cyan=0.0899`、`purpleBlue=0.0422`、`creamWhite=0.0032`、`bright=0.3572`。该诊断只用于失败分析，不参与渲染或拟合。
- `run3613`：`orange=0.4559`、`cyan=0.0001`、`purpleBlue=0.0119`、`creamWhite=0.0008`、`bright=0.0482`。
- `run3665`：`orange=0.3871`、`cyan=0.0127`、`purpleBlue=0.0124`、`creamWhite=0.0016`、`bright=0.1071`。
- 物理诊断（run3665 beauty 帧）：`eta.mean=0.4719`、`eta.thickFraction=0.0087`、`phase.mean=0.0626`、`phase.visibleFraction=0.0397`、`foam.visibleFraction=0.0225`、`velocity.activeFraction=0.9629`、`huangFrontState.occupancy.mean=0.0888`、`huangFrontState.occupancy.above035=0.0972`、`phaseAreaError.broadSheet.mean=0.2024`。
- 对照结论：这轮确认 beauty 侧能把 Huang front 转成真实干涉色，cyan 相比 run3613 提高约百倍，紫蓝/白色散射也由局部物理场控制；但与参考图仍差距明显。参考图的青绿分叉河道是连续贯穿的主结构，run3665 只在右下/底部/局部边缘出现碎片状青绿；紫蓝窄边仍不足；橙金厚膜变得更物理但偏暗、偏整片；微滴密度和沿边界排布仍不对。

### Huang 2020 模型贴合度
- 更贴合的部分：干涉色不再主要靠手工暖色/冷色混合，而是由 `eta`、`Gamma` 梯度、front occupancy/age、视角 `cosTheta`、capillary/Marangoni 边界厚度扰动进入 `thinFilmRgb()` 推导；这符合 Huang 中 `eta/Gamma/u` 主场决定膜厚和表面张力耦合的方向。
- 仍不贴合的部分：`huangFrontState` 本身不是论文式 velocity-aligned/BiMocq2 material front。当前 front 仍是局部、碎片、偏边缘的诊断场，中心没有形成参考图所需的连续分叉河道；`phaseAreaError.broadSheet.mean=0.2024` 也说明下游相场仍在宽片/窄线之间摇摆。
- 因此本轮不能再继续靠 beauty shader 小修小补。shader 已证明可以接收物理 front 并输出干涉色，下一步必须修 Huang front 的生成与守恒输运。

### 下一步计划
1. 不改构图，不采样参考图，不继续做颜色拟合。
2. 回到 `thinFilmSim.js`：优先重构 `HUANG_RESIDUAL_TRANSPORT_FRAGMENT_SHADER` / `HUANG_FRONT_STATE_FRAGMENT_SHADER` 的 material-front 生成，使 `huangResidualTransport` 先出现连续弯曲、分叉、窄的物理线网，而不是宽雾和边缘碎片。
3. 按 Huang 全文继续靠近 velocity-aligned/BiMocq2 映射：增加 forward/backward map composition、pair error、reset gate 与沿 `u + Gamma_tangent` 的守恒 backtrace；横向只做宽度约束/NMS，不再直接决定 front 是否存在。
4. 验收顺序仍为 `solid -> thickness -> phase -> velocity -> foam -> filamentConnectivity -> phaseArea -> phaseAreaError -> huangResidualTransport -> huangFrontState -> beauty`；只有当 `huangFrontState` 先出现连续青绿分叉窄线后，才继续判断 beauty 的 cyan/purple/cream-white 是否自然上升。
## 2026-06-02 heartbeat / Run 3666-3725: material-front carry 实验失败，已撤回代码

### 开始前强制复核
- 已重新读取 `artifacts/targets/soap-film-huang-2020-fulltext-notes.md`、`artifacts/targets/soap-film-physics-handoff.md`、`artifacts/targets/soap-film-target.md` 和本迭代记录。
- 已重新查看并对照 `artifacts/targets/soap-film-reference.jpg`、上一轮最新 beauty `run-3665-beauty-huang-optical-front-coupling-rim-phase.png`、`run-3664-huangFrontState...png`、`run-3654-thickness...png`、`run-3655-phase...png`、`run-3657-foam...png`。
- 复核结论：`run-3665` 已证明 beauty 能把 Huang front 转成薄膜干涉色，但 `huangFrontState` 自身仍是局部云斑/边缘碎片，不是参考图中心贯穿的连续青绿分叉河道。继续修 beauty 或构图不符合计划；本轮只尝试 `thinFilmSim.js` 的 Huang residual/front 生成链路。

### 本轮尝试
- 尝试 1：在 `HUANG_RESIDUAL_TRANSPORT_FRAGMENT_SHADER` 中加入基于 incoming flux、forward/backward map、pair confidence 和 BFECC consistency 的 conservative material carry；在 `HUANG_FRONT_STATE_FRAGMENT_SHADER` 中加入 mapped front memory，让 previous front 通过 back/forward material map 参与 occupancy、distance 和 lineAge。
- 尝试 2：发现尝试 1 过度污染下游后，降低 mapped front memory 权重，仅保留弱 occupancy/age 传播。
- 尝试 3：撤掉 front 侧 mapped-history 直连，仅保留 residual conservative carry，检查 residual 诊断改善是否能安全传导。
- 所有尝试都没有使用贴图、参考图采样、预烘焙纹理、canvas 图案、样式拟合或构图修改。

### 截图与指标
- `run-3666-3685-huang-material-carry-front-memory-*`：全 debug view 截图成功，`problemCount=0`。但是 beauty 变成浅粉/奶白片，`eta.thickFraction=0.0003`，`creamWhite=0.1277`，`cyan=0.0`，明显退化。
- `run-3686-3705-huang-material-carry-conservative-front-*`：全 debug view 截图成功，`problemCount=0`。仍为浅粉/奶白，`cyan=0.0`，`creamWhite=0.0909`，没有恢复青绿河道。
- `run-3706-3725-huang-residual-carry-front-original-*`：全 debug view 截图成功，`problemCount=0`。厚膜颜色恢复一部分，但 `cyan=0.0065`，低于上一轮 `run3665` 的约 `0.0155`；`orange=0.5756`，明显过量；front 仍不连续。
- 对照参考图：参考图有连续青绿分叉河道、紫蓝窄边、橙金厚膜内的拉丝和沿边界的奶金/白色微滴。本轮三个尝试都没有形成中心贯穿河道，且前两个把厚膜破坏成浅奶色，第三个退回过量橙膜。

### Huang 2020 贴合度结论
- 方向上，本轮尝试的是 Huang/BiMocq2 思路中的 material map carry 和 forward/backward consistency，属于论文模型相关路径。
- 但当前实现仍只是局部 fragment shader 权重连接，并没有真正构成 Huang et al. 2020 的 staggered spherical grid、严格 velocity-aligned vector advection、Gamma implicit projection-like SPD solve 和守恒 `eta/Gamma/u` 闭环。
- 实验结果说明：把 material carry 直接注入 front occupancy 会破坏 `eta` reservoir 和下游 optical thickness；这条路径不能继续靠权重调节推进。
- 本轮代码中的 material carry/front memory 改动已撤回，避免留下比 `run-3665` 更差的回归。保留的是截图、颜色诊断 JSON 和本记录。

### 下一步计划
1. 不再尝试把 previous front 直接通过 mapState 喂回 occupancy；front 必须从 `eta/Gamma/u` 的守恒更新自然产生，而不是记忆贴片。
2. 下一轮优先检查 `GAMMA_VELOCITY_CORRECTION_FRAGMENT_SHADER`、`GAMMA_DIVERGENCE_FIELD_FRAGMENT_SHADER` 和 Gamma feedback 循环，确认 `Gamma` projection-like residual 是否真的回写到速度和 `eta`，而不是只形成诊断图。
3. 在改 front 前，先用 debug 验证 `gammaCandidate/gammaRhsResidual/huangGradGamma/huangMarangoniGate/etaGammaVelocity` 是否能形成连续 velocity-aligned 压缩带；只有这些主物理场连续后，才允许 front/phase/foam 读取。
4. 下一轮验收仍按 `solid -> thickness -> phase -> velocity -> foam -> filamentConnectivity -> phaseArea -> phaseAreaError -> huangResidualTransport -> huangFrontState -> beauty` 全序列截图，并继续对照参考图和 Huang 全文模型。

## 2026-06-02 / Run 3746-3785: 新增 `filmSolver=huangCore` CPU 球面参考核心，完成最小可见性与 Gamma RHS 投影修复

### 开始前强制复核
- 已按当前最高优先级重新读取 `artifacts/targets/soap-film-huang-2020-fulltext-notes.md`、`artifacts/targets/soap-film-physics-handoff.md`、`artifacts/targets/soap-film-target.md` 和本迭代记录。
- 复核 Huang et al. 2020 全文约束：主场必须是球面半厚度 `eta`、表活剂浓度 `Gamma`、切向速度 `u=(u_theta,u_phi)`；核心耦合为球面 `grad/div/laplace`、`-(M/eta) grad(Gamma)` Marangoni 力、外部空气拖曳、重力体力、`D Gamma/Dt = -Gamma div(u) + Ds lap(Gamma)` 和 `D eta/Dt = -eta div(u)`。`phase/foam/filament/front` 只能从这些场派生，不能反过来制造图案。
- 本轮改代码前重新对照了参考图 `artifacts/targets/soap-film-reference.jpg` 和上一轮最新有效图 `artifacts/targets/run-3745-beauty-huang-gamma-spherical-feedback.png`。上一轮仍然是混合启发式主导，橙金有恢复但中心青绿分叉河道缺失，`eta.thickFraction` 仍不自洽。

### 本轮实现
- 新增 `mvp/src/visual/huangSphericalCore.js`：一个先正确性优先的 CPU/DataTexture 球面参考核心，作为 `filmSolver=huangCore`。它保留 legacy GPU 路径作为对照，但默认新路径为 Huang 主线。
- 主变量改为 `eta/Gamma/uPhi/uTheta`，并用经纬球面度量实现近似 `grad_s`、`div_s`、`lap_s`、极点折返和 `phi` 周期采样；当前仍是 cell-centered 近似，还不是论文的 staggered spherical grid。
- 时间步分裂：先半拉格朗日球面回溯平流 `eta/Gamma/u/phase/foam`，再构造 `Gamma` RHS，做隐式 Jacobi 解 `(I - alpha lap_s) Gamma = rhs`，随后用 `-(M/eta) grad_s(Gamma)`、重力、外部气流拖曳和粘性扩散更新 `u`，最后按 `eta = eta* - dt eta* div_s(u)` 更新厚度并记录质量误差。
- 所有 debug 贴图从同一 `huangCore` 主状态导出：`thickness/phase/velocity/foam/filamentConnectivity/phaseArea/huangFrontState/huangResidualTransport/huangMapState/huangForwardMapState/etaGammaVelocity/gammaCandidate/gammaRhsResidual/huangDivergence/huangGradGamma/huangMarangoniGate/beauty`。
- `mvp/src/config/controlSchema.js` 新增 `glassWind.filmSolver`，默认 `huangCore`，可切回 `legacy` 对照。
- `mvp/src/visual/thinFilmSim.js` 接入 `huangCore` texture/diagnostics getter，并保留 `legacy` 路径；`mvp/src/visual/logoScene.js` 在 `window.__soapFilmDebug` 中发布 `filmSolver`，并在 `solid` 视图跳过模拟步进前同步 solver mode。
- 首轮 `run-3746-3765-huang-core-cpu-reference` 暴露一个数值问题：`Gamma` 隐式步把 RHS 和 Jacobi 输出数组混用，导致记录到的 residual 为 `initial=0.000002 -> final=0.000006`，ratio > 1。
- 随后修复 `solveGamma()`：新增独立 `gammaRhs` 数组，用固定 RHS 计算 Jacobi，残差改为真实 `(I - alpha lap_s)Gamma - rhs`。这是数值求解器修复，不是调色。

### 验证结果
- 语法检查通过：
  - `mvp/src/visual/huangSphericalCore.js`
  - `mvp/src/visual/thinFilmSim.js`
  - `mvp/src/visual/logoScene.js`
  - `mvp/src/config/controlSchema.js`
- `run-3746-3765-huang-core-cpu-reference-*`：20 个 debug/beauty 视图全部截图成功，`problemCount=0`，确认 `solid` 壳层可见且 `window.__soapFilmDebug.filmSolver=huangCore`。
- `run-3766-3785-huang-core-cpu-rhs-projection-*`：修复 RHS 后重新全量截图，`solid/thickness/phase/velocity/foam/filamentConnectivity/phaseArea/phaseAreaSkeleton/huangFrontState/huangResidualTransport/huangMapState/huangForwardMapState/huangNarrowGate/etaGammaVelocity/gammaCandidate/gammaRhsResidual/huangDivergence/huangGradGamma/huangMarangoniGate/beauty` 全部 `problemCount=0`。
- 最终 beauty 诊断 `run-3785`：`solver=huangCore`、`size=128`、`step=136`、`massError=-0.00083`、`projectionResidual.initial=0.000009`、`projectionResidual.final=0`、`ratio=0.0006`、`iterations=18`。
- 物理场统计 `run-3785`：`eta.mean=0.5299`、`eta.thickFraction=0.4113`、`eta.thinFraction=0.3452`、`Gamma.mean=0.4762`、`velocity.mean=0.1425`、`velocity.activeFraction=1`、`foam.visibleFraction=0.8575`、`phase.visibleFraction=0.9553`、`huangFrontState.occupancy.mean=0.1993`。
- 本轮生成分析 JSON：`artifacts/targets/run-3785-huang-core-cpu-rhs-projection-color-comparison.json`。该 JSON 只用于离线对比，未进入渲染路径。参考图活跃像素统计约 `orange=0.3361`、`cyan=0.0668`、`purpleBlue=0.0381`、`creamWhite=0.0141`、`bright=0.1971`；当前约 `orange=0.1353`、`cyan=0.0693`、`purpleBlue=0.0495`、`creamWhite=0.6766`、`bright=0.7140`。

### 对照参考图与 Huang 模型的偏差
- 相似点：`solid`、`thickness`、`phase`、`velocity`、`foam` 和 Huang 诊断链路现在都可见；`eta` 厚薄区、`Gamma` 梯度、速度和投影残差来自同一个主状态，已明显比上一轮混合启发式更适合作为论文核心改造基线。
- 橙金厚膜：参考图中橙金是主体岛状厚膜，当前 `eta.thickFraction=0.4113` 说明厚膜场存在，但最终 beauty 的橙金活跃占比只有约 `0.1353`，且主要是一条水平带，不是参考图的岛状厚膜/液体拉丝。
- 青绿分叉河道：HSV 数值里 cyan 接近参考，但肉眼失败；当前是大块淡青/奶白下半区和横向层带，不是参考图中连续、弯曲、分叉的青绿河道。也就是说颜色比例不能作为成功证据，必须以 `eta/Gamma/u/front` 的连通结构为准。
- 紫蓝窄边：当前紫蓝比例略高，但形态不是贴着青绿河道的窄边，而是水平相位带/边缘散布。
- 奶金/白色微滴：当前 `creamWhite=0.6766`，远高于参考 `0.0141`；视觉上是大面积奶白/粉白污染，不是沿高剪切/高曲率/相边界分布的离散微滴。
- Huang 贴合度：本轮完成了 `eta/Gamma/u` 主状态、球面算子近似、Marangoni 速度响应、`Gamma` 隐式投影式求解和质量/残差诊断；但仍未达到论文级。缺口包括 staggered spherical grid、真正 velocity-aligned 向量平流、BiMocq2/forward-backward material map、论文场景参数、外部气流边界条件，以及更严格的谱薄膜渲染。

### 下一步计划
1. 保留 `filmSolver=huangCore` 为默认主线，`legacy` 仅作对照；不得把 legacy 的 phase/front/foam 经验项重新喂回主状态。
2. 先补 CPU 核心的可测物理场景，而不是继续调 beauty：建立纯重力排液、Marangoni 梯度扰动、外部气流拖曳三组固定场景，分别验证 `eta` 质量、`Gamma` residual、`u` 响应和球面散度。
3. 把当前 cell-centered 近似升级为更接近论文的 staggered spherical grid，至少先让 `u_theta/u_phi` 在采样和散度/梯度上分离，降低水平带状伪影。
4. 实现真正的 velocity-aligned/BiMocq2 式 forward/backward material map；`huangFrontState` 必须由 map confidence、pair error、压缩区、`|grad Gamma|` 和 `div_s(u)` 派生，不能再是宽雾或上一帧 front 记忆贴片。
5. 在 beauty 侧只允许读取 `eta/Gamma/u/front/foam` 物理派生字段生成干涉色；下一轮若继续出现大面积奶白污染，应先查 `eta -> optical thickness -> thinFilmRgb()` 映射和泡沫散射门控，而不是调构图或颜色。
## 2026-06-03 / Run 3833-3863: Huang CPU 核心增加论文基础场景与方向性诊断

开始前强制复核：本轮重新读取 `artifacts/targets/soap-film-huang-2020-fulltext-notes.md`、`artifacts/targets/soap-film-physics-handoff.md`、`artifacts/targets/soap-film-target.md` 和本迭代记录，并重新查看 `artifacts/targets/soap-film-reference.jpg` 与上一轮最新 beauty `artifacts/targets/run-3785-beauty-huang-core-cpu-rhs-projection.png`。上一轮已经通过 solid 最小可见性和 20 个 debug view 截图，`window.__soapFilmDebug.filmSolver=huangCore`，但结果仍是水平层带和大面积奶白/浅青污染：橙金厚膜不是参考图那种岛状厚膜，青绿比例虽有但形态不是连续分叉河道，紫蓝窄边不贴河道，奶金/白色微滴变成大片污染。按 Huang et al. 2020 全文模型对照，问题不在构图，也不能靠调色解决；必须先验证 `eta/Gamma/u` 三个主场在纯机制场景下是否符合论文方向。

本轮实现只修改物理核心与诊断/截图工具，没有改构图、相机、参考图采样、贴图、预烘焙纹理、canvas pattern 或 beauty 拟合：
- `mvp/src/visual/huangSphericalCore.js` 新增 `filmHuangScenario` 支持：`referenceFlow`、`gravityDrainage`、`marangoniPatch`、`airflowShear`。
- 三个论文基础场景分别初始化为：纯重力排液的上下厚度梯度与近均匀 `Gamma`；Marangoni 表活剂斑块与近均匀 `eta`；外部气流剪切的弱扰动 `eta/Gamma` 与目标切向拖曳。
- 外力参数按场景拆分：重力场关闭气流并弱化 Marangoni；Marangoni 场关闭重力/气流、降低扩散并强化 `-(M/eta) grad(Gamma)`；气流场强化 drag 到目标切向速度。
- `diagnostics()` 新增 `scenario`、`forces`、`scenarioChecks`，记录上下半球 `eta` 均值差、`marangoniAlignment`、`airflowAlignment`、平均压缩、目标气流速度等。
- 泡沫更新改为只在 front/`|grad Gamma|`/shear 附近局部累积，避免整片相场继续把 beauty 刷成白雾。
- `mvp/src/config/controlSchema.js` 新增 `glassWind.filmHuangScenario`；`mvp/src/visual/logoScene.js` 在 `window.__soapFilmDebug` 发布该场景；`artifacts/targets/capture-soap-front-state.mjs` 增加额外 URL query 参数入口，便于固定场景截图。

静态检查通过：
- `mvp/src/visual/huangSphericalCore.js`
- `mvp/src/visual/thinFilmSim.js`
- `mvp/src/visual/logoScene.js`
- `mvp/src/config/controlSchema.js`
- `artifacts/targets/capture-soap-front-state.mjs`

截图验证：
- 完整默认序列：`run-3833-3852-huang-core-scenarios-force-scale-reference-*`，覆盖 `solid/thickness/phase/velocity/foam/filamentConnectivity/phaseArea/phaseAreaSkeleton/huangFrontState/huangResidualTransport/huangMapState/huangForwardMapState/huangNarrowGate/etaGammaVelocity/gammaCandidate/gammaRhsResidual/huangDivergence/huangGradGamma/huangMarangoniGate/beauty`，全部 `problemCount=0`。最新默认 beauty 为 `artifacts/targets/run-3852-beauty-huang-core-scenarios-force-scale-reference.png`。
- Marangoni 场景：`run-3853-3861-huang-core-scenario-marangoni-force-scale-*`，全部 `problemCount=0`。最新 Marangoni beauty 为 `artifacts/targets/run-3861-beauty-huang-core-scenario-marangoni-force-scale.png`。
- 当前重力 beauty 诊断：`artifacts/targets/run-3862-beauty-huang-core-scenario-gravity-current.png`。
- 当前气流 beauty 诊断：`artifacts/targets/run-3863-beauty-huang-core-scenario-airflow-current.png`。
- 离线颜色诊断写入 `artifacts/targets/run-3852-huang-core-scenarios-force-scale-reference-color-comparison.json`，只用于失败分析，不参与渲染。

关键物理诊断：
- 默认 `referenceFlow`：`massError=-0.00005`，`projectionResidual.initial=0.000011 -> final=0`，`eta.thickFraction=0.4238`，`foam.visibleFraction=0.3294`，`phase.visibleFraction=0.9617`，`front.occupancy.mean=0.1596`。`gravityDrainageBias=0.4411`、`airflowAlignment=0.9997`，但 `marangoniAlignment=-0.637`，说明混合场里气流/重力主导，Marangoni 响应仍被压过或符号/输运混合不稳。
- 纯重力排液：`gravityDrainageBias=0.5820`，`northEtaMean=0.2051`、`southEtaMean=0.7871`，方向符合重力排液；`massError=-0.00915` 偏大，需要进一步降低长预热质量漂移。
- Marangoni 斑块：修正前 `marangoniAlignment=-0.0222`，修正后 `marangoniAlignment=0.7900`，说明速度已经主要沿 Huang 主方程的 `-grad(Gamma)` 方向响应；但 `meanCompression=7.421` 太高，当前强化过猛，会导致局部压缩不稳定，不能直接作为最终参考图参数。
- 外部气流剪切：`airflowAlignment=0.9998`，目标气流拖曳方向成立；但画面仍是大块浅青/蓝层带，说明 velocity-aligned/BiMocq2 材料前沿和相场面积约束还没达到论文结果。

对照参考图的失败点：
- 参考图是橙金厚膜岛占主导，青绿分叉河道贯穿并贴紫蓝窄边，奶金/白色微滴集中在边界和高剪切位置；当前默认图仍是水平层带主导，中部没有连续分叉河道。
- 离线 HSV 诊断显示参考约 `orangeGold=0.2975`、`cyanGreen=0.0680`、`purpleBlue=0.0399`、`creamWhite=0.0029`；当前默认约 `orangeGold=0.1225`、`cyanGreen=0.3002`、`purpleBlue=0.1149`、`creamWhite=0.1881`。这再次说明当前不是缺青色/紫色，而是青紫和白色以错误的宽片/层带形态出现。
- 与 Huang 2020 的贴合度提高在：现在有可切换的论文基础机制场景、球面 `eta/Gamma/u` 主状态、`Gamma` 隐式 Jacobi 残差、重力/气流/Marangoni 方向性诊断。仍不贴合在：经纬 cell-centered 近似还不是论文 staggered spherical grid；没有真正的 velocity-aligned 向量平流和 BiMocq2；`phase/front/foam` 仍过宽，不能生成参考图那种守恒、窄、连续、分叉的 material front。

下一步计划：
1. 不改构图、不调 beauty 颜色、不采样参考图。
2. 先稳定 Marangoni 场景：降低 `meanCompression`，让 `marangoniAlignment` 保持正向但不过冲；把 `eta` 质量漂移控制在可解释范围。
3. 将 `phase` 从现在接近全屏可见的宽片改为真正由 `eta/Gamma/u` 守恒输运出的材料前沿；优先实现 velocity-aligned backtrace 的 forward/backward map 误差诊断，而不是再给 `front` 加阈值。
4. 开始把 cell-centered `uPhi/uTheta` 拆向论文更接近的 staggered 采样，至少先在 `div_s(u)` 和 `grad_s(Gamma)` 的离散上减少水平层带伪影。
5. 下一轮仍按 `solid -> thickness -> phase -> velocity -> foam -> filamentConnectivity -> phaseArea -> phaseAreaSkeleton -> huangFrontState -> ... -> beauty` 全序列截图，并继续对照参考图与 Huang 全文模型。

## 2026-06-03 / Run 3887-3909: 球面 velocity-aligned/BFECC 输运与窄相场预算

### 开始前强制复核
- 已重新读取 `artifacts/targets/soap-film-huang-2020-fulltext-notes.md`、`artifacts/targets/soap-film-physics-handoff.md`、`artifacts/targets/soap-film-target.md` 和本迭代记录。
- 已重新查看 `artifacts/targets/soap-film-reference.jpg` 与上一轮最新图 `artifacts/targets/run-3852-beauty-huang-core-scenarios-force-scale-reference.png`。上一轮物理方向诊断成立，但视觉仍是水平层带、大面积青白/奶白污染，没有参考图的橙金厚膜岛、青绿分叉河道、紫蓝窄边和边界微滴。
- 对照 Huang et al. 2020 全文，本轮不改构图、不采样参考图、不调 beauty 颜色；优先补当前 `huangCore` 与论文 velocity-aligned/BiMocq2 material transport 的差距，并压低由派生 `phase/foam` 造成的宽片污染。

### 本轮实现
- `mvp/src/visual/huangSphericalCore.js` 增加球面局部基 `e_phi/e_theta` 与 3D 切向向量回投影：速度不再简单把 `uPhi/uTheta` 当平面标量搬运，而是在 backtrace 点还原为球面切向向量，再投影到当前点的局部球面基。这是 Huang velocity-aligned 向量平流的近似版本，还不是完整 staggered/vector BiMocq2。
- `eta/Gamma/phase/foam` 平流改为 BFECC 式双向误差修正：从当前点沿速度回溯采样，再从回溯点前推回当前点，用 round-trip 误差做受限校正；校正由球面距离 `pairError` 门控，避免把 map 误差直接放大成假纹理。
- `huangFrontState` 的 `pairError` 计算从原先可疑的 UV 代数修正为球面度量距离；`mapConfidence/mapReject`、`materialResidual` 和 `frontOccupancy` 现在来自同一 forward/backward consistency。
- 降低 `phase/foam` 的派生增长预算：`phase` 必须更多依赖 `frontOcc/gradGamma/compression` 的窄物理支撑，`foam` 只在 front、表活剂梯度和剪切附近保留。同步把 Marangoni 单场景的 `marangoniForceScale` 从 0.12 降到 0.075，避免斑块场景继续过压缩。
- 修复本文档上一轮标题前的乱码换行。

### 截图与诊断
- 第一版 `run-3864-3883-huang-core-velocity-bfecc-reference*`：前 19 个 debug view 已生成，beauty 补抓为 `run-3883-beauty-huang-core-velocity-bfecc-reference-beauty.png`，`problemCount=0`。该版证明 BFECC/向量回投影没有导致 WebGL 或主状态崩溃，但 `phase.visibleFraction=0.761`、`broadSheet=0.4176`，画面仍被宽相场刷成大面积青白/奶白。
- 最终版完整序列 `run-3887-3906-huang-core-velocity-bfecc-narrow-budget-reference-*` 覆盖 `solid/thickness/phase/velocity/foam/filamentConnectivity/phaseArea/phaseAreaSkeleton/huangFrontState/huangResidualTransport/huangMapState/huangForwardMapState/huangNarrowGate/etaGammaVelocity/gammaCandidate/gammaRhsResidual/huangDivergence/huangGradGamma/huangMarangoniGate/beauty`，全部截图成功，`problemCount=0`。最新 beauty 为 `artifacts/targets/run-3906-beauty-huang-core-velocity-bfecc-narrow-budget-reference.png`。
- 三个基础场景补抓：`run-3907` 重力排液、`run-3908` Marangoni 斑块、`run-3909` 外部气流剪切，均 `problemCount=0`。
- 离线颜色诊断写入 `artifacts/targets/run-3906-huang-core-velocity-bfecc-narrow-budget-reference-color-comparison.json`，只用于失败分析，不进入模拟或渲染。

### 最终数值
- 默认 `referenceFlow`：`massError=-0.00083`，`projectionResidual.initial=0.000010 -> final=0`，`eta.thickFraction=0.4113`，`eta.thinFraction=0.3453`，`velocity.mean=0.1424`，`gravityDrainageBias=0.5841`，`airflowAlignment=0.9996`，`marangoniAlignment=-0.7499`。`phase.visibleFraction` 从第一版 0.761 降到 0.195，`foam.visibleFraction=0.0858`，`broadSheet=0.0034`。
- 纯重力排液：方向仍成立，`northEtaMean=0.2036`、`southEtaMean=0.7852`、`gravityDrainageBias=0.5816`；但 `massError=-0.01328` 仍偏大，说明长预热/强重力下质量修正还不够严格。
- Marangoni 斑块：`marangoniAlignment=0.6503`，仍为正向；`meanCompression` 从上一轮 4.7906 降到 3.5289，但仍过高，说明当前显式速度更新会在 Gamma 斑块附近产生过强局部压缩。
- 外部气流剪切：`airflowAlignment=0.9999`，`massError=-0.0004`，方向性稳定；但视觉仍为纬向层带/大块边界，不是论文视频中的连续拉伸条带。

### 对照参考图与 Huang 模型的偏差
- 颜色统计：参考约 `orangeGold=0.3793`、`cyanGreen=0.0633`、`purpleBlue=0.0311`、`creamWhite=0.0020`；最终图约 `orangeGold=0.3088`、`cyanGreen=0.1055`、`purpleBlue=0.0635`、`creamWhite=0.1184`。橙金比例更接近，但青绿/紫蓝/奶白仍偏高且形态错误。
- 视觉偏差：最终图仍被经纬方向的水平带和下垂竖丝主导；参考图的青绿结构是斜向、弯曲、分叉、贯穿的 material river，当前只是下半区竖向条纹和一条纬向边界。
- Huang 贴合度提升：速度平流现在至少做了球面切向向量回投影；标量输运有 forward/backward consistency 和 BFECC 受限校正；`phase/foam` 宽片不再主导主画面。
- 仍不贴合：还没有论文的 staggered spherical grid；`div_s(u)` 和 `grad_s(Gamma)` 仍是 cell-centered 经典运算，容易产生纬向带状伪影；没有真正 BiMocq2 mapping reset/composition；`referenceFlow` 混合场里 Marangoni 仍被气流/重力压过，`marangoniAlignment` 为负。

### 下一步计划
1. 不改构图、不采样参考图、不调 beauty 色彩。
2. 优先把 CPU 核心从 cell-centered 速度近似推进到 staggered-like 离散：分离 `u_phi/u_theta` 的采样位置，重写 `div_s(u)` 和 `grad_s(Gamma)`，降低水平层带伪影。
3. 在 Marangoni 场景继续降低显式压缩：引入基于 `Gamma` projection residual 的速度校正/阻尼，而不是继续调前沿阈值。
4. 材料前沿下一步要从 forward/backward map 的连续曲线产生，不能用上一帧 front memory 或宽 phase 预算补出来；目标是先让 `huangResidualTransport` 和 `huangFrontState` 出现弯曲分叉窄线，再看 beauty。
5. 重力场景要把 `massError=-0.01328` 压回可解释范围，避免靠后处理 massScale 掩盖数值漂移。

## 2026-06-03 / Run 3910-3932: 球面 staggered-like 散度/梯度与 Marangoni 阻尼

### 开始前强制复核
- 已重新读取 `artifacts/targets/soap-film-huang-2020-fulltext-notes.md`、`artifacts/targets/soap-film-physics-handoff.md`、`artifacts/targets/soap-film-target.md` 和本迭代记录。
- 已重新查看 `artifacts/targets/soap-film-reference.jpg`、上一轮最新 beauty `artifacts/targets/run-3906-beauty-huang-core-velocity-bfecc-narrow-budget-reference.png`，以及上一轮 `huangFrontState/phase/foam/thickness` 调试图。
- 上一轮的主要失败没有变成构图问题：结果仍是水平纬向带和下垂竖丝，参考图需要的是橙金厚膜岛、斜向青绿分叉河道、贴边紫蓝窄相位线和高剪切/边界微滴。按 Huang et al. 2020 全文模型对照，下一步应继续减少 cell-centered 经纬离散伪影，而不是调色或调整构图。

### 本轮实现
- `mvp/src/visual/huangSphericalCore.js` 新增 `minmod()` 斜率限制器，用中心差分和受限面斜率混合重建 `grad_s(field)`，降低单纯中心差分在强梯度/极区附近的振荡。
- 将旧 `gradient()` 拆为 `centeredGradient()` 和新的 slope-limited `gradient()`；新的梯度仍在 cell-centered 状态上工作，因此只是 staggered-like 过渡，不是论文完整 staggered spherical grid。
- 将旧 `divergence()` 拆为 `centeredDivergence()` 和新的有限体积式 `divergence()`：`u_phi` 与 `u_theta` 先重建到经纬面，`theta` 通量显式乘以 `sin(theta)` 面积权重，再除以中心 `sin(theta)`。
- 新增 `sinThetaAtFace()`、`centeredDivergence` 与 `staggeredDivergenceDelta` 诊断，用来记录新旧散度的差别，而不是只看 beauty。
- `solveGamma()` 与最终厚度更新阶段都记录 staggered-like 散度与 centered 散度差异。
- Marangoni 力加入基于 `Gamma` projection residual 和局部压缩的阻尼项，只作用于 `-(M/eta) grad_s(Gamma)` 分量，避免在高残差/强压缩区继续显式过冲；重力和气流拖曳不受该阻尼影响。
- 没有使用贴图、参考图采样、预烘焙纹理、canvas pattern 或样式拟合；参考图只用于本轮结束后的离线人工对比统计。

### 验证与截图
- 静态检查通过：
  - `mvp/src/visual/huangSphericalCore.js`
  - `mvp/src/visual/thinFilmSim.js`
  - `mvp/src/visual/logoScene.js`
  - `artifacts/targets/capture-soap-front-state.mjs`
- 完整默认序列 `run-3910-3929-huang-core-staggered-div-reference-*` 覆盖 `solid/thickness/phase/velocity/foam/filamentConnectivity/phaseArea/phaseAreaSkeleton/huangFrontState/huangResidualTransport/huangMapState/huangForwardMapState/huangNarrowGate/etaGammaVelocity/gammaCandidate/gammaRhsResidual/huangDivergence/huangGradGamma/huangMarangoniGate/beauty`，全部 `problemCount=0`。
- 最新默认 beauty 为 `artifacts/targets/run-3929-beauty-huang-core-staggered-div-reference.png`。
- 关键调试图：
  - `artifacts/targets/run-3918-huangFrontState-huang-core-staggered-div-reference.png`
  - `artifacts/targets/run-3926-huangDivergence-huang-core-staggered-div-reference.png`
  - `artifacts/targets/run-3927-huangGradGamma-huang-core-staggered-div-reference.png`
  - `artifacts/targets/run-3928-huangMarangoniGate-huang-core-staggered-div-reference.png`
- 三个论文基础场景补抓成功：`run-3930` 重力排液、`run-3931` Marangoni 斑块、`run-3932` 外部气流剪切，均 `problemCount=0`。其中第一次 Marangoni 抓图发生一次浏览器 `socket hang up`，结果 JSON 为空，服务未崩溃，重拍成功。
- 离线颜色统计写入 `artifacts/targets/run-3929-huang-core-staggered-div-reference-color-comparison.json`，只用于失败分析，未进入求解器、渲染器或参数拟合。

### 关键数值
- 默认 `referenceFlow`：`massError=-0.00029`，比上一轮 `-0.00083` 更小；`projectionResidual.initial=0.000014 -> final=0`，`ratio=0.0005`，`iterations=18`。
- 默认 `referenceFlow` 场统计：`eta.mean=0.5305`，`eta.thickFraction=0.4159`，`eta.thinFraction=0.3312`，`Gamma.highFraction=0.3402`，`velocity.mean=0.1434`。
- 默认方向性：`gravityDrainageBias=0.5631`，`airflowAlignment=0.9996`，但 `marangoniAlignment=-0.7201`，说明混合场中 Marangoni 仍被气流/重力主导或与当前材料输运耦合方向冲突。
- 默认派生场：`phase.visibleFraction=0.1711`，`foam.visibleFraction=0.0821`，`huangFrontState.occupancy.mean=0.1778`，`broadSheet=0.008`。宽片污染已被压低，但连通拓扑仍不对。
- 新旧散度差：`staggeredDivergenceDelta.mean=0.0136`，`aboveFraction=0.0457`。这说明本轮离散确实改变了散度局部计算，但影响范围有限，无法单独消除纬向层带。
- 纯重力排液：`gravityDrainageBias=0.5804`，方向正确；但 `massError=-0.01652`，强重力长期排液下仍存在不可忽略质量漂移。
- Marangoni 斑块：`marangoniAlignment=0.4704`，仍为正向，说明单机制下 `-grad(Gamma)` 驱动成立；但 `meanCompression=2.2849`，局部压缩仍偏强。
- 外部气流剪切：`airflowAlignment=0.9999`，方向正确；`massError=-0.00042`，但视觉仍偏纬向层带。

### 对照参考图与 Huang 模型的偏差
- 参考图活跃区域几乎铺满目标画面，离线统计 `activeFraction=0.97072`；当前 `run-3929` 只有 `0.18719`。这不是色相比例小问题，而是球面物理结构覆盖和材料前沿拓扑根本不够。
- 颜色桶：参考 `orange=0.37926`、`cyan=0.06333`、`purple=0.03112`、`cream=0.00203`；当前 `orange=0.30400`、`cyan=0.11336`、`purple=0.07606`、`cream=0.13195`。橙金比例接近了一点，但青绿、紫蓝和奶白仍以错误的水平/竖向结构出现。
- 肉眼偏差：`run-3929` 仍是上方淡色纬向带、中部宽橙带、下方蓝青区和竖向滴丝；参考图是多尺度橙金岛与青绿分叉河道交织，并非这种经纬层状排液。
- Huang 贴合度提升：本轮比上一轮更接近论文的球面守恒离散方向，`div_s(u)` 引入面通量思想，质量误差在默认混合场改善，projection residual 稳定下降，Marangoni 单场景仍能正向响应。
- Huang 仍不贴合：速度仍存储在 cell center，没有真正的 `u_phi/u_theta` 面速度自由度；`eta/Gamma` 更新仍不是严格面通量守恒格式；material map 仍只是 BFECC/round-trip 近似，不是完整 BiMocq2 mapping reset/composition；经纬网格本身仍放大水平带状伪影。

### 下一步计划
1. 不改构图、不调 beauty 色彩、不采样参考图。
2. 将 `u_phi/u_theta` 拆成真实 face velocity buffers，先在 CPU core 中实现面速度更新、面上 Marangoni 梯度、面通量 `eta*u`，再由面通量更新 `eta/Gamma`，而不是只在 cell center 重建。
3. 对重力场景做严格质量修正审计：确认质量漂移来自边界/极区/显式压缩还是后续 clamp，并把 `gravityDrainage.massError=-0.01652` 压回可解释范围。
4. 对 Marangoni 场景继续降低显式压缩，同时保持 `marangoniAlignment` 为正；目标是让 `meanCompression` 降下来，而不是靠隐藏 phase/foam。
5. Material front 下一步不要再改阈值，优先实现 forward/backward map 的 reset/composition 或至少持久化 map confidence，让 `huangFrontState` 出现弯曲连续窄线，再进入 beauty 对比。

## 2026-06-03 / Run 3934-3937: 真 `filmSimResolution=512` 验证与截图脚本覆盖修复

### 触发原因
- 用户指出伪影太多且分辨率太低，并明确要求 `filmSimResolution=512`。
- 先按原截图脚本追加 `filmSimResolution=512` 抓了 `run-3933`，但 `window.__soapFilmDebug.simSize` 和 `filmDiagnostics.size` 都仍是 `128`。原因是截图脚本 URL 中先写死了 `filmSimResolution=128`，后追加 `filmSimResolution=512` 时，应用读取第一个参数，导致文件名里的 512 是假的。

### 本轮实现
- 修改 `artifacts/targets/capture-soap-front-state.mjs`：URL 构造改为 `URLSearchParams`，默认参数先写入，再用 extra query 的 key 执行 `params.set(key, value)` 覆盖默认值。
- 同时根据有效 `filmSimResolution` 自动延长非 solid view 的等待时间：`512` 使用更长等待窗口，避免高分辨率 CPU/DataTexture 求解还没到目标 render count 就超时。
- 这次只修截图验证工具，没有改模拟方程、渲染色彩、构图，也没有使用贴图、参考图采样、预烘焙纹理或 canvas pattern。

### 截图与确认
- `run-3934-beauty-huang-core-true-512-reference.png`：真实 512 beauty，`simSize=512`，`filmDiagnostics.size=512`，`problemCount=0`。
- `run-3935-3937-huang-core-true-512-reference-debug-*`：补抓 `solid/thickness/huangDivergence`。其中 `thickness` 和 `huangDivergence` 确认为 `simSize=512`；`solid` 不推进模拟，报告的是默认初始化尺寸，不作为 512 物理验证依据。
- 512 离线颜色统计写入 `artifacts/targets/run-3934-huang-core-true-512-reference-color-comparison.json`，只用于人工失败分析，不进入求解器或渲染器。

### 关键数值
- 真实 512 beauty：`massError=-0.00027`，`projectionResidual.initial=0.294574 -> final=0.004862`，`ratio=0.0165`，`iterations=18`。
- 512 场统计：`eta.mean=0.5249`，`eta.thickFraction=0.4007`，`eta.thinFraction=0.2459`，`Gamma.highFraction=0.3045`，`velocity.mean=0.1818`。
- 512 方向性：`gravityDrainageBias=0.4999`，`marangoniAlignment=0.3528`，`airflowAlignment=0.9181`。相比 128，混合场 Marangoni 不再为负，但整体压缩恶化。
- 512 失败指标：`meanCompression=10.0112`，`phase.visibleFraction=0.3107`，`broadSheet=0.1746`，`staggeredDivergenceDelta.mean=0.0299`、`aboveFraction=0.1207`。这说明高分辨率暴露出更多细节，但也暴露了当前显式压缩和散度离散不稳定。

### 对照参考图的结论
- 128 到 512 后，边界和微结构不再只是粗块；橙金统计从 `0.30400` 到 `0.34704`，更接近参考图 `0.37926`。
- 但活跃覆盖仍只有 `0.19558`，参考图是 `0.97072`；青绿 `0.16737` 和奶白 `0.06787` 仍以水平带/宽片出现，不是参考图的斜向分叉河道和边界微滴。
- `thickness` 512 调试图本身已经有明显水平厚度带和底部高频颗粒；`huangDivergence` 512 也呈纬向层状。这证明主要伪影不是 beauty shader 或 128 放大导致，而是当前 cell-centered/staggered-like 求解器和材料输运拓扑导致。

### 下一步计划
1. 后续视觉验收默认使用真实 `filmSimResolution=512` 或至少 320/384；不能再用脚本假覆盖产生的 128 截图判断最终质感。
2. 512 下 `projectionResidual.initial` 和 `meanCompression` 显著升高，下一步必须提高/改造 Gamma 隐式求解：更多迭代或更好的 SPD/CG，并把速度更新从 cell-centered 重建推进到真实 face velocity。
3. 优先修 `eta/Gamma` 的面通量守恒与压缩控制；否则 512 只会把纬向层带和底部颗粒伪影显示得更清楚。

## 2026-06-03 / Run 3943-3964: 真实面速度、CFL 限速与 512 复测

### 本轮改动
- `mvp/src/visual/huangSphericalCore.js` 将 Huang core 从 cell-centered 速度重建推进到真实面速度缓冲：新增 `uPhiFace/uThetaFace`、临时面速度、面速度到中心速度同步、面散度 `divergenceFromFaces()` 与面通量厚度更新 `etaFluxDivergence()`。
- `solveGamma()` 改用面速度散度构造 RHS，并增加高分辨率下的 Jacobi 迭代数；512 下本轮 `projectionResidual` 可降到约 `0.000004-0.000017`。
- 面速度更新按球面 CFL 限速，经向速度按 `sin(theta)` 缩小，纬向速度按 `pi/N` 缩小；之后将 CFL 系数从 `0.85` 收紧到 `0.32`，避免 512 下单步跨多格导致局部爆散度。
- `referenceFlow` 初始条件从强上下分层改为球面厚度/表活剂扰动斑块与斜向材料扰动；默认混合外力改为低重力、斜向气流和更强 Marangoni，以避免继续把重力排液当参考图形态。
- `Gamma` projection RHS 和求解 clamp 从 `0.02-0.98` 收紧到 `0.06-0.94`，同时降低每步 `eta` 通量变化上限，减少几十步内大面积贴边。
- `artifacts/targets/capture-soap-front-state.mjs` 支持高分辨率 `captureMinRenderCount` 和更长 CDP 超时，512 截图不再因为主线程忙而误报失败。
- 没有使用贴图、参考图采样、预烘焙纹理、canvas pattern 或样式拟合；新增扰动只作为物理初始条件进入 `eta/Gamma/u`。

### 截图与验证
- 128 面通量/CFL sanity：`run-3943-3946-huang-core-faceflux-cfl-sanity-*`，`solid/thickness/huangDivergence/beauty` 全部 `problemCount=0`。
- 512 面通量/CFL 早期验证：`run-3947-3949-huang-core-faceflux-cfl-true-512-*`，三张图实际成功写出，但外层命令超时；结果 JSON 完整。
- 128 低重力混合场：`run-3959-3961-huang-core-referenceflow-lowgravity-sanity-*`，`thickness/huangDivergence/beauty` 全部 `problemCount=0`。
- 最新真实 512 验证：`run-3962-3964-huang-core-lowgravity-true-512-*`，`thickness/huangDivergence/beauty` 全部 `problemCount=0`，有效 `filmDiagnostics.size=512`。

### 关键数值
- 最新 512 beauty `run-3964`：`step=7`，`massError=0`，`projectionResidual.initial=0.005145 -> final=0.000004`，`ratio=0.0008`，`iterations=44`。
- 最新 512 场统计：`eta.min=0.2229`、`eta.max=0.7961`、`eta.mean=0.4816`、`eta.thickFraction=0.0088`、`eta.thinFraction=0.0002`；`Gamma.min=0.3747`、`Gamma.max=0.6359`、`Gamma.highFraction=0.0101`。
- 最新 512 方向性：`gravityDrainageBias=-0.0528`，`marangoniAlignment=0.1765`，`airflowAlignment=0.9608`。早期低重力混合场中气流方向正确，Marangoni 已转为正响应，但还不够强。
- 最新 512 失败指标：`projectedDivergence.min=-23.4173`、`max=24.9114`、`aboveFraction=0.9876`，`staggeredDivergenceDelta.mean=0.2743`、`max=12.7517`。比旧 512 的局部 ±700-900 爆散度小很多，但仍远高于论文级离散应有状态。
- 最新 128 长一点的低重力场 `run-3961`：`massError=-0.00522`，`projectionResidual.ratio=0.0005`，但 `eta.thickFraction=0.3987`、`eta.thinFraction=0.3657`，说明长时间后仍会向厚/薄区贴边。

### 对照参考图与 Huang 模型的结论
- 512 最新 beauty 已经不是低分辨率问题：图案细节足够密，但仍有贯穿球面的赤道/纬线伪影，说明伪影来自经纬网格、面散度和材料输运，而不是 `filmSimResolution=128`。
- 相比旧 512，`Gamma` 和 `eta` 早期不再大面积贴边，投影 residual 明显改善；这是更贴近 Huang `eta/Gamma/u` 耦合的方向。
- 与参考图仍严重不符：参考图需要大面积橙金厚膜岛、连续青绿分叉河道和边界奶金/白微滴；最新 512 仍是较均匀的碎裂干涉网络加一条水平 seam，青绿河道不够连通，橙金厚膜占比不足。
- 与 Huang 论文仍未完全贴合：虽然已有真实面速度和面通量，但仍是经纬网格 CPU/DataTexture 实现；缺少论文级 velocity-aligned/BiMocq2 材料映射、真正 SPD/CG Gamma projection、严格面质量守恒、极区稳定离散或 cubed-sphere 网格。

### 下一步计划
1. 不再继续调色或构图；下一步必须消除赤道/纬线 seam，优先审计经纬网格极区/赤道采样、球面贴图映射和面速度索引。
2. 将 `eta` 与 `Gamma` 都改为同一套守恒面通量更新，并用面积加权残差验证每步全局质量，而不是靠后验 massScale 修正。
3. 把当前 Jacobi projection 升级为更接近论文的 projection-like SPD solve 或 CG，并记录 residual 曲线；目标是降低 `projectedDivergence.aboveFraction` 与 `staggeredDivergenceDelta.mean`。
4. 实现真正 BiMocq2/forward-backward material map reset/composition；当前 BFECC 只能保小细节，不能保持参考图需要的连续分叉前沿。
5. 如果经纬网格 seam 仍无法消除，按最高优先级规则查找并整理 cubed-sphere/球面流体离散补充论文，再和 Huang 2020 核心假设逐项审核。

## 2026-06-04 standalone Huang clean program

用户要求停止继续接旧 `mvp` 管线，另起一个干净程序，只要最终效果。已新增独立无依赖 Node 程序：

- `artifacts/huang-clean/huang-clean-sim.mjs`
- 输出目录：`artifacts/huang-clean/output/`

本轮实现要点：

- 不再复用旧 `phase/front/foam` 经验反馈路径。
- 主状态为 Huang 2020 对应的球面半厚度 `eta`、表活剂 `Gamma`、切向速度 `uTheta/uPhi`。
- 使用球面经纬网格和 `sin(theta)` 度量项计算散度/梯度/拉普拉斯。
- 使用 great-circle velocity-aligned backtrace 做球面平流。
- 厚度/表活剂平流使用 BFECC 细节保留；这还不是完整 BiMocq2 双映射。
- Gamma 隐式步改为 face-flux 形式 `A x = x - dt div(Gamma*_face beta_face grad x)`，用 matrix-free CG 求解，更接近 Huang projection-like SPD 系统。
- `eta` 用 `eta_t = -eta div(u)` 更新，并做全局质量修正。
- beauty 图由 `2*eta` 光学厚度、视角折射角、Fresnel/谱采样、`|grad eta|` 路径修正和物理派生 foam 场生成；未使用参考图采样、贴图或旧 shader。

最新 512 输出：

- beauty：`artifacts/huang-clean/output/huang-clean-512-spd-v4-beauty.png`
- thickness：`artifacts/huang-clean/output/huang-clean-512-spd-v4-thickness.png`
- divergence：`artifacts/huang-clean/output/huang-clean-512-spd-v4-divergence.png`
- foam：`artifacts/huang-clean/output/huang-clean-512-spd-v4-foam.png`
- diagnostics：`artifacts/huang-clean/output/huang-clean-512-spd-v4-diagnostics.json`

最新诊断：

- `sim=512x512`
- `steps=300`
- `dt=0.0015`
- `cg=36`
- `massError=-4.11e-10`
- `gammaResidual=0.0033796 -> 0.0032335`
- `elapsedMs=273923`

对参考图与 Huang 模型的偏差：

- 相似点：已出现由膜厚/视角导出的黄色、青色、紫粉相位带；厚度场与 beauty 相位带同源；质量守恒稳定；不再依赖旧的视觉反馈。
- 主要偏差：参考图的橙金厚膜岛占比远高于当前结果；参考图有连续青绿分叉河道，当前仍以大尺度球面色带为主；参考图有大量奶金/白色微滴和细丝，当前微结构不足；Gamma residual 在 512 长时状态下降很慢，说明 implicit/projection-like 步还没有达到论文级求解质量。
- 失败原因：当前是 clean CPU 复现核心的第一版，仍用 BFECC 代替完整 BiMocq2 双映射；Gamma 系统虽改为 face-flux SPD 近似，但预条件很弱，高分辨率长时间后收敛不足；经纬网格仍有极区病态，需要更严格 pole handling 或 cubed-sphere。

下一步：

- 实现真正 BiMocq2 backward/forward map，而不是 BFECC 替代。
- 为 Gamma projection-like 系统加更准确的对角/多重网格预条件，要求 512 长时 residual 至少稳定下降一个数量级。
- 加入论文式多光路 soap bubble ray tracing，而不是当前单次薄膜近似。
- 建立 close-up cap 渲染视角，只裁切同一球面模拟结果，不改变物理场，以便和 `soap-film-reference.jpg` 的构图可比。
