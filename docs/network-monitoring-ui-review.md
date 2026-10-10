# Network monitor screen review

The Raspberry Pi frontend routes `/network` to `NetworkScreen.jsx` through
`raspberry-platform/frontend/src/App.jsx`. This is a source review of that
screen; no application code was changed for this note.

## Findings

| Location in `NetworkScreen.jsx` | Finding | Effect |
| --- | --- | --- |
| Lines 16 and 29 | `STATE_TONE` is declared twice in the same module. | The duplicate `const` declaration prevents the module from parsing. |
| Lines 45 and 53 | `Card` is declared twice in the same module. | The duplicate function declaration makes the intended card styling ambiguous. |
| Lines 14 and 111 | `POLL_MS` is defined, but the interval uses `FALLBACK_POLL_MS`, which is not defined. | After the parse issue is resolved, the polling effect will fail instead of providing a fallback. |

The screen already has the right data path in outline: it requests
`GET /api/network/status`, subscribes to the `network` event on
`GET /api/network/stream`, and renders history and diagnostics from the status
response. The findings above block a reliable operator view of that data.

## Suggested completion checks

1. Keep a single `STATE_TONE` map and a single `Card` component.
2. Use the declared polling interval consistently, or define a separate
   fallback interval with an explicit value.
3. Build the Raspberry Pi frontend and open `/network` to confirm that the
   initial request, event stream, and polling fallback all run without a
   JavaScript error.
4. Disconnect the event stream during a manual check. The displayed
   `updated_at` value and connection state should make stale data apparent.

These checks describe follow-up work; this documentation commit does not claim
the screen has been fixed.
