"use client";

import { KeyboardEvent, useEffect, useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };

export default function Chat() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content: "Hey Maya from Meridian. What do you need?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const next: Msg[] = [...messages, { role: "user", content: input }];
    setMessages(next);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      setMessages([
        ...next,
        {
          role: "assistant",
          content: data.message ?? "Got an empty response.",
        },
      ]);
    } catch {
      setMessages([
        ...next,
        { role: "assistant", content: "Request didn't go through." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const onKey = (e: KeyboardEvent) =>
    e.key === "Enter" && !e.shiftKey && send();

  return (
    <main className="flex flex-col h-screen bg-slate-50 text-gray-900">
      <header className="bg-white border-b px-6 py-4 flex items-center gap-3 shadow-sm">
        <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
          M
        </div>
        <div>
          <p className="font-semibold text-gray-900 text-sm">
            Meridian Electronics
          </p>
          <p className="text-xs text-gray-500">support</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto py-6 px-4">
        <div className="max-w-2xl mx-auto space-y-4">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-sm md:max-w-lg px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                  m.role === "user"
                    ? "bg-blue-600 text-white rounded-br-none"
                    : "bg-white text-gray-800 shadow-sm border rounded-bl-none"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-white border shadow-sm px-4 py-3 rounded-2xl rounded-bl-none flex gap-1 items-center">
                {[0, 150, 300].map((d) => (
                  <span
                    key={d}
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: `${d}ms` }}
                  />
                ))}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="bg-white border-t px-4 py-4">
        <div className="max-w-2xl mx-auto flex gap-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKey}
            placeholder="Type a message…"
            disabled={loading}
            className="flex-1 min-h-[44px] rounded-full border border-gray-300 bg-white px-4 py-2.5 text-base text-gray-900 caret-blue-600 shadow-sm placeholder:text-gray-600 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:bg-gray-100 disabled:text-gray-500"
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-medium px-5 py-2.5 rounded-full transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </main>
  );
}
