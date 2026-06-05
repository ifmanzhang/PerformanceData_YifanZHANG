# Realtime Soap Parameter Scan

Cache: `artifacts/realtime-soap/cache/gravity_fig14_like_temporal32_soft`

| case | ok | fps | p95 ms | eta max | velocity mean | output |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| baseline | yes | 33.25 | 31.42 | 0.421 | 0.047 | `artifacts\realtime-soap\runs\RT-scan-temporal32-soft-v1\baseline` |
| low-cache-free | yes | 32.86 | 33.55 | 0.533 | 0.063 | `artifacts\realtime-soap\runs\RT-scan-temporal32-soft-v1\low-cache-free` |
| high-cache-stable | yes | 32.98 | 36.80 | 0.393 | 0.046 | `artifacts\realtime-soap\runs\RT-scan-temporal32-soft-v1\high-cache-stable` |
| strong-disturbance | yes | 32.75 | 33.46 | 0.567 | 0.070 | `artifacts\realtime-soap\runs\RT-scan-temporal32-soft-v1\strong-disturbance` |
| strong-air-marangoni | yes | 32.99 | 33.73 | 0.427 | 0.067 | `artifacts\realtime-soap\runs\RT-scan-temporal32-soft-v1\strong-air-marangoni` |
| low-diffusion-crisp | yes | 31.75 | 35.75 | 0.420 | 0.049 | `artifacts\realtime-soap\runs\RT-scan-temporal32-soft-v1\low-diffusion-crisp` |
