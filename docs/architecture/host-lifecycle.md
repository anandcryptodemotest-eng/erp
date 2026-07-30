# Host Lifecycle

1. Bootstrap Extension Registry (widgets, themes, activities as needed).
2. Construct Host `{ id, permissions, navigation, theme, services }`.
3. Screen Controller builds UIContext for the current screen.
4. On complete: Host.services.submit (or other service) persists domain state.
5. Host.navigation routes to the next experience.

Hosts never patch Runtime internals.
