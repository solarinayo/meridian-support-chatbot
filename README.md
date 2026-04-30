# Meridian support chatbot

Next app lives in **`frontend/`** (pages + `app/api`). Shared server code is **`backend/`** (MCP, OpenRouter, guardrails). Nothing in `backend/` ships to the browser; env vars hold URLs and keys.

```bash
npm run dev
```

Same as `cd frontend && npm run dev`.

Env: copy `frontend/.env.example` → `frontend/.env.local`. You need `MCP_URL`, `OPENROUTER_BASE_URL`, and `OPENROUTER_API_KEY`. The UI only hits `/api/chat` on the same host.

**Vercel:** repo root `./`, env vars as in `.env.example`. See `vercel.json`.

**HF Space (Docker):** root `Dockerfile`, build context = repo root, set the same vars in the Space settings. Listens on `7860`.
