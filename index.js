import { openSync, writeSync, closeSync } from "node:fs"
// Event types that trigger the bell, comma-separated. Defaults to all four.
const DEFAULT_EVENTS = "permission.asked,question.asked,session.idle,session.error"
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
  const messages = {
    "permission.asked": "OpenCode permission requested",
    "question.asked": "OpenCode question asked",
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
    // Wrap sequences in tmux passthrough so they escape to the outer terminal
    const wrap = (seq) =>
      process.env.TMUX ? `\x1bPtmux;${seq.replace(/\x1b/g, "\x1b\x1b")}\x1b\\` : seq
    // Write to the controlling terminal (/dev/tty), not process.stdout —
    // stdout isn't the user's tmux client TTY, so unfocused windows miss the bell
    const emit = (seq) => {
      try {
        const fd = openSync("/dev/tty", "w")
        writeSync(fd, seq)
        closeSync(fd)
      } catch {}
    }
    if (ENABLED_OUTPUTS.has("osc")) emit(wrap(`\x1b]9;${message}\x07`))
    if (ENABLED_OUTPUTS.has("bell")) emit(wrap("\x07"))
  }

  return {
    event: async ({ event }) => {
      // Only handle events in the configured set, silently skip the rest
      if (!ENABLED_EVENTS.has(event?.type)) return
      if (event.type === "question.asked") {
        ring(`question:${event.properties?.sessionID}`, messages["question.asked"])
        return
      }
      const sessionId = event?.properties?.sessionID
      // Use "type:id" when sessionId exists, plain "type" when missing (no trailing colon)
      const key = sessionId ? `${event.type}:${sessionId}` : event.type
      ring(key, messages[event.type])
    },
    // Fallback path: question.asked is published inside the tool body, so also
    // ring on the tool hook. Fire-and-forget — never block the tool hook.
    "tool.execute.before": (input) => {
      if (input.tool === "question") ring(`tool:question:${input.sessionID}`, messages["question.asked"])
    },
    // Exposed for testing
    _ring: (key, now) => ring(key, undefined, now),
  }
}
