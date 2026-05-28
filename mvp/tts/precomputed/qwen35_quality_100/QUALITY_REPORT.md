# Qwen3.5 关闭思考模式文本库质量检查报告

生成文件：`manifest.json`
严格可用文件：`manifest_strict_pass.json`
质量标记文件：`quality_flags.json`

## 总览

- 总 cue 数：100
- 严格通过：81
- 建议人工复核：10
- 建议删除/重生成：9
- 来源统计：{'qwen_generated': 92, 'curated_fallback': 8}
- 阶段统计：{'calm': 20, 'guidance': 18, 'evaluation': 20, 'overload': 27, 'ending': 15}
- LLM：qwen3.5:27b
- 思考模式：Ollama /api/chat think=false + Qwen /no_think

## 结论

这批文本作为“大批量生成测试”合格：数量达到约 100 条，并证明批量候选 + 本地过滤可以稳定运行。作为最终 TTS 入库文本，不建议直接全量使用；推荐先使用 `manifest_strict_pass.json` 中的 81 条，再补生成约 20 条严格通过文本。

## 建议人工复核

- `guidance-04` guidance: Listening becomes your only task here.｜only task 过于任务化
- `guidance-13` guidance: Try not to try.｜fallback，质量可用但非 Qwen 生成
- `guidance-14` guidance: Do less than before.｜fallback，质量可用但非 Qwen 生成
- `guidance-18` guidance: Let the quiet find you.｜fallback，质量可用但非 Qwen 生成
- `evaluation-09` evaluation: Soft approval fills the empty space.｜approval 过度评估感
- `evaluation-11` evaluation: Soft approval settles in the dim air.｜approval 过度评估感
- `overload-13` overload: The loop closes without asking you.｜loop closes without asking you 控制感偏强，可作为 overload 备选
- `overload-26` overload: Keep the quiet shape.｜fallback，控制感偏强
- `overload-27` overload: Do not solve this.｜fallback，命令感偏强
- `ending-02` ending: Your rule ends at the door.｜your rule ends 语义稍别扭

## 建议删除或重生成

- `calm-19` calm: The system rests in peace.｜rests in peace 有死亡/陈词联想
- `guidance-15` guidance: Keep almost still.｜Keep almost still 是身体指令
- `guidance-16` guidance: Let the breath arrive.｜Let the breath arrive 是真实呼吸指令风险
- `guidance-17` guidance: Stay where you are.｜Stay where you are 是身体/行动指令
- `evaluation-04` evaluation: Your stillness passes the quiet test.｜stillness + quiet test 过度评估且身体化
- `evaluation-16` evaluation: Your stillness meets the gentle rule.｜your stillness 身体化
- `overload-09` overload: The pattern breathes a slow rhythm.｜pattern breathes 容易回到呼吸语义
- `ending-09` ending: Your release is written in the air.｜written in the air 陈词感
- `ending-12` ending: The door stands open for your step.｜your step 暗示身体行动

## 已反写到生成器的改进

- 删除有风险的 fallback：`Let the breath arrive`、`Keep almost still`、`Stay where you are`、`Do not solve this`。
- 增加过滤词：`breath`、`breathes`、`breathing`、`stillness`、`approval`、`test`、`task`、`step`。
- 增加禁句：`rests in peace`、`written in the air`、`only task`、`quiet test` 等。

## 补生成后的最终入库版本

- 最终文件：`manifest_final_100.json`
- 最终 cue 数：99
- 文本来源：99 条均为 `qwen_generated`
- 质量来源：76 条来自第一批严格通过，23 条来自补生成严格通过
- 自动检查：禁词、禁句、真实呼吸/身体指令、`<think>`、重复文本均为 0
- 阶段分布：calm 21，guidance 15，evaluation 20，overload 28，ending 15

结论：`manifest_final_100.json` 可以作为当前 Qwen3.5 关闭思考模式后的高质量文本库，进入 Qwen3-TTS 预生成音频阶段。
