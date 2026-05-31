# Soap Film Physics Handoff

更新时间：2026-05-31

## 用户的明确需求
- 目标不是“模仿参考图”，而是用真实物理算法模拟肥皂泡/肥皂膜表面液滴导致的膜厚不均。
- 色彩必须由膜厚、视角、曲率、表活剂、泡沫/微滴等物理场推导出薄膜干涉色。
- active path 绝对不能采样照片、参考图、预烘焙纹理或 canvas 图案；参考图只可作为人工对照。
- 现在可以先不在乎性能，允许高分辨率、多子步、预热、延迟渲染；先把物理质感做出来，再优化。
- 必须全程中文沟通。

## 本轮已停止的运行状态
- 已停止 `127.0.0.1:4173` 上的本地 Node 服务。
- 已清理本轮产生的 headless Chrome 临时测试进程。
- 当前机器没有配置 Git remote，`git remote -v` 为空。
- 当前机器没有 `gh` CLI，因此不能走 GitHub PR/CLI 发布流程。

## 当前代码改动概览
- `mvp/src/visual/thinFilmSim.js`
  - 从单一贴图式状态升级为 GPU ping-pong 多场模拟。
  - 当前字段含义：
    - `field.r = h` 膜厚
    - `field.g = surfactant / Gamma` 表活剂浓度
    - `field.b = foam` 泡沫/微滴密度
    - `field.a = dye / phase` 相场或薄区状态
    - `velocity.rg = vx/vy` 切向速度
  - 加入了 velocity step、divergence pass、Jacobi pressure projection、velocity projection、field step。
  - 已修复一个关键 shader 问题：`FIELD_STEP_FRAGMENT_SHADER` 使用二阶/对角采样但未定义；现在已补齐。
  - 已删除 active 初始场里明显手画参考图河道的 `wavyRiver/branchRiver/ellipsoid/capsuleDistance` 路径。
  - 仍保留程序化 noise 作为初始微扰和源项，这符合目标文件中的允许范围，但后续要继续降低“像图案”的成分。

- `mvp/src/visual/logoScene.js`
  - active physical path 不再使用 `TextureLoader` 或 `uReferenceFilmMap`。
  - 旧内核曲线仍保留代码但默认不渲染。
  - beauty shader 已大幅移除原先的 `marbleField/grain/cellFoamDot/bubbleUv` 一类直接画图案逻辑。
  - 新增/调整了 debug view：
    - `beauty`
    - `solid`
    - `thickness`
    - `velocity`
    - `surfactant`
    - `phase`
    - `foam`
  - 新增临时运行时调试对象 `window.__soapFilmDebug`，用于确认 `initLogo3d/updateLogo3d` 是否执行、渲染次数、相机和壳层状态。
  - 注意：这只是临时诊断钩子，不是最终产品 API。

- `mvp/src/config/controlSchema.js`
  - 暴露更高成本的物理参数默认值：
    - `filmSimResolution = 384`
    - `filmSubsteps = 8`
    - `filmPressureIterations = 56`
    - `filmPrewarmSteps = 96`
  - `filmSubsteps` 上限提高到 24，`filmPressureIterations` 上限提高到 96，`filmPrewarmSteps` 上限提高到 480。
  - 增加 `solid` 和 `phase` debug view 选项。

- `mvp/src/main.js`
  - URL 参数现在可以覆盖 `CONTROL_PARAMS` 中的控制项。
  - 示例：
    - `?view=macro&live=1&forceVisuals=1&filmDebugView=thickness`
    - `?filmSubsteps=1&filmPrewarmSteps=0&filmPressureIterations=4&filmSimResolution=128`

- `artifacts/targets/soap-film-target.md`
  - 已加入最新硬要求：真实物理算法优先，性能可先让步，不能用贴图或参考图拟合。

## 已通过的静态检查
运行过并通过：

```bash
node --check mvp/src/visual/thinFilmSim.js
node --check mvp/src/visual/logoScene.js
node --check mvp/src/config/controlSchema.js
node --check mvp/src/main.js
```

## 当前未解决的问题
这是最重要的交接点：当前还没有达到可验收效果，甚至还没有通过“纯色壳层可见”诊断。

