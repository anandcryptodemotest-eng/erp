# Widget Development

Follow [create-widget.md](../guides/create-widget.md) and ADR 0009.

Invariants:

- Only `render` / `validate` / `collectPayload`
- No REST, no Host imports, no lifecycle hooks
- Style via ThemeTokens only

Prefer field types and existing widget props before registering a new widget.
