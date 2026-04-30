import OpenAI from "openai";
import { log, timer } from "./logger";

export type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

function client(): OpenAI {
  const baseURL = process.env.OPENROUTER_BASE_URL?.trim();
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!baseURL) throw new Error("OPENROUTER_BASE_URL is not set");
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");
  return new OpenAI({ baseURL, apiKey });
}

const MODELS = [
  "google/gemini-2.5-flash",
  "openai/gpt-4o-mini",
  "anthropic/claude-haiku-4-5",
];

type ChatParams = Omit<
  OpenAI.Chat.ChatCompletionCreateParamsNonStreaming,
  "model"
>;

export async function chat(
  params: ChatParams,
): Promise<OpenAI.Chat.ChatCompletion> {
  const ai = client();
  for (const model of MODELS) {
    const elapsed = timer();
    try {
      const res = await ai.chat.completions.create({ ...params, model });
      log({
        level: "info",
        event: "ai_ok",
        durationMs: elapsed(),
        meta: { model },
      });
      return res;
    } catch (err: unknown) {
      const status = (err as { status?: number }).status;
      log({
        level: "warn",
        event: "ai_retry",
        durationMs: elapsed(),
        meta: { model, status },
      });
      // 404 = model removed/renamed on OpenRouter; fall through to next model.
      if (
        status !== 404 &&
        status !== 429 &&
        status !== 500 &&
        status !== 503
      )
        throw err;
      if (model === MODELS.at(-1)) throw err;
    }
  }
  throw new Error("all models failed");
}