最新调试结果：
- 用 `filmDebugView=solid` 截图，画面仍然接近黑屏，只看到右上角“控制台”按钮。
- 这说明当前问题不在“膜厚图案是否真实”，而在更底层：
  - `initLogo3d()` 可能没有真正执行；
  - `updateLogo3d()` 可能没有进入 render；
  - WebGL/headless 环境可能没真正画出透明 canvas；
  - shader 运行时可能有浏览器端错误但没有被现有日志捕获；
  - 或者壳层几何/材质 alpha/相机/front-face 判断导致全被 discard。
- 在 in-app browser 中读 `window.__soapFilmDebug` 得到 `null`，进一步说明要先确认模块脚本是否执行到 `logoScene.js` 的初始化钩子。

相关调试截图：
- `artifacts/soap-film-runs/run-41-debug-solid.png`
- `artifacts/soap-film-runs/run-42-debug-solid-after-restart.png`

这些截图没有提交，避免把大量临时图片推入仓库；本文件记录了结论。

## 下一步计划
1. 先恢复最小可见性，而不是继续调颜色。
   - 打开：
     `http://127.0.0.1:4173/?view=wide&live=1&forceVisuals=1&filmDebugView=solid&filmSubsteps=1&filmPrewarmSteps=0&filmPressureIterations=4&filmSimResolution=128`
   - 在浏览器控制台检查：
     `window.__soapFilmDebug`
   - 如果仍为 `null`，先查 `main.js` 是否加载、是否有 module import/runtime error。
   - 如果 `renderCount` 增长但画面黑，先把 glass shader 临时改成完全不透明纯红、关闭 discard/frontMask、关闭 transparent/depth 影响，确认几何和相机。

2. `solid` 可见后，再看物理场。
   - `filmDebugView=thickness`
   - `filmDebugView=phase`
   - `filmDebugView=velocity`
   - `filmDebugView=foam`
   - 目标不是美观，而是确认字段有空间变化、会随时间演化、没有被数值耗散成平板。

3. 物理场可见后，再继续真实物理模型。
   - 按子 agent 给出的建议，把薄膜方程明确化：
     - `gamma = gamma0 * (1 - beta * Gamma) + gammaC * c`
     - `p = -gamma * laplacian(h) - Pi(h) + rho * g_n * h`
     - `q = -(h^3 / 3mu) * grad(p) + (h^2 / 2mu) * grad(gamma) + tangentGravity`
     - `dh/dt = -div(q) + source - evaporation`
   - 当前代码已经往这个方向改，但还不是严格的保守通量实现。
   - 毛细项含四阶导数，显式更新容易炸或被迫很小；后续应改成半隐式 Jacobi/Gauss-Seidel 或更多子步。

4. 颜色只做薄膜干涉，不再画图案。
   - 当前 `thinFilmRgb()` 已从简单余弦三通道改成 12 波长近似谱积分。
   - 后续应继续靠 `h`、`cos(theta)`、`grad(h)` 改光学法线，而不是用 noise 生成纹理。

5. 性能最后处理。
   - 先允许 `384/512`、`8-24` 子步、几十次压力迭代。
   - 等视觉成立后，再恢复“不可见标签页暂停渲染”的节能逻辑和默认低成本配置。

## 推荐运行命令
启动：

```bash
/Users/if_man/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node mvp/server/index.js
```

打开：

```text
http://127.0.0.1:4173/?view=wide&live=1&forceVisuals=1&filmDebugView=solid&filmSubsteps=1&filmPrewarmSteps=0&filmPressureIterations=4&filmSimResolution=128
```

检查：

```bash
node --check mvp/src/visual/thinFilmSim.js
node --check mvp/src/visual/logoScene.js
node --check mvp/src/config/controlSchema.js
node --check mvp/src/main.js
```

停止服务：

```bash
lsof -tiTCP:4173 -sTCP:LISTEN | xargs kill
```

## 重要提醒
- 不要再从参考图采样。
- 不要用一张程序化彩色纹理扭曲来假装物理。
- 先让 `solid` 可见，再看 `thickness/phase/velocity/foam`，最后才谈 beauty。
- 如果下一台机器 GPU/WebGL 表现不同，先以浏览器控制台和 `window.__soapFilmDebug` 为准。
