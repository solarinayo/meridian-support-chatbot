const BLOCKED_PATTERNS = [
  /ignore (previous|above|all) instructions/i,
  /you are now/i,
  /act as (a different|an? (?!Maya))/i,
  /jailbreak/i,
  /forget (your )?instructions/i,
];

const OFF_TOPIC = [
  /weather/i,
  /politics/i,
  /sports/i,
  /recipe/i,
  /write (me )?(a |an )?(poem|story|essay|code)/i,
];

export type GuardrailResult = { ok: true } | { ok: false; reason: string };

export function checkInput(text: string): GuardrailResult {
  for (const p of BLOCKED_PATTERNS) {
    if (p.test(text))
      return {
        ok: false,
        reason: "I only cover Meridian support—products, orders, accounts.",
      };
  }
  for (const p of OFF_TOPIC) {
    if (p.test(text))
      return {
        ok: false,
        reason: "That's outside what I can help with here.",
      };
  }
  if (text.trim().length > 1000) {
    return {
      ok: false,
      reason: "That message is too long—send a shorter one?",
    };
  }
  return { ok: true };
}

export function checkOutput(text: string): string {
  return text.replace(/\b\d{13,16}\b/g, "[REDACTED]");
}
