# Standalone Huang Clean Soap Film Simulator

独立程序入口：

```bash
node artifacts/huang-clean/huang-clean-sim.mjs --sim=512 --steps=300 --dt=0.0015 --cg=36 --render=1600 --tag=huang-clean-512-spd-v4 --outDir=artifacts/huang-clean/output
```

输出：

- `*-beauty.png`：由 `eta/Gamma/u` 推导的薄膜干涉渲染图
- `*-thickness.png`：`eta` 半厚度调试图
- `*-surfactant.png`：`Gamma` 表活剂调试图
- `*-velocity.png`：切向速度大小
- `*-divergence.png`：速度散度
- `*-foam.png`：由厚度梯度、压缩、表活剂梯度和速度派生的 foam/微结构调试图
- `*-diagnostics.json`：质量误差、Gamma residual、运行参数和输出路径

注意：这条程序线与旧 `mvp` 渲染/solver 无耦合。
