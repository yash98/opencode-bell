# opencode-bell

opencode plugin that rings the terminal bell when the session goes idle, asks for permission, or errors.

## Install

Add the plugin from GitHub to `opencode.json`:

```json
{
  "plugin": ["opencode-bell"]
}
```

If installing via npm spec doesn't pick it up, point at the git repo directly:

```sh
opencode install github:yash98/opencode-bell
```

or reference it via file path after cloning:

```json
{
  "plugin": ["file:///path/to/opencode-bell/index.js"]
}
```

## Setup

1. Add to `opencode.json` (see above).
2. Restart opencode.

## Configure (optional, env vars)

```sh
export OPENCODE_BELL_EVENTS="session.idle,session.error"  # events to ring on
export OPENCODE_BELL_OUTPUTS="bell,osc"                   # bell and/or desktop notification (OSC 9)
export OPENCODE_BELL_DEBOUNCE=1200                        # debounce window, ms
```

Valid events: `permission.asked`, `question.asked`, `session.idle`, `session.error`.
