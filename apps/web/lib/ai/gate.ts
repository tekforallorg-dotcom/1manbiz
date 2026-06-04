export type AiMode = "off" | "assisted" | "semi" | "autonomous";

/**
 * The autonomy gate. Returns true only when ALL hold:
 *   - the business opted into full autonomy (ai_mode = 'autonomous'),
 *   - the message is inside the 24h customer-service window (free-form allowed),
 *   - the AI is confident its answer is fully grounded in the catalog.
 * Every other case degrades safely to "do not auto-send" -- the vendor handles
 * it manually. This is the single decision point for autonomous sending.
 */
export function shouldAutoSend(args: {
  mode: AiMode;
  windowOpen: boolean;
  confidence: "high" | "low";
}): boolean {
  return args.mode === "autonomous" && args.windowOpen && args.confidence === "high";
}
