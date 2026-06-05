import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

function parseArgs(argv) {
  const args = {
    cache: "artifacts/realtime-soap/cache/gravity_fig14_like",
    outDir: "artifacts/realtime-soap/runs/RT-scan-latest",
    physics: "256x512",
    render: 2048,
    seconds: 5,
    fpsTarget: 24,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const [key, raw] = arg.slice(2).split("=");
    const value = raw ?? argv[++i];
    if (key in args) args[key] = value;
  }
  return args;
}

function runCase(args, item) {
  const outDir = path.join(args.outDir, item.name);
  const cmd = [
    "artifacts/realtime-soap/realtime-soap.mjs",
    "--mode=benchmark",
    `--physics=${args.physics}`,
    `--render=${args.render}`,
    `--fpsTarget=${args.fpsTarget}`,
    `--seconds=${args.seconds}`,
    `--cache=${args.cache}`,
    `--outDir=${outDir}`,
    ...item.flags,
  ];
  const t0 = performance.now();
  const result = spawnSync(process.execPath, cmd, { encoding: "utf8" });
  const elapsedMs = performance.now() - t0;
  if (result.status !== 0) {
    return {
      name: item.name,
      ok: false,
      elapsedMs,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  }
  const performanceReport = JSON.parse(fs.readFileSync(path.join(outDir, "performance.json"), "utf8"));
  const diagnostics = JSON.parse(fs.readFileSync(path.join(outDir, "diagnostics.json"), "utf8"));
  return {
    name: item.name,
    ok: true,
    elapsedMs,
    outDir,
    flags: item.flags,
    performance: performanceReport,
    eta: diagnostics.eta,
    Gamma: diagnostics.Gamma,
    velocity: diagnostics.velocity,
    front: diagnostics.front,
    foam: diagnostics.foam,
  };
}

function main() {
  const args = parseArgs(process.argv);
  fs.mkdirSync(args.outDir, { recursive: true });
  const cases = [
    { name: "baseline", flags: [] },
    { name: "low-cache-free", flags: ["--cacheBlend=0.48", "--renderCacheBlend=0.52", "--disturbanceStrength=0.28"] },
    { name: "high-cache-stable", flags: ["--cacheBlend=0.90", "--renderCacheBlend=0.86", "--disturbanceStrength=0.08"] },
    { name: "strong-disturbance", flags: ["--disturbanceStrength=0.90", "--disturbanceU=0.35", "--disturbanceV=0.45", "--cacheBlend=0.68"] },
    { name: "strong-air-marangoni", flags: ["--airSpeed=1.20", "--airDirection=75", "--marangoni=1.10", "--disturbanceStrength=0.20"] },
    { name: "low-diffusion-crisp", flags: ["--diffusion=0.004", "--viscosity=0.18", "--renderCacheBlend=0.82"] },
  ];
  const results = cases.map((item) => runCase(args, item));
  const summary = {
    kind: "realtime-soap-parameter-scan",
    cache: args.cache,
    physics: args.physics,
    render: Number(args.render),
    seconds: Number(args.seconds),
    fpsTarget: Number(args.fpsTarget),
    results,
  };
  fs.writeFileSync(path.join(args.outDir, "scan-summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  const lines = [
    "# Realtime Soap Parameter Scan",
    "",
    `Cache: \`${args.cache}\``,
    "",
    "| case | ok | fps | p95 ms | eta max | velocity mean | output |",
    "| --- | --- | ---: | ---: | ---: | ---: | --- |",
  ];
  for (const r of results) {
    if (!r.ok) {
      lines.push(`| ${r.name} | no | | | | | |`);
      continue;
    }
    lines.push(`| ${r.name} | yes | ${r.performance.avgPhysicsFps.toFixed(2)} | ${r.performance.p95PhysicsFrameMs.toFixed(2)} | ${r.eta.max.toFixed(3)} | ${r.velocity.mean.toFixed(3)} | \`${r.outDir}\` |`);
  }
  fs.writeFileSync(path.join(args.outDir, "scan-summary.md"), `${lines.join("\n")}\n`, "utf8");
  console.log(`[parameter-scan] wrote ${args.outDir}`);
}

main();
