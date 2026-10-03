// Event types that trigger the bell, comma-separated. Defaults to all three.
const DEFAULT_EVENTS = "permission.asked,session.idle,session.error"
// Empty string or whitespace-only also falls back to defaults
const rawEvents = process.env.OPENCODE_BELL_EVENTS || DEFAULT_EVENTS
const parsed = rawEvents.split(",").map((s) => s.trim()).filter(Boolean)
const ENABLED_EVENTS = new Set(parsed.length > 0 ? parsed : DEFAULT_EVENTS.split(","))

// Output methods, comma-separated. Defaults to the original BEL-only behavior.
const DEFAULT_OUTPUTS = "bell"
const rawOutputs = process.env.OPENCODE_BELL_OUTPUTS || DEFAULT_OUTPUTS
const parsedOutputs = rawOutputs.split(",").map((s) => s.trim()).filter(Boolean)
const ENABLED_OUTPUTS = new Set(parsedOutputs.length > 0 ? parsedOutputs : DEFAULT_OUTPUTS.split(","))

// Debounce window in ms. Falls back to 1200 if NaN, negative, or zero.
const parsedDebounce = parseInt(process.env.OPENCODE_BELL_DEBOUNCE, 10)
const DEBOUNCE_MS = parsedDebounce > 0 ? parsedDebounce : 1200

/**
 * OpencodeBellPlugin — OpenCode plugin factory.
 * Listens for configured events and writes ASCII BEL to the terminal.
 * Same key only rings once within the debounce window.
 */
export const OpencodeBellPlugin = async () => {
  const bell = "\x07"
  const messages = {
    "permission.asked": "OpenCode permission requested",
    "session.idle": "OpenCode session idle",
    "session.error": "OpenCode session error",
  }
  // Map<key, lastRingTimestamp> — tracks last ring time per key
  const last = new Map()

  /**
   * ring — debounced bell for a given key.
   * @param {string} key - debounce key, format "event.type:sessionId" or "event.type"
   * @param {number} now - current timestamp in ms, injectable for testing
   */
  const ring = (key, message = "OpenCode needs attention", now = Date.now()) => {
    const prev = last.get(key) || 0
    if (now - prev < DEBOUNCE_MS) return
    last.set(key, now)
    if (process.stdout && process.stdout.isTTY) {
      if (ENABLED_OUTPUTS.has("osc")) process.stdout.write(`\x1b]9;${message}\x07`)
      if (ENABLED_OUTPUTS.has("bell")) process.stdout.write(bell)
    }
  }

  return {
    event: async ({ event }) => {
      // Only handle events in the configured set, silently skip the rest
      if (!ENABLED_EVENTS.has(event?.type)) return
      const sessionId = event?.properties?.sessionID
      // Use "type:id" when sessionId exists, plain "type" when missing (no trailing colon)
      const key = sessionId ? `${event.type}:${sessionId}` : event.type
      ring(key, messages[event.type])
    },
    // Exposed for testing
    _ring: (key, now) => ring(key, undefined, now),
  }
}
