# Meridian Electronics — support chatbot

Customer-facing chat for **Meridian Electronics**: stock and catalog questions, order flows, and account-sensitive actions driven by **live MCP tools** (not static copy). All secrets and provider keys stay **server-side**; the browser only calls `POST /api/chat` on the same origin.

---

## Platform architecture

```mermaid
flowchart TB
  subgraph Browser
    UI["React UI\napp/page.tsx"]
  end

  subgraph Vercel["Next.js on Vercel"]
    API["Route handler\nPOST /api/chat"]
    LIB["Server modules\nfrontend/lib/*"]
  end

  subgraph Providers
    OR["OpenRouter\nchat completions + tools"]
    MCP["MCP server\nStreamable HTTP\nMCP_URL"]
  end

  UI -->|"JSON { messages }"| API
  API --> LIB
  LIB -->|"HTTPS + API key"| OR
  LIB -->|"MCP client\ntimeouts + retries"| MCP
```

---

## Chat request lifecycle (`POST /api/chat`)

```mermaid
sequenceDiagram
  autonumber
  participant B as Browser
  participant R as Next route
  participant G as Guardrails
  participant C as MCP client
  participant S as MCP server
  participant L as OpenRouter

  B->>R: POST /api/chat
  R->>G: checkInput(last user message)
  alt guardrail fail
    G-->>R: block reason
    R-->>B: 200 JSON message
  else continue
    R->>C: connect MCP transport
    C->>S: streamable HTTP session
    S-->>C: session OK
    R->>C: listTools
    S-->>C: tool definitions
    loop until finish_reason != tool_calls
      R->>L: chat.completions messages + tools
      L-->>R: assistant message optional tool_calls
      R->>C: callTool per request
      C->>S: tool execution
      S-->>C: structured result
      R->>L: next turn with tool role messages
    end
    R->>G: checkOutput(assistant text)
    R-->>B: 200 JSON message
  end
```

---

## Resilience

**Model routing** (`frontend/lib/ai.ts`): ordered model list; on `404` / `429` / `500` / `503`, advance to the next model before failing the request.

**MCP session** (`frontend/lib/mcp.ts`): connect retries, per-session wall clock (`MCP_SESSION_TIMEOUT_MS`, default 55s), aligns with `maxDuration` on the route.

**MCP circuit breaker** (`frontend/lib/circuit-breaker.ts`):

```mermaid
stateDiagram-v2
  direction LR
  [*] --> Closed
  Closed --> Open: failures >= 3
  Open --> HalfOpen: after 15s cooldown
  HalfOpen --> Closed: next call succeeds
  HalfOpen --> Open: failure before success
```

---

## Tech stack

| Layer | Technology |
|--------|------------|
| UI | React 19, Next.js 16 App Router, Tailwind CSS 4 |
| API | Route handlers only; no browser exposure of keys |
| LLM | OpenRouter (`OPENROUTER_BASE_URL`), OpenAI-compatible client |
| Tools | `@modelcontextprotocol/sdk` streamable HTTP to `MCP_URL` |
| Safety | Input/output guardrails, structured JSON logs |
| Deploy | Vercel (`vercel.json`), Docker / HF Space (`Dockerfile`) |

---

## Repository layout

```
frontend/
  app/
    page.tsx              # Chat UI (client)
    api/chat/route.ts     # Single POST entrypoint
  lib/
    ai.ts                 # OpenRouter chat + model fallback
    mcp.ts                # MCP connect, session timeout, withMCP helper
    guardrails.ts         # Pre/post message checks
    logger.ts             # JSON lines logging
    circuit-breaker.ts    # MCP failure circuit
    prompts.ts            # System prompt
backend/                  # Standalone Node package (same concepts; not wired into Next imports)
```

---

## Local setup

```bash
git clone https://github.com/solarinayo/meridian-support-chatbot.git
cd meridian-support-chatbot
npm install --prefix frontend
cp frontend/.env.example frontend/.env.local
# set MCP_URL, OPENROUTER_BASE_URL, OPENROUTER_API_KEY in frontend/.env.local
npm run dev
```

`npm run dev` runs `next dev --webpack` inside `frontend/`.

---

## Deploy

| Target | Notes |
|--------|--------|
| **Vercel** | Project root can be repo root or `frontend/`; set env vars to match `.env.example`. See `vercel.json` for install/build overrides if needed. |
| **Docker / HF** | Repo-root `Dockerfile`; pass the same env vars; default listen `7860`. |

---

Built by Ayomide Solarinayo.
