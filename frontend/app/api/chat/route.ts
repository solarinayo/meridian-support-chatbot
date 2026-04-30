import { chat, type ChatCompletionMessageParam } from "@/lib/ai";
import { checkInput, checkOutput } from "@/lib/guardrails";
import { log, timer } from "@/lib/logger";
import { withMCP } from "@/lib/mcp";
import { SYSTEM_PROMPT } from "@/lib/prompts";
import { NextRequest } from "next/server";

/** Align with MCP session budget so the platform does not kill the handler first. */
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const elapsed = timer();
  const { messages } = await req.json();
  const lastUserMsg =
    [...messages].reverse().find((m: { role: string }) => m.role === "user")
      ?.content ?? "";

  const guard = checkInput(lastUserMsg);
  if (!guard.ok) {
    log({
      level: "warn",
      event: "guardrail_blocked",
      meta: { reason: guard.reason },
    });
    return Response.json({ message: guard.reason });
  }

  try {
    return await withMCP(async (client) => {
      const { tools } = await client.listTools();

      const openaiTools = tools.map((t) => ({
        type: "function" as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: t.inputSchema,
        },
      }));

      const msgs: ChatCompletionMessageParam[] = [
        { role: "system", content: SYSTEM_PROMPT },
        ...messages,
      ];

      let res = await chat({
        messages: msgs,
        tools: openaiTools,
      });
      let toolCallCount = 0;

      while (res.choices[0].finish_reason === "tool_calls") {
        const { message } = res.choices[0];
        msgs.push(message);
        toolCallCount++;

        const calls = message.tool_calls ?? [];
        const functionCalls = calls.filter(
          (tc): tc is Extract<(typeof calls)[number], { type: "function" }> =>
            tc.type === "function",
        );

        const toolMessages = await Promise.all(
          functionCalls.map(async (tc) => {
            const callTimer = timer();
            try {
              const result = await client.callTool({
                name: tc.function.name,
                arguments: JSON.parse(tc.function.arguments),
              });
              const content = (
                result.content as { type: string; text?: string }[]
              )
                .map((c) => (c.type === "text" ? c.text : JSON.stringify(c)))
                .join("\n");

              log({
                level: "info",
                event: "tool_call",
                durationMs: callTimer(),
                meta: { tool: tc.function.name },
              });

              return {
                role: "tool" as const,
                tool_call_id: tc.id,
                content: content || "done",
              };
            } catch (err) {
              log({
                level: "error",
                event: "tool_error",
                meta: { tool: tc.function.name, err: String(err) },
              });
              return {
                role: "tool" as const,
                tool_call_id: tc.id,
                content: "Tool error—ask user to retry.",
              };
            }
          }),
        );

        for (const tm of toolMessages) {
          msgs.push(tm);
        }

        res = await chat({
          messages: msgs,
          tools: openaiTools,
        });
      }

      const raw = res.choices[0].message.content ?? "Empty reply—try again.";
      const reply = checkOutput(raw);

      log({
        level: "info",
        event: "chat_done",
        durationMs: elapsed(),
        meta: { toolCalls: toolCallCount, tokens: res.usage?.total_tokens },
      });

      return Response.json({ message: reply });
    });
  } catch (err) {
    log({
      level: "error",
      event: "request_failed",
      durationMs: elapsed(),
      error: String(err),
    });

    const isTimeout = String(err).includes("timed out");
    return Response.json(
      {
        message: isTimeout
          ? "Timed out—try again."
          : "Server hiccup—try again.",
      },
      { status: 500 },
    );
  }
}
