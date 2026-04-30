import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { mcpBreaker } from "./circuit-breaker";
import { log, timer } from "./logger";

function mcpUrl(): string {
  const u = process.env.MCP_URL?.trim();
  if (!u) throw new Error("MCP_URL is not set");
  try {
    new URL(u);
  } catch {
    throw new Error(
      "MCP_URL must be a full URL (e.g. https://host/mcp). Check for a typo like MCP_URL=MCP_SERVER_URL=... in .env.local.",
    );
  }
  return u;
}

const CONNECT_TIMEOUT = 10_000;
/** Budget for listTools + all LLM turns + tool calls in one HTTP request. */
const CALL_TIMEOUT = Number(
  process.env.MCP_SESSION_TIMEOUT_MS?.trim() || "",
) || 55_000;
const MAX_RETRIES = 3;

async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms),
  );
  return Promise.race([promise, timeout]);
}

async function connect(client: Client): Promise<void> {
  const url = mcpUrl();
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const transport = new StreamableHTTPClientTransport(new URL(url));
      await withTimeout(
        client.connect(transport),
        CONNECT_TIMEOUT,
        "MCP connect",
      );
      return;
    } catch (err) {
      log({
        level: "warn",
        event: "mcp_connect_failed",
        meta: { attempt, err: String(err) },
      });
      if (attempt === MAX_RETRIES) throw err;
      await new Promise((r) => setTimeout(r, 500 * attempt));
    }
  }
}

export async function withMCP<T>(
  fn: (client: Client) => Promise<T>,
): Promise<T> {
  if (mcpBreaker.isOpen()) {
    log({ level: "warn", event: "mcp_circuit_open" });
    throw new Error("MCP circuit open");
  }

  const elapsed = timer();
  const client = new Client({ name: "meridian-chat", version: "1.0.0" });

  try {
    await connect(client);
    const result = await withTimeout(fn(client), CALL_TIMEOUT, "MCP call");
    mcpBreaker.success();
    log({ level: "info", event: "mcp_ok", durationMs: elapsed() });
    return result;
  } catch (err) {
    mcpBreaker.failure();
    log({
      level: "error",
      event: "mcp_error",
      durationMs: elapsed(),
      meta: { state: mcpBreaker.getState() },
      error: String(err),
    });
    throw err;
  } finally {
    await client.close().catch(() => {});
  }
}
