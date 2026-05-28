const { OLLAMA_HOST, QWEN_MODEL } = require("../config");

function cleanSentence(text) {
  return String(text || "")
    .replace(/^[\s"'`]+|[\s"'`]+$/g, "")
    .replace(/\s+/g, " ")
    .replace(/^(assistant|sentence|output)\s*:\s*/i, "")
    .trim();
}

function isUsableSentence(text) {
  const sentence = cleanSentence(text);
  const words = sentence.split(/\s+/).filter(Boolean);
  if (words.length < 3 || words.length > 10) return false;
  if (/[0-9]/.test(sentence)) return false;
  if (/(baseline|score|error|detected|metrics?|stage|pressure|technical)/i.test(sentence)) return false;
  if (/(heart|pulse|racing|diagnos|medical|symptom|anxiety|panic)/i.test(sentence)) return false;
  if (/(breath|breathing|breathe|inhale|exhale|stillness|approval|test|task)/i.test(sentence)) return false;
  if (/(walk|walking|step|steps|move|moving|dance|stand|standing)/i.test(sentence)) return false;
  if (/(hold your breath|control your breath|perfectly still|do not solve this|rests in peace|written in the air)/i.test(sentence)) return false;
  return true;
}

function buildPromptSummary(body) {
  const pressure = Number(body.pressure || 0);
  const metrics = body.metrics || {};
  const breathRate = Number(metrics.breathRate || 0);
  const breathingStability = Number(metrics.breathingStability ?? 0.7);
  const cardiacArousal = Number(metrics.cardiacArousal || 0);
  return {
    stage: String(body.stage || "calm"),
    pressure: pressure > 0.66 ? "high" : pressure > 0.28 ? "medium" : "low",
    pulseRate: Number(body.visual?.pulseRate || 0).toFixed(2),
    jitter: Number(body.visual?.jitter || 0).toFixed(2),
    drift: Number(body.visual?.drift || 0).toFixed(2),
    breathing: breathingStability > 0.72 ? "steady" : breathingStability > 0.42 ? "uneven" : "strained",
    tempo: cardiacArousal > 0.66 || breathRate > 16 ? "tight" : cardiacArousal > 0.32 ? "alert" : "soft",
  };
}

function buildPrompt(summary) {
  return [
    "You are a calm sleep assistant in a performance.",
    "Write exactly one short English sentence.",
    "3 to 9 words only.",
    "No numbers. No labels. No quotes.",
    "Do not mention data, baseline, score, error, metrics, stage, or detection.",
    "Do not mention heart, pulse, symptoms, panic, diagnosis, or medical states.",
    "Do not mention walking, steps, dancing, standing, or movement.",
    "The line should feel sparse, slow, and breath-paced.",
    "As pressure rises, add restraint without sounding urgent.",
    "",
    `stage: ${summary.stage}`,
    `pressure: ${summary.pressure}`,
    `pulseRate: ${summary.pulseRate}`,
    `jitter: ${summary.jitter}`,
    `drift: ${summary.drift}`,
    `breathing: ${summary.breathing}`,
    `bodyTempo: ${summary.tempo}`,
  ].join("\n");
}

async function generateWithQwen(prompt) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);
  try {
    const response = await fetch(`${OLLAMA_HOST}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: QWEN_MODEL,
        messages: [
          {
            role: "system",
            content: "Answer only with the final sentence. Do not include reasoning, labels, or explanations. /no_think",
          },
          { role: "user", content: `${prompt}\n/no_think` },
        ],
        stream: false,
        think: false,
        options: {
          temperature: 0.7,
          top_p: 0.8,
          top_k: 20,
          num_predict: 24,
          stop: ["\n"],
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama ${response.status}: ${errorText.slice(0, 160)}`);
    }

    const data = await response.json();
    return cleanSentence(data.message?.content || "");
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  cleanSentence,
  isUsableSentence,
  buildPromptSummary,
  buildPrompt,
  generateWithQwen,
};
