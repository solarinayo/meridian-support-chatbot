type Level = "info" | "warn" | "error";

interface LogEntry {
  level: Level;
  event: string;
  durationMs?: number;
  error?: string;
  meta?: Record<string, unknown>;
}

export function log(entry: LogEntry) {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...entry });
  entry.level === "error" ? console.error(line) : console.log(line);
}

export function timer() {
  const start = Date.now();
  return () => Date.now() - start;
}
